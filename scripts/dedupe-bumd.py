#!/usr/bin/env python3
"""Deduplicate BUMD cohorts and attach the richer DKI profile records.

Raw data/bumd.json is never overwritten. The public reader uses
 data/bumd-deduped.json. Conflicting figures are kept as history, not averaged.
"""
from __future__ import annotations

import collections
import datetime as dt
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "bumd.json"
DKI = ROOT / "data" / "bumd-dki.json"
OUT = ROOT / "data" / "bumd-deduped.json"


def read(path: Path):
    return json.loads(path.read_text())


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().lower()
    value = re.sub(r"\([^)]*\)", "", value)
    return re.sub(r"[^a-z0-9]", "", value)


def richness(c: dict) -> int:
    return (
        5 * bool(c.get("l")) + 4 * bool(c.get("fin")) + 3 * bool(c.get("w")) +
        2 * bool(c.get("o")) + 2 * bool(c.get("d")) + len(c.get("src", [])) -
        3 * bool(re.search(r"-\d$", c["id"]))
    )


def merge_group(group: list) -> dict:
    ordered = sorted(group, key=lambda c: (-richness(c), c["id"]))
    primary = dict(ordered[0])
    aliases = [c["id"] for c in ordered[1:]]
    primary["aliases"] = aliases
    primary["src"] = list(dict.fromkeys(u for c in ordered for u in c.get("src", [])))
    if not primary.get("w"):
        primary["w"] = next((c["w"] for c in ordered[1:] if c.get("w")), None)
    primary["ownership_history"] = [
        {"owner": o.get("g"), "pct": o.get("s"), "source": o.get("u") or c.get("src", [None])[0], "record_id": c["id"]}
        for c in ordered for o in c.get("o", [])
    ]
    seen_owners = {(o.get("g"), o.get("s")) for o in primary.get("o", [])}
    for c in ordered[1:]:
        for o in c.get("o", []):
            key = (o.get("g"), o.get("s"))
            if key not in seen_owners:
                primary.setdefault("o", []).append(o)
                seen_owners.add(key)
    primary["financial_history"] = [
        {"figure": c["fin"], "record_id": c["id"]}
        for c in ordered if c.get("fin")
    ]
    candidates = [c for c in ordered if c.get("fin")]
    latest = max(candidates, key=lambda c: (c["fin"].get("y") or 0, richness(c)), default=None)
    if latest:
        primary["fin"] = latest["fin"]
    return primary


def main() -> None:
    raw = read(SRC)
    dki = read(DKI)
    groups = collections.defaultdict(list)
    for company in raw["co"]:
        groups[norm(company["n"])].append(company)

    merged, alias_to_primary, merge_report = [], {}, []
    for group in groups.values():
        company = merge_group(group)
        merged.append(company)
        for old_id in [company["id"], *company["aliases"]]:
            alias_to_primary[old_id] = company["id"]
        if company["aliases"]:
            merge_report.append({"into": company["id"], "merged": company["aliases"]})

    by_id = {c["id"]: c for c in merged}
    # Exact DKI matches established during source review. The remaining nine are
    # joint ventures absent from the national cohort and are added below.
    dki_map = {
        "bumd-dki-pdamj": "pam-jaya", "bumd-dki-bndki": "bank-dki", "bumd-dki-fodst": "food-station-tjipinang",
        "bumd-dki-ptjiep": "jiep-jakarta-industrial-estate-pulogadung", "bumd-dki-jkpro": "jakpro",
        "bumd-dki-jktur": "jakarta-tourisindo", "bumd-dki-jmkrd": "jamkrida-jakarta", "bumd-dki-mrtj": "mrt-jakarta",
        "bumd-dki-ancol": "pembangunan-jaya-ancol", "bumd-dki-trnsjk": "transjakarta", "bumd-dki-drmjy": "dharma-jaya",
        "bumd-dki-paljy": "pal-jaya", "bumd-dki-psrjy": "pasar-jaya", "bumd-dki-srnjy": "sarana-jaya",
        "bumd-dki-askrd": "askrida",
    }
    for detail in dki["entities"]:
        target = dki_map.get(detail["id"])
        detail_payload = {
            "contacts": detail.get("contacts", []), "officers": detail.get("officers", []),
            "legal_basis": detail.get("legal_basis", []), "financials": detail.get("financials"),
            "ownership_edges": [e for e in dki["edges"] if e["to"] == detail["id"]],
            "source": detail.get("source"), "updated_at": detail.get("updated_at"),
        }
        if target and target in by_id:
            company = by_id[target]
            company["detail"] = detail_payload
            company["src"] = list(dict.fromkeys(company.get("src", []) + detail.get("sources", [])))
            if detail.get("url") and not company.get("w"):
                company["w"] = detail["url"]
            continue
        # These nine DKI joint ventures were absent from the national cohort.
        company = {
            "id": detail["id"], "n": detail.get("short_name") or detail["name"], "l": detail.get("legal_name") or detail["name"],
            "f": (detail.get("legal_form") or "").lower() or None, "s": detail.get("sector"), "d": detail.get("business"),
            "p": detail.get("province"), "c": None, "o": [], "src": detail.get("sources", []), "w": detail.get("url"),
            "sub": 1, "detail": detail_payload,
        }
        for edge in detail_payload["ownership_edges"]:
            company["o"].append({"g": edge["from"], "s": edge.get("pct"), "u": edge.get("source")})
        merged.append(company)
        by_id[company["id"]] = company

    # Re-map every relationship and operation to the canonical company ID.
    ties = []
    seen_ties = set()
    for tie in raw.get("ties", []):
        t = dict(tie)
        t["a"] = alias_to_primary.get(t["a"], t["a"])
        t["b"] = alias_to_primary.get(t["b"], t["b"])
        key = (t.get("a"), t.get("b"), t.get("r"), t.get("d"), t.get("dt"), t.get("u"), t.get("e"))
        if key not in seen_ties:
            ties.append(t)
            seen_ties.add(key)
    ops = []
    for op in raw.get("ops", []):
        o = dict(op)
        o["m"] = [dict(m, id=alias_to_primary.get(m.get("id"), m.get("id"))) if m.get("id") else m for m in op.get("m", [])]
        ops.append(o)
    ents = {}
    for old_id, entity in raw.get("ents", {}).items():
        canonical = alias_to_primary.get(old_id, old_id)
        ents[old_id] = dict(entity)
        if canonical != old_id:
            ents[old_id]["alias_of"] = canonical
    for company in merged:
        ents.setdefault(company["id"], {"n": company["n"], "k": "bumd_sub" if company.get("sub") else "bumd"})

    provinces = collections.Counter(c.get("p") or "Not stated" for c in merged)
    result = dict(raw)
    result.update({
        "generated": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "co": merged, "ties": ties, "ops": ops, "ents": ents,
        "mapped": len(merged),
        "prov": sorted(provinces.items(), key=lambda x: (-x[1], x[0])),
        "dedupe": {
            "input_rows": len(raw["co"]), "canonical_entities": len(merged),
            "merged_rows": sum(len(g) - 1 for g in groups.values() if len(g) > 1),
            "merge_groups": merge_report,
            "dki_joint_ventures_added": len(merged) - len(raw["co"]) + sum(len(g) - 1 for g in groups.values() if len(g) > 1),
            "method": "Duplicate names are merged by canonical ID with aliases retained. Latest financial figures are selected by year; all figure history is retained. Ownership observations are never averaged.",
        },
        "source_integrity": {
            "data/bumd.json": hashlib.sha256(SRC.read_bytes()).hexdigest(),
            "data/bumd-dki.json": hashlib.sha256(DKI.read_bytes()).hexdigest(),
        },
    })
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"input": len(raw["co"]), "canonical": len(merged), "merged_duplicate_rows": result["dedupe"]["merged_rows"], "ties": len(ties), "dki_joint_ventures_added": result["dedupe"]["dki_joint_ventures_added"]}, indent=2))


if __name__ == "__main__":
    main()
