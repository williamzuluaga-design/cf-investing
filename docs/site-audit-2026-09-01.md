# CF Investing — commercial & technical site audit

Date: 2026-09-01

## Scope

Primary product site: `https://cfinvesting.com/`

Legacy/defensive domain to test separately: `https://www.cfinvestings.com/`

The repository currently declares `cfinvesting.com` as the canonical host in page metadata, robots and sitemap. The two domains should not operate as competing indexable sites. If the legacy domain remains in use, its preferred role is a path-preserving 301 redirect to the canonical host after DNS/SSL and email dependencies are confirmed.

## Current technical baseline

- Production assets are under `./public` and served through the Cloudflare Worker static-assets configuration.
- Obsolete root-level copies of the old site, stylesheet, JavaScript, robots and sitemap were removed.
- The superseded discovery script and the legacy project-source registry were removed.
- A static `Site quality gate` now checks deployable HTML, canonical host, duplicate canonicals, local links/assets, sitemap routes, robots configuration and stale references on every push/PR to `main`.
- The first quality-gate run completed successfully.
- Source monitoring/discovery remain evidence operations; their outputs must not be treated as commercial claims without human review.

## Commercial review

### P0 — define one conversion event

The homepage is now intentionally simple, but every primary CTA currently navigates deeper into the site. Before adding more content, choose one measurable business conversion for organizations: for example request a research brief, join an institutional update list, or request a Project Intelligence conversation. Do not add a form until privacy, consent, storage and response ownership are defined.

### P0 — keep the value proposition decision-oriented

The strongest positioning is not “more financial content.” It is a structured path from evidence to a better financial decision. Keep the four entry questions, but make each destination answer one concrete user job and one next step.

### P1 — add proof before promotion

Use evidence already native to the product: source provenance, update dates, methodology, primary-source links, number of reviewed records and clearly labeled analytical assumptions. Avoid generic testimonials or partner logos unless permission and evidence exist.

### P1 — productize the organizational offer

The current architecture supports a future commercial ladder without turning the site into an investment marketplace:

1. open research / QCMO;
2. free analytical tools;
3. recurring Project or Sustainable Finance intelligence;
4. institutional research, education or analytical services.

Pricing and lead capture should wait until the first paid use case and buyer are validated.

### P1 — distinguish audiences without rebuilding the homepage

Preserve the simple question-led homepage. On destination pages, make it obvious whether the page is mainly for individuals, finance professionals, project sponsors or capital providers. This reduces ICP ambiguity without adding another navigation layer.

### P2 — create a measured acquisition loop

Once privacy/legal basics are in place, instrument a small funnel: landing page → research/tool use → subscription/contact intent. Use Search Console plus lightweight analytics before adding paid acquisition.

## Technical review

### P0 — domain canonicalization

Verify that `cfinvesting.com` is the only indexable canonical host. Test all four host variants (`http/https`, `www/non-www`) and the legacy `cfinvestings.com` variants. Redirect legacy traffic path-for-path where appropriate. Do not change mail-related DNS records as part of a web redirect project.

### P0 — indexing and discoverability

Submit the canonical domain property and `https://cfinvesting.com/sitemap.xml` in Google Search Console. The sitemap already covers English and Spanish routes. Monitor coverage before making conclusions from search-result absence.

### P1 — social/brand metadata

Add a favicon, a consistent social-preview image, `og:image`, Twitter card metadata and stable page-level sharing metadata. This is a relatively small implementation with visible brand impact.

### P1 — structured data

Add conservative JSON-LD where facts are known: `WebSite` at the root and, later, `Article`/`Dataset` only on pages that actually meet those definitions. Do not invent organization identifiers, addresses, ratings or authorship.

### P1 — accessibility and mobile regression checks

The current navigation remains scrollable on small screens. Add automated accessibility/performance checks only after the static quality gate is stable; prioritize keyboard focus, heading order, contrast and mobile tap targets.

### P1 — legal/data layer before collection

Create privacy/terms/consent mechanics before activating newsletter, forms, accounts or analytics that require consent. Keep the current browser-local analytical tools data-minimal in the meantime.

### P2 — analytics

Start with Cloudflare Web Analytics or another lightweight first-party-friendly setup. Add GA4 only when there is a clear measurement plan. Track a small set of events tied to the chosen conversion goal rather than every click.

## External AI audit agent

Recommended: **SureThing — AI Website Audit Agent**.

Why it fits CF Investing: it renders a public URL in a browser and reviews SEO, sitemap/robots, performance, mobile, accessibility, design/UX, content/messaging, tracking and technical health. It also ranks fixes by impact × effort and explicitly includes positioning/ICP mismatch and growth recommendations, so it covers both technical and commercial questions.

Run it first on `https://cfinvesting.com/`. Run a second audit on `https://www.cfinvestings.com/` only to validate redirect/legacy-domain behavior rather than as a separate content property.

Suggested audit brief:

> Review CF Investing as an evidence-first financial-intelligence platform for individuals and organizations. The site is informational, research and educational; it does not execute investments or financing transactions. Prioritize recommendations that improve commercial clarity, trust, qualified lead intent, SEO/indexability, mobile UX, accessibility and technical reliability. Flag anything that makes the product look like an unregulated investment marketplace or creates unsupported financial claims.

## Decision rule for the next iteration

Do not add another public feature page until the following are resolved or consciously deferred: canonical-domain test, external audit, Search Console/indexing setup, one conversion goal, social metadata, privacy/data-collection decision and review of the external auditor's top five recommendations.
