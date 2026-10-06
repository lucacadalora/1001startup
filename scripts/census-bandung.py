#!/usr/bin/env python3
"""BANDUNG COHORT — the census leaves Greater Jakarta (Aug 30 2026).

Luca: "we need to expand https://1001.vantis.sh/map with bandung, because some
startup is in there like mayar."

Mayar is real and it is Bandung: PT Mayar Kernel Supernova, Jl. Trunojoyo No.11,
Bandung Wetan — the Ministry of Law registry and the company's own /about agree
on both. It was invisible to every earlier sweep for one reason: the census was
scoped to Greater Jakarta, and Bandung was an explicit EXCLUSION — Bobobox,
Evermos and Agate sat in `endeavor_pending` marked "plainly out of region", and
FirstSupport.ai and Delegasi sat in `yc_outside` marked "outside Greater
Jakarta". That scope line moves here.

Same bar as every other row, no lower: tech- or venture-built, its own legal
entity, a headcount that can be sourced. Entity and address from a primary
record where one exists (companieshouse.id = the Ministry of Law registry, or
the company's own contact/privacy page); funding only where an amount is public
and linked; headcount from a live LinkedIn read with the spread against every
other figure stated — and a DASH, never a band midpoint, where nothing better
exists. Five rows here carry a dash and contribute no jobs and no output.

Two decisions worth reading before trusting the numbers:

  · eFishery is NOT here. Bandung's unicorn stopped operating in February 2025
    after the fraud audit, laid off ~90-98% of ~1,500 staff and is being wound
    up. It belongs in the shutdown register, not the live census, and that is
    where it goes (data/closed.json).

  · Delegasi is NOT here either, and it very nearly was. It looked like a
    clean move-in — YC S22, a live site, a live LinkedIn page — and the census
    liveness screen is what stopped it: a death-word hit led to the co-founder
    and CTO's own profile, which says he "ultimately made the decision to wind
    down the company". YC's directory marks it Inactive for the same reason.
    It goes to the shutdown register.

  · Dicoding's headcount is a dash even though LinkedIn shows 974 and Revelio
    1,028. Its own declared size band is 51-200 — an order of magnitude apart,
    and both models read the same LinkedIn page, which for a learning platform
    collects mentors, reviewers and alumni. The company's own statement outranks
    a workforce model on the published ladder, and a band midpoint may never be
    published, so the row shows a dash until Dicoding states a payroll figure.

Idempotent UPSERT: re-running restores exactly these fields on an existing row
(the repair path after a cross-session clobber) and leaves everything else —
logo, geocode, sprite — alone. It also rewrites the scope/yc_outside registers
it owns, so the reasons stay in sync with the rows.

    python3 scripts/census-bandung.py && node scripts/build-census.js
"""
import json, os, tempfile

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-30'

