# CF Pulse — operating model

CF Pulse is the executive signal layer on the CF Investing homepage. It deliberately shows exactly three signals:

1. Markets
2. Capital signal
3. Events radar

The product rule is `Signal → Evidence → Why it matters`. CF Pulse is not a trading feed, recommendation engine or investment-advice product.

## Semi-automatic architecture

`public/data/pulse-inputs.json` contains human-reviewed market facts and official future event dates.

`public/data/projects.json` is the reviewed Project Intelligence dataset.

`scripts/build_executive_pulse.py` combines both sources and writes `public/data/executive-pulse.json`.

The builder automatically:

- keeps the visible product to exactly three signals;
- selects the latest source-reviewed Project Intelligence case with a disclosed financing amount for the Capital signal;
- removes events after their end date and promotes the next reviewed dates;
- carries source links into the output;
- marks the Pulse for review when reviewed market inputs expire or when no future reviewed events remain;
- avoids inventing live market values or scraping unsupported facts.

## Workflow

`.github/workflows/executive-pulse.yml` runs daily and can also be run manually. It additionally runs when its reviewed inputs, project dataset or builder change.

If the generated JSON changes, the workflow commits only `public/data/executive-pulse.json`.

If reviewed inputs are stale, it opens at most one issue titled `CF Pulse review required` so a human can refresh official facts and dates.

## Editorial boundary

Automation selects and formats evidence; it does not decide whether an unreviewed source is true, infer a market recommendation, predict prices, or auto-publish Project Discovery candidates. Market facts and future official events remain reviewed inputs.

## Updating the Pulse

For a normal review cycle:

1. Verify the current policy-rate / executive market facts against the primary sources already listed or other approved primary sources.
2. Update the bilingual market fields, `reviewed_at` and `valid_through` in `public/data/pulse-inputs.json`.
3. Add or remove future decision-relevant events using official dates and source links.
4. Do not manually choose the Capital signal unless the automatic Project Intelligence selection is unsuitable; improve the reviewed project dataset instead.
5. Commit the input update. The Executive CF Pulse workflow will rebuild the output.

## Product constraint

Do not expand CF Pulse beyond three visible signals on the homepage. If more information becomes valuable, place it behind a dedicated brief, watchlist or deeper Research / Project Intelligence route rather than adding another homepage dashboard row.
