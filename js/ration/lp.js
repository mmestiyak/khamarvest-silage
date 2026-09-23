// Small dense two-phase simplex for least-cost ration formulation.
//
//   minimise  c . x
//   subject to  sum_j coef[j] * x[j]  (<= | >= | =)  rhs   for each constraint
//               x >= 0
//
// Ration problems are tiny (under 25 variables, under 40 constraints), so a
// plain tableau with Bland's rule is fast, stable enough, and has no
// dependencies. Nothing here knows about feeds or animals.

const EPS = 1e-9;
const MAX_ITER = 2000;

/**
 * @param {number[]} c objective coefficients (length n)
 * @param {{coef:number[], op:'<='|'>='|'=', rhs:number}[]} constraints
 * @returns {{status:'optimal'|'infeasible'|'unbounded', x:number[], cost:number}}
 */
export function solveLP(c, constraints) {
  const n = c.length;
  // Normalise so every right-hand side is non-negative.
  const rows = constraints.map(({ coef, op, rhs }) => {
    let a = coef.slice();
    let b = rhs;
    let o = op;
    if (b < 0) {
      a = a.map((v) => -v);
      b = -b;
      o = o === '<=' ? '>=' : o === '>=' ? '<=' : '=';
    }
    return { a, o, b };
  });

  const m = rows.length;
  let nSlack = 0;
  let nArt = 0;
  for (const r of rows) {
    if (r.o !== '=') nSlack++;
    if (r.o !== '<=') nArt++;
  }
  const total = n + nSlack + nArt;
  const T = [];
  const basis = new Array(m);
  const isArt = new Array(total).fill(false);
  let si = n;
  let ai = n + nSlack;
  rows.forEach((r, i) => {
    const row = new Float64Array(total + 1);
    for (let j = 0; j < n; j++) row[j] = r.a[j];
    if (r.o === '<=') {
      row[si] = 1;
      basis[i] = si++;
    } else if (r.o === '>=') {
      row[si++] = -1;
      row[ai] = 1;
      isArt[ai] = true;
      basis[i] = ai++;
    } else {
      row[ai] = 1;
      isArt[ai] = true;
      basis[i] = ai++;
    }
    row[total] = r.b;
    T.push(row);
  });

  const pivot = (r, col) => {
    const pr = T[r];
    const pv = pr[col];
    for (let j = 0; j <= total; j++) pr[j] /= pv;
    for (let i = 0; i < T.length; i++) {
      if (i === r) continue;
      const f = T[i][col];
      if (Math.abs(f) < EPS) continue;
      const ri = T[i];
      for (let j = 0; j <= total; j++) ri[j] -= f * pr[j];
    }
    basis[r] = col;
  };

  // Reduced-cost row for an objective vector over the current basis.
  const reducedRow = (cost) => {
    const z = new Float64Array(total + 1);
    for (let j = 0; j < total; j++) z[j] = cost[j] || 0;
    for (let i = 0; i < T.length; i++) {
      const cb = cost[basis[i]] || 0;
      if (cb === 0) continue;
      for (let j = 0; j <= total; j++) z[j] -= cb * T[i][j];
    }
    return z;
  };

  // Returns 'optimal' or 'unbounded'. `allowed(j)` filters entering columns.
  const run = (z, allowed) => {
    for (let iter = 0; iter < MAX_ITER; iter++) {
      let enter = -1;
      for (let j = 0; j < total; j++) {
        if (allowed(j) && z[j] < -EPS) { enter = j; break; } // Bland: first improving column
      }
      if (enter === -1) return 'optimal';
      let leave = -1;
      let best = Infinity;
      for (let i = 0; i < T.length; i++) {
        const a = T[i][enter];
        if (a > EPS) {
          const ratio = T[i][total] / a;
          if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[leave])) {
            best = ratio;
            leave = i;
          }
        }
      }
      if (leave === -1) return 'unbounded';
      pivot(leave, enter);
      const f = z[enter];
      for (let j = 0; j <= total; j++) z[j] -= f * T[leave][j];
    }
    return 'optimal';
  };

  // Phase 1: drive the artificial variables to zero.
  if (nArt > 0) {
    const c1 = new Array(total).fill(0);
    for (let j = 0; j < total; j++) if (isArt[j]) c1[j] = 1;
    const z1 = reducedRow(c1);
    run(z1, () => true);
    if (-z1[total] > 1e-7) return { status: 'infeasible', x: new Array(n).fill(0), cost: NaN };
    // Pivot any artificial still sitting in the basis out on a real column,
    // or drop the row when it turned out redundant.
    for (let i = T.length - 1; i >= 0; i--) {
      if (!isArt[basis[i]]) continue;
      let col = -1;
      for (let j = 0; j < total; j++) {
        if (!isArt[j] && Math.abs(T[i][j]) > EPS) { col = j; break; }
      }
      if (col === -1) { T.splice(i, 1); basis.splice(i, 1); } else pivot(i, col);
    }
  }

  // Phase 2: the real objective, artificial columns locked out.
  const c2 = new Array(total).fill(0);
  for (let j = 0; j < n; j++) c2[j] = c[j];
  const z2 = reducedRow(c2);
  const status = run(z2, (j) => !isArt[j]);
  if (status === 'unbounded') return { status, x: new Array(n).fill(0), cost: -Infinity };

  const x = new Array(n).fill(0);
  for (let i = 0; i < T.length; i++) if (basis[i] < n) x[basis[i]] = Math.max(0, T[i][total]);
  const cost = x.reduce((s, v, j) => s + v * c[j], 0);
  return { status: 'optimal', x, cost };
}
