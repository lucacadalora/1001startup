#!/usr/bin/env python3
"""census-funding-fix.py — one-off, idempotent: attach a funding source to the
rows the automatic picker could not source, and correct the figures that no
public source actually supports.

Luca, Aug 29 2026: "we need to put a link of the funding information, so it not
looks like assumption, especially that small company like bahasa.ai which i
believe a group/same group with meeting.ai" — he was right about Bahasa.ai: the
US$2M on that row came from trackers only, while East Ventures' own release says
the 2018 seed was undisclosed, and the team has since pivoted to Meeting.ai,
which has raised nothing at all.

Every entry below was checked against a primary or press source (listed in
`src`); where the census total exceeded what any source supports it is cut to
the sourced amount, and where nothing is disclosed the figure goes to null —
"—" is an honest answer, an unsourced number is not.
"""
import json, os, tempfile

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'census-raw.json')

FIX = {
  'gojek': dict(
    src='https://www.cbinsights.com/research/gojek-tokopedia-merger/',
    note='Cumulative venture funding into Gojek before the 2021 Tokopedia merger '
         '(Google, Tencent, Temasek, KKR, Meituan and others). Aggregated by trackers '
         'across a decade of rounds — it was never disclosed as a single figure. GoTo is '
         'now listed on the IDX (GOTO).',
    extra=['https://pitchbook.com/newsletter/gojek-raises-300m-before-tokopedia-merger']),

  'modalku': dict(
    src='https://fundingsocieties.com/press/2022/us294m-seriesc-fundraise',
    note='Equity raised at Funding Societies | Modalku group level, not by the Indonesian '
         'entity alone: US$144M Series C+ led by SoftBank Vision Fund 2 (Feb 2022, announced '
         'alongside US$150M of debt lines, which are excluded here), earlier rounds, and '
         'US$25M from Cool Japan Fund (Dec 2024).',
    extra=['https://www.prnewswire.com/apac/news-releases/funding-societies-secures-investment-'
           'from-cool-japan-fund-302335604.html']),

  'linkaja': dict(
    amount=100,
    src='https://linkaja.id/artikel/linkaja-announces-strategic-investment-from-grab',
    note='US$100M Series B led by Grab with Telkomsel, BRI Ventura Investama and Mandiri '
         'Capital (Nov 2020). The Mitsui & Co. strategic investment of Mar 2024 was not '
         'disclosed in size, so nothing is added for it.',
    extra=['https://technode.global/2024/03/27/indonesias-linkaja-secures-strategic-investment-from-mitsui/']),

  'pasarpolis': dict(
    amount=71, round='Extension led by Tokio Marine (size not confirmed)', year=2025,
    src='https://techcrunch.com/2020/09/02/indonesian-insurtech-startup-pasarpolis-gets-54-million-'
        'series-b-from-investors-including-leapfrog-and-sbi/',
    note='US$54M Series B (LeapFrog, SBI, Xiaomi, Alpha JWC, Intudo, Go-Ventures; Sep 2020), US$5M of '
         'equity from IFC (Feb 2021) and a US$12M bridge in late 2023. The 2018 Series A from Gojek, '
         'Tokopedia and Traveloka was undisclosed, and the Tokio Marine-led extension of Sep 2025 was '
         'reported at about US$5M but never confirmed \u2014 neither is added here.',
    extra=['https://technode.global/2021/02/04/indonesia-insurtech-platform-pasarpolis-raises-5-'
           'million-in-equity-financing-from-the-world-banks-groups-ifc/',
           'https://www.dealstreetasia.com/stories/pasarpolis-secures-funding-japanese-investor-456223',
           'https://fintechnews.id/108509/insurtech/pasarpolis-extension-funding-tokio-marine/']),

  'migo': dict(
    amount=60,
    src='https://www.dealstreetasia.com/stories/indonesia-mnc-group-migo-260170',
    note='US$40M from MNC Vision Networks for a minority stake in the Indonesian unit (Sep 2021) '
         'and a further US$20M from the same group (Feb 2023). The earlier Series B1 (Temasek) '
         'and B2 (Steve Chen, Provident, Vickers) were undisclosed.',
    extra=['https://www.dealstreetasia.com/stories/migo-series-c-round-329578',
           'https://migo.io/2020/09/07/migo-closes-series-b2-round-funded-by-youtube-co-founder-and-go-jek-commissioners']),

  'pintek': dict(
    amount=7, round='Series A', year=2021,
    src='https://www.accion.org/news/pintek-raises-7m-series-a-to-grow-its-education-fintech-ecosystem-in-indonesia/',
    note='US$7M Series A (Nov 2021; Kaizenvest, Heritas Capital, Blue7, Earlsfield, with Finch '
         'Capital, Global Founders Capital, Accion Venture Lab, Strive and Fox Ventures). Pintek '
         'states more than US$35M raised in total, but that figure includes debt facilities; the '
         'earlier pre-Series A was undisclosed.',
    extra=['https://e27.co/education-targeted-fintech-platform-pintek-secures-pre-series-a-funding-'
           'led-by-gfc-diving-further-to-education-based-finance-sector-20191108/']),

  'uangme': dict(
    round='Growth round at parent SuperAtom (Gobi Partners, Cheetah Mobile)', year=2019,
    src='https://www.dealstreetasia.com/stories/gobi-partners-superatom-153450',
    note='US$24M led by Gobi Partners with Cheetah Mobile (Sep 2019) — raised by SuperAtom, the '
         'Singapore parent that operates UangMe in Indonesia, not by the Indonesian entity. '
         'SuperAtom later raised a US$22M Series C from Nue3 Capital.',
    extra=['https://fintechnews.sg/33512/funding/indonesia-based-lending-fintech-raises-us-24-'
           'million-in-gobi-partners-led-round/']),

  'eureka-ai': dict(
    amount=20, round='Series B (Apis Partners, Gobi Partners)', year=2020,
    src='https://kr-asia.com/eureka-series-b-round',
    note='US$20M Series B (Feb 2020; Apis Partners, Gobi Partners, Riyad TAQNIA Fund, MEC Ventures, '
         'with SGInnovate, GDP Ventures, Pacific Bridge and Cianna Capital). Earlier rounds undisclosed.',
    extra=['https://www.digitalnewsasia.com/startups/indonesian-ai-startup-eurekaai-closes-us20m-series-b-round']),

  'lion-parcel': dict(
    amount=None, round='None disclosed', year=None,
    note='No disclosed external funding round. Lion Parcel is part of the Lion Air Group and has '
         'said it is financed internally, with an IPO discussed as the route to outside capital.',
    extra=['https://investasi.kontan.co.id/news/lion-parcel-berniat-gelar-ipo-di-tiga-tahun-mendatang-ini-alasannya']),

  'ekrut': dict(
    amount=None, round='Pre-Series A (Venturra Discovery) \u2014 amount undisclosed', year=2019,
    note='Both rounds were undisclosed: seed from East Ventures (Jan 2017) and a pre-Series A led '
         'by Venturra Discovery with Azure Ventures and Bizreach (Apr 2019). EKRUT was acquired by '
         'GetLinks in Jun 2023.',
    extra=['https://www.dealstreetasia.com/stories/indonesian-job-marketplace-ekrut-closes-pre-series-'
           'a-led-by-venturra-discovery-130020']),

  'pasarmikro': dict(
    amount=2.5, round='Seed', year=2022,
    src='https://e27.co/indonesia-based-agri-commodity-trade-platform-pasarmikro-bags-us2-5m-seed-capital-20221104/',
    note='US$2.5M seed (Nov 2022). The earlier seed led by 1982 Ventures (Jan 2022) was undisclosed.',
    extra=['https://www.nasdaq.com/press-release/1982-ventures-backs-indo-agritrading-marketplace-pasarmikro-2022-01-13']),

  'danacita': dict(
    round="Series A (Monk's Hill Ventures, Qualgro)", year=2021,
    src='https://www.dealstreetasia.com/stories/indonesia-danacita-series-a-229240',
    note="US$5M Series A (Feb 2021; Monk's Hill Ventures and Qualgro). Danacita operates as part of "
         'the ErudiFi group.'),

  'tanamduit': dict(
    round='Seed (RND Capital)', year=2018,
    src='https://e27.co/indonesias-online-mutual-fund-platform-tanamduit-secures-us3m-rnd-capital-20180907/',
    note='US$3M seed from RND Capital (Sep 2018); no later round has been disclosed.',
    extra=['https://www.dealstreetasia.com/stories/indonesian-mutual-fund-startup-tanamduit-raises-3m-from-rnd-capital-106230']),

  'sonar-platform': dict(
    amount=None, round='Acquired by Dataxet', year=2020,
    note='Rounds undisclosed. Sonar was acquired by Dataxet in 2020 and now trades as Dataxet:Sonar.',
    extra=['https://tracxn.com/d/companies/sonar-platform/__jbwBtkoig3vA9NrLpoQFEOT0KS2SQPTpM289q0-x72I']),

  'bahasa-ai': dict(
    amount=None, round='Seed (East Ventures) \u2014 amount undisclosed', year=2018,
    name='Bahasa.ai (Meeting.ai)',
    note='Seed from East Ventures (Aug 2018) — East Ventures’ own release says the amount was '
         'undisclosed, so the US$2M carried by trackers is not used. The same team pivoted in 2023 '
         'to Meeting.ai, which East Ventures reported in Nov 2024 as having raised no external '
         'funding; no later round has been announced as of the Aug 2026 re-check.',
    verify='Same company, two brands: Hokiman Kurniawan co-founded Bahasa.ai (2016, Indonesian-language '
           'chatbots) and launched Meeting.ai in Jul 2023 off Bahasa.ai’s revenue; Bahasa.ai keeps '
           'operating alongside it. Bootstrapped since the 2018 East Ventures seed — ~20 staff, mostly '
           'engineers, and 111k total users as of Nov 2024. The 3-person LinkedIn count belongs to the '
           'old Bahasa.ai page; headcount now sits under the Meeting.ai brand.',
    extra=['https://east.vc/news/press-release/bahasa-ai-seed-funding',
           'https://east.vc/news/from-portfolios/battle-of-the-ai-transcribers-meeting-ai-takes-on-otter-ai']),

  # --- second pass: links the picker chose that did not actually evidence money ---
  'tokopedia': dict(
    src='https://techcrunch.com/2018/12/11/tokopedia-raises-1-1b/',
    note='Cumulative funding before the 2021 GoTo merger, aggregated across a decade of rounds — '
         'the largest disclosed being US$1.1B led by SoftBank Vision Fund and Alibaba (Dec 2018). '
         'Tokopedia has been 75.01%-owned by TikTok/ByteDance since 2024 and no longer raises on '
         'its own account.',
    extra=['https://www.thejakartapost.com/news/2018/12/12/tokopedia-secures-us1-1b-in-latest-financing-round.html']),

  'cashlez': dict(
    amount=5.8,
    src='https://asia.nikkei.com/Business/Startups/Indonesian-mobile-POS-startup-Cashlez-raises-5.8-million-in-IPO',
    note='US$5.8M raised in the Apr 2020 IPO on the IDX (ticker CASH). Pre-IPO rounds were not disclosed.'),

  'dattabot': dict(
    amount=None, round='First round (Alpha JWC Ventures) \u2014 amount undisclosed', year=2016,
    note='The 2016 first round led by Alpha JWC Ventures was announced without a figure, and no later '
         'round has been disclosed — the US$4M previously carried here had no public source.',
    extra=['https://e27.co/after-rebranding-mediatrac-will-now-be-known-as-dattabot-20160909/']),

  'tiket-com': dict(
    amount=None, round='Acquired in full by Blibli / PT Global Digital Niaga', year=2017,
    note='The 2011–12 seed was never disclosed, and tiket.com has been wholly owned by Blibli '
         '(PT Global Digital Niaga, IDX: BELI) since 2017 — it does not raise on its own account.'),

  'indodax': dict(
    amount=None, round='Undisclosed (East Ventures)', year=2017,
    note='Indodax appears in East Ventures\u2019 portfolio, but no round amount has ever been '
         'disclosed; the company describes itself as bootstrapped.'),

  'pahamify': dict(
    src='https://www.dealstreetasia.com/stories/indonesian-edtech-firm-pahamify-bags-series-a-led-by-shunwei-capital-217449',
    note='Only Y Combinator\u2019s standard deal for the W20 batch (US$150K) is a disclosed amount. The '
         'Series A led by Shunwei Capital (Oct 2020) was announced without a figure, so nothing is '
         'added for it.',
    extra=['https://www.ycombinator.com/blog/ycs-500-000-standard-deal']),

  # link check found this TechCrunch slug 404s — the published one carries the amount
  'fundtastic': dict(
    round='Series A (Ascend Capital Group, Indivara Group)', year=2021,
    src='https://techcrunch.com/2021/02/22/indonesian-investment-platform-fundtastic-lands-7-7-million-series-a/',
    note='US$7.7M Series A led by Ascend Capital Group with Indivara Group (Feb 2021).',
    extra=['https://www.dealstreetasia.com/stories/fundtastic-ascend-capital-indivara-228541']),

  'solarkita': dict(
    amount=None, round='Follow-on (Indonesia 1 Fund, Schneider Electric Energy Access Asia) \u2014 amount undisclosed', year=2024,
    note='First cheque from New Energy Nexus\u2019 Indonesia 1 Fund (Jun 2021) and a follow-on with '
         'Schneider Electric Energy Access Asia (announced Jan 2024) — neither was disclosed in size.',
    extra=['https://teknologi.bisnis.com/read/20240122/84/1734473/schneider-electric-energy-access-asia-umumkan-investasinya-di-solarkita',
           'https://newenergynexus.id/news/new-energy-nexus-mobilizes-investments-into-4-solar-pv-startups-through-its-indonesia-1-fund/']),
}


