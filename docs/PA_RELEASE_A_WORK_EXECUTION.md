# PA-RELEASE-A — Work routing after exact Site v3 capture

**Current status (2026-11-02): PREVIEW_ENV_BLOCKED — no more Work retries authorized.** The retry instruction in this file is superseded by the final status in [PA_RELEASE_A_PREVIEW_RECOVERY.md](./PA_RELEASE_A_PREVIEW_RECOVERY.md). Local Wrangler GitHub Actions smoke passed; ChatGPT Sites preview remains inaccessible. Escalate the platform issue rather than launching another Work task.

**SUPERSEDED:** the earlier broad architecture-reconciliation assignment is no longer the active Work task. Do **not** independently analyze or reconcile the project.

The current bounded Work task is in [PA_RELEASE_A_HOSTED_V3_EXACT_PATCH.md](./PA_RELEASE_A_HOSTED_V3_EXACT_PATCH.md). Exact prepared candidate files + SHA256 manifest are in Library:
`/Планировщик сюжета/Development/04_Hosted_and_MCP/PA_RELEASE_A_V3_20261101/`.

- Captured Site: saved/deployed v3, commit `f4ab5397ea2ac7e5b1c6804ae5a169acc7468089`.
- Reviewed Git source: main commit `478e76dd27c4f212da162a7419e6086ad8a07216`.
- Overlay only `src/editor.js` and `public/index.html`, **after checking their captured hashes and that source/deployment have not changed**.
- Preserve all other 41 hosted source files, including MCP, auth, D1 and migration metadata; do not touch any old test plot.
- Run bounded synthetic predeploy checks and save a candidate if it can be saved without deploying.
- **No deployment, Site publication or plugin mutation authorized.** STOP if drift, failure or unsupported candidate-only save.

The previous task was planning context, not an instruction to expand Work's scope.
