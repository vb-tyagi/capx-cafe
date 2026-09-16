import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { posts, escapeHtml as esc } from './src/posts.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const origin = 'https://capx-cafe.vercel.app';
const read = (name) => readFile(join(root, 'src', name), 'utf8');
const [head, header, footer, tokens, base, pages, script] = await Promise.all(
  ['head.html', 'header.html', 'footer.html', 'tokens.css', 'base.css', 'pages.css', 'interactions.js'].map(read),
);
const rootAssets = (html) => html.replace(/(src|href)="assets\//g, '$1="/assets/').replaceAll("url('assets/", "url('/assets/");
const readingTime = (post) => Math.max(1, Math.ceil(post.body.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 220));
const postLink = (post) => `/blog/${post.slug}/`;
const routes = [];
function metadata(title, description, route, article) {
  const url = origin + route;
  return head.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*(">)/g, `$1${esc(description)}$2`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*(">)/g, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${url}$2`)
    .replace('content="website"', `content="${article ? 'article' : 'website'}"`)
    + `\n<link rel="canonical" href="${url}">\n`;
}
async function render(route, title, description, content, article) {
  let nav = header;
  const selected = route.startsWith('/blog/') ? '/blog/' : route === '/pricing/' ? route : null;
  if (selected) nav = nav.replaceAll(`href="${selected}"`, `href="${selected}" aria-current="page"`);
  const schema = article ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: article.title,
    description: article.deck, url: origin + route, mainEntityOfPage: origin + route,
    author: { '@type': 'Organization', name: 'capx café', url: origin },
    publisher: { '@type': 'Organization', name: 'capx café', url: origin },
    dateModified: '2026-09-16', image: origin + '/assets/social-preview.jpg', inLanguage: 'en',
  }).replaceAll('<', '\\u003c')}</script>` : '';
  const html = rootAssets([
    '<!doctype html>\n<html lang="en">\n<head>', metadata(title, description, route, article), schema,
    '<style>', tokens, base, pages, '</style>\n</head>\n<body>',
    '<a class="skip-link" href="#main">Skip to content</a>', nav, '<main id="main">', content,
    '</main>', footer, '<script>', script, '</script>\n</body>\n</html>\n',
  ].join('\n'));
  const dir = join(root, route.slice(1));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html);
  routes.push(route);
}

const home = (await Promise.all(['hero','workflow','security','skills','install'].map((name) => read(`${name}.html`)))).join('\n');
await render('/', 'capx café — turn what you ship into what you share', 'Create, schedule, and publish X posts from the coding agent that already understands your work. Your X token stays on the server. Every post passes a guardrail.', home);
await render('/pricing/', 'Pricing — developer access and creator plans | capx café', 'Understand capx café costs: free developer BYO access, self-hosting, and upcoming creator plans from $5/month. Compare allowances, limits, and top-ups.', await read('pricing.html'));

const featured = posts[0];
const blog = `<section class="page-hero blog-hero wrap" aria-labelledby="blog-title"><div><p class="eyebrow">The capx café blog</p><h1 id="blog-title">Good work.<br><em>Good words.</em></h1></div><p class="page-lede">Notes on building, writing, and giving your agent a way to share. Practical guides for the space between shipping something and telling its story.</p></section>
<section class="featured-story wrap" aria-labelledby="featured-title"><a class="featured-art" href="${postLink(featured)}" aria-label="Read: ${esc(featured.title)}"><img src="/assets/cover.jpg" width="1448" height="1086" alt="capx café’s warm retro workspace with a lime-screen computer"></a><div class="featured-copy"><p class="eyebrow">Start here / ${featured.category} · ${readingTime(featured)} min read</p><h2 id="featured-title"><a href="${postLink(featured)}">You shipped it.<br><em>Now tell people<br>what changed.</em></a></h2><p>${esc(featured.deck)}</p><a class="text-link" href="${postLink(featured)}">Read the story <span aria-hidden="true">↗</span></a></div></section>
<section class="blog-list wrap" aria-labelledby="all-stories-title"><h2 id="all-stories-title">More from the café</h2>${posts.slice(1).map((post) => `<article class="story-row"><div class="story-meta"><div class="eyebrow">${post.category}</div><span>${readingTime(post)} min read</span></div><div><h3><a href="${postLink(post)}">${esc(post.title)}</a></h3><p>${esc(post.deck)}</p></div><a class="text-link" href="${postLink(post)}" aria-label="Read: ${esc(post.title)}">Read article <span aria-hidden="true">↗</span></a></article>`).join('\n')}</section>`;
await render('/blog/', 'Blog — building, writing, and agent workflows | capx café', 'Practical guides to MCP, agent setup, guarded X publishing, build updates, and writing in your own voice with capx café.', blog);

for (const post of posts) {
  const headings = [...post.body.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)];
  const related = post.related.map((slug) => {
    const item = posts.find((p) => p.slug === slug);
    if (!item) throw new Error(`Unknown related post: ${slug}`);
    return `<article><p class="eyebrow">${item.category} · ${readingTime(item)} min read</p><h3><a href="${postLink(item)}">${esc(item.title)}</a></h3></article>`;
  }).join('');
  const body = `<article><header class="article-hero wrap"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog/">Blog</a><span aria-hidden="true">/</span><span>${post.category}</span></nav><p class="eyebrow">${post.category}</p><h1>${esc(post.title)}</h1><p class="article-deck">${esc(post.deck)}</p><div class="article-byline"><span>By capx café</span><span>Updated <time datetime="2026-09-16">16 September 2026</time></span><span>${readingTime(post)} min read</span></div></header>
<div class="article-layout wrap"><nav class="article-toc" aria-label="On this page"><p class="eyebrow">In this article</p>${headings.map(([,id,title]) => `<a href="#${id}">${title}</a>`).join('')}</nav><div class="article-body">${post.body}<section class="article-sources" aria-labelledby="sources-title"><h2 id="sources-title">Sources &amp; further reading</h2><ul>${post.sources.map(([label,href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join('')}</ul></section><aside class="article-next"><h3>Try it with your own work.</h3><p>Choose your agent, connect capx café, and start with a preview of one real change.</p><a class="button lime" href="/#install">Set up capx café <span aria-hidden="true">↗</span></a></aside></div></div></article><section class="related-posts wrap" aria-labelledby="related-title"><h2 id="related-title">Keep reading.</h2><div class="related-grid">${related}</div></section>`;
  await render(postLink(post), `${post.title} | capx café`, post.deck, body, post);
}
await writeFile(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `<url><loc>${origin}${route}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
console.log(`Built ${routes.length} pages, sitemap.xml, and robots.txt.`);
