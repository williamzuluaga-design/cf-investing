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
- Static assets directory: `./public`
- Observability: enabled
- Git integration: changes merged to `main` are intended to trigger the Cloudflare build/deploy flow

The root domain is canonical. Deployment status should be verified in Cloudflare before treating a Git commit as publicly live.

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
