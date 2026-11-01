# Sites adaptation · 2026-11-01

The supplied Graphite v0.9 UI and graph contract are retained. The official Worker ESM deployment layout is used: dist/server/index.js exports default.fetch and contains the HTML and server code; no ASSETS binding or provisioned D1 UUID is hard-coded. .openai/hosting.json declares DB and r2:null. Sites provisions hosted DB and applies packaged drizzle migrations when deploying. db/0001_initial.sql and drizzle/0001_initial.sql are byte-identical.

## Authentication candidate

PLOT_PRIVATE_TOKEN was replaced by Sites dispatch identity. Every project API call and HTML root require oai-authenticated-user-id. Native Sites policy is verified owner-only: custom access, one owner, zero groups/editors/external visitors. Shared bearer tokens are rejected. Mutations reject cross-origin Origin headers. No secrets, API keys, external model calls, or new plugins are needed.

This boundary requires the hosted dispatcher. Unit/workerd identity headers are synthetic and do NOT prove real ChatGPT sign-in or header-spoofing resistance. The candidate must not be called fully verified until live owner and anonymous access are tested.

## Local preview

Use npm ci, npm run build, then sites-preview start with this checkout. The dev script accepts the daemon --port argument. A clearly labelled local QA entry at /__qa/signin simulates dispatch identity using a non-secret local QA cookie. It is only in scripts/preview-worker.mjs, NOT in dist/server/index.js or the deployment artifact. All incoming identity headers are stripped in this local harness. Local QA is not production authentication. The migration is applied once via the Wrangler ledger; the local database is separate from hosted D1.

## Client

The client connects automatically via same-origin native identity. The last active Site project is restored after reload. Standalone file mode stays local. Original pending-write and revision-conflict guards remain. A pending or conflicting copy can be exported and imported as a separate project for manual reconciliation. No silent server overwrite is allowed.

## Verification

Current reproducible checks: npm run check; npm run build; node scripts/validate-artifact.mjs; npm test. Tests include real workerd + local D1 persistence across isolate restart, migration idempotence, API lifecycle, immutable history, restore, stale revision conflict, anonymous rejection, legacy-bearer rejection, and cross-origin rejection. docs/input-baseline-tests contains historical input tests/results, not evidence for this changed version.

Browser QA used actual Sites local preview and real navigation/reload, with local D1, not mocked HTTP or page.set_content. Hosted D1 and real ChatGPT access remain a separate gate.
