#!/usr/bin/env python3
"""CLOUD COHORT — Indonesian cloud-infrastructure providers (Aug 30 2026).

Luca: "in bandung i believe there is idcloudhost and other cloud provider, also
awan.io in jakarta etc — is it counted as startup? if yes put them."

The answer is yes, by the census's own three tests (tech- or founder-built, its
own legal entity, a sourceable headcount) — and the census already carried the
precedent twice: Dewaweb (bootstrapped cloud host, Jakarta Barat) and Elitery
(managed cloud, Jakarta Selatan) are counted rows. This script adds the rest of
the qualifying category. Two geography surprises from verification:

  · IDCloudHost is NOT a Bandung company today. PT Cloud Hosting Indonesia's
    registered office is Sentral Senayan 2 Lt. 16, Jakarta Pusat (Ministry of
    Law registry + its own LinkedIn primary location), and its current office
    list is Jakarta + Sukabumi + Pekanbaru — Bandung is the 2015 founding city
    only. Filed wins.

  · awan.io is exactly what Luca remembered: Awanio, PT Awan Komputasi
    Teknologi, Treasury Tower (District 8 SCBD). NOT to be confused with the
    IDX ticker AWAN, which is PT Era Digital Media Tbk — Eranyacloud's parent
    and a different company entirely.

What is deliberately NOT here goes to the published scope register: incumbent
cloud arms (they fail the first test), foreign hosting groups' Indonesian
product lines (the Maxim shape), out-of-region hosts, and system integrators
selling engineering services (the agency rule).

Idempotent UPSERT: re-running restores exactly these fields on an existing row
(the repair path after a cross-session clobber) and leaves everything else —
logo, sprite, liveness stamps — alone. Scope entries merge BY NAME and the
script never reassigns scope['rule'] (the census-fitness lesson).

    python3 scripts/census-cloud.py && node scripts/build-census.js
"""
import json, os, tempfile

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-30'

