import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const siteUrl = 'https://silage.khamarvest.com';
const blogDir = join(root, 'blog');
const rootPost = 'vutta-silage-prothombar-khawano-rules.html';

function text(match) { return match?.[1]?.replace(/\s+/g, ' ').trim() || ''; }
function esc(value) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const files = [rootPost, ...(await readdir(blogDir)).filter((file) => file.endsWith('.html') && file !== 'index.html' && file !== 'article-template.html').map((file) => `blog/${file}`)];
const posts = [];
for (const file of files) {
  const html = await readFile(join(root, file), 'utf8');
  if (/<meta name="robots" content="noindex/i.test(html)) continue;
  const title = text(html.match(/<title>([\s\S]*?)<\/title>/i)).replace(/\s*\|[^|]*$/u, '');
  const description = text(html.match(/<meta name="description" content="([\s\S]*?)"/i));
  const date = text(html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/i));
  const modified = text(html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"/i)) || date;
  if (!title || !description || !date) throw new Error(`${file} needs a title, description and datePublished structured data.`);
  // Cloudflare serves .html files at extensionless URLs (and 307-redirects the .html
  // form), so all published links must be extensionless.
  posts.push({ file, url: `/${file.replace(/\.html$/, '')}`, title, description, date, modified });
}
posts.sort((a, b) => b.date.localeCompare(a.date));

const cards = posts.map((post) => `
      <article class="rounded-xl border border-green-900/10 bg-white p-6 shadow-sm">
        <p class="text-sm font-medium text-green-700">খামারি গাইড · ${post.date}</p>
        <h2 class="mt-2 text-2xl font-bold leading-tight text-green-900"><a href="${esc(post.url)}" class="hover:underline">${esc(post.title)}</a></h2>
        <p class="mt-3 leading-7 text-stone-600">${esc(post.description)}</p>
        <a href="${esc(post.url)}" class="mt-4 inline-block font-semibold text-green-800 underline">গাইডটি পড়ুন →</a>
      </article>`).join('');
// Blog index structured data. The ItemList is the point: it hands crawlers and
// AI assistants the whole guide library, titles and URLs included, in one
// machine-readable block instead of making them parse 29 cards of markup.
const blogSchema = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${siteUrl}/blog/`,
      name: 'সাইলেজ ও গরুর খাদ্য গাইড',
      description: 'ভুট্টা সাইলেজ, গরুর খাদ্য ও খামার ব্যবস্থাপনা নিয়ে সহজ, ব্যবহারিক বাংলা গাইড।',
      inLanguage: 'bn-BD',
      url: `${siteUrl}/blog/`,
      isPartOf: { '@type': 'WebSite', name: 'খামারভেস্ট সাইলেজ', url: `${siteUrl}/` },
      publisher: { '@type': 'Organization', name: 'খামারভেস্ট (Khamarvest)', url: `${siteUrl}/` },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: posts.length,
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        itemListElement: posts.map((post, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteUrl}${post.url}`,
          name: post.title,
        })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'হোম', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'খামারি গাইড', item: `${siteUrl}/blog/` },
      ],
    },
  ],
}).normalize('NFC');
const index = `<!DOCTYPE html>
<html lang="bn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>সাইলেজ ও গরুর খাদ্য গাইড | খামারভেস্ট সাইলেজ</title><meta name="description" content="ভুট্টা সাইলেজ, গরুর খাদ্য ও খামার ব্যবস্থাপনা নিয়ে সহজ, ব্যবহারিক বাংলা গাইড।"><link rel="canonical" href="${siteUrl}/blog/"><meta name="robots" content="index, follow, max-image-preview:large"><meta property="og:type" content="website"><meta property="og:locale" content="bn_BD"><meta property="og:site_name" content="খামারভেস্ট (Khamarvest)"><meta property="og:title" content="সাইলেজ ও গরুর খাদ্য গাইড"><meta property="og:description" content="ভুট্টা সাইলেজ, গরুর খাদ্য ও খামার ব্যবস্থাপনা নিয়ে সহজ, ব্যবহারিক বাংলা গাইড।"><meta property="og:url" content="${siteUrl}/blog/"><meta property="og:image" content="${siteUrl}/img/silage-bag-1200.jpeg"><meta property="og:image:alt" content="খামারভেস্ট ভুট্টা সাইলেজের বস্তা"><meta name="twitter:card" content="summary_large_image"><link rel="preload" href="/fonts/hind-siliguri-400-bengali.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css"><link rel="alternate" type="application/rss+xml" title="খামারভেস্ট সাইলেজ গাইড" href="/feed.xml"><script type="application/ld+json">${blogSchema}</script></head>
<body class="bg-stone-50 font-['Hind_Siliguri'] text-stone-800"><header class="border-b border-green-900/10 bg-white"><nav class="mx-auto flex max-w-4xl items-center justify-between px-5 py-4"><a href="/" class="text-xl font-bold text-green-800">খামারভেস্ট সাইলেজ</a><div class="flex gap-4 items-center"><a href="/" class="text-sm font-medium text-green-800 underline">সাইলেজ দেখুন</a><a href="/about" class="text-sm font-medium text-green-800 underline">আমাদের সম্পর্কে</a><a href="https://www.facebook.com/khamarvestSilage/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2]/10 px-3 py-1 text-sm font-semibold text-[#1877F2] transition hover:bg-[#1877F2] hover:text-white"><svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg><span>Facebook</span></a></div></nav></header><main class="mx-auto max-w-4xl px-5 py-12 md:py-16"><p class="font-medium text-green-700">খামারি গাইড</p><h1 class="mt-2 text-4xl font-bold text-green-900 md:text-5xl">সাইলেজ ও গরুর খাদ্য গাইড</h1><p class="mt-4 max-w-2xl text-lg leading-8 text-stone-600">খামারের দৈনন্দিন সিদ্ধান্তে কাজে লাগে এমন সহজ, বাস্তবভিত্তিক বাংলা তথ্য।</p><section class="mt-8 rounded-xl border border-green-900/10 bg-white p-5"><p class="text-sm font-bold text-green-700">ফ্রি টুলস (কোনো শর্ত নেই)</p><div class="mt-2 flex flex-wrap gap-x-5 gap-y-1.5"><a href="/tools/silage-calculator" class="font-semibold text-green-800 underline">সাইলেজ ক্যালকুলেটর</a><a href="/tools/dudher-labh-calculator" class="font-semibold text-green-800 underline">দুধের লাভ-লস ক্যালকুলেটর</a><a href="/tools/motatajakoron-khoroch-calculator" class="font-semibold text-green-800 underline">মোটাতাজাকরণ খরচ</a><a href="/tools/khaddo-talika-chart" class="font-semibold text-green-800 underline">খাদ্য তালিকা চার্ট</a><a href="/tools/tika-krimi-calendar" class="font-semibold text-green-800 underline">টিকার রেকর্ড</a><a href="/tools/hishab-khata" class="font-semibold text-green-800 underline">হিসাব খাতা</a><a href="/tools/delivery-challan" class="font-semibold text-green-800 underline">ডেলিভারি চালান</a><a href="/tools/gorur-ojon-mapar-chart" class="font-semibold text-green-800 underline">গরুর ওজন চার্ট</a><a href="/tools/" class="font-semibold text-green-800 underline">সব টুল →</a></div></section><section class="mt-6 grid gap-5 md:grid-cols-2">${cards}</section></main><script src="/js/ga.js" defer></script></body></html>`;
// Normalise so the generated page does not mix Bengali forms (see AGENTS.md).
await writeFile(join(blogDir, 'index.html'), index.normalize('NFC'));

