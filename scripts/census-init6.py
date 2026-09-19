#!/usr/bin/env python3
"""Init-6 portfolio: the census's per-VC investor lane (v2, Aug 30 2026).

Init-6 is the Jakarta fund founded in 2020 by Achmad Zaky and Nugroho
Herucahyono (Xinuc), both Bukalapak co-founders. Canonical investor spelling
in the census is "Init-6" — the fund's own site titles itself Init-6 at
init-6.fund (LinkedIn styles it lowercase "init 6"; press uses both). This
script NORMALIZES the historical variants (Init 6 / Init6 / init6) wherever
they appear in an investors array.

FULL ROSTER, from the fund's own record (portfolio page + its /news/1..29
archive + its LinkedIn), read Aug 30 2026 — 26 companies:

  On https://init-6.fund/portfolio (22): Gently, Monit, Skorlife, Qiscus,
  Codemi, Awanio (awan.io), Schoters, Flik (useflik.com), Ringkas, Dibimbing,
  Algobash, Sekolah.mu, DIN (din.global), Waste4Change, Runchise, LedgerOwl,
  IDCloudHost, Imajin, Setoko, Torch, UMA Women, One% Nutrition.

  In its news archive / LinkedIn but NOT on the portfolio page (4):
   · Showwcase (news/8, Jan 2022) — US developer-network startup. NOT in the
     census: not an Indonesian company (expansion plans notwithstanding).
   · Aigis (news/3, May 2022 — US$1M from Y Combinator + init6; YC W22,
     PT Maju Finansial Digital, founder Reinhart Hermanus). NOT in the census:
     defunct/pivoted — aigis.id answers HTTP 525 (origin down), the
     "Aigis (YC W22)" LinkedIn company page now 404s (Exa livecrawl,
     30 Aug 2026), and trade press reported a pivot to "project management,
     finance solutions" (incubees.com). Same W22 orbit as Finnix, which the
     census already dropped as dormant.
   · Bioma (news/21, Oct 2022 — pre-seed co-led East Ventures + Init-6;
     PT Bioma Bersama Indonesia, ex-Listee team, product-as-a-service
     rentals). NOT added yet: operating status unclear — withbioma.com 404s,
     company.bioma.id does not resolve from this VM, LinkedIn shows 7 people
     (live read 30 Aug 2026) and no post-2022 press was found. Needs one
     verified operating signal before a row; sits in the standing queue.
   · Simplifa.ai (fund's LinkedIn, Mar 2026, named alongside Awanio and
     Qiscus as portfolio) — ADDED below; operating, Jakarta, 36 staff.

  Census rows tagged Init-6 after this pass (20) — 10 pre-existing (awanio,
  dibimbing-id, gently, idcloudhost, imajin, qiscus, ringkas, runchise,
  sekolah-mu, waste4change) + 10 added by this script (simplifa-ai, monit,
  skorlife, flik, ledgerowl, torch, setoko, uma-women, codemi, algobash).
  Waste4Change's tag rests on the fund's own portfolio listing — no funding
  release names Init-6's round, and the row says so rather than inventing one.

  Portfolio names NOT in the census, all verified 30 Aug 2026 (6):
   · Showwcase — US company (above).
   · DIN (din.global) — Din Global Pte Ltd, a SINGAPORE holdco operating in
     PAKISTAN (Dbank digital-bank bid → DCore → Waseela; Tania Aidrus).
     US$17.6M seed co-led by Sequoia SEA + Kleiner Perkins; Init-6 appears
     only via its own portfolio tile. din.global is dead (www CNAME points at
     'cloudfront.nett', a typo TLD). Categorically out of region.
   · Aigis — defunct/pivoted (above).
   · Schoters — Init-6's EXIT: acquired by Ruangguru 5 Jul 2022 (Crunchbase,
     DSA; its own blog says so; Init-6's portfolio marks it 'Exited'; brand
     is now 'Schoters by Ruangguru'). Still runs its own PT Partner Impian
     Milenial, but a census row would double-count Ruangguru's workforce —
     same rule that keeps TikTok Shop Indonesia out (PT Tokopedia row).
   · One% Nutrition — operating (Jul-2026 product launch), 9 staff (LinkedIn
     + PitchBook agree), Jakarta+Bali ops, but NO verifiable legal entity:
     LinkedIn self-declares HQ Singapore, no SG/ID registration traceable
     (the 2015 'ONE PERCENT PTE. LTD.' is a namesake), site footer names no
     entity. Fails the dedicated-company test until an entity surfaces. Both
     rounds (pre-seed May 2025 Init-6 + First Move; second pre-seed early
     2026 led by Ondine Capital, 'six-digit USD') are undisclosed anyway.
   · Bioma — operating unclear (above; standing queue).

  Round detail recovered from the fund's news archive and carried onto rows:
  Ringkas pre-seed US$2.3M (31 May 2022 — 500 Global, Iterative Capital,
  Creative Gorilla Capital, Teja Ventures, init6) which the earlier funding
  pass had missed → disclosed total 8.6 → 10.9; Runchise seed participants
  Arise + Init-6 (East Ventures lead, amount undisclosed); Qiscus US$2M from
  Init-6 (Nov 2023); IDCloudHost US$5M (Mar 2021); Awanio Apr 2022.

Idempotent. Run: python3 scripts/census-init6.py && node scripts/build-census.js
"""
import json
import os

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'census-raw.json')

