#!/usr/bin/env python3
"""BOLEH DICOBA DIGITAL (BDD) — single verified add (Aug 31 2026).

Luca: "try to check PT Boleh Dicoba Digital, i think this is also startup
from bandung." He is right on both counts, and the row is a judgment call
worth reading:

  · ENTITY — PT Boleh Dicoba Digital, established 21 Nov 2017, HQ Bandung
    (EMIS company profile, with filed 2024 financials: net sales +15.4%).
    The site's own footer gives the current office: Jl. Lembong No.32,
    Braga, Kec. Sumur Bandung (EMIS still carries an older Jalan Sunda
    address; the company's own page wins). Second office in Kemang,
    Jakarta; a Singapore desk (Hong Lim Complex) and a Hong Kong entity
    "ALWAYS KEEP BUILDING LIMITED" appear on the BDD SEA page.

  · THE AGENCY QUESTION — its own <title> says "Jasa Digital Marketing
    Agency" and EMIS classifies it Marketing Consulting Services: the same
    word that kept Btech (Boer Technology) out under the agency rule. What
    separates BDD is the venture test: it was built BY Brodo (a census row)
    as its own PT, and Brodo's Dec-2020 Series A — Sembrani Nusantara fund
    (BRI Ventures) + GDP Venture — was announced by the investors
    themselves as raised partly to scale BDD, then already the "cloud
    marketing" platform for Eiger, CottonInk, Kick Avenue, Rata.id. A
    venture-built scale-up with a census sibling, not a bootstrapped
    services shop. Included on that basis; reversible if Luca reads the
    agency rule the other way (the Btech precedent is flagged the same
    way in scope.outside).

  · FUNDING — a DASH. BDD has never disclosed a round of its own; the
    venture money is one step removed (Brodo's raise, itself undisclosed
    in amount). Listing BRI/GDP as BDD investors would be wrong.

  · HEADCOUNT — 181, live LinkedIn read 2026-08-31 ("Lihat seluruh 181
    karyawan"), own band 51-200 brackets it; RocketReach's 177 vendor
    figure corroborates within 3%. The single company page also covers
    the small SEA arm — the operation and both large offices are
    Indonesian, counted like Qiscus/Bahasa.ai.

  · NO DOUBLE-COUNT — Brodo's 115 is read from PT Brodo Ganesha
    Indonesia's own LinkedIn page; BDD's 181 from its own. Separate PTs,
    separate payrolls, separate pages.

Idempotent UPSERT (census-bandung.py mechanics): re-running restores
exactly these fields on the existing row and leaves logo/geocode/sprite
alone. Geocode is attempted only when the row has no lat: photon.komoot.io
(Nominatim 429-bans this IP), accepted only inside the Bandung envelope.

    python3 scripts/census-bdd.py && node scripts/build-census.js
"""
import json, os, sys, tempfile, urllib.request, urllib.parse

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-31'

