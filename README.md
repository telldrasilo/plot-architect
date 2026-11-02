# Plot Architect / Graphite — private development source

**Local baseline:** Graphite v0.13.5-alpha / UX-016, 2026-11-01.  
**Hosted Site:** private v4 is LIVE (deployment `appgdep_6ae8284035b48191a6603d203cd6def5`). **This repository is still a local development source, not an exact hosted source mirror.** See `docs/PA_RELEASE_A_V4_RELEASE_RESULT.md`.

This repository packages the reproducible local Graphite editor and the Site/MCP candidate code for review and testing. It must **not** be deployed verbatim to the existing production Site: the live source, owner-only access, MCP bindings and D1 must first be inspected and reconciled.

## Platform-native-first rule

**Do not reinvent a workflow already provided by the platform.** Use GitHub PR/CI for code, official OpenAI Sites/Vite tooling for build, and ChatGPT Sites' built-in **Save version → Deploy version** for releases of the existing Site. Reuse hosted D1, MCP, native owner identity, sharing and saved versions. Do not create a parallel hosting/preview/auth/deployment stack or require undocumented internal platform invariants. Keep only concrete release checks, especially unintended D1 migrations or binding replacement. See `AGENTS.md` and `docs/RELEASE_POLICY.md`.

**Actual hosted baseline:** private v4 is deployed. For the next patch follow **`docs/RELEASE_POLICY.md` → «Постоянный сценарий выпуска обычного патча»**, not the historical Release A save/deploy handoffs. The v4 release evidence is in `docs/PA_RELEASE_A_V4_RELEASE_RESULT.md`.

## Layout

- `site/`: local development code (`src/`, `public/`, `db/`, `drizzle/`, test and build scripts).
- `qa/browser/`: preserved local browser regression tests.
- `docs/RELEASE_POLICY.md`: **one canonical patch-release scenario**, Site/MCP separation, Work budget and D1 safety.
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

For releases: use the single canonical routine in `docs/RELEASE_POLICY.md`: GitHub branch → PR → CI → merge; review the narrow patch against the live Site; native Sites Save version → owner-approved Deploy version → targeted post-deploy acceptance. Never treat this local repo as an exact hosted source mirror.