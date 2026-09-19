# 1001startup.id

Indonesian startup census — https://1001startup.id (working host: 1001.vantis.sh).

One Fastify app (`server.js`, port 8390) serves two hosts: `is1001(req)` routes the census brand to `views/pages1001.js`; every other host gets the PASAR link-in-bio pages (`views/pages.js`).

- `data/census-raw.json` — the census rows; `scripts/build-census.js` compiles them into `public/data/census.json`
- `scripts/census-*.py` — idempotent cohort merges (YC, Antler, Endeavor, cloud, logistics, …), liveness sweeps, funding backfills
- `scripts/census-news.py` — the /news feed (its `data/census-news-state.json` cache is not committed)
- `lib/leads-*.js` — /leads (Exa + DeepSeek), gated by `LEADS_PASSCODE`

Not committed: `.env` (see `.env.example`), `data/pasar.db` (PASAR accounts), `data/leads/`, `data/links-cache/`, the `*.bak-*` files.

```bash
npm install && node server.js
```
