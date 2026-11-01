# Plot Architect · PA-SITE-01 · First Working Product

**Status:** tested local candidate for ChatGPT Sites; **not deployed**. The artifact uses the Graphite v0.9 editor as its visual baseline, with a project manager and Site-compatible persistence adapter. It does not require OpenAI API keys, does not contain paid model calls, and does not change Xianxia Master / Campaign Vault.

## How to try the working interface now

Open `public/index.html` in Chrome/Edge. Use **Проекты** to create, switch, duplicate, rename, delete and import stories. Edits save to this browser's `localStorage`; use **Экспорт** for a portable backup. A browser-private/local file is *not* the hosted Site.

## Site architecture

- `public/index.html`: standalone Plot Architect UI, Graphite Canvas, edge aggregation, fields, search, focus, projects.
- `src/editor.js`: editable client source; packaged inline into HTML for standalone preview.
- `src/worker.mjs`: Cloudflare Workers-compatible JSON REST API, with no dependencies.
- `src/graph_contract.mjs`: graph validation, canonical package, legacy import normalization.
- `db/0001_initial.sql`: D1 migration with `plot_projects` (current snapshots) and `plot_revisions` (immutable snapshots per server revision).
- `.openai/hosting.json`: Sites D1 binding name `DB`, no R2, no `project_id` before provisioning.
- `wrangler.jsonc`: source-layout Worker/asset binding example; `database_id` must be provisioned/replaced by Sites.
- `dist/`: built artifact containing frontend, Worker source, `.openai` hosting config and migration.

## Project format

`plot-architect/project-1`: `{format, exportedAt, project: {id, name, graph}}`. The graph has stable IDs, `nodes`, `edges`, `fields`, `lanes`, geometry and editable prose. `autoFieldIds` is derived from geometry; `manualFieldIds` are editorial and retained. The portability format is versioned separately from the legacy Plot Package 0.2 draft and is not claimed to be a drop-in importer for Campaign Vault.

Older `plot-ux-prototype/0.9` graph JSON is accepted by the **local UI importer** and normalized. Import creates a *new* project, never overwrites an existing one.

## How server-backed saving works

The private server endpoint must be deployed with D1 `DB` and `PLOT_PRIVATE_TOKEN` (minimum 24 chars). A Site owner connects from **Проекты → Подключить Site**. The token is held in session storage (not in export files), and the server compares a bearer token before performing any database action. Keep the Site private to the owner; a public site with this MVP's shared secret is not approved.

Edits are first copied to local browser storage, then debounced to the Site. Writes use an `expectedRevision`; a conflict returns HTTP 409 instead of overwriting an independent edit. A pending local sync marker blocks silent replacement of unsaved edits on reopening. The editor provides explicit local backup/export for conflict recovery. Future editions should replace the shared key with Site-native identity and per-user authorization.

Server API routes: `GET /api/health`, `GET|POST /api/projects`, `GET|PUT|DELETE /api/projects/:id`, `GET /api/projects/:id/revisions`, `POST /api/projects/:id/restore`. REST endpoints are intentionally separate from an eventual MCP plugin.

## Run checks locally

```
node --version   # Node 22+
npm run check
npm test
python tests/client_check.py
python tests/regression_browser.py
python tests/remote_client_check.py
npm run build
```

Browser tests use Playwright Chromium via `page.set_content` and mocked storage/HTTP APIs because actual localhost navigation is denied by this test environment. Server tests use Node's SQLite mock D1 wrapper. These checks do not assert a production deploy or a live D1 session.

## Deployment

Read `docs/SITES_HANDOFF.md` and `docs/WORK_SITE_REQUEST.md`. Work with `@Sites`, upload the entire ZIP, create a **private Site**, provision `DB` in D1, apply the included migration, configure `PLOT_PRIVATE_TOKEN` as a secret, inspect the preview, then save a version and deploy only after the runtime and security checks pass. The Site URL will only exist after that separate process; there is no Site management action in this chat.

## Not in PA-SITE-01

MCP tools and ChatGPT bidirectional editing, Plot Runtime/Campaign Vault integration, real-time collaboration, role-level permissions, cross-device server deployment verification, human usability study. The current product is a vertical slice for genuine story editing, not the complete target architecture.
