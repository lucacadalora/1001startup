# Founder review — brief for each reviewer

1001startup.id is a public census of Indonesian startups where every published
fact carries a source ("sourced or withdrawn": if it cannot be sourced it is left
blank — never guessed). Your output is shown on public company pages, so
precision matters more than coverage.

## Input

`data/founders-work/chunk-N.json` (in /home/ubuntu/projects/pasar-vantis) — a
JSON list of ~55 companies. Each has `id`, `name`, `legal_name`, `url`, `sector`,
`kota`, `founded_on_record`, `endeavor_entrepreneurs` (founders named by
Endeavor's own roster, when present), and `evidence`: trimmed search snippets
(`url`, `title`, `text`) from the company's own site (`"from": "own-site"`) and
the open web (`"from": "web"`). The file is large: read it in pieces or with
python.

## Task

For each company, decide who founded it, with sources.

## Rules

1. A person is a founder only if a source explicitly calls them founder /
   co-founder / cofounder / pendiri / salah satu pendiri, or says they founded /
   mendirikan / "didirikan oleh" the company (or its original product, e.g.
   Go-Jek for the Gojek row). "CEO", "President Director", "Direktur Utama"
   alone is NOT founder.
2. A name is recorded only when ONE of these holds:
   - a) the company's own website / official blog / press release / official
     LinkedIn company page names them as founder; or
   - b) `endeavor_entrepreneurs` names them AND one more independent qualifying
     source agrees; or
   - c) two independent reputable sources name them: news outlets (Kompas,
     Tempo, Detik, CNBC Indonesia, Katadata, Bisnis, Kontan, DailySocial, Tech in
     Asia, KrASIA, DealStreetAsia, e27, Antara, Reuters, Bloomberg, Forbes, CNA,
     SWA, Marketeers, IDN Times, Kumparan, Liputan6, Jakarta Post, Fortune,
     Nikkei, …), an investor's own portfolio/announcement page, or the founder's
     own verifiable profile/site.
   Aggregators never count (Crunchbase, Tracxn, CB Insights, PitchBook,
   Dealroom, theorg.com, founders.io, ZoomInfo, RocketReach, Apollo, Owler,
   Craft, Golden, Wikidata, Wikipedia itself, SignalHire, LeadIQ,
   StartupRanking, Seedtable, Latka, Growjo, Glassdoor, startupintros,
   thecompanycheck). Use them only as leads, then confirm elsewhere.
3. Conflicts: if qualifying sources disagree on who the founders are, record
   only the names they agree on and explain the disagreement in `note`.
4. Indonesian arms of foreign groups (Grab Indonesia, Lazada Indonesia, Shopee,
   SeaBank, …) and units/spin-offs of incumbents (bank subsidiaries, …): the
   group's founders are NOT founders of the Indonesian entity. Leave founders
   empty, status `not_applicable`, short note — UNLESS a qualifying source names
   someone as founder of the Indonesian company itself; then record that.
5. `founded` (year): only if one of your sources states it. If
   `founded_on_record` is set and your sources agree, keep it; if they
   disagree, say so in `note` and give the year your best source states.
6. Extra searches ONLY via
   `python3 /home/ubuntu/projects/pasar-vantis/data/founders-work/exa-q.py "query" [optional-domain.com]`
   — at most 25 calls for your whole chunk, spent where evidence is thin or
   conflicting ("<company> pendiri", "<company> founded by", the company's
   domain + "about founder"). Do NOT use the WebSearch tool (shared session
   cap). You may fetch one specific page with WebFetch or
   `curl -sL -m 20 -A 'Mozilla/5.0' URL` to confirm a statement; many sites
   block bots — don't retry endlessly.
7. For each source you rely on, include a short exact quote (≤ 25 words) from
   the page or snippet that shows the founder statement.
8. Never invent and never "complete" a list from memory. Background knowledge
   may tell you where to look but is never a source. Insufficient evidence →
   status `insufficient`, founders `[]`.
9. Names: the spelling the company or the most authoritative source uses; full
   names, no honorifics or titles.

## Output

Write a JSON array to `data/founders-work/out-N.json` — one object per company
in your chunk (every company, even those with nothing):

```json
{"id": "...", "status": "ok" | "insufficient" | "not_applicable",
 "founders": ["Full Name"], "founded": 2015,
 "sources": [{"url": "...", "kind": "company" | "endeavor" | "press" | "investor" | "profile", "quote": "..."}],
 "note": "..."}
```

`founded` is a year or null. `note` is public-safe plain English that may
appear on the page ("Founded by X and Y, per the company's About page.", or a
short conflict explanation). Never mention tools, searches, snippets, agents,
budgets or this task in `note`.

Write the file incrementally (e.g. after every ~10 companies) so partial work
survives an interruption, and validate at the end that it parses as JSON and
has exactly one entry per input id.

Final reply: counts by status, plus the ids you were least sure about with one
line each. Keep it short.
