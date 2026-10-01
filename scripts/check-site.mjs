// Site convention checker. Run: npm run check
//
// Every rule here comes from AGENTS.md. The point is that adding article number
// 20, 30 or 50 stays safe without re-reading the conventions each time: this
// catches the mistakes we have actually made (a .html internal link, a page
// shipped without Open Graph tags, an em dash, a raw multi-MB image, a page
// missing from the sitemap) before they reach production.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { product as PRODUCT, money } from './product.mjs';
import { evaluate, MARKER } from './calc.mjs';
import { parse as parseFaq } from './faq.mjs';

const root = process.cwd();
const site = 'https://silage.khamarvest.com';

// Trust rules from AGENTS.md. They apply to every word we publish, including
// llms.txt, which is the file AI assistants read and quote back to farmers: a
// promised profit figure there reaches people as ours just as surely as one in
// an article, and nothing on the page would show it to us.
const INVENTED_TESTIMONIAL = ['তারা বলেন', 'খামারিরা বলেন', 'সফল হয়েছেন'];
const PROMISED_EARNINGS = ['লাভ করুন', 'আয় করুন', 'গ্যারান্টি', 'মুনাফা নিশ্চিত', 'লাভ বাড়ান', 'লাভ তত', 'লাভ শুরু হবে'];

