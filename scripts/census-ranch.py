#!/usr/bin/env python3
"""Ranch Market (PT Supra Boga Lestari Tbk) — the acquired-incumbent lane.

Luca, 30 Aug 2026: "ranch market also, why you didnt involve it?"

He is right under the census's own rule. The inclusion test is "built OR BOUGHT
by tech or venture money rather than run as an incumbent's product line" — and
Blibli (PT Global Digital Niaga, Djarum group) completed the purchase of 51.00%
of Supra Boga Lestari on 30 Sep 2021 for Rp 2.03 trillion, folding the Ranch
Market / Farmers Market supermarkets into the Blibli Tiket omnichannel
ecosystem. The census already carries the other Blibli acquisitions (tiket.com
100%, Dekoruma 99.83%) with the containment mark; Ranch Market completes the
set. It was never considered-and-rejected — every earlier sweep walked startup
name-lists, so an incumbent that entered the tech graph by being acquired was
invisible to all of them (the StickEarn/adtech failure mode, in the M&A lane).

Row facts, all primary-sourced: filed headcount 846 (31 Dec 2025), live IDX
market cap Rp 813.5bn (~US$50M) cross-checked on two sources, ownership 51.00%
from BELI's own audited FY2025 consolidated statements.

Companion edits (same batch, other files):
  · scripts/census-valuation.py — MARKS 'ranch-market' listed/2026 + CONTAINED
    (inside Blibli, like tiket.com), or the build hard-fails by design.
  · scripts/census-output-flags.py — workforce flag: 846 supermarket staff at
    the commerce anchor.

Idempotent upsert by id; keeps logo/sprite of an existing row.
Run: python3 scripts/census-ranch.py
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
TODAY = '2026-08-30'

ROW = {
    'name': 'Ranch Market (Supra Boga Lestari)',
    'legal_name': 'PT Supra Boga Lestari Tbk',
    'sector': 'grocery retail — premium supermarkets (Ranch Market, Farmers Market), Blibli group omnichannel arm',
    'in_dki': True,
    'hq_address': ('Ranch Market Headquarter Lt. 5, Jl. Raya Pesanggrahan No. 2, Kembangan Selatan, '
                   'Kembangan, Jakarta Barat 11610'),
    'kecamatan': 'Kembangan',
    'kota': 'Jakarta Barat',
    'url': 'https://ranchmarket.co.id',
    'funding_total_usd_m': None,
    'last_round': 'Blibli bought 51.00% for Rp 2.03T (Sep 2021) — an acquisition, not a round',
    'last_round_year': 2021,
    'funding_note': (
        'No venture round on record, and none would be expected: Supra Boga Lestari is a 1997 '
        'retailer that listed on the IDX in June 2012 (RANC). The tech-money event is the '
        'acquisition — PT Global Digital Niaga (Blibli, Djarum group) completed its purchase of '
        '51.00% on 30 September 2021 for Rp 2.03 trillion, which is what brings the company into '
        'this census under the "bought by tech money" test.'),
    'valuation_usd_m': 50,
    'valuation_asof': '2026-08',
    'valuation_note': (
        'Live IDX market capitalisation: Rp 813.5bn — about US$50M — at Rp 520 a share in late Aug '
        '2026, the same figure on stockanalysis.com and Pluang. The company is loss-making on Rp '
        '2.98T of trailing revenue. HELD OUT of the census\'s combined valuation: Blibli holds '
        '51.00% and consolidates it (BELI\'s audited FY2025 statements), so the majority of this '
        'value already sits inside Blibli\'s market cap — the same treatment as tiket.com and '
        'Dekoruma.'),
    'employees_est': 846,
    'employees_asof': '2025-12-31',
    'employees_kind': 'company',
    'employees_src': 'https://stockanalysis.com/quote/idx/RANC/employees/',
    'employees_note': (
        '846 as filed for 31 December 2025 — the company\'s own figure, which beats every scrape. '
        'A 60-store supermarket group plainly runs on more people in uniform than that: outsourced '
        'and contract store staff do not appear in a filed permanent headcount, so read this as '
        'the payroll the company files, likely a floor on everyone working in its stores.'),
    'investors': ['PT Global Digital Niaga Tbk (Blibli) — 51.00%'],
    'sources': [
        'https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/RANC',
        'https://ranchmarket.co.id/story',
        'https://market.bisnis.com/read/20211001/192/1449103/grup-djarum-blibli-resmi-akuisisi-ranc-rp2-triliun',
        'https://www.liputan6.com/saham/read/4672813/blibli-akuisisi-51-persen-saham-supra-boga-lestari-rp-203-triliun',
        'https://asset-about.blibli.com/2026/03/LK-Konsolidasi_Global-Digital-Niaga_Des-2025.pdf',
        'https://stockanalysis.com/quote/idx/RANC/employees/',
        'https://stockanalysis.com/quote/idx/RANC/market-cap/',
        'https://pluang.com/asset/indo-stock/RANC',
        'https://ekbis.sindonews.com/read/1473957/178/telah-buka-62-store-ranc-pertajam-market-premium-di-2024-1729116616',
        'https://ranchmarket.co.id/cfind/source/files/other-information/siaran-pers---grand-launching-ranch-market-di-bliblimart.pdf',
    ],
    'confidence': 0.85,
    'verify_note': (
        'Established 1997 (deed No. 34 of 28 May 1997, per the company\'s own history page), '
        'premium-grocery operator of Ranch Market and Farmers Market — 62 stores as of Oct 2024 '
        '(SINDOnews) — listed on the IDX since June 2012 as RANC. Head office from the IDX\'s own '
        'listed-company profile: Ranch Market Headquarter Lt. 5, Jl. Raya Pesanggrahan No. 2, '
        'Kembangan, Jakarta Barat, above the flagship store. In the census under the "bought by '
        'tech money" test: Blibli completed a 51.00% acquisition on 30 Sep 2021 (Rp 2.03T) and '
        'consolidates the company as a direct subsidiary — its supermarkets became the physical '
        'grocery arm of the Blibli Tiket ecosystem, with official stores on Bliblimart from 7 Oct '
        '2021 (company press release). Missing until now because every earlier sweep walked '
        'startup name-lists, which an acquired 1997 incumbent never appears on. Operating as of '
        'Aug 2026 — site live, shares trading.'),
    'id': 'ranch-market',
    'site_status': 'ok',
    'liveness_checked': TODAY,
    'lat': -6.18833, 'lon': 106.75637,
    'geocode_src': 'photon:Ranch Market, Jalan Pesanggrahan 2, Kembangan',
    'geocode_kind': 'building',
}


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    before = len(raw['companies'])
    shutil.copyfile(RAW, RAW + '.bak-ranch')

    by_id = {c.get('id'): c for c in raw['companies']}
    cur = by_id.get(ROW['id'])
    if cur is None:
        raw['companies'].append(json.loads(json.dumps(ROW)))
        print('added ranch-market')
    else:
        keep = {k: cur[k] for k in ('logo', 'logo_src', 'sprite') if k in cur}
        cur.clear()
        cur.update(json.loads(json.dumps(ROW)))
        for k, v in keep.items():
            cur.setdefault(k, v)
        print('updated ranch-market')

    tmp = RAW + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)
    os.replace(tmp, RAW)
    print(f'census-raw.json: {before} -> {len(raw["companies"])} companies (backup: .bak-ranch)')


main()
