// Scenario tests for the ration engine (js/ration). Run: npm run test:ration
// Exits non-zero on any failure so `npm run verify` catches a broken solver or
// a feed value that pushes a standard ration outside published ranges.

import { solveLP } from '../js/ration/lp.js';
import { formulate, defaultSelection, requirements, FEEDS, P_CEILING_PCT } from '../js/ration/engine.js';

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error('  FAIL', msg); } };
const fmt = (n, d = 1) => Number(n).toFixed(d);

// --- LP sanity: a textbook problem with a known answer ---------------------
{
  // min 2x + 3y  s.t. x + y >= 4, x <= 3, y <= 5  ->  x=3, y=1, cost 9
  const r = solveLP([2, 3], [
    { coef: [1, 1], op: '>=', rhs: 4 },
    { coef: [1, 0], op: '<=', rhs: 3 },
    { coef: [0, 1], op: '<=', rhs: 5 },
  ]);
  check(r.status === 'optimal' && Math.abs(r.cost - 9) < 1e-6, `LP textbook: got ${r.status} cost ${r.cost}`);
  const inf = solveLP([1], [{ coef: [1], op: '>=', rhs: 2 }, { coef: [1], op: '<=', rhs: 1 }]);
  check(inf.status === 'infeasible', `LP infeasible detection: got ${inf.status}`);
  const eq = solveLP([1, 1], [{ coef: [1, 2], op: '=', rhs: 4 }, { coef: [1, 0], op: '>=', rhs: 1 }]);
  check(eq.status === 'optimal' && Math.abs(eq.cost - 2.5) < 1e-6, `LP equality: got ${eq.status} cost ${eq.cost}`);
}

// --- Requirements stay inside published ranges ------------------------------
{
  const d = requirements('dairy', { weight: 400, milk: 10 });
  check(d.dmi > 11 && d.dmi < 13.5, `dairy 400/10 DMI ${fmt(d.dmi)} kg, expected 11-13.5`);
  check(d.cpPct >= 12 && d.cpPct <= 17, `dairy 400/10 CP ${fmt(d.cpPct)}%, expected 12-17`);
  check(d.meDensity >= 8 && d.meDensity <= 11.5, `dairy 400/10 ME density ${fmt(d.meDensity)} MJ/kg DM`);
  const hi = requirements('dairy', { weight: 450, milk: 20 });
  check(hi.cpPct >= 14 && hi.cpPct <= 18, `dairy 450/20 CP ${fmt(hi.cpPct)}%, expected 14-18`);
  const f = requirements('fattening', { weight: 300, adg: 0.8 });
  check(f.dmi > 6.5 && f.dmi < 9, `fattening 300 DMI ${fmt(f.dmi)} kg, expected 6.5-9`);
  check(f.cpPct >= 11 && f.cpPct <= 14, `fattening CP ${fmt(f.cpPct)}%`);
  check(f.meDensity >= 9 && f.meDensity <= 11.5, `fattening 300/0.8 ME density ${fmt(f.meDensity)}`);
  const g = requirements('goat', { weight: 25, adg: 0.05 });
  check(g.dmi > 0.7 && g.dmi < 1.2, `goat 25 kg DMI ${fmt(g.dmi, 2)} kg`);
  check(g.meMJ > 5 && g.meMJ < 9, `goat 25 kg ME ${fmt(g.meMJ)} MJ`);
}

// --- Standard scenarios formulate, meet needs, and cost what a farm would pay -
const SILAGE = 10;
const scenarios = [
  { name: 'dairy 350 kg, 8 L', animal: { type: 'dairy', weight: 350, milk: 8 }, cost: [150, 400] },
  { name: 'dairy 400 kg, 10 L', animal: { type: 'dairy', weight: 400, milk: 10 }, cost: [180, 460] },
  { name: 'dairy 450 kg, 15 L, pregnant', animal: { type: 'dairy', weight: 450, milk: 15, pregnant: true }, cost: [250, 720], pMax: 0.7 },
  { name: 'fattening 250 kg, 0.8 kg/d', animal: { type: 'fattening', weight: 250, adg: 0.8 }, cost: [110, 300] },
  { name: 'fattening 350 kg, 1.0 kg/d', animal: { type: 'fattening', weight: 350, adg: 1.0 }, cost: [150, 380] },
  { name: 'dry cow 400 kg, pregnant', animal: { type: 'dry', weight: 400, pregnant: true }, cost: [90, 280] },
  { name: 'heifer 150 kg, 0.5 kg/d', animal: { type: 'heifer', weight: 150, adg: 0.5 }, cost: [60, 200], pMax: 0.7 },
  { name: 'goat 25 kg, 50 g/d', animal: { type: 'goat', weight: 25, adg: 0.05 }, cost: [10, 45], pMax: 0.7 },
  { name: 'goat 30 kg, 1 L milk', animal: { type: 'goat', weight: 30, milk: 1 }, cost: [15, 60], pMax: 0.7 },
];

