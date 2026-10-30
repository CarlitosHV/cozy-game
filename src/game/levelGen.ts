/**
 * Dynamic Level Generator (levels 5 → ∞)
 * Builds a fresh, always-completable platforming route from "segments"
 * (hops, moving platforms, crumbling pads, elevators, bridges, trampolines, updrafts),
 * dressed with one of the 4 world themes (rotating cozy → cosmic → swamp → aero).
 * The level number is the random seed, so level N is always the same layout.
 * Difficulty rises gradually up to level ~40: bigger gaps, higher steps, smaller pads,
 * more moving/crumbling platforms and more enemies — always within the jump limits
 * validated for the player physics (walk jump ≈ 2.5m gap at +0.6m, 2.0m at +1.2m).
 *
 * Levels are not a straight line: there are spiral towers to climb, drops to descend,
 * and puzzles that appear more often as you advance:
 *  - Roca: push a rock against a high wall to climb it
 *  - Llave en la isla: drop down to a lower island for the key, bounce back up, open the gate
 *  - Ladrón de llaves: an enemy carries the key — stomp on it to steal it
 *  - Vigía: sneak past a watchtower, hiding behind walls while its light looks away
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
import { CoverBox, emptyPuzzles, makeCarrier, makeDoor, makePushBlock, makeSentinel, DOOR_H } from './puzzles';

const STONE: Record<ThemeId, number> = { cozy: 0xa08a7a, cosmic: 0x6d6a8f, swamp: 0x55604a, aero: 0x6fb7dc };

type Puzzle = 'blockClimb' | 'keyDoor' | 'stealKey' | 'stealth';
const PUZZLE_ORDER: Puzzle[] = ['blockClimb', 'keyDoor', 'stealKey', 'stealth'];

/** How many puzzles a level has: 1 from level 5, 2 from 7, 3 from 12, 4 from 20. */
export function puzzleCountForLevel(level: number): number {
  if (level < 5) return 0;
  return 1 + (level >= 7 ? 1 : 0) + (level >= 12 ? 1 : 0) + (level >= 20 ? 1 : 0);
}

