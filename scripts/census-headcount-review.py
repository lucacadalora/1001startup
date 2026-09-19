#!/usr/bin/env python3
"""census-headcount-review.py — the human half of the headcount pipeline.

Luca, Aug 29 2026, looking at the jobs column: "it seems you need to do more
loop/running for tokopedia, amartha etc head count, impossible amartha has 5000".

He was right that the column was wrong, and the diagnosis was worse than one bad
row. `census-headcount.py apply` deliberately refuses to overwrite a figure that
did not itself come from LinkedIn, and it refuses to auto-apply a swing bigger
than 3x. Everything it refused sat in census-raw.json untouched, with the live
LinkedIn read parked alongside it in `employees_li`. Twenty-eight rows were in
that state and nobody had gone through them. On top of that, eleven rows carried
a number that is not a measurement at all — the arithmetic midpoint of a LinkedIn
size band (51-200 -> 125, 201-500 -> 350, 501-1,000 -> 750). Amartha's 5,000 was
one of those.

This script is that review, done once, by hand, with a source per row. It is
idempotent: re-running it writes the same values. Every decision below carries
the tier it was decided at, under the ladder now published in
`method.headcount_rule`:

  1  a filing (IDX financial statements, exchange disclosure)
  2  the company's own published statement (press release, prospectus, own site)
  3  named reporting that attributes a figure to the company
  4  a live LinkedIn associated-member count — a FLOOR for desk-based firms,
     and stale-high for firms that have shrunk (alumni who never updated)
  5  a dated vendor workforce model (Revelio Labs, LeadIQ) — last resort, named
  x  band midpoints are never a figure; a row with nothing better publishes "-"

Usage:  python3 scripts/census-headcount-review.py [--dry-run]
"""
import argparse, json, os, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
CACHE = os.path.join(HERE, '..', 'data', 'census-headcount.json')

