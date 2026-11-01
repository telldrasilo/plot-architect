# PA-RELEASE-A — save one private Site candidate, no deployment

**Status:** READY FOR EXPLICIT OWNER-STARTED WORK. This is NOT permission to deploy.
**Target existing Site ONLY:** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`.
**Source baseline:** saved and deployed v3; source commit `f4ab5397ea2ac7e5b1c6804ae5a169acc7468089`, deployment `appgdep_6ae72bc3affc8191bb43ff3843cf616e`.
**Verified source package:** Library `/Планировщик сюжета/Development/04_Hosted_and_MCP/PA_SITES_VITE_V3_WORK_READY_20261102/PA_SITES_VITE_V3_WORK_READY_20261102.zip`; SHA-256 `490f5b598febeee584b6a535b96d40bd95a01d54b450a05aaa920c8cebf5454c`.
**Previous results:** 43 original hashes, 7 changed/new files, 39 unchanged, 46 final hashes, Vite syntax/build and local preview PASS. Hosted-v3+Vite CI, mock `localhost` sign-in, isolated local D1 synthetic create/read/409/MCP PASS (GitHub main `b3730a92304a091714e7779fab76c7d80ce7c11e`).
**Known preview limit:** the official `@openai/sites-vite-plugin@0.2.0` deliberately returns HTTP 403 to `/signin-with-chatgpt` on `terminal.local`; only loopback hostnames are accepted. See its upstream `packages/sites-vite-plugin/src/index.ts`. Work browser `MOCK_SIGNIN_UNAVAILABLE` is expected under this host. **Do not repeat or work around mock sign-in.** `authenticated:false` in unsigned local preview is not a production owner identity failure.

## Scope (one Work pass, no repeated architectural investigation)

1. Read only GitHub `AGENTS.md`, `docs/RELEASE_POLICY.md` and this document; use the verified Library package rather than reconstructing a project. Confirm the existing Site saved and deployed versions have not drifted from v3 using **read-only source metadata and hashes**. If drift, STOP `SOURCE_DRIFT_BLOCKED`; do not inspect user plots.
2. Reuse the existing ephemeral v3+7-file candidate worktree if present, otherwise apply exactly the same seven files to the same original v3 source. Check manifest 46/46, unchanged 39/39, no unexpected paths, exact hosted `src/mcp_server.mjs` with `server/discover` protocol `2026-07-28`, six tool names/signatures, unmodified production REST authorization and existing Drizzle migrations. No `npm update`, package changes, additional source edits or repository migration.
3. Inspect `.openai/hosting.json` and **read-only Sites metadata**: project ID must equal target Site, D1 binding `DB` must be the existing linked Site database, capabilities must retain `mcp`, access stays owner-only. Confirm neither the save operation nor build performs production migrations or data writes. Check the packaged `dist/.openai/hosting.json`, `dist/server/index.js`, `dist/client/index.html` and `dist/server/wrangler.json`. The Wrangler config includes the well-known **dummy local D1 ID** `00000000-0000-0000-0000-000000000001`; verify that Sites' version-save/deploy machinery uses the existing host-managed `DB` from `.openai/hosting.json`, not a new or dummy database. If host-managed runtime D1 mapping cannot be inspected, record `D1_BINDING_UNVERIFIED_FOR_DEPLOY` but continue to **save-only** only if Sites confirms that Save version neither deploys nor applies migrations nor writes production D1. Explicitly mark the saved candidate **NOT APPROVED FOR DEPLOYMENT** until mapping is separately verified. If the save action could touch D1, STOP `CANDIDATE_SAVE_UNSAFE` instead. Never change the DB binding.
4. Use the previous verified Vite build and CI evidence; run only the minimal required version-save build/check. Do **not** restart the browser preview or attempt `/signin-with-chatgpt` at `terminal.local`. Native production identity is not provable from Vite mock sign-in; retain it as a **deployment-stage acceptance test**, not a pre-save assertion.
5. **Save exactly one reviewable version of the EXISTING Site** if and only if Sites explicitly supports `save version` **without updating the active deployment**, with no D1 mutation and unchanged owner-only audience. The official Sites workflow separates Save version and Deploy version. No preview auth bypass, no weakening protection, no plugin update, no new Site.
6. Verify by read-only inspection: new candidate version ID, build/source commit, saved version metadata, current deployment still v3 with deployment ID above, D1 association and MCP capability unchanged, no migration applied. STOP immediately after reporting results. **DO NOT deploy, publish, change sharing or touch D1 rows.**

## Hard limits and failure paths

- No user/old test plot reads, list, export, backup, migration, restore, deletion, or copying. No Work spent on old stories.
- No synthetic writes to production D1, and no tests that could access the real DB. All existing CI evidence is local and separate.
- No changing Site access policy, real D1 binding, MCP tool definitions, plugin, application source outside the seven approved files, or credentials.
- Do not use fake `oai-authenticated-user-id` request headers or widen the upstream mock auth host allowlist.
- No new Site; no silent downgrade to standalone/static-only deployment.
- STOP `CANDIDATE_SAVE_UNSAFE` if the save action implicitly deploys or changes D1.
- Treat `D1_BINDING_UNVERIFIED_FOR_DEPLOY` as a **deployment blocker**, not an automatic version-save blocker. Version save is allowed only with confirmed no-deploy/no-migrate/no-write semantics. Include that status in the report and do not proceed toward deployment.
- STOP `BUILD_ARTIFACT_DRIFT` if production artifact unexpectedly changes schema, MCP, auth, or source path identities.
- STOP `SOURCE_DRIFT_BLOCKED` if Site v3 baseline changed.
- STOP `SAVE_VERSION_BLOCKED` on actual version-save API/tool failure; **no repeated attempts or alternative channels**.

## Final report from Work

State precisely: existing saved/deployed v3 IDs before/after, candidate source version ID if saved, 46-file checksum status, 7-file diff, build result, D1 linkage evidence or explicit `D1_BINDING_UNVERIFIED_FOR_DEPLOY` status, MCP/policy preservation, guarantee `deployment_performed=false`, `real_D1_rows_touched=false`, `plugin_changed=false`. If blocked, identify first STOP code and a concrete missing capability. **No publication authorization is implied by a candidate being saved.**

## Next release phase (NOT authorized here)

After the candidate is saved and reviewed, request a **separate explicit owner permission for private deployment**. Before deploy reconfirm intended D1 binding, migration no-op, retained owner-only audience and six MCP definitions. After deploy verify real owner sign-in in the published Site, 401 as unauthorized, browser UX, MCP discovery and only specifically approved new synthetic D1 writes. Rollback of code does not revert D1 data.
