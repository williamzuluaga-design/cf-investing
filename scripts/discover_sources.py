#!/usr/bin/env python3
import hashlib
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public/data/discovery-sources.json"
QUEUE = ROOT / "public/data/discovery-queue.json"
PROJECTS = ROOT / "public/data/projects.json"
REVIEW_MD = Path("/tmp/source-discovery-review.md")
UA = "CFInvestingSourceDiscovery/1.0 (+https://cfinvesting.com/projects/methodology/)"


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(value):
    value = html.unescape(value or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def canonical(url):
    p = urllib.parse.urlsplit(url)
    path = re.sub(r"/{2,}", "/", p.path or "/")
    if path != "/":
        path = path.rstrip("/")
    return urllib.parse.urlunsplit((p.scheme.lower(), p.netloc.lower(), path, "", ""))


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


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        content_type = resp.headers.get("Content-Type", "")
        if "html" not in content_type.lower():
            raise RuntimeError(f"Unexpected content type: {content_type}")
        raw = resp.read(2_000_000)
    return raw.decode("utf-8", errors="replace")


def match_candidate(source, base_url, href, title):
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
    if not title:
        return None
    return c, title


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def save_json(path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    registry = load_json(REGISTRY, {"sources": []})
    previous = load_json(QUEUE, {"candidates": []})
    projects = load_json(PROJECTS, {"projects": []})
    known_urls = {canonical(p.get("source_url", "")) for p in projects.get("projects", []) if p.get("source_url")}
    previous_by_url = {canonical(c["url"]): c for c in previous.get("candidates", []) if c.get("url")}
    run_at = now_iso()
    discovered = {}
    source_runs = []
    new_items = []

    for source in registry.get("sources", []):
        if not source.get("enabled"):
            source_runs.append({"source_id": source["id"], "enabled": False, "status": "registered_not_active", "checked_at": None, "candidate_count": 0})
            continue
        run = {"source_id": source["id"], "enabled": True, "status": "ok", "checked_at": run_at, "candidate_count": 0}
        try:
            page = fetch_html(source["url"])
            parser = LinkParser()
            parser.feed(page)
            seen = set()
            limit = int(source.get("max_candidates_per_run", 30))
            for href, title in parser.links:
                matched = match_candidate(source, source["url"], href, title)
                if not matched:
                    continue
                url, title = matched
                if url in seen or url in known_urls:
                    continue
                seen.add(url)
                old = previous_by_url.get(url)
                candidate = {
                    "id": old.get("id") if old else hashlib.sha1(url.encode("utf-8")).hexdigest()[:14],
                    "source_id": source["id"],
                    "source_name": source["organization"],
                    "candidate_kind": source.get("candidate_kind", "unknown"),
                    "title": title,
                    "url": url,
                    "first_seen": old.get("first_seen") if old else run_at,
                    "last_seen": run_at,
                    "currently_listed": True,
                    "review_status": old.get("review_status", "pending_review") if old else "pending_review",
                    "review_notes": old.get("review_notes", "") if old else ""
                }
                discovered[url] = candidate
                if old is None:
                    new_items.append(candidate)
                if len(seen) >= limit:
                    break
            run["candidate_count"] = len(seen)
        except Exception as exc:
            run["status"] = "error"
            run["error"] = clean_text(str(exc))[:500]
        source_runs.append(run)

    for url, old in previous_by_url.items():
        if url not in discovered:
            retained = dict(old)
            retained["currently_listed"] = False
            discovered[url] = retained

    candidates = sorted(discovered.values(), key=lambda c: (c.get("review_status") != "pending_review", c.get("first_seen") or "", c.get("title") or ""))
    payload = {
        "schema_version": "1.0",
        "updated_at": run_at,
        "status": "active",
        "policy": "Candidates are discovery signals only and require human review before publication.",
        "source_runs": source_runs,
        "candidates": candidates
    }
    save_json(QUEUE, payload)

    lines = [
        "# Project discovery review queue",
        "",
        f"Run: {run_at}",
        "",
        "New candidates were detected on registered official-source listing pages. Review each primary source before adding or changing any Project Intelligence record.",
        ""
    ]
    if new_items:
        for c in new_items:
            lines += [f"- **{c['title']}** — {c['source_name']}  ", f"  {c['url']}"]
    else:
        lines.append("No new candidates in this run.")
    lines += ["", "Do not auto-publish candidates. Confirm identity, geography, instrument, disclosed amount, source date and relevance first."]
    REVIEW_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write(f"new_count={len(new_items)}\n")
            fh.write(f"checked_source_count={sum(1 for x in source_runs if x.get('enabled'))}\n")
            fh.write(f"failed_source_count={sum(1 for x in source_runs if x.get('status') == 'error')}\n")
    print(f"Discovery run complete: {len(new_items)} new candidates; {len(candidates)} retained candidates.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
