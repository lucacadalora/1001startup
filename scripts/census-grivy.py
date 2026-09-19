#!/usr/bin/env python3
"""GRIVY — single verified add, and TIMEDOOR — a sourced rejection (Aug 31 2026).

Luca, from a LinkedIn screenshot: "just found this startup, is it maybe can be
put into 1001startup.id? also timedoor. but the concern is the CEO is expat."

THE EXPAT QUESTION FIRST, because it decides nothing here. The census rule is
three tests — tech- or venture-built rather than an incumbent's product line,
its own legal entity, a sourceable headcount — plus geography. Founder or CEO
nationality is not one of them and never has been: the census already counts
Grab Indonesia, SeaBank, Bank Saqu (WeLab), Amar (Tolaram), Upbit Indonesia
(Dunamu), TikTok Indonesia (ByteDance), Tomoro Coffee (Star Yuan) and Flash
Coffee Indonesia (CEO Bardon Matthew). What foreign ownership DOES trigger is
the global-parent rule — Indonesia-only jobs and value — and Grivy is not even
that case: PT Grivy Dotcom is an Indonesian company with its own registry
record, not the local arm of a foreign group.

  · GRIVY — IN. PT Grivy Dotcom, akta No. 30 of 26 Jul 2013, SK 43649 of
    20 Aug 2013, registration 77/116994, registered at OFFICE 8, LEVEL 18A
    SCBD, Jl. Jend. Sudirman Kav. 52-53 (iditrix registry mirror; EMIS gives
    the same establishment date, 26 Jul 2013, with filed 2024 financials —
    net sales +14.01%). Its own privacy policy names the entity: "This
    Privacy Policy explains how we, PT Grivy Dotcom, collect, store, and use
    your information." Founder and CEO Jan B. Oudeman; the company is a
    Google for Startups Accelerator alumnus, listed on Google's own programme
    page ("Grivy is an AI-first platform that bridges the gap between online
    engagement data and offline sales. Indonesia").

  · THE AGENCY QUESTION, asked before it is raised: EMIS classifies the PT as
    "Custom Computer Programming Services | Other Services Related to
    Advertising", and Grivy runs campaigns for brands — the shape that kept
    Btech out and made the BDD call a judgment. What separates Grivy is that
    it sells a product, not delivery hours: three named platform products on
    its own LinkedIn (ACQUIRE, ACTIVATE, ENRICH, all "Platform as a Service
    (PaaS) Software"), and it took venture money in Feb 2015. Included as a
    venture-built product company; flagged reversible like BDD was.

  · FUNDING — a DASH, and this is the sourced-or-withdrawn rule working.
    Grivy announced a pre-Series A in Feb 2015 with BOTH the amount and the
    investors undisclosed, and in Nov 2019 DealStreetAsia reported it was
    only EYEING a ~US$1M bridge/Series A — a plan, not a close. The trackers
    each carry a different total (CB Insights US$1.15M, BounceWatch US$1.30M,
    Crunchbase US$1.75M), which is exactly the class of number the census
    refuses to publish. funding_status = undisclosed.

  · HEADCOUNT — 44, live LinkedIn read 2026-08-31 ("View all 44 employees");
    its own band says 51-200, so the band does NOT bracket the count and the
    live figure wins, as everywhere else. BounceWatch's 42 corroborates within
    5%. The page also covers small SEA desks (Ho Chi Minh City, Bangkok,
    Singapore, Kuala Lumpur); Jakarta is the primary location and the entity
    is Indonesian, counted like Qiscus and Eureka AI.

  · TIMEDOOR — OUT, and NOT on nationality. It fails twice: the head office is
    Renon, Denpasar, Bali (Jakarta's Kelapa Gading address is a branch on its
    own about page), which is outside Greater Jakarta and the Bandung basin;
    and the business is fee-for-service delivery — web, app and system
    development, offshore/outsourced engineering, online marketing, plus IT
    courses for children and Japanese-language vocational and manpower
    services — the agency rule that excluded Btech and the Bandung software
    houses. Registered in scope.outside so the decision is visible on
    /coverage rather than looking like a gap. Reversible if the census area
    ever reaches Bali and the agency line is redrawn.

Idempotent UPSERT (census-bdd.py mechanics): re-running restores exactly these
fields on the existing row, leaves logo/sprite/geocode alone, merges the scope
entry BY NAME and never reassigns scope['rule'].

    python3 scripts/census-grivy.py && node scripts/build-census.js
"""
import json, os, re, sys, tempfile

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-31'

