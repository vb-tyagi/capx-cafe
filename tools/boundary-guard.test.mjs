import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findViolations } from './boundary-guard.mjs';

test('clean files pass', () => {
  const v = findViolations([
    { path: 'packages/canteen/src/orchestrator.ts', content: "import { runGauntlet } from '../../casserole/src/index.ts';" },
    { path: 'packages/core/package.json', content: '{"name":"@capx/core","dependencies":{}}' },
  ]);
  assert.equal(v.length, 0);
});

test('flags a closed file importing the open fork', () => {
  const v = findViolations([{ path: 'packages/loops/src/x.ts', content: "import { Foo } from 'postiz/dist/foo';" }]);
  assert.ok(v.some((x) => x.rule === 'no-fork-import'));
});

test('flags vendored fork source header', () => {
  const v = findViolations([{ path: 'packages/x/src/y.ts', content: '// Postiz - Social media schedule tool\nexport const x = 1;' }]);
  assert.ok(v.some((x) => x.rule === 'no-vendored-fork-source'));
});

test('flags a copyleft dependency in a closed package.json', () => {
  const v = findViolations([{ path: 'packages/x/package.json', content: '{"dependencies":{"some-agpl-lib":"^1.0.0"}}' }]);
  assert.ok(v.some((x) => x.rule === 'no-copyleft-dependency'));
});
