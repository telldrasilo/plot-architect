# Plot Architect / Graphite — instructions for agents

## Goal and sources
Build the private Plot Architect project; do not change unrelated projects. **Documentation serves development, not the reverse.**
- GitHub `main` is the development source, not a byte-identical copy of the deployed ChatGPT Site. Check current `main` before code changes.
- Read only documentation relevant to the task. For design, use the approved UX decisions in Library `/Планировщик сюжета/Development/UX_DESIGN_STANDARD.md`; for a Site release, use [docs/RELEASE_POLICY.md](docs/RELEASE_POLICY.md). Historical `PA_RELEASE_A_*`, `site/docs/`, ZIP files and ledgers are references, **not instructions for new work**.
- Direct recent decisions by the owner take precedence over historical drafts. Ask only when there is a real unresolved product or safety choice.

## Work proportionately
- Ideation, critique and visual exploration: no version audit, changelog entry, PR or release checks required.
- Code: branch from current `main` → narrow PR → applicable tests/CI → merge. Use GitHub PR/commits/CI as the change history; **no mandatory duplicate Library ledger, per-patch ZIP, manual SHA census or documentation status synchronization**.
- Edit a specification only when a durable UX rule, data contract, architecture or decision changes. Never fix historical status wording merely to match today's release. A documentation-only PR need not run unrelated browser/database tests; rely on applicable CI.
- Prefer a small, reviewable change and report actual test outcomes, not inferred ones.

## Protected boundaries
- **No Site deploy, saved Site source modification, sharing change, production D1 write/migration, MCP route/schema change or Plugin Skill change without explicit owner authorization for that action.** GitHub merge alone authorizes none of these.
- Ordinary releases update the **existing** Site using native OpenAI Sites/Vite Save version → Deploy version and unchanged native auth/D1 binding. A **new** private Site is permitted only under a newer explicit owner decision; use [docs/PA_NEW_SITE_BOOTSTRAP.md](docs/PA_NEW_SITE_BOOTSTRAP.md) for that one-time clean install. Never invent authentication, preflight, migration or a Wrangler deployment path. For ordinary updates use [docs/RELEASE_POLICY.md](docs/RELEASE_POLICY.md).
- Keep owner-only access, existing `DB`, relevant MCP contracts and editorial data safe. Do not fake login headers or weaken authentication. Local mock identity does not prove production identity; code rollback does not restore D1.
- No credentials, user plots or dumps in GitHub. Never use Work to recover, copy, preserve or migrate old/test stories (PA-WORK-GUARD-01); stop if a task depends on it. Use synthetic test data when permitted.
- Never alter old test evidence to obtain a green CI result.

Use official platform documentation when an operation depends on Sites, its bindings, authentication, or deployment. Otherwise do not perform platform checks just to satisfy a document.
