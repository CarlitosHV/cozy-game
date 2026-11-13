/**
 * Procedural "Only Up!"-Inspired Vertical & Winding Parkour Generator
 * (levels >= 6, non-boss / non-sandbox / non-backrooms)
 *
 * Features:
 * - Strong FNV-1a + Fisher-Yates seeding keyed by (level, themeId) plus per-theme opening
 *   signatures so Level 11 (Neon) and Level 21 (Cyberpunk) never share the same architecture.
 * - 12 distinct vertical & winding set-piece modules with randomized sub-variants.
 * - Progressive length & challenge: early parkour levels (6–10) keep baseline 8-module size,
 *   scaling up to +50% longer & harder at higher levels (up to 15 modules & +180m climb)
 *   with narrower pads, multi-crumble chains, double pendulums, pinwheels, and themed enemies.
 * - Theme-adhoc structural colors & materials (pillars, gallows frames, arches, podiums).
 */
import * as THREE from 'three';
import { EnemyManager } from './enemies';
import { spawnExtraEnemy, ExtraKind } from './enemiesExtra';
import { ItemSpot } from './items';
import {
  createRollingWoolBall,
  createRotatingPinwheel,
  createSporeSteamVent,
  createSwingingObstacle,
  RollingWoolBallModel,
  RotatingPinwheelModel,
  SporeSteamVentModel,
  SwingingObstacleModel,
} from './models';
import { addOpenBackdrop, difficultyForLevel } from './levelGen';
import { createLevelKit } from './levelKit';
import { createThemePack } from './levelThemes';
import type { PlatformItem, PlatformSurfaceType, WorldBuildResult } from './levels';
import { OutdoorThemeId, RELICS, THEME_INFO, themeForLevel } from './progress';
import { ProceduralTextures } from './textures';

function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface PlacedBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

const SURFACE_BY_THEME: Record<OutdoorThemeId, { main: PlatformSurfaceType; pad: PlatformSurfaceType; deck: PlatformSurfaceType }> = {
  cozy: { main: 'grass', pad: 'stone', deck: 'wood' },
  cosmic: { main: 'stone', pad: 'crystal', deck: 'crystal' },
  swamp: { main: 'soil', pad: 'wood', deck: 'stone' },
  aero: { main: 'grass', pad: 'cloud', deck: 'cloud' },
  garden: { main: 'grass', pad: 'wood', deck: 'grass' },
  castle: { main: 'stone', pad: 'stone', deck: 'wood' },
  neon: { main: 'crystal', pad: 'crystal', deck: 'crystal' },
  cyberpunk: { main: 'stone', pad: 'stone', deck: 'stone' },
  lava: { main: 'stone', pad: 'stone', deck: 'stone' },
  ice: { main: 'crystal', pad: 'crystal', deck: 'crystal' },
  desert: { main: 'stone', pad: 'stone', deck: 'stone' },
  candy: { main: 'cloud', pad: 'cloud', deck: 'cloud' },
};

const STRUCTURE_LOOK: Record<
  OutdoorThemeId,
  { frame: number; pillar: number; trim: number; roughness: number; metalness: number }
> = {
  cozy: { frame: 0x6b4423, pillar: 0x7c6a5a, trim: 0xf59e0b, roughness: 0.78, metalness: 0.1 },
  aero: { frame: 0xe2e8f0, pillar: 0xdbeafe, trim: 0x38bdf8, roughness: 0.25, metalness: 0.25 },
  cosmic: { frame: 0x312e81, pillar: 0x1e1b4b, trim: 0xc084fc, roughness: 0.35, metalness: 0.55 },
  swamp: { frame: 0x3f2e1d, pillar: 0x365314, trim: 0x84cc16, roughness: 0.85, metalness: 0.08 },
  garden: { frame: 0xf8fafc, pillar: 0xd6d3d1, trim: 0xf472b6, roughness: 0.65, metalness: 0.1 },
  castle: { frame: 0x27272a, pillar: 0x3f3a4a, trim: 0xef4444, roughness: 0.72, metalness: 0.35 },
  neon: { frame: 0x160c2e, pillar: 0x0f0722, trim: 0xe879f9, roughness: 0.28, metalness: 0.65 },
  cyberpunk: { frame: 0x0f172a, pillar: 0x1e293b, trim: 0xfacc15, roughness: 0.4, metalness: 0.75 },
  lava: { frame: 0x1c1917, pillar: 0x292524, trim: 0xf97316, roughness: 0.75, metalness: 0.25 },
  ice: { frame: 0x7dd3fc, pillar: 0xbae6fd, trim: 0xe0f2fe, roughness: 0.18, metalness: 0.2 },
  desert: { frame: 0x92400e, pillar: 0xb45309, trim: 0xfbbf24, roughness: 0.75, metalness: 0.18 },
  candy: { frame: 0x78350f, pillar: 0xf472b6, trim: 0x6ee7b7, roughness: 0.42, metalness: 0.1 },
};

type ModuleKind =
  | 'spiral_tower'
  | 'switchback_scaffold'
  | 'beam_gauntlet'
  | 'vertical_shaft'
  | 'plunge_rebound'
  | 'risk_split'
  | 'arch_weave'
  | 'floating_cluster'
  | 'crumble_ladder'
  | 'pendulum_corridor'
  | 'kinetic_elevators'
  | 'ring_vaults';

const ALL_MODULES: ModuleKind[] = [
  'spiral_tower',
  'vertical_shaft',
  'switchback_scaffold',
  'beam_gauntlet',
  'plunge_rebound',
  'risk_split',
  'arch_weave',
  'floating_cluster',
  'crumble_ladder',
  'pendulum_corridor',
  'kinetic_elevators',
  'ring_vaults',
];

