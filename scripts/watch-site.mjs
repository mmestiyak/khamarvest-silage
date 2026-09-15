// Watches the LIVE site for regressions and for content going stale.
// Run: npm run watch            (against production)
//      SITE=http://localhost:8321 npm run watch   (against a local preview)
//
// This is the deploy-time safety net that `npm run check` cannot be: check
// validates the repo, this validates what Cloudflare is actually serving. A
// broken deploy, an expired price offer or a stale year reference is invisible
// locally and costs real search visibility.
//
// Writes a markdown report to stdout and exits non-zero if anything is wrong,
// so the workflow can turn it into a GitHub issue.
import { readFile } from 'node:fs/promises';

const SITE = (process.env.SITE || 'https://silage.khamarvest.com').replace(/\/$/, '');
const LIVE = !SITE.includes('localhost');
const problems = [];
const notes = [];

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const monthsBetween = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

async function get(url, opts = {}) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'khamarvest-watchdog' }, ...opts });
  return { status: res.status, url: res.url, body: opts.head ? '' : await res.text() };
}

// --- 1. Every published URL still resolves and is still indexable -----------
const sitemapRes = await get(`${SITE}/sitemap.xml`);
if (sitemapRes.status !== 200) {
  problems.push(`sitemap.xml returned ${sitemapRes.status}`);
} else {
  const urls = [...sitemapRes.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  notes.push(`${urls.length} URLs in sitemap.xml`);
  const broken = [];
  const noindexed = [];
  // Batched so a 80-URL sweep does not take minutes.
  for (let i = 0; i < urls.length; i += 8) {
    await Promise.all(urls.slice(i, i + 8).map(async (u) => {
      const target = LIVE ? u : u.replace('https://silage.khamarvest.com', SITE);
      try {
        const r = await get(target);
        if (r.status !== 200) broken.push(`${u} returned ${r.status}`);
        else if (/<meta name="robots" content="[^"]*noindex/i.test(r.body)) noindexed.push(u);
      } catch (e) {
        broken.push(`${u} failed to fetch (${e.message})`);
      }
    }));
  }
  if (broken.length) problems.push(`Pages not returning 200:\n${broken.map((b) => `  - ${b}`).join('\n')}`);
  if (noindexed.length) problems.push(`Pages in the sitemap marked noindex:\n${noindexed.map((b) => `  - ${b}`).join('\n')}`);
  if (!broken.length && !noindexed.length) notes.push('every sitemap URL returns 200 and is indexable');
}

// --- 2. HTTPS is still forced ----------------------------------------------
if (LIVE) {
  const r = await fetch('http://silage.khamarvest.com/', { redirect: 'manual' }).catch(() => null);
  if (!r) problems.push('http:// did not respond at all');
  else if (r.status !== 301 && r.status !== 308) {
    problems.push(`http:// returned ${r.status} instead of a permanent redirect. Cloudflare SSL/TLS > Edge Certificates > Always Use HTTPS may have been turned off.`);
  } else notes.push('http:// still 301s to https://');
}

// --- 3. The homepage still says what it is supposed to say ------------------
const home = await get(`${SITE}/`);
if (home.status !== 200) {
  problems.push(`homepage returned ${home.status}`);
} else {
  const title = home.body.match(/<title>([^<]*)<\/title>/)?.[1] || '';
  if (!/১০ টাকা/.test(title)) problems.push('homepage <title> no longer contains the per-kg price');
  if (title.length > 80) problems.push(`homepage <title> is ${title.length} chars and will be truncated in search results`);
  const offers = [...home.body.matchAll(/"price":\s*"(\d+)"/g)].map((m) => m[1]);
  for (const expected of ['10', '500']) {
    if (!offers.includes(expected)) problems.push(`homepage Product schema no longer offers ${expected} BDT`);
  }
  // An expired offer makes Google drop the price from the search result.
  const validUntil = home.body.match(/"priceValidUntil":\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
  if (!validUntil) problems.push('homepage offers have no priceValidUntil');
  else {
    const daysLeft = Math.round((new Date(validUntil) - today) / 86400000);
    if (daysLeft < 0) problems.push(`priceValidUntil expired ${-daysLeft} days ago (${validUntil}). Google will stop showing the price.`);
    else if (daysLeft < 60) problems.push(`priceValidUntil is ${daysLeft} days away (${validUntil}). Extend it before it lapses.`);
    else notes.push(`priceValidUntil ${validUntil}, ${daysLeft} days out`);
  }
}

// --- 4. Content that has gone stale ----------------------------------------
// Read straight from the checked-out repo rather than a generated manifest, so
// there is nothing to keep in sync.
try {
  const { readdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'blog');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.html') && !['index.html', 'article-template.html'].includes(f));
  const stale = [];
  for (const f of files) {
    const html = await readFile(join(dir, f), 'utf8');
    const mod = html.match(/"dateModified":\s*"(\d{4}-\d{2}-\d{2})"/)?.[1]
      || html.match(/"datePublished":\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
    if (mod && monthsBetween(new Date(mod), today) >= 12) stale.push(`/blog/${f.replace(/\.html$/, '')} (${mod})`);
  }
  if (stale.length) notes.push(`${stale.length} guide(s) untouched for 12 months, worth a freshness pass:\n${stale.map((p) => `  - ${p}`).join('\n')}`);
  else notes.push('no guide is older than 12 months');
} catch (e) {
  notes.push(`could not read blog/ for staleness (${e.message})`);
}

// --- 5. Year references that have rolled over ------------------------------
const year = today.getFullYear();
const bn = (n) => String(n).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
if (home.status === 200 && home.body.includes(bn(year - 1)) && !home.body.includes(bn(year))) {
  problems.push(`homepage still says ${bn(year - 1)} and never says ${bn(year)}. Price and "দাম ২০XX" lines need rolling forward.`);
}

// --- Report ----------------------------------------------------------------
const lines = [`# Site watchdog, ${iso(today)}`, '', `Checked \`${SITE}\`.`, ''];
if (problems.length) {
  lines.push(`## ${problems.length} problem(s)`, '');
  problems.forEach((p) => lines.push(`- ${p}`));
  lines.push('');
}
lines.push('## Status', '');
notes.forEach((n) => lines.push(`- ${n}`));
console.log(lines.join('\n'));
if (problems.length) process.exit(1);
