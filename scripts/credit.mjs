// Writes the developer credit line into the footer of every page, and the
// founder Person into the LocalBusiness on the homepage and /about. Run: npm run build:credit
// (part of npm run build, before build:css).
//
// Why: a named person behind a cash-on-delivery business is a trust signal for
// farmers, and the schema Person (with the online handle and personal site)
// lets Google and AI assistants tie the brand to its co-founder. The visible
// name pairs Bengali with "Meer Estiyak", the name he is known by online, so
// entity matching works; the full Bengali name lives in alternateName.
//
// Idempotent: it strips the block it previously wrote before inserting.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const OPEN = '<!-- credit:start -->';
const CLOSE = '<!-- credit:end -->';
const SITE = 'https://mmestiyak.com';

export const FOUNDER = {
  '@type': 'Person',
  '@id': `${SITE}/#person`,
  name: 'Meer Estiyak',
  alternateName: ['মীর মোঃ ইশতিয়াক আহমেদ', 'মীর ইশতিয়াক', 'mmestiyak'],
  jobTitle: 'Co-founder, Khamarvest',
  url: SITE,
  // Same @id and profiles as the Person on mmestiyak.com, whose /farm/ page
  // links back to this site, so both sides describe one entity.
  sameAs: [
    `${SITE}/farm/`,
    'https://www.linkedin.com/in/mmestiyak',
    'https://github.com/mmestiyak',
    'https://twitter.com/mmestiyak',
    'https://www.instagram.com/mmestiyak/',
  ],
};

const line = (dark, en) => `${OPEN}
    <p class="mx-auto max-w-[1140px] px-2 pb-3 text-center text-[14px] ${dark ? 'text-white/80' : 'text-[#54705d]'}">${en
      ? 'Website built and maintained by'
      : 'ওয়েবসাইট তৈরি ও দেখাশোনা:'} <a href="${SITE}" rel="author" class="underline underline-offset-2">${en ? 'Meer Estiyak' : 'মীর ইশতিয়াক (Meer Estiyak)'}</a>, ${en ? 'co-founder, Khamarvest' : 'সহপ্রতিষ্ঠাতা, খামারভেস্ট'}</p>
    ${CLOSE}`;

const SKIP = new Set(['gmb-cover-photo.html', 'guide-book.html']);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', 'img', 'js', 'css', 'fonts', 'scripts'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(rel));
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

// Adds founder to the first schema node of the given type, keeping formatting.
function addFounder(html, type) {
  return html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (all, open, body, close) => {
    const json = JSON.parse(body);
    const nodes = json['@graph'] || [json];
    const node = nodes.find((n) => [].concat(n['@type']).includes(type));
    if (!node) return all;
    node.founder = FOUNDER;
    return `${open}\n${JSON.stringify(json, null, 2)}\n  ${close}`;
  });
}

let changed = 0;
for (const file of await walk('')) {
  const before = await readFile(join(root, file), 'utf8');
  let html = before.replace(new RegExp(`\\s*${OPEN}[\\s\\S]*?${CLOSE}\\s*(?=</footer>)`, 'g'), '');
  if (!SKIP.has(file) && html.includes('</footer>')) {
    const footer = html.slice(html.lastIndexOf('<footer'), html.lastIndexOf('</footer>'));
    const dark = /<footer[^>]*bg-black/.test(footer);
    // Footers that are one inline <footer>…text…</footer> line need the credit on its own line.
    html = html.replace(/<\/footer>(?![\s\S]*<\/footer>)/, `\n    ${line(dark, /<html lang="en"/.test(html))}\n  </footer>`);
  }
  if (file === 'index.html') html = addFounder(html, 'LocalBusiness');
  if (file === 'about.html') html = addFounder(html, 'LocalBusiness');
  if (html !== before) { await writeFile(join(root, file), html); changed += 1; }
}
console.log(`Credit: wrote footer credit / founder schema in ${changed} page(s).`);
