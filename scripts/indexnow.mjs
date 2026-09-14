// Submits changed public URLs to IndexNow (Bing, Yandex, Naver, Seznam share
// one endpoint). Bing's index is what ChatGPT search reads, so a new guide
// reaches ChatGPT minutes after deploy instead of whenever Bing recrawls.
//
// Usage (from the GitHub Action, after the Cloudflare deploy has had time to land):
//   node scripts/indexnow.mjs <beforeSha> <afterSha>
// With no shas, or a zero "before" sha (force push / first push), every URL in
// sitemap.xml is submitted instead.
//
// The key is public by design: IndexNow verifies ownership by fetching
// https://silage.khamarvest.com/<key>.txt, so the key file at the repo root
// MUST contain exactly this key. npm run check asserts that.
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export const INDEXNOW_KEY = 'a7f3c9e1b2d84f6a9c0e5d7b3f1a8c2e';
const site = 'https://silage.khamarvest.com';

// Repo files that are HTML but not public pages (mirrors .assetsignore), plus
// 404.html, which is public but noindex: submitting it would ask Bing to index
// an error page.
const NOT_PUBLIC = new Set(['blog/article-template.html', 'gmb-cover-photo.html', '404.html']);

function toUrl(file) {
  if (file === 'index.html') return `${site}/`;
  if (file.endsWith('/index.html')) return `${site}/${file.replace(/index\.html$/, '')}`;
  return `${site}/${file.replace(/\.html$/, '')}`;
}

async function sitemapUrls() {
  const xml = await readFile('sitemap.xml', 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function changedUrls(before, after) {
  const diff = execSync(`git diff --name-only --diff-filter=AM ${before} ${after}`, { encoding: 'utf8' });
  const urls = new Set();
  for (const file of diff.split('\n').filter(Boolean)) {
    if (!file.endsWith('.html') || NOT_PUBLIC.has(file)) continue;
    if (/^(scripts|node_modules|\.claude|\.github)\//.test(file)) continue;
    urls.add(toUrl(file));
  }
  // llms.txt is what AI assistants read; resubmit it when it changes.
  if (diff.includes('llms.txt')) urls.add(`${site}/llms.txt`);
  // feed.xml is regenerated whenever a guide changes, so a fresh copy in Bing's
  // index keeps the feed a usable discovery path.
  if (diff.includes('feed.xml')) urls.add(`${site}/feed.xml`);
  return [...urls];
}

const [before, after] = process.argv.slice(2);
const fullRun = !before || !after || /^0+$/.test(before);
let urls = fullRun ? await sitemapUrls() : await changedUrls(before, after);
urls = urls.slice(0, 10000);

if (!urls.length) {
  console.log('IndexNow: no public pages changed, nothing to submit.');
  process.exit(0);
}

const body = { host: 'silage.khamarvest.com', key: INDEXNOW_KEY, keyLocation: `${site}/${INDEXNOW_KEY}.txt`, urlList: urls };
console.log(`IndexNow: submitting ${urls.length} URL(s)${fullRun ? ' (full sitemap)' : ''}:\n  ${urls.join('\n  ')}`);

if (process.env.INDEXNOW_DRY_RUN) { console.log('dry run, not sent'); process.exit(0); }

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
// 200 = accepted, 202 = accepted and key will be validated later. Anything else is a real failure.
console.log(`IndexNow: HTTP ${res.status} ${res.statusText}`);
if (![200, 202].includes(res.status)) {
  console.log(await res.text());
  process.exit(1);
}
