#!/usr/bin/env python3
"""Refresh public release metadata for external macro sources.

Important: this monitor intentionally does not download or republish Global Macro
Database numerical series. It only observes public release/repository metadata so
CF Investing can link users to the upstream source while respecting GMD terms.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "public" / "data" / "macro-sources.json"
GMD_HOME = "https://www.globalmacrodata.com/"
GMD_COMMITS = "https://api.github.com/repos/KMueller-Lab/Global-Macro-Database/commits?per_page=1"
UA = "CFInvesting-SourceMonitor/1.0 (+https://cfinvesting.com/)"


def fetch_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/json"})
    with urlopen(req, timeout=25) as response:
        return response.read().decode("utf-8", errors="replace")


def main() -> int:
    payload = json.loads(TARGET.read_text(encoding="utf-8"))
    source = payload["sources"][0]
    changed = False

    home = fetch_text(GMD_HOME)
    match = re.search(r"Latest release\s*[–-]\s*v(\d{4}_\d{2})", home, re.IGNORECASE)
    if not match:
        match = re.search(r"v(\d{4}_\d{2})", home)
    if match and source.get("current_release") != match.group(1):
        source["current_release"] = match.group(1)
        changed = True

    commits = json.loads(fetch_text(GMD_COMMITS))
    if commits:
        commit = commits[0]
        sha = commit.get("sha")
        commit_date = (((commit.get("commit") or {}).get("committer") or {}).get("date")
                       or ((commit.get("commit") or {}).get("author") or {}).get("date"))
        if sha and source.get("latest_upstream_commit") != sha:
            source["latest_upstream_commit"] = sha
            changed = True
        if commit_date and source.get("latest_upstream_commit_date") != commit_date:
            source["latest_upstream_commit_date"] = commit_date
            changed = True

    if changed:
        payload["updated_at"] = date.today().isoformat()
        TARGET.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("macro-source metadata updated")
    else:
        print("macro-source metadata unchanged")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
