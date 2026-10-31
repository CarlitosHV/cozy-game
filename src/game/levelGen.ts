/**
 * Dynamic Level Generator (levels 5 → ∞) — mini open worlds
 *
 * Every generated level is a small open world instead of a straight line:
 *  - A big central valley where you start. The summit floats above it, wrapped in a
 *    magic shield.
 *  - 3 to 4 paths branch out of the valley in different directions (east, west, north,
 *    south). Each path ends at an altar with an orb 🔮 marked by a beam of light, and a
 *    portal 🌀 that brings you back to the valley.
 *  - Paths are different: spiral towers to climb, parkour chains, descents into the
 *    depths, and puzzles (push a rock to climb a wall, fetch a key from a lower island,
 *    steal a key from an enemy, sneak past a watchtower).
 *  - From level 9 one path starts closed by a gate: its key waits at the end of another
 *    path, so you have to explore in the right order.
 *  - From level 16 there is an extra orb on top of a pillar in the valley (push the rock!).
 *  - With every orb the shield breaks and the wind current in the valley takes you up to
 *    the summit.
 * The level number is the random seed, so level N is always the same world.
 * Difficulty rises gradually up to level ~40, always within the jump limits validated for
 * the player physics (walk jump ≈ 2.5m gap at +0.6m, 2.0m at +1.2m).
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

/** How many puzzle paths a level has: 1 from level 5, 2 from 7, 3 from 12, 4 from 20. */
export function puzzleCountForLevel(level: number): number {
  if (level < 5) return 0;
  return 1 + (level >= 7 ? 1 : 0) + (level >= 12 ? 1 : 0) + (level >= 20 ? 1 : 0);
}

