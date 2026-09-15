import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFile(join(root, 'src', name), 'utf8');
const sections = ['header', 'hero', 'workflow', 'security', 'skills', 'install', 'footer'];
const html = [
  '<!doctype html>\n<html lang="en">\n<head>',
  await read('head.html'),
  '<style>', await read('tokens.css'), await read('base.css'), '</style>\n</head>\n<body>',
  '<a class="skip-link" href="#main">Skip to content</a>',
  await read('header.html'), '<main id="main">',
  ...(await Promise.all(sections.slice(1, -1).map((name) => read(`${name}.html`)))),
  '</main>', await read('footer.html'),
  '<script>', await read('interactions.js'), '</script>\n</body>\n</html>\n',
].join('\n');
await writeFile(join(root, 'index.html'), html);
console.log(`Built landing/index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
