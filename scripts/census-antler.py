#!/usr/bin/env python3
"""ANTLER LENS — the Antler-funded Indonesian cohort (Aug 30 2026).

Luca: "try to search antler granted/funded startup, i know like intura.co spun
etc that got $125k ticket funding, try to check them all."

Antler opened in Indonesia in Nov 2021 (Jakarta residencies ID1…ID8+, first
checks US$110-125K in 2022-2024, US$85K + up to US$250K match from ~2025) and
made ~24 investments in 2022 and ~25 in each of 2023 and 2024. The roster below
is built from Antler's own portfolio directory (all 21 pages, Indonesia tag),
its location page and careers board, its demo-day videos, and the three batch
announcements the press carried (Jun 2023, Nov 2023, Jan 2024) — 63 evidenced
companies. Names claimed as Antler but unevidenced (TransTRACK, Amoda, FishLog,
Baskit, Sribuu, Mindtera, Bicarakan.id…) were checked and are NOT tagged: their
cap tables trace to other funds.

Same accountability idiom as the YC and Endeavor lenses: every roster company
is either COUNTED in the census (tagged `antler`), listed in `antler_pending`
("on the roster, not yet in the census" — visible, not hidden), or listed in
`antler_outside` with the reason it will not be counted. A census row still has
to pass the census's own three tests; an Antler check alone does not create a
row, which is why most of the roster (pre-seed, 1-20 people) starts in pending.

One known coverage gap, stated rather than hidden: the funded batch of cohort
ID2 (late 2022, roughly 9-12 names) was never announced anywhere the sweep
could find, and Antler's directory no longer lists companies that died early —
the roster is a floor, not a ceiling. The Wayback Machine rate-limited every
probe this session; an archived 2023 portfolio snapshot is the recovery path.

Idempotent: re-running restores exactly the tags, registers and roster file
this script owns (the repair path after a cross-session clobber) and touches
nothing else. Scope-register entries merge BY NAME; scope['rule'] is never
reassigned.

    python3 scripts/census-antler.py && node scripts/build-census.js
"""
import json, os, tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
ROSTER_OUT = os.path.join(ROOT, 'data', 'antler-roster.json')
TODAY = '2026-08-30'

SOURCE = {
    "checked": TODAY,
    "url": "https://www.antler.co/portfolio",
    "roster_count": 63,
    "note": (
        "Antler's own directory (21 pages, Indonesia tag) + location page + careers board + "
        "official demo-day videos + the Jun 2023 / Nov 2023 / Jan 2024 batch announcements. "
        "First checks ran US$110-125K in 2022-2024; the current standard is US$85K for 10% via "
        "SAFE with up to US$250K follow-on match. Cohort ID2's funded batch (late 2022, ~9-12 "
        "names) was never published and early deaths drop off Antler's directory, so the roster "
        "is a floor."),
}

# ── census rows that carry the antler tag ────────────────────────────
# pinned name -> census id, the census-endeavor.py idiom: fails loudly on a
# rename rather than fuzzy-matching. Extended by the verified-row batches below.
ANTLER_IN = {
    'staffinc': {
        'antler_year': 2019,
        'antler_note': "Antler Singapore's first Jakarta bet — co-founder Wisnu Nugrahadi: "
                       "'Antler was our first investor' (as Sampingan, 2019).",
    },
    'brick': {
        'antler_year': 2021,
        'antler_note': "Seed from Antler and 1982 Ventures, Mar 2021, before the US$8.5M "
                       "seed round of Feb 2022.",
    },
    'intura': {'antler_year': 2025,
               'antler_note': "Antler ID8 residency (Feb-Apr 2025) pre-seed, amount undisclosed — "
                              "the company Luca named."},
    'base': {'antler_year': 2019,
             'antler_note': "Founders came out of Antler's second Singapore cohort (2019); Antler "
                            "held through the US$6M Rakuten-led Series A of Nov 2022."},
    'lister': {'antler_year': 2022,
               'antler_note': "CEO, Apr 2022: 'Lister got our first funding from Antler!' — amount "
                              "undisclosed; Accelerating Asia Cohort 8 followed in 2023."},
    'gapai': {'antler_year': 2022,
              'antler_note': "2022 residency check (as Academix, later pivoted to Gapai); Antler "
                             "repeated in the US$1M Wavemaker-led seed of May 2024."},
    'dash-electric': {'antler_year': 2024,
                      'antler_note': "One of six in Antler's Jan 2024 US$750K Indonesian batch; "
                                     "Antler returned in the Radical Fund-led seed of Nov 2024."},
    'spun': {'antler_year': 2024,
             'antler_note': "One of six in Antler's Jan 2024 US$750K Indonesian batch; Antler "
                            "participated in the US$1.8M Genesia-led seed of Jan 2026."},
    'healthpro': {'antler_year': 2022,
                  'antler_note': "2022 residency check, amount undisclosed; Accelerating Asia "
                                 "Cohort 7 followed in Nov 2022."},
    'carenow': {'antler_year': 2022,
                'antler_note': "2022 residency cohort (tracker-attributed; no Antler announcement "
                               "names it); Iterative W23 followed in Feb 2023."},
    'qalboo': {'antler_year': 2022,
               'antler_note': "Antler + Iterative pre-seed, announced Oct 2022, amount "
                              "undisclosed."},
    'trucarbon': {'antler_year': 2022,
                  'antler_note': "Antler pre-seed as TruClimate, late 2022, amount undisclosed "
                                 "(trackers model US$100K); rebranded TruCarbon in 2024."},
    'matchmade': {'antler_year': 2023,
                  'antler_note': "US$125K in Antler's Jun 2023 SEA batch, then a US$1.5M pre-seed "
                                 "led by Vertex Ventures SEA & India in Oct 2023."},
    'arkopay': {'antler_year': 2023,
                'antler_note': "US$125K in Antler's Jun 2023 SEA batch (as ARKO); won CNA's The "
                               "Big Spark in Mar 2024 (S$405K committed)."},
    'assetfindr': {'antler_year': 2024,
                   'antler_note': "US$125K — named first in Antler's own Jan 2024 six-startup "
                                  "US$750K Indonesian batch announcement."},
    'cavos': {'antler_year': 2024,
              'antler_note': "Founder joined Antler's ID6 cohort in Feb 2024 (check amount is "
                             "tracker-only); Tenity invested May 2025."},
}

