#!/usr/bin/env python3
"""WORKFORCE SPLIT — full payrolls restored, office vs frontline made visible.
Luca, Aug 31 2026, an hour after the metro scoping shipped: "damn it vanished
and our data 150k jobs gone … it is okay we give them all jobs data, but with
caveat/split, so we have the job count in office and the frontliner … make it
back 30k jobs, because that company has contribution like that. i dont want
- unknown job."

SUPERSEDES census-jobs-scope.py the same day. The jobs column counts the whole
Indonesian payroll again — J&T back at 30,000 — and the scoping story becomes a
published SPLIT instead of a withheld number:

  - every field-workforce row carries workforce_kind='frontline' and a
    `frontline` mark whose panel says what kind of payroll the number is
    (couriers, sorters, store crews, coaches, village field officers);
  - where the company itself discloses the split, workforce_split publishes it
    (Amartha: ~1,000 office / ~9,000 field officers, chairman Rudiantara;
    FORE: 97% store staff = ~130 office / ~4,170 frontline, its own AGM);
  - NO dashes: employees_est/tier/kind/src/asof/note/reviewed are restored
    VERBATIM from census-raw.json.bak-jobscope, so LinkedIn-sweep semantics
    are exactly what they were. The frontline story lives only in the new
    workforce_* fields, which no sweep touches.

Output keeps the census legit (the old sanity-gate breach must not return):
build-census.js prices frontline payroll at method.frontline_gva_per_worker_idr_m
= Rp 149jt — the BPS NATIONAL economy-wide average (PDB 2023 at current prices
Rp 20,892.4T / 139.85M employed, Sakernas Aug 2023) — instead of a DKI sector
anchor; split rows price office at the sector anchor + frontline at Rp 149jt.
Cross-check: FORE's audited FY2025 accounts imply ~Rp 124jt of true value added
per worker, within 20% of the anchor.

Idempotent. mitra/driver/merchant partners still never count.
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
BAK_SCOPE = RAW + '.bak-jobscope'   # pre-scoping originals, restored from here
BAK = RAW + '.bak-workforce'

FRONTLINE_ANCHOR = 149  # Rp jt / worker / yr — BPS national average, 2023 prices

# workforce_note = the `frontline` mark's panel body (sweep-safe field).
# split = {office, frontline, basis, src} — only where the company discloses it.
W = {
    'j-t-express': {'note':
        "All 30,000 are payroll, and most are frontline: salaried couriers and sorters staffing "
        "about 100 gateways and 4,000-plus operating points across Indonesia — LinkedIn shows "
        "13,185 profiles because frontline staff keep few. The office/frontline split is not "
        "published, so the row is marked rather than split, and the payroll is priced at the "
        "national frontline anchor instead of a Jakarta sector average."},
    'amartha': {'split': {'office': 1000, 'frontline': 9000, 'basis': 'company',
        'src': 'https://finansial.bisnis.com/read/20250826/563/1905857/pamer-punya-10000-karyawan-ini-strategi-amartha-financial-kala-badai-phk-menghantui'},
        'note':
        "Amartha's own numbers split the payroll: of the 10,000-plus A-Team, about 9,000 are "
        "penyuluh lapangan — village field officers on fixed wages serving borrowers across more "
        "than 50,000 villages (chairman Rudiantara, Aug 2025) — leaving about 1,000 office staff, "
        "which matches the 1,010 LinkedIn profiles within 1%. Output prices the two parts "
        "separately: office at the fintech anchor, field officers at the national frontline "
        "anchor."},
    'fore-coffee': {'split': {'office': 130, 'frontline': 4170, 'basis': 'company',
        'src': None},
        'note':
        "FORE's own disclosure splits it: 97% of the 4,300-plus are store staff — about 4,170 "
        "frontline against about 130 office, which is why LinkedIn sees only 610 profiles. "
        "Output prices the two parts separately: office at the F&B anchor, store staff at the "
        "national frontline anchor."},
    'kopi-kenangan': {'note':
        "More than 5,000 on the company's own count, overwhelmingly store crews across "
        "1,000-plus outlets in dozens of cities; no office split is published. Priced at the "
        "national frontline anchor."},
    'sicepat-ekspres': {'note':
        "The 3,925 (Revelio Labs, Mar 2026) is hub, sorting and operations staff nationwide — "
        "the ~18,000 couriers are mitra and are never counted. No office split is published."},
    'ninja-xpress': {'note':
        "3,646 (Revelio Labs, Mar 2026) across a national last-mile network — warehouse, hub "
        "and operations staff; partner fleets are never counted. No office split is published."},
    'anteraja': {'note':
        "LinkedIn's 2,330 against a self-declared 10,001+ band: a national courier network's "
        "payroll, mostly frontline; no office split is published."},
    'lion-parcel': {'note':
        "1,119 on LinkedIn across a national parcel network — courier, agent-network and hub "
        "staff; no office split is published."},
    'paxel': {'note':
        "386 staff including its Happiness Hero couriers — employed frontline, not gig riders — "
        "across an intercity same-day network; no office split is published."},
    'idexpress': {'note':
        "1,278 live profiles under a self-declared 10,001+ band — a national last-mile network "
        "built by J&T alumni; courier employment status is unpublished, and so is any office "
        "split."},
    'tomoro-coffee': {'note':
        "1,785 on LinkedIn — a floor for store crews across 600-plus company-operated stores; "
        "no office split is published."},
    'haus': {'note':
        "More than 1,300 on the company's 2022 count at 186 outlets (it now lists 197 in 18 "
        "cities) — counter crews are the workforce; no office split is published."},
    'sociolla': {'note':
        "3,173 (Revelio Labs, Mar 2026) spans 60-plus stores, the warehouses and the Jakarta "
        "offices; LinkedIn sees 1,109, and the gap is store and warehouse staff. No office "
        "split is published."},
    'fithub': {'note':
        "1,356 on LinkedIn — mostly coaches and front-desk staff across 120-plus clubs in "
        "about 19 cities, some partner-operated; no office split is published."},
    'tanamera-coffee': {'note':
        "270 on LinkedIn — roastery and cafe crews across 20 Indonesian outlets (6 of them in "
        "Jakarta) plus Singapore; no office split is published."},
    'kopi-tuku': {'note':
        "336 on LinkedIn — a floor for store crews across about 80 toko, Jabodetabek-first; "
        "no office split is published."},
    'common-grounds': {'note':
        "210 across 19 cafes (15 of them in Jakarta and Tangerang) — cafe crews are the "
        "workforce; no office split is published."},
    'flash-coffee': {'note':
        "423 on LinkedIn across an Indonesia-only network — 47 of its 56 sites in Greater "
        "Jakarta and 5 more in Bandung; store crews dominate. No office split is published."},
    'ftl-gym': {'note':
        "853 — trainers, coaches and front-desk staff across roughly 40 outlets in Jabodetabek "
        "and Bandung; no office split is published."},
    'ranch-market': {'note':
        "846 filed permanent staff of a 60-store supermarket group — store and warehouse "
        "workers dominate, and outsourced floor staff sit outside the filing; no office split "
        "is published."},
    'torch': {'note':
        "123 on LinkedIn — shopkeepers and warehouse staff across 11 stores in about 10 cities "
        "dominate the workforce; no office split is published."},
}

EMP_FIELDS = ('employees_est', 'employees_tier', 'employees_kind', 'employees_src',
              'employees_asof', 'employees_note', 'employees_reviewed')
SCOPE_FIELDS = ('jobs_scope', 'jobs_scope_note', 'jobs_scope_src', 'employees_national',
                'employees_national_src', 'employees_national_asof', 'employees_national_kind')

METRO_RULE = (
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
FRONTLINE_RULE = (
    " Jobs count the company's whole Indonesian payroll, frontline included: salaried couriers, "
    "sorters, store crews, gym coaches and village field officers are employment the company "
    "creates and are counted — driver-, courier-, merchant- and seller-partners (mitra) never "
    "are. Rows whose payroll is mostly frontline carry a `frontline` mark saying what kind of "
    "workforce the number is, and where the company itself discloses the split — Amartha's "
    "~9,000 field officers, FORE's 97% store staff — the office/frontline breakdown is "
    "published on the row. So the jobs total states the employment these companies actually "
    "carry, and the output model prices frontline payroll at the national frontline anchor "
    "rather than a Jakarta sector average."
)

GPR_METRO_TAIL = (
    "Jobs are people on the payroll working in the census metros: driver-, courier-, merchant- "
    "and seller-partners are mitra, not employees, and are never counted — and a nationwide "
    "network's payroll outside the metros is scoped out or dashed, because most of it is not "
    "working here."
)
GPR_FINAL_TAIL = (
    "Jobs are people on an Indonesian payroll: driver-, courier-, merchant- and seller-partners "
    "are mitra, not employees, and are never counted — and a payroll that is mostly frontline "
    "(couriers, store crews, field officers) is marked as such and priced at the national "
    "frontline anchor rather than a Jakarta sector average."
)

FRONTLINE_RULE_TEXT = (
    "A frontline worker is priced at Rp 149 million of value added a year — the BPS national "
    "economy-wide average: PDB 2023 at current prices, Rp 20,892.4 trillion, over 139.85 "
    "million employed (Sakernas, August 2023) — instead of a DKI Jakarta sector anchor. A "
    "courier, barista or village field officer adds roughly what the average Indonesian worker "
    "adds, not a Jakarta digital-sector multiple. Rows marked `frontline` price their whole "
    "payroll at this anchor; rows with a company-published split price the office share at the "
    "sector anchor and the frontline share at this one. Cross-check: FORE's audited FY2025 "
    "accounts imply about Rp 124 million of true value added per worker — within 20% of this "
    "anchor on the one audited case."
)
BPS_SOURCES = [
    'https://www.bps.go.id/en/pressrelease/2024/02/05/2379/ekonomi-indonesia-triwulan-iv-2023-tumbuh-5-04-persen--y-on-y-.html',
    'https://www.bps.go.id/en/pressrelease/2023/11/06/2002/tingkat-pengangguran-terbuka--tpt--sebesar-5-32-persen-dan-rata-rata-upah-buruh-sebesar-3-18-juta-rupiah-per-bulan.html',
]


def main():
    if not os.path.exists(BAK):
        shutil.copy2(RAW, BAK)
        print(f'backup -> {BAK}')
    raw = json.load(open(RAW))
    orig = {c['id']: c for c in json.load(open(BAK_SCOPE))['companies']}
    byid = {c['id']: c for c in raw['companies']}

    for cid, d in W.items():
        c, o = byid.get(cid), orig.get(cid)
        if not c or not o:
            print(f'!! {cid} missing (census={bool(c)}, backup={bool(o)}) — skipped')
            continue
        # restore the pre-scoping employee record verbatim; sweeps behave as before
        for k in EMP_FIELDS:
            if k in o:
                c[k] = o[k]
            else:
                c.pop(k, None)
        for k in SCOPE_FIELDS:
            c.pop(k, None)
        c['workforce_kind'] = 'frontline'
        c['workforce_note'] = d['note']
        if 'split' in d:
            s = d['split']
            assert s['office'] + s['frontline'] == c['employees_est'], \
                f"{cid}: split {s['office']}+{s['frontline']} != {c['employees_est']}"
            c['workforce_split'] = s
        else:
            c.pop('workforce_split', None)
        print(f"{cid:20s} est={c.get('employees_est')} split={'yes' if 'split' in d else 'label'}")

    m = raw['method']
    hr = m.get('headcount_rule', '')
    hr = hr.replace(METRO_RULE, '')
    if FRONTLINE_RULE not in hr:
        hr = hr.rstrip() + FRONTLINE_RULE
    m['headcount_rule'] = hr
    if GPR_METRO_TAIL in m.get('global_parent_rule', ''):
        m['global_parent_rule'] = m['global_parent_rule'].replace(GPR_METRO_TAIL, GPR_FINAL_TAIL)
    m['frontline_gva_per_worker_idr_m'] = FRONTLINE_ANCHOR
    m['frontline_rule'] = FRONTLINE_RULE_TEXT
    for u in BPS_SOURCES:
        if u not in m.get('sources', []):
            m.setdefault('sources', []).append(u)

    json.dump(raw, open(RAW, 'w'), indent=1, ensure_ascii=False)
    total = sum(c.get('employees_est') or 0 for c in raw['companies'])
    print(f'\nwrote {RAW} — {len(W)} rows, jobs total now ~{total:,}')


if __name__ == '__main__':
    main()
