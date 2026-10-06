#!/usr/bin/env python3
"""BALI JOINS THE CENSUS — Sarbagita scope + six verified rows (Aug 31 2026).

Luca, after the Timedoor rejection went to /coverage: "ok then we need to make
the maps of Bali like we make Bandung and put that timedoor, also BTI energy
and several startup in there."

So Bali is now IN SCOPE the way Bandung is: Sarbagita (Perpres 45/2011) —
Denpasar, Badung, Gianyar, Tabanan. The island's other five regencies stay
outside until a row lands in one (fetch-bali.py has the relation ids ready).
This script is the ONE owner of the scope-rule edit, the same way the Bandung
merge was: it rewrites scope['rule'] deliberately — every other census script
still follows the census-fitness lesson and never touches it.

THE ROWS (every figure read 2026-08-31, sources on each):

  · TIMEDOOR — the row Luca asked for, and yesterday's /coverage rejection
    reversed on exactly the terms it named: "reversible if the census area
    ever reaches Bali and the agency line is redrawn." Bali is now in scope,
    and Luca redrew the line. PT Timedoor Indonesia (own site; iditrix
    registry mirror: reg 33/1167/L, 2017, at Jl. Tukad Citarum Gang F No.1
    Renon — an earlier registered address; today's office Jl. Tukad Yeh Aya
    IX No.46 Renon per site + LinkedIn). Founded 2014 by Yutaka Tokunaga
    (Japan). HEADCOUNT IS THE JUDGMENT CALL: the live LinkedIn page tags 764
    people, but that one page covers the whole group — Timedoor Academy's
    kids-coding branches and the LPK Japanese job-training arm, whose
    trainees and mentors tag themselves — while the company's own about page
    says "approximately 150 staff members". A company's own statement
    outranks a LinkedIn tag count (census-headcount.py's apply rule), so 150
    is published and the 764 is in the note. Funding: no round on record.

  · BTI ENERGY — Luca named it. PT Bintang Terbarukan Indonesia (own about
    page: founded Mar 2020, registered Mar 2021; companieshouse.id mirror reg
    1157526 at Jalan Nangka Utara No.240 Denpasar; today's contact page:
    Jl. Antasura No.50 Denpasar + BSD and Surabaya branches). Solar EPC with
    customer financing schemes. The EPC-services tension (the LSKK shape) is
    flagged in-row; included as a cleantech company on Luca's call. 29 live
    on LinkedIn, band 11-50 brackets it. No round or grant of its own on
    record (its founder is quoted in New Energy Nexus Indonesia's Bali
    cleantech piece; that is color, not capital).

  · NUANU — PT Nuanu Real Estate (companieshouse.id reg 1708629, Jalan
    Pantai Nyanyi, Tabanan), the 44-hectare creative-city district at Nyanyi
    founded 2020 by QIWI co-founder Sergey Solonin; press consistently
    reports US$100M of project investment — founder capital, not a venture
    round, so funding stays a dash under parent_funded. 172 live on
    LinkedIn. The venture test reads: built by tech money as its own
    operating company, not an incumbent's line (the DC-real-estate exclusion
    covers incumbents' integrator arms, not this).

  · BUKIT VISTA — PT Bukit Vista Nusantara (its own Google Play developer
    account + LinkedIn registered name), Jimbaran. Founder-CEO Jing Cho
    Yang, Airbnb's former Indonesia market lead. Tech-run villa/guesthouse
    operations — the Travelio/Rukita/Jendela360 managed-property shape, so
    the services tension resolves the way those rows did. 43 live on
    LinkedIn. Bootstrapped: no round on record. NO STREET ADDRESS published
    on its site — filed under Jimbaran/Kuta Selatan with a settlement-level
    pin, the ArdHosting treatment, rather than a guessed street.

  · BOOKANDLINK — PT Tripla Bookandlink Indonesia per its OWN contact page
    (Jl. Imam Bonjol Blok AA 8, Denpasar), the 2014 Bali-founded hotel
    channel-manager now wholly owned by Japan's tripla Inc. (TSE: 5136):
    tripla 53% + Development Bank of Japan 47% acquired the group at US$6.8M
    in Sep 2023; tripla went to 100% in Aug 2024. Global-parent rule: the
    Indonesian operation is the row (the Ninja Xpress/Upbit shape), funding
    is a dash with the acquisition in the note. 44 live on LinkedIn.

  · AVANI ECO — the cassava-bioplastic maker (bags, straws, packaging) that
    put Bali's plastic fight on CNN; established 2014 per its own about page
    (LinkedIn says 2012 — own site wins), HQ Jl. Cargo Permai No.188, Ubung
    Kaja, Denpasar Utara, with a Jakarta branch. THE HONESTY GAP: no PT
    string is published anywhere the sweep could find — LinkedIn's
    registered-name enrichment shows "AVANI Eco Innovations, LLC" — so the
    row ships with no legal_name (46 census rows already do) and the gap
    stated in the note. Funding: DOEN Foundation impact investment on
    record, amount undisclosed; the MBRIF AED 2.5M guarantee belongs to the
    separate Middle East arm and is NOT counted. 38 live on LinkedIn.

Idempotent UPSERT (census-bdd.py mechanics): re-running restores exactly these
fields, leaves logo/sprite/geocode alone, merges scope BY NAME, and REPLACED
removes the Timedoor rejection the /coverage register carried for one day.

    python3 scripts/census-bali.py && node scripts/build-census.js
"""
import json, os, re, sys, tempfile, urllib.request, urllib.parse

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-31'

