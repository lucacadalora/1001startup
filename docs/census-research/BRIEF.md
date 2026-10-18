# 1001startup.id census: research brief, wave "more-legit" (18 Oct 2026)

1001startup.id is a public census of Indonesian startups ("the Indonesian Crunchbase"). Every row is
published on a company page, so every figure must be sourced and every sentence true. The owner asked
for "more and more legit startups". Your job: find Indonesian startups that are NOT yet in the census in
your lane, and research each one to the census standard below.

**Quality over count.** 6-12 fully verified rows is an excellent result for a lane. A wrong row (dead
company, wrong headcount, invented funding, namesake) is far worse than a missing one. When in doubt,
put the company in `backlog` with what is missing.

Files in this folder (read-only for you):
- `existing.tsv`: everything already decided: census rows (name, legal name, url, kota), the closed
  register, removals, scope.outside rejections, prior rejections with reasons. Check every candidate
  against it first: names, legal names, old names and brand renames. Skip anything already there unless
  you hold NEW evidence that reverses an earlier "outside" decision (then use `reversals`, not `rows`).
- `example-rows.json`: two published rows. Match this shape and this depth exactly.
- `example-rejected.json`: how a rejection is written.
- `pending-rosters.json`, `backlog-w1.json`: lists some lanes start from.
- `tools/exa.py` (search + page contents through Exa; its own quota) and `tools/li.py` (live LinkedIn
  company-page read: people count, band, HQ). Run them with `python3 -I`.
- `claims.tsv`: shared, append-only. Before you research a candidate, run
  `grep -i "<name>" claims.tsv`; if another lane claimed it, skip it. Otherwise claim it:
  `printf '%s\t%s\n' "<lane>" "<name>" >> claims.tsv`.

## The tests (all must hold)

