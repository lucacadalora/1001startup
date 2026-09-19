#!/usr/bin/env python3
"""INFIA (Dagelan) — single verified add (Aug 31 2026).

Luca: "try to check dagelan/infia, do they eligible?" They are — and the row
is Infia, not Dagelan, by the census's own brand rule.

  · WHICH NAME IS THE ROW — Dagelan (the meme account, 23M+ followers) is an
    IP owned and operated by the company; it has no entity of its own. The
    Jenius/TikTok-Shop rule: brands don't get rows, companies do. So the row
    is INFIA Corp / PT Infia Media Pratama, with Dagelan named in the sector
    string and the tags.

  · THE THREE TESTS — (1) tech-built: a digital-native network grown on
    Instagram distribution from 14 Jan 2014 (Dagelan first, then Infia_fact
    and siblings), now an IP company — 40+ owned properties incl. Tahilalats,
    across licensing, content and placemaking ("Made for Fun"); the shape the
    census already counts as IDN, Social Bread and BDD — owned media
    properties, not client-services hours. (2) own entity: PT. Infia Media
    Pratama, business number 664064 (companieshouse.id registry mirror, which
    still carries the older Beltway Office Park/TB Simatupang registered
    address; the company's own contact page wins for today's office —
    Jl. RC. Veteran Raya No.68, Bintaro, Kebayoran Lama, Jakarta Selatan
    12240, the same address on its LinkedIn page). (3) headcount: 74, read
    live 2026-08-31 on BOTH LinkedIn pages — the current infia-corp page
    ('Discover all 74 employees') and the legacy infia-media-pratama page
    ('Lihat seluruh 74 karyawan') agree to the person.

  · FUNDING — a DASH (none_on_record). Twelve years of operation and no
    announced round anywhere: nothing on DailySocial or Tech in Asia, no
    round on the trackers, and the company's own telling is ad-revenue-built
    ("started as a business of selling advertisements on social media";
    its Jun 2026 post: "Twelve years on the feed earned 23M+ Indonesian
    followers"). The Qwords/Anomali line applies: for a tech-built company,
    zero disclosed capital is a fact to publish, not a failure to source.

  · NAMESAKE TRAP (logged for the next sweep): linkedin.com/company/infia is
    a Belgian firm in Hamont-Achel. The right pages are infia-corp and
    infia-media-pratama.

Idempotent UPSERT (census-bdd.py mechanics): re-running restores exactly
these fields and leaves logo/sprite/geocode alone.

    python3 scripts/census-infia.py && node scripts/build-census.js
"""
import json, os, re, sys, tempfile, urllib.request, urllib.parse

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-31'

# SECTOR_KEYS first-match-wins: 'media' lands the row at the media bucket
# (position 11); nothing earlier can fire — no commerce/retail, no payment,
# no software/b2b, no data/AI. 'hospitality' (prop) and 'creator' (media
# itself) sit at-or-after media, so the placemaking clause is safe. Asserted.
ROW = {
    "name": "INFIA (Dagelan)",
    "id": "infia",
    "legal_name": "PT Infia Media Pratama",
    "sector": "media — creative-IP company behind the Dagelan meme network (23M+ followers), Tahilalats and 40+ owned IPs, monetised through licensing, branded content and placemaking",
    "in_dki": True,
    "hq_address": "Jl. RC. Veteran Raya No.68, RT.4/RW.10, Bintaro, Kec. Kebayoran Lama, Jakarta Selatan 12240",
    "kecamatan": "Kebayoran Lama",
    "kota": "Jakarta Selatan",
    "url": "https://infiacorp.com",
    "funding_total_usd_m": None,
    "funding_status": "none_on_record",
    "funding_note": (
        "No round on record across twelve years: nothing on DailySocial or Tech in Asia, no round "
        "on the trackers, and the company's own telling is ad-revenue-built — it began 14 Jan 2014 "
        "selling advertising on its social accounts and grew Dagelan to 23M+ followers before "
        "pivoting to owned IP. Zero disclosed capital is the fact, not a sourcing gap."),
    "employees_est": 74,
    "employees_asof": TODAY,
    "employees_src": "https://www.linkedin.com/company/infia-corp",
    "employees_kind": "linkedin",
    "employees_note": (
        "LinkedIn lists 74 people, read 2026-08-31 — and twice over: the current INFIA Corp page "
        "('Discover all 74 employees') and the legacy Infia Media Pratama page ('Lihat seluruh 74 "
        "karyawan') agree to the person. Vendor enrichment lags at 47; the live count wins."),
    "verify_note": (
        "Luca asked whether Dagelan/Infia is eligible — it is, and the row is the company, not the "
        "meme account: Dagelan is an owned IP with no entity of its own (the Jenius/TikTok-Shop "
        "brand rule), so it rides the Infia row by name. ENTITY: PT. Infia Media Pratama, business "
        "number 664064 per the companieshouse.id registry mirror — which still carries the older "
        "registered address (Beltway Office Park Tower B, Jl. TB. Simatupang No. 41); the company's "
        "own contact page gives today's office in Bintaro, matching its LinkedIn page, and the own "
        "page wins (the BDD precedent). VENTURE TEST: tech-built — a digital-native network grown "
        "on Instagram distribution into an IP house (40+ properties incl. Tahilalats; licensing, "
        "content, placemaking), the owned-media shape already counted as IDN and Social Bread — "
        "owned properties, not client-services hours. OPERATING: infiacorp.com answered 200 on the "
        "read date and the company posted on LinkedIn in June 2026 ('Twelve years on the feed'); "
        "dagelan.co is also live. NAMESAKE GUARD: linkedin.com/company/infia is an unrelated "
        "Belgian firm — the counts above come from the two Infia pages, not it."),
    "confidence": 0.8,
    "sources": [
        "https://infiacorp.com/",
        "https://infiacorp.com/contact/",
        "https://www.linkedin.com/company/infia-corp",
        "https://www.linkedin.com/company/infia-media-pratama",
        "https://companieshouse.id/infia-media-pratama",
        "https://www.dagelan.co/",
    ],
    "site_status": "ok",
    "liveness_checked": TODAY,
}

# Greater Jakarta envelope (per-row metro rule)
ENV = {"lat": (-6.60, -5.90), "lon": (106.45, 107.20)}

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


def geocode():
    for q in ("Jalan RC Veteran Raya, Bintaro, Jakarta Selatan", "Bintaro, Kebayoran Lama, Jakarta Selatan"):
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
    got = sector_key(ROW["sector"])
    if got != "media":
        sys.exit(f"sector string routes to {got!r}, not 'media' — rewrite it before writing the row")

    with open(RAW, encoding="utf-8") as fh:
        raw = json.load(fh)
    byid = {c.get("id"): c for c in raw["companies"]}
    cur = byid.get(ROW["id"])
    if cur is None:
        cur = dict(ROW)
        raw["companies"].append(cur)
        print("ADDED", ROW["id"])
    else:
        cur.update(ROW)  # restore owned fields, leave logo/sprite/geocode alone
        print("RESTORED", ROW["id"])
    if not cur.get("lat"):
        g = geocode()
        if g:
            cur["lat"], cur["lon"], cur["geocode_src"], cur["geocode_kind"] = g
            cur["geocode_tries"] = cur.get("geocode_tries", 0) + 1
            print("  geocoded:", g)
        else:
            print("  UNLOCATED (photon found nothing inside the Jakarta envelope)")

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, RAW)
    print("companies:", len(raw["companies"]))


if __name__ == "__main__":
    main()
