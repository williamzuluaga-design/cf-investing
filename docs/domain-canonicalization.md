# CF Investing — domain canonicalization

Observed from GitHub Actions on 2026-09-02.

## Current live behavior

Canonical domain:

- `https://cfinvesting.com/` → **200 OK**
- `https://www.cfinvesting.com/` → **301** → `https://cfinvesting.com/`
- `http://cfinvesting.com/` → **200 OK** (should redirect to HTTPS)
- `http://www.cfinvesting.com/` → **200 OK** (should redirect to HTTPS canonical root)
- `https://cfinvesting.com/robots.txt` → **200 OK**
- `https://cfinvesting.com/sitemap.xml` → **200 OK**

Legacy/defensive domain:

- `https://cfinvestings.com/` → **200 OK** on the legacy hostname
- `https://www.cfinvestings.com/` → **301** → `https://cfinvestings.com/`
- `http://cfinvestings.com/` → **200 OK**
- `http://www.cfinvestings.com/` → **301** → `http://cfinvestings.com/`
- `https://cfinvestings.com/research/` → **404**

This means the canonical HTTPS site is healthy, but HTTP traffic is not forced to HTTPS and the legacy domain is still a competing web host rather than a path-preserving redirect.

## P0 Cloudflare change 1 — force HTTPS

For the `cfinvesting.com` zone, enable **SSL/TLS → Edge Certificates → Always Use HTTPS**.

Do the same for `cfinvestings.com` if that zone remains active in Cloudflare. This should turn HTTP requests into HTTPS before they reach the application.

Do not change MX, SPF, DKIM or DMARC records as part of this work.

## P0 Cloudflare change 2 — redirect legacy domain to canonical domain

In the `cfinvestings.com` zone create a **Single Redirect** using a wildcard pattern.

Incoming request URL:

`http*://cfinvestings.com/*`

Target URL:

`https://cfinvesting.com/${2}`

Settings:

- Status: **301 Permanent Redirect**
- Preserve query string: **Enabled**

Create the equivalent redirect for the `www` hostname if it is not already normalized before this rule:

Incoming request URL:

`http*://www.cfinvestings.com/*`

Target URL:

`https://cfinvesting.com/${2}`

- Status: **301**
- Preserve query string: **Enabled**

Expected examples after configuration:

- `https://cfinvestings.com/` → `https://cfinvesting.com/`
- `https://www.cfinvestings.com/` → `https://cfinvesting.com/`
- `https://cfinvestings.com/research/` → `https://cfinvesting.com/research/`
- `http://cfinvestings.com/projects/?x=1` → `https://cfinvesting.com/projects/?x=1`

## Verification

The repository contains `scripts/live_domain_check.py`. The GitHub workflow runs it automatically and will report whether secure canonical URLs remain available and whether HTTP/legacy redirects are correct.

Until the Cloudflare changes are applied, HTTP and legacy-domain gaps are warnings rather than blocking CI failures.

## Important constraint

The redirect project concerns web traffic only. If `cfinvestings.com` is later used for email, keep the email-related DNS records intact. Web redirects do not require removing MX records.

## Cloudflare references

- Always Use HTTPS: https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/
- Redirect requests to a different hostname: https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-all-different-hostname/
