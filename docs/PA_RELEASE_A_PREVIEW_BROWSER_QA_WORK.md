# PA-RELEASE-A — one-pass browser QA after official Vite mock sign-in

**Status:** READY FOR OWNER'S SEPARATE WORK SESSION. Not a source-version/save/deploy authorization.

**Exact existing private Site:** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`; published Site v3 unchanged.
**Source candidate:** Library `/Планировщик сюжета/Development/04_Hosted_and_MCP/PA_SITES_VITE_V3_WORK_READY_20261102/` (7-file Vite+UX overlay; 46/46 SHA previously verified).
**Documentation:** `docs/PA_RELEASE_A_PREVIEW_AUTH_QA.md`, `docs/RELEASE_POLICY.md`.
**Existing evidence:** hosted-v3/Vite mock login, isolated D1 synthetic write/read/409, all four GitHub CI checks PASS on `main` commit `5dc94cc7151816ab9f197393724fc639ff9e4023`.

## Exact narrow Work execution

1. **Reuse** the previous prepared Vite worktree and private preview if still accessible. Otherwise, recreate exactly the already SHA-verified v3+7-file overlay from the immutable Library archive, only within an ephemeral preview worktree. Confirm saved/deployed Site still v3 via read-only metadata. If baseline drift exists, STOP `SOURCE_DRIFT_BLOCKED`; do not analyze or reconcile.
2. Start Vite `npm run dev` via supported `sites-preview` only if needed (once). Verify `/api/health` is `authenticated:false` and anonymous `/api/projects` responds `401 AUTH_REQUIRED`. This is expected before local login; not a failure.
3. In the preview **browser**, navigate to `/signin-with-chatgpt?return_to=/` on **the same preview origin**. This is the official `@openai/sites-vite-plugin@0.2.0` **development-only mock login**; do not manually set identity headers or disable auth. Check `/api/health` becomes `authenticated:true` and `/api/projects` returns `200`. Mock identity `local_seedy` is **not** verification of the owner's real ChatGPT identity.
4. Verify the underlying DB belongs to a **local/ephemeral preview**, not production D1. Do not infer isolation from the dummy database ID alone: confirm the running preview's actual D1 binding/runtime mode. If unknown, do only read-only UI checks and STOP `D1_ISOLATION_BLOCKED` before writes.
5. If **and only if** local isolation is confirmed, create a brand-new small synthetic story: verify first empty project, add/edit a note/field, reload and confirm persistence, provoke stale-revision `409` safely on that synthetic project only; check UX-013 context menu/tooltips, UX-014 inspector, UX-015 semantic zoom, UX-016 compact/map drag. Do not open any pre-existing project.
6. Report results of local browser QA, the distinction mock-vs-real owner identity, whether D1 isolation was proven, screenshots/logs **without user content**, and the next release gate. End the Work run after this **single** browser verification; no retries or architecture research.

## Hard exclusions

- **Do not save a Site source version or candidate in this QA run.** Do not publish or deploy, change real D1, Site access mode, REST/MCP, plugin, secrets, dependencies, or application code.
- Do not read, list, export, restore, back up, or migrate legacy/user/demo plots; no `list_projects` from production and no tests involving existing data.
- Do not turn production auth into a mock or use the dev login in the published Site.
- Do not mark `HOSTED_ACCESS_VERIFIED` solely from mock login. Real owner identity and private access remain a separate pre-release gate.

**STOP codes:** `SOURCE_DRIFT_BLOCKED`, `PREVIEW_ENV_BLOCKED`, `MOCK_SIGNIN_UNAVAILABLE`, `D1_ISOLATION_BLOCKED`, `BROWSER_QA_FAILED`. In every case leave the published Site v3 unchanged.
