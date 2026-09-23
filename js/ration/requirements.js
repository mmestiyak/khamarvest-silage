// Daily nutrient requirements per animal, in the units the feed table uses:
// dry matter intake (kg), crude protein (g), metabolisable energy (MJ),
// calcium and phosphorus (g). Plus the minimum share of roughage the rumen
// needs, which the optimiser enforces as a constraint.
//
// The formulas are the simplified NRC / Kearl relationships that extension
// tables are built from, stated so a vet can check them:
//   metabolic weight     W^0.75
//   maintenance ME       ~0.55 MJ per kg W^0.75 (NRC 2001 NEm 0.08 Mcal at ~64% efficiency)
//   milk ME              ~5.1 MJ per kg of 4-4.5% fat milk (NRC 2001 NEl 0.74 Mcal at 64%)
//   growth ME            NRC (2016) NEg = 0.0557 W^0.75 ADG^1.097 Mcal, at ~42% efficiency
//   goat maintenance     NRC (2007) 101 kcal per kg W^0.75, plus 10% for activity
// Crude protein is given as a % of DM for growing and dry animals (NRC 2016
// tables), and for milking cows as the larger of a maintenance+milk allowance
// and a 12.5% floor, because a low-yield cow on straw still needs the floor.
// Tropical local and crossbred cattle sit inside these ranges; the accuracy
// claim on the page (roughly +/-10%) comes from how far the formulas and the
// feed book values each scatter around the truth.

