#!/usr/bin/env python3
"""Cut the display font down to the writing system the site actually uses.

Overused Grotesk ships as a 92KB variable font carrying 1,361 glyphs — Cyrillic,
Greek and the rest of a global Latin set. PASAR is English and Indonesian, and
that file is preloaded on every page, so it competes with the map data for the
first seconds of a phone's connection. Keeping all of Latin (through Extended-B),
punctuation, arrows, currency and the geometric marks the design system uses
leaves every character any page or merchant name has ever needed.

Re-runnable; the original is left in place.
"""
import os, subprocess, sys
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'public', 'assets', 'fonts')

RANGES = ','.join([
    'U+0000-00FF',   # Basic Latin + Latin-1 (accented vowels, ×, ÷)
    'U+0100-024F',   # Latin Extended-A/B
    'U+02B0-02FF',   # spacing modifiers
    'U+0300-036F',   # combining marks
    'U+2000-206F',   # general punctuation — · — – ‘ ’ “ ” … ‹ ›
    'U+1E00-1EFF',   # Latin Extended Additional — Vietnamese and friends
    'U+2070-209F',   # super/subscripts
    'U+20A0-20BF',   # currency, incl. ₫ ₱
    'U+2100-214F',   # letterlike — № ™ ℮
    'U+2190-21FF',   # arrows — → ↗ ↓
    'U+2200-22FF',   # maths — ≥ ≤ ≈ ∞
    'U+2500-257F',   # box drawing
    'U+25A0-25FF',   # geometric — ▪ ● ◎ the eyebrows use
    'U+2600-26FF',   # misc symbols
    'U+FEFF', 'U+FFFD',
])

TARGETS = [('overused-grotesk-vf.woff2', 'overused-grotesk-vf-latin.woff2')]

def main():
    for src, dst in TARGETS:
        s = os.path.join(FONTS, src)
        d = os.path.join(FONTS, dst)
        if not os.path.exists(s):
            print(f'skip {src}: not found'); continue
        # Name every OpenType feature the source carries. '*' quietly keeps only
        # the default set here, which drops tnum/subs/sups and the stylistic
        # sets — and site.css does ask for tabular figures.
        feats = sorted({f.FeatureTag for f in TTFont(s)['GSUB'].table.FeatureList.FeatureRecord})
        subprocess.run([sys.executable, '-m', 'fontTools.subset', s,
                        f'--unicodes={RANGES}',
                        '--layout-features=' + ','.join(feats),
                        '--flavor=woff2',
                        '--output-file=' + d], check=True)
        print(f'{src} {os.path.getsize(s)/1024:.0f}K -> {dst} {os.path.getsize(d)/1024:.0f}K')

if __name__ == '__main__':
    main()
