/**
 * Dynamic Level Generator (levels 5 → ∞) — open zones in the style of Mario 64
 *
 * Every generated level is one big zone to explore freely:
 *  - The land is a 6×6 grid of terrain blocks at different heights (sunken pits, plains,
 *    hills and mesas, 3m apart) joined by staircases, so you can wander anywhere: climb,
 *    drop down, loop around. The connections are checked so every corner can be reached.
 *  - Hidden around the zone are 3-5 orbs 🔮 (each marked by a beam of light): on top of
 *    spiral towers, on islands in the sky reached with trampolines, at the end of routes
 *    that leave the map (with a portal back), on a pillar you reach by pushing a rock,
 *    inside a locked vault (the key is on a sky island or carried by an enemy) or next to
 *    a watchtower you have to sneak past.
 *  - In the middle stands the fortress, wrapped in a magic shield. Finding every orb
 *    breaks the shield, but it doesn't take you to the top: the last part of the level is
 *    a long, tangled spiral climb around the fortress tower (crumbling pads, moving pads,
 *    narrow steps, elevators and enemies), with shrines on the way, up to the summit.
 * The level number is the random seed, so level N is always the same zone.
 * Difficulty rises up to level ~40 within the jump limits validated for the physics.
 */
import * as THREE from 'three';
import { EnemyManager } from './enemies';
import { ProceduralTextures } from './textures';
import { PlatformItem, WorldBuildResult } from './levels';
import { createLevelKit } from './levelKit';
import { Builder, createThemePack } from './levelThemes';
import { ItemSpot } from './items';
import { THEME_INFO, themeForLevel, ThemeId } from './progress';
import { ExtraKind, spawnExtraEnemy } from './enemiesExtra';
import { CoverBox, DOOR_H, emptyPuzzles, makeBeam, makeCarrier, makeDoor, makeOrb, makePortal, makePushBlock, makeSentinel } from './puzzles';

/** 0 at level 5 → 1 at level 40+ */
export function difficultyForLevel(level: number): number {
  return Math.min(1, Math.max(0, (level - 5) / 35));
}

/** How many orbs are guarded by puzzles: 1 from level 5, 2 from 7, 3 from 12, 4 from 20. */
export function puzzleCountForLevel(level: number): number {
  if (level < 5) return 0;
  return 1 + (level >= 7 ? 1 : 0) + (level >= 12 ? 1 : 0) + (level >= 20 ? 1 : 0);
}