CANON = 'Init-6'
VARIANTS = {'init 6', 'init6', 'init-6'}  # lowercase-compared; canonical wins

NEW = [
 {
  "name": "Gently", "id": "gently",
  "legal_name": "PT Inovasi Teknologi Untung Berkah",
  # 'd2c' + 'consumer brand' both land this in the fnb / 'F&B & D2C' bucket;
  # avoid the words 'retail' and 'health' here or the commerce and health
  # regexes (which run earlier) take it instead.
  "sector": "consumer brand — D2C baby and kids personal care",
  "in_dki": False,
  "hq_address": "Foresta Business Loft 6 No. 6, BSD City, Pagedangan, Kabupaten Tangerang, Banten 15339",
  "kota": "Kabupaten Tangerang",
  "url": "https://gently.co.id",
  "funding_total_usd_m": 2.5,
  "last_round": "Seed, Feb 2024 — US$2.5M led by Northstar Group with Accel",
  "last_round_year": 2024,
  "employees_est": 78,
  "employees_note": "LinkedIn/Revelio 78 (-6.5% YoY). Sources disagree: Tracxn reads 112 as of 31 May 2026 and the company's own Pintarnya employer profile says 1-49. Privately held with no filings, so none of the three can be checked against a return.",
  "investors": ["Northstar Group", "Accel", "Init-6"],
  "verify_note": "PT Inovasi Teknologi Untung Berkah — the legal name is confirmed by Gently's own consumer-complaint page (gently.co.id/pages/layanan-pengaduan) and carried as a LinkedIn alias; address from its Pintarnya employer profile. Founded 2021, annual revenue ~US$2.3M per LinkedIn. Funding is the US$2.5M Northstar/Accel seed; Init 6 came in earlier at pre-seed for an undisclosed amount, which is the fund's house style — LinkedIn counts 1 round and Tracxn 2, and the disclosed total is the same either way. Entered the census from the Init 6 portfolio sweep.",
  "confidence": 0.82,
  "sources": [
   "https://www.gently.co.id/pages/layanan-pengaduan",
   "https://linkedin.com/company/gentlyindonesia",
   "https://pintarnya.com/company/gently-indonesia-26236",
   "https://init-6.fund/portfolio",
   "https://tracxn.com/d/companies/gently/__0Glr3njGUQU9Owri3aPfzOPxYZ5eIJiN9HZeObafcb4/funding-and-investors",
  ],
 },
 {
  "name": "Simplifa.ai", "id": "simplifa-ai",
  "legal_name": "PT Simplifa Cerdas Menyala",
  # 'bank-statement' trips the fintech regex — intended bucket. Do not add the
  # word 'licensed bank' (bank rule) or 'health'/'retail' (earlier regexes).
  "sector": "fintech AI — bank-statement and financial-report analysis for credit risk, fraud detection and NPL work",
  "in_dki": True,
  "hq_address": "Beltway Office Park, Tower A Lantai 3, Jl. Ampera Raya No. 9-10, Ragunan, Pasar Minggu, Jakarta Selatan, DKI Jakarta 12550",
  "kota": "Jakarta Selatan",
  "url": "https://simplifa.ai",
  "funding_total_usd_m": None,
  "last_round": "Backed by Init-6 — round and amount never announced",
  "employees_est": 36,
  "employees_asof": "2026-08-30",
  "employees_src": "https://www.linkedin.com/company/simplifa-ai",
  "employees_li_band": "11-50",
  "employees_note": "Live LinkedIn read 30 Aug 2026: 36 people, self-declared band 11-50 (corroborates). No filings; privately held.",
  "investors": ["Init-6"],
  "funding_note": "Init-6 names Simplifa.ai a portfolio company (its LinkedIn, Mar 2026, alongside Awanio and Qiscus); no round, amount or date has been announced anywhere we can find, so the funding figure stays a dash.",
  "verify_note": "PT Simplifa Cerdas Menyala — legal name and the Beltway Office Park (Ragunan, Jakarta Selatan) address are from the company's own privacy policy and site footer. Operating: LinkedIn company page posting as of late Aug 2026, an active job listing on Dealls (Mar 2026), and a published strategic collaboration with Mitsui Leasing on its own blog. Founders per Dealls company profile: Gema Buana (co-founder & CEO), Dian Syahfitra (co-founder & CTO). Entered the census from the Init-6 portfolio sweep — the fund's portfolio page does not list it; its LinkedIn does.",
  "confidence": 0.75,
  "sources": [
   "https://simplifa.ai/en/privacy-policy",
   "https://www.linkedin.com/company/simplifa-ai",
   "https://www.linkedin.com/posts/init-6_init6-venturecapital-founderstory-activity-7437341906063429632-L2HE",
   "https://simplifa.ai/en/blog/strategic-collaboration-mitsui-leasing-x-simplifa",
   "https://dealls.com/en/karir/simplifa-ai",
  ],
 },
]

NEW += [
 {
  "name": "Monit", "id": "monit",
  "legal_name": "PT Monit Teknologi Indonesia",
  "sector": "fintech — corporate spend management: corporate cards, expense, reimbursement and bill pay",
  "in_dki": True,
  "hq_address": "Pakuwon Tower Lvl. 5, Kota Kasablanka, Jl. Casablanca No. 88, Jakarta Selatan 12870",
  "kota": "Jakarta Selatan",
  "url": "https://monitpay.com",
  "funding_total_usd_m": 2.5,
  "last_round": "US$2.5M, Jul 2025 — led by Cento Ventures with Sansan (strategic), 1982 Ventures and Init-6 re-joining",
  "last_round_year": 2025,
  "funding_src": "https://www.1982.vc/post/monit-closes-us-2-5m-round-led-by-cento-and-strategic-japanese-investor",
  "funding_note": "US$2.5M is the only disclosed amount: the Feb-2022 first round (1982 Ventures lead, Init-6, an unnamed VC) was announced only as 'a seven-figure sum'.",
  "employees_est": 56,
  "employees_asof": "2026-08-30",
  "employees_src": "https://linkedin.com/company/monitpay",
  "employees_li_band": "11-50",
  "employees_note": "Live LinkedIn read 30 Aug 2026: 56 people (self-declared band 11-50 lags; a cached Jun-2026 crawl read 31, +27.9% YoY — the team roughly doubled into mid-2026).",
  "investors": ["Cento Ventures", "Sansan", "1982 Ventures", "Init-6"],
  "verify_note": "PT Monit Teknologi Indonesia per its own privacy page (an affiliated PT Monit Finansial Indonesia, reg. 1272933, also exists in the Ministry registry). Operating: customer-story LinkedIn post a week old, live Android app (id.monit.monit_mobile), and lead investor Cento lists it Active. Init-6 backed the first round (its own announcement, Feb 2022 — 'We backed Monit from the very beginning', Zaky) and re-joined in 2025. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.9,
  "sources": [
   "https://monitpay.com/privacy",
   "https://linkedin.com/company/monitpay",
   "https://www.1982.vc/post/monit-closes-us-2-5m-round-led-by-cento-and-strategic-japanese-investor",
   "https://init-6.fund/news/10",
   "https://e27.co/monit-the-brex-of-indonesia-attracts-funding-led-by-1982-ventures-20220218/",
   "https://news.dailysocial.id/post/monit-raih-pendanaan-lanjutan-us25-juta-dipimpin-cento-ventures/",
   "https://companieshouse.id/monit-finansial-indonesia",
  ],
 },
 {
  "name": "Skorlife (Skor Technologies)", "id": "skorlife",
  "legal_name": "PT Skortech Karya Indonesia",
  "sector": "fintech — consumer credit score, credit builder and the Skorcard credit card",
  "in_dki": True,
  "hq_address": "Gedung 18 Office Park, Lt. 25 Suite A2, Jl. TB Simatupang No. 18, Jakarta Selatan 12520",
  "kota": "Jakarta Selatan",
  "url": "https://skorlife.com",
  "funding_total_usd_m": 12.4,
  "last_round": "Pre-Series A, Jan 2025 — US$6.2M at parent Skor Technologies, led by Argor Capital with QED Investors, Saison Capital and Digital Currency Group",
  "last_round_year": 2025,
  "funding_src": "https://pulse2.com/skor-technologies-indonesia-based-personal-finance-company-raises-6-2-million-pre-series-a/",
  "funding_note": "US$12.4M disclosed across the group = 2.2 pre-seed (Sep 2022) + 4.0 seed (May 2023, Hummingbird lead) + 6.2 pre-Series A (Jan 2025, parent Skor Technologies covering Skorlife + Skorcard).",
  "employees_est": 51,
  "employees_asof": "2026-08-30",
  "employees_src": "https://www.linkedin.com/company/skor-co/",
  "employees_li_band": "11-50",
  "employees_note": "51 = live LinkedIn read of the Skor Technologies group page (Skorlife + Skorcard, both Jakarta). The Skorlife-named page is semi-dormant (band 2-10, no count exposed) — group activity moved to the parent page after the Mar-2024 restructure; counted at group level the way the group announces its own funding.",
  "investors": ["AC Ventures", "Saison Capital", "Hummingbird Ventures", "QED Investors", "Argor Capital", "Digital Currency Group", "Init-6"],
  "verify_note": "PT Skortech Karya Indonesia per its own who-we-are page and the Ministry registry (reg. 1239318); OJK regulatory-sandbox graduate per its site. Operating: Android app updated 26 Aug 2026 (1M+ installs), iOS #95 in Finance (ID). Init-6's tie: Achmad Zaky is a named pre-seed angel (TechNode, Sep 2022) and the fund lists Skorlife on init-6.fund/portfolio; no source puts Init-6 in the 2023/2025 rounds. Row covers the Skor Technologies group (Skorlife app + PT Skorcard) — the restructure is why name, headcount and funding are group-level. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.85,
  "sources": [
   "https://skorlife.com/en/who-we-are/",
   "https://companieshouse.id/skortech-karya-indonesia",
   "https://www.linkedin.com/company/skor-co/",
   "https://linkedin.com/company/skorlife",
   "https://technode.global/2022/09/05/indonesian-credit-tech-startup-skorlife-scores-2-2m-pre-seed-funding/",
   "https://technode.global/2023/05/25/indonesias-skorlife-grabs-us4m-seed-funding-led-by-hummingbird-ventures/",
   "https://techcrunch.com/2023/05/23/skorlife-seed/",
   "https://pulse2.com/skor-technologies-indonesia-based-personal-finance-company-raises-6-2-million-pre-series-a/",
   "https://acv.vc/insights/acv-portfolio-news/skorlife-pre-seed-funding/",
   "https://init-6.fund/portfolio",
  ],
 },
 {
  "name": "Flik", "id": "flik",
  "legal_name": "PT Flik Teknologi Indonesia",
  "sector": "fintech — one-click unified checkout and payments for brands",
  "in_dki": True,
  "hq_address": "Cibis Tower 9, Lantai 15, Jl. Cilandak KKO No. 2, Jakarta Selatan",
  "kota": "Jakarta Selatan",
  "url": "https://useflik.com",
  "funding_total_usd_m": 1.1,
  "last_round": "Pre-seed, Jan 2023 — US$1.1M led by East Ventures with Init-6, GMO VenturePartners and Saison Capital",
  "last_round_year": 2023,
  "funding_src": "https://east.vc/news/press-release/flik-secured-us-1-1-million-pre-seed-funding-led-by-east-ventures",
  "employees_est": 25,
  "employees_asof": "2026-08-30",
  "employees_src": "https://linkedin.com/company/flik-id",
  "employees_li_band": "11-50",
  "employees_note": "Live LinkedIn read 30 Aug 2026: 25 people, band 11-50 corroborates.",
  "investors": ["East Ventures", "Init-6", "GMO VenturePartners", "Saison Capital"],
  "verify_note": "PT Flik Teknologi Indonesia — Ministry registry reg. 1228400 and the LinkedIn page header agree; registered at Cibis Tower 9, Cilandak. Operating: useflik.com and flik.co.id both live ('10M+ customers across hundreds of brands'), blog through Jun 2025, LinkedIn About freshly rewritten, founder Ahmad Gadi active. NOT Flip.id — different company. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.85,
  "sources": [
   "https://useflik.com",
   "https://companieshouse.id/flik-teknologi-indonesia",
   "https://linkedin.com/company/flik-id",
   "https://east.vc/news/press-release/flik-secured-us-1-1-million-pre-seed-funding-led-by-east-ventures",
   "https://technode.global/2023/01/09/indonesias-flik-secures-1-1m-pre-seed-funding-led-by-east-ventures/",
   "https://techcrunch.com/2023/01/09/flik/",
   "https://init-6.fund/news/15",
   "https://init-6.fund/portfolio",
  ],
 },
 {
  "name": "LedgerOwl", "id": "ledgerowl",
  "legal_name": "PT Aryaseva Axlmos Kaya",
  "sector": "fintech SaaS — AI bookkeeping-to-tax platform with managed accountants for SMEs",
  "in_dki": True,
  "hq_address": "Gedung Cibis Nine Lt. 15 Unit C, Jl. TB Simatupang No. 2, Cilandak Timur, Pasar Minggu, Jakarta Selatan",
  "kota": "Jakarta Selatan",
  "url": "https://ledgerowl.com",
  "funding_total_usd_m": None,
  "last_round": "Strategic round, Feb 2026 — led by Skystar Capital with Incubate Fund Asia, amount undisclosed (for Australian expansion)",
  "last_round_year": 2026,
  "funding_note": "No round has a disclosed amount: the Feb-2023 pre-seed (co-led Init-6 + Investible) and the Feb-2026 strategic round (Skystar + Incubate Fund Asia) were both announced without figures — the dash is by rule, not missing research.",
  "employees_est": 51,
  "employees_asof": "2026-08-30",
  "employees_src": "https://linkedin.com/company/ledgerowl",
  "employees_li_band": "11-50",
  "employees_note": "Live LinkedIn read 30 Aug 2026: 51 people (band 11-50 is the usual stale self-declaration; a cached Jun-2026 crawl read 37, +8.5% YoY; PitchBook 50). A separate Ledgerowl Australia page exists and is not counted.",
  "investors": ["Init-6", "Investible", "Skystar Capital", "Incubate Fund Asia"],
  "verify_note": "PT Aryaseva Axlmos Kaya per the company's own site footer and its LinkedIn header. Founded 2019 by Rey Kamal (ex-payment-gateway CFO) and Adrian Yasin, bootstrapped until the 2023 pre-seed. Operating: LinkedIn post 2 days before the 30 Aug 2026 read, Skystar's own Feb-2026 funding release. NOT Ledger, the crypto-wallet company. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.9,
  "sources": [
   "https://ledgerowl.com",
   "https://linkedin.com/company/ledgerowl",
   "https://teknologi.bisnis.com/read/20230228/266/1632387/startup-fintech-ledgerowl-raih-pendanaan-dari-init6-dan-investible",
   "https://skystar.vc/ledgerowl-strategic-funding/",
   "https://init-6.fund/news/20",
   "https://init-6.fund/portfolio",
  ],
 },
]

NEW += [
 {
  "name": "Torch", "id": "torch",
  "legal_name": "PT Maha Nagari Nusantara",
  # 'd2c' + 'consumer brand' land this in fnb / 'F&B & D2C' with Gently and the
  # coffee cohort; 'retail' would send it to Commerce and — the trap that DID
  # fire once — 'travel' sends it to Travel & Mobility (rule order). Neither
  # word may appear here.
  "sector": "consumer brand — D2C outdoor and journey gear: backpacks, bags, apparel, own stores + online",
  "in_dki": False,
  "hq_address": "Jl. Laswi No. 1M, Bandung, Jawa Barat 40613",
  "kota": "Bandung",
  "url": "https://torch.id",
  "funding_total_usd_m": None,
  "last_round": "Strategic — Init-6, Aug 2024, amount undisclosed",
  "last_round_year": 2024,
  "funding_note": "Init-6's investment (announced 20 Aug 2024, its second consumer deal after Gently) is the only outside round on record and its amount was never disclosed — founded 2015 and otherwise self-funded; Bisnis reported IPO ambitions in Sep 2025.",
  "employees_est": 123,
  "employees_asof": "2026-08-30",
  "employees_src": "https://www.linkedin.com/company/torch-indonesia",
  "employees_li_band": "51-200",
  "employees_note": "Live LinkedIn read 30 Aug 2026: 123 (band 51-200 corroborates). A FLOOR: 11 offline stores across ~10 cities as of Apr 2025 — shopkeepers and warehouse staff rarely hold profiles, and most of the workforce is store ops.",
  "investors": ["Init-6"],
  "verify_note": "PT Maha Nagari Nusantara — Indonesian Wikipedia and the company's own job postings agree on the entity; founded 2015 in Bandung by Ben Wirawan and Hanafi Salman, first store on Jl. Laswi. Operating: 2026 collections live (Gundam and Pocari collaborations), Kompas Bandung feature Feb 2026, Amazon US sales. Venture test passes on the Init-6 round itself. Workforce is predominantly retail ops — row carries an output caveat. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.85,
  "sources": [
   "https://torch.id/",
   "https://id.wikipedia.org/wiki/Torch_(perusahaan)",
   "https://www.linkedin.com/company/torch-indonesia",
   "https://www.liputan6.com/tekno/read/5677729/init-6-suntik-dana-ke-torch-siap-ekspansi-pasar-indonesia",
   "https://www.radarbandung.id/2025/04/26/pasang-target-tinggi-torch-ingin-wujudkan-100-store-dan-tembus-pasar-amerika-serikat/",
   "https://bandung.kompas.com/read/2026/02/18/223843278/dari-ruko-kecil-ke-forbes-asia-kisah-ben-wirawan-bangun-brand-lokal-go",
   "https://init-6.fund/news/24",
   "https://init-6.fund/portfolio",
  ],
 },
 {
  "name": "Setoko", "id": "setoko",
  "legal_name": "PT Sekitar Teknologi Nusantara",
  # 'SaaS' → saas bucket; the words 'e-commerce'/'retail' would divert it to
  # Commerce, so they stay out of the sector string.
  "sector": "SaaS enabler for MSMEs — online-store builder pivoted to order management: web store, online POS, WhatsApp and social orders",
  "in_dki": True,
  "hq_address": "QP Office, Perkantoran Tanjung Mas Raya Blok B1 No. 44, Jl. Tanjung Barat Raya, Jakarta Selatan 12530",
  "kota": "Jakarta Selatan",
  "url": "https://setoko.id",
  "funding_total_usd_m": None,
  "last_round": "Accelerator — Iterative, Summer 2023 batch (amount undisclosed)",
  "last_round_year": 2023,
  "funding_note": "No disclosed amounts: Init-6 lists Setoko in its portfolio (round unannounced) and Setoko joined Iterative's S23 accelerator batch — neither published a figure.",
  "employees_est": 2,
  "employees_asof": "2026-08-30",
  "employees_src": "https://www.linkedin.com/company/setoko",
  "employees_li_band": "11-50",
  "employees_note": "Live LinkedIn read 30 Aug 2026: 2 profiles (the self-declared 11-50 band is stale). A tech company, so the floor effect is small — the count is probably close to real. The Android app (id.setoko, 100K+ installs) was still updated on 6 Aug 2026.",
  "investors": ["Init-6", "Iterative"],
  "verify_note": "PT Sekitar Teknologi Nusantara — Google Play developer info (with the Tanjung Mas Raya address), the setoko.id footer and the LinkedIn page header ('Setoko (Iterative S23)') all agree. Founder Nasrul Fatah, ex-Bukalapak. Alive but very lean: setoko.co 301s to setoko.id, which serves the pivoted order-management product with leftover WordPress theme-demo links — hygiene debris, not a shutdown; the Aug-2026 app update is the operating signal that outweighs a tracker's 'last activity Oct 2023'. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.7,
  "sources": [
   "https://setoko.id/",
   "https://play.google.com/store/apps/details?id=id.setoko",
   "https://www.linkedin.com/company/setoko",
   "https://init-6.fund/portfolio",
   "https://iterative.vc/post/meet-the-summer-2023-batch",
  ],
 },
 {
  "name": "UMA Women", "id": "uma-women",
  "legal_name": "UMA Women Pte. Ltd. (Singapore holdco)",
  # 'consumer brand' → fnb bucket. The word 'health' would send this product
  # brand to Healthtech — it is feminine-care CPG, not healthcare services.
  "sector": "consumer brand — organic feminine care (pads, liners, period pants), D2C + drugstore chains",
  "in_dki": True,
  "kota": "Jakarta",
  "url": "https://id.umawomen.com",
  "funding_total_usd_m": None,
  "last_round": "Strategic — Init-6, Oct 2024, amount undisclosed",
  "last_round_year": 2024,
  "funding_note": "Init-6's strategic investment (its own announcement, 30 Oct 2024) is the only round on record; no amount was ever published.",
  "employees_est": None,
  "employees_li_band": "11-50",
  "employees_note": "Held — no clean figure exists: the live LinkedIn list (19, read 30 Aug 2026) is visibly polluted by Universitas Medan Area ('UMA') namesake profiles, a cached vendor snapshot read 4, and the self-declared 11-50 band is unverified. Dash until a clean read exists; the row contributes no jobs.",
  "investors": ["Init-6"],
  "verify_note": "UMA Women Pte. Ltd. — Singapore holdco (UEN 202434397W, incorporated 21 Aug 2024) per the ACRA mirror and the brand's own terms-of-service page; the operation is Jakarta (LinkedIn HQ), so it is counted like Qiscus and Bahasa.ai under the holdco rule. No Indonesian PT surfaced — the registry's PT Uma Oma Indonesia is a food-retail namesake and was rejected. Operating: live Shopify storefront with current promos, stocked at Watsons, Guardian, Food Hall, Astro and a Tokopedia official store. No street address is published anywhere — the row stays unlocated until one surfaces. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.6,
  "sources": [
   "https://id.umawomen.com/",
   "https://id.umawomen.com/pages/terms-of-service",
   "https://sgbizdb.com/company/uma-women-pte-ltd-202434397w",
   "https://www.linkedin.com/company/umawomen",
   "https://init-6.fund/news/25",
   "https://katadata.co.id/digital/startup/6721d5a43ca13/eks-bos-bukalapak-suntik-startup-kesehatan-wanita-uma-women",
   "https://init-6.fund/portfolio",
  ],
 },
]

