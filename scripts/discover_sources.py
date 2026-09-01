#!/usr/bin/env python3
import hashlib
import html
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public/data/discovery-sources.json"
QUEUE = ROOT / "public/data/discovery-queue.json"
PROJECTS = ROOT / "public/data/projects.json"
REVIEW_MD = Path("/tmp/source-discovery-review.md")
UA = "CFInvestingSourceDiscovery/1.1 (+https://cfinvesting.com/projects/methodology/)"
MAX_DOWNLOAD = 50_000_000


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(value):
    value = html.unescape(value or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def ascii_key(value):
    value = unicodedata.normalize("NFKD", clean_text(value))
    value = "".join(c for c in value if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def canonical(url):
    p = urllib.parse.urlsplit(url or "")
    path = re.sub(r"/{2,}", "/", p.path or "/")
    if path != "/":
        path = path.rstrip("/")
    return urllib.parse.urlunsplit((p.scheme.lower(), p.netloc.lower(), path, "", ""))


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def save_json(path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_bytes(url, accept="*/*"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=35) as resp:
        raw = resp.read(MAX_DOWNLOAD + 1)
        if len(raw) > MAX_DOWNLOAD:
            raise RuntimeError("Source response exceeded download safety limit")
        return raw, resp.headers.get("Content-Type", "")


def fetch_html(url):
    raw, content_type = fetch_bytes(url, "text/html,application/xhtml+xml")
    if "html" not in content_type.lower() and not raw.lstrip().startswith(b"<"):
        raise RuntimeError(f"Unexpected content type: {content_type}")
    return raw.decode("utf-8", errors="replace")


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.current_href = None
        self.current_text = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            attrs = dict(attrs)
            self.current_href = attrs.get("href")
            self.current_text = []

    def handle_data(self, data):
        if self.current_href is not None:
            self.current_text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.current_href is not None:
            self.links.append((self.current_href, clean_text(" ".join(self.current_text))))
            self.current_href = None
            self.current_text = []


def match_html_candidate(source, base_url, href, title):
    if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
        return None
    absolute = urllib.parse.urljoin(base_url, href)
    parsed = urllib.parse.urlsplit(absolute)
    base_host = urllib.parse.urlsplit(base_url).netloc.lower()
    if parsed.scheme not in ("http", "https") or parsed.netloc.lower() != base_host:
        return None
    path = parsed.path or "/"
    prefixes = source.get("include_path_prefixes", [])
    if prefixes and not any(path.startswith(p) and path.rstrip("/") != p.rstrip("/") for p in prefixes):
        return None
    c = canonical(absolute)
    if c == canonical(base_url):
        return None
    title = clean_text(title)
    if not title or len(title) < 4:
        title = path.rstrip("/").split("/")[-1].replace("-", " ").strip().title()
    return (c, title) if title else None


def discover_html(source):
    page = fetch_html(source["url"])
    parser = LinkParser()
    parser.feed(page)
    seen = set()
    items = []
    limit = int(source.get("max_candidates_per_run", 30))
    for href, title in parser.links:
        matched = match_html_candidate(source, source["url"], href, title)
        if not matched:
            continue
        url, title = matched
        if url in seen:
            continue
        seen.add(url)
        items.append({
            "title": title,
            "url": url,
            "discovery_key": f"{source['id']}|url|{url}",
            "metadata": {},
            "connector": "html_catalog"
        })
        if len(items) >= limit:
            break
    return items, {"records_scanned": len(parser.links), "structured": False}


XML_ALIASES = {
    "title": {"projectname", "projecttitle", "title", "name", "project"},
    "number": {"projectnumber", "projectno", "projectid", "projectcode", "number", "projectnumbervalue"},
    "country": {"country", "countryname", "countries"},
    "published": {"publicationdate", "dateposted", "projectdateposted", "disclosuredate", "postingdate", "publisheddate", "datepublished"},
    "sector": {"sector", "sectorname"},
    "status": {"status", "projectstatus", "projectstatusvalue"},
    "category": {"escategory", "environmentalsocialcategory", "environmentaland_socialcategory", "category"},
    "url": {"url", "link", "projecturl", "projectlink", "href"},
    "amount": {"amount", "financedamount", "financingamount", "projectamount", "amountfinanced"},
    "client": {"client", "sponsor", "borrower", "company", "clientname"}
}


def xml_local(tag):
    tag = tag.split("}")[-1].split(":")[-1]
    return ascii_key(tag)


def flatten_xml(node):
    fields = {}
    leaf_count = 0
    for e in node.iter():
        for k, v in e.attrib.items():
            v = clean_text(v)
            if v:
                fields.setdefault(xml_local(k), []).append(v)
        children = list(e)
        text = clean_text(e.text)
        if not children and text:
            leaf_count += 1
            fields.setdefault(xml_local(e.tag), []).append(text)
    return fields, leaf_count


def pick_field(fields, kind):
    aliases = XML_ALIASES[kind]
    for alias in aliases:
        values = fields.get(ascii_key(alias), [])
        for value in values:
            if clean_text(value):
                return clean_text(value)
    return ""


def parse_date(value):
    value = clean_text(value)
    if not value:
        return None
    candidates = [value[:10], value]
    for candidate in candidates:
        for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(candidate, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    m = re.search(r"(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})", value)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def source_record_url(source, fields, project_number):
    raw_url = pick_field(fields, "url")
    if raw_url:
        absolute = urllib.parse.urljoin(source["url"], raw_url)
        if urllib.parse.urlsplit(absolute).scheme in ("http", "https"):
            return absolute, "record_link"
    search = source["url"] + "?" + urllib.parse.urlencode({"field_project_number_value": project_number})
    return search, "catalog_search"


def record_in_scope(source, country, published):
    scope = source.get("country_scope", [])
    if scope and ascii_key(country) not in {ascii_key(x) for x in scope}:
        return False
    since = parse_date(source.get("published_since", ""))
    if since:
        date = parse_date(published)
        if date is None or date < since:
            return False
    return True


def discover_idbinvest_xml(source):
    endpoint = source.get("structured_url")
    if not endpoint:
        raise RuntimeError("Structured URL is not configured")
    raw, content_type = fetch_bytes(endpoint, "application/xml,text/xml;q=0.9,*/*;q=0.1")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise RuntimeError(f"BID Invest XML could not be parsed: {exc}") from exc

    by_identity = {}
    scanned_nodes = 0
    for node in root.iter():
        fields, leaf_count = flatten_xml(node)
        if leaf_count < 2 or leaf_count > 80:
            continue
        title = pick_field(fields, "title")
        number = pick_field(fields, "number")
        if not title or not number:
            continue
        scanned_nodes += 1
        country = pick_field(fields, "country")
        published = pick_field(fields, "published")
        if not record_in_scope(source, country, published):
            continue
        identity = f"{ascii_key(number)}|{ascii_key(title)}"
        if identity in by_identity:
            continue
        url, url_scope = source_record_url(source, fields, number)
        metadata = {
            "project_number": number,
            "country": country or None,
            "publication_date": published or None,
            "sector": pick_field(fields, "sector") or None,
            "status": pick_field(fields, "status") or None,
            "es_category": pick_field(fields, "category") or None,
            "amount": pick_field(fields, "amount") or None,
            "client_or_sponsor": pick_field(fields, "client") or None,
            "link_scope": url_scope
        }
        metadata = {k: v for k, v in metadata.items() if v not in (None, "")}
        by_identity[identity] = {
            "title": title,
            "url": url,
            "discovery_key": f"{source['id']}|project-number|{ascii_key(number)}",
            "metadata": metadata,
            "connector": "idbinvest_xml"
        }

    def order(item):
        date = parse_date(item.get("metadata", {}).get("publication_date", ""))
        return date.timestamp() if date else 0

    items = sorted(by_identity.values(), key=order, reverse=True)
    limit = int(source.get("max_candidates_per_run", 60))
    return items[:limit], {
        "records_scanned": scanned_nodes,
        "structured": True,
        "endpoint": endpoint,
        "content_type": content_type,
        "eligible_records": len(items)
    }


def run_connector(source):
    connector = source.get("connector", "html_catalog")
    if connector == "idbinvest_xml":
        try:
            return discover_idbinvest_xml(source), False
        except Exception:
            if source.get("fallback_connector") == "html_catalog":
                return discover_html(source), True
            raise
    if connector == "html_catalog":
        return discover_html(source), False
    raise RuntimeError(f"Unsupported connector: {connector}")


def candidate_identity(source, item):
    return item.get("discovery_key") or f"{source['id']}|url|{canonical(item.get('url'))}"


def main():
    registry = load_json(REGISTRY, {"sources": []})
    previous = load_json(QUEUE, {"candidates": []})
    projects = load_json(PROJECTS, {"projects": []})

    known_urls = {canonical(p.get("source_url", "")) for p in projects.get("projects", []) if p.get("source_url")}
    known_titles = {ascii_key(p.get("name", "")) for p in projects.get("projects", []) if p.get("name")}
    previous_by_key = {}
    for candidate in previous.get("candidates", []):
        key = candidate.get("discovery_key") or f"legacy|url|{canonical(candidate.get('url', ''))}"
        previous_by_key[key] = candidate

    run_at = now_iso()
    discovered = {}
    source_runs = []
    new_items = []

    for source in registry.get("sources", []):
        connector = source.get("connector", "html_catalog")
        if not source.get("enabled"):
            source_runs.append({
                "source_id": source["id"], "enabled": False, "connector": connector,
                "status": "registered_not_active", "checked_at": None, "candidate_count": 0
            })
            continue

        run = {
            "source_id": source["id"], "enabled": True, "connector": connector,
            "status": "ok", "checked_at": run_at, "candidate_count": 0
        }
        try:
            (items, stats), fallback_used = run_connector(source)
            run.update(stats)
            run["fallback_used"] = fallback_used
            accepted = 0
            for item in items:
                url = item.get("url", "")
                title = clean_text(item.get("title", ""))
                if not title or canonical(url) in known_urls or ascii_key(title) in known_titles:
                    continue
                key = candidate_identity(source, item)
                old = previous_by_key.get(key)
                candidate = {
                    "id": old.get("id") if old else hashlib.sha1(key.encode("utf-8")).hexdigest()[:14],
                    "discovery_key": key,
                    "source_id": source["id"],
                    "source_name": source["organization"],
                    "candidate_kind": source.get("candidate_kind", "unknown"),
                    "connector": item.get("connector", connector),
                    "title": title,
                    "url": url,
                    "metadata": item.get("metadata", {}),
                    "first_seen": old.get("first_seen") if old else run_at,
                    "last_seen": run_at,
                    "currently_listed": True,
                    "review_status": old.get("review_status", "pending_review") if old else "pending_review",
                    "review_notes": old.get("review_notes", "") if old else ""
                }
                discovered[key] = candidate
                if old is None:
                    new_items.append(candidate)
                accepted += 1
            run["candidate_count"] = accepted
        except Exception as exc:
            run["status"] = "error"
            run["error"] = clean_text(str(exc))[:500]
        source_runs.append(run)

    for key, old in previous_by_key.items():
        if key not in discovered:
            retained = dict(old)
            retained["currently_listed"] = False
            discovered[key] = retained

    candidates = sorted(
        discovered.values(),
        key=lambda c: (c.get("review_status") != "pending_review", c.get("first_seen") or "", c.get("title") or "")
    )
    payload = {
        "schema_version": "1.1",
        "updated_at": run_at,
        "status": "active",
        "policy": "Candidates are discovery signals only and require human review before publication.",
        "source_runs": source_runs,
        "candidates": candidates
    }
    save_json(QUEUE, payload)

    lines = [
        "# Project discovery review queue", "", f"Run: {run_at}", "",
        "New candidates were detected from registered official-source connectors. Review each primary source before adding or changing any Project Intelligence record.", ""
    ]
    for c in new_items[:30]:
        meta = c.get("metadata", {})
        detail = " · ".join(str(meta.get(k)) for k in ("project_number", "country", "publication_date", "sector") if meta.get(k))
        lines.append(f"- **{c['title']}** — {c['source_name']}" + (f" — {detail}" if detail else "") + "  ")
        lines.append(f"  {c['url']}")
    if not new_items:
        lines.append("No new candidates in this run.")
    elif len(new_items) > 30:
        lines += ["", f"{len(new_items) - 30} additional new candidates are available in public/data/discovery-queue.json."]
    lines += ["", "Do not auto-publish candidates. Confirm identity, geography, instrument, disclosed amount, source date and relevance first."]
    REVIEW_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write(f"new_count={len(new_items)}\n")
            fh.write(f"checked_source_count={sum(1 for x in source_runs if x.get('enabled'))}\n")
            fh.write(f"failed_source_count={sum(1 for x in source_runs if x.get('status') == 'error')}\n")
            fh.write(f"structured_source_count={sum(1 for x in source_runs if x.get('structured'))}\n")
    print(f"Discovery run complete: {len(new_items)} new candidates; {len(candidates)} retained candidates.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
