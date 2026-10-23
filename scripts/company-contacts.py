#!/usr/bin/env python3
"""Collect public business contacts for the local company graph.

Build-time only: no Exa/Firecrawl/lead API and no query-time network dependency.
Only role-based published mailboxes, tel: links, careers pages and actual
LinkedIn company links are retained. Personal email patterns are never inferred.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import html
import json
import re
import threading
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib import robotparser

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "company-contacts.json"
CACHE = ROOT / "data" / "contact-cache"
UA = "1001startupPublicSourceBot/1.0 (+https://1001startup.id/about)"
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
LINKEDIN_RE = re.compile(r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|school)/[^\"'<>\s]+", re.I)
CONTACT_RE = re.compile(r"contact|kontak|hubungi|tentang|about|corporate|company|karir|career|careers|join-us", re.I)
ROLE = {
    "info", "contact", "hello", "halo", "sales", "marketing", "marcom", "admin", "support", "cs", "care", "help", "hr", "recruitment", "recruit", "career", "careers", "press", "media", "legal", "finance", "billing", "partnership", "partnerships", "business", "team", "office", "general", "customer", "customerservice", "enquiry", "enquiries", "inquiry", "inquiries", "feedback", "corporate", "service", "services", "relations", "publicrelations", "consumer", "consumercare", "customercare", "customerhelp", "wehearyou", "wecare", "humas", "sekretariat", "pengaduan", "layanan", "pelanggan", "corporatesecretary", "corporatecommunication", "corporateaffairs", "csirt", "security", "abuse", "postmaster",
}
DUMMY = {"example", "john", "jane", "doe", "smith", "firstname", "lastname", "name", "email", "user", "username", "jdoe", "jsmith", "johndoe", "johnsmith", "firstlast", "flast", "test", "testing"}
_tls = threading.local()


def read_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


def cache_path(entity: dict) -> Path:
    return CACHE / (entity["id"].replace("/", "-") + ".json")


def session():
    if not hasattr(_tls, "session"):
        import requests
        _tls.session = requests.Session()
        _tls.session.headers.update({"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
    return _tls.session


def allowed(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    if not hasattr(_tls, "robots"):
        _tls.robots = {}
    if robots_url not in _tls.robots:
        status = 0
        try:
            response = session().get(robots_url, timeout=(6, 12))
            status = response.status_code
            text = response.text if status == 200 else ""
        except Exception:
            text = ""
        if status in {401, 403}:
            # Be conservative when the site explicitly refuses the robots file too.
            _tls.robots[robots_url] = False
        else:
            rp = robotparser.RobotFileParser()
            rp.set_url(robots_url)
            rp.parse(text.splitlines() if text else [])
            _tls.robots[robots_url] = rp
    cached = _tls.robots[robots_url]
    return cached if cached is False else cached.can_fetch(UA, url)


def fetch(url: str) -> dict:
    if not allowed(url):
        return {"url": url, "status": "robots_denied", "html": ""}
    try:
        response = session().get(url, timeout=(10, 35), allow_redirects=True, stream=True)
        ctype = response.headers.get("content-type", "").lower()
        if response.status_code in {401, 403, 406, 429}:
            return {"url": response.url, "status": "blocked", "code": response.status_code, "html": ""}
        if response.status_code >= 400:
            return {"url": response.url, "status": "http_error", "code": response.status_code, "html": ""}
        if ctype and not any(x in ctype for x in ["text/html", "application/xhtml", "text/plain"]):
            return {"url": response.url, "status": "not_html", "html": ""}
        chunks, size = [], 0
        for chunk in response.iter_content(65536):
            chunks.append(chunk)
            size += len(chunk)
            if size > 2_000_000:
                break
        raw = b"".join(chunks)
        encoding = response.encoding or "utf-8"
        return {"url": response.url, "status": "ok", "code": response.status_code, "html": raw.decode(encoding, errors="replace"), "sha256": hashlib.sha256(raw).hexdigest()}
    except Exception as exc:
        return {"url": url, "status": "error", "error": str(exc)[:300], "html": ""}


def same_site(a: str, b: str) -> bool:
    def host(url):
        return urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
    return host(a) == host(b)


def role_email(value: str) -> bool:
    value = value.strip(" .<>,;:'\"[]()").lower()
    if not EMAIL_RE.fullmatch(value):
        return False
    local, domain = value.split("@", 1)
    parts = [p for p in re.split(r"[._+\-]+", local) if p]
    if not parts or any(p in DUMMY for p in parts):
        return False
    if "noreply" in parts or "no-reply" in local or "donotreply" in local:
        return False
    if any(p in ROLE for p in parts):
        return True
    return any(local.endswith(suffix) for suffix in ["care", "support", "service", "services", "sales", "relations", "affairs", "humas"])


def extract(page: dict, base: str) -> dict:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(page["html"], "html.parser")
    emails, phones, careers, linkedin = {}, {}, [], set()
    for anchor in soup.find_all("a", href=True):
        href = html.unescape(anchor["href"].strip())
        absolute = urljoin(page["url"] or base, href)
        text = anchor.get_text(" ", strip=True)
        if href.lower().startswith("mailto:"):
            candidate = href[7:].split("?", 1)[0]
            if role_email(candidate):
                emails[candidate.lower()] = page["url"] or base
        elif href.lower().startswith("tel:"):
            number = href[4:].strip()
            if 5 <= len(number) <= 36:
                phones[number] = page["url"] or base
        if LINKEDIN_RE.match(absolute):
            linkedin.add(absolute.split("?")[0].rstrip("/"))
        if same_site(base, absolute) and CONTACT_RE.search(href + " " + text):
            careers.append((absolute, re.search(r"karir|career|careers|join-us", href + " " + text, re.I) is not None))
    for element in soup.find_all(string=EMAIL_RE):
        for candidate in EMAIL_RE.findall(str(element)):
            if role_email(candidate):
                emails[candidate.lower()] = page["url"] or base
    # Keep only the first few same-site discovery links, contact before about/careers.
    unique = []
    for url, is_career in careers:
        if url not in [x[0] for x in unique]:
            unique.append((url, is_career))
    return {"emails": emails, "phones": phones, "links": unique, "linkedin": sorted(linkedin)}


def targets() -> list:
    rows = []
    census = read_json(ROOT / "data" / "census-raw.json")
    for company in census["companies"]:
        if company.get("url"):
            rows.append({"id": "tech-" + company["id"], "url": company["url"], "name": company["name"]})
    bumd = read_json(ROOT / "data" / "bumd-deduped.json")
    for company in bumd.get("co", []):
        if company.get("w"):
            rows.append({"id": company["id"], "url": company["w"], "name": company["n"]})
    enrichment = ROOT / "data" / "bumn-enrichment.json"
    if enrichment.exists():
        for company in read_json(enrichment)["entities"]:
            if company.get("url"):
                rows.append({"id": company["id"], "url": company["url"], "name": company["name"]})
    return rows


def collect(entity: dict, refresh: bool) -> dict:
    path = cache_path(entity)
    if path.exists() and not refresh:
        return read_json(path)
    started = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    pages = [fetch(entity["url"])]
    discovered = []
    for page in pages:
        if page.get("html"):
            found = extract(page, entity["url"])
            discovered.extend(found["links"][:4])
    # Homepage + up to three same-site pages. Do not wander into a general crawl.
    for url, _ in discovered[:3]:
        if url != pages[0]["url"]:
            pages.append(fetch(url))
        time.sleep(0.08)
    emails, phones, linkedin, careers = {}, {}, set(), None
    for page in pages:
        if not page.get("html"):
            continue
        found = extract(page, entity["url"])
        emails.update(found["emails"])
        phones.update(found["phones"])
        linkedin.update(found["linkedin"])
        for url, is_career in found["links"]:
            if is_career and not careers:
                careers = url
    contacts = []
    for email, source in sorted(emails.items()):
        contacts.append({"type": "email_role", "value": email, "source": source, "value_class": "reported"})
    for number, source in sorted(phones.items()):
        contacts.append({"type": "phone_business", "value": number, "source": source, "value_class": "reported"})
    if careers:
        contacts.append({"type": "careers_url", "value": careers, "source": careers, "value_class": "reported"})
    result = {
        "id": entity["id"], "name": entity["name"], "website": entity["url"],
        "retrieved_at": started, "contacts": contacts,
        "linkedin_url": sorted(linkedin)[0] if linkedin else None,
        "pages": [{k: v for k, v in page.items() if k != "html"} for page in pages],
        "status": "ok" if any(page["status"] == "ok" for page in pages) else "unavailable",
    }
    write_json(path, result)
    time.sleep(0.08)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch", action="store_true", help="collect missing/expired records from public sites")
    parser.add_argument("--refresh", action="store_true", help="re-fetch even when a cached record exists")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    records = []
    if args.fetch:
        rows = targets()
        if args.only:
            rows = [x for x in rows if args.only.lower() in x["id"].lower() or args.only.lower() in x["name"].lower()]
        if args.limit:
            rows = rows[:args.limit]
        todo = [x for x in rows if args.refresh or not cache_path(x).exists()]
        print(f"Contact collection: {len(todo)} sites, {args.workers} workers")
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futures = [pool.submit(collect, row, args.refresh) for row in todo]
            for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
                try:
                    future.result()
                except Exception as exc:
                    print("error", exc)
                if i % 25 == 0 or i == len(futures):
                    print(f"{i}/{len(futures)}")
    for row in targets():
        path = cache_path(row)
        if path.exists():
            records.append(read_json(path))
    result = {
        "generated": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "entities": records,
        "stats": {
            "entities": len(records),
            "with_email": sum(any(c["type"] == "email_role" for c in x["contacts"]) for x in records),
            "with_phone": sum(any(c["type"] == "phone_business" for c in x["contacts"]) for x in records),
            "with_careers": sum(any(c["type"] == "careers_url" for c in x["contacts"]) for x in records),
            "with_linkedin": sum(bool(x.get("linkedin_url")) for x in records),
            "unavailable": sum(x["status"] != "ok" for x in records),
        },
        "method": [
            "Build-time public-page collection only. No third-party lead/search API is called.",
            "Only published role-based mailboxes and tel: links are retained; no personal email is guessed.",
            "Every contact carries its exact source page and retrieval date. A blocked site is unavailable, not a negative finding.",
        ],
    }
    write_json(OUT, result)
    print(json.dumps(result["stats"], indent=2))


if __name__ == "__main__":
    main()
