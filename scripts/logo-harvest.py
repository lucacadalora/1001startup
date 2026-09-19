#!/usr/bin/env python3
"""Harvest logo candidates for census companies that lack a real icon.

The original census-icons.py only read <link rel=icon> out of raw HTML with a
strict regex, so it lost every site that (a) ships an SVG icon, (b) declares
icons only in a web-app manifest, (c) renders <head> from JS, or (d) blocks
plain urllib. This harvester drives a real Chromium (Playwright) instead and
rasterises every candidate through the browser's own decoder, so SVG/ICO/WEBP
all come back as 512px PNG. App-store artwork is fetched in parallel because
consumer apps almost always have a cleaner square mark than their website.

Candidates land in data/logo-candidates/<id>/<nn>-<source>.png plus meta.json;
nothing is published here — logo-pick.py chooses and builds the tile.

Usage: python3 scripts/logo-harvest.py [--ids a,b,c | --monogram] [--workers N]
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request, base64
import concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
CAND = os.path.join(ROOT, 'data', 'logo-candidates')
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")

# ---------------------------------------------------------------- app stores
def itunes(name, url):
    """App Store artwork, 512px. Matched on seller/track name or bundle host."""
    host = urllib.parse.urlparse(url or '').netloc.replace('www.', '')
    root = host.split('.')[0] if host else ''
    out = []
    for country in ('id', 'us'):
        q = urllib.parse.urlencode({'term': name, 'country': country,
                                    'entity': 'software', 'limit': 8})
        try:
            req = urllib.request.Request(f'https://itunes.apple.com/search?{q}',
                                         headers={'User-Agent': UA})
            js = json.load(urllib.request.urlopen(req, timeout=20))
        except Exception:
            continue
        for r in js.get('results', []):
            hay = f"{r.get('trackName','')} {r.get('sellerName','')} {r.get('bundleId','')} {r.get('sellerUrl','')}".lower()
            score = 0
            if root and root in hay: score += 2
            n = re.sub(r'[^a-z0-9]', '', name.lower())
            if n and n in re.sub(r'[^a-z0-9]', '', hay): score += 2
            if score:
                art = r.get('artworkUrl512') or r.get('artworkUrl100') or ''
                art = re.sub(r'/\d+x\d+bb\.(jpg|png)$', '/512x512bb.png', art)
                if art: out.append((score, art, f"appstore:{r.get('trackName','')[:40]}"))
        if out: break
    return [(s, u, t) for s, u, t in sorted(out, reverse=True)[:2]]

def play_search(name, url):
    """Google Play listing artwork (play-lh CDN, =s512)."""
    host = urllib.parse.urlparse(url or '').netloc.replace('www.', '')
    root = host.split('.')[0] if host else ''
    q = urllib.parse.urlencode({'q': name, 'c': 'apps', 'hl': 'en', 'gl': 'ID'})
    try:
        req = urllib.request.Request(f'https://play.google.com/store/search?{q}',
                                     headers={'User-Agent': UA})
        html = urllib.request.urlopen(req, timeout=20).read().decode('utf8', 'ignore')
    except Exception:
        return []
    ids = re.findall(r'/store/apps/details\?id=([A-Za-z0-9_.]+)', html)
    seen, out = set(), []
    n = re.sub(r'[^a-z0-9]', '', name.lower())
    for pid in ids:
        if pid in seen: continue
        seen.add(pid)
        pl = pid.lower()
        if not ((root and root in pl) or (n and len(n) > 3 and n in pl.replace('.', ''))):
            continue
        try:
            u = f'https://play.google.com/store/apps/details?id={pid}&hl=en&gl=ID'
            h = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}),
                                       timeout=20).read().decode('utf8', 'ignore')
            m = re.search(r'<meta property="og:image" content="([^"]+)"', h)
            if m:
                art = re.sub(r'=[sw]\d+.*$', '=s512', m.group(1))
                out.append((3, art, f'play:{pid}'))
        except Exception:
            pass
        if len(out) >= 2: break
    return out

def wikipedia(name, url):
    """Wikipedia page image — the only reliable high-res mark for older brands
    (KASKUS, tiket.com, Anteraja) whose own sites ship a 32px favicon."""
    out = []
    for lang in ('id', 'en'):
        try:
            q = urllib.parse.urlencode({'action': 'query', 'generator': 'search',
                                        'gsrsearch': name, 'gsrlimit': 3,
                                        'prop': 'pageimages', 'piprop': 'original',
                                        'format': 'json'})
            req = urllib.request.Request(f'https://{lang}.wikipedia.org/w/api.php?{q}',
                                         headers={'User-Agent': UA})
            js = json.load(urllib.request.urlopen(req, timeout=20))
            n = re.sub(r'[^a-z0-9]', '', name.lower())
            for pg in (js.get('query', {}).get('pages', {}) or {}).values():
                t = re.sub(r'[^a-z0-9]', '', pg.get('title', '').lower())
                src = (pg.get('original') or {}).get('source')
                if src and t and (t.startswith(n[:8]) or n.startswith(t[:8])):
                    out.append((2, src, f"wiki:{pg.get('title','')[:30]}"))
        except Exception:
            pass
        if out: break
    return out[:1]


# ---------------------------------------------------------------- in-browser
# Collect icon URLs from the live DOM, then draw each through an <img> onto a
# canvas so the browser rasterises SVG/ICO/WEBP for us.
COLLECT_JS = r"""
async () => {
  const out = [];
  const push = (u, tag, pri, size) => { if (u) out.push({url: new URL(u, location.href).href, tag, pri, size}); };
  for (const l of document.querySelectorAll('link[rel]')) {
    const rel = (l.getAttribute('rel') || '').toLowerCase();
    const href = l.getAttribute('href');
    if (!href) continue;
    const sz = parseInt((l.getAttribute('sizes') || '').split('x')[0]) || 0;
    if (rel.includes('apple-touch-icon')) push(href, 'apple-touch-icon', 90 + Math.min(sz, 512) / 10, sz);
    else if (/(^|\s)icon(\s|$)|shortcut icon|fluid-icon/.test(rel)) push(href, 'link-icon', 60 + Math.min(sz, 512) / 10, sz);
    else if (rel.includes('mask-icon')) push(href, 'mask-icon', 20, 0);
  }
  const man = document.querySelector('link[rel~="manifest"]');
  if (man && man.getAttribute('href')) {
    try {
      const j = await (await fetch(new URL(man.getAttribute('href'), location.href).href)).json();
      for (const ic of (j.icons || [])) {
        const sz = parseInt(String(ic.sizes || '').split('x')[0]) || 0;
        push(new URL(ic.src, new URL(man.getAttribute('href'), location.href)).href,
             'manifest', 100 + Math.min(sz, 512) / 10, sz);
      }
    } catch (e) {}
  }
  push('/apple-touch-icon.png', 'guess-apple', 40, 0);
  push('/favicon.ico', 'guess-favicon', 30, 0);
  push('/favicon.png', 'guess-favicon', 30, 0);
  push('/logo512.png', 'guess-logo512', 35, 0);
  const seen = new Set();
  return out.filter(o => !seen.has(o.url) && seen.add(o.url)).sort((a, b) => b.pri - a.pri).slice(0, 12);
}
"""

RASTER_JS = r"""
async (src) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const done = new Promise((res, rej) => { img.onload = res; img.onerror = () => rej('load'); });
  img.src = src;
  await Promise.race([done, new Promise((_, r) => setTimeout(() => r('timeout'), 12000))]);
  const nw = img.naturalWidth || 512, nh = img.naturalHeight || 512;
  if (!nw || !nh) throw 'empty';
  const S = 512, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // contain, centred — never distort a mark
  const r = Math.min(S / nw, S / nh), w = nw * r, h = nh * r;
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  return {data: c.toDataURL('image/png'), nw, nh};
}
"""

HEADER_JS = r"""
() => {
  // The visible brand lockup in the top-left of the page. Worth capturing for
  // B2B sites whose only mark is a wordmark and whose favicon is a 16px blob.
  const cands = [];
  for (const el of document.querySelectorAll('header img, nav img, [class*=header] img, [class*=navbar] img, [class*=logo] img, header svg, nav svg, [class*=logo] svg')) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 14 || r.top > 220 || r.width > 460) continue;
    const s = (el.getAttribute('src') || '') + ' ' + (el.getAttribute('alt') || '') +
              ' ' + (el.className.baseVal !== undefined ? el.className.baseVal : el.className || '');
    const score = /logo|brand|wordmark/i.test(s) ? 2 : 1;
    cands.push({score: score - r.top / 1000, x: r.x, y: r.y, w: r.width, h: r.height});
  }
  cands.sort((a, b) => b.score - a.score);
  return cands.slice(0, 2);
}
"""


AGGREGATORS = ('linkedin.com', 'linktr.ee', 'instagram.com', 'facebook.com', 'twitter.com',
               'x.com', 'play.google.com', 'apps.apple.com', 'medium.com', 'notion.site',
               'crunchbase.com', 'wa.me', 'bit.ly', 'youtube.com', 'tiktok.com')


def harvest_site(pw, c, outdir):
    """Drive Chromium at the company site; return list of (pri, path, tag)."""
    from playwright.sync_api import Error as PWError
    got = []
    url = c.get('url')
    if not url: return got
    host = urllib.parse.urlparse(url).netloc.lower()
    if any(host == a or host.endswith('.' + a) for a in AGGREGATORS):
        # would only ever yield the platform's own mark
        got.append((-1, None, f'SKIP aggregator host {host}'))
        return got
    browser = pw.chromium.launch(args=['--disable-dev-shm-usage'])
    ctx = browser.new_context(user_agent=UA, viewport={'width': 1280, 'height': 900},
                              ignore_https_errors=True, locale='en-US')
    page = ctx.new_page()
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=45000)
        page.wait_for_timeout(2500)
        cands = page.evaluate(COLLECT_JS)
        n = 0
        for cand in cands:
            try:
                res = page.evaluate(RASTER_JS, cand['url'])
            except PWError:
                continue
            except Exception:
                continue
            if not res: continue
            b = base64.b64decode(res['data'].split(',', 1)[1])
            tag = f"{cand['tag']}-{res['nw']}x{res['nh']}"
            p = os.path.join(outdir, f"{n:02d}-site-{re.sub(r'[^a-z0-9-]', '', tag.lower())}.png")
            open(p, 'wb').write(b)
            got.append((cand['pri'] + min(res['nw'], 512) / 20, p, tag))
            n += 1
        for i, hb in enumerate(page.evaluate(HEADER_JS) or []):
            try:
                p = os.path.join(outdir, f'h{i:02d}-header.png')
                page.screenshot(path=p, clip={'x': hb['x'] - 4, 'y': hb['y'] - 4,
                                              'width': hb['w'] + 8, 'height': hb['h'] + 8})
                got.append((25 - i, p, f"header-{int(hb['w'])}x{int(hb['h'])}"))
            except Exception:
                pass
    except Exception as e:
        got.append((-1, None, f'ERR {type(e).__name__}: {str(e)[:70]}'))
    finally:
        try: ctx.close(); browser.close()
        except Exception: pass
    return got

def fetch_url_png(url, path):
    if url.lower().split('?')[0].endswith('.svg'):
        return svg_to_png(url, path)   # PIL cannot open SVG; rasterise in Chromium
    try:
        b = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=25).read()
        if len(b) < 800: return False
        from PIL import Image
        from io import BytesIO
        im = Image.open(BytesIO(b)); im.load()
        im.convert('RGBA').save(path)
        return True
    except Exception:
        return False

def svg_to_png(url, path, size=512):
    """Render a vector logo through Chromium — the only way to get a raster of an
    SVG-only brand asset at a useful size."""
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch(args=['--disable-dev-shm-usage'])
            pg = br.new_context(user_agent=UA, viewport={'width': size, 'height': size},
                                device_scale_factor=2).new_page()
            # transparent backdrop: a white knocked-out logo would vanish on a white
            # page, and the tile builder needs the alpha to pick its card colour
            pg.set_content(f'<body style="margin:0;background:transparent;display:flex;'
                           f'align-items:center;justify-content:center;height:{size}px">'
                           f'<img src="{url}" style="max-width:{size - 24}px;max-height:{size - 24}px">')
            pg.wait_for_timeout(2500)
            pg.screenshot(path=path, omit_background=True)
            br.close()
        return os.path.getsize(path) > 800
    except Exception:
        return False


def run_one(c):
    outdir = os.path.join(CAND, c['id'])
    os.makedirs(outdir, exist_ok=True)
    meta = {'id': c['id'], 'name': c['name'], 'url': c.get('url'), 'candidates': [], 'errors': []}
    # app stores first (cheap, no browser)
    n = 0
    for score, u, tag in (itunes(c['name'], c.get('url')) + play_search(c['name'], c.get('url'))
                          + wikipedia(c['name'], c.get('url'))):
        p = os.path.join(outdir, f"s{n:02d}-{re.sub(r'[^a-z0-9]', '', tag.split(':')[0])}.png")
        if fetch_url_png(u, p):
            meta['candidates'].append({'pri': 150 + score, 'path': os.path.relpath(p, ROOT), 'tag': tag, 'src': u})
            n += 1
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        for pri, p, tag in harvest_site(pw, c, outdir):
            if p is None: meta['errors'].append(tag)
            else: meta['candidates'].append({'pri': pri, 'path': os.path.relpath(p, ROOT), 'tag': tag})
    meta['candidates'].sort(key=lambda x: -x['pri'])
    json.dump(meta, open(os.path.join(outdir, 'meta.json'), 'w'), indent=1)
    return meta

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='')
    ap.add_argument('--monogram', action='store_true')
    ap.add_argument('--workers', type=int, default=3)
    ap.add_argument('--from-urls', default='',
                    help='file of "<id> <image-url>" lines: stash a hand-sourced '
                         'image as a candidate for companies the crawl cannot reach')
    a = ap.parse_args()
    raw = json.load(open(RAW))
    if a.from_urls:
        n_ok = 0
        for line in open(a.from_urls):
            line = line.strip()
            if not line or line.startswith('#'): continue
            cid, u = line.split(None, 1)
            d = os.path.join(CAND, cid); os.makedirs(d, exist_ok=True)
            k = len([f for f in os.listdir(d) if f.startswith('m')])
            p_ = os.path.join(d, f'm{k:02d}-manual.png')
            ok = fetch_url_png(u.strip(), p_)
            print(f"  {cid:32s} {'ok' if ok else 'FAILED'}  {u.strip()[:70]}")
            if ok:
                n_ok += 1
                mp = os.path.join(d, 'meta.json')
                meta = json.load(open(mp)) if os.path.exists(mp) else {'id': cid, 'candidates': [], 'errors': []}
                meta['candidates'].insert(0, {'pri': 999, 'path': os.path.relpath(p_, ROOT),
                                              'tag': 'manual', 'src': u.strip()})
                json.dump(meta, open(mp, 'w'), indent=1)
        print(f'{n_ok} manual candidates stored'); return
    if a.ids:
        want = set(a.ids.split(','))
        cs = [c for c in raw['companies'] if c['id'] in want]
    elif a.monogram:
        cs = [c for c in raw['companies'] if c.get('logo_src') == 'monogram']
    else:
        print('pick --ids or --monogram'); sys.exit(2)
    os.makedirs(CAND, exist_ok=True)
    print(f'harvesting {len(cs)} companies with {a.workers} workers')
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for m in ex.map(run_one, cs):
            print(f"  {m['id']:32s} {len(m['candidates']):2d} candidates "
                  f"{'| ' + '; '.join(m['errors']) if m['errors'] else ''}")

if __name__ == '__main__':
    main()