# ── the verified rows (deep-verified 2026-08-30, two research passes) ─
# Same bar as every other census row. Sector strings are worded for their
# SECTOR_KEYS bucket (first-match-wins — no stray 'enterprise'/'b2b'/'bank').
ROWS = [
 {
  "name": "Intura", "id": "intura",
  "legal_name": "PT Kelinci Teknologi Kreatif",
  "sector": "AI search optimization — audits and strategy so ChatGPT, Gemini, Perplexity and Google AI Overviews surface a brand (GEO/AEO)",
  "in_dki": True,
  "hq_address": "Gedung Wirausaha Lt. 1 Unit 104, Jl. HR Rasuna Said Kav. C-5, Karet, Kec. Setiabudi, Jakarta Selatan 12920",
  "kecamatan": "Setiabudi", "kota": "Jakarta Selatan",
  "lat": -6.21386, "lon": 106.83121,
  "geocode_kind": "building", "geocode_src": "photon: Gedung Wirausaha, Setiabudi (building-level)",
  "url": "https://intura.co",
  "funding_total_usd_m": None,
  "last_round": "Pre-seed, 2025 — Antler (ID8 residency), amount undisclosed",
  "last_round_year": 2025,
  "employees_est": 3, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/inturaco",
  "employees_note": "LinkedIn lists 3 people on the company page, read 2026-08-30; its own size band says 2-10, which brackets the count. A months-old pre-seed company — small is the normal state.",
  "investors": ["Antler"],
  "verify_note": ("THE COMPANY LUCA NAMED. Dual structure per its own terms page: Intura Pte. Ltd. "
    "(Singapore) + PT Kelinci Teknologi Kreatif (Indonesia), with the Jakarta office at Gedung "
    "Wirausaha on Rasuna Said — counted at the Indonesian operation, the Qiscus treatment. Built "
    "inside Antler's ID8 residency (Feb-Apr 2025) by two ex-Kredivo product/ML leads — Najwa "
    "Assilmi (CEO) and Muhammad Ramadiansyah (CTO). NO AMOUNT IS PUBLISHED for the Antler "
    "pre-seed; the US$125K on trackers is the standard-check assumption, not an announcement. "
    "PIVOTED: launched Mar 2025 as an LLM experimentation/comparison platform (Product Hunt #9 of "
    "the day; open-source intura-ai SDK), now sells AI-search-visibility audits — the sector line "
    "reflects what it is today. Operating: terms updated Jun 2026, keyword studies publishing, "
    "LinkedIn active a month before the read."),
  "confidence": 0.7,
  "sources": [
    "https://intura.co/en/terms",
    "https://intura.co/en/news/antler-id8-entrepreneur-residency-pre-seed-jakarta-2025",
    "https://www.linkedin.com/company/inturaco",
    "https://intura.co/en/about",
    "https://www.producthunt.com/products/intura",
  ],
 },
 {
  "name": "BASE", "id": "base",
  "legal_name": "PT Basis Inovasi Global",
  "sector": "d2c consumer brand — vegan skincare, makeup and personal care",
  "in_dki": True,
  "hq_address": None,
  "kecamatan": None, "kota": "Jakarta Selatan",
  "url": "https://base.co.id",
  "funding_total_usd_m": 6.0,
  "last_round": "Series A, Nov 2022 — US$6M led by Rakuten Ventures",
  "last_round_year": 2022,
  "employees_est": 29, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/baseid",
  "employees_note": ("LinkedIn lists 29 people on the company page, read 2026-08-30, against a "
    "self-declared band of 51-200 — the band is stale-high, and Exa's workforce record models 20 "
    "with a -48.5% year-on-year contraction. Read the figure as a shrunken 20-29."),
  "investors": ["Rakuten Ventures", "East Ventures", "Skystar Capital", "Pegasus Tech Ventures",
                "Antler", "iSeed SEA", "XA Network"],
  "verify_note": ("Founded 2019 by Yaumi Fauziah Sugiharta (ex-Gojek marketing head) and Ratih "
    "Permata Sari; the founders came out of Antler's second Singapore cohort and Antler held "
    "through three rounds. Funding is the ANNOUNCED sum: the 2019 seed (East Ventures + Skystar) "
    "and 2021 pre-Series A were undisclosed, the Nov 2022 Series A was US$6M led by Rakuten "
    "Ventures — trackers' US$7.4M/US$6.1M totals are models, not announcements. THE OLD DOMAIN IS "
    "LOST: itsmybase.com is a NameCheap parking page (re-registered Jul 2024) — the store lives "
    "at base.co.id and the social handles stay @itsmybase; the census URL is the live store. NO "
    "STREET ADDRESS is published anywhere — LinkedIn says Jakarta Selatan 12230, so the row is "
    "filed there and left unlocated. The legal name PT Basis Inovasi Global rests on employee "
    "profiles and vendor records, not a primary filing — medium confidence. Trading (Tokopedia "
    "store 104rb+ sold, catalog live) but visibly contracted."),
  "confidence": 0.6,
  "sources": [
    "https://technode.global/2022/11/08/indonesian-dtc-beauty-and-wellness-base-lands-6m-series-a-round-led-by-rakuten-ventures/",
    "https://hybrid.co.id/post/pendanaan-awal-base/",
    "https://www.linkedin.com/company/baseid",
    "https://base.co.id/id/our-story",
    "https://www.tokopedia.com/itsmybase",
  ],
  "funding_src": "https://technode.global/2022/11/08/indonesian-dtc-beauty-and-wellness-base-lands-6m-series-a-round-led-by-rakuten-ventures/",
  "funding_src_tier": "announced",
 },
 {
  "name": "Lister", "id": "lister",
  "legal_name": "PT Lister Teknologi Edukasi",
  "sector": "edtech — live language coaching and IELTS/TOEFL test prep for individuals and corporate training",
  "in_dki": True,
  "hq_address": "Grand Slipi Tower Lt. 5 Unit E-F, Jl. Letjen S. Parman Kav. 22-24, Palmerah, Kec. Palmerah, Jakarta Barat 11480",
  "kecamatan": "Palmerah", "kota": "Jakarta Barat",
  "lat": -6.20079, "lon": 106.79852,
  "geocode_kind": "building", "geocode_src": "photon: Grand Slipi Tower, Palmerah (building-level)",
  "url": "https://lister.co.id",
  "funding_total_usd_m": None,
  "last_round": "Accelerating Asia Cohort 8, Jun 2023 — amount undisclosed (first funding: Antler, Apr 2022)",
  "last_round_year": 2023,
  "employees_est": 142, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/listercoid",
  "employees_note": ("LinkedIn lists 142 people on the company page, read 2026-08-30; its own size "
    "band of 201-500 sits above the count and Exa's workforce record models 120 (-15% YoY) — read "
    "142 as the live count of a coaching marketplace whose tutors blur the payroll line."),
  "investors": ["Antler", "Accelerating Asia"],
  "verify_note": ("PT Lister Teknologi Edukasi with a Singapore 'global head office' (68 Circular "
    "Road — a registration address) per its own footer; the whole operation is the Grand Slipi "
    "Tower office. Founded 2020 by Sigit Arifianto, an ex-Indonesia-Mengajar teacher who was an "
    "Antler Entrepreneur in Residence; his own Apr 2022 post announced 'Lister got our first "
    "funding from Antler'. NO ROUND HAS EVER CARRIED AN AMOUNT — Antler 2022 and Accelerating "
    "Asia Cohort 8 (2023) were both undisclosed, and the US$100K on trackers is a model. 300+ "
    "corporate clients claimed; promo running on the live site at the read date."),
  "confidence": 0.75,
  "sources": [
    "https://lister.co.id/",
    "https://www.linkedin.com/posts/sigitarifian_listercoid-antlerindonesia-startupjourney-activity-6924598795297054720-tzLp",
    "https://www.acceleratingasia.com/latest-news/accelerating-asia-cohort-eight",
    "https://www.linkedin.com/company/listercoid",
  ],
 },
 {
  "name": "Gapai", "id": "gapai",
  "legal_name": "PT Akademi Indonesia Cerdas",
  "sector": "talent — overseas job placement platform for Indonesian migrant workers, with training and administrative support",
  "in_dki": True,
  "hq_address": "Jl. Kemang Utara No. 26B Unit 3, Bangka, Kec. Mampang Prapatan, Jakarta Selatan 12730",
  "kecamatan": "Mampang Prapatan", "kota": "Jakarta Selatan",
  "lat": -6.25709, "lon": 106.81771,
  "geocode_kind": "road", "geocode_src": "photon: Jalan Kemang Utara, Mampang Prapatan (street-level)",
  "url": "https://gapai.id",
  "funding_total_usd_m": 1.0,
  "last_round": "Seed, May 2024 — US$1M led by Wavemaker Partners, Antler repeating",
  "last_round_year": 2024,
  "employees_est": 34, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/gapai",
  "employees_note": ("LinkedIn lists 34 people on the company page, read 2026-08-30; its own size "
    "band says 11-50, which brackets the count. Exa's workforce record models 19 — a >40% spread, "
    "so read the figure as a 19-34 band. The workers Gapai places are candidates, not staff, and "
    "are not counted."),
  "investors": ["Wavemaker Partners", "Antler"],
  "verify_note": ("PT Akademi Indonesia Cerdas (registry no. 1255248) — established 25 May 2022 as "
    "the Academix school-LMS edtech from Antler's first Jakarta residency, pivoted into Gapai, the "
    "overseas-placement platform; LinkedIn's 'since 2021' predates the PT and the row uses 2022. "
    "Registered at Gedung Jaya on MH Thamrin, operating from Kemang Utara (own footer) — the "
    "operating office is pinned. The US$1M seed of May 2024 was led by Wavemaker with Antler as a "
    "repeat investor per Wavemaker's own release (Fortune Indonesia wrote it as co-led). "
    "LICENSING POSTURE, stated plainly: Gapai is NOT itself a licensed P3MI placement company — "
    "its own terms define it as the technology platform supporting licensed P3MI partners, so "
    "placement compliance rides on those partners. Active: SusHi Tech Tokyo delegation, Saudi "
    "nurse-placement hiring, posts a month before the read; clients named include Dulsco, SSP, "
    "Rixos and Aramco facilities work."),
  "confidence": 0.8,
  "sources": [
    "https://gapai.id/tentang-gapai",
    "https://companieshouse.id/akademi-indonesia-cerdas-1255248",
    "https://wavemaker.vc/gapai-secures-1-million-in-seed-funding-to-empower-indonesian-migrant-workers/",
    "https://www.antaranews.com/berita/4098222/gapai-dapat-suntikan-dana-awal-rp16-miliar-untuk-memperluas-layanan",
    "https://www.linkedin.com/company/gapai",
  ],
  "funding_src": "https://wavemaker.vc/gapai-secures-1-million-in-seed-funding-to-empower-indonesian-migrant-workers/",
  "funding_src_tier": "announced",
 },
 {
  "name": "Dash Electric", "id": "dash-electric",
  "legal_name": "PT Dash Platform Indonesia",
  "sector": "logistics — EV-native last-mile delivery fleet and managed frontline-workforce operations",
  "in_dki": True,
  "hq_address": "One Pacific Place Lt. 15, SCBD, Jl. Jend. Sudirman Kav. 52-53, Senayan, Kec. Kebayoran Baru, Jakarta Selatan 12190",
  "kecamatan": "Kebayoran Baru", "kota": "Jakarta Selatan",
  "lat": -6.22477, "lon": 106.80985,
  "geocode_kind": "building", "geocode_src": "same building as the pasarpolis row (One Pacific Place, SCBD)",
  "url": "https://www.dashelectric.co",
  "funding_total_usd_m": None,
  "last_round": "Seed extension, Jan 2026 — SAGANA joined the Nov 2024 seed led by The Radical Fund; no amount ever disclosed",
  "last_round_year": 2026,
  "employees_est": 103, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/dash-electric",
  "employees_note": ("LinkedIn lists 103 people on the company page, read 2026-08-30, against a "
    "self-declared band of 11-50 that is badly stale (Exa's record models 68, +137% YoY — a fast "
    "grower). The count is office and ops staff: the ~2,900 drivers Dash manages for clients are "
    "a MIX of freelance day-rate riders and full-time couriers embedded at client operations "
    "(McDonald's, Astro, Indomaret, Lazada) and are not counted, per the census's partner rule."),
  "investors": ["The Radical Fund", "Bali Investment Club", "Schneider Electric Energy Access Asia",
                "Aksara Ventures", "Kevin Aluwi", "Antler", "SAGANA"],
  "verify_note": ("PT Dash Platform Indonesia per its own footer and the registry (job boards' 'PT "
    "Dash Electric Indonesia' is informal usage). Founded 2023 by Aditya Brahmana (8 years Gojek) "
    "and Robert Mulianto (DHL, Tokopedia); one of six startups in Antler's Jan 2024 US$750K "
    "Indonesian batch, then an oversubscribed seed in Nov 2024 led by The Radical Fund with Kevin "
    "Aluwi and Schneider Electric's energy-access arm, and a SAGANA extension in Jan 2026 — NO "
    "ROUND HAS EVER CARRIED AN AMOUNT, so the funding cell is a dash over three real rounds. "
    "Positioning widened through 2025-26 from EV last-mile into a frontline-workforce operating "
    "platform; the EV fleet (2,560 self-reported) stays core. Homepage metrics (7,204 workers "
    "hired, IDR 826bn GMV) are self-reported and carried only as context."),
  "confidence": 0.75,
  "sources": [
    "https://www.dashelectric.co/",
    "https://www.antler.co/blog/antler-backs-6-startups-with-750-000-pre-seed-funding-in-indonesia",
    "https://technode.global/2024/11/06/indonesias-dash-electric-secures-seed-funding-to-scale-ev-as-a-service-across-indonesia/",
    "https://www.dashelectric.co/newsroom/news/sagana-joins-dash-electric-seed-round",
    "https://www.linkedin.com/company/dash-electric",
  ],
 },
 {
  "name": "SPUN", "id": "spun",
  "legal_name": "PT Solutopia Untuk Nusantara",
  "sector": "travel — visa and permit application platform for travelers and travel agents, automated end to end",
  "in_dki": True,
  "hq_address": "Jl. Sampit IV No. 8, Kramat Pela, Kec. Kebayoran Baru, Jakarta Selatan 12130",
  "kecamatan": "Kebayoran Baru", "kota": "Jakarta Selatan",
  "lat": -6.24499, "lon": 106.79663,
  "geocode_kind": "road", "geocode_src": "photon: Jalan Sampit IV, Kebayoran Baru (street-level)",
  "url": "https://spun.global",
  "funding_total_usd_m": 1.8,
  "last_round": "Seed, Jan 2026 — US$1.8M round total, led by Genesia Ventures",
  "last_round_year": 2026,
  "employees_est": 51, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/spunteam",
  "employees_note": ("LinkedIn lists 51 people on the company page, read 2026-08-30, just above "
    "its own 11-50 band; Exa's workforce record models 41 (+86% YoY) — a fast grower either way."),
  "investors": ["Genesia Ventures", "Antler", "Spiral Ventures", "Iterative", "Kopital Ventures"],
  "verify_note": ("PT Solutopia Untuk Nusantara, NIB 1012230036226, licensed under KBLI 79111 "
    "(travel agency) — the right regime for visa services — and registered at MTH Square (registry "
    "no. 1696381) while operating from the pinned Kebayoran Baru office, per its own footer. "
    "Founded 2024 out of Antler's Oct-Dec 2023 residency by Christa Sabathaly (ex-Google) and "
    "Dilla Anindita (ex-Cookpad, Grab); one of six in the Jan 2024 US$750K Antler batch. The Jan "
    "2026 seed is stated as a US$1.8M ROUND TOTAL led by Genesia Ventures — the Antler pool is "
    "not added on top. Very active: TechNode reports 99% approval, 300+ visa types, embedded in "
    "Klook, Traveloka, tiket.com and Nusatrip; engineering blog launched Feb 2026."),
  "confidence": 0.85,
  "sources": [
    "https://spun.global/en",
    "https://companieshouse.id/solutopia-untuk-nusantara",
    "https://technode.global/2026/01/19/indonesias-spun-raises-1-8m-seed-funding-to-expand-ai-enabled-visa-infrastructure-across-southeast-asia/",
    "https://www.antler.co/blog/antler-backs-6-startups-with-750-000-pre-seed-funding-in-indonesia",
    "https://www.linkedin.com/company/spunteam",
  ],
  "funding_src": "https://technode.global/2026/01/19/indonesias-spun-raises-1-8m-seed-funding-to-expand-ai-enabled-visa-infrastructure-across-southeast-asia/",
  "funding_src_tier": "announced",
 },
 {
  "name": "HealthPro", "id": "healthpro",
  "legal_name": "PT Inti Buana Kesehatan Nawasena",
  "sector": "healthtech — on-demand staffing of nurses and healthcare workers for hospitals, clinics and labs",
  "in_dki": True,
  "hq_address": "Sahid Sudirman Center Lt. 56, Jl. Jend. Sudirman No. 86, Karet Tengsin, Kec. Tanah Abang, Jakarta Pusat 10220",
  "kecamatan": "Tanah Abang", "kota": "Jakarta Pusat",
  "lat": -6.21115, "lon": 106.81801,
  "geocode_kind": "street", "geocode_src": "photon: Sahid Sudirman Center (complex, street-level)",
  "url": "https://www.healthpro.id",
  "funding_total_usd_m": None,
  "last_round": "Accelerating Asia Cohort 7, Nov 2022 — amount undisclosed (pre-seed: Antler, 2022)",
  "last_round_year": 2022,
  "employees_est": 26, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/healthproid",
  "employees_note": ("LinkedIn lists 26 people on the company page, read 2026-08-30; its own size "
    "band says 11-50, which brackets the count. The 10,000+ healthcare professionals on the "
    "platform are placed workers, not staff, and are not counted."),
  "investors": ["Antler", "Accelerating Asia"],
  "verify_note": ("PT Inti Buana Kesehatan Nawasena (registry no. 1253211), registered through a "
    "CEO Suite serviced office at Sahid Sudirman Center — the filed address is pinned, and "
    "LinkedIn's operational location is an unnumbered Jakarta Selatan 12750. Founded 2021 by "
    "Rendy Alfuadi and nurse co-founder Vika Rachma Sari (Antler's board says 2022, LinkedIn "
    "2023 — the earliest sourced year is used). NO ROUND HAS AN AMOUNT: Antler 2022 and "
    "Accelerating Asia Cohort 7 were undisclosed; trackers model US$100-200K. Operating: pitched "
    "the OIC Youth Entrepreneurship Conference main stage in Istanbul, Jun 2026; 32,000+ "
    "deployments claimed as of mid-2025."),
  "confidence": 0.7,
  "sources": [
    "https://companieshouse.id/inti-buana-kesehatan-nawasena",
    "https://www.acceleratingasia.com/latest-news/accelerating-asia-cohort-seven",
    "https://hasan.vc/how-healthpro-id-is-redefining-on-demand-healthcare-staffing-in-indonesia/",
    "https://www.linkedin.com/company/healthproid",
  ],
 },
 {
  "name": "CareNow", "id": "carenow",
  "legal_name": "PT Carenow Indonesia Sejahtera",
  "sector": "fintech — patient installment payments for medical treatment, over a licensed lending partner",
  "in_dki": True,
  "hq_address": "Jl. Bangka Raya No. 42A, Pela Mampang, Kec. Mampang Prapatan, Jakarta Selatan 12720",
  "kecamatan": "Mampang Prapatan", "kota": "Jakarta Selatan",
  "lat": -6.23955, "lon": 106.81819,
  "geocode_kind": "road", "geocode_src": "photon: Jalan Bangka Raya, Mampang Prapatan (street-level)",
  "url": "https://www.carenow.id",
  "funding_total_usd_m": None,
  "last_round": "Iterative Winter 2023 batch, Feb 2023 — amount undisclosed",
  "last_round_year": 2023,
  "employees_est": 12, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/carenow-indonesia",
  "employees_note": ("LinkedIn lists 12 people on the company page, read 2026-08-30; its own size "
    "band says 11-50."),
  "investors": ["Antler", "Iterative"],
  "verify_note": ("PT Carenow Indonesia Sejahtera per its own terms page; the Bangka Raya address "
    "is the site footer's. OJK POSTURE, stated plainly: CareNow is the technology layer, NOT the "
    "lender — its own footer says the installments run through PT Digital Micro Indonesia "
    "(DanaBijak), whose LPBBTI licence KEP-92/D.05/2021 was verified in OJK's 13 Feb 2026 "
    "directory (row 86); CareNow itself claims no licence. THE DOUBTS, stated: founder-CEO Dr. "
    "Stefanie Juergens has left (her profile now leads with Apotek Super), the Singapore arm "
    "CareNow SEA Pte. Ltd. is struck off while still shown in the footer, the company LinkedIn "
    "has been quiet for ~11 months, and no round has ever carried an amount (trackers model "
    "US$150-250K). Still trading: the site sells 0% 2-3x installments across a claimed 1,000+ "
    "clinics, the Android app is live, and the blog ran a promo in Aug 2025."),
  "confidence": 0.55,
  "sources": [
    "https://www.carenow.id/terms",
    "https://www.carenow.id/",
    "https://iterative.vc/post/meet-the-iterative-winter-2023-batch",
    "https://ojk.go.id/id/kanal/iknb/data-dan-statistik/direktori/fintech/Documents/Direktori%20LPBBTI%2013%20Februari%202026.pdf",
    "https://www.linkedin.com/company/carenow-indonesia",
  ],
 },
 {
  "name": "Qalboo", "id": "qalboo",
  "legal_name": "PT Qalboo Teknologi Berkah",
  "sector": "mental health — Islamic counseling, psychological assessment and wellbeing platform",
  "in_dki": True,
  "hq_address": "Bellezza Shopping Arcade, Jl. Letjen Soepeno (Permata Hijau) No. 106, Grogol Utara, Kec. Kebayoran Lama, Jakarta Selatan 12210",
  "kecamatan": "Kebayoran Lama", "kota": "Jakarta Selatan",
  "lat": -6.22168, "lon": 106.78247,
  "geocode_kind": "building", "geocode_src": "photon: The Bellezza, Permata Hijau (building-level)",
  "url": "https://www.qalboo.app",
  "funding_total_usd_m": None,
  "last_round": "Pre-seed, Oct 2022 — Antler + Iterative, amount undisclosed",
  "last_round_year": 2022,
  "employees_est": None, "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/qalboo",
  "employees_note": ("NO PUBLISHABLE FIGURE. LinkedIn shows 23 people but the company's own "
    "declared size band is 2-10 — the page collects associated clinical psychologists alongside "
    "staff, the Dicoding shape. The company's own statement outranks the page count and a band "
    "midpoint is never published, so the row carries a dash and contributes no jobs and no "
    "output until Qalboo states a payroll figure."),
  "investors": ["Antler", "Iterative"],
  "verify_note": ("PT Qalboo Teknologi Berkah (registry no. 1254124), registered at the Bellezza "
    "arcade on Permata Hijau, which matches its own site footer; an offline counseling location "
    "runs on Jl. Ciputat Raya. Founded 2022 by Windy Dhaliana (ex-Sayurbox); the Antler + "
    "Iterative pre-seed was announced by Tech in Asia in Oct 2022 without an amount. The domain "
    "moved from qalboo.com to qalboo.app. Low-signal but transactable: individual/couples/child "
    "counseling, psych tests and corporate programs are bookable on the live site, while the "
    "blog has been quiet since Apr 2025 and no events are listed."),
  "confidence": 0.6,
  "sources": [
    "https://companieshouse.id/qalboo-teknologi-berkah-1254124",
    "https://www.qalboo.app/",
    "https://www.techinasia.com/exclusive-antler-iterative-backs-preseed-indonesias-mental-health-app-muslims",
    "https://www.linkedin.com/company/qalboo",
  ],
 },
 {
  "name": "TruCarbon (ex TruClimate)", "id": "trucarbon",
  "legal_name": "PT Solusi Transisi Iklim",
  "sector": "carbon management — GHG accounting (TruCount), digital MRV and decarbonization projects",
  "in_dki": True,
  "hq_address": "Citylofts Sudirman #08-817, Jl. K.H. Mas Mansyur Kav. 121, Karet Tengsin, Kec. Tanah Abang, Jakarta Pusat 10220",
  "kecamatan": "Tanah Abang", "kota": "Jakarta Pusat",
  "lat": -6.2091, "lon": 106.81838,
  "geocode_kind": "building", "geocode_src": "photon: CityLofts Sudirman, Tanah Abang (building-level)",
  "url": "https://www.trucarbon.co",
  "funding_total_usd_m": None,
  "last_round": "Pre-seed, Dec 2022 — Antler, amount undisclosed (trackers model US$100K)",
  "last_round_year": 2022,
  "employees_est": 9, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/trucarbon",
  "employees_note": ("LinkedIn lists 9 people on the company page, read 2026-08-30; its own size "
    "band of 11-50 sits just above, and Exa's record models 6 (-38% YoY) — the team shrank "
    "through the 2024 rebrand and is small today."),
  "investors": ["Antler"],
  "verify_note": ("Founded 2022 as TruClimate, 'transformed into TruCarbon in 2024' per its own "
    "about text — truclimate.earth is dead and the old LinkedIn slug 404s, so older sources "
    "carry rotten links; the live company is trucarbon.co. PT Solusi Transisi Iklim per the "
    "site's own legal name; a new Singapore arm (TruCarbon International Pte Ltd, incorporated "
    "Mar 2026) appears in the footer — a structure to watch. Shifted from SaaS-first to "
    "advisory-and-projects: TruCount carbon accounting for IDX-listed companies launched Jan "
    "2026 with an MoU with the listed-companies association AEI, and a biomass energy-transition "
    "carbon project with Sambu Group ran public consultation in Aug 2026. The Antler pre-seed "
    "was never quantified."),
  "confidence": 0.65,
  "sources": [
    "https://www.trucarbon.co/",
    "https://www.linkedin.com/company/trucarbon",
    "https://www.antaranews.com/berita/3709173/truclimate-beri-solusi-pengurangan-emisi-dengan-dukungan-antler",
    "https://ecobiz.asia/trucarbon-aei-kolaborasi-dukung-emiten-perkuat-pelaporan-emisi-manfaatkan-digital-carbon-accounting/",
  ],
 },
 {
  "name": "Matchmade", "id": "matchmade",
  "legal_name": "PT Match Made Indonesia",
  "sector": "saas — financial-data reconciliation and ledger software, matching transactions across systems into SAP, Oracle, Odoo and Xero",
  "in_dki": True,
  "hq_address": "Wisma Nugra Santana Lt. 2, Jl. Jend. Sudirman Kav. 7-8, Karet Tengsin, Kec. Tanah Abang, Jakarta Pusat 10220",
  "kecamatan": "Tanah Abang", "kota": "Jakarta Pusat",
  "lat": -6.20832, "lon": 106.82129,
  "geocode_kind": "building", "geocode_src": "photon: Wisma Nugra Santana, Tanah Abang (building-level)",
  "url": "https://matchmade.io",
  "funding_total_usd_m": 1.63,
  "last_round": "Pre-seed, Oct 2023 — US$1.5M led by Vertex Ventures SEA & India",
  "last_round_year": 2023,
  "employees_est": 54, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/match-made",
  "employees_note": ("LinkedIn lists 54 people on the company page, read 2026-08-30, just above "
    "its own 11-50 band; Exa's record modeled 42 in mid-2026 (+30% YoY) — growing fast."),
  "investors": ["Vertex Ventures SEA & India", "Antler"],
  "verify_note": ("PT Match Made Indonesia (registry no. 1639297) for Indonesia plus Matchmade "
    "Pte. Ltd. (UEN 202312816E) for other countries, per its own terms page — the operating "
    "office at Wisma Nugra Santana is pinned; the registry carries Mayapada Tower. Founded 2023 "
    "by early Gojek employees Tedo Esmu Ziraga (CEO) and Gilang Gibranthama. Funding is the "
    "announced sum: US$125K in Antler's Jun 2023 SEA batch + the US$1.5M pre-seed Vertex's own "
    "release announced in Oct 2023 (trackers' US$1.7-1.8M are models). Which entity took the "
    "Vertex money is not public — flagged, not guessed. The strongest operator of the Antler "
    "cohort: clients include Gojek, Ismaya, FIT HUB and Dailybox, and Vertex republished a Tech "
    "in Asia spotlight in Jun 2026."),
  "confidence": 0.85,
  "sources": [
    "https://matchmade.io/terms-of-service",
    "https://companieshouse.id/match-made-indonesia",
    "https://www.vertexventures.sg/news/vvseai-investment-vertex-venture-leads-1-5m-in-matchmade/",
    "https://www.backscoop.com/newsletter-posts/21-sea-startups-get-funded-by-antler-part-2",
    "https://www.linkedin.com/company/match-made",
  ],
  "funding_src": "https://www.vertexventures.sg/news/vvseai-investment-vertex-venture-leads-1-5m-in-matchmade/",
  "funding_src_tier": "announced",
 },
 {
  "name": "ArkoPay", "id": "arkopay",
  "legal_name": "PT Teknologi Bangunan Berjaya",
  "sector": "fintech — supplier payments and working-capital facilitation for SME construction businesses",
  "in_dki": True,
  "hq_address": "Nifarro Park, ITS Tower Lt. 6 Unit 10, Jl. Raya Pasar Minggu No. 18, Kec. Pasar Minggu, Jakarta Selatan 12510",
  "kecamatan": "Pasar Minggu", "kota": "Jakarta Selatan",
  "lat": -6.26348, "lon": 106.84413,
  "geocode_kind": "building", "geocode_src": "photon: Nifarro Park complex (OSM files it under Pasar Minggu; the address reads Pancoran-side)",
  "url": "https://arkopay.com",
  "funding_total_usd_m": 0.43,
  "last_round": "The Big Spark (CNA), Mar 2024 — S$405K (~US$300K) committed on the show finale",
  "last_round_year": 2024,
  "employees_est": 3, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/arkopay-indonesia",
  "employees_note": ("LinkedIn lists 3 people on the company page, read 2026-08-30; its own size "
    "band says 2-10. A very small team — the doubt is on the row, not hidden."),
  "investors": ["Antler", "The Big Spark", "Tenity"],
  "verify_note": ("PT Teknologi Bangunan Berjaya (registry no. 1438071), named in its own privacy "
    "policy, at Nifarro Park's ITS Tower. Founded 2023 in Antler's residency by Laura Lukito "
    "(ex-Antler EIR, Forbes 30 Under 30 Asia 2025); the LinkedIn page's 'Founded 2019' predates "
    "the company and is wrong. Funding = US$125K (Antler's Jun 2023 SEA batch, as ARKO) + "
    "S$405K (~US$300K) won on the finale of CNA's The Big Spark in Mar 2024, which Forbes "
    "reports as received; a Tenity SGD 70K accelerator figure is tracker-only and not summed. "
    "THE DOUBTS, stated: three discoverable staff, no company LinkedIn post since ~Sep 2025, "
    "and a new ArkoProp property-listing/KPR side vertical — operating at very small scale, "
    "with the site maintained (Forbes repost Jun 2025) and the CEO active through Aug 2026. "
    "Lending-adjacent language with no licence of its own claimed; facilitation model."),
  "confidence": 0.5,
  "sources": [
    "https://arkopay.com/kebijakan-privasi/",
    "https://companieshouse.id/teknologi-bangunan-berjaya",
    "https://www.backscoop.com/newsletter-posts/21-sea-startups-get-funded-by-antler-part-2",
    "https://www.mediacorp.sg/media-releases/arkopay-cellivate-technologies-and-tenang-ai-wow-investors-finale-big-spark-shot-seed-funding-186401",
    "https://www.forbes.com/profile/laura-lukito/",
    "https://www.linkedin.com/company/arkopay-indonesia",
  ],
  "funding_src": "https://www.mediacorp.sg/media-releases/arkopay-cellivate-technologies-and-tenang-ai-wow-investors-finale-big-spark-shot-seed-funding-186401",
  "funding_src_tier": "announced",
 },
 {
  "name": "AssetFindr", "id": "assetfindr",
  "legal_name": "PT Solusi Berkat Inovasi",
  "sector": "AI asset intelligence — maintenance management (CMMS), IoT and digital inspection, with a tyre-fleet niche",
  "in_dki": True,
  "hq_address": "Kencana Tower, Business Park Kebon Jeruk, Jl. Raya Meruya Ilir No. 88, Meruya Utara, Kec. Kembangan, Jakarta Barat 11620",
  "kecamatan": "Kembangan", "kota": "Jakarta Barat",
  "lat": -6.19849, "lon": 106.76238,
  "geocode_kind": "building", "geocode_src": "photon: Business Park Kebon Jeruk (Kencana Tower), Kembangan (building-level)",
  "url": "https://assetfindr.com",
  "funding_total_usd_m": 0.125,
  "last_round": "Pre-seed, Jan 2024 — US$125K, Antler",
  "last_round_year": 2024,
  "employees_est": 24, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/assetfindr",
  "employees_note": ("LinkedIn lists 24 people on the company page, read 2026-08-30; its own size "
    "band says 11-50, which brackets the count."),
  "investors": ["Antler"],
  "verify_note": ("PT Solusi Berkat Inovasi per its own privacy policy (Meruya Utara, Kembangan), "
    "operating from Kencana Tower in Business Park Kebon Jeruk per LinkedIn's primary location. "
    "Founded 2024 by Sugih Sutjiono (CEO) and Benediktus Sumarso (CPTO); named first in Antler's "
    "own Jan 2024 six-startup US$750K batch announcement, which makes the US$125K check one of "
    "the few Antler amounts on the public record. Very active at the read date: pitched TyreOptimaX "
    "at a Kadin Indonesia event on 28 Aug 2026 and exhibited at Mining Indonesia 2026 the same "
    "week."),
  "confidence": 0.8,
  "sources": [
    "https://assetfindr.com/privacy-policy",
    "https://www.antler.co/blog/antler-backs-6-startups-with-750-000-pre-seed-funding-in-indonesia",
    "https://www.linkedin.com/company/assetfindr",
  ],
  "funding_src": "https://www.antler.co/blog/antler-backs-6-startups-with-750-000-pre-seed-funding-in-indonesia",
  "funding_src_tier": "announced",
 },
 {
  "name": "Cavos", "id": "cavos",
  "legal_name": "PT Pintar Cipta Inovasi",
  "sector": "voice AI — agents and automated QA for contact centers in financial services",
  "in_dki": True,
  "hq_address": None,
  "kecamatan": None, "kota": None,
  "url": "https://cavos.io",
  "funding_total_usd_m": None,
  "last_round": "Venture round, May 2025 — Tenity, amount undisclosed",
  "last_round_year": 2025,
  "employees_est": 16, "employees_asof": TODAY, "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/cavos-io",
  "employees_note": ("LinkedIn lists 16 people on the company page, read 2026-08-30; its own size "
    "band says 11-50. Exa's record models 13 at +550% YoY — the fastest grower of the Antler "
    "cohort."),
  "investors": ["Antler", "Tenity"],
  "verify_note": ("PT Pintar Cipta Inovasi per the site's own footer, with Cavos Pte. Ltd. (UEN "
    "202504844D) in Singapore — investor Tenity describes it as 'headquartered in Singapore with "
    "primary operations in Jakarta', and the census counts the Jakarta operation, the Qiscus "
    "treatment. NO STREET ADDRESS is published anywhere — LinkedIn's locations are just 'Jakarta' "
    "and 'Singapore', so the row is unlocated and carries no kota. Founded 2024 by Johan Antlov "
    "(ex-Lazada MD, HappyFresh co-founder) and Ramdhan Hidayat (CTO, joined Antler's ID6 cohort "
    "Feb 2024 — the check amount is tracker-only, never announced). Tenity invested May 2025, "
    "amount undisclosed. Very active: weekly product posts on voice-AI call handling and "
    "collections automation through the read date."),
  "confidence": 0.65,
  "sources": [
    "https://cavos.io/",
    "https://www.tenity.com/shaping-the-future-of-enterprise-contact-centers-tenity-invests-in-ex-happyfresh-co-founders-ai-startup-to-power-the-next-generation-of-customer-service/",
    "https://www.linkedin.com/company/cavos-io",
    "https://www.cbinsights.com/company/cavos-ai/financials",
  ],
 },
]

