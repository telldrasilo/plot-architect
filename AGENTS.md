# Agent rules — Plot Architect / Graphite

## Scope
- Private Plot Architect project only. Never modify Xianxia Master, Campaign Vault, or unrelated projects.
- `main` is the reviewed **local development** baseline; it does not assert what is running on ChatGPT Sites.
- Treat files in `site/docs/` as historical inputs where they conflict with these current guards and `docs/RELEASE_POLICY.md`.

## Do not do without separate explicit release authorization
- Do not deploy, publish or modify the hosted Site, its access policy, real D1, REST/MCP routes or plugin connection.
- Do not create a second Site or independent duplicate plugin.
- Do not commit credentials, tokens, owner identifiers, project dumps or exported user plots into the repository.
- Never use Work for backup, migration, copying, restoring or preserving legacy/test plots, including “Кризис наследования” (PA-WORK-GUARD-01). If the plan requires it, STOP: WORK_LEGACY_DEPENDENCY.
- Do not presume that code rollback reverts database changes. Additive isolated schema first, synthetic D1 testing, explicit rollout and recovery plan.

## Source reconciliation is mandatory for a hosted release
1. Read exact existing Site source version/deployment, live MCP tool contract, D1 schema and private-owner access.
2. Compare that actual source against the local candidate: identify drift; patch only required files and preserve hosted-only fixes.
3. For UI-only rollout, preserve REST, MCP tool signatures, DB migrations, and access policy byte-for-byte unless approved.
4. Prevent silent loss of editorial data: if `eventRewrites[]` is not supported by server validation/storage, gate that feature rather than claiming persistence.
5. All data-changing operations require explicit authorization and CAS/transaction tests. Use new synthetic project data for hosted E2E.
6. No publication on test failure; report STOP with evidence.

## Local checks for every PR
Run from `site/`: `npm run check`, `npm run check:v2`, `npm run test:local`, `npm run build`. Report exact results; do not say actual D1 or owner identity is tested by local SQLite mocks. Run browser QA on modified interactions when browser is available.

## Code/change discipline
- Keep patches narrow. State baseline, changed files, invariant tests, reproducible commands and rollback target.
- Do not modify historical test results, security assertions or snapshots merely to obtain green CI.
- Separate three release types: UI (Site code), MCP server/tools (Site + discovery), Plugin Skill metadata (eligible Plugin Creator update).
- Use private PRs and reviewable diffs; never automatically deploy on merge.
- Avoid large duplicated handoff packets: link to immutable commit SHA and one small release task.