/**
 * Node.js local Graphite development entrypoint. Never start this on a VPS:
 * it has no external OAuth/TLS/proxy security model.
 */
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {openGraphiteLocalStorage} from '../src/node_local_storage.mjs';
import {createGraphiteLoopbackServer} from '../src/node_local_server.mjs';

const path = join(homedir(), '.graphite-local', 'graphite-dev.sqlite');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const token = randomBytes(32).toString('base64url');
const port = process.env.GRAPHITE_LOCAL_PORT === undefined
  ? 8788 : Number(process.env.GRAPHITE_LOCAL_PORT);
let sqlite, gateway;
try {
  sqlite = openGraphiteLocalStorage(path);
  gateway = createGraphiteLoopbackServer({database: sqlite, editorHtml: html, token});
  const url = await gateway.listen(port);
  console.log('\nGraphite LOCAL NODE (not for public deployment)');
  console.log('Editor: ' + url + '/');
  console.log('Database: ' + path);
  console.log('Temporary local access key (keep private): ' + token);
  console.log('The key also authenticates local MCP Bearer calls.');
  console.log('No OpenAI API calls. No Beget, Sites, D1 or plugin changes.');
  console.log('Stop with Ctrl+C. This key expires when the process exits.\n');
} catch (error) {
  console.error('Graphite local startup failed:', error?.message || String(error));
  if (gateway) await gateway.close();
  if (sqlite) sqlite.close();
  process.exitCode = 1;
}
if (gateway?.listening) {
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await gateway.close();
    sqlite.close();
  };
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => void shutdown().catch(error => {
      console.error('Failed to stop local Graphite:', error?.name || 'Error');
      process.exitCode = 1;
    }));
  }
}
