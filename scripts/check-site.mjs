// Site convention checker. Run: npm run check
//
// Every rule here comes from AGENTS.md. The point is that adding article number
// 20, 30 or 50 stays safe without re-reading the conventions each time: this
// catches the mistakes we have actually made (a .html internal link, a page
// shipped without Open Graph tags, an em dash, a raw multi-MB image, a page
// missing from the sitemap) before they reach production.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';

const root = process.cwd();
const site = 'https://silage.khamarvest.com';

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

// Files that are in the repo but not public pages (mirrors .assetsignore).
const NOT_PUBLIC = new Set(['blog/article-template.html']);
// Public but not article-style pages, so they skip the article-only rules.
const UTILITY = new Set(['gmb-cover-photo.html', 'guide-book.html']);
// Generated, checked as a page but not as an article.
const GENERATED = new Set(['blog/index.html']);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', 'img', 'js', 'scripts'].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walk(rel));
    else if (entry.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

// Does an extensionless site path resolve to a real file? Mirrors how
// Cloudflare Workers Assets serves this repo.
async function resolves(urlPath) {
  const clean = urlPath.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (clean === '/') return exists(join(root, 'index.html'));
  const base = clean.replace(/^\//, '');
  return (await exists(join(root, `${base}.html`)))
    || (await exists(join(root, base, 'index.html')))
    || (await exists(join(root, base)));
}

const files = (await walk('')).filter((f) => !NOT_PUBLIC.has(f)).sort();
const articles = files.filter((f) => (f.startsWith('blog/') && !GENERATED.has(f)) || f === 'vutta-silage-prothombar-khawano-rules.html');
const canonicals = new Map();

for (const file of files) {
  const html = await readFile(join(root, file), 'utf8');
  const pick = (re) => html.match(re)?.[1]?.trim();
  const isArticle = articles.includes(file);
  const isUtility = UTILITY.has(file);

  // --- Rules that apply to every public page ---

  // Owner considers em/en dashes an AI tell. Plain hyphen for ranges.
  if (/[—–]/.test(html)) err(file, 'contains an em or en dash');

  // Bengali digits are ০-৯. Devanagari ०-९ look similar and have slipped in before.
  const deva = html.match(/[०-९]+/g);
  if (deva) err(file, `Devanagari digits instead of Bengali: ${[...new Set(deva)].join(' ')}`);

  // Internal links must be extensionless and must resolve.
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
    const target = m[1];
    if (/^\/(img|js)\//.test(target)) {
      if (!await exists(join(root, target.slice(1)))) err(file, `missing asset ${target}`);
      continue;
    }
    if (target.endsWith('.html')) err(file, `internal link uses .html: ${target}`);
    else if (!await resolves(target)) err(file, `internal link does not resolve: ${target}`);
  }

  // Images must be the optimized copies, and must exist.
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const src = tag.match(/src="([^"]+)"/)?.[1];
    if (!src) { err(file, 'img tag without src'); continue; }
    if (/IMG_\d+\.JPG\.jpeg/i.test(src)) err(file, `uses a raw multi-MB image: ${src}`);
    if (src.startsWith('http')) continue;
    const abs = src.startsWith('/') ? join(root, src.slice(1)) : resolve(root, dirname(file), src);
    if (!await exists(abs)) err(file, `image not found: ${src}`);
    if (!/width=/.test(tag) || !/height=/.test(tag)) warn(file, `img without width/height (layout shift): ${src}`);
  }

  if (isUtility) continue;

  // --- SEO rules for real pages ---

  const title = pick(/<title>([\s\S]*?)<\/title>/i);
  if (!title) err(file, 'no <title>');
  else {
    const isEnglish = /<html lang="en"/.test(html);
    const ok = isEnglish ? /\|\s*Khamarvest/.test(title) : /\|\s*খামারভেস্ট/.test(title);
    if (!ok) err(file, `title does not end with | ${isEnglish ? 'Khamarvest Silage' : 'খামারভেস্ট'}`);
  }

  const desc = pick(/<meta name="description" content="([\s\S]*?)"/i);
  if (!desc) err(file, 'no meta description');
  else if (desc.length < 70 || desc.length > 320) warn(file, `meta description is ${desc.length} chars`);

  const robots = pick(/<meta name="robots" content="([^"]*)"/i);
  if (!robots) err(file, 'no meta robots');
  else if (/noindex/i.test(robots)) err(file, 'still set to noindex');

  const canonical = pick(/<link rel="canonical" href="([^"]*)"/i);
  if (!canonical) err(file, 'no canonical');
  else {
    if (canonical.endsWith('.html')) err(file, 'canonical uses .html (it 307-redirects)');
    if (!canonical.startsWith(site)) err(file, `canonical is not on ${site}`);
    const expected = file === 'index.html' ? `${site}/`
      : file.endsWith('/index.html') ? `${site}/${file.replace(/index\.html$/, '')}`
      : `${site}/${file.replace(/\.html$/, '')}`;
    if (canonical !== expected) err(file, `canonical should be ${expected}, found ${canonical}`);
    if (canonicals.has(canonical)) err(file, `duplicate canonical, also in ${canonicals.get(canonical)}`);
    canonicals.set(canonical, file);
  }

  // Open Graph: without these, Facebook and WhatsApp shares render bare.
  for (const prop of ['og:title', 'og:description', 'og:image', 'og:url']) {
    if (!new RegExp(`property="${prop}"`).test(html)) err(file, `missing ${prop}`);
  }
  const ogUrl = pick(/property="og:url" content="([^"]*)"/);
  if (ogUrl && canonical && ogUrl !== canonical) err(file, 'og:url does not match canonical');
  const ogImg = pick(/property="og:image" content="([^"]*)"/);
  if (ogImg) {
    if (!ogImg.startsWith('http')) err(file, 'og:image must be an absolute URL');
    else if (!await exists(join(root, new URL(ogImg).pathname.slice(1)))) err(file, `og:image file missing: ${ogImg}`);
  }

  // Structured data must parse, or Google silently drops the rich result.
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes = data['@graph'] || [data];
      const article = nodes.find((n) => n['@type'] === 'Article');
      if (article) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(article.datePublished || '')) err(file, 'Article datePublished missing or malformed');
        if (article.mainEntityOfPage && canonical && article.mainEntityOfPage !== canonical) err(file, 'JSON-LD mainEntityOfPage does not match canonical');
        for (const who of ['author', 'publisher']) {
          if (article[who]?.name !== 'খামারভেস্ট (Khamarvest)') err(file, `Article ${who} should be "খামারভেস্ট (Khamarvest)"`);
        }
      }
    } catch (e) {
      err(file, `invalid JSON-LD: ${e.message}`);
    }
  }

  if (!isArticle) continue;

  // --- Article-only rules ---

  // Brand in the body is what makes search engines and AI assistants cite us.
  const body = (html.split(/<article[^>]*>/)[1] || '').split('</article>')[0];
  const brandInBody = (body.match(/খামারভেস্ট/g) || []).length;
  if (brandInBody < 2) err(file, `brand appears ${brandInBody}x in the article body, needs at least 2`);

  if (!/<script src="\/js\/ga\.js"/.test(html)) err(file, 'missing /js/ga.js, clicks will not be tracked');
  if (!/"@type": "FAQPage"/.test(html)) warn(file, 'no FAQPage schema (AI assistants pull answers from it)');
  if (!/"@type": "BreadcrumbList"/.test(html)) warn(file, 'no BreadcrumbList schema');
}