/** Orbs to find: 3 until level 11, 4 until 15, then 5. */
export function orbCountForLevel(level: number): number {
  return level >= 16 ? 5 : level >= 12 ? 4 : 3;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STONE: Record<ThemeId, number> = { cozy: 0xa08a7a, cosmic: 0x6d6a8f, swamp: 0x55604a, aero: 0x6fb7dc, garden: 0x9ca3af, castle: 0x4b4458 };
const ORB_COLORS = [0xf472b6, 0x38bdf8, 0xfacc15, 0x4ade80, 0xc084fc];

type Puzzle = 'rock' | 'vault' | 'thief' | 'stealth';
type Explore = 'tower' | 'sky' | 'excursion';
type Feature = Puzzle | Explore;
const PUZZLE_ORDER: Puzzle[] = ['rock', 'vault', 'thief', 'stealth'];
const EXPLORE_ORDER: Explore[] = ['tower', 'sky', 'excursion'];

// ---- Zone layout ----
const G = 6; // tiles per side
const T = 11; // tile size (m)
const HZ = (G * T) / 2; // half zone size = 33
const H = 3.0; // height between terrain levels (too high to jump)
const BOTTOM = -6; // bottom of every terrain block
const MIN_Y = -3.5; // lowest floor of the routes that leave the map

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
interface Tile {
  i: number;
  j: number;
  kind: 'fort' | 'inner' | 'outer';
  level: number;
  y: number;
  cx: number;
  cz: number;
  rects: Rect[];
  used: boolean;
  plat?: PlatformItem;
}
interface StairPlan {
  low: Tile;
  high: Tile;
  axis: 'x' | 'z';
  dir: number;
  edge: number;
  lat: number;
}

/** Cursor in a route's local frame: u = forward distance, v = lateral, a = width across, l = length along */
interface LCur {
  u: number;
  v: number;
  y: number;
  a: number;
  l: number;
}
interface Frame {
  id: string;
  ox: number;
  oz: number;
  fx: number;
  fz: number;
  rx: number;
  rz: number;
  axisF: 'x' | 'z';
  axisR: 'x' | 'z';
  vMax: number;
  cur: LCur;
  n: number;
  ids: string[];
}

const rectHit = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const rectAt = (x: number, z: number, hx: number, hz: number): Rect => ({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });

export function generateLevel(level: number, root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const rng = mulberry32(level * 9973 + 17);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const shuffle = <T,>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      [arr[i], arr[k]] = [arr[k], arr[i]];
    }
    return arr;
  };
  const diff = difficultyForLevel(level);
  const kit = createLevelKit(root, textures);
  const themeId = themeForLevel(level);
  const theme = createThemePack(themeId, kit, textures);
  const accent = parseInt(THEME_INFO[themeId].accent.slice(1), 16);
  const terrainBuilder = theme.terrain ?? theme.big;
  const padBuilders = theme.small.filter((b) => b !== theme.deck);

  const enemies = new EnemyManager(root, textures);
  const puzzles = emptyPuzzles();
  const items: ItemSpot[] = [];
  const routes: { name: string; ids: string[] }[] = [];
  let enemyN = 0;
  let collectN = 0;
  const cpNames = [...theme.cpNames].sort(() => rng() - 0.5);

  const stoneMat = new THREE.MeshStandardMaterial({ color: STONE[themeId], roughness: 0.85, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
  const wallBuilder: Builder = (g, w, d, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    m.position.y = -h / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2), capMat);
    cap.position.y = 0.02;
    g.add(cap);
  };

  function collectible(x: number, y: number, z: number, force = false) {
    if (!force && (collectN >= 26 || rng() > 0.5)) return;
    kit.addCollectible(`g${collectN++}`, rng() < 0.7 ? 'sun_crystal' : 'golden_acorn', x, y + 1.2, z);
  }
  function hint(pos: THREE.Vector3, radius: number, text: string) {
    puzzles.hints.push({ pos: pos.clone(), radius, text, shown: false });
  }

  // ---------------- Enemies ----------------
  // New enemy kinds unlock gradually: 2 kinds from level 5, 3 from level 9, all 4 from level 13
  const extraKinds: ExtraKind[] = (['chaser', 'hopper', 'shooter', 'diver'] as ExtraKind[]).sort(() => rng() - 0.5);
  const kindsAvailable = extraKinds.slice(0, level >= 13 ? 4 : level >= 9 ? 3 : 2);
  let extraN = 0;
  const extraCap = 4 + Math.round(diff * 9);
  function extra(kind: ExtraKind, pos: THREE.Vector3, axis: 'x' | 'z', range: number) {
    if (!kindsAvailable.includes(kind) || extraN >= extraCap) return false;
    spawnExtraEnemy(enemies, themeId, kind, `x${extraN++}`, pos, axis, range);
    return true;
  }
  function walker(pos: THREE.Vector3, axis: 'x' | 'z', range: number) {
    const r = rng();
    if (r < 0.35 && extra('chaser', pos, axis, range)) return;
    if (r < 0.7 && extra('hopper', pos, axis, range)) return;
    theme.walker(enemies, `w${enemyN++}`, pos, axis, range);
  }

  /** True if the boxes don't collide with existing platforms (keeping head room above and below). */
  function fits(boxes: { x: number; z: number; top: number; sx: number; sy: number; sz: number }[], ignore: PlatformItem[] = []) {
    for (const b of boxes) {
      // Keep everything out of the fortress (its walls, shield and spiral are built later)
      if (Math.abs(b.x) < 11.3 + b.sx / 2 && Math.abs(b.z) < 11.3 + b.sz / 2) return false;
      const y0 = b.top - b.sy - 1.6;
      const y1 = b.top + 2.0;
      for (const q of kit.platforms) {
        if (q.type === 'updraft' || ignore.includes(q)) continue;
        const qy0 = q.position.y - q.size.y;
        if (qy0 >= y1 || q.position.y <= y0) continue;
        if (Math.abs(q.position.x - b.x) < (q.size.x + b.sx) / 2 + 0.05 && Math.abs(q.position.z - b.z) < (q.size.z + b.sz) / 2 + 0.05) return false;
      }
    }
    return true;
  }

  // ======================================================================
  // 1. TERRAIN PLAN: heights of the 6×6 tiles + staircases, always connected
  // ======================================================================
  const kindOf = (i: number, j: number): Tile['kind'] =>
    (i === 2 || i === 3) && (j === 2 || j === 3) ? 'fort' : i === 0 || j === 0 || i === G - 1 || j === G - 1 ? 'outer' : 'inner';
  const RING: [number, number][] = [];
  for (let i = 0; i < G; i++) RING.push([i, 0]);
  for (let j = 1; j < G; j++) RING.push([G - 1, j]);
  for (let i = G - 2; i >= 0; i--) RING.push([i, G - 1]);
  for (let j = G - 2; j >= 1; j--) RING.push([0, j]);
  const spawn = new THREE.Vector3(0, 0.2, -18.5);
  const spawnRect: Rect = { x0: -3.6, x1: 3.6, z0: -22, z1: -11 };

  let tiles: Tile[][] = [];
  let stairs: StairPlan[] = [];
  const tileAt = (i: number, j: number) => (i < 0 || j < 0 || i >= G || j >= G ? null : tiles[i][j]);
  const nonFort = () => tiles.flat().filter((t) => t.kind !== 'fort');

  function tryStairs(low: Tile, high: Tile): StairPlan | null {
    const axis: 'x' | 'z' = high.i !== low.i ? 'x' : 'z';
    const dir = axis === 'x' ? Math.sign(high.i - low.i) : Math.sign(high.j - low.j);
    const center = axis === 'x' ? low.cx : low.cz;
    const latC = axis === 'x' ? low.cz : low.cx;
    const edge = center + dir * (T / 2);
    for (const off of shuffle([0, -2.4, 2.4, -1.2, 1.2])) {
      const lat = latC + off;
      const a0 = edge - dir * (7 * 0.8 + 1.6);
      const lowR: Rect =
        axis === 'x' ? { x0: Math.min(a0, edge), x1: Math.max(a0, edge), z0: lat - 1.6, z1: lat + 1.6 } : { x0: lat - 1.6, x1: lat + 1.6, z0: Math.min(a0, edge), z1: Math.max(a0, edge) };
      const b1 = edge + dir * 2.2;
      const highR: Rect =
        axis === 'x' ? { x0: Math.min(edge, b1), x1: Math.max(edge, b1), z0: lat - 1.6, z1: lat + 1.6 } : { x0: lat - 1.6, x1: lat + 1.6, z0: Math.min(edge, b1), z1: Math.max(edge, b1) };
      if (low.rects.some((r) => rectHit(r, lowR)) || high.rects.some((r) => rectHit(r, highR))) continue;
      low.rects.push(lowR);
      high.rects.push(highR);
      return { low, high, axis, dir, edge, lat };
    }
    return null;
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    // Heights around the outer ring: a smooth random walk (the inner ring stays flat around the fortress)
    const lv = new Array(RING.length).fill(0);
    if (attempt < 39) {
      let cur = 0;
      const s0 = Math.floor(rng() * RING.length);
      for (let k = 0; k < RING.length; k++) {
        if (k > 0) {
          const r = rng();
          if (r >= 0.4) cur += r < 0.76 ? 1 : -1;
          cur = Math.max(-1, Math.min(2, cur));
        }
        lv[(s0 + k) % RING.length] = cur;
      }
      for (let pass = 0; pass < 6; pass++)
        for (let k = 0; k < RING.length; k++) {
          const nb = (k + 1) % RING.length;
          if (Math.abs(lv[nb] - lv[k]) > 1) lv[nb] = lv[k] + Math.sign(lv[nb] - lv[k]);
        }
    }
    tiles = [];
    for (let i = 0; i < G; i++) {
      tiles.push([]);
      for (let j = 0; j < G; j++) {
        tiles[i].push({ i, j, kind: kindOf(i, j), level: 0, y: 0, cx: -HZ + (i + 0.5) * T, cz: -HZ + (j + 0.5) * T, rects: [], used: false });
      }
    }
    RING.forEach(([i, j], k) => {
      tiles[i][j].level = lv[k];
      tiles[i][j].y = lv[k] * H;
    });
    for (const t of nonFort()) if (rectHit(spawnRect, rectAt(t.cx, t.cz, T / 2, T / 2))) t.rects.push(spawnRect);

    // Union-find over tiles: flat neighbours are joined for free, a step of one level needs stairs
    const parent = new Map<Tile, Tile>();
    const find = (t: Tile): Tile => {
      let r = t;
      while (parent.get(r) !== r) r = parent.get(r)!;
      parent.set(t, r);
      return r;
    };
    nonFort().forEach((t) => parent.set(t, t));
    const edges: [Tile, Tile][] = [];
    for (const t of nonFort())
      for (const [di, dj] of [
        [1, 0],
        [0, 1],
      ]) {
        const n = tileAt(t.i + di, t.j + dj);
        if (n && n.kind !== 'fort') edges.push([t, n]);
      }
    for (const [a, b] of edges) if (a.level === b.level) parent.set(find(a), find(b));
    stairs = [];
    const maxStairs = 7 + Math.round(diff * 4);
    for (const [a, b] of shuffle(edges.filter(([a, b]) => Math.abs(a.level - b.level) === 1))) {
      const needed = find(a) !== find(b);
      if (!needed && (rng() > 0.3 || stairs.length >= maxStairs)) continue;
      const [low, high] = a.level < b.level ? [a, b] : [b, a];
      const st = tryStairs(low, high);
      if (!st) continue;
      stairs.push(st);
      parent.set(find(a), find(b));
    }
    const root0 = find(tiles[2][1]);
    if (nonFort().every((t) => find(t) === root0)) break;
  }

  // ======================================================================
  // 2. BUILD THE TERRAIN
  // ======================================================================
  for (const t of nonFort()) {
    t.plat = kit.addPlatform(`tile_${t.i}_${t.j}`, t.cx, t.y, t.cz, T, T, t.y - BOTTOM, terrainBuilder);
    t.plat.solid = true;
  }
  // The level starts here (first checkpoint), facing the fortress
  kit.addCheckpoint(1, cpNames[0] ?? 'Entrada', new THREE.Vector3(3.4, 0, -20.4), spawn.clone(), true);
  const rise = H / 7;
  stairs.forEach((st, s) => {
    const ids = [st.low.plat!.id];
    for (let k = 0; k < 7; k++) {
      const along = st.edge - st.dir * ((6 - k) * 0.8 + 0.4);
      const top = st.low.y + (k + 1) * rise;
      const x = st.axis === 'x' ? along : st.lat;
      const z = st.axis === 'x' ? st.lat : along;
      const p = kit.addPlatform(`stair_${s}_${k}`, x, top, z, st.axis === 'x' ? 0.8 : 2.6, st.axis === 'x' ? 2.6 : 0.8, (k + 1) * rise + 0.3, wallBuilder);
      p.solid = true;
      ids.push(p.id);
    }
    ids.push(st.high.plat!.id);
    routes.push({ name: `escalera ${s}`, ids });
    if (rng() < 0.45) {
      const topX = st.axis === 'x' ? st.edge + st.dir * 1.0 : st.lat;
      const topZ = st.axis === 'x' ? st.lat : st.edge + st.dir * 1.0;
      collectible(topX, st.high.y, topZ, true);
    }
  });

  // ======================================================================
  // 3. ORB FEATURES around the zone
  // ======================================================================
  const AX = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];
  let featureN = 0;
  let orbIdx = 0;
  const sockets: THREE.Mesh[] = [];
  const placeOrb = (x: number, floorY: number, z: number) => {
    const orb = makeOrb(root, x, floorY, z, ORB_COLORS[orbIdx % ORB_COLORS.length]);
    orb.socket = sockets[orbIdx];
    puzzles.orbs.push(orb);
    orbIdx++;
  };
  const insideTile = (t: Tile, x: number, z: number, margin: number) => Math.abs(x - t.cx) <= T / 2 - margin && Math.abs(z - t.cz) <= T / 2 - margin;

  /** Spiral tower of 7 pads; the orb waits on the top one. */
  function tower(t: Tile): boolean {
    const R = 3.3;
    const step = 0.85 + 0.25 * diff;
    for (const f of shuffle([...AX])) {
      for (const [ox, oz] of shuffle([
        [0, 0],
        [1.2, 0],
        [-1.2, 0],
        [0, 1.2],
        [0, -1.2],
      ])) {
        const cx = t.cx + ox;
        const cz = t.cz + oz;
        const spin = rng() < 0.5 ? 1 : -1;
        const pads: { x: number; z: number; top: number }[] = [];
        for (let i = 0; i < 7; i++) {
          const a = Math.PI + spin * i * (Math.PI / 2);
          // local forward = f, lateral = (f.z, -f.x)
          const u = Math.cos(a) * R;
          const v = Math.sin(a) * R;
          pads.push({ x: cx + f.x * u + f.z * v, z: cz + f.z * u - f.x * v, top: t.y + 0.6 + i * step });
        }
        const foot = rectAt(cx, cz, R + 1.5, R + 1.5);
        if (t.rects.some((r) => rectHit(r, foot))) continue;
        if (!fits(pads.map((p) => ({ ...p, sx: 2.8, sy: 0.6, sz: 2.8 })), [t.plat!])) continue;
        const id = `f${featureN++}`;
        const ids = [t.plat!.id];
        pads.forEach((p, i) => ids.push(kit.addPlatform(`${id}_${i}`, p.x, p.top, p.z, 2.8, 2.8, 0.6, pick(padBuilders)).id));
        const last = pads[pads.length - 1];
        placeOrb(last.x, last.top, last.z);
        const colH = 6 * step + 3;
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, colH, 10),
          new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 })
        );
        col.position.set(cx, t.y + colH / 2, cz);
        root.add(col);
        collectible(pads[3].x, pads[3].top, pads[3].z, true);
        if (rng() < 0.3 + 0.4 * diff) extra('diver', new THREE.Vector3(cx, last.top, cz), 'x', 1.4);
        t.rects.push(foot);
        t.used = true;
        routes.push({ name: `torre ${id}`, ids });
        return true;
      }
    }
    return false;
  }

  /** Trampoline → island in the sky (+2.8m) → (optionally) a second trampoline → higher island (+5.6m). */
  function sky(t: Tile, twoStages: boolean, reward: 'orb' | 'key'): boolean {
    for (const f of shuffle([...AX])) {
      for (const lat of shuffle([0, 1.5, -1.5])) {
        for (const side of shuffle([1, -1])) {
          const r = { x: f.z * side, z: -f.x * side };
          const t1 = { x: t.cx - f.x * 2.8 + r.x * lat, z: t.cz - f.z * 2.8 + r.z * lat };
          if (!insideTile(t, t1.x, t1.z, 1.8)) continue;
          const d1 = { x: t1.x + f.x * 6, z: t1.z + f.z * 6, top: t.y + 2.8 };
          const d2 = { x: d1.x + r.x * 6, z: d1.z + r.z * 6, top: t.y + 5.6 };
          const boxes = [
            { x: t1.x, z: t1.z, top: t.y + 1.1, sx: 2.6, sy: 1.1, sz: 2.6 },
            { ...d1, sx: 6, sy: 0.6, sz: 6 },
          ];
          if (twoStages) boxes.push({ ...d2, sx: 6, sy: 0.6, sz: 6 });
          const foot = rectAt(t1.x, t1.z, 1.8, 1.8);
          if (t.rects.some((q) => rectHit(q, foot))) continue;
          if (!fits(boxes, [t.plat!])) continue;
          const id = `f${featureN++}`;
          kit.addBouncy(`${id}_t1`, theme.trampoline(), t1.x, t.y, t1.z);
          const ids = [t.plat!.id, `${id}_t1`, kit.addPlatform(`${id}_d1`, d1.x, d1.top, d1.z, 6, 6, 0.6, theme.big).id];
          let last = d1;
          if (twoStages) {
            kit.addBouncy(`${id}_t2`, theme.trampoline(), d1.x, d1.top, d1.z);
            ids.push(`${id}_t2`, kit.addPlatform(`${id}_d2`, d2.x, d2.top, d2.z, 6, 6, 0.6, theme.big).id);
            last = d2;
          }
          const sp = new THREE.Vector3(last.x + f.x * 1.6 - r.x * 1.6, last.top, last.z + f.z * 1.6 - r.z * 1.6);
          if (reward === 'orb') placeOrb(sp.x, last.top, sp.z);
          else {
            items.push({ type: 'llave', pos: new THREE.Vector3(sp.x, last.top + 0.95, sp.z) });
            hint(new THREE.Vector3(last.x, last.top, last.z), 3.5, '🔑 ¡Una llave! Abre la bóveda donde está encerrado un orbe');
          }
          collectible(d1.x, d1.top, d1.z, true);
          hint(new THREE.Vector3(t1.x, t.y, t1.z), 4, '🍄 ¡Rebota en el trampolín para subir a las islas del cielo!');
          if (rng() < 0.3 + 0.4 * diff) extra('diver', new THREE.Vector3(d1.x, d1.top, d1.z), 'x', 1.6);
          t.rects.push(foot);
          t.used = true;
          routes.push({ name: `cielo ${id}`, ids });
          return true;
        }
      }
    }
    return false;
  }

  // ---- Routes that leave the map (local frames) ----
  const fx = (F: Frame, u: number, v: number) => F.ox + F.fx * u + F.rx * v;
  const fz = (F: Frame, u: number, v: number) => F.oz + F.fz * u + F.rz * v;
  const fvec = (F: Frame, u: number, v: number, y: number) => new THREE.Vector3(fx(F, u, v), y, fz(F, u, v));
  const fsize = (F: Frame, a: number, l: number) => ({ sx: Math.abs(F.fx) * l + Math.abs(F.rx) * a, sz: Math.abs(F.fz) * l + Math.abs(F.rz) * a });
  function fadd(F: Frame, a: number, l: number, h: number, u: number, v: number, y: number, builder: Builder): PlatformItem {
    const { sx, sz } = fsize(F, a, l);
    const p = kit.addPlatform(`${F.id}_${F.n++}`, fx(F, u, v), y, fz(F, u, v), sx, sz, h, builder);
    F.cur = { u, v, y, a, l };
    F.ids.push(p.id);
    return p;
  }
  function fnext(F: Frame, a: number, l: number, gap: number, dy: number) {
    const c = F.cur;
    const maxShift = Math.max(0, (c.a + a) / 2 - 0.8);
    let dv = (rng() * 2 - 1) * Math.min(maxShift, 4);
    if (c.v + dv > F.vMax) dv = -Math.abs(dv);
    if (c.v + dv < -F.vMax) dv = Math.abs(dv);
    return { u: c.u + c.l / 2 + gap + l / 2, v: c.v + dv, y: Math.max(MIN_Y, c.y + dy) };
  }
  const randDy = (F: Frame) => (rng() < 0.12 && F.cur.y > 1 ? -0.4 : rng() * (0.35 + 0.85 * diff));
  const randGap = (dy: number) => Math.min(dy > 0.8 ? 2.0 : 2.45, 1.1 + rng() * (0.55 + 0.85 * diff));
  const smallSize = () => Math.max(2.6, 3.5 - 0.8 * diff + (rng() - 0.5) * 0.4);

  function segHop(F: Frame) {
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const prev = { ...F.cur };
      const s = smallSize();
      const dy = randDy(F);
      const p = fnext(F, s, s, randGap(dy), dy);
      fadd(F, s, s, 0.8, p.u, p.v, p.y, pick(padBuilders));
      const w = fvec(F, p.u, p.v, p.y);
      collectible(w.x, w.y, w.z);
      if (i > 0 && rng() < 0.15 + 0.35 * diff) {
        theme.flyer(enemies, `f${enemyN++}`, fvec(F, (prev.u + p.u) / 2, (prev.v + p.v) / 2 + (rng() < 0.5 ? -1.4 : 1.4), Math.max(prev.y, p.y) + 1.1), F.axisR, 1.5 + diff);
      }
    }
  }
  function segMover(F: Frame) {
    const dy = Math.min(0.6, randDy(F));
    const p = fnext(F, 3.6, 3.6, Math.min(2.2, randGap(dy)), dy);
    const plat = fadd(F, 3.6, 3.6, 0.6, p.u, p.v, p.y, theme.mover);
    kit.makeMoving(plat, F.axisR, 1.0 + rng() * 0.6, 0.65 + 0.35 * diff, rng() * 6);
  }
  function segCrumble(F: Frame) {
    for (let i = 0; i < 2; i++) {
      const s = smallSize();
      const dy = Math.min(0.6, randDy(F));
      const p = fnext(F, s, s, randGap(dy), dy);
      kit.makeCrumbling(fadd(F, s, s, 0.5, p.u, p.v, p.y, pick(padBuilders)));
    }
  }
  function segBridge(F: Frame) {
    const len = 7 + rng() * 2;
    const dy = Math.min(0.3, randDy(F));
    const p = fnext(F, 2.6, len, 1.3, dy);
    fadd(F, 2.6, len, 0.4, p.u, p.v, p.y, theme.bridge);
    const w = fvec(F, p.u, p.v, p.y);
    collectible(w.x, w.y, w.z, true);
  }
  function segBounce(F: Frame) {
    // Island + trampoline → high deck 6m ahead and 2.8m up (validated layout)
    const dy = Math.min(0.6, randDy(F));
    const p = fnext(F, 5, 5, Math.min(1.8, randGap(dy)), dy);
    fadd(F, 5, 5, 1.5, p.u, p.v, p.y, theme.big);
    const t = fvec(F, p.u, p.v, p.y);
    kit.addBouncy(`${F.id}_tramp${F.n}`, theme.trampoline(), t.x, t.y, t.z);
    F.ids.push(`${F.id}_tramp${F.n}`);
    fadd(F, 6, 6, 0.6, p.u + 6, p.v, p.y + 2.8, theme.big);
  }
  function segDescent(F: Frame) {
    for (let i = 0; i < 3 && F.cur.y > MIN_Y + 0.5; i++) {
      const drop = Math.min(F.cur.y - MIN_Y, 1.0 + rng() * 0.9);
      const p = fnext(F, 3.6, 3.6, 1.6 + rng() * 0.8, -drop);
      fadd(F, 3.6, 3.6, 0.8, p.u, p.v, p.y, pick(padBuilders));
    }
  }

  const usedSides = new Set<string>();
  /** A route of floating platforms leaving the map; the orb waits on an island at the end, with a portal home. */
  function excursion(t: Tile): boolean {
    if (t.kind !== 'outer') return false;
    const outs = AX.filter((a) => !tileAt(t.i + a.x, t.j + a.z));
    for (const f of shuffle(outs)) {
      const side = `${f.x},${f.z}`;
      if (usedSides.has(side)) continue;
      const id = `f${featureN++}`;
      const F: Frame = {
        id,
        ox: t.cx + f.x * (T / 2),
        oz: t.cz + f.z * (T / 2),
        fx: f.x,
        fz: f.z,
        rx: f.z,
        rz: -f.x,
        axisF: f.x !== 0 ? 'x' : 'z',
        axisR: f.x !== 0 ? 'z' : 'x',
        vMax: 3.5,
        cur: { u: -1, v: 0, y: t.y, a: 6, l: 2 },
        n: 0,
        ids: [t.plat!.id],
      };
      const n = 2 + Math.floor(diff * 2 + rng());
      const pool = [segHop, segMover, segCrumble, segBounce, segBridge, t.y > 1 ? segDescent : segHop];
      let last: ((F: Frame) => void) | null = null;
      for (let k = 0; k < n; k++) {
        let s = pick(pool);
        if (s === last) s = segHop;
        last = s;
        s(F);
      }
      const dy = Math.min(0.6, randDy(F));
      const p = fnext(F, 7, 7, Math.min(1.8, randGap(dy)), dy);
      fadd(F, 7, 7, 2.5, p.u, p.v, p.y, theme.big);
      const c = fvec(F, p.u, p.v, p.y);
      placeOrb(c.x, p.y, c.z);
      const pp = fvec(F, p.u - 2.2, p.v + 2.2, p.y);
      puzzles.portals.push(makePortal(root, pp.x, p.y, pp.z, spawn, ORB_COLORS[(orbIdx - 1) % ORB_COLORS.length]));
      const pr = fvec(F, p.u + 2.4, p.v - 2.4, p.y);
      theme.prop(pr.x, pr.y, pr.z, rng());
      if (diff > 0.3 && rng() < 0.5) walker(fvec(F, p.u, p.v + 2.4, p.y), F.axisF, 1.8);
      usedSides.add(side);
      t.used = true;
      routes.push({ name: `excursión ${id}`, ids: F.ids });
      return true;
    }
    return false;
  }

  /** A pillar too high to jump with the orb on top, and a rock to push against it. */
  function rock(t: Tile): boolean {
    for (const f of shuffle([...AX])) {
      for (const lat of shuffle([0, 1.5, -1.5])) {
        const r = { x: f.z, z: -f.x };
        const pc = { x: t.cx + f.x * 2.5 + r.x * lat, z: t.cz + f.z * 2.5 + r.z * lat };
        const rc = { x: t.cx - f.x * 2.2 + r.x * lat, z: t.cz - f.z * 2.2 + r.z * lat };
        // The ground path from behind the rock to the pillar must be free
        const ax = [t.cx - f.x * 4.9 + r.x * lat, t.cx + f.x * 4.5 + r.x * lat];
        const az = [t.cz - f.z * 4.9 + r.z * lat, t.cz + f.z * 4.5 + r.z * lat];
        const path: Rect = {
          x0: Math.min(...ax) - (f.x === 0 ? 2.2 : 0),
          x1: Math.max(...ax) + (f.x === 0 ? 2.2 : 0),
          z0: Math.min(...az) - (f.z === 0 ? 2.2 : 0),
          z1: Math.max(...az) + (f.z === 0 ? 2.2 : 0),
        };
        if (t.rects.some((q) => rectHit(q, path))) continue;
        if (!fits([{ x: pc.x, z: pc.z, top: t.y + 3.2, sx: 4, sy: 4, sz: 4 }], [t.plat!])) continue;
        // Nothing high nearby (a higher tile or stairs would let you skip the rock)
        const near = kit.platforms.some((q) => {
          if (q === t.plat || q.position.y <= t.y + 1.0) return false;
          const gx = Math.max(0, Math.abs(q.position.x - pc.x) - (q.size.x / 2 + 2));
          const gz = Math.max(0, Math.abs(q.position.z - pc.z) - (q.size.z / 2 + 2));
          return Math.hypot(gx, gz) < 4.5;
        });
        if (near) continue;
        const id = `f${featureN++}`;
        const pillar = kit.addPlatform(`${id}_pillar`, pc.x, t.y + 3.2, pc.z, 4, 4, 4, wallBuilder);
        pillar.solid = true;
        const rk = makePushBlock(root, `${id}_rock`, rc.x, t.y, rc.z, stoneMat, accent);
        kit.platforms.push(rk.plat);
        puzzles.blocks.push(rk.block);
        placeOrb(pc.x, t.y + 3.2, pc.z);
        hint(new THREE.Vector3(rc.x, t.y, rc.z), 5, '¡Hay un orbe sobre el pilar! Empuja la roca hasta él (camina hacia ella) y súbete encima');
        t.rects.push(path);
        t.used = true;
        routes.push({ name: `roca ${id}`, ids: [t.plat!.id, pillar.id] });
        return true;
      }
    }
    return false;
  }

  /** A closed stone vault with the orb inside and a locked door. */
  function vault(t: Tile, keyText: string): boolean {
    const S = 6.4;
    const half = S / 2;
    const th = 0.6;
    for (const f of shuffle([...AX])) {
      for (const lat of shuffle([0, 1, -1])) {
        const r = { x: f.z, z: -f.x };
        const vc = { x: t.cx - f.x * 0.8 + r.x * lat, z: t.cz - f.z * 0.8 + r.z * lat };
        const foot = rectAt(vc.x, vc.z, half + 0.3, half + 0.3);
        const front = { x: vc.x + f.x * (half + 1.6), z: vc.z + f.z * (half + 1.6) };
        const frontR = rectAt(front.x, front.z, f.x !== 0 ? 1.4 : 2, f.x !== 0 ? 2 : 1.4);
        if (t.rects.some((q) => rectHit(q, foot) || rectHit(q, frontR))) continue;
        if (!insideTile(t, front.x, front.z, 0.4)) continue;
        if (!fits([{ x: vc.x, z: vc.z, top: t.y + DOOR_H + 0.5, sx: S, sy: DOOR_H + 1, sz: S }], [t.plat!])) continue;
        const id = `f${featureN++}`;
        const wall = (name: string, u: number, v: number, a: number, l: number) => {
          // u along f, v along r; a = size across (r), l = size along (f)
          const x = vc.x + f.x * u + r.x * v;
          const z = vc.z + f.z * u + r.z * v;
          const sx = Math.abs(f.x) * l + Math.abs(r.x) * a;
          const sz = Math.abs(f.z) * l + Math.abs(r.z) * a;
          kit.addPlatform(`${id}_${name}`, x, t.y + DOOR_H, z, sx, sz, DOOR_H + 0.5, wallBuilder).solid = true;
        };
        wall('back', -half + th / 2, 0, S, th);
        wall('left', 0, -half + th / 2, th, S - 2 * th);
        wall('right', 0, half - th / 2, th, S - 2 * th);
        const seg = (S - 3.4) / 2;
        wall('fl', half - th / 2, -(1.7 + seg / 2), seg, th);
        wall('fr', half - th / 2, 1.7 + seg / 2, seg, th);
        kit.addPlatform(`${id}_roof`, vc.x, t.y + DOOR_H + 0.5, vc.z, S + 0.4, S + 0.4, 0.5, wallBuilder).solid = true;
        const dc = { x: vc.x + f.x * (half - th / 2), z: vc.z + f.z * (half - th / 2) };
        const gate = makeDoor(root, `${id}_door`, dc.x, t.y, dc.z, 3.4, accent, f.x !== 0);
        kit.platforms.push(gate.plat);
        puzzles.doors.push(gate.door);
        placeOrb(vc.x, t.y, vc.z);
        hint(new THREE.Vector3(front.x, t.y, front.z), 4, keyText);
        t.rects.push(foot, frontR);
        t.used = true;
        return true;
      }
    }
    return false;
  }

  /** A watchtower on the edge of the map guards the orb: sneak behind the walls. */
  function stealth(t: Tile): boolean {
    if (t.kind !== 'outer') return false;
    const outs = AX.filter((a) => !tileAt(t.i + a.x, t.j + a.z));
    if (outs.length !== 1) return false;
    const out = outs[0];
    const r = { x: out.z, z: -out.x };
    const sp = { x: t.cx + out.x * (T / 2 - 1.8), z: t.cz + out.z * (T / 2 - 1.8) };
    const tileR = rectAt(t.cx, t.cz, T / 2, T / 2);
    if (t.rects.some((q) => rectHit(q, tileR))) return false;
    const s = rng() < 0.5 ? 1 : -1;
    const covers: CoverBox[] = [];
    const coverBoxes = [8.2, 5.6, 3.0].map((dist, i) => {
      const side = i % 2 === 0 ? s : -s;
      const x = sp.x - out.x * dist + r.x * side * 2.4;
      const z = sp.z - out.z * dist + r.z * side * 2.4;
      return { x, z, top: t.y + 2.6, sx: out.x !== 0 ? 0.8 : 3.4, sy: 2.8, sz: out.x !== 0 ? 3.4 : 0.8 };
    });
    if (!fits(coverBoxes, [t.plat!])) return false;
    const id = `f${featureN++}`;
    coverBoxes.forEach((b, i) => {
      kit.addPlatform(`${id}_cover${i}`, b.x, b.top, b.z, b.sx, b.sz, b.sy, wallBuilder).solid = true;
      covers.push({ minX: b.x - b.sx / 2, maxX: b.x + b.sx / 2, minZ: b.z - b.sz / 2, maxZ: b.z + b.sz / 2 });
    });
    const entrance = new THREE.Vector3(t.cx - out.x * (T / 2 - 1.2), t.y + 0.2, t.cz - out.z * (T / 2 - 1.2));
    const sentinel = makeSentinel(
      root,
      sp.x,
      t.y,
      sp.z,
      Math.atan2(-out.x, -out.z),
      { minX: t.cx - T / 2, maxX: t.cx + T / 2, minZ: t.cz - T / 2, maxZ: t.cz + T / 2, y: t.y },
      entrance,
      covers,
      accent
    );
    puzzles.sentinels.push(sentinel);
    kit.registerCylinder(`${id}_sentinel`, sp.x, t.y, sp.z, 0.8, 2.8);
    placeOrb(sp.x - r.x * s * 2.3 + out.x * 0.4, t.y, sp.z - r.z * s * 2.3 + out.z * 0.4);
    hint(entrance, 4, '¡Un vigía cuida el orbe! Si su luz te ve, vuelves a la entrada. Escóndete tras los muros y avanza cuando mire a otro lado');
    t.rects.push(tileR);
    t.used = true;
    routes.push({ name: `vigía ${id}`, ids: [t.plat!.id] });
    return true;
  }

  // ---- Decide and place the orbs ----
  const nOrbs = orbCountForLevel(level);
  for (let i = 0; i < nOrbs; i++) {
    // Sockets in front of the fortress gate: they light up as you find the orbs
    const px = (i - (nOrbs - 1) / 2) * 1.5;
    const pz = -13.2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), stoneMat);
    post.position.set(px, 0.55, pz);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 12),
      new THREE.MeshStandardMaterial({ color: ORB_COLORS[i % ORB_COLORS.length], emissive: ORB_COLORS[i % ORB_COLORS.length], emissiveIntensity: 0.05, roughness: 0.3 })
    );
    ball.position.set(px, 1.3, pz);
    root.add(post, ball);
    sockets.push(ball);
  }
  const nPuzzle = Math.min(nOrbs, puzzleCountForLevel(level));
  const plan: Feature[] = [];
  for (let i = 0; i < nPuzzle; i++) plan.push(PUZZLE_ORDER[(level + i) % PUZZLE_ORDER.length]);
  for (let i = nPuzzle; i < nOrbs; i++) plan.push(EXPLORE_ORDER[(level + i) % EXPLORE_ORDER.length]);
  const isSpawnTile = (t: Tile) => t.j === 1 && (t.i === 2 || t.i === 3);
  const freeTiles = () => shuffle(nonFort().filter((t) => !t.used && !isSpawnTile(t)));
  const outerFirst = () => {
    const f = freeTiles();
    return [...f.filter((t) => t.kind === 'outer'), ...f.filter((t) => t.kind !== 'outer')];
  };
  const tryFeature = (kind: Feature): boolean => {
    for (const t of outerFirst()) {
      if (kind === 'tower' && tower(t)) return true;
      if (kind === 'sky' && sky(t, diff > 0.3 || rng() < 0.4, 'orb')) return true;
      if (kind === 'excursion' && excursion(t)) return true;
      if (kind === 'rock' && rock(t)) return true;
      if (kind === 'stealth' && stealth(t)) return true;
      if (kind === 'vault' || kind === 'thief') {
        const text =
          kind === 'vault'
            ? 'El orbe está encerrado en la bóveda. Busca la llave en las islas del cielo (sube con un trampolín)'
            : 'El orbe está encerrado en la bóveda. ¡Un enemigo tiene la llave! Salta sobre él para quitársela';
        if (!vault(t, text)) continue;
        // The key, somewhere else in the zone
        if (kind === 'vault') {
          if (!freeTiles().some((k) => sky(k, false, 'key'))) items.push({ type: 'llave', pos: new THREE.Vector3(spawn.x - 2, 0.95, spawn.z + 2) });
        } else {
          const host = freeTiles().find((k) => k.kind === 'inner') ?? freeTiles()[0];
          const before = enemies.enemies.length;
          const pos = host ? new THREE.Vector3(host.cx, host.y, host.cz) : new THREE.Vector3(spawn.x + 2, 0, spawn.z);
          theme.walker(enemies, `carrier_${enemyN++}`, pos, 'x', 3.4);
          const carrier = enemies.enemies[before];
          if (carrier) puzzles.carriers.push(makeCarrier(carrier, puzzles));
          else items.push({ type: 'llave', pos: pos.clone().add(new THREE.Vector3(0, 0.95, 0)) });
          if (host) {
            host.used = true;
            host.rects.push(rectAt(host.cx, host.cz, 4.6, 1.2));
          }
        }
        return true;
      }
    }
    return false;
  };
  for (const kind of plan) {
    if (tryFeature(kind)) continue;
    // Fallbacks keep the orb count
    if (!tryFeature('tower') && !tryFeature('sky')) tryFeature('excursion');
  }

  // ======================================================================
  // 4. THE FORTRESS: shield → tangled spiral climb → summit
  // ======================================================================
  const R = 7.5;
  // Ring wall around the abyss with the gate on the south side
  const wallTop = 2.5;
  const wallH = wallTop - BOTTOM;
  kit.addPlatform('fort_wall_n', 0, wallTop, 10.5, 22, 1, wallH, wallBuilder).solid = true;
  kit.addPlatform('fort_wall_e', 10.5, wallTop, 0, 1, 20, wallH, wallBuilder).solid = true;
  kit.addPlatform('fort_wall_w', -10.5, wallTop, 0, 1, 20, wallH, wallBuilder).solid = true;
  kit.addPlatform('fort_wall_sw', -6.25, wallTop, -10.5, 9.5, 1, wallH, wallBuilder).solid = true;
  kit.addPlatform('fort_wall_se', 6.25, wallTop, -10.5, 9.5, 1, wallH, wallBuilder).solid = true;
  kit.addPlatform('gate_bridge', 0, 0, -10.5, 3, 1, 0.6, theme.bridge);
  kit.addPlatform('fort_entry', 0, 0, -R, 5, 5, 2.5, theme.big);
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 10), stoneMat);
    pillar.position.set(s * 1.9, 2.1, -11.2);
    root.add(pillar);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: accent }));
    flame.position.set(s * 1.9, 4.4, -11.2);
    root.add(flame);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.22, 8, 24, Math.PI), capMat);
  arch.position.set(0, 4.2, -11.2);
  root.add(arch);
  kit.addCheckpoint(2, 'Puerta de la Fortaleza', new THREE.Vector3(1.5, 0, -9.0), new THREE.Vector3(-0.8, 0.2, -7.3));
  hint(new THREE.Vector3(0, 0, -R), 3, '¡La última parte! Sube por la espiral alrededor de la torre hasta la cima. Si caes, vuelves al último santuario');

  const rounds = level >= 20 ? 3 : 2;
  const legsN = rounds * 4;
  const DELTA = 1.8;
  const CORNERS = [
    [R, -R],
    [R, R],
    [-R, R],
    [-R, -R],
  ];
  type Pattern = 'hops' | 'crumble' | 'movers' | 'narrow' | 'elevator';
  const patterns: [Pattern, number][] = [
    ['hops', 2],
    ['crumble', 0.5 + diff * 1.5],
    ['movers', 0.8 + diff],
    ['narrow', 0.4 + diff * 1.2],
    ['elevator', 0.4 + diff],
  ];
  const pickPattern = (avoid: Pattern | null): Pattern => {
    const tot = patterns.reduce((a, [, w]) => a + w, 0);
    for (let tries = 0; tries < 6; tries++) {
      let x = rng() * tot;
      for (const [p, w] of patterns) {
        x -= w;
        if (x <= 0) {
          if (p !== avoid) return p;
          break;
        }
      }
    }
    return 'hops';
  };
  const climbIds = ['tile_2_1', 'gate_bridge', 'fort_entry'];
  let from = { x: 0, z: -R, top: 0, half: 2.5 };
  let lastPattern: Pattern | null = null;
  let cpId = 3;
  for (let k = 0; k < legsN; k++) {
    const [cxk, czk] = CORNERS[k % 4];
    const big = k % 4 === 3;
    const isLast = k === legsN - 1;
    const legRise = k === 0 ? DELTA / 2 : DELTA;
    const to = { x: cxk, z: czk, top: from.top + legRise, half: big ? 2.25 : 1.75 };
    const axis: 'x' | 'z' = Math.abs(to.x - from.x) > 0.1 ? 'x' : 'z';
    const dir = Math.sign(axis === 'x' ? to.x - from.x : to.z - from.z);
    const radial: 'x' | 'z' = axis === 'x' ? 'z' : 'x';
    const dist = Math.abs(axis === 'x' ? to.x - from.x : to.z - from.z);
    const L = dist - from.half - to.half;
    const pattern: Pattern = k === 0 ? 'hops' : pickPattern(lastPattern);
    lastPattern = pattern;
    let m: number;
    let s: number;
    if (L < 6) [m, s] = [1, 2.0];
    else if (pattern === 'movers') [m, s] = [2, 3.0];
    else if (pattern === 'narrow') [m, s] = [4, 1.4];
    else [m, s] = [3, 2.6];
    const gap = (L - m * s) / (m + 1);
    const startAlong = (axis === 'x' ? from.x : from.z) + dir * from.half;
    for (let i = 0; i < m; i++) {
      const along = startAlong + dir * (gap * (i + 1) + s * i + s / 2);
      const x = axis === 'x' ? along : from.x;
      const z = axis === 'x' ? from.z : along;
      const top = from.top + (legRise * (i + 1)) / (m + 1);
      const p = kit.addPlatform(`climb_${k}_${i}`, x, top, z, s, s, 0.6, pick(padBuilders));
      climbIds.push(p.id);
      if (pattern === 'crumble') kit.makeCrumbling(p);
      else if (pattern === 'movers') kit.makeMoving(p, radial, 0.9, 0.6 + 0.4 * diff, rng() * 6);
      else if (pattern === 'elevator' && i === 1) kit.makeMoving(p, 'y', 0.9, 0.8, rng() * 6);
      if (i === Math.floor(m / 2) && rng() < 0.4) collectible(x, top, z, true);
    }
    if (m >= 2 && rng() < 0.25 + 0.35 * diff) {
      const mid = startAlong + dir * (L / 2);
      const pos = new THREE.Vector3(axis === 'x' ? mid : from.x, from.top + legRise / 2 + 1.3, axis === 'x' ? from.z : mid);
      theme.flyer(enemies, `f${enemyN++}`, pos, radial, 1.2);
    }
    const corner = kit.addPlatform(`climb_${k}_corner`, to.x, to.top, to.z, to.half * 2, to.half * 2, 0.8, pick(padBuilders));
    climbIds.push(corner.id);
    if (big && !isLast) {
      // Shrine on the way up: falling brings you back here
      kit.addCheckpoint(cpId, cpNames[cpId % cpNames.length] ?? 'Santuario', new THREE.Vector3(to.x - 1.2, to.top, to.z - 1.2), new THREE.Vector3(to.x + 0.7, to.top + 0.2, to.z + 0.7));
      cpId++;
      if (diff > 0.3 && rng() < 0.6) extra('shooter', new THREE.Vector3(to.x + 1.4, to.top, to.z - 1.4), 'x', 0);
    } else if (!isLast && rng() < 0.15 + 0.35 * diff) {
      extra('diver', new THREE.Vector3(to.x, to.top, to.z), 'x', 1.2);
    }
    from = to;
  }

  // Tower core and the summit on top
  const summitTop = from.top + 1.0;
  const plazaH = 1.5;
  const coreTop = summitTop - plazaH;
  kit.addPlatform('core', 0, coreTop, 0, 5, 5, coreTop + 14, wallBuilder).solid = true;
  kit.addPlatform('summit', 0, summitTop, 0, 9, 9, plazaH, theme.big);
  climbIds.push('summit');
  routes.push({ name: 'fortaleza', ids: climbIds });
  theme.prop(-3, summitTop, 3, rng());
  theme.prop(3, summitTop, 3, rng());
  kit.addCollectible('g_master', 'sun_crystal', 0, summitTop + 1.4, 2);
  if (diff > 0.15) theme.walker(enemies, `w${enemyN++}`, new THREE.Vector3(0, summitTop, -2.5), 'x', 2.2);

  // Magic shield over the whole fortress until every orb is found
  const shieldTop = summitTop + 8;
  const shieldBottom = -14;
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 3),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  shieldMesh.add(
    new THREE.Mesh(new THREE.IcosahedronGeometry(1.004, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.22, depthWrite: false }))
  );
  shieldMesh.position.set(0, summitTop / 2, 0);
  shieldMesh.scale.set(13, summitTop / 2 + 7, 13);
  root.add(shieldMesh);
  const shieldPlat: PlatformItem = {
    id: 'summit_shield',
    type: 'static',
    position: new THREE.Vector3(0, shieldTop, 0),
    size: new THREE.Vector3(22, shieldTop - shieldBottom, 22),
    mesh: shieldMesh,
    solid: true,
  };
  kit.platforms.push(shieldPlat);
  const summitBeam = new THREE.Group();
  summitBeam.position.set(0, summitTop, 0);
  summitBeam.add(makeBeam(0xfde68a, 80, 0.7, 3));
  root.add(summitBeam);
  puzzles.summit = {
    shield: shieldPlat,
    shieldY: shieldTop,
    shieldMesh,
    beam: summitBeam,
    active: false,
    fade: 0,
    openText: '¡Todos los orbes reunidos! El escudo de la fortaleza se rompió: entra por la puerta y sube la espiral hasta la cima',
  };

  // ======================================================================
  // 5. LIFE IN THE ZONE: spawn, enemies, treats, props
  // ======================================================================
  hint(spawn, 5, `¡Explora la zona! Encuentra los ${puzzles.orbs.length} orbes (sigue los rayos de luz). Con todos, se rompe el escudo de la fortaleza del centro`);

  /** A free spot on a tile (away from stairs, features and the spawn path). */
  const freeSpot = (t: Tile, radius: number): THREE.Vector3 | null => {
    for (let k = 0; k < 10; k++) {
      const x = t.cx + (rng() - 0.5) * (T - 2 * radius - 1);
      const z = t.cz + (rng() - 0.5) * (T - 2 * radius - 1);
      const r = rectAt(x, z, radius, radius);
      if (t.rects.some((q) => rectHit(q, r))) continue;
      const blocked = kit.platforms.some(
        (q) => q !== t.plat && q.position.y > t.y && q.position.y - q.size.y < t.y + 2.5 && Math.abs(q.position.x - x) < q.size.x / 2 + radius && Math.abs(q.position.z - z) < q.size.z / 2 + radius
      );
      if (blocked) continue;
      t.rects.push(r);
      return new THREE.Vector3(x, t.y, z);
    }
    return null;
  };
  // Patrols on free tiles
  const nWalkers = 2 + Math.round(diff * 6);
  let placed = 0;
  for (const t of shuffle(nonFort().filter((t) => !t.used && !isSpawnTile(t)))) {
    if (placed >= nWalkers) break;
    const p = freeSpot(t, 2.2);
    if (!p) continue;
    walker(p, rng() < 0.5 ? 'x' : 'z', 1.6);
    placed++;
  }
  // Flyers over some staircases, turrets on the highest ground
  stairs.forEach((st) => {
    if (rng() > 0.2 + 0.4 * diff) return;
    const mid = st.edge - st.dir * 3;
    const pos = new THREE.Vector3(st.axis === 'x' ? mid : st.lat, st.low.y + 2.8, st.axis === 'x' ? st.lat : mid);
    theme.flyer(enemies, `f${enemyN++}`, pos, st.axis === 'x' ? 'z' : 'x', 1.2);
  });
  for (const t of nonFort().filter((t) => t.level === 2 && !t.used)) {
    if (rng() > 0.6) continue;
    const p = freeSpot(t, 1);
    if (p) extra('shooter', p, 'x', 0);
  }
  // Treats and collectibles
  const treatTiles = shuffle(nonFort().filter((t) => !t.used));
  (['baya', 'baya', 'nuez', 'baya', 'nuez'] as const).forEach((type, k) => {
    const t = treatTiles[k % Math.max(1, treatTiles.length)];
    const p = t && freeSpot(t, 0.8);
    if (p) items.push({ type, pos: p.add(new THREE.Vector3(0, 0.95, 0)) });
  });
  for (const t of shuffle(nonFort())) {
    if (collectN >= 24) break;
    const p = freeSpot(t, 0.6);
    if (p) collectible(p.x, p.y, p.z, rng() < 0.6);
  }
  // Decor
  for (const t of nonFort()) {
    const n = t.used ? 1 : 2;
    for (let k = 0; k < n; k++) {
      if (rng() < 0.35) continue;
      const p = freeSpot(t, 1.3);
      if (p) theme.prop(p.x, p.y, p.z, rng());
    }
  }

  // ---------------- Sky backdrop around the whole world ----------------
  let playR = 0;
  for (const p of kit.platforms) {
    if (p === shieldPlat) continue;
    playR = Math.max(playR, Math.hypot(p.position.x, p.position.z) + Math.max(p.size.x, p.size.z) / 2);
  }
  addOpenBackdrop(root, textures, themeId, playR + 18, kit.animators);

  const world = kit.finish(new THREE.Vector3(0, summitTop + 0.2, 0), enemies, items, new THREE.Vector3(-3, summitTop + 5, 1));
  world.levelName = `${theme.name} · Nivel ${level}`;
  world.summitName = theme.summitName;
  world.summitRequiresLanding = true;
  world.puzzles = puzzles;
  world.routes = routes;
  return world;
}