# `sector` wording is load-bearing: build-census.js SECTOR_KEYS is first-match-
# wins, and 'commerce'/'retail' would hijack this row into the marketplace
# bucket. Written to land in 'ai-cloud' next to Eureka AI and Dattabot — no
# earlier bucket word appears in it (no commerce/retail, no payment, no
# software/enterprise/b2b). Asserted below.
ROW = {
    "name": "Grivy",
    "id": "grivy",
    "legal_name": "PT Grivy Dotcom",
    "sector": "AI — consumer data intelligence linking brands' online activations to in-store purchases (smart QR journeys, identity resolution, campaign measurement)",
    "in_dki": True,
    "hq_address": "Gedung Office 8, Level 18A, SCBD Lot 28, Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190",
    "kecamatan": "Kebayoran Baru",
    "kota": "Jakarta Selatan",
    "url": "https://business.grivy.com",
    "funding_total_usd_m": None,
    "funding_status": "undisclosed",
    "funding_note": (
        "Withheld, not zero. Grivy announced a pre-Series A in February 2015 with both the amount "
        "and the investors undisclosed (reported only as backers connected to a national "
        "conglomerate), and in November 2019 DealStreetAsia reported the company was eyeing a "
        "~US$1M bridge round ahead of a Series A — a plan, not a close. No round of Grivy's has "
        "ever been announced with a figure. The trackers each carry a different total (CB Insights "
        "US$1.15M, BounceWatch US$1.30M, Crunchbase US$1.75M), so none of them is published here."),
    "employees_est": 44,
    "employees_asof": TODAY,
    "employees_src": "https://www.linkedin.com/company/grivy",
    "employees_kind": "linkedin",
    "employees_note": (
        "LinkedIn lists 44 people on the company page ('View all 44 employees'), read 2026-08-31. "
        "Its own size band says 51-200, which does NOT bracket the count — the live people count is "
        "what is published, as on every other row. BounceWatch's 42 corroborates within 5%. The one "
        "page also covers small regional desks (Ho Chi Minh City, Bangkok, Singapore, Kuala Lumpur); "
        "Jakarta is the primary location and the entity is Indonesian, counted like Qiscus and Eureka AI."),
    "verify_note": (
        "Luca asked whether an expat-led company belongs in the census. Nationality is not one of the "
        "three tests, and the census already counts Grab Indonesia, SeaBank, Bank Saqu, Amar, Upbit, "
        "TikTok Indonesia, Tomoro and Flash Coffee; what foreign ownership triggers is the "
        "global-parent rule (Indonesia-only jobs and value), and Grivy is not that case — PT Grivy "
        "Dotcom is an Indonesian company, not a foreign group's local arm. ENTITY: akta No. 30 of "
        "26 Jul 2013, SK 43649 of 20 Aug 2013, registration 77/116994, registered at Office 8 Level "
        "18A SCBD (iditrix registry mirror); EMIS gives the same establishment date with filed 2024 "
        "financials (net sales +14.01%); the company's own privacy policy names PT Grivy Dotcom as "
        "the controller. Founder and CEO Jan B. Oudeman, Dutch by his own account ('I am Dutch' — "
        "Indonesia Expat interview). VENTURE TEST: pre-Series A Feb 2015, and "
        "Google for Startups Accelerator alumnus per Google's own programme page. AGENCY TENSION, "
        "stated plainly: EMIS classifies the PT under advertising services and Grivy runs brand "
        "campaigns, the shape that kept Btech out — what separates it is that it sells named "
        "platform products (ACQUIRE, ACTIVATE, ENRICH, listed as Platform-as-a-Service software) "
        "rather than delivery hours. Included as venture-built; reversible if the agency rule is "
        "read the other way. LIVENESS: business.grivy.com serves 200 (grivy.com redirects to it) "
        "and the LinkedIn page posted the same day it was read, 14.6K followers."),
    "confidence": 0.8,
    "sources": [
        "https://business.grivy.com/about-grivy",
        "https://grivy.zendesk.com/hc/en-us/articles/49410856129561-Privacy-Policy",
        "https://iditrix.com/grivy-dotcom/729891/",
        "https://www.emis.com/php/company-profile/ID/Pt_Grivy_Dotcom_en_13391576.html",
        "https://www.linkedin.com/company/grivy",
        "https://startup.google.com/programs/accelerator/southeast-asia/",
        "https://hybrid.co.id/post/grivy-sealed-pre-series-a-funding/",
        "https://www.dealstreetasia.com/stories/grivy-plato-160387",
        "https://indonesiaexpat.id/meet-the-expats/meet-jan-oudeman/",
    ],
    "site_status": "ok",
    "liveness_checked": TODAY,
}

# Office 8 Tower is already pinned by two census rows in the same building
# (bukuwarung, jejakin). Copy the pin rather than re-geocoding a tower that
# photon/nominatim resolve to the middle of Sudirman.
PIN_FROM = "bukuwarung"

SCOPE_OUT = [{
    "name": "Timedoor (PT Timedoor Indonesia)",
    "owner": "PT Timedoor Indonesia — founded 2014 by Yutaka Tokunaga (Japan)",
    "why": (
        "outside on geography and on the agency rule, not on nationality. The head office is "
        "Jl. Tukad Yeh Aya IX No.46, Renon, Denpasar, Bali — outside Greater Jakarta and the Bandung "
        "basin — and the Kelapa Gading address on its own about page is a branch, alongside Tokyo and "
        "New Cairo. The business is fee-for-service delivery: web, app and system development, "
        "offshore engineering, online marketing, plus IT courses for children (Timedoor Academy) and "
        "Japanese-language vocational and manpower services, all under the one PT — the same reason "
        "Btech and the Bandung software houses sit here. An expat-run company is counted like any "
        "other when it passes the tests: Grivy, added the same day, is led by a Dutch founder. "
        "Reversible if the census area ever reaches Bali and the agency line is redrawn."),
    "sources": [
        "https://timedoor.net/about/",
        "https://timedoor.net/service/",
        "https://www.linkedin.com/company/pt-timedoor-indonesia",
    ],
}]

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


def main():
    got = sector_key(ROW["sector"])
    if got != "ai-cloud":
        sys.exit(f"sector string routes to {got!r}, not 'ai-cloud' — rewrite it before writing the row")

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
        src = byid.get(PIN_FROM)
        if src and src.get("lat"):
            cur["lat"], cur["lon"] = src["lat"], src["lon"]
            cur["geocode_src"] = f"same building: Office 8 SCBD (pin copied from {PIN_FROM})"
            cur["geocode_kind"] = src.get("geocode_kind", "building")
            cur["geocode_tries"] = cur.get("geocode_tries", 0) + 1
            print("  pinned:", cur["lat"], cur["lon"])
        else:
            print("  UNLOCATED (no pin to copy from " + PIN_FROM + ")")

    scope = raw.setdefault("scope", {})
    scope.setdefault("rule", "")  # never reassigned here
    mine = {e["name"] for e in SCOPE_OUT}
    scope["outside"] = [e for e in scope.get("outside", []) if e.get("name") not in mine] + SCOPE_OUT

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, RAW)
    print("companies:", len(raw["companies"]), "| scope.outside:", len(scope["outside"]))


if __name__ == "__main__":
    main()
