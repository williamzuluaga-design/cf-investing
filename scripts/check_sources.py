#!/usr/bin/env python3
"""Low-frequency primary-source freshness monitor for CF Investing.

The monitor stores only operational metadata and normalized-text hashes. A change
signal never edits published project facts; human review is required first.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import ssl
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import certifi
except ImportError:  # Local/manual runs can still use the platform trust store.
    certifi = None

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "public" / "data" / "source-registry.json"
STATE_PATH = ROOT / "public" / "data" / "source-monitor.json"
REVIEW_PATH = Path("/tmp/source-monitor-review.md")
USER_AGENT = "CFInvesting-SourceMonitor/1.1 (+https://cfinvesting.com/projects/methodology/)"
TIMEOUT = 25


class VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg", "template"}:
            self.skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg", "template"} and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def tls_context() -> ssl.SSLContext:
    """Return a verification-enabled TLS context.

    GitHub Actions installs certifi so sources with certificate chains that are not
    resolved by the runner's default trust store can still be verified safely.
    Certificate verification is never disabled.
    """
    if certifi is not None:
        return ssl.create_default_context(cafile=certifi.where())
    return ssl.create_default_context()


def normalized_text(payload: bytes, content_type: str) -> str:
    text = payload.decode("utf-8", errors="replace")
    if "html" in content_type.lower() or "<html" in text[:1000].lower():
        parser = VisibleTextParser()
        parser.feed(text)
        text = " ".join(parser.parts)
    return re.sub(r"\s+", " ", text).strip()


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def fetch_source(source: dict, previous: dict) -> dict:
    checked_at = now_iso()
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/json,text/plain;q=0.8,*/*;q=0.5",
    }
    if previous.get("etag"):
        headers["If-None-Match"] = previous["etag"]
    if previous.get("last_modified"):
        headers["If-Modified-Since"] = previous["last_modified"]

    req = Request(source["url"], headers=headers, method="GET")
    try:
        with urlopen(req, timeout=TIMEOUT, context=tls_context()) as response:
            payload = response.read()
            status_code = getattr(response, "status", 200)
            content_type = response.headers.get("Content-Type", "")
            text = normalized_text(payload, content_type)
            current_hash = digest(text)
            old_hash = previous.get("content_sha256")
            baseline = not bool(old_hash)
            changed = bool(old_hash and old_hash != current_hash)
            return {
                **{k: source[k] for k in ("id", "record_id", "name", "source_name", "url")},
                "status": "changed" if changed else ("baseline_initialized" if baseline else "unchanged"),
                "http_status": status_code,
                "last_checked_at": checked_at,
                "last_change_detected_at": checked_at if changed else previous.get("last_change_detected_at"),
                "baseline_initialized_at": checked_at if baseline else previous.get("baseline_initialized_at"),
                "etag": response.headers.get("ETag"),
                "last_modified": response.headers.get("Last-Modified"),
                "content_sha256": current_hash,
                "normalized_text_length": len(text),
                "error": None,
            }
    except HTTPError as exc:
        if exc.code == 304:
            return {
                **{k: source[k] for k in ("id", "record_id", "name", "source_name", "url")},
                **{k: previous.get(k) for k in ("last_change_detected_at", "baseline_initialized_at", "etag", "last_modified", "content_sha256", "normalized_text_length")},
                "status": "unchanged",
                "http_status": 304,
                "last_checked_at": checked_at,
                "error": None,
            }
        return error_result(source, previous, checked_at, f"HTTP {exc.code}: {exc.reason}", exc.code)
    except (URLError, TimeoutError, ssl.SSLError, OSError) as exc:
        return error_result(source, previous, checked_at, str(exc), None)


def error_result(source: dict, previous: dict, checked_at: str, message: str, http_status):
    return {
        **{k: source[k] for k in ("id", "record_id", "name", "source_name", "url")},
        **{k: previous.get(k) for k in ("last_change_detected_at", "baseline_initialized_at", "etag", "last_modified", "content_sha256", "normalized_text_length")},
        "status": "error",
        "http_status": http_status,
        "last_checked_at": checked_at,
        "error": message[:500],
    }


def write_github_output(changed: bool, error_count: int) -> None:
    output = os.environ.get("GITHUB_OUTPUT")
    if not output:
        return
    with open(output, "a", encoding="utf-8") as fh:
        fh.write(f"changed={'true' if changed else 'false'}\n")
        fh.write(f"errors={error_count}\n")


def main() -> int:
    registry = load_json(REGISTRY_PATH, {"sources": []})
    previous_state = load_json(STATE_PATH, {"sources": []})
    previous_by_id = {item.get("id"): item for item in previous_state.get("sources", [])}

    enabled = [s for s in registry.get("sources", []) if s.get("enabled", True)]
    results = [fetch_source(source, previous_by_id.get(source["id"], {})) for source in enabled]
    changes = [r for r in results if r["status"] == "changed"]
    errors = [r for r in results if r["status"] == "error"]
    baselines = [r for r in results if r["status"] == "baseline_initialized"]
    healthy = len(results) - len(errors)

    state = {
        "schema_version": "1.0",
        "updated_at": now_iso(),
        "monitor_status": "attention" if changes or errors else "healthy",
        "policy": "Monitoring detects possible source changes only. Published project facts require human review before update.",
        "summary": {
            "sources": len(results),
            "healthy": healthy,
            "changed_last_run": len(changes),
            "errors": len(errors),
            "pending_baseline": 0,
            "baselines_initialized_last_run": len(baselines),
        },
        "sources": results,
        "last_run_changes": [
            {
                "id": r["id"],
                "record_id": r["record_id"],
                "name": r["name"],
                "source_name": r["source_name"],
                "url": r["url"],
                "detected_at": r["last_checked_at"],
            }
            for r in changes
        ],
    }
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if changes:
        lines = [
            "# Source changes detected",
            "",
            "The scheduled source monitor detected normalized-text changes in primary pages already used by Project Intelligence.",
            "",
            "**Do not update project facts automatically.** Review each primary source, compare material facts, and only then update `public/data/projects.json` and the relevant profile if warranted.",
            "",
        ]
        for item in changes:
            lines.extend([
                f"## {item['name']}",
                f"- Record: `{item['record_id']}`",
                f"- Source: {item['source_name']}",
                f"- URL: {item['url']}",
                f"- Detected: {item['last_checked_at']}",
                "",
            ])
        lines.extend([
            "Review checklist:",
            "- Confirm whether the change is material or only editorial/navigation noise.",
            "- Re-check amount, stage, instrument, dates, sponsor/borrower and material terms.",
            "- Preserve source attribution and source date.",
            "- Record a new `last_reviewed` date only after human review.",
        ])
        REVIEW_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    write_github_output(bool(changes), len(errors))
    print(json.dumps(state["summary"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