// Static tool pages (tools/*.html) — keep in sync when adding a tool.
const toolPages = ['/tools/', '/tools/silage-calculator', '/tools/dudher-labh-calculator', '/tools/motatajakoron-khoroch-calculator', '/tools/khamar-shastho-checklist', '/tools/delivery-challan', '/tools/gorur-ojon-mapar-chart', '/tools/khaddo-talika-chart', '/tools/tika-krimi-calendar', '/tools/hishab-khata'];
// Standalone root pages that are not Bangla blog posts (kept out of the /blog/
// index). Discovered rather than listed, so a new root page cannot silently miss
// the sitemap. `excluded` are internal or non-indexable pages.
const excluded = new Set(['index.html', rootPost, 'gmb-cover-photo.html', 'guide-book.html', '404.html']);
const staticPages = (await readdir(root, { withFileTypes: true }))
  .filter((e) => e.isFile() && e.name.endsWith('.html') && !excluded.has(e.name))
  .map((e) => `/${e.name.replace(/\.html$/, '')}`)
  .sort();
// District pages are scanned from area/ (generated by scripts/generate-area-pages.mjs).
const areaPages = (await readdir(join(root, 'area')))
  .filter((file) => file.endsWith('.html'))
  .map((file) => (file === 'index.html' ? '/area/' : `/area/${file.replace(/\.html$/, '')}`));