# ── the cohort ───────────────────────────────────────────────────────
# `sector` wording is load-bearing: build-census.js SECTOR_KEYS is first-match-
# wins, so each string is worded for the bucket it should land in.
ROWS = [
 {
  "name": "Evermos", "id": "evermos",
  "legal_name": "PT Setiap Hari Dipakai",
  "sector": "social commerce — sharia/halal reseller marketplace and community distribution network",
  "in_dki": False,
  "hq_address": "Jl. Ir. H. Juanda No. 95, Lebaksiliwangi, Kec. Coblong, Kota Bandung, Jawa Barat 40132",
  "kecamatan": "Coblong", "kota": "Bandung",
  "url": "https://evermos.com",
  "funding_total_usd_m": 77.25,
  "last_round": "Series C, May 2023 — US$39M led by IFC (World Bank Group)",
  "last_round_year": 2023,
  "employees_est": 582,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/evermos/",
  "employees_note": (
    "LinkedIn lists 582 people on the company page, read 2026-08-30; its own size band says "
    "501-1,000, which brackets the count. Resellers are mitra — Evermos states more than 100,000 of "
    "them — and are excluded under the census jobs rule, so this is payroll only and the platform's "
    "real economic footprint is understated by design."),
  "investors": ["IFC (World Bank Group)", "Jungle Ventures", "UOB Venture Management",
                "Telkomsel Mitra Inovasi", "MDI Ventures", "Shunwei Capital", "Alpha JWC Ventures"],
  "verify_note": (
    "PT Setiap Hari Dipakai and the Juanda 95 address both come from the Ministry of Law registry "
    "(companieshouse.id) and match the address on evermos.id's own contact page. Funding is the sum "
    "of the three ANNOUNCED rounds — US$8.25M Series A (own PR Newswire release, Jan 2020), US$30M "
    "Series B (TechCrunch, Sep 2021) and US$39M Series C (own PR Newswire release, May 2023). "
    "CB Insights totals US$78.25M over six rounds and DealStreetAsia reported the Series C as "
    "US$40M; the announced sum is published and the tracker figure is noted rather than mixed in."),
  "confidence": 0.9,
  "sources": [
    "https://www.prnewswire.com/apac/news-releases/evermos-announces-largest-fundraise-at-usd39-million-to-fuel-business-expansion-of-connected-commerce-network-301835542.html",
    "https://www.prnewswire.co.uk/news-releases/indonesia-s-leading-social-commerce-startup-evermos-secures-us-8-25m-in-series-a-funding-806399731.html",
    "https://techcrunch.com/2021/09/21/indonesian-social-commerce-startup-evermos-lands-30m-series-b/",
    "https://companieshouse.id/setiap-hari-dipakai",
    "https://evermos.id/kontak/",
    "https://www.linkedin.com/company/evermos/",
    "https://disclosures.ifc.org/project-detail/ESRS/47154/evermos-ri",
  ],
  "funding_src": "https://www.prnewswire.com/apac/news-releases/evermos-announces-largest-fundraise-at-usd39-million-to-fuel-business-expansion-of-connected-commerce-network-301835542.html",
  "funding_src_tier": "announced",
 },
 {
  "name": "Bobobox", "id": "bobobox",
  "legal_name": "PT Bobobox Mitra Indonesia",
  "sector": "travel and hospitality — app-first capsule-hotel (pod) and cabin network",
  "in_dki": False,
  "hq_address": "Jl. Dr. Djunjunan No. 3, Pamoyanan, Kec. Cicendo, Kota Bandung, Jawa Barat 40173",
  "kecamatan": "Cicendo", "kota": "Bandung",
  "url": "https://bobobox.com",
  "funding_total_usd_m": 21.32,
  "last_round": "Series B, Sep 2023 — US$8.32M",
  "last_round_year": 2023,
  "employees_est": 401,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/bobobox-id/",
  "employees_note": (
    "LinkedIn lists 401 people on the company page, read 2026-08-30; its own size band says "
    "201-500, and the count sits at the top of it. Pod and cabin housekeeping is salaried site "
    "staff, so unlike a marketplace this count is close to the real payroll."),
  "investors": ["Horizons Ventures", "Alpha JWC Ventures", "Kakao Investment", "Sequoia Capital India",
                "Mallorca Investment", "Sovereign's Capital", "SIG Venture Capital"],
  "verify_note": (
    "PT Bobobox Mitra Indonesia is the entity named on Bobobox's own privacy policy and LinkedIn "
    "page; the registry carries two more group companies — PT Bobobox Mitra Terpadu and PT Bobobox "
    "Aset Manajemen — at the same Dr. Djunjunan 3 address, and no separate row is kept for either. "
    "Funding is CB Insights' US$21.32M over five rounds, which is consistent with the two rounds "
    "that were announced with a figure: US$11.5M Series A (Horizons Ventures and Alpha JWC, "
    "reported May 2020 as Rp 170bn) and US$8.32M Series B (Sep 2023). TRACKERS DISAGREE: "
    "PremierAlts models US$27.9M raised, a US$4.5M later-stage round in May 2024 and a US$151.4M "
    "valuation as of 27 May 2024 — a secondary-market model, not a disclosed mark, so no valuation "
    "is carried on this row."),
  "confidence": 0.78,
  "sources": [
    "https://www.cbinsights.com/company/bobobox/financials",
    "https://www.dealstreetasia.com/stories/bobobox-seriesa-189500",
    "https://kalsel.antaranews.com/berita/171580/bobobox-raih-pendanaan-115-juta-dolar-as",
    "https://bobobox.com/kebijakan-privasi",
    "https://www.linkedin.com/company/bobobox-id/",
    "https://indonesia.endeavor.org/company/bobobox",
  ],
  "funding_src": "https://www.cbinsights.com/company/bobobox/financials",
  "funding_src_tier": "tracker",
 },
 {
  "name": "Agate", "id": "agate",
  "legal_name": "PT Agate International",
  "sector": "game development and publishing studio; gamification work for corporate clients",
  "in_dki": False,
  "hq_address": "Level Up Building, Kawasan Summarecon Bandung, Jl. Sentra Raya Barat Kav. 2B, Cisaranten Kidul, Kec. Gedebage, Kota Bandung, Jawa Barat 40295",
  "kecamatan": "Gedebage", "kota": "Bandung",
  "url": "https://agate.id",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 358,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/agateint/",
  "employees_note": (
    "LinkedIn lists 358 people on the company page, read 2026-08-30; its own size band says "
    "201-500. Indonesia's largest game studio by headcount, founded 2009 out of ITB."),
  "investors": [],
  "verify_note": (
    "Entity and address are Agate's own contact page, matched by CB Insights' HQ record. "
    "NO FUNDING FIGURE IS PUBLISHED because no round has been announced as closed: in August 2024 "
    "CEO Shieny Aprilia said Agate was SEEKING US$10M (Rp 155bn), of which US$2M was to come "
    "through convertible notes that year — a raise in progress, not a completed round. The "
    "Rp 100bn attached to Riftstorm in 2025 is the production budget of a co-development with "
    "Confiction Labs, not capital raised by the company, and is deliberately not counted."),
  "confidence": 0.8,
  "sources": [
    "https://agate.id/contact",
    "https://www.linkedin.com/company/agateint/",
    "https://katadata.co.id/digital/startup/66c4474a31f42/developer-gim-agate-cari-investasi-rp-155-miliar-bidik-pasar-jepang-dan-korea",
    "http://technologue.id/agate-international-geber-fundraising-perkuat-operasional-bisnis",
    "https://www.cbinsights.com/company/pt-agate-international",
    "https://indonesia.endeavor.org/company/agate",
  ],
 },
 {
  "name": "Dicoding Indonesia", "id": "dicoding",
  "legal_name": "PT Presentologics",
  "sector": "edtech — developer upskilling academy and hiring platform, with curricula licensed from Google, AWS, Microsoft and IBM",
  "in_dki": False,
  "hq_address": "Dicoding Space, Jl. Batik Kumeli No. 50, Sukaluyu, Kec. Cibeunying Kaler, Kota Bandung, Jawa Barat 40123",
  "kecamatan": "Cibeunying Kaler", "kota": "Bandung",
  "url": "https://www.dicoding.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": None,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/dicoding/",
  "employees_note": (
    "NO PUBLISHABLE FIGURE. LinkedIn shows 974 people and Revelio Labs models 1,028 (Mar 2026), but "
    "Dicoding's own declared size band is 51-200 — an order of magnitude below both. The two models "
    "read the same LinkedIn page, so they are not independent of each other, and for a learning "
    "platform that page collects mentors, reviewers, curriculum authors and alumni alongside staff. "
    "The company's own statement outranks a workforce model on the published ladder and a band "
    "midpoint is never published, so this row carries a dash and contributes no jobs and no output "
    "until Dicoding states a payroll figure."),
  "investors": [],
  "verify_note": (
    "PT Presentologics is the entity behind Dicoding Space at Jl. Batik Kumeli 50, per the "
    "company's own contact page and a third-party partner listing that names both together; a "
    "second registered name, PT Dicoding Akademi Indonesia, also exists and the split between the "
    "two is not published. No funding round is on record — Dicoding's disclosed backing is "
    "programme funding from platform partners rather than an equity round."),
  "confidence": 0.6,
  "sources": [
    "https://www.dicoding.com/contact-us",
    "https://www.linkedin.com/company/dicoding/",
    "https://www.reveliolabs.com/companies/dicoding-indonesia/employees",
    "https://citcom.id/id/member/pt-dicoding-akademi-indonesia",
  ],
 },
 {
  "name": "Brodo", "id": "brodo",
  "legal_name": "PT Brodo Ganesha Indonesia",
  "sector": "consumer brand — D2C leather footwear and menswear, with an in-house digital marketing arm",
  "in_dki": False,
  "hq_address": "Jl. Gudang Utara No. 40B, Merdeka, Kec. Sumur Bandung, Kota Bandung, Jawa Barat 40113",
  "kecamatan": "Sumur Bandung", "kota": "Bandung",
  "url": "https://bro.do",
  "funding_total_usd_m": None,
  "last_round": "Series A, Dec 2020 — led by BRI Ventures (Dana Ventura Sembrani Nusantara) with GDP Venture, amount undisclosed",
  "last_round_year": 2020,
  "employees_est": 115,
  "employees_asof": TODAY,
  "employees_src": "https://id.linkedin.com/company/pt-brodo-ganesha-indonesia",
  "employees_note": (
    "LinkedIn lists 115 people on the company page, read 2026-08-30; its own size band says 51-200. "
    "Retail store staff are salaried and count; the count runs low for a brand with physical stores "
    "because shop-floor staff keep profiles less often than head-office staff."),
  "investors": ["BRI Ventures (Dana Ventura Sembrani Nusantara)", "GDP Venture"],
  "verify_note": (
    "Founded 2010 by two ITB students and still headquartered in Bandung — LinkedIn's HQ line, the "
    "Kemenperin brand register and Craft's location record all put the head office at Jl. Gudang "
    "Utara 40B, Sumur Bandung, while an older registry filing carries Jalan Sangkuriang M2-B, also "
    "in Kota Bandung. NO AMOUNT IS PUBLISHED for the December 2020 Series A: BRI Ventures, GDP "
    "Venture, Tempo, Kontan and DealStreetAsia all reported the round without a figure, and none "
    "has been disclosed since. On Endeavor Indonesia's roster."),
  "confidence": 0.75,
  "sources": [
    "https://www.tempo.co/ekonomi/startup-sepatu-lokal-brodo-dapat-pendanaan-seri-a-dari-bri-ventures-556485",
    "https://www.dealstreetasia.com/stories/brodo-bri-ventures-219801",
    "https://keuangan.kontan.co.id/news/bri-ventures-ikut-investasi-seri-a-untuk-startup-merek-sepatu-lokal-brodo",
    "https://craft.co/brodo-ganesha-indonesia/locations",
    "https://id.linkedin.com/company/pt-brodo-ganesha-indonesia",
    "http://ifn.kemenperin.go.id/profil/brodo",
  ],
 },
 {
  "name": "Elevarm", "id": "elevarm",
  "legal_name": "PT Elevasi Agri Indonesia",
  "sector": "agritech — seeds, organic fertiliser and agronomy services for smallholder horticulture farmers",
  "in_dki": False,
  "hq_address": "Menara Asia Afrika Lt. 9, Jl. Asia Afrika No. 133-137, Kota Bandung, Jawa Barat 40112",
  "kecamatan": "Sumur Bandung", "kota": "Bandung",
    "lat": -6.92234, "lon": 107.61697,
  "geocode_kind": "road",
  "geocode_src": "nominatim: Jalan Asia Afrika, Kebon Pisang, Sumur Bandung, Kota Bandung (street-level)",
 "url": "https://elevarm.com",
  "funding_total_usd_m": 4.25,
  "last_round": "Pre-Series A, Mar 2025 — US$4.25M (Rp 70bn) led by Intudo Ventures with Insignia Ventures Partners and 500 Global",
  "last_round_year": 2025,
  "employees_est": 70,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/elevarm/",
  "employees_note": (
    "LinkedIn lists 70 people on the company page, read 2026-08-30; its own size band says 51-200. "
    "Field agronomists are salaried and count; the farmers Elevarm serves are customers, not staff."),
  "investors": ["Intudo Ventures", "Insignia Ventures Partners", "500 Global"],
  "verify_note": (
    "TWO ADDRESSES, BOTH REAL: the Ministry of Law registry gives Menara Asia Afrika Lt. 9 in Kota "
    "Bandung as the registered office, and elevarm.com's own footer gives an operating office at "
    "Jl. Ir. H. Juanda No. 477A, Ciburial, Cimenyan, KABUPATEN Bandung. The filed address is used "
    "here and for the kota, the same rule the census applied to FTL Gym. An ITB Science and "
    "Technology Park spin-off; the US$4.25M figure is from Elevarm's own announcement, matched by "
    "DailySocial, Finsmes and Techverse."),
  "confidence": 0.88,
  "sources": [
    "https://elevarm.com/blog/berita/elevarm-bukukan-pendanaan-pra-seri-a-rp70-miliar-dari-intudo-insignia-dan-500-global",
    "https://news.dailysocial.id/post/pendanaan-pra-seri-a-agritech-elevarm/",
    "https://www.finsmes.com/2025/03/elevarm-raises-us4-25m-in-pre-series-a-funding.html",
    "https://companieshouse.id/elevasi-agri-indonesia",
    "https://dkst.itb.ac.id/elevarm-raih-pendanaan-pra-seri-a-us425-juta-alumni-startup-dkst-itb-terus-berinovasi-di-sektor-agritech/",
    "https://www.linkedin.com/company/elevarm/",
  ],
  "funding_src": "https://elevarm.com/blog/berita/elevarm-bukukan-pendanaan-pra-seri-a-rp70-miliar-dari-intudo-insignia-dan-500-global",
  "funding_src_tier": "announced",
 },
 {
  "name": "Prosa.ai", "id": "prosa-ai",
  "legal_name": "PT Prosa Solusi Cerdas",
  "sector": "AI — Indonesian-language natural-language processing, speech-to-text and voice biometrics",
  "in_dki": False,
  "hq_address": "Jl. Dr. Otten No. 10, Pasir Kaliki, Kec. Cicendo, Kota Bandung, Jawa Barat 40171",
  "kecamatan": "Cicendo", "kota": "Bandung",
  "url": "https://prosa.id",
  "funding_total_usd_m": None,
  "last_round": "Series A, Jun 2019 — led by GDP Venture, amount undisclosed",
  "last_round_year": 2019,
  "employees_est": None,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/prosa-ai/",
  "employees_note": (
    "NO PUBLISHABLE FIGURE. LinkedIn's page carries the size band 51-200 but no live people count, "
    "and a band midpoint is never published, so this row contributes no jobs and no output."),
  "investors": ["GDP Venture"],
  "verify_note": (
    "Founded 2018 by ITB researchers Dessi Puji Lestari and Ayu Purwarianti with a telecoms "
    "veteran; the Series A was announced by GDP Venture in June 2019 without a figure and none has "
    "been disclosed since. SITE MOVED: prosa.ai now returns a bare S3 NotFound at every path, "
    "while prosa.id serves the live site — the .ai domain looks abandoned rather than the company. "
    "Address from the entity's own agency-directory listing under its registered name."),
  "confidence": 0.62,
  "sources": [
    "https://teknologi.bisnis.com/read/20190620/266/935955/gdp-ventures-kucurkan-investasi-seri-a-ke-prosa.ai",
    "https://www.dealstreetasia.com/stories/prosa-gdp-venture-140868",
    "https://www.designrush.com/agency/profile/pt-prosa-solusi-cerdas",
    "https://www.linkedin.com/company/prosa-ai/",
    "https://prosa.id",
  ],
 },
 {
  "name": "OrderOnline.id", "id": "orderonline",
  "legal_name": "PT Ordivo Teknologi Indonesia",
  "sector": "SaaS — order management, COD checkout and business automation for online sellers",
  "in_dki": False,
  "hq_address": "Jl. Otto Iskandar Dinata No. 392, Kota Bandung, Jawa Barat",
  "kecamatan": None, "kota": "Bandung",
    "lat": -6.91361, "lon": 107.60463,
  "geocode_kind": "road",
  "geocode_src": "nominatim: Jalan Otto Iskandardinata, Pasirkaliki, Cicendo, Kota Bandung (street-level)",
 "url": "https://orderonline.id",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 31,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/ordivo/",
  "employees_note": (
    "LinkedIn's indexed profile states the company employs 31 people, read 2026-08-30; the size "
    "band on the OrderOnline.id page says 51-200, so read 31 as the floor of a 31-200 spread."),
  "investors": [],
  "verify_note": (
    "PT Ordivo Teknologi Indonesia and the Otto Iskandar Dinata 392 address are both from the "
    "Ministry of Law registry (companieshouse.id). Bootstrapped as far as the public record goes — "
    "no round has ever been announced. The company reports more than 19,000 MSME users and Rp 5.5 "
    "trillion of cumulative user transaction value since 2021; that is GTV, not revenue and not "
    "value added, and is carried here only as context."),
  "confidence": 0.72,
  "sources": [
    "https://companieshouse.id/ordivo-teknologi-indonesia",
    "https://www.linkedin.com/company/ordivo/",
    "https://mediaindonesia.com/ekonomi/517576/platform-berbasis-web-orderonlineid-mudahkan-umkm-otomatisasi-bisnis",
    "https://www.jabarnews.com/daerah/catat-transksi-rp330-miliar-ordivo-komitmen-bangun-ekosistem-bisnis-online/",
  ],
 },
 {
  "name": "Mayar", "id": "mayar",
  "legal_name": "PT Mayar Kernel Supernova",
  "sector": "fintech — no-code payment acceptance, commerce and spend management for MSMEs and creators",
  "in_dki": False,
  "hq_address": "Nextspace by UnionSPACE, Jl. Trunojoyo No. 11, Citarum, Kec. Bandung Wetan, Kota Bandung, Jawa Barat 40115",
  "kecamatan": "Bandung Wetan", "kota": "Bandung",
  "url": "https://mayar.id",
  "funding_total_usd_m": None,
  "last_round": "Undisclosed round, Sep 2022 — Resolution Ventures",
  "last_round_year": 2022,
  "employees_est": 34,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/mayarid/",
  "employees_note": (
    "LinkedIn lists 34 people on the company page, read 2026-08-30; its own size band says 11-50, "
    "which brackets the count."),
  "investors": ["BEENEXT", "Resolution Ventures"],
  "verify_note": (
    "The row Luca asked for. PT Mayar Kernel Supernova is confirmed twice over — the Ministry of "
    "Law registry gives the name and the Nextspace/Trunojoyo 11 address, and mayar.id's own /about "
    "prints the same address. NO AMOUNT IS PUBLISHED: the March 2021 pre-seed led by BEENEXT and "
    "the round Resolution Ventures announced in September 2022 were both closed without a figure, "
    "and Resolution's own post carries none. A Singapore entity, Mayar International Pte. Ltd. at "
    "160 Robinson Road, is listed alongside the Indonesian one on the same page; the Indonesian "
    "operation is what is counted."),
  "confidence": 0.85,
  "sources": [
    "https://mayar.id/about",
    "https://companieshouse.id/mayar-kernel-supernova",
    "https://www.resolution.ventures/mayar-closes-funding-round-to-expedite-the-digitalization-of-payments-processes-for-msmes-in-indonesia/",
    "https://www.linkedin.com/company/mayarid/",
    "https://magnitt.com/startups/mayar-id-74987",
  ],
 },
 {
  "name": "Digital Happiness", "id": "digital-happiness",
  "legal_name": "PT Digital Semantika Indonesia",
  "sector": "game studio — horror games, best known for the DreadOut series",
  "in_dki": False,
  "hq_address": "Jl. Anatomi No. 19, Cigadung, Kec. Cibeunying Kaler, Kota Bandung, Jawa Barat 40191",
  "kecamatan": "Cibeunying Kaler", "kota": "Bandung",
  "url": "https://www.digitalhappiness.net",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 16,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/dh-games/",
  "employees_note": (
    "LinkedIn lists 16 people on the company page, read 2026-08-30; its own size band says 11-50."),
  "investors": [],
  "verify_note": (
    "Entity and address are from the studio's own contact page. NO VENTURE ROUND: DreadOut was "
    "financed by an Indiegogo campaign that reached its US$25,000 target in 2013, and the sequel's "
    "reported development budget of about Rp 2.8bn is a production cost, not capital raised. "
    "Crowdfunding is not counted as funding on any row of this census. SITE CHECK: our liveness "
    "probe reads digitalhappiness.net as unreachable, which is a TLS chain the VM cannot verify "
    "and not evidence of anything — the studio shipped DreadOut 3 devlogs on Steam and ran its "
    "DHXP 2026 showcase in May 2026."),
  "confidence": 0.72,
  "sources": [
    "https://www.digitalhappiness.net/contact/",
    "https://www.linkedin.com/company/dh-games/",
    "https://hybrid.co.id/post/game-horror-dreadout-berhasil-mencapai-target-penggalangan-dana-di-indiegogo/",
    "https://katadata.co.id/berita/nasional/5e9a55776f93c/biaya-pengembangan-gim-horor-dreadout-2-lebih-rp-28-miliar",
  ],
 },
 {
  "name": "Own Games", "id": "own-games",
  "legal_name": None,
  "sector": "mobile game studio — casual simulation games, best known for Tahu Bulat",
  "in_dki": False,
  "hq_address": "Jl. Asia Afrika No. 133-137, Kota Bandung, Jawa Barat 40112",
  "kecamatan": "Sumur Bandung", "kota": "Bandung",
  "url": "https://own-games.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": None,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/own-games/",
  "employees_note": (
    "NO PUBLISHABLE FIGURE. The LinkedIn page carries the size band 11-50 but no live people "
    "count, and a band midpoint is never published, so this row contributes no jobs and no output."),
  "investors": [],
  "verify_note": (
    "Founded 2013 in Bandung by Eldwin Viriya; Tahu Bulat passed tens of millions of installs. The "
    "address is the developer address Own Games publishes on Google Play. THE LEGAL ENTITY IS NOT "
    "PUBLISHED: the studio's own site names no PT, and its LinkedIn page is wired to an unrelated "
    "entity (Oxane Partners Limited) — a LinkedIn data error, not a corporate fact, so the legal "
    "name is left blank rather than guessed."),
  "confidence": 0.55,
  "sources": [
    "https://own-games.com/",
    "https://play.google.com/store/apps/details?id=com.owngames.tahubulat",
    "https://id.wikipedia.org/wiki/Own_Games",
    "https://www.linkedin.com/company/own-games/",
  ],
 },
 {
  "name": "Nightspade", "id": "nightspade",
  "legal_name": "PT Nightspade Multikreasi",
  "sector": "game studio and interactive-media developer, work-for-hire and own titles",
  "in_dki": False,
  "hq_address": "Jl. Ligar Raya No. 40, Kota Bandung, Jawa Barat 40191",
  "kecamatan": "Cibeunying Kaler", "kota": "Bandung",
    "lat": -6.87824, "lon": 107.63424,
  "geocode_kind": "road",
  "geocode_src": "nominatim: Jalan Ligar Raya, Cimenyan (street-level)",
 "url": "https://www.nightspade.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 11,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/nightspade/",
  "employees_note": (
    "LinkedIn lists 11 people on the company page, read 2026-08-30; its own size band says 11-50."),
  "investors": [],
  "verify_note": (
    "Entity and address are the studio's own site footer and contact page. Founded 2011, one of "
    "the oldest studios in the Bandung games cluster; no funding round is on record. BOUNDARY "
    "NOTE: Jl. Ligar Raya runs along the Cigadung edge — the 40191 postcode is Kota Bandung's, "
    "but OSM files the road itself under Cimenyan, Kabupaten Bandung. The row is filed under Kota "
    "Bandung and the pin follows OSM's road, so the dot sits just outside the city line."),
  "confidence": 0.68,
  "sources": [
    "https://www.nightspade.com/",
    "https://www.linkedin.com/company/nightspade/",
  ],
 },
 {
  "name": "DyCode", "id": "dycode",
  "legal_name": "PT Dycode Cominfotech Development",
  "sector": "dev tools and IoT engineering — mobile, cloud and connected-device products",
  "in_dki": False,
  "hq_address": "Jl. Setrasari Kulon VII No. 3, Kota Bandung, Jawa Barat 40152",
  "kecamatan": "Sukasari", "kota": "Bandung",
    "lat": -6.87604, "lon": 107.58589,
  "geocode_kind": "road",
  "geocode_src": "nominatim: Jalan Setrasari Kulon, Sukarasa, Sukasari, Kota Bandung (street-level)",
 "url": "https://dycode.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 14,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/dycode/",
  "employees_note": (
    "LinkedIn lists 14 people on the PT Dycode Cominfotech Development page, read 2026-08-30, "
    "against a self-declared band of 51-200 — the band looks stale. A second page for the IoT "
    "spin-off DycodeX lists 2 more; they are not added, to avoid double-counting the same group."),
  "investors": [],
  "verify_note": (
    "Entity and address are DyCode's own site footer and contact page. The IoT arm DycodeX sought "
    "a Series A for its SMARTernak livestock product in 2018; no round was ever announced as "
    "closed, so no figure is published."),
  "confidence": 0.62,
  "sources": [
    "https://dycode.com/",
    "https://www.linkedin.com/company/dycode/",
    "https://hybrid.co.id/post/dycodex-cari-pendanaan-baru-seri-a-dan-scale-up-smarternak/",
  ],
 },
 {
  "name": "Alkademi", "id": "alkademi",
  "legal_name": "PT Raditya Alkademi Digital",
  "sector": "edtech — vocational digital-skills bootcamps and corporate training",
  "in_dki": False,
  "hq_address": "Jl. Golf Raya, Komp. Mulya Golf Residence No. B7, Kota Bandung, Jawa Barat",
  "kecamatan": None, "kota": "Bandung",
  "url": "https://alkademi.id",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 20,
  "employees_asof": TODAY,
  "employees_src": "https://id.linkedin.com/company/alkademi-idn",
  "employees_note": (
    "LinkedIn lists 20 people on the company page, read 2026-08-30, against a self-declared band "
    "of 2-10 — the band is stale and the live count is published."),
  "investors": [],
  "verify_note": (
    "PT Raditya Alkademi Digital and the Golf Raya address are from the Ministry of Law registry "
    "(companieshouse.id). NOT Arkademi: a similarly named Jakarta vocational-learning company "
    "backed by SOSV/Orbit Startups is a different business and is not this row."),
  "confidence": 0.6,
  "sources": [
    "https://companieshouse.id/raditya-alkademi-digital-1242011",
    "https://id.linkedin.com/company/alkademi-idn",
    "https://alkademi.id/",
  ],
 },
 {
  "name": "Duluin", "id": "duluin",
  "legal_name": "PT Rasa Aksata Nusantara",
  "sector": "SaaS — HR, attendance and employee-management platform for Indonesian SMEs",
  "in_dki": False,
  "hq_address": "Jl. Batununggal Indah Raya No. 365, Batununggal, Kec. Bandung Kidul, Kota Bandung, Jawa Barat 40266",
  "kecamatan": "Bandung Kidul", "kota": "Bandung",
    "lat": -6.95347, "lon": 107.62493,
  "geocode_kind": "road",
  "geocode_src": "nominatim: Jalan Batununggal Indah Raya, Batununggal, Bandung Kidul, Kota Bandung (street-level)",
 "url": "https://duluin.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": None,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/duluin/",
  "employees_note": (
    "NO PUBLISHABLE FIGURE. The LinkedIn page carries the size band 11-50 but no live people "
    "count, and a band midpoint is never published, so this row contributes no jobs and no output."),
  "investors": [],
  "verify_note": (
    "PT Rasa Aksata Nusantara and the Batununggal address are printed in duluin.com's own footer, "
    "and LinkedIn's HQ line says Bandung; the site also lists a Kelapa Gading, Jakarta Utara "
    "office, and the Bandung one is treated as the head office on the strength of the LinkedIn HQ "
    "field and the footer's ordering. No funding round is on record."),
  "confidence": 0.55,
  "sources": [
    "https://duluin.com/",
    "https://www.linkedin.com/company/duluin/",
  ],
 },
]

