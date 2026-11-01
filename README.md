# Plot Architect / Graphite — private development source

**Local baseline:** Graphite v0.13.5-alpha / UX-016, 2026-11-01.  
**Deployment state:** LOCAL ONLY. **This repository is not a mirror of the current hosted Site source.**

This repository packages the reproducible local Graphite editor and the Site/MCP candidate code for review and testing. It must **not** be deployed verbatim to the existing production Site: the live source, owner-only access, MCP bindings and D1 must first be inspected and reconciled.

## Layout

- `site/`: local development code (`src/`, `public/`, `db/`, `drizzle/`, test and build scripts).
- `qa/browser/`: preserved local browser regression tests.
- `docs/RELEASE_POLICY.md`: staging, Site/MCP separation, Work budget, D1 restrictions.
- `docs/RELEASE_MANIFEST.json`: frozen baseline and test evidence.
- `docs/WORK_RELEASE_A.md`: draft Work handoff for compatible UI changes only.
- `AGENTS.md`: binding instructions for agents touching this repository.

## Local checks (Node 22+)

```bash
cd site
npm ci
npm run check
npm run check:v2
npm run test:local
npm run build
```

`npm test` also attempts `workerd-integration.test.mjs`, which needs a separate real Workers/D1 test environment; local `test:local` does **not** establish hosted D1 correctness. Browser scripts require Python/Playwright and a browser environment and are separate from CI.

No GitHub Actions job has deployment credentials or deploy permissions. The CI workflow is test-only.

For releases: keep each UI patch in a pull request; merge into `main` only after review and checks. The first Site deployment must explicitly compare against the real current hosted source; do not assume this code is its baseline.