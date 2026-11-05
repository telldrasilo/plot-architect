/**
 * Safe launch contract for the official tunnel-client.
 *
 * No local secret or Platform key is placed in argv. The tunnel-client process
 * and its supervised stdio child inherit only their runtime environment.
 * Never install/update a ChatGPT connector here.
 */
import {isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertLocalMcpUrl} from './node_local_mcp_stdio_bridge.mjs';

const tunnelIdPattern = /^tunnel_[A-Za-z0-9_]{20,100}$/;

export function localTunnelLaunchOptions({
  clientExe, tunnelId, platformKey, localToken, localOrigin,
  inheritedEnv = process.env
} = {}) {
  if (typeof clientExe !== 'string' || !isAbsolute(clientExe) ||
    /[\r\n]/.test(clientExe)) {
    throw new TypeError('GRAPHITE_TUNNEL_CLIENT_EXE must be an absolute executable path');
  }
  if (typeof tunnelId !== 'string' || !tunnelIdPattern.test(tunnelId)) {
    throw new TypeError('A separate Graphite Local tunnel ID is required');
  }
  if (typeof platformKey !== 'string' || !/^sk-[^\s]{30,}$/.test(platformKey)) {
    throw new TypeError('CONTROL_PLANE_API_KEY must be set in this PowerShell session');
  }
  if (typeof localToken !== 'string' || localToken.length < 40) {
    throw new TypeError('Ephemeral local access key required');
  }
  const targetUrl = assertLocalMcpUrl(localOrigin + '/mcp');
  const bridge = fileURLToPath(new URL('../scripts/mcp-local-stdio.mjs', import.meta.url))
    .replaceAll('\\', '/');
  if (/[\r\n"']/.test(bridge)) throw new TypeError('Unsupported MCP bridge path');
  const command = 'node "' + bridge + '"';
  const env = {...inheritedEnv};
  // Explicit flags below take precedence; prevent inherited profile/channel
  // settings from redirecting the new local-only connector elsewhere.
  for (const key of [
    'TUNNEL_CLIENT_PROFILE', 'TUNNEL_CLIENT_PROFILE_FILE',
    'TUNNEL_CLIENT_CONFIG', 'MCP_SERVER_URL', 'MCP_COMMAND'
  ]) delete env[key];
  env.CONTROL_PLANE_API_KEY = platformKey;
  env.GRAPHITE_LOCAL_MCP_URL = targetUrl;
  env.GRAPHITE_LOCAL_MCP_TOKEN = localToken;
  const args = [
    'run', '--control-plane.tunnel-id', tunnelId,
    '--mcp.command', command
  ];
  return {command: clientExe, args, options: {env, stdio: 'inherit', windowsHide: true}};
}
