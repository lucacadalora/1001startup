#!/usr/bin/env python3
"""Split Stockbit out of the combined Bibit row (Aug 30 2026).

Luca: "it seems stockbit not appear yet." It did appear — but only inside one
combined row, "Bibit (Stockbit Bibit)". Stockbit is not a product line of PT
Bibit Tumbuh Bersama: the platform is its own PT (PT Stockbit Investa Bersama,
registry 954622), in-app trading runs through its own OJK-licensed broker
(PT Stockbit Sekuritas Digital, IDX member code XL, ex PT Mahakarya Artha
Sekuritas), and its own LinkedIn page lists 649 people separate from Bibit's
465. Under the census's published inclusion rule (startup + dedicated legal
entity + sourceable headcount) that is a row — the same call that gave Krom a
row apart from Kredivo.

No double counting: the group's US$175M (30 + 65 Sequoia-led 2021, 80 GIC-led
2022) was announced as Bibit rounds and stays on the Bibit row; every round
raised at the Stockbit level (Ideosource seed 2015, East Ventures-led Series A
2019) was undisclosed, so Stockbit's funding is a dash with the history in its
note. Headcounts come from the two entities' separate LinkedIn pages.

Idempotent UPSERT, same shape as census-gap3.py: re-running restores exactly
these fields (the repair path after a cross-session clobber) and leaves logo,
sprite and anything another pass added alone.

    python3 scripts/census-stockbit.py && node scripts/build-census.js
"""
import json, os, tempfile

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-30'

ROWS = [
 {
  "name": "Stockbit", "id": "stockbit",
  "legal_name": "PT Stockbit Investa Bersama",
  # leads with "fintech" so SECTOR_KEYS routes it there; "licensed" must not
  # open the string or the Digital Banking rule (^licensed ... bank) is risked.
  "sector": "fintech — stock investing app and investor community; in-app trading runs through its own OJK-licensed broker, Stockbit Sekuritas (IDX member code XL)",
  "in_dki": True,
  "hq_address": "RDTX Square (Menara Standard Chartered) Lt. 33 & 35, Jl. Prof. Dr. Satrio No. 164, Karet Semanggi, Setiabudi, Jakarta Selatan 12930",
  "kecamatan": "Setiabudi", "kota": "Jakarta Selatan",
  # same building as the bibit row (one group, two floors): reuse its pin.
  "lat": -6.20733, "lon": 106.82561,
  "geocode_kind": "building",
  "geocode_src": "same building as the bibit row (RDTX Square / ex Menara Standard Chartered)",
  "url": "https://stockbit.com",
  "funding_total_usd_m": None, "last_round": "Series A (East Ventures-led)", "last_round_year": 2019,
  "funding_note": (
    "Every round raised at the Stockbit level was undisclosed: the Sep 2015 seed from Ideosource and "
    "the May 2019 Series A led by East Ventures (with Convergence Ventures, FreakOut and angels; "
    "earlier backers 500 Startups, Braavos and Ideosource) never carried amounts. The group's "
    "US$175M (US$30M + US$65M Sequoia India-led 2021, US$80M GIC-led May 2022) was announced as "
    "Bibit rounds and sits on the Bibit row — the two rows do not double-count. CB Insights carries "
    "a US$25M 'unattributed' entry dated Nov 2022 with no announcement behind it; tracker-only, "
    "not counted."),
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 649,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/stockbit/",
  "employees_kind": "linkedin",
  "employees_note": (
    "LinkedIn lists 649 people on the Stockbit company page, read 2026-08-30 (its own size band: "
    "501-1,000). A vendor snapshot earlier in 2026 carried 445 (+40.6% YoY), so read it as the top "
    "of a 445-649 spread. Sister company Bibit's page lists its 465 separately — group staff appear "
    "under whichever of the two employer pages they list, so the two rows are complementary, with "
    "only marginal cross-listing risk."),
  "investors": ["Ideosource", "East Ventures", "Convergence Ventures", "FreakOut",
                "500 Global (500 Startups)", "Braavos Ventures"],
  "sources": [
    "https://companieshouse.id/stockbit-investa-bersama",
    "https://stockbit.com/contact",
    "https://stockbit.com/about",
    "https://apei.or.id/en/our_member/detail/871/stockbit-sekuritas-digital",
    "https://carisaham.com/sekuritas/detail/XL",
    "https://www.linkedin.com/company/stockbit/",
    "https://hybrid.co.id/post/stockbit-closes-seed-funding-from-ideosource/",
    "https://www.digitalnewsasia.com/startups/stockbit-raises-series-funding-led-east-ventures"],
  "site_status": "ok", "liveness_checked": TODAY,
  "confidence": 0.85,
  "verify_note": (
    "Founded 2012 by Wellson Lo (ex-KPMG Singapore, trader), joined by co-founder Johny Susanto, as "
    "a social/analytics platform for IDX investors. In 2021 the group made it a full broker by "
    "acquiring PT Mahakarya Artha Sekuritas (est. 1990) and renaming it PT Stockbit Sekuritas "
    "Digital — IDX member code XL, PPE licence KEP-132/PM/1992, listed Active by APEI; the rename "
    "and KSEI/IDX digital-onboarding registration are on Stockbit's own About timeline. Platform "
    "entity PT Stockbit Investa Bersama (Ministry of Law registry no. 954622) is registered at RDTX "
    "Square Lt. 35 — the same floor and building as sister company Bibit (PT Bibit Tumbuh Bersama); "
    "the broker sits on Lt. 33 per stockbit.com/contact and APEI. One group, two products, separate "
    "PTs and separate payrolls, so the census carries two rows. App Store distribution sits under "
    "Stockbit Pte Ltd (SG holdco) — the operation is Jakarta, counted like Qiscus. LinkedIn's HQ "
    "field says Jakarta Pusat; the registry, the broker filings and the site all say Jakarta "
    "Selatan, and the filed address wins."),
 },
]

# Surgical fixes to the existing Bibit row — only these fields change; funding,
# pin, logo and everything else on the row stay as they are.
BIBIT_FIX = {
  "name": "Bibit",
  "sector": "fintech — robo-advisor investment app (mutual funds, bonds, stocks); sister company of Stockbit under the same group",
  "funding_note": (
    "US$175M raised at the Bibit level for the Stockbit Bibit group: US$30M and US$65M Sequoia "
    "India-led in 2021, US$80M GIC-led May 2022. Sister company Stockbit carries its own census row; "
    "its own rounds (2015 seed, 2019 Series A) were undisclosed — the two rows do not double-count."),
  "employees_note": (
    "LinkedIn lists 465 people on the Bibit company page, read 2026-08-29. LinkedIn's own size band: "
    "501-1,000 employees. Sister company Stockbit's page lists its 649 separately — one group, two "
    "employer pages, so the two census rows are complementary."),
  "verify_note": (
    "HQ confirmed: Menara Standard Chartered Lt. 35, Jl. Prof. Dr. Satrio No. 164, Jakarta Selatan "
    "12930 (artikel.bibit.id); building since rebranded RDTX Square per Wikipedia — same address, "
    "not an error. Funding ~$175M ($30M + $65M Sequoia-led 2021, $80M GIC-led May 2022) checks out; "
    "valuation correctly null. Split Aug 30 2026: Stockbit (PT Stockbit Investa Bersama, with broker "
    "PT Stockbit Sekuritas Digital) now has its own row — same building, separate legal entities and "
    "payrolls; this row is PT Bibit Tumbuh Bersama only."),
}


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
    bibit = by.get('bibit')
    if bibit is None:
        raise SystemExit("bibit row missing — check census-raw.json before re-running")
    bibit.update(BIBIT_FIX)
    print("updated bibit        Bibit (split note + rename)")
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)
    print(f"{added} added, {updated} updated -> {len(raw['companies'])} companies")


if __name__ == '__main__':
    main()
