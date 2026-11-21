import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const D = [[-1, 0, 'u'], [1, 0, 'd'], [0, -1, 'l'], [0, 1, 'r']];
function P(t) {
  const R = t.replace(/\r/g, '').split('\n').filter((r) => r.length > 0);
  const H = R.length, W = Math.max(...R.map((r) => r.length));
  const a = new Uint8Array(W * H).fill(1), f = [], g = [], b = [];
  let p = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = R[y][x] ?? '#';
    if (c === '#') continue;
    const i = y * W + x;
    a[i] = 0; f.push(i);
    if (c === '.' || c === '*' || c === '+') g.push(i);
    if (c === '$' || c === '*') b.push(i);
    if (c === '@' || c === '+') p = i;
  }
  return { W, H, a, f, g, b, p };
}
function F(L, B, s, A) {
  const v = new Map([[s, [-1, '']]]), q = [s];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % L.W, y = (c / L.W) | 0;
    for (const [dy, dx, ch] of D) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
      const n = ny * L.W + nx;
      if (L.a[n] || B.has(n) || v.has(n)) continue;
      if (A && !A.has(n)) continue;
      v.set(n, [c, ch]); q.push(n);
    }
  }
  return v;
}
function T(v, t) {
  if (!v.has(t)) return null;
  let s = '', c = t;
  while (true) { const [p, ch] = v.get(c); if (p < 0) break; s = ch + s; c = p; }
  return s;
}
function U(L, R, G) {
  const ds = [];
  for (const g of G) {
    const d = new Map([[g, 0]]), q = [g];
    for (let h = 0; h < q.length; h++) {
      const b = q[h], x = b % L.W, y = (b / L.W) | 0, db = d.get(b);
      for (const [dy, dx] of D) {
        const px = x - dx, py = y - dy, sx = x - 2 * dx, sy = y - 2 * dy;
        if (px < 0 || py < 0 || sx < 0 || sy < 0 || px >= L.W || py >= L.H || sx >= L.W || sy >= L.H) continue;
        const p = py * L.W + px, s = sy * L.W + sx;
        if (!R.has(p) || !R.has(s) || d.has(p)) continue;
        d.set(p, db + 1); q.push(p);
      }
    }
    ds.push(d);
  }
  return ds;
}
function S(L, R, B0, G, st, cap) {
  const GS = new Set(G), ds = U(L, R, G), dead = new Set();
  for (const c of R) { if (GS.has(c)) continue; if (ds.every((d) => !d.has(c))) dead.add(c); }
  const pm = [], ix = G.map((_, i) => i);
  const perm = (a, k) => {
    if (k === a.length) { pm.push([...a]); return; }
    for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  };
  if (ix.length <= 7) perm(ix, 0);
  const hr = (B) => {
    if (pm.length === 0) {
      let s = 0;
      for (const b of B) {
        let m = Infinity;
        for (const d of ds) { const v = d.get(b); if (v !== undefined && v < m) m = v; }
        if (m === Infinity) return Infinity;
        s += m;
      }
      return s;
    }
    let best = Infinity;
    for (const p of pm) {
      let s = 0;
      for (let i = 0; i < B.length; i++) {
        const d = ds[p[i]].get(B[i]);
        if (d === undefined) { s = Infinity; break; }
        s += d;
      }
      if (s < best) best = s;
    }
    return best;
  };
  const N = [], hp = [];
  const push = (f, ni) => {
    hp.push([f, ni]);
    for (let i = hp.length - 1; i > 0;) { const p = (i - 1) >> 1; if (hp[p][0] <= hp[i][0]) break;[hp[p], hp[i]] = [hp[i], hp[p]]; i = p; }
  };
  const pop = () => {
    const top = hp[0][1], last = hp.pop();
    if (hp.length) {
      hp[0] = last;
      for (let i = 0;;) {
        let l = 2 * i + 1, r = l + 1, m = i;
        if (l < hp.length && hp[l][0] < hp[m][0]) m = l;
        if (r < hp.length && hp[r][0] < hp[m][0]) m = r;
        if (m === i) break;
        [hp[m], hp[i]] = [hp[i], hp[m]]; i = m;
      }
    }
    return top;
  };
  const h0 = hr(B0);
  if (h0 === Infinity) return null;
  N.push({ b: [...B0].sort((a, b) => a - b), p: st, q: -1, s: '', g: 0 });
  push(h0, 0);
  const seen = new Map(), sx = new Map();
  let ex = 0;
  while (hp.length) {
    const ni = pop(), n = N[ni];
    if (n.b.every((b) => GS.has(b))) {
      const sg = [];
      for (let c = n; c && c.q >= 0; c = N[c.q]) sg.push(c.s);
      return { m: sg.reverse().join(''), p: n.p };
    }
    if (++ex > cap) return null;
    const BS = new Set(n.b), rc = F(L, BS, n.p, R);
    let nm = Infinity;
    for (const c of rc.keys()) if (c < nm) nm = c;
    const key = n.b.join(',') + '|' + nm;
    if ((seen.get(key) ?? Infinity) <= n.g) continue;
    seen.set(key, n.g);
    for (let bi = 0; bi < n.b.length; bi++) {
      const b = n.b[bi], x = b % L.W, y = (b / L.W) | 0;
      for (const [dy, dx, ch] of D) {
        const ax = x - dx, ay = y - dy, tx = x + dx, ty = y + dy;
        if (ax < 0 || ay < 0 || tx < 0 || ty < 0 || ax >= L.W || ay >= L.H || tx >= L.W || ty >= L.H) continue;
        const sd = ay * L.W + ax, dt = ty * L.W + tx;
        if (!R.has(dt) || BS.has(dt) || dead.has(dt) || !rc.has(sd)) continue;
        const w = T(rc, sd);
        if (w === null) continue;
        const nb = [...n.b];
        nb[bi] = dt;
        nb.sort((a, b2) => a - b2);
        const h = hr(nb);
        if (h === Infinity) continue;
        const ek = nb.join(',') + '|' + b;
        if ((sx.get(ek) ?? Infinity) <= n.g + 1) continue;
        sx.set(ek, n.g + 1);
        N.push({ b: nb, p: b, q: ni, s: w + ch, g: n.g + 1 });
        push(n.g + 1 + h, N.length - 1);
      }
    }
  }
  return null;
}
function V(t) {
  const L = P(t);
  if (L.b.length === 0) return '';
  const all = new Set(L.f), py = (L.p / L.W) | 0, px = L.p % L.W;
  const rf = (y) => {
    let f = -1, l = -1;
    for (let x = 0; x < L.W; x++) if (!L.a[y * L.W + x]) { if (f < 0) f = x; l = x; }
    if (f < 0) return null;
    for (let x = f; x <= l; x++) if (L.a[y * L.W + x]) return null;
    return [f, l];
  };
  const cf = (x) => {
    let f = -1, l = -1;
    for (let y = 0; y < L.H; y++) if (!L.a[y * L.W + x]) { if (f < 0) f = y; l = y; }
    if (f < 0) return null;
    for (let y = f; y <= l; y++) if (L.a[y * L.W + x]) return null;
    return [f, l];
  };
  const rooms = [];
  let hall = null;
  const hz = rf(py), vt = hz ? null : cf(px);
  if (hz || vt) {
    hall = new Set();
    if (hz) for (let x = hz[0]; x <= hz[1]; x++) hall.add(py * L.W + x);
    else for (let y = vt[0]; y <= vt[1]; y++) hall.add(y * L.W + px);
    const rest = L.f.filter((c) => !hall.has(c)), inR = new Set(rest), done = new Set();
    for (const c of rest) {
      if (done.has(c)) continue;
      const cells = new Set(), q = [c];
      done.add(c);
      for (let h = 0; h < q.length; h++) {
        const cu = q[h];
        cells.add(cu);
        const x = cu % L.W, y = (cu / L.W) | 0;
        for (const [dy, dx] of D) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
          const n = ny * L.W + nx;
          if (!inR.has(n) || done.has(n)) continue;
          done.add(n); q.push(n);
        }
      }
      const bx = L.b.filter((b) => cells.has(b));
      if (bx.length === 0) continue;
      const gl = L.g.filter((g) => cells.has(g));
      const en = [...hall].filter((hc) => {
        const x = hc % L.W, y = (hc / L.W) | 0;
        return D.some(([dy, dx]) => cells.has((y + dy) * L.W + (x + dx)));
      });
      rooms.push({ cells, en, bx, gl });
    }
  }
  const ok0 = hall !== null && rooms.length > 0
    && rooms.every((r) => r.en.length > 0 && r.bx.length === r.gl.length)
    && rooms.reduce((s, r) => s + r.bx.length, 0) === L.b.length;
  if (ok0) {
    const BN = new Set(L.b);
    let pl = L.p, out = '', ok = true;
    for (const r of rooms) {
      const R = new Set([...r.cells, ...r.en]), door = r.en[0];
      const rc = F(L, BN, pl, null), w = T(rc, door);
      if (w === null) { ok = false; break; }
      const sol = S(L, R, r.bx, r.gl, door, 600000);
      if (!sol) { ok = false; break; }
      out += w + sol.m;
      for (const b of r.bx) BN.delete(b);
      for (const g of r.gl) BN.add(g);
      pl = sol.p;
    }
    if (ok) return out;
  }
  const wh = S(L, all, L.b, L.g, L.p, 800000);
  return wh ? wh.m : '';
}
for (const id of readdirSync(I).sort()) {
  const m = V(readFileSync(join(I, id, 'level.txt'), 'utf8'));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${m}\n`);
}
