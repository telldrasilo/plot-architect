/**
 * Tunnel client's supervised MCP stdio child. This process NEVER opens SQLite.
 * It receives an ephemeral Bearer credential only through its inherited
 * environment from the loopback Graphite parent process.
 */
import {createLocalMcpStdioBridge} from '../src/node_local_mcp_stdio_bridge.mjs';

try {
  createLocalMcpStdioBridge({
    input: process.stdin,
    output: process.stdout,
    targetUrl: process.env.GRAPHITE_LOCAL_MCP_URL,
    token: process.env.GRAPHITE_LOCAL_MCP_TOKEN
  });
} catch {
  // No path, environment variables, credentials or project data in diagnostics.
  process.stderr.write('Graphite local MCP bridge cannot start: missing or invalid local runtime configuration\n');
  process.exitCode = 1;
}