# ── the cohort ───────────────────────────────────────────────────────
# `sector` wording is load-bearing: build-census.js SECTOR_KEYS is first-match-
# wins. Every string here is written to land in 'ai-cloud' (the /cloud/ rule) —
# no earlier bucket word appears in any of them (no "enterprise", "software",
# "b2b", "payment", "marketplace", "supply"...). Dewaweb set the precedent.
ROWS = [
 {
  "name": "IDCloudHost", "id": "idcloudhost",
  "legal_name": "PT Cloud Hosting Indonesia",
  "sector": "cloud infrastructure — cloud VPS, bare metal, object storage, colocation, web hosting and domains",
  "in_dki": True,
  "hq_address": "Sentral Senayan II Lt. 16, Jl. Asia Afrika No. 8, Gelora, Kec. Tanah Abang, Jakarta Pusat 10270",
  "kecamatan": "Tanah Abang", "kota": "Jakarta Pusat",
  "lat": -6.22367, "lon": 106.79899,
  "geocode_kind": "building",
  "geocode_src": "photon: Sentral Senayan 2, Tanah Abang (building-level)",
  "url": "https://idcloudhost.com",
  "funding_total_usd_m": 5.0,
  "last_round": "Seed, Mar 2021 — US$5M from Init 6",
  "last_round_year": 2021,
  "employees_est": 78,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/idcloudhost",
  "employees_note": (
    "LinkedIn lists 78 people on the company page, read 2026-08-30; its own size band says 51-200, "
    "which brackets the count. Exa's workforce record models 60 — the spread is recorded, the live "
    "count is published."),
  "investors": ["Init 6"],
  "verify_note": (
    "LUCA ASKED WHETHER THIS IS A BANDUNG COMPANY — IT IS NOT, ANY MORE: PT Cloud Hosting "
    "Indonesia (registry no. 700340) is registered at Sentral Senayan 2 Lt. 16, Jl. Asia Afrika "
    "No. 8, Jakarta Pusat, and LinkedIn's primary-location list (Jakarta, Sukabumi, Pekanbaru) "
    "carries no Bandung office — Bandung is the 2015 founding city, where CEO Alfian Pamungkas "
    "Sakawiguna studied at Telkom University. Filed address wins. FUNDING: US$5M from Init 6 "
    "(Achmad Zaky's fund), announced 23 Mar 2021 — its first outside capital after six "
    "bootstrapped years. CB Insights adds a US$3.46M 'corporate minority' from Bukalapak in Mar "
    "2022 for a US$8.46M total, but no announcement exists behind it, so the announced US$5M is "
    "what is published (tracker figure noted, not mixed in); Dealroom's claim of Mandiri Capital "
    "participation in the 2021 round is unsupported by any contemporaneous source and ignored. "
    "Acquired the hosting brand DewaBiz in May 2019. Operating evidence is fresh: a colocation "
    "push covered 26-28 Aug 2026, an AI anti-DDoS launch with StormWall in May 2026, a healthcare "
    "AI-infrastructure deal in Feb 2026, and a LinkedIn post two days before the read. "
    "idcloudhost.com serves a Cloudflare challenge to this VM's checker — that blocks our probe "
    "and is not evidence about the company."),
  "confidence": 0.85,
  "sources": [
    "https://companieshouse.id/cloud-hosting-indonesia",
    "https://teknologi.bisnis.com/read/20210324/266/1371820/raih-pendanaan-us5-juta-dari-init-6-idcloudhost-incar-pasar-asia",
    "https://www.thejakartapost.com/news/2021/03/24/bukalapak-founder-injects-5m-in-indonesian-cloud-hosting-start-up",
    "https://init-6.fund/news/4",
    "https://www.linkedin.com/company/idcloudhost",
    "https://www.cbinsights.com/company/idcloudhost/financials",
    "https://wartaekonomi.co.id/read226310/bantu-ukm-kembangkan-bisnis-idcloudhost-akuisisi-dewabiz",
    "https://www.trenasia.id/tren-ekbis/id-cloud-host-tawarkan-colocation-server-untuk-bisnis-di-era-ai",
    "https://www.jpnn.com/news/idcloudhost-edelweiss-healthcare-group-bangun-infrastruktur-ai-untuk-sistem-kesehatan",
  ],
  "funding_src": "https://teknologi.bisnis.com/read/20210324/266/1371820/raih-pendanaan-us5-juta-dari-init-6-idcloudhost-incar-pasar-asia",
  "funding_src_tier": "announced",
 },
 {
  "name": "Qwords", "id": "qwords",
  "legal_name": "PT Qwords Company International",
  "sector": "cloud and web hosting — managed hosting, cloud VPS, domains and data-center services",
  "in_dki": True,
  "hq_address": "Gedung Cyber 1 Lt. 3, Jl. Kuningan Barat No. 8, Kuningan Barat, Kec. Mampang Prapatan, Jakarta Selatan 12710",
  "kecamatan": "Mampang Prapatan", "kota": "Jakarta Selatan",
  "lat": -6.2387, "lon": 106.82406,
  "geocode_kind": "building",
  "geocode_src": "photon: Cyber Tower (Gedung Cyber), Kuningan Barat, Mampang Prapatan (building-level)",
  "url": "https://www.qwords.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 48,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/qwords",
  "employees_note": (
    "LinkedIn lists 48 people on the company page, read 2026-08-30; its own size band of 51-200 "
    "sits above the count and looks stale-high. Exa's workforce record models 38 with a -27.6% "
    "year-on-year contraction including the CTO's April 2026 departure — a tracker model, recorded "
    "here as the spread, while the live count is what is published."),
  "investors": [],
  "verify_note": (
    "Founded 10 Jul 2005 in Bandung by Rendy Maulana Akbar, then an ITB student — one of the "
    "oldest Indonesian hosting companies, and the founder now chairs the cloud-and-hosting "
    "association ACHI. The operational HQ moved to Jakarta long ago: PT Qwords Company "
    "International's own /jakarta-office page, its LinkedIn HQ field and its PeeringDB record all "
    "give Gedung Cyber 1 Lt. 3, Kuningan Barat (tenant since 2011); Bandung remains a branch at "
    "Jl. Terusan Setra Indah I No. 19, Sukajadi, alongside Sleman and Surabaya offices and a "
    "second Jakarta office in SCBD. NO OUTSIDE CAPITAL EVER DISCLOSED — no round appears in any "
    "tracker or news archive, and a 2013 SWA profile still had the founder inviting investors — "
    "but an explicit bootstrap statement was not found either, so the row says 'no outside "
    "capital on record' rather than 'bootstrapped'. The registry record for the PT itself was "
    "unreachable, so no registry number is carried; the group's registrar affiliate PT Aksara "
    "Data Digital (reg. 1131299, same Cyber 1 address, ICANN-accredited 2022) and ISP affiliate "
    "PT Jejaring Cepat Indonesia are related entities and are NOT counted — the row is keyed to "
    "PT Qwords Company International alone. PANDI-accredited .id registrar since 2016, "
    "ISO 27001, PSE-registered."),
  "confidence": 0.8,
  "sources": [
    "https://qwords.co.id/jakarta-office/",
    "https://qwords.co.id/history/",
    "https://www.linkedin.com/company/qwords",
    "https://www.peeringdb.com/org/5512",
    "https://id.wikipedia.org/wiki/Qwords",
    "https://peluangusaha.kontan.co.id/news/merintis-bisnis-webhosting-dari-kafe-ke-kafe-1",
    "https://swa.co.id/read/59459/rendy-maulana-akbar-raja-hosting-yang-terobsesi-jadi-pemain-dunia",
    "https://www.datacenterdynamics.com/en/videos/dcdtalks-indonesian-data-center-market-and-customer-retention-with-rendy-maulana-qwords/",
  ],
 },
 {
  "name": "Awanio (awan.io)", "id": "awanio",
  "legal_name": "PT Awan Komputasi Teknologi",
  "sector": "cloud infrastructure — sovereign virtualization and orchestration stack (cluster manager, hypervisor OS, white-label multi-tenant cloud) run by local providers",
  "in_dki": True,
  "hq_address": "Treasury Tower, District 8 SCBD, Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190",
  "kecamatan": "Kebayoran Baru", "kota": "Jakarta Selatan",
  "lat": -6.22793, "lon": 106.8063,
  "geocode_kind": "building",
  "geocode_src": "same building as the bukalapak row (Treasury Tower, District 8 SCBD)",
  "url": "https://awan.io",
  "funding_total_usd_m": None,
  "last_round": "Seed, Apr 2022 — Init 6, amount undisclosed",
  "last_round_year": 2022,
  "employees_est": 19,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/awanio",
  "employees_note": (
    "LinkedIn lists 19 people on the company page, read 2026-08-30; its own size band says 11-50, "
    "which brackets the count. Exa's workforce record models 13 — spread recorded."),
  "investors": ["Init 6"],
  "verify_note": (
    "THE COMPANY LUCA MEANT BY 'awan.io' — that is its canonical domain (awanio.com answers a 522 "
    "and looks abandoned; the working site, Instagram handle and footer all say awan.io / Awanio). "
    "PT Awan Komputasi Teknologi per its own LinkedIn page title and the Synnex Metrodata "
    "partnership announcement; no registry record surfaced, so no registry number is carried. "
    "Builds the sovereign-cloud layer rather than running one: a virtualization/orchestration "
    "platform (Cockpit cluster manager, Vapor hypervisor OS, white-label multi-tenant cloud — a "
    "VMware-exit stack) that local providers and integrators deploy, TKDN-certified at 98.68% and "
    "distributed through Synnex Metrodata. Started 2018 as founder Iskandar Soesman's side "
    "project, full-time from 2021 with co-founders Agung Surya Bangsa, Akbar Kusuma Negara and "
    "Irfan Yuta Pratama. NO AMOUNT IS PUBLISHED for the April 2022 seed from Init 6 — kumparan, "
    "the company's own announcement and Init 6's page all say undisclosed, and CB Insights "
    "carries only an unattributed round. DISAMBIGUATION: the IDX ticker AWAN is PT Era Digital "
    "Media Tbk, Eranyacloud's parent — a different company; do not join their records."),
  "confidence": 0.85,
  "sources": [
    "https://awan.io/",
    "https://id.linkedin.com/company/awanio",
    "https://init-6.fund/news/12",
    "https://kumparan.com/kumparantech/pendiri-bukalapak-achmad-zaky-investasi-di-startup-cloud-awanio-1xuWyCvL3gP",
    "https://mediaasuransinews.co.id/ekonomi-digital/synnex-metrodata-gandeng-awanio-berikan-solusi-komputasi-awan-tkdn-9868/",
    "https://www.goodnewsfromindonesia.id/2025/10/13/inovasi-produk-digital-awanio-dari-cloud-lokal-jadi-pilihan-global",
  ],
 },
 {
  "name": "CloudKilat (Infinys)", "id": "cloudkilat",
  "legal_name": "PT Infinys System Indonesia",
  "sector": "cloud infrastructure — IaaS, VPS, object storage and web hosting under the CloudKilat and Infinyscloud brands",
  "in_dki": True,
  "hq_address": "Pakuwon Tower Lt. 9, Jl. Casablanca Kav. 88, Menteng Dalam, Kec. Tebet, Jakarta Selatan 12870",
  "kecamatan": "Tebet", "kota": "Jakarta Selatan",
  "lat": -6.22189, "lon": 106.84294,
  "geocode_kind": "building",
  "geocode_src": "photon: Pakuwon Tower, Tebet (building-level)",
  "url": "https://www.cloudkilat.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 62,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/infinyscloud",
  "employees_note": (
    "LinkedIn lists 62 people on the company page (kept under the Infinyscloud brand name), read "
    "2026-08-30, against a self-declared band of 11-50 — the band is a stale self-declaration and "
    "the live count is published. Exa's workforce record models 52 (+15.8% YoY) and Getlatka 55; "
    "spread recorded."),
  "investors": [],
  "verify_note": (
    "CloudKilat is a brand, not a company — 'dihadirkan oleh PT Infinys System Indonesia' per its "
    "own FAQ, with Infinyscloud as the sibling brand for larger deployments; the row is the PT, "
    "carrying both brands, and both sites are live. One of the oldest dedicated Indonesian cloud "
    "companies: the PT dates to 2006 (an early Microsoft hosting partner in 2009), launched "
    "CloudKilat for SMEs on 25 Sep 2013 and deployed Indonesia's first Cloudian object storage "
    "the same year. NO FUNDING ROUND HAS EVER BEEN DISCLOSED — Getlatka models it at US$0 raised "
    "— and no registry number surfaced. Founders are not published; Louis Larry (Director) and "
    "Irvan Riccasanta (COO) are the named officers, and alumnus Dondy Bappedyanto now runs "
    "competitor Biznet Gio."),
  "confidence": 0.75,
  "sources": [
    "http://www.cloudkilat.com/rujukan/tanya-jawab/apa-itu-cloudkilat",
    "https://www.cloudkilat.com/id/",
    "https://www.linkedin.com/company/infinyscloud",
    "https://www.isi.co.id/platform/cloudkilat/",
    "https://www.prnewswire.com/news-releases/pt-infinys-system-indonesia-chooses-cloudian-to-bring-first-object-storage-solution-to-indonesia-210218261.html",
    "https://united-comm.com/infinys-tawarkan-cloudkilat-bagi-ukm-usaha-pemula-dan-personal-dengan-harga-terjangkau/",
    "https://getlatka.com/companies/infinys-system-indonesia",
  ],
 },
 {
  "name": "Herza Cloud", "id": "herza-cloud",
  "legal_name": "PT Herza Digital Indonesia",
  "sector": "cloud and web hosting — VPS, dedicated servers and colocation across Indonesian and regional zones",
  "in_dki": True,
  "hq_address": "EightyEight@Kasablanka Tower A Lt. 12, Jl. Casablanca Raya Kav. 88, Menteng Dalam, Kec. Tebet, Jakarta Selatan 12870",
  "kecamatan": "Tebet", "kota": "Jakarta Selatan",
  "lat": -6.22336, "lon": 106.84244,
  "geocode_kind": "building",
  "geocode_src": "same building as the ringkas row (Kota Kasablanka Office 88 tower)",
  "url": "https://herza.cloud",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 40,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/herzaid",
  "employees_note": (
    "LinkedIn lists 40 people on the company page, read 2026-08-30; its own size band says 11-50."),
  "investors": [],
  "verify_note": (
    "Started in Makassar as CV dBOXES Web Solutions (2006) and converted to PT Herza Digital "
    "Indonesia in May 2019 with the head office in Jakarta — LinkedIn's primary location, its "
    "PeeringDB record and an EMIS company profile all give the Office 88 tower at Kota "
    "Kasablanka, and Makassar remains a second office. Runs its own data-center footprints "
    "('Herza DC - Cyber1', 'Herza DC - Tifa' per PeeringDB) plus a Singapore subsidiary, Herza "
    "Singapore Pte Ltd. No funding round is on record. herza.cloud answers this VM's checker "
    "with a 403 bot-shield — the client portal renders and the LinkedIn page posted a month "
    "before the read (SANOG 44), so the block is the shield, not the company."),
  "confidence": 0.7,
  "sources": [
    "https://www.linkedin.com/company/herzaid",
    "https://www.peeringdb.com/org/26490",
    "https://www.emis.com/php/company-profile/ID/Pt_Herza_Digital_Indonesia_en_14633972.html",
    "https://clients.herza.cloud/",
  ],
 },
 {
  "name": "Klikserver", "id": "klikserver",
  "legal_name": "PT Bandhawa Tri Tirta",
  "sector": "cloud infrastructure — dedicated servers, colocation and cloud VPS in Jakarta data centers",
  "in_dki": True,
  "hq_address": "Gedung Office 8 Lt. 18-A, SCBD Lot 28, Jl. Senopati No. 8, Senayan, Kec. Kebayoran Baru, Jakarta Selatan 12190",
  "kecamatan": "Kebayoran Baru", "kota": "Jakarta Selatan",
  "lat": -6.22947, "lon": 106.806,
  "geocode_kind": "building",
  "geocode_src": "same building as the jejakin row (Gedung Office 8, SCBD)",
  "url": "https://www.klikserver.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 8,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/klikserver",
  "employees_note": (
    "LinkedIn lists 8 people on the company page, read 2026-08-30; its own size band says 11-50, "
    "just above the count."),
  "investors": [],
  "verify_note": (
    "PT Bandhawa Tri Tirta per its own about page, founded 2014 by co-founder Dranatha Anward; "
    "registered office at Office 8 in SCBD with operations at Gedung IDC Duren Tiga (a Jakarta "
    "tier-3 data center) per its LinkedIn locations. Sells dedicated servers, colocation and "
    "cloud VPS on 10 Gbps local ports. No funding round has ever been announced. A small shop, "
    "counted the same way the census counts Nightspade and Glaid Studio — the tests are entity, "
    "headcount and being tech-built, not size."),
  "confidence": 0.62,
  "sources": [
    "https://www.klikserver.com/en/about-us/",
    "https://www.linkedin.com/company/klikserver",
  ],
 },
 {
  "name": "Hostnic", "id": "hostnic",
  "legal_name": "PT Linkgo Metro Teknologi",
  "sector": "cloud and web hosting — VPS, domains and shared hosting",
  "in_dki": True,
  "hq_address": "Perumahan Meruya Indah Blok J3, Meruya Utara, Kec. Kembangan, Jakarta Barat 11650",
  "kecamatan": "Kembangan", "kota": "Jakarta Barat",
  "lat": -6.20209, "lon": 106.74034,
  "geocode_kind": "road",
  "geocode_src": "photon: Jalan Meruya Indah, Kembangan (street-level)",
  "url": "https://www.hostnic.id",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 6,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/hostnic",
  "employees_note": (
    "LinkedIn lists 6 people on the company page, read 2026-08-30; its own size band says 11-50, "
    "above the count."),
  "investors": [],
  "verify_note": (
    "A hosting brand running since 2009, incorporated 26 Apr 2011 and under PT Linkgo Metro "
    "Teknologi's management since March 2020 per its own LinkedIn history — an ownership change "
    "recorded here, with no incumbent or foreign tie found behind the new PT. Data centers in "
    "Jakarta and Singapore; the self-service VPS panel is live. No funding round is on record, "
    "and a LinkedIn-derived US$4.3M revenue estimate circulating in vendor caches is not "
    "credible for a six-person shop and is not carried. Above the census's smallest counted "
    "rows and operating, unlike the excluded three-person Chatbiz."),
  "confidence": 0.55,
  "sources": [
    "https://www.linkedin.com/company/hostnic",
    "https://www.hostnic.id/hosting/cloud-vps/",
  ],
 },
 {
  "name": "ArdHosting", "id": "ardhosting",
  "legal_name": "PT Ardh Global Indonesia",
  "sector": "cloud and web hosting — domains and web hosting since 2000",
  "in_dki": False,
  "hq_address": None,
  "kecamatan": None, "kota": "Kota Tangerang",
  "url": "https://www.ardhosting.com",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "employees_est": 13,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/ardhglobal",
  "employees_note": (
    "LinkedIn lists 13 people on the company page, read 2026-08-30; its own size band says 11-50, "
    "which brackets the count."),
  "investors": [],
  "verify_note": (
    "PT Ardh Global Indonesia per its own about page — one of the oldest Indonesian hosts, "
    "selling hosting and domains since 2000, also behind the dijaminmurah.com and "
    "duniahosting.com brands. NO STREET ADDRESS IS PUBLISHED anywhere the sweep could find: "
    "LinkedIn puts the company and its staff in Tangerang, so the row is filed under Kota "
    "Tangerang and left unlocated rather than pinned to a guess — the same treatment as the "
    "addressless Bodetabek micro-companies. ardhosting.com answered 200 on the read date."),
  "confidence": 0.55,
  "sources": [
    "https://www.ardhosting.com/about-ardhosting-indonesia",
    "https://www.linkedin.com/company/ardhglobal",
  ],
 },
 {
  "name": "Eranyacloud", "id": "eranyacloud",
  "legal_name": "PT Era Awan Digital",
  "sector": "cloud infrastructure — VMs, Kubernetes clusters, block and object storage",
  "in_dki": True,
  "hq_address": "Jl. Cikini Raya No. 72, Cikini, Kec. Menteng, Jakarta Pusat 10330",
  "kecamatan": "Menteng", "kota": "Jakarta Pusat",
  "lat": -6.18706, "lon": 106.83635,
  "geocode_kind": "road",
  "geocode_src": "photon: Jalan Cikini Raya, Menteng (street-level)",
  "url": "https://eranyacloud.com",
  "funding_total_usd_m": None,
  "last_round": "Parent IPO, Apr 2023 — PT Era Digital Media Tbk (IDX: AWAN) raised Rp 75bn at group level, 80% earmarked for Eranyacloud",
  "last_round_year": 2023,
  "employees_est": 45,
  "employees_asof": TODAY,
  "employees_kind": "linkedin",
  "employees_src": "https://www.linkedin.com/company/eranya-cloud",
  "employees_note": (
    "LinkedIn lists 45 people on the company page, read 2026-08-30; its own size band says 11-50. "
    "Exa's workforce record models 32 — a >40% spread, so read the figure as a 32-45 band with "
    "the live count published."),
  "investors": [],
  "verify_note": (
    "Founder-built, then listed through the founder's own vehicle — the Krom shape, not the "
    "Jenius shape: PT Era Awan Digital (established 2020, its own entity and payroll) is a "
    "subsidiary of PT Era Digital Media Tbk, the mobile-content company of founder-CEO Shaane "
    "Harjani, whose LinkedIn styles the journey 'bootstrapped to IPO'. EDM listed on IDX on "
    "18 Apr 2023 as AWAN at Rp 100/share, raising Rp 75bn oversubscribed 114.8x, with 80% of "
    "proceeds earmarked for Eranyacloud — GROUP money, so this row's funding stays a dash under "
    "the same rule that keeps group figures off the Grab and Lalamove rows (idxchannel's share "
    "count is internally inconsistent with its own Rp figure and is not relied on). No valuation "
    "is carried: AWAN's market cap prices the parent, not this subsidiary. DISAMBIGUATION: the "
    "ticker AWAN is unrelated to Awanio/awan.io, a different census row."),
  "confidence": 0.85,
  "sources": [
    "https://eranyacloud.com/",
    "https://eranyacloud.com/en/company/",
    "https://www.linkedin.com/company/eranya-cloud",
    "https://eranyacloud.com/news-and-event/melalui-edm-awan-eranyacloud-melantai-di-bursa-efek-indonesia/",
    "https://market.bisnis.com/read/20230418/7/1647991/era-digital-awan-oversubscribe-1148-kali-saat-ipo-saham",
    "https://investasi.kontan.co.id/news/resmi-ipo-begini-rencana-penggunaan-dana-era-digital-media-awan",
    "https://ptedm.com/?page_id=18459",
  ],
 },
]

