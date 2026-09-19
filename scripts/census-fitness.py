#!/usr/bin/env python3
"""Fitness cohort — FIT HUB, FTL Gym, DOOgether, STRONGBEE + the scope lines
(Aug 30 2026).

Luca: "it seems you havent include fithub, ftl and tech based gym." Correct —
the census had ZERO fitness companies and none in any register: tech-enabled
fitness was on none of the sector lists the earlier sweeps walked (the same
blind spot that hid StickEarn's adtech).

Verified the way the census demands: entity from a primary record (own site
footer / privacy policy / registry / the company's own app-store seller name),
funding only where an amount is public and linked, headcount from a LIVE
LinkedIn read with the spread stated, site fetched today. The lane's
conventional operators (ReFIT, Gold's, Celebrity Fitness, Fita, dormant Fitco)
go to the published scope register, not into silence — a scope decision that
exists only in a script is indistinguishable from a gap.

Money rules applied: FTL's US$3M OCBC Ventura facility is venture DEBT, not
equity, so its funding is a dash with the history in the note (the AdaKami
rule). FIT HUB's US$12M Series A is press-reported (DealStreetAsia), never
company-announced — counted at US$18.5M total with the tier named on the row.

Idempotent UPSERT + scope append: re-running restores exactly these fields and
never duplicates scope lines.

    python3 scripts/census-fitness.py && node scripts/build-census.js
"""
import json, os, tempfile

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-30'

