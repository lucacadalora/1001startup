#!/usr/bin/env python3
"""Digital banks + the foreign-parented platforms, merged into the census.

Luca, Aug 29 2026: "weird you havent include superbank, why?" and then
"shopee also mission, lazada missing".

WHY THEY WERE MISSING — two different failures:

  1. The banks were REJECTED, deliberately, in the gap-2 pass: see the header of
     scripts/census-gap2.py, "Bank Jago, Superbank, Krom, Amar, Allo, SeaBank -
     licensed banks, not startups; including them would also wreck the GVA
     anchors". That decision lived only in a Python docstring — nothing on the
     page said these six had been considered and cut, so the census read as if
     it had simply never heard of them. The rule itself does not survive
     Superbank: Jakarta HQ, 732 staff, US$345M of consortium equity, 7M
     customers, IPO'd on the IDX as SUPA. The census already carries listed
     companies and OJK-licensed lenders and e-money issuers; a bank licence is
     not the line it claims to be. And the GVA half of the reason is backwards
     — priced at the fintech anchor a bank is UNDERSTATED, not inflated. The
     right fix is a bank anchor (below), not exclusion.

  2. Shopee, Lazada and Grab were never screened at all. No register entry, no
     rule, no rejection — the sweeps ran off Indonesian-startup name lists, so
     platforms with foreign parents and large Jakarta operating entities fell
     straight through. Exactly the Qiscus failure mode (its LinkedIn entity is
     a Singapore holdco) that the coverage-gap batch was supposed to close.
     Those four rows (plus Ninja Xpress) were added by a PARALLEL SESSION while
     this batch was being researched, and its versions are better sourced than
     the ones drafted here — Grab's Indonesian head office read out of Grab's
     own ESG Report 2025 (South Quarter, Cilandak) rather than the stale Lippo
     Kuningan address on its LEI record, and a headcount allocated from group
     figures on Indonesia's revenue share. They are deliberately NOT re-applied
     here. This script now covers the banks only.

     That collision is itself the census's documented write race: the parallel
     write landed on top of this one and dropped 11 rows, the scope register
     and the bank anchor in one go. Re-running this script is the repair, which
     is why it is idempotent — but the file stays a two-writer hazard, so
     re-read before every write and rebuild immediately after.

LUCA'S INCLUSION RULE (Aug 29, verbatim): "as long as it can be called startup,
and dedicated company and we can get head count". Applied here as three tests —
tech/VC-built rather than an incumbent's product line; its own legal entity;
and a headcount we can source. What that keeps and what it drops is published
on the page, in raw['scope'], so the boundary is auditable instead of implied.

HEADCOUNTS: every listed bank's figure is the company's own filed number as of
30 Jun 2026 (via stockanalysis.com), NOT a LinkedIn or Revelio scrape. The
scrapes are badly wrong on this cohort and it is worth recording why: Allo Bank
reads 868 on Revelio against 411 filed (2.1x), Amar Bank 464 on LinkedIn
against 1,585 filed (3.4x low — Revelio's 963 is wrong the other way), Krom 457
vs 397, Bank Jago 605 vs 631, Superbank 584 vs 732. Bank staff sit in branches
and collections teams that never appear on LinkedIn. The two private banks
(SeaBank, Bank Saqu) keep LinkedIn figures, labelled as such.

FUNDING: left null for the banks, deliberately. Bank capital — rights issues,
consortium injections, IPO proceeds — is not a venture round, and conflating
the two would inflate the census's headline funding figure. This is the same
error the adversarial pass already caught once, when AdaKami's "US$31.69M"
turned out to be a Superbank LOAN FACILITY rather than equity. Superbank is the
one exception: its four pre-IPO consortium rounds are reported as funding by
the trackers, so the figure is carried with a note saying what it actually is.

TODO (not done here): market-cap valuations for the six listed banks. Sourced
caps exist for SUPA (Rp 29.0T), ARTO (Rp 39.5T) and BBYB (Rp 3.10T) but not the
other three, and valuation marks are a separately-governed published total
whose single writer is scripts/census-valuation.py. Do it there, not here.

Idempotent. Run: python3 scripts/census-banks.py && node scripts/build-census.js
"""
import json
import os

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'census-raw.json')

