#!/usr/bin/env node
// Regenerates the numbers behind /blog/go-khaddo-mousumi-calendar.
//
// The guide claims a specific number of days per district on which the normal
// minimum temperature sits below 15C, the point at which the Napier literature
// says growth becomes negligible. Those numbers are not ours: they are BMD
// climate normals, served as day-by-day tables by BAMIS (the agro-met portal).
// This script fetches them again so anyone can check the guide, and so the
// figures can be refreshed if BMD republishes its normals.
//
//   node scripts/fodder-calendar-data.mjs            # cold-day table
//   node scripts/fodder-calendar-data.mjs --rain     # monthly rainfall too
//
// Thresholds come from Habte et al. 2023, Frontiers in Plant Science:
// Napier grows best at 25-40C, "little growth occurs at <15C, and its growth
// ceases at 10C".

const LITTLE_GROWTH = 15;
const GROWTH_CEASES = 10;

// BMD station ids as BAMIS numbers them. Station, not district: Ishurdi sits in
// Pabna and Srimangal in Moulvibazar, which is why the guide prints the station
// name rather than silently relabelling it as a district.
const STATIONS = {
  Srimangal: 41915, Dinajpur: 41863, Ishurdi: 41907, Rajshahi: 41895,
  Rangpur: 41859, Syedpur: 41858, Chuadanga: 41926, Jashore: 41936,
  Bogura: 41883, Tangail: 41909, Mymensingh: 41886, Cumilla: 41933,
  Barishal: 41950, Faridpur: 41929, Sylhet: 41891, Satkhira: 41946,
  Khulna: 41947, Dhaka: 41923, Chattogram: 41978, Coxsbazar: 41992,
};

const UA = { 'user-agent': 'Mozilla/5.0 (khamarvest-silage fodder-calendar)' };
const url = (kind, id, m) =>
  `https://www.bamis.gov.bd/en/agro-climate/monthly/${kind}/${id}/${m}/table/`;

async function month(kind, id, m, unit) {
  const re = new RegExp(`<td>\\s*(-?\\d{1,4}(?:\\.\\d+)?)\\s*${unit}\\s*</td>`, 'g');
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url(kind, id, m), { headers: UA });
      const values = [...(await res.text()).matchAll(re)].map((r) => Number(r[1]));
      if (values.length) return values;
    } catch {
      // BAMIS drops connections under load; retry before giving up
    }
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  throw new Error(`no data for station ${id}, month ${m}, ${kind}`);
}

const wantRain = process.argv.includes('--rain');
const rows = [];

for (const [station, id] of Object.entries(STATIONS)) {
  const row = { station, below15: 0, below10: 0, byMonth: [], rain: [] };
  for (let m = 1; m <= 12; m += 1) {
    const t = await month('tempmin', id, m, '°C');
    row.below15 += t.filter((v) => v < LITTLE_GROWTH).length;
    row.below10 += t.filter((v) => v < GROWTH_CEASES).length;
    row.byMonth.push(Number((t.reduce((a, b) => a + b, 0) / t.length).toFixed(1)));
    if (wantRain) {
      const r = await month('rainfall', id, m, 'mm');
      row.rain.push(Math.round(r.reduce((a, b) => a + b, 0)));
    }
  }
  rows.push(row);
}

rows.sort((a, b) => b.below15 - a.below15);

console.log(`\n# Days per year below the Napier thresholds, BMD normals via BAMIS`);
console.log(`# <${LITTLE_GROWTH}C = little growth, <${GROWTH_CEASES}C = growth ceases\n`);
console.log('station      <15C  <10C   Dec   Jan   Feb');
for (const r of rows) {
  console.log(
    r.station.padEnd(12),
    String(r.below15).padStart(4),
    String(r.below10).padStart(5),
    String(r.byMonth[11]).padStart(5),
    String(r.byMonth[0]).padStart(5),
    String(r.byMonth[1]).padStart(5),
  );
}

if (wantRain) {
  console.log('\n# Monthly rainfall normals, mm\n');
  console.log('station      ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m) => m.padStart(5)).join(''));
  for (const r of rows) {
    const dry = r.rain[10] + r.rain[11] + r.rain[0] + r.rain[1];
    const year = r.rain.reduce((a, b) => a + b, 0);
    console.log(
      r.station.padEnd(12) + r.rain.map((v) => String(v).padStart(5)).join(''),
      `| Nov-Feb ${dry}mm of ${year}mm (${((dry / year) * 100).toFixed(1)}%)`,
    );
  }
}
