#!/usr/bin/env python3
"""GDP Venture portfolio: the census's second per-VC investor pass (Aug 30 2026).

GDP Venture (PT Global Digital Prima) is the Djarum Group's digital venture
builder, founded 2010 by Martin Hartono (CEO; On Lee CTO, Danny Wirianto CBO,
Benny Sudrata CFO; founding partners Antonny Liem and Kusumo Martanto). HQ =
Wisma 77 Tower 2 Lt. 8, Jl. Letjen S. Parman Kav. 77, Slipi, Jakarta Barat —
per the fund's own contact page. Canonical investor spelling in the census is
"GDP Venture"; two rows carry entity round-notes ("(Global Digital
International)" on Kumparan, "(Djarum Group)" on Kaskus) which the investor
graph already groups under the same cleaned name.

ROSTER, from the fund's own record read 30 Aug 2026 — 48 tiles. Source: the
portfolio page https://gdpventure.com/portfolio (a Vue SPA; the tiles come
from its own CMS, https://cms.gdpventure.com/api/venture/company, which is a
plain GET and is what this pass actually parsed). Where each tile landed:

  IN THE CENSUS BEFORE THIS PASS, already tagged (4 tiles): Visinema,
  Kumparan, Narasi, Brodo. (Kaskus and Prosa.ai also carry GDP Venture but
  are NOT on the current page — legacy positions, tags rest on their own
  rows' evidence and are left untouched.)

  IN THE CENSUS, NEWLY TAGGED by this pass (7 tiles + 1 group side-effect):
   · Blibli, Tiket, Dekoruma, Halodoc, IDN MEDIA, Agate, NalaGenetics
   · the "Cermati" tile also tags the existing BNPL row indodana
     ("Indodana (Cermati Fintech Group)") through the group.

  ADDED to the census by this pass (8 tiles): Cermati, Garasi.id, Jumpstart,
  Sweet Escape, Balesin.id, Catapa, Kontrak Hukum, Ubiklan — each verified
  the census way (own PT + address + sourced headcount + announced-only
  funding + live site) before the row was written; details on the rows.

  NOT in the census (29 tiles), each with a published reason in the fund's
  investors.json outside[] register: 7 IDN units (Duniaku, ggwp, IDN
  Pictures, Popbela, Popmama, Yummy, ICE — one IDN row already counts them),
  3 group brands without their own PT (GLAIR = GDP Labs AI arm; MXA = Merah
  Cipta Media unit; Bolalob = ex-Kaskus brand folded into kumparan May
  2026), 3 queued (Springboard + 12WIRED = no traceable entity yet; ProPS =
  PT verified but props.id down from two networks today), 1 unclear
  (TuringSense, US + dormant-looking), and 15 foreign portfolio companies
  (Alto, Yumi, 88rising, EST Media, NEX, Now United, Stampede Ventures,
  Triller, Aptera, Motosurf, Vintage Electric, 6Estates, Gushcloud,
  Involve Asia, Datasaur.ai).

EVIDENCE NOTES (the load-bearing ones):
 · IDN: IDN's own Sep-2016 Series A announcement names GDP Venture directly
   (with North Base Media, East Ventures, MNM Creative) — the cleanest
   company-side naming in the pass.
 · Dekoruma: Series B (Oct 2018) led by Global Digital Niaga — Kontan calls
   GDN "lini bisnis GDP Ventures" — before Blibli took ownership in 2024.
 · Halodoc: press names the group's Blibli entity (AVCJ, Series A 2016,
   "controlled by ... Djarum Group") rather than the fund brand; the fund's
   page lists Halodoc. Tagged "(via Blibli)".
 · Agate + NalaGenetics: no round release names GDP Venture — recorded on
   the fund's own listing with the row saying so (the Waste4Change idiom).
 · JumpStart: every round undisclosed (Series A 2018 GDP Venture per
   heaptalk; Series B May 2023 + Series C 2026 Cool Japan Fund, CJF's own
   press PDFs) → funding stays a dash; 6,400+ machines as of Dec 2025.
 · Balesin: detikINET's 2016 "diperkirakan USD 2 juta" is an estimate, not
   an announcement → funding withheld to a dash with the story in the note.
   Tracxn marks BJtech "deadpooled" — stale: GDP Venture's own LinkedIn
   announced Balesin's POS Loyalty launch on 24 Jul 2026.

GOTCHAS hit during this pass: gdpventure.com is a JS SPA (curl the CMS API,
not the page); the fund page's own MXA link 404s; LinkedIn livecrawl often
serves cache — three adds carry cached/vendor headcounts with tiers and
dates instead of a fake live read; "Cermati" the marketplace entity (PT
Agregasi Cermat Indonesia, ex PT Dwi Cermat Indonesia) is NOT Indodana (PT
Artha Dana Teknologi) — two rows, jobs split by each page's own count, the
group's 1,001-5,000 band never published; Kontrak Hukum's LinkedIn count 77
exceeds its own 11-50 band (association pollution) → vendor count used;
'PT Tekno Legal Digital' is a word-order trap (real: PT Legal Tekno Digital).

Idempotent. Run: python3 scripts/census-gdp.py && python3 scripts/census-icons.py && node scripts/build-census.js
"""
import json
import os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
RAW = os.path.join(DATA, 'census-raw.json')
INVESTORS = os.path.join(DATA, 'investors.json')

PORTFOLIO = 'https://gdpventure.com/portfolio'

