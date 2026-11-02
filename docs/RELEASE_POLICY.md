# Plot Architect — release policy (only for hosted releases)

This policy is **not** a prerequisite for brainstorming, local UX changes, or ordinary code PRs. The GitHub `main` branch is a development source; a running ChatGPT Site is an independent deployed state. Use native GitHub and OpenAI Sites mechanisms, not custom infrastructure. A separately approved **fresh private Site** uses [PA_NEW_SITE_BOOTSTRAP.md](PA_NEW_SITE_BOOTSTRAP.md) for initial provisioning; the ordinary release procedure below applies to later updates.

**Last evidenced private deployment:** v4, deployment `appgdep_6ae8284035b48191a6603d203cd6def5` (`succeeded`), existing owner-only Site. Evidence and partial acceptance: [PA_RELEASE_A_V4_RELEASE_RESULT.md](PA_RELEASE_A_V4_RELEASE_RESULT.md). Query Sites for the **current** deployment when performing a new release; this pointer is not a live monitor.

## Ordinary release procedure

1. **Scope.** Identify UI, MCP/backend, D1 schema, or Plugin Skill changes and explicit owner authorization. Start from reviewed GitHub PR, merged commit and passing **applicable** CI. Do not recapture past releases or old stories.
2. **Reconcile affected source.** Check the existing Site's current version/deployment and only the hosted files and contracts relevant to the change. The repo is not a production mirror. Keep hosted-only REST/auth/D1/MCP files and migrations untouched in UI-only releases. Stop for unexplained conflicting changes or data incompatibility, not differences in historical docs.
3. **Save.** Apply the narrow approved patch using official Sites/Vite tools on the **existing private Site** and use **Save version**. Record the saved version ID. Do not deploy a whole GitHub worktree blindly or substitute a local Wrangler D1 identifier for the host binding.
4. **Deploy only when separately authorized.** Verify the intended saved version, owner-only audience, existing named `DB` binding, relevant MCP contract and **actual** platform warnings for migrations or storage replacement. A real unsafe change/warning means stop; do not demand undocumented internal D1 preflight or bypass native controls. Use **Sites → Deploy version**, not raw Wrangler. New D1 migration, MCP semantics or Plugin Skill changes need explicit additional approval.
5. **Targeted acceptance.** Record status, version/deployment ID and URL; verify live owner identity, affected UI flow, DB/MCP behaviour **as relevant to the change**. Record any inaccessible check as **unverified**, not passed. Never read old plots or write production D1 without permission. Code rollback does **not** roll back D1.
6. **Record once.** The PR plus a brief release result are sufficient. Update one short current-status pointer **only if its operational information actually changed**. Do not append a duplicate Library ledger entry, rehash all historical files or create a documentation reconciliation project.

## Risk-based checks

| Change type | What is required |
| --- | --- |
| Local UI / text only | Targeted tests and normal PR/CI; **no hosted release checks** |
| Hosted UI patch | Reconcile relevant UI files, preserve hosted auth/DB/MCP; native private release, affected-flow smoke test |
| MCP/API semantics or persisted graph | Verify contracts, compatibility, relevant auth and synthetic roundtrip; explicit approval and separate release scope |
| D1 migration / destructive data operation | Separate explicit approval, additive/migration safety review, isolated synthetic transaction/CAS tests and recovery plan; STOP on unexpected changes |
| Plugin Skill only | Use authorized Plugin Creator procedure; no Site deploy unless Site source actually changes |

## Minimal Work handoff, only when the native Site operation is unavailable here

```text
Existing private Plot Architect Site — native Sites operation only.
GitHub PR / merge commit: <link / SHA>. Changed hosted paths: <short list>.
Existing Site/version: <IDs>. Action authorized: <Save only | Save + private Deploy>.
Apply only the approved diff; preserve hosted-only auth, DB, REST and MCP.
Before Deploy check owner-only, same DB, and actual migration/storage warnings.
STOP on conflicting source, actual access/data risk or supported-tool failure.
Do not inspect or migrate old stories or create another Site/plugin.
Return saved/deployed IDs and the checks actually performed.
```

Use Work sparingly for the specific native action, never to rebuild, reread old versions or rescue historical plots. Old `PA_RELEASE_A_*` instructions describe previous releases, **not** a current workflow.

Official references: [Sites management](https://learn.chatgpt.com/docs/sites/managing-a-site), [Sites data and connections](https://learn.chatgpt.com/docs/sites/data-and-connections), [OpenAI Sites Vite plugin](https://github.com/openai/sites/tree/main/packages/sites-vite-plugin).
