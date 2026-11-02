# PA-RELEASE-A — v4 private deployment result

**State:** `DEPLOYED_PRIVATE_V4_ACCEPTANCE_PARTIAL`. **Date:** 2026-11-02.

## Deployed existing Site

- Site URL: https://plot-architect-graphite-as.telldrasilo.chatgpt.site
- Site ID: `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`.
- Saved/deployed v4: `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce~appgver_9fab684372648191b91af6756baf76b5`.
- V4 Site source: `02efc872a246454889d955f7662d8be123431fe4`.
- Current deployment: `appgdep_6ae8284035b48191a6603d203cd6def5`, `succeeded`, at 2026-11-02T06:06:04Z.
- Previous v3 deployment, reference only: `appgdep_6ae72bc3affc8191bb43ff3843cf616e`.
- Original Work evidence: Library `libfile_d271b343aab88191bfe82f5d51433dc7`, `PA_RELEASE_A_V4_NATIVE_DEPLOY_REPORT_20261102.zip`; `RESULT.json` contains detailed deployment and runtime metadata. Do not copy its owner identity/email fields into GitHub.

## Successful verifications

1. One **native Sites Deploy version** of the **previously saved** v4; no new Site/version, no raw Wrangler deploy, no source modification.
2. The active Sites version and deployment ID match the requested v4, status `succeeded`.
3. Site access policy remains **owner-only**, with no shared groups or external visitors, according to returned Sites metadata.
4. Live `/api/health` in the actual owner's production session returned `ok:true`, `authenticated:true`, `authMode:sites-native`, `requiresAuthorization:true`.
5. Before/after D1 metadata: same project-managed **`DB`** logical binding and the same two table names `plot_projects` and `plot_revisions`. No manual SQL, migration, backup, restore, or writes were performed.
6. Sites reports MCP ready; the existing linked plugin connection is retained and the six tool definitions are registered: `list_projects`, `get_project`, `get_context`, `get_changes`, `preview_patch`, `apply_patch`. Source capture previously verified their signatures and protocol.
7. Existing user/legacy plot content was **not** listed, read, opened, exported, backed up or modified. Graphite home/editor was deliberately not opened since it might load an existing story.

## Deferred acceptance — *not* failed release checks

- **Anonymous app-level 401:** one unauthenticated request was blocked upstream by Cloudflare 403 Error 1010; therefore it does not validate an application-layer 401. No retries or bypasses.
- **Published UI/UX:** context menu, tooltip, inspector, semantic zoom and compact/map drag have not been tested on published v4.
- **MCP end-to-end:** Sites MCP ready and six tools registered, but live JSON-RPC `server/discover`/`tools/list` roundtrip was not executed. No existing-project MCP tool calls.
- **D1 persistence:** live data write/readback was not tested. No authorization to write synthetic records to production D1 has been given.
- **D1 internals:** the host-managed database's internal UUID and migration ledger were not exposed in this report. The logical `DB` binding/table overview is consistent before and after deployment, but that is not proof of byte-identical records or zero platform-side database operations. A rollback of Worker code would not restore data.

## Next step

**Keep v4 private and active**. Do not redo deployment or candidate save. For UI verification, first design a non-destructive entry that cannot automatically load existing projects (or let the owner explicitly choose a genuinely new story); never use Work to migrate/recover old stories. For MCP, a read-only `server/discover` and `tools/list` check can be performed without calling a project-data tool. Treat real D1 write/readback as a separate explicit consent boundary.

### Project release principle

Use official Sites Save version/Deploy version, Sites-owned D1/identity/MCP and supported Vite tooling. No invented parallel infrastructure or mandatory internal preflight facility not provided by the platform. Keep only concrete, actionable safety checks. See `AGENTS.md` and `docs/RELEASE_POLICY.md`.
