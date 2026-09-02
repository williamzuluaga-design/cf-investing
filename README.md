# CF Investing

**Capital, Finance & Investment Intelligence**

Public web platform for applied financial research, markets, sustainable finance, project intelligence, decision tools and educational experiences.

## Brand architecture

CF supports four core finance lenses:

- **Corporate Finance** — value, funding and financial decisions.
- **Climate Finance** — capital for transition and resilience.
- **Catalytic Finance** — risk-sharing structures that can mobilize additional capital.
- **Capital Formation** — turning opportunities into better-prepared, financeable projects.

## Public site structure

- Research / QCMO
- Sustainable Finance
- Project Intelligence
- Financial Tools
- Education
- Methodology & Trust

The public UX follows a progressive-disclosure rule: keep the first decision simple and expose technical depth only when users need it.

## Deployment

The production site uses a **Cloudflare Worker with Static Assets**, connected to this GitHub repository and served at:

`https://cfinvesting.com`

Current deployment configuration is defined in `wrangler.jsonc`:

- Worker: `cf-investing`
- Production branch: `main`
- Worker entry point: `./src/worker.js`
- Static assets directory: `./public`
- Static assets binding: `ASSETS`
- Worker-first routes: `/api/*`
- Observability: enabled
- Git integration: changes merged to `main` are intended to trigger the Cloudflare build/deploy flow

The root domain is canonical. Deployment status should be verified in Cloudflare before treating a Git commit as publicly live.

## Newsletter backend

CF Investing is prepared for an API-first Beehiiv integration:

`CF Investing -> /api/newsletter/subscribe -> Cloudflare Worker -> Beehiiv API`

The Beehiiv publication ID is stored as a non-secret Wrangler variable. The API credential must exist only as the Cloudflare Secret `BEEHIIV_API_KEY`; it must never be committed to GitHub or exposed in client-side code.

The first version records acquisition context with Beehiiv UTM fields and forces double opt-in. It does not automatically reactivate previously unsubscribed contacts.

See `docs/beehiiv-integration.md` for the setup and activation gate. The public newsletter form should remain unexposed until the Cloudflare secret, controlled API test and privacy/terms requirements are complete.

## Project Intelligence operations

Project Intelligence uses separate operational layers for:

- source discovery;
- source freshness monitoring;
- human review;
- normalized published project records.

Automated discovery or monitoring signals do **not** publish or change material project facts automatically. Primary-source review remains required.

## Repository policy

The MIT license applies to repository code unless otherwise stated. Editorial content, research outputs, datasets, educational materials, trademarks and third-party assets may be subject to separate rights and licenses.

## Disclaimer

CF Investing provides research, educational and analytical information. Nothing published on the site constitutes personalized investment advice, brokerage activity, a financing commitment or an offer or solicitation to buy or sell securities.