# ── roster companies NOT (yet) counted, with status flags ────────────
# blurbs are Antler's own directory/press wording, compressed. flag values:
# 'verifying' = census verification in flight this session; 'quiet' = no
# recent operating signal found (tiny team, absent from Antler's current
# directory) — inactive-looking but unconfirmed, the Halofina treatment.
PENDING = [
 {"name": "Akar", "url": "https://akar.cloud", "year": 2022,
  "blurb": "modular vertical indoor-farming hardware"},
 {"name": "Secha", "url": "https://sechahome.com", "year": 2022,
  "blurb": "move-in-ready home-improvement financing (PT Kesempatan Kedua Milenial)"},
 {"name": "REACH", "url": "https://getreach.id", "year": 2022,
  "blurb": "personal-finance advice app", "flag": "quiet"},
 {"name": "Geekzwolf", "url": None, "year": 2022,
  "blurb": "web3-game discovery community (PT Serigala Teknologi Indonesia)", "flag": "quiet"},
 {"name": "ZIWA", "url": "https://ziwaku.com", "year": 2022,
  "blurb": "women's mental-health community platform", "flag": "quiet"},
 {"name": "Eduku", "url": None, "year": 2022,
  "blurb": "school LMS (PT Generasi Muda Maju)", "flag": "quiet"},
 {"name": "Teroka", "url": None, "year": 2022,
  "blurb": "creator-economy D2C brand builder", "flag": "quiet"},
 {"name": "Agri Sparta", "url": "https://agrisparta.com", "year": 2023,
  "blurb": "rice-farming industrialization — agrochemical supply with pay-at-harvest"},
 {"name": "Agrigate", "url": "https://agrigate.id", "year": 2023,
  "blurb": "B2B agri supply chain between verified farmers and industrial buyers"},
 {"name": "Tumbuh", "url": None, "year": 2023,
  "blurb": "BNPL and embedded financing for small businesses", "flag": "quiet"},
 {"name": "Rampable", "url": "https://rampable.co", "year": 2023,
  "blurb": "crypto payroll and expense rails", "flag": "quiet"},
 {"name": "Manuport", "url": None, "year": 2023,
  "blurb": "apparel-industry supply-chain platform", "flag": "quiet"},
 {"name": "Prowriting", "url": None, "year": 2023,
  "blurb": "AI UX-writing assistant", "flag": "quiet"},
 {"name": "Stofee", "url": None, "year": 2023,
  "blurb": "B2B fashion supply-chain marketplace (China+1 sourcing)"},
 {"name": "Kora", "url": None, "year": 2023,
  "blurb": "co-farming and post-harvest agritech — Antler's directory tags it Singapore while Antler's own Aug 2024 statement calls it an Indonesian portfolio company; entity check needed"},
 {"name": "Club Kyta", "url": "https://clubkyta.com", "year": 2023,
  "blurb": "omnichannel distribution for D2C brands in tier-2/3 cities"},
 {"name": "Alter", "url": "https://alter.game", "year": 2023,
  "blurb": "social platform for gamers", "flag": "quiet"},
 {"name": "Hazana", "url": "https://hazana.id", "year": 2023,
  "blurb": "embedded halal financing for platforms"},
 {"name": "Ovy Health (ex Plans)", "url": "https://ovyhealth.com", "year": 2023,
  "blurb": "fertility and reproductive-health assistant"},
 {"name": "Loop Health", "url": "https://loophealth.id", "year": 2023,
  "blurb": "diabetes-management app and coaching"},
 {"name": "Sqouts", "url": "https://sqouts.com", "year": 2023,
  "blurb": "conversational-AI talent screening"},
 {"name": "Safelog.AI", "url": "https://safelog.ai", "year": 2023,
  "blurb": "AI background-checking agent"},
 {"name": "Lunash", "url": "https://lunash.id", "year": 2024,
  "blurb": "AI debt-collection and recovery platform (PT Lunash Inovasi Indonesia)"},
 {"name": "Konstruksi.AI", "url": "https://konstruksi.ai", "year": 2024,
  "blurb": "construction management with machine-vision QC"},
 {"name": "Ternakin", "url": "https://ternakin.co", "year": 2024,
  "blurb": "IoT fish farming and contract farming"},
 {"name": "Adamata", "url": "https://adamata.co", "year": 2024,
  "blurb": "AI robotic sorting for mixed waste"},
 {"name": "Blu IQ Tech", "url": "https://bluiq.tech", "year": 2024,
  "blurb": "IoT and AI fishing efficiency"},
 {"name": "FranchiseOne", "url": "https://franchise.one", "year": 2024,
  "blurb": "all-in-one franchise enabler"},
 {"name": "Geosquare.ai", "url": "https://geosquare.ai", "year": 2024,
  "blurb": "5x5m-grid geospatial data platform (PT Geo Innovation Nusantara)"},
 {"name": "Harvesea", "url": "https://harvesea.com", "year": 2024,
  "blurb": "wholesale seafood supply"},
 {"name": "Logice", "url": "https://logiceindonesia.com", "year": 2024,
  "blurb": "cold-chain fulfilment"},
 {"name": "Moneta", "url": "https://moneta.sg", "year": 2024,
  "blurb": "AI risk management for lenders — .sg domain, entity check needed"},
 {"name": "rAIgine", "url": "https://raigine.com", "year": 2024,
  "blurb": "AI engine for manufacturers"},
 {"name": "Rainmaker", "url": "https://rainmaker.co.id", "year": 2024,
  "blurb": "AI sales assistant for insurance agents"},
 {"name": "Snef", "url": "https://snef.co", "year": 2024,
  "blurb": "AI social commerce"},
 {"name": "Tagflow AI", "url": "https://tagflow-ai.com", "year": 2024,
  "blurb": "LLM fine-tuning platform"},
 {"name": "WorthWasting", "url": "https://worthwasting.id", "year": 2024,
  "blurb": "hazardous-waste management aggregator"},
 {"name": "YoboLabs", "url": "https://yobo.id", "year": 2024,
  "blurb": "AI-native growth marketing for consumer brands"},
 {"name": "AvataraLabs", "url": "https://avataralabs.ai", "year": 2025,
  "blurb": "AI virtual sellers"},
 {"name": "Easyport", "url": "https://easyport.co", "year": 2025,
  "blurb": "AI freight forwarding"},
 {"name": "MTA (ClaimMind)", "url": "https://claimmind.life", "year": 2025,
  "blurb": "insurance-claims AI"},
]

# ── roster companies that will NOT be counted, with the reason ───────
OUTSIDE = [
 {"name": "Bling", "url": "https://bling.co.id", "year": 2022,
  "city": "Jakarta", "reason": "No longer operating",
  "note": "gold-investment app from cohort ID1; Dealroom marks it defunct."},
 {"name": "Tokobox", "url": None, "year": 2019,
  "city": "Singapore-incorporated", "reason": "No longer operating",
  "note": "social-commerce enablement for Indonesian sellers, closed around 2020 — a team "
          "member's own page records 'Closed business, active 2019-2020'."},
 {"name": "Kamoo", "url": None, "year": 2023,
  "city": "Yogyakarta", "reason": "Outside the census area",
  "note": "dairy value-chain platform in Yogyakarta, one person on LinkedIn — outside the "
          "geography, and quiet besides."},
 {"name": "Qonflo", "url": "https://qonflo.ai", "year": 2025,
  "city": "Surabaya", "reason": "Outside the census area",
  "note": "chat-pipeline automation; LinkedIn puts the company in Surabaya."},
 {"name": "Aurelif", "url": "https://aurelif.co", "year": 2025,
  "city": "Singapore", "reason": "Outside the census area",
  "note": "aging-care operating system; LinkedIn HQ Singapore, APAC focus."},
 {"name": "Katalis AI", "url": "https://katalis.ai", "year": 2023,
  "city": "Singapore-incorporated", "reason": "Outside the census area",
  "note": "AI marketing for e-commerce, Katalis Pte Ltd, sells across SEA — no Indonesian "
          "entity surfaced."},
]

