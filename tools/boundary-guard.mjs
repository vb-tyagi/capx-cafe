// AGPL open/closed boundary guard for the CLOSED repo (legally-validated boundary, 2026-07-10).
// Fails the build if closed code imports the open fork, vendors fork source, or pulls a copyleft dep.
// Dependency-free; the pure findViolations() is unit-tested in boundary-guard.test.mjs.
//
// 🗄️ DORMANT since P0 (2026-07-14): unwired from `pnpm verify` — the Postiz fork is cold-archived
// (STATE §5.1/§5.5, Option B). This file is intentionally KEPT: run it ad hoc via `pnpm guard`, and
// re-add it to the `verify` script in one line if the fork is ever un-archived. Do not delete.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORK_TOKEN = /(^|[\/'"@ ])(postiz|capx-platform)([\/'"]|$)/i;
const IMPORT_SPECIFIER =
  /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const VENDORED_FORK = /GNU Affero General Public License|Postiz\s*-\s*Social media/i;
const COPYLEFT_DEP = [/agpl/i, /^gpl-/i];

/** Pure checker. `files` = [{ path, content }]. Returns an array of violations. */
export function findViolations(files) {
  const violations = [];
  for (const f of files) {
    // 1) no imports of the open fork
    IMPORT_SPECIFIER.lastIndex = 0;
    let m;
    while ((m = IMPORT_SPECIFIER.exec(f.content)) !== null) {
      const spec = m[1] || m[2] || m[3];
      if (spec && FORK_TOKEN.test(spec)) {
        violations.push({ file: f.path, rule: 'no-fork-import', detail: `imports fork module "${spec}"` });
      }
    }
    // 2) no vendored fork source inside closed code files
    if (/\.(m?[jt]sx?|c[jt]s)$/.test(f.path) && VENDORED_FORK.test(f.content)) {
      violations.push({ file: f.path, rule: 'no-vendored-fork-source', detail: 'contains AGPL/Postiz source header' });
    }
    // 3) no copyleft dependency declared in a closed package.json
    if (f.path.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(f.content);
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        for (const name of Object.keys(deps)) {
          if (COPYLEFT_DEP.some((re) => re.test(name)) || FORK_TOKEN.test(name)) {
            violations.push({ file: f.path, rule: 'no-copyleft-dependency', detail: `dependency "${name}"` });
          }
        }
      } catch {
        /* non-JSON package.json — ignore */
      }
    }
  }
  return violations;
}

const SCAN_DIRS = ['packages', 'services', 'apps', 'tools'];
const CODE_EXT = new Set(['.ts', '.mts', '.cts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json']);
const SKIP = new Set(['node_modules', '.git', 'dist', '.turbo', '.next']);

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP.has(e) || e.includes('boundary-guard')) continue; // the guard never scans itself
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (CODE_EXT.has(extname(p))) acc.push({ path: p, content: readFileSync(p, 'utf8') });
  }
}

function main() {
  const root = process.argv[2] || '.';
  const files = [];
  for (const d of SCAN_DIRS) walk(join(root, d), files);
  const violations = findViolations(files);
  if (violations.length) {
    console.error(`✖ AGPL boundary-guard: ${violations.length} violation(s)`);
    for (const v of violations) console.error(`  [${v.rule}] ${v.file}: ${v.detail}`);
    process.exit(1);
  }
  console.log(
    `✓ AGPL boundary-guard: ${files.length} files clean (no fork imports, no vendored source, no copyleft deps)`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
