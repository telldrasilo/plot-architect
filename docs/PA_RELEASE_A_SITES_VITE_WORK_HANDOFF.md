# PA-RELEASE-A — one-pass Sites Vite v3 candidate handoff

**RELEASE ROUTE UPDATE (2026-11-02):** Prior preview and mock-login tasks are complete/blocked by a deliberate upstream host restriction. Do not rerun this handoff. To save a candidate without deployment use [PA_RELEASE_A_SAVE_CANDIDATE_ONLY.md](./PA_RELEASE_A_SAVE_CANDIDATE_ONLY.md) with explicit host D1 binding verification.

**POST-WORK UPDATE — 2026-11-02:** The seven-file overlay and Vite preview succeeded, but Work stopped at `HOSTED_ACCESS_UNVERIFIED` because no local test sign-in was performed. Review [PA_RELEASE_A_PREVIEW_AUTH_QA.md](./PA_RELEASE_A_PREVIEW_AUTH_QA.md) before any further Work task. Official Vite mock login is supported in `vite dev` and verified in GitHub CI, but it **does not** verify real owner identity. Do not rerun the previous handoff verbatim; no source version was saved.

**Status:** PREPARED, NOT EXECUTED. This document is **not** a deployment approval.
**Target existing private Site:** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`.
**Only eligible baseline:** saved/deployed version **3**, source commit `f4ab5397ea2ac7e5b1c6804ae5a169acc7468089`, deployment `appgdep_6ae72bc3affc8191bb43ff3843cf616e`.
**Source archive (ChatGPT Library):**
`/Планировщик сюжета/Development/04_Hosted_and_MCP/PA_SITES_VITE_V3_WORK_READY_20261102/PA_SITES_VITE_V3_WORK_READY_20261102.zip`
**ZIP SHA-256:** `490f5b598febeee584b6a535b96d40bd95a01d54b450a05aaa920c8cebf5454c`.
Read `README_FIRST.md`, `RELEASE_MANIFEST.json`. Use **only** `site_source/` in this archive. Do not substitute the experimental compiled CI ZIP (its Cloudflare config has dummy local D1 ID).

## Authorized scope ONLY if the owner explicitly starts the Work task

1. **Read-only drift gate:** confirm current *saved source and deployed source* are still the captured v3. Compare exactly 43 baseline file hashes to the captured source manifest, without reading database rows or story content. Check owner-only policy, D1 binding name `DB`, six MCP tool names/schemas. If metadata or any file changed, STOP `SOURCE_DRIFT_BLOCKED`; do not conduct a forensic analysis.
2. **Minimal overlay in the existing Site worktree:** apply exactly seven manifest-listed changed/new files. They are: `src/editor.js`, `public/index.html`, `package.json`, `package-lock.json`, `src/sites-vite-entry.mjs`, `sites-vite-compat/vite.config.mjs`, `wrangler.sites.jsonc`. Do not change or delete the other **39 original files**. Verify SHA-256 of all **46** post-overlay source files. Preserve the hosted `src/mcp_server.mjs` with protocol `2026-07-28` and `server/discover`, hosted auth, existing `.openai/hosting.json` (including MCP capabilities), Drizzle migration, REST and D1 connection byte-for-byte.
3. **Build:** from Site source root, use the pinned lockfile and `npm ci --include=dev --no-audit --no-fund` only if dependencies are not already correctly installed in the environment that will launch preview. Run `npm run check` and `npm run build`. Confirm output `dist/server/index.js`, `dist/.openai/hosting.json`, migrations and correct `DB` binding. `npm run dev` must run **Vite**, not `dev:legacy` and not `scripts/preview.mjs`. Never run global `wrangler`, update dependencies, create a new Site or change application runtime code. If the platform does not provision dependencies for its own preview runtime, STOP without workaround.
4. **One preview attempt only:** run the supported `sites-preview start` against this existing Site worktree with the new default Vite dev entry. The source Vite config explicitly permits the Sites preview hostname and the Vite command accepts `--host 0.0.0.0 --port 4173 --strictPort`. Use the platform preview browser to inspect the rendered Graphite UI, UX-013 menu/tooltip, UX-014 inspector, UX-015 zoom and UX-016 compact/map drag. Validate first-connect blank project, reload, editable notes/fields, 409 recovery, MCP discovery and anonymous API 401 as far as supported by a *private synthetic preview*. **Do not claim simulated identity or local D1 validates production identity/D1.** If the preview cannot start or the browser cannot verify it, STOP `PREVIEW_ENV_BLOCKED`. Do not retry the old Wrangler script.
5. **Data firewall:** no reading, dumping, backing up, restoring, migrating, modifying or deleting existing stories. Any write/readback must use a brand-new synthetic graph in a verifiably isolated **preview-only** database. If preview is connected to production D1 or isolation cannot be verified, **do not write**; report `D1_ISOLATION_BLOCKED`. No D1 schema migration or existing row changes.
6. **Source candidate, not a deployment:** only if every applicable predeploy gate passes, save **one source version-candidate of the existing Site** if saving can be done without publishing/deploying and without altering real D1 or the plugin. If saving itself deploys or the release mechanism would consume the **dummy local database ID** from `wrangler.sites.jsonc`, STOP `CANDIDATE_SAVE_UNSAFE`. Never deploy, publish or edit plugin/access/MCP tool schema. Report version ID if saved, otherwise exact stop code.

## Do not repeat earlier work

Prior v3 hash checks (43/43), the old Release A 18 checks, GitHub hosted-v3 + Vite integration tests, and four green GitHub CI workflows are existing evidence; only rerun checks materially affected by the **new Work environment**. Do not re-analyze architecture, source history, or legacy plots.

## Final response from Work

Return: current saved/deployed version IDs, `baseline` match yes/no, 7-path diff and 46/46 hash result, Vite build result, one preview result, browser + security + synthetic D1 evidence with honest limits, D1 isolation result, candidate source version ID if any, `deployment_not_performed=true`, `plugin_unchanged=true`, and next approval required. Stop on first blocker; **do not find alternative workarounds**.
