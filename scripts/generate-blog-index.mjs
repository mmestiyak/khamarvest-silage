import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

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
  const title = text(html.match(/<title>([\s\S]*?)<\/title>/i)).replace(/\s*\|\s*খামারভেস্ট\s*$/u, '');
  const description = text(html.match(/<meta name="description" content="([\s\S]*?)"/i));
  const date = text(html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/i));
  if (!title || !description || !date) throw new Error(`${file} needs a title, description and datePublished structured data.`);
  posts.push({ file, title, description, date });
}
posts.sort((a, b) => b.date.localeCompare(a.date));

const cards = posts.map((post) => `
      <article class="rounded-xl border border-green-900/10 bg-white p-6 shadow-sm">
        <p class="text-sm font-medium text-green-700">খামারি গাইড · ${post.date}</p>
        <h2 class="mt-2 text-2xl font-bold leading-tight text-green-900"><a href="/${esc(post.file)}" class="hover:underline">${esc(post.title)}</a></h2>
        <p class="mt-3 leading-7 text-stone-600">${esc(post.description)}</p>
        <a href="/${esc(post.file)}" class="mt-4 inline-block font-semibold text-green-800 underline">গাইডটি পড়ুন →</a>
      </article>`).join('');
const index = `<!DOCTYPE html>
<html lang="bn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>সাইলেজ ও গরুর খাদ্য গাইড | খামারভেস্ট সাইলেজ</title><meta name="description" content="ভুট্টা সাইলেজ, গরুর খাদ্য ও খামার ব্যবস্থাপনা নিয়ে সহজ, ব্যবহারিক বাংলা গাইড।"><link rel="canonical" href="${siteUrl}/blog/"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet"><script src="https://cdn.tailwindcss.com"></script><script type="application/ld+json">{"@context":"https://schema.org","@type":"CollectionPage","name":"সাইলেজ ও গরুর খাদ্য গাইড","inLanguage":"bn-BD","url":"${siteUrl}/blog/"}</script></head>
<body class="bg-stone-50 font-['Hind_Siliguri'] text-stone-800"><header class="border-b border-green-900/10 bg-white"><nav class="mx-auto flex max-w-4xl items-center justify-between px-5 py-4"><a href="/" class="text-xl font-bold text-green-800">খামারভেস্ট সাইলেজ</a><div class="flex gap-4 items-center"><a href="/" class="text-sm font-medium text-green-800 underline">সাইলেজ দেখুন</a><a href="https://www.facebook.com/khamarvestSilage/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2]/10 px-3 py-1 text-sm font-semibold text-[#1877F2] transition hover:bg-[#1877F2] hover:text-white"><svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg><span>Facebook</span></a></div></nav></header><main class="mx-auto max-w-4xl px-5 py-12 md:py-16"><p class="font-medium text-green-700">খামারি গাইড</p><h1 class="mt-2 text-4xl font-bold text-green-900 md:text-5xl">সাইলেজ ও গরুর খাদ্য গাইড</h1><p class="mt-4 max-w-2xl text-lg leading-8 text-stone-600">খামারের দৈনন্দিন সিদ্ধান্তে কাজে লাগে এমন সহজ, বাস্তবভিত্তিক বাংলা তথ্য।</p><section class="mt-10 grid gap-5 md:grid-cols-2">${cards}</section></main></body></html>`;
await writeFile(join(blogDir, 'index.html'), index);

const sitemapUrls = ['/', ...posts.map((post) => `/${post.file}`)];
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url>\n    <loc>${siteUrl}${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${url === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${url === '/' ? '1.0' : '0.8'}</priority>\n  </url>`).join('\n')}\n  <url>\n    <loc>${siteUrl}/blog/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n</urlset>\n`;
await writeFile(join(root, 'sitemap.xml'), sitemap);
console.log(`Published index for ${posts.length} article(s) and refreshed sitemap.xml.`);