RULE = ("A company is counted when it was built or bought by tech or venture money rather than run "
        "as an incumbent's product line, when it is its own legal entity, and when a headcount can "
        "be sourced. All three have to hold. Geography: Greater Jakarta; since 30 Aug 2026 the "
        "Bandung basin — Kota Bandung, Kota Cimahi, Kabupaten Bandung and Kabupaten Bandung Barat; "
        "and since 31 Aug 2026 south Bali — the Sarbagita metro: Denpasar, Badung, Gianyar and "
        "Tabanan. Everywhere else in Indonesia is still outside.")

# scope entries this script deletes (merged-by-name): the Timedoor rejection
# is superseded by the row below, on the exact reversibility terms it stated.
REPLACED = {"Timedoor (PT Timedoor Indonesia)"}

# ── the cohort ───────────────────────────────────────────────────────
# `sector` wording is load-bearing: build-census.js SECTOR_KEYS is first-match-
# wins. Each string is written for ONE bucket and asserted below — e.g. no
# 'data'/'AI' in Bukit Vista's (ai-cloud sits before prop), no 'education' in
# Nuanu's (edtech sits before prop), 'SaaS' leads BookandLink's (saas sits
# before prop, so 'hotel … front-office' can't drift).
ROWS = [
 {
  "name": "Timedoor",
  "id": "timedoor",
  "legal_name": "PT Timedoor Indonesia",
  "sector": "IT services — web, mobile-app and system development studio, with the Timedoor Academy coding school for kids and a Japanese job-training arm (LPK Timedoor)",
  "_sector_key": "ai-cloud",
  "in_dki": False,
  "hq_address": "Jl. Tukad Yeh Aya IX No.46, Renon, Denpasar Selatan, Denpasar, Bali 80226",
  "kecamatan": "Denpasar Selatan",
  "kota": "Denpasar",
  "url": "https://timedoor.net",
  "funding_total_usd_m": None,
  "funding_status": "none_on_record",
  "funding_note": ("No round on record — grown since 2014 without disclosed outside capital. Founder "
                   "Yutaka Tokunaga invests in others through Ango Ventures; nothing public says anyone "
                   "invested in Timedoor."),
  "employees_est": 150,
  "employees_asof": TODAY,
  "employees_src": "https://timedoor.net/about/",
  "employees_kind": "company",
  "employees_note": ("The company's own about page says 'approximately 150 staff members', read 2026-08-31. "
                     "The live LinkedIn page tags 764 people and declares 201-500 — but that one page covers "
                     "the whole group, including Timedoor Academy's kids-coding branches and the LPK Timedoor "
                     "Japanese job-training arm, whose mentors and trainees tag themselves — so the company's "
                     "own statement is published and the tag count is not (a better-sourced figure is never "
                     "overwritten by a LinkedIn count)."),
  "verify_note": ("Yesterday's /coverage rejection, reversed on exactly the terms it stated: 'reversible if "
                  "the census area ever reaches Bali and the agency line is redrawn' — Bali entered scope on "
                  "31 Aug 2026 and Luca redrew the line, naming this row. The agency tension stands and is "
                  "stated plainly: web/app/system development billed as delivery, the same shape that keeps "
                  "the Bandung software houses out; what it carries besides delivery is a product-ish "
                  "education arm (Timedoor Academy, its own subsidiary per the LinkedIn page) and a "
                  "Japan-lane services business. ENTITY: PT. Timedoor Indonesia on its own site; iditrix "
                  "registry mirror 'Time Door Indonesia' reg 33/1167/L (2017) at Jl. Tukad Citarum Gang F "
                  "No.1 Renon — an earlier registered address; the Tukad Yeh Aya office is on its site and "
                  "LinkedIn today. Founded 2014 by Yutaka Tokunaga (Japan) — founder nationality is not a "
                  "census test (the Grivy row, same week). Offices: Denpasar HQ, Kelapa Gading Jakarta "
                  "branch, Tokyo, New Cairo — the Indonesian operation is what is counted. timedoor.net "
                  "answered 200 on the read date."),
  "confidence": 0.75,
  "sources": [
    "https://timedoor.net/about/",
    "https://www.linkedin.com/company/pt-timedoor-indonesia",
    "https://iditrix.com/time-door-indonesia/512168/",
    "https://timedoor.net/blogs/Signs-MOU-with-MNC-University-to-Establish-Japan-AI-Business-Department/",
  ],
  "site_status": "ok",
  "liveness_checked": TODAY,
  "_geocode": ["Jalan Tukad Yeh Aya IX, Renon, Denpasar", "Renon, Denpasar Selatan, Denpasar"],
 },
 {
  "name": "BTI Energy",
  "id": "bti-energy",
  "legal_name": "PT Bintang Terbarukan Indonesia",
  "sector": "climate — rooftop solar EPC: design, procurement and installation with flexible payment schemes for homes, SMEs and commercial buildings",
  "_sector_key": "climate",
  "in_dki": False,
  "hq_address": "Jl. Antasura No.50, Denpasar Utara, Denpasar, Bali",
  "kecamatan": "Denpasar Utara",
  "kota": "Denpasar",
  "url": "https://www.btienergy.id",
  "funding_total_usd_m": None,
  "funding_status": "none_on_record",
  "funding_note": ("No round or grant of its own on record. The zero-upfront and instalment schemes it "
                   "advertises are customer financing, not raised capital; its founder is quoted in New "
                   "Energy Nexus Indonesia's Bali cleantech coverage, but no Nexus grant, batch or "
                   "investment naming BTI has been found."),
  "employees_est": 29,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/bti-energy",
  "employees_kind": "linkedin",
  "employees_note": ("LinkedIn lists 29 people on the company page ('Discover all 29 employees'), read "
                     "2026-08-31; its own band 11-50 brackets the count. RocketReach's vendor figure (27) "
                     "corroborates within 7%."),
  "verify_note": ("The second row Luca named for Bali. ENTITY: its own about page — founded March 2020, "
                  "registered March 2021 as PT Bintang Terbarukan Indonesia; companieshouse.id registry "
                  "mirror reg 1157526 at Jalan Nangka Utara No.240 Denpasar (an earlier registered address; "
                  "the Antasura office is on its own contact page today, with BSD Tangerang and Surabaya "
                  "branches). Officers per its own team page: CEO I Komang Budiasa; commissioners include "
                  "founder I Gusti Ngurah Erlangga Bayu Rahmanda Putra — quoted as founder & CEO in New "
                  "Energy Nexus Indonesia's Bali energy-transition piece. THE TENSION, stated plainly: solar "
                  "EPC is engineering billed per project — the shape that kept LSKK out. What separates BTI "
                  "on the census's own terms is thin (a 2020 cleantech founding and financed-installation "
                  "schemes, not a venture round); it is included on Luca's explicit call and flagged "
                  "reversible, the Btech precedent read the other way. btienergy.id answered 200 on the "
                  "read date."),
  "confidence": 0.65,
  "sources": [
    "https://www.btienergy.id/en/about-bti/",
    "https://www.btienergy.id/en/contact/",
    "https://www.linkedin.com/company/bti-energy",
    "https://companieshouse.id/bintang-terbarukan-indonesia",
    "https://newenergynexus.id/cleantech-startups-are-key-players-in-balis-energy-transition-and-offer-significant-economic-opportunities-in-the-future/",
  ],
  "site_status": "ok",
  "liveness_checked": TODAY,
  "_geocode": ["Jalan Antasura, Denpasar", "Denpasar Utara, Denpasar"],
 },
 {
  "name": "Nuanu (Nuanu Creative City)",
  "id": "nuanu",
  "legal_name": "PT Nuanu Real Estate",
  "sector": "property — 44-hectare creative-city district on the Nyanyi coast of Tabanan: hospitality, venues, wellness and creative-economy tenants",
  "_sector_key": "prop",
  "in_dki": False,
  "hq_address": "Jl. Pantai Nyanyi, Banjar Nyanyi, Desa Beraban, Kec. Kediri, Kabupaten Tabanan, Bali 82121",
  "kecamatan": "Kediri",
  "kota": "Kabupaten Tabanan",
  "url": "https://nuanu.com",
  "funding_total_usd_m": None,
  "funding_status": "parent_funded",
  "funding_note": ("Founder-funded, so the census total stays a dash: press consistently reports US$100M "
                   "of total investment by founder Sergey Solonin (QIWI co-founder) — project capital from "
                   "the owner, not a disclosed venture round, and no third-party round is on record."),
  "employees_est": 172,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/nuanu",
  "employees_kind": "linkedin",
  "employees_note": ("LinkedIn lists 172 people on the company page ('Discover all 172 employees'), read "
                     "2026-08-31. Its own band says 201-500, which does not bracket the count — the live "
                     "people count is what is published, as on every other row. Tenant businesses inside the "
                     "district (the beach club, hotel and venue operators) hire on their own pages and are "
                     "not in this figure."),
  "verify_note": ("ENTITY: PT. Nuanu Real Estate, reg 1708629, registered on Jalan Pantai Nyanyi, Tabanan "
                  "(companieshouse.id registry mirror) — matching the LinkedIn primary location at Banjar "
                  "Nyanyi, Desa Beraban; the group also styles itself Nuanu Property Group and Nuanu "
                  "Creative City. VENTURE TEST: built from 2020 by Sergey Solonin, co-founder of QIWI — "
                  "tech money building its own operating company, not an incumbent's product line (the "
                  "census's real-estate exclusions cover incumbents' integrator and data-centre arms, not "
                  "this). Sector filed as property alongside Rukita and Jendela360. A real-estate developer "
                  "is an unusual census row; included because it passes all three tests as written, and "
                  "flagged for exactly that reason. nuanu.com answered 200 on the read date."),
  "confidence": 0.7,
  "sources": [
    "https://companieshouse.id/nuanu-real-estate",
    "https://www.linkedin.com/company/nuanu",
    "https://nuanu.com",
    "https://www.wallpaper.com/architecture/nuanu-creative-city-development-bali-indonesia",
    "https://theedgemalaysia.com/node/784849",
  ],
  "site_status": "ok",
  "liveness_checked": TODAY,
  "_geocode": ["Jalan Pantai Nyanyi, Beraban, Tabanan", "Pantai Nyanyi, Tabanan", "Beraban, Kediri, Tabanan"],
 },
 {
  "name": "Bukit Vista",
  "id": "bukit-vista",
  "legal_name": "PT Bukit Vista Nusantara",
  "sector": "property management — tech-run villa and guesthouse operations and dynamic pricing for Bali owners",
  "_sector_key": "prop",
  "in_dki": False,
  "hq_address": "Jimbaran, Kec. Kuta Selatan, Kabupaten Badung, Bali (street address not published on its site)",
  "kecamatan": "Kuta Selatan",
  "kota": "Kabupaten Badung",
  "url": "https://www.bukitvista.com",
  "funding_total_usd_m": None,
  "funding_status": "none_on_record",
  "funding_note": ("No round on record — every public profile shows a bootstrapped company; Crunchbase "
                   "lists no rounds. Founder-CEO Jing Cho Yang was Airbnb's Indonesia market development "
                   "lead until 2014."),
  "employees_est": 43,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/bukitvista",
  "employees_kind": "linkedin",
  "employees_note": ("LinkedIn lists 43 people on the company page ('Discover all 43 employees'), read "
                     "2026-08-31. The operation is Bali-based with a Yogyakarta remote team on the same "
                     "page."),
  "verify_note": ("ENTITY: PT Bukit Vista Nusantara — first-party twice over: its own Google Play developer "
                  "account publishes apps under that name, and the LinkedIn page's registered name matches. "
                  "THE SERVICES QUESTION resolves the way Travelio, Rukita and Jendela360 did: managed "
                  "property run on its own tech (remote operations, dynamic pricing, guest platform) is an "
                  "included census shape, and the founder is ex-Airbnb rather than a conventional villa "
                  "agency lineage. NO STREET ADDRESS is published anywhere the sweep could find — LinkedIn "
                  "and its own site say Jimbaran — so the row is filed under Kuta Selatan with a "
                  "settlement-level pin rather than a guessed street (the ArdHosting treatment). "
                  "bukitvista.com answered 200 on the read date."),
  "confidence": 0.7,
  "sources": [
    "https://www.bukitvista.com/about-us",
    "https://www.linkedin.com/company/bukitvista",
    "https://play.google.com/store/apps/dev?id=7898240698688652615",
    "https://www.crunchbase.com/organization/bukitvista",
  ],
  "site_status": "ok",
  "liveness_checked": TODAY,
  "_geocode": ["Jimbaran, Kuta Selatan, Badung", "Jimbaran, Bali"],
  "_geocode_kind": "settlement",
 },
 {
  "name": "BookandLink",
  "id": "bookandlink",
  "legal_name": "PT Tripla Bookandlink Indonesia (tripla Inc., TSE: 5136 group)",
  "sector": "SaaS — hotel channel manager, booking engine and front-office system for Indonesian hotels and villas",
  "_sector_key": "saas",
  "in_dki": False,
  "hq_address": "Komplek Pertokoan, Jl. Imam Bonjol Blok AA 8, Denpasar Barat, Denpasar, Bali",
  "kecamatan": "Denpasar Barat",
  "kota": "Denpasar",
  "url": "https://web.bookandlink.com/en",
  "funding_total_usd_m": None,
  "funding_status": "parent_funded",
  "funding_note": ("Parent-funded, so the census total stays a dash: Japan's tripla Inc. (TSE: 5136) and "
                   "the Development Bank of Japan acquired the BookandLink group at US$6.8M in September "
                   "2023 (53/47), and tripla went to 100% in August 2024 — an acquisition price, not "
                   "capital raised by the Indonesian company. No venture round of its own is on record."),
  "employees_est": 44,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/bookandlink",
  "employees_kind": "linkedin",
  "employees_note": ("LinkedIn lists 44 people on the company page ('View all 44 employees'), read "
                     "2026-08-31. Its own band says 51-200, which does not bracket the count — the live "
                     "people count is what is published, as on every other row."),
  "verify_note": ("ENTITY: PT Tripla Bookandlink Indonesia, named with the Imam Bonjol address on its own "
                  "contact page (which also lists the Tokyo parent office). Founded 2014 in Bali by "
                  "founders out of villa management; since August 2024 wholly owned by tripla Inc., the "
                  "Tokyo-listed hotel-tech group — so the GLOBAL-PARENT RULE applies (the Ninja "
                  "Xpress/Upbit shape): the Indonesian operation is the row, counted at its Indonesian "
                  "payroll, and the parent's figures never become Indonesian totals. "
                  "web.bookandlink.com answered 200 on the read date."),
  "confidence": 0.8,
  "sources": [
    "https://web.bookandlink.com/en/contact-us",
    "https://web.bookandlink.com/en/about-us",
    "https://www.linkedin.com/company/bookandlink",
    "https://skift.com/2023/09/18/tripla-expands-into-indonesia-via-bookandlink-acquisition/",
    "https://en.traicy.com/posts/2024082412017/",
    "https://www.marketscreener.com/quote/stock/TRIPLA-CO-LTD-145770705/news/Tripla-Co-Ltd-and-Development-Bank-of-Japan-Inc-acquired-BOOKANDLINK-PTE-LTD-for-6-8-million-44858820/",
  ],
  "site_status": "ok",
  "liveness_checked": TODAY,
  "_geocode": ["Jalan Imam Bonjol, Denpasar", "Denpasar Barat, Denpasar"],
 },
 {
  "name": "Avani Eco",
  "id": "avani-eco",
  "sector": "climate — cassava-starch bioplastic and compostable packaging maker (bags, straws, food service packaging) supplying hospitality and export buyers",
  "_sector_key": "climate",
  "in_dki": False,
  "hq_address": "Jl. Cargo Permai No.188, Dusun Liligundi, Ubung Kaja, Denpasar Utara, Denpasar, Bali 80116",
  "kecamatan": "Denpasar Utara",
  "kota": "Denpasar",
  "url": "https://avanieco.com",
  "funding_total_usd_m": None,
  "funding_status": "undisclosed",
  "funding_note": ("Backed, amount never disclosed: the DOEN Foundation made an impact investment in Avani "
                   "(a New Ventures-facilitated deal, on DOEN's own platform) with no figure published. The "
                   "MBRIF AED 2.5M (~US$680K) guarantee reported in 2022 belongs to the separate Avani Eco "
                   "Middle East arm and is NOT counted here."),
  "employees_est": 38,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/avani-eco",
  "employees_kind": "linkedin",
  "employees_note": ("LinkedIn lists 38 people on the company page ('Discover all 38 employees'), read "
                     "2026-08-31. Its own band says 201-500, which does not bracket the count — the live "
                     "people count is what is published. The separate Avani Eco Middle East arm has its own "
                     "page and is not in this figure."),
  "verify_note": ("The census's honesty gap, stated plainly: NO PT STRING IS PUBLISHED anywhere the sweep "
                  "could find — its own site names no legal entity, and LinkedIn's registered-name "
                  "enrichment shows 'AVANI Eco Innovations, LLC' — so the row ships without a legal_name "
                  "and this note says why (46 census rows are in the same state). Everything else is "
                  "first-party: established 2014 per its own about page (LinkedIn says 2012 — the company's "
                  "own page wins), co-founded by Kevin Kumala, whose cassava-bag 'drink the plastic' demo "
                  "carried Bali's plastic fight onto CNN and NBC in 2017; HQ and Jakarta branch from its "
                  "own contact page. avanieco.com answered 200 on the read date."),
  "confidence": 0.6,
  "sources": [
    "https://avanieco.com/about-us/",
    "https://www.avanieco.com/contact/",
    "https://www.linkedin.com/company/avani-eco",
    "http://www.arthaplatform.com/newsdetails/doen-foundation-supports-avani/1022/",
    "https://edition.cnn.com/2017/01/16/world/cassava-plastic/index.html",
    "https://www.wamda.com/2022/10/mbrif-provides-680000-guarantee-avani-eco",
  ],
  "site_status": "ok",
  "liveness_checked": TODAY,
  "_geocode": ["Jalan Cargo Permai, Ubung Kaja, Denpasar", "Ubung Kaja, Denpasar"],
 },
]

