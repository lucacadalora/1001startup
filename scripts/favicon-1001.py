#!/usr/bin/env python3
"""Favicon set for 1001startup.id.

Why this exists (Luca, Aug 31 2026, from a Bing SERP screenshot: "that 1001
startup id favicon stil lworng"): the site shipped ONE 256px PNG and no
/favicon.ico at the root, so search engines fell back to a generic globe.
Two rules drive the design:

  - Search engines render the icon at 16-24px. The header's brand mark
    (hairline box + "1001" on one line) turns to mush at that size — tested.
    Stacked "10/01" reversed out of solid ink stays legible at 16px and holds
    on both light and dark SERP grounds.
  - Google wants square icons that are a multiple of 48px, reachable at a
    stable URL. So: 48/96/144/192 PNGs, a 180 apple-touch, and a
    multi-resolution favicon.ico (16/32/48) served at the ROOT by a
    host-aware route in server.js (public/ is shared with PASAR, so the file
    cannot simply be dropped there).

Run: python3 scripts/favicon-1001.py   (needs Playwright chromium + Pillow)
"""
import os, subprocess, sys, tempfile

ROOT = '/home/ubuntu/projects/pasar-vantis'
OUT = os.path.join(ROOT, 'public', 'assets')
FONT = os.path.join(ROOT, 'public', 'assets', 'fonts', 'plex-mono-500.woff2')
# 512 is the master ON PURPOSE. Rendering larger and reducing 32-64x eats the
# mono strokes (1024 -> 16 tested as grey mush); 512 -> 16 still reads.
MASTER = 512

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:'PM';font-weight:500;src:url(file://{FONT}) format('woff2')}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{MASTER}px;height:{MASTER}px}}
body{{background:#000;display:grid;place-items:center;overflow:hidden}}
b{{font:500 250px/0.92 'PM',monospace;color:#fff;letter-spacing:-10px;
   text-align:center;display:block;text-indent:-10px}}
</style></head><body><b>10<br>01</b></body></html>"""


def main():
    from PIL import Image
    chrome = subprocess.run(
        "ls ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | head -1",
        shell=True, capture_output=True, text=True).stdout.strip()
    if not chrome:
        print('no chromium found', file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory() as td:
        page = os.path.join(td, 'fav.html')
        png = os.path.join(td, 'master.png')
        open(page, 'w').write(HTML)
        subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu',
                        '--allow-file-access-from-files', '--hide-scrollbars',
                        # without a time budget the shot can land before the
                        # webfont does, and the icon comes out empty
                        '--virtual-time-budget=3000',
                        f'--window-size={MASTER},{MASTER}', f'--screenshot={png}',
                        'file://' + page], capture_output=True)
        master = Image.open(png).convert('RGBA')

    # Google: square, multiple of 48. Apple touch icon: 180.
    for px in (48, 96, 144, 192, 512):
        master.resize((px, px), Image.LANCZOS).save(
            os.path.join(OUT, f'favicon-1001-{px}.png'), optimize=True)
    master.resize((180, 180), Image.LANCZOS).save(
        os.path.join(OUT, 'apple-touch-icon-1001.png'), optimize=True)
    # the legacy path every 1001 view already references stays valid, now 192
    master.resize((192, 192), Image.LANCZOS).save(
        os.path.join(OUT, 'favicon-1001.png'), optimize=True)
    # multi-resolution .ico — the file Bing and old clients look for at the root
    master.save(os.path.join(OUT, 'favicon-1001.ico'), format='ICO',
                sizes=[(16, 16), (32, 32), (48, 48)])
    print('favicon set written:', ', '.join(sorted(
        f for f in os.listdir(OUT) if f.startswith(('favicon-1001', 'apple-touch-icon-1001')))))
    return 0


if __name__ == '__main__':
    sys.exit(main())
