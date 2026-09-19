#!/usr/bin/env python3
"""census-row-fix.py — hand-verified corrections to single rows that no sweep can make.

Idempotent; each entry carries the evidence in its own note. Run after the automated
passes (census-headcount.py apply, census-funding-src.py) so a sweep cannot undo a
judgement call made here.
"""
import json, os, tempfile

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')

FIX = {
  # Luca, Aug 29 2026: the Nov-2024 "about 20 people" figure was stale, and chasing the
  # live LinkedIn pages turned up two more errors in the row — the Serpong address had
  # been dead for years, and the operating entity is a Singapore holdco.
  # Luca got the real number from Kata.ai's CEO (Aug 2026): 62. No public source
  # reproduces it — LinkedIn's live profile count says 91, Growjo 87, Exa's index 53,
  # LeadIQ 200, adapt.io 250, and LinkedIn's own band only says 51-200. A company
  # statement outranks all of them, and the note is worded so the LinkedIn sweep's
  # PROTECTED rule will never overwrite it.
  'kata-ai': dict(
    employees_est=62,
    employees_kind='company',
    employees_asof='2026-08-29',
    employees_note='Company statement: 62 people, given by Kata.ai to the census in Aug 2026. '
                   'Public trackers do not agree with each other or with the company — LinkedIn '
                   'listed 91 profiles the same week, Growjo 87, LeadIQ 200, adapt.io 250 — so the '
                   'company\u2019s own figure is used and none of the others is averaged in.',
  ),

  'bahasa-ai': dict(
    hq_address='Neo Soho Capital, Jl. Letjen S. Parman Kav. 28, Tanjung Duren Selatan, '
               'Grogol Petamburan, Jakarta Barat 11470',
    kecamatan='Grogol Petamburan',
    kota='Jakarta Barat',
    in_dki=True,
    lat=-6.176944, lon=106.791389,
    geocode_src='LinkedIn office listing (Neo Soho, Jakarta Barat) + Neo Soho published address',
    # the complex, not the floor: nominatim is rate-limited right now, so this is the
    # published Neo Soho address pinned approximately — geocode-census.js --repin will refine it
    geocode_kind='kelurahan',
    legal_name='Bahasalab Automation Pte. Ltd. (Singapore holdco; Indonesian operations in Jakarta Barat)',
    employees_est=12,
    employees_kind='manual',      # hand-reconciled across two brand pages — the sweep must not undo it
    employees_asof='2026-08-29',
    employees_src='https://www.linkedin.com/company/meeting-ai',
    employees_note='LinkedIn, read 2026-08-29: 12 people on the Meeting.ai page and 11 on the '
                   'Bahasa.ai page — largely the same team under two brands, so the row counts 12 '
                   'rather than the sum. Down from about 20 across both brands in Nov 2024.',
    verify_note='Same company, two brands: Hokiman Kurniawan co-founded Bahasa.ai (2016, '
                'Indonesian-language chatbots), pivoted in 2022 and launched Meeting.ai in Jul 2023 '
                'off Bahasa.ai’s revenue; Bahasa.ai’s own LinkedIn calls Meeting.ai its product. '
                'Bootstrapped since the 2018 East Ventures seed. LinkedIn (Aug 2026) puts the '
                'Meeting.ai holdco in Singapore with the working office at Neo Soho, Jakarta Barat, '
                'and Bahasa.ai headquartered in Jakarta — the Serpong/BSD address the census carried '
                'came off an old site and is retired. Counted like Qiscus: a Singapore holdco over a '
                'Jakarta operation stays in the census. Meeting.ai reports 600,000+ users (Aug 2026), '
                'up from 111k in Nov 2024.',
    sources_add=['https://www.linkedin.com/company/meeting-ai',
                 'https://meeting.ai'],
  ),

  # Dash-row sweep, 30 Aug 2026 (Luca: "need to enhance this data, i believe shopee,
  # lalamove etc has employee"). Every null-headcount row was re-run through live
  # LinkedIn crawls, Revelio probes and Exa company records. Filled where a current
  # entity-scoped figure exists; rejections are recorded IN the notes so the next
  # session does not re-litigate them (the invisible-rejection rule).

  # The find that unlocked this row: SiCepat's own Mar-2026 announcement pays BHR —
  # the government bonus scheme for PARTNER (mitra) couriers, distinct from the
  # statutory employee THR — to ~18,000 couriers (CEO Barry Lim, 4 Mar 2026;
  # Liputan6's headline literally says "BHR Mitra SiCepat", and tirto groups it with
  # Grab and inDrive's partner payouts). That classifies today's fleet as mitra, so
  # the old "courier fleet vs desk count is unsplittable" reason for the dash no
  # longer holds: the countable payroll is the desk-visible workforce, and the row
  # takes the Ninja Xpress treatment (Revelio entity model, partner fleet excluded).
  'sicepat-ekspres': dict(
    employees_est=3925,
    employees_asof='2026-03',
    employees_tier=5,
    employees_kind='manual',
    employees_src='https://www.reveliolabs.com/companies/pt-sicepat-ekspres/employees',
    employees_li=1207,
    employees_li_asof='2026-08-29',
    employees_reviewed='2026-08-30',
    employees_note='INDONESIAN PAYROLL ONLY, from a workforce model — Revelio Labs reads 3,925 '
                   '(Mar 2026); LinkedIn shows 1,207 profiles. The courier fleet is EXCLUDED as '
                   'mitra: SiCepat’s own Mar-2026 announcement (CEO Barry Lim) pays BHR — '
                   'the bonus scheme for partner couriers, distinct from the statutory employee '
                   'THR — to about 18,000 couriers, which classifies today’s fleet as '
                   'partners rather than payroll. That reclassification is what replaced the old '
                   'dash: the 59,286 of March 2022 was a courier-inclusive figure from the era '
                   'when SiCepat employed its fleet, and no longer describes the company. To the '
                   'extent any couriers remain on payroll, this figure is a floor.',
    sources_add=['https://www.reveliolabs.com/companies/pt-sicepat-ekspres/employees',
                 'https://ekonomi.bisnis.com/read/20260304/98/1957562/sicepat-ekspres-akan-salurkan-bhr-untuk-18000-kurir-nominal-naik-50',
                 'https://www.liputan6.com/bisnis/read/6290712/bhr-mitra-sicepat-ekspres-naik-50-18000-orang-kebagian'],
  ),

  'duluin': dict(
    employees_est=44,
    employees_asof='2026-08-30',
    employees_tier=4,
    employees_src='https://www.linkedin.com/company/duluin',
    employees_li=44,
    employees_li_asof='2026-08-30',
    employees_note='44 on the Duluin Group LinkedIn page, read live 30 Aug 2026 — the earlier '
                   'crawl could not render a count. The self-declared band 11-50 corroborates.',
    sources_add=['https://www.linkedin.com/company/duluin'],
  ),

  'prosa-ai': dict(
    employees_est=32,
    employees_asof='2026-08-30',
    employees_tier=4,
    employees_src='https://www.linkedin.com/company/prosa-ai',
    employees_li=32,
    employees_li_asof='2026-08-30',
    employees_note='32 on the LinkedIn page, read live 30 Aug 2026 — the earlier crawl could '
                   'not render a count. The page’s self-declared band still says 51-200; a '
                   'band is a stale self-declaration and never arbitrates, so the live count is '
                   'published and the disagreement recorded.',
    sources_add=['https://www.linkedin.com/company/prosa-ai'],
  ),

  'binar': dict(
    employees_est=225,
    employees_asof='2026-08-30',
    employees_tier=5,
    employees_src='https://www.linkedin.com/company/binar-academy',
    employees_exa=225,
    employees_note='225 per Exa’s workforce record for the company (read 30 Aug 2026; the '
                   'record matches Binar — founded 2017, IT services after the B2B pivot). '
                   'The LinkedIn page itself was erroring on both crawl attempts, so no live page '
                   'count cross-checks this yet — re-read when the page renders.',
    sources_add=['https://www.linkedin.com/company/binar-academy'],
  ),

  'own-games': dict(
    employees_note='NO PUBLISHABLE FIGURE. The LinkedIn page carries the size band 11-50 but no '
                   'live count has rendered on any crawl. Checked and REJECTED 30 Aug 2026: '
                   'Exa’s workforce record models 5 people but mis-locates the company in '
                   'Tampere, Finland under an unrelated entity — entity contamination, not '
                   'evidence. The dash stands until a clean figure exists.',
  ),

  'shopee-indonesia': dict(
    employees_note='Withdrawn rather than estimated. The only Indonesian figures Shopee has ever '
                   'put on the record are from 2022 and they disagree by a factor of three: 6,232 '
                   'staff at PT Shopee International Indonesia in Q1 2022 (the base the September '
                   '2022 layoff coverage used), against "more than 20,000 employees in Indonesia '
                   'across Shopee, ShopeePay and ShopeeFood" from its own executive in June 2022. '
                   'Since then Shopee has relocated or cut more than a thousand Indonesian roles, '
                   'and Sea Limited discloses no country breakdown. Under the global-parent rule '
                   'the row stays in the census at its Indonesian scope, with a dash where there '
                   'is no defensible Indonesian number. Re-checked 30 Aug 2026: Revelio carries no '
                   'Indonesian entity, and Exa’s workforce record for shopee.co.id (605 '
                   'people, +716% YoY, "founded 2020") is an entity fragment — rejected. The '
                   '6,200 this row used to carry was the 2022 figure carried forward four years.',
  ),

  # Luca, Aug 30 2026: "im not sure feedloop still has this lot of employee, check it."
  # He was right. The row carried an UNDATED "company site: 90+ people" claim — the sweep
  # held it (no replaceable keyword in the note) and parked the live count in employees_li
  # without anyone adjudicating. Due diligence: the "90+ Team members" stat sits on
  # feedloop.ai/about, a page that only exists on the redesigned site (Common Crawl: the
  # old site was still up on the 2026-06-13 capture; /about first appears 2026-08-07), and
  # the stat is a carried-forward marketing figure — every dated source sits far below it.
  'feedloop-ai': dict(
    legal_name='PT Feedloop Global Technology',
    employees_est=57,
    employees_asof='2026-08-30',
    employees_tier=4,
    employees_kind='linkedin',
    employees_src='https://www.linkedin.com/company/feedloopai/',
    employees_li=57,
    employees_li_asof='2026-08-30',
    employees_exa=47,
    employees_note='57 on the LinkedIn page, read live 30 Aug 2026; LinkedIn’s own size band '
                   '51-200 agrees. The about page on the company’s redesigned site still says '
                   '“90+ team members”, but that stat is undated and every dated source '
                   'sits well below it: Exa’s workforce record models 47 (−36% year on '
                   'year, three senior product/engineering departures logged Feb–Apr 2026), '
                   'PitchBook lists 77, Latka 86 as of Dec 2024. The trail reads as a ~90-person '
                   'team in 2024–25 that has since contracted — and a LinkedIn count lags '
                   'high when a company shrinks (the Kata.ai check), so read 57 as the high end, '
                   'not a floor.',
    verify_note='feedloop.ai/contact, re-read 30 Aug 2026 on the redesigned site, still lists '
                '“Jakarta — Headquarters, Jl. Tulodong Bawah No. 12B” with Bandung '
                'as an engineering hub — matches the record (Senayan, Kebayoran Baru); the '
                'Melawai X No. 9 pin LinkedIn shows is the pre-2025 office (it is the footer '
                'address on 2024 captures of the old site). TMI-led pre-Series A (2021) and East '
                'Ventures seed confirmed by the cited sources; no amount ever disclosed. Legal '
                'name PT Feedloop Global Technology per the company’s own LinkedIn page — '
                'not found on companieshouse.id, so registry-unverified. Site relaunched between '
                'the Jun and Aug 2026 crawls around an enterprise-AI product line (Velosight '
                'narrative intelligence, Unison customer intelligence, Atlas knowledge graphs); '
                'LinkedIn active through Dec 2025 (Gelora Wirausaha ITB) — operating, but '
                'smaller than its own about-page stat: see the headcount note. FL1 Indonesian '
                'LLM claim genuine.',
    sources_add=['https://www.linkedin.com/company/feedloopai/',
                 'https://feedloop.ai/about'],
  ),
}


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by = {c['id']: c for c in raw['companies']}
    for cid, f in FIX.items():
        c = by.get(cid)
        if not c:
            print(f'  ! {cid} not in census — skipped')
            continue
        add = f.pop('sources_add', []) if 'sources_add' in f else []
        for k, v in f.items():
            c[k] = v
        if add:
            c['sources'] = list(dict.fromkeys((c.get('sources') or []) + add))
        print(f"{cid}: employees={c.get('employees_est')} ({c.get('employees_asof')}), {c.get('kota')}")
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)


if __name__ == '__main__':
    main()