ROW = {
  "name": "Boleh Dicoba Digital (BDD)",
  "id": "boleh-dicoba",
  "legal_name": "PT Boleh Dicoba Digital",
  # SECTOR_KEYS first-match-wins: no 'commerce', no 'cloud', no 'data', no
  # 'b2b', no 'd2c' before 'media' can... ('d2c'/fnb sits AFTER media, safe);
  # 'marketing' does not match 'marketplace'. Lands: media / Media & Gaming.
  "sector": "media — digital advertising and performance-marketing agency for local consumer brands: paid ads, creative production, SEO and live-shopping campaigns",
  "in_dki": False,
  "hq_address": "Jl. Lembong No.32, Braga, Kec. Sumur Bandung, Kota Bandung, Jawa Barat 40111",
  "kecamatan": "Sumur Bandung",
  "kota": "Bandung",
  "url": "https://bolehdicoba.com",
  "funding_total_usd_m": None,
  "funding_note": (
    "No round of its own on record. The venture money is one step removed: BDD was built by "
    "Brodo, and Brodo's Series A (Dec 2020 — Sembrani Nusantara fund/BRI Ventures + GDP Venture, "
    "amount itself undisclosed) was announced by the investors as raised partly to scale BDD, "
    "then already the marketing platform for Eiger, CottonInk, Kick Avenue and Rata.id."),
  "employees_est": 181,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/bolehdicoba/",
  "employees_note": (
    "LinkedIn lists 181 people on the company page ('Lihat seluruh 181 karyawan'), read "
    "2026-08-31; its own size band says 51-200, which brackets the count, and RocketReach's "
    "vendor figure (177) corroborates within 3%. The one page also covers the small SEA arm "
    "(Singapore desk); the operation and both large offices — Bandung and Kemang, Jakarta — "
    "are Indonesian."),
  "verify_note": (
    "The row Luca asked about, and a judgment call stated plainly: BDD's own title says "
    "'Jasa Digital Marketing Agency' — the word that kept Btech out under the agency rule. "
    "What separates it is the venture test: PT Boleh Dicoba Digital (est. 21 Nov 2017, EMIS, "
    "filed 2024 financials) was built by Brodo — a census row — as its own PT, and Brodo's "
    "Dec-2020 Series A (BRI Ventures' Sembrani Nusantara fund + GDP Venture) was announced by "
    "the investors themselves as partly for scaling BDD. Included as a venture-built company; "
    "reversible if the agency rule is read the other way. No payroll overlap with the Brodo "
    "row (separate PTs, separate LinkedIn pages: 115 vs 181). A Hong Kong entity 'Always Keep "
    "Building Limited' and a Singapore desk (Hong Lim Complex) appear on the BDD SEA page; the "
    "Indonesian operation is what is counted. Operating evidence: Restock.id partnership "
    "announced Dec 2025; site live Aug 2026."),
  "confidence": 0.85,
  "sources": [
    "https://bolehdicoba.com",
    "https://bolehdicoba.com/bdd-sea/",
    "https://id.linkedin.com/company/bolehdicoba",
    "https://www.emis.com/php/company-profile/ID/Pt_Boleh_Dicoba_Digital_en_22160213.html",
    "https://hybrid.co.id/post/brodo-bags-series-a-funding-from-sembrani-nusantara-venture-fund-and-gdp-venture/",
    "https://keuangan.kontan.co.id/news/fintech-restockid-gandeng-boleh-dicoba-digital-perkuat-pembiayaan",
  ],
  "site_status": "ok",
  "liveness_checked": TODAY,
}

# Bandung envelope (per-row metro rule — never the Jakarta one)
ENV = {"lat": (-7.10, -6.75), "lon": (107.45, 107.85)}

def geocode():
    for q in ("Jl. Lembong 32, Braga, Bandung", "Jalan Lembong, Bandung"):
        try:
            u = "https://photon.komoot.io/api/?" + urllib.parse.urlencode({"q": q, "limit": 3})
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "census-geocode/1.0"}), timeout=15) as r:
                fc = json.load(r)
            for f in fc.get("features", []):
                lon, lat = f["geometry"]["coordinates"][:2]
                if ENV["lat"][0] <= lat <= ENV["lat"][1] and ENV["lon"][0] <= lon <= ENV["lon"][1]:
                    kind = f.get("properties", {}).get("osm_key", "road")
                    kind = "building" if kind == "building" else ("road" if kind == "highway" else kind)
                    return lat, lon, "photon:" + q, kind
        except Exception as e:
            print("  geocode try failed:", e, file=sys.stderr)
    return None

def main():
    with open(RAW) as f:
        raw = json.load(f)
    byid = {c.get("id"): c for c in raw["companies"]}
    cur = byid.get(ROW["id"])
    if cur is None:
        cur = dict(ROW)
        raw["companies"].append(cur)
        print("ADDED", ROW["id"])
    else:
        cur.update(ROW)  # restore owned fields, leave logo/geocode/sprite alone
        print("RESTORED", ROW["id"])
    if not cur.get("lat"):
        g = geocode()
        if g:
            cur["lat"], cur["lon"], cur["geocode_src"], cur["geocode_kind"] = g
            cur["geocode_tries"] = cur.get("geocode_tries", 0) + 1
            print("  geocoded:", g)
        else:
            print("  UNLOCATED (photon found nothing inside the Bandung envelope)")
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)
    os.replace(tmp, RAW)
    print("companies:", len(raw["companies"]))

if __name__ == "__main__":
    main()
