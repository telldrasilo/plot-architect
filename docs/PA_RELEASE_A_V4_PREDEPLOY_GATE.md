# PA-RELEASE-A — saved v4 candidate, pre-deployment gate

**Recorded:** 2026-11-02. **Status: CANDIDATE SAVED / NOT APPROVED FOR DEPLOYMENT.**  
**Site ID:** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`. Keep the existing Site, D1, MCP and plugin. No second Site.
**Candidate v4 Version ID:** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce~appgver_9fab684372648191b91af6756baf76b5`.  
**Candidate source commit (Sites):** `02efc872a246454889d955f7662d8be123431fe4`.  
**Candidate version deployment ID:** `null`.  
**Compiled archive SHA-256 (Sites):** `8e9323cebe58c0db0b3ea84bd07d15bfc30ae72a010bc6bf2546cb7bb3fe7604`.  
**Current live deployment (v3):** `appgdep_6ae72bc3affc8191bb43ff3843cf616e`, Site source `f4ab5397ea2ac7e5b1c6804ae5a169acc7468089`.  
**Evidence:** ChatGPT Library report `libfile_7ccc2afe966881918b7170e05072e997`, `PA_RELEASE_A_CANDIDATE_V4_NOT_APPROVED_REPORT_20261102.zip` (contains RESULT.json and human-readable report). This document records the report; does not claim a new live Site inspection.

## Verified by Work (save-only)

- Saved exactly one new **unpublished** Site source version, v4. One save version call, no deployment call. Live v3 deployment ID and previous timestamp unchanged after.
- Source 46/46 SHA-256 match; exactly 7 approved changed/new files relative to 43-file v3 baseline, remaining 39 byte-identical. Existing hosted Worker/REST authorization, `src/mcp_server.mjs`, Graph contract and Drizzle files remain unchanged.
- Previous successful Vite build and synthetic GitHub CI evidence reused. Candidate artifact includes `dist/server/index.js`, `dist/client/index.html`, `dist/.openai/hosting.json`, `dist/server/wrangler.json` and Drizzle metadata.
- Read-only Sites D1 overview before/after returns binding `DB` and existing tables `plot_projects` and `plot_revisions`. No D1 row reads, migrations, writes, backups, legacy-plot access, sharing changes, MCP changes or plugin changes.
- Existing owner-only access policy unchanged. Real production owner sign-in and current D1 CRUD from candidate v4 are **not tested**, because v4 has no deployment.

## Why v4 is NOT approved for deployment

The bundled Cloudflare Vite output `dist/server/wrangler.json` contains a **dummy local development D1 database ID** `00000000-0000-0000-0000-000000000001`. The saved artifact's `.openai/hosting.json` says `project_id` = existing Site and `d1: DB`, and Sites read-only metadata still shows `DB`. **None of these alone proves** how the Sites deployment service resolves the final D1 UUID or whether it replaces/ignores the local Wrangler binding when deploying.

The official Sites guide states `.openai/hosting.json` holds project linkage and optional storage binding names, and that `Save version` and `Deploy version` are separate operations: https://learn.chatgpt.com/docs/sites/managing-a-site. The Cloudflare Vite guide states `dist/server/wrangler.json` is the output configuration used for preview and deployment in the generic Cloudflare Vite workflow: https://developers.cloudflare.com/workers/vite-plugin/reference/migrating-from-wrangler-dev/. These public descriptions **do not constitute a guarantee** about Sites' internal override logic.

The OpenAI dev mock sign-in is only for loopback hosts; the `terminal.local` browser returns intentional 403. **Do not weaken or bypass the upstream host check**, and do not treat a `localhost` CI mock as the owner's real hosted identity.

## Next allowed investigation (read-only, without Work if possible)

1. Inspect the **saved v4** version metadata and its packaged Worker binding manifest, without rewriting or resaving v4.
2. Seek *authoritative supported Sites metadata or documentation* showing exactly how the project-level hosted D1 `DB` is bound during **Deploy existing saved version**. Accept a confirmed binding mapping or explicit platform guarantee; do **not** infer that a dummy ID will be ignored.
3. Confirm a deploy of this version is expected to cause **no database migration/schema changes** and retains MCP discovery, six tool signatures and owner-only audience.
4. If the actual mapping/behavior cannot be proven, leave `D1_BINDING_UNVERIFIED_FOR_DEPLOY` and STOP. An altered production-safe source package would need a **new review, CI, saved candidate and owner approval**, not a silent patch to saved v4.
5. If all gates pass, obtain **separate explicit owner authorization** before any private deployment. No Work call or deployment is authorized by this document.

## Post-deployment acceptance plan — only after separately approved deployment

- Record the new deployment ID, destination version v4 and unchanged owner-only access policy; confirm the owner can authenticate through native Sites, while an unauthenticated user gets 401.
- Check rendered Graphite UI/UX-013/014/015/016. No opening or editing existing user/legacy stories.
- Check MCP `server/discover` protocol `2026-07-28` and the same six tool signatures.
- If explicitly allowed, use only one **new isolated synthetic project** to test create/reload/notes/fields/stale `409`, with an explicit expectation for how it will be identified/removed afterward. Do not assume rollback restores D1.
- On any failing release criterion: cease use of v4, follow a separately reviewed code rollback plan to v3. **Code rollback does not reverse D1 migration/data changes.**

**Non-negotiable exclusions:** no new Site, no external public publication, no D1 migration/repair, no importing/restoring old plots, no changing the MCP/plugin/access policy, no deployment without owner approval.