# n=None publishes a dash and contributes zero jobs and zero GVA (the §01 null gate).
DECISIONS = {
    # ---------------------------------------------------------------- tier 1: filings
    'gojek': dict(
        n=3411, tier=1, asof='2026-06-30',
        note="3,411 permanent employees at 30 June 2026, from PT GoTo Gojek Tokopedia Tbk's own "
             "quarterly financial statements (IDX: GOTO). About 99% of them are in Indonesia. The "
             "figure is group-wide — Gojek, GoTo Financial (GoPay, Midtrans) and corporate — and GOTO "
             "has shrunk from more than 9,000 staff in 2021-22. Tokopedia is no longer consolidated "
             "(GoTo has held 24.99% since January 2024) and is counted on its own row. Replaces 7,000, "
             "which was a guess at the middle of a LinkedIn size band.",
        src='https://stockanalysis.com/quote/idx/GOTO/employees/',
        sources=['https://stockanalysis.com/quote/idx/GOTO/employees/',
                 'https://databoks.katadata.co.id/ketenagakerjaan/statistik/6a4b4540e651b/jumlah-karyawan-goto-berkurang-pada-kuartal-i-2026'],
        confidence=0.9),
    'bukalapak': dict(
        n=430, tier=1, asof='2026-06-30',
        note="430 employees at 30 June 2026, from PT Bukalapak.com Tbk's filings (IDX: BUKA). The "
             "company's May 2026 disclosure to the exchange put headcount at 1,018 at end-2024 and 424 "
             "at end-2025 after it wound down the physical-goods marketplace; 419 at 31 March 2026. "
             "Revelio Labs independently reads 428. Replaces 1,400, a LeadIQ estimate that was three "
             "times the filed number.",
        src='https://stockanalysis.com/quote/idx/BUKA/employees/',
        sources=['https://stockanalysis.com/quote/idx/BUKA/employees/',
                 'https://investasi.kontan.co.id/news/bukalapak-buka-telah-phk-60-karyawan-kinerja-keuangan-tertekan',
                 'https://www.bloombergtechnoz.com/detail-news/108188/pangkas-50-karyawan-bukalapak-buka'],
        confidence=0.92),

    # ---------------------------------------------------------------- tier 2: the company itself
    'amartha': dict(
        n=10000, tier=2, asof='2025-08-26',
        note="More than 10,000 employees, on Amartha's own account: its July 2025 release says "
             "\"lebih dari 10.000 karyawan (A-Team)\" spread across Indonesia, and chairman Rudiantara "
             "repeated the figure in August 2025, adding that about 9,000 of them are penyuluh lapangan "
             "— field officers. Those field officers are payroll, not mitra: Amartha's own Business "
             "Partner (staf lapangan) postings offer a fixed monthly wage from Rp 3.5 million, THR, a "
             "company mess and employee training, which is the same test that lets J&T's salaried "
             "couriers count and keeps Gojek's drivers out. LinkedIn sees 1,010 profiles and Tracxn "
             "2,613 because neither instrument reaches a field officer in a village — and 10,000 minus "
             "the 9,000 field officers leaves about 1,000 office staff, which is what LinkedIn shows to "
             "within 1%. The reference class agrees: PNM Mekaar, the state-owned lender running the same "
             "weekly-group model, employs 62,184 people for 15.4 million borrowers, about one staff "
             "member per 250. Amartha has disbursed Rp 35 trillion to 3.3 million women across more than "
             "50,000 villages; the same ratio puts it in exactly this band. The old 5,000 was the "
             "midpoint of a LinkedIn size band and measured nothing.",
        src='https://amartha.com/blog/siaran-pers/amartha-dinobatkan-tempat-kerja-terbaik-HR-Asia-awards-2025',
        sources=['https://amartha.com/blog/siaran-pers/amartha-dinobatkan-tempat-kerja-terbaik-HR-Asia-awards-2025',
                 'https://finansial.bisnis.com/read/20250826/563/1905857/pamer-punya-10000-karyawan-ini-strategi-amartha-financial-kala-badai-phk-menghantui',
                 'https://www.zonagadget.co.id/amartha-buka-rahasia-fintech-solusi-menciptakan-lapangan-kerja-di-indonesia',
                 'https://www.bantenraya.com/ekonomi-bisnis/15462999/salurkan-pendanaan-rp35-triliun-fintech-umkm-amartha-jadi-tempat-kerja-terbaik',
                 'https://www.pnm.co.id/bisnis/pnm-mekaar'],
        confidence=0.82),
    'fore-coffee': dict(
        n=4300, tier=2, asof='2025-12-31',
        note="More than 4,300 employees at 31 December 2025 — FORE's own figure, given at its May 2026 "
             "AGM and public expose, which also notes that 97% of them are store staff. That is why "
             "LinkedIn only sees 610 profiles: baristas do not keep them. The number was previously "
             "carried as an unsourced estimate off the outlet count; it now stands on the company's "
             "own disclosure.",
        src='https://fore.coffee/press-release-fore-holds-annual-general-meeting-of-shareholders-and-public-expose/',
        sources=['https://fore.coffee/press-release-fore-holds-annual-general-meeting-of-shareholders-and-public-expose/',
                 'https://fore.coffee/id/siaran-pers-fore-gelar-rupst-dan-public-expose-tegaskan-komitmen-pada-pertumbuhan-berkelanjutan/'],
        confidence=0.9),
    'haus': dict(
        n=1300, tier=2, asof='2022-04',
        note="More than 1,300 employees, the company's own figure when it had 186 outlets (April 2022). "
             "It is dated, but it is a floor rather than a stale peak: Haus! now lists 197 outlets in 18 "
             "cities, so the workforce has not shrunk. Vendor models read 1,000-1,180 and LinkedIn sees "
             "286 profiles, all of which miss counter staff. Replaces 1,500, which was not sourced to "
             "anything.",
        src='https://swa.co.id/read/364484/gaya-gufron-syarif-bawa-haus-jadi-pemain-penting-bisnis-minuman',
        sources=['https://swa.co.id/read/364484/gaya-gufron-syarif-bawa-haus-jadi-pemain-penting-bisnis-minuman',
                 'https://id.linkedin.com/company/pt-inspirasi-bisnis-nusantara-haus-indonesia'],
        confidence=0.6),

    # ---------------------------------------------------------------- tier 3: attributed reporting
    'tokopedia': dict(
        n=250, tier=3, asof='2026-07',
        note="About 250 people, after the July 2026 restructuring. TikTok/ByteDance cut PT Tokopedia on "
             "1 July 2026; CNBC Indonesia, Jakarta Globe and The Jakarta Post all report the round left "
             "roughly 10% of the ~2,500 staff TikTok inherited in January 2024, with the technology unit "
             "down to about 35 people from about 1,100. DISPUTED, and shown that way on purpose: the "
             "Manpower Ministry and DPR say around 200 staff took voluntary compensation packages and "
             "reject the larger layoff numbers, and TikTok has published none. Both scrapes lag the "
             "event — Revelio read 3,907 in March 2026 and LinkedIn still shows 1,537 profiles, most of "
             "them people who have not updated. The old 6,157 was a vendor estimate from before the cut.",
        src='https://jakartaglobe.id/business/goto-says-tiktok-shoptokopedia-layoffs-wont-materially-affect-earnings',
        sources=['https://jakartaglobe.id/business/goto-says-tiktok-shoptokopedia-layoffs-wont-materially-affect-earnings',
                 'https://www.cnbcindonesia.com/market/20260706114531-17-748337/goto-buka-suara-soal-kabar-phk-90-karyawan-tokopedia',
                 'https://www.thejakartapost.com/business/2026/07/07/some-200-tokopedia-staff-leave-tiktok-amid-restructuring.html',
                 'https://ekonomi.bisnis.com/read/20260706/12/1985945/dasco-sekitar-200-pegawai-tiktok-tokopedia-pilih-kompensasi-bukan-phk'],
        confidence=0.5),

    # ---------------------------------------------------------------- withdrawn: no publishable figure
    'sicepat-ekspres': dict(
        n=None, tier=None, asof=None,
        note="Withdrawn rather than estimated. SiCepat's own last disclosure was 59,286 employees "
             "(March 2022, courier fleet included, given to media during a layoff dispute). It has since "
             "lost its largest marketplace volume and contracted, and no newer company figure exists. "
             "The instruments that can see it only see the office: Revelio reads 3,925 (March 2026), "
             "LeadIQ 5,700, LinkedIn 1,207 profiles. A tenfold gap between a courier fleet and a desk "
             "count is not something to split the difference on, so this row publishes no headcount and "
             "contributes no jobs or output. The 5,700 it used to carry was the LeadIQ estimate.",
        src=None,
        sources=['https://www.liputan6.com/bisnis/read/4912950/sicepat-evaluasi-kinerja-pekerja-berapa-yang-kena-phk',
                 'https://ekonomi.bisnis.com/read/20220316/98/1511377/sicepat-ekspres-phk-ratusan-karyawan-kurir'],
        confidence=0.7),
    'shopee-indonesia': dict(
        n=None, tier=None, asof=None,
        note="Withdrawn rather than estimated. The only Indonesian figures Shopee has ever put on the "
             "record are from 2022 and they disagree by a factor of three: 6,232 staff at PT Shopee "
             "International Indonesia in Q1 2022 (the base the September 2022 layoff coverage used), "
             "against \"more than 20,000 employees in Indonesia across Shopee, ShopeePay and ShopeeFood\" "
             "from its own executive in June 2022. Since then Shopee has relocated or cut more than a "
             "thousand Indonesian roles, and Sea Limited discloses no country breakdown. Under the "
             "global-parent rule the row stays in the census at its Indonesian scope, with a dash where "
             "there is no defensible Indonesian number. The 6,200 it used to carry was the 2022 figure "
             "carried forward four years.",
        src=None,
        sources=['https://investor.id/business/307165/kini-giliran-shopee-indonesiaphk180-karyawan-pesangonnya-segini',
                 'https://www.liputan6.com/tekno/read/4987499/shopee-indonesia-pastikan-tak-lakukan-phk-karyawan',
                 'https://teknologi.bisnis.com/read/20250530/84/1881161/shopee-tiktok-tokopedia-kembali-dikabarkan-phk'],
        confidence=0.7),
    'midtrans': dict(
        n=None, tier=None, asof=None,
        note="Not counted again here. Midtrans is wholly owned by GoTo and its staff already sit inside "
             "the 3,411 permanent employees PT GoTo Gojek Tokopedia Tbk files, which this census counts "
             "on the Gojek (GoTo Group) row — the same containment rule that keeps a subsidiary's "
             "valuation from being counted twice. Its own LinkedIn page shows 48 people and vendor "
             "models 75-150, because most GoTo Financial staff list the parent. The 750 it used to carry "
             "was the midpoint of a LinkedIn size band that does not match any of them.",
        src=None,
        sources=['https://stockanalysis.com/quote/idx/GOTO/employees/'],
        confidence=0.8),

    # ---------------------------------------------------------------- tier 5: dated vendor models
    'sociolla': dict(
        n=3173, tier=5, asof='2026-03',
        note="3,173 staff at March 2026, Revelio Labs' dated workforce read for PT Social Bella "
             "Indonesia, on a series that runs 2,417 (2023) to 3,173 (2026). Preferred over the LeadIQ "
             "figure the row used to carry (2,300) because Revelio's series matched Bukalapak's filed "
             "headcount to within four people, and over LinkedIn's 1,109 profiles because Sociolla runs "
             "60-plus physical stores whose staff do not keep them.",
        src='https://www.reveliolabs.com/companies/social-bella-indonesia/employees',
        sources=['https://www.reveliolabs.com/companies/social-bella-indonesia/employees'],
        confidence=0.6),
    'ninja-xpress': dict(
        n=3646, tier=5, asof='2026-03',
        note="INDONESIAN PAYROLL ONLY. 3,646 staff at March 2026 per Revelio Labs, down 12.5% year on "
             "year on a series that has fallen every year since 2022. Ninja's own last public figure was "
             "about 5,500 across Indonesia in 2019. LinkedIn shows 864 profiles. Partner fleets are not "
             "counted.",
        src='https://www.reveliolabs.com/companies/ninja-xpress/employees',
        sources=['https://www.reveliolabs.com/companies/ninja-xpress/employees'],
        confidence=0.6),
    'visionet': dict(
        n=2862, tier=5, asof='2026-03',
        note="2,862 staff at March 2026 per Revelio Labs, on a flat series (2,745 in 2023). Corroborated "
             "by an independent Microsoft-partner directory listing \"2,000+ staff\" and by the company's "
             "own LinkedIn size band of 1,001-5,000. LinkedIn shows 883 profiles because VisioNet's "
             "field engineers are deployed on client sites. Unchanged in value; the source is now named "
             "and dated.",
        src='https://www.reveliolabs.com/companies/pt-visionet-data/employees',
        sources=['https://www.reveliolabs.com/companies/pt-visionet-data/employees'],
        confidence=0.6),

    # ---------------------------------------------------------------- tier 4: live LinkedIn reads
    'paxel': dict(
        n=386, tier=4, asof='2026-08-29',
        note="386 people on Paxel's LinkedIn page, inside the company's own declared size band of "
             "201-500. Its Happiness Hero couriers are staff rather than gig riders, so this is a floor. "
             "Replaces 750, the midpoint of a 501-1,000 band that Paxel's own page does not claim.",
        src='https://id.linkedin.com/company/paxel-co',
        sources=['https://id.linkedin.com/company/paxel-co'], confidence=0.55),
    'kitalulus': dict(
        n=265, tier=5, asof='2026-07',
        note="About 265 people — LeadIQ reads 266 (July 2026) and Tracxn 264 (May 2026), which is as "
             "close to agreement as two vendor models get. LinkedIn shows 93 profiles. Replaces 350, the "
             "midpoint of the 201-500 band.",
        src='https://leadiq.com/c/kitalulus/619e1f5eb861d1aa19394551/employee-directory',
        sources=['https://www.linkedin.com/company/kitalulusid/',
                 'https://leadiq.com/c/kitalulus/619e1f5eb861d1aa19394551/employee-directory'], confidence=0.55),
    'pintar': dict(
        n=465, tier=4, asof='2026-08-29',
        note="465 people on PINTAR's LinkedIn page, matched by LeadIQ (465, June 2026), RocketReach "
             "(462) and SignalHire (480). Replaces 125, the midpoint of a 51-200 band that every other "
             "instrument contradicts — Pintar acquired GREDU, Hiringmaps and Kerja.io in 2024 and is "
             "several times the size the old figure implied.",
        src='https://id.linkedin.com/company/pintarco',
        sources=['https://id.linkedin.com/company/pintarco'], confidence=0.7),
    'hukumonline': dict(
        n=441, tier=4, asof='2026-08-29',
        note="441 people on Hukumonline's LinkedIn page; Revelio reads 474 for PT Justika Siar Publika "
             "at March 2026. Replaces 95, a ZoomInfo figure roughly a fifth of both.",
        src='https://www.linkedin.com/company/hukumonline.com/',
        sources=['https://www.linkedin.com/company/hukumonline.com/',
                 'https://www.reveliolabs.com/companies/justika-siar-publika/employees'], confidence=0.7),
    'myskill': dict(
        n=308, tier=4, asof='2026-08-29',
        note="308 people on MySkill's own LinkedIn page (myskillid), inside a 201-500 band; Revelio "
             "reads 653 at March 2026. Replaces 125, a 51-200 band midpoint that came from the wrong "
             "company — the crawler had matched MySkill NZ, an unrelated New Zealand business.",
        src='https://linkedin.com/company/myskillid',
        sources=['https://linkedin.com/company/myskillid',
                 'https://www.reveliolabs.com/companies/myskill/employees'], confidence=0.6),
    'purwadhika-digital-technology-school': dict(
        n=131, tier=4, asof='2026-08-29',
        note="131 people on the Purwadhika Digital Technology School LinkedIn page; RocketReach reads "
             "192. Replaces 125, a band midpoint. A second page, \"Thrive With Purwadhika\", carries 54 "
             "and is the rebrand rather than a separate business.",
        src='https://linkedin.com/company/purwadhika',
        sources=['https://linkedin.com/company/purwadhika'], confidence=0.55),
    'hacktiv8': dict(
        n=142, tier=4, asof='2026-08-29',
        note="142 people on Hacktiv8's LinkedIn page, down 17% year on year; an independent edutech "
             "profile put it at about 191 in 2023, so the direction is consistent. Replaces 125, a band "
             "midpoint.",
        src='https://linkedin.com/company/hacktiv8',
        sources=['https://linkedin.com/company/hacktiv8'], confidence=0.6),
    'lifepack': dict(
        n=29, tier=5, asof='2026-07',
        note="About 29 people — LeadIQ (July 2026) and Tracxn (May 2026) both read 29, and Lifepack's "
             "LinkedIn page shows 17 profiles inside an 11-50 band. Replaces 125, the midpoint of a "
             "51-200 band the company's own page does not claim.",
        src='https://linkedin.com/company/lifepackid',
        sources=['https://linkedin.com/company/lifepackid'], confidence=0.6),
    'visinema': dict(
        n=127, tier=4, asof='2026-08-29',
        note="127 staff on Visinema's LinkedIn page. The studio describes \"over 420 creators\", but film "
             "and animation crews are engaged per production and are not payroll, so they are not "
             "counted here for the same reason platform mitra are not. Replaces 250, a midpoint of an "
             "EMIS 101-500 band.",
        src='https://id.linkedin.com/company/visinema-pictures',
        sources=['https://id.linkedin.com/company/visinema-pictures'], confidence=0.55),
    'bababos': dict(
        n=27, tier=4, asof='2026-08-29',
        note="27 people on Bababos' LinkedIn page. Replaces 85, which the record itself described as "
             "not reliably reported.",
        src='https://id.linkedin.com/company/bababos',
        sources=['https://id.linkedin.com/company/bababos'], confidence=0.5),
    'delman': dict(
        n=11, tier=4, asof='2026-08-29',
        note="11 people on Delman Data Lab's LinkedIn page, inside an 11-50 band. Replaces 30, the "
             "midpoint of that band.",
        src='https://www.linkedin.com/company/delman-io/',
        sources=['https://www.linkedin.com/company/delman-io/'], confidence=0.5),
    'kecilin': dict(
        n=7, tier=4, asof='2026-08-29',
        note="7 people on Kecilin's LinkedIn page as of August 2026, against a 51-200 band the page "
             "still declares. The company confirmed it was continuing to operate after its founder-CEO "
             "left in 2025, but the team that remains is a fraction of the ~84 this row used to carry. "
             "Treat as a live-but-shrunken company, not a shutdown.",
        src='https://www.linkedin.com/company/kecilin-data',
        sources=['https://www.linkedin.com/company/kecilin-data'], confidence=0.45),

    # ---------------------------------------------------------------- kept, note corrected
    'tokocrypto': dict(
        n=100, tier=4, asof='2026-08-29',
        note="About 100 people, consistent across Tokocrypto's LinkedIn profile count (98, +16% YoY) "
             "and its own declared 11-50 to 51-200 scale after the post-2022 restructuring. The 336 "
             "\"associated members\" the page also shows is alumni lag — LinkedIn keeps counting people "
             "who never updated their profile after leaving, which is why that metric runs high for "
             "companies that have shrunk and low for companies whose staff are not desk-based.",
        src='https://www.linkedin.com/company/tokocrypto/',
        sources=['https://www.linkedin.com/company/tokocrypto/'], confidence=0.65),
}