console.log('Default feeds:', defaultSelection(SILAGE).map((f) => f.id).join(', '));
for (const sc of scenarios) {
  const r = formulate({ animal: { ...sc.animal, count: 1 }, feeds: defaultSelection(SILAGE), silagePrice: SILAGE });
  const mix = r.items.map((it) => `${it.id} ${fmt(it.freshKg)}kg`).join(', ');
  console.log(`\n${sc.name}: ${fmt(r.cost.perAnimal, 0)} tk/day | DM ${fmt(r.adequacy.dm * 100, 0)}% CP ${fmt(r.adequacy.cp * 100, 0)}% ME ${fmt(r.adequacy.me * 100, 0)}% Ca ${fmt(r.adequacy.ca * 100, 0)}% P ${fmt(r.adequacy.p * 100, 0)}%`);
  console.log(`  ${mix} | salt ${r.additives.saltG} g, DCP ${r.additives.dcpG} g, lime ${r.additives.limeG} g${r.withoutSilage ? ` | without silage ${r.withoutSilage.ok ? fmt(r.withoutSilage.costPerAnimal, 0) + ' tk' : 'not feasible (' + r.withoutSilage.reasons.join(',') + ')'}` : ''}`);
  check(r.ok, `${sc.name}: not ok, reasons ${r.reasons.join(',') || 'none'}`);
  check(r.adequacy.cp >= 0.95 && r.adequacy.cp <= 1.4, `${sc.name}: CP adequacy ${fmt(r.adequacy.cp, 2)}`);
  check(r.adequacy.me >= 0.95 && r.adequacy.me <= (sc.animal.type === 'goat' ? 1.3 : 1.22), `${sc.name}: ME adequacy ${fmt(r.adequacy.me, 2)}`);
  check(r.supply.dm >= 0.97 * r.req.dmiMin && r.adequacy.dm <= 1.08, `${sc.name}: DM ${fmt(r.supply.dm)} kg outside ${fmt(r.req.dmiMin)}-${fmt(r.req.dmi)}`);
  check(r.caToP >= 1.2 || r.additives.limeG >= 2 * r.req.dcpCap, `${sc.name}: Ca:P ${fmt(r.caToP, 2)} below 1.2`);
  // Phosphorus stays near the ceiling where the default feeds allow it; the
  // 15 L cow, heifer and goats need a protein density only P-rich feeds give.
  const pPct = r.supply.p / r.supply.dm / 10;
  check(pPct <= (sc.pMax ?? P_CEILING_PCT + 0.02), `${sc.name}: P ${fmt(pPct, 2)}% of DM above ceiling`);
  check(r.adequacy.ca >= 0.9 && r.adequacy.p >= 0.9, `${sc.name}: minerals Ca ${fmt(r.adequacy.ca, 2)} P ${fmt(r.adequacy.p, 2)}`);
  check(r.cost.perAnimal >= sc.cost[0] && r.cost.perAnimal <= sc.cost[1], `${sc.name}: cost ${fmt(r.cost.perAnimal, 0)} outside ${sc.cost.join('-')} tk/day`);
  const roughShare = r.supply.rough / r.supply.dm;
  check(roughShare >= r.req.minRough - 0.03, `${sc.name}: roughage share ${fmt(roughShare, 2)} below ${r.req.minRough}`);
  for (const it of r.items) {
    const share = it.dmKg / r.supply.dm;
    const cap = it.feed.maxBy?.[sc.animal.type] || it.feed.max;
    check(share <= cap + 0.05, `${sc.name}: ${it.id} share ${fmt(share, 2)} exceeds cap ${cap}`);
  }
  check(r.items.length <= 7, `${sc.name}: ${r.items.length} feeds is not a practical ration`);
}

// --- A 20 L cow needs a real protein source, and the engine must say so -----
{
  const common = formulate({ animal: { type: 'dairy', weight: 500, milk: 25 }, feeds: defaultSelection(SILAGE), silagePrice: SILAGE });
  check(!common.ok && common.reasons.includes('protein'), `25 L on common feeds: expected protein shortfall, got ok=${common.ok} reasons=${common.reasons}`);
  const withSoy = formulate({ animal: { type: 'dairy', weight: 500, milk: 25 }, feeds: [...defaultSelection(SILAGE), { id: 'soybean_meal' }], silagePrice: SILAGE });
  check(withSoy.ok, `20 L with soybean meal: expected ok, reasons=${withSoy.reasons}`);
  console.log(`\n25 L cow: common feeds -> ${common.reasons.join(',') || 'ok'}; with soybean meal -> ${withSoy.ok ? fmt(withSoy.cost.perAnimal, 0) + ' tk/day' : withSoy.reasons}`);
}

