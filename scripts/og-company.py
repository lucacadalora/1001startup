#!/usr/bin/env python3
"""Per-company OG share cards for 1001startup.id.

One 1200x630 card per census company: logo, name, and the row's key figures —
so a shared /company/<id> link renders as that company's card, not the generic
site card. Same discipline as the pages: only fields the row carries, nothing
invented, the est/valuation kind wording preserved.

Writes public/assets/og-c-<id>-<hash8>.png (content-hashed FILENAME — the CF
edge caches /assets for 30 days and the purge token is DNS-only) and the
single-writer manifest data/og-cards.json {id: "/assets/og-c-...png"} that
server.js reads (mtime-cached) and hands to the company view. Old hashes for
the same id are deleted. Idempotent: unchanged data -> same hash -> no churn.

Run after a census data change:  python3 scripts/og-company.py
(uses Playwright's chromium; ~3-4 min for the full census)
"""
import hashlib, html, json, os, re, sys

ROOT = '/home/ubuntu/projects/pasar-vantis'
OUT_DIR = os.path.join(ROOT, 'public', 'assets')
MANIFEST = os.path.join(ROOT, 'data', 'og-cards.json')
FONT_G = os.path.join(ROOT, 'public', 'assets', 'fonts', 'overused-grotesk-vf.woff2')
FONT_M = os.path.join(ROOT, 'public', 'assets', 'fonts', 'plex-mono-400.woff2')

def money(n):
    if n is None: return None
    if n >= 10: return f'{n:,.0f}' if float(n).is_integer() else f'{n:,.1f}'
    return f'{n:,.1f}' if n >= 1 else f'{n:,.2f}'

def card_html(c):
    name = c['name']
    size = 76 if len(name) <= 16 else 62 if len(name) <= 26 else 50
    logo = c.get('logo') or ''
    logo_fs = os.path.join(ROOT, 'public', logo.lstrip('/')) if logo else ''
    logo_tag = f'<img class="lg" src="file://{html.escape(logo_fs)}">' if logo and os.path.exists(logo_fs) else ''
    facts = []
    def usd(m):
        # Indonesian shorthand: M = miliar — never print a bare M on an ID card
        return f'{(m / 1000):,.1f} MILIAR' if m >= 1000 else f'{money(m)} JUTA'
    if c.get('funding_total_usd_m') is not None:
        facts.append(f'PENDANAAN US${usd(c["funding_total_usd_m"])}')
    if c.get('valuation_usd_m') is not None:
        k = 'KAP. PASAR' if c.get('valuation_kind') == 'listed' else 'EST. VALUASI' if (c.get('valuation_est') or c.get('valuation_kind') == 'est') else 'VALUASI'
        facts.append(f'{k} US${usd(c["valuation_usd_m"])}')
    if c.get('employees_est') is not None:
        facts.append(f'{c["employees_est"]:,} PEKERJA')
    if c.get('kota'):
        facts.append(c['kota'].upper())
    fact_line = ' · '.join(facts)
    legal = c.get('legal_name') or ''
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:'OG';font-style:normal;font-weight:300 900;src:url(file://{FONT_G}) format('woff2')}}
@font-face{{font-family:'PM';font-weight:400;src:url(file://{FONT_M}) format('woff2')}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1200px;height:630px;background:#fff;font-family:'OG',sans-serif;color:#000;position:relative;overflow:hidden}}
.bar{{position:absolute;top:0;left:0;right:0;height:12px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}}
.in{{position:absolute;inset:12px 0 0 0;padding:66px 84px 58px;display:flex;flex-direction:column}}
.kick{{font:400 20px/1 'PM',monospace;letter-spacing:.10em;text-transform:uppercase;color:#8E8E93;display:flex;gap:13px;align-items:center}}
.kick .sq{{width:11px;height:11px;background:#000}}
.mid{{margin-top:84px;display:flex;gap:36px;align-items:flex-start}}
.lg{{width:104px;height:104px;object-fit:contain;border:2px solid #E7E7E7;background:#fff;flex:0 0 auto}}
.nm{{font-size:{size}px;line-height:1.06;letter-spacing:-0.025em;font-weight:600;max-width:15ch}}
.legal{{font:400 19px/1.4 'PM',monospace;text-transform:uppercase;letter-spacing:.05em;color:#8E8E93;margin-top:16px}}
.facts{{margin-top:auto;font:400 22px/1.5 'PM',monospace;letter-spacing:.05em;color:#000;border-top:3px solid #000;padding-top:24px;max-width:1032px}}
.foot{{margin-top:20px;display:flex;justify-content:space-between;font:400 19px/1 'PM',monospace;letter-spacing:.07em;text-transform:uppercase;color:#8E8E93}}
</style></head><body>
<div class="bar"></div>
<div class="in">
  <div class="kick"><span class="sq"></span>SENSUS #{c.get('rank','')} · 1001STARTUP.ID</div>
  <div class="mid">{logo_tag}<div><div class="nm">{html.escape(name)}</div>
  {f'<div class="legal">{html.escape(legal)}</div>' if legal else ''}</div></div>
  <div class="facts">{html.escape(fact_line)}</div>
  <div class="foot"><span>SENSUS STARTUP INDONESIA</span><span>SUMBER PUBLIK · ESTIMASI BERLABEL</span></div>
</div>
</body></html>"""

def main():
    from playwright.sync_api import sync_playwright
    data = json.load(open(os.path.join(ROOT, 'public', 'data', 'census.json')))
    companies = data.get('companies', [])
    manifest = {}
    made = kept = 0
    # set_content() pages are about:blank-origin and silently BLOCK file://
    # subresources (fonts + logos render as fallbacks) — the page must itself
    # be a file:// URL for --allow-file-access-from-files to apply.
    tmp = '/tmp/og-card-render.html'
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu'])
        pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for c in companies:
            with open(tmp, 'w') as f:
                f.write(card_html(c))
            pg.goto('file://' + tmp, wait_until='networkidle')
            png = pg.screenshot(clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630})
            h = hashlib.md5(png).hexdigest()[:8]
            fname = f'og-c-{c["id"]}-{h}.png'
            fpath = os.path.join(OUT_DIR, fname)
            if os.path.exists(fpath):
                kept += 1
            else:
                # sweep stale hashes for this id, then write the new one
                for old in os.listdir(OUT_DIR):
                    if re.fullmatch(re.escape(f'og-c-{c["id"]}-') + r'[0-9a-f]{8}\.png', old) and old != fname:
                        os.remove(os.path.join(OUT_DIR, old))
                with open(fpath, 'wb') as f:
                    f.write(png)
                made += 1
            manifest[c['id']] = '/assets/' + fname
        b.close()
    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=1, sort_keys=True)
    print(f'og cards: {made} written, {kept} unchanged, manifest {len(manifest)} -> {MANIFEST}')

if __name__ == '__main__':
    sys.exit(main())
