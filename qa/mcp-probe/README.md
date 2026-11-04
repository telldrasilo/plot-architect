# Graphite: Stage 0 external MCP probe (Windows)

This is a **standalone synthetic connectivity experiment** from the
[Graphite Beget/MCP plan](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).
It is **not** the Graphite MCP server and does not use its database, auth,
plots, note tasks or hosted Site. The stdio process has **no network listener**.

Only two tools are exposed:
- `read_probe_value`: read `synthetic-one|synthetic-two` and a revision.
- `write_probe_value`: explicitly set one of those two values after checking
  `expected_revision`. The tool is marked as a write action.

The isolated value is stored in the machine's temporary directory
(`graphite-mcp-stdio-probe.local.json`) or in
`GRAPHITE_MCP_PROBE_STATE_FILE` if set. No other paths are exposed as tools.
There are no required npm dependencies and no credentials in this repository.

## 1. Local test

From an up-to-date repository checkout in PowerShell (Node.js 22+):

```powershell
cd D:\Graphite\plot-architect
git pull
node --test .\qa\mcp-probe\probe.test.mjs
```

Expected: one passing test covering initialize, tools/list, read, rejected
unsanctioned value, one synthetic write, read-after-write, stale revision
rejection and persistence across restart.

**Do not run `server.mjs` and expect a browser page**: it is an MCP
stdio endpoint and should be spawned by `tunnel-client`.

## 2. Secure MCP Tunnel: owner-controlled setup only

Official docs:
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://github.com/openai/tunnel-client/releases/latest
- https://chatgpt.com/plugins

Preconditions: OpenAI Platform organization with tunnel permissions,
a valid runtime Platform API key, an available `tunnel_id`, and ability
to select this tunnel in ChatGPT. Creating a tunnel and test plugin are
**separate explicit owner actions**, not performed by repository commits.

1. Open Platform tunnel settings linked from the official tunnel docs.
   Create/select a private tunnel associated with your intended personal
   Platform organization / ChatGPT account. Record the **tunnel ID only**.
   Do **not** share any API key or authorization token in chat, screenshots,
   GitHub, or configuration files.
2. Install the official Windows `tunnel-client` from the latest release.
   Check `tunnel-client help quickstart` for your installed version.
3. In PowerShell, from the repository root, configure the **current shell
   only**. Enter the runtime API key locally via a hidden prompt:

```powershell
$secureKey = Read-Host "Tunnel runtime API key (not for chat)" -AsSecureString
$env:CONTROL_PLANE_API_KEY = [System.Net.NetworkCredential]::new("", $secureKey).Password
Remove-Variable secureKey

$tunnelId = "REPLACE_WITH_YOUR_TUNNEL_ID"
$serverPath = (Resolve-Path ".\qa\mcp-probe\server.mjs").Path
tunnel-client init --sample sample_mcp_stdio_local --profile graphite-probe --tunnel-id $tunnelId --mcp-command "node `"$serverPath`""
tunnel-client doctor --profile graphite-probe --explain
tunnel-client run --profile graphite-probe
```

Follow the official client help if flags/configuration have changed. The
tunnel client must remain running for tool discovery and calls; it starts
the local MCP stdio process on demand. OpenAI-side tunnel transport is
authenticated with the runtime key; this tiny local synthetic MCP does
not implement standalone OAuth and **must never be exposed on a public
HTTP endpoint**. Do not use it with real data.

4. In ChatGPT Plugins select **Add custom MCP server → Tunnel**, use the
   same tunnel ID, choose the available **No authentication** option for
   this *synthetic tunnel-only test*, review the risk warning and create
   a **separate private test plugin** (e.g. `Graphite MCP Probe`).
   Do not edit or replace the real Graphite plugin.
5. In a new conversation, select the probe plugin:
   - Call `read_probe_value`; note `value` and `revision`.
   - With your explicit approval, call `write_probe_value` with
     `value="synthetic-two"` and the revision just read.
   - Call `read_probe_value` again; verify the revision advanced
     by one and `value="synthetic-two"`.
   - Verify an invalid or stale write cannot change the value.

## 3. Report results and stop conditions

Record `TOOLS_DISCOVERY`, `READ`, `WRITE`, `READ_AFTER_WRITE` as
`PASS | FAIL | NOT_VERIFIED`; separately record the user confirmation
experience. A local passing test only proves the probe, **not** ChatGPT's
ability to use an external writable MCP or the viability of Beget.

If tunnel creation, ChatGPT permissions, OAuth selection, tool discovery
or write calls are unavailable, record the exact blocker and **stop**.
Do not expose the Graphite QA Worker or use unauthorized port forwarding.

Afterwards stop `tunnel-client`, remove the test plugin/tunnel if no
longer needed, and clear the shell's key:

```powershell
Remove-Item Env:\CONTROL_PLANE_API_KEY
```

Deleting the synthetic temporary JSON state is optional. No real Graphite
projects or databases are touched by this experiment.
