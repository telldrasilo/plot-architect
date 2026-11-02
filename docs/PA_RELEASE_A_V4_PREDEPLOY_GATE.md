# PA-RELEASE-A — official private deployment of saved v4

**SUPERSEDED FOR CURRENT OWNER-APPROVED V4 RELEASE:** This historical gate required a D1 internal preflight plan that Sites does not expose, leading to `DEPLOY_D1_UNSAFE` even though no actual mismatch was observed. Do not rerun it. Use [PA_RELEASE_A_NATIVE_DEPLOY_V4.md](./PA_RELEASE_A_NATIVE_DEPLOY_V4.md) for one native deployment with concrete binding/audience checks. Existing D1 data risk remains; no Wrangler bypass.

**Current release state (2026-11-02):** v4 saved, **NOT YET DEPLOYED**. Owner has explicitly requested **private publication of this version on the existing Site**. Deployment may proceed only through native Sites with the finite preflight below. Do not ask for a redundant approval if those conditions are satisfied; stop if they are not.

**Existing Site:** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`  
**Saved v4 version:** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce~appgver_9fab684372648191b91af6756baf76b5`  
**Current live v3 deployment (rollback reference):** `appgdep_6ae72bc3affc8191bb43ff3843cf616e`  
**Saved v4 deployment ID:** `null` in Work's last verified report.  
**Site v4 source commit:** `02efc872a246454889d955f7662d8be123431fe4`  
**Original v4 evidence:** Library `libfile_7ccc2afe966881918b7170e05072e997`; 46/46 SHA-256 match, exactly seven approved changes, 39 unchanged. Previous hosted-v3+Vite CI tests, MCP contract and local synthetic D1 tests PASS.

## Policy: use native Sites, not our own infrastructure

Follow [official Sites managing and publishing](https://learn.chatgpt.com/docs/sites/managing-a-site) and [OpenAI Sites Help Center](https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites). Sites natively manages project linkage, saved versions, deployment, audience and D1 by `.openai/hosting.json` (`project_id`, `d1: "DB"`). **Do not** create a new Site, run direct Cloudflare deployment, develop mock login, emulate production identity or invent a separate release system. Reuse the **saved v4**; do not rebuild or resave unless a concrete failure requires a new approved release.

## One native Deploy version attempt (owner authorized, conditional)

Use Sites/Work to perform **one** official `Deploy version` operation for the **existing saved v4** only after checking:
1. Existing Site and selected saved v4 ID match the IDs above; current active deployment is still v3. Existing audience remains **owner-only** (not public, not shared). Site settings still show D1 binding `DB`, `.openai/hosting.json` retains the same project ID and `d1: "DB"`, and the six existing MCP tools are retained.
2. In the native deployment preview/plan or supported metadata, verify deployment **does not replace or detach the existing D1** and **does not propose new database migrations/schema changes**. Saved `dist/server/wrangler.json` contains a **dummy local development ID** `00000000-0000-0000-0000-000000000001`. This is a genuine safety flag: never blindly publish a raw Cloudflare build with that ID. Use official Site-managed D1. The official docs describe the named binding, but do not guarantee undocumented internal UUID substitution. **Do not invent an internal verification requirement the platform cannot expose**; use the native binding and deployment controls. If the operation indicates the dummy DB would be used, would replace D1, would run migrations, or the identity of the target database conflicts with current Site metadata, STOP `DEPLOY_D1_UNSAFE`. Do not attempt workarounds.
3. Do not require `/signin-with-chatgpt` in Work's `terminal.local` preview: the upstream Vite plugin intentionally rejects it. Real owner auth is a **postdeployment** check, not proven by local mock identity.

If the native deploy interface cannot attest that the old database binding will be retained and gives no reliable way to distinguish the dummy ID from the existing managed binding, **STOP and report the exact missing capability**. Do not convert uncertainty into a claim of safety. Otherwise execute native **Deploy saved version v4 once**, keeping owner-only audience.

## Postdeployment read-only acceptance

- Record new deployment ID, version v4 and live URL; reconfirm audience owner-only, `DB` still present and existing migration/schema overview unchanged. Do **not** inspect existing story rows.
- Verify real ChatGPT owner authentication at the live Site, anonymous API access denied, and Graphite UI (context menu, tooltip, inspector, semantic zoom and drag). If the normal UI would list older projects, do not open or modify them.
- Check MCP `server/discover`, protocol `2026-07-28`, and exactly six existing MCP tools, with unchanged signatures.
- **Do not write any real D1 rows by default.** New synthetic project write/readback needs separately explicit permission. No backup, restoration or migration of old/test stories; no plugin updates or secret changes.
- On a failure: stop, report observable evidence and the live deployment state. Do not silently redeploy or assume rolling back code reverts D1. OpenAI warns that publishing can affect a Site's database even before the new version is live.

## Outcome

Report `DEPLOYED_PRIVATE_V4` with version and deployment IDs, live URL, unchanged owner-only access, DB/MCP outcome and read-only acceptance status; or report `DEPLOY_D1_UNSAFE` / other concrete blocker, with the v3 active deployment unchanged. **Do not report publication unless Sites confirms success.**
