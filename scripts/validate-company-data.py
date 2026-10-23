#!/usr/bin/env python3
"""Release gate for the tech/BUMN/BUMD graph and chatbot artifacts."""
from __future__ import annotations

import collections
import json
import re
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "validation-report.json"


def read(name):
    path = ROOT / name if name.startswith("public/") else ROOT / "data" / name
    return json.loads(path.read_text())


def main() -> int:
    checks = []
    def check(name, ok, detail):
        print(f"{name}: {'PASS' if ok else 'FAIL'} — {detail}", flush=True)
        checks.append({"name": name, "ok": bool(ok), "detail": detail})

    raw = read("census-raw.json")
    public = read("public/data/census.json")
    bumd = read("bumd-deduped.json")
    tmp = tempfile.TemporaryDirectory()
    db_copy = Path(tmp.name) / "company-graph.sqlite"
    shutil.copyfile(ROOT / "data" / "company-graph.sqlite", db_copy)
    con = sqlite3.connect(db_copy)
    q = lambda sql, *args: con.execute(sql, args).fetchone()[0]

    check("census ids unique", len({c["id"] for c in raw["companies"]}) == len(raw["companies"]), len(raw["companies"]))
    check("census public build matches raw", len(raw["companies"]) == len(public["companies"]), f"{len(raw['companies'])} raw / {len(public['companies'])} built")
    # The Kimi wave record (data/census-adds/kimi-2026-10-startups.json): rows published under
    # the census rule, and the rows held back with the reason for each.
    wave = read("census-adds/kimi-2026-10-startups.json")
    published, held = set(wave["rows"]) | set(wave.get("rows_wave2", [])), {x["id"] for x in wave["held"]}
    ids = {c["id"] for c in raw["companies"]}
    new_rows = [c for c in raw["companies"] if c["id"] in published]
    check("wave rows all published", published <= ids, f"{len(published & ids)}/{len(published)}")
    check("held rows not published", not (held & ids), sorted(held & ids))
    # group companies (24 Oct 2026): every flag names its group and the page that shows the ownership
    grp = [c for c in raw["companies"] if c.get("group_parent")]
    bad_grp = [c["id"] for c in grp if not (c["group_parent"].get("group") and c["group_parent"].get("relation")
                                           and str(c["group_parent"].get("src", "")).startswith("http"))]
    check("group flags complete", not bad_grp, f"{len(grp)} flagged" + (f"; incomplete {bad_grp}" if bad_grp else ""))
    check("group flags reach the public build", sum(1 for c in public["companies"] if c.get("group_parent")) == len(grp),
          sum(1 for c in public["companies"] if c.get("group_parent")))
    evidence_ok = all(any("linkedin.com/company/" in str(u) or "linkedin.com/school/" in str(u) for u in [c.get("employees_src"), *(c.get("sources") or [])]) for c in new_rows)
    check("all expansion rows have LinkedIn company evidence", evidence_ok, len(new_rows))
    check("no solopreneur headcount", all(c.get("employees_est") is None or c["employees_est"] >= 5 for c in new_rows), "all exact headcounts >=5 or null")
    check("no group-wide employee leakage", all(c.get("employees_est") is None for c in new_rows if c.get("company_type") == "foreign_id_operation" and "GROUP-WIDE" in c.get("employees_note", "").upper()), "group figures only in employees_group_est")
    check("BUMD canonical covers the raw file", len(bumd["co"]) >= len(read("bumd.json")["co"]), f'{len(bumd["co"])} canonical / {len(read("bumd.json")["co"])} raw')
    check("BUMD ids unique", len({c["id"] for c in bumd["co"]}) == len(bumd["co"]), len(bumd["co"]))
    check("BUMD merge documented", bumd.get("dedupe", {}).get("merged_rows") == sum(len(g.get("merged", [])) for g in bumd.get("dedupe", {}).get("merge_groups", [])) or not bumd.get("dedupe", {}).get("merged_rows"), bumd.get("dedupe", {}).get("merged_rows"))
    check("BUMD DKI detail attached", sum(bool(c.get("detail")) for c in bumd["co"]) == 23, sum(bool(c.get("detail")) for c in bumd["co"]))

    check("SQLite integrity", q("pragma integrity_check") == "ok", q("pragma integrity_check"))
    check("relationships have endpoints", q("select count(*) from relationships r left join entities a on a.id=r.from_id left join entities b on b.id=r.to_id where a.id is null or b.id is null") == 0, q("select count(*) from relationships r left join entities a on a.id=r.from_id left join entities b on b.id=r.to_id where a.id is null or b.id is null"))
    check("BUMN parent registry exact", q("select count(*) from entities where registry='bumn'") == 56, q("select count(*) from entities where registry='bumn'"))
    check("BUMD graph registry exact", q("select count(*) from entities where registry='bumd'") == len(bumd["co"]), q("select count(*) from entities where registry='bumd'"))
    check("tech graph registry matches census", q("select count(*) from entities where registry='tech'") == len(raw["companies"]), q("select count(*) from entities where registry='tech'"))
    check("FTS finds Bank DKI", q("select count(*) from entity_fts where id='bank-dki'") == 1, q("select count(*) from entity_fts where id='bank-dki'"))
    check("Kozystay facts correct", q("select value_num from observations where entity_id='tech-kozystay' and kind='employees'") == 211, q("select value_num from observations where entity_id='tech-kozystay' and kind='employees'"))
    mobile = q("select count(*) from contacts where type in ('phone','phone_business','hotline','fax') and value like '08%' and value not like '0800%' and value not like '0804%'")
    check("No mobile numbers published", mobile == 0, mobile)
    debris = q("select count(*) from contacts where type in ('email','email_role') and (value like '%.png' or value like '%.jpg' or value like 'u003%' or value like '% %')")
    check("No scrape debris in e-mail contacts", debris == 0, debris)
    check("National macro document", q("select count(*) from entities where id='national-aggregates'") == 1, q("select count(*) from entities where id='national-aggregates'"))
    check("No unlabeled GVA method", q("select count(*) from observations where kind='direct_gva_estimate' and method_id is null") == 0, q("select count(*) from observations where kind='direct_gva_estimate' and method_id is null"))
    check("No vacancy fabrication", q("select count(*) from job_postings") == 0, q("select count(*) from job_postings"))

    lines = (ROOT / "data" / "company-corpus.jsonl").read_text().splitlines()
    ids, empty = set(), 0
    for line in lines:
        doc = json.loads(line)
        ids.add(doc["id"])
        empty += not bool(doc.get("text"))
    check("Corpus unique and non-empty", len(lines) == len(ids) and not empty, f"{len(lines)} documents / {empty} empty")
    check("Corpus matches entities", len(lines) == q("select count(*) from entities"), f"{len(lines)} documents / {q('select count(*) from entities')} entities")
    con.close()
    tmp.cleanup()

    report = {
        "ok": all(c["ok"] for c in checks),
        "checks": checks,
        "totals": {
            "tech": len(raw["companies"]), "bumd": len(bumd["co"]),
            "new_rows": len(new_rows), "corpus": len(lines),
        },
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
