// Turns every plain-text phone number in page copy into a tap-to-open link:
// the WhatsApp number opens wa.me, the call numbers open tel:. Run: npm run build:contact
// (part of npm run build, before build:css).
//
// Why: a farmer on a phone who reads "WhatsApp +880 1334-211984" had to copy the
// number by hand. A wa.me link also lets /js/ga.js prefill the message with the
// page's H1 and count the tap, exactly like every other WhatsApp link.
//
// It only touches text nodes: tags and attributes, <a>, <script> (JSON-LD),
// <style>, <title>, <textarea> and comments are left alone, so it is idempotent
// and runs safely over generated pages. Numbers come from scripts/site.json.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const site = JSON.parse(await readFile(join(root, 'scripts/site.json'), 'utf8'));

const digits = (n) => n.replace(/\D/g, '');
const intl = (local) => `880${digits(local).slice(1)}`;
// "01334-211984" and "+880 1334-211984": the two ways the site writes a number.
const forms = (local) => {
  const d = digits(local);
  return [`${d.slice(0, 5)}-${d.slice(5)}`, `+880 ${d.slice(1, 5)}-${d.slice(5)}`, d];
};
const TARGETS = [
  { local: site.whatsapp, href: `https://wa.me/${intl(site.whatsapp)}` },
  ...[site.call, ...(site.callExtra || [])].map((n) => ({ local: n, href: `tel:+${intl(n)}` })),
];
const byText = new Map();
for (const t of TARGETS) for (const f of forms(t.local)) if (!byText.has(f)) byText.set(f, t.href);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NUMBER = new RegExp(`(?<![\\d+-])(${[...byText.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![\\d-])`, 'g');

const PROTECTED = /(<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<a\b[\s\S]*?<\/a>|<title\b[\s\S]*?<\/title>|<textarea\b[\s\S]*?<\/textarea>|<[^>]*>)/;

export function linkify(html) {
  return html.split(PROTECTED).map((part, i) => (i % 2 ? part : part.replace(NUMBER, (m) => `<a href="${byText.get(m)}" class="font-medium underline">${m}</a>`))).join('');
}
export function bareNumbers(html) {
  return html.split(PROTECTED).filter((_, i) => i % 2 === 0).flatMap((p) => p.match(NUMBER) || []);
}

const SKIP = new Set(['node_modules', '.git', 'scripts', 'css', 'js', 'fonts', 'img', '.claude', '.github']);
async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let changed = 0, links = 0;
  for (const file of await walk('')) {
    const html = await readFile(join(root, file), 'utf8');
    const next = linkify(html);
    if (next !== html) { await writeFile(join(root, file), next); changed++; links += bareNumbers(html).length; }
  }
  console.log(`build:contact: linked ${links} number(s) in ${changed} file(s)`);
}
