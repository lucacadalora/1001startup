#!/usr/bin/env python3
"""Build the self-contained company graph, FTS index and chatbot corpus.

Sources are versioned local files only. No web/API call is made by this builder.
Reported facts, derived values, estimates and unknowns remain distinct.
"""
from __future__ import annotations

import collections
import datetime as dt
import hashlib
import json
import re
import sqlite3
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "company-graph.sqlite"
CORPUS = ROOT / "data" / "company-corpus.jsonl"
INSIGHTS = ROOT / "public" / "data" / "company-insights.json"
NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def read(name: str):
    path = ROOT / name if name.startswith("public/") else ROOT / "data" / name
    return json.loads(path.read_text())


# What may be published from a scraped contact. Mirrors lib/public-contacts.js
# (the company pages); change both together. Mobile and foreign numbers, file
# names caught as e-mail addresses and escaped-markup debris are dropped.
EMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$")
FILE_TLD_RE = re.compile(r"\.(png|jpe?g|gif|webp|svg|ico|css|js|json|pdf)$")
CONTACT_KIND = {
    "email_role": "email", "email": "email",
    "phone_business": "phone", "phone": "phone", "hotline": "phone", "fax": "phone",
    "careers_url": "url", "website": "url", "linkedin_company": "url",
}


def clean_contact(type_: str, value) -> str | None:
    kind = CONTACT_KIND.get(type_)
    if kind == "email":
        v = str(value or "").strip().lower()
        v = re.sub(r"^mailto:", "", v)
        v = re.sub(r"^(u003[ce]|&gt;|&lt;|>|<)+", "", v)
        return v if EMAIL_RE.match(v) and not FILE_TLD_RE.search(v) else None
    if kind == "phone":
        from urllib.parse import unquote
        v = re.sub(r"[\s\u00a0]", "", unquote(str(value or "")))
        v = re.sub(r"^/+", "", v)
        v = re.sub(r"^\+{2,}", "+", v)
        v = re.sub(r"[()\-.]", "", v)
        if not re.fullmatch(r"\+?\d{3,15}", v):
            return None
        if re.fullmatch(r"1\d{2,6}", v):
            return v
        if v.startswith("+62"):
            nat = "0" + v[3:]
        elif v.startswith("+"):
            return None
        elif v.startswith("62") and len(v) >= 10:
            nat = "0" + v[2:]
        elif v.startswith("0"):
            nat = v
        else:
            return None
        if nat.startswith(("0800", "0804")) or re.fullmatch(r"0[2-7]\d{6,10}", nat):
            return nat
        return None
    if kind == "url":
        v = str(value or "").strip()
        return v if re.fullmatch(r"https?://[^\s\"'<>]+", v, re.I) else None
    return None


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "unknown"


def norm(value: str) -> str:
    return slug(value).replace("-", "")


def source_key(url: str) -> str | None:
    return "src-" + hashlib.sha1(url.encode()).hexdigest()[:16] if url else None


