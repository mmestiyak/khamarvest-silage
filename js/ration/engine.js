// Least-cost ration formulation.
//
// Given an animal and the feeds a farmer can actually buy (with their local
// prices), find the cheapest daily mix that meets the animal's dry matter,
// protein and energy needs while respecting the rumen (minimum roughage) and
// each feed's safe ceiling. Calcium and phosphorus are topped up afterwards
// with DCP, which is how it is done on the farm.
//
// The LP is written as a goal programme: shortfall variables with a steep
// penalty stand in for each requirement, so a feed list that cannot meet a
// requirement still yields the best ration it can, and the shortfall tells the
// UI exactly what is missing (protein source, energy source, or simply too few
// feed types to fill the animal). Everything here is pure: no DOM, no fetch.

import { FEEDS, ADDITIVES, CATEGORY, SOURCES, feedById, feedMax } from './feeds.js';
import { requirements, ANIMALS } from './requirements.js';
import { solveLP } from './lp.js';

export { FEEDS, ADDITIVES, CATEGORY, SOURCES, ANIMALS, requirements };
export const CATEGORY_LABELS = Object.fromEntries(Object.values(CATEGORY).map((c) => [c.id, c.label]));

// Penalties per unit of shortfall, well above what any feed costs per unit of
// the same nutrient, so the optimiser only accepts a shortfall when no
// combination of the selected feeds can avoid it.
const PENALTY = { dm: 400, cp: 2, me: 40 }; // taka per kg DM, per g CP, per MJ ME
// Energy above this share of requirement is discouraged (not forbidden): a dry
// cow or a goat filled up on the cheapest energy-dense feed gets fat, and fat
// dry cows calve badly. The penalty is small, so straw or grass wins as the
// filler only when it costs little more.
const ME_CEILING = 1.15;
const PENALTY_ME_OVER = 12; // taka per MJ above the ceiling
// Phosphorus above this share of DM does nothing for the animal: dairy cows
// yielding up to 40 L are fully supplied at 0.35-0.40% (NRC 2001; Wu & Satter
// 2000), and the surplus is excreted. Bran and oil cake carry 1-1.7% P, so a
// bran-heavy ration drifts to 0.7%, the NRC (2005) maximum tolerable level,
// and then needs a large dose of limestone to hold Ca:P. The limit is soft so
// a farm that only has bran still gets a ration; the UI says when it is hit.
export const P_CEILING_PCT = 0.5;
const PENALTY_P_OVER = 2; // taka per g P above the ceiling

/** Feeds with `default: true`, priced at their defaults, for a first render. */
export function defaultSelection(silagePrice) {
  return FEEDS.filter((f) => f.default).map((f) => ({ id: f.id, price: f.silage && silagePrice != null ? silagePrice : f.price }));
}

// A selection entry names a feed from the table by `id`, or carries its own
// `custom` definition (a farmer's local by-product, priced and described by
// them, usually with nutrients copied from the nearest table feed).
function resolveFeeds(selection, req, silagePrice, excluded) {
  const animalType = req.type;
  const out = [];
  for (const sel of selection) {
    const f = sel.custom
      ? { id: sel.id, cat: sel.custom.cat === 'rough' ? 'rough' : 'conc', bn: sel.custom.bn || sel.id, dm: Number(sel.custom.dm) || 88, cp: Number(sel.custom.cp) || 0, me: Number(sel.custom.me) || 0, ca: Number(sel.custom.ca) || 0, p: Number(sel.custom.p) || 0, price: Number(sel.custom.price) || 0, max: Math.min(1, Math.max(0.02, Number(sel.custom.max) || 0.3)), custom: true }
      : feedById(sel.id);
    if (!f || f.dm <= 0) continue;
    // Feeds that are unsafe for this animal's state (UMS in late pregnancy)
    // are dropped here and reported, rather than silently priced in.
    if (f.avoidWhen && Object.keys(f.avoidWhen).some((k) => !!req[k] === f.avoidWhen[k])) { excluded.push({ id: f.id, bn: f.bn, why: Object.keys(f.avoidWhen)[0] }); continue; }
    const price = sel.price != null && sel.price !== '' ? Math.max(0, Number(sel.price)) : (f.silage && silagePrice != null ? silagePrice : f.price);
    let maxKg = sel.maxKg != null && sel.maxKg !== '' && Number(sel.maxKg) > 0 ? Number(sel.maxKg) : null;
    if (f.maxKgPerBW) maxKg = Math.min(maxKg ?? Infinity, f.maxKgPerBW * req.weight);
    out.push({ ...f, price, maxKg, maxShare: feedMax(f, animalType), costPerKgDM: price / (f.dm / 100) });
  }
  return out;
}