export const ANIMALS = {
  dairy: {
    label: 'দুধের গাভী', short: 'গাভী', emoji: '🐄',
    fields: ['weight', 'milk', 'pregnant'],
    weight: { def: 350, min: 150, max: 700, presets: [250, 300, 350, 400, 450, 500] },
    milk: { def: 8, min: 0, max: 40 },
    minRough: 0.45,
    salt: 30, dcpCap: 120,
  },
  fattening: {
    label: 'মোটাতাজাকরণের ষাঁড়', short: 'ষাঁড়', emoji: '🐂',
    fields: ['weight', 'adg'],
    weight: { def: 250, min: 100, max: 600, presets: [150, 200, 250, 300, 350, 400] },
    adg: { def: 0.8, options: [[0.5, '৫০০ গ্রাম/দিন (ধীর, কম খরচ)'], [0.8, '৮০০ গ্রাম/দিন (স্বাভাবিক)'], [1.0, '১ কেজি/দিন (দ্রুত, দানাদার বেশি)']] },
    minRough: 0.35,
    salt: 30, dcpCap: 100,
  },
  dry: {
    label: 'গর্ভবতী / শুকনা গাভী', short: 'শুকনা গাভী', emoji: '🐄',
    fields: ['weight', 'pregnant'],
    weight: { def: 350, min: 150, max: 700, presets: [250, 300, 350, 400, 450, 500] },
    pregnantDefault: true,
    minRough: 0.6,
    salt: 30, dcpCap: 100,
  },
  heifer: {
    label: 'বাড়ন্ত বকনা / বাছুর (৬ মাস+)', short: 'বাছুর', emoji: '🐮',
    fields: ['weight', 'adg'],
    weight: { def: 150, min: 60, max: 350, presets: [80, 100, 150, 200, 250] },
    adg: { def: 0.5, options: [[0.3, '৩০০ গ্রাম/দিন'], [0.5, '৫০০ গ্রাম/দিন (স্বাভাবিক)'], [0.7, '৭০০ গ্রাম/দিন']] },
    minRough: 0.4,
    salt: 20, dcpCap: 80,
  },
  goat: {
    label: 'ছাগল / ভেড়া', short: 'ছাগল', emoji: '🐐',
    fields: ['weight', 'goatMilk', 'goatAdg'],
    weight: { def: 25, min: 8, max: 80, presets: [15, 20, 25, 30, 40] },
    milk: { def: 0, min: 0, max: 5 },
    adg: { def: 0.05, options: [[0, 'বাড়ছে না (পূর্ণবয়স্ক)'], [0.05, '৫০ গ্রাম/দিন (স্বাভাবিক)'], [0.1, '১০০ গ্রাম/দিন (দ্রুত)']] },
    minRough: 0.5,
    salt: 8, dcpCap: 25,
  },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param {string} type key of ANIMALS
 * @param {{weight:number, milk?:number, adg?:number, pregnant?:boolean}} p
 */
export function requirements(type, p) {
  const spec = ANIMALS[type];
  if (!spec) throw new Error(`unknown animal type ${type}`);
  const W = clamp(Number(p.weight) || spec.weight.def, spec.weight.min, spec.weight.max);
  const mbw = Math.pow(W, 0.75);
  const milk = Math.max(0, Number(p.milk) || 0);
  const adg = Math.max(0, Number(p.adg) || 0);
  const pregnant = !!p.pregnant;
  // dmi is intake CAPACITY (the ceiling); dmiMin is the gut fill below which
  // the rumen is not working properly. The optimiser may land anywhere between.
  let dmi, dmiMin, cpG, meMJ, caG, pG, cpPct;

  if (type === 'dairy') {
    // NRC (2001) intake: 0.372 x milk + 0.0968 x W^0.75, capped at 4% of weight.
    dmi = Math.min(0.0968 * mbw + 0.372 * milk, 0.04 * W);
    dmiMin = Math.max(0.02 * W, 0.7 * dmi);
    meMJ = 0.56 * mbw + 5.1 * milk + (pregnant ? 14 : 0);
    // Protein: maintenance plus 90 g per litre, but never below the NRC table
    // density for that yield (12% dry, ~14% at 10 L, ~15.5% at 20 L).
    const floorPct = Math.min(17.5, 12 + 0.15 * milk);
    cpG = Math.max(5.0 * mbw + 90 * milk + (pregnant ? 200 : 0), floorPct * dmiMin * 10);
    caG = (0.031 * W + 1.22 * milk + (pregnant ? 4 : 0)) / 0.45;
    pG = (0.02 * W + 0.9 * milk + (pregnant ? 2 : 0)) / 0.6;
  } else if (type === 'fattening' || type === 'heifer') {
    dmi = Math.min(0.105 * mbw, 0.03 * W);
    dmiMin = 0.85 * dmi;
    const maint = (type === 'fattening' ? 0.6 : 0.55) * mbw;
    const neg = 0.0557 * mbw * Math.pow(adg, 1.097) * 4.184; // MJ net energy for gain
    meMJ = maint + neg / 0.42;
    cpPct = type === 'fattening' ? clamp(10 + 3 * adg, 11, 14) : clamp(11 + 4 * adg, 12, 15);
    cpG = cpPct * ((dmi + dmiMin) / 2) * 10;
    caG = (0.0154 * W + 14 * adg) / 0.5;
    pG = (0.016 * W + 8 * adg) / 0.68;
  } else if (type === 'dry') {
    dmi = 0.02 * W;
    dmiMin = 0.85 * dmi;
    meMJ = 0.56 * mbw + (pregnant ? 14 : 0);
    cpPct = pregnant ? 11 : 9;
    cpG = cpPct * ((dmi + dmiMin) / 2) * 10;
    caG = (0.031 * W + (pregnant ? 10 : 0)) / 0.45;
    pG = (0.02 * W + (pregnant ? 5 : 0)) / 0.6;
  } else if (type === 'goat') {
    const adgG = adg * 1000;
    // NRC (2007): ~3% of weight at maintenance, 4-5% when milking or growing fast.
    dmi = Math.min(0.03 * W + 0.3 * milk + 0.004 * adgG, 0.05 * W);
    dmiMin = 0.8 * dmi;
    meMJ = 0.47 * mbw + 0.03 * adgG + 5.0 * milk;
    cpPct = milk > 0 ? 14 : adgG > 0 ? 12.5 : 10.5; // NRC (2007): kids 12-14%, dry adults 10-11%
    cpG = cpPct * ((dmi + dmiMin) / 2) * 10;
    caG = (0.02 * W + 1.2 * milk + 0.01 * adgG) / 0.45;
    pG = (0.015 * W + 0.9 * milk + 0.006 * adgG) / 0.6;
  }

  return {
    type, weight: W, milk, adg, pregnant,
    dmi, dmiMin, cpG, meMJ, caG, pG,
    // Densities quoted against the middle of the intake range, which is
    // roughly what the optimiser lands on.
    cpPct: (cpG / (((dmi + dmiMin) / 2) * 1000)) * 100,
    meDensity: meMJ / ((dmi + dmiMin) / 2),
    minRough: spec.minRough,
    salt: spec.salt,
    dcpCap: spec.dcpCap,
  };
}
