import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';
import { cloudflare } from '@cloudflare/vite-plugin';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Keep the hosted editor's canonical HTML byte-for-byte, rather than introducing
// a second hand-maintained UI document.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function graphiteHtml() {
  const virtualId = '\0virtual:graphite-html';
  return {
    name: 'plot-architect-raw-editor-html',
    resolveId(id) { if (id === 'virtual:graphite-html') return virtualId; },
    load(id) {
      if (id === virtualId) {
        const html = readFileSync(path.join(projectRoot, 'public/index.html'), 'utf8');
        return 'export default ' + JSON.stringify(html) + ';';
      }
    },
  };
}

export default defineConfig({
  root: projectRoot,
  // ChatGPT Sites local preview uses a fixed local hostname. Never use wildcard hosts.
  server: { allowedHosts: ['terminal.local'] },
  preview: { allowedHosts: ['terminal.local'] },
  plugins: [
    graphiteHtml(),
    sites(),
    cloudflare({ configPath: './wrangler.sites.jsonc', viteEnvironment: { name: 'server' } }),
  ],
  environments: { server: { build: { sourcemap: false } } },
  build: { outDir: 'dist', emptyOutDir: true },
});
