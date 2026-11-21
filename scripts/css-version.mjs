// Stamps every page's stylesheet link with a hash of css/site.css:
// <link rel="stylesheet" href="/css/site.css?v=1a2b3c4d">. Run: npm run build:cssver
// (part of npm run build, right after build:css).
//
// Why: _headers caches /css/* for an hour. On 2026-10-20 the new homepage
// footer went live with new Tailwind classes, and returning visitors got the
// new HTML with the cached old stylesheet: white text on a near-white footer.
// A changed hash is a new URL, so the browser fetches the new CSS at once.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
// Hash with LF line endings: a Windows checkout (core.autocrlf) holds the file
// with CRLF, and the stamp must match the bytes git commits and Cloudflare serves.
export const cssHash = async () => createHash('sha256').update((await readFile(join(root, 'css/site.css'), 'utf8')).replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);

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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const v = await cssHash();
  let changed = 0;
  for (const file of await walk('')) {
    const before = await readFile(join(root, file), 'utf8');
    const html = before.replace(/href="\/css\/site\.css(\?v=[0-9a-f]+)?"/g, `href="/css/site.css?v=${v}"`);
    if (html !== before) { await writeFile(join(root, file), html); changed += 1; }
  }
  console.log(`CSS version ${v}: stamped ${changed} page(s).`);
}