// --- Sitemap and llms.txt coverage ---
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const url of sitemapUrls) {
  if (!await resolves(new URL(url).pathname)) errors.push(`sitemap.xml: lists a URL that does not resolve: ${url}`);
}
for (const [canonical, file] of canonicals) {
  if (GENERATED.has(file)) continue;
  if (!sitemapUrls.includes(canonical)) errors.push(`sitemap.xml: missing ${canonical} (${file}). Run npm run build:blog`);
}

const llms = await readFile(join(root, 'llms.txt'), 'utf8');
if (/[—–]/.test(llms)) errors.push('llms.txt: contains an em or en dash');
const llmsDeva = llms.match(/[०-९]+/g);
if (llmsDeva) errors.push(`llms.txt: Devanagari digits instead of Bengali: ${[...new Set(llmsDeva)].join(' ')}`);
for (const file of articles) {
  const slug = file.replace(/\.html$/, '');
  if (!llms.includes(slug)) warnings.push(`llms.txt: does not list ${slug}, AI assistants will not see it`);
}

// --- Report ---
const label = `${files.length} pages, ${articles.length} articles`;
if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n` + warnings.map((w) => `  ~ ${w}`).join('\n'));
if (errors.length) {
  console.log(`\nErrors (${errors.length}):\n` + errors.map((e) => `  x ${e}`).join('\n'));
  console.log(`\nFAILED: ${label}\n`);
  process.exit(1);
}
console.log(`\nOK: ${label}, no errors.\n`);