SCHEMA = """
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE entities(id TEXT PRIMARY KEY, registry TEXT, slug TEXT, name TEXT, legal_name TEXT,
  company_type TEXT, sector TEXT, province TEXT, city TEXT, url TEXT, status TEXT,
  confidence REAL, payload_json TEXT);
CREATE TABLE aliases(alias TEXT, entity_id TEXT, kind TEXT, UNIQUE(alias,entity_id,kind));
CREATE TABLE sources(id TEXT PRIMARY KEY, url TEXT, publisher TEXT, accessed_at TEXT);
CREATE TABLE observations(id INTEGER PRIMARY KEY, entity_id TEXT, kind TEXT, value_num REAL,
  value_text TEXT, unit TEXT, year TEXT, as_of TEXT, value_class TEXT, source_id TEXT,
  method_id TEXT, note TEXT, is_current INTEGER DEFAULT 1);
CREATE TABLE relationships(id INTEGER PRIMARY KEY, from_id TEXT, to_id TEXT, type TEXT,
  pct REAL, as_of TEXT, value_class TEXT, source_id TEXT, note TEXT, evidence TEXT);
CREATE TABLE contacts(id INTEGER PRIMARY KEY, entity_id TEXT, type TEXT, value TEXT,
  source_id TEXT, verified_at TEXT, value_class TEXT);
CREATE TABLE financial_accounts(entity_id TEXT, coa_id TEXT, account TEXT, year TEXT,
  value_idr REAL, source_id TEXT, UNIQUE(entity_id,coa_id,year));
CREATE TABLE officers(entity_id TEXT, name TEXT, role TEXT, source_id TEXT);
CREATE TABLE dedupe_candidates(alias_norm TEXT, entity_ids TEXT, note TEXT);
CREATE TABLE job_postings(id TEXT PRIMARY KEY, entity_id TEXT, title TEXT, location TEXT,
  salary_min REAL, salary_max REAL, currency TEXT, posted_at TEXT, expires_at TEXT,
  url TEXT, source_id TEXT, first_seen TEXT, last_seen TEXT, dedup_cluster TEXT);
CREATE VIRTUAL TABLE entity_fts USING fts5(id UNINDEXED, name, legal_name, sector, province, city, body);
CREATE INDEX idx_obs_entity ON observations(entity_id,kind,is_current);
CREATE INDEX idx_rel_from ON relationships(from_id);
CREATE INDEX idx_rel_to ON relationships(to_id);
CREATE INDEX idx_contacts_entity ON contacts(entity_id,type);
CREATE INDEX idx_fin_entity ON financial_accounts(entity_id,year);
CREATE INDEX idx_alias ON aliases(alias);
"""


class Graph:
    def __init__(self):
        self.entities = {}
        self.aliases = collections.defaultdict(set)
        self.sources = {}
        self.obs = []
        self.rels = []
        self.contacts = []
        self.accounts = []
        self.officers = []
        self.alias_norms = collections.defaultdict(set)

    def source(self, url: str | None) -> str | None:
        if not url or not str(url).startswith(("http://", "https://")):
            return None
        sid = source_key(url)
        self.sources[sid] = (url, urlparse(url).netloc, NOW[:10])
        return sid

    def entity(self, eid: str, **kwargs) -> str:
        current = self.entities.get(eid, {})
        merged = dict(current)
        for key, value in kwargs.items():
            if value is not None or key not in merged:
                merged[key] = value
        merged["id"] = eid
        self.entities[eid] = merged
        for value, kind in [
            (kwargs.get("name"), "name"), (kwargs.get("legal_name"), "legal_name"),
            *[(x, "alias") for x in kwargs.get("aliases", [])],
        ]:
            if value:
                self.aliases[eid].add((value, kind))
                self.alias_norms[norm(value)].add(eid)
        return eid

    def observation(self, entity_id, kind, value=None, text=None, unit=None, year=None, as_of=None,
                    value_class="unknown", source=None, method=None, note=None, current=1):
        self.obs.append((entity_id, kind, value, text, unit, year, as_of, value_class, self.source(source), method, note, current))

    def relationship(self, from_id, to_id, type_, pct=None, as_of=None, value_class="reported",
                     source=None, note=None, evidence=None):
        self.rels.append((from_id, to_id, type_, pct, as_of, value_class, self.source(source), note, evidence))

    def contact(self, entity_id, type_, value, source=None, verified_at=None, value_class="reported"):
        value = clean_contact(type_, value)
        if value is None:
            return
        if any(c[0] == entity_id and c[1] == type_ and c[2] == value for c in self.contacts):
            return
        self.contacts.append((entity_id, type_, value, self.source(source), verified_at, value_class))

    def account(self, entity_id, coa_id, account, year, value, source=None):
        self.accounts.append((entity_id, str(coa_id), account, str(year), value, self.source(source)))

    def officer(self, entity_id, name, role, source=None):
        self.officers.append((entity_id, name, role, self.source(source)))

    def external(self, eid: str, name: str, registry="external", **kwargs):
        return self.entity(eid, registry=registry, slug=eid, name=name, **kwargs)