// --- UMS is excluded in late pregnancy and capped at 2 kg per 100 kg ---------
{
  const preg = formulate({ animal: { type: 'dry', weight: 400, pregnant: true }, feeds: [...defaultSelection(SILAGE), { id: 'ums' }], silagePrice: SILAGE });
  check(preg.excluded.some((e) => e.id === 'ums') && !preg.items.some((it) => it.id === 'ums'), 'UMS should be excluded for a pregnant cow');
  const bull = formulate({ animal: { type: 'fattening', weight: 250, adg: 0.8 }, feeds: [{ id: 'ums', price: 10 }, { id: 'straw' }, { id: 'wheat_bran' }, { id: 'maize_grain' }, { id: 'mustard_cake' }], silagePrice: SILAGE });
  const ums = bull.items.find((it) => it.id === 'ums');
  check(!ums || ums.freshKg <= 5.01, `UMS cap: expected <= 5 kg for 250 kg bull, got ${ums?.freshKg}`);
}

// --- Diagnosis: the engine names what is missing ----------------------------
{
  const strawOnly = formulate({ animal: { type: 'dairy', weight: 350, milk: 8 }, feeds: [{ id: 'straw', price: 15 }] });
  check(!strawOnly.ok && strawOnly.reasons.length > 0, `straw only: should fail with reasons, got ${strawOnly.reasons}`);
  const concOnly = formulate({ animal: { type: 'dairy', weight: 350, milk: 8 }, feeds: [{ id: 'wheat_bran' }, { id: 'maize_grain' }] });
  check(concOnly.reasons.includes('no_roughage'), `concentrates only: expected no_roughage, got ${concOnly.reasons}`);
  const noProtein = formulate({ animal: { type: 'dairy', weight: 400, milk: 15 }, feeds: [{ id: 'straw' }, { id: 'silage' }, { id: 'maize_grain' }, { id: 'molasses' }] });
  check(noProtein.reasons.includes('protein'), `no protein source: expected protein, got ${noProtein.reasons}`);
  const none = formulate({ animal: { type: 'dairy', weight: 400, milk: 15 }, feeds: [] });
  check(none.reasons.includes('no_feeds') && none.items.length === 0, 'empty selection handled');
  console.log(`\nDiagnosis: straw-only -> ${strawOnly.reasons.join(',')}; no protein -> ${noProtein.reasons.join(',')}`);
}

// --- Own fodder at zero price and a quantity cap are honoured ---------------
{
  const r = formulate({
    animal: { type: 'dairy', weight: 350, milk: 8 },
    feeds: [...defaultSelection(SILAGE), { id: 'napier', price: 0, maxKg: 20 }],
    silagePrice: SILAGE,
  });
  const nap = r.items.find((it) => it.id === 'napier');
  check(nap && nap.freshKg <= 20.01, `own napier: expected <= 20 kg, got ${nap?.freshKg}`);
  console.log(`Own napier (free, max 20 kg): ${nap?.freshKg} kg used, ${fmt(r.cost.perAnimal, 0)} tk/day`);
}

// --- A farmer's custom feed is priced and used like any other -------------
{
  const r = formulate({
    animal: { type: 'fattening', weight: 250, adg: 0.8 },
    feeds: [...defaultSelection(SILAGE), { id: 'custom_khud', custom: { bn: 'খুদ', cat: 'conc', dm: 88, cp: 9, me: 13, ca: 0.05, p: 0.3, max: 0.35, price: 20 } }],
    silagePrice: SILAGE,
  });
  const khud = r.items.find((it) => it.id === 'custom_khud');
  check(khud && khud.freshKg > 0 && khud.feed.bn === 'খুদ', `custom feed: expected cheap broken rice to be used, got ${khud?.freshKg}`);
  console.log(`Custom feed (khud 20 tk): ${khud?.freshKg} kg used, ${fmt(r.cost.perAnimal, 0)} tk/day`);
}

// --- Every feed row is complete ---------------------------------------------
for (const f of FEEDS) {
  check(f.dm > 0 && f.cp > 0 && f.me > 0 && f.price >= 0 && f.max > 0 && f.max <= 1 && f.bn, `feed ${f.id} has a missing or invalid field`);
}

// --- Every animal class, at both ends of its weight range, still formulates --
for (const type of ['dairy', 'fattening', 'dry', 'heifer', 'goat']) {
  for (const weight of type === 'goat' ? [10, 60] : type === 'heifer' ? [70, 300] : [150, 600]) {
    const r = formulate({ animal: { type, weight, milk: type === 'dairy' ? 12 : 0, adg: type === 'goat' ? 0.05 : 0.7, pregnant: type === 'dry' }, feeds: defaultSelection(SILAGE), silagePrice: SILAGE });
    check(r.items.length > 0 && Number.isFinite(r.cost.perAnimal), `${type} ${weight} kg: no ration`);
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll ration checks passed');
process.exit(failures ? 1 : 0);
