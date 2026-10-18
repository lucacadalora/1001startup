#!/usr/bin/env python3
"""Live LinkedIn company-page read (logged-out, Indonesian locale) — the census's
dated headcount source. Prints the people count ("Lihat seluruh N karyawan"),
the self-declared size band, HQ, website and name, plus the page URL and today's
UTC date to cite as employees_asof.

  python3 -I li.py <company-slug> [<slug> ...]      e.g. li.py netra-runtime kodingworks

A 404 means the slug is wrong (find the right one from the company's own site
footer or an Exa search restricted to linkedin.com). If the count is missing,
fall back to:  python3 -I exa.py contents https://www.linkedin.com/company/<slug> --live
"""
import datetime, html, re, subprocess, sys

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

def field(t, label):
    m = re.search(label + r'\s*</dt>\s*<dd[^>]*>(.*?)</dd>', t, re.S)
    if not m:
        m = re.search(label + r'.{0,400}?<dd[^>]*>(.*?)</dd>', t, re.S)
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(1)))).strip() if m else None

for slug in sys.argv[1:]:
    url = f'https://id.linkedin.com/company/{slug}'
    p = subprocess.run(['curl', '-sL', '-A', UA, '-H', 'Accept-Language: id-ID,id;q=0.9', '-m', '30',
                        '-w', '\n%{http_code}', url], capture_output=True, text=True, errors='replace')
    body, _, code = p.stdout.rpartition('\n')
    print(f'== {slug}  HTTP {code}  read {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d} UTC  {url}')
    if code != '200':
        continue
    t = body
    name = re.search(r'<title>(.*?)</title>', t, re.S)
    cnt = re.search(r'Lihat seluruh ([\d\.,]+) karyawan', t) or re.search(r'See all ([\d\.,]+) employees', t)
    num = re.search(r'"numberOfEmployees":\{"value":(\d+)', t)
    print('   name     :', html.unescape(name.group(1)).strip() if name else None)
    print('   people   :', cnt.group(1) if cnt else None, '| schema numberOfEmployees:', num.group(1) if num else None)
    for lab in ('Ukuran perusahaan', 'Kantor Pusat', 'Situs web', 'Industri', 'Didirikan', 'Jenis'):
        print(f'   {lab:16}:', field(t, lab))
    og = re.search(r'og:description" content="([^"]+)"', t)
    print('   about    :', html.unescape(og.group(1))[:400] if og else None)
    locs = re.findall(r'<p class="[^"]*">\s*([^<]{5,200}?(?:Indonesia|Singapore|Singapura|Saudi|Malaysia)[^<]{0,60})\s*</p>', t)
    if locs:
        print('   locations:', ' || '.join(dict.fromkeys(l.strip() for l in locs))[:600])