function solve(feeds, req) {
  const n = feeds.length;
  const S = { dm: n, cp: n + 1, me: n + 2, over: n + 3, pOver: n + 4 };
  const nv = n + 5;
  const c = new Array(nv).fill(0);
  feeds.forEach((f, i) => { c[i] = f.costPerKgDM; });
  c[S.dm] = PENALTY.dm;
  c[S.cp] = PENALTY.cp;
  c[S.me] = PENALTY.me;
  c[S.over] = PENALTY_ME_OVER;
  c[S.pOver] = PENALTY_P_OVER;
  const row = () => new Array(nv).fill(0);
  const cons = [];

  // Intake ceiling and floor (floor may be met by the shortfall variable).
  let r = row(); feeds.forEach((_, i) => { r[i] = 1; }); cons.push({ coef: r, op: '<=', rhs: req.dmi });
  r = row(); feeds.forEach((_, i) => { r[i] = 1; }); r[S.dm] = 1; cons.push({ coef: r, op: '>=', rhs: req.dmiMin });
  // Protein and energy.
  r = row(); feeds.forEach((f, i) => { r[i] = f.cp * 10; }); r[S.cp] = 1; cons.push({ coef: r, op: '>=', rhs: req.cpG });
  r = row(); feeds.forEach((f, i) => { r[i] = f.me; }); r[S.me] = 1; cons.push({ coef: r, op: '>=', rhs: req.meMJ });
  r = row(); feeds.forEach((f, i) => { r[i] = f.me; }); r[S.over] = -1; cons.push({ coef: r, op: '<=', rhs: ME_CEILING * req.meMJ });
  // Phosphorus ceiling as a share of whatever DM the ration ends up with.
  r = row(); feeds.forEach((f, i) => { r[i] = (f.p - P_CEILING_PCT) * 10; }); r[S.pOver] = -1; cons.push({ coef: r, op: '<=', rhs: 0 });
  // Rumen health: roughage share of DM.
  r = row(); feeds.forEach((f, i) => { r[i] = (f.cat === 'rough' ? 1 : 0) - req.minRough; }); cons.push({ coef: r, op: '>=', rhs: 0 });
  // Each feed's safe share of DM, and any quantity the farmer capped.
  feeds.forEach((f, i) => {
    r = row(); feeds.forEach((_, j) => { r[j] = (j === i ? 1 : 0) - f.maxShare; }); cons.push({ coef: r, op: '<=', rhs: 0 });
    if (f.maxKg != null) { r = row(); r[i] = 1; cons.push({ coef: r, op: '<=', rhs: f.maxKg * f.dm / 100 }); }
  });

  const res = solveLP(c, cons);
  if (res.status !== 'optimal') return null;
  return {
    x: res.x.slice(0, n),
    shortfall: { dm: res.x[S.dm], cp: res.x[S.cp], me: res.x[S.me] },
  };
}

// Round to what gets weighed out on a farm: half kilos of fodder and 100 g of
// concentrate for cattle; 100 g and 50 g for a goat-sized ration.
function roundFresh(feed, kg, req) {
  const small = req.dmi < 3;
  const step = feed.cat === 'rough' ? (small ? 0.1 : 0.5) : (small ? 0.05 : 0.1);
  return kg < step / 2 ? 0 : Math.round(Math.round(kg / step) * step * 1000) / 1000;
}

function supplyOf(items) {
  const s = { dm: 0, cp: 0, me: 0, ca: 0, p: 0, fresh: 0, rough: 0, cost: 0 };
  for (const it of items) {
    s.dm += it.dmKg;
    s.cp += it.dmKg * it.feed.cp * 10;
    s.me += it.dmKg * it.feed.me;
    s.ca += it.dmKg * it.feed.ca * 10;
    s.p += it.dmKg * it.feed.p * 10;
    s.fresh += it.freshKg;
    s.cost += it.cost;
    if (it.feed.cat === 'rough') s.rough += it.dmKg;
  }
  return s;
}

/**
 * @param {{
 *   animal: {type:string, weight:number, milk?:number, adg?:number, pregnant?:boolean, count?:number},
 *   feeds: {id:string, price?:number, maxKg?:number}[],
 *   silagePrice?: number
 * }} input
 */