// Patterns a phrase list misses, from the 2026-09-29 brand review. Each one was
// live on the site. They run on every public page and on the Facebook posts,
// not only on articles: the homepage said "কেন শত শত খামারি..." for months
// because the trust rules skipped everything that was not an article.
const TRUST_PATTERNS = [
  [/(শত শত|হাজারো|হাজার হাজার|অসংখ্য)\s*খামারি|খামারি[^।<"]{0,40}(ভরসা রাখেন|আস্থা রাখেন)|ব্যবহারকারী[^।<"]{0,20}খামারি/, 'invented social proof (we hold no customer data or quotes). State the mechanism instead'],
  [/দ্রুত ডেলিভারি|[০-৯]+\s*ঘণ্টায়\s*(পৌঁছ|ডেলিভারি)|পরদিন ডেলিভারি/, 'promises a delivery speed. Dates are confirmed on the confirmation call'],
  [/(সবসময়|সব সময়)\s*সুস্থ|(গরু|গাভী) সুস্থ থাকে(?! না)|দুধ উৎপাদন বেশি হয়|হজমশক্তি বাড়ায়/, 'health or yield promise. Cite a source or describe the feed, not the outcome'],
  [/(পচার|পচন)[^।<"]{0,15}(কোনো সমস্যা নেই|ধরে না)|নষ্ট(ের| হওয়ার) ভয় নেই/, 'absolute no-spoilage claim; the guides themselves warn about punctures and rodents'],
  [/খামারভেস্ট[^।<"]{0,30}(সবচেয়ে (কার্যকর|নির্ভরযোগ্য|ভালো)|সেরা)|ভেজালমুক্ত নিশ্চয়তা/, 'unsupported superlative or guarantee about the brand'],
  [/তাজা (সবুজ )?খাবারের মতো(ই)? পুষ্টি/, 'nutrition equivalence we have no lab report for (see /about)'],
  // The price is the same all year. A real, permanent price cut may be shown
  // (see the price-history marker below); a "sale" or "stock is running out"
  // frame may not, because it tells the farmer the price is about to go back up.
  [/ছাড় চলছে|স্টক থাকতেই|স্টক শেষ হওয়ার আগে|অফার শেষ/, 'temporary-sale or false-urgency framing; the price is the same all year'],
];
// Warnings: an invented precision figure.
const TRUST_WARNINGS = [
  [/[০-৯]+\s*%\s*নির্ভুল/, 'precision figure ("X% নির্ভুল") with no source. Owner decision pending'],
];

// Every trust rule over one text. Comments are stripped: they are not published.
function trustProblems(text) {
  // A page may quote a banned claim in order to disown it (/about's "যে দাবিগুলো
  // আমরা করি না"). Wrap that in <!-- trust:quoted-start --> / <!-- trust:quoted-end -->.
  const t = text.replace(/<!-- trust:quoted-start -->[\s\S]*?<!-- trust:quoted-end -->/g, '').replace(/<!--[\s\S]*?-->/g, '').normalize('NFC');
  const out = [];
  for (const phrase of INVENTED_TESTIMONIAL) if (t.includes(phrase)) out.push(['err', `invented customer testimonial: "${phrase}". Use a real attributed quote or drop it`]);
  for (const m of t.matchAll(/[০-৯][০-৯,]*\s*টাকা\s*লাভ|লাভজনক একটি বিনিয়োগ|বছরে লাভ/g)) out.push(['err', `names a profit figure or endorses the investment: "${m[0]}". Link /tools/dudher-labh-calculator instead`]);
  for (const phrase of PROMISED_EARNINGS) if (t.includes(phrase)) out.push(['err', `promises earnings or gives a guarantee: "${phrase}"`]);
  if (/অর্ধেকের নিচে|অর্ধেক কমি/.test(t)) out.push(['err', 'unsupported savings claim (halving). State the price, not the saving']);
  for (const [re, msg] of TRUST_PATTERNS) { const m = t.match(re); if (m) out.push(['err', `${msg}: "${m[0]}"`]); }
  // "আগের দাম" is only true if product.json records an earlier price.
  if (/আগের দাম/.test(t) && !PRODUCT.previous) out.push(['err', 'shows an "আগের দাম" but scripts/product.json > history has no earlier price']);
  for (const [re, msg] of TRUST_WARNINGS) { const m = t.match(re); if (m) out.push(['warn', `${msg}: "${m[0]}"`]); }
  return out;
}

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

// Files that are in the repo but not public pages (mirrors .assetsignore).
const NOT_PUBLIC = new Set(['blog/article-template.html', 'gmb-cover-photo.html']);
// Public but not article-style pages, so they skip the article-only rules.
// 404.html is served by Cloudflare for unknown paths: intentionally noindex,
// no canonical and absent from the sitemap, so it skips the SEO page rules and
// gets its own assertions at the bottom of this file instead.
const UTILITY = new Set(['guide-book.html', '404.html']);
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
const titles = new Map();
const descriptions = new Map();

for (const file of files) {
  const html = await readFile(join(root, file), 'utf8');
  const pick = (re) => html.match(re)?.[1]?.trim();
  const isArticle = articles.includes(file);
  const isUtility = UTILITY.has(file);

  // --- Rules that apply to every public page ---

  // Owner considers em/en dashes an AI tell. Plain hyphen for ranges.
  if (/[—–]/.test(html)) err(file, 'contains an em or en dash');
  // Markup that leaked into visible text. The homepage showed `🌽">` above the
  // header for a week after the data-URI favicon was removed with a regex that
  // stopped at the first `>` inside the SVG.
  if (/<\/(?:svg|script|style)>\s*">/.test(html) || /<\/script><text /.test(html)) err(file, 'stray markup leaked into visible text (leftover of a removed tag)');

  // A file mixing precomposed and decomposed Bengali stores the same word as two
  // different byte sequences, so find/replace silently edits only some of them.
  if (html.normalize('NFC') !== html) warn(file, 'Bengali text is not NFC-normalised, find/replace on it can miss occurrences');

  // Tailwind is compiled into /css/site.css and the fonts are self-hosted in
  // /fonts. The CDN script and Google Fonts each cost a rural phone seconds of
  // blank screen before any Bengali renders.
  if (/cdn\.tailwindcss\.com/.test(html)) err(file, 'loads Tailwind from the CDN, link /css/site.css instead (npm run build:css)');
  if (/fonts\.(googleapis|gstatic)\.com/.test(html)) err(file, 'loads Google Fonts remotely, fonts are self-hosted (see scripts/fetch-fonts.mjs)');
  if (/<script>\s*tailwind\.config/.test(html)) err(file, 'inline tailwind.config, the config lives in tailwind.config.js');

  // Devanagari letters look close enough to Bengali to survive proofreading:
  // "टाका" sat in a published article until a price codemod walked past it.
  // U+0964 danda is shared punctuation and legitimately used everywhere.
  const deva_letters = html.match(/[\u0900-\u0963\u0966-\u097F]+/g);
  if (deva_letters) err(file, `Devanagari letters instead of Bengali: ${[...new Set(deva_letters)].join(' ')}`);

  // Bengali digits are ০-৯. Devanagari ०-९ look similar and have slipped in before.
  const deva = html.match(/[०-९]+/g);
  if (deva) err(file, `Devanagari digits instead of Bengali: ${[...new Set(deva)].join(' ')}`);

  // Internal links must be extensionless and must resolve. Relative hrefs are
  // checked too: index.html links to "blog/" and "corn-silage-bangladesh"
  // without a leading slash, and a typo there would 404 silently.
  for (const m of html.matchAll(/(?:href|src)="([^"#?]*)"/g)) {
    let target = m[1];
    if (!target || /^(https?:|data:|mailto:|tel:|#|\/\/)/.test(target)) continue;
    if (target.includes("' +") || target.includes('${')) continue; // built in JS at runtime
    if (!target.startsWith('/')) {
      const dir = dirname(file) === '.' ? '' : `${dirname(file)}/`;
      target = `/${relative(root, resolve(root, dir, target)).replace(/\\/g, '/')}`;
    }
    if (/^\/(img|js|css|fonts)\//.test(target)) {
      if (!await exists(join(root, target.slice(1)))) err(file, `missing asset ${target}`);
      continue;
    }
    if (target.endsWith('.html')) err(file, `internal link uses .html: ${target}`);
    else if (!await resolves(target)) err(file, `internal link does not resolve: ${target}`);
  }

  // Responsive sources must resolve. A typo in a srcset fails silently: the
  // browser quietly falls back to the full-size <img src>, so the page still
  // looks right while every visitor pays for the large file.
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const candidate of m[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (!url || url.startsWith('http') || url.startsWith('data:')) continue;
      const abs = url.startsWith('/') ? join(root, url.slice(1)) : resolve(root, dirname(file), url);
      if (!await exists(abs)) err(file, `srcset references a missing file: ${url}`);
    }
  }
  // Same for CSS image-set()/url() backgrounds pointing into img/.
  for (const m of html.matchAll(/url\((["']?)((?:\.\.\/)*img\/[^"')]+)\1\)/g)) {
    const url = m[2];
    const abs = url.startsWith('/') ? join(root, url.slice(1)) : resolve(root, dirname(file), url);
    if (!await exists(abs)) err(file, `CSS background references a missing image: ${url}`);
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

  if (!/<link rel="stylesheet" href="\/css\/site\.css">/.test(html)) err(file, 'missing /css/site.css stylesheet');
  if (!/<link rel="preload" href="\/fonts\/[^"]+\.woff2" as="font" type="font\/woff2" crossorigin>/.test(html)) warn(file, 'no font preload, first Bengali paint will be late');

  // --- SEO rules for real pages ---

  const title = pick(/<title>([\s\S]*?)<\/title>/i);
  if (!title) err(file, 'no <title>');
  else {
    const isEnglish = /<html lang="en"/.test(html);
    const ok = isEnglish ? /\|\s*Khamarvest/.test(title) : /\|\s*খামারভেস্ট/.test(title);
    if (!ok) err(file, `title does not end with | ${isEnglish ? 'Khamarvest Silage' : 'খামারভেস্ট'}`);
    // Google truncates a title around 55-60 characters and Bengali glyphs are
    // wider than Latin, so anything past that is written for nobody. The
    // homepage was 91 characters, 40 of which never rendered.
    const visible = title.split('|')[0].trim();
    if (visible.length > 60) warn(file, `title's visible span is ${visible.length} chars and will be cut off in search results`);
    if (titles.has(title)) err(file, `duplicate <title>, same as ${titles.get(title)}`);
    titles.set(title, file);
  }

  const desc = pick(/<meta name="description" content="([\s\S]*?)"/i);
  if (!desc) err(file, 'no meta description');
  else {
    if (desc.length < 70 || desc.length > 320) warn(file, `meta description is ${desc.length} chars`);
    if (descriptions.has(desc)) err(file, `duplicate meta description, same as ${descriptions.get(desc)}`);
    descriptions.set(desc, file);
  }

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
        if (article.dateModified) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(article.dateModified)) err(file, 'Article dateModified malformed');
          else if (article.datePublished && article.dateModified < article.datePublished) err(file, 'dateModified is earlier than datePublished');
        }
        if (article.mainEntityOfPage && canonical && article.mainEntityOfPage !== canonical) err(file, 'JSON-LD mainEntityOfPage does not match canonical');
        for (const who of ['author', 'publisher']) {
          if (article[who]?.name !== 'খামারভেস্ট (Khamarvest)') err(file, `Article ${who} should be "খামারভেস্ট (Khamarvest)"`);
        }
      }
      if (file === 'index.html') {
        const product = nodes.find((n) => n['@type'] === 'Product');
        const offers = [].concat(product?.offers || []);
        if (!product) err(file, 'homepage has no Product schema');
        else if (!offers.length || offers.some((o) => o.priceCurrency !== 'BDT' || !o.price)) err(file, 'homepage Product needs Offer(s) with price and priceCurrency BDT');
        const biz = nodes.find((n) => n['@type'] === 'LocalBusiness' || n['@type'] === 'Organization');
        const sameAs = [].concat(biz?.sameAs || []);
        if (!sameAs.some((u) => /facebook\.com/.test(u)) || !sameAs.some((u) => /youtube\.com/.test(u))) err(file, 'homepage LocalBusiness.sameAs must link the Facebook page and YouTube channel');
        // Country-only is what we had, and it is close to no location signal at
        // all for Google local results or for an AI asked about nearby suppliers.
        if (!biz?.address?.addressLocality) err(file, 'homepage LocalBusiness.address needs addressLocality (see AGENTS.md > production base)');
      }
    } catch (e) {
      err(file, `invalid JSON-LD: ${e.message}`);
    }
  }

  // --- Trust rules (AGENTS.md: never invent results, customer stories or promises) ---
  // Every public page, not only articles.
  for (const [level, msg] of trustProblems(html)) (level === 'err' ? err : warn)(file, msg);

  if (!isArticle) continue;

  // --- Article-only rules ---

  // Brand in the body is what makes search engines and AI assistants cite us.
  const body = (html.split(/<article[^>]*>/)[1] || '').split('</article>')[0];
  const brandInBody = (body.match(/খামারভেস্ট/g) || []).length;
  if (brandInBody < 2) err(file, `brand appears ${brandInBody}x in the article body, needs at least 2`);

  if (!/<script src="\/js\/ga\.js"/.test(html)) err(file, 'missing /js/ga.js, clicks will not be tracked');
  // Every article ends with a generated "সম্পর্কিত গাইড" block. Without it an
  // article is a dead end for the reader and a leaf for the crawler.
  if (!html.includes('<!-- related-guides:start -->')) err(file, 'no related-guides block, run npm run build:related');
  if (!/"@type"\s*:\s*"FAQPage"/.test(html)) warn(file, 'no FAQPage schema (AI assistants pull answers from it)');
  if (!/"@type"\s*:\s*"BreadcrumbList"/.test(html)) warn(file, 'no BreadcrumbList schema');
}

// --- Facebook posts (scripts/social-posts.json) ---
// They reach more farmers than the site does, so the same trust rules apply.
{
  const posts = await readFile(join(root, 'scripts/social-posts.json'), 'utf8');
  const strings = [];
  (function collect(v) { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); })(JSON.parse(posts));
  for (const [level, msg] of trustProblems(strings.join('\n'))) (level === 'err' ? errors.push(`scripts/social-posts.json: ${msg}`) : warn('scripts/social-posts.json', msg));
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

// llms.txt is the short index (one line per page) that assistants fetch first;
// llms-full.txt carries the per-guide summaries. The trust, dash and digit rules
// apply to both, because both are quoted verbatim.
const LLMS_FILES = ['llms.txt', 'llms-full.txt'];
const llmsText = {};
for (const name of LLMS_FILES) {
  if (!await exists(join(root, name))) { errors.push(`${name}: missing`); llmsText[name] = ''; continue; }
  llmsText[name] = await readFile(join(root, name), 'utf8');
}
const llms = llmsText['llms.txt'];
const llmsFull = llmsText['llms-full.txt'];
for (const [name, text] of Object.entries(llmsText)) {
  if (/[—–]/.test(text)) errors.push(`${name}: contains an em or en dash`);
  for (const phrase of PROMISED_EARNINGS) {
    if (text.includes(phrase)) errors.push(`${name}: promises earnings or gives a guarantee: "${phrase}". Assistants quote this file verbatim`);
  }
  for (const phrase of INVENTED_TESTIMONIAL) {
    if (text.includes(phrase)) errors.push(`${name}: invented customer testimonial: "${phrase}"`);
  }
  const deva = text.match(/[०-९]+/g);
  if (deva) errors.push(`${name}: Devanagari digits instead of Bengali: ${[...new Set(deva)].join(' ')}`);
  // Every site URL it hands an assistant must exist and be extensionless.
  for (const m of text.matchAll(/https:\/\/silage\.khamarvest\.com(\/[\w\/.#-]*)?(?![\w\/.#<-])/g)) {
    const path = m[1] || '/';
    if (/\.html(#|$)/.test(path)) errors.push(`${name}: .html URL ${m[0]}, use the extensionless form`);
    else if (!await resolves(path)) errors.push(`${name}: URL does not resolve: ${m[0]}`);
  }
}
// Many assistants truncate a long llms.txt, and it had grown to 58 KB. Keep it
// an index: one line per page, summaries go in llms-full.txt.
const llmsBytes = Buffer.byteLength(llms, 'utf8');
if (llmsBytes > 16 * 1024) errors.push(`llms.txt: ${(llmsBytes / 1024).toFixed(1)} KB, keep it under 16 KB (one line per page; move summaries to llms-full.txt)`);
if (!llms.includes(`${site}/llms-full.txt`)) errors.push('llms.txt: does not point to llms-full.txt');
for (const file of articles) {
  const slug = file.replace(/\.html$/, '');
  if (!llms.includes(slug)) warnings.push(`llms.txt: does not list ${slug}, AI assistants will not see it`);
  if (!llmsFull.includes(slug)) warnings.push(`llms-full.txt: has no summary of ${slug}`);
}

// --- Recovery page ---
// Cloudflare serves this for every unknown path (wrangler.jsonc >
// assets.not_found_handling). A 404 that dead-ends loses the visitor and wastes
// the crawl, so it must stay noindex, styled, and full of ways back in.
{
  const html = await readFile(join(root, '404.html'), 'utf8');
  if (!/<meta name="robots" content="noindex/i.test(html)) errors.push('404.html: must be noindex, it is not a real page');
  if (!/<link rel="stylesheet" href="\/css\/site\.css">/.test(html)) errors.push('404.html: missing /css/site.css');
  const links = new Set([...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]));
  for (const must of ['/', '/blog/', '/tools/', '/area/']) {
    if (!links.has(must)) errors.push(`404.html: no way back to ${must}`);
  }
  const wrangler = await readFile(join(root, 'wrangler.jsonc'), 'utf8');
  if (!/"not_found_handling"\s*:\s*"404-page"/.test(wrangler)) errors.push('wrangler.jsonc: assets.not_found_handling must be "404-page" or 404.html is never served');
}

// --- RSS feed ---
// An always-current feed is a machine-readable "what changed" endpoint for
// aggregators and AI crawlers, and one discovery path that does not wait on
// Google. It is generated by npm run build:blog, so a stale feed means the
// build was skipped.
{
  const feed = await readFile(join(root, 'feed.xml'), 'utf8');
  if (/[—–]/.test(feed)) errors.push('feed.xml: contains an em or en dash');
  const items = [...feed.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]).filter((u) => u !== `${site}/blog/`);
  if (items.length < 10) errors.push(`feed.xml: only ${items.length} items, run npm run build:blog`);
  for (const url of items) {
    if (!await resolves(new URL(url).pathname)) errors.push(`feed.xml: item does not resolve: ${url}`);
    if (!sitemapUrls.includes(url)) errors.push(`feed.xml: ${url} is not in sitemap.xml, run npm run build:blog`);
  }
  for (const f of ['index.html', 'blog/index.html']) {
    if (!/rel="alternate" type="application\/rss\+xml"/.test(await readFile(join(root, f), 'utf8'))) errors.push(`${f}: no <link rel="alternate"> to /feed.xml, nothing can discover the feed`);
  }
}

// --- Sitemap freshness signals ---
// Stamping every URL with today's date teaches crawlers the field is noise and
// they stop using it to prioritise recrawls. Dates come from each article's
// dateModified and from git for everything else.
{
  const stamps = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  if (new Set(stamps).size < 2) errors.push('sitemap.xml: every lastmod is the same date, which crawlers treat as noise (see scripts/generate-blog-index.mjs)');
  // Bangladesh is UTC+6, so for six hours a day the owner's date is a day ahead
  // of UTC. Allow that one-day skew; anything beyond it is a real typo.
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  for (const stamp of stamps) {
    if (stamp > tomorrow) errors.push(`sitemap.xml: lastmod is more than a day in the future: ${stamp}`);
  }
}

// --- Price consistency ---
// The price is written in ~400 places across ~80 files. A change that lands in
// most of them but not all is the worst outcome available: a farmer reads one
// price and is charged another. scripts/product.json is the source of truth,
// `npm run set-price` does the rewrite, and this makes a partial change
// impossible to ship.
{
  const product = JSON.parse(await readFile(join(root, 'scripts/product.json'), 'utf8'));
  const bn = (n) => Number(n).toLocaleString('en-US').replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);

  // 1. The offers Google reads must match the source of truth.
  const home = await readFile(join(root, 'index.html'), 'utf8');
  // Compared as numbers: the schema writes a non-whole price as "8.50".
  const schemaPrices = [...home.matchAll(/"price":\s*"([\d.]+)"/g)].map((m) => Number(m[1]));
  for (const [label, value] of [['per kg', product.pricePerKg], ['per bag', product.bagPrice]]) {
    if (!schemaPrices.includes(value)) {
      errors.push(`index.html: Product schema has no ${label} offer of ${value}, but scripts/product.json says it should`);
    }
  }
  if (!home.includes(`"priceValidUntil": "${product.priceValidUntil}"`)) {
    errors.push(`index.html: priceValidUntil does not match scripts/product.json (${product.priceValidUntil})`);
  }
  // validFrom is the day the current price took effect (Merchant listings
  // asks for it). It must be the latest date in product.json > history, which
  // set-price keeps in step.
  const priceFrom = product.history.at(-1).from;
  if (!home.includes(`"validFrom": "${priceFrom}"`)) {
    errors.push(`index.html: offers have no validFrom of ${priceFrom} (the latest date in scripts/product.json > history)`);
  }
  for (const file of files) {
    const html = await readFile(join(root, file), 'utf8');
    for (const m of html.matchAll(/"validFrom":\s*"([^"]*)"/g)) {
      if (m[1] !== priceFrom) errors.push(`${file}: validFrom ${m[1]} does not match the current price's start date ${priceFrom}`);
    }
  }

  // The homepage calculator prices by the bag. It kept 500 through the
  // 2026-09-30 change to 425, because set-price did not know the constant.
  for (const m of home.matchAll(/PRICE_PER_BAG\s*=\s*(\d+)/g)) {
    if (Number(m[1]) !== product.bagPrice) errors.push(`index.html: homepage calculator uses ${m[1]} tk/bag but the price is ${product.bagPrice}`);
  }

  // 2. Calculators must charge what the pages advertise.
  for (const file of files.filter((f) => f.startsWith('tools/'))) {
    const html = await readFile(join(root, file), 'utf8');
    for (const m of html.matchAll(/(?:SILAGE_PRICE|PRICE)\s*=\s*(\d+(?:\.\d+)?)/g)) {
      if (Number(m[1]) !== product.pricePerKg) {
        errors.push(`${file}: calculator uses ${m[1]} tk/kg but the price is ${product.pricePerKg}`);
      }
    }
  }

  // 3. llms.txt and llms-full.txt are what assistants quote, so they must not lag the site.
  for (const [name, text] of Object.entries(llmsText)) {
    if (!text.includes(`${money(product.pricePerKg)} টাকা`)) {
      errors.push(`${name}: does not state the current price of ${money(product.pricePerKg)} টাকা`);
    }
  }

  // 4. No page may still show a price we have moved away from.
  const superseded = product.history
    .filter((h) => h.pricePerKg !== product.pricePerKg || h.bagPrice !== product.bagPrice);
  for (const old of superseded) {
    const oK = bn(old.pricePerKg);
    const oB = bn(old.bagPrice);
    const patterns = [
      new RegExp(`${oK} টাকা কেজি`),
      new RegExp(`${oK} টাকা/কেজি`),
      new RegExp(`কেজি(?:<[^>]*>|\\s)*${oK} টাকা`),
      // A bag price only in bag context, and not a transport figure in between:
      // "২০ বস্তা ... পরিবহন ২,০০০ ÷ ৪ = ৫০০ টাকা" is a share, not a price.
      new RegExp(`বস্তা(?:(?!পরিবহন)[^।"]){0,60}?(?<![০-৯,])${oB} টাকা`),
      // English wording, on corn-silage-bangladesh and in the llms files.
      new RegExp(`BDT ${old.pricePerKg}(?:/kg| per kg)`),
      new RegExp(`BDT ${old.bagPrice}(?![\\d,])`),
    ];
    for (const file of [...files, ...LLMS_FILES]) {
      // A page may state the old price as history ("আগে ১২ টাকা ছিল, এখন ১০"),
      // wrapped in <!-- price-history:start --> / <!-- price-history:end -->.
      const html = (await readFile(join(root, file), 'utf8')).replace(/<!-- price-history:start -->[\s\S]*?<!-- price-history:end -->/g, '');
      if (patterns.some((re) => re.test(html))) {
        err(file, `still shows the superseded price (${old.pricePerKg}/kg, ${old.bagPrice}/bag). Run npm run set-price, then fix whatever it reports as needing a human`);
      }
    }
  }
}

// --- Social post library ---
// Every post links to a guide. A typo in a slug sends a farmer who clicked a
// Facebook link to a 404, which is the worst possible first impression.
{
  const { posts } = JSON.parse(await readFile(join(root, 'scripts/social-posts.json'), 'utf8'));
  for (const post of posts) {
    if (!await resolves(`/${post.slug}`)) errors.push(`scripts/social-posts.json: "${post.slug}" does not resolve`);
    if (!post.hook || !post.points?.length || !post.close) errors.push(`scripts/social-posts.json: "${post.slug}" is missing hook, points or close`);
  }
  const seasons = new Set(posts.map((p) => p.season));
  for (const needed of ['monsoon', 'winter', 'summer', 'qurbani']) {
    if (!seasons.has(needed)) warnings.push(`scripts/social-posts.json: no post tagged "${needed}", that season will fall back to evergreen`);
  }
}

// --- Favicon ---
// Search Console reported a "Not found (404)", which was /favicon.ico, and only
// the homepage declared an icon at all, as a data: URI that Google's favicon
// crawler cannot fetch. The result was a generic globe beside every result in
// mobile search.
{
  for (const f of ['favicon.ico', 'favicon.svg', 'favicon-48.png', 'favicon-180.png', 'favicon-192.png']) {
    if (!await exists(join(root, f))) errors.push(`missing ${f}, run npm run favicon`);
  }
  const missing = [];
  for (const file of files) {
    const html = await readFile(join(root, file), 'utf8');
    if (!html.includes('<!-- favicon:start -->')) missing.push(file);
    if (/<link rel="icon" href="data:/.test(html)) err(file, 'declares a data: URI favicon, which Google cannot fetch. Use /favicon.ico');
  }
  if (missing.length) errors.push(`${missing.length} page(s) declare no favicon, run npm run build:favicon: ${missing.slice(0, 3).join(', ')}`);
}

// --- Calculated figures and FAQ (single sources) ---
// A figure with a formula must show what the formula gives today, and the
// FAQPage schema must be exactly the visible FAQ. Either failing means a hand
// edit went around the build; `npm run build` repairs both.
for (const file of files) {
  const html = await readFile(join(root, file), 'utf8');
  for (const s of html.matchAll(/<script[\s\S]*?<\/script>/g)) {
    if (s[0].includes('<!--=')) err(file, 'a calc marker sits inside a <script>; markers belong in visible text only');
  }
  for (const m of html.matchAll(MARKER)) {
    let want;
    try { want = evaluate(m[1], file); } catch (e) { err(file, e.message); continue; }
    if (m[2] !== want) err(file, `figure "${m[2]}" should be ${want} by its formula "${m[1]}". Run npm run build`);
  }
  const a = html.indexOf('<!-- faq:start -->');
  if (a !== -1) {
    const clean = (x) => x.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
    const visible = parseFaq(html.slice(a, html.indexOf('<!-- faq:end -->'))).map(([q, ans]) => [clean(q), clean(ans)]);
    const schema = [];
    for (const s of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { const j = JSON.parse(s[1]); for (const n of j['@graph'] || [j]) if (n['@type'] === 'FAQPage') schema.push(...n.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])); } catch {}
    }
    if (JSON.stringify(visible) !== JSON.stringify(schema)) err(file, 'FAQPage schema differs from the visible FAQ. Edit the visible FAQ only, then run npm run build');
  } else if (/"@type"\s*:\s*"FAQPage"/.test(html) && !file.startsWith('area/')) {
    err(file, 'has FAQPage schema but no visible <!-- faq:start --> block (Google wants FAQ markup to match what readers see)');
  }
}

// "দাম কমেছে" is only true after a price cut. After an increase the homepage
// price block (struck-through old price, "টাকা কম" badge) must be rewritten.
if (PRODUCT.previous && PRODUCT.previous.pricePerKg < PRODUCT.pricePerKg) {
  const home = await readFile(join(root, 'index.html'), 'utf8');
  if (/দাম কমেছে|টাকা কম/.test(home)) errors.push(`index.html: the price went up (${PRODUCT.previous.pricePerKg} -> ${PRODUCT.pricePerKg}) but the page still says the price came down. Rewrite the price block`);
}

// --- Business facts (scripts/site.json) ---
// Pages must agree with site.json: a forgotten `npm run build` after editing
// it fails here, and so does any phone number that is not one of ours, which
// is how a typo or a stale number would otherwise survive.
{
  const site = JSON.parse(await readFile(join(root, 'scripts/site.json'), 'utf8'));
  const applied = JSON.parse(await readFile(join(root, 'scripts/site.applied.json'), 'utf8'));
  const strip = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_'))));
  if (strip(site) !== strip(applied)) errors.push('scripts/site.json has changes the pages do not have yet. Run npm run build');
  const ours = new Set([site.whatsapp, site.call, ...site.callExtra].map((n) => n.replace(/\D/g, '').slice(1)));
  for (const file of [...files, ...LLMS_FILES]) {
    const text = await readFile(join(root, file), 'utf8');
    for (const m of text.matchAll(/(?:\+?880[ -]?|(?<![0-9])0)(1[3-9]\d{2})-?(\d{6})(?![0-9])/g)) {
      if (!ours.has(m[1] + m[2])) err(file, `phone number ${m[0]} is not in scripts/site.json`);
    }
  }
}

// --- Mobile order bar ---
// Only the homepage had a floating order button; a phone reader of a guide
// scrolled 11-13 screens to the first WhatsApp link. scripts/order-bar.mjs
// writes the bar into every page except the two with a bottom bar of their own.
{
  const OWN_BAR = new Set(['index.html', 'tools/ration-generator.html', 'guide-book.html']);
  const missing = [];
  for (const file of files) {
    if (OWN_BAR.has(file)) continue;
    const html = await readFile(join(root, file), 'utf8');
    if (!html.includes('<!-- order-bar:start -->')) missing.push(file);
  }
  if (missing.length) errors.push(`${missing.length} page(s) have no mobile order bar, run npm run build:orderbar: ${missing.slice(0, 3).join(', ')}`);
}

// --- District links from articles ---
// District pages convert best (11.2% CTR) but 34 of 38 articles linked none.
// The related-guides block carries a strip of every district page.
for (const file of articles) {
  const html = await readFile(join(root, file), 'utf8');
  const block = html.split('<!-- related-guides:start -->')[1]?.split('<!-- related-guides:end -->')[0] || '';
  if (!/href="\/area\/silage-/.test(block)) err(file, 'related-guides block has no district links, run npm run build:related');
}

// --- IndexNow ---
// Bing verifies ownership by fetching /<key>.txt. If the key in the script and
// the file drift apart every submission is silently rejected.
{
  const src = await readFile(join(root, 'scripts/indexnow.mjs'), 'utf8');
  const key = src.match(/INDEXNOW_KEY = '([a-f0-9]{32})'/)?.[1];
  if (!key) errors.push('scripts/indexnow.mjs: no 32-hex INDEXNOW_KEY');
  else {
    const keyFile = join(root, `${key}.txt`);
    if (!await exists(keyFile)) errors.push(`missing IndexNow key file ${key}.txt at the repo root`);
    else if ((await readFile(keyFile, 'utf8')).trim() !== key) errors.push(`${key}.txt does not contain the key`);
  }
}

// --- Analytics ---
// AI-assistant referrals are the main lead source; both GA bootstraps must tag them.
for (const f of ['js/ga.js', 'index.html']) {
  const src = await readFile(join(root, f), 'utf8');
  if (!src.includes('ai_referral')) errors.push(`${f}: does not fire the ai_referral event (see AGENTS.md > Analytics)`);
  // Farmers who call instead of typing are leads too; every tel: link is tracked.
  if (!src.includes('phone_click')) errors.push(`${f}: does not fire phone_click for tel: links (see AGENTS.md > Analytics)`);
}

// --- Lead capture (AGENTS.md > Lead capture) ---
// Leads go to the owner's Google Sheet; a page that stops loading js/leads.js
// loses them without any visible sign.
{
  const leads = await readFile(join(root, 'js/leads.js'), 'utf8');
  if (!/LEADS_URL = 'https:\/\/script\.google\.com\/macros\/s\/[^']+\/exec'/.test(leads)) errors.push('js/leads.js: LEADS_URL is not a Google Apps Script /exec URL, so no lead is saved');
  if (!(await readFile(join(root, 'js/ga.js'), 'utf8')).includes("'/js/leads.js'")) errors.push('js/ga.js: no longer loads /js/leads.js, so WhatsApp and call taps are not logged');
  if (!(await readFile(join(root, 'index.html'), 'utf8')).includes('src="/js/leads.js"')) errors.push('index.html: does not load /js/leads.js, so the order form saves nothing');
  for (const f of (await readdir(join(root, 'area'))).filter((f) => f.startsWith('silage-') && f.endsWith('.html'))) {
    if (!(await readFile(join(root, 'area', f), 'utf8')).includes('data-lead-form')) errors.push(`area/${f}: has no callback form (data-lead-form). Run npm run build:areas`);
  }
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
