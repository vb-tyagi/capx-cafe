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
  const labels = ['How it works', 'Built-in-Safety', 'Pricing', 'Blog', 'Set up capx café'];
  const links = ['/#how', '/#security', '/pricing/', '/blog/', '/#install'];
  for (const [route, html] of pages) {
    for (const name of ['Main navigation', 'Mobile navigation']) {
      const nav = new RegExp(`<nav[^>]*aria-label="${name}"[^>]*>([\\s\\S]*?)<\\/nav>`).exec(html)![1];
      const anchors = [...nav.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
      assert.deepEqual(anchors.map((m) => m[1]), links, `${route}: ${name} links`);
      assert.deepEqual(anchors.map((m) => m[2].replace(/<span[\s\S]*?<\/span>/g, '').trim()), labels, `${route}: ${name} labels`);
    }
  }
});
