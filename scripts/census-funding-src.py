#!/usr/bin/env python3
"""census-funding-src.py — pick, per funded company, the ONE public URL that best
evidences its funding figure, and record how strong that evidence is.

Luca, Aug 29 2026: "we need to put a link of the funding information, so it not
looks like an assumption". Every funding number on 1001startup.id must be
clickable through to its source, and a figure that exists only on an aggregator
must SAY so rather than borrow the authority of a round announcement.

Writes three fields on each funded company (idempotent, nulls-safe):
  funding_src        the chosen URL
  funding_src_tier   announced | tracker   (announced = press / VC / the company
                     or its investor saying it; tracker = Crunchbase-class only)
  funding_src_all    every source that looks like funding evidence (for the hover)

Rows where nothing in `sources` evidences the money are left WITHOUT funding_src
and printed as a research queue — never papered over with a company contact page.
"""
import json, re, sys, urllib.parse as up, os, tempfile

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'census-raw.json')

# --- domain classes -------------------------------------------------------
PRESS = ('techcrunch.com', 'dealstreetasia.com', 'technode.global', 'e27.co', 'techinasia.com',
         'katadata.co.id', 'kontan.co.id', 'bisnis.com', 'dailysocial.id', 'thejakartapost.com',
         'jakartaglobe.id', 'asia.nikkei.com', 'bloomberg.com', 'reuters.com', 'prnewswire.com',
         'businesswire.com', 'forbes.com', 'kr-asia.com', 'kumparan.com', 'cnbcindonesia.com',
         'tempo.co', 'antaranews.com', 'detik.com', 'swa.co.id', 'marketeers.com', 'kompas.id',
         'fintechnews.sg', 'fintechfutures.com', 'fintech.global', 'thepaypers.com', 'finsmes.com',
         'digitalnewsasia.com', 'hybrid.co.id', 'edtechreview.in', 'insideretail.asia', 'aimgroup.com',
         'businesstimes.com.sg', 'gamesindustry.biz', 'seafoodsource.com', 'biobanking.com',
         'indotelko.com', 'youngster.id', 'backscoop.com', 'medcom.id', 'nasdaq.com', 'avcj.com',
         'venturesea.co', 'jakartapost.com', 'techinasia', 'dealstreetasia', 'theedgesingapore.com',
         'indonesiabusinesspost.com', 'tnglobal.com', 'globenewswire.com', 'straitstimes.com')
VC    = ('east.vc', 'alphajwc.com', 'vertexventures.sg', 'acv.vc', 'intudo.com', 'intudovc.com',
         'openspace.vc', 'sequoiacap.com', 'peakxv.com', 'ycombinator.com', 'antler.co', '500.co',
         'insignia', 'mdi.co.id', 'mdi.vc', 'venturra', 'skystar', 'wavemaker', 'jungle-ventures',
         'b-capital', 'northstar', 'generalatlantic.com', 'accion.org', 'lendable.io', 'saratoga-investama.com',
         'investible.com', 'gunder.com', 'preqin.com', 'p4gpartnerships.org', 'sosv.com')
TRACK = ('crunchbase.com', 'cbinsights.com', 'dealroom.co', 'tracxn.com', 'pitchbook.com', 'craft.co',
         'motherbase.ai', 'seedtable', 'thecompanycheck', 'getlatka.com', 'growjo', 'latka',
         'startupranking', 'prospeo.io', 'bouncewatch.com', 'premieralts.com', 'gaebler.com')
WEAK  = ('linkedin.com', 'leadiq.com', 'zoominfo.com', 'glints.com', 'jobstreet.com', 'reveliolabs.com',
         'dnb.com', 'idalamat.com', 'companieshouse.id', 'rocketreach', 'apollo.io', 'signalhire',
         'lokasiterdekat.com', 'cushmanwakefield.com', 'rencanamu.id', 'hr.asia', 'wikipedia.org')

