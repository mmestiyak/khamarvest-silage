// Loader for scripts/product.json, the single source of truth for price facts.
// Generators import this instead of hardcoding numbers.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const raw = JSON.parse(await readFile(join(process.cwd(), 'scripts/product.json'), 'utf8'));

/** 1234 -> "১,২৩৪" (Bengali digits, Bengali thousands grouping) */
export function bn(n) {
  return Number(n).toLocaleString('en-US').replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
}

export const product = {
  ...raw,
  perKgBn: bn(raw.pricePerKg),
  bagPriceBn: bn(raw.bagPrice),
  bagKgBn: bn(raw.bagKg),
  /** The price as it was before the current one, or null on the first entry. */
  previous: raw.history.length > 1 ? raw.history[raw.history.length - 2] : null,
};
