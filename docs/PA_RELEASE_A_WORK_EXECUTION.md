# PA-RELEASE-A — executable Work / Sites task

**Authority:** owner approved beginning controlled Release A integration preparation, **NOT deployment**. This document authorizes no independent release.  
**Source:** private GitHub `telldrasilo/plot-architect`, reviewed baseline `a351e74be3c67975d33096b9b3b8574e1f6a0577`.  
**Target:** EXISTING owner-private Site `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce`, with existing D1 and associated Plot Architect MCP.  
**Required reading:** repository `AGENTS.md` → `docs/RELEASE_POLICY.md` → `docs/PA_RELEASE_A_PREFLIGHT.md`. Do not search old chats or rewrite the architecture.

## Execute in Work with Sites access, in this exact order

1. **Read-only live discovery first:** fetch actual latest saved Site source and published deployment ID, owner-only access policy, D1 bindings/schema migration status, current `src/editor.js` / `public/index.html`, REST/identity code, and six-tool MCP registration. Compare with Git commit above. Keep the distinction between saved source and published deployed version. Historic library archives are NOT live source.
2. **Change only what is necessary:** selectively port UX-013 menu/tooltips, UX-014 inspector (but **NOT hosted event rewriting**), UX-015 three-level zoom and UX-016 compact/map drag into the **current hosted source**. Preserve hosted-only recovery fixes, especially 409 conflict → duplicate → continued autosave. Match the inline HTML editor code to `src/editor.js` after merge.
3. **Hard scope:** no new Site/plugin; no D1 migration, no REST/MCP tool-schema changes, no auth/access policy changes, no P5/P6 generation or patch application. `beginEventRewrite()` must stay blocked when `remote.connected`. Never silently discard `eventRewrites[]`, notes, fields or visual data.
4. **Work-budget firewall:** do NOT read, export, back up, restore, migrate, recreate, or test the preservation of old demonstration plots, including «Кризис наследования». Use fresh synthetic test projects. If needed for safe release, stop with `WORK_LEGACY_DEPENDENCY`. Do not delete or modify historic records.
5. **Predeploy verification:** syntax/check/build; node contracts and applicable browser regressions for menu, inspector, semantic zoom, drag, fields, Undo, 409 recovery, autosave/reload and persistence roundtrip; identity 401 negative; 6 MCP tool names/schema unchanged. Verify actual private preview and fresh synthetic D1 persistence where available. A local mock is not a hosted D1 result.
6. **Candidate only:** if all gates pass, save a reviewable **new source version/candidate** for the SAME owner-only Site, but **STOP BEFORE deploy/publish**, sharing changes, plugin installation, any migration, or destructive mutation. Do not imply that a saved candidate is deployed. If the platform itself cannot save without deployment, stop and report this constraint instead of deploying.
7. **Report:** exact live source and deployment baseline IDs, pinned Git SHA, changed paths / concise diff, tests run and pass/fail evidence, D1 and identity status, saved candidate version ID (if any), release blockers and the single next owner approval needed for private deployment. Keep evidence free of actual private plot content.

## Stop conditions

`SOURCE_DRIFT_BLOCKED`, `HOSTED_ACCESS_UNVERIFIED`, `PERSISTENCE_ROUNDTRIP_FAILED`, `REWRITE_GATE_REGRESSION`, `WORK_LEGACY_DEPENDENCY`, `TEST_GATE_FAILED`. On any stopper: no publication and no speculative fix outside scope.

**Result sought:** a reconciled, tested candidate ready for a separate explicit owner-approved private deployment; not a published Site and not a new MCP plugin.
