# PA-RELEASE-A — Vite preview auth gate: expected mock sign-in

**HOST RESTRICTION VERIFIED (2026-11-02):** Official `@openai/sites-vite-plugin` 0.2.0 mock sign-in permits only `localhost`, `127.0.0.1`, or `::1` on a loopback socket; it intentionally returns 403 for `terminal.local`. The GitHub loopback mock-auth test remains valid, but private Work browser auth cannot be validated that way. Diagnostic PR #15 closed without merge. For the next step use [PA_RELEASE_A_SAVE_CANDIDATE_ONLY.md](./PA_RELEASE_A_SAVE_CANDIDATE_ONLY.md); do not weaken the sign-in security boundary.

**Status:** Verified locally in GitHub CI; existing Site remains deployed at v3. No Site change, Work run, production D1 write or plugin update in this QA task.

## Observed Work stop

Evidence: ChatGPT Library `libfile_dba67370e2a08191ab8ed738306d5970` (`PA_RELEASE_A_VITE_PREVIEW_REPORT_20261102.zip`).
- Baseline v3 verified 43/43, overlay 7/7, candidate 46/46.
- Private `sites-preview` Vite started and rendered Graphite.
- `/api/health` reported `authenticated:false`, `/api/projects` rejected `AUTH_REQUIRED`.
- No identity injection, user data access, synthetic D1 write, saved source version or deployment.

## Verified fix for **local preview development only**

The already pinned **`@openai/sites-vite-plugin@0.2.0`** documents a supported simulated sign-in route available only in `vite dev`:
`/signin-with-chatgpt?return_to=/`; paired sign-out route `/signout-with-chatgpt?return_to=/`.
The simulated identity has ID `local_seedy`, and **is not the real owner**.

GitHub CI `.github/workflows/hosted-v3-vite-integration.yml` now:
- checks **anonymous** `authenticated:false` and API `401`;
- navigates through the plugin's **own** sign-in endpoint with a cookie jar (does not manufacture identity request headers);
- verifies subsequent `authenticated:true` from the original hosted v3 `src/worker.mjs`;
- uses `wrangler d1 migrations apply DB --local --config wrangler.sites.jsonc` on a fresh GitHub runner with dummy local DB ID, then creates **one new synthetic graph**, reads it, stores a synthetic editorial note, tests stale revision `409`, and verifies readback;
- confirms MCP `server/discover` and all six existing tools.
- keeps the original hosted auth and MCP implementation **byte-identical**.

This resolves how to enter authorized mode **in the local Vite test harness**, without weakening server authorization. The `--local` D1 CLI and Vite plugin use local Miniflare storage; this does **not** validate hosted D1.

## IMPORTANT: release gates remain distinct

- **Local mock identity**: CI PASS, QA only. Not owner-only access proof.
- **Real deployed Site owner identity**: only under ChatGPT Sites' real identity dispatcher; **not** proven by local preview or its test cookie.
- **Real production D1 isolation/persistence**: not tested or authorized to change.
- **Site Source candidate**: still NOT saved. Site v3 published unchanged.
- **Browser UX after local mock login**: not yet verified on Work preview.

Do not add hardcoded ID values or expose dev login routes in production code. Do not pass synthetic local credentials or fake identity headers into deployed Sites or MCP. Anonymous local HTML may still be served as a Vite static asset while server APIs return 401; that visual rendering is **not authentication**. Before changing any existing-site source version, separately review static-asset routing and owner-only audience policy.

## Next Work step (requires owner approval)

One bounded browser-only preview session using the identical verified Vite v3 source candidate and the official mock sign-in path. Verify the API authorization flips from false to true, and UI behavior using only a truly local isolated D1. **No production D1/old plot access**. Reuse GitHub CI results and do not run architectural analysis. Stop if this differs; do not assert `HOSTED_ACCESS_VERIFIED` from `local_seedy` alone. Saving a new candidate and deployment remain separately gated by release policy and owner authorization.

References:
- https://www.npmjs.com/package/@openai/sites-vite-plugin
- https://developers.cloudflare.com/workers/local-development/local-data/
