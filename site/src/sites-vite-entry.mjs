// Experimental Sites/Vite transport: preserve the REST/MCP/D1 implementation.
// The existing build.mjs remains the baseline; this entry does not modify it.
import runtimeWorker from './worker.mjs';
import html from 'virtual:graphite-html';

export default {
  fetch(request, env, ctx) {
    return runtimeWorker.fetch(request, { ...env, PLOT_HTML: html }, ctx);
  },
};