/** 0 at level 5 → 1 at level 40+ */
export function difficultyForLevel(level: number): number {
  return Math.min(1, Math.max(0, (level - 5) / 35));
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

type Seg = 'hop' | 'mover' | 'crumble' | 'elevator' | 'bridge' | 'bounce' | 'updraft' | 'checkpoint' | 'spiral' | 'descent' | Puzzle;

interface Cursor {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
}

export function generateLevel(level: number, root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const rng = mulberry32(level * 9973 + 17);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const diff = difficultyForLevel(level);
  const kit = createLevelKit(root, textures);
  const theme = createThemePack(themeForLevel(level), kit, textures);

  const enemies = new EnemyManager(root, textures);
  const puzzles = emptyPuzzles();
  const themeId = themeForLevel(level);
  const accent = parseInt(THEME_INFO[themeId].accent.slice(1), 16);
  const stoneMat = new THREE.MeshStandardMaterial({ color: STONE[themeId], roughness: 0.85, flatShading: true });
  const wallBuilder: Builder = (g, w, d, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    m.position.y = -h / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }));
    cap.position.y = 0.02;
    g.add(cap);
  };
  const items: ItemSpot[] = [];
  let enemyN = 0;
  let collectN = 0;
  const cpNames = [...theme.cpNames].sort(() => rng() - 0.5);

  let cur: Cursor = { x: 0, y: 0, z: 0, w: 24, d: 20 };
  let platN = 0;

  function add(w: number, d: number, h: number, x: number, y: number, z: number, builder: Builder): PlatformItem {
    const p = kit.addPlatform(`gen_${platN++}`, x, y, z, w, d, h, builder);
    cur = { x, y, z, w, d };
    return p;
  }

  /** Where the next platform goes: x always overlaps the current one so the gap is purely along +z. */
  function next(w: number, d: number, gap: number, dy: number) {
    const maxShift = Math.max(0, (cur.w + w) / 2 - 0.8);
    let dx = (rng() * 2 - 1) * Math.min(maxShift, 5.5);
    if (cur.x + dx > 11) dx = -Math.abs(dx);
    if (cur.x + dx < -11) dx = Math.abs(dx);
    return { x: cur.x + dx, y: Math.max(0, cur.y + dy), z: cur.z + cur.d / 2 + gap + d / 2 };
  }

  const randDy = () => (rng() < 0.12 && cur.y > 1 ? -0.4 : rng() * (0.35 + 0.85 * diff));
  const randGap = (dy: number) => Math.min(dy > 0.8 ? 2.0 : 2.45, 1.1 + rng() * (0.55 + 0.85 * diff));
  const smallSize = () => Math.max(2.6, 3.5 - 0.8 * diff + (rng() - 0.5) * 0.4);

  function collectible(x: number, y: number, z: number, force = false) {
    if (!force && (collectN >= 11 || rng() > 0.55)) return;
    kit.addCollectible(`g${collectN++}`, rng() < 0.7 ? 'sun_crystal' : 'golden_acorn', x, y + 1.2, z);
  }

  // New enemy kinds unlock gradually: 2 kinds from level 5, 3 from level 9, all 4 from level 13
  const extraKinds: ExtraKind[] = (['chaser', 'hopper', 'shooter', 'diver'] as ExtraKind[]).sort(() => rng() - 0.5);
  const kindsAvailable = extraKinds.slice(0, level >= 13 ? 4 : level >= 9 ? 3 : 2);
  const has = (k: ExtraKind) => kindsAvailable.includes(k);
  const enemyTheme = themeForLevel(level);
  let extraN = 0;
  const extraCap = 2 + Math.round(diff * 7);
  function extra(kind: ExtraKind, pos: THREE.Vector3, axis: 'x' | 'z', range: number) {
    if (!has(kind) || extraN >= extraCap) return false;
    spawnExtraEnemy(enemies, enemyTheme, kind, `x${extraN++}`, pos, axis, range);
    return true;
  }

  function walkerOn(x: number, y: number, z: number, w: number, d: number, sideBias: number) {
    // Patrols along the side edge so it never blocks the straight path completely
    const side = sideBias >= 0 ? 1 : -1;
    const px = x + side * (w / 2 - 1.1);
    const pos = new THREE.Vector3(px, y, z);
    const range = Math.max(1.0, d / 2 - 1.3);
    // Sometimes a chaser or a hopper takes the place of the classic walker
    const r = rng();
    if (r < 0.35 && extra('chaser', pos, 'z', range)) return;
    if (r < 0.7 && extra('hopper', pos, 'z', range)) return;
    theme.walker(enemies, `w${enemyN++}`, pos, 'z', range);
  }

  /** Turret in a corner of a wide platform, aiming across the route. */
  function shooterOn(x: number, y: number, z: number, w: number, d: number, sideBias: number) {
    const side = sideBias >= 0 ? 1 : -1;
    extra('shooter', new THREE.Vector3(x + side * (w / 2 - 0.7), y, z + d / 2 - 0.7), 'x', 0);
  }

  // ---------------- Start ----------------
  add(24, 20, 3, 0, 0, 0, theme.big);
  kit.addCheckpoint(1, cpNames[0] ?? 'Inicio', new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(0, 0.2, 0), true);
  theme.prop(-8, 0, -6, rng());
  theme.prop(8.5, 0, -5.5, rng());
  theme.prop(-9, 0, 6, rng());
  theme.prop(9, 0, 5.5, rng());
  items.push({ type: 'baya', pos: new THREE.Vector3(-4, 0.95, 4) }, { type: 'nuez', pos: new THREE.Vector3(5, 0.95, -5) });
  kit.addCollectible(`g${collectN++}`, 'sun_crystal', 6, 1.2, 4);

  // ---------------- Plan the segments ----------------
  const nSeg = 7 + Math.floor(diff * 5) + Math.floor(rng() * 2);
  const weights: [Seg, number][] = [
    ['hop', 3],
    ['mover', 0.8 + diff],
    ['crumble', 0.3 + diff],
    ['elevator', 0.4 + diff * 0.6],
    ['bridge', 0.6],
    ['bounce', 0.8],
    ['updraft', 0.8],
    ['spiral', 0.5 + 0.4 * diff],
    ['descent', 0.6],
  ];
  const total = weights.reduce((a, [, w]) => a + w, 0);
  const plan: Seg[] = [];
  for (let i = 0; i < nSeg; i++) {
    let r = rng() * total;
    let chosen: Seg = 'hop';
    for (const [s, w] of weights) {
      r -= w;
      if (r <= 0) {
        chosen = s;
        break;
      }
    }
    // Avoid repeating the same special segment back to back
    if (chosen !== 'hop' && plan[plan.length - 1] === chosen) chosen = 'hop';
    plan.push(chosen);
  }
  if (!plan.includes('bounce') && !plan.includes('updraft')) plan[Math.floor(nSeg / 2)] = rng() < 0.5 ? 'bounce' : 'updraft';
  plan.splice(Math.floor((nSeg * 2) / 3), 0, 'checkpoint');
  plan.splice(Math.floor(nSeg / 3), 0, 'checkpoint');
  plan.unshift('hop');

  // Puzzles spread along the route (the first one changes from level to level)
  const nPuzzles = puzzleCountForLevel(level);
  const startP = level % PUZZLE_ORDER.length;
  const chosenPuzzles: Puzzle[] = [];
  for (let k = 0; k < nPuzzles; k++) chosenPuzzles.push(PUZZLE_ORDER[(startP + k) % PUZZLE_ORDER.length]);
  for (let k = nPuzzles - 1; k >= 0; k--) {
    const idx = 2 + Math.floor(((k + 0.5) * (plan.length - 2)) / nPuzzles);
    plan.splice(idx, 0, chosenPuzzles[k]);
  }

  // ---------------- Puzzle helpers ----------------
  function hint(x: number, y: number, z: number, radius: number, text: string) {
    puzzles.hints.push({ pos: new THREE.Vector3(x, y, z), radius, text, shown: false });
  }

  /** Wide hub where a puzzle happens (no props on it so nothing blocks the rock). */
  function hub(w = 12, d = 10) {
    const dy = Math.min(0.6, randDy());
    const pos = next(w, d, Math.min(1.8, randGap(dy)), dy);
    add(w, d, 2.5, pos.x, pos.y, pos.z, theme.big);
    return pos;
  }

  /** Narrow bridge with a locked gate in the middle and stone walls on both sides. */
  function gateBridge() {
    const len = 10;
    const pos = next(2.6, len, 1.3, 0);
    add(2.6, len, 0.4, pos.x, pos.y, pos.z, theme.bridge);
    const gate = makeDoor(root, `door_${platN}`, pos.x, pos.y, pos.z, 3.4, accent);
    kit.platforms.push(gate.plat);
    puzzles.doors.push(gate.door);
    for (const side of [-1, 1]) {
      kit.addPlatform(`gatewall_${platN}_${side}`, pos.x + side * (1.7 + 2.6), pos.y + DOOR_H, pos.z, 5.2, 0.9, DOOR_H + 3, wallBuilder).solid = true;
    }
    collectible(pos.x, pos.y, pos.z + len / 2 - 1.2, true);
    return pos;
  }

  let cpIndex = 2;
  for (const seg of plan) {
    switch (seg) {
      case 'hop': {
        const n = 2 + Math.floor(rng() * (2 + diff * 2));
        let prev: Cursor | null = null;
        for (let i = 0; i < n; i++) {
          const s = smallSize();
          const dy = randDy();
          const pos = next(s, s, randGap(dy), dy);
          prev = { ...cur };
          add(s, s, 0.8, pos.x, pos.y, pos.z, pick(theme.small));
          collectible(pos.x, pos.y, pos.z);
          // Dive-bomber circling above a pad
          if (i === n - 1 && rng() < 0.35 + 0.4 * diff) extra('diver', new THREE.Vector3(pos.x, pos.y, pos.z), 'x', 1.6);
          // Flying enemy hovering over the gap
          if (prev && rng() < 0.15 + 0.4 * diff && enemyN < 3 + diff * 6) {
            const mz = (prev.z + pos.z) / 2;
            theme.flyer(enemies, `f${enemyN++}`, new THREE.Vector3((prev.x + pos.x) / 2 + (rng() < 0.5 ? -1.5 : 1.5), Math.max(prev.y, pos.y) + 1.1, mz), 'x', 1.8 + diff);
          }
        }
        break;
      }
      case 'mover': {
        const dy = Math.min(0.6, randDy());
        const pos = next(3.6, 3.6, Math.min(2.2, randGap(dy)), dy);
        const p = add(3.6, 3.6, 0.6, pos.x, pos.y, pos.z, theme.mover);
        kit.makeMoving(p, 'x', 1.4 + rng() * (0.6 + diff), 0.65 + 0.35 * diff, rng() * 6);
        break;
      }
      case 'crumble': {
        const s = smallSize();
        const dy = Math.min(0.6, randDy());
        const pos = next(s, s, randGap(dy), dy);
        const p = add(s, s, 0.5, pos.x, pos.y, pos.z, pick(theme.small));
        kit.makeCrumbling(p);
        collectible(pos.x, pos.y, pos.z);
        break;
      }
      case 'elevator': {
        const pos = next(3.5, 3.5, 1.3, 0.5);
        const p = add(3.5, 3.5, 0.5, pos.x, pos.y, pos.z, theme.deck);
        kit.makeMoving(p, 'y', 1.0, 0.8, rng() * 6);
        // Next jump measured from the lowest point of the elevator, staying reachable from the top
        cur = { ...cur, y: pos.y - 0.4 };
        break;
      }
      case 'bridge': {
        const len = 7 + rng() * 2;
        const dy = Math.min(0.3, randDy());
        const pos = next(2.6, len, 1.3, dy);
        add(2.6, len, 0.4, pos.x, pos.y, pos.z, theme.bridge);
        collectible(pos.x, pos.y, pos.z, true);
        break;
      }
      case 'bounce': {
        // Island + trampoline → high deck exactly 6m ahead and 2.8m up (validated layout)
        const dy = Math.min(0.6, randDy());
        const pos = next(5, 5, Math.min(1.8, randGap(dy)), dy);
        add(5, 5, 1.5, pos.x, pos.y, pos.z, theme.big);
        kit.addBouncy(`tramp_${platN}`, theme.trampoline(), pos.x, pos.y, pos.z);
        kit.addCollectible(`g${collectN++}`, 'sun_crystal', pos.x, pos.y + 4.4, pos.z + 2.2);
        add(6, 6, 0.6, pos.x, pos.y + 2.8, pos.z + 6, theme.deck);
        if (rng() < 0.3 + 0.5 * diff) walkerOn(cur.x, cur.y, cur.z, 6, 6, rng() - 0.5);
        else if (rng() < 0.5) shooterOn(cur.x, cur.y, cur.z, 6, 6, rng() - 0.5);
        break;
      }
      case 'updraft': {
        // Pad + updraft → glide pad (+5.5z, +5.6y) → landing (+6z, +1.8y)  (validated layout)
        const dy = Math.min(0.6, randDy());
        const pos = next(5, 5, Math.min(1.8, randGap(dy)), dy);
        add(5, 5, 1.5, pos.x, pos.y, pos.z, theme.launchPad);
        kit.addUpdraft(`updraft_${platN}`, pos.x, pos.y, pos.z, 15, 4.6, theme.updraftTint);
        add(4.8, 4.8, 0.5, pos.x, pos.y + 5.6, pos.z + 5.5, theme.deck);
        collectible(cur.x, cur.y, cur.z, true);
        add(8, 6, 2, pos.x, pos.y + 7.4, pos.z + 11.5, theme.big);
        if (rng() < 0.4 + 0.4 * diff) shooterOn(cur.x, cur.y, cur.z, 8, 6, rng() - 0.5);
        theme.prop(cur.x + (cur.x > 0 ? -3 : 3), cur.y, cur.z + 1.5, rng());
        break;
      }
      case 'spiral': {
        // Spiral tower: pads circling around an invisible axis, each one higher (climb!)
        // 3 pads = half turn, 7 pads = turn and a half; the last pad is always the front one
        const n = diff > 0.2 && rng() < 0.65 ? 7 : 3;
        const R = 3.3;
        const spin = rng() < 0.5 ? 1 : -1;
        const first = next(2.8, 2.8, 1.4, 0.6);
        const cx = first.x;
        const cz = first.z + R;
        for (let i = 0; i < n; i++) {
          const a = Math.PI + spin * i * (Math.PI / 2);
          const y = first.y + i * (0.85 + 0.25 * diff);
          add(2.8, 2.8, 0.6, cx + Math.sin(a) * R, y, cz + Math.cos(a) * R, pick(theme.small));
          if (i === n - 1) collectible(cur.x, cur.y, cur.z, true);
        }
        // Glowing column in the middle of the spiral
        const colH = (n - 1) * (0.85 + 0.25 * diff) + 3;
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, colH, 10),
          new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 })
        );
        col.position.set(cx, first.y + colH / 2 - 2, cz);
        root.add(col);
        if (rng() < 0.3 + 0.4 * diff) extra('diver', new THREE.Vector3(cx, cur.y, cz), 'x', 1.4);
        break;
      }
      case 'descent': {
        // Drop down a staircase of floating pads (only when we're high enough)
        if (cur.y < 4) {
          const s = smallSize();
          const pos = next(s, s, randGap(0.8), 0.8);
          add(s, s, 0.8, pos.x, pos.y, pos.z, pick(theme.small));
          break;
        }
        const n = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < n && cur.y > 2.5; i++) {
          const s = 3.6;
          const drop = 1.3 + rng() * 1.2;
          const pos = next(s, s, 1.6 + rng() * 1.0, -drop);
          add(s, s, 0.8, pos.x, pos.y, pos.z, pick(theme.small));
          collectible(pos.x, pos.y, pos.z);
        }
        break;
      }
      case 'blockClimb': {
        // A rock on a plaza and a wall too high to jump: push the rock to the wall and climb
        const h = hub(12, 10);
        const wallH = 3.2;
        const bx = h.x + (rng() - 0.5) * 5;
        const bz = h.z - 1;
        const rock = makePushBlock(root, `block_${platN}`, bx, h.y, bz, stoneMat, accent);
        kit.platforms.push(rock.plat);
        puzzles.blocks.push(rock.block);
        hint(h.x, h.y, h.z - 3, 5.5, '🪨 Empuja la roca contra el muro (camina hacia ella) y súbete encima para trepar');
        add(12, 6, wallH + 0.8, h.x, h.y + wallH, h.z + 5 + 3, wallBuilder).solid = true;
        collectible(cur.x, cur.y, cur.z, true);
        if (rng() < 0.3 + 0.5 * diff) walkerOn(cur.x, cur.y, cur.z, 12, 6, rng() - 0.5);
        break;
      }
      case 'keyDoor': {
        // The key waits on a lower island to the side: drop down, take it, bounce back with the trampoline
        const h = hub(12, 10);
        const side = rng() < 0.5 ? 1 : -1;
        const ix = h.x + side * 9;
        const iy = h.y - 2.8;
        const iz = h.z + (rng() - 0.5) * 3;
        const isle = kit.addPlatform(`keyisle_${platN}`, ix, iy, iz, 5, 5, 1.5, theme.big);
        void isle;
        kit.addBouncy(`keytramp_${platN}`, theme.trampoline(), ix, iy, iz);
        items.push({ type: 'llave', pos: new THREE.Vector3(ix + side * 1.6, iy + 0.95, iz + 1.6) });
        theme.prop(ix + side * 1.6, iy, iz - 1.6, rng());
        hint(h.x, h.y, h.z - 3, 5.5, '🔑 La puerta está cerrada… mira abajo: la llave está en una isla. ¡Usa el trampolín para volver!');
        if (diff > 0.3 && rng() < 0.6) theme.flyer(enemies, `f${enemyN++}`, new THREE.Vector3((h.x + ix) / 2, h.y + 0.8, iz), 'z', 1.6);
        gateBridge();
        break;
      }
      case 'stealKey': {
        // An enemy carries the key over the plaza: stomp on it to make it drop the key
        const h = hub(12, 10);
        const before = enemies.enemies.length;
        theme.walker(enemies, `carrier_${enemyN++}`, new THREE.Vector3(h.x, h.y, h.z + 1), 'x', 3.6);
        const carrierEnemy = enemies.enemies[before];
        if (carrierEnemy) puzzles.carriers.push(makeCarrier(carrierEnemy, puzzles));
        else items.push({ type: 'llave', pos: new THREE.Vector3(h.x, h.y + 0.95, h.z + 1) });
        hint(h.x, h.y, h.z - 3, 6, '🔑 ¡Ese bicho tiene la llave! Salta sobre su cabeza para quitársela');
        if (diff > 0.4) walkerOn(h.x, h.y, h.z, 12, 10, rng() - 0.5);
        gateBridge();
        break;
      }
      case 'stealth': {
        // Watchtower zone: sneak behind the walls while its light looks the other way
        const W = 12;
        const D = 18;
        const dy = Math.min(0.6, randDy());
        const pos = next(W, D, Math.min(1.8, randGap(dy)), dy);
        add(W, D, 2.5, pos.x, pos.y, pos.z, theme.big);
        const sx = pos.x;
        const sz = pos.z + D / 2 - 1.5;
        const s = rng() < 0.5 ? 1 : -1;
        const covers: CoverBox[] = [];
        const rows = [9.5, 6.5, 3.5];
        rows.forEach((dist, i) => {
          const wx = sx + (i % 2 === 0 ? s : -s) * 2.6;
          const wz = sz - dist;
          kit.addPlatform(`cover_${platN}_${i}`, wx, pos.y + 2.6, wz, 3.4, 0.8, 2.8, wallBuilder).solid = true;
          covers.push({ minX: wx - 1.7, maxX: wx + 1.7, minZ: wz - 0.4, maxZ: wz + 0.4 });
        });
        const entrance = new THREE.Vector3(pos.x, pos.y + 0.2, pos.z - D / 2 + 1.2);
        const sentinel = makeSentinel(
          root,
          sx,
          pos.y,
          sz,
          Math.PI,
          { minX: pos.x - W / 2, maxX: pos.x + W / 2, minZ: pos.z - D / 2, maxZ: pos.z + D / 2, y: pos.y },
          entrance,
          covers,
          accent
        );
        puzzles.sentinels.push(sentinel);
        kit.registerCylinder(`sentinel_${platN}`, sx, pos.y, sz, 0.8, 2.8);
        hint(entrance.x, entrance.y, entrance.z, 7, '👁️ ¡Un vigía! Si su luz te ve, vuelves al inicio. Escóndete tras los muros y avanza cuando mire a otro lado');
        collectible(sx + s * 4.5, pos.y, sz - 0.5, true);
        break;
      }
      case 'checkpoint': {
        const dy = Math.min(0.6, randDy());
        const pos = next(10, 8, Math.min(1.8, randGap(dy)), dy);
        add(10, 8, 2.5, pos.x, pos.y, pos.z, theme.big);
        const shrineSide = rng() < 0.5 ? 1 : -1;
        kit.addCheckpoint(
          cpIndex,
          cpNames[cpIndex - 1] ?? `Punto ${cpIndex}`,
          new THREE.Vector3(pos.x + shrineSide * 3.3, pos.y, pos.z - 1.6),
          new THREE.Vector3(pos.x, pos.y + 0.2, pos.z + 0.5)
        );
        cpIndex++;
        theme.prop(pos.x - shrineSide * 3.6, pos.y, pos.z + 2.2, rng());
        items.push({ type: rng() < 0.75 ? 'baya' : 'nuez', pos: new THREE.Vector3(pos.x - shrineSide * 1.5, pos.y + 0.95, pos.z - 2) });
        if (rng() < 0.4 + 0.5 * diff) walkerOn(pos.x, pos.y, pos.z, 10, 8, -shrineSide);
        if (rng() < 0.5 + 0.4 * diff) shooterOn(pos.x, pos.y, pos.z, 10, 8, shrineSide);
        break;
      }
    }
  }

  // ---------------- Summit: final updraft + plaza (validated layout) ----------------
  {
    const dy = Math.min(0.6, randDy());
    const pos = next(5, 5, Math.min(1.8, randGap(dy)), dy);
    add(5, 5, 1.5, pos.x, pos.y, pos.z, theme.launchPad);
    kit.addUpdraft('summit_updraft', pos.x, pos.y, pos.z, 13, 4.2, theme.updraftTint);
    const sx = pos.x;
    const sy = pos.y + 8.5;
    const sz = pos.z + 10;
    add(16, 14, 3, sx, sy, sz, theme.big);
    theme.prop(sx - 6, sy, sz + 4.5, rng());
    theme.prop(sx + 6, sy, sz + 4.5, rng());
    kit.addPlatform('summit_step', sx + 4.5, sy + 1.1, sz + 3, 2.2, 2.2, 1.1, theme.deck);
    kit.addCollectible(`g_master`, 'sun_crystal', sx + 4.5, sy + 2.4, sz + 3);
    if (diff > 0.15) theme.walker(enemies, `w${enemyN++}`, new THREE.Vector3(sx, sy, sz + 5.5), 'x', 3);
    extra('hopper', new THREE.Vector3(sx - 4, sy, sz + 4), 'x', 2);
    theme.backdrop(sz + 30);

    const world = kit.finish(new THREE.Vector3(sx, sy + 0.2, sz), enemies, items, new THREE.Vector3(sx - 3, sy + 6, sz + 1));
    world.levelName = `${theme.name} · Nivel ${level}`;
    world.puzzles = puzzles;
    world.summitName = theme.summitName;
    return world;
  }
}
