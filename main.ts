// Sokoban solver: finds the hallway (the player's row), splits the level
// into the rooms above and below it, solves every room push-optimally with
// A* over pushes (matching heuristic, dead-square pruning), then stitches
// the rooms together with player walks. Deterministic: budgets are node
// counts, never clocks.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const DIRS = [
  { dy: -1, dx: 0, c: 'u' },
  { dy: 1, dx: 0, c: 'd' },
  { dy: 0, dx: -1, c: 'l' },
  { dy: 0, dx: 1, c: 'r' },
];

type Level = {
  W: number; H: number; wall: Uint8Array; floor: number[];
  goals: number[]; boxes: number[]; player: number;
};

function parse(text: string): Level {
  const rows = text.replace(/\r/g, '').split('\n').filter((r) => r.length > 0);
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  const wall = new Uint8Array(W * H).fill(1);
  const floor: number[] = [], goals: number[] = [], boxes: number[] = [];
  let player = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y][x] ?? '#';
    if (ch === '#') continue;
    const id = y * W + x;
    wall[id] = 0; floor.push(id);
    if (ch === '.' || ch === '*' || ch === '+') goals.push(id);
    if (ch === '$' || ch === '*') boxes.push(id);
    if (ch === '@' || ch === '+') player = id;
  }
  return { W, H, wall, floor, goals, boxes, player };
}

// BFS over cells the player can walk to (boxes are obstacles). Returns a Map
// cell -> [prevCell, char] covering the reachable area, rooted at `start`.
function flood(L: Level, blocked: Set<number>, start: number, allowed: Set<number> | null) {
  const prev = new Map<number, [number, string]>();
  prev.set(start, [-1, '']);
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % L.W, cy = (c / L.W) | 0;
    for (const d of DIRS) {
      const nx = cx + d.dx, ny = cy + d.dy;
      if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
      const n = ny * L.W + nx;
      if (L.wall[n] || blocked.has(n) || prev.has(n)) continue;
      if (allowed && !allowed.has(n)) continue;
      prev.set(n, [c, d.c]);
      q.push(n);
    }
  }
  return prev;
}
function pathTo(prev: Map<number, [number, string]>, target: number): string | null {
  if (!prev.has(target)) return null;
  let s = '', c = target;
  while (true) {
    const [p, ch] = prev.get(c)!;
    if (p < 0) break;
    s = ch + s; c = p;
  }
  return s;
}

// Min pushes to move one box from every cell to each goal, inside a region
// (single box, other boxes ignored). Reverse BFS from each goal.
function pullDistances(L: Level, region: Set<number>, goals: number[]) {
  const dists: Map<number, number>[] = [];
  for (const g of goals) {
    const dist = new Map<number, number>([[g, 0]]);
    const q = [g];
    for (let h = 0; h < q.length; h++) {
      const b = q[h], bx = b % L.W, by = (b / L.W) | 0, db = dist.get(b)!;
      for (const d of DIRS) {
        const px = bx - d.dx, py = by - d.dy, sx = bx - 2 * d.dx, sy = by - 2 * d.dy;
        if (px < 0 || py < 0 || sx < 0 || sy < 0 || px >= L.W || py >= L.H || sx >= L.W || sy >= L.H) continue;
        const p = py * L.W + px, s = sy * L.W + sx;
        if (!region.has(p) || !region.has(s) || dist.has(p)) continue;
        dist.set(p, db + 1);
        q.push(p);
      }
    }
    dists.push(dist);
  }
  return dists;
}