# a URL earns its place only if it reads like money changing hands
MONEY = re.compile(r'(fund|raise|raises|raised|invest|investment|investasi|pendanaan|raih|galang|'
                   r'seri[ae]s?[-_/]?[abcde]\b|seed|round|secure|snag|land[s]?[-_]|close[sd]?[-_]|'
                   r'press[-_]?release|financial|valuation|ipo|initial-public-offering|prospectus|'
                   r'shares|acquisition|m-?and-?a)', re.I)
# pages that describe the company, not the money
# ...matched on PATH SEGMENTS only: substring matching turned "pinhome-boosts-…"
# into a "home" page and threw away a real Katadata round story.
NONMONEY = {'contact', 'contact-us', 'hubungi', 'hubungi-kami', 'about', 'about-us', 'tentang',
            'tentang-kami', 'our-location', 'location', 'locations', 'team', 'career', 'careers',
            'employees', 'profilemember', 'member', 'kontak', 'edukasi', 'home', 'profile'}


def host(u):
    try:
        return up.urlparse(u).netloc.replace('www.', '').lower()
    except Exception:
        return ''


def cls(u):
    n = host(u)
    for grp, t in ((PRESS, 'press'), (VC, 'vc'), (TRACK, 'tracker'), (WEAK, 'weak')):
        if any(p in n for p in grp):
            return t
    return 'other'


def score(u, company_host):
    """Higher = better evidence for a funding figure."""
    k = cls(u)
    base = {'press': 60, 'vc': 55, 'other': 30, 'tracker': 20, 'weak': 0}[k]
    s = base
    if MONEY.search(u):
        s += 25
    segs = {x for seg in up.urlparse(u).path.lower().split('/') for x in [seg, *seg.split('-')] if x}
    if segs & NONMONEY and not MONEY.search(u):
        s -= 45
    # the company's own newsroom announcing its own round is primary evidence
    if company_host and company_host in host(u) and MONEY.search(u):
        s += 10
    # tracker pages that at least point at the funding tab
    if k == 'tracker' and re.search(r'(financ|funding|investors)', u, re.I):
        s += 8
    return s


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    queue, stats = [], {'announced': 0, 'tracker': 0, 'none': 0}
    for c in raw['companies']:
        f = c.get('funding_total_usd_m')
        if f is None or f <= 0:
            for k in ('funding_src', 'funding_src_tier', 'funding_src_all'):
                c.pop(k, None)
            continue
        srcs = list(dict.fromkeys((c.get('sources') or []) + (c.get('enrich_sources') or [])))
        ch = host(c.get('url') or '')
        scored = sorted(((score(u, ch), u) for u in srcs), key=lambda t: -t[0])
        best = scored[0] if scored else (0, None)
        # manual override wins and is never recomputed away
        if c.get('funding_src_manual'):
            best = (100, c['funding_src_manual'])
        if best[0] < 40 or not best[1]:
            for k in ('funding_src', 'funding_src_tier', 'funding_src_all'):
                c.pop(k, None)
            stats['none'] += 1
            queue.append((f, c['name'], c['id'], [f'{cls(u)}:{u}' for u in srcs]))
            continue
        tier = 'tracker' if cls(best[1]) == 'tracker' else 'announced'
        c['funding_src'] = best[1]
        c['funding_src_tier'] = tier
        c['funding_src_all'] = [u for sc, u in scored if sc >= 40][:5]
        stats[tier] += 1

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)

    print(f"funded rows: {sum(stats.values())}  announced={stats['announced']}  "
          f"tracker-only={stats['tracker']}  NO LINK={stats['none']}")
    if queue:
        print('\n--- research queue: funding figure with no funding-evidencing URL ---')
        for f, n, i, srcs in sorted(queue, key=lambda t: -t[0]):
            print(f'{f:>9}  {n}  [{i}]')
            for s in srcs:
                print('           ', s)


if __name__ == '__main__':
    main()
