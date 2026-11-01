# PA-SITES-VITE-01 — official packaging adapter (experimental, 2026-11-02)

**Scope:** GitHub development only. Existing owner-only Site v3, D1, MCP, plugin and hosted source are unchanged. This does not authorize publication, create a Site, or reopen the blocked Work preview.

## Confirmed sources

- Official OpenAI `openai/sites` supports Node 22.13+, Vite 8 and `@openai/sites-vite-plugin`. The plugin copies `.openai/hosting.json` and `drizzle/**` into `dist/.openai/`.
- Cloudflare's Vite plugin builds Workers into a named environment. We select `server`, producing `dist/server/index.js`.
- Existing Graphite root `npm run dev` invokes the legacy preview script, which directly requires `node_modules/wrangler/bin/wrangler.js`. It is **not automatically replaced** by this experiment.

## Implementation

- `site/sites-vite-compat/package.json` and its own `package-lock.json`: isolated exact dependencies, lockfile from successful GitHub Actions install; no root package dependency updates.
- `site/sites-vite-compat/vite.config.mjs`: Vite with `sites()`, Cloudflare Worker environment `server`, and a virtual module loading the existing HTML without changing it.
- `site/src/sites-vite-entry.mjs`: delegates to existing `src/worker.mjs` with the unchanged inline editor HTML. No auth bypass.
- `site/wrangler.sites.jsonc`: **local dummy** D1 binding. Never deploy this config as a real Cloudflare project.
- `.github/workflows/sites-vite-compat.yml`: isolated `npm ci`, Vite build, checked `dist/server/index.js` + `dist/.openai`, local `vite preview` UI/`401` smoke, no deployment credentials.

## Safety and equivalence boundaries

1. The Vite compatibility CI builds the **GitHub development source**, not the captured hosted v3 source. GitHub `src/mcp_server.mjs` is not byte-equivalent to the hosted implementation (`server/discover`, protocol 2026-07-28). Do **not** use this experimental repository tree as a replacement for deployed Site.
2. The QA preview is local, not authenticated OpenAI Sites preview. A local D1 binding is not hosted D1. The release remains `PREVIEW_ENV_BLOCKED`.
3. For a future existing-Site candidate, start from the captured hosted source 43/43 SHA verified, preserve the 41 untouched files from v3, integrate the approved two UI files, **then add the separately reviewed build-adapter files**. Because that is a change beyond the former two-file release scope, a new owner-approved release plan and a new source diff are required.
4. The next GitHub milestone is a separate PR changing the **default Site build/dev entrypoints** only after checking with the captured hosted v3 source. Until then, Work would still invoke the old `npm run dev` and the same Wrangler error.
5. Keep the old custom build path as a fallback during comparison. No legacy plot data, old-test recovery or migration, secrets, real D1 mutation, production deploy, or plugin changes.

**Verification:** official Vite and Sites packaging CI + existing Node and Wrangler regressions. The remote Sites preview is **not proven** fixed.
