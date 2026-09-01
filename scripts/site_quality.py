#!/usr/bin/env python3
"""Static quality gate for the CF Investing public site.

The script checks deployable files under ./public only. It is intentionally
conservative: broken local references, duplicate canonicals and known stale
artifacts are errors; incomplete SEO metadata is reported as a warning so the
site can be improved incrementally without blocking unrelated work.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CANONICAL_HOST = "cfinvesting.com"
FORBIDDEN = (
    "TraderCapital",
    "Cloudflare Pages",
    "/data/project-sources.json",
)


class AuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title_parts: list[str] = []
        self.h1_count = 0
        self.lang = ""
        self.canonical = ""
        self.description = ""
        self.refs: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        attrs_dict = {str(k).lower(): str(v) for k, v in attrs if k and v is not None}
        if tag == "html":
            self.lang = attrs_dict.get("lang", "").strip()
        elif tag == "title":
            self.in_title = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "meta" and attrs_dict.get("name", "").lower() == "description":
            self.description = attrs_dict.get("content", "").strip()
        elif tag == "link" and attrs_dict.get("rel", "").lower() == "canonical":
            self.canonical = attrs_dict.get("href", "").strip()

        for key in ("href", "src"):
            value = attrs_dict.get(key)
            if value:
                self.refs.append((key, value.strip()))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.title_parts)).strip()


def route_to_file(path: str) -> Path:
    path = path or "/"
    if path == "/":
        return PUBLIC / "index.html"
    rel = path.lstrip("/")
    candidate = PUBLIC / rel
    if path.endswith("/"):
        return candidate / "index.html"
    if candidate.suffix:
        return candidate
    return candidate / "index.html"


def local_target(ref: str) -> Path | None:
    if not ref or ref.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    parsed = urlsplit(ref)
    if parsed.scheme or parsed.netloc:
        return None
    path = parsed.path
    if not path:
        return None
    if path.startswith("/"):
        return route_to_file(path)
    return None


def public_rel(path: Path) -> str:
    return "/" + str(path.relative_to(PUBLIC)).replace("\\", "/")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    canonical_map: defaultdict[str, list[str]] = defaultdict(list)

    html_files = sorted(PUBLIC.rglob("*.html"))
    for file_path in html_files:
        rel = public_rel(file_path)
        text = file_path.read_text(encoding="utf-8", errors="replace")

        for stale in FORBIDDEN:
            if stale in text:
                errors.append(f"{rel}: stale reference found: {stale}")

        parser = AuditParser()
        try:
            parser.feed(text)
        except Exception as exc:  # HTMLParser is permissive; keep a useful failure signal.
            errors.append(f"{rel}: HTML parse failed: {exc}")
            continue

        if not parser.lang:
            warnings.append(f"{rel}: missing html lang attribute")
        if not parser.title:
            warnings.append(f"{rel}: missing title")
        if not parser.description:
            warnings.append(f"{rel}: missing meta description")
        if parser.h1_count != 1:
            warnings.append(f"{rel}: expected exactly one h1, found {parser.h1_count}")
        if not parser.canonical:
            warnings.append(f"{rel}: missing canonical URL")
        else:
            parsed = urlsplit(parser.canonical)
            if parsed.scheme != "https" or parsed.netloc != CANONICAL_HOST:
                errors.append(f"{rel}: non-canonical host/scheme: {parser.canonical}")
            canonical_map[parser.canonical].append(rel)

        for attr, ref in parser.refs:
            target = local_target(ref)
            if target is not None and not target.exists():
                errors.append(f"{rel}: broken local {attr} {ref} -> {public_rel(target)}")

    for canonical, pages in canonical_map.items():
        if len(pages) > 1:
            errors.append(f"duplicate canonical {canonical}: {', '.join(pages)}")

    sitemap = PUBLIC / "sitemap.xml"
    sitemap_count = 0
    if sitemap.exists():
        try:
            root = ET.fromstring(sitemap.read_text(encoding="utf-8"))
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            locs = [e.text.strip() for e in root.findall("sm:url/sm:loc", ns) if e.text]
            sitemap_count = len(locs)
            seen = set()
            for loc in locs:
                if loc in seen:
                    errors.append(f"sitemap: duplicate URL {loc}")
                seen.add(loc)
                parsed = urlsplit(loc)
                if parsed.scheme != "https" or parsed.netloc != CANONICAL_HOST:
                    errors.append(f"sitemap: wrong host/scheme {loc}")
                    continue
                if not route_to_file(parsed.path).exists():
                    errors.append(f"sitemap: route does not exist {loc}")
        except Exception as exc:
            errors.append(f"sitemap: parse failed: {exc}")
    else:
        errors.append("public/sitemap.xml is missing")

    robots = PUBLIC / "robots.txt"
    if not robots.exists():
        errors.append("public/robots.txt is missing")
    else:
        robots_text = robots.read_text(encoding="utf-8", errors="replace")
        expected = "Sitemap: https://cfinvesting.com/sitemap.xml"
        if expected not in robots_text:
            errors.append("robots.txt does not advertise the canonical sitemap")

    summary = {
        "html_pages": len(html_files),
        "sitemap_urls": sitemap_count,
        "errors": len(errors),
        "warnings": len(warnings),
    }
    print(json.dumps(summary, indent=2))
    if warnings:
        print("\nWARNINGS")
        for item in warnings:
            print(f"- {item}")
    if errors:
        print("\nERRORS")
        for item in errors:
            print(f"- {item}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
