# Global Macro Database integration

CF Investing registers the Global Macro Database (GMD) as an external macroeconomic research source and monitors its public release/repository metadata.

## Upstream sources

- Website: https://www.globalmacrodata.com/
- Explore: https://www.globalmacrodata.com/explore.html
- Documentation: https://www.globalmacrodata.com/documentation.html
- Research Use Terms: https://www.globalmacrodata.com/license.html
- Main repository: https://github.com/KMueller-Lab/Global-Macro-Database
- Python repository: https://github.com/KMueller-Lab/Global-Macro-Database-Python

## Current integration

`public/data/macro-sources.json` contains source metadata used by the Research pages. `scripts/update_macro_sources.py` checks the official GMD homepage and upstream GitHub repository for release/repository changes. The scheduled workflow `.github/workflows/macro-sources.yml` runs weekly and commits changes only when upstream metadata changes.

This integration is intentionally metadata-only. It does **not** download, cache, mirror, transform, or publish GMD numerical series.

## Rights boundary

The GMD Research Use Terms state that the public dataset is for academic and non-profit research and prohibit commercial use and republication of GMD data on another website, API, platform, product, model, index or signal without explicit written approval. They also say to contact the project if the intended use falls outside those terms.

The GMD terms distinguish reusable helper code from the data: reusable helper functions may be MIT-licensed in the relevant repository, but the GMD numerical data remain governed by the Research Use Terms. The Python package repository itself carries an MIT software license. A permissive code license therefore does not grant CF Investing permission to republish GMD data.

## Enabling numerical ingestion later

Do not set `data_ingest_enabled` to `true` unless CF Investing has written authorization that covers the intended public/product use. Once permission exists, the preferred technical route is:

1. record the permission scope and attribution requirements in this document;
2. pin a GMD release/version for reproducibility;
3. ingest only the minimum required variables/countries;
4. store provenance, vintage, units and GMD citation with every derived output;
5. separate observed GMD values from CF Investing calculations or interpretations;
6. update CF Pulse/QCMO only after source review and validation;
7. retain a direct link to the upstream GMD source and do not imply endorsement.

## Permission request scope

A request to GMD should explicitly ask whether CF Investing may use selected macroeconomic series in a publicly accessible financial-intelligence website, including charts, derived indicators and executive signals, and whether future monetization or institutional subscriptions would require a separate commercial license. Contact listed by GMD: kmueller@globalmacrodata.com.
