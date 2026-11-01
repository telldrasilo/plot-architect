# Experimental official Sites / Vite packaging

This is a **separate compatibility experiment**, not the approved release candidate.

Uses OpenAI `@openai/sites-vite-plugin` (metadata + Drizzle) and Cloudflare
`@cloudflare/vite-plugin` (Worker + D1 preview). The Graphite editor HTML,
REST API, authorization and MCP implementation are imported from `../src`
without editing production logic. The only new runtime code is the Worker
entry adapter `../src/sites-vite-entry.mjs`.

The checked-in `../package-lock.json`, old `../scripts/build.mjs` and
`../scripts/preview.mjs` are deliberately untouched. This experiment uses
its own package manifest. Dependencies are pinned in this directory's own `package-lock.json`. CI now
uses `npm ci` and verifies `dist/server/index.js`, Sites metadata and
migrations, plus a local `vite preview` HTTP smoke for Graphite and `401`.
This is proof of the **local repository source** only, not captured hosted v3.
Before any private Site candidate, repeat the build on the captured hosted v3
backend with the approved two-file UX overlay, confirm all six MCP tools and
all saved-version/deployment security gates.

`npm run build` here never deploys. `npm run preview` uses local dummy D1,
NOT the existing private Site and not real owner identity. Never run any
Cloudflare deployment command. Do not upload this experimental bundle to
the existing Site until hosted protocol/file-diff gates are reviewed.
