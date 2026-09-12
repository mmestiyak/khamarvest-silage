// Checks every external source link on the site still resolves.
//
// Articles cite DAERA, Teagasc, LSU and similar extension pages in their
// তথ্যসূত্র sections. Those pages get moved or deleted (two had died by
// September 2026). A dead citation looks careless to a farmer and to Google.
// The monthly GitHub Action runs this and opens an issue listing what broke.
//
// Run locally: npm run check:links
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Not sources: our own social/contact links, analytics, our own domain.
const SKIP_HOSTS = /(^|\.)(facebook\.com|wa\.me|youtube\.com|googletagmanager\.com|google\.com|khamarvest\.com|schema\.org|w3\.org)$/;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', '.github', 'img', 'js', 'css', 'fonts', 'scripts'].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walk(rel));
    else if (entry.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

// url -> Set of files that link it
const links = new Map();
for (const file of await walk('')) {
  const html = await readFile(join(root, file), 'utf8');
  for (const m of html.matchAll(/href="(https?:\/\/[^"#]+)/g)) {
    let host;
    try { host = new URL(m[1]).hostname; } catch { continue; }
    if (SKIP_HOSTS.test(host)) continue;
    if (!links.has(m[1])) links.set(m[1], new Set());
    links.get(m[1]).add(file);
  }
}

async function probe(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, redirect: 'follow', signal: ctrl.signal });
    return { status: res.status, finalUrl: res.url };
  } catch (e) {
    // Node rejects the half-configured TLS chains that dls.gov.bd, dncrp.gov.bd
    // and some universities serve. A browser still opens them, so a certificate
    // failure is "check by hand", not "dead". Only a missing domain is dead.
    const code = e.cause?.code || e.code || (e.name === 'AbortError' ? 'timeout' : e.message);
    const tls = /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|ERR_TLS/i.test(code);
    return { status: 0, error: code, tls };
  } finally {
    clearTimeout(timer);
  }
}

const dead = [];     // 404, 410, 5xx, network error: the citation is gone
const blocked = [];  // 403/405/429 bot walls and TLS-misconfigured sites: a human should click it
const ok = [];
for (const [url, files] of links) {
  const r = await probe(url);
  const entry = { url, files: [...files], ...r };
  if (r.status >= 200 && r.status < 400) ok.push(entry);
  else if ([401, 403, 405, 429].includes(r.status) || r.tls) blocked.push(entry);
  else dead.push(entry);
}

const line = (e) => `- ${e.url}  (${e.status || e.error})\n  cited in: ${e.files.join(', ')}`;
console.log(`# External source links: ${links.size} checked, ${ok.length} ok, ${blocked.length} bot-blocked, ${dead.length} dead\n`);
if (dead.length) console.log(`## Dead links (replace the citation)\n${dead.map(line).join('\n')}\n`);
if (blocked.length) console.log(`## Bot-blocked or certificate problem (open in a browser to confirm they still exist)\n${blocked.map(line).join('\n')}\n`);
if (!dead.length) console.log('No dead links.');
process.exit(dead.length ? 1 : 0);
