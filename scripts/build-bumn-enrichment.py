#!/usr/bin/env python3
"""Build a non-destructive BUMN enrichment layer from the existing sourced files."""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "bumn-enrichment.json"
EXCLUDED = (
    "sec.gov", "fortune.com", "fortuneidn.", "flo.uri.sh", "katadata.", "investortrust.", "detik.", "tempo.", "cnbc", "kontan.", "bisnis.", "antara", "kompas.", "idntimes.", "techinasia.", "dealstreetasia.", "e27.", "techcrunch.", "bloomberg.", "reuters.", "yahoo.", "wikipedia.", "linkedin.", "facebook.", "instagram.", "google.", "youtube.", "idx.co.id", "ojk.go.id", "bi.go.id", "bps.go.id", "kemendagri.", "peraturan.bpk", "kemenkeu.", "danantara", "indopremier.", "avnmedia.", "infobanknews.", "pefindo.", "kredonews.", "topbusiness.", "infoniaga.",
)


def read(name):
    return json.loads((ROOT / "data" / name).read_text())


def urls(value):
    if isinstance(value, str) and value.startswith(("http://", "https://")):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from urls(child)
    elif isinstance(value, list):
        for child in value:
            yield from urls(child)


def channel_score(entity, url: str) -> int:
    """Prefer a company-named host; never turn a third-party filing host into a contact channel."""
    host = urlparse(url).netloc.lower()
    host_key = re.sub(r"[^a-z0-9]", "", host)
    tokens = [x for x in re.split(r"[.-]+", host) if x]
    aliases = {
        re.sub(r"[^a-z0-9]", "", entity["slug"].lower()),
        re.sub(r"[^a-z0-9]", "", entity["short"].lower()),
    }
    score = 0
    for alias in aliases:
        if len(alias) >= 4 and alias in host_key:
            score = max(score, 100)
        if len(alias) >= 2 and alias in tokens:
            score = max(score, 90)
        if len(alias) >= 2 and "bank" + alias in host_key:
            score = max(score, 85)
    return score


def main() -> None:
    bumn = read("bumn-56.json")
    sankey = read("bumn-sankey.json")["groups"]
    ties = read("bumn-ties.json")["groups"]
    subs = read("bumn-subs.json")["groups"]
    channel_file = ROOT / "data" / "bumn-official-channels.json"
    channels = {x["slug"]: x for x in (read("bumn-official-channels.json") if channel_file.exists() else [])}
    records = []
    for entity in bumn["entities"]:
        slug = entity["slug"]
        candidates = []
        candidates.extend(urls(sankey.get(slug, {}).get("src")))
        candidates.extend(urls(sankey.get(slug, {}).get("basis_doc")))
        candidates.extend(urls(ties.get(slug, [])))
        candidates.extend(urls(entity.get("fin")))
        candidates.extend(urls(entity.get("src")))
        documents = []
        for url in candidates:
            host = urlparse(url).netloc.lower()
            if not host or any(token in host for token in EXCLUDED):
                continue
            if host not in [urlparse(x).netloc.lower() for x in documents]:
                documents.append(url)
        ranked = sorted(((channel_score(entity, url), url) for url in documents), key=lambda x: -x[0])
        website_source = ranked[0][1] if ranked and ranked[0][0] > 0 else None
        website = f"{urlparse(website_source).scheme}://{urlparse(website_source).netloc}" if website_source else None
        channel = channels.get(slug)
        if channel:
            website = channel.get("official_url")
            website_source = channel.get("source_url")
            if website_source and website_source not in documents:
                documents.append(website_source)
        group = subs.get(slug) or {}
        records.append({
            "id": "bumn-" + slug,
            "slug": slug,
            "name": entity["name"],
            "short_name": entity["short"],
            "registry": "bumn",
            "company_type": "central_public_enterprise",
            "sector": entity.get("sector"),
            "cluster": entity.get("cluster"),
            "url": website,
            "website_source": website_source,
            "channel_status": channel.get("status") if channel else None,
            "channel_note": channel.get("notes") if channel else None,
            "document_sources": documents,
            "contacts": [{"type": "website", "value": website, "source": website_source, "value_class": "reported"}] if website else [],
            "employees": (entity.get("fin") or {}).get("employees"),
            "financials": entity.get("fin") or {},
            "scores": entity.get("scores") or {},
            "score_reasons": entity.get("why") or {},
            "score_sources": entity.get("src") or {},
            "relationship_counts": {k: group.get(k) for k in ["t1", "t1a", "t2", "t2a", "deeper"]},
            "relationship_basis": group.get("basis"),
            "sources": list(dict.fromkeys(documents)),
        })
    result = {
        "generated": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "asof": bumn.get("asof"),
        "entities": records,
        "stats": {
            "entities": len(records),
            "with_official_channel": sum(bool(x["url"]) for x in records),
            "with_employees": sum(bool(x["employees"]) for x in records),
            "employees_reported": round(sum((x["employees"] or {}).get("v", 0) for x in records)),
            "subsidiaries_at_all_levels": sum((x["relationship_counts"].get("t1") or 0) + (x["relationship_counts"].get("t2") or 0) + (x["relationship_counts"].get("deeper") or 0) for x in records),
        },
        "method": [
            "This layer is derived only from the repository's existing BUMN source files; it does not overwrite scores or financial facts.",
            "A filing or official-document domain is a contact-discovery starting point, not proof that the root page answers.",
            "Employee totals are sums over available parent records, not a claim of complete BUMN employment. Parent/group scope notes remain attached.",
            "Revenue and profit remain separate from GVA; no GDP conversion is applied in this layer.",
        ],
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result["stats"], indent=2))


if __name__ == "__main__":
    main()