# ── who is deliberately NOT in the cohort ────────────────────────────
# Same accountability rule the YC and Endeavor lenses use: a Bandung company
# that a reader would expect to find is either counted above or listed here
# with the reason it is not.
SCOPE_OUT = [
 {"name": "eFishery", "owner": "PT Multidaya Teknologi Nusantara",
  "why": "Bandung's unicorn stopped operating in February 2025 after a forensic audit alleged "
         "roughly US$600M of inflated figures; management laid off about 90-98% of some 1,500 "
         "staff and the company is being wound up. It is a shutdown-register entry, not a live "
         "census row, and it is listed there"},
 {"name": "Halofina", "owner": "PT Akselerasi Edukasi Internasional",
  "why": "not excluded — queued: the app and halofina.com are up, but LinkedIn is down to 5 people "
         "from a declared band of 51-200, halofina.id returns a 503, there has been no company "
         "news since 2020 and it now appears in a startup-failure database. It joins the census, "
         "or the shutdown register, once the status is settled"},
 {"name": "Delegasi", "owner": "PT Delegasi Teknologi Indonesia (YC S22)",
  "why": "wound down around August 2025. Co-founder and CTO Ahmad Anshorimuslim "
         "Syuhada's own profile says he 'made the decision to wind down the company', and "
         "Y Combinator's directory marks the batch entry Inactive — the site and the LinkedIn "
         "page being up did not mean the company was. It is in the shutdown register"},
 {"name": "Prelo", "owner": "Bukalapak",
  "why": "acquired by Bukalapak in October 2018, and Bukalapak is already counted — a separate row "
         "would double-count the same staff (the TikTok Shop rule)"},
 {"name": "FirstSupport.ai", "owner": "independent (YC W21)",
  "why": "two people on LinkedIn and a site that has not resolved since Aug 2026 — it fails the "
         "liveness screen, not the geography test that used to exclude it"},
 {"name": "Kandang.in", "owner": "PT Kandang Karya Teknologi",
  "why": "entity unresolved: the LinkedIn page names PT Kandang Karya Teknologi in Bandung, a "
         "registry record of that name sits in Kota Malang, and a near-identical PT Karya Kandang "
         "(Ternakbisnis) Teknologi runs the crowdfunding platform. The US$4M attributed to it "
         "looks like money raised ON the platform rather than BY the company"},
 {"name": "Makerindo Prima Solusi", "owner": "PT Makerindo Prima Solusi",
  "why": "an IoT consultancy billing for delivery rather than a venture- or tech-built product "
         "company, and its two LinkedIn pages disagree on headcount (22 against 4)"},
 {"name": "Chatbiz.id", "owner": "PT Pemuda Inovasi Teknologi",
  "why": "three people on LinkedIn and a follower count in decline; the entity and the Ledeng "
         "address are real, but there is not enough of a company left to count"},
 {"name": "LSKK", "owner": "PT Langgeng Sejahtera Kreasi Komputasi",
  "why": "a systems house that wins government and defence tenders — real engineering, but "
         "contract-funded rather than tech- or venture-built; it fails the first test"},
 {"name": "Bandros", "owner": "Kota Bandung / UPT Angkutan",
  "why": "the Bandung Tour on Bus is a municipal tourism service, not a startup; the LinkedIn page "
         "of that name belongs to it"},
 {"name": "Bandung software houses",
  "owner": "Arkamaya, Lancartech, Techcompid, Sejadi and others",
  "why": "fee-for-service development agencies. They are excluded for the same reason ReFIT is: "
         "sold as services, not built by tech or venture money"},
]

