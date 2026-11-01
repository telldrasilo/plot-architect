# PA-RELEASE-A: exact two-file hosted v3 overlay

STATUS: PREDEPLOY CANDIDATE ONLY. No authorization to publish or mutate D1.

Hosted Site version: 3; source f4ab5397ea2ac7e5b1c6804ae5a169acc7468089; deployment appgdep_6ae72bc3affc8191bb43ff3843cf616e.
Verified source capture: Library libfile_6c90d4394e2081919441b279325657cb. Manifest: 43/43 SHA-256 verified. D1 binding DB and six MCP tools.

Exactly two Site files change, when current hosted source still matches the captured v3 hashes:
- src/editor.js: old SHA256 1cb883b2f7a6604901f30769f087c3149b0ec5d5a6ea3b3e8530eee88c5d1c99; candidate SHA256 0058de01b8b67c92d81cd1e36492b6940d728b7553848005d8e3e7ffdf608d7b.
- public/index.html: old SHA256 3135547ded551263dc3d697accb3f9bde523584a226f23eb9da4f7e1d0982430; candidate SHA256 e00f37abb1e1b2d83195a52665df93491287293b0c9a75f78a6c20e807fb427c.

Preserve all other 41 source files byte-for-byte. Especially preserve hosted src/mcp_server.mjs: it implements server/discover and version 2026-07-28, which local MCP does not. No REST, auth, plugin, D1 schema, migration, or access-policy changes. UI edits: UX-013/014/015/016 with local-only event rewrite blocked on connected Site. Cold start creates a blank project rather than importing a demonstration plot.

Local evidence: source and HTML match; syntax, build and 15 REST/MCP Node tests pass. UX browser suites pass. A mocked-api browser test confirms blank first connection, note PUT and reload. Workerd dependencies were not available locally; real hosted D1 and identity are NOT VERIFIED.

Work step: verify current source AND deployed version, exact old file hashes, then copy only the two pinned GitHub files. Verify all other files still match v3. Run platform build, synthetic preview and security checks. If any drift, incompatibility or test failure, STOP and report; do not research or broaden scope. Save one reviewable source candidate only if it does not deploy automatically. No deployment without separate explicit approval. Never read, migrate or restore legacy test plots.