ROWS = [
 {
  "name": "FIT HUB (FitHub)", "id": "fithub",
  "legal_name": "PT Jaya Digital Properti",
  "sector": "health & fitness — tech-enabled affordable gym chain; app-led membership, classes and personal training across 100+ clubs",
  "in_dki": True,
  "hq_address": "Pacific Century Place Lt. 27, Jl. Jend. Sudirman Lot 10 Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190",
  "kecamatan": "Kebayoran Baru", "kota": "Jakarta Selatan",
  "lat": -6.22768, "lon": 106.80847,
  "geocode_kind": "building",
  "geocode_src": "photon: Pacific Century Place (building), Kebayoran Baru",
  "url": "https://fithub.id",
  "funding_total_usd_m": 18.5,
  "last_round": "Series A (US$12M, reported — Wavemaker/Cercano)", "last_round_year": 2024,
  "funding_src_manual": "https://www.prnewswire.com/apac/news-releases/fit-hub-secures-us6-5m-to-expand-tech-enabled-fitness-solutions-in-indonesia-301793079.html",
  "funding_src_all": [
    "https://www.prnewswire.com/apac/news-releases/fit-hub-secures-us6-5m-to-expand-tech-enabled-fitness-solutions-in-indonesia-301793079.html",
    "https://www.dealstreetasia.com/stories/fit-hub-wavemaker-cercano-399274"],
  "funding_note": (
    "US$6.5M is company-announced (own release, Apr 2023): a US$3M seed in early 2022 from Global "
    "Founders Capital, Trihill Capital and Goodwater Capital, plus a US$3.5M seed extension in Dec "
    "2022 led by Wavemaker Partners with Trihill, East Ventures, Gentree and BAce Capital. The "
    "US$12M Series A (Wavemaker and Cercano Management) was reported by DealStreetAsia in Jun 2024 "
    "and is carried by PitchBook, but the company never announced it — read the US$18.5M total as "
    "announced 6.5 + reported 12. Trackers disagree with each other (CB Insights says 13, Caplight "
    "33.5); neither total has a source behind it."),
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 1356,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/fit-hub-id/",
  "employees_kind": "linkedin",
  "employees_note": (
    "LinkedIn lists 1,356 people on the company page, read 2026-08-30 (its own size band, "
    "1,001-5,000, corroborates the scale). Vendor models sit far lower — one carried 618 (+20.5% "
    "YoY) in mid-2026 and PitchBook 129 — because they model the desk organisation, while the page "
    "count includes club coaches and front-desk staff across 100+ clubs. Some clubs are "
    "partner-operated, so part of that workforce may sit on partners' payrolls; read the count as "
    "the top of a wide spread."),
  "investors": ["Global Founders Capital", "Wavemaker Partners", "Trihill Capital", "Goodwater Capital",
                "East Ventures", "Gentree", "BAce Capital", "Cercano Management (reported)"],
  "sources": [
    "https://www.prnewswire.com/apac/news-releases/fit-hub-secures-us6-5m-to-expand-tech-enabled-fitness-solutions-in-indonesia-301793079.html",
    "https://www.dealstreetasia.com/stories/fit-hub-wavemaker-cercano-399274",
    "https://fithub.id/free-trial/v3",
    "https://www.linkedin.com/company/fit-hub-id/",
    "https://indonesia.endeavor.org/from-zero-to-300000-how-william-tjajadi-ceo-co-founder-of-fit-hub-found-greatness-after-navigating-global-chaos/",
    "https://mediaindonesia.com/jabar/berita/926310/diduga-jalankan-franchise-ilegal-fithub-kopo-dan-surya-sumantri-ditutup"],
  "site_status": "ok", "liveness_checked": TODAY,
  "confidence": 0.85,
  "verify_note": (
    "Founded Aug 2020, CEO and co-founder William Tjajadi (Endeavor Indonesia's ScaleUp blog "
    "profiles him; the company is not on Endeavor's entrepreneur roster, so no tag). Legal entity "
    "and head office are FIT HUB's own consumer-complaint footer — PT Jaya Digital Properti, "
    "Pacific Century Place Lt. 27 — and the same PT is the seller of its App Store app. One live "
    "dispute worth carrying: from 24 Aug 2026 a business partner, PT Asimah Citraprasada Nusantara, "
    "closed the two partner-run Bandung clubs (Kopo, Surya Sumantri), alleging the cooperation was "
    "marketed as a franchise while unregistered (no STPW at the Trade Ministry) — that is the "
    "partner's allegation as reported by Media Indonesia; no company response is on record yet, and "
    "the Jakarta operation is unaffected. Operating and hiring as of today."),
 },
 {
  "name": "FTL Gym", "id": "ftl-gym",
  "legal_name": "PT Lebih Cepat Dari Cahaya",
  "sector": "health & fitness — 24-hour gym chain (Faster Than Light); group classes, Pilates+ studios and the FTL STRIDE app",
  "in_dki": True,
  "hq_address": "Jl. Tanjung Duren Raya No. 21, Grogol Petamburan, Jakarta Barat 11470",
  "kecamatan": "Grogol Petamburan", "kota": "Jakarta Barat",
  "lat": -6.17399, "lon": 106.78559,
  "geocode_kind": "building",
  "geocode_src": "photon: FTL Gym (OSM fitness_centre POI), Grogol Petamburan",
  "url": "https://ftlgym.com",
  "funding_total_usd_m": None,
  "last_round": "Venture debt (OCBC Ventura)", "last_round_year": 2024,
  "funding_note": (
    "US$3M of venture DEBT from OCBC Ventura, reported by DealStreetAsia on 9 Jul 2024 (Dealroom "
    "carried the facility as US$3-5M). A loan facility is not equity funding, so it is not counted "
    "— the same rule that keeps AdaKami's Superbank facility out of its row. No equity round has "
    "ever been publicly disclosed."),
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 853,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/ftl-gym/",
  "employees_kind": "linkedin",
  "employees_note": (
    "LinkedIn lists 853 people on the company page, read 2026-08-30. Its self-declared band says "
    "1,001-5,000 (higher than the count) and its Jobstreet employer profile still says 51-100 "
    "(stale-low) — the live count is the published figure. Trainers and coaches are recruited into "
    "staff roles (the GrowithFTL personal-trainer track), so the count is payroll-shaped, spread "
    "across roughly 40 outlets in Jabodetabek and Bandung."),
  "investors": ["OCBC Ventura (venture debt)"],
  "sources": [
    "https://www.dealstreetasia.com/stories/ftl-ocbc-ventura-402953",
    "https://companieshouse.id/lebih-cepat-dari-cahaya",
    "https://id.jobstreet.com/companies/pt-lebih-cepat-dari-cahaya-168553583164264",
    "https://www.linkedin.com/company/ftl-gym/",
    "https://ftlgym.com",
    "https://www.cbinsights.com/company/ftl-gym"],
  "site_status": "ok", "liveness_checked": TODAY,
  "confidence": 0.8,
  "verify_note": (
    "Founded 2020 (LinkedIn and CB Insights agree); founder Erik Susanto, with co-founder and COO "
    "Liem Willy Kurniawan Anindya per CB Insights' people page. The legal entity is nailed three "
    "ways: PT Lebih Cepat Dari Cahaya — Indonesian for Faster Than Light — is the Ministry "
    "registry record (no. 1122844) at Jalan Tanjung Duren Raya 21, the Jobstreet employer profile "
    "at the same address, and the App Store seller of FTL's own STRIDE app. LinkedIn's HQ field "
    "says Jakarta Pusat; the registry and Jobstreet say Tanjung Duren, Jakarta Barat — the filed "
    "address wins. FTL Ultra Mampang took a Jakarta Tourism Awards 'Leading Fitness Center' title "
    "(Jan 2026). Operating and expanding as of today."),
 },
 {
  "name": "DOOgether", "id": "doogether",
  "legal_name": "PT Generasi Muda Indonesia Utama",
  "sector": "health & fitness — fitness venue booking and corporate wellness platform",
  "in_dki": True,
  "hq_address": "Jl. Kemang Dalam IV No. K23, Bangka, Mampang Prapatan, Jakarta Selatan 12730",
  "kecamatan": "Mampang Prapatan", "kota": "Jakarta Selatan",
  "lat": -6.26978, "lon": 106.81895,
  "geocode_kind": "road",
  "geocode_src": "photon: Jalan Kemang Dalam IV, Bangka, Mampang Prapatan (street-level)",
  "url": "https://www.doogether.com",
  "funding_total_usd_m": None,
  "last_round": "Pre-Series A (Living Lab Ventures)", "last_round_year": 2022,
  "funding_note": (
    "Raised repeatedly, never with a public amount: the Dec 2022 pre-Series A led by Living Lab "
    "Ventures (Sinar Mas Land's venture arm) was announced without a figure — Katadata D-Insights "
    "covered it — and the earlier rounds were likewise undisclosed. PitchBook counts 9 investors "
    "across 5 rounds, no amounts. Nothing is invented for it."),
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 20,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/doogether",
  "employees_kind": "linkedin",
  "employees_note": (
    "LinkedIn lists 20 people on the company page, read 2026-08-30. PitchBook models 16 and one "
    "vendor 11 — read it as an 11-20 band. A small team, but a live one: the site is up, both its "
    "consumer and venue apps are maintained, and the page posts."),
  "investors": ["Living Lab Ventures (Sinar Mas)"],
  "sources": [
    "https://dinsights.katadata.co.id/read/2022/12/28/doogether-secures-fresh-funds-from-living-lab-ventures",
    "https://www.linkedin.com/company/doogether",
    "https://www.doogether.com",
    "https://www.waze.com/id/live-map/directions/id/daerah-khusus-ibukota-jakarta/doogether-(pt.-generasi-muda-indonesia-utama)"],
  "site_status": "ok", "liveness_checked": TODAY,
  "confidence": 0.75,
  "verify_note": (
    "Founded 2016-17; Indonesia's early fitness-booking play (the ClassPass shape), now selling "
    "corporate wellness programmes on top of venue booking. The PT is named on its own venue "
    "listings and is the App Store seller of both DOOgether apps. The registry mirror carries a "
    "registered address at Office 8 Lt. 18-A, SCBD (reg. 39/30188, 2017); the operating office is "
    "the Kemang Dalam IV address published on its listings — the row pins the operating office."),
 },
 {
  "name": "STRONGBEE", "id": "strongbee",
  "legal_name": "PT Strongbee Bakti Indonesia",
  "sector": "health & fitness — booking and studio-management software for wellness studios (white-label B2B)",
  "in_dki": True,
  "hq_address": "Jl. Wijaya I No. 64 Lt. 3, Petogogan, Kebayoran Baru, Jakarta Selatan 12160",
  "kecamatan": "Kebayoran Baru", "kota": "Jakarta Selatan",
  "lat": -6.23933, "lon": 106.81492,
  "geocode_kind": "road",
  "geocode_src": "photon: Jalan Wijaya I, Kebayoran Baru (street-level)",
  "url": "https://www.strongbee.co.id",
  "funding_total_usd_m": None,
  "last_round": None, "last_round_year": None,
  "funding_note": (
    "No funding round has ever been publicly disclosed, and no figure is invented for it. "
    "CompassList profiled the business in Jul 2020, in its consumer sports-booking era; it has "
    "since pivoted to white-label B2B software for wellness studios."),
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 15,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/strongbee-co-id",
  "employees_kind": "linkedin",
  "employees_note": (
    "LinkedIn lists 15 people on the company page, read 2026-08-30; its own size band (11-50) "
    "corroborates. A desk team — since the pivot to studio software the trainers and studios on "
    "the platform are customers, not staff."),
  "investors": [],
  "sources": [
    "https://www.strongbee.co.id/about",
    "https://www.strongbee.co.id/contact",
    "https://strongbee.co.id/privacy_policies",
    "https://www.linkedin.com/company/strongbee-co-id",
    "https://www.compasslist.com/insights/sports-directory-and-booking-app-strongbee-helps-indonesians-to-keep-moving-even-during-covid-19"],
  "site_status": "ok", "liveness_checked": TODAY,
  "confidence": 0.75,
  "verify_note": (
    "The PT is named in STRONGBEE's own privacy policy and is the App Store seller of both its "
    "apps (STRONGBEE, STRONGBEE Partner). The contact page gives Jl. Wijaya I No. 64 Lt. 3; the "
    "privacy policy still carries the older No. 73 on the same street — the row uses the contact "
    "page. Operating: site live, apps in stores, LinkedIn active."),
 },
]

