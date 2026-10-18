# Fact-check brief: hostile verification of census rows before they go live

You are checking rows another researcher wrote for 1001startup.id, a public census of Indonesian
startups. Assume each row is wrong until a source you open yourself says otherwise. Earlier checks
like this found material errors in about one row in four: a loan facility counted as equity, a
LinkedIn page belonging to a namesake, a dead company, a group-level figure presented as Indonesian,
a "founding round" that was actually a later round. Your job is to catch those before they publish.

Read BRIEF.md (same folder) for the census tests and rules. Tools: `tools/exa.py`, `tools/li.py`,
WebFetch, curl with a browser UA. WebSearch is shared and capped: use at most 10 WebSearch calls.
Write only inside your own folder.

For EVERY row in the file you are given, check:

1. **Alive in 2026.** Open the site yourself (curl -sL with a browser UA). Confirm one dated 2026
   operating signal from a source you open (company LinkedIn posts, app-store update date, 2026 news).
2. **Entity.** Open `legal_src` (or the best source) and confirm the PT name is printed there and
   belongs to this company (not a namesake, not a parent).
3. **Headcount.** Re-read LinkedIn with `python3 -I tools/li.py <slug>` (slug from employees_src).
   Confirm the page is the right company (website link, HQ, description). Report today's count; flag
   a difference above 20% or a wrong page. If the source is a filing or company statement, open it.
4. **Money.** Open every URL in `funding_srcs`. Confirm each amount, currency, date and round name,
   and that the conversion is sensible. Flag: debt counted as equity, a tracker-only figure, an
   investor named without a source, a group figure on an Indonesian row, IDR/USD slips, a sum that
   double-counts a round reported twice.
5. **Head office.** Confirm kota and province from a source you open; check the street address.
6. **Tests 1 and 2.** Is it really venture-built and not an incumbent's unit, a brand of a company
   already counted, or an agency that sells team time? Is it already in the census under another
   name? (`existing.tsv`: names, legal names, old names.)
7. **The text.** Spot-check at least four factual claims in `verify_note` against their sources.
   Flag anything unsupported, any tool or process words, and anything that reads as promotional.

Also check every entry in the lane's `closed` list (companies that shut down, for the census's
closed register). Confirm the end date (YYYY or YYYY-MM), the fate (`closed`, or
`acquired-then-closed`), at least two sources that you opened, and any funding figure. Return each one
in the register's full shape: `{"name", "legal_name", "fate", "confidence": "confirmed"|"reported",
"sector": "<Category> — <description>", "city", "founded": "YYYY" or null, "ended", "funding_usd_m":
number or null (only a sourced total), "why": "plain-English paragraph: what it did, how and when it
ended, what the funding figure counts", "sources": [...]}`, or drop it with the reason.

Output `<your folder>/verdicts.json`:

```
{"lane": "...", "verdicts": [
  {"id": "...", "verdict": "KEEP" | "FIX" | "DROP",
   "fixes": {"field": "new value", ...},          // exact replacements, only for FIX
   "why": "what you found, with the URLs that show it",
   "headcount_today": N or null, "li_slug_checked": "..."}
 ],
 "closed": [ {full register entry, checked} ],
 "closed_dropped": [ {"name": "...", "why": "..."} ]}
```

Use DROP for: dead or dormant, wrong country, fails test 1 or 2, a duplicate, or a row whose core
facts you cannot confirm. Use FIX for errors you can correct with a source (give the full corrected
field text for notes, not a diff). Use KEEP only when the core facts held up when you opened the
sources yourself. Your final message: one line per row with the verdict and the reason in a few words.