SA = 'https://stockanalysis.com/quote/idx/%s/employees/'

# Sector strings for the eight banks all begin "licensed digital bank" — that
# exact phrase is what build-census.js's new 'bank' rule matches. It is NOT a
# loose /neobank|digital banking/ test, because that wording is marketing copy:
# Akulaku, KoinWorks and FAZZ all use it and none of them holds a bank licence.
NEW = [
 {
  "name": "Superbank", "id": "superbank",
  "legal_name": "PT Super Bank Indonesia Tbk",
  "sector": "licensed digital bank — consumer and MSME banking embedded in the Grab and OVO apps",
  "in_dki": True,
  "hq_address": "Treasury Tower Lt. 28-29, District 8 SCBD Lot 13, Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190",
  "kota": "Jakarta Selatan",
  "url": "https://www.superbank.id",
  "funding_total_usd_m": 345.4,
  "last_round": "IPO on the IDX (ticker SUPA), 17 Dec 2025",
  "last_round_year": 2025,
  "employees_est": 732,
  "employees_note": "732 as of 30 Jun 2026, the company's own filed figure. LinkedIn/Revelio show 584 — the filing is preferred.",
  "investors": ["Emtek Group", "Grab", "Singtel", "KakaoBank", "GXS"],
  "verify_note": "Formerly PT Bank Fama International, licensed as a commercial bank in 1993 and founded in Bandung; joined Emtek late 2021, Grab and Singtel early 2022, KakaoBank-led consortium 2023, renamed and moved its head office to Jakarta in 2023. The US$345.4M is four pre-IPO consortium equity injections as reported by LinkedIn/Revelio, not venture rounds — indicative only. Post-IPO core capital Rp 8T lifted it from KBMI 1 to KBMI 2. H1 2026 profit before tax Rp 234bn (+669% YoY), loans Rp 13.4T, third-party funds Rp 15.9T, 7M+ customers, >60% of them Grab or OVO users.",
  "confidence": 0.92,
  "sources": [
   "https://www.superbank.id/en/tentang-kami/sejarah-kami",
   "https://stockanalysis.com/quote/idx/SUPA/employees/",
   "https://www.fortuneidn.com/market/naik-kelas-ke-kbmi-2-modal-inti-super-bank-naik-jadi-rp8-t-pasca-ipo-00-3dhnm-y2gt1f",
   "https://fintechnews.id/110448/digital-banking-news-indonesia/superbank-indonesia-h1-2026-profit/",
   "https://keuangan.kontan.co.id/news/jumlah-nasabah-superbank-capai-65-juta-hingga-awal-2026",
  ],
 },
 {
  "name": "Bank Jago", "id": "bank-jago",
  "legal_name": "PT Bank Jago Tbk",
  "sector": "licensed digital bank — life-centric banking, embedded in the GoTo and Bibit ecosystems",
  "in_dki": True,
  "hq_address": "Menara SMBC Lt. 43, 45 & 46, Jl. Dr. Ide Anak Agung Gde Agung Kav. 5.5-5.6, Setiabudi, Jakarta Selatan 12950",
  "kota": "Jakarta Selatan",
  "url": "https://www.jago.com",
  "funding_total_usd_m": None,
  "last_round": "listed on the IDX (ticker ARTO) since 12 Jan 2016; recapitalised 2020 by the Jerry Ng / Patrick Walujo vehicle, then GoTo and GIC",
  "last_round_year": 2016,
  "employees_est": 631,
  "employees_note": "631 as of 30 Jun 2026, company filing. Revelio reads 605 and LinkedIn 624.",
  "investors": ["GoTo Group", "GIC", "Wealth Track Technology (Jerry Ng)", "Patrick Walujo"],
  "verify_note": "Formerly Bank Artos Indonesia. Relaunched as a digital bank in 2020 after the Ng/Walujo takeover; GoTo took a stake in Dec 2020 and GIC followed. Funding left null: its capital came through IDX rights issues, not venture rounds.",
  "confidence": 0.93,
  "sources": [
   "https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/ARTO",
   "https://stockanalysis.com/quote/idx/ARTO/employees/",
  ],
 },
 {
  "name": "SeaBank", "id": "seabank",
  "legal_name": "PT Bank Seabank Indonesia",
  "sector": "licensed digital bank — no-fee savings and lending inside the Shopee ecosystem",
  "in_dki": True,
  "hq_address": "Gama Tower Lt. 35, Jl. H.R. Rasuna Said Kav. C-22 No. 2, Karet Kuningan, Setiabudi, Jakarta Selatan 12940",
  "kota": "Jakarta Selatan",
  "url": "https://www.seabank.co.id",
  "funding_total_usd_m": None,
  "last_round": "wholly acquired by Sea Ltd (NYSE: SE) in 2021; capital comes from the parent",
  "last_round_year": 2021,
  "employees_est": 776,
  "employees_note": "LinkedIn 776 (+9.7% YoY). Privately held, so no filed headcount — this is the weaker of the two source classes used in this batch.",
  "investors": ["Sea Ltd (NYSE: SE)"],
  "verify_note": "Formerly PT Bank Kesejahteraan Ekonomi, founded 4 Oct 1991, acquired and renamed by Sea in 2021. FY2025: revenue Rp 8.18T, net profit Rp 678bn, total assets Rp 44.43T, equity Rp 7.12T. Q2 2026 net profit Rp 373.7bn, up 219% YoY.",
  "confidence": 0.88,
  "sources": [
   "https://www.seabank.co.id/perusahaan/info/lokasi",
   "https://id.wikipedia.org/wiki/SeaBank",
   "https://www.dealstreetasia.com/stories/seabank-q2-profit-more-than-triples-492615",
  ],
 },
 {
  "name": "Krom Bank", "id": "krom-bank",
  "legal_name": "PT Krom Bank Indonesia Tbk",
  "sector": "licensed digital bank — high-yield savings, the deposit arm of the Kredivo group",
  "in_dki": True,
  "hq_address": "Dipo Tower Lt. 3 Unit D-E, Jl. Jend. Gatot Subroto Kav. 50-52, Petamburan, Tanah Abang, Jakarta Pusat 10260",
  "kota": "Jakarta Pusat",
  "url": "https://krom.id",
  "funding_total_usd_m": None,
  "last_round": "listed on the IDX (ticker BBSI); 75% held by Kredivo Group (FinAccel)",
  "last_round_year": 2022,
  "employees_est": 397,
  "employees_note": "397 as of 30 Jun 2026, company filing. Revelio reads 457.",
  "investors": ["Kredivo Group (FinAccel)"],
  "verify_note": "Founded 16 Mar 1957 as Bank Bisnis Internasional; renamed PT Krom Bank Indonesia Tbk in Sep 2022 and relaunched as a digital bank in 2024. Funding null — the census already counts Kredivo/FinAccel's venture rounds on its own row, and counting them twice would double-book the same money.",
  "confidence": 0.9,
  "sources": [
   "https://id.wikipedia.org/wiki/Krom_Bank_Indonesia",
   "https://stockanalysis.com/quote/idx/BBSI/company/",
   "https://stockanalysis.com/quote/idx/BBSI/employees/",
  ],
 },
 {
  "name": "Allo Bank", "id": "allo-bank",
  "legal_name": "PT Allo Bank Indonesia Tbk",
  "sector": "licensed digital bank — consumer banking across the CT Corp retail and media ecosystem",
  "in_dki": True,
  "hq_address": "Menara Bank Mega Lt. 5-6, Jl. Kapten P. Tendean Kav. 12-14A, Mampang Prapatan, Jakarta Selatan 12790",
  "kota": "Jakarta Selatan",
  "url": "https://www.allobank.com",
  "funding_total_usd_m": None,
  "last_round": "listed on the IDX (ticker BBHI); controlled by Mega Corpora (CT Corp)",
  "last_round_year": 2022,
  "employees_est": 411,
  "employees_note": "411 as of 30 Jun 2026, company filing. Revelio reads 868 — more than double the filed figure, and wrong.",
  "investors": ["Mega Corpora (CT Corp)", "Grab", "Bukalapak", "Carlo Ventures"],
  "verify_note": "Founded 1992 as Bank Harda Internasional, acquired by Mega Corpora and relaunched as Allo Bank in 2021-22. The 2022 rights issue brought in Grab, Bukalapak and Carlo Ventures as strategic shareholders; that was a public-market placement, not a venture round, so funding stays null.",
  "confidence": 0.88,
  "sources": [
   "https://www.cbinsights.com/company/allo-bank",
   "https://stockanalysis.com/quote/idx/BBHI/employees/",
   "https://finance.yahoo.com/quote/BBHI.JK/profile/",
  ],
 },
 {
  "name": "Amar Bank", "id": "amar-bank",
  "legal_name": "PT Bank Amar Indonesia Tbk",
  "sector": "licensed digital bank — Tunaiku micro-lending and Senyumku digital savings",
  "in_dki": True,
  "hq_address": "RDTX Square Lt. 11, Jl. Prof. Dr. Satrio No. 164, Karet Semanggi, Setiabudi, Jakarta Selatan 12930",
  "kota": "Jakarta Selatan",
  "url": "https://amarbank.co.id",
  "funding_total_usd_m": None,
  "last_round": "listed on the IDX (ticker AMAR) since 9 Jan 2020; majority-held by the Tolaram Group",
  "last_round_year": 2020,
  "employees_est": 1585,
  "employees_note": "1,585 as of 30 Jun 2026, company filing — the largest headcount in this cohort, and the one the scrapes miss worst: LinkedIn says 464 and Revelio 963. Tunaiku's field and collections staff do not show up on LinkedIn.",
  "investors": ["Tolaram Group", "Investree (minority, 2022)"],
  "verify_note": "Digital-first since 2014 through the Tunaiku unsecured micro-loan product; head office moved from Surabaya to Jakarta. Counted in Greater Jakarta on its registered head-office address.",
  "confidence": 0.9,
  "sources": [
   "https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/AMAR",
   "https://amarbank.co.id/investor-contact",
   "https://stockanalysis.com/quote/idx/AMAR/employees/",
  ],
 },
 {
  "name": "Bank Neo Commerce", "id": "bank-neo-commerce",
  "legal_name": "PT Bank Neo Commerce Tbk",
  "sector": "licensed digital bank — neobank consumer accounts and lending, Akulaku-backed",
  "in_dki": True,
  "hq_address": "Treasury Tower Lt. 60, District 8 SCBD Lot 13, Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190",
  "kota": "Jakarta Selatan",
  "url": "https://www.bankneo.co.id",
  "funding_total_usd_m": None,
  "last_round": "listed on the IDX (ticker BBYB) since 2015; Akulaku became the controlling shareholder in 2021",
  "last_round_year": 2021,
  "employees_est": 909,
  "employees_note": "909 as of 30 Jun 2026, company filing. Revelio reads 947 and LinkedIn 743.",
  "investors": ["Akulaku", "Gozco Capital", "Rockcore Financial Technology"],
  "verify_note": "Founded 19 Sep 1989 as Bank Yudha Bhakti, renamed Bank Neo Commerce in 2020. FY2025 revenue Rp 3.14T. Akulaku is a separate census row; its own venture funding is counted there, not here.",
  "confidence": 0.9,
  "sources": [
   "https://id.wikipedia.org/wiki/Bank_Neo_Commerce",
   "https://stockanalysis.com/quote/idx/BBYB/employees/",
  ],
 },
 {
  "name": "Bank Saqu", "id": "bank-saqu",
  "legal_name": "PT Bank Saqu Indonesia",
  "sector": "licensed digital bank — banking for solopreneurs and micro-businesses",
  "in_dki": True,
  "hq_address": "Jl. Tiang Bendera III No. 26-32, Roa Malaka, Tambora, Jakarta Barat 11230",
  "kota": "Jakarta Barat",
  "url": "https://banksaqu.co.id",
  "funding_total_usd_m": None,
  "last_round": "joint venture — Astra Financial and WeLab acquired PT Bank Jasa Jakarta in 2022",
  "last_round_year": 2022,
  "employees_est": 461,
  "employees_note": "LinkedIn 461 (+20.2% YoY). Privately held, so no filed headcount.",
  "investors": ["Astra Financial", "WeLab"],
  "verify_note": "Formerly PT Bank Jasa Jakarta, a micro-business lender since 1984; the Bank Saqu digital service launched 2023 and the legal entity was renamed PT Bank Saqu Indonesia in May 2025.",
  "confidence": 0.85,
  "sources": [
   "https://banksaqu.co.id/support/34/di-mana-kantor-pusat-pt-bank-saqu-indonesia-",
   "https://banksaqu.co.id/about",
   "https://id.wikipedia.org/wiki/Bank_Saqu_Indonesia",
  ],
 },
]

# Published on the page so the boundary is auditable, not implied. Every name
# here was considered under Luca's rule and fails one of its three tests.
SCOPE = {
    "rule": "A company is counted when it was built or bought by tech or venture money rather than run as an incumbent's product line, when it is its own legal entity, and when a headcount can be sourced. All three have to hold.",
    "decided": "2026-08-29",
    "outside": [
        {"name": "Jenius", "owner": "PT Bank BTPN Tbk (SMBC)",
         "why": "a product brand, not a company — Jenius has no legal entity of its own, so there is nothing to count separately from BTPN"},
        {"name": "blu", "owner": "PT Bank Digital BCA",
         "why": "its own entity, but BCA's digital arm rather than a tech-built bank — an incumbent product line"},
        {"name": "Hibank", "owner": "PT Bank Hibank Indonesia (BNI)",
         "why": "BNI's MSME digital arm, formerly Bank Mayora — incumbent-built"},
        {"name": "Bank Raya", "owner": "PT Bank Raya Indonesia Tbk (BRI)",
         "why": "BRI's digital arm, formerly Bank Agroniaga — incumbent-built"},
        {"name": "TikTok Shop Indonesia", "owner": "ByteDance / PT Tokopedia",
         "why": "operated through PT Tokopedia since the 2024 merger, and Tokopedia is already counted — a separate row would double-count the same staff"},
    ],
}