# ── who is deliberately NOT in the cohort ────────────────────────────
# Merged BY NAME into scope.outside — published on the landing page under
# WHERE THE LINE IS, so a considered name is never mistaken for a gap.
SCOPE_OUT = [
 {"name": "Biznet Gio", "owner": "PT Biznet Gio Nusantara — Biznet + Internet Initiative Japan (IIJ)",
  "why": "the cloud arm of the Biznet network-and-datacenter incumbent, run as a joint venture "
         "with Japan's IIJ — an incumbent's product line, not a tech- or venture-built company"},
 {"name": "Cloudeka / Deka GPU / GPU Merdeka (Lintasarta)", "owner": "PT Aplikanusa Lintasarta — Indosat Ooredoo Hutchison group",
  "why": "Lintasarta's cloud and GPU brands — Indonesia's first NVIDIA Cloud Partner sits here, "
         "but Lintasarta is a 1988 telco-infrastructure incumbent inside the Indosat group, so "
         "the first test fails twice over",
  "sources": ["https://www.datacenterdynamics.com/en/news/indosats-lintasarta-launches-ai-cloud-gpu-merdeka-in-indonesia/",
              "https://www.cloudeka.id/products/deka-gpu/"]},
 {"name": "Telco cloud and GPU arms — Telkomsigma/Flou, neuCentrIX, NeutraDC, Telkomsel GPUaaS, Indosat AI factory",
  "owner": "PT Telkom Indonesia (Persero) Tbk / Telkomsel / Indosat Ooredoo Hutchison",
  "why": "the state and private telcos' cloud, data-center and GPU product lines — Telkomsigma's "
         "Flou, Telkom's neuCentrIX and NeutraDC (PT Telkom Data Ekosistem), Telkomsel's GPUaaS "
         "and the Indosat-Ooredoo-Nokia-NVIDIA 1GW 'AI factory' announced Aug 2026. Incumbent "
         "arms, not startups (the Jenius rule)",
  "sources": ["https://www.telkomsigma.co.id/id/solusi-cloud/",
              "https://neucentrix.telkom.co.id/en",
              "https://www.telkomsel.com/en/enterprise/product-list-advanced-network-services/GPUaaS",
              "https://w.media/indosat-ooredoo-nokia-nvidia-partner-to-build-1gw-ai-factory-in-indonesia/"]},
 {"name": "Datacomm Cloud Business", "owner": "PT Datacomm Diangraha",
  "why": "the cloud business unit (launched 2015) of a network integrator founded in 1990 — an "
         "incumbent's product line",
  "sources": ["https://www.datacomm.co.id/release/datacomm-cloud-business-diluncurkan/"]},
 {"name": "CBN Cloud", "owner": "PT Cyberindo Aditama (CBN)",
  "why": "the cloud arm of a Jakarta ISP incumbent founded in 1996 — an incumbent's product line",
  "sources": ["https://cbncloud.co.id/en"]},
 {"name": "ION Cloud Nusantara", "owner": "PT Parsaoran Global Datatrans (ION Network)",
  "why": "a sovereign-cloud product line launched in April 2025 by a Jakarta ISP group — an "
         "incumbent's product line, not a company",
  "sources": ["https://investor.id/business/396137/layanan-cloud-nusantara-memperkuat-kedaulatan-digital-indonesia"]},
 {"name": "IndonesianCloud", "owner": "PT Indonesian Cloud — TRG Investama group",
  "why": "a 2011 Jakarta cloud provider, but built inside PT Teknologi Riset Global Investama's "
         "telecom-infrastructure holding rather than founder- or venture-built — group capital, "
         "the first test",
  "sources": ["https://senator.id/2026/01/19/kpk-soroti-portofolio-raja-menara-di-proyek-kabel-bawah-laut/"]},
 {"name": "Foreign hosting and GPU groups' Indonesian arms",
  "owner": "Exabytes (MY) · Hostinger (LT) · Zetta Group (AU) · EdgeMode (US) · Firmus (AU) · Lyrid (US) · the hyperscalers",
  "why": "locally present, foreign-built: Exabytes Indonesia (Penang group that absorbed "
         "Masterweb in 2019), Niagahoster (Hostinger's Yogyakarta arm, folded into the global "
         "brand in June 2025), Zettagrid Indonesia (PT Arupa Cloud Nusantara, Australian-owned), "
         "EdgeMode's Jakarta/Karawang GPU builds (Florida, OTC: EDGM), Firmus's Batam AI factory "
         "(Australia), Lyrid Indonesia (a five-person office of the San Jose company), and the "
         "hyperscalers' local PTs (Google Cloud Indonesia and peers). The Maxim rule: foreign "
         "companies expanding, and any Indonesian slice is unpublished",
  "sources": ["https://www.exabytes.my/blog/exabytes-acquires-indonesia-hosting-firm-master-web-network/",
              "https://www.hostinger.com/blog/niagahoster-hostinger-brand/",
              "https://www.zettagrid.id/news/2017/09/04/award-winning-australian-cloud-service-provider-zettagrid-now-available-in-indonesia/",
              "https://www.linkedin.com/company/edgemode",
              "https://www.thejakartapost.com/business/2026/06/29/australian-start-up-firmus-to-build-nvidia-powered-data-center-on-batam"]},
 {"name": "Hosts headquartered outside the census area",
  "owner": "Rumahweb, DomaiNesia/Nevacloud (Deneva), IDwebhost — Yogyakarta · Jagoan Hosting — Malang · Wowrack, Atrium — Surabaya · BOC — Bali · Computing ID — Mojokerto · FlazHost — Lebak",
  "why": "real Indonesian hosting companies whose head offices sit outside Greater Jakarta and "
         "the Bandung basin — outside the geography, the same line that keeps Komunal and "
         "Dagangan out. FlazHost is additionally a CV, not a PT",
  "sources": ["https://www.rumahweb.com/tentang/", "https://deneva.co.id/brands/",
              "https://www.peeringdb.com/org/11981"]},
 {"name": "Integrators, resellers and data-center real estate",
  "owner": "Epsindo · Nusatech · Valdo Compute Fabric · Lintas Teknologi · DCI Indonesia (IDX: DCII)",
  "why": "in the market but not cloud operators: Epsindo integrates and resells NVIDIA DGX "
         "systems, Nusatech resells Google Cloud VMs, Valdo manufactures modular AI data "
         "centers inside a BPO group, Lintas Teknologi is a telecom network integrator, and DCI "
         "is carrier-neutral colocation real estate — a different business from running a cloud",
  "sources": ["https://epsindo.ai/", "https://nusatech.co.id/google-cloud-vm-vps/",
              "https://stockanalysis.com/quote/idx/DCII/company/"]},
 {"name": "No entity or headcount to count",
  "owner": "GVAI (gva.co.id) · Jakartawebhosting · DapurHosting · Helipod · SinarCloud · Cloudpintar · Cloupod · RDPGRID · Pawpado",
  "why": "sites are live but no legal entity or sourceable headcount could be found for any of "
         "them, so the third test fails. GVAI is the one that matters: the only independent "
         "GPU-cloud claimant inside the geography (NVIDIA B300/GB200 menu, Jakarta HQ claim) — "
         "it joins the census the day a PT and a payroll surface",
  "sources": ["https://www.gva.co.id/", "https://www.jakartawebhosting.com/about"]},
 {"name": "Cloudmatika", "owner": "PT Awan Solusi Informatika — Tsukaeru Group (Nagano, Japan)",
  "why": "locally incorporated, but established in 2015 AS the Indonesian arm of Japan's Tsukaeru "
         "hosting group, which also runs Oz Hosting in Australia — a foreign incumbent expanding "
         "(the Maxim shape), not an Indonesian-built startup. Its LinkedIn's '100% Indonesian "
         "owned' line conflicts with its own about page's 'member of Japan's Tsukaeru Group', "
         "and the about page wins. Exa models ~11 staff",
  "sources": ["https://cloudmatika.co.id/en/about-cloudmatika",
              "https://www.itvoice.in/tsukaeru-group-launches-cloudmatika-cloud-services",
              "https://id.linkedin.com/company/cloudmatika"]},
 {"name": "CloudRaya", "owner": "Wowrack (Seattle, USA) — PT Wowrack Cepat Teknologi Nusantara, Surabaya",
  "why": "a public-cloud product of the US-headquartered Wowrack hosting group ('powered by "
         "Wowrack Indonesia' per its own LinkedIn), with the Indonesian PT registered in "
         "Surabaya — a brand, a foreign group and an out-of-region HQ, any one of which is "
         "disqualifying",
  "sources": ["https://www.linkedin.com/company/cloud-raya",
              "https://companieshouse.id/wowrack-cepat-teknologi-nusantara"]},
 {"name": "Btech (Boer Technology)", "owner": "PT Boer Technology, Bogor",
  "why": "inside the geography (Bogor) and genuinely independent — 166 people on a live LinkedIn "
         "read, bootstrapped since 2009 — but it is an open-source system integrator selling "
         "OpenStack/Kubernetes engineering and managed services, the same fee-for-service shape "
         "as the excluded software houses (the agency rule). A products pivot would reopen the "
         "question",
  "sources": ["https://btech.id/en/about-us/", "https://www.linkedin.com/company/btechpt"]},
 {"name": "DewaBiz + DewaVPS", "owner": "PT Cloud Hosting Indonesia (IDCloudHost) / PT Dewaweb",
  "why": "brands inside counted rows: DewaBiz was acquired by IDCloudHost in May 2019 (PT "
         "Dewabisnis Digital Indonesia, Bekasi, is part of that group) and DewaVPS is Dewaweb's "
         "own brand launched Dec 2024 — separate rows would double-count (the TikTok Shop rule)",
  "sources": ["https://wartaekonomi.co.id/read226310/bantu-ukm-kembangkan-bisnis-idcloudhost-akuisisi-dewabiz",
              "https://www.dewavps.com/about-us/"]},
]

# names this script used in an earlier revision and has since renamed —
# stripped on merge so a rename never leaves a stale duplicate line behind.
REPLACED = {"Cloudeka (Lintasarta)", "Telkom Cloud / neuCentrIX / NeutraDC", "DewaBiz"}


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by = {c.get('id'): c for c in raw['companies']}
    added = updated = 0
    for row in ROWS:
        cur = by.get(row['id'])
        if cur is None:
            raw['companies'].append(dict(row))
            added += 1
            print(f"added   {row['id']:14s} {row['name']}")
        else:
            cur.update(dict(row))
            updated += 1
            print(f"updated {row['id']:14s} {row['name']}")

    # scope register — merge by name, never reassign the rule sentence
    scope = raw.setdefault('scope', {})
    scope.setdefault('rule', '')
    mine = {e['name'] for e in SCOPE_OUT} | REPLACED
    scope['outside'] = [e for e in scope.get('outside', []) if e.get('name') not in mine] + SCOPE_OUT

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)
    print(f"{added} added, {updated} updated -> {len(raw['companies'])} companies")


if __name__ == '__main__':
    main()
