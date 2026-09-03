// Build-time constants stamped into the single-file dist bundle by build.mjs (esbuild `define`).
// In dev (node --experimental-strip-types) nothing defines them, so every consumer MUST guard with
// `typeof X !== 'undefined'` and fall back — see src/version.ts.

/** pkg.version of apps/capx-mcp, injected by build.mjs; undefined when running from source. */
declare const __CAPX_VERSION__: string | undefined;