# Published scope lines — the rest of the lane, adjudicated in the open. Keyed
# by name; re-running replaces rather than duplicates.
SCOPE = [
 {"name": "ReFIT Indonesia", "owner": "PT Mitra Bugar Bersama",
  "why": "a conventional gym-franchise business — its site sells kemitraan packages — not tech- or venture-built; fails the first test"},
 {"name": "Gold's Gym Indonesia", "owner": "PT Fit And Health Indonesia",
  "why": "the Indonesian franchise of a US brand, run as a conventional chain since 2007 — an incumbent, not a startup"},
 {"name": "Celebrity Fitness & Fitness First", "owner": "Evolution Wellness (Singapore)",
  "why": "foreign-owned incumbent chains with no venture history and no Indonesian carve-out to count"},
 {"name": "Fita", "owner": "PT Telkomsel",
  "why": "Telkomsel's wellness app — an incumbent's product line with no legal entity of its own (the Jenius rule)"},
 {"name": "Fitco / The Fit Company", "owner": "East Ventures-seeded wellness group",
  "why": "dormant: fitco.id and thefitcompany.id are both unreachable and LinkedIn is down to one listed person; its 20FIT brand survives separately"},
 {"name": "20FIT (Group)", "owner": "entity unverified",
  "why": "not excluded — queued: the Kebayoran Baru hub operates (58 on LinkedIn) but its legal entity after The Fit Company restructure is unverified; it joins the census when the PT is confirmed"},
]


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by = {c.get('id'): c for c in raw['companies']}
    added = updated = 0
    for row in ROWS:
        cur = by.get(row['id'])
        if cur is None:
            raw['companies'].append(dict(row))
            added += 1
            print(f"added   {row['id']:12s} {row['name']}")
        else:
            cur.update(dict(row))
            updated += 1
            print(f"updated {row['id']:12s} {row['name']}")
    scope = raw.setdefault('scope', {})
    # the live rule now carries a geography sentence (Bandung, added Aug 30) —
    # only seed the rule when it is missing, never overwrite it from here
    scope.setdefault('rule', (
        "A company is counted when it was built or bought by tech or venture money rather than run "
        "as an incumbent's product line, when it is its own legal entity, and when a headcount can "
        "be sourced. All three have to hold."))
    sc = scope.setdefault('outside', [])
    have = {e.get('name'): e for e in sc}
    for e in SCOPE:
        if e['name'] in have:
            have[e['name']].update(e)
        else:
            sc.append(dict(e))
    print(f"scope: {len(sc)} outside lines ({len(SCOPE)} owned here)")
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)
    print(f"{added} added, {updated} updated -> {len(raw['companies'])} companies")


if __name__ == '__main__':
    main()
