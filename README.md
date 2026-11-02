# Plot Architect / Graphite

Private plot-structure editor. **GitHub `main` is the development source, not a byte-for-byte mirror of the live ChatGPT Site.**

## Where to start

- **Code and tests:** `site/`, `qa/`; read [AGENTS.md](AGENTS.md) for brief agent boundaries.
- **Design:** Library `/Планировщик сюжета/Development/UX_DESIGN_STANDARD.md` (consult relevant sections, not the entire history).
- **Published Site:** query Sites for actual current version and access when the task concerns hosting; latest recorded v4 release evidence: [docs/PA_RELEASE_A_V4_RELEASE_RESULT.md](docs/PA_RELEASE_A_V4_RELEASE_RESULT.md).
- **Releasing:** [docs/RELEASE_POLICY.md](docs/RELEASE_POLICY.md), **only** when a Site/MCP/D1/Plugin release is in scope.

## Development

From up-to-date `main`: make a focused branch, submit a PR, run applicable checks, wait for CI and merge. GitHub PRs, commits and CI are the development history. Update docs only when a lasting rule, contract or user-facing behavior changes; no duplicate per-task Library logs or archive version comparisons.

For app changes the usual commands (from `site/`) are:

```bash
npm ci
npm run check
npm run check:v2
npm run test:local
npm run build
```

The default dev/build uses the official Sites Vite adapter; legacy scripts exist for comparison. Browser QA is targeted to modified interactions. Local tests do not establish live owner identity or production D1 correctness.

**Safety:** Publishing is a separate, explicit owner-authorized native Sites workflow. Preserve owner-only access, D1 `DB`, existing REST/MCP interfaces and hosted-only fixes. Do not migrate/recover old plots through Work or deploy the local worktree directly.
