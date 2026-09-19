#!/usr/bin/env python3
"""Liveness screen for the census — is every company still actually operating?

Luca, Aug 29 2026: "you need to aware that qlue is not exist anymore, fix it,
dont let our consensus is not legit by allowing those data, screen it."

A funding-first screen is not enough: a company can have a verified PT, a real
address and a sourced funding round, and still be dead. This runs the two checks
that actually catch that, over every row:

  1. WEBSITE  — fetch the URL (HTTP/1.1, browser UA, apex<->www retry) and look
     for: unreachable, HTTP >= 400, a body too small to be a real page, and
     PARKED/for-sale placeholders (the "window.location.href=/lander" stub that
     caught Andalin and wagely's old domain).
  2. STATUS   — one Exa query per company, scanned for shutdown/liquidation/
     licence-revocation/layoff language and for a reported headcount.

It REPORTS; it does not delete. Every removal is a judgment call that needs a
human-checked reason, and false positives are common: Cloudflare returns 403 to
this VM for perfectly healthy companies (Blibli, Halodoc, Traveloka), and
keyword hits are often contaminated by an unrelated article on the same page.
Confirmed removals belong in census-raw.json's `removed` register, with the
evidence, so the next sweep does not re-add them.

    python3 scripts/census-liveness.py            # full screen -> report
    python3 scripts/census-liveness.py --stamp    # also stamp site_status/liveness_checked
    python3 scripts/census-liveness.py --only a,b # screen just these ids (a new
                                                  # cohort does not need the
                                                  # other 300 rows re-queried)
"""
import json, os, re, subprocess, sys, concurrent.futures as cf
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
OUT = os.path.join(ROOT, 'data', 'census-liveness.json')
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

PARKED = re.compile(r'window\.location\.href="/lander"|domain (?:is )?for sale|parkingcrew|sedoparking|'
                    r'buy this domain|premium domain marketplace', re.I)
DEATH = re.compile(r'(gulung tikar|tutup permanen|berhenti beroperasi|shut ?down|shutting down|ceased operations|'
                   r'dibubarkan|pembubaran|likuidasi|liquidat|bangkrut|pailit|izin dicabut|licence revoked|'
                   r'license revoked|defunct|wound down|winding down|no longer operat|menghentikan operasi|'
                   r'resmi tutup|tutup layanan)', re.I)
EMP = re.compile(r'employs ([\d,]+) (?:people|person)', re.I)


def fetch(url):
    try:
        r = subprocess.run(["curl", "-sL", "-m", "22", "--http1.1", "-A", UA, "-w",
                            "\n%{http_code}|%{size_download}|%{url_effective}", url],
                           capture_output=True, text=True, timeout=40)
        body = r.stdout or ""
        code, size, final = (body.rsplit("\n", 1)[-1].split("|") + ["", "", ""])[:3]
        return code, int(size or 0), final, body[:4000]
    except Exception:
        return "ERR", 0, "", ""


def site_check(c):
    u = c.get('url')
    if not u:
        return {"status": "no-url"}
    code, size, final, body = fetch(u)
    if code in ("000", "ERR"):
        alt = u.replace("://www.", "://") if "://www." in u else u.replace("://", "://www.")
        code2, size2, final2, body2 = fetch(alt)
        if code2 not in ("000", "ERR"):
            code, size, final, body = code2, size2, final2, body2
    if PARKED.search(body):
        return {"status": "parked", "code": code, "size": size}
    if code in ("000", "ERR"):
        return {"status": "unreachable", "code": code, "size": size}
    if code.isdigit() and int(code) >= 400:
        # 403/401/429 is usually a bot wall in front of a healthy site, not a dead one
        return {"status": "blocked-or-error", "code": code, "size": size}
    if size < 800:
        return {"status": "empty-body", "code": code, "size": size}
    return {"status": "ok", "code": code, "size": size}


def status_probe(c, exa):
    legal = (c.get('legal_name') or '').split('(')[0].strip()
    q = f"{c['name']} {legal} Indonesia status {date.today().year} tutup shut down berhenti beroperasi PHK akuisisi karyawan"
    try:
        r = exa(q, 4, 1200)
    except Exception as e:
        return {"probe_error": str(e)}
    txt = " ".join((x.get("text") or "") for x in r.get("results", []))
    m = DEATH.search(txt)
    return {
        "death_hits": [x.group(0) for x in DEATH.finditer(txt)][:3],
        "death_context": txt[max(0, m.start() - 120):m.start() + 140].replace("\n", " ") if m else "",
        "reported_headcounts": [int(x.group(1).replace(',', '')) for x in EMP.finditer(txt)][:3],
        "sources": [x.get("url") for x in r.get("results", [])][:3],
    }


def only_ids(argv):
    """--only a,b,c — screen a subset. A merge that adds sixteen rows should not
    have to re-query three hundred, and the report/stamps for the rest are left
    exactly as the last full run wrote them."""
    for i, a in enumerate(argv):
        if a == '--only' and i + 1 < len(argv):
            return {x.strip() for x in argv[i + 1].split(',') if x.strip()}
        if a.startswith('--only='):
            return {x.strip() for x in a.split('=', 1)[1].split(',') if x.strip()}
    return None


def main():
    stamp = '--stamp' in sys.argv
    raw = json.load(open(RAW, encoding='utf-8'))
    cos = raw['companies']
    pick = only_ids(sys.argv)
    if pick:
        cos = [c for c in cos if c.get('id') in pick]
        missing = pick - {c.get('id') for c in cos}
        if missing:
            raise SystemExit('--only: no such id: ' + ', '.join(sorted(missing)))
        print(f'screening {len(cos)} of {len(raw["companies"])} rows')

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    exa = None
    try:  # status probe is optional — the site check works without a key
        import urllib.request
        env = {}
        for line in open(os.path.expanduser('~/.openclaw/secrets/exa.env')):
            if '=' in line:
                k, v = line.strip().split('=', 1)
                env[k] = v
        key = env.get('EXA_API_KEY')

        def exa(query, n=4, chars=1200):
            body = json.dumps({"query": query, "numResults": n,
                               "contents": {"text": {"maxCharacters": chars}}}).encode()
            req = urllib.request.Request("https://api.exa.ai/search", data=body,
                                         headers={"x-api-key": key, "Content-Type": "application/json"})
            return json.load(urllib.request.urlopen(req, timeout=60))
    except Exception as e:
        print(f"(no Exa key — site check only: {e})")

    report = []
    with cf.ThreadPoolExecutor(12) as ex:
        sites = list(ex.map(site_check, cos))
    if exa:
        with cf.ThreadPoolExecutor(10) as ex:
            probes = list(ex.map(lambda c: status_probe(c, exa), cos))
    else:
        probes = [{} for _ in cos]

    today = date.today().isoformat()
    for c, s, p in zip(cos, sites, probes):
        row = {"id": c.get('id'), "name": c['name'], "url": c.get('url'), **s, **p}
        report.append(row)
        if stamp:
            c['site_status'] = s.get('status')
            c['liveness_checked'] = today

    suspects = [r for r in report if r.get('status') in ('parked', 'unreachable', 'empty-body', 'no-url')
                or r.get('death_hits')]
    # A --only run screens a subset, so it MERGES into the report rather than
    # replacing it: the report is what /closed reads for "taken out" and what
    # the landing counts for site_ok, and a partial run must not shrink either.
    rows = report
    if pick:
        try:
            prev = json.load(open(OUT, encoding='utf-8')).get('rows', [])
        except Exception:
            prev = []
        fresh = {r['id'] for r in report}
        rows = [r for r in prev if r.get('id') not in fresh] + report
    json.dump({"checked": today, "rows": rows}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    if stamp:
        # indent=2 like every other writer of this file — a one-line 700KB dump
        # makes any later diff unreadable and races badly with a parallel editor
        json.dump(raw, open(RAW, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    print(f"screened {len(report)} companies -> {OUT}")
    print(f"{len(suspects)} need a human look:\n")
    for r in sorted(suspects, key=lambda x: x['name']):
        bits = [r.get('status')]
        if r.get('death_hits'):
            bits.append('death-words: ' + ', '.join(r['death_hits'][:2]))
        if r.get('reported_headcounts'):
            bits.append(f"headcount seen: {r['reported_headcounts']}")
        print(f"  {r['name'][:30]:30} {' | '.join(str(b) for b in bits if b)[:110]}")
    print("\nKeyword hits are frequently contaminated by an unrelated article on the same page — "
          "read the context in the JSON before removing anything.")


if __name__ == '__main__':
    main()
