# landing/ — the capx café website

Live at **https://capx-cafe.vercel.app** (Vercel project `capx-cafe`, static, no framework).
Ten pages: `/`, `/pricing/`, `/blog/` and seven articles. Redesigned by the founder, shipped 2026-09-16.

## How it is built
```
src/                 the sources — edit these, never the generated HTML
  head.html          shared <head> tags only (charset, viewport, theme-color, icons, font preloads)
  header.html        nav: How it works · Built-in-Safety · Pricing · Blog · GitHub ↗ · Set up capx café (CTA)
  hero|workflow|security|skills|install.html   homepage sections, in that order
  pricing.html       the pricing page
  posts.mjs          the seven articles (title, deck, category, body, sources, related)
  meta.mjs           per-page <title>, meta description, social title/description, og:type + shared
                     settings (site name, locale, robots, the share image). The build refuses a route
                     that has no entry here.
  footer.html · tokens.css · base.css · pages.css · interactions.js
build.mjs            inlines everything into index.html, pricing/index.html, blog/…/index.html,
                     sitemap.xml and robots.txt. Generated files ARE committed (they are the deploy).
test/assets.test.ts  every referenced asset exists, <img> width/height match the file, rasters ≤ 600 KB,
                     the img{max-width:100%;height:auto} rule stays
test/pages.test.ts   ten routes, unique metadata, nav order, tags == meta.mjs, share image == its tags
```
Rebuild + check: `node landing/build.mjs && pnpm run verify` (from the repo root). A clean
`git status` after a rebuild proves the committed HTML matches the sources.

Local preview: `cd landing && python3 -m http.server 4736` (project port; `.claude/launch.json`).

## Metadata and link previews
`src/meta.mjs` holds the search title, meta description, social title and social description for every
page (sentence case; brand always "capx café"; "(prev. Twitter)" kept on purpose; "capx cafe MCP"
without the accent is intentional). The homepage social title is deliberately the original positioning
line, "Let your AI run your X (prev. Twitter)." — it matches the share image.

**Share image:** `assets/capx-cafe-social-v3.jpg`, 1200×630 JPEG (≤ 600 KB), used by all ten pages via
`og:image` / `twitter:image` (card `summary_large_image`) and the article JSON-LD. To replace it, export
a new JPEG at 1200×630, give it a **new filename** (platforms cache cards per URL for days), update
`site.image` in `src/meta.mjs`, rebuild; the test checks the file's real dimensions against the tags.
Master artwork lives outside the repo (founder). The old `assets/social-preview.jpg` is kept so cards
cached before 2026-09-17 keep rendering.

The GitHub repository uses the same image as its social preview (Settings → General → Social preview,
uploaded 2026-09-17) and its About text was set the same day.

## Deploy
Production deploys are manual and founder-approved:
```
cd landing && vercel deploy --prod --yes
```
The Vercel project is **not** git-connected — pushing to `main` deploys nothing. `.vercelignore` keeps
`src/`, `test/`, `build.mjs` and the raster masters out of the upload. After a deploy, compare the live
pages to the local build (they should be byte-identical) and fetch the share image as a crawler.
Rollback: `vercel rollback <deployment-id>` (previous production ids are in the Vercel dashboard).

## Article credit
Every article credits **Vaibhav Tyagi** (byline, `meta author`, JSON-LD `author` and `publisher` as a
Person). Never an organisation.