NEW = [
 {
  "name": "Cermati", "id": "cermati",
  "legal_name": "PT Agregasi Cermat Indonesia (group holdco Dwi Cermat Pte. Ltd., Singapore)",
  # 'fintech' is the first regex this string can hit — 'marketplace' (commerce)
  # and 'insurance' (insurtech) both run later, so wording is safe.
  "sector": "fintech — financial-products marketplace and aggregator: loans, credit cards and insurance comparison (Cermati Fintech Group's consumer arm)",
  "in_dki": True,
  "hq_address": "Plaza Bank Index Lt. 12, Jl. M.H. Thamrin No. 57, Gondangdia, Menteng, Jakarta Pusat 10350",
  "kecamatan": "Menteng", "kota": "Jakarta Pusat",
  "url": "https://www.cermati.com",
  "funding_total_usd_m": None,
  "last_round": "Series D (Jun 2022, MDI Ventures-led — reported ~Rp 250bn, never confirmed by the company)",
  "last_round_year": 2022,
  "funding_note": "No round has a company-confirmed amount, so the total is withheld: seed/A (East Ventures, Beenos, Finch Capital) undisclosed; Series B (Sep 2018) taken by the Djarum Group with the early VCs exiting, undisclosed; Series C (2021, MDI Ventures via Centauri Fund with Djarum's Central Capital Ventura) undisclosed; Series D (Jun 2022) only 'reportedly' Rp 250.3bn per DailySocial. Tracker totals (Preqin US$17.3M, LinkedIn-enrichment US$18.9M) are tracker-only and not published.",
  "valuation_usd_m": None,
  "valuation_note": "No figure on record. Private, never marked.",
  "employees_est": 535,
  "employees_asof": "2026-08-30", "employees_tier": 4,
  "employees_src": "https://www.linkedin.com/company/cermati",
  "employees_li": 535, "employees_li_asof": "2026-08-30",
  "employees_note": "535 on the Cermati LinkedIn page, read live 30 Aug 2026. The page's self-declared band (1,001-5,000) covers the whole Cermati Fintech Group including Indodana and is never used as a figure; the census's indodana row carries that entity's own count separately, so the two rows split the group's people by each page's own reading.",
  "investors": ["Djarum Group", "MDI Ventures", "Centauri Fund", "East Ventures (exited 2018)", "Beenos (exited 2018)", "Finch Capital (exited 2018)", "GDP Venture"],
  "verify_note": "Cermati.com's operator migrated Aug 2024 from PT Dwi Cermat Indonesia (reg. 676374, still registered, Grand Slipi Tower) to PT Agregasi Cermat Indonesia — OJK ITSK registration S-136/IK.01/2025 (14 Mar 2025) on the company's own about page; Singapore group holdco Dwi Cermat Pte. Ltd. (UEN 201617824D, live) with the operation in Jakarta, counted like Qiscus. Sister entity of the census's indodana row (PT Artha Dana Teknologi) at the same Plaza Bank Index address — cermati.com's own CSP header references *.indodana.id, confirming shared group infrastructure. LinkedIn company post 2 days before the read. Entered the census from the GDP Venture portfolio pass (the fund's page lists Cermati; Djarum took the group at Series B 2018 per East Ventures' own release).",
  "confidence": 0.85,
  "site_status": "ok", "liveness_checked": "2026-08-30",
  "lat": -6.19222, "lon": 106.82354,
  "geocode_src": "reuse:indodana (same building — Plaza Bank Index)", "geocode_kind": "building",
  "sources": [
   "https://www.cermati.com/pages/about-us",
   "https://www.linkedin.com/company/cermati",
   "https://east.vc/news/press-release/cermati-series-b",
   "https://www.digitalnewsasia.com/business/cermati-secures-series-c-funding-led-mdi-venture",
   "https://news.dailysocial.id/post/cermati-is-reportedly-securing-250-billion-rupiah-series-d-funding-led-by-mdi-ventures/",
   "https://www.companies.sg/business/201617824D/DWI-CERMAT-PTE-LTD-",
   PORTFOLIO,
  ],
 },
 {
  "name": "Garasi.id", "id": "garasi-id",
  "legal_name": "PT Digital Otomotif Indonesia",
  # 'automotive' lands this in Travel & Mobility (the Broom idiom). Keep the
  # words 'marketplace'/'retail' (commerce) and 'B2B' (saas) OUT of the string.
  "sector": "automotive services — vehicle warranty, inspection, towing and servicing for fleets and dealers (consumer used-car platform until a 2021 pivot)",
  "in_dki": True,
  "hq_address": "Jl. K.S. Tubun II C No. 8, Slipi, Palmerah, Jakarta Barat 11410",
  "kecamatan": "Palmerah", "kota": "Jakarta Barat",
  "url": "https://garasi.id",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "funding_note": "No announced round. Built and funded inside the group: Kaskus (PT Darta Media Indonesia) launched Garasi.id in Jul 2017 within the GDP Venture builder, and no outside investor was ever named. A 'Venture Round 2023' on LinkedIn-enrichment data is tracker-only and not published.",
  "valuation_usd_m": None,
  "valuation_note": "No figure on record. Private, never marked.",
  "employees_est": 44,
  "employees_asof": "2026-08-30", "employees_tier": 4,
  "employees_src": "https://www.linkedin.com/company/garasi-id",
  "employees_li": 44, "employees_li_asof": "2026-08-30",
  "employees_note": "44 on its LinkedIn page, read live 30 Aug 2026 (CEO Ardyanto Alam shown on the page); the self-declared 51-200 band is stale against the count and is not used.",
  "investors": ["GDP Venture (via Kaskus)"],
  "verify_note": "PT Digital Otomotif Indonesia is Garasi.id's own footer ('Copyright (c) 2026 PT. Digital Otomotif Indonesia') — do not confuse with the registry near-namesake PT Garasi Digital Teknologi (Pejaten, a different company). Launched by Kaskus in 2017 (hybrid.co.id at the time); pivoted 2021 from consumer used-car sales to fleet/dealer services — warranty, inspection, towing, servicing — and still operates from the Kaskus K.S. Tubun campus, with a Surabaya workshop. GDP Venture's own LinkedIn posted Garasi.id partnership content on 3 Feb 2026. Entered the census from the GDP Venture portfolio pass.",
  "confidence": 0.8,
  "site_status": "ok", "liveness_checked": "2026-08-30",
  "lat": -6.19010, "lon": 106.80476,
  "geocode_src": "photon:Jalan Ks Tubun II C, Palmerah", "geocode_kind": "street",
  "sources": [
   "https://garasi.id",
   "https://www.linkedin.com/company/garasi-id",
   "https://hybrid.co.id/post/kaskus-dirikan-marketplace-khusus-otomotif-garasi-id/",
   "https://id.wikipedia.org/wiki/Global_Digital_Prima",
   PORTFOLIO,
  ],
 },
 {
  "name": "CATAPA", "id": "catapa",
  "legal_name": "PT Citra Teknologi Pintar",
  # 'saas' fires before the hr/misc rule; 'payroll' does not trip the fintech
  # /payment/ regex. Keep 'health'/'retail' out.
  "sector": "HR & payroll SaaS — HRIS with an agentic-AI payroll assistant (incubated at GDP Labs)",
  "in_dki": True,
  "hq_address": "The East Tower Lt. 37, Jl. Dr. Ide Anak Agung Gde Agung Kav. E3.2 No. 1, Mega Kuningan, Setiabudi, Jakarta Selatan 12950",
  "kecamatan": "Setiabudi", "kota": "Jakarta Selatan",
  "url": "https://catapa.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "funding_note": "No announced round. Internally incubated and funded at GDP Labs since 21 Apr 2017; Caplight's 'Seed, Apr 2017' is tracker-only and not published.",
  "valuation_usd_m": None,
  "valuation_note": "No figure on record. Private, never marked.",
  "employees_est": 63,
  "employees_asof": "2026-08-30", "employees_tier": 4,
  "employees_src": "https://www.linkedin.com/company/catapapayroll",
  "employees_li": 63, "employees_li_asof": "2026-08-30",
  "employees_note": "63 on its LinkedIn page ('CATAPA Official'), read live 30 Aug 2026, inside the self-declared 51-200 band. Some staff are dual-badged with GDP Labs (a sampled profile reads 'CATAPA HRIS & GDP Labs'), so if GDP Labs ever gets a row the two must be checked for double-counted people.",
  "investors": ["GDP Venture (GDP Labs)"],
  "verify_note": "PT Citra Teknologi Pintar is bound by catapa.com's own Terms & Conditions (effective 1 Nov 2024) and holds ISO/IEC 27001 cert ISMS1001286 in that name; the Ministry registry (reg. 1266378) puts the PT at the same The East Lt. 37 address as the LinkedIn HQ. Jakarta, not Bandung — Bandung is a GDP Labs engineering office. Indonesian Wikipedia still files Catapa under PT Darta Media Indonesia; stale, superseded by the company's own T&C. CEO Stefanie Suanita concurrently holds a GDP Labs Senior Principal PM role — the entanglement is real but the entity test passes. Active: AWS co-presentation and hiring posts within the month before the read. Entered the census from the GDP Venture portfolio pass.",
  "confidence": 0.85,
  "site_status": "ok", "liveness_checked": "2026-08-30",
  "lat": -6.22924, "lon": 106.82502,
  "geocode_src": "photon:The East, Mega Kuningan", "geocode_kind": "building",
  "sources": [
   "https://catapa.com/terms-conditions",
   "https://www.linkedin.com/company/catapapayroll",
   "https://www.compasslist.com/founders/stefanie-suanita",
   "https://gdplabs.gitbook.io/catapa/catapa/about-catapa",
   "https://validation.cbqaglobal.com/verify/ISMS1001286",
   PORTFOLIO,
  ],
 },
 {
  "name": "SweetEscape", "id": "sweetescape",
  "legal_name": "PT SweetEscape Kenangan Indonesia (holdco SweetEscape Pte. Ltd., Singapore)",
  # 'marketplace' → Commerce, matching the fund's own COMMERCE filing.
  "sector": "on-demand photography services marketplace — books vetted photographers for trips, events and brands across 400+ cities",
  "in_dki": True,
  "hq_address": "Revenue Tower Lt. 19, District 8 SCBD, Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190",
  "kecamatan": "Kebayoran Baru", "kota": "Jakarta Selatan",
  "url": "https://sweetescape.com",
  "funding_total_usd_m": 7,
  "last_round": "Series A — US$6M co-led by Openspace Ventures and Jungle Ventures, with Burda Principal Investments (Jul 2019); Beenext, Skystar Capital and GDP Venture as existing investors",
  "last_round_year": 2019,
  "funding_src": "https://techcrunch.com/2019/07/02/sweet-escape-6m/",
  "funding_src_tier": "announced",
  "funding_src_all": [
   "https://techcrunch.com/2019/07/02/sweet-escape-6m/",
   "https://hybrid.co.id/post/sweetescapes-plans-after-receiving-seed-funding/",
  ],
  "funding_note": "US$7M disclosed = US$1M seed (2017, announced Aug 2018) + US$6M Series A (Jul 2019, TechCrunch). The Series B planned for 2020 was never announced; no rounds after 2019 are on record.",
  "valuation_usd_m": None,
  "valuation_note": "No figure on record. Private, never marked.",
  "employees_est": 99,
  "employees_asof": "2026-08-30", "employees_tier": 4,
  "employees_src": "https://www.linkedin.com/company/sweetescape",
  "employees_li": 99, "employees_li_asof": "2026-08-30",
  "employees_note": "99 on its LinkedIn page, read live 30 Aug 2026, inside the self-declared 51-200 band. The sister page 'Fotto by SweetEscape' is not counted.",
  "investors": ["Openspace Ventures", "Jungle Ventures", "Burda Principal Investments", "BEENEXT", "Skystar Capital", "GDP Venture"],
  "verify_note": "PT SweetEscape Kenangan Indonesia is named in the company's own privacy policy (gazette trace BN 102/TBN 023627, 2018); the T&C also names SweetEscape APAC Ltd and the Singapore holdco SweetEscape Pte. Ltd. — Jakarta operation under a SG holdco, counted like Qiscus. Founded 2016 by David Soong; TechCrunch's Series A piece names GDP Venture as an existing investor, and Katadata files Sweet Escape in GDP's commerce portfolio. Survived COVID: KONTAN featured Soong on 1 Feb 2025, and the registered PT address (Grand Wijaya Center, Kebayoran Baru) sits behind the Revenue Tower operating office LinkedIn lists. Entered the census from the GDP Venture portfolio pass.",
  "confidence": 0.85,
  "site_status": "ok", "liveness_checked": "2026-08-30",
  "lat": -6.22754, "lon": 106.80712,
  "geocode_src": "reuse:brik (same building — Revenue Tower Lt. 19)", "geocode_kind": "building",
  "sources": [
   "https://techcrunch.com/2019/07/02/sweet-escape-6m/",
   "https://www.sweetescape.com/privacy-policy",
   "https://www.linkedin.com/company/sweetescape",
   "https://peluangusaha.kontan.co.id/news/mencetak-cuan-dari-hasil-jepretan-foto",
   "https://katadata.co.id/digital/startup/6126278d598df/unit-usaha-djarum-gdp-venture-siapkan-strategi-baru-di-bisnis-media",
   PORTFOLIO,
  ],
 },
 {
  "name": "JumpStart", "id": "jumpstart",
  "legal_name": "PT Muara Juara Kreasi Indonesia",
  # 'F&B' + 'coffee' → fnb. The press calls the machines "mesin retail pintar";
  # the word 'retail' must NOT appear here or commerce takes the row.
  "sector": "F&B tech — smart vending machines for coffee, matcha and snacks (6,400+ machines across Indonesia)",
  "in_dki": True,
  "hq_address": "The Bellezza Shopping Arcade Lt. LG, Jl. Arteri Permata Hijau No. 34, Grogol Utara, Kebayoran Lama, Jakarta Selatan 12210",
  "kecamatan": "Kebayoran Lama", "kota": "Jakarta Selatan",
  "url": "https://jumpstart.id",
  "funding_total_usd_m": None,
  "last_round": "Series C — Cool Japan Fund (announced Jun 2026; amount undisclosed)",
  "last_round_year": 2026,
  "funding_note": "Every round is undisclosed, so the total is a dash: Series A 2018 from GDP Venture (heaptalk); Series B May 2023 led by Cool Japan Fund with Living Lab Ventures (CJF's own press PDF, ~2,000 machines then); Series C decided FY2025 and publicized Jun 2026 (CJF press 20 Apr 2026; kumparan/DealStreetAsia). No amount appears in any source.",
  "valuation_usd_m": None,
  "valuation_note": "No figure on record. Private, never marked.",
  "employees_est": 113,
  "employees_asof": "2026-08-30", "employees_tier": 4,
  "employees_src": "https://www.linkedin.com/company/jumpstart-indonesia",
  "employees_li": 113, "employees_li_asof": "2026-08-30",
  "employees_note": "113 on its LinkedIn page, read live 30 Aug 2026, inside the self-declared 51-200 band. The machines are unmanned — this is corporate/field staff, not a fleet count.",
  "investors": ["GDP Venture", "Cool Japan Fund", "Living Lab Ventures"],
  "verify_note": "PT Muara Juara Kreasi Indonesia is named in Cool Japan Fund's own May-2023 press PDF ('About PT Muara Juara Kreasi Indonesia (JumpStart)'). 6,400+ machines and '200% growth' as of Dec 2025 per CJF's Apr-2026 Series C PDF; 'Yoridori by JumpStart' matcha machines launched Aug 2026 (GDP's own newsroom). Founded 2018 by Brian Imawan. Beware US namesakes (Jump Start Java LLC). Entered the census from the GDP Venture portfolio pass.",
  "confidence": 0.85,
  "site_status": "ok", "liveness_checked": "2026-08-30",
  "lat": -6.22168, "lon": 106.78247,
  "geocode_src": "reuse:qalboo (same building — Bellezza Shopping Arcade)", "geocode_kind": "building",
  "sources": [
   "https://www.cj-fund.co.jp/en/files/press_230525-en.pdf",
   "https://www.cj-fund.co.jp/en/files/press_260420-en.pdf",
   "https://heaptalk.com/news/jumpstart-bags-a-series-b-in-funds-from-living-lab-ventures-and-cool-japan-fund/",
   "https://kumparan.com/kumparanbisnis/jumpstart-dapatkan-pendanaan-series-c-dari-cool-japan-fund-inc-27TQVpMCvQ3",
   "https://www.linkedin.com/company/jumpstart-indonesia",
   PORTFOLIO,
  ],
 },
 {
  "name": "Kontrak Hukum", "id": "kontrak-hukum",
  "legal_name": "PT Legal Tekno Digital",
  # 'legal' routes to the misc/'Other tech' bucket — no earlier regex fires.
  "sector": "legal tech — company incorporation, contracts, trademark and compliance for SMEs (khOS, DiBA digital business assistant)",
  "in_dki": True,
  "hq_address": "Jl. Kemanggisan Utama Raya No. 9A, Kemanggisan, Palmerah, Jakarta Barat 11480",
  "kecamatan": "Palmerah", "kota": "Jakarta Barat",
  "url": "https://kontrakhukum.com",
  "funding_total_usd_m": None,
  "last_round": "Strategic investment by KASKUS (Nov 2018, amount undisclosed)",
  "last_round_year": 2018,
  "funding_note": "The Nov-2018 KASKUS strategic investment was announced with no value ('tidak disebutkan berapa nilai investasi' — youngster.id); no other round is on record. CB Insights' 'Corporate Minority' stage is tracker-only.",
  "valuation_usd_m": None,
  "valuation_note": "No figure on record. Private, never marked.",
  "employees_est": 27,
  "employees_asof": "2026-06-28", "employees_tier": 5,
  "employees_src": "https://www.linkedin.com/company/kontrakhukum",
  "employees_li": 77, "employees_li_asof": "2026-08-13",
  "employees_note": "27 is a dated vendor read (Exa enrichment, Jun 2026, +17.5% YoY) — published because the LinkedIn page count is unusable: the cached 13 Aug 2026 crawl shows 77 members against the company's own 11-50 band, i.e. association pollution (regional-branch and partner profiles). LinkedIn blocked live crawls on the read day; the band corroborates the tens, not the 77.",
  "investors": ["GDP Venture (via Kaskus)"],
  "verify_note": "PT Legal Tekno Digital — the company's own site footer and the Ministry registry (reg. 954553) agree; LinkedIn-enrichment's 'PT Tekno Legal Digital' is a word-order trap. Founded 2018 by Rieke Caroline (her 2017 buatkontrak.com was a different PT). Address is triple-listed — Kemanggisan footer (used here), SME Tower Gatot Subroto on LinkedIn, The East on the registry; the company's own current footer wins. Active 2026: '© 2026 Kontrak Hukum. khOS' footer, a new DiBA subscription product, a BCA merchant-event speaking slot (~Jul 2026), and GDP Venture's own #KontrakHukum promo post on 3 Jul 2026. Entered the census from the GDP Venture portfolio pass.",
  "confidence": 0.72,
  "site_status": "ok", "liveness_checked": "2026-08-30",
  "lat": -6.18973, "lon": 106.79393,
  "geocode_src": "photon:Jalan Kemanggisan Utama, Palmerah", "geocode_kind": "street",
  "sources": [
   "https://kontrakhukum.com",
   "https://www.linkedin.com/company/kontrakhukum",
   "https://youngster.id/headline/kaskus-berinvestasi-di-kontrakhukum-com/",
   "https://hybrid.co.id/post/kaskus-invests-in-kontrakhukum/",
   PORTFOLIO,
  ],
 },
 {
  "name": "Balesin.id", "id": "balesin",
  "legal_name": "PT Jualan Online Indonesia (BJtech)",
  # 'saas' → SaaS. The substring 'commerce' (even inside 'chat-commerce' /
  # 'conversational-commerce') trips the Commerce regex first — keep it OUT,
  # along with 'marketplace'/'retail'; 'bank' out too ('Bang Joni' is safe).
  "sector": "conversational-selling SaaS — WhatsApp chat automation, live-agent customer service and POS loyalty for merchants",
  "in_dki": True,
  "hq_address": "Rukan Permata Senayan Blok B-25, Jl. Tentara Pelajar No. 1, Grogol Utara, Kebayoran Lama, Jakarta Selatan 12210",
  "kecamatan": "Kebayoran Lama", "kota": "Jakarta Selatan",
  "url": "https://balesin.id",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "funding_note": "Withheld to a dash: detikINET (Sep 2016) put the Bang Joni-era round at 'diperkirakan USD 2 juta' — an estimate, not an announcement — plus US$200K at launch from Teknologi Investamma Ventura per the same piece; no figure the company itself announced exists, and the LinkedIn/Crunchbase US$1.4M is tracker-only. GDP Venture's stake was never priced publicly.",
  "valuation_usd_m": None,
  "valuation_note": "No figure on record. Private, never marked.",
  "employees_est": 9,
  "employees_asof": "2026-06-28", "employees_tier": 5,
  "employees_src": "https://www.linkedin.com/company/bjtech",
  "employees_li": 43, "employees_li_asof": "2026-08-30",
  "employees_note": "9 is a dated vendor read (Exa enrichment, 28 Jun 2026) — published because the BJtech LinkedIn page count (43, cached crawl) is visibly polluted: sampled member cards belong to unrelated companies, and a second page ('Balesin Chat') collects random self-associations. The company's own band is 11-50.",
  "investors": ["Teknologi Investamma Ventura", "GDP Venture"],
  "verify_note": "PT Jualan Online Indonesia is named in balesin.id's own Terms — Balesin.id is that PT's flagship brand (evolution: Bang Joni chatbot 2016 → BJtech → Balesin.id 2019), so the dedicated-entity test passes. Tracxn marks BJtech 'deadpooled' (Apr 2026) — contradicted by GDP Venture's own LinkedIn announcing Balesin's POS Loyalty launch on 24 Jul 2026 and by the live site + Live Agent app; the deadpool flag is stale tracker data. Founder Diatce G. Harahap runs .temu Coffee (Bali) concurrently. Entered the census from the GDP Venture portfolio pass.",
  "confidence": 0.7,
  "site_status": "ok", "liveness_checked": "2026-08-30",
  "lat": -6.22189, "lon": 106.79120,
  "geocode_src": "photon:Rukan Permata Senayan, Kebayoran Lama", "geocode_kind": "building",
  "sources": [
   "https://balesin.id/term",
   "https://www.linkedin.com/company/bjtech",
   "https://inet.detik.com/cyberlife/d-3289954/teman-virtual-bang-joni-disuntik-usd-2-juta",
   "https://www.liputan6.com/tekno/read/4382426/balesinid-kembangkan-fitur-chat-commerce-untuk-whatsapp",
   PORTFOLIO,
  ],
 },
 {
  "name": "Ubiklan", "id": "ubiklan",
  "legal_name": "PT Helpio Glovin Teknologi",
  # 'media —' head keeps it next to StickEarn in Media & Gaming; keep
  # 'marketplace' out or commerce takes it.
  "sector": "media — out-of-home and transit advertising technology: car-wraps, TransJakarta/KRL/LRT branding, LED and drone shows",
  "in_dki": True,
  "hq_address": "Mall Taman Palem Lt. 8 (parkiran), Cengkareng, Jakarta Barat 11730",
  "kecamatan": "Cengkareng", "kota": "Jakarta Barat",
  "url": "https://www.ubiklan.com",
  "funding_total_usd_m": None,
  "last_round": "Seed — Warna Warni Group (2017, amount never announced)",
  "last_round_year": 2017,
  "funding_note": "Founder Glorio Yulianto confirms Warna Warni Group (the OOH incumbent) as seed investor on the record, but the amount was only ever hearsay-worded ('kabarnya ratusan ribu dolar' — youngster.id), so the total stays a dash; Caplight's US$100K Nov-2016 seed is tracker-only. No amount for GDP Venture's stake either.",
  "valuation_usd_m": None,
  "valuation_note": "No figure on record. Private, never marked.",
  "employees_est": 69,
  "employees_asof": "2026-08-27", "employees_tier": 4,
  "employees_src": "https://www.linkedin.com/company/ubiklan",
  "employees_li": 69, "employees_li_asof": "2026-08-27",
  "employees_note": "69 on its LinkedIn page — a cached 27 Aug 2026 crawl (LinkedIn blocked a live read on the 30th), comfortably inside the self-declared 51-200 band and consistent with the vendor trend (+15% YoY from 50), so the three-day-old figure is published as read.",
  "investors": ["Warna Warni Group", "GDP Venture"],
  "verify_note": "PT Helpio Glovin Teknologi is bound by ubiklan.com's own Terms of Use and sits in the Ministry registry (reg. 765884); 'Ubiklan Technologies' in the footer is a trade name, not the PT. Founded 2016 by Glorio Yulianto and Kalvin Handoko; grown from car-wrap ads into full hybrid OOH (TransJakarta/KRL/LRT branding, LED, billboards, drone shows — GDP Venture's own #ubiklan drone-show post, 11 Apr 2026). Operating HQ is the Mall Taman Palem office per its footer; the registered address is APL Tower Central Park. Own 'Mid-Year Review OOH Jabodetabek 2026' report published days before the read. Entered the census from the GDP Venture portfolio pass.",
  "confidence": 0.85,
  "site_status": "ok", "liveness_checked": "2026-08-30",
  "lat": -6.13936, "lon": 106.73174,
  "geocode_src": "photon:Mall Taman Palem, Cengkareng", "geocode_kind": "building",
  "sources": [
   "https://www.ubiklan.com/term_of_use/business/",
   "https://www.linkedin.com/company/ubiklan",
   "https://youngster.id/technopreneur/glorio-yulianto-ubah-kemacetan-jadi-keuntungan/",
   "https://www.techinasia.com/companies/pthelpio-glovin-teknologi-ubiklan",
   PORTFOLIO,
  ],
 },
]