def load_contacts() -> dict:
    path = ROOT / "data" / "company-contacts.json"
    if not path.exists():
        return {}
    return {x["id"]: x for x in read("company-contacts.json")["entities"]}


def build() -> Graph:
    g = Graph()
    contact_map = load_contacts()

    # Technology census: facts, estimates and group context remain separate.
    census = read("public/data/census.json")
    for c in census["companies"]:
        eid = "tech-" + c["id"]
        g.entity(eid, registry="tech", slug=c["id"], name=c["name"], legal_name=c.get("legal_name"),
                 company_type=c.get("company_type"), sector=c.get("sector_label") or c.get("sector"),
                 province=c.get("province"), city=c.get("kota"), url=c.get("url"),
                 status=c.get("site_status"), confidence=c.get("confidence"), payload=c)
        for url in [c.get("url"), c.get("employees_src"), c.get("funding_src"), *(c.get("sources") or [])]:
            g.source(url)
        if c.get("employees_est") is not None:
            g.observation(eid, "employees", c["employees_est"], unit="people", as_of=c.get("employees_asof"),
                          value_class="reported" if c.get("employees_kind") == "company" else "estimate",
                          source=c.get("employees_src"), method=c.get("employees_kind"), note=c.get("employees_note"))
        if c.get("employees_group_est") is not None:
            g.observation(eid, "employees_group_context", c["employees_group_est"], unit="people",
                          value_class="context_only", source=c.get("employees_src"), note=c.get("employees_note"))
        if c.get("funding_total_usd_m") is not None:
            g.observation(eid, "funding_disclosed", c["funding_total_usd_m"], unit="USD_millions",
                          as_of=c.get("funding_asof"), value_class="reported", source=c.get("funding_src"),
                          method=c.get("funding_status"), note=c.get("funding_note"))
        if c.get("funding_group_total_usd_m") is not None:
            g.observation(eid, "funding_group_context", c["funding_group_total_usd_m"], unit="USD_millions",
                          value_class="context_only", source=c.get("funding_src"), note=c.get("funding_note"))
        if c.get("valuation_usd_m") is not None:
            g.observation(eid, "valuation", c["valuation_usd_m"], unit="USD_millions", as_of=c.get("valuation_asof"),
                          value_class="estimate" if c.get("valuation_est") else "reported", source=(c.get("sources") or [None])[0],
                          method=c.get("valuation_kind"), note=c.get("valuation_note"))
        if c.get("est_gva_idr_bn") is not None:
            g.observation(eid, "direct_gva_estimate", c["est_gva_idr_bn"], unit="IDR_billions_per_year",
                          value_class="estimate", method="headcount_x_sector_anchor_v1",
                          note="Model estimate; never revenue, GMV, funding or valuation.")
        for contact in contact_map.get(eid, {}).get("contacts", []):
            g.contact(eid, contact["type"], contact["value"], contact.get("source"), contact_map[eid].get("retrieved_at"))
        if c.get("employees_src"):
            g.contact(eid, "linkedin_company", c["employees_src"], c.get("employees_src"), c.get("employees_asof"))
        if c.get("url"):
            g.contact(eid, "website", c["url"], c.get("url"))

    # BUMN parent enrichment and full subsidiary trees.
    bumn = read("bumn-enrichment.json")
    bumn_subs = read("bumn-subs.json")["groups"]
    bumn_sankey = read("bumn-sankey.json")["groups"]
    bumn_ties = read("bumn-ties.json")["groups"]
    for e in bumn["entities"]:
        eid = e["id"]
        g.entity(eid, registry="bumn", slug=e["slug"], name=e["short_name"], legal_name=e["name"],
                 company_type=e.get("company_type"), sector=e.get("sector"), url=e.get("url"), payload=e)
        for url in e.get("sources", []):
            g.source(url)
        emp = e.get("employees")
        if emp:
            g.observation(eid, "employees", emp.get("v"), unit="people", as_of=emp.get("period"),
                          value_class="reported_secondary" if "fortune" in (emp.get("url") or "") else "reported",
                          source=emp.get("url"), note=emp.get("note"))
        for key, fin in (e.get("financials") or {}).items():
            if key == "employees":
                continue
            if isinstance(fin, dict) and fin.get("v") is not None:
                kind = {"revenue": "revenue", "net_profit": "net_profit", "total_assets": "total_assets",
                        "dividend_fy2025": "dividend", "dividend_fy2024": "dividend"}.get(key, key)
                g.observation(eid, kind, fin["v"], unit="IDR_trillions", year=fin.get("period"),
                              value_class="reported_secondary" if fin.get("secondary") else "reported",
                              source=fin.get("url"), note=fin.get("note"))
        for contact in e.get("contacts", []):
            g.contact(eid, contact["type"], contact["value"], contact.get("source"))
        for contact in contact_map.get(eid, {}).get("contacts", []):
            g.contact(eid, contact["type"], contact["value"], contact.get("source"), contact_map[eid].get("retrieved_at"))

        def walk(node, parent_id, root, path):
            name, pct, status, sector = node[:4]
            children = node[5] if len(node) > 5 else []
            node_slug = slug(name)
            node_path = path + "-" + node_slug
            nid = "bumn-sub-" + root + node_path
            g.entity(nid, registry="bumn_subsidiary", slug=nid, name=name, company_type="subsidiary",
                     sector=sector, status=status, payload={"name": name, "status": status, "sector": sector})
            g.relationship(parent_id, nid, "ownership", pct=pct, value_class="reported",
                           note=(bumn_subs[root].get("basis") or {}).get("doc"),
                           source=((bumn_sankey.get(root, {}).get("src") or {}).get("fs") or {}).get("u"),
                           evidence=(bumn_subs[root].get("basis") or {}).get("as_of"))
            for child in children:
                walk(child, nid, root, node_path)
        group = bumn_subs.get(e["slug"])
        if group:
            for node in group.get("subs", []):
                walk(node, eid, e["slug"], "")
        for row in bumn_ties.get(e["slug"], []):
            kind, actor, targets, note, confidence, asof, url = row
            for target_name, profile in targets:
                tid = "external-" + slug(target_name)
                g.external(tid, target_name, payload={"profile_path": profile})
                g.relationship(eid, tid, kind, as_of=asof, value_class="reported" if confidence == "confirmed" else "company_stated",
                               source=url, note=note, evidence=confidence)

    # Canonical BUMD registry and all relationship/operation records.
    bumd = read("bumd-deduped.json")
    for c in bumd["co"]:
        eid = c["id"]
        g.entity(eid, registry="bumd", slug=eid, name=c["n"], legal_name=c.get("l"),
                 company_type="regional_joint_venture" if c.get("sub") else "regional_public_enterprise",
                 sector=c.get("s"), province=c.get("p"), city=c.get("c"), url=c.get("w"),
                 status=c.get("st"), aliases=c.get("aliases", []), payload=c)
        for url in c.get("src", []):
            g.source(url)
        if c.get("fin"):
            fin = c["fin"]
            for kind, key in [("assets", "a"), ("revenue", "r"), ("net_profit", "p")]:
                if fin.get(key) is not None:
                    g.observation(eid, kind, fin[key], unit=fin.get("u"), year=fin.get("y"),
                                  value_class="reported", source=fin.get("s"), note="Latest reported figure in the canonical record")
        for owner in c.get("o", []):
            oid = "government-" + slug(owner.get("g"))
            g.external(oid, owner.get("g"), registry="regional_government")
            g.relationship(oid, eid, "ownership", pct=owner.get("s"), value_class="reported",
                           source=owner.get("u") or (c.get("src") or [None])[0])
        detail = c.get("detail") or {}
        for contact in detail.get("contacts", []):
            g.contact(eid, contact["type"], contact["value"], contact.get("source"), value_class=contact.get("value_class", "reported"))
        for officer in detail.get("officers", []):
            g.officer(eid, officer["name"], officer.get("role"), officer.get("source"))
        for edge in detail.get("ownership_edges", []):
            from_id = edge["from"]
            if from_id not in g.entities:
                g.external(from_id, from_id, registry="organization")
            g.relationship(from_id, eid, "ownership", pct=edge.get("pct"), as_of=edge.get("as_of"),
                           value_class=edge.get("value_class", "reported"), source=edge.get("source"))
        fin = detail.get("financials") or {}
        for account in fin.get("accounts", []):
            for year in fin.get("years", []):
                if account.get(str(year)) is not None:
                    g.account(eid, account.get("coa_id"), account.get("nama"), year, account[str(year)], fin.get("source"))
        for contact in contact_map.get(eid, {}).get("contacts", []):
            g.contact(eid, contact["type"], contact["value"], contact.get("source"), contact_map[eid].get("retrieved_at"))
    def related_registry(kind):
        return {"bumn": "bumn_related", "bumn_sub": "bumn_related_subsidiary"}.get(kind, kind or "external")
    for tie in bumd.get("ties", []):
        for node_id in [tie["a"], tie["b"]]:
            if node_id not in g.entities:
                entity_meta = bumd.get("ents", {}).get(node_id, {})
                g.external(node_id, entity_meta.get("n") or node_id, registry=related_registry(entity_meta.get("k")), payload=entity_meta)
        g.relationship(tie["a"], tie["b"], tie.get("r"), as_of=tie.get("dt"),
                       value_class="company_stated" if tie.get("e") == "s" else "confirmed",
                       source=tie.get("u"), note=tie.get("d"), evidence=tie.get("e"))
    for op in bumd.get("ops", []):
        oid = "op-" + op["id"]
        g.entity(oid, registry="joint_operation", slug=op["id"], name=op["n"], legal_name=op.get("l"),
                 company_type="joint_venture" if op.get("k") == "jv" else "joint_operation",
                 sector=op.get("k"), status=op.get("st"), payload=op)
        for url in op.get("src", []):
            g.source(url)
        for member in op.get("m", []):
            mid = member.get("id")
            if not mid:
                mid = "external-" + slug(member.get("n"))
                g.external(mid, member.get("n"), registry="organization")
            elif mid not in g.entities:
                meta = bumd.get("ents", {}).get(mid, {})
                g.external(mid, meta.get("n") or mid, registry=related_registry(meta.get("k")), payload=meta)
            g.relationship(oid, mid, "joint_operation_member", pct=member.get("pct"),
                           value_class="reported", source=(op.get("src") or [None])[0], note=op.get("d"))

    # Census supply-chain graph and its source registry. Endpoint forms include
    # canonical IDs, external IDs and name-only counterparties.
    links = read("census-links.json")
    for edge in links.get("edges", []):
        raw_from = edge.get("from") or edge.get("from_ext") or edge.get("from_name")
        raw_to = edge.get("to") or edge.get("to_ext") or edge.get("to_name")
        from_id = "tech-" + raw_from if "tech-" + raw_from in g.entities else raw_from
        to_id = "tech-" + raw_to if "tech-" + raw_to in g.entities else raw_to
        if not raw_from or not raw_to:
            continue
        for node in [from_id, to_id]:
            if node not in g.entities:
                meta = links.get("externals", {}).get(node, {})
                g.external(node, meta.get("name") or node, registry="external", payload=meta)
        meta = links.get("sources", {}).get(edge.get("src"), {})
        g.relationship(from_id, to_id, edge.get("kind"),
                       as_of=edge.get("checked"), value_class=edge.get("check") or "reported",
                       source=meta.get("url"), note=edge.get("note") or edge.get("what"), evidence=edge.get("quote"))

    # National reference values are kept apart from entity values, in one searchable macro document.
    macro_id = "national-aggregates"
    g.entity(macro_id, registry="benchmark", slug=macro_id, name="Indonesia — official aggregates",
             company_type="macro_benchmark", sector="official_statistics", payload={"note": "Aggregate values are never allocated to individual companies"})
    for i, row in enumerate(bumd.get("stats", [])):
        value = row.get("v")
        if value:
            g.observation(macro_id, "national_stat_" + str(i), None, text=value, unit="text",
                          value_class="reported_secondary", source=row.get("u"), note=row.get("k"))
    pdam_url = "https://www.slideshare.net/slideshow/buku-summary_2024_fabjbj_removed-1-pptx/282310788"
    g.observation(macro_id, "national_pdam_evaluated", 394, unit="companies", year="2023",
                  value_class="reported", source=pdam_url, note="PUPR/BPKP Buku Kinerja BUMD Air Minum 2024; aggregate only")
    g.observation(macro_id, "national_pdam_employees", 59045, unit="people", year="2023",
                  value_class="reported", source=pdam_url, note="National aggregate; never allocated to an individual PDAM")
    return g


