# PA-SITE-01 acceptance and gaps

## Completed on local candidate

- Graphite Canvas interface stays interactive, with fields, node relations, focus, map, edge bridges and undo.
- Multi-project list, create, switch, rename, duplicate, local delete and import/export.
- Local autosave per project; same document reinitialization retains state.
- Worker REST API and schema; creating/modifying/deleting/listing projects; revision history, restore, conflict 409, owner-token rejection.
- Site-client API handshake and autosave verified with mocked HTTP. A forced conflict leaves local changes intact.
- D1 SQL migration exercised using Node SQLite test adapter.

## Not completed / additional live checks

- Site deployment and real account-level private access / auth.
- Live D1 migration in Sites, real HTTP persistence across deployment / browser reload.
- Full production passwordless workspace identity and per-user permissions.
- User study for usability with real stories and cross-device fidelity.
- Full Plot Package 0.2 integration, MCP tools and Xianxia Master runtime.

## Stop conditions for private release

Any unprotected project mutation, dropped node/edge in import/export, silent revision conflict, failure to persist after reload, or incorrect migration is a hard blocker.