/** Curated world-opening signatures so entering a new world always feels completely fresh */
const OPENING_MODULES_BY_THEME: Record<OutdoorThemeId, ModuleKind[]> = {
  aero: ['vertical_shaft', 'ring_vaults', 'floating_cluster'],
  neon: ['ring_vaults', 'spiral_tower', 'arch_weave'],
  cyberpunk: ['pendulum_corridor', 'switchback_scaffold', 'beam_gauntlet'],
  cosmic: ['floating_cluster', 'kinetic_elevators', 'spiral_tower'],
  lava: ['crumble_ladder', 'plunge_rebound', 'pendulum_corridor'],
  ice: ['beam_gauntlet', 'kinetic_elevators', 'vertical_shaft'],
  desert: ['arch_weave', 'switchback_scaffold', 'spiral_tower'],
  candy: ['risk_split', 'ring_vaults', 'plunge_rebound'],
  swamp: ['plunge_rebound', 'crumble_ladder', 'floating_cluster'],
  castle: ['pendulum_corridor', 'spiral_tower', 'crumble_ladder'],
  cozy: ['floating_cluster', 'spiral_tower', 'switchback_scaffold'],
  garden: ['arch_weave', 'ring_vaults', 'vertical_shaft'],
};

export function generateParkourLevel(
  level: number,
  root: THREE.Object3D,
  textures: ProceduralTextures
): WorldBuildResult {
  const themeId = themeForLevel(level) as OutdoorThemeId;
  const seed = hashSeed(`parkour_v2:${level}:${themeId}`) ^ Math.imul(level, 0x9e3779b1);
  const rng = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const diff = difficultyForLevel(level);

  const kit = createLevelKit(root, textures);
  const theme = createThemePack(themeId, kit, textures);
  const accent = parseInt(THEME_INFO[themeId].accent.slice(1), 16);
  const look = STRUCTURE_LOOK[themeId];
  const surf = SURFACE_BY_THEME[themeId];
  const padBuilders = theme.small.length > 0 ? theme.small : [theme.big];

  const enemies = new EnemyManager(root, textures);
  const items: ItemSpot[] = [];
  const obstacles: SwingingObstacleModel[] = [];
  const rollingBalls: RollingWoolBallModel[] = [];
  const pinwheels: RotatingPinwheelModel[] = [];
  const steamVents: SporeSteamVentModel[] = [];
  const placedBoxes: PlacedBox[] = [];

  const turnSign = rng() < 0.5 ? 1 : -1;
  const cpNames = shuffleInPlace([...theme.cpNames], rng);
  let cpIdx = 1;
  let platN = 0;
  let collectN = 0;
  let enemyN = 0;
  let ventN = 0;
  let archN = 0;

  const moduleCount =
    level <= 10 ? 8
    : level <= 16 ? 9
    : level <= 23 ? 10
    : level <= 31 ? 11
    : level <= 40 ? 12
    : level <= 50 ? 13
    : level <= 62 ? 14
    : 15;
  const extraSteps = level >= 32 ? 2 : level >= 18 ? 1 : 0;
  const gapBoost = level <= 10 ? 0 : Math.min(0.28, ((level - 10) / 45) * 0.28);
  const padShrink = level <= 10 ? 0 : Math.min(0.32, ((level - 10) / 45) * 0.32);

  const MAX_Y = 180.0;
  const MIN_Y = -4.0;
  const clampY = (y: number) => THREE.MathUtils.clamp(y, MIN_Y, MAX_Y);

  const overlapsPlaced = (x: number, y: number, z: number, w: number, d: number, margin = 1.25): boolean => {
    const minX = x - w / 2 - margin;
    const maxX = x + w / 2 + margin;
    const minZ = z - d / 2 - margin;
    const maxZ = z + d / 2 + margin;
    for (const b of placedBoxes) {
      // Allow vertical Only-Up stacking once separated by >= 5.2m vertically
      if (Math.abs(b.y - y) >= 5.2) continue;
      if (minX < b.maxX && maxX > b.minX && minZ < b.maxZ && maxZ > b.minZ) {
        return true;
      }
    }
    return false;
  };

  const recordBox = (x: number, y: number, z: number, w: number, d: number) => {
    placedBoxes.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      y,
    });
  };

  const spawnRelic = (x: number, y: number, z: number, forceAcorn?: boolean, secondary = false, modIdx = 0) => {
    if (collectN >= RELICS.parkour) return;
    if (secondary && moduleCount >= 11 && modIdx % 2 === 1) return;
    const type = (forceAcorn ?? collectN % 2 === 1) ? 'golden_acorn' : 'sun_crystal';
    kit.addCollectible(`pk_col_${collectN++}`, type, x, y + 1.15, z);
  };

  const spawnExtra = (kind: ExtraKind, x: number, y: number, z: number, axis: 'x' | 'z', range: number) => {
    spawnExtraEnemy(enemies, themeId, kind, `pk_ex_${enemyN++}`, new THREE.Vector3(x, y, z), axis, range);
  };

  const frameMat = new THREE.MeshStandardMaterial({
    color: look.frame,
    roughness: look.roughness,
    metalness: look.metalness,
  });
  const pillarMat = new THREE.MeshStandardMaterial({
    color: look.pillar,
    roughness: look.roughness,
    metalness: look.metalness,
  });
  const trimMat = new THREE.MeshBasicMaterial({ color: look.trim });
  const archMat = new THREE.MeshStandardMaterial({
    color: look.trim,
    roughness: 0.3,
    metalness: 0.5,
    emissive: accent,
    emissiveIntensity: 0.3,
  });

  // Shared unit geometries for procedural parkour structures (reused via mesh.scale)
  const unitPostGeo = new THREE.CylinderGeometry(0.11, 0.14, 1, 8).translate(0, 0.5, 0);
  const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const unitPillarGeo = new THREE.CylinderGeometry(0.85, 1, 1, 10);
  const unitRingGeo = new THREE.TorusGeometry(1.15, 0.075, 6, 18);
  const unitArchGeo = new THREE.TorusGeometry(1, 0.05, 8, 28, Math.PI);

  const addGallowsPendulum = (x: number, y: number, z: number, span = 3.8, height = 4.6, phase = 0) => {
    const frame = new THREE.Group();
    frame.position.set(x, y, z);
    const p1 = new THREE.Mesh(unitPostGeo, frameMat);
    p1.scale.set(1, height, 1);
    p1.position.x = -span / 2;
    const p2 = new THREE.Mesh(unitPostGeo, frameMat);
    p2.scale.set(1, height, 1);
    p2.position.x = span / 2;
    const beam = new THREE.Mesh(unitBoxGeo, frameMat);
    beam.scale.set(span + 0.5, 0.24, 0.24);
    beam.position.y = height;
    const accentBar = new THREE.Mesh(unitBoxGeo, trimMat);
    accentBar.scale.set(span + 0.1, 0.06, 0.26);
    accentBar.position.y = height - 0.1;
    frame.add(p1, p2, beam, accentBar);
    kit.addDecor(frame);
    kit.registerCylinder(`pk_gal_l_${x.toFixed(1)}_${z.toFixed(1)}_${platN}`, x - span / 2, y, z, 0.2, height);
    kit.registerCylinder(`pk_gal_r_${x.toFixed(1)}_${z.toFixed(1)}_${platN}`, x + span / 2, y, z, 0.2, height);

    const speed = Math.max(1.5, 2.5 - diff * 0.45);
    const pend = createSwingingObstacle(3.0, 0.72, speed, textures);
    pend.group.position.set(x, y + height, z);
    if (phase !== 0) {
      pend.update(phase);
    }
    root.add(pend.group);
    obstacles.push(pend);
  };

  const addSupportPillar = (x: number, topY: number, z: number, height: number, radius = 0.7) => {
    const g = new THREE.Group();
    g.position.set(x, topY - height / 2, z);
    const shaft = new THREE.Mesh(unitPillarGeo, pillarMat);
    shaft.scale.set(radius, height, radius);
    const ring = new THREE.Mesh(unitRingGeo, trimMat);
    ring.scale.setScalar(radius);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height * 0.42;
    const midRing = new THREE.Mesh(unitRingGeo, trimMat);
    midRing.scale.setScalar(radius);
    midRing.rotation.x = Math.PI / 2;
    midRing.position.y = 0;
    g.add(shaft, ring, midRing);
    kit.addDecor(g);
  };

  const addSkyArch = (x: number, y: number, z: number, yaw: number, radius = 4.4) => {
    const arch = new THREE.Mesh(unitArchGeo, archMat);
    arch.scale.setScalar(radius);
    arch.position.set(x, y + 0.35, z);
    arch.rotation.y = yaw + Math.PI / 2;
    arch.name = `pk_arch_${archN++}`;
    kit.addDecor(arch);
  };

  let curX = 0;
  let curY = 0;
  let curZ = 0;
  let curYaw = turnSign * (0.2 + rng() * 0.7);
  let curW = 12.5;
  let curD = 12.5;

  const advanceCursor = (
    edgeGap: number,
    dy: number,
    nextW: number,
    nextD: number,
    deltaYaw: number
  ): { x: number; y: number; z: number; yaw: number } => {
    const effGap = edgeGap + (edgeGap >= 1.8 && edgeGap <= 2.3 ? gapBoost : 0);
    const prevHalf = Math.max(curW, curD) * 0.41;
    const nextHalf = Math.max(nextW, nextD) * 0.41;
    const stepDist = prevHalf + effGap + nextHalf;

    const tryYaw = curYaw + deltaYaw;
    const targetY = clampY(curY + dy);

    for (let attempt = 0; attempt < 14; attempt++) {
      const candidateYaw =
        tryYaw + (attempt === 0 ? 0 : (attempt % 2 === 1 ? 1 : -1) * Math.ceil(attempt / 2) * 0.34 * turnSign);
      const nx = curX + Math.sin(candidateYaw) * stepDist;
      const nz = curZ + Math.cos(candidateYaw) * stepDist;
      if (!overlapsPlaced(nx, targetY, nz, nextW, nextD, 1.2)) {
        curX = nx;
        curY = targetY;
        curZ = nz;
        curYaw = candidateYaw;
        curW = nextW;
        curD = nextD;
        return { x: curX, y: curY, z: curZ, yaw: curYaw };
      }
    }

    curYaw = tryYaw;
    curX += Math.sin(curYaw) * (stepDist + 2.2);
    curZ += Math.cos(curYaw) * (stepDist + 2.2);
    curY = targetY;
    curW = nextW;
    curD = nextD;
    return { x: curX, y: curY, z: curZ, yaw: curYaw };
  };

  const addPlat = (
    label: string,
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    builder: (g: THREE.Group, w: number, d: number, h: number) => void,
    surface: PlatformSurfaceType
  ): PlatformItem => {
    const p = kit.addPlatform(`pk_${platN++}_${label}`, x, y, z, w, d, h, builder);
    p.surface = surface;
    recordBox(x, y, z, w, d);
    return p;
  };

  const addCheckpointPlaza = (w = 8.8, dy = 1.0, deltaYaw = turnSign * 0.3) => {
    const cp = advanceCursor(2.1, dy, w, w, deltaYaw);
    addPlat(`cp_${cpIdx}`, cp.x, cp.y, cp.z, w, w, 2.0, theme.big, surf.main);
    kit.addCheckpoint(
      cpIdx++,
      cpNames[(cpIdx - 2) % cpNames.length] || `Terraza Alta ${cpIdx - 1}`,
      new THREE.Vector3(cp.x - 2.1, cp.y, cp.z - 1.9),
      new THREE.Vector3(cp.x, cp.y + 0.2, cp.z)
    );
    theme.prop(cp.x + w * 0.28, cp.y, cp.z + w * 0.26, rng());
    if (rng() < 0.7) {
      items.push({ type: rng() < 0.5 ? 'baya' : 'nuez', pos: new THREE.Vector3(cp.x + 2.0, cp.y + 0.95, cp.z - 2.0) });
    }
    return cp;
  };

  // =========================================================================
  // START SANCTUARY (CP 1)
  // =========================================================================
  addPlat('start', 0, 0, 0, 12.5, 12.5, 2.6, theme.big, surf.main);
  kit.addCheckpoint(cpIdx++, cpNames[0] || 'Base de Ascenso', new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(0, 0.2, 0), true);
  theme.prop(-4.1, 0, -3.7, rng());
  theme.prop(4.1, 0, -3.4, rng());
  spawnRelic(3.9, 0, 3.1, true);
  items.push({ type: 'baya', pos: new THREE.Vector3(-3.9, 0.95, 2.9) });

  // =========================================================================
  // SHUFFLED & PARAMETERIZED ONLY-UP MODULES (SCALING PROGRESSIVELY WITH LEVEL)
  // =========================================================================
  const buildModule = (mod: ModuleKind, modSign: number, idx: number) => {
    const hardness = Math.min(1.6, 0.9 + diff * 0.28 + idx * 0.025 + (level > 15 ? 0.08 : 0));

    if (mod === 'spiral_tower') {
      const spireAngle = curYaw + modSign * (0.4 + rng() * 0.3);
      const orbitR = 6.7 + rng() * 1.4;
      const cx = curX + Math.sin(spireAngle) * (curW * 0.45 + orbitR);
      const cz = curZ + Math.cos(spireAngle) * (curW * 0.45 + orbitR);
      const baseSpireY = curY;
      addSupportPillar(cx, baseSpireY + 14.5 + extraSteps * 1.4, cz, 24 + extraSteps * 2, 1.3);

      const startAngle = Math.atan2(curX - cx, curZ - cz);
      const steps = 8 + extraSteps + Math.floor(rng() * 2); // 8–9 early → up to 10–11 at high levels
      const sweep = Math.PI * (1.65 + rng() * 0.35 + extraSteps * 0.2);
      for (let s = 1; s <= steps; s++) {
        const theta = startAngle + modSign * (s / steps) * sweep;
        const sx = cx + Math.sin(theta) * orbitR;
        const sz = cz + Math.cos(theta) * orbitR;
        const sy = clampY(baseSpireY + s * 1.2);
        const pw = Math.max(2.55, (s % 4 === 0 ? 3.8 : 2.95 + rng() * 0.45) - padShrink * 0.6);
        if (!overlapsPlaced(sx, sy, sz, pw, pw, 0.6)) {
          const p = addPlat(`spiral_${idx}_${s}`, sx, sy, sz, pw, pw, 1.0, s % 2 === 0 ? pick(padBuilders) : theme.deck, surf.pad);
          if (s === 4) {
            kit.makeMoving(p, 'y', 1.0, 1.0 + diff * 0.25);
            spawnRelic(sx, sy + 1.0, sz, undefined, true, idx);
          } else if (s === 6 || (extraSteps >= 2 && s === 9)) {
            theme.walker(enemies, `pk_spw_${enemyN++}`, new THREE.Vector3(sx, sy, sz), 'x', 1.0);
          } else if (s === steps) {
            spawnRelic(sx, sy, sz);
          }
          curX = sx;
          curY = sy;
          curZ = sz;
          curW = pw;
          curD = pw;
          curYaw = theta + modSign * (Math.PI / 2);
        }
      }
      return;
    }

    if (mod === 'vertical_shaft') {
      const bounceYaw = modSign * (0.3 + rng() * 0.4);
      const p1 = advanceCursor(2.05, 0.9, 4.4, 4.4, bounceYaw);
      addPlat(`vshaft_bounce_${idx}`, p1.x, p1.y, p1.z, 4.4, 4.4, 1.3, theme.launchPad, surf.pad);
      kit.addBouncy(`pk_tramp_${idx}_vs`, theme.trampoline(), p1.x, p1.y, p1.z);

      const p2 = advanceCursor(2.15, 3.8, 4.6, 4.6, -modSign * 0.45);
      addPlat(`vshaft_mid_${idx}`, p2.x, p2.y, p2.z, 4.6, 4.6, 1.1, theme.deck, surf.deck);
      spawnRelic(p2.x, p2.y, p2.z);

      const p3 = advanceCursor(2.1, 0.85, 4.5, 4.5, modSign * 0.35);
      addPlat(`vshaft_up_${idx}`, p3.x, p3.y, p3.z, 4.5, 4.5, 1.3, theme.launchPad, surf.pad);
      kit.addUpdraft(`pk_up_${idx}_vs`, p3.x, p3.y, p3.z, 15.2, 4.6, theme.updraftTint);
      const guide = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.14, 8, 28), trimMat);
      guide.rotation.x = Math.PI / 2;
      guide.position.set(p3.x, p3.y + 4.6, p3.z);
      kit.addDecor(guide);

      const p4 = advanceCursor(1.95, 6.4, 5.0, 5.0, modSign * (0.55 + rng() * 0.35));
      addPlat(`vshaft_top_${idx}`, p4.x, p4.y, p4.z, 5.0, 5.0, 1.3, theme.big, surf.main);
      addSupportPillar(p4.x, p4.y - 1.3, p4.z, 10.5, 0.52);
      spawnExtra('diver', p4.x, p4.y + 3.0, p4.z, 'x', 2.0);
      spawnRelic(p4.x, p4.y, p4.z);
      return;
    }

    if (mod === 'switchback_scaffold') {
      let dir = modSign;
      const legs = 7 + extraSteps;
      for (let s = 1; s <= legs; s++) {
        const turn = s % 2 === 0 ? dir * (1.35 + rng() * 0.25) : dir * (0.28 + rng() * 0.2);
        if (s % 2 === 0) dir = -dir;
        const w = Math.max(2.5, (s === 3 ? 3.8 : 2.9 + rng() * 0.4) - padShrink * 0.6);
        const d = Math.max(2.5, (s === 3 ? 4.8 : 2.9 + rng() * 0.4) - (s === 3 ? 0 : padShrink * 0.6));
        const pos = advanceCursor(2.1, 1.2, w, d, turn);
        const builder = s === 3 ? theme.bridge : s === 5 || s === 8 ? theme.mover : pick(padBuilders);
        const pl = addPlat(`swb_${idx}_${s}`, pos.x, pos.y, pos.z, w, d, 0.95, builder, s === 3 ? surf.deck : surf.pad);
        if (s === 4 || (extraSteps >= 1 && s === 7)) {
          kit.makeCrumbling(pl);
        } else if (s === 5 || s === 8) {
          kit.makeMoving(pl, Math.abs(Math.sin(pos.yaw)) > 0.65 ? 'z' : 'x', 1.4 + diff * 0.4, 0.95 * hardness);
        }
        if (s === 3) {
          const vent = createSporeSteamVent(0.95, Math.max(1.85, 3.0 - diff * 0.5), new THREE.Vector3(pos.x, pos.y, pos.z), textures);
          root.add(vent.group);
          steamVents.push(vent);
          kit.registerCylinder(`pk_vent_${ventN++}`, pos.x, pos.y, pos.z, 0.6, 0.95);
          spawnRelic(pos.x, pos.y, pos.z, undefined, true, idx);
        } else if (s === legs) {
          spawnExtra('hopper', pos.x, pos.y, pos.z, 'x', 0.9);
          spawnRelic(pos.x, pos.y, pos.z);
        }
      }
      return;
    }

    if (mod === 'beam_gauntlet') {
      const bWidth = 2.35 + rng() * 0.35;
      const b1 = advanceCursor(2.15, 1.0, bWidth, 5.6, modSign * 0.4);
      addPlat(`beam1_${idx}`, b1.x, b1.y, b1.z, bWidth, 5.6, 0.7, theme.bridge, surf.deck);
      const pin1 = createRotatingPinwheel(2.05, 1.25 * hardness, 'z', textures);
      pin1.group.position.set(b1.x, b1.y, b1.z);
      root.add(pin1.group);
      pinwheels.push(pin1);
      kit.registerCylinder(`pk_pin_${idx}_1`, b1.x, b1.y, b1.z, 0.34, 3.2);

      const m1 = advanceCursor(2.2, 1.2, 3.2, 3.2, -modSign * 0.45);
      const mv = addPlat(`beammov_${idx}`, m1.x, m1.y, m1.z, 3.2, 3.2, 0.95, theme.mover, surf.deck);
      kit.makeMoving(mv, Math.abs(Math.sin(m1.yaw)) > 0.65 ? 'z' : 'x', 1.55, 1.05 * hardness);
      spawnRelic(m1.x, m1.y, m1.z);

      const b2 = advanceCursor(2.2, 1.15, bWidth + 0.15, 5.6, modSign * 0.48);
      addPlat(`beam2_${idx}`, b2.x, b2.y, b2.z, bWidth + 0.15, 5.6, 0.7, theme.bridge, surf.deck);
      const pin2 = createRotatingPinwheel(1.9, -1.2 * hardness, 'z', textures);
      pin2.group.position.set(b2.x, b2.y, b2.z);
      root.add(pin2.group);
      pinwheels.push(pin2);
      kit.registerCylinder(`pk_pin_${idx}_2`, b2.x, b2.y, b2.z, 0.34, 3.2);
      theme.flyer(enemies, `pk_bf_${enemyN++}`, new THREE.Vector3(b2.x, b2.y + 2.3, b2.z), 'x', 1.8);

      const d1 = advanceCursor(2.05, 1.2, 4.0, 4.0, modSign * 0.35);
      addPlat(`beamend_${idx}`, d1.x, d1.y, d1.z, 4.0, 4.0, 1.1, theme.deck, surf.deck);
      spawnRelic(d1.x, d1.y, d1.z);
      return;
    }

    if (mod === 'plunge_rebound') {
      const d1 = advanceCursor(2.0, -1.8, 3.3, 3.3, modSign * 0.55);
      addPlat(`plunge1_${idx}`, d1.x, d1.y, d1.z, 3.3, 3.3, 0.95, pick(padBuilders), surf.pad);

      const d2 = advanceCursor(2.05, -2.0, 3.1, 3.1, modSign * 0.48);
      const cr = addPlat(`plunge2_${idx}`, d2.x, d2.y, d2.z, 3.1, 3.1, 0.85, theme.deck, surf.deck);
      kit.makeCrumbling(cr);
      spawnRelic(d2.x, d2.y, d2.z);

      const arena = advanceCursor(2.15, -1.8, 6.2, 6.4, modSign * 0.4);
      addPlat(`plunge_arena_${idx}`, arena.x, arena.y, arena.z, 6.2, 6.4, 1.4, theme.big, surf.main);
      addGallowsPendulum(arena.x, arena.y, arena.z, 4.0, 4.3, idx * 0.7);
      const ball = createRollingWoolBall(
        0.55,
        new THREE.Vector3(arena.x, arena.y, arena.z),
        { minX: arena.x - 2.1, maxX: arena.x + 2.1, minZ: arena.z - 2.1, maxZ: arena.z + 2.1 },
        accent,
        textures
      );
      root.add(ball.group);
      rollingBalls.push(ball);

      const tramp = advanceCursor(2.1, 0.9, 4.4, 4.4, -modSign * 0.55);
      addPlat(`plunge_tramp_${idx}`, tramp.x, tramp.y, tramp.z, 4.4, 4.4, 1.3, theme.launchPad, surf.pad);
      kit.addBouncy(`pk_tramp_pl_${idx}`, theme.trampoline(), tramp.x, tramp.y, tramp.z);

      const rebound = advanceCursor(2.15, 3.85, 4.8, 4.8, -modSign * 0.42);
      addPlat(`plunge_reb_${idx}`, rebound.x, rebound.y, rebound.z, 4.8, 4.8, 1.2, theme.deck, surf.deck);
      spawnRelic(rebound.x, rebound.y, rebound.z);
      return;
    }

    if (mod === 'risk_split') {
      const origin = { x: curX, y: curY, z: curZ, yaw: curYaw };
      let rejoinYaw = origin.yaw + modSign * (0.3 + rng() * 0.35);
      const endY = clampY(origin.y + 7.6);
      let endCenter = {
        x: origin.x + Math.sin(rejoinYaw) * 26.5,
        y: endY,
        z: origin.z + Math.cos(rejoinYaw) * 26.5,
      };
      for (let attempt = 0; attempt < 10; attempt++) {
        const ty = origin.yaw + modSign * 0.4 + (attempt === 0 ? 0 : (attempt % 2 === 1 ? 1 : -1) * Math.ceil(attempt / 2) * 0.42);
        const tx = origin.x + Math.sin(ty) * 26.5;
        const tz = origin.z + Math.cos(ty) * 26.5;
        if (!overlapsPlaced(tx, endY, tz, 11.5, 11.5, 1.6)) {
          rejoinYaw = ty;
          endCenter = { x: tx, y: endY, z: tz };
          break;
        }
      }

      const fwdX = Math.sin(rejoinYaw);
      const fwdZ = Math.cos(rejoinYaw);
      const rightX = Math.cos(rejoinYaw);
      const rightZ = -Math.sin(rejoinYaw);
      const arcPos = (tFrac: number, lat: number, yOff: number) => ({
        x: origin.x + fwdX * (26.5 * tFrac) + rightX * lat,
        y: clampY(origin.y + yOff),
        z: origin.z + fwdZ * (26.5 * tFrac) + rightZ * lat,
      });

      // Left Risky Crumbling Express
      const r1 = arcPos(0.24, -6.2, 1.3);
      const crA = addPlat(`riskL1_${idx}`, r1.x, r1.y, r1.z, 2.8, 2.8, 0.85, pick(padBuilders), surf.pad);
      kit.makeCrumbling(crA);
      const r2 = arcPos(0.45, -7.8, 2.9);
      const crB = addPlat(`riskL2_${idx}`, r2.x, r2.y, r2.z, 2.8, 2.8, 0.85, theme.deck, surf.deck);
      kit.makeCrumbling(crB);
      spawnRelic(r2.x, r2.y, r2.z, true);
      items.push({ type: 'nuez', pos: new THREE.Vector3(r2.x, r2.y + 0.95, r2.z) });
      const r3 = arcPos(0.66, -6.8, 4.6);
      addPlat(`riskL3_${idx}`, r3.x, r3.y, r3.z, 3.1, 3.1, 0.95, theme.bridge, surf.deck);
      spawnExtra('chaser', r3.x, r3.y, r3.z, 'x', 0.9);
      const r4 = arcPos(0.84, -4.4, 6.1);
      addPlat(`riskL4_${idx}`, r4.x, r4.y, r4.z, 3.3, 3.3, 0.95, pick(padBuilders), surf.pad);

      // Right Technical Bounce Detour
      const s1 = arcPos(0.25, 6.2, 1.0);
      addPlat(`safeR1_${idx}`, s1.x, s1.y, s1.z, 4.2, 4.2, 1.25, theme.launchPad, surf.pad);
      kit.addBouncy(`pk_tramp_sk_${idx}`, theme.trampoline(), s1.x, s1.y, s1.z);
      const s2 = arcPos(0.5, 8.2, 4.5);
      addPlat(`safeR2_${idx}`, s2.x, s2.y, s2.z, 4.3, 4.3, 1.15, theme.deck, surf.deck);
      spawnRelic(s2.x, s2.y, s2.z);
      const s3 = arcPos(0.76, 5.6, 6.0);
      addPlat(`safeR3_${idx}`, s3.x, s3.y, s3.z, 4.1, 4.1, 1.15, pick(padBuilders), surf.pad);

      addPlat(`split_end_${idx}`, endCenter.x, endCenter.y, endCenter.z, 7.2, 7.2, 1.8, theme.big, surf.main);
      curX = endCenter.x;
      curY = endCenter.y;
      curZ = endCenter.z;
      curYaw = rejoinYaw;
      curW = 7.2;
      curD = 7.2;
      return;
    }

    if (mod === 'arch_weave') {
      const archSteps = 6 + extraSteps;
      for (let s = 1; s <= archSteps; s++) {
        const w = s === 3 ? 5.2 : Math.max(2.65, 3.2 + rng() * 0.45 - padShrink * 0.7);
        const pos = advanceCursor(2.1, 1.2, w, w, modSign * (0.28 + rng() * 0.14));
        const pl = addPlat(`arch_${idx}_${s}`, pos.x, pos.y, pos.z, w, w, 1.05, s === 3 ? theme.big : pick(padBuilders), surf.pad);
        if (s === 2 || s === 4 || s === 6 || s === 8) {
          addSkyArch(pos.x, pos.y, pos.z, pos.yaw, 4.2);
        }
        if (s === 5 || (extraSteps >= 2 && s === 7)) kit.makeCrumbling(pl);
        if (s === 3) {
          spawnExtra('shooter', pos.x + 1.3, pos.y, pos.z - 1.3, 'x', 0);
          spawnRelic(pos.x - 1.1, pos.y, pos.z + 1.1, undefined, true, idx);
        } else if (s === archSteps) {
          spawnRelic(pos.x, pos.y, pos.z);
        }
      }
      return;
    }

    if (mod === 'crumble_ladder') {
      // High-tension vertical crumbling climb (+10.5m to +13.5m) with tight tiny rest landings
      const ladSteps = 7 + extraSteps;
      for (let s = 1; s <= ladSteps; s++) {
        const isRest = s === 4 || s === ladSteps;
        const w = isRest ? 3.8 : Math.max(2.35, 2.65 + rng() * 0.35 - padShrink * 0.6);
        const swing = modSign * (s % 2 === 0 ? 0.38 : -0.22);
        const pos = advanceCursor(2.15, 1.32, w, w, swing);
        const pl = addPlat(
          `crumblad_${idx}_${s}`,
          pos.x,
          pos.y,
          pos.z,
          w,
          w,
          0.85,
          isRest ? theme.deck : pick(padBuilders),
          surf.pad
        );
        if (!isRest) {
          kit.makeCrumbling(pl);
        } else if (s === 4) {
          spawnExtra('chaser', pos.x, pos.y, pos.z, 'z', 0.95);
          spawnRelic(pos.x, pos.y, pos.z, true, true, idx);
        } else {
          items.push({ type: 'baya', pos: new THREE.Vector3(pos.x, pos.y + 0.95, pos.z) });
          spawnRelic(pos.x, pos.y, pos.z);
        }
      }
      return;
    }

    if (mod === 'pendulum_corridor') {
      // Twin swinging pendulums & rolling sphere across narrow catwalk decks
      const e1 = advanceCursor(2.0, 0.9, 4.6, 5.4, modSign * 0.25);
      addPlat(`pend_a_${idx}`, e1.x, e1.y, e1.z, 4.6, 5.4, 1.2, theme.deck, surf.deck);
      addGallowsPendulum(e1.x, e1.y, e1.z, 3.8, 4.4, 0);

      const mid = advanceCursor(2.1, 1.15, 2.7, 5.2, modSign * 0.2);
      addPlat(`pend_mid_${idx}`, mid.x, mid.y, mid.z, 2.7, 5.2, 0.75, theme.bridge, surf.deck);
      spawnRelic(mid.x, mid.y, mid.z);

      const e2 = advanceCursor(2.1, 1.1, 5.4, 5.4, modSign * 0.25);
      addPlat(`pend_b_${idx}`, e2.x, e2.y, e2.z, 5.4, 5.4, 1.3, theme.big, surf.main);
      addGallowsPendulum(e2.x, e2.y, e2.z, 4.1, 4.4, Math.PI * 0.65);
      const ball = createRollingWoolBall(
        0.52,
        new THREE.Vector3(e2.x, e2.y, e2.z),
        { minX: e2.x - 1.9, maxX: e2.x + 1.9, minZ: e2.z - 1.9, maxZ: e2.z + 1.9 },
        accent,
        textures
      );
      root.add(ball.group);
      rollingBalls.push(ball);
      spawnExtra('shooter', e2.x + 1.5, e2.y, e2.z - 1.5, 'x', 0);

      const exit = advanceCursor(2.05, 1.25, 3.6, 3.6, -modSign * 0.35);
      addPlat(`pend_end_${idx}`, exit.x, exit.y, exit.z, 3.6, 3.6, 1.0, pick(padBuilders), surf.pad);
      spawnRelic(exit.x, exit.y, exit.z);
      return;
    }

    if (mod === 'kinetic_elevators') {
      // Synchronized X/Z/Y moving platform relay + updraft vault
      const m1 = advanceCursor(2.15, 1.1, 3.5, 3.5, modSign * 0.35);
      const pM1 = addPlat(`kin_x_${idx}`, m1.x, m1.y, m1.z, 3.5, 3.5, 0.95, theme.mover, surf.deck);
      kit.makeMoving(pM1, 'x', 1.6, 1.15 * hardness);

      const m2 = advanceCursor(2.2, 1.35, 3.4, 3.4, -modSign * 0.4);
      const pM2 = addPlat(`kin_y_${idx}`, m2.x, m2.y, m2.z, 3.4, 3.4, 0.95, theme.mover, surf.deck);
      kit.makeMoving(pM2, 'y', 1.1, 1.05 * hardness);
      spawnRelic(m2.x, m2.y + 1.1, m2.z);

      const up = advanceCursor(2.1, 1.2, 4.4, 4.4, modSign * 0.3);
      addPlat(`kin_up_${idx}`, up.x, up.y, up.z, 4.4, 4.4, 1.25, theme.launchPad, surf.pad);
      kit.addUpdraft(`pk_up_${idx}_kin`, up.x, up.y, up.z, 14.5, 4.4, theme.updraftTint);

      const top = advanceCursor(2.05, 5.8, 4.6, 4.6, modSign * 0.45);
      addPlat(`kin_top_${idx}`, top.x, top.y, top.z, 4.6, 4.6, 1.2, theme.deck, surf.deck);
      addSupportPillar(top.x, top.y - 1.2, top.z, 9.0, 0.5);
      spawnExtra('hopper', top.x, top.y, top.z, 'z', 1.1);
      spawnRelic(top.x, top.y, top.z);
      return;
    }

    if (mod === 'ring_vaults') {
      // Sweeping banked ascent lined with glowing halo rings, steam vent & walker guard
      const steps = 6 + extraSteps;
      for (let s = 1; s <= steps; s++) {
        const w = s === 4 ? 4.8 : Math.max(2.6, 3.1 + rng() * 0.4 - padShrink * 0.7);
        const pos = advanceCursor(2.1, 1.25, w, w, modSign * (0.36 + rng() * 0.12));
        addPlat(`ringv_${idx}_${s}`, pos.x, pos.y, pos.z, w, w, 1.0, s === 4 ? theme.big : pick(padBuilders), surf.pad);
        if (s % 2 === 1) {
          const halo = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.11, 8, 26), trimMat);
          halo.position.set(pos.x, pos.y + 2.35, pos.z);
          halo.rotation.y = pos.yaw;
          kit.addDecor(halo);
        }
        if (s === 3) {
          const vent = createSporeSteamVent(0.95, Math.max(1.85, 2.9 - diff * 0.45), new THREE.Vector3(pos.x, pos.y, pos.z), textures);
          root.add(vent.group);
          steamVents.push(vent);
          kit.registerCylinder(`pk_vent_${ventN++}`, pos.x, pos.y, pos.z, 0.6, 0.95);
          spawnRelic(pos.x, pos.y, pos.z, undefined, true, idx);
        } else if (s === 4) {
          theme.walker(enemies, `pk_rgw_${enemyN++}`, new THREE.Vector3(pos.x, pos.y, pos.z), 'x', 1.2);
        } else if (s === steps) {
          spawnRelic(pos.x, pos.y, pos.z);
        }
      }
      return;
    }

    // Default: 'floating_cluster' — compact asymmetric sky islands
    const clusterSteps = 6 + extraSteps;
    for (let s = 1; s <= clusterSteps; s++) {
      const yawSwing = modSign * (s % 2 === 0 ? 0.58 : -0.26);
      const w = s === 4 ? 4.4 : Math.max(2.5, 2.9 + rng() * 0.45 - padShrink * 0.6);
      const pos = advanceCursor(2.1, 1.25, w, w, yawSwing);
      const pl = addPlat(`cluster_${idx}_${s}`, pos.x, pos.y, pos.z, w, w, 1.0, s % 2 === 0 ? theme.deck : pick(padBuilders), surf.pad);
      if (s === 3 || (extraSteps >= 2 && s === 7)) {
        kit.makeMoving(pl, 'y', 1.0, 1.0 * hardness);
        if (s === 3) spawnRelic(pos.x, pos.y + 1.0, pos.z, undefined, true, idx);
      } else if (s === 4) {
        spawnExtra('diver', pos.x, pos.y + 3.1, pos.z, 'x', 2.2);
        items.push({ type: 'baya', pos: new THREE.Vector3(pos.x, pos.y + 0.95, pos.z) });
      } else if (s === clusterSteps) {
        spawnRelic(pos.x, pos.y, pos.z);
      }
    }
  };

  // =========================================================================
  // PROGRESSIVE MODULE PLAN: World-distinct opener + Fisher-Yates shuffle
  // =========================================================================
  const openerPool = OPENING_MODULES_BY_THEME[themeId] || ALL_MODULES;
  const opener = openerPool[Math.floor(rng() * openerPool.length)];
  const remainingPool = shuffleInPlace(
    ALL_MODULES.filter((m) => m !== opener),
    rng
  );
  const chosenModules: ModuleKind[] = [opener, ...remainingPool.slice(0, Math.min(moduleCount - 1, remainingPool.length))];
  while (chosenModules.length < moduleCount) {
    const prev = chosenModules[chosenModules.length - 1];
    const extraPool = shuffleInPlace(
      ALL_MODULES.filter((m) => m !== prev),
      rng
    );
    for (const candidate of extraPool) {
      if (chosenModules.length >= moduleCount) break;
      if (candidate !== chosenModules[chosenModules.length - 1]) {
        chosenModules.push(candidate);
      }
    }
  }

  chosenModules.forEach((mod, idx) => {
    const modSign = idx % 2 === 0 ? turnSign : -turnSign;
    buildModule(mod, modSign, idx);
    // Add an intermediate Checkpoint Shrine every 2 modules
    if (idx % 2 === 1 && idx < chosenModules.length - 1) {
      addCheckpointPlaza(8.8, 0.95, modSign * 0.28);
    }
  });

  // =========================================================================
  // GRAND SUMMIT PLAZA & VICTORY PORTAL
  // =========================================================================
  const sum = advanceCursor(2.25, 1.35, 14.5, 14.5, turnSign * 0.35);
  addPlat('summit_plaza', sum.x, sum.y, sum.z, 14.5, 14.5, 3.0, theme.big, surf.main);
  addSupportPillar(sum.x - 5.0, sum.y - 3.0, sum.z - 5.0, 22, 0.85);
  addSupportPillar(sum.x + 5.0, sum.y - 3.0, sum.z + 5.0, 22, 0.85);
  theme.prop(sum.x - 4.7, sum.y, sum.z - 4.4, rng());
  theme.prop(sum.x + 4.7, sum.y, sum.z + 4.4, rng());
  spawnExtra('diver', sum.x, sum.y + 3.5, sum.z, 'x', 2.8);

  const podiumMat = new THREE.MeshStandardMaterial({
    color: look.trim,
    roughness: Math.min(0.5, look.roughness),
    metalness: Math.max(0.35, look.metalness),
  });
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.35, 16), podiumMat);
  podium.position.set(sum.x, sum.y + 0.17, sum.z);
  podium.receiveShadow = true;
  kit.addDecor(podium);

  // Guarantee exact RELICS.parkour (12) collectibles placed
  while (collectN < RELICS.parkour) {
    const angle = (collectN / RELICS.parkour) * Math.PI * 2;
    spawnRelic(sum.x + Math.cos(angle) * 4.2, sum.y + 0.35, sum.z + Math.sin(angle) * 4.2);
  }

  // Center far horizon backdrop cleanly around full ascent bounds
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of kit.platforms) {
    minX = Math.min(minX, p.position.x - p.size.x / 2);
    maxX = Math.max(maxX, p.position.x + p.size.x / 2);
    minZ = Math.min(minZ, p.position.z - p.size.z / 2);
    maxZ = Math.max(maxZ, p.position.z + p.size.z / 2);
  }
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  let playR = 36;
  for (const p of kit.platforms) {
    playR = Math.max(playR, Math.hypot(p.position.x - midX, p.position.z - midZ) + Math.max(p.size.x, p.size.z) / 2);
  }
  addOpenBackdrop(root, textures, themeId, playR + 26, kit.animators, midX, midZ);

  const portalPos = new THREE.Vector3(sum.x, sum.y + 0.35, sum.z);
  const showcasePos = new THREE.Vector3(sum.x - 4.0, sum.y + 5.2, sum.z - 2.0);
  const world = kit.finish(portalPos, enemies, items, showcasePos);
  world.levelName = `${theme.name} · Ascenso ${level}`;
  world.summitName = theme.summitName;
  world.summitRequiresLanding = true;
  world.obstacles.push(...obstacles);
  world.rollingBalls.push(...rollingBalls);
  world.pinwheels.push(...pinwheels);
  world.steamVents.push(...steamVents);
  return world;
}
