#!/usr/bin/env python3
"""ByteDance/TikTok Indonesia: the global-parent row Luca pointed at.

Luca, 30 Aug 2026: "it seems in 1001startup.id it missed tiktok/bytedance,
bytedance can be called as startup, it acquires the tiktokshop, and the
bytedance indonesia holding tiktok, means a lot of job there."

He is right by the census's own rules. The scope register only ever decided
TikTok SHOP (correctly: it runs through PT Tokopedia, already a row) — the
TikTok APP operation, ByteDance's own Indonesian presence, was never considered
anywhere, which from the outside is indistinguishable from ignorance (the
Superbank lesson). Under the global-parent rule (Grab / Shopee / Lazada /
Lalamove precedents) it belongs in as one row, Indonesia-only:

  · TikTok Indonesia (ByteDance) — PT MP Games (ByteDance's Indonesian entity)

ENTITY CHAIN, all first-party or registry:
  · TikTok for Business's own Indonesia VAT/WHT help page (May 2026): Indonesian
    advertisers contract with "PT MP Games or TikTok Pte. Ltd."; tax invoices
    arrive from noreply-invoice@mail.bytedance.net.
  · Ministry of Law registry (biz no. 291927, via companieshouse.id): PT MP
    Games, Lantai 31, Sinar Mas Land Plaza Sudirman, Jl. Jend. Sudirman Kav. 21,
    South Jakarta. An amendment snapshot (iditrix) carries the earlier
    registered address: Gandaria 8 Office Tower 09D-E — TikTok Indonesia's
    long-time office (also where the PASAR world's TikTok tenant stands).
  · The same PT holds the registered copyrights for BABE — ByteDance's
    Indonesian news app — tying the entity to ByteDance on the registry side.
  · The app itself is registered under TikTok Pte. Ltd. (SG) on Komdigi's PSE
    register; the Tokopedia stake is held via TikTok Nusantara (SG) Pte. Ltd.

DELIBERATE DASHES (the Lalamove discipline — a dash row can still carry filed
operating substance):
  · funding   — group capital only; no Indonesian raise exists. The US$1.5B the
    group put INTO Indonesia is the PT Tokopedia row's last round, not this one.
  · valuation — ByteDance's US$550B (Feb 2026 GA secondary, Reuters) and
    US$330B+ (Aug 2025 buyback, Reuters) are GROUP marks; no Indonesia revenue
    split is published, so no Grab-style carve is possible.
  · jobs      — Indonesian payroll only, and no publishable figure exists:
    no Indonesia-scoped LinkedIn entity page, job boards self-declare bands
    (never published as counts), and the Jul 2026 restructuring was confirmed
    by TikTok WITHOUT a number. A 2023 "2,000 staff" figure could not be
    re-sourced and is withdrawn, not used. Creators/sellers/affiliates = mitra.

Also owned here (upsert-by-name, never wholesale — the census-banks lesson):
  · scope line 'ByteDance Ltd. (group)' — the group itself is never a row;
  · the existing 'TikTok Shop Indonesia' line gains a pointer to this row.

Idempotent: re-reads census-raw.json at run time (parallel sessions write it),
upserts by id/name, and re-applies cleanly after a clobber.
Run: python3 scripts/census-tiktok.py
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
TODAY = '2026-08-30'

ROW = {
    'id': 'tiktok-indonesia',
    'name': 'TikTok Indonesia (ByteDance)',
    'legal_name': 'PT MP Games',
    'sector': 'media — short-video social platform & creator economy',
    'in_dki': True,
    'hq_address': ('Sinar Mas Land Plaza Sudirman (Sinarmas MSIG Tower) Lt. 31, '
                   'Jl. Jend. Sudirman Kav. 21, Karet, Setiabudi, Jakarta Selatan 12920'),
    'kecamatan': 'Setiabudi',
    'kota': 'Jakarta Selatan',
    # Same-building pin idiom: the pinhome row is WeWork, Sinarmas MSIG Tower 38F.
    'lat': -6.22782,
    'lon': 106.82523,
    'geocode_src': 'same building as the pinhome row (Sinarmas MSIG Tower, Jl. Jend. Sudirman Kav. 21)',
    'geocode_kind': 'building',
    'url': 'https://www.tiktok.com',
    'id_only': True,
    'global_parent': {
        'group': 'ByteDance Ltd. (TikTok)',
        'listing': None,
        'domicile': 'Cayman Islands holding; operating headquarters in Beijing, TikTok run from Singapore and Los Angeles',
        'group_valuation_usd_m': 550000,
        'group_valuation_asof': 'Feb 2026 (Reuters — General Atlantic secondary sale)',
        'indonesia_basis': None,
        'group_funding': ('Venture-built and still private: SIG Susquehanna, HongShan (Sequoia China), '
                          'General Atlantic and SoftBank among backers. Recent marks are capital going the '
                          'other way — an employee-share buyback above US$330B (Aug 2025) and a General '
                          'Atlantic secondary sale at about US$550B (Feb 2026), both per Reuters; group '
                          'revenue US$48B in Q2 2025 alone'),
    },
    'funding_total_usd_m': None,
    'last_round': 'Group level only — Feb 2026 secondary at ~US$550B (Reuters)',
    'last_round_year': None,
    'funding_note': (
        'Not an Indonesian figure, so none is published. ByteDance raised its capital at group level — '
        'SIG Susquehanna, HongShan (Sequoia China), General Atlantic and SoftBank among its backers — and '
        'PT MP Games has no disclosed Indonesian raise of its own. The group has lately been returning '
        'capital, not raising it: an employee-share buyback at a valuation above US$330B (Aug 2025) and a '
        'General Atlantic secondary sale at about US$550B (Feb 2026), both per Reuters. The US$1.5B the '
        'group put INTO Indonesia in January 2024 is the PT Tokopedia transaction and sits on that row, '
        'not this one.'),
    'valuation_usd_m': None,
    'valuation_note': (
        'No Indonesian figure exists and there is no basis to carve one. ByteDance is private and its '
        'marks are group-wide — about US$550B in a Feb 2026 General Atlantic secondary sale, above '
        'US$330B in the Aug 2025 buyback, both per Reuters — and the group publishes no Indonesia '
        'revenue split, so a Grab-style carve-out (Indonesia share of revenue x group value) is '
        'impossible; anything printed here would be invented. Indonesia being TikTok’s largest '
        'market by users is a reach fact, not a valuation basis.'),
    'employees_est': None,
    'employees_note': (
        'INDONESIAN PAYROLL ONLY, and no publishable figure exists. TikTok/ByteDance has never filed or '
        'stated an Indonesian headcount: LinkedIn has no Indonesia-scoped employer page (the global '
        'TikTok and ByteDance pages mix every market), and Indonesian job boards self-declare bands — '
        'Kitalulus’s ByteDance profile says "more than 2,000 employees" (read Feb 2026), a band '
        'this census never publishes as a count. What is on record: TikTok confirmed an Indonesian '
        'restructuring on 2 Jul 2026 without disclosing a number (CNBC Indonesia; Fortune IDN); DPR '
        'leadership put about 200 voluntary packages on the TikTok Shop–Tokopedia side while press '
        'reports ran to 1,250 — both sides are carried on the PT Tokopedia row, whose remaining staff '
        'are counted there, not here. A "2,000 staff in Indonesia" figure circulated in 2023 coverage '
        'could not be re-sourced and is withdrawn rather than reused. Creators, sellers and affiliate '
        'promoters are mitra by construction and are never counted.'),
    'operating_evidence': (
        'TikTok’s own usage figures, stated by its GM of Content Operations SEA Angga Anugrah '
        'Putra at the TikTok SEA Growth Summit (Jakarta, 30 Jul 2025, Kompas): more than 160M monthly '
        'active users in Indonesia in Q1 2025 — TikTok’s largest market in Southeast Asia '
        '(Vietnam 70M, Thailand 50M; 460M across 11 SEA markets) — up from 10M MAU in Jul 2018 (SVP '
        'Zhen Liu, same Kompas piece). CEO Shou Zi Chew pledged a US$10B multi-year Indonesian '
        'investment in Jakarta, Jun 2023 (Liputan6/Bisnis). Regulatory trail: Komdigi suspended '
        'TikTok’s PSE registration (TDPSE) on 3 Oct 2025 after TikTok supplied only partial data '
        'on TikTok Live monetisation during the 25–30 Aug 2025 protests (suspected online-'
        'gambling-linked gifting), and lifted the suspension on 5 Oct 2025 once the data was delivered '
        '(Komdigi releases; ANTARA; Kompas). Through TikTok Nusantara (SG) Pte. Ltd. the group has '
        'held 75.01% of PT Tokopedia since 31 Jan 2024; KPPU fined that entity Rp 15B on 29 Sep 2025 '
        'for late merger notification (Putusan 02/KPPU-M/2025).'),
    'investors': [],
    'sources': [
        'https://ads.tiktok.com/help/article/indonesia-vat-wht?lang=en',
        'https://companieshouse.id/mp-games',
        'https://iditrix.com/mp-games/554627/',
        'https://www.komdigi.go.id/berita/siaran-pers/detail/tidak-penuhi-kewajiban-komdigi-suspend-tanda-daftar-pse-tiktok',
        'https://www.komdigi.go.id/berita/siaran-pers/detail/kemkomdigi-cabut-pembekuan-sementara-tiktok',
        'https://www.antaranews.com/berita/5150845/kemkomdigi-bekukan-sementara-izin-tiktok-karena-langgar-kewajiban-pse',
        'https://tekno.kompas.com/read/2025/07/30/14164347/pengguna-tiktok-di-indonesia-tembus-160-juta-terbanyak-di-asia-tenggara',
        'https://jdih.kaboki.go.id/PutusanPengadilan/view_produk?id=VjB3TDM2RVVLRDJkbEVKbHVyVEMyUT09',
        'https://ekonomi.bisnis.com/read/20250929/9/1915700/tiktok-didenda-rp15-miliar-gara-gara-telat-laporkan-akuisisi-saham-tokopedia',
        'https://www.reuters.com/world/china/bytedance-valued-550-billion-proposed-share-sale-by-general-atlantic-sources-say-2026-02-25/',
        'https://www.reuters.com/business/finance/tiktok-owner-bytedance-sets-valuation-over-330-billion-revenue-grows-sources-say-2025-08-27/',
        'https://www.bloomberg.com/news/articles/2025-05-30/tiktok-shop-cutting-more-indonesia-jobs-after-taking-over-rival',
        'https://www.cnbcindonesia.com/tech/20260702111409-37-747459/tiktok-buka-suara-soal-kabar-phk-90-karyawan-tokopedia',
        'https://www.liputan6.com/bisnis/read/5329687/tiktok-bakal-investasi-rp-148-triliun-di-indonesia-hipmi-harus-gandeng-perusahaan-lokal',
        'https://www.kitalulus.com/company/bytedance-nqf2',
    ],
    'confidence': 0.75,
    'verify_note': (
        'ByteDance’s own Indonesian operation — the TikTok APP side — counted under the global-'
        'parent rule; the e-commerce arm runs through PT Tokopedia (75.01% TikTok-held), which has its '
        'own census row, so nothing here double-counts it. ENTITY CHAIN: PT MP Games is TikTok’s '
        'Indonesian contracting entity per TikTok for Business’s own Indonesia VAT/WHT help page '
        '(last updated May 2026 — Indonesian advertisers contract with "PT MP Games or TikTok Pte. '
        'Ltd."; tax invoices arrive from mail.bytedance.net). The Ministry of Law registry (business '
        'number 291927, via companieshouse.id) has PT MP Games at Sinar Mas Land Plaza Sudirman Lt. '
        '31; an amendment snapshot (iditrix) shows the earlier registered address at Gandaria 8 Office '
        'Tower 09D-E — TikTok Indonesia’s long-time office. The same PT holds the registered '
        'copyrights for BABE, ByteDance’s Indonesian news app — the registry-side tie to the '
        'group. The TikTok app itself is registered under TikTok Pte. Ltd. (Singapore) on '
        'Komdigi’s PSE register. ByteDance (founded 2012, Beijing) is venture-built and still '
        'private, so the built-by-tech-money test passes on the group itself. Operating as of 30 Aug '
        '2026: tiktok.com serves; the Jul 2026 restructuring did not close the Indonesian operation.'),
    'logo': '/assets/logo-c-tiktok-indonesia.webp',
    'logo_src': 'site',
    'site_status': 'ok',
    'liveness_checked': TODAY,
}

SCOPE_ADD = [
    {
        'name': 'ByteDance Ltd. (group)',
        'owner': 'private; Cayman Islands holding, Beijing operating HQ',
        'why': ('a foreign group is never itself a row — its Indonesian slice is: PT MP Games, the '
                'TikTok app operation (the TikTok Indonesia (ByteDance) row), and PT Tokopedia, the '
                'e-commerce arm 75.01% TikTok-held (its own row), both counted Indonesia-only under '
                'the global-parent rule'),
    },
]

# The Shop line predates this row; give it the forward pointer so the register
# reads as one decision, not two contradictory ones.
SHOP_POINTER = (' The TikTok app operation itself is counted — see the '
                'TikTok Indonesia (ByteDance) row.')


def main():
    with open(RAW) as f:
        raw = json.load(f)
    shutil.copy2(RAW, RAW + '.bak-tiktok')

    cos = raw['companies']
    before = len(cos)
    by_id = {c.get('id'): i for i, c in enumerate(cos)}
    if 'tiktok-indonesia' in by_id:
        i = by_id['tiktok-indonesia']
        keep = {k: cos[i][k] for k in ('lat', 'lon', 'logo', 'logo_src') if k in cos[i]}
        merged = dict(cos[i]); merged.update(ROW)
        # this script carries its own pin/logo; only keep foreign values if we lacked one
        for k, v in keep.items():
            if ROW.get(k) is None:
                merged[k] = v
        cos[i] = merged
        print('updated tiktok-indonesia in place')
    else:
        cos.append(dict(ROW))
        print('added tiktok-indonesia')

    sc = raw.setdefault('scope', {})
    out = sc.setdefault('outside', [])
    names = {e.get('name'): e for e in out}
    for e in SCOPE_ADD:
        if e['name'] in names:
            names[e['name']].update(e)
            print('scope line updated:', e['name'])
        else:
            out.append(dict(e))
            print('scope line added:', e['name'])
    shop = names.get('TikTok Shop Indonesia')
    if shop and 'TikTok Indonesia (ByteDance)' not in shop.get('why', ''):
        shop['why'] = shop['why'].rstrip() + SHOP_POINTER
        print('scope line pointed forward: TikTok Shop Indonesia')

    with open(RAW, 'w') as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)
    print(f'companies {before} -> {len(cos)}; scope outside lines: {len(out)}')


if __name__ == '__main__':
    main()
