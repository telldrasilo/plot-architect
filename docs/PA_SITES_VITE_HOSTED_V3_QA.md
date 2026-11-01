# PA-SITES-VITE-V3 QA — captured hosted runtime integration

**State:** CI verification of local integration; **not** a saved or deployed Site release.  
**Date:** 2026-11-02.  
**Target existing private Site:** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`; saved and deployed source version 3.  
**Authoritative input archive:** Library `/Планировщик сюжета/Development/04_Hosted_and_MCP/PA_SITES_VITE_V3_20261102/PA_SITES_VITE_V3_SOURCE_CANDIDATE_20261102.zip`.

## What is verified

The GitHub QA branch stores the byte-exact **code-only** captured hosted-v3 `src/worker.mjs`, `src/mcp_server.mjs`, `src/graph_contract.mjs`, and original hosted-v3 `tests/mcp.test.mjs`, with source SHA-256 assertions. It does not store or inspect any private user plot or secret.

In CI, these three original hosted runtime modules replace the corresponding *development copy only within the ephemeral GitHub runner*. The approved UI `src/editor.js` and `public/index.html`, pinned Vite config/entry, and root lockfile are also verified by SHA-256 before build.

CI runs:
1. Exact `npm ci --include=dev` on Node 22.16.
2. Hosted-v3 native REST, MCP and security tests (15 checks).
3. Vite production build to `dist/server/index.js`, with `dist/.openai/hosting.json` and `drizzle` migration metadata.
4. Ephemeral `vite dev` HTTP smoke: Graphite UI, `/api/health`, anonymous API 401, `/mcp` `server/discover` protocol `2026-07-28`, and exactly six tools: `list_projects`, `get_project`, `get_context`, `get_changes`, `preview_patch`, `apply_patch`.
5. Upload a short-lived, private, compiled CI artifact for review. The local Wrangler config references a **dummy** database ID; this CI artifact must **not** be deployed verbatim.

The source capture's 46-file full tree is independently stored with manifest in Library. This job overlays the **runtime-relevant hosted-v3 files** onto the reviewed Vite development tree; it is not a full 46/46 reconstitution and does not claim complete byte identity with that archive.

## What remains unverified

- ChatGPT Sites preview after using the Vite build/dev entrypoints.
- Actual owner-only Sites identity headers and access policy under platform runtime.
- Real hosted Cloudflare D1 persistence, including synthetic write/readback.
- Source candidate save without implicit deploy; production MCP/REST integration after save.
- Any Site deployment. **No deployment authorization follows from GitHub CI.**

## Next work boundary

Do not return to the old Wrangler private-preview workaround. Use the existing source capture v3 and the Library Vite-V3 candidate. If the owner explicitly authorizes a bounded Sites source-candidate attempt, Work should first confirm the v3 live baseline has not drifted, then use the exact reviewed Vite package plus two UX files, verify all newly added/changed path hashes, and attempt one private preview. If the platform requires deployment to save, or preview fails, stop without deployment or old-plot handling.

Do not replace hosted `src/mcp_server.mjs` with GitHub local development MCP, run migrations, change Site access, or touch original user/test plot rows.