# Bali envelope (per-row metro rule — never the Jakarta or Bandung one)
ENV = {"lat": (-8.95, -8.05), "lon": (114.80, 115.70)}

# mirror of build-census.js SECTOR_KEYS, first-match-wins, for the assertion
SECTOR_KEYS = [
    (r"climate|carbon|sustainab|renewable|solar|waste|recycl|circular|\besg\b|emission|mangrove|reforest|air.quality|clean energy|bioplastic|reuse|refill|ev charging|charging network", "climate"),
    (r"^licensed (digital )?bank", "bank"),
    (r"^web3/crypto", "crypto"),
    (r"fintech|payment|wallet|lend|bnpl|wealth|invest|remit|bank", "fintech"),
    (r"insur", "misc"),
    (r"commerce|marketplace|retail|grocer", "commerce"),
    (r"logist|deliver|freight|supply|warehous|courier", "logistics"),
    (r"health|pharma|biotech|\bbio\b|medic|telemed", "health"),
    (r"edtech|educat|upskill|learn", "edtech"),
    (r"saas|enterprise|b2b|pos |dev tool|software", "saas"),
    (r"\bai\b|artificial|data|cloud|cyber|it service", "ai-cloud"),
    (r"media|gaming|game|stream|entertain|creator|music|video", "media"),
    (r"travel|mobilit|transport|automotive|ride", "travel"),
    (r"prop|construction|hospitality|real estate", "prop"),
    (r"agri|aqua|fish|farm|rural", "agri"),
    (r"f&b|fnb|food|kitchen|coffee|d2c|consumer brand|new retail", "fnb"),
    (r"hr |talent|legal|climate|energy|misc", "misc"),
]


def sector_key(s):
    for pat, key in SECTOR_KEYS:
        if re.search(pat, s or "", re.I):
            return key
    return "misc"


def geocode(queries, kind_hint=None):
    for q in queries:
        try:
            u = "https://photon.komoot.io/api/?" + urllib.parse.urlencode({"q": q, "limit": 3})
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "census-geocode/1.0"}), timeout=15) as r:
                fc = json.load(r)
            for f in fc.get("features", []):
                lon, lat = f["geometry"]["coordinates"][:2]
                if ENV["lat"][0] <= lat <= ENV["lat"][1] and ENV["lon"][0] <= lon <= ENV["lon"][1]:
                    kind = kind_hint or f.get("properties", {}).get("osm_key", "road")
                    kind = "building" if kind == "building" else ("road" if kind == "highway" else kind)
                    return lat, lon, "photon:" + q, kind
        except Exception as e:
            print("  geocode try failed:", e, file=sys.stderr)
    return None


def main():
    for row in ROWS:
        got = sector_key(row["sector"])
        want = row["_sector_key"]
        if got != want:
            sys.exit(f"{row['id']}: sector string routes to {got!r}, not {want!r} — rewrite it before writing the row")

    with open(RAW, encoding="utf-8") as fh:
        raw = json.load(fh)
    byid = {c.get("id"): c for c in raw["companies"]}

    added = updated = 0
    for row in ROWS:
        want = {k: v for k, v in row.items() if not k.startswith("_")}
        cur = byid.get(row["id"])
        if cur is None:
            cur = dict(want)
            raw["companies"].append(cur)
            byid[row["id"]] = cur
            added += 1
            print("ADDED", row["id"])
        else:
            cur.update(want)  # restore owned fields, leave logo/sprite/geocode alone
            updated += 1
            print("RESTORED", row["id"])
        if not cur.get("lat"):
            g = geocode(row.get("_geocode", []), row.get("_geocode_kind"))
            if g:
                cur["lat"], cur["lon"], cur["geocode_src"], cur["geocode_kind"] = g
                cur["geocode_tries"] = cur.get("geocode_tries", 0) + 1
                print("  geocoded:", g)
            else:
                print("  UNLOCATED (photon found nothing inside the Bali envelope)")

    # scope: this script is the ONE deliberate owner of the rule edit (see
    # docstring); entries merge by name and REPLACED drops the Timedoor line.
    scope = raw.setdefault("scope", {})
    # Since 28 Sep 2026 the census is nationwide and scripts/census-national.py
    # owns the rule; a repair re-run here must not put the three-metro text back.
    if not scope.get("nationwide_added"):
        scope["rule"] = RULE
    scope["bali_added"] = TODAY
    scope["outside"] = [e for e in scope.get("outside", []) if e.get("name") not in REPLACED]

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, RAW)
    print(f"{added} added, {updated} updated -> {len(raw['companies'])} companies; scope.outside: {len(scope['outside'])}")


if __name__ == "__main__":
    main()