# yc_outside rows whose stated reason was the old Greater-Jakarta boundary and
# is now wrong. Both stay out — but for reasons that survive the scope change
# instead of a geography test the census no longer applies.
YC_OUTSIDE_FIX = {
 "Delegasi": {
   # full record, because an earlier run of this script DELETED the yc_outside
   # row on the assumption Delegasi was joining the census. It is not, so the
   # row has to be restorable from here rather than from a backup.
   "name": "Delegasi",
   "yc_batch": "S22",
   "url": "https://delegasi.co/",
   "city": "Bandung, West Java",
   "reason": "No longer operating",
   "note": "PT Delegasi Teknologi Indonesia, Bandung. Bandung is inside the census as of 30 Aug "
           "2026, so the old 'outside Greater Jakarta' reason no longer applies — this row is out "
           "because the company wound down around August 2025, on its co-founder and CTO's own "
           "account, and YC marks the entry Inactive. US$125K, the YC standard deal, is all that "
           "was ever disclosed.",
 },
 "FirstSupport.ai": {
   "reason": "No longer operating",
   "note": "PT unpublished. Unfunded, two people on LinkedIn, and firstsupport.ai has not resolved "
           "since Aug 2026. Bandung is inside the census as of 30 Aug 2026, so the old 'outside "
           "Greater Jakarta' reason no longer applies — this row fails the liveness screen instead.",
 },
}