/**
 * The theme backdrops were made for a straight route along +z. Build one in its own group,
 * center it on the zone and push every solid piece out of the play area (radius playR).
 */
function addOpenBackdrop(
  root: THREE.Object3D,
  textures: ProceduralTextures,
  themeId: ThemeId,
  playR: number,
  animators: ((dt: number, time: number) => void)[]
) {
  const group = new THREE.Group();
  root.add(group);
  const bdKit = createLevelKit(group, textures);
  const pack = createThemePack(themeId, bdKit, textures);
  const zMax = 120;
  pack.backdrop(zMax);
  animators.push(...bdKit.animators);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  for (const obj of group.children) {
    if ((obj as THREE.Points).isPoints || (obj as THREE.Sprite).isSprite) continue;
    const geo = (obj as THREE.Mesh).geometry;
    if (geo && geo.type === 'PlaneGeometry') {
      // Water / ground sheets: lower them under the deepest floors and center them
      obj.position.set(0, -6.5, 0);
      obj.scale.set(1.8, 1.8, 1);
      continue;
    }
    obj.position.z -= zMax / 2;
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    if (box.isEmpty()) continue;
    box.getSize(size);
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const rad = Math.max(size.x, size.z) / 2;
    const dist = Math.hypot(cx, cz);
    const need = playR + rad;
    if (dist < need) {
      const dx = dist > 0.01 ? cx / dist : 1;
      const dz = dist > 0.01 ? cz / dist : 0;
      obj.position.x += dx * need - cx;
      obj.position.z += dz * need - cz;
    }
  }
}
