// One FAQ per page, written once. Run: npm run build:faq (part of npm run build).
//
// Why: until 2026-09-30 every article wrote its FAQ twice, once as FAQPage
// JSON-LD and once (sometimes) as visible text, and 185 of the 198 schema
// questions were not on the page at all. Google's structured-data rules want
// FAQ markup to match what the reader can see, and two copies drift: a price
// change fixed one and not the other.
//
// Now the visible block is the source:
//
//   <!-- faq:start -->
//   <h2 id="faq" ...>সাধারণ প্রশ্ন</h2>
//   <div class="...">
//     <details ...><summary ...>Question?</summary><p ...>Answer, may contain <a>links</a>.</p></details>
//     ...
//   </div>
//   <!-- faq:end -->
//
// and every build rewrites the page's FAQPage JSON-LD from it (tags stripped).
// Edit the visible question or answer; never edit the JSON-LD FAQ by hand.
//
// `node scripts/faq.mjs --migrate` is the one-time step that created the
// visible blocks from the schema on pages that had none.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const MIGRATE = process.argv.includes('--migrate');
const OPEN = '<!-- faq:start -->';
const CLOSE = '<!-- faq:end -->';

const H2 = `class="mt-11 font-['Noto_Serif_Bengali'] text-2xl font-bold leading-snug text-[#123b28] sm:text-3xl"`;
const DETAILS = 'class="rounded-xl border border-[#184d32]/10 bg-white p-5"';
const SUMMARY = 'class="block cursor-pointer py-2 font-bold text-[#0b6a3e]"';
const ANSWER = 'class="mt-2 text-[#33483a]"';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

export function block(items) {
  const rows = items.map(([q, a]) => `      <details ${DETAILS}><summary ${SUMMARY}>${q}</summary><p ${ANSWER}>${a}</p></details>`).join('\n');
  return `${OPEN}\n          <h2 id="faq" ${H2}>সাধারণ প্রশ্ন</h2>\n          <div class="mt-4 space-y-3">\n${rows}\n          </div>\n          ${CLOSE}`;
}

/** Q/A pairs from a visible FAQ block, as HTML (answers keep their links). */
export function parse(blockHtml) {
  const details = [...blockHtml.matchAll(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*<\/details>/g)];
  // Some pages (the English page, the ration generator) write each question
  // as an <h3> followed by one <p>; that is equally a single source.
  const headed = details.length ? [] : [...blockHtml.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<p\b[^>]*>([\s\S]*?)<\/p>/g)];
  return [...details, ...headed].map((m) => [m[1].trim(), m[2].trim()]);
}

/** Every ld+json script with its parsed JSON. */
function ldScripts(html) {
  return [...html.matchAll(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g)]
    .map((m) => ({ full: m[0], open: m[1], close: m[3], index: m.index, json: JSON.parse(m[2]) }));
}
const faqNode = (json) => (json['@graph'] || [json]).find((n) => n['@type'] === 'FAQPage');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', 'img', 'js', 'css', 'fonts', 'scripts', 'area'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(rel));
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

// Where a new visible block goes: before the Facebook box that closes every
// article, else before the sources, else before the generated blocks, else at
// the end of the article body. -1 means "no safe place", and the page is skipped.
function insertAt(html) {
  const fb = html.indexOf('<section class="mt-9 rounded-2xl border border-[#0b5fcc]/20');
  if (fb !== -1) return fb;
  const src = html.indexOf('>তথ্যসূত্র</h2>');
  if (src !== -1) return html.lastIndexOf('<section', src);
  const rel = html.indexOf('<!-- related-guides:start -->');
  if (rel !== -1) return rel;
  const end = html.indexOf('\n        </div>\n      </article>');
  return end === -1 ? -1 : end + 1;
}

// Pages whose existing visible Q&A differs from their schema FAQ: merged by
// hand once, not overwritten here.
const SKIP_MIGRATE = new Set(process.argv.filter((a) => a.startsWith('--skip=')).flatMap((a) => a.slice(7).split(',')));

if (import.meta.url === `file://${process.argv[1]}`) {
  let synced = 0; let migrated = 0;
  for (const file of await walk('')) {
    let html = await readFile(join(root, file), 'utf8');
    const scripts = ldScripts(html);
    const holder = scripts.find((s) => faqNode(s.json));
    const hasBlock = html.includes(OPEN);

    if (!hasBlock && holder && MIGRATE && !SKIP_MIGRATE.has(file)) {
      if (insertAt(html) === -1) { console.log(`FAQ: ${file} has schema FAQ but no safe place for a visible block, skipped`); continue; }
      const items = faqNode(holder.json).mainEntity.map((q) => [esc(q.name), esc(q.acceptedAnswer.text)]);
      const at = insertAt(html);
      html = `${html.slice(0, at)}${block(items)}\n\n          ${html.slice(at)}`;
      migrated += 1;
    }
    if (!html.includes(OPEN)) { if (html !== await readFile(join(root, file), 'utf8')) await writeFile(join(root, file), html); continue; }

    const inner = html.slice(html.indexOf(OPEN), html.indexOf(CLOSE));
    const items = parse(inner);
    if (!items.length) throw new Error(`${file}: faq block has no <details><summary>…</summary><p>…</p></details> items`);
    const mainEntity = items.map(([q, a]) => ({ '@type': 'Question', name: text(q), acceptedAnswer: { '@type': 'Answer', text: text(a) } }));

    const fresh = ldScripts(html);
    let target = fresh.find((s) => faqNode(s.json));
    if (target) {
      faqNode(target.json).mainEntity = mainEntity;
    } else {
      // A page with a visible FAQ and no FAQPage yet: add it to the first graph.
      target = fresh[0];
      if (!target) throw new Error(`${file}: visible FAQ but no JSON-LD to attach FAQPage to`);
      const node = { '@type': 'FAQPage', mainEntity };
      if (target.json['@graph']) target.json['@graph'].push(node);
      else target.json = { '@context': 'https://schema.org', '@graph': [Object.fromEntries(Object.entries(target.json).filter(([k]) => k !== '@context')), node] };
    }
    const rebuilt = `${target.open}\n${JSON.stringify(target.json, null, 2)}\n  ${target.close}`;
    const out = html.slice(0, target.index) + rebuilt + html.slice(target.index + target.full.length);
    if (out !== await readFile(join(root, file), 'utf8')) { await writeFile(join(root, file), out); synced += 1; }
  }
  console.log(`FAQ: ${migrated ? `${migrated} visible block(s) created, ` : ''}schema rewritten from the visible FAQ in ${synced} page(s).`);
}
