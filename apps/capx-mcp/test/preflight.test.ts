// Preflight on the BYO Client ID. Every case here is a failure we hit or expect: X answers a bad
// client_id with an opaque error page, so a wrong value otherwise costs a confusing browser round-trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preflightClientId } from '../src/mcp.ts';

test('catches the placeholder — the exact failure that bit us in this project', () => {
  // The literal string we shipped in .mcp.json. It produced a consent URL X could only reject.
  assert.match(preflightClientId('PASTE_YOUR_X_CLIENT_ID_HERE') ?? '', /placeholder/i);
  assert.match(preflightClientId('your_client_id_here') ?? '', /placeholder/i);
  assert.match(preflightClientId('xxxxxxxxxxxxxxxx') ?? '', /placeholder/i);
});

test('catches the common paste mistakes', () => {
  assert.match(preflightClientId('') ?? '', /No X Client ID/);
  assert.match(preflightClientId('   ') ?? '', /No X Client ID/);
  assert.match(preflightClientId('https://developer.x.com/en/portal') ?? '', /looks like a URL/);
  assert.match(preflightClientId('abc def123456') ?? '', /space/);
  assert.match(preflightClientId('short') ?? '', /too short/);
  // an API Secret / Bearer token is far longer than a Client ID
  assert.match(preflightClientId('A'.repeat(120)) ?? '', /too long/);
  assert.match(preflightClientId('has$weird%chars!!') ?? '', /unexpected characters/);
});

test('accepts a REAL X OAuth2 client id', () => {
  // the actual shape X issues (this is @vb_tyagi's real, non-secret public client id)
  assert.equal(preflightClientId('WDVwdkhuc01kY3J1OGxWVnBaMUQ6MTpjaQ'), null);
  assert.equal(preflightClientId('  WDVwdkhuc01kY3J1OGxWVnBaMUQ6MTpjaQ  '), null, 'tolerates stray whitespace');
});
