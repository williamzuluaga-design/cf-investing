# Beehiiv integration — CF Investing

## Architecture

`CF Investing form -> /api/newsletter/subscribe -> Cloudflare Worker -> Beehiiv API`

The browser never receives the Beehiiv API key.

## Publication

- Publication ID: `pub_84f3b627-2b28-47c6-9b63-87595841f5b1`
- API endpoint used by the Worker: `POST /v2/publications/:publicationId/subscriptions`
- Double opt-in is forced on by the Worker.
- Existing unsubscribed contacts are **not** automatically reactivated.

## Cloudflare secret required before activation

In Cloudflare:

1. Open **Workers & Pages**.
2. Open Worker **cf-investing**.
3. Open **Settings -> Variables and Secrets**.
4. Add a **Secret** named exactly `BEEHIIV_API_KEY`.
5. Paste the Beehiiv API key created for the CF Investing integration.
6. Save/deploy the setting.

Never place the Beehiiv API key in GitHub, `wrangler.jsonc`, client-side JavaScript, HTML, screenshots, issues, logs or documentation.

The publication ID is not a credential and is stored as the Wrangler variable `BEEHIIV_PUBLICATION_ID`.

## Current endpoint contract

`POST /api/newsletter/subscribe`

JSON request:

```json
{
  "email": "reader@example.com",
  "language": "es",
  "source": "home",
  "interest": "general",
  "company_website": ""
}
```

Allowed language values:

- `en`
- `es`

Supported source values:

- `home`
- `research`
- `projects`
- `sustainable`
- `tools`
- `education`
- `institutional`

Supported interest values:

- `general`
- `markets`
- `projects-capital`
- `sustainable-finance`
- `education`

The `company_website` field is a honeypot and must remain empty for normal users.

## Beehiiv acquisition mapping — v1

Until publication custom fields are explicitly created and validated, acquisition context is stored with standard Beehiiv UTM fields:

- `utm_source = cfinvesting.com`
- `utm_medium = website`
- `utm_campaign = source`
- `utm_term = interest`
- `utm_content = language`

This avoids silently depending on custom fields that may not yet exist in Beehiiv.

## Public form activation gate

Do not expose a production subscription form until all of the following are complete:

1. `BEEHIIV_API_KEY` exists as a Cloudflare Secret.
2. A controlled test subscription succeeds.
3. Privacy and terms pages are available in EN and ES.
4. The form clearly states what the subscriber will receive and that confirmation is required.
5. Basic anti-abuse protection is reviewed before broader promotion; Cloudflare Turnstile is the preferred next layer if spam becomes material.

## Next enhancement

After the basic flow is validated, create publication custom fields in Beehiiv for `Language`, `Interest` and `Source`. Only then update the Worker payload to send `custom_fields`, and use those fields for dynamic segments.