1. **Venture-built, a real tech company.** Built or bought by tech or venture money (VC, angel or
   accelerator backed, or a bootstrapped tech company selling its own product). NOT an incumbent's product
   line (a bank, conglomerate, telco or state-owned company's unit or brand). NOT an agency: a software
   house, outsourcing or consulting firm, system integrator or reseller that mainly sells its team's time
   is out, unless its own product is now the main business (say what shows that). A brand that is part of
   a company already in the census is a double count: reject it.
2. **Its own legal entity.** The PT (or a foreign holdco plus an Indonesian PT) named by a first-party
   page (site footer, terms, privacy policy, app-store developer name, the company's own release) or a
   registry (AHU via companieshouse.id, OJK, Bank Indonesia or Komdigi PSE lists). `legal_src` = that URL.
3. **A dated 2026 headcount with a source.** Preference order: filing > the company's own DATED statement
   > attributed 2026 reporting > the live LinkedIn people count you read today (`tools/li.py <slug>`,
   cite `https://www.linkedin.com/company/<slug>` and today's UTC date) > a dated vendor record. Never a
   size-band midpoint; never an undated marketing stat ("90+ team members") over a dated read. Make sure
   the LinkedIn page is the right company (it links to the site, the HQ matches; watch namesakes, foreign
   pages, co-branded programme pages). Partners paid per task (drivers, couriers, mitra, freelancers) are
   not employees; salaried field or store staff are (then set `workforce_kind: "frontline"` and a
   `workforce_note`). The self-declared LinkedIn band only corroborates; the count wins when they differ.
   Very small teams (under about 5 people) need a clear operating business AND outside backing to be
   worth a row; otherwise reject or backlog with the reason.

**Geography.** Head office anywhere in Indonesia. Give `kota` ("Jakarta Selatan", "Kota Surabaya",
"Kabupaten Sleman", "Kota Bandung"...), `province` ("DKI Jakarta", "Jawa Timur", "Daerah Istimewa
Yogyakarta"...), `kecamatan` when known, and a street `hq_address` with `hq_src`. A Singapore holdco
whose team and business are Indonesian counts at the Indonesian address (see the Sokratech example). A
foreign group's Indonesian arm counts at its Indonesian slice only: Indonesian payroll, and group funding
is NOT an Indonesian figure (funding dash, the group story in `funding_note`).

**Liveness.** The site answers today AND there is a 2026 operating signal (company LinkedIn posts, app
update, 2026 news, hiring, events). Shut down, parked domain, pivoted away or absorbed: reject. If it was
a notable venture-backed company that closed, add it to `closed` (fate `closed` or
`acquired-then-closed`, `ended` YYYY or YYYY-MM, confidence `confirmed` or `reported`, two sources).

## Money: sourced or withdrawn

- `funding_total_usd_m` only from an announcement: the company's or investor's own release, or reputable
  press (DealStreetAsia, Tech in Asia, DailySocial, KrASIA, e27, Katadata, Kontan, Bisnis, CNBC
  Indonesia, Reuters, Bloomberg). Those URLs go in `funding_srcs`.
- Trackers (Crunchbase, Tracxn, PitchBook, CB Insights, Dealroom, thecompanycheck, Latka, F6S) never
  supply a figure or an investor on their own. Mention them only as "tracker context only".
- `funding_status`: `disclosed` (sum of sized rounds), `partial` (some rounds sized: the figure is a
  floor), `undisclosed` (rounds exist, no amounts: figure null), `none_on_record` (no round found:
  figure null), `parent_funded`, `grant_only`, `debt_only`, `listed`.
- IDR amounts: convert at the rate of the announcement date and say so. Debt facilities never count as
  equity. An accelerator's assumed standard cheque does not count; a sourced amount does.
- `investors`: only names a source ties to a round. `valuation_usd_m` null unless reputable reporting
  gives one; then `valuation_note` says where.

## Sector string (it routes the row to a bucket; first match wins)

Write `sector` as "<Category> — <plain description of what it sells and to whom>" and set
`_sector_key` to the bucket you intend. Rules, in order (case-insensitive regex):

```
climate  : climate|carbon|sustainab|renewable|solar|waste|recycl|circular|\besg\b|emission|mangrove|reforest|air.quality|clean energy|bioplastic|reuse|refill|ev charging|charging network
bank     : ^licensed (digital )?bank
crypto   : ^web3/crypto
fintech  : fintech|payment|wallet|lend|bnpl|wealth|invest|remit|bank
misc     : insur
commerce : commerce|marketplace|retail|grocer
logistics: logist|deliver|freight|supply|warehous|courier
health   : health|pharma|biotech|\bbio\b|medic|telemed
edtech   : edtech|educat|upskill|learn
saas     : saas|enterprise|b2b|pos |dev tool|software
ai-cloud : \bai\b|artificial|data|cloud|cyber|it service
media    : media|gaming|game|stream|entertain|creator|music|video
travel   : travel|mobilit|transport|automotive|ride
prop     : prop|construction|hospitality|real estate
agri     : agri|aqua|fish|farm|rural
fnb      : f&b|fnb|food|kitchen|coffee|d2c|consumer brand|new retail
misc     : hr |talent|legal|climate|energy|misc   (anything else -> misc)
```

Trap words: an earlier rule fires first. "marketplace", "commerce", "retail", "supply", "learn",
"invest", "payment", "data", "cloud", "health", "travel" inside a long description will steal the row.
Test your string against the list (python `re.search(p, s, re.I)` over the rules in order) and reword.

## Public text (these fields print on the company page)

`verify_note`, `funding_note`, `employees_note`, `valuation_note`, `workforce_note`: plain English, full
sentences, dates like "18 Oct 2026", sources named by publisher. Never mention tools or process: no
"Exa", "agent", "brief", "scrape", "crawl", "403", "captcha", "search", "li.py", "tracker said so hence".
`verify_note` follows the example: "Test 1 (venture-built): ... Test 2 (own entity): ... Test 3
(headcount): ... Geography: ... Liveness: ... Doubtful: ... Namesakes: ...". Say what is uncertain.

## Row fields

Required: `name`, `id` (lowercase slug, unique), `legal_name`, `legal_src`, `url`, `site_status: "ok"`,
`sector`, `_sector_key`, `hq_address`, `kecamatan`, `kota`, `province`, `hq_src`, `employees_est`,
`employees_asof` (YYYY-MM-DD, UTC), `employees_src`, `employees_kind` (`linkedin` | `company` | `filing`
| `press` | `vendor`), `employees_li_band`, `employees_note`, `funding_total_usd_m`, `funding_status`,
`funding_note`, `funding_srcs`, `last_round`, `last_round_year`, `investors`, `valuation_usd_m`,
`valuation_kind`, `valuation_asof`, `valuation_note`, `founded` (string year or null), `confidence`
(0.6-0.95; below 0.6 = do not submit), `verify_note`, `sources` (every URL you relied on; no tracker or
aggregator pages, no namesake pages), `added` and `liveness_checked` = today's UTC date.

Founders, one entry per row in `founders`: `{"id", "status": "ok"|"insufficient"|"not_applicable",
"founders": [names], "founded": year or null, "sources": [{"url", "kind": "company"|"press"|"investor"|
"registry", "quote": "verbatim sentence naming the founder"}], "note"}`. `ok` needs the company's own
domain or LinkedIn company page or own release, OR two reputable non-aggregator outlets on different hosts.
Aggregators never count. `not_applicable` for a foreign group's arm or a bank unit.

## Tools and limits

- WebSearch is SHARED by every lane (about 200 per turn in total): use at most 15 WebSearch calls.
  Lean on `tools/exa.py search` / `exa.py contents` (separate quota), WebFetch, `curl -sL -A "Mozilla/5.0
  ..."` and `tools/li.py`.
- companieshouse.id, forbes.com, bisnis.com, kontan and some others block this machine: read them with
  `python3 -I tools/exa.py contents <url>` (add `--live` for pages that change).
- Write ONLY inside your own folder `<wave>/<lane>/`. Never write anywhere under ~/projects. Do not edit
  `tools/` or the shared files (except appending to `claims.tsv`). Run Python that reads downloaded pages
  with `python3 -I`, and keep downloads in a `dl/` subfolder of your lane folder.
- Write `<lane>/out.json` incrementally (rewrite it after each finished company) so stopped work survives:

```
{"lane": "...", "rows": [...], "founders": [...], "rejected": [{"name", "why", "sources"}],
 "closed": [...], "reversals": [...], "backlog": [{"name", "city", "why_notable", "source"}],
 "notes": "anything the reviewer must know"}
```

- Aim to finish within about 40 minutes. Your final message: one line per row (id, kota, headcount,
  funding), one line per rejection (name: reason), then backlog names.