def write(g: Graph) -> None:
    if DB.exists():
        DB.unlink()
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    with con:
        con.executemany("INSERT INTO meta VALUES (?,?)", [
            ("generated", NOW), ("release", "company-graph-v1"),
            ("query_time_network", "disabled"),
            ("value_classes", "reported, reported_secondary, derived, estimate, context_only, unknown"),
            ("method", "Local files only; every observation carries value_class and source_id where available"),
        ])
        con.executemany("INSERT INTO sources VALUES (?,?,?,?)", [(sid, *value) for sid, value in g.sources.items()])
        entity_rows = []
        fts_rows = []
        for eid, e in g.entities.items():
            payload = dict(e)
            payload.pop("id", None)
            entity_rows.append((eid, e.get("registry"), e.get("slug"), e.get("name"), e.get("legal_name"),
                                e.get("company_type"), e.get("sector"), e.get("province"), e.get("city"),
                                e.get("url"), e.get("status"), e.get("confidence"), json.dumps(payload, ensure_ascii=False)))
            body = " ".join(str(e.get(k) or "") for k in ["name", "legal_name", "sector", "province", "city"])
            fts_rows.append((eid, e.get("name"), e.get("legal_name"), e.get("sector"), e.get("province"), e.get("city"), body))
        con.executemany("INSERT INTO entities VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", entity_rows)
        alias_rows = [(alias, eid, kind) for eid, values in g.aliases.items() for alias, kind in values]
        con.executemany("INSERT INTO aliases VALUES (?,?,?)", alias_rows)
        con.executemany("INSERT INTO observations(entity_id,kind,value_num,value_text,unit,year,as_of,value_class,source_id,method_id,note,is_current) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", g.obs)
        con.executemany("INSERT INTO relationships(from_id,to_id,type,pct,as_of,value_class,source_id,note,evidence) VALUES (?,?,?,?,?,?,?,?,?)", g.rels)
        con.executemany("INSERT INTO contacts(entity_id,type,value,source_id,verified_at,value_class) VALUES (?,?,?,?,?,?)", g.contacts)
        con.executemany("INSERT INTO financial_accounts VALUES (?,?,?,?,?,?)", g.accounts)
        con.executemany("INSERT INTO officers VALUES (?,?,?,?)", g.officers)
        con.executemany("INSERT INTO dedupe_candidates VALUES (?,?,?)", [
            (alias, json.dumps(sorted(ids)), "Exact-name candidate only; not automatically merged")
            for alias, ids in g.alias_norms.items() if len(ids) > 1
        ])
        con.executemany("INSERT INTO entity_fts VALUES (?,?,?,?,?,?,?)", fts_rows)
    con.close()

    by_registry = collections.Counter(e.get("registry") for e in g.entities.values())
    by_type = collections.Counter((e.get("company_type") or "unclassified") for e in g.entities.values())
    by_relation = collections.Counter(r[2] for r in g.rels)
    by_contact = collections.Counter(c[1] for c in g.contacts)
    release = {
        "generated": NOW,
        "entities": len(g.entities), "by_registry": dict(by_registry), "by_company_type": dict(by_type),
        "relationships": len(g.rels), "by_relationship": dict(by_relation),
        "observations": len(g.obs), "sources": len(g.sources), "contacts": len(g.contacts),
        "by_contact": dict(by_contact), "officers": len(g.officers),
        "dedupe_candidates": sum(len(ids) > 1 for ids in g.alias_norms.values()),
        "coverage": {
            "tech_companies": by_registry.get("tech", 0),
            "bumn_parents": by_registry.get("bumn", 0),
            "bumn_subsidiaries": by_registry.get("bumn_subsidiary", 0),
            "bumd_canonical": by_registry.get("bumd", 0),
            "bumd_dedupe_merge_groups": len(read("bumd-deduped.json").get("dedupe", {}).get("merge_groups", [])),
            "note": "BUMN/BUMD/tech employment is reported separately to avoid cross-registry double counting. No vacancy counts are inferred from headcount.",
        },
        "chatbot": {
            "sqlite": "data/company-graph.sqlite", "jsonl": "data/company-corpus.jsonl",
            "fts": "entity_fts (FTS5)", "query_time_network": "disabled",
            "vacancies": "job_postings schema is present but empty until a dated vacancy source is ingested",
        },
    }
    INSIGHTS.parent.mkdir(parents=True, exist_ok=True)
    INSIGHTS.write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n")

    with CORPUS.open("w") as fh:
        for eid, entity in sorted(g.entities.items()):
            observations = [o for o in g.obs if o[0] == eid]
            relationships = [r for r in g.rels if r[0] == eid or r[1] == eid]
            contacts = [c for c in g.contacts if c[0] == eid]
            facts = [{
                "kind": o[1], "value": o[2] if o[2] is not None else o[3], "unit": o[4],
                "year": o[5], "as_of": o[6], "value_class": o[7], "source_id": o[8],
                "method": o[9], "note": o[10], "is_current": o[11],
            } for o in observations]
            edges = [{
                "from": r[0], "to": r[1], "type": r[2], "pct": r[3], "as_of": r[4],
                "value_class": r[5], "source_id": r[6], "note": r[7], "evidence": r[8],
            } for r in relationships]
            doc = {
                "id": eid, "registry": entity.get("registry"), "name": entity.get("name"),
                "legal_name": entity.get("legal_name"), "company_type": entity.get("company_type"),
                "sector": entity.get("sector"), "province": entity.get("province"), "city": entity.get("city"),
                "facts": facts, "relationships": edges,
                "contacts": [{"type": c[1], "value": c[2], "source_id": c[3], "verified_at": c[4], "value_class": c[5]} for c in contacts],
                "source_ids": sorted({o[8] for o in observations if o[8]} | {r[6] for r in relationships if r[6]}),
            }
            lines = [f"{entity.get('name')} ({entity.get('legal_name') or entity.get('name')})",
                     f"Registry: {entity.get('registry')}; type: {entity.get('company_type')}; sector: {entity.get('sector')}; location: {entity.get('city')}, {entity.get('province')}.",
                     f"Status: {entity.get('status') or 'not stated'}; URL: {entity.get('url') or 'not collected'}."]
            for fact in facts[:80]:
                lines.append(f"- {fact['kind']}: {fact['value']} {fact['unit'] or ''} ({fact['as_of'] or fact['year'] or 'undated'}) [{fact['value_class']}] {fact['note'] or ''}".strip())
            for edge in edges[:40]:
                lines.append(f"- {edge['from']} --{edge['type']}--> {edge['to']} ({edge['pct'] if edge['pct'] is not None else 'percentage unknown'}) [{edge['value_class']}]")
            doc["text"] = "\n".join(lines)
            doc["text_sha256"] = hashlib.sha256(doc["text"].encode()).hexdigest()
            fh.write(json.dumps(doc, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    graph = build()
    write(graph)
    print(json.dumps({
        "entities": len(graph.entities), "observations": len(graph.obs), "relationships": len(graph.rels),
        "contacts": len(graph.contacts), "sources": len(graph.sources), "sqlite": str(DB), "corpus": str(CORPUS),
    }, indent=2))