SCOPE_LINE = [
 {"name": "Antler-check names that are not Antler's",
  "owner": "TransTRACK · Amoda · FishLog · Baskit · Sribuu · Mindtera · Bicarakan.id · Prieds · Kelola",
  "why": "names circulating as Antler Indonesia portfolio that the sweep checked and could not "
         "evidence — each cap table traces to other funds (Cocoon/Eurazeo, East Ventures, BRI "
         "Ventures et al.). Recorded so the tag never spreads to them by rumor",
 },
]


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by = {c.get('id'): c for c in raw['companies']}

    added = updated = 0
    for row in ROWS:
        cur = by.get(row['id'])
        if cur is None:
            raw['companies'].append(dict(row))
            by[row['id']] = raw['companies'][-1]
            added += 1
            print(f"added   {row['id']:14s} {row['name']}")
        else:
            cur.update(dict(row))
            updated += 1
            print(f"updated {row['id']:14s} {row['name']}")

    # tags — strip stale ones first so a rename or demotion never lingers
    for c in raw['companies']:
        for k in ('antler', 'antler_year', 'antler_note'):
            c.pop(k, None)
    missing = [i for i in ANTLER_IN if i not in by]
    if missing:
        raise SystemExit('census ids missing (renamed? clobbered?): ' + ', '.join(missing))
    for cid, fields in ANTLER_IN.items():
        by[cid]['antler'] = True
        by[cid].update(fields)
        print(f"tagged  {cid:14s} antler={fields.get('antler_year')}")

    raw['antler_source'] = SOURCE
    raw['antler_pending'] = PENDING
    raw['antler_outside'] = OUTSIDE

    scope = raw.setdefault('scope', {})
    mine = {e['name'] for e in SCOPE_LINE}
    scope['outside'] = [e for e in scope.get('outside', []) if e.get('name') not in mine] + SCOPE_LINE

    with open(ROSTER_OUT, 'w', encoding='utf-8') as fh:
        json.dump({"source": SOURCE, "in_census": sorted(ANTLER_IN),
                   "pending": PENDING, "outside": OUTSIDE}, fh, ensure_ascii=False, indent=2)

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)
    print(f"antler: {added} rows added, {updated} updated, {len(ANTLER_IN)} tagged, "
          f"{len(PENDING)} pending, {len(OUTSIDE)} outside -> {len(raw['companies'])} companies")


if __name__ == '__main__':
    main()
