import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://capx-cafe.vercel.app';
const routes = [...readFileSync(join(root, 'sitemap.xml'), 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
const pages = new Map(routes.map((route) => [route, readFileSync(join(root, route.slice(1), 'index.html'), 'utf8')]));

test('every generated route, internal link, anchor, and CSS asset resolves', () => {
  assert.equal(pages.size, 10, 'home, pricing, blog, and seven articles must be generated');
  for (const [route, html] of pages) {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate IDs on ${route}`);
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    refs.push(...[...html.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)].map((m) => m[1]));
    for (const ref of refs) {
      const url = new URL(ref.replaceAll('&amp;', '&'), origin + route);
      if (url.origin !== origin) continue;
      let target = join(root, decodeURIComponent(url.pathname).slice(1));
      assert.ok(existsSync(target), `${route}: missing ${ref}`);
      if (statSync(target).isDirectory()) target = join(target, 'index.html');
      assert.ok(existsSync(target), `${route}: missing index for ${ref}`);
      if (url.hash) {
        const targetHtml = readFileSync(target, 'utf8');
        assert.ok(targetHtml.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${route}: missing anchor ${ref}`);
      }
    }
  }
});

test('every page has unique metadata, one primary heading, and the correct canonical URL', () => {
  const titles = new Set();
  for (const [route, html] of pages) {
    const title = /<title>(.*?)<\/title>/.exec(html)?.[1];
    assert.ok(title && !titles.has(title), `missing or repeated title: ${route}`);
    titles.add(title);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `primary heading: ${route}`);
    assert.ok(html.includes(`<link rel="canonical" href="${origin}${route}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${origin}${route}">`));
    assert.match(html, /<meta name="description" content="[^"]+">/);
    if (route.startsWith('/blog/') && route !== '/blog/') {
      const schema = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)![1]);
      assert.equal(schema['@type'], 'BlogPosting');
      assert.equal(schema.url, origin + route);
    }
  }
});

test('desktop and mobile navigation preserve the agreed labels and order on every page', () => {
  const labels = ['How it works', 'Built-in-Safety', 'Pricing', 'Blog', 'GitHub', 'Set up capx café'];
  const links = ['/#how', '/#security', '/pricing/', '/blog/', 'https://github.com/vb-tyagi/capx-cafe', '/#install'];
  for (const [route, html] of pages) {
    for (const name of ['Main navigation', 'Mobile navigation']) {
      const nav = new RegExp(`<nav[^>]*aria-label="${name}"[^>]*>([\\s\\S]*?)<\\/nav>`).exec(html)![1];
      const anchors = [...nav.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
      assert.deepEqual(anchors.map((m) => m[1]), links, `${route}: ${name} links`);
      assert.deepEqual(anchors.map((m) => m[2].replace(/<span[\s\S]*?<\/span>/g, '').trim()), labels, `${route}: ${name} labels`);
    }
  }
});

test('social/SEO metadata follows src/meta.mjs and the share image really is what the tags claim', async () => {
  const { meta, site } = await import('../src/meta.mjs');
  const imgPath = join(root, site.image.path);
  assert.ok(existsSync(imgPath), `share image missing: ${site.image.path}`);
  assert.ok(statSync(imgPath).size <= 600 * 1024, 'share image over the 600 KB raster cap');
  const buf = readFileSync(imgPath);
  assert.equal(buf.readUInt16BE(0), 0xffd8, 'share image must be a JPEG (og:image:type says so)');
  let off = 2, dims: { w: number; h: number } | null = null;
  while (off + 9 < buf.length && buf[off] === 0xff) {
    const marker = buf[off + 1], size = buf.readUInt16BE(off + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) { dims = { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) }; break; }
    off += 2 + size;
  }
  assert.deepEqual(dims, { w: site.image.width, h: site.image.height }, 'og:image:width/height must match the file');
  assert.equal(site.image.url, `${origin}/${site.image.path}`);
  for (const [route, html] of pages) {
    const m = meta[route];
    assert.ok(m, `no metadata entry for ${route}`);
    const attr = (v: string) => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    assert.ok(html.includes(`<title>${attr(m.title)}</title>`), `${route}: title`);
    assert.ok(html.includes(`<meta name="description" content="${attr(m.description)}">`), `${route}: description`);
    assert.ok(html.includes(`<meta property="og:title" content="${attr(m.socialTitle)}">`), `${route}: og:title`);
    assert.ok(html.includes(`<meta property="og:description" content="${attr(m.socialDescription)}">`), `${route}: og:description`);
    assert.ok(html.includes(`<meta property="og:type" content="${m.type}">`), `${route}: og:type`);
    assert.ok(html.includes(`<meta property="og:image" content="${site.image.url}">`), `${route}: og:image`);
    assert.ok(html.includes(`<meta name="twitter:image" content="${site.image.url}">`), `${route}: twitter:image`);
    assert.ok(html.includes(`<meta name="robots" content="${site.robots}">`), `${route}: robots`);
    assert.ok(html.includes(`<meta property="og:site_name" content="${site.name}">`), `${route}: og:site_name`);
    assert.ok(!html.includes('social-preview.jpg'), `${route}: old share image still referenced`);
    assert.ok(!/twitter:(site|creator)/.test(html), `${route}: twitter:site/creator must stay omitted until handles are confirmed`);
  }
});
