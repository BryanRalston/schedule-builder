/**
 * Root robots.txt + sitemap.xml for GitHub Pages (managerschedulepro.com).
 * Run: node tests/test-seo-robots-sitemap.mjs
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log('  PASS', name, detail ? '— ' + detail : '');
}
function fail(name, detail) {
  results.push({ name, ok: false, detail: String(detail) });
  console.log('  FAIL', name, '—', detail);
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

const MIME = {
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.html': 'text/html',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = join(ROOT, p.replace(/^\//, ''));
      if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

console.log('\n=== SEO robots.txt + sitemap.xml ===');

const robotsPath = join(ROOT, 'robots.txt');
const sitemapPath = join(ROOT, 'sitemap.xml');
if (existsSync(robotsPath) && existsSync(sitemapPath)) pass('files-at-repo-root');
else fail('files-at-repo-root', 'robots.txt and sitemap.xml must sit next to index.html / CNAME');

const robots = existsSync(robotsPath) ? read('robots.txt') : '';
const sitemap = existsSync(sitemapPath) ? read('sitemap.xml') : '';

if (/User-agent:\s*\*/i.test(robots) && /Allow:\s*\//.test(robots) && !/Disallow:\s*\//.test(robots)) {
  pass('robots-allow-all');
} else fail('robots-allow-all', robots.slice(0, 200));

if (robots.includes('Sitemap: https://managerschedulepro.com/sitemap.xml')) {
  pass('robots-sitemap-line');
} else fail('robots-sitemap-line', 'robots.txt must point at https://managerschedulepro.com/sitemap.xml');

const required = [
  'https://managerschedulepro.com/',
  'https://managerschedulepro.com/app/',
  'https://managerschedulepro.com/app/?map=1',
];
const missing = required.filter((u) => !sitemap.includes('<loc>' + u + '</loc>'));
if (!missing.length && sitemap.includes('urlset')) pass('sitemap-required-urls');
else fail('sitemap-required-urls', missing.join(', ') || 'not a urlset');

if (!sitemap.includes('/#can-do')) pass('no-hash-only-urls');
else fail('no-hash-only-urls', 'hash-only landing anchors should not be sitemap URLs');

const sw = read('sw.js');
if (!sw.includes('robots.txt') && !sw.includes('sitemap.xml')) {
  pass('sw-precache-untouched');
} else fail('sw-precache-untouched', 'do not add SEO files to SW precache (avoids cache-version bump)');

const { server, base } = await startStaticServer();
try {
  const robotsRes = await fetch(base + '/robots.txt');
  const sitemapRes = await fetch(base + '/sitemap.xml');
  const robotsBody = await robotsRes.text();
  const sitemapBody = await sitemapRes.text();
  if (robotsRes.status === 200 && /Allow:\s*\//.test(robotsBody)) {
    pass('local-robots-200', String(robotsRes.status));
  } else fail('local-robots-200', robotsRes.status + ' ' + robotsBody.slice(0, 80));
  if (sitemapRes.status === 200 && sitemapBody.includes('<loc>https://managerschedulepro.com/app/?map=1</loc>')) {
    pass('local-sitemap-200', String(sitemapRes.status));
  } else fail('local-sitemap-200', sitemapRes.status + ' ' + sitemapBody.slice(0, 80));
} finally {
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log('\n' + results.filter((r) => r.ok).length + ' passed,', failed.length, 'failed');
if (failed.length) process.exit(1);