# Per-row investor tags + provenance on rows that were already in the census.
# investors_add appends missing names (case-insensitive dedup), sources_add
# appends missing URLs, verify_append appends once (marker = first 40 chars).
TAGS = {
 'blibli': {
  'investors_add': ['GDP Venture (Djarum Group)'],
  'sources_add': [PORTFOLIO],
  'verify_append': ' GDP Venture pass (30 Aug 2026): Blibli is on the fund’s own portfolio page — the Djarum Group’s flagship e-commerce build inside GDP Venture (PT Global Digital Prima), not an outside cheque.',
 },
 'tiket-com': {
  'investors_add': ['GDP Venture (Djarum Group)'],
  'sources_add': [PORTFOLIO],
  'verify_append': ' GDP Venture pass (30 Aug 2026): on the fund’s own portfolio page; held through the Blibli group since PT Global Digital Niaga took tiket.com in 2017.',
 },
 'dekoruma': {
  'investors_add': ['GDP Venture (via Global Digital Niaga)', 'BEENEXT', 'Convergence Ventures'],
  'sources_add': [
   'https://hybrid.co.id/post/pendanaan-e-commerce-interior-dekoruma/',
   PORTFOLIO,
  ],
  'verify_append': ' GDP Venture pass (30 Aug 2026): before the 2024 acquisition, Dekoruma’s Series B (Oct 2018, “several million dollars”) was led by Global Digital Niaga — “lini bisnis GDP Ventures” per Kontan — with AddVentures, Skystar, Beenext and Convergence participating; the fund’s page still lists Dekoruma.',
 },
 'halodoc': {
  'investors_add': ['GDP Venture (via Blibli)'],
  'sources_add': [
   'https://www.avcj.com/avcj/news/3001811/indonesia-healthcare-services-app-gets-usd11m-series-a',
   PORTFOLIO,
  ],
  'verify_append': ' GDP Venture pass (30 Aug 2026): Halodoc is on the fund’s own portfolio page; press names the group’s Blibli entity rather than the fund brand — AVCJ’s Series A coverage (2016) lists Blibli (“controlled by … Djarum Group”) among the investors alongside lead Clermont, NSI Ventures and Go-Jek, and the 2019 US$65M Series B release lists Blibli.com as an existing investor.',
 },
 'idn': {
  'investors_add': ['GDP Venture', 'North Base Media', 'MNM Creative'],
  'sources_add': [
   'https://www.idntimes.com/business/finance/idn-media-raih-pendanaan-seri-a-dari-north-base-media-gdp-venture-east-ventures-dan-mnm-creative-1-00-7nfm9-66z74c',
   PORTFOLIO,
  ],
  'verify_append': ' GDP Venture pass (30 Aug 2026): IDN’s own Sep-2016 Series A announcement names North Base Media, GDP Venture, East Ventures and MNM Creative (amount undisclosed) — the fund’s page also tiles seven IDN units (Duniaku, ggwp, IDN Pictures, Popbela, Popmama, Yummy, ICE) separately; they are all inside this one row.',
 },
 'agate': {
  'investors_add': ['GDP Venture'],
  'sources_add': [
   'https://katadata.co.id/digital/nasional/5ea689f307f19/musim-semi-pengembang-gim-tanah-air',
   PORTFOLIO,
  ],
  'verify_append': ' GDP Venture pass (30 Aug 2026): Agate is on the fund’s own portfolio page and Katadata (Apr 2020) treats it as part of the GDP Venture ecosystem, with GDP’s corporate-PR head speaking for its numbers — but no round announcement names GDP Venture, so the tag is recorded with round undisclosed (the only announced round remains the 2016 Maloekoe pre-Series A).',
 },
 'nalagenetics': {
  'investors_add': ['GDP Venture'],
  'sources_add': [PORTFOLIO],
  'verify_append': ' GDP Venture pass (30 Aug 2026): the tag rests on the fund’s own portfolio listing — no funding release names GDP Venture (the US$12.6M Series A was co-led by Intudo and Vulcan with A*ccelerate, Dexa, Diagnos and Integra) — recorded with round undisclosed rather than inventing one.',
 },
 'indodana': {
  'investors_add': ['GDP Venture (Cermati Fintech Group)'],
  'sources_add': [
   'https://east.vc/news/press-release/cermati-series-b',
   PORTFOLIO,
  ],
  'verify_append': ' GDP Venture pass (30 Aug 2026): the fund’s page lists Cermati, and the Djarum Group took the Cermati group at its 2018 Series B (East Ventures’ own release, with EV/Beenos/Finch exiting) — this row is the group’s BNPL entity; the marketplace entity (PT Agregasi Cermat Indonesia) is the census’s separate cermati row, and each row’s jobs figure is its own LinkedIn page count, never the shared group band.',
 },
}

