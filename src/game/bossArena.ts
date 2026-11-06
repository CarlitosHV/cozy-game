/**
 * "Lucha contra jefes" generator: builds a boss arena for a level, dressed with the
 * level's theme. The arena is a big flat plaza (6×6 tiles of 10 m without the corners)
 * with the shrine at the south edge and the structures each boss needs:
 *   - Plumarroca (cozy): three rock towers with spiral steps; the bird perches on top.
 *   - ERR0R.exe (aero): a central dais the glitch monster floats over.
 *   - Nave Nodriza (cosmic): open ground with cows grazing.
 *   - Huesudo (swamp): the giant ducks into the bog and rises somewhere else: around the edge
 *     of the arena or out of the lake in the middle.
 *   - Rey Gnomo (garden): an open lawn.
 *   - Drácula (castle): a courtyard with four candelabra.
 * Tools (slingshot, stones, bat, net, bombs, torches) are placed as backpack pickups and
 * the victory portal stays hidden until the boss is defeated (see combat.ts).
 */
import * as THREE from 'three';
import { EnemyManager } from './enemies';
import { ProceduralTextures } from './textures';
import { WorldBuildResult } from './levels';
import { createLevelKit } from './levelKit';
import { Builder, createThemePack } from './levelThemes';
import { ItemSpot, ItemType } from './items';
import { BOSS_FOR_THEME, BOSS_INFO, BossKind, RELICS, THEME_INFO, themeForLevel } from './progress';
import { addOpenBackdrop, difficultyForLevel } from './levelGen';
import { VictoryPortalModel } from './models';