# Cache entries where the resolver matched the wrong LinkedIn page. Flagged so a later
# `census-headcount.py apply` cannot clobber the reviewed figure with a stranger's count.
CACHE_FIXES = {
    'revou': dict(linkedin='https://linkedin.com/company/revou', count=605, band='501-1,000',
                  li_name='RevoU', manual_ok=True,
                  note_for_humans='resolver had matched "RevoU x Telkom Indonesia", a co-branded programme page (16 people)'),
    'myskill': dict(linkedin='https://linkedin.com/company/myskillid', count=308, band='201-500',
                    li_name='MySkill', manual_ok=True,
                    note_for_humans='resolver had matched MySkill NZ, an unrelated New Zealand company'),
    'purwadhika-digital-technology-school': dict(
        linkedin='https://linkedin.com/company/purwadhika', count=131, band='51-200',
        li_name='Purwadhika Digital Technology School', manual_ok=True,
        note_for_humans='resolver had matched the "Thrive With Purwadhika" rebrand page (54 people)'),
}

RULE = (
    "Headcount is taken from the best source available, in this order: a company filing; the "
    "company's own published statement; named reporting that attributes a figure to the company; a "
    "live LinkedIn people count; a dated vendor workforce model. LinkedIn is a floor, not a count — "
    "couriers, baristas and village field officers do not keep profiles, and people who have left "
    "stay listed for months, so the same number runs low for a labour-intensive business and high "
    "for one that has just shrunk. The midpoint of a LinkedIn size band is not a source and is never "
    "published: a row with nothing better shows a dash and contributes no jobs and no output. Jobs "
    "mean payroll — salaried field and delivery staff count, platform drivers, couriers, merchants "
    "and sellers engaged as mitra do not — and a subsidiary whose staff are already inside a counted "
    "parent's filing is not counted twice."
)


