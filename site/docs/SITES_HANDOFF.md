# PA-SITE-01 · ChatGPT Sites installation brief

**Objective:** build and deploy an owner-only Plot Architect website from the accompanying source. Use the ZIP files, not an imagined/reconstructed prior prototype. No paid OpenAI API, external SaaS or Site-side text generation. Keep Xianxia plugins untouched.

## Read in order

`README.md` → `docs/ACCEPTANCE.md` → `src/graph_contract.mjs` → `src/worker.mjs` → `db/0001_initial.sql` → `public/index.html` → `tests/` → `docs/DECISIONS.md`.

## Instructions to Sites in Work

1. Create a new **private ChatGPT Site** from this package and adapt its deployment shape only as needed for the currently supported Sites runtime. Keep the Graphite v0.9 interface and source/data contracts. Do not deploy publicly.
2. Provision D1 binding `DB`; keep R2 null. Ensure `db/0001_initial.sql` is applied exactly once; verify tables, indexes and both project and revision records. Follow the Sites migration packaging requirements for the selected starter. Do not invent a `project_id` in `.openai/hosting.json`.
3. Configure `PLOT_PRIVATE_TOKEN` as a hosted secret, **not** in source or HTML. Token must be at least 24 random characters. Do not include secret values in screenshots or logs. If platform-native authentication is substituted, document and test it; never simply remove the bearer requirement without a comparable protected authentication/authorization boundary.
4. Compile/package Worker + assets and verify all REST routes. Do not present success if a Worker entry, database binding, Site manifest or migration is missing.
5. Test **in the Sites preview**: create two projects; edit node, field and comment; save and reload; import legacy v0.9 JSON; export plot-architect/project-1 JSON; verify group move and undo; inspect edge summaries; run the conflict scenario (stale expectedRevision returns 409 and does not change server graph). Test that anonymous API requests are denied.
6. Take a fresh Site preview screenshot, save a reviewable version, then **deploy only the reviewed private version**. Check actual URL and access restrictions after deploy. Do not mark private release complete until Site and D1 state survive a real browser reload.

### Known caveats to resolve during Site build

- `wrangler.jsonc` contains placeholder database ID `replace-on-provision`. Replace only via actual provisioned DB metadata.
- The source uses native Worker `fetch` and `env.ASSETS.fetch`, so it may require adapting to the Sites starter's Worker build. The Node build script copies the necessary files but is not itself a validation of Sites deployment.
- Local client uses `localStorage` as a *backup*, not authoritative server storage after owner connection; client is a basic prototype. Test recovery from interrupted sync and manual reconciliation before broader sharing.
- UI is optimized for desktop, and does not yet have multiuser conflict merge. The Site remains private.
- The current browser suite cannot prove real localhost page reload, D1 binding or tenant auth. Perform these tests in the actual Site.

## Handoff status

**PREPARED, NOT DEPLOYED.** No Site URL, published version, D1 database or MCP plugin has been created in this ordinary chat session. A Work-mode Sites run is required to complete these actions.