BANK_ANCHOR = 1680
BANK_CAVEAT = (
    "Licensed banks carry their own GVA anchor (Rp 1,680 million per worker), not the "
    "fintech one. It is BPS DKI Jakarta's sector K (financial services and insurance) "
    "figure of Rp 1,976 million per worker at the same 0.85 discount used elsewhere, and "
    "it deliberately sits above the Rp 1,282 million M,N cap: that cap exists to stop "
    "STARTUPS being valued at bank-average productivity, and licensed banks are the very "
    "firms whose output produces the K average, so it does not apply to them. Pricing a "
    "bank at the fintech anchor would understate it, not inflate it. The estimate stays "
    "conservative against what these banks report — SeaBank's 776 staff come to Rp 1.3T "
    "here against Rp 8.18T of 2025 revenue and Rp 678bn of net profit."
)


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by_id = {c.get('id'): c for c in raw['companies']}

    added, updated = [], []
    for rec in NEW:
        if rec['id'] in by_id:
            by_id[rec['id']].update(rec)
            updated.append(rec['name'])
        else:
            raw['companies'].append(dict(rec))
            added.append(rec['name'])

    anchors = raw['method']['gva_per_worker_idr_m_by_sector']
    anchor_new = anchors.get('bank') != BANK_ANCHOR
    anchors['bank'] = BANK_ANCHOR

    caveats = raw['method'].setdefault('caveats', [])
    if not any(c.startswith('Licensed banks carry their own GVA anchor') for c in caveats):
        caveats.insert(4, BANK_CAVEAT)

    # MERGE, never replace: other cohort scripts (census-fitness.py) own their
    # own scope lines, and a wholesale assignment here would wipe them on a
    # repair re-run. Upsert by name; rule/decided converge on the shared text.
    sc = raw.setdefault('scope', {})
    # nationwide since 28 Sep 2026: census-national.py owns the rule text
    if not sc.get('nationwide_added'):
        sc['rule'] = SCOPE['rule']
    sc.setdefault('decided', SCOPE['decided'])
    have = {e.get('name'): e for e in sc.setdefault('outside', [])}
    for e in SCOPE['outside']:
        if e['name'] in have:
            have[e['name']].update(e)
        else:
            sc['outside'].append(dict(e))

    json.dump(raw, open(RAW, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"added {len(added)}: {', '.join(added) or '-'}")
    print(f"updated {len(updated)}: {', '.join(updated) or '-'}")
    print(f"bank anchor {'set' if anchor_new else 'unchanged'} at {BANK_ANCHOR} jt/worker; "
          f"scope register: {len(SCOPE['outside'])} named outside")
    print(f"companies now {len(raw['companies'])}")


if __name__ == '__main__':
    main()