// Push-optimal A* inside one region. Nodes store parent pointers so the
// frontier stays small; the move string is rebuilt once, at the goal.
function solveRegion(L: Level, region: Set<number>, boxes0: number[], goals: number[], start: number, cap: number) {
  const goalSet = new Set(goals);
  const dists = pullDistances(L, region, goals);
  const dead = new Set<number>();
  for (const c of region) {
    if (goalSet.has(c)) continue;
    if (dists.every((d) => !d.has(c))) dead.add(c);
  }
  const perms: number[][] = [];
  const idx = goals.map((_, i) => i);
  const permute = (a: number[], k: number) => {
    if (k === a.length) { perms.push([...a]); return; }
    for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; permute(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  };
  if (idx.length <= 7) permute(idx, 0);
  const heur = (boxes: number[]): number => {
    if (perms.length === 0) {
      // Too many boxes to match exactly: sum of per-box minima is still
      // admissible (a matching can only cost more).
      let s = 0;
      for (const b of boxes) {
        let m = Infinity;
        for (const d of dists) { const v = d.get(b); if (v !== undefined && v < m) m = v; }
        if (m === Infinity) return Infinity;
        s += m;
      }
      return s;
    }
    let best = Infinity;
    for (const p of perms) {
      let s = 0;
      for (let i = 0; i < boxes.length; i++) {
        const d = dists[p[i]].get(boxes[i]);
        if (d === undefined) { s = Infinity; break; }
        s += d;
      }
      if (s < best) best = s;
    }
    return best;
  };
  type Node = { boxes: number[]; player: number; parent: number; seg: string; g: number };
  const nodes: Node[] = [];
  const heap: [number, number][] = []; // [f, nodeIndex]
  const hpush = (f: number, ni: number) => {
    heap.push([f, ni]);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const hpop = (): number => {
    const top = heap[0][1], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0;;) {
        let l = 2 * i + 1, r = l + 1, m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const h0 = heur(boxes0);
  if (h0 === Infinity) return null;
  nodes.push({ boxes: [...boxes0].sort((a, b) => a - b), player: start, parent: -1, seg: '', g: 0 });
  hpush(h0, 0);
  const seen = new Map<string, number>();
  const seenExact = new Map<string, number>();
  let expansions = 0;
  while (heap.length) {
    const ni = hpop();
    const n = nodes[ni];
    if (n.boxes.every((b) => goalSet.has(b))) {
      const segs: string[] = [];
      for (let c: Node | undefined = n; c && c.parent >= 0; c = nodes[c.parent]) segs.push(c.seg);
      return { moves: segs.reverse().join(''), player: n.player };
    }
    if (++expansions > cap) return null;
    const boxSet = new Set(n.boxes);
    const reach = flood(L, boxSet, n.player, region);
    let norm = Infinity;
    for (const c of reach.keys()) if (c < norm) norm = c;
    const key = n.boxes.join(',') + '|' + norm;
    if ((seen.get(key) ?? Infinity) <= n.g) continue;
    seen.set(key, n.g);
    for (let bi = 0; bi < n.boxes.length; bi++) {
      const b = n.boxes[bi], bx = b % L.W, by = (b / L.W) | 0;
      for (const d of DIRS) {
        const sx = bx - d.dx, sy = by - d.dy, tx = bx + d.dx, ty = by + d.dy;
        if (sx < 0 || sy < 0 || tx < 0 || ty < 0 || sx >= L.W || sy >= L.H || tx >= L.W || ty >= L.H) continue;
        const stand = sy * L.W + sx, dest = ty * L.W + tx;
        if (!region.has(dest) || boxSet.has(dest) || dead.has(dest) || !reach.has(stand)) continue;
        const walk = pathTo(reach, stand);
        if (walk === null) continue;
        const nb = [...n.boxes];
        nb[bi] = dest;
        nb.sort((a, b2) => a - b2);
        const h = heur(nb);
        if (h === Infinity) continue;
        const ekey = nb.join(',') + '|' + b;
        if ((seenExact.get(ekey) ?? Infinity) <= n.g + 1) continue;
        seenExact.set(ekey, n.g + 1);
        nodes.push({ boxes: nb, player: b, parent: ni, seg: walk + d.c, g: n.g + 1 });
        hpush(n.g + 1 + h, nodes.length - 1);
      }
    }
  }
  return null;
}

function solveLevel(text: string): string {
  const L = parse(text);
  if (L.boxes.length === 0) return '';
  const all = new Set(L.floor);
  const py = (L.player / L.W) | 0, px = L.player % L.W;
  // The hallway is the player's row when that row is floor end to end
  // (between the border walls); otherwise try the player's column.
  const rowFloor = (y: number) => {
    let first = -1, last = -1;
    for (let x = 0; x < L.W; x++) if (!L.wall[y * L.W + x]) { if (first < 0) first = x; last = x; }
    if (first < 0) return null;
    for (let x = first; x <= last; x++) if (L.wall[y * L.W + x]) return null;
    return [first, last];
  };
  const colFloor = (x: number) => {
    let first = -1, last = -1;
    for (let y = 0; y < L.H; y++) if (!L.wall[y * L.W + x]) { if (first < 0) first = y; last = y; }
    if (first < 0) return null;
    for (let y = first; y <= last; y++) if (L.wall[y * L.W + x]) return null;
    return [first, last];
  };
  type Room = { cells: Set<number>; entries: number[]; boxes: number[]; goals: number[] };
  const rooms: Room[] = [];
  let hall: Set<number> | null = null;
  const horiz = rowFloor(py);
  const vert = horiz ? null : colFloor(px);
  if (horiz || vert) {
    hall = new Set<number>();
    if (horiz) for (let x = horiz[0]; x <= horiz[1]; x++) hall.add(py * L.W + x);
    else for (let y = vert![0]; y <= vert![1]; y++) hall.add(y * L.W + px);
    // Components of the remaining floor are rooms (or bare pockets).
    const rest = L.floor.filter((c) => !hall!.has(c));
    const inRest = new Set(rest);
    const done = new Set<number>();
    for (const c of rest) {
      if (done.has(c)) continue;
      const cells = new Set<number>();
      const q = [c];
      done.add(c);
      for (let h = 0; h < q.length; h++) {
        const cur = q[h];
        cells.add(cur);
        const cx = cur % L.W, cy = (cur / L.W) | 0;
        for (const d of DIRS) {
          const nx = cx + d.dx, ny = cy + d.dy;
          if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
          const n = ny * L.W + nx;
          if (!inRest.has(n) || done.has(n)) continue;
          done.add(n);
          q.push(n);
        }
      }
      const bx = L.boxes.filter((b) => cells.has(b));
      if (bx.length === 0) continue;
      const gl = L.goals.filter((g) => cells.has(g));
      const entries = [...hall].filter((hc) => {
        const hx = hc % L.W, hy = (hc / L.W) | 0;
        return DIRS.some((d) => cells.has((hy + d.dy) * L.W + (hx + d.dx)));
      });
      rooms.push({ cells, entries, boxes: bx, goals: gl });
    }
  }
  const decomposable = hall !== null && rooms.length > 0
    && rooms.every((r) => r.entries.length > 0 && r.boxes.length === r.goals.length)
    && rooms.reduce((s, r) => s + r.boxes.length, 0) === L.boxes.length;
  if (decomposable) {
    const boxesNow = new Set(L.boxes);
    let player = L.player, out = '';
    let ok = true;
    for (const r of rooms) {
      const region = new Set([...r.cells, ...r.entries]);
      const door = r.entries[0];
      const reach = flood(L, boxesNow, player, null);
      const walk = pathTo(reach, door);
      if (walk === null) { ok = false; break; }
      const sol = solveRegion(L, region, r.boxes, r.goals, door, 600000);
      if (!sol) { ok = false; break; }
      out += walk + sol.moves;
      for (const b of r.boxes) boxesNow.delete(b);
      for (const g of r.goals) boxesNow.add(g);
      player = sol.player;
    }
    if (ok) return out;
  }
  const whole = solveRegion(L, all, L.boxes, L.goals, L.player, 800000);
  return whole ? whole.moves : '';
}

for (const id of readdirSync(I).sort()) {
  const moves = solveLevel(readFileSync(join(I, id, 'level.txt'), 'utf8'));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}
