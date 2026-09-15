// Rewrites hero <img src="/img/*.jpeg"> into <picture> with responsive WebP and
// JPEG sources. Run after npm run images.
//
// Why this matters: the hero is the LCP element on almost every page, and we
// were shipping one 1200-1400 px file to everybody. A farmer on a phone was
// downloading a 570 KB image to paint it 375 px wide.
//
// Idempotent by construction: it first unwraps any <picture> it previously
// wrote, then wraps once. Re-running can never nest. (An earlier version
// checked a fixed lookback window for "<picture>" and silently double-wrapped
// twelve files, because the srcset attributes are longer than the window.)
//
// Only absolute /img/ sources are touched. The homepage uses relative img/
// paths with hand-tuned `sizes` for its square photos, and is left alone.
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const WIDTHS = [480, 800, 1200];
// The hero sits in the article column: roughly 800 px on a desktop, full
// viewport on a phone. Getting this wrong only costs one size bucket.
const SIZES = '(min-width: 1024px) 800px, 100vw';
const UNWRAP = /<picture>(?:<source\b[^>]*>)*(<img\b[^>]*>)<\/picture>/g;

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', 'img', 'js', 'css', 'fonts', 'scripts'].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walk(rel));
    else if (entry.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

async function srcset(base, ext) {
  const parts = [];
  for (const w of WIDTHS) {
    if (await exists(join(root, 'img', `${base}-${w}w.${ext}`))) parts.push(`/img/${base}-${w}w.${ext} ${w}w`);
  }
  return parts.join(', ');
}

let changed = 0;
let wrapped = 0;
let repaired = 0;
for (const file of await walk('')) {
  const original = await readFile(join(root, file), 'utf8');

  // 1. Unwrap, repeatedly, so any nesting from an earlier run collapses.
  let html = original;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = html.replace(UNWRAP, '$1');
    if (next === html) break;
    html = next;
    if (pass > 0) repaired += 1;
  }

  // 2. Wrap each bare /img/ hero exactly once.
  const tags = [...html.matchAll(/<img\b[^>]*src="\/img\/([^"]+)\.jpeg"[^>]*>/g)];
  for (const m of tags) {
    const [tag, base] = [m[0], m[1]];
    const webp = await srcset(base, 'webp');
    if (!webp) continue; // no variants generated for this image
    const jpeg = await srcset(base, 'jpeg');
    const picture = '<picture>'
      + `<source type="image/webp" srcset="${webp}" sizes="${SIZES}">`
      + (jpeg ? `<source type="image/jpeg" srcset="${jpeg}" sizes="${SIZES}">` : '')
      + tag
      + '</picture>';
    html = html.replace(tag, picture);
    wrapped += 1;
  }

  if (html !== original) {
    await writeFile(join(root, file), html);
    changed += 1;
  }
}
console.log(`Wrapped ${wrapped} image(s) across ${changed} file(s).${repaired ? ` Repaired ${repaired} nested <picture>.` : ''}`);