const sitemapUrls = ['/', ...posts.map((post) => post.url), ...toolPages, ...staticPages, ...areaPages];
const today = new Date().toISOString().slice(0, 10);

// lastmod has to be truthful. A sitemap that stamps every URL with today's date
// is a known quality signal against the site: crawlers learn the field is noise
// and stop using it to prioritise recrawls. Articles carry their own
// dateModified in JSON-LD; everything else uses the file's last commit date.
function urlToFile(url) {
  if (url === '/') return 'index.html';
  const base = url.replace(/^\//, '');
  return base.endsWith('/') ? `${base}index.html` : `${base}.html`;
}
function gitDate(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : today;
  } catch {
    return today; // shallow clone, or the file is not committed yet
  }
}
const postModified = new Map(posts.map((post) => [post.url, post.modified]));
const lastmodFor = (url) => postModified.get(url) || gitDate(urlToFile(url));

const entries = [...sitemapUrls.map((url) => ({ url, priority: url === '/' ? '1.0' : '0.8', changefreq: url === '/' ? 'weekly' : 'monthly' })),
  { url: '/blog/', priority: '0.9', changefreq: 'weekly' }];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ url, priority, changefreq }) => `  <url>\n    <loc>${siteUrl}${url}</loc>\n    <lastmod>${lastmodFor(url)}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(root, 'sitemap.xml'), sitemap);

// RSS feed. Feed readers are a small audience here, but an always-current feed
// is a cheap, machine-readable "what changed" endpoint: Bing/IndexNow, AI
// crawlers and aggregators all consume it, and it is one more discovery path
// that does not depend on Google indexing us first.
const rfc822 = (date) => new Date(`${date}T06:00:00+06:00`).toUTCString();
const feedItems = posts.slice(0, 25).map((post) => `    <item>
      <title>${esc(post.title)}</title>
      <link>${siteUrl}${post.url}</link>
      <guid isPermaLink="true">${siteUrl}${post.url}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
      <description>${esc(post.description)}</description>
    </item>`).join('\n');
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>খামারভেস্ট সাইলেজ, খামারি গাইড</title>
    <link>${siteUrl}/blog/</link>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>ভুট্টা সাইলেজ, গরুর খাদ্য ও খামার ব্যবস্থাপনা নিয়ে বাংলা গাইড।</description>
    <language>bn-BD</language>
    <lastBuildDate>${rfc822(posts[0]?.modified || today)}</lastBuildDate>
${feedItems}
  </channel>
</rss>
`;
await writeFile(join(root, 'feed.xml'), feed.normalize('NFC'));

console.log(`Published index for ${posts.length} article(s) and refreshed sitemap.xml + feed.xml.`);
