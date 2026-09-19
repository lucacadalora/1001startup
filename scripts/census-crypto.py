#!/usr/bin/env python3
"""Crypto cohort — the dedicated sector + its rows (Aug 30 2026).

Luca, round 1: "need a dedicated fintech sector for crypto — indodax,
tokocrypto, pintu, pluang, also add idrx search it". Round 2, after the sector
shipped with 7 rows: "you missed: bybit indonesia, triv (Funded by mexc), do
more search".

What this script owns (idempotent — re-running it is the repair after any
cross-session clobber):

1. Six rows: IDRX, Bybit Indonesia (NOBI), Triv, Mobee, Bittime, Upbit
   Indonesia. (Indodax/Tokocrypto/Pintu/Pluang/Reku/Nanovest predate this
   script — an Aug-29 parallel batch added them; this script only PATCHES them.)
2. Sector-string rewrites that move rows into the 'crypto' bucket. The
   bucket's regex in build-census.js matches ONLY strings that LEAD with the
   controlled phrase 'web3/crypto' (the bank-rule precedent): 'crypto' appears
   mid-string in wealth-app copy — Ajaib's 'stocks, mutual funds, crypto' —
   where it must NOT move the row.
3. The 'crypto' GVA anchor = 1,075 jt/worker, THE SAME VALUE as fintech, on
   purpose: exchanges and a stablecoin issuer are financial-services firms
   priced at the same discounted BPS DKI sector-K anchor; the bank exception
   (own filed-average anchor) does not apply to non-bank licensees.
4. Scope lines (upsert-by-name, never wholesale, never scope['rule']):
   Ajaib Kripto (inside the Ajaib row), NVX/BTSE (fails headcount), Luno
   Indonesia (OJK-licensed May 2026 but exiting unnamed regions 1 Sep 2026 —
   QUEUED), Naga Exchange (6 people), Bitwewe (no readable headcount).

Companion edit: scripts/census-valuation.py MARKS carries 'triv' (private,
2025) — the US$200M MEXC deal mark — or the build hard-fails by design.

Licence facts used in strings/notes, all first-party:
  · Pintu    = PFAK 01/BAPPEBTI/PFAK/08/2024 (1 Aug 2024, Indonesia's first) — Kemendag release.
  · Pluang   = PT Bumi Santosa Cemerlang, PFAK 02/BAPPEBTI/PFAK/08/2024 (same release).
  · Tokocrypto = PT Aset Digital Berkat, PFAK 03/…/09/2024 — Bappebti register.
  · Nanovest = PT Tumbuh Bersama Nano, PFAK 11/…/12/2024, Mayapada Tower 1 — register.
  · Indodax  = PFAK 10/…/12/2024 — register.  · Reku = PFAK Nov 2024 — own PR.
  · Triv     = full PFAK Oct 2024 (Bappebti pojok-media + Katadata/Kontan); CPAK 001/2020 was the FIRST.
  · Mobee    = PT CTXG Indonesia Berkarya, PFAK 07/…/11/2024, Treasury Tower Lt. 18.
  · NOBI     = PT Enkripsi Teknologi Handal, PFAK 09/…/12/2024, UOB Plaza — Bybit majority Jul 2026.
  · Bittime  = PT Utama Aset Digital Indonesia, OJK PAKD KEP-11/D.07/2025 (22 May 2025) — own blog + press.
  · Upbit    = PT Upbit Exchange Indonesia, OJK PAKD KEP-6/D.07/2025 (17 Mar 2025) — OJK's own page.
  · NOT-Nanovest trap: NVX (PT Aset Kripto Internasional, PFAK 05/…/01/2025,
    since Jul 2026 the BTSE Indonesia JV) is an unrelated company.

Media-misread trap recorded on the Triv row: MEXC's own release says a
strategic investment AT a US$200M valuation, amount undisclosed — several
Indonesian outlets printed "pendanaan Rp 3,2 triliun", the valuation misread
as the cheque. The funding cell stays a dash; the valuation carries the mark.

Run: python3 scripts/census-crypto.py
Then: python3 scripts/census-valuation.py && node scripts/build-census.js
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
TODAY = '2026-08-30'

BAPPEBTI = 'https://bappebti.go.id/pedagang_aset_kripto'
KEMENDAG = 'https://www.kemendag.go.id/berita/siaran-pers/sahkan-dua-pfak-bappebti-fokus-perkuat-ekosistem-aset-kripto'
REKU_PR = 'https://reku.id/en/information/reku-dapat-lisensi-pfak-dari-bappebti-siap-genjot-pertumbuhan-industri-kripto-indonesia'

# Treasury Tower pin — the same coordinates every Treasury Tower row carries.
TREASURY = {'lat': -6.22793, 'lon': 106.8063, 'geocode_kind': 'building'}

ROWS = [
 {
    'name': 'IDRX',
    'legal_name': 'PT IDRX Indo Inovasi',
    'sector': 'web3/crypto (rupiah stablecoin issuer)',
    'url': 'https://idrx.co',
    'in_dki': True,
    'hq_address': ('Gedung Treasury Tower No. 16B, District 8 SCBD Lot 28, Jl. Jend. Sudirman '
                   'Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan'),
    'kecamatan': 'Kebayoran Baru',
    'kota': 'Jakarta Selatan',
    'lat': TREASURY['lat'], 'lon': TREASURY['lon'],
    'geocode_kind': 'building',
    'geocode_src': 'same building as the superbank row (Treasury Tower, registry address)',
    'funding_total_usd_m': 0.3,
    'last_round': 'Pre-seed (eMerge by MDI Ventures-led)',
    'last_round_year': 2025,
    'funding_src': 'https://www.antaranews.com/berita/5125552/startup-kripto-idrx-raih-pendanaan-awal-rp48-miliar',
    'funding_src_tier': 'announced',
    'funding_src_all': [
        'https://www.antaranews.com/berita/5125552/startup-kripto-idrx-raih-pendanaan-awal-rp48-miliar',
        'https://investor.id/market/410627/idrx-kantongi-pendanaan-tahap-awal-rp-49-miliar',
        'https://news.dailysocial.id/post/idrx-kantongi-pendanaan-awal-rp49-miliar-bangun-stablecoin-rupiah/',
        'https://investasi.kontan.co.id/news/startup-kripto-idrx-kantongi-pendanaan-awal-senilai-rp-48-miliar',
    ],
    'funding_note': (
        'US$300K pre-seed announced 22 Sep 2025, led by eMerge by MDI Ventures (the early-stage '
        'arm of Telkom Indonesia’s VC) with Indodax, MANSA, Lisk, Camp Investment '
        'Technologies and angels including William Sutanto (Indodax co-founder). Vendor/LinkedIn '
        'records claim US$550K over two rounds — the extra US$250K has no announcement '
        'behind it and is not counted.'),
    'valuation_usd_m': None,
    'valuation_note': ('No company mark on record. The token’s circulating market value is a '
                       'claim about the stablecoin float, not about the company, and is not used.'),
    'employees_est': 13,
    'employees_asof': TODAY,
    'employees_kind': 'linkedin',
    'employees_src': 'https://www.linkedin.com/company/idrx-indo-inovasi',
    'employees_note': (
        'Live LinkedIn company-page count 13 ("Discover all 13 employees"), read 2026-08-30; the '
        'page’s self-declared band is 11-50 and Exa’s vendor record reads 11 (+50% YoY) '
        '— the three agree for a two-year-old issuer team.'),
    'investors': ['eMerge by MDI Ventures', 'Indodax', 'MANSA', 'Lisk', 'Camp Investment Technologies'],
    'sources': [
        'https://companieshouse.id/idrx-indo-inovasi',
        'https://www.antaranews.com/berita/5125552/startup-kripto-idrx-raih-pendanaan-awal-rp48-miliar',
        'https://indodax.com/market/IDRXIDR',
        'https://www.instagram.com/reel/DRRcANMAqg6/',
        'https://gizmologi.id/news/crypto/idrx-gandeng-solana-superteam/',
        'https://market.bisnis.com/read/20260703/94/1985487/stablecoin-rupiah-idrx-dibidik-jadi-infrastruktur-pembayaran-lintas-negara',
        'https://www.antaranews.com/berita/5635845/stablecoin-rupiah-hadirkan-efisiensi-transaksi-remitansi',
        'https://www.linkedin.com/company/idrx-indo-inovasi',
        'https://home.idrx.co/en/',
        'https://docs.idrx.co/',
    ],
    'confidence': 0.8,
    'verify_note': (
        'PT IDRX Indo Inovasi — Ministry of Law registry no. 1351027, established 31 Jan '
        '2023, registered at Gedung Treasury Tower No. 16B (the pin reuses the census’s '
        'Treasury Tower coordinates); LinkedIn’s own location block lists an operating '
        'address at Jl. Prof. DR. Soepomo No. 2, Menteng Dalam, Tebet — both kept, filed '
        'address headlined. Issuer of IDRX, a rupiah-pegged stablecoin (1 IDRX = Rp 1) on '
        'multiple EVM chains and Solana, CertiK-audited, redeemable for rupiah; backed by fiat '
        'reserves and government bonds per its own site. Crypto assets are not legal tender in '
        'Indonesia — IDRX trades as a listed crypto asset, not a payment instrument: a live '
        'IDRX/IDR market on Indodax and a Pintu listing since Nov 2025 (Pintu’s own '
        'announcement). Founded by CEO Nathanael Christian. Not to be confused with IDRT '
        '(Rupiah Token), the older rupiah stablecoin by a different issuer.'),
    'operating_evidence': (
        'Aug 2026: site and docs live, IDRX/IDR market trading on Indodax (~Rp 1.3bn 24h volume '
        'on the day read). 21 Jan 2026: MoU with Solana Superteam Indonesia on rupiah-based '
        'real-world-asset tokenisation (Gizmologi). Jul 2026: showcased cross-border remittance '
        'rails at MASA 2026 in Singapore, covered by ANTARA and Bisnis.com.'),
    'id': 'idrx',
    'site_status': 'ok',
    'liveness_checked': TODAY,
 },
 {
    'name': 'Bybit Indonesia (NOBI)',
    'legal_name': 'PT Enkripsi Teknologi Handal',
    'sector': 'web3/crypto (Bybit-owned crypto exchange, ex-NOBI — PFAK 09/BAPPEBTI/PFAK/12/2024)',
    'url': 'https://www.bybit.id',
    'in_dki': True,
    'hq_address': ('UOB Plaza (Thamrin Nine) Lantai 31, Jl. M.H. Thamrin No. 10, Karet Tengsin, '
                   'Tanah Abang, Jakarta Pusat 10220'),
    'kecamatan': 'Tanah Abang',
    'kota': 'Jakarta Pusat',
    'lat': -6.19898, 'lon': 106.8223527,
    'geocode_kind': 'building',
    'geocode_src': 'photon:UOB Plaza Thamrin Nine',
    'funding_total_usd_m': 4,
    'last_round': 'Majority acquisition by Bybit (platform live 15 Jul 2026)',
    'last_round_year': 2026,
    'funding_src': 'https://acv.vc/insights/acv-portfolio-news/3600/',
    'funding_src_tier': 'announced',
    'funding_src_all': [
        'https://acv.vc/insights/acv-portfolio-news/3600/',
        'https://technode.global/2022/02/17/indonesias-nobi-lands-4m-in-an-oversubscribed-seed-funding-round-led-by-ac-ventures/',
        'https://teknologi.bisnis.com/read/20220217/266/1501795/platform-aset-kripto-nobi-disuntik-ac-ventures-us4-juta',
    ],
    'funding_note': (
        'US$4M = the oversubscribed seed of Feb 2022, raised as NOBI — led by AC Ventures with '
        'AppWorks, Skystar Capital, Cakra Ventures, Global Founders Capital and angels (the '
        'lead investor’s own release). The Jul 2026 Bybit majority acquisition carries no '
        'disclosed price, and group money is never an Indonesian total.'),
    'valuation_usd_m': None,
    'valuation_note': ('Bybit’s majority acquisition (announced 16 Jul 2026) has no disclosed '
                       'price — no independent mark exists.'),
    'employees_est': 50,
    'employees_asof': TODAY,
    'employees_kind': 'linkedin',
    'employees_src': 'https://www.linkedin.com/company/usenobi',
    'employees_note': (
        'Live LinkedIn count on the NOBI entity page ("Discover all 50 employees", read '
        '2026-08-30; self-declared band 11-50). The new Bybit Indonesia brand page lists 3 '
        'people — the same team mid-migration, not additive (the Bahasa.ai/Meeting.ai '
        'two-page rule).'),
    'investors': ['Bybit (majority owner)', 'AC Ventures', 'AppWorks', 'Skystar Capital',
                  'Cakra Ventures', 'Global Founders Capital'],
    'sources': [
        'https://www.prnewswire.com/news-releases/bybit-to-launch-indonesia-platform-following-majority-acquisition-of-nobi-302827728.html',
        'https://acv.vc/insights/acv-portfolio-news/3600/',
        'https://technode.global/2022/02/17/indonesias-nobi-lands-4m-in-an-oversubscribed-seed-funding-round-led-by-ac-ventures/',
        'https://www.liputan6.com/crypto/read/8248377/akuisisi-nobi-bybit-resmi-masuk-indonesia',
        BAPPEBTI,
        'https://www.linkedin.com/company/usenobi',
        'https://www.linkedin.com/company/bybitindonesia',
    ],
    'confidence': 0.85,
    'verify_note': (
        'PT Enkripsi Teknologi Handal — founded 2018 as Honest Mining by Lawrence Samantha and '
        'Dion Evan, rebranded NOBI (crypto asset management), full PFAK licence '
        '09/BAPPEBTI/PFAK/12/2024 filed at UOB Plaza Lt. 31, Thamrin (the regulator’s register; '
        'CB Insights’ "Jakarta Barat" is wrong — filed address wins). Bybit — the world’s '
        'second-largest exchange by volume, per its own release — acquired a majority and '
        'launched Bybit Indonesia on 15 Jul 2026 under OJK supervision at bybit.id, with '
        'co-founder Dion Evan as Bybit Indonesia COO (continuity, not a shell). Counted at the '
        'Indonesian entity only, the Tokocrypto/Binance treatment.'),
    'operating_evidence': (
        'Platform launched 15 Jul 2026 with ~500 trading pairs (own release, wide Indonesian '
        'coverage); bybit.id live Aug 2026; usenobi.com still serves the legacy brand.'),
    'id': 'bybit-indonesia',
    'site_status': 'ok',
    'liveness_checked': TODAY,
 },
 {
    'name': 'Triv',
    'legal_name': 'PT Tiga Inti Utama',
    'sector': 'web3/crypto & multi-asset exchange (PFAK-licensed Oct 2024; US stocks, gold)',
    'url': 'https://triv.co.id',
    'in_dki': True,
    'hq_address': ('One Pacific Place Level 11, SCBD, Jl. Jend. Sudirman Kav. 52-53, Senayan, '
                   'Kebayoran Baru, Jakarta Selatan 12190'),
    'kecamatan': 'Kebayoran Baru',
    'kota': 'Jakarta Selatan',
    'lat': -6.2247671, 'lon': 106.8098512,
    'geocode_kind': 'building',
    'geocode_src': 'photon:Pacific Place complex, SCBD (One Pacific Place tower)',
    'funding_total_usd_m': None,
    'last_round': 'Strategic investment (MEXC Ventures) — amount undisclosed',
    'last_round_year': 2025,
    'funding_note': (
        'No round amount has ever been disclosed. The Aug 2025 MEXC Ventures deal is a '
        'strategic investment AT a US$200M valuation — MEXC’s own release gives no amount; '
        'several Indonesian outlets printed "pendanaan Rp 3,2 triliun", which is the valuation '
        'misread as the cheque. Not counted.'),
    'valuation_usd_m': 200,
    'valuation_asof': '2025-08',
    'valuation_note': (
        'US$200M is the valuation MEXC Ventures’ own announcement (5 Aug 2025) attaches to its '
        'strategic investment — a deal mark, not a market price.'),
    'employees_est': 101,
    'employees_asof': TODAY,
    'employees_kind': 'linkedin',
    'employees_src': 'https://www.linkedin.com/company/triv',
    'employees_note': (
        'Live LinkedIn page count 101 ("Discover all 101 employees", read 2026-08-30; '
        'self-declared band 51-200; Jobstreet band 51-100). Exa’s vendor record reads 59 '
        '(+81% YoY) — the spread is recorded, read the figure as a band (Kata.ai rule).'),
    'employees_exa': 59,
    'employees_spread': True,
    'investors': ['MEXC Ventures'],
    'sources': [
        'https://www.prnewswire.com/news-releases/mexc-ventures-invests-in-triv-indonesias-leading-crypto-exchange-at-200-million-valuation-to-accelerate-southeast-asia-expansion-302520573.html',
        'https://blog.triv.co.id/triv-raih-investasi-strategis-us200-juta-dari-mexc-ventures/',
        'https://money.kompas.com/read/2025/08/10/115000026/platform-kripto-triv-dapat-pendanaan-rp-3-2-triliun-dari-mexc-ventures',
        'https://katadata.co.id/finansial/keuangan/6703a33fdda41/platform-kripto-triv-raih-izin-penuh-pfak-dari-bappebti',
        'https://investasi.kontan.co.id/news/triv-raih-izin-penuh-pfak-dari-bappebti',
        'https://bappebti.go.id/pojok_media/detail/15455',
        'https://companieshouse.id/tiga-inti-utama',
        'https://www.linkedin.com/company/triv',
        'https://id.jobstreet.com/id/companies/triv-168557425860995',
        'https://triv.co.id/en/about',
    ],
    'confidence': 0.8,
    'verify_note': (
        'Founded 2015 by Gabriel Rey. Registry: PT Tiga Inti Utama, reg. 704087, registered '
        'address Jl. Tambakrejo No. 44-46, Surabaya — the SCBD office headlined above is the '
        'company’s own LinkedIn-listed head office and where its Jakarta hiring sits (Jobstreet '
        'lists "Surabaya & Jakarta"); counted on the Qiscus rule: operation headquartered in '
        'scope, legal home elsewhere, both recorded. The FIRST registered crypto-trader '
        'candidate in Indonesia (CPAK 001/BAPPEBTI/CP-AK/01/2020, per its own LinkedIn) and '
        'full PFAK licence Oct 2024 (Bappebti pojok-media repost; Katadata; Kontan). Claims 3M+ '
        'users and US$7.5M paid-up capital (own LinkedIn). Has since expanded to US stocks and '
        'gold alongside crypto (own about page).'),
    'operating_evidence': (
        'Aug 2026: site and apps live. 5 Aug 2025: MEXC Ventures strategic partnership at a '
        'US$200M valuation, with SEA expansion framing (MEXC’s own release, Decrypt, national '
        'press).'),
    'id': 'triv',
    'site_status': 'ok',
    'liveness_checked': TODAY,
 },
 {
    'name': 'Mobee',
    'legal_name': 'PT CTXG Indonesia Berkarya',
    'sector': 'web3/crypto (crypto exchange — PFAK 07/BAPPEBTI/PFAK/11/2024, OJK-supervised)',
    'url': 'https://mobee.com',
    'in_dki': True,
    'hq_address': ('District 8 Treasury Tower Lantai 18, SCBD Lot 28, Jl. Jend. Sudirman '
                   'Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190'),
    'kecamatan': 'Kebayoran Baru',
    'kota': 'Jakarta Selatan',
    'lat': TREASURY['lat'], 'lon': TREASURY['lon'],
    'geocode_kind': 'building',
    'geocode_src': 'same building as the superbank row (Treasury Tower, PFAK filing)',
    'funding_total_usd_m': None,
    'last_round': 'Undisclosed round (1982 Ventures-led)',
    'last_round_year': 2023,
    'funding_note': (
        'The Mar 2023 launch round led by 1982 Ventures, with Indonesian family offices and '
        'strategic angels, was undisclosed — the company’s own release names the lead but no '
        'amount, and no tracker carries a credible one.'),
    'valuation_usd_m': None,
    'employees_est': 61,
    'employees_asof': TODAY,
    'employees_kind': 'linkedin',
    'employees_src': 'https://www.linkedin.com/company/mobee-com',
    'employees_note': (
        'Live LinkedIn count 61 ("View all 61 employees", read 2026-08-30; self-declared band '
        '51-200). An older duplicate page (mobee-io) froze at 56 — same company, not '
        'additive.'),
    'investors': ['1982 Ventures'],
    'sources': [
        'https://mobee.com/en/company',
        'https://mobee.com/en/news/mobee-funding-1982-ventures',
        'https://asiatechdaily.com/digital-asset-exchange-mobee-launches-in-indonesia-secures-funding/',
        'https://www.preqin.com/data/profile/asset/mobee/536967',
        BAPPEBTI,
        'https://www.cbinsights.com/company/mobee',
        'https://www.linkedin.com/company/mobee-com',
    ],
    'confidence': 0.8,
    'verify_note': (
        'Founded Oct 2021 by Andrew Tjahyadikarta and Jeff Pradana (Preqin; AsiaTechDaily), '
        'launched Mar 2023 first for qualified/institutional investors, now a retail exchange '
        'claiming 100K+ registered users and 400+ pairs (own company page). Full PFAK licence '
        '07/BAPPEBTI/PFAK/11/2024 filed at District 8 Treasury Tower Lt. 18 — the census’s '
        'Treasury Tower pin is reused. Own site: licensed and supervised by OJK and Komdigi, '
        'ISO 27001 certified.'),
    'operating_evidence': (
        'Aug 2026: Gold sponsor of Indonesia Blockchain Week (12-13 Aug 2026, IDBW’s own '
        'LinkedIn); app relaunch Dec 2025; site live.'),
    'id': 'mobee',
    'site_status': 'ok',
    'liveness_checked': TODAY,
 },
 {
    'name': 'Bittime',
    'legal_name': 'PT Utama Aset Digital Indonesia',
    'sector': 'web3/crypto (crypto exchange — OJK PAKD licence KEP-11/D.07/2025)',
    'url': 'https://www.bittime.com',
    'in_dki': True,
    'hq_address': ('Gedung AIA Central, Jl. Jend. Sudirman Kav. 48A, Karet Semanggi, Setiabudi, '
                   'Jakarta Selatan 12930'),
    'kecamatan': 'Setiabudi',
    'kota': 'Jakarta Selatan',
    'lat': -6.2180922, 'lon': 106.8170896,
    'geocode_kind': 'building',
    'geocode_src': 'photon:AIA Central, Jl. Jend. Sudirman Kav. 48A',
    'funding_total_usd_m': None,
    'funding_note': (
        'No announced round on record. thecompanycheck carries "US$2M Series A, May 2024" — a '
        'single-tracker figure with no announcement behind it, not counted (the Stockbit '
        'rule).'),
    'valuation_usd_m': None,
    'employees_est': 79,
    'employees_asof': TODAY,
    'employees_kind': 'linkedin',
    'employees_src': 'https://www.linkedin.com/company/bittimexchange',
    'employees_note': (
        'Live LinkedIn count 79 ("View all 79 employees", read 2026-08-30) against a stale '
        'self-declared band of 11-50 — the count wins (Prosa.ai rule). Exa’s vendor record '
        'reads 56 (+29% YoY).'),
    'investors': [],
    'sources': [
        'https://www.bittime.com/blog/ceo-bittime-ryan-lymn-buka-akses-rwa-dengan-one-stop-platform',
        'https://wartaekonomi.co.id/read575217/bittime-resmi-kantongi-izin-pakd-siap-luncurkan-strategi-pertumbuhan-baru-lewat-bittime-vip-program',
        'https://money.kompas.com/read/2026/07/14/141145226/bittime-luncurkan-perdagangan-futures-kripto-jadi-yang-pertama-berizin-penuh',
        'https://www.antaranews.com/berita/4074471/bittime-resmi-peroleh-izin-staking-aset-kripto-dari-bappebti',
        'https://wartaekonomi.co.id/read539574/fokus-kembangkan-industri-berjangka-dan-kripto-indonesia-bittime-buka-kantor-baru',
        'https://careercenter.uph.edu/member/employer/view/3039/pt-utama-aset-digital-indonesia',
        'https://www.linkedin.com/company/bittimexchange',
        'https://www.bittime.com/en',
    ],
    'confidence': 0.8,
    'verify_note': (
        'Founded 2021; Bappebti-registered candidate trader since Apr 2022 (UPH employer '
        'profile quoting the company), crypto-staking licence Apr 2024 (ANTARA), and the full '
        'OJK digital-asset trader licence KEP-11/D.07/2025 on 22 May 2025 (own blog; '
        'wartaekonomi). Per Kompas (14 Jul 2026) the first fully OJK-licensed platform to '
        'launch regulated crypto futures. CEO Ryan Lymn. Moved into AIA Central in Jul 2024 '
        '(wartaekonomi, own opening); the UPH employer page still carries the older Mampang '
        'Prapatan Raya 75 address — both recorded, newer headlined.'),
    'operating_evidence': (
        'Jul 2026: OJK-regulated crypto futures live (Kompas). Jun 2026: tokenised US stocks '
        'on the platform (own site). 500K+ Play Store downloads.'),
    'id': 'bittime',
    'site_status': 'ok',
    'liveness_checked': TODAY,
 },
 {
    'name': 'Upbit Indonesia',
    'legal_name': 'PT Upbit Exchange Indonesia',
    'sector': 'web3/crypto (Dunamu/Upbit-owned crypto exchange — OJK PAKD KEP-6/D.07/2025)',
    'url': 'https://id.upbit.com',
    'in_dki': True,
    'hq_address': ('Treasury Tower Lantai 21, District 8 SCBD Lot 28, Jl. Jend. Sudirman '
                   'Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190'),
    'kecamatan': 'Kebayoran Baru',
    'kota': 'Jakarta Selatan',
    'lat': TREASURY['lat'], 'lon': TREASURY['lon'],
    'geocode_kind': 'building',
    'geocode_src': 'same building as the superbank row (Treasury Tower)',
    'funding_total_usd_m': None,
    'funding_note': (
        'A subsidiary of Dunamu Inc. (South Korea), operator of Upbit — no Indonesian round '
        'exists, and group capital is never an Indonesian total (global-parent rule).'),
    'valuation_usd_m': None,
    'valuation_note': 'Value sits inside Dunamu; no Indonesian carve-out is published.',
    'employees_est': 23,
    'employees_asof': TODAY,
    'employees_src': 'https://www.linkedin.com/company/pt-upbit-exchange-indonesia',
    'employees_note': (
        'Exa’s LinkedIn-derived workforce record reads 23 (+31.8% YoY) and the page’s '
        'self-declared band (11-50) corroborates; the page hides its people count from '
        'logged-out reads, so no live count was possible on 2026-08-30.'),
    'investors': ['Dunamu Inc. (parent)'],
    'sources': [
        'https://ojk.go.id/en/berita-dan-kegiatan/pengumuman/Pages/PT-Upbit-Exchange-Indonesia-Business-License.aspx',
        'https://www.antaranews.com/berita/4733261/upbit-indonesia-memperoleh-izin-usaha-dari-ojk',
        'https://investor.id/market/393126/upbit-indonesia-kantongi-izin-dari-ojk',
        'https://www.liputan6.com/crypto/read/5974306/ojk-beri-restu-upbit-indonesia-dagang-aset-kripto',
        'https://duniafintech.com/upbit-indonesia/',
        'https://www.wikibit.com/en/survey/6120213e1c.html',
        'https://www.linkedin.com/company/pt-upbit-exchange-indonesia',
        'https://id.upbit.com/home',
    ],
    'confidence': 0.8,
    'verify_note': (
        'Operating in Indonesia since 2019 (duniafintech profile of the Bappebti-registered '
        'candidate era); Treasury Tower Lt. 21 office confirmed by a Jan-2021 WikiBit site '
        'visit and the current EMIS registry record, and LinkedIn’s HQ (Senayan, Kebayoran '
        'Baru) agrees — the census’s Treasury Tower pin is reused. OJK granted the '
        'digital-financial-asset trader business licence KEP-6/D.07/2025 on 17 Mar 2025 — '
        'OJK’s own announcement — among the first under POJK 27/2024. Parent Dunamu operates '
        'Upbit, South Korea’s largest exchange; counted at the Indonesian entity only '
        '(global-parent rule).'),
    'operating_evidence': (
        'Aug 2026: id.upbit.com live with active listing and maintenance notices; OJK licence '
        'Mar 2025.'),
    'id': 'upbit-indonesia',
    'site_status': 'ok',
    'liveness_checked': TODAY,
 },
]

# Surgical field patches on rows another batch owns — never row-replacement.
PATCH = {
    'pintu': {
        'sector': ('web3/crypto (crypto exchange & wallet app — Indonesia’s first full '
                   'PFAK licence, 01/BAPPEBTI/PFAK/08/2024)'),
        '_sources_add': [KEMENDAG],
        '_verify_add': (' PFAK licence 01/BAPPEBTI/PFAK/08/2024 (1 Aug 2024) — Indonesia’s '
                        'first full crypto-trader licence, per Kemendag’s own release.'),
    },
    'pluang': {
        'sector': ('web3/crypto & multi-asset investing (PFAK-licensed crypto — '
                   '02/BAPPEBTI/PFAK/08/2024 — plus gold, US stocks, funds)'),
        '_sources_add': [KEMENDAG],
        '_verify_add': (' The census row’s legal entity PT Bumi Santosa Cemerlang is itself the '
                        'licensed crypto trader: PFAK 02/BAPPEBTI/PFAK/08/2024 (1 Aug 2024, '
                        'Kemendag release, alongside Pintu’s 01).'),
    },
    'nanovest': {
        'sector': 'web3/crypto & US-stocks investing app (PFAK-licensed crypto trader, 11/BAPPEBTI/PFAK/12/2024)',
        'hq_address': ('Mayapada Tower 1, Lantai 20, Suite 03A, Jl. Jend. Sudirman Kav. 28, Karet '
                       'Kuningan, Setiabudi, Jakarta Selatan 12920'),
        '_sources_add': [BAPPEBTI],
        '_verify_add': (' PT Tumbuh Bersama Nano holds full PFAK licence 11/BAPPEBTI/PFAK/12/2024 '
                        '(27 Dec 2024); the Mayapada Tower 1 building name comes from that filing '
                        '— same Sudirman Kav. 28 address the row already carried. Distinct '
                        'from NVX/PT Aset Kripto Internasional (an unrelated exchange, now BTSE '
                        'Indonesia).'),
    },
    'reku': {
        '_sources_add': [REKU_PR],
        '_verify_add': (' PFAK-licensed 28 Nov 2024, per Reku’s own release; CFX exchange '
                        'member SPAB-017/PFAK/CFX/08/2024.'),
    },
    'indodax': {
        '_sources_add': [BAPPEBTI],
        '_verify_add': ' Full PFAK licence 10/BAPPEBTI/PFAK/12/2024 (27 Dec 2024), per Bappebti’s register.',
    },
    'tokocrypto': {
        '_sources_add': [BAPPEBTI],
        '_verify_add': ' Full PFAK licence 03/BAPPEBTI/PFAK/09/2024 (5 Sep 2024), per Bappebti’s register.',
    },
}

CRYPTO_ANCHOR = 1075  # = the fintech anchor, deliberately (see docstring)

SCOPE = [
    {'name': 'Ajaib Kripto', 'owner': 'PT Kagum Teknologi Indonesia (Ajaib Group)',
     'why': ('PFAK-licensed in its own right (04/BAPPEBTI/PFAK/09/2024) but counted inside the '
             'census’s Ajaib row, which stays in Fintech: the group is a stock brokerage '
             'first, the arm’s headcount is not published separately, and splitting it '
             'would double-count the group. The Crypto sector lists companies whose primary '
             'business is crypto.')},
    {'name': 'NVX (BTSE Indonesia)', 'owner': 'PT Aset Kripto Internasional',
     'why': ('PFAK-licensed exchange (05/BAPPEBTI/PFAK/01/2025), relaunched Jul 2026 as BTSE '
             'Indonesia — a joint venture with BTSE Group. Fails the headcount test today '
             '(LinkedIn lists 1 person, nothing else published); queued, not rejected, if that '
             'changes. Unrelated to Nanovest despite the look-alike name.')},
    {'name': 'Luno Indonesia', 'owner': 'PT Luno Indonesia Ltd',
     'why': ('OJK granted its digital-asset trader licence KEP-17/D.07/2026 on 25 May 2026 '
             '(OJK’s own announcement) — yet Luno has announced service exits in regions it '
             'does not name, with accounts closing from 1 Sep 2026 (own help centre), '
             'Indonesian coverage treats local users as affected, and Indonesian bank-transfer '
             'deposits have been suspended since 24 Feb 2026 (GoPay only). Too unclear to '
             'count; QUEUED — re-check after 1 Sep 2026.')},
    {'name': 'Naga Exchange', 'owner': 'PT Cipta Koin Digital',
     'why': ('PFAK 03/BAPPEBTI/PFAK/01/2025 (APL Tower), but its LinkedIn lists 6 people — '
             'fails the sourceable-headcount/scale test today; queued. An unrelated Yogyakarta '
             'namesake page ("PT Cipta Koin Digital / koinku.id") exists — ignore it.')},
    {'name': 'Bitwewe', 'owner': 'PT Sentra Bitwewe Indonesia',
     'why': ('PFAK 06/BAPPEBTI/PFAK/10/2024 (Lippo Tower Holland Village), but no sourceable '
             'headcount — the LinkedIn page is too thin to read a people count from; '
             'queued.')},
]

EXPECT_CRYPTO = {'indodax', 'tokocrypto', 'reku', 'pintu', 'pluang', 'nanovest',
                 'idrx', 'bybit-indonesia', 'triv', 'mobee', 'bittime', 'upbit-indonesia'}


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    before = len(raw['companies'])
    shutil.copyfile(RAW, RAW + '.bak-crypto')

    by_id = {c.get('id'): c for c in raw['companies']}

    for row in ROWS:
        cur = by_id.get(row['id'])
        if cur is None:
            raw['companies'].append(json.loads(json.dumps(row)))
            by_id[row['id']] = raw['companies'][-1]
            print('added', row['id'])
        else:
            keep = {k: cur[k] for k in ('logo', 'logo_src', 'sprite') if k in cur}
            cur.clear()
            cur.update(json.loads(json.dumps(row)))
            for k, v in keep.items():
                cur.setdefault(k, v)
            print('updated', row['id'])

    for cid, patch in PATCH.items():
        c = by_id.get(cid)
        if c is None:
            print(f'  !! {cid} missing from census-raw — patch skipped (re-run after repair)')
            continue
        for k, v in patch.items():
            if k == '_sources_add':
                src = c.setdefault('sources', [])
                for u in v:
                    if u not in src:
                        src.append(u)
            elif k == '_verify_add':
                if v.strip() not in (c.get('verify_note') or ''):
                    c['verify_note'] = (c.get('verify_note') or '').rstrip() + v
            else:
                c[k] = v
        print(f'  patched {cid}')

    anchors = raw['method']['gva_per_worker_idr_m_by_sector']
    if anchors.get('crypto') != CRYPTO_ANCHOR:
        anchors['crypto'] = CRYPTO_ANCHOR
        print(f'  anchor: crypto = {CRYPTO_ANCHOR} (= fintech, by design)')

    sc = raw.setdefault('scope', {}).setdefault('outside', [])
    have = {e.get('name'): e for e in sc}
    for e in SCOPE:
        if e['name'] in have:
            have[e['name']].update(e)
        else:
            sc.append(dict(e))

    # sanity: the controlled head-phrase must select exactly the intended rows
    import re
    got = {c['id'] for c in raw['companies'] if re.match(r'^web3/crypto', str(c.get('sector', '')), re.I)}
    if got != EXPECT_CRYPTO:
        raise SystemExit(f'crypto bucket mismatch: +{got - EXPECT_CRYPTO} -{EXPECT_CRYPTO - got}')

    tmp = RAW + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(tmp, RAW)
    print(f'census-raw.json: {before} -> {len(raw["companies"])} companies '
          f'(backup: census-raw.json.bak-crypto); crypto bucket = {sorted(got)}')


if __name__ == '__main__':
    main()
