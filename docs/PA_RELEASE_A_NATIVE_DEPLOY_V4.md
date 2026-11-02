# PA-RELEASE-A — native deploy of saved v4 (no imaginary preflight)

**Status:** READY FOR ONE OWNER-AUTHORIZED PRIVATE SITES DEPLOY; NOT YET EXECUTED.
**Scope:** Existing Site `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`, saved version `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce~appgver_9fab684372648191b91af6756baf76b5`. Live fallback is v3 deployment `appgdep_6ae72bc3affc8191bb43ff3843cf616e`.
**Previous Work stop:** `DEPLOY_D1_UNSAFE` was triggered *solely by the absence* of a Sites D1 internal binding/migration preflight report, not by an observed mismatch or migration request. The old `docs/PA_RELEASE_A_V4_PREDEPLOY_GATE.md` demanded a product capability that is not exposed. It is **superseded by this task for this specific deployment**.

## Established evidence; don't repeat

- Owner authorized private publication of saved v4. Current v3 is active, v4 is saved and not deployed.
- Site owner-only audience and existing project D1 binding `DB` confirmed through native Sites metadata; candidate `.openai/hosting.json` matches existing project ID and `d1:"DB"`.
- Captured v3 source and saved v4: 46/46 SHA-256 match, precisely seven approved changed/new files; the remaining **39 files, including hosted Worker, auth, MCP schema, Drizzle migrations, are byte-identical to v3**.
- GitHub CI: official Sites Vite packaging, original hosted MCP, mock **loopback** identity, isolated local D1 synthetic create/read/409 PASS; real Site owner auth and production D1 are not established by CI.
- The Vite output `dist/server/wrangler.json` carries dummy local D1 UUID `00000000-0000-0000-0000-000000000001`. **This is still a residual uncertainty**: official Sites documentation describes project-managed D1 through `.openai/hosting.json` but does not document how it handles this Wrangler UUID. Do not claim it is guaranteed to be ignored or replaced.

## Supported workflow only

Official Sites documentation:
- https://learn.chatgpt.com/docs/sites/managing-a-site
- https://learn.chatgpt.com/docs/sites/data-and-connections
- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites

These document **Save version → Deploy version**, owner audience and project-managed `d1` binding; they do **not** promise a before-deploy D1 binding UUID/migration plan. Never make access to such a plan a required gate; never manufacture one.

## One bounded Work pass

1. Read the above evidence and inspect only existing **Sites metadata**: matching Site ID, exact saved v4 version ID, live v3 deployment ID, owner-only audience, existing linked `DB`, and unchanged MCP capability. Do **not** list or open story projects.
2. Confirm there are **no newly added or altered migration files** between saved v4 and live v3, using previous 39-file source comparison as evidence; do not re-run full CI. Check whether the actual native Sites deploy action surfaces a **concrete warning/error** about DB replacement, wrong binding, or pending migrations. Do not request a hypothetical preflight report that the tool cannot produce.
3. The owner already explicitly requested private publishing of v4. **Only use Sites' native "Deploy version" for this existing saved v4; never invoke raw Cloudflare Wrangler.** If Sites offers no preflight plan, its absence alone is **not** reason to stop. If there is an actual DB mismatch or explicit migration/data-loss warning, stop with the exact text before execution; do not resolve by changing data or switching Sites.
4. If none of those concrete warnings occurs and the existing Sites controls still show the same `DB`/audience, perform **one** native Deploy version attempt with existing owner-only audience. Recognize that the platform may perform DB operations as part of deployment; do not promise zero D1 mutations or automatic rollback. This risk is inherent to native deployment and acknowledged in the final report.
5. Postdeploy, read-only verify Site version/deployment ID, owner-only access, `DB` binding, database schema/table names (no story row queries), real owner access if supported, anonymous 401, Graphite UI and MCP discovery/six tool names. **No real D1 writes**, migrations, backup/restore, legacy plot operations, plugin updates, access changes or new Site. If a verification fails, stop and report; do not automatically redeploy/rollback.

## Report

Either `DEPLOYED_PRIVATE_V4` with new deployment ID and a direct Site URL, observed DB/owner/MCP checks and residual uncertainties, or `NATIVE_DEPLOY_BLOCKED` with a concrete product warning/failed action. If deployment ran but failed, report its precise status and possible data impact: per OpenAI, a failed publish can still affect D1. Do not claim success without a confirmed new deployment ID.

**Release boundary:** This document is only for the user's current explicitly authorized v4 private release, not automatic future deployments.
