# Plot Architect · Graphite · Sites candidate

Private owner-only story graph editor adapted from PA_SITE_01_FIRST_WORKING_PRODUCT_20261101(1).zip. No paid model API. No Xianxia Master, Campaign Vault or other plugins are changed.

## Current state

Registered Site: appgprj_6ae715d7cccc8191bc35fbcd5255d9ce. Owner-only access policy verified. Source and deployment package are prepared for a saved review version. Hosted publication is gated by the original handoff requirement for successful hosted/private checks before publication. Local QA is not proof of hosted D1 or ChatGPT authentication. See docs/SITES_ADAPTATION.md and the delivery report for exact completed and blocked checks.

## Build and tests

Node 24 or newer (uses node:sqlite in tests). Run npm ci, npm run check, npm run build, node scripts/validate-artifact.mjs, npm test. The eight tests include workerd and a fresh local D1 with migration replay, persistence, API lifecycle, revision conflicts and authorization rejection. Tests create their own temporary database and do not modify hosted data.

## Local preview

Run npm run build, then sites-preview start /absolute/path/to/checkout. Use the exact returned URL. The local landing page identifies the QA session; Open QA editor enables a local test identity. The local DB persists in .wrangler/state. This is not real ChatGPT login.

## Hosting

Use the Sites source workflow helper to push this checkout and package dist. The manifest declares d1:DB and r2:null. The bundled Worker is dist/server/index.js; HTML is embedded, no ASSETS binding is needed. drizzle/0001_initial.sql is byte-identical to db/0001_initial.sql, with a journal for one hosted migration. Sites provisions hosted D1 during deployment. No Cloudflare database ID is invented in the hosted config.

Authentication uses the verified owner-only Sites access policy plus native oai-authenticated-user-id supplied by dispatch. No PLOT_PRIVATE_TOKEN is required or saved. Never deploy this candidate to a shared or public Site. Publish only the reviewed saved version with the owner-private operation after satisfying or explicitly changing the handoff gate.

## Editor

Graphite v0.9, free movement, fields, precise links, focus, minimap, aggregate bridges and undo are retained. Multiple server projects, autosave, revision conflicts, additive JSON import/export, and local recovery copies are supported. Reload restores the last active server project. A failed or conflicting sync retains the local copy; export then import creates an independent recovery project for manual reconciliation.

Original input documentation: docs/INPUT_README.md and docs/SITES_HANDOFF.md. Historical mocked browser tests/results: docs/input-baseline-tests. They are not current validation evidence.
