# PA-RELEASE-A — preview environment recovery after Work STOP

## Final status: PREVIEW_ENV_BLOCKED (2026-11-02)

The permitted Work retry did **not** restart preview. The available `sites-preview` interface supports only `start/stop/status/daemon`; it exposes no container exec or preview-side package installation. Absence of `/site` in the editor environment proves nothing about the separate preview container. Therefore the prior instructions to inspect `/site/node_modules` and run `npm ci` inside preview are **inapplicable** in this environment. Do not reissue that task.

**Independent verification without Work:** [GitHub Actions local Wrangler smoke](https://github.com/telldrasilo/plot-architect/actions/runs/41353026387) PASS using `npm ci --include=dev`, pinned Wrangler, local D1 migration, local preview, anonymous 401, simulated QA owner read. This tests a clean GitHub runner, **not the Sites preview mount, real owner identity or hosted D1**.

**Current action:** STOP further Work preview retries. Escalate to OpenAI Sites support with the existing two Work STOP reports, Site ID, version/deployment, exact MODULE_NOT_FOUND, `sites-preview` command limitation, and local GitHub CI proof. Do not install a global Wrangler, move packages to dependencies, vendor node_modules, change more than the two reviewed UI files or bypass the private preview gate without separate owner-reviewed policy change. The Site remains v3; no candidate source version saved, no deployment or plugin/D1 change.

---


**Status:** blocked at private preview; NOT a code regression. Do not publish or save a candidate until preview gates pass.

## Evidence (2026-11-02)
Source: `PA_RELEASE_A_PREDEPLOY_STOP_REPORT_20261102.zip`, ChatGPT Library `libfile_b6144f4e39cc8191bef9830415070171`.

- Captured existing Site v3 source and 43/43 hashes match; two prepared UI changes match release manifest; 41 other source files unchanged.
- `npm run check`, `npm run build`, compiled syntax, 17/17 project tests and 1/1 synthetic editorial/visual PUT/GET + stale 409 check: **PASS**.
- `sites-preview start` failed before healthy with `MODULE_NOT_FOUND: /site/node_modules/wrangler/bin/wrangler.js`.
- The Work report states dependencies were provided via a temporary `node_modules` symlink that preview could not see. The symlink was removed. The exact reason the mount could not see it remains to be checked in the preview environment.
- No saved source version, deployment, Site, plugin or real D1 mutations resulted. Real preview identity and browser reload not verified.

## Narrow environment-only retry (a separate explicit Work instruction)

1. Confirm current Site saved/deployed v3, source `f4ab5397ea2ac7e5b1c6804ae5a169acc7468089` and baseline hashes are unchanged. Stop on drift.
2. Reapply precisely the same two verified Site UI files from `/Планировщик сюжета/Development/04_Hosted_and_MCP/PA_RELEASE_A_V3_20261101/` (no source edits outside those two). Check 2/2 candidate hashes and 41/41 unchanged hashes.
3. Before launching preview, diagnose the **preview container's own** project root `/site`: inspect `/site/node_modules`, `readlink -f`/real path if symlinked, and whether `/site/node_modules/wrangler/bin/wrangler.js` is readable. The site checkout may have dependencies in the editing shell but not in the preview mount.
4. **If the platform supports it**, materialize actual dependencies in the preview-visible `/site` directory using the EXISTING `package-lock.json`, e.g. `npm ci --include=dev --no-audit --no-fund` from `/site`. Verify presence of the exact CLI file, and that it is visible from the preview runtime. Do not replace the dependency with a global binary, alter `package.json`/`package-lock.json`, update Wrangler, vendor `node_modules`, or rely on a symlink outside the preview mount. Do not run `npx` with an unpinned package.
5. Retry `sites-preview start` **once**. If the expected module is still absent, install cannot complete, or preview runtime remains inaccessible, STOP `PREVIEW_ENV_BLOCKED` with exact environment diagnostics. Do not repeatedly experiment, rewrite app code or weaken test gates.
6. If preview becomes healthy, run only **outstanding** preview gates with new synthetic data: owner-only identity, unauthorized `401`, UI menu/inspector/zoom/drag, conflict 409 recovery, reload and D1 roundtrip, MCP 6 tool discovery unchanged. Distinguish simulated identity/local D1 from actual hosted verification.
7. If ALL required predeploy checks pass, save **one reviewable source candidate** only when it can be done without deployment. STOP. No deploy, no plugin update, no changes to real data or secrets.

## Avoid repeated Work use

Do not redo the 18 already successful baseline/release Node checks unless code/dependency lock changed or platform requires them. Do not analyze old user plots or legacy test cases. Report either `PREVIEW_READY_CANDIDATE_SAVED` with source version ID and evidence, or `PREVIEW_ENV_BLOCKED` / a specific existing STOP code.

**Do not misclassify** the preview MODULE_NOT_FOUND as a Graphite UI failure. It is not proof of hosted Site correctness either.