NEW += [
 {
  "name": "Codemi", "id": "codemi",
  "legal_name": "PT Codemi Global",
  # 'learning' → the edtech bucket, deliberately: corporate L&D is where
  # Init-6 itself files Codemi, next to Dibimbing and Sekolah.mu.
  "sector": "edtech SaaS — corporate learning management (cloud LMS) and field-team capability tools for enterprises",
  "in_dki": True,
  "hq_address": "Alamanda Tower Lt. 25 Suite M26, Jl. T.B. Simatupang Kav. 23-24, Cilandak Barat, Cilandak, Jakarta Selatan 12430",
  "kota": "Jakarta Selatan",
  "url": "https://codemi.co.id",
  "funding_total_usd_m": None,
  "last_round": "Seed, Oct 2020 — Init-6, amount undisclosed",
  "last_round_year": 2020,
  "funding_note": "The Init-6 seed (announced 9 Oct 2020; Achmad Zaky joined the board as komisaris) is the only round on record and its amount was never disclosed.",
  "employees_est": 37,
  "employees_asof": "2026-08-30",
  "employees_src": "https://www.linkedin.com/company/codemi-indonesia",
  "employees_li_band": "11-50",
  "employees_note": "Live LinkedIn read 30 Aug 2026: 37 people, band 11-50 corroborates.",
  "investors": ["Init-6"],
  "verify_note": "PT Codemi Global — the company's own contact and privacy pages name the entity; registry mirror carries reg. 78/122064 (issued 2013, Jakarta Selatan). Founded 2013. Operating: live product site (LMS plus the newer Capable/Tandem field-capability tools), LinkedIn current, and Init-6's careers page lists it as actively hiring. The contact page's Alamanda Tower address is used over the stale Menara Mandiri 2 address still on LinkedIn. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.85,
  "sources": [
   "https://codemi.co.id/contact",
   "https://codemi.co.id/privacy",
   "https://www.linkedin.com/company/codemi-indonesia",
   "https://iditrix.com/codemi-global/724916/",
   "https://init-6.fund/news/17",
   "https://kr-asia.com/indonesian-edtech-codemi-raises-seed-funding-from-init-6",
   "https://init-6.fund/portfolio",
  ],
 },
 {
  "name": "Algobash", "id": "algobash",
  "legal_name": "PT Matagi Informasi Pertiwi",
  # 'SaaS' → saas bucket ('hiring'/'assessment' match nothing earlier).
  "sector": "SaaS — AI pre-employment assessment: coding tests, AI interviews and CV screening for tech hiring",
  "in_dki": False,
  "hq_address": "Jl. Cimandiri 1 Blok FF2 No. 16, Kota Tangerang Selatan, Banten",
  "kota": "Kota Tangerang Selatan",
  "url": "https://www.algobash.com",
  "funding_total_usd_m": None,
  "last_round": "Pre-seed, Aug 2022 — Init-6, amount undisclosed",
  "last_round_year": 2022,
  "funding_note": "The Init-6 pre-seed (announced 18 Aug 2022) was undisclosed. CB Insights counts 3 investors but names none publicly — uncorroborated, so only Init-6 is listed.",
  "employees_est": 11,
  "employees_asof": "2026-08-30",
  "employees_src": "https://www.linkedin.com/company/algobash",
  "employees_li_band": "11-50",
  "employees_note": "Live LinkedIn read 30 Aug 2026: 11 people (band 11-50; an undated enrichment cache read 7, +100% YoY).",
  "investors": ["Init-6"],
  "verify_note": "PT Matagi Informasi Pertiwi — named in the site footer of every Algobash page and in the registry mirror (BN 55/TBN 32718, issued 2017, Kota Tangerang Selatan). The PT predates the product: it was founders Elfino Sitompul and Melinda Wardiman's 2017 software agency (matagi.id), and Algobash (built late 2020) is its operating brand. Filed registry address (Tangsel) is used for the pin; LinkedIn self-declares HQ 'Jakarta Selatan' with no street — the spread is recorded here. Operating: company blog post 8 Jun 2026 (Echelon Singapore), LinkedIn current with agentic-AI positioning. Entered the census from the Init-6 portfolio sweep.",
  "confidence": 0.8,
  "sources": [
   "https://www.algobash.com",
   "https://www.algobash.com/privacy-policy/",
   "https://www.linkedin.com/company/algobash",
   "https://iditrix.com/matagi-informasi-pertiwi/507795/",
   "https://init-6.fund/news/18",
   "https://news.dailysocial.id/post/dapat-dukungan-init-6-algobash-suguhkan-platform-perekrutan-programmer-terkurasi/",
   "https://www.compasslist.com/insights/algobash-saas-for-more-effective-it-hiring-in-indonesia",
   "https://init-6.fund/portfolio",
  ],
 },
]

