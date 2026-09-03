// The version the server reports in `initialize` (serverInfo.version) — ONE source: package.json.
//
// The published `capx-cafe` package is a single esbuild bundle whose package.json is generated at build
// time, so a runtime `readFileSync('../package.json')` would be a fragile path guess once installed.
// build.mjs therefore stamps pkg.version in as the __CAPX_VERSION__ constant (esbuild `define`). From
// source (dev / tests) that constant is undefined and we read this package's own package.json instead.
import { readFileSync } from 'node:fs';

const DEV_FALLBACK = '0.0.0-dev';

function versionFromPackageJson(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string };
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : DEV_FALLBACK;
  } catch {
    return DEV_FALLBACK;
  }
}

export const CAPX_VERSION: string = typeof __CAPX_VERSION__ === 'string' ? __CAPX_VERSION__ : versionFromPackageJson();
