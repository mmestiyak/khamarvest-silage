// Snapshots the competing silage sites and reports what changed since last run.
// Run: npm run watch:competitors
//
// AK Silage and Prantor Silage are one operation (same phone number, same
// robots.txt, same seven-page structure, near-identical article text with the
// brand swapped). Knowing when they publish, change price, or start publishing
// a lab analysis is worth more than checking manually and forgetting to.
//
// The snapshot is committed to scripts/competitor-snapshot.json so the diff
// survives between runs.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SNAPSHOT = join(process.cwd(), 'scripts/competitor-snapshot.json');
const SITES = [
  { name: 'AK Silage', url: 'https://www.aksilage.com' },
  { name: 'Prantor Silage', url: 'https://www.prantorsilage.com' },
];

const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function snapshot(site) {
  const out = { name: site.name, url: site.url, checked: new Date().toISOString().slice(0, 10) };
  try {
    const home = await fetch(`${site.url}/`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await home.text();
    out.title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || '';
    const body = text(html);
    // Do they publish a price yet? Today they say "call for price", which is
    // our clearest advantage on price queries.
    out.publishesPrice = /(\d|[০-৯])+\s*(টাকা|tk|BDT)/i.test(body);
    // Do they publish a lab analysis? The day they do, our nutrition guide
    // needs a response.
    out.claimsLab = /(ল্যাব|laboratory|lab report|পরীক্ষাগার)/i.test(body);
    out.nutritionClaims = (body.match(/TDN[^,।]{0,24}|ড্রাই ম্যাটার[^,।]{0,20}|ক্রুড প্রোটিন[^,।]{0,20}/gi) || []).slice(0, 6);
    const sm = await fetch(`${site.url}/sitemap.xml`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    out.pages = sm.ok ? [...(await sm.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort() : [];
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

const previous = JSON.parse(await readFile(SNAPSHOT, 'utf8').catch(() => '{"sites":[]}'));
const current = { sites: await Promise.all(SITES.map(snapshot)) };

const changes = [];
for (const now of current.sites) {
  const before = previous.sites.find((s) => s.name === now.name);
  if (!before) { changes.push(`**${now.name}**: first snapshot, ${now.pages.length} pages.`); continue; }
  const added = now.pages.filter((p) => !before.pages.includes(p));
  const removed = before.pages.filter((p) => !now.pages.includes(p));
  if (added.length) changes.push(`**${now.name}** published ${added.length} new page(s):\n${added.map((p) => `  - ${p}`).join('\n')}`);
  if (removed.length) changes.push(`**${now.name}** removed ${removed.length} page(s):\n${removed.map((p) => `  - ${p}`).join('\n')}`);
  if (now.title !== before.title) changes.push(`**${now.name}** changed its homepage title:\n  was: ${before.title}\n  now: ${now.title}`);
  if (now.publishesPrice && !before.publishesPrice) changes.push(`**${now.name}** now publishes a price on the homepage. Our published price was a clear advantage on price queries; check how theirs compares.`);
  if (!now.publishesPrice && before.publishesPrice) changes.push(`**${now.name}** removed its published price.`);
  if (now.claimsLab && !before.claimsLab) changes.push(`**${now.name}** now mentions a lab report. /blog/silage-pushtiman-dm-cp-tdn tells farmers to ask which lab and which batch, so check whether they actually answer that.`);
}

await writeFile(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);

const lines = [`# Competitor watch, ${new Date().toISOString().slice(0, 10)}`, ''];
if (changes.length) { lines.push('## Changes', ''); changes.forEach((c) => lines.push(`- ${c}`)); }
else lines.push('No changes since the last snapshot.');
lines.push('', '## Current state', '');
for (const s of current.sites) {
  lines.push(`- **${s.name}**: ${s.error ? `unreachable (${s.error})` : `${s.pages.length} pages, price published: ${s.publishesPrice ? 'yes' : 'no'}, mentions a lab: ${s.claimsLab ? 'yes' : 'no'}`}`);
}
console.log(lines.join('\n'));
// Exit 1 only when something actually changed, so the workflow can decide
// whether to open an issue.
if (changes.length) process.exit(1);
