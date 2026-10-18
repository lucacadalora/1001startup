# Census research waves

How the 18 Oct 2026 "more legit startups" wave was run, kept so the next wave
starts from here instead of from a lost session folder.

1. Make a wave folder (`export CENSUS_WAVE=~/census-wave`), copy `BRIEF.md` and
   `VERIFY.md` into it, plus `scripts/census-research/li.py` under `tools/`
   (`exa.py` only if Luca approves Exa spend for the run: Exa is his paid account). Write `existing.tsv` (census names, legal names, closed register,
   removals, scope.outside and prior rejections) and an empty `claims.tsv`.
2. Ask Luca before a big fan-out if it would use Exa. One research agent per lane (a fund's portfolio, a roster, a regulator's list,
   a news window) works to `BRIEF.md` and writes `<lane>/out.json`.
3. `python3 scripts/census-research/check_lane.py $CENSUS_WAVE/<lane>/out.json --urls`
   for the mechanical checks, then one hostile fact-checker per lane works to
   `VERIFY.md` and writes `verify-<lane>/verdicts.json` (KEEP / FIX / DROP).
4. `python3 scripts/census-research/assemble.py <slice> <lane> ...` writes the
   census record `data/census-adds/more-legit-2026-10-<slice>.json` and the founders
   evidence `data/founders-work/out-more-legit-<slice>.json`.
5. Publish: `scripts/census-national.py <record>` (CENSUS_CLOSED at a scratch copy
   when the slice has no closures), re-pin by building or street with
   `scripts/census-research/repin.py <plan.json> [--write]` (the geocoder drops
   towers onto district centres), `census-icons.py` + `logo-pick.py` for letter
   tiles, then build -> `census-founders-merge.py` -> build, `og-company.py`
   (behind `vm-gate run --`), check pages through Cloudflare, `indexnow.py`.
   Antler/Endeavor roster companies also need their lens registers updated
   (see the dated block at the end of `census-antler.py`).

Unfinished leads from the first wave: `data/census-adds/more-legit-2026-10-backlog.json`.