# Per-row investor tags + provenance. investors_add appends missing names,
# sources_add appends missing URLs, verify_append appends once (marker = the
# first 40 chars), fields overwrites scalar fields (used only where this pass
# established a better-sourced figure).
TAGS = {
 'ringkas': {
  'investors_add': ['Init-6', '500 Global', 'Iterative Capital', 'Creative Gorilla Capital',
                    'Teja Ventures', 'East Ventures', 'Crestone Venture Capital'],
  'sources_add': [
   'https://init-6.fund/news/5',
   'https://www.techinasia.com/mortgage-startup-ringkas-bags-23m-preseed',
   'https://east.vc/news/press-release/ringkas-digital-mortgage-platform-raises-seed-round',
  ],
  'fields': {
   'funding_total_usd_m': 10.9,
   'funding_note': 'US$10.9M disclosed = US$2.3M pre-seed (May 2022 — 500 Global, Iterative Capital, Creative Gorilla Capital, Teja Ventures, Init-6) + US$3.5M seed (May 2023 — co-led East Ventures and Crestone, with 500 Global) + US$5.1M pre-Series A (May 2025 — Flourish Ventures, Kadan Capital).',
  },
  'verify_append': ' Init-6 pass (30 Aug 2026): the May-2022 US$2.3M pre-seed (announced by Ringkas; carried on the fund’s own news archive, init-6.fund/news/5, and Tech in Asia) was missing from the earlier total — disclosed funding is 2.3 + 3.5 + 5.1 = US$10.9M.',
 },
 'runchise': {
  'investors_add': ['Init-6', 'Arise'],
  'sources_add': [
   'https://init-6.fund/news/19',
   'https://east.vc/news/press-release/runchise-raised-seed-funding-led-by-east-ventures',
  ],
  'verify_append': ' Init-6 pass (30 Aug 2026): the Oct-2022 seed (amount undisclosed) was led by East Ventures with participation from Arise and Init-6 — the fund’s own announcement, init-6.fund/news/19; the US$1M May-2024 round was co-led by East Ventures and Genesia.',
 },
 'waste4change': {
  'investors_add': ['Init-6'],
  'sources_add': ['https://init-6.fund/portfolio'],
  'verify_append': ' Init-6 pass (30 Aug 2026): Init-6 lists Waste4Change in its published portfolio (init-6.fund/portfolio). No funding release names its round — the Series A participant lists (AC Ventures’ own release, TechCrunch) do not include it — so it is recorded as an investor with round undisclosed.',
 },
 'qiscus':       {'sources_add': ['https://init-6.fund/news/23']},
 'idcloudhost':  {'sources_add': ['https://init-6.fund/news/4']},
 'awanio':       {'sources_add': ['https://init-6.fund/news/12']},
 'dibimbing-id': {'sources_add': ['https://init-6.fund/news/13']},
 'imajin':       {'sources_add': ['https://init-6.fund/news/16']},
 'sekolah-mu':   {'sources_add': ['https://init-6.fund/portfolio']},
}


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by_id = {c.get('id'): c for c in raw['companies']}
    added, updated, tagged, normed = [], [], [], []

    for rec in NEW:
        if rec['id'] in by_id:
            by_id[rec['id']].update(rec); updated.append(rec['name'])
        else:
            raw['companies'].append(dict(rec)); by_id[rec['id']] = raw['companies'][-1]
            added.append(rec['name'])

    for cid, tag in TAGS.items():
        c = by_id.get(cid)
        if not c:
            print(f"!! TAGS row missing from census: {cid} — skipped"); continue
        touched = False
        inv = c.setdefault('investors', [])
        for name in tag.get('investors_add', []):
            if not any(name.lower() == str(x).lower() for x in inv):
                inv.append(name); touched = True
        src = c.setdefault('sources', [])
        for u in tag.get('sources_add', []):
            if u not in src:
                src.append(u); touched = True
        for k, v in tag.get('fields', {}).items():
            if c.get(k) != v:
                c[k] = v; touched = True
        va = tag.get('verify_append')
        if va and va[:40] not in (c.get('verify_note') or ''):
            c['verify_note'] = (c.get('verify_note') or '').rstrip() + va
            touched = True
        if touched:
            tagged.append(cid)

    # normalize every historical spelling of the fund's name, everywhere
    for c in raw['companies']:
        inv = c.get('investors')
        if not isinstance(inv, list):
            continue
        out, seen, changed = [], set(), False
        for x in inv:
            v = CANON if str(x).strip().lower() in VARIANTS else x
            if v != x: changed = True
            if str(v).lower() in seen: changed = True; continue
            seen.add(str(v).lower()); out.append(v)
        if changed:
            c['investors'] = out; normed.append(c['id'])

    json.dump(raw, open(RAW, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"added {len(added)}: {', '.join(added) or '-'}")
    print(f"updated {len(updated)}: {', '.join(updated) or '-'}")
    print(f"tagged {len(tagged)}: {', '.join(tagged) or '-'}")
    print(f"normalized spelling on {len(normed)}: {', '.join(normed) or '-'}")
    print(f"companies now {len(raw['companies'])}")


if __name__ == '__main__':
    main()