export function formulate(input) {
  const animal = input.animal;
  const count = Math.max(1, Math.round(Number(animal.count) || 1));
  const req = requirements(animal.type, animal);
  const spec = ANIMALS[animal.type];
  const excluded = [];
  let feeds = resolveFeeds(input.feeds || [], req, input.silagePrice, excluded);
  const reasons = [];

  if (feeds.length === 0) reasons.push('no_feeds');
  if (feeds.length && !feeds.some((f) => f.cat === 'rough')) reasons.push('no_roughage');

  let sol = feeds.length ? solve(feeds, req) : null;

  // Second pass: drop feeds the optimiser used in amounts no one would weigh
  // out, and re-solve so the remaining feeds absorb the difference.
  if (sol) {
    const keep = feeds.filter((f, i) => roundFresh(f, sol.x[i] / (f.dm / 100), req) > 0);
    if (keep.length && keep.length < feeds.length) {
      const again = solve(keep, req);
      if (again) { feeds = keep; sol = again; }
    }
  }

  const items = [];
  if (sol) {
    feeds.forEach((f, i) => {
      const freshKg = roundFresh(f, sol.x[i] / (f.dm / 100), req);
      if (freshKg <= 0) return;
      const dmKg = freshKg * f.dm / 100;
      items.push({ id: f.id, feed: f, freshKg, dmKg, cost: freshKg * f.price, atMax: dmKg >= f.maxShare * req.dmi * 0.97 });
    });
    // A shortfall under 5% is inside the method's own error and is shown by
    // the adequacy bars; above it the feed list is genuinely missing something.
    if (sol.shortfall.dm > 0.03 * req.dmi) reasons.push('dm');
    if (sol.shortfall.cp > 0.05 * req.cpG) reasons.push('protein');
    if (sol.shortfall.me > 0.05 * req.meMJ) reasons.push('energy');
  }
  items.sort((a, b) => (a.feed.cat === b.feed.cat ? b.freshKg - a.freshKg : a.feed.cat === 'rough' ? -1 : 1));

  const supply = supplyOf(items);

  // Minerals: salt always; DCP for a phosphorus gap, limestone for the
  // calcium gap that remains. Bran and oil cake leave phosphorus in surplus,
  // so calcium is raised to at least 1.3x phosphorus as well as to the
  // requirement: an inverted Ca:P ratio causes urinary stones in bulls and
  // bucks. The cap keeps a single additive from hiding a badly built ration.
  const round5 = (g) => Math.round(g / 5) * 5;
  const pGap = Math.max(0, req.pG - supply.p);
  let dcpG = Math.min(req.dcpCap, round5(pGap / (ADDITIVES.dcp.p / 100)));
  if (dcpG < 5) dcpG = 0;
  const pTotal = supply.p + dcpG * ADDITIVES.dcp.p / 100;
  const caTarget = Math.max(req.caG, 1.4 * pTotal);
  const caGap = Math.max(0, caTarget - supply.ca - dcpG * ADDITIVES.dcp.ca / 100);
  let limeG = Math.min(2 * req.dcpCap, Math.ceil(caGap / (ADDITIVES.limestone.ca / 100) / 5) * 5);
  if (limeG < 5) limeG = 0;
  if (!items.length) { dcpG = 0; limeG = 0; }
  const additives = {
    saltG: items.length ? req.salt : 0,
    dcpG,
    limeG,
    cost: items.length
      ? (req.salt / 1000) * ADDITIVES.salt.price + (dcpG / 1000) * ADDITIVES.dcp.price + (limeG / 1000) * ADDITIVES.limestone.price
      : 0,
  };
  supply.ca += dcpG * ADDITIVES.dcp.ca / 100 + limeG * ADDITIVES.limestone.ca / 100;
  supply.p += dcpG * ADDITIVES.dcp.p / 100;

  const adequacy = {
    dm: supply.dm / req.dmi,
    cp: supply.cp / req.cpG,
    me: supply.me / req.meMJ,
    ca: supply.ca / req.caG,
    p: supply.p / req.pG,
  };
  const caToP = supply.p > 0 ? supply.ca / supply.p : 0;
  const ok = items.length > 0 && reasons.length === 0 && supply.dm >= 0.97 * req.dmiMin && adequacy.cp >= 0.95 && adequacy.me >= 0.95;

  const perAnimal = supply.cost + additives.cost;
  const cost = {
    feedPerAnimal: supply.cost,
    additivesPerAnimal: additives.cost,
    perAnimal,
    herdPerDay: perAnimal * count,
    herdPerMonth: perAnimal * count * 30,
    perLitre: req.type === 'dairy' && req.milk > 0 ? perAnimal / req.milk : null,
    perKgGain: (req.type === 'fattening' || req.type === 'heifer') && req.adg > 0 ? perAnimal / req.adg : null,
  };

  const silageItem = items.find((it) => it.feed.silage);
  const silage = silageItem ? {
    kgPerAnimal: silageItem.freshKg,
    kgPerDay: silageItem.freshKg * count,
    bagsPerMonth: Math.ceil((silageItem.freshKg * count * 30) / 50),
    daysPerBag: 50 / (silageItem.freshKg * count),
  } : null;

  // Honest comparison: the cheapest ration the same feed list gives without
  // silage. Computed, never asserted, and shown with its sign either way.
  let withoutSilage = null;
  if (silageItem) {
    const others = (input.feeds || []).filter((s) => s.id !== silageItem.id);
    if (others.length) {
      const alt = formulate({ ...input, feeds: others });
      withoutSilage = { costPerAnimal: alt.cost.perAnimal, ok: alt.ok, reasons: alt.reasons };
    }
  }

  const warnings = [];
  if (items.length) {
    const concShare = 1 - supply.rough / (supply.dm || 1);
    if (concShare > 0.45) warnings.push('split_concentrate');
    if (silage) {
      warnings.push('silage_adapt');
      if (silage.daysPerBag > 3) warnings.push('open_bag');
    }
    if (caToP < 1.2) warnings.push('ca_p_ratio');
    if (items.some((it) => it.id === 'molasses')) warnings.push('molasses_mix');
    warnings.push('water');
  }

  return {
    ok,
    reasons,
    req,
    spec,
    count,
    items,
    additives,
    supply,
    adequacy,
    caToP,
    cost,
    silage,
    withoutSilage,
    warnings,
    excluded,
    feedsAtMax: items.filter((it) => it.atMax).map((it) => it.id),
  };
}