/** Paths leaving the valley: 3 until level 11, then 4. */
export function branchCountForLevel(level: number): number {
  return level >= 12 ? 4 : 3;
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
const ORB_NAMES = ['rosa', 'azul', 'dorado', 'verde', 'violeta'];

type Puzzle = 'rock' | 'keyDoor' | 'thief' | 'stealth';
type Explore = 'tower' | 'parkour' | 'depths';
type BranchKind = Puzzle | Explore;
const PUZZLE_ORDER: Puzzle[] = ['rock', 'keyDoor', 'thief', 'stealth'];
const EXPLORE_ORDER: Explore[] = ['tower', 'parkour', 'depths'];

/** The central valley: a square island of this size centered on the origin */
const HUB = 34;
const HALF = HUB / 2;
/** Lowest floor allowed (falling below y = -9 sends you back to the valley) */
const MIN_Y = -3.5;

type DirName = 'E' | 'W' | 'N' | 'S';
/** f = forward (away from the valley), r = lateral axis */
const DIRS: Record<DirName, { fx: number; fz: number; rx: number; rz: number }> = {
  E: { fx: 1, fz: 0, rx: 0, rz: 1 },
  W: { fx: -1, fz: 0, rx: 0, rz: -1 },
  N: { fx: 0, fz: 1, rx: -1, rz: 0 },
  S: { fx: 0, fz: -1, rx: 1, rz: 0 },
};

/** Cursor in branch-local coordinates: u = distance from the valley edge, v = lateral, a = width across, l = length along */
interface LCur {
  u: number;
  v: number;
  y: number;
  a: number;
  l: number;
}

interface Branch {
  k: number;
  dir: DirName;
  fx: number;
  fz: number;
  rx: number;
  rz: number;
  axisF: 'x' | 'z';
  axisR: 'x' | 'z';
  cur: LCur;
  n: number;
}

export function generateLevel(level: number, root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const rng = mulberry32(level * 9973 + 17);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const diff = difficultyForLevel(level);
  const kit = createLevelKit(root, textures);
  const themeId = themeForLevel(level);
  const theme = createThemePack(themeId, kit, textures);
  const accent = parseInt(THEME_INFO[themeId].accent.slice(1), 16);

  const enemies = new EnemyManager(root, textures);
  const puzzles = emptyPuzzles();
  const items: ItemSpot[] = [];
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
    if (!force && (collectN >= 24 || rng() > 0.5)) return;
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
  const extraCap = 3 + Math.round(diff * 8);
  function extra(kind: ExtraKind, pos: THREE.Vector3, axis: 'x' | 'z', range: number) {
    if (!kindsAvailable.includes(kind) || extraN >= extraCap) return false;
    spawnExtraEnemy(enemies, themeId, kind, `x${extraN++}`, pos, axis, range);
    return true;
  }
  function walker(pos: THREE.Vector3, axis: 'x' | 'z', range: number) {
    // Sometimes a chaser or a hopper takes the place of the classic walker
    const r = rng();
    if (r < 0.35 && extra('chaser', pos, axis, range)) return;
    if (r < 0.7 && extra('hopper', pos, axis, range)) return;
    theme.walker(enemies, `w${enemyN++}`, pos, axis, range);
  }

  // ---------------- Branch geometry helpers ----------------
  const wx = (b: Branch, u: number, v: number) => b.fx * (HALF + u) + b.rx * v;
  const wz = (b: Branch, u: number, v: number) => b.fz * (HALF + u) + b.rz * v;
  const vec = (b: Branch, u: number, v: number, y: number) => new THREE.Vector3(wx(b, u, v), y, wz(b, u, v));
  const sizeOf = (b: Branch, a: number, l: number) => ({ sx: Math.abs(b.fx) * l + Math.abs(b.rx) * a, sz: Math.abs(b.fz) * l + Math.abs(b.rz) * a });

  /** Adds a platform of the path and moves the cursor onto it. */
  function add(b: Branch, a: number, l: number, h: number, u: number, v: number, y: number, builder: Builder): PlatformItem {
    const { sx, sz } = sizeOf(b, a, l);
    const p = kit.addPlatform(`b${b.k}_${b.n++}`, wx(b, u, v), y, wz(b, u, v), sx, sz, h, builder);
    b.cur = { u, v, y, a, l };
    return p;
  }
  /** Adds a side platform (not part of the main path). */
  function side(b: Branch, id: string, a: number, l: number, h: number, u: number, v: number, y: number, builder: Builder): PlatformItem {
    const { sx, sz } = sizeOf(b, a, l);
    return kit.addPlatform(id, wx(b, u, v), y, wz(b, u, v), sx, sz, h, builder);
  }
  /** Where the next platform goes: always overlapping laterally, so the jump is along the path. */
  function next(b: Branch, a: number, l: number, gap: number, dy: number) {
    const c = b.cur;
    const maxShift = Math.max(0, (c.a + a) / 2 - 0.8);
    let dv = (rng() * 2 - 1) * Math.min(maxShift, 5.5);
    if (c.v + dv > 9) dv = -Math.abs(dv);
    if (c.v + dv < -9) dv = Math.abs(dv);
    return { u: c.u + c.l / 2 + gap + l / 2, v: c.v + dv, y: Math.max(MIN_Y, c.y + dy) };
  }
  const randDy = (b: Branch) => (rng() < 0.12 && b.cur.y > 1 ? -0.4 : rng() * (0.35 + 0.85 * diff));
  const randGap = (dy: number) => Math.min(dy > 0.8 ? 2.0 : 2.45, 1.1 + rng() * (0.55 + 0.85 * diff));
  const smallSize = () => Math.max(2.6, 3.5 - 0.8 * diff + (rng() - 0.5) * 0.4);

  // ---------------- Path segments ----------------
  function hopSeg(b: Branch, count = 2 + Math.floor(rng() * (1 + diff * 2))) {
    for (let i = 0; i < count; i++) {
      const prev = { ...b.cur };
      const s = smallSize();
      const dy = randDy(b);
      const p = next(b, s, s, randGap(dy), dy);
      add(b, s, s, 0.8, p.u, p.v, p.y, pick(theme.small));
      const w = vec(b, p.u, p.v, p.y);
      collectible(w.x, w.y, w.z);
      if (i === count - 1 && rng() < 0.25 + 0.4 * diff) extra('diver', w.clone(), b.axisR, 1.6);
      if (i > 0 && rng() < 0.12 + 0.35 * diff && enemyN < 4 + diff * 8) {
        const mid = vec(b, (prev.u + p.u) / 2, (prev.v + p.v) / 2 + (rng() < 0.5 ? -1.5 : 1.5), Math.max(prev.y, p.y) + 1.1);
        theme.flyer(enemies, `f${enemyN++}`, mid, b.axisR, 1.8 + diff);
      }
    }
  }
  function bridgeSeg(b: Branch) {
    const len = 7 + rng() * 2;
    const dy = Math.min(0.3, randDy(b));
    const p = next(b, 2.6, len, 1.3, dy);
    add(b, 2.6, len, 0.4, p.u, p.v, p.y, theme.bridge);
    const w = vec(b, p.u, p.v, p.y);
    collectible(w.x, w.y, w.z, true);
  }
  function moverSeg(b: Branch) {
    const dy = Math.min(0.6, randDy(b));
    const p = next(b, 3.6, 3.6, Math.min(2.2, randGap(dy)), dy);
    const plat = add(b, 3.6, 3.6, 0.6, p.u, p.v, p.y, theme.mover);
    kit.makeMoving(plat, b.axisR, 1.4 + rng() * (0.6 + diff), 0.65 + 0.35 * diff, rng() * 6);
  }
  function crumbleSeg(b: Branch) {
    const s = smallSize();
    const dy = Math.min(0.6, randDy(b));
    const p = next(b, s, s, randGap(dy), dy);
    const plat = add(b, s, s, 0.5, p.u, p.v, p.y, pick(theme.small));
    kit.makeCrumbling(plat);
    const w = vec(b, p.u, p.v, p.y);
    collectible(w.x, w.y, w.z);
  }
  function elevatorSeg(b: Branch) {
    const p = next(b, 3.5, 3.5, 1.3, 0.5);
    const plat = add(b, 3.5, 3.5, 0.5, p.u, p.v, p.y, theme.deck);
    kit.makeMoving(plat, 'y', 1.0, 0.8, rng() * 6);
    // Next jump measured from the lowest point of the elevator, staying reachable from the top
    b.cur = { ...b.cur, y: p.y - 0.4 };
  }
  function bounceSeg(b: Branch) {
    // Island + trampoline → high deck 6m ahead and 2.8m up (validated layout)
    const dy = Math.min(0.6, randDy(b));
    const p = next(b, 5, 5, Math.min(1.8, randGap(dy)), dy);
    add(b, 5, 5, 1.5, p.u, p.v, p.y, theme.big);
    const t = vec(b, p.u, p.v, p.y);
    kit.addBouncy(`tramp_${b.k}_${b.n}`, theme.trampoline(), t.x, t.y, t.z);
    const c = vec(b, p.u + 2.2, p.v, p.y + 4.4);
    kit.addCollectible(`g${collectN++}`, 'sun_crystal', c.x, c.y, c.z);
    add(b, 6, 6, 0.6, p.u + 6, p.v, p.y + 2.8, theme.deck);
    if (rng() < 0.3 + 0.5 * diff) walker(vec(b, b.cur.u, b.cur.v + (rng() < 0.5 ? -1.9 : 1.9), b.cur.y), b.axisF, 1.7);
  }
  function updraftSeg(b: Branch) {
    // Pad + updraft → glide pad (+5.5, +5.6y) → landing (+11.5, +7.4y). The wind blows north (+z) only.
    if (b.dir !== 'N') return bounceSeg(b);
    const dy = Math.min(0.6, randDy(b));
    const p = next(b, 5, 5, Math.min(1.8, randGap(dy)), dy);
    add(b, 5, 5, 1.5, p.u, p.v, p.y, theme.launchPad);
    const t = vec(b, p.u, p.v, p.y);
    kit.addUpdraft(`updraft_${b.k}_${b.n}`, t.x, t.y, t.z, 15, 4.6, theme.updraftTint);
    add(b, 4.8, 4.8, 0.5, p.u + 5.5, p.v, p.y + 5.6, theme.deck);
    const g = vec(b, b.cur.u, b.cur.v, b.cur.y);
    collectible(g.x, g.y, g.z, true);
    add(b, 8, 6, 2, p.u + 11.5, p.v, p.y + 7.4, theme.big);
  }
  /** Spiral tower: pads circling an axis, each one higher. n = 3 (half turn) or 7 (turn and a half). */
  function spiralSeg(b: Branch, n: 3 | 7) {
    const R = 3.3;
    const spin = rng() < 0.5 ? 1 : -1;
    const first = next(b, 2.8, 2.8, 1.4, 0.6);
    const cu = first.u + R;
    const cv = first.v;
    const step = 0.85 + 0.25 * diff;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + spin * i * (Math.PI / 2);
      add(b, 2.8, 2.8, 0.6, cu + Math.cos(a) * R, cv + Math.sin(a) * R, first.y + i * step, pick(theme.small));
    }
    // The last pad is always the front one (u = cu + R), so the path continues forward
    const top = vec(b, b.cur.u, b.cur.v, b.cur.y);
    collectible(top.x, top.y, top.z, true);
    const colH = (n - 1) * step + 3;
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, colH, 10),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 })
    );
    const cpos = vec(b, cu, cv, first.y + colH / 2 - 2);
    col.position.copy(cpos);
    root.add(col);
    if (rng() < 0.3 + 0.4 * diff) extra('diver', vec(b, cu, cv, b.cur.y), 'x', 1.4);
  }
  /** Staircase of floating pads going down. */
  function descentSeg(b: Branch, steps: number) {
    for (let i = 0; i < steps && b.cur.y > MIN_Y + 0.5; i++) {
      const drop = Math.min(b.cur.y - MIN_Y, 0.9 + rng() * 0.8);
      const p = next(b, 3.6, 3.6, 1.6 + rng() * 0.8, -drop);
      add(b, 3.6, 3.6, 0.8, p.u, p.v, p.y, pick(theme.small));
      const w = vec(b, p.u, p.v, p.y);
      collectible(w.x, w.y, w.z);
    }
  }

  // ---------------- Puzzle segments ----------------
  /** Wide plaza where a puzzle happens (no props on it so nothing blocks the rock). */
  function puzzleHub(b: Branch) {
    const dy = Math.min(0.6, randDy(b));
    const p = next(b, 12, 10, Math.min(1.8, randGap(dy)), dy);
    add(b, 12, 10, 2.5, p.u, p.v, p.y, theme.big);
    return p;
  }
  /** Narrow bridge with a locked gate in the middle and stone walls on both sides. */
  function gateBridge(b: Branch) {
    const len = 10;
    const p = next(b, 2.6, len, 1.3, 0);
    add(b, 2.6, len, 0.4, p.u, p.v, p.y, theme.bridge);
    const c = vec(b, p.u, p.v, p.y);
    const gate = makeDoor(root, `door_${b.k}_${b.n}`, c.x, p.y, c.z, 3.4, accent, b.axisF === 'x');
    kit.platforms.push(gate.plat);
    puzzles.doors.push(gate.door);
    for (const s of [-1, 1]) {
      side(b, `gatewall_${b.k}_${b.n}_${s}`, 5.2, 0.9, DOOR_H + 3, p.u, p.v + s * (1.7 + 2.6), p.y + DOOR_H, wallBuilder).solid = true;
    }
    const w = vec(b, p.u + len / 2 - 1.2, p.v, p.y);
    collectible(w.x, w.y, w.z, true);
    return p;
  }
  /** A rock on a plaza and a wall too high to jump: push the rock to the wall and climb. The ledge becomes the altar. */
  function rockSeg(b: Branch) {
    const h = puzzleHub(b);
    const wallH = 3.2;
    const bp = vec(b, h.u - 1, h.v + (rng() - 0.5) * 5, h.y);
    const rock = makePushBlock(root, `block_${b.k}_${b.n}`, bp.x, h.y, bp.z, stoneMat, accent);
    kit.platforms.push(rock.plat);
    puzzles.blocks.push(rock.block);
    hint(vec(b, h.u - 3, h.v, h.y), 5.5, '🪨 Empuja la roca contra el muro (camina hacia ella) y súbete encima para trepar');
    add(b, 12, 7, wallH + 0.8, h.u + 5 + 3.5, h.v, h.y + wallH, wallBuilder).solid = true;
  }
  /** The key waits on a lower island to the side: drop down, take it, bounce back with the trampoline. */
  function keyDoorSeg(b: Branch) {
    const h = puzzleHub(b);
    const s = h.v > 0 ? -1 : 1;
    const iu = h.u + (rng() - 0.5) * 3;
    const iv = h.v + s * 9;
    const iy = h.y - 2.8;
    side(b, `keyisle_${b.k}_${b.n}`, 5, 5, 1.5, iu, iv, iy, theme.big);
    const t = vec(b, iu, iv, iy);
    kit.addBouncy(`keytramp_${b.k}_${b.n}`, theme.trampoline(), t.x, t.y, t.z);
    items.push({ type: 'llave', pos: vec(b, iu + 1.6, iv + s * 1.6, iy + 0.95) });
    hint(vec(b, h.u - 3, h.v, h.y), 5.5, '🔑 Hay una puerta cerrada más adelante… la llave está en una isla más abajo. ¡Vuelve con el trampolín!');
    if (diff > 0.3 && rng() < 0.6) theme.flyer(enemies, `f${enemyN++}`, vec(b, iu, (h.v + iv) / 2, h.y + 0.8), b.axisF, 1.6);
    gateBridge(b);
  }
  /** An enemy carries the key over the plaza: stomp on it to make it drop the key. */
  function thiefSeg(b: Branch) {
    const h = puzzleHub(b);
    const before = enemies.enemies.length;
    theme.walker(enemies, `carrier_${enemyN++}`, vec(b, h.u + 1, h.v, h.y), b.axisR, 3.6);
    const carrierEnemy = enemies.enemies[before];
    if (carrierEnemy) puzzles.carriers.push(makeCarrier(carrierEnemy, puzzles));
    else items.push({ type: 'llave', pos: vec(b, h.u + 1, h.v, h.y + 0.95) });
    hint(vec(b, h.u - 3, h.v, h.y), 6, '🔑 ¡Ese bicho tiene la llave! Salta sobre su cabeza para quitársela');
    gateBridge(b);
  }
  /** Watchtower zone: sneak behind the walls while its light looks the other way. */
  function stealthSeg(b: Branch) {
    const W = 12;
    const D = 18;
    const dy = Math.min(0.6, randDy(b));
    const p = next(b, W, D, Math.min(1.8, randGap(dy)), dy);
    add(b, W, D, 2.5, p.u, p.v, p.y, theme.big);
    const su = p.u + D / 2 - 1.5;
    const sp = vec(b, su, p.v, p.y);
    const s = rng() < 0.5 ? 1 : -1;
    const covers: CoverBox[] = [];
    [9.5, 6.5, 3.5].forEach((dist, i) => {
      const cu = su - dist;
      const cv = p.v + (i % 2 === 0 ? s : -s) * 2.6;
      side(b, `cover_${b.k}_${i}`, 3.4, 0.8, 2.8, cu, cv, p.y + 2.6, wallBuilder).solid = true;
      const c = vec(b, cu, cv, 0);
      const { sx, sz } = sizeOf(b, 3.4, 0.8);
      covers.push({ minX: c.x - sx / 2, maxX: c.x + sx / 2, minZ: c.z - sz / 2, maxZ: c.z + sz / 2 });
    });
    const zc = vec(b, p.u, p.v, p.y);
    const zs = sizeOf(b, W, D);
    const entrance = vec(b, p.u - D / 2 + 1.2, p.v, p.y + 0.2);
    const sentinel = makeSentinel(
      root,
      sp.x,
      p.y,
      sp.z,
      Math.atan2(-b.fx, -b.fz),
      { minX: zc.x - zs.sx / 2, maxX: zc.x + zs.sx / 2, minZ: zc.z - zs.sz / 2, maxZ: zc.z + zs.sz / 2, y: p.y },
      entrance,
      covers,
      accent
    );
    puzzles.sentinels.push(sentinel);
    kit.registerCylinder(`sentinel_${b.k}`, sp.x, p.y, sp.z, 0.8, 2.8);
    hint(entrance, 7, '👁️ ¡Un vigía! Si su luz te ve, vuelves al inicio de la zona. Escóndete tras los muros y avanza cuando mire a otro lado');
    const c = vec(b, su - 0.5, p.v + s * 4.5, p.y);
    collectible(c.x, c.y, c.z, true);
  }

  // ---------------- The valley ----------------
  const spawn = new THREE.Vector3(0, 0.2, -13);
  kit.addPlatform('hub', 0, 0, 0, HUB, HUB, 3, theme.big);
  kit.addCheckpoint(1, cpNames[0] ?? 'Valle', new THREE.Vector3(3.6, 0, -14.6), spawn.clone(), true);

  // Summit floating above the valley (pad + wind current → plaza 10m ahead, 8.5m up: validated layout)
  const pad = new THREE.Vector3(0, 0.4, -6);
  kit.addPlatform('summit_pad', pad.x, pad.y, pad.z, 5, 5, 1.5, theme.launchPad).solid = true;
  kit.addUpdraft('summit_updraft', pad.x, pad.y, pad.z, 13, 4.2, theme.updraftTint);
  const summitUpdraft = kit.platforms.pop()!; // stays dormant until every orb is found
  const sx = pad.x;
  const sy = pad.y + 8.5;
  const sz = pad.z + 10;
  kit.addPlatform('summit', sx, sy, sz, 16, 14, 3, theme.big);
  theme.prop(sx - 6, sy, sz + 4.5, rng());
  theme.prop(sx + 6, sy, sz + 4.5, rng());
  kit.addPlatform('summit_step', sx + 4.5, sy + 1.1, sz + 3, 2.2, 2.2, 1.1, theme.deck).solid = true;
  kit.addCollectible(`g_master`, 'sun_crystal', sx + 4.5, sy + 2.4, sz + 3);
  if (diff > 0.15) theme.walker(enemies, `w${enemyN++}`, new THREE.Vector3(sx, sy, sz + 5.5), 'x', 3);
  extra('hopper', new THREE.Vector3(sx - 4, sy, sz + 4), 'x', 2);

  // Magic shield around the summit (solid while locked)
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  const shieldWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.005, 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false })
  );
  shieldMesh.add(shieldWire);
  shieldMesh.position.set(sx, sy + 1, sz);
  shieldMesh.scale.set(11.5, 7, 10.5);
  root.add(shieldMesh);
  const shieldPlat: PlatformItem = {
    id: 'summit_shield',
    type: 'static',
    position: new THREE.Vector3(sx, sy + 7, sz),
    size: new THREE.Vector3(18, 10, 16),
    mesh: shieldMesh,
    solid: true,
  };
  kit.platforms.push(shieldPlat);
  const summitBeam = new THREE.Group();
  summitBeam.position.set(sx, sy, sz);
  summitBeam.add(makeBeam(0xfde68a, 80, 0.7, 3));
  root.add(summitBeam);
  puzzles.summit = { updraft: summitUpdraft, shield: shieldPlat, shieldY: sy + 7, shieldMesh, beam: summitBeam, active: false, fade: 0 };

  // ---------------- Plan the paths ----------------
  const nBranches = branchCountForLevel(level);
  const dirs = (['E', 'W', 'N', 'S'] as DirName[]).sort(() => rng() - 0.5).slice(0, nBranches);
  const nPuzzle = Math.min(nBranches, puzzleCountForLevel(level));
  const kinds: BranchKind[] = [];
  for (let i = 0; i < nPuzzle; i++) kinds.push(PUZZLE_ORDER[(level + i) % PUZZLE_ORDER.length]);
  for (let i = nPuzzle; i < nBranches; i++) kinds.push(EXPLORE_ORDER[(level + i) % EXPLORE_ORDER.length]);
  kinds.sort(() => rng() - 0.5);
  // From level 9 one path is locked: its key waits at the altar of another path
  const locked = level >= 9 ? 1 + Math.floor(rng() * (nBranches - 1)) : -1;
  const keyHolder = locked >= 0 ? (locked + 1 + Math.floor(rng() * (nBranches - 1))) % nBranches : -1;
  const perch = level >= 16;
  const nOrbs = nBranches + (perch ? 1 : 0);

  // Orb sockets around the summit pad: they light up as you find the orbs
  const sockets: THREE.Mesh[] = [];
  for (let i = 0; i < nOrbs; i++) {
    const a = (i / nOrbs) * Math.PI * 2 + Math.PI / nOrbs;
    const px = pad.x + Math.sin(a) * 3.8;
    const pz = pad.z + Math.cos(a) * 3.8;
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

  // ---------------- Build every path ----------------
  const entrances: THREE.Vector3[] = [];
  let orbIdx = 0;
  dirs.forEach((dir, k) => {
    const d = DIRS[dir];
    const v0 = (rng() * 2 - 1) * 5;
    const b: Branch = {
      k,
      dir,
      ...d,
      axisF: d.fx !== 0 ? 'x' : 'z',
      axisR: d.rx !== 0 ? 'x' : 'z',
      cur: { u: -1, v: v0, y: 0, a: 8, l: 2 },
      n: 0,
    };
    entrances.push(vec(b, -2, v0, 0));
    const kind = kinds[k];

    if (k === locked) {
      gateBridge(b);
      hint(vec(b, -2, v0, 0), 5, '🔒 Este camino está cerrado. La llave 🔑 está al final de otro camino: ¡explora!');
    }
    // A short warm-up out of the valley
    const intro = 1 + (rng() < 0.3 + 0.5 * diff ? 1 : 0);
    for (let i = 0; i < intro; i++) {
      const r = rng();
      if (kind !== 'depths' && kind !== 'tower' && r < 0.22) spiralSeg(b, 3);
      else if (kind === 'depths' || r < 0.55) hopSeg(b, 2);
      else if (r < 0.7) bridgeSeg(b);
      else if (r < 0.85) moverSeg(b);
      else crumbleSeg(b);
    }

    let altarDone = false;
    switch (kind) {
      case 'tower':
        spiralSeg(b, 7);
        if (diff > 0.5) {
          hopSeg(b, 1);
          spiralSeg(b, 3);
        }
        break;
      case 'parkour': {
        const pool = ['mover', 'crumble', 'elevator', 'bounce', 'updraft', 'hop'];
        const m = 2 + Math.floor(diff * 2.5);
        let last = '';
        for (let i = 0; i < m; i++) {
          let s = pick(pool);
          if (s === last) s = 'hop';
          last = s;
          if (s === 'mover') moverSeg(b);
          else if (s === 'crumble') crumbleSeg(b);
          else if (s === 'elevator') elevatorSeg(b);
          else if (s === 'bounce') bounceSeg(b);
          else if (s === 'updraft') updraftSeg(b);
          else hopSeg(b);
        }
        break;
      }
      case 'depths':
        descentSeg(b, 3 + Math.floor(rng() * 2));
        if (rng() < 0.5) crumbleSeg(b);
        descentSeg(b, 2);
        break;
      case 'rock':
        rockSeg(b);
        altarDone = true; // the ledge on top of the wall is the altar
        break;
      case 'keyDoor':
        keyDoorSeg(b);
        break;
      case 'thief':
        thiefSeg(b);
        break;
      case 'stealth':
        stealthSeg(b);
        break;
    }

    // ---- Altar with the orb + portal back to the valley ----
    if (!altarDone) {
      const dy = kind === 'depths' ? 0 : Math.min(0.6, randDy(b));
      const p = next(b, 8, 8, Math.min(1.8, randGap(dy)), dy);
      add(b, 8, 8, 2.5, p.u, p.v, p.y, theme.big);
    }
    const c = b.cur;
    const color = ORB_COLORS[orbIdx % ORB_COLORS.length];
    const op = vec(b, c.u, c.v, c.y);
    const orb = makeOrb(root, op.x, c.y, op.z, color);
    orb.socket = sockets[orbIdx];
    puzzles.orbs.push(orb);
    orbIdx++;
    const pp = vec(b, c.u - c.l / 2 + 1.4, c.v + c.a / 2 - 1.4, c.y);
    puzzles.portals.push(makePortal(root, pp.x, c.y, pp.z, spawn, color));
    const pr = vec(b, c.u + c.l / 2 - 1.3, c.v - c.a / 2 + 1.3, c.y);
    theme.prop(pr.x, pr.y, pr.z, rng());
    if (k === keyHolder) {
      items.push({ type: 'llave', pos: vec(b, c.u + c.l / 2 - 1.6, c.v + c.a / 2 - 1.6, c.y + 0.95) });
      hint(op, 4, '🔑 ¡Una llave! Abre el camino cerrado del valle');
    }
    if (rng() < 0.45) items.push({ type: rng() < 0.75 ? 'baya' : 'nuez', pos: vec(b, c.u - c.l / 2 + 1.5, c.v - c.a / 2 + 1.5, c.y + 0.95) });
    if (kind !== 'rock' && diff > 0.3 && rng() < 0.5) walker(vec(b, c.u, c.v + c.a / 2 - 1.2, c.y), b.axisF, 2);
  });

  // ---------------- Valley decor, lookouts & perch ----------------
  const reserved: { x: number; z: number; r: number }[] = [
    { x: spawn.x, z: spawn.z, r: 4 },
    { x: 3.6, z: -14.6, r: 2.5 },
    { x: pad.x, z: pad.z, r: 5.5 },
    ...entrances.map((e) => ({ x: e.x, z: e.z, r: 6 })),
  ];
  const free = (x: number, z: number, r = 2.5) => reserved.every((q) => Math.hypot(q.x - x, q.z - z) > q.r + r);

  // Lookouts: little stairs of blocks in the south corners with treats on top
  for (const s of [-1, 1]) {
    const steps: [number, number, number][] = [
      [s * 9.8, 0.8, -13],
      [s * 12.8, 1.6, -13],
      [s * 12.8, 2.4, -10],
    ];
    steps.forEach(([x, y, z], i) => {
      kit.addPlatform(`lookout_${s}_${i}`, x, y, z, 3, 3, y + 0.6, theme.deck).solid = true;
      reserved.push({ x, z, r: 2.2 });
    });
    const [tx, ty, tz] = steps[2];
    kit.addCollectible(`g${collectN++}`, 'golden_acorn', tx, ty + 1.2, tz);
    items.push({ type: s < 0 ? 'nuez' : 'baya', pos: new THREE.Vector3(tx + s * 0.6, ty + 0.95, tz + 0.8) });
  }

  // Perch: a tall pillar in a north corner with an orb on top (push the rock to climb it)
  if (perch) {
    const s = rng() < 0.5 ? 1 : -1;
    const px = s * 13;
    const pz = 13;
    kit.addPlatform('perch', px, 3.2, pz, 4, 4, 4, wallBuilder).solid = true;
    const rock = makePushBlock(root, 'block_perch', s * 8.3, 0, pz, stoneMat, accent);
    kit.platforms.push(rock.plat);
    puzzles.blocks.push(rock.block);
    const color = ORB_COLORS[orbIdx % ORB_COLORS.length];
    const orb = makeOrb(root, px, 3.2, pz, color);
    orb.socket = sockets[orbIdx];
    puzzles.orbs.push(orb);
    orbIdx++;
    hint(new THREE.Vector3(s * 7, 0, pz), 4.5, '🔮 ¡Hay un orbe sobre el pilar! Empuja la roca hasta él para subir');
    reserved.push({ x: px, z: pz, r: 3 }, { x: s * 8.3, z: pz, r: 3 }, { x: s * 10, z: pz, r: 2.5 });
  }

  // Props (trees, shrooms, lamps…) where they don't block paths
  const propSpots: [number, number][] = [
    [-13, -4], [13, -4], [-13, 5], [13, 5], [-6, 14], [6, 14], [-13, 13], [13, 13],
    [-7, -3], [7, -3], [-9, 9], [9, 9], [0, 13], [-14, -14.5], [14, -14.5],
  ];
  for (const [x, z] of propSpots) {
    if (!free(x, z) || rng() < 0.25) continue;
    theme.prop(x, 0, z, rng());
    reserved.push({ x, z, r: 2 });
  }
  kit.addCollectible(`g${collectN++}`, 'sun_crystal', 0, 1.2, 4);
  items.push({ type: 'baya', pos: new THREE.Vector3(-4, 0.95, -10) });

  // Valley guards
  if (diff > 0.15) walker(new THREE.Vector3(-10, 0, 1), 'z', 4);
  if (diff > 0.45) walker(new THREE.Vector3(10, 0, 1), 'z', 4);

  hint(
    spawn,
    5,
    `🗺️ ¡Mundo abierto! Explora los caminos y encuentra los ${nOrbs} orbes 🔮 (sigue los rayos de luz). Con todos, se rompe el escudo de la cima`
  );

  // ---------------- Sky backdrop around the whole world ----------------
  let playR = 0;
  for (const p of kit.platforms) playR = Math.max(playR, Math.hypot(p.position.x, p.position.z) + Math.max(p.size.x, p.size.z) / 2);
  addOpenBackdrop(root, textures, themeId, playR + 18, kit.animators);

  const world = kit.finish(new THREE.Vector3(sx, sy + 0.2, sz), enemies, items, new THREE.Vector3(sx - 3, sy + 6, sz + 1));
  world.levelName = `${theme.name} · Nivel ${level}`;
  world.summitName = theme.summitName;
  world.summitRequiresLanding = true;
  world.puzzles = puzzles;
  return world;
}

/**
 * The theme backdrops were made for a straight route along +z. Build one in its own group,
 * center it on the valley and push every solid piece out of the play area (radius playR).
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
      obj.scale.set(1.6, 1.6, 1);
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
