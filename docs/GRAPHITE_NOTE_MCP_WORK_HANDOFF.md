# Graphite — one-pass Work release handoff for note → draft MCP

**Status:** SOURCE PREPARATION ONLY. This document is not authorization to modify a Site, production D1, plugin registration, or existing user projects. Read [AGENTS.md](../AGENTS.md) and [RELEASE_POLICY.md](RELEASE_POLICY.md) only where relevant. Avoid historical release scripts and duplicated version archaeology.

## Exact target — do not confuse the two Sites

- **New independent private Graphite Site:** `appgprj_6ae84b2112e4819180b875a027acba36`.
- Last recorded URL: `https://graphite-20261102.telldrasilo.chatgpt.site/`.
- Last reported new Graphite plugin: `plugin_asdk_app_sites_7617bbd717488191a6f386fcc914fa46`, private, version 1.0.0; verify its actual current registration only if plugin update is authorized.
- Last recorded new Graphite bootstrap source/deployed baseline: `6b37744956a45d1c0707a54d53e882acd21760cb` (2026-11-02 second deployment); last recorded deployment ID `appgdep_6ae84d1897c081919d91135c5531dd58` (**historical observation, not a current-state assertion**).
- **Never modify the older Plot Architect Site** `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`, its production database, or its associated plugin. Never copy, inspect, reconstruct or migrate old user stories.

## GitHub release source