DEAD = {'https://techcrunch.com/2021/02/22/indonesian-investment-platform-fundtastic/'}


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by = {c['id']: c for c in raw['companies']}
    missing = [k for k in FIX if k not in by]
    if missing:
        raise SystemExit(f'unknown ids: {missing}')
    for cid, f in FIX.items():
        c = by[cid]
        if 'amount' in f:
            c['funding_total_usd_m'] = f['amount']
        if 'name' in f:
            c['name'] = f['name']
        # a tooltip that says "Series A · 2022" over a note explaining a 2018 seed
        # is its own credibility problem — the round label moves with the figure
        if 'round' in f:
            c['last_round'] = f['round']
        if 'year' in f:
            c['last_round_year'] = f['year']
        if 'employees' in f:
            c['employees_est'] = f['employees']
        if 'employees_note' in f:
            c['employees_note'] = f['employees_note']
        if 'verify' in f:
            c['verify_note'] = f['verify']
        c['funding_note'] = f['note']
        if f.get('src'):
            c['funding_src_manual'] = f['src']
        else:
            c.pop('funding_src_manual', None)
        srcs = list(dict.fromkeys((c.get('sources') or []) +
                                  ([f['src']] if f.get('src') else []) + f.get('extra', [])))
        c['sources'] = [u for u in srcs if u not in DEAD]
        print(f"{cid:16s} funding={c.get('funding_total_usd_m')}  src={f.get('src') or '(none — figure withdrawn)'}")

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)


if __name__ == '__main__':
    main()
