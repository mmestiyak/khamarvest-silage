// Contact numbers for the generators (order bar, district pages), read from
// scripts/site.json so there is one place to change them. See EDITING.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const site = JSON.parse(readFileSync(join(process.cwd(), 'scripts/site.json'), 'utf8'));
const intl = (local) => `880${local.replace(/\D/g, '').slice(1)}`;
// WhatsApp is the order line everywhere, including the JSON-LD.
export const WA_NUMBER = intl(site.whatsapp);
// The line that takes calls (owner, 2026-09-29).
export const CALL_TEL = `+${intl(site.call)}`;
