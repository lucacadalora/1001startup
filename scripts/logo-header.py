#!/usr/bin/env python3
"""Capture a company's nav wordmark at 3x device scale.

Some sites carry their brand only as an inline <svg> in the header — there is no
icon file to download, and a 1x screenshot of it is a grey smudge at tile size.
This shoots the logo element alone on a forced-white backdrop at deviceScaleFactor
3, which is what makes a wordmark legible once it is scaled into a 256px tile.

Usage: python3 scripts/logo-header.py <id>[:<url>] [...]
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, 'data', 'logo-candidates')
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")

PICK_JS = r"""
() => {
  const cands = [];
  const sel = 'header img, header svg, nav img, nav svg, [class*=header] img, [class*=header] svg, ' +
              '[class*=navbar] img, [class*=navbar] svg, [class*=logo] img, [class*=logo] svg, a[href="/"] img, a[href="/"] svg';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 14 || r.top > 240 || r.width > 500) continue;
    const cls = (el.className && el.className.baseVal !== undefined) ? el.className.baseVal : (el.className || '');
    const hay = `${el.getAttribute('src') || ''} ${el.getAttribute('alt') || ''} ${cls} ${el.id || ''}`;
    cands.push({score: (/logo|brand|wordmark/i.test(hay) ? 3 : 1) - r.top / 500 - (r.width > 320 ? 1 : 0),
                x: r.x, y: r.y, w: r.width, h: r.height});
  }
  cands.sort((a, b) => b.score - a.score);
  // white backdrop: many navs are transparent over a hero image or dark bar
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:2147483646';
  document.body.appendChild(d);
  for (const c of cands.slice(0, 2)) {
    const el = document.elementFromPoint(-1, -1);  // no-op; keep structure simple
  }
  d.remove();
  return cands.slice(0, 2);
}
"""

WHITEN_JS = r"""
() => {
  // Force a white page behind the nav so a transparent/inverted logo still reads.
  const s = document.createElement('style');
  s.textContent = `html,body{background:#fff !important}
    header,nav,[class*=header],[class*=navbar]{background:#fff !important;
      background-image:none !important;box-shadow:none !important}`;
  document.head.appendChild(s);
}
"""

def shoot(pw, cid, url):
    br = pw.chromium.launch(args=['--disable-dev-shm-usage'])
    ctx = br.new_context(user_agent=UA, viewport={'width': 1400, 'height': 900},
                         device_scale_factor=3, ignore_https_errors=True)
    page = ctx.new_page()
    n = 0
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(3500)
        boxes = page.evaluate(PICK_JS)
        page.evaluate(WHITEN_JS)
        page.wait_for_timeout(400)
        d = os.path.join(CAND, cid); os.makedirs(d, exist_ok=True)
        for i, b in enumerate(boxes):
            p = os.path.join(d, f'x{i:02d}-hdr3x.png')
            page.screenshot(path=p, clip={'x': max(0, b['x'] - 3), 'y': max(0, b['y'] - 3),
                                          'width': b['w'] + 6, 'height': b['h'] + 6})
            mp = os.path.join(d, 'meta.json')
            meta = json.load(open(mp)) if os.path.exists(mp) else {'id': cid, 'candidates': [], 'errors': []}
            meta['candidates'].insert(0, {'pri': 500 - i, 'path': os.path.relpath(p, ROOT), 'tag': 'hdr3x'})
            json.dump(meta, open(mp, 'w'), indent=1)
            n += 1
    except Exception as e:
        print(f'  {cid:26s} ERR {str(e)[:70]}')
    finally:
        try: ctx.close(); br.close()
        except Exception: pass
    return n

raw = json.load(open(os.path.join(ROOT, 'data', 'census-raw.json')))
urls = {c['id']: c.get('url') for c in raw['companies'] if 'id' in c}
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    for arg in sys.argv[1:]:
        cid, _, u = arg.partition(':')
        u = u or urls.get(cid)
        if not u: print(f'  {cid:26s} no url'); continue
        print(f'  {cid:26s} {shoot(pw, cid, u)} shots')
