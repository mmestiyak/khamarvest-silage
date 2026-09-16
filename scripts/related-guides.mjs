// Appends a "সম্পর্কিত গাইড" block to the end of every article body.
// Run: npm run build:related (part of npm run build).
//
// Why: thirty articles each linked to three or four others by hand, chosen
// while writing, so the graph is lopsided and a reader who finishes an article
// often has nowhere obvious to go next. A consistent block at the end of every
// article gives every guide inbound links, spreads crawl depth evenly, and
// keeps a farmer reading.
//
// Related guides are picked by shared topic tags below, preferring articles the
// current one does NOT already link to, so the block adds paths instead of
// repeating the ones already in the text. Tags are explicit rather than derived
// from keywords: a wrong "related" link is worse than none, and this way the
// choices are reviewable in one place.
//
// Idempotent: it strips any block it previously wrote before adding a new one.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const MARKER_OPEN = '<!-- related-guides:start -->';
const MARKER_CLOSE = '<!-- related-guides:end -->';

// slug -> topic tags. First tag is the primary one.
const TAGS = {
  'silage-ki-kivabe-toiri-upokarita': ['silage-basics', 'feeding'],
  'silage-pushtiman-dm-cp-tdn': ['silage-basics', 'buying'],
  'vutta-silage-prothombar-khawano-rules': ['feeding', 'silage-basics'],
  'vutta-silage-khawanor-poriman-o-hishab': ['feeding', 'cost'],
  'silage-songrokkhon-niyom': ['storage', 'silage-basics'],
  'vutta-silage-noshto-chinben': ['storage', 'buying'],
  'silage-mano-jachai': ['buying', 'storage'],
  'silage-kothay-pawa-jay': ['buying', 'cost'],
  'nirapode-silage-kenar-niyom': ['buying', 'cost'],
  'vutta-silage-dam-koto-kothay-kinben': ['cost', 'buying'],
  'silage-vs-kacha-ghas-vs-khor': ['cost', 'feeding'],
  'silage-kinben-naki-nije-banaben': ['cost', 'silage-basics'],
  'nepier-ghas-vs-vutta-silage': ['feeding', 'cost'],
  'silage-niye-vul-dharona': ['silage-basics', 'feeding'],
  'mohisher-khaddo-o-silage': ['feeding', 'dairy'],
  'chagol-vera-silage-khawano-guide': ['feeding', 'silage-basics'],
  'rumen-kivabe-kaj-kore': ['feeding', 'health'],
  'go-khaddo-shobdokosh': ['feeding', 'silage-basics'],
  'khonij-lobon-mineral-mixture': ['feeding', 'health'],
  'danadar-khaddo-goru-ration': ['feeding', 'dairy'],
  'gavir-dudh-baranor-upay': ['dairy', 'feeding'],
  'gorvoboti-gavir-khaddo-dry-period': ['dairy', 'breeding'],
  'gavir-heat-o-projonon-niyom': ['breeding', 'dairy'],
  'bachur-jotno-o-khaddo': ['breeding', 'health'],
  'kom-jaiyay-gavir-palan-labh': ['dairy', 'management'],
  'goru-motatajakoron-khaddo-talika': ['beef', 'feeding'],
  'qurbani-goru-motatajakoron-porikolpona': ['beef', 'management'],
  'gorur-ojon-mapar-niyom': ['management', 'feeding'],
  'gorur-khamar-shuru-korar-upay': ['management', 'cost'],
  'goru-tika-o-krimi-tarik-talika': ['health', 'management'],
  'gorur-khura-rog-fmd-lokkhon-o-koronio': ['health'],
  'gorur-pet-fapa-hole-koronio': ['health', 'feeding'],
  'gorome-gorur-jotno-heat-stress': ['seasonal', 'health'],
  'shite-gorur-thanda-jhuki-o-khaddo': ['seasonal', 'health'],
  'goru-shitokale-khaddo-vyobosthapna': ['seasonal', 'feeding'],
  'borshakale-gorur-khaddo-babosthapona': ['seasonal', 'feeding'],
};

function slugOf(file) {
  return file.replace(/^blog\//, '').replace(/\.html$/, '');
}
function urlOf(file) {
  return `/${file.replace(/\.html$/, '')}`;
}

const files = [
  'vutta-silage-prothombar-khawano-rules.html',
  ...(await readdir(join(root, 'blog')))
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && f !== 'article-template.html')
    .map((f) => `blog/${f}`),
];

const articles = [];
for (const file of files) {
  const html = await readFile(join(root, file), 'utf8');
  const slug = slugOf(file);
  const tags = TAGS[slug];
  if (!tags) throw new Error(`scripts/related-guides.mjs: no tags for ${slug}. Add it to TAGS.`);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s*\|[^|]*$/u, '').trim();
  articles.push({ file, slug, tags, title, url: urlOf(file), html });
}

function score(a, b) {
  let s = 0;
  b.tags.forEach((t, i) => {
    const j = a.tags.indexOf(t);
    if (j === -1) return;
    s += (a.tags.length - j) + (b.tags.length - i); // primary-to-primary scores highest
  });
  return s;
}

let updated = 0;
for (const a of articles) {
  // Strip a previously written block so re-running never stacks them.
  const base = a.html.replace(new RegExp(`\\s*${MARKER_OPEN}[\\s\\S]*?${MARKER_CLOSE}`, 'g'), '');
  const alreadyLinked = new Set([...base.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]));

  const ranked = articles
    .filter((b) => b.slug !== a.slug && score(a, b) > 0)
    .map((b) => ({ b, s: score(a, b), fresh: alreadyLinked.has(b.url) ? 0 : 1 }))
    // A guide this article does not already link to is worth more: the block
    // should open new paths, not restate links already in the prose.
    .sort((x, y) => y.fresh - x.fresh || y.s - x.s || x.b.slug.localeCompare(y.b.slug))
    .slice(0, 4)
    .map((x) => x.b);
  if (ranked.length < 3) throw new Error(`${a.slug}: only ${ranked.length} related guides found, check TAGS`);

  const cards = ranked.map((b) => `
          <a href="${b.url}" class="block rounded-xl border border-[#184d32]/10 bg-white p-4 transition hover:border-[#0e7c4b] hover:shadow-sm">
            <span class="block font-semibold leading-7 text-[#0b6a3e]">${b.title}</span>
          </a>`).join('');

  const block = `
          ${MARKER_OPEN}
          <section class="mt-10 border-t border-[#184d32]/10 pt-7">
            <h2 class="text-lg font-bold text-[#123b28]">সম্পর্কিত গাইড</h2>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">${cards}
            </div>
          </section>
          ${MARKER_CLOSE}`;

  // Insert just before the article body's closing wrapper.
  const close = '\n        </div>\n      </article>';
  if (!base.includes(close)) throw new Error(`${a.slug}: could not find the article body close to insert before`);
  const out = base.replace(close, `${block}${close}`);
  if (out !== a.html) {
    await writeFile(join(root, a.file), out);
    updated += 1;
  }
}
console.log(`Related-guides block written into ${updated} of ${articles.length} article(s).`);