# Curated fund profile for /investor/gdp-venture — data/investors.json is the
# single-writer side file for these; this script owns the 'gdp-venture' key.
FUND = {
 "name": "GDP Venture",
 "type": "Corporate venture builder (Djarum Group)",
 "site": "https://gdpventure.com",
 "hq": "Wisma 77 Tower 2 Lt. 8, Jl. Letjen S. Parman Kav. 77, Slipi, Jakarta Barat",
 "founded": 2010,
 "founders": ["Martin Hartono"],
 "about": "The Djarum Group’s digital venture builder, founded in 2010 by Martin Hartono; On Lee is CTO, Danny Wirianto CBO, Benny Sudrata CFO, with Antonny Liem and Kusumo Martanto as founding partners. It builds and buys as much as it invests: Blibli, tiket.com, Kaskus and Garasi.id are group builds, Kumparan and IDN arrived as media investments, the Cermati group came in at its 2018 Series B, and a product arm (GDP Labs) incubates SaaS like CATAPA. Its published portfolio — 48 names on the page, read 30 Aug 2026 — also carries a substantial US entertainment book (88rising, Triller, Now United, Aptera) that sits outside an Indonesian census by definition. Kaskus and Prosa.ai carry GDP Venture on their census rows from earlier evidence despite being absent from the current page.",
 "sources": [
  "https://gdpventure.com/portfolio",
  "https://gdpventure.com/about",
  "https://katadata.co.id/ekonopedia/profil/63621b454e4d0/mengenal-gdp-venture-modal-ventura-grup-djarum-di-balik-blibli",
  "https://id.wikipedia.org/wiki/Global_Digital_Prima",
 ],
 "outside_asof": "30 Aug 2026",
 "outside": [
  {"name": "Duniaku", "url": "https://duniaku.idntimes.com", "status": "Unit of IDN",
   "why": "Gaming-media brand run inside IDN (PT Media Putra Nusantara); the census’s IDN row already counts its people and output — a separate row would double-count."},
  {"name": "ggwp", "url": "https://ggwp.id", "status": "Unit of IDN",
   "why": "Esports/gaming community brand inside IDN; contained in the census’s IDN row."},
  {"name": "IDN Pictures", "url": "https://www.idn.media", "status": "Unit of IDN",
   "why": "IDN’s film arm; contained in the census’s IDN row."},
  {"name": "Popbela", "url": "https://www.popbela.com", "status": "Unit of IDN",
   "why": "Women’s media brand inside IDN; contained in the census’s IDN row."},
  {"name": "Popmama", "url": "https://www.popmama.com", "status": "Unit of IDN",
   "why": "Parenting-media brand inside IDN; contained in the census’s IDN row."},
  {"name": "Yummy", "url": "https://www.yummy.co.id", "status": "Unit of IDN",
   "why": "Food-media brand inside IDN (not Yummy Corp, the cloud-kitchen company); contained in the census’s IDN row."},
  {"name": "Indonesia Creators Economy (ICE)", "url": "https://www.ice.id", "status": "Unit of IDN",
   "why": "IDN’s creator-economy arm; contained in the census’s IDN row."},
  {"name": "GLAIR", "url": "https://glair.ai", "status": "Operating — GDP Labs AI arm",
   "why": "No dedicated entity: GDP Labs’ AI research team grown into a brand (KrAsia interview with its founder); its site footer sits at PT Darta Media Indonesia’s registered address and no PT GLAIR exists in the registry. A product line inside another PT does not get a row — the Jenius rule."},
  {"name": "MXA (MediaXAsia)", "url": "https://www.mxa.id", "status": "Operating — Merah Cipta Media unit",
   "why": "Ad-buying unit inside PT Merah Cipta Media: its GM sits on MCM’s payroll, its LinkedIn HQ is MCM’s own Wisma 77 floor, no dedicated PT was found, and the fund page’s own link to it now 404s."},
  {"name": "Bolalob", "url": "https://bolalob.com", "status": "Folded into kumparan (May 2026)",
   "why": "A sports-media brand, never its own PT — ran inside Kaskus (bolalob.com still serves PT Darta Media Indonesia’s *.kaskus.co.id certificate) and was integrated into the kumparan ecosystem on 29 May 2026; the brand lives on Instagram (~1.2M followers)."},
  {"name": "Springboard", "url": "https://springboard.id", "status": "Queued — entity unverifiable",
   "why": "Real and recently active (ran the 2025 Scooter Prix series at Sentul on TVRI, produced 88rising’s Head In The Clouds Jakarta; founder David Wayne Ika) but no PT name is traceable and springboard.id has no DNS today; queued until the entity or the site surfaces."},
  {"name": "12WIRED", "url": "https://www.12wired.com", "status": "Queued — entity unverifiable",
   "why": "Operating Jakarta music company (10 people on a live LinkedIn read, 30 Aug 2026; CEO Nadia Yustina, ex-Sony Music) in the Merah Cipta Media stable, addressed in GDP’s own Wisma 77 building — but no PT name is traceable today; queued until the entity surfaces."},
  {"name": "ProPS", "url": "https://props.id", "status": "Queued — site down today",
   "why": "PT Promedia Punggawa Satu (reg. 728556, BSD City; 2017 KASKUS strategic investment, press names GDP Venture) — but props.id timed out from two independent networks on 30 Aug 2026 and nothing newer than its 8 May 2026 LinkedIn post is verifiable. Flips to a row when the site or fresher activity returns."},
  {"name": "TuringSense", "url": "https://www.turingsense.com", "status": "Unclear — likely dormant",
   "why": "US wearables maker (Campbell, CA) with a former Jakarta R&D arm; site still up but no product or news activity found since ~2021. Foreign HQ and no live Indonesian operation to count."},
  {"name": "Alto", "url": "https://alto.com", "status": "Operating — US",
   "why": "US digital pharmacy (San Francisco; acquired by Paulus Holdings 2025, now under Fuze Health) — not an Indonesian company."},
  {"name": "Yumi", "url": "https://helloyumi.com", "status": "Operating — US",
   "why": "US organic baby-nutrition brand (Los Angeles) — not an Indonesian company."},
  {"name": "88rising", "url": "https://88rising.com", "status": "Operating — US",
   "why": "US music label and media company for Asian and Asian-American artists (Los Angeles) — not an Indonesian company."},
  {"name": "EST Media (Eastern Standard Times)", "url": "https://www.easternstandardtimes.com", "status": "Operating — US",
   "why": "Pan-Asian Gen-Z media group (West Hollywood; EST Media Holding Inc.) — not an Indonesian company."},
  {"name": "NEX", "url": "https://www.nex.inc", "status": "Operating — US",
   "why": "Nex Team Inc. (San Jose), maker of HomeCourt and the Nex Playground motion-gaming console — not an Indonesian company."},
  {"name": "Now United", "url": "https://www.nowunited.com", "status": "Operating — global (XIX Entertainment)",
   "why": "Simon Fuller’s global rotating-member pop group (Los Angeles; roster includes an Indonesian member) — an entertainment IP, not an Indonesian company."},
  {"name": "Stampede Ventures", "url": "https://stampedeventures.com", "status": "Operating — US",
   "why": "Hollywood film/TV production company founded by ex-Warner Bros. president Greg Silverman — not an Indonesian company."},
  {"name": "Triller", "url": "https://triller.co", "status": "Operating — US (NASDAQ: ILLR)",
   "why": "US short-video/creator platform, now Triller Group Inc. — not an Indonesian company."},
  {"name": "Aptera", "url": "https://www.aptera.us", "status": "Operating — US",
   "why": "US solar electric-vehicle maker (Carlsbad, CA; targeting Q4 2026 production) — not an Indonesian company."},
  {"name": "Motosurf", "url": "https://motosurf.com", "status": "Operating — US",
   "why": "US electric-jetboard maker (Dallas, TX) — not an Indonesian company."},
  {"name": "Vintage Electric", "url": "https://www.vintageelectricbikes.com", "status": "Operating — US",
   "why": "US hand-built e-bike maker (Santa Clara, CA) — not an Indonesian company."},
  {"name": "6Estates", "url": "https://www.6estates.com", "status": "Operating — Singapore",
   "why": "NUS-spinoff document-AI vendor for banks and finance — Singapore company."},
  {"name": "Gushcloud", "url": "https://www.gushcloud.com", "status": "Operating — Singapore",
   "why": "Gushcloud International — global influencer marketing and creator/talent company — Singapore company."},
  {"name": "Involve Asia", "url": "https://involve.asia", "status": "Operating — Malaysia",
   "why": "Affiliate/performance-marketing platform (Involve Asia Technologies Sdn Bhd, Kuala Lumpur) — Malaysian company."},
  {"name": "Datasaur.ai", "url": "https://datasaur.ai", "status": "Operating — US",
   "why": "YC W20 data-labeling/private-AI company, HQ in the SF Bay Area. Much of its engineering sits in Indonesia (its VP Engineering and principal engineers are in Jakarta/Yogyakarta), but the company itself is US — no Indonesian entity to count."},
 ],
}


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by_id = {c.get('id'): c for c in raw['companies']}
    added, updated, tagged = [], [], []

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
        if isinstance(src, list):
            for u in tag.get('sources_add', []):
                if u not in src:
                    src.append(u); touched = True
        va = tag.get('verify_append')
        if va and va[:40] not in (c.get('verify_note') or ''):
            c['verify_note'] = (c.get('verify_note') or '').rstrip() + va
            touched = True
        if touched:
            tagged.append(cid)

    json.dump(raw, open(RAW, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    try:
        inv_details = json.load(open(INVESTORS, encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError):
        inv_details = {}
    inv_details['gdp-venture'] = FUND
    json.dump(inv_details, open(INVESTORS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    n_gdp = sum(1 for c in raw['companies']
                if any('gdp venture' in str(x).lower() for x in c.get('investors', [])))
    print(f"added {len(added)}: {', '.join(added) or '-'}")
    print(f"updated {len(updated)}: {', '.join(updated) or '-'}")
    print(f"tagged {len(tagged)}: {', '.join(tagged) or '-'}")
    print(f"rows carrying GDP Venture: {n_gdp}")
    print(f"companies now {len(raw['companies'])}")
    print("investors.json: gdp-venture profile seeded "
          f"({len(FUND['outside'])} names on the outside register)")


if __name__ == '__main__':
    main()