export interface BossSetup {
  kind: BossKind;
  level: number;
  /** 0 → 1 difficulty */
  diff: number;
  name: string;
  short: string;
  floorY: number;
  /** Half size of the plaza */
  half: number;
  spawn: THREE.Vector3;
  /** Where the boss starts */
  home: THREE.Vector3;
  /** Bird: top center of every tower */
  perches: THREE.Vector3[];
  /** UFO: where the cows graze */
  cowSpots: THREE.Vector3[];
  /** Dracula: candelabra positions */
  candelabra: THREE.Vector3[];
  /** Skeleton: base (waist) of the giant where it first rises */
  giantBase: THREE.Vector3;
  /** Skeleton: every place the giant can rise from (edge of the arena and the central lake) */
  giantSpots: THREE.Vector3[];
  food: { pos: THREE.Vector3; kind: 'burger' | 'fries' }[];
  portal: VictoryPortalModel;
  portalPos: THREE.Vector3;
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

const TILE = 10;
const N = 6;
const HALF = (N * TILE) / 2; // 30

export function generateBossArena(level: number, root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult & { boss: BossSetup } {
  const rng = mulberry32(level * 4241 + 7);
  const themeId = themeForLevel(level);
  const kind = BOSS_FOR_THEME[themeId];
  const info = BOSS_INFO[kind];
  const diff = difficultyForLevel(level);
  const kit = createLevelKit(root, textures);
  const theme = createThemePack(themeId, kit, textures);
  const terrain: Builder = theme.terrain ?? theme.big;
  const accent = parseInt(THEME_INFO[themeId].accent.slice(1), 16);
  const enemies = new EnemyManager(root, textures);
  const items: ItemSpot[] = [];
  const Y = 0;

  // ---- Plaza ----
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const corner = (i === 0 || i === N - 1) && (j === 0 || j === N - 1);
      if (corner) continue;
      const x = -HALF + TILE / 2 + i * TILE;
      const z = -HALF + TILE / 2 + j * TILE;
      kit.addPlatform(`floor_${i}_${j}`, x, Y, z, TILE, TILE, 4, terrain);
    }
  }
  // Glowing boss circle in the middle
  const circle = new THREE.Mesh(
    new THREE.RingGeometry(5.6, 6.0, 48),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = Y + 0.03;
  root.add(circle);

  // ---- Shrine / start ----
  const spawn = new THREE.Vector3(0, Y + 0.2, 23);
  kit.addCheckpoint(0, `Entrada · ${info.short}`, new THREE.Vector3(-5.5, Y, 25.5), spawn, true);

  const setup: BossSetup = {
    kind,
    level,
    diff,
    name: info.name,
    short: info.short,
    floorY: Y,
    half: HALF,
    spawn,
    home: new THREE.Vector3(0, Y, -6),
    perches: [],
    cowSpots: [],
    candelabra: [],
    giantBase: new THREE.Vector3(0, Y - 2.4, -27.5),
    giantSpots: [],
    food: [],
    portal: null as unknown as VictoryPortalModel,
    portalPos: new THREE.Vector3(0, Y, 2),
  };

  const item = (type: ItemType, x: number, z: number, y = Y) => items.push({ type, pos: new THREE.Vector3(x, y + 0.95, z) });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b8378, roughness: 0.95, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 });

  // ---- Boss-specific structures ----
  if (kind === 'bird') {
    const towers: [number, number][] = [
      [0, -15],
      [13.5, 6],
      [-13.5, 6],
    ];
    const top = Y + 11.5;
    const towerBuilder: Builder = (g, w, d, h) => {
      const r = w * 0.56;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 1.1, h, 9), rockMat);
      body.position.y = -h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.15, r, 0.35, 9), capMat);
      cap.position.y = -0.1;
      g.add(cap);
      // Nest
      const nest = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.22, 6, 14), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 }));
      nest.rotation.x = Math.PI / 2;
      nest.position.y = 0.15;
      g.add(nest);
    };
    towers.forEach(([x, z], k) => {
      kit.addPlatform(`tower_${k}`, x, top, z, 4.4, 4.4, top - Y + 4, towerBuilder);
      setup.perches.push(new THREE.Vector3(x, top, z));
      // Spiral steps starting on the side that faces the middle of the arena
      const start = Math.atan2(-z, -x);
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const a = start + i * 0.8;
        const sx = x + Math.cos(a) * 4.35;
        const sz = z + Math.sin(a) * 4.35;
        const sy = Y + 1.05 * (i + 1);
        const b = theme.small[i % theme.small.length];
        kit.addPlatform(`tower_${k}_step${i}`, sx, sy, sz, 2.2, 2.2, 0.5, b);
      }
      item('bate', x * 0.55 + 2, z * 0.55 + 2);
    });
    setup.home.copy(setup.perches[0]);
    item('resortera', -3, 19);
    item('bate', 3, 19);
    item('piedra', -6, 16);
    item('piedra', 6, 16);
    item('piedra', 0, 5);
  } else if (kind === 'glitch') {
    const dais: Builder = (g, w, d, h) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(w / 2, w / 2 + 0.3, h, 24),
        new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 })
      );
      m.position.y = -h / 2;
      m.receiveShadow = true;
      g.add(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.08, 6, 40), new THREE.MeshBasicMaterial({ color: 0xff00e6 }));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    };
    kit.addPlatform('dais', 0, Y + 1.0, -4, 7, 7, 1.0 + 4, dais);
    setup.home.set(0, Y + 5.2, -4);
    for (const [x, z] of [
      [-12, -10],
      [12, -10],
      [-9, 8],
      [9, 8],
    ]) {
      kit.addPlatform(`pillar_${x}_${z}`, x, Y + 2.2, z, 1.6, 1.6, 2.2 + 4, theme.small[0]);
    }
    item('bate', -3, 19);
    item('bate', 10, 0);
    item('resortera', 3, 19);
    item('piedra', 6, 15);
    item('piedra', -10, 2);
  } else if (kind === 'ufo') {
    setup.home.set(0, Y + 9.5, -4);
    const spots: [number, number][] = [
      [-14, -12],
      [13, -14],
      [-17, 4],
      [16, 6],
      [0, -20],
    ];
    for (const [x, z] of spots) setup.cowSpots.push(new THREE.Vector3(x, Y, z));
    // A few rocks to hide behind
    for (const [x, z] of [
      [-6, -2],
      [7, -6],
      [-9, 12],
      [10, 13],
    ]) {
      kit.addPlatform(`rock_${x}_${z}`, x, Y + 1.4, z, 2.4, 2.4, 1.4 + 4, theme.small[0]);
    }
    item('resortera', -3, 19);
    item('red', 3, 19);
    item('red', -14, -4);
    item('piedra', 0, 16);
    item('piedra', -8, 6);
    item('piedra', 8, 2);
    item('piedra', 2, -10);
    item('piedra', 18, -4);
  } else if (kind === 'skeleton') {
    setup.home.copy(setup.giantBase);
    // Where Huesudo can rise: north edge (first), the two sides, the two empty north corners
    // and the bog lake in the middle of the arena
    for (const [x, z] of [
      [0, -27.5],
      [-27.5, -6],
      [27.5, -6],
      [-24.5, -24.5],
      [24.5, -24.5],
      [0, 0],
    ]) {
      setup.giantSpots.push(new THREE.Vector3(x, Y - 2.4, z));
    }
    // The lake: dark bog water with reeds around it
    const lake = new THREE.Mesh(
      new THREE.CircleGeometry(5.3, 40),
      new THREE.MeshStandardMaterial({ color: 0x2f4a1c, emissive: 0x1a2e0c, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 })
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(0, Y + 0.04, 0);
    lake.receiveShadow = true;
    root.add(lake);
    const scum = new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.35, depthWrite: false });
    for (let k = 0; k < 7; k++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * 4;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.35 + rng() * 0.4, 10), scum);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(Math.cos(a) * r, Y + 0.06, Math.sin(a) * r);
      root.add(pad);
    }
    const reedM = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.8 });
    const tipM = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + rng() * 0.3;
      const r = 5.0 + rng() * 0.6;
      const h = 0.9 + rng() * 0.8;
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, h, 5), reedM);
      reed.position.set(Math.cos(a) * r, Y + h / 2, Math.sin(a) * r);
      reed.rotation.z = (rng() - 0.5) * 0.3;
      root.add(reed);
      const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 3, 6), tipM);
      tip.position.set(reed.position.x, Y + h + 0.05, reed.position.z);
      root.add(tip);
    }
    // Stepping stones in the bog at the north side (decor + cover)
    for (const [x, z] of [
      [-10, -14],
      [10, -16],
      [-3, -8],
      [16, 2],
      [-16, 4],
    ]) {
      kit.addPlatform(`stone_${x}_${z}`, x, Y + 1.0, z, 2.2, 2.2, 1.0 + 4, theme.small[0]);
    }
    item('bomba', -12, 10);
    item('bomba', 12, 10);
    item('bomba', -6, -2);
    item('bomba', 6, -2);
    item('bate', -3, 19);
    item('bate', 14, -8);
    item('resortera', 3, 19);
    item('piedra', 7, 15);
  } else if (kind === 'gnome') {
    setup.home.set(0, Y, -10);
    for (const [x, z] of [
      [-14, -6],
      [14, -6],
      [-8, 10],
      [9, 11],
    ]) {
      kit.addPlatform(`mound_${x}_${z}`, x, Y + 1.1, z, 2.6, 2.6, 1.1 + 4, theme.small[0]);
    }
    item('red', -3, 19);
    item('red', 16, 2);
    item('red', -16, 2);
    item('bate', 3, 19);
    item('bate', 0, -18);
    item('resortera', 6, 17);
    item('piedra', -6, 15);
  } else {
    // dracula
    setup.home.set(0, Y + 3.5, -6);
    setup.candelabra.push(
      new THREE.Vector3(-14, Y, -14),
      new THREE.Vector3(14, Y, -14),
      new THREE.Vector3(-14, Y, 12),
      new THREE.Vector3(14, Y, 12)
    );
    for (const [x, z] of [
      [-7, -1],
      [7, -1],
      [-7, -13],
      [7, -13],
    ]) {
      kit.addPlatform(`column_${x}_${z}`, x, Y + 3.0, z, 1.4, 1.4, 3.0 + 4, theme.small[0]);
    }
    item('antorcha', -3, 19);
    item('antorcha', 3, 19);
    item('antorcha', 0, 0);
    item('bate', -10, 18);
    item('bate', 18, -2);
    item('resortera', 10, 18);
    item('piedra', -18, -2);
  }

  // ---- Food that heals (handled by the combat system) ----
  const foodSpots: [number, number, 'burger' | 'fries'][] = [
    [-20, 10, 'burger'],
    [20, 10, 'fries'],
    [-21, -12, 'fries'],
    [21, -12, 'burger'],
    [0, 13, 'fries'],
  ];
  for (const [x, z, k] of foodSpots) setup.food.push({ pos: new THREE.Vector3(x, Y + 1.0, z), kind: k });

  // ---- A few crystals to collect ----
  for (let k = 0; k < RELICS.boss; k++) {
    const a = (k / RELICS.boss) * Math.PI * 2 + rng() * 0.4;
    const r = 17 + rng() * 6;
    kit.addCollectible(`bc${k}`, rng() < 0.7 ? 'sun_crystal' : 'golden_acorn', Math.cos(a) * r, Y + 1.2, Math.sin(a) * r);
  }

  // ---- Decor along the border (never on the play paths) ----
  for (let k = 0; k < 22; k++) {
    const a = rng() * Math.PI * 2;
    const r = 25.5 + rng() * 3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) continue;
    if (Math.abs(x) > HALF - TILE && Math.abs(z) > HALF - TILE) continue; // corners are empty
    if (Math.abs(x) < 6 && z > 18) continue; // keep the entrance clear
    if (kind === 'skeleton' && setup.giantSpots.some((g) => Math.hypot(g.x - x, g.z - z) < 7)) continue; // the giant's spots
    theme.prop(x, Y, z, rng());
  }

  addOpenBackdrop(root, textures, themeId, HALF * 1.45 + 6, kit.animators);

  const portalPos = setup.portalPos;
  const world = kit.finish(portalPos.clone(), enemies, items, new THREE.Vector3(-4, Y + 4, 6));
  // The portal only appears once the boss is defeated
  setup.portal = world.victoryPortal!;
  setup.portal.group.visible = false;
  world.victoryPortal = undefined;
  world.summitPosition = new THREE.Vector3(0, -999, 0);
  world.levelName = `${info.name} · Nivel ${level}`;
  world.summitName = 'Portal del jefe';
  return Object.assign(world, { boss: setup });
}
