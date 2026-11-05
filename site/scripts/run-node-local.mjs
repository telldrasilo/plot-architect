/**
 * Node.js local Graphite development entrypoint. Never start this on a VPS:
 * it has no external OAuth/TLS/proxy security model.
 */
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {openGraphiteLocalStorage} from '../src/node_local_storage.mjs';
import {createGraphiteLoopbackServer} from '../src/node_local_server.mjs';
import {localTunnelLaunchOptions} from '../src/node_local_tunnel_launch.mjs';

const path = join(homedir(), '.graphite-local', 'graphite-dev.sqlite');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const token = randomBytes(32).toString('base64url');
const withTunnel = process.argv.includes('--with-tunnel');
if (process.argv.slice(2).some(arg => arg !== '--with-tunnel')) {
  throw new Error('Unsupported local Graphite command-line argument');
}
if (withTunnel && (!process.env.GRAPHITE_TUNNEL_CLIENT_EXE ||
    !process.env.GRAPHITE_TUNNEL_ID || !process.env.CONTROL_PLANE_API_KEY)) {
  throw new Error('Set GRAPHITE_TUNNEL_CLIENT_EXE, GRAPHITE_TUNNEL_ID and CONTROL_PLANE_API_KEY before enabling the local tunnel');
}
const port = process.env.GRAPHITE_LOCAL_PORT === undefined
  ? 8788 : Number(process.env.GRAPHITE_LOCAL_PORT);
let sqlite, gateway, tunnel, stopping = false;
const shutdown = async (error = false) => {
  if (stopping) return;
  stopping = true;
  if (error) process.exitCode = 1;
  if (tunnel && tunnel.exitCode === null && !tunnel.killed) tunnel.kill();
  if (gateway) await gateway.close();
  if (sqlite) sqlite.close();
};
try {
  sqlite = openGraphiteLocalStorage(path);
  // The local owner intentionally uses note → reviewed drafts. Hosted Worker
  // defaults remain unchanged, and the loopback gateway still authenticates
  // every REST/MCP request before exposing the transactional workflow.
  gateway = createGraphiteLoopbackServer({database: sqlite, editorHtml: html,
    token, workflowEnabled: true});
  const url = await gateway.listen(port);
  console.log('\nGraphite LOCAL NODE (not for public deployment)');
  console.log('Editor: ' + url + '/');
  console.log('Database: ' + path);
  console.log('Temporary local access key (keep private): ' + token);
  console.log('The key also authenticates local MCP Bearer calls.');
  console.log('No OpenAI model API calls. No Beget, Sites, D1 or plugin changes.');
  console.log('Stop with Ctrl+C. This key expires when the process exits.\n');
  if (withTunnel) {
    const invocation = localTunnelLaunchOptions({
      clientExe: process.env.GRAPHITE_TUNNEL_CLIENT_EXE,
      tunnelId: process.env.GRAPHITE_TUNNEL_ID,
      platformKey: process.env.CONTROL_PLANE_API_KEY,
      localToken: token, localOrigin: url
    });
    tunnel = spawn(invocation.command, invocation.args, invocation.options);
    console.log('Graphite Local tunnel started for the selected NEW tunnel ID.');
    tunnel.on('error', () => {
      console.error('Failed to start tunnel-client: check executable path');
      void shutdown(true);
    });
    tunnel.on('exit', (code, signal) => {
      if (stopping) return;
      console.error('Graphite Local tunnel ended; local server is stopping (' + (code ?? signal ?? 'unknown') + ')');
      void shutdown(true);
    });
  }
} catch (error) {
  console.error('Graphite local startup failed:', error?.message || String(error));
  await shutdown(true);
  process.exitCode = 1;
}
if (gateway?.listening) {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => void shutdown().catch(() => {
      console.error('Failed to stop local Graphite safely');
      process.exitCode = 1;
    }));
  }
}
