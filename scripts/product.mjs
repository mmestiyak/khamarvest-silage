// Loader for scripts/product.json, the single source of truth for price facts.
// Generators import this instead of hardcoding numbers.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const raw = JSON.parse(await readFile(join(process.cwd(), 'scripts/product.json'), 'utf8'));

/** 1234 -> "১,২৩৪" (Bengali digits, Bengali thousands grouping) */
export function bn(n) {
  return Number(n).toLocaleString('en-US').replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
}

/** A price: whole numbers as they are, anything else with two decimals, so
 *  8.5 is written "৮.৫০" (money), never "৮.৫". */
export function money(n) {
  const v = Number(n);
  return Number.isInteger(v) ? bn(v) : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
}
/** The same in Latin digits, for English copy and JSON-LD ("8.50"). */
export function moneyEn(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export const product = {
  ...raw,
  perKgBn: money(raw.pricePerKg),
  perKgEn: moneyEn(raw.pricePerKg),
  bagPriceBn: bn(raw.bagPrice),
  bagKgBn: bn(raw.bagKg),
  /** The price as it was before the current one, or null on the first entry. */
  previous: raw.history.length > 1 ? raw.history[raw.history.length - 2] : null,
};
