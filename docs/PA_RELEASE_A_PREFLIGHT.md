# PA-RELEASE-A — selective Graphite UI integration preflight

**Status:** PREPARATION ONLY / NOT APPROVED FOR DEPLOYMENT  
**Repository source:** `telldrasilo/plot-architect`, pinned local baseline `cac24e28cfae239ee2f5317901ccf38bac62d59b` (Graphite v0.13.5-alpha / UX-016).  
**Target:** existing owner-only Plot Architect Site `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`; **never** a new Site or independent plugin.  
**Source of truth for hosted runtime:** fetch the **currently saved and published** Site source, deployed version, access policy, MCP tools, and D1 bindings during a separately authorized Sites integration. Historic Library snapshots are not substitutes.

## Current local code review

- UI sources: `site/src/editor.js` and its exact inline copy in `site/public/index.html`. Do not deploy these independently without checking their consistency.
- UX-013: minimal node menu and tooltip behavior; UX-015: three visual zoom levels; UX-016: drag in compact/map; UX-014: revised inspector and local single-event rewrite draft. UI changes must retain P4D autosave/conflict recovery.
- `beginEventRewrite()` currently returns early when `remote.connected`; the absence of hosted single-event rewrite persistence is an **intentional safety limitation**. Keep it in Release A.
- `validateGraph()` clones the raw graph; it does **not** discard arbitrary top-level editor overlay fields, but hosted persistence of every editor overlay still requires real synthetic readback. Treat the absence of field-level validation as a separate concern.
- The local archive contains extra server/MCP/data code. Never replace `worker.mjs`, `mcp_server.mjs`, DB schema, auth, REST or hosting configuration merely by copying the local directory.

## Historic comparison, NOT live verification

Comparison against `PA_HOSTED_SYNC_01_SOURCE_V2.tar.gz` from the 2026-11-01 recovery evidence (version 2, commit `65eb80a646f1a418fc9ac6f9ff620faf60c831ad`) found six differing files present in both sources:

| File | Historic source bytes | Local candidate bytes | Release-A handling |
|---|---:|---:|---|
| `src/editor.js` | 73,876 | 156,519 | UI selective port after live drift check |
| `public/index.html` | 100,519 | 198,619 | UI selective port; match inline JS exactly |
| `src/graph_contract.mjs` | 4,606 | 5,015 | Keep hosted; verify fields roundtrip rather than overwrite |
| `src/worker.mjs` | 7,702 | 7,825 | **Do not copy**: hosted routes/auth/MCP may differ |
| `scripts/build.mjs` | 870 | 988 | Keep hosted unless build compatibility requires reviewed minimal change |
| `package.json` | 415 | 792 | Keep hosted unless explicitly required for a validated build |

The historical archive predates some hosted MCP work. **Do not infer that the deployed Site is still version 2.** New local files such as `src/mcp_server.mjs`, `src/v2_store.mjs`, and `db/0002_v2_isolated.sql` are **out of scope** for Release A.

## Required predeploy order

1. Obtain current hosted saved source SHA/version, deployed version/ID, owner-only policy, current tool schemas, graph validator, and D1 migration state; capture metadata only and do not read or migrate legacy plot content.
2. Compare the actual hosted UI against the pinned Git commit (including hosted-only recovery/identity fixes). Stop on unexplained drift. Prepare minimal **UI-only** diff and verify the editor is embedded into the resulting HTML.
3. Preserve all hosted REST, MCP, auth, D1 schema, migrations, and access settings. No destructive operations, legacy test-story backups, restore, or compatibility work using Work.
4. Run `npm run check`, `npm run check:v2`, `npm run test:local`, and `npm run build`; run browser interaction regressions with a **new synthetic graph**. Check editor field/color, compact/map drag, Undo, layout/tag handling, 409 conflict/recovery, project creation, autosave, and reload.
5. On an owner-only private preview, verify synthetic graph readback of titles/descriptions, `width`/`height`/`color`, lanes/fields, editorial overlays, and edges. The rewrite start button must remain disabled on connected Site. Verify API unauthenticated returns 401, and existing MCP signatures/discovery have not regressed.
6. Produce a candidate with exact changed paths, saved source version, rollback code target, evidence and blockers. **STOP before deploy unless the owner separately authorizes the specific publication.**
7. On authorized private deploy: one controlled deployment, readback using a newly created synthetic fixture, tool discovery, access policy recheck, and report. Deployment rollback is **not** a D1 rollback.

## Stop codes

- `SOURCE_DRIFT_BLOCKED`: cannot reconcile live source with Git candidate.
- `HOSTED_ACCESS_UNVERIFIED`: private owner/identity claims unverified.
- `PERSISTENCE_ROUNDTRIP_FAILED`: any synthetic editorial or visual field is lost.
- `REWRITE_GATE_REGRESSION`: hosted single-event rewrite can write without a validated backend.
- `WORK_LEGACY_DEPENDENCY`: safe release would require Work to handle legacy test plots.
- `TEST_GATE_FAILED`: required test or preview failed.

## What Release A does *not* deliver

No new P5 generation, variant storage, P6 application, hosted D1 schema migration, MCP tool additions, plugin skill revision, historical-data restoration, or general-purpose sync rewrite. These belong to separately reviewed tracks.
