# Architectural decisions, PA-SITE-01

- **Graph snapshot + revision journal:** chosen over premature per-node relational tables for an initial single-editor product. Later migrations can normalize schema without changing visual/semantic graph IDs.
- **Soft delete projects:** protects against accidental deletion; UI does not expose server undelete yet.
- **Expected revision on server writes:** no silent last-writer-wins. A stale client receives 409 and preserves its local copy for export.
- **Fields are semantic zones with geometry-based tags:** canonical positions remain part of graph, but changing them never changes edge meaning or event chronology.
- **Presentation state never creates plot facts:** camera, focused nodes and edge aggregates only alter rendering.
- **Portable JSON export:** includes geometry and semantic IDs. Import is additive and validates links.
- **Temporary owner token:** explicit security gate until Sites-native ownership auth is implemented and tested. Site must remain private. Token is server-side secret; do not store it in project JSON.
- **Preserve original Graphite v0.9:** no new visual redesign or node taxonomy during this storage/sync phase.
- **MCP deliberately deferred:** direct read/write tools require a separate permission and consistency review. REST API is available as a documented integration foundation, not an installed ChatGPT connector.