def load(p):
    return json.load(open(p, encoding='utf-8'))


def save(p, obj):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(p), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, p)


def main(dry):
    raw = load(RAW)
    by = {c['id']: c for c in raw['companies']}
    missing = [k for k in DECISIONS if k not in by]
    if missing:
        raise SystemExit('unknown ids in DECISIONS: ' + ', '.join(missing))

    before = sum(c.get('employees_est') or 0 for c in raw['companies'])
    rows = []
    for cid, d in DECISIONS.items():
        c = by[cid]
        old = c.get('employees_est')
        c['employees_est'] = d['n']
        c['employees_note'] = d['note']
        c['employees_asof'] = d['asof']
        c['employees_tier'] = d['tier']
        c['employees_reviewed'] = '2026-08-29'
        if d.get('src'):
            c['employees_src'] = d['src']
        else:
            c.pop('employees_src', None)
        if d.get('confidence') is not None:
            c['confidence'] = d['confidence']
        # the parked LinkedIn cross-check has now been adjudicated
        c.pop('employees_li', None)
        c.pop('employees_li_asof', None)
        c.pop('employees_li_band', None)
        seen = set(c.get('enrich_sources') or [])
        add = [u for u in (d.get('sources') or []) if u not in seen and u not in (c.get('sources') or [])]
        if add:
            c['enrich_sources'] = (c.get('enrich_sources') or []) + add
        rows.append((cid, c['name'], old, d['n'], d['tier']))

    cache = load(CACHE)
    for cid, fix in CACHE_FIXES.items():
        cache.setdefault(cid, {'name': by[cid]['name'] if cid in by else cid}).update(fix)

    raw['method']['headcount_rule'] = RULE
    raw['method']['method_summary'] = raw['method']['method_summary'].replace(
        'and a headcount estimate (mostly LinkedIn bands)',
        'and a headcount taken from the best available source under a published ladder')

    after = sum(c.get('employees_est') or 0 for c in raw['companies'])
    if not dry:
        save(RAW, raw)
        save(CACHE, cache)

    print(f"{'DRY RUN — ' if dry else ''}{len(rows)} rows reviewed\n")
    print(f"  {'company':34s} {'was':>7} {'now':>7}  {'delta':>8}  tier")
    for cid, name, old, new, tier in sorted(rows, key=lambda r: -abs((r[3] or 0) - (r[2] or 0))):
        delta = (new or 0) - (old or 0)
        print(f"  {name[:34]:34s} {str(old):>7} {str(new) if new is not None else '—':>7}  "
              f"{delta:>+8,}  {tier if tier else 'withdrawn'}")
    print(f"\n  jobs total {before:,} -> {after:,}  ({after - before:+,})")
    print(f"  cache pages corrected: {', '.join(CACHE_FIXES)}")


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    main(ap.parse_args().dry_run)
