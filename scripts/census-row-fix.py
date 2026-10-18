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

  # 18 Oct 2026 (UTC). The "more legit startups" wave's East Ventures lane found Hijra on
  # EV's portfolio and rejected it as a double count of this row: the ALAMI group has
  # traded as Hijra since its 20 Dec 2022 rebrand. Re-researching the row found it wrong
  # four ways. (1) US$37.5M added the whole Jan 2021 "more than US$20M in equity and
  # debt" round to the Aug 2021 US$17.5M Series A+; that round was never split, so none
  # of it can count as equity, and the floor is seed 1.5 + Series A+ 17.5 = 19.0, partial.
  # (2) Its funding_src (fintech.global, Oct 2022) was the UNSIZED pre-Series B, not the
  # Lendable debt line. (3) 150 people was the midpoint of a 51-200 band. (4) It counted
  # only the P2P company, while the people, the rounds and the brand are the group's.
  # Sector judgement: Hijra Bank is a BPRS (sharia rural bank), a licence class below a
  # commercial bank, and it holds 80 of the group's ~217 people, so the row stays in
  # Fintech at the fintech anchor. The bank bucket (^licensed bank) is for commercial banks
  # and would price all 217 at Rp 1,680M/worker instead of 1,075M (+56% output).
  # Headcount: two LinkedIn pages for one group (Hijra 217, the older ALAMI 525) are
  # reconciled by hand, so employees_kind='manual' keeps the sweep, whose cache points at
  # the ALAMI page, from writing 525 back. The id stays 'alami-sharia' so links keep working.
  'alami-sharia': dict(
    name='Hijra (ALAMI)',
    legal_name='PT Alami Fintek Sharia and PT BPRS Hijra Alami (Hijra Bank); holding companies '
               'Alami Technologies Pte. Ltd. (Singapore) and PT Alami Teknologi Sharia',
    legal_src='https://alamisharia.co.id/tentang-alami/',
    sector='Fintech — Islamic finance group: ALAMI, a sharia P2P platform financing SMEs, and '
           'Hijra Bank, an OJK-licensed sharia rural bank (BPRS) run through a mobile banking app',
    url='https://hijra.id',
    hq_src='https://alamisharia.co.id/tentang-alami/',
    site_status='ok',
    liveness_checked='2026-10-18',
    confidence=0.8,
    funding_total_usd_m=19.0,
    funding_status='partial',
    funding_asof='2026-10-18',
    funding_src='https://www.dealstreetasia.com/stories/alami-ev-growth-quona-254638',
    funding_src_tier='announced',
    funding_floor_note='the pre-seed, the equity share of the Jan 2021 Series A and the 2022 and '
                       '2023 rounds were never sized',
    funding_note='Sized equity on record adds up to at least US$19.0 million; the figure is a floor. '
                 'Counted: (1) the seed round closed in late 2019, US$1.5 million led by Golden Gate '
                 'Ventures with Agaeti Ventures, RHL Ventures and the angel investor Aamir Rahim '
                 '(ALAMI’s release of 13 Nov 2019 names the investors; the amount comes from the '
                 'January 2021 announcement as reported by Tech in Asia and TNGlobal); (2) the Series '
                 'A+, US$17.5 million of equity led by EV Growth and Quona Capital, with AC Ventures '
                 'and Golden Gate Ventures following on (DealStreetAsia, 13 Aug 2021; Tech in Asia, '
                 '19 Aug 2021). Not counted, because no amount was published: the May 2019 pre-seed '
                 'led by tryb Group, an equity investment according to The Business Times; the '
                 'January 2021 Series A led by AC Ventures and Golden Gate Ventures with Quona '
                 'Capital, announced only as more than US$20 million of equity and debt combined, '
                 'with no split, so none of it can be counted as equity; the October 2022 pre-Series '
                 'B led by East Ventures’ growth fund with AC Ventures, Quona Capital, FEBE Ventures '
                 'and Capria Ventures (East Ventures release, 10 Oct 2022); ParagonCorp’s investment '
                 'through Paragon Beneva Investama (Kontan, 20 Dec 2022); and the growth round led by '
                 'Intudo Ventures with East Ventures, AC Ventures, Quona Capital and Golden Gate '
                 'Ventures (ALAMI release, 5 Oct 2023; Bisnis.com reported that the amount was not '
                 'disclosed). Debt is never counted: the Lendable facility of April 2022, up to '
                 'US$30 million, is a financing line, not equity. This row used to show US$37.5 '
                 'million, which added the whole January 2021 equity-and-debt total to the Series '
                 'A+; that figure is withdrawn. In a July 2024 founder profile on BackScoop the group '
                 'described its lifetime raise as around US$50 million of equity and US$50 million of '
                 'debt; that total is not broken down by round, so it is not counted.',
    funding_src_all=[
      'https://www.dealstreetasia.com/stories/alami-ev-growth-quona-254638',
      'https://acv.vc/insights/acv-portfolio-news/a-new-digital-bank-could-instill-vc-faith-in-indonesias-sharia-fintech/',
      'https://www.globalprivatecapital.org/newsroom/ev-growth-and-quona-capital-invest-usd17-5m-in-indonesian-p2p-lender-alami/',
      'https://alamisharia.co.id/blogs/sharia-fintech-firm-alami-bags-20m-in-round-led-by-ac-ventures-golden-gate/',
      'https://technode.global/2021/01/14/sharia-p2p-fintech-alami-secures-us20m-series-a-round/',
      'https://alamisharia.co.id/press/mou-alami-dengan-venture-capital-dalam-acara-indonesia-sharia-economic-forum-isef/',
      'https://e27.co/indonesias-alami-gets-funding-claims-to-be-the-first-sharia-based-vc-funding-round-in-sea-20191114/',
      'https://www.businesstimes.com.sg/startups-tech/startups/islamic-financing-marketplace-alami-bags-funding-led-singapore-based-tryb',
      'https://east.vc/news/press-release/new-investment-fuels-up-alami-group-in-pre-series-b-round-led-by-east-ventures-growth-fund',
      'https://fintech.global/2022/10/11/alami-nets-funding-for-shariah-compliant-p2p-sme-lending/',
      'https://keuangan.kontan.co.id/news/alami-terima-kucuran-pendanaan-dari-paragon',
      'https://alamisharia.co.id/en/press/alami-raises-growth-investment-and-strengthens-its-senior-management-team/',
      'https://finansial.bisnis.com/read/20231005/55/1701539/tekfin-syariah-alami-disuntik-investasi-baru',
      'https://lendable.io/news/alami-secures-usd-30-million-sharia-compliant-financing-facility-from-lendable/',
      'https://www.backscoop.com/newsletter-posts/ice-breakers-with-dima-djani-founder-and-ceo-hijra',
    ],
    last_round='Growth round led by Intudo Ventures (amount undisclosed)',
    last_round_year=2023,
    investors=['Golden Gate Ventures (led seed, co-led Series A)', 'AC Ventures (co-led Series A)',
               'Quona Capital (co-led Series A+)', 'EV Growth (co-led Series A+)',
               'East Ventures (led 2022 pre-Series B)', 'Intudo Ventures (led 2023 growth round)',
               'Capria Ventures', 'FEBE Ventures', 'Paragon Beneva Investama (ParagonCorp)',
               'TryB Group (led pre-seed)', 'Agaeti Ventures', 'RHL Ventures'],
    valuation_usd_m=None,
    valuation_note=None,
    employees_est=217,
    employees_kind='manual',
    employees_asof='2026-10-18',
    employees_tier=4,
    employees_reviewed='2026-10-18',
    employees_src='https://www.linkedin.com/company/hijrabank',
    employees_li=217,
    employees_li_asof='2026-10-18',
    employees_li_band='51-200',
    employees_note='217 people on the Hijra LinkedIn page, read live on 18 Oct 2026. It is the '
                   'group’s current page (it links to hijra.id and gives Jakarta Selatan as '
                   'headquarters); its self-declared size band, 51-200, sits just below the count. '
                   'The group’s older page under the ALAMI name still lists 525 people, and that '
                   'count is not used: LinkedIn keeps counting people who leave without updating '
                   'their profiles, and the group cut staff in September 2023 (DailySocial) and by '
                   'about 40% in February 2025 (DealStreetAsia, Tech in Asia). Two dated figures '
                   'support the order of size: the bank’s own 2025 annual report gives 80 employees '
                   'at Hijra Bank on 31 Dec 2025 (88 a year earlier), the bank alone, and Revelio '
                   'Labs’ workforce model reads 222 for March 2026. Some staff of the P2P company may '
                   'appear only on the ALAMI page, so read 217 as the group’s approximate size rather '
                   'than an exact payroll.',
    verify_note='Test 1 (venture-built): founded in 2018 by three former bankers, Dima Djani, Harza '
                'Sandityo and Bembi Juniar, as ALAMI, a sharia peer-to-peer financing platform, and '
                'venture-backed since 2019 (see the funding note). Its bank is a small rural bank the '
                'group bought in 2021, not an incumbent’s unit. Test 2 (own entity): the group has '
                'traded as Hijra since its rebrand of 20 Dec 2022, and the row counts the whole group, '
                'where its people, funding rounds and brand sit. ALAMI’s own ownership page names '
                'Alami Technologies Pte. Ltd., a Singapore company, as the 85% owner of PT Alami '
                'Fintek Sharia, the OJK-licensed P2P platform, with PT Alami Teknologi Sharia holding '
                'the other 15%. The bank’s 2025 annual report names PT Alami Teknologi Sharia as the '
                '99.99% owner of PT Bank Perekonomian Rakyat Syariah Hijra Alami, the bank behind the '
                'Hijra Bank app launched on 6 Dec 2022. The bank was PT BPRS Cempaka Al Amin, licensed '
                'in 2009; it became BPRS Hijra Alami in May 2021 and took its present name under the '
                '2023 financial-sector law (Hijra notice, 4 Sep 2023). Test 3 (headcount): see the '
                'headcount note. Geography: the group office is Plaza 89 on Jl. H.R. Rasuna Said, '
                'Setiabudi, the address on ALAMI’s site and on the group’s job listings; Hijra Bank’s '
                'own office is Ruko Plaza Pondok Indah 1 in Kebayoran Lama, also Jakarta Selatan. '
                'Liveness: Hijra Bank posted its report for the quarter to September 2026 in October '
                '2026, ALAMI posted its 2025 financial statements on 30 Jun 2026 and shows a current '
                'repayment rate, and both LinkedIn pages carried posts in the four weeks before 18 Oct '
                '2026. Sector: Hijra Bank is a sharia rural bank (BPRS), a narrower licence than a '
                'commercial bank (OJK’s rules bar rural banks from current accounts and foreign '
                'exchange, as Tech in Asia set out in Aug 2021), and it employed 80 of the group’s '
                'roughly 217 people at the end of 2025. The row therefore stays in Fintech, priced at '
                'the fintech output anchor, rather than in Digital Banking, which holds licensed '
                'commercial banks. Doubtful: the group-wide headcount, and how much equity the '
                'unsized rounds added. Namesakes: Hijra Bank S.C. in Ethiopia (hijra-bank.com) is an '
                'unrelated bank.',
    sources_add=['https://hijra.id/',
                 'https://alamisharia.co.id/tentang-alami/',
                 'https://hijra.id/wp-content/uploads/2026/05/Laporan-Tahunan-Annual-Report-PT-BPRS-Hijra-Alami-2025.pdf',
                 'https://hijra.id/blog/uncategorized/info-perubahan-nama-menjadi-pt-bank-perekonomian-rakyat-syariah-hijra-alami/',
                 'https://alamisharia.co.id/en/press/alami-group-rebranded-to-hijra-forging-vision-to-become-a-platform-for-goodness/',
                 'https://hijra.id/wp-content/uploads/2026/10/Laporan-Keuangan-Publikasi-BPRS-Hijra-Alami-Triwulan-III-2026.pdf',
                 'https://alamisharia.co.id/financial-statement/financial-statement-2025/',
                 'https://www.linkedin.com/company/hijrabank',
                 'https://www.linkedin.com/company/alamisharia',
                 'https://www.reveliolabs.com/companies/alami/employees',
                 'https://news.dailysocial.id/post/startup-fintech-hijra-tempuh-phk-demi-jaga-pertumbuhan/',
                 'https://www.dealstreetasia.com/stories/akseleran-alami-layoffs-431125',
                 'https://id.techinasia.com/alami-phk-karyawan-perubahan-strategi',
                 'https://www.kalibrr.com/c/hijra-group/jobs'],
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
    # indent=1 is the file's format since the national publisher (census-national.py)
    # took over; indent=2 here would rewrite all 1.8 MB as one whitespace diff
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=1)
    os.chmod(tmp, 0o664)  # mkstemp makes 0600; keep the file's usual mode
    os.replace(tmp, RAW)


if __name__ == '__main__':
    main()
