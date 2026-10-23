# 1001startup.id

Indonesian startup census — https://1001startup.id (working host: 1001.vantis.sh).

One Fastify app (`server.js`, port 8390) serves two hosts: `is1001(req)` routes the census brand to `views/pages1001.js`; every other host gets the PASAR link-in-bio pages (`views/pages.js`).

- `data/census-raw.json` — the census rows; `scripts/build-census.js` compiles them into `public/data/census.json`
- `scripts/census-*.py` — idempotent cohort merges (YC, Antler, Endeavor, cloud, logistics, …), liveness sweeps, funding backfills
- `scripts/census-news.py` — the /news feed (its `data/census-news-state.json` cache is not committed)
- `views/research1001.js` — the bilingual `/research` index and first article at `/research/indonesia-computer-import-growth`, linked from the shared navigation and homepage.
- `views/import-note1001.js` — the bilingual AI factory import scenario within the Research article; `/news#indonesia-ai-factory-imports` retains a link to it; derived CSVs and source/calculation notes live in `public/data/research/indonesia-imports-2026-09/` (editorial content, independent of the generated wire)
- `lib/leads-*.js` — /leads (Exa + DeepSeek), gated by `LEADS_PASSCODE`
- `data/census-adds/kimi-2026-10-startups.json` — the Kimi wave of 24 Oct 2026: the 13 rows published under the census rule, and the 94 rows held back (incumbents, listed and licensed operators, foreign groups' arms, names in `scope.outside`, BUMN subsidiaries), each with its reason. Kimi's original cohort files are in `data/census-adds/kimi-2026-10/`.
- `data/company-contacts.json` — public business contacts from each company's own pages (`scripts/company-contacts.py --fetch`), with the page each came from. `lib/public-contacts.js` decides what a company page prints: role mailboxes, office lines and hotlines, careers pages; never mobile or foreign numbers or guessed addresses. `scripts/build-company-graph.py` applies the same rule.
- `/api/company-graph/{search,company,stats}` — a read-only local graph of the census, BUMN and BUMD (`lib/company-graph-routes.js`), answered from `data/company-graph.sqlite` with no outside API at query time; on while `data/companygraph.live` exists. Rebuild after any census, BUMN or BUMD change with `npm run build:graph` (BUMD dedupe, BUMN enrichment, graph + `data/company-corpus.jsonl`), then `npm test`.

Not committed: `.env` (see `.env.example`), `data/pasar.db` (PASAR accounts), `data/leads/`, `data/links-cache/`, the `*.bak-*` files, and the generated graph files (`data/company-graph.sqlite`, `data/company-corpus.jsonl`, `data/bumd-deduped.json`).

```bash
npm install && node server.js
```
