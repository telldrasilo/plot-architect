# Plot Architect — Work-budget release policy

## Version evidence

**Local:** v0.13.5-alpha / UX-016, reproducible ZIP in ChatGPT Library at `/Планировщик сюжета/Development/01_Current/PA_LOCAL_V0135_20261101/`.  
**Hosted:** existing owner-only Site and six-tool PA-MCP-01, actual current production source not compared with this local snapshot.  
**Backend:** P1/P2 v2 schema code and SQLite tests are only a spike; actual D1 gate remains `BLOCKED_D1_NOT_VERIFIED`.

## Release tracks

| Track | Allowed change | Work/Sites stage | Plugin step |
|---|---|---|---|
| A — UI | UX-013 menus, UX-015 semantic zoom, UX-016 drag; UX-014 only with verified persistence or feature flag | Compare actual Site source, minimal patch, owner-only preview/QA, explicit private deploy | None if tool schema unchanged |
| B — data & P5 | D1 additive tables, editorial drafts, prepared variants, new MCP semantics | Isolated synthetic real D1 tests, CAS, auth, hosted E2E, explicit deploy | Refresh/discovery if MCP schema changed |
| C — Skill | Prompt/routing/metadata without app binding changes | No Site deployment if only Skill content changes | Guarded update of existing private plugin using current release ID |

Do not combine the unverified D1 rewrite path with Track A just to reduce Work calls: a single huge risky task is not cost-effective.

## Work budget

Prepare tested local patch and exact file-level diff outside Work. Ask Work only to reconcile with the current hosted Source, verify security, save a candidate, run hosted tests, and deploy once if separately authorized. Avoid broad legacy history retrieval. Work is forbidden for legacy test-story preservation (`PA-WORK-GUARD-01`); old rows should remain untouched. No second Site or plugin.

## Release gates

1. `source_version`, `deployment_id`, access mode, Tool schema and DB migrations observed from current live Site.
2. Scope/diff reviewed; all unexplained drift stopped.
3. No schema loss of `eventRewrites[]`, editor notes, or visual fields; if unsupported, disable feature in hosted release rather than dropping data.
4. Local Node/build/browser tests pass; hosted auth and persistence tested with NEW synthetic data.
5. On private preview, owner-only identity confirmed; no cross-owner access, no auth weakening.
6. Migration apply is explicit, additive and tested for CAS=0 rollback. Deployment rollback is not a DB rollback.
7. Private deploy only after authorization; postdeploy tool discovery and read/write readback. Final report includes versions, changed files, test outcomes and blockers.