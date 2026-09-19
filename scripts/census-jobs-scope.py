#!/usr/bin/env python3
"""SUPERSEDED SAME DAY by census-workforce-split.py — Luca: full payrolls back
with an office/frontline split; do NOT re-run this. Kept as the record of the
metro-scoping hour. Original header follows.

JOBS SCOPED TO THE CENSUS METROS — Luca, Aug 31 2026: "we want real numbers
people that working for the startup those in jakarta area."

The jobs column used to count the whole Indonesian payroll of any company
headquartered in a census metro. For a desk company that is the same number as
its metro workforce; for a nationwide field network it is not — J&T's 30,000
couriers staff 4,000+ points across the country, Amartha's 9,000 field officers
work in 50,000+ villages. From this pass the column counts PAYROLL WORKING IN
THE CENSUS METROS (Greater Jakarta; Bandung and the Bali rows in their own
metros):

  - scope:  the company itself discloses a basis to carve a metro figure from
            (only Amartha does: 10,000 total minus ~9,000 field officers, and
            LinkedIn corroborates the ~1,000 within 1%) -> publish the carve.
  - keep:   the network is evidenced census-metro-majority (own store lists,
            About pages, filings) -> the figure stands, marked `metro`.
  - dash:   the payroll is national and no metro split exists anywhere ->
            sourced-or-withdrawn, same as funding: an explained dash. The
            national figure moves to employees_national and stays on the
            profile.

Mitra/driver/merchant partners were never counted and still are not. Desk rows
are untouched: their payroll IS the metro estimate.

Idempotent: re-running restores exactly these fields. Rows touched here get
`employees_reviewed`, which census-headcount.py apply refuses to overwrite.
RUN ORDER: after census-headcount.py apply and census-row-fix.py, before
census-funding-src.py / build-census.js. Also update census-output-flags.py in
the same pass (flags for dashed rows are moot — they price no output now).

Evidence gathered 2026-08-31 (WebSearch/WebFetch; Exa exhausted):
  flash-coffee.com/locations -> 47 of 56 ID sites Greater Jakarta, 5 of the
    other 9 Bandung (93% census-metro).
  tanameracoffee.co.id/find-us -> 20 ID outlets: 6 Jakarta, 3 Bali, 2 Batam,
    9 across Surabaya/Makassar/Semarang/Yogyakarta/Kendari (+12 Singapore).
  kontan (Jun 2025) -> TUKU 72 toko Jabodetabek + first outposts in 4 cities;
    swa.co.id (2026) -> 80 toko, 11 cities, next adds Jabodetabek + Bali.
  fithub.id location pages -> "120+ Lokasi", ~19 cities (Surabaya 9, Bandung 6,
    plus Makassar/Yogyakarta/Semarang/Batam/Palembang/Balikpapan/...).
  Supra Boga: 40 Farmers + 20 Ranch stores; its 2022 disclosure put 70 outlets
    "primarily in Jabodetabek".
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
BAK = RAW + '.bak-jobscope'

TODAY = '2026-08-31'

# ── the decisions ────────────────────────────────────────────────────────────
# action 'dash':  employees_est -> null, national figure preserved.
# action 'scope': employees_est -> the metro carve.
# action 'keep':  figure unchanged, marked `metro` with the evidence.

D = {
    'j-t-express': {'action': 'dash', 'note':
        "The payroll is national; this column is not. J&T's official company profile counts "
        "\"more than 30,000 trained human resources\" across Indonesia — salaried couriers and "
        "sorters staffing about 100 gateways and 4,000-plus operating points in every part of the "
        "country, payroll rather than platform mitra. The jobs column counts people working in the "
        "census metros, and J&T publishes no Jakarta-area figure to carve from (its group accounts "
        "do not even publish an Indonesia revenue line), so the cell holds a dash instead of a "
        "number that is mostly the rest of the archipelago. LinkedIn shows 13,185 profiles, also "
        "nationwide. The 30,000 was carried in this column until 31 Aug 2026 and stays on this "
        "profile as the national payroll."},
    'sicepat-ekspres': {'action': 'dash', 'note':
        "The payroll is national; this column is not. SiCepat's 3,925 (Revelio Labs workforce "
        "model, Mar 2026) spreads over sorting hubs and branches across Indonesia, and no metro "
        "split is published anywhere. The ~18,000 couriers were already excluded as mitra — "
        "SiCepat's own Mar-2026 announcement pays them BHR, the partner bonus, not the statutory "
        "employee THR. LinkedIn shows 1,207 profiles, also national. The 3,925 was carried in this "
        "column until 31 Aug 2026 and stays on this profile as the national payroll."},
    'ninja-xpress': {'action': 'dash', 'note':
        "The payroll is national; this column is not. 3,646 staff at March 2026 per Revelio Labs, "
        "on a series that has fallen every year since 2022 (Ninja's own last public figure was "
        "about 5,500 across Indonesia in 2019), spread over a nationwide last-mile network with no "
        "metro split published. Partner fleets were never counted. The 3,646 was carried in this "
        "column until 31 Aug 2026 and stays on this profile as the national payroll."},
    'anteraja': {'action': 'dash', 'note':
        "The payroll is national; this column is not. LinkedIn lists 2,330 people (read "
        "2026-08-29) against a self-declared band of 10,001+ — the scale of a courier network that "
        "operates across Indonesia, not of a Jakarta office. No metro split is published. The "
        "2,330 was carried in this column until 31 Aug 2026 and stays on this profile as the "
        "national payroll."},
    'lion-parcel': {'action': 'dash', 'note':
        "The payroll is national; this column is not. LinkedIn lists 1,119 people (read "
        "2026-08-29, band 1,001-5,000) across a nationwide parcel network riding Lion Air's "
        "routes; no metro split is published. The 1,119 was carried in this column until "
        "31 Aug 2026 and stays on this profile as the national payroll."},
    'paxel': {'action': 'dash', 'note':
        "The payroll is national; this column is not. Paxel's 386 (LinkedIn, inside its own "
        "201-500 band) includes its Happiness Hero couriers, who are staff rather than gig riders, "
        "across an intercity same-day network well beyond Greater Jakarta; no metro split is "
        "published. The 386 was carried in this column until 31 Aug 2026 and stays on this "
        "profile as the national payroll."},
    'idexpress': {'action': 'dash', 'note':
        "The payroll is national; this column is not. 1,278 live LinkedIn profiles (a floor — the "
        "page declares 10,001+) across a last-mile network built nationwide by J&T alumni; courier "
        "employment status is unpublished and so is any metro split. The 1,278 was carried in this "
        "column until 31 Aug 2026 and stays on this profile as the national payroll."},
    'kopi-kenangan': {'action': 'dash', 'note':
        "The payroll is national; this column is not. Kenangan Brands' own site counts more than "
        "5,000 employees across 1,000-plus outlets in dozens of Indonesian cities, and publishes "
        "no city split; most of those baristas do not work in Greater Jakarta. The 5,000 was "
        "carried in this column until 31 Aug 2026 and stays on this profile as the national "
        "payroll."},
    'fore-coffee': {'action': 'dash', 'note':
        "The payroll is national; this column is not. FORE's own figure — more than 4,300 "
        "employees at 31 December 2025, 97% of them store staff — covers an outlet network that "
        "reaches far beyond Greater Jakarta, and no metro split is published (LinkedIn sees 610 "
        "profiles because baristas keep none). The 4,300 was carried in this column until "
        "31 Aug 2026 and stays on this profile as the national payroll."},
    'tomoro-coffee': {'action': 'dash', 'note':
        "The payroll is national; this column is not. The 1,785 LinkedIn count (itself a floor) "
        "sits under 600-plus company-operated stores across Indonesia and now overseas, run from "
        "Jakarta; no metro split is published. The 1,785 was carried in this column until "
        "31 Aug 2026 and stays on this profile as the national payroll."},
    'haus': {'action': 'dash', 'note':
        "The payroll is national; this column is not. Haus!'s own 1,300-plus dates from April "
        "2022 at 186 outlets; it now lists 197 outlets across 18 cities and publishes no city "
        "split of staff. The 1,300 was carried in this column until 31 Aug 2026 and stays on "
        "this profile as the national payroll."},
    'sociolla': {'action': 'dash', 'note':
        "The payroll is national; this column is not. The 3,173 (Revelio Labs, Mar 2026, for "
        "PT Social Bella Indonesia) covers 60-plus physical stores across Indonesia as well as "
        "the Jakarta offices and warehouses, and no metro split is published; LinkedIn shows "
        "1,109 profiles. The 3,173 was carried in this column until 31 Aug 2026 and stays on "
        "this profile as the national payroll."},
    'fithub': {'action': 'dash', 'note':
        "The payroll is national; this column is not. The 1,356 LinkedIn count spans 120-plus "
        "clubs in about 19 cities on FIT HUB's own location pages (Surabaya alone lists 9, "
        "Bandung 6, plus Makassar, Yogyakarta, Semarang, Batam, Palembang, Balikpapan and more), "
        "some of them partner-operated, and no metro split is published. The 1,356 was carried "
        "in this column until 31 Aug 2026 and stays on this profile as the national payroll."},
    'tanamera-coffee': {'action': 'dash', 'note':
        "The payroll is national; this column is not. Tanamera's own find-us page (read 31 Aug "
        "2026) lists 20 Indonesian outlets of which only 6 are in Jakarta — the rest sit in "
        "Surabaya, Makassar, Bali, Batam, Semarang, Yogyakarta and Kendari, with 12 more sites "
        "in Singapore — and the 270 LinkedIn count carries no split between them. The 270 was "
        "carried in this column until 31 Aug 2026 and stays on this profile as the national "
        "payroll."},

    'amartha': {'action': 'scope', 'est': 1000, 'tier': 2, 'kind': 'manual',
        'src': 'https://finansial.bisnis.com/read/20250826/563/1905857/pamer-punya-10000-karyawan-ini-strategi-amartha-financial-kala-badai-phk-menghantui',
        'asof': '2025-08-26', 'note':
        "About 1,000 people — the company's own arithmetic, scoped to where they work. Amartha's "
        "July 2025 release counts \"lebih dari 10.000 karyawan (A-Team)\", and chairman Rudiantara "
        "repeated the figure in August 2025, adding that about 9,000 of them are penyuluh "
        "lapangan — field officers on fixed wages from Rp 3.5 million a month serving borrowers "
        "across more than 50,000 villages, overwhelmingly outside Greater Jakarta. Take the field "
        "force out and roughly 1,000 remain, centred on the TB Simatupang head office; LinkedIn "
        "sees 1,010 profiles, within 1% of that. The jobs column counts payroll working in the "
        "census metros, so the row carries the ~1,000 and the 10,000 national payroll stays on "
        "this profile. (The column carried the 10,000 until 31 Aug 2026.)",
        'scope_note':
        "The figure is Amartha's own 10,000-plus national payroll minus the ~9,000 village field "
        "officers its chairman put on it — the remainder matches the 1,010 LinkedIn profiles "
        "within 1%. The full national payroll is on the profile."},

    'kopi-tuku': {'action': 'keep', 'scope_note':
        "Kept as census-metro workforce: TUKU's network is Jabodetabek-first from its 2015 Cipete "
        "origin — 72 toko across Jabodetabek plus first outposts in Bandung, Surabaya, Malang and "
        "Yogyakarta as of June 2025 (Kontan), 80 toko in 11 cities by mid-2026 (SWA), the next "
        "openings again Jabodetabek and Bali — and the 336 is a LinkedIn floor that store crews "
        "mostly do not appear in, so it is read as the metro payroll's floor.",
        'scope_src': 'https://industri.kontan.co.id/news/kopi-tuku-targetkan-penambahan-100-gerai-hingga-2026'},
    'common-grounds': {'action': 'keep', 'scope_note':
        "Kept as census-metro workforce: 15 of its 19 cafes are in Jakarta and Tangerang on the "
        "page's own About, and the 210 is a floor — cafe crews keep few profiles."},
    'flash-coffee': {'action': 'keep', 'scope_note':
        "Kept as census-metro workforce: Flash's own locations page (read 31 Aug 2026) lists 47 "
        "of its 56 Indonesian sites in Greater Jakarta and 5 of the other 9 in Bandung — about "
        "93% of the network sits in census metros.",
        'scope_src': 'https://flash-coffee.com/locations/'},
    'ftl-gym': {'action': 'keep', 'scope_note':
        "Kept as census-metro workforce: FTL's roughly 40 outlets sit in Jabodetabek and Bandung "
        "— both census metros — so the 853 live page count is metro payroll, read as a floor."},
    'ranch-market': {'action': 'keep', 'scope_note':
        "Kept as census-metro workforce: the 846 is the group's filed permanent payroll, and the "
        "store network has been Jabodetabek-centred since founding — its 2022 disclosure put 70 "
        "outlets primarily in Jabodetabek; today it runs 40 Farmers Market and 20 Ranch Market "
        "stores. Outsourced store staff sit outside the filed figure either way."},
    'torch': {'action': 'keep', 'scope_note':
        "Kept as census-metro workforce: the row sits in Bandung and the 123 is a LinkedIn count "
        "that skews to the Bandung head office and warehouse — the 11 stores across ~10 cities "
        "are staffed by shopkeepers who rarely hold profiles — so it is read as the Bandung-area "
        "workforce's floor."},
}

HEADCOUNT_RULE_ADD = (
    " Jobs are also scoped to where people actually work: since 31 Aug 2026 the column counts "
    "payroll working in the census metros — Greater Jakarta, and for the Bandung and Bali rows "
    "their own metros — because this is a census of those places, not of everywhere their "
    "companies reach. A desk company carries its payroll as read, nearly all of it at the head "
    "office. A nationwide field network — couriers, store crews, village field officers — "
    "publishes a metro figure only where the company itself discloses a basis to carve one "
    "(marked `metro`), keeps its figure where its own store list shows a census-metro-majority "
    "network (also marked), and otherwise holds a dash that says what the national payroll is; "
    "the national figure stays on the profile either way."
)

GPR_OLD_TAIL = (
    "Jobs are people on an Indonesian payroll: driver-, courier-, merchant- and seller-partners "
    "are mitra, not employees, and are never counted."
)
GPR_NEW_TAIL = (
    "Jobs are people on the payroll working in the census metros: driver-, courier-, merchant- "
    "and seller-partners are mitra, not employees, and are never counted — and a nationwide "
    "network's payroll outside the metros is scoped out or dashed, because most of it is not "
    "working here."
)


def main():
    if not os.path.exists(BAK):
        shutil.copy2(RAW, BAK)
        print(f'backup -> {BAK}')
    raw = json.load(open(RAW))
    byid = {c['id']: c for c in raw['companies']}
    moved = 0
    for cid, d in D.items():
        c = byid.get(cid)
        if not c:
            print(f'!! {cid} NOT IN CENSUS — skipped')
            continue
        act = d['action']
        if act in ('dash', 'scope'):
            # preserve the national figure once; never re-copy nulls on re-run
            if c.get('employees_national') is None and c.get('employees_est') is not None:
                c['employees_national'] = c['employees_est']
                c['employees_national_src'] = c.get('employees_src') or (
                    'https://jet.co.id/about/company' if cid == 'j-t-express' else None)
                c['employees_national_asof'] = c.get('employees_asof')
                c['employees_national_kind'] = c.get('employees_kind')
                moved += 1
            c['employees_note'] = d['note']
            c['employees_reviewed'] = TODAY
            if act == 'dash':
                c['employees_est'] = None
                c['jobs_scope'] = 'national_only'
                for k in ('employees_kind', 'employees_tier', 'employees_src', 'employees_asof'):
                    c.pop(k, None)
            else:  # scope
                c['employees_est'] = d['est']
                c['jobs_scope'] = 'metro'
                c['jobs_scope_note'] = d['scope_note']
                c['employees_kind'] = d['kind']
                c['employees_tier'] = d['tier']
                c['employees_src'] = d['src']
                c['employees_asof'] = d['asof']
        else:  # keep
            c['jobs_scope'] = 'metro_majority'
            c['jobs_scope_note'] = d['scope_note']
            if d.get('scope_src'):
                c['jobs_scope_src'] = d['scope_src']
        print(f"{act:5s} {cid:20s} est={c.get('employees_est')} natl={c.get('employees_national')}")

    m = raw['method']
    if HEADCOUNT_RULE_ADD not in m.get('headcount_rule', ''):
        m['headcount_rule'] = m.get('headcount_rule', '').rstrip() + HEADCOUNT_RULE_ADD
    if GPR_OLD_TAIL in m.get('global_parent_rule', ''):
        m['global_parent_rule'] = m['global_parent_rule'].replace(GPR_OLD_TAIL, GPR_NEW_TAIL)

    json.dump(raw, open(RAW, 'w'), indent=1, ensure_ascii=False)
    print(f'\nwrote {RAW} — {len(D)} rows adjudicated, {moved} national figures preserved')


if __name__ == '__main__':
    main()