# ids this batch has RETRACTED. Listing them is what makes the script a repair
# path rather than a one-way door: a re-run after a cross-session clobber must
# not quietly resurrect a company the liveness screen threw out.
RETRACTED = ['delegasi']


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    before = len(raw['companies'])
    raw['companies'] = [c for c in raw['companies'] if c.get('id') not in RETRACTED]
    if len(raw['companies']) != before:
        print(f"retracted {before - len(raw['companies'])} row(s): {', '.join(RETRACTED)}")
    by = {c.get('id'): c for c in raw['companies']}
    added = updated = 0
    for row in ROWS:
        cur = by.get(row['id'])
        if cur is None:
            raw['companies'].append(dict(row))
            added += 1
            print(f"added   {row['id']:18s} {row['name']}")
        else:
            cur.update(dict(row))
            updated += 1
            print(f"updated {row['id']:18s} {row['name']}")

    # scope register — replace this script's own entries, leave the rest alone
    scope = raw.setdefault('scope', {}).setdefault('outside', [])
    mine = {e['name'] for e in SCOPE_OUT}
    raw['scope']['outside'] = [e for e in scope if e.get('name') not in mine] + SCOPE_OUT
    # Nationwide since 28 Sep 2026 (scripts/census-national.py owns the rule): a
    # repair re-run must not put the Jakarta+Bandung text back.
    if not raw['scope'].get('nationwide_added'):
        raw['scope']['rule'] = (
            "A company is counted when it was built or bought by tech or venture money rather than run "
            "as an incumbent's product line, when it is its own legal entity, and when a headcount can "
            "be sourced. All three have to hold. Geography: Greater Jakarta and, since 30 Aug 2026, "
            "the Bandung basin — Kota Bandung, Kota Cimahi, Kabupaten Bandung and Kabupaten Bandung "
            "Barat. Everywhere else in Indonesia is still outside.")
    raw['scope']['bandung_added'] = TODAY

    yc = raw.get('yc_outside') or []
    out = []
    for e in yc:
        fix = YC_OUTSIDE_FIX.get(e.get('name'), 'keep')
        if fix == 'keep':
            out.append(e)
        elif fix is None:
            print(f"yc_outside: removed {e['name']} — now counted")
        else:
            e.update(fix); out.append(e)
            print(f"yc_outside: reason updated for {e['name']}")
    have = {e.get('name') for e in out}
    for name, fix in YC_OUTSIDE_FIX.items():
        if fix and name not in have and fix.get('name'):
            out.append(dict(fix))
            print(f"yc_outside: restored {name}")
    raw['yc_outside'] = out

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)
    print(f"{added} added, {updated} updated -> {len(raw['companies'])} companies")


if __name__ == '__main__':
    main()
