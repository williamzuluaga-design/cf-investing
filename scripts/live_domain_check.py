#!/usr/bin/env python3
"""Live public-domain checks for CF Investing.

Canonical-host failures are blocking errors. Legacy-domain redirect gaps are
reported as warnings until the defensive domain is intentionally configured.
No DNS or hosting changes are made by this script.
"""

from __future__ import annotations

import json
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, HTTPSHandler

CANONICAL_HOST = "cfinvesting.com"
UA = "CFInvesting-LiveDomainCheck/1.0"
TIMEOUT = 20


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = build_opener(NoRedirect, HTTPSHandler(context=ssl.create_default_context()))


def once(url: str) -> tuple[int | None, str | None, str | None]:
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*;q=0.8"})
    try:
        with opener.open(req, timeout=TIMEOUT) as resp:
            return resp.status, resp.headers.get("Location"), None
    except HTTPError as exc:
        return exc.code, exc.headers.get("Location"), None
    except URLError as exc:
        return None, None, str(exc.reason)
    except Exception as exc:
        return None, None, str(exc)


def trace(url: str, limit: int = 6) -> dict:
    current = url
    chain = []
    seen = set()
    for _ in range(limit):
        if current in seen:
            return {"start": url, "chain": chain, "final_url": current, "error": "redirect loop"}
        seen.add(current)
        status, location, error = once(current)
        chain.append({"url": current, "status": status, "location": location, "error": error})
        if error or status is None:
            return {"start": url, "chain": chain, "final_url": current, "error": error or "request failed"}
        if status in {301, 302, 303, 307, 308} and location:
            current = urljoin(current, location)
            continue
        return {"start": url, "chain": chain, "final_url": current, "final_status": status, "error": None}
    return {"start": url, "chain": chain, "final_url": current, "error": "too many redirects"}


def canonical_ok(result: dict, expected_path: str = "/") -> bool:
    if result.get("error") or result.get("final_status") not in {200, 204}:
        return False
    parsed = urlsplit(result.get("final_url", ""))
    return parsed.scheme == "https" and parsed.netloc == CANONICAL_HOST and parsed.path == expected_path


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    checks = []

    canonical_variants = [
        ("https://cfinvesting.com/", "/"),
        ("http://cfinvesting.com/", "/"),
        ("https://www.cfinvesting.com/", "/"),
        ("http://www.cfinvesting.com/", "/"),
    ]
    for url, expected_path in canonical_variants:
        result = trace(url)
        checks.append(result)
        if not canonical_ok(result, expected_path):
            errors.append(f"canonical variant did not resolve to https://{CANONICAL_HOST}{expected_path}: {url}")

    for path in ("/robots.txt", "/sitemap.xml"):
        url = f"https://{CANONICAL_HOST}{path}"
        result = trace(url)
        checks.append(result)
        if not canonical_ok(result, path):
            errors.append(f"canonical public asset unavailable: {url}")

    legacy_variants = [
        ("https://cfinvestings.com/", "/"),
        ("https://www.cfinvestings.com/", "/"),
        ("http://cfinvestings.com/", "/"),
        ("http://www.cfinvestings.com/", "/"),
        ("https://cfinvestings.com/research/", "/research/"),
    ]
    for url, expected_path in legacy_variants:
        result = trace(url)
        checks.append(result)
        if not canonical_ok(result, expected_path):
            warnings.append(
                f"legacy domain is not yet path-preserving to https://{CANONICAL_HOST}{expected_path}: {url}"
            )

    print(json.dumps({"errors": errors, "warnings": warnings, "checks": checks}, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
