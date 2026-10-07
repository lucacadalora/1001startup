# Founder check — the most-visited companies

Read `data/founders-work/BRIEF.md` first: its source rules (rules 1-9) apply
here unchanged. This pass exists because the first review ran without a search
tool, so well-known founders were sometimes missed or recorded under a short
name. You DO have the WebSearch tool for this pass.

## Input

`data/founders-work/check-in-N.json` — ~37 companies, each with the first
review's result: `current_status`, `current_founders`, `current_founded`,
`current_sources`, `current_note`.

## For each company

1. **Confirm** each name in `current_founders`: it must meet the BRIEF rules
   (company's own page; or Endeavor + one more; or two independent reputable
   sources). A name that does not hold up is removed.
2. **Complete** the list: search for co-founders the first pass missed (e.g.
   "<company> founders", "<company> co-founder", "pendiri <company>",
   "<company> didirikan oleh"). Add a name only under the same rules.
3. **Full names**: where the company uses a short name ("Albert") and a
   reputable source gives the full name for the same person, use the full name
   and cite that source.
4. **Year**: keep, set or clear `founded` under BRIEF rule 5.
5. For `current_status` "insufficient": try to reach the rules now; if you
   cannot, leave it insufficient.

Budget: at most 50 WebSearch calls for your whole file (about 1-2 per company;
spend more only on the most prominent companies). Prefer WebFetch / curl of
the pages the search finds to read the exact sentence. Never cite aggregators
(BRIEF rule 2 list) or Wikipedia itself; Wikipedia's own reference links are
fine to follow.

## Output

Write `data/founders-work/check-out-N.json`: a JSON array, one object per
input company, in the BRIEF output shape plus a `verdict`:

```json
{"id": "...", "verdict": "confirmed" | "corrected" | "insufficient" | "not_applicable",
 "status": "ok" | "insufficient" | "not_applicable",
 "founders": ["Full Name"], "founded": 2015,
 "sources": [{"url": "...", "kind": "company|endeavor|press|investor|profile", "quote": "≤25 words, exact"}],
 "note": "public-safe, plain English, no mention of tools or this task"}
```

`confirmed` = the first review's list stands as is (still give its sources).
`corrected` = anything changed (names added, removed or expanded, year
changed); give the complete final entry, not a diff. Write the file
incrementally; validate at the end (parses, one entry per input id).

Final reply: counts by verdict, and every correction in one line each
(id: before -> after, with the deciding source).