- Repository: `telldrasilo/plot-architect`, branch `main` only **after** reviewed [PR #52](https://github.com/telldrasilo/plot-architect/pull/52) has **passed applicable CI and merged**. PR #52 supersedes closed PR #50. Do not deploy an unmerged branch.
- PR #49 merged the internal note-handoff code and synthetic E2E. PR #51 merged the additive receipt schema and synthetic D1 migration tests (main commit `734a2427009be643335c03b4ac0ad1ca26b80f46`). PR #52 adds the MCP adapter, integration tests and local preview compatibility fix (superseding PR #50).
- At release time pin the **actual post-merge main commit SHA**; do not assume the PR head SHA is the merge commit.
- The latest known published *Graphite* base is the second bootstrap commit above, **not** the old Plot Architect v4 documented in RELEASE_POLICY. First verify actual saved/deployed hosted source to ensure a matching base.
- Precomputed diff for review: `https://github.com/telldrasilo/plot-architect/compare/6b37744956a45d1c0707a54d53e882acd21760cb...<POST_MERGE_SHA>` (substitute the real SHA; this example is not an executable URL until then).
- Source dependency closure since recorded bootstrap: `site/src/creative_workflow_*.mjs` (10 internal workflow modules), `site/src/mcp_note_tools.mjs`, `site/src/mcp_server.mjs`, `site/src/worker.mjs`, `site/src/editor.js`, `site/public/index.html`, and the additive D1 migration `site/drizzle/0002_cw_operation_receipts.sql` plus `site/drizzle/meta/_journal.json`. `site/package.json` adds test coverage. Verify the current diff; **do not cherry-pick only the two MCP files**, because imports may not exist in the hosted baseline.
- Do not deploy `qa/`, `site/tests/`, `.github/`, old docs, local `wrangler` settings, or a wholesale repo checkout as the hosted source. Apply only the approved, necessary code changes using native Sites editing, reconciling any hosted-only modifications. Keep owner identity handling, named binding `DB`, REST API, the old seven MCP tools, and Sites/Vite integration intact.

## Exact MCP behavior

After an approved source release the Site should list **11** tools: the previous 7 unchanged plus:
1. `list_note_tasks` — bounded project note search; read-only.
2. `get_note_task` — a note and explicitly related active-canon neighborhood; read-only, no unrelated drafts or notes.
3. `preview_note_drafts` — model-authored proposal, exact revision and stable generation ID; call the existing opt-in `/api/projects/:id/workflow/preview`; return review token, no write.
4. `save_note_drafts` — **only after the owner's explicit acceptance of the preview**; call `/api/projects/:id/workflow/apply` with exact proposal/revision/generation ID/token. CAS+receipt/replay, isolated working area, **no automatic canonical acceptance**.

The approved creative model permits one or many events and a variable number of alternatives; it does not force three alternatives or equal lengths. The source note and original plot remain unchanged when proposals are staged.

## Three independent release gates — do not silently cross them

1. **Site source/private Save+Deploy:** requires its own clear owner authorization after PR #52 merge and successful CI. Existing Site only; never create another Site.
2. **Workflow persistence and D1 schema:** the server's `CW_WORKFLOW_ENABLED` is **off by default**, and `assertWorkflowReceiptStore()` needs a `cw_operation_receipts` table. The additive migration is prepared and tested in source (`site/drizzle/0002_cw_operation_receipts.sql`, merged PR #51), but **no production migration or workflow activation has been authorized or verified**. Do not assume the receipt table exists in production. Turning on the workflow or applying even an additive production schema migration requires a **separate explicit authorization**, approved/migration-tested schema plan and real native D1 safety checks. No manual SQL against production, no unsupported Wrangler deployment and no fabricated data restoration. If the table is absent or an unsafe migration warning appears, **STOP without enabling writes**.
3. **Plugin registration/skills:** existing private Graphite plugin must be updated separately, using its authorized official tool/registration workflow. Do not change the old Plot Architect plugin or create a new plugin. Only report new MCP tools as *usable from ChatGPT* when registration and live discovery actually confirm them.

**Migration review source:** `site/drizzle/0002_cw_operation_receipts.sql` and its Drizzle journal entry, from merged PR #51. This adds operation metadata only, not a competing story graph. Do **not** apply it to production without its own release authorization and native Sites validation. Do not copy SQL from documentation into production.

## Minimal Work execution — only AFTER the gates above have authorization

1. Confirm exact **Graphite** Site identity, current owner-only access, current deployment and available native Edit checkout. Verify GitHub `main` SHA and PR #52 passing CI/merged. If checkout fails (`Unable to prepare the Site`), **STOP**; no alternative deploy path.
2. Reconcile only changed hosted files from the pinned diff and their import closure. Preserve hosted-only auth, `DB`, REST/MCP and unrelated paths. Any unexplained conflict or binding change means **STOP**.
3. For an authorized migration: use an already-reviewed, tested additive migration through supported native Site tools, and verify that existing tables/records are preserved; **do not use this handoff as migration authorization**. Otherwise do a source-only Save and leave workflow disabled.
4. Native Sites **Save version**; record saved version ID. Private **Deploy version only if separately authorized**, after checking owner-only, unchanged `DB`, and actual warnings.
5. Read-only post-deploy: check private Site URL, `/api/health` with authenticated owner, previous MCP 7 tools plus the new four, basic old tool compatibility, default closed access. For workflow writes, only use a **new synthetic test project** if explicit user-data-write permission has been given; never open or modify existing plots.
6. If separately authorized, update **existing Graphite** plugin registration to 11 tools; verify discovery in ChatGPT. Mark tests **NOT VERIFIED** when environment prevents execution. Return Site/version/deployment IDs, current plugin ID and tool count, binding status, and actual evidence. One short release result is enough.

## Ready-to-paste Work task (after the owner grants the specific release gates)

> Work on the **existing private Graphite Site** `appgprj_6ae84b2112e4819180b875a027acba36`, **not** old Plot Architect. Source: GitHub `telldrasilo/plot-architect`, current `main` after merged PR #52 and passing CI; pin its exact SHA. Execute `docs/GRAPHITE_NOTE_MCP_WORK_HANDOFF.md` strictly. Inspect only affected hosted source and the native deployment state; preserve owner-only/auth, existing D1 `DB`, and hosted-only changes. Use only native Sites Edit → Save version → (if explicitly authorized) private Deploy. Do not create another Site or plugin, read/migrate old plots, use Wrangler deploy, or make an unapproved D1 migration. If `cw_operation_receipts` or activation is required but not explicitly approved, STOP before production write. Update the **existing Graphite plugin** only with its separate explicit authorization. Report precisely what was done and not verified.
