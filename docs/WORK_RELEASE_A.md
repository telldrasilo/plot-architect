# PA-RELEASE-A — Work handoff template (DRAFT, NOT AUTHORIZATION)

Read the release gate in [`PA_RELEASE_A_PREFLIGHT.md`](./PA_RELEASE_A_PREFLIGHT.md) first. This template is not approval to deploy. Use the current Git `main` head at execution time, not a stale historical SHA.

Target: EXISTING owner-only Plot Architect Site (not a new Site).  
Candidate baseline: local Graphite v0.13.5-alpha, exact source in this repository at a pinned SHA.  
Goal: selective UI integration. No P5/P6 data migration and no MCP schema changes.

1. Read current live Site source, version, published deployment, owner access, MCP tool list and D1 schema **before changing code**.
2. Compare the pinned Git commit to live source. Refuse blanket replacement; identify only the needed UX files.
3. Merge UX-013/015/016 and inspector-only UX-014 safely. **Keep `beginEventRewrite()` blocked while `remote.connected`** until a separately reviewed hosted persistence contract exists. Never enable P5/P6 in Release A.
4. Keep owner-only policy, REST, MCP, migration and auth unchanged. No legacy test data export/backfill/restore or bulk migration via Work.
5. Run static/build/browser tests, owner-only preview and synthetic new-project smoke; do not claim actual D1 proof from mocked tests.
6. Stop on unresolved source drift, auth uncertainty, data-loss risk or regression; preserve the candidate and report blocker.
7. **Only after separate explicit approval**, deploy one private version and verify UI reload/MCP tools.

Before Work starts: run repository CI with `site/tests/pa-release-a-preflight.test.mjs`. Historical Site source snapshots do not confirm the live deployed version.

Deliver: precise changed-file diff, before/after Source version and deployment ID (if any), QA matrix, active blockers and cost-relevant work summary. Never interpret this document alone as user authorization to publish.