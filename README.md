# Plot Architect / Graphite — private development source

**Local baseline:** Graphite v0.13.5-alpha / UX-016, 2026-11-01.  
**Hosted Site:** private v4 is LIVE (deployment `appgdep_6ae8284035b48191a6603d203cd6def5`). **This repository is still a local development source, not an exact hosted source mirror.** See `docs/PA_RELEASE_A_V4_RELEASE_RESULT.md`.

This repository packages the reproducible local Graphite editor and the Site/MCP candidate code for review and testing. It must **not** be deployed verbatim to the existing production Site: the live source, owner-only access, MCP bindings and D1 must first be inspected and reconciled.

## Platform-native-first rule

**Do not reinvent a workflow already provided by the platform.** Use GitHub PR/CI for code, official OpenAI Sites/Vite tooling for build, and ChatGPT Sites' built-in **Save version → Deploy version** for releases of the existing Site. Reuse hosted D1, MCP, native owner identity, sharing and saved versions. Do not create a parallel hosting/preview/auth/deployment stack or require undocumented internal platform invariants. Keep only concrete release checks, especially unintended D1 migrations or binding replacement. See `AGENTS.md` and `docs/RELEASE_POLICY.md`.

As of 2026-11-02 a saved **v4** Sites candidate exists while **v3** remains live; its owner-only private deployment is user-authorized **subject to native preflight**. See `docs/PA_RELEASE_A_V4_PREDEPLOY_GATE.md` before asking Sites to deploy that exact saved version.

## Layout

- `site/`: local development code (`src/`, `public/`, `db/`, `drizzle/`, test and build scripts).
- `qa/browser/`: preserved local browser regression tests.
- `docs/RELEASE_POLICY.md`: staging, Site/MCP separation, Work budget, D1 restrictions.
- `docs/RELEASE_MANIFEST.json`: frozen baseline and test evidence.
- `docs/WORK_RELEASE_A.md`: draft Work handoff for compatible UI changes only.
- `AGENTS.md`: binding instructions for agents touching this repository.

## Local build modes (Node 22.13+)

The default `site/npm run build` and `site/npm run dev` now use the verified Sites Vite adapter. `npm run build:legacy` and `npm run dev:legacy` retain the previous custom bundle and Wrangler QA loop for regression/rollback. The Sites/Vite adapter was included in the hosted private v4 release. Local Wrangler test configuration is not production binding metadata. See `docs/PA_SITES_VITE_ADAPTER.md`.

## Local checks (Node 22.13+)

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