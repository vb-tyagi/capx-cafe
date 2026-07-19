// Phase 4 media: the chunked X uploader (INIT->APPEND->FINALIZE->STATUS) and the MediaGateway that
// admits + uploads inside vault.withToken. casserole never runs here — media is not moderated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { MediaGateway } from '../src/media/index.ts';
import { httpXMediaUploader } from '../src/xclient/index.ts';
import type { FetchLike, MinimalResponse, XMediaUploader } from '../src/xclient/index.ts';

const NOW = 1_700_000_000_000;
const noSleep = async (): Promise<void> => {};
const ok = (body: unknown): MinimalResponse => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

function recordingFetch(script: MinimalResponse[]) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body });
    return script.shift() ?? ok({});
  };
  return { fetchImpl, calls };
}

test('httpXMediaUploader: an image runs INIT -> APPEND -> FINALIZE and returns the media id', async () => {
  const { fetchImpl, calls } = recordingFetch([
    ok({ media_id_string: 'M123' }), // INIT
    ok({}), // APPEND 0
    ok({ media_id_string: 'M123' }), // FINALIZE (no processing_info -> done)
  ]);
  const out = await httpXMediaUploader(fetchImpl, { sleep: noSleep })({
    accessToken: 't', bytes: new Uint8Array([1, 2, 3]), mediaType: 'image/png', category: 'tweet_image',
  });
  assert.equal(out.mediaId, 'M123');
  assert.equal(calls.length, 3);
  assert.match(calls[0]?.body ?? '', /command=INIT/);
  assert.match(calls[1]?.body ?? '', /command=APPEND/);
  assert.match(calls[2]?.body ?? '', /command=FINALIZE/);
});

test('httpXMediaUploader: large media makes multiple ordered APPEND segments', async () => {
  const { fetchImpl, calls } = recordingFetch([ok({ media_id_string: 'M2' }), ok({}), ok({}), ok({ media_id_string: 'M2' })]);
  await httpXMediaUploader(fetchImpl, { chunkBytes: 2, sleep: noSleep })({
    accessToken: 't', bytes: new Uint8Array([1, 2, 3, 4]), mediaType: 'image/jpeg', category: 'tweet_image',
  });
  const appends = calls.filter((c) => /command=APPEND/.test(c.body ?? ''));
  assert.equal(appends.length, 2, '4 bytes / 2-byte chunks = 2 APPENDs');
  assert.match(appends[0]?.body ?? '', /segment_index=0/);
  assert.match(appends[1]?.body ?? '', /segment_index=1/);
});

test('httpXMediaUploader: a video polls STATUS until processing succeeds', async () => {
  const { fetchImpl, calls } = recordingFetch([
    ok({ media_id_string: 'V1' }), // INIT
    ok({}), // APPEND
    ok({ media_id_string: 'V1', processing_info: { state: 'pending', check_after_secs: 0 } }), // FINALIZE
    ok({ processing_info: { state: 'in_progress', check_after_secs: 0 } }), // STATUS 1
    ok({ processing_info: { state: 'succeeded' } }), // STATUS 2
  ]);
  const out = await httpXMediaUploader(fetchImpl, { sleep: noSleep })({
    accessToken: 't', bytes: new Uint8Array([9]), mediaType: 'video/mp4', category: 'tweet_video',
  });
  assert.equal(out.mediaId, 'V1');
  assert.equal(calls.filter((c) => /command=STATUS/.test(c.url)).length, 2);
});

test('httpXMediaUploader: throws on a failed INIT', async () => {
  const fetchImpl: FetchLike = async () => ({ ok: false, status: 400, json: async () => ({}), text: async () => 'bad' });
  await assert.rejects(
    () => httpXMediaUploader(fetchImpl, { sleep: noSleep })({ accessToken: 't', bytes: new Uint8Array([1]), mediaType: 'image/png', category: 'tweet_image' }),
    /INIT/,
  );
});

async function gatewaySetup(upload: XMediaUploader) {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  const admission = new Admission(store, new HmacSessionSigner('sign-key', 15 * 60_000, 12 * 60 * 60_000));
  await store.addAllowlisted('h_abc');
  await vault.put(
    { emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD', verified: true, createdAtMs: 1_600_000_000_000 },
    { access: 'atok', refresh: 'rtok' },
  );
  const media = new MediaGateway({ admission, vault, upload, now: () => NOW });
  return { media, bearer: admission.issueSession('h_abc', NOW) };
}

test('MediaGateway uploads inside withToken and returns the media id', async () => {
  let seenToken = '';
  const { media, bearer } = await gatewaySetup(async ({ accessToken }) => {
    seenToken = accessToken;
    return { mediaId: 'MG1' };
  });
  const r = await media.uploadMedia({ bearer, bytes: new Uint8Array([1, 2]), mediaType: 'image/png', category: 'tweet_image' });
  assert.equal(r.mediaId, 'MG1');
  assert.equal(seenToken, 'atok', 'the gateway passed the DECRYPTED token to the uploader');
});

test('MediaGateway rejects an unadmitted bearer and empty bytes, uploading nothing', async () => {
  let called = false;
  const { media, bearer } = await gatewaySetup(async () => {
    called = true;
    return { mediaId: 'x' };
  });
  assert.ok((await media.uploadMedia({ bearer: 'bogus', bytes: new Uint8Array([1]), mediaType: 'image/png', category: 'tweet_image' })).rejected);
  assert.ok((await media.uploadMedia({ bearer, bytes: new Uint8Array([]), mediaType: 'image/png', category: 'tweet_image' })).rejected);
  assert.equal(called, false, 'no upload attempted for a rejected or empty request');
});
