// Landing-page asset integrity — wired into `pnpm run verify` so a broken image can never ship again.
// Guards three past incidents:
//   1. STRETCHED IMAGE (2026-08-29): an <img> carried width/height attributes while the CSS set only
//      width — the browser kept the attribute height and distorted the render. Guard: the stylesheet
//      must keep the global `img{max-width:100%;height:auto}` rule, and every width/height attribute
//      pair must match the actual file's aspect ratio.
//   2. MISSING LOCAL ASSETS (favicon 404s, Jul 2026): every local src/href the page references must
//      exist on disk.
//   3. Accidental re-bloat of the hero media (2.3 MB PNG): no referenced raster may exceed 600 KB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LANDING = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(LANDING, 'index.html'), 'utf8');

/** width/height straight from the binary header — PNG IHDR or JPEG SOFn. */
function imageDims(path: string): { w: number; h: number } | null {
  const buf = readFileSync(path);
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf.readUInt16BE(0) === 0xffd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) break;
      const marker = buf[off + 1];
      const size = buf.readUInt16BE(off + 2);
      // SOF0..SOF15 except DHT(C4)/JPGA?(C8)/DAC(CC) carry dimensions.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      off += 2 + size;
    }
  }
  return null;
}

/** every local (non-http, non-#, non-mailto) src/href referenced by the page. */
function localRefs(): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|#|mailto:|\/\/)/.test(ref)) continue;
    out.add(ref.replace(/^\//, '').split(/[?#]/)[0]);
  }
  return [...out];
}

test('the global image aspect-ratio guard stays in the stylesheet', () => {
  assert.match(html, /img\{max-width:100%;height:auto\}/, 'img{max-width:100%;height:auto} guard was removed — stretched images become possible again');
});

test('every local asset the page references exists on disk', () => {
  const missing = localRefs().filter((ref) => !existsSync(join(LANDING, ref)));
  assert.deepEqual(missing, [], `page references missing files: ${missing.join(', ')}`);
});

test('every <img> width/height attribute pair matches the real file aspect ratio', () => {
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const src = /src="([^"]+)"/.exec(tag)?.[1];
    const w = /\bwidth="(\d+)"/.exec(tag)?.[1];
    const h = /\bheight="(\d+)"/.exec(tag)?.[1];
    if (!src || /^https?:/.test(src)) continue;
    if ((w && !h) || (h && !w)) assert.fail(`${src}: width/height must be set together (got one of the two)`);
    if (!w || !h) continue; // no reservation attrs — the CSS guard alone governs
    const dims = imageDims(join(LANDING, src.replace(/^\//, '')));
    assert.ok(dims, `${src}: unreadable image header`);
    const attrRatio = Number(w) / Number(h);
    const fileRatio = dims.w / dims.h;
    assert.ok(
      Math.abs(attrRatio - fileRatio) / fileRatio < 0.01,
      `${src}: width/height attrs (${w}x${h}) do not match the actual image (${dims.w}x${dims.h}) — this is exactly the stretched-hero bug`,
    );
  }
});

test('no referenced raster exceeds 600 KB (keeps the hero light forever)', () => {
  const heavy = localRefs()
    .filter((r) => /\.(png|jpe?g|gif|webp)$/i.test(r))
    .map((r) => ({ r, kb: Math.round(statSync(join(LANDING, r)).size / 1024) }))
    .filter((x) => x.kb > 600);
  assert.deepEqual(heavy, [], `oversized images referenced by the page: ${heavy.map((x) => `${x.r} (${x.kb}KB)`).join(', ')}`);
});
