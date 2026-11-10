/**
 * Extra eye candy that scales with the graphics quality (Ajustes → Rendimiento y Gráficos):
 *
 *  - Baja: nothing extra (fastest).
 *  - Media: some floating particles, a flock of birds, a few far islands and ground decor.
 *  - Alta: lots of particles, several flocks, a full ring of far islands with waterfalls and
 *    drifting cloud puffs, lots of ground decor on every floor, and far scenery painted around
 *    the horizon of each world (planets and a black hole in space, glass towers over a meadow in
 *    Aero… see backdrops.ts). In the Backrooms, when the lights go out, a low mist creeps in.
 *
 * The ground decor depends on the world: flowers and grass in the meadow, cloud tufts and
 * crystals in the sky, glowing crystals and mushrooms in space, reeds and moss in the swamp,
 * tulips and topiaries in the garden, tombstones, candles and dead grass at the castle, and
 * papers, stains and fallen ceiling tiles in the Backrooms.
 *
 * Purely decorative: nothing here collides or takes part in the game.
 */
import * as THREE from 'three';
import type { WorldBuildResult, PlatformItem, PlatformSurfaceType } from './levels';
import { ThemeId } from './progress';
import { buildBackdrop, Backdrop } from './backdrops';

export type Quality = 'high' | 'medium' | 'low';

interface ThemeLook {
  particle: number;
  particle2: number;
  /** Fireflies blink, petals/leaves fall, embers and sparks rise */
  motion: 'float' | 'fall' | 'rise';
  island: number;
  rock: number;
  flowers: number[];
  grass: number;
  bird: number;
  /** Closed rooms (the Backrooms): only floating dust, no sky life or flowers */
  indoor?: boolean;
}

const LOOK: Record<ThemeId, ThemeLook> = {
  cozy: { particle: 0xfff7d6, particle2: 0xffc8dd, motion: 'fall', island: 0x86c26b, rock: 0xa08a7a, flowers: [0xf9a8d4, 0xfde68a, 0xffffff, 0xc4b5fd], grass: 0x6fbf4a, bird: 0x44403c },
  aero: { particle: 0xbae6fd, particle2: 0xffffff, motion: 'float', island: 0xe0f2fe, rock: 0x6fb7dc, flowers: [0x7dd3fc, 0xffffff, 0xa5f3fc], grass: 0x8fd4a8, bird: 0x1e3a8a },
  cosmic: { particle: 0xc4b5fd, particle2: 0x67e8f9, motion: 'float', island: 0x5b4b8a, rock: 0x6d6a8f, flowers: [0xc084fc, 0x67e8f9, 0xf0abfc], grass: 0x7c6fcf, bird: 0xe9d5ff },
  swamp: { particle: 0xd9f99d, particle2: 0xfde047, motion: 'float', island: 0x4d6b3c, rock: 0x55604a, flowers: [0xbef264, 0xfde047, 0xa3e635], grass: 0x4f772d, bird: 0x1c1917 },
  garden: { particle: 0xfbcfe8, particle2: 0xffffff, motion: 'fall', island: 0x7cc46b, rock: 0x9ca3af, flowers: [0xf472b6, 0xfb7185, 0xfacc15, 0xffffff], grass: 0x65a30d, bird: 0x57534e },
  castle: { particle: 0xfb923c, particle2: 0xfde68a, motion: 'rise', island: 0x3f3a4a, rock: 0x4b4458, flowers: [0xdc2626, 0x7c3aed, 0x1f2937], grass: 0x3f4f2f, bird: 0x0c0a09 },
  backrooms: { particle: 0xfff3c4, particle2: 0xd6c58a, motion: 'float', island: 0, rock: 0, flowers: [], grass: 0, bird: 0, indoor: true },
};

/** One kind of ground decor: parts that share the same placement (e.g. stem + flower head). */
interface DecorPart {
  geo: () => THREE.BufferGeometry;
  colors: number[];
  emissive?: number;
  opacity?: number;
}
interface DecorKind {
  share: number;
  parts: DecorPart[];
  scale: [number, number];
  /** Random lean (radians) */
  tilt: number;
  /** Extra random height stretch */
  stretch?: [number, number];
}

const G = {
  tuft: () => new THREE.ConeGeometry(0.06, 0.38, 3).translate(0, 0.19, 0),
  stem: (h: number) => () => new THREE.CylinderGeometry(0.012, 0.012, h, 3).translate(0, h / 2, 0),
  head: (r: number, y: number) => () => new THREE.IcosahedronGeometry(r, 0).translate(0, y, 0),
  ball: (r: number, y: number) => () => new THREE.SphereGeometry(r, 8, 6).translate(0, y, 0),
  crystal: (r: number, h: number) => () => new THREE.OctahedronGeometry(r, 0).scale(1, h / (2 * r), 1).translate(0, h / 2 - 0.02, 0),
  cap: (r: number, y: number) => () => new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, y, 0),
  post: (r: number, h: number, y = 0) => () => new THREE.CylinderGeometry(r * 0.85, r, h, 6).translate(0, y + h / 2, 0),
  cone: (r: number, h: number, y: number) => () => new THREE.ConeGeometry(r, h, 6).translate(0, y + h / 2, 0),
  box: (w: number, h: number, d: number, y = h / 2) => () => new THREE.BoxGeometry(w, h, d).translate(0, y, 0),
  slab: (r: number) => () => new THREE.CylinderGeometry(r, r, 0.006, 14).translate(0, 0.006, 0),
  puff: () => new THREE.IcosahedronGeometry(0.26, 1).scale(1.3, 0.55, 1).translate(0, 0.08, 0),
  pebble: (r: number = 0.12) => () => new THREE.DodecahedronGeometry(r, 0).scale(1.2, 0.55, 0.9).translate(0, r * 0.28, 0),
  rockShard: (r: number = 0.09, h: number = 0.22) => () => new THREE.ConeGeometry(r, h, 4).rotateY(0.4).translate(0, h * 0.5, 0),
  zenStack: () => () => new THREE.CylinderGeometry(0.07, 0.13, 0.16, 5).translate(0, 0.08, 0),
  woodLeaf: () => () => new THREE.CircleGeometry(0.08, 5).rotateX(-Math.PI / 2).scale(1.4, 1, 0.8).translate(0, 0.005, 0),
  shelfFungus: () => () => new THREE.CylinderGeometry(0.14, 0.02, 0.03, 6, 1, false, 0, Math.PI).translate(0, 0.02, 0),
  tombTop: () => new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 0.55, 0),
};

/** Classifies the surface type of any static platform for logical decoration */
export function classifyPlatformSurface(p: PlatformItem, theme: ThemeId): PlatformSurfaceType {
  if (p.surface) return p.surface;
  const id = (p.id || '').toLowerCase();
  if (/stone|rock|pebble|slate|paving|cobble|ruin|terrace|temple|castle|pillar|slab|monolith|fort|wall|parapet/.test(id)) {
    return 'stone';
  }
  if (/wood|bridge|plank|timber|dock|pier|boardwalk|tree|branch/.test(id)) {
    return 'wood';
  }
  if (/cloud|aero_puff|mist|puff/.test(id)) {
    return 'cloud';
  }
  if (/dirt|soil|planter|mud|peat|field/.test(id)) {
    return 'soil';
  }
  if (/crystal|gem|shard|prism|meteor|space|cosmic|astral/.test(id)) {
    return 'crystal';
  }
  if (/grass|lawn|meadow|moss|pasture|island|summit|spawn/.test(id)) {
    return 'grass';
  }

  // Color-based matching from platform mesh
  let c: number | undefined;
  if (p.mesh) {
    p.mesh.traverse((child) => {
      if (c !== undefined) return;
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | undefined;
      if (mat && mat.color && typeof mat.color.getHex === 'function') {
        c = mat.color.getHex();
      }
    });
  }
  if (c !== undefined) {
    if (c === 0x888888 || c === 0x64748b || c === 0x475569 || c === 0x334155 || c === 0x94a3b8 || c === 0x555555 || c === 0x6d6a8f || c === 0x4b4458 || c === 0x3f3a4a) {
      return 'stone';
    }
    if (c === 0x8b5a2b || c === 0xa0522d || c === 0x78350f || c === 0x92400e || c === 0xb45309 || c === 0x854d0e || c === 0x6b4f3a || c === 0x5c4033) {
      return 'wood';
    }
    if (c === 0x55aa44 || c === 0x86c26b || c === 0x6fbf4a || c === 0x4d7c0f || c === 0x65a30d || c === 0x84cc16 || c === 0x3f6212 || c === 0x8fd4a8) {
      return 'grass';
    }
    if (c === 0xffffff || c === 0xf0f9ff || c === 0xe0f2fe || c === 0xbae6fd) {
      return 'cloud';
    }
  }

  if (theme === 'castle') return 'stone';
  if (theme === 'cosmic') return 'crystal';
  if (theme === 'aero') return 'cloud';
  if (theme === 'swamp') return 'soil';
  return 'grass';
}

/** Distinctive decoration tables keyed logically by platform surface type */
const SURFACE_DECOR: Record<PlatformSurfaceType, DecorKind[]> = {
  grass: [
    { share: 0.58, parts: [{ geo: G.tuft, colors: [0x6fbf4a, 0x5aa83a, 0x84cc16] }], scale: [0.7, 1.4], tilt: 0.3, stretch: [0.8, 1.4] },
    { share: 0.34, parts: [{ geo: G.stem(0.3), colors: [0x3f6212] }, { geo: G.head(0.09, 0.3), colors: [0xf9a8d4, 0xfde68a, 0xffffff, 0xc4b5fd, 0xf472b6] }], scale: [0.8, 1.3], tilt: 0.1 },
    { share: 0.08, parts: [{ geo: G.post(0.035, 0.16), colors: [0xfef3c7] }, { geo: G.cap(0.12, 0.15), colors: [0xef4444, 0xf97316] }], scale: [0.8, 1.4], tilt: 0.12 },
  ],
  stone: [
    { share: 0.55, parts: [{ geo: G.pebble(0.13), colors: [0x78716c, 0x64748b, 0x94a3b8, 0x57534e] }], scale: [0.7, 1.5], tilt: 0.1 },
    { share: 0.30, parts: [{ geo: G.rockShard(0.09, 0.22), colors: [0x64748b, 0x94a3b8, 0xcfd8dc] }], scale: [0.6, 1.3], tilt: 0.2 },
    { share: 0.15, parts: [{ geo: G.zenStack(), colors: [0x78716c, 0x64748b] }], scale: [0.7, 1.2], tilt: 0.05 },
  ],
  wood: [
    { share: 0.50, parts: [{ geo: G.woodLeaf(), colors: [0xd97706, 0xb45309, 0x92400e, 0xca8a04, 0x78350f] }], scale: [0.7, 1.3], tilt: 0.05 },
    { share: 0.35, parts: [{ geo: G.shelfFungus(), colors: [0xa16207, 0x78350f, 0x854d0e] }], scale: [0.8, 1.5], tilt: 0.1 },
    { share: 0.15, parts: [{ geo: G.ball(0.06, 0.05), colors: [0x451a03, 0x5c2c10] }], scale: [0.7, 1.2], tilt: 0 },
  ],
  cloud: [
    { share: 0.65, parts: [{ geo: G.puff, colors: [0xffffff, 0xf0f9ff, 0xe0f2fe] }], scale: [0.6, 1.5], tilt: 0 },
    { share: 0.35, parts: [{ geo: G.ball(0.07, 0.08), colors: [0xe0f2fe, 0xfef08a, 0xbae6fd], emissive: 0.6 }], scale: [0.6, 1.3], tilt: 0 },
  ],
  soil: [
    { share: 0.50, parts: [{ geo: G.tuft, colors: [0x365314, 0x4d7c0f] }], scale: [0.6, 1.2], tilt: 0.25 },
    { share: 0.30, parts: [{ geo: G.pebble(0.1), colors: [0x57534e, 0x44403c, 0x78716c] }], scale: [0.7, 1.3], tilt: 0.08 },
    { share: 0.20, parts: [{ geo: G.post(0.03, 0.14), colors: [0xd6d3d1] }, { geo: G.cap(0.1, 0.12), colors: [0x78350f, 0xa16207] }], scale: [0.7, 1.3], tilt: 0.15 },
  ],
  crystal: [
    { share: 0.60, parts: [{ geo: G.crystal(0.1, 0.45), colors: [0xc084fc, 0x67e8f9, 0xf0abfc, 0x818cf8], emissive: 0.75 }], scale: [0.6, 1.8], tilt: 0.35 },
    { share: 0.40, parts: [{ geo: G.head(0.06, 0.06), colors: [0xfef08a, 0x67e8f9, 0xa855f7], emissive: 0.9 }], scale: [0.6, 1.4], tilt: 0 },
  ],
};

const BACKROOMS_DECOR: DecorKind[] = [
  { share: 0.4, parts: [{ geo: G.box(0.3, 0.004, 0.42, 0.004), colors: [0xfafaf9, 0xfef9c3] }], scale: [0.8, 1.2], tilt: 0.03 },
  { share: 0.25, parts: [{ geo: G.slab(0.5), colors: [0x8a7a3a, 0x6b5f2e], opacity: 0.55 }], scale: [0.6, 2.2], tilt: 0 },
  { share: 0.2, parts: [{ geo: G.box(0.6, 0.03, 0.6, 0.02), colors: [0xe7e0bf, 0xd6cc9c] }], scale: [0.9, 1.1], tilt: 0.12 },
  { share: 0.15, parts: [{ geo: G.post(0.05, 0.22), colors: [0xbae6fd], opacity: 0.8 }, { geo: G.post(0.022, 0.05, 0.22), colors: [0x1d4ed8] }], scale: [0.9, 1.1], tilt: 0 },
];

const DENSITY: Record<Quality, { particles: number; flocks: number; islands: number; flowers: number; puffs: number }> = {
  low: { particles: 0, flocks: 0, islands: 0, flowers: 0, puffs: 0 },
  medium: { particles: 140, flocks: 1, islands: 6, flowers: 700, puffs: 0 },
  high: { particles: 420, flocks: 3, islands: 14, flowers: 2400, puffs: 10 },
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft, lumpy wisp of mist (a few overlapping blobs that fade out at the edges). */
function mistTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  const blobs = [
    [64, 34, 30],
    [40, 38, 22],
    [88, 36, 24],
    [24, 42, 14],
    [106, 42, 14],
    [58, 26, 18],
  ];
  for (const [x, y, r] of blobs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 64);
  }
  // Fade out the bottom and the sides, so it doesn't show a hard edge where it meets the floor or a wall
  g.globalCompositeOperation = 'destination-in';
  const fadeY = g.createLinearGradient(0, 0, 0, 64);
  fadeY.addColorStop(0, 'rgba(0,0,0,0)');
  fadeY.addColorStop(0.3, 'rgba(0,0,0,1)');
  fadeY.addColorStop(0.62, 'rgba(0,0,0,1)');
  fadeY.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fadeY;
  g.fillRect(0, 0, 128, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface MistWisp {
  s: THREE.Sprite;
  base: THREE.Vector3;
  phase: number;
  drift: number;
  op: number;
}

function softDot(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

interface Bird {
  mesh: THREE.Group;
  wings: THREE.Mesh[];
  phase: number;
}
interface Flock {
  center: THREE.Vector3;
  radius: number;
  speed: number;
  angle: number;
  birds: Bird[];
}

export class AmbientDecor {
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private quality: Quality = 'high';
  private level = 0;
  private theme: ThemeId = 'cozy';
  private world: WorldBuildResult | null = null;
  private particles: THREE.Points | null = null;
  private particleBase: Float32Array | null = null;
  private particleSpan = 26;
  private flocks: Flock[] = [];
  private islands: { obj: THREE.Object3D; baseY: number; phase: number }[] = [];
  private puffs: { obj: THREE.Object3D; speed: number; radius: number; angle: number; y: number }[] = [];
  private waterfalls: THREE.Mesh[] = [];
  private dot: THREE.CanvasTexture | null = null;
  private backdrop: Backdrop | null = null;
  private center = new THREE.Vector3();
  /** Backrooms mist (Alta only): wisps around you that creep in when the lights go out */
  private mist: MistWisp[] = [];
  private mistTex: THREE.CanvasTexture | null = null;
  private mistY = 0;
  /** 0 = lights on (no mist), 1 = blackout (full mist) */
  private mistK = 0;
  private static readonly MIST_SPAN = 13;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = 'ambient-decor';
    scene.add(this.group);
  }

  get currentQuality(): Quality {
    return this.quality;
  }

  setQuality(q: Quality) {
    if (q === this.quality) return;
    this.quality = q;
    if (this.world) this.build(this.world, this.level, this.theme);
  }

  /** (Re)builds the decor for a level. */
  build(world: WorldBuildResult, level: number, theme: ThemeId) {
    this.clear();
    this.world = world;
    this.level = level;
    this.theme = theme;
    const d = DENSITY[this.quality];
    if (this.quality === 'low') return;
    const look = LOOK[theme];
    const rng = mulberry(level * 3571 + 7);

    // Size of the playable world
    let cx = 0;
    let cz = 0;
    let n = 0;
    let maxR = 30;
    for (const p of world.platforms) {
      if (p.position.y < -20) continue; // basements far below
      cx += p.position.x;
      cz += p.position.z;
      n++;
    }
    if (n) {
      cx /= n;
      cz /= n;
    }
    for (const p of world.platforms) {
      if (p.position.y < -20) continue;
      maxR = Math.max(maxR, Math.hypot(p.position.x - cx, p.position.z - cz) + Math.max(p.size.x, p.size.z) / 2);
    }
    maxR = Math.min(maxR, 160);
    const center = new THREE.Vector3(cx, 0, cz);
    this.center.copy(center);

    this.buildParticles(d.particles, look, rng);
    if (this.quality === 'high') {
      this.backdrop = buildBackdrop(theme, mulberry(level * 7919 + 3));
      if (this.backdrop) this.group.add(this.backdrop.group);
    }
    if (theme === 'backrooms' && this.quality === 'high') this.buildMist(rng);
    if (look.indoor) {
      this.buildGroundDecor(world, Math.round(d.flowers * 0.12), rng);
      return;
    }
    this.buildGroundDecor(world, d.flowers, rng);
    this.buildIslands(center, maxR, d.islands, look, rng);
    for (let i = 0; i < d.flocks; i++) this.buildFlock(center, maxR, look, rng, i);
    this.buildPuffs(center, maxR, d.puffs, rng);
  }

  /** Low wisps of stale yellow mist that drift through the halls around you. */
  private buildMist(rng: () => number) {
    this.mistTex ??= mistTexture();
    const S = AmbientDecor.MIST_SPAN;
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.mistTex, transparent: true, depthWrite: false, opacity: 0, color: 0xcfcdd9 });
      const s = new THREE.Sprite(mat);
      const w = 2.6 + rng() * 2.8;
      s.scale.set(w, w * (0.42 + rng() * 0.2), 1);
      s.renderOrder = 2;
      s.visible = false;
      this.group.add(s);
      this.mist.push({
        s,
        // (height of its middle: the sprite's lower half is see-through, so it never cuts into the floor)
        base: new THREE.Vector3((rng() - 0.5) * S * 2, s.scale.y * 0.5 + (rng() < 0.7 ? rng() * 0.5 : 0.6 + rng() * 1.0), (rng() - 0.5) * S * 2),
        phase: rng() * Math.PI * 2,
        drift: 0.25 + rng() * 0.35,
        op: 0.55 + rng() * 0.35,
      });
    }
    this.mistK = 0;
  }

  /** `dark`: how dark the level is (0 lit … ~0.82 the warehouse's blackout, ~0.93 the Skinwalker's). */
  private updateMist(dt: number, time: number, focus: THREE.Vector3, cam: THREE.Vector3 | undefined, dark: number) {
    // It creeps in slowly when the lights go out, and thins away when they come back
    const want = THREE.MathUtils.smoothstep(dark, 0.62, 0.8);
    this.mistK = THREE.MathUtils.damp(this.mistK, want, want > this.mistK ? 0.6 : 1.4, dt);
    if (this.mistK < 0.01) {
      for (const m of this.mist) m.s.visible = false;
      return;
    }
    // Stays on the floor while you jump
    this.mistY = Math.abs(focus.y - this.mistY) > 3 ? focus.y : THREE.MathUtils.damp(this.mistY, focus.y, 1.2, dt);
    const S = AmbientDecor.MIST_SPAN;
    for (const m of this.mist) {
      let x = m.base.x + time * m.drift + Math.sin(time * 0.21 + m.phase) * 1.2;
      let z = m.base.z + Math.cos(time * 0.17 + m.phase) * 1.5;
      x = THREE.MathUtils.euclideanModulo(x - focus.x + S, S * 2) - S + focus.x;
      z = THREE.MathUtils.euclideanModulo(z - focus.z + S, S * 2) - S + focus.z;
      const y = this.mistY + m.base.y + Math.sin(time * 0.5 + m.phase) * 0.12;
      m.s.position.set(x, y, z);
      // Fades in from the edges of the box (no popping) and when the camera goes through it
      const edge = Math.min(S - Math.abs(x - focus.x), S - Math.abs(z - focus.z));
      let a = THREE.MathUtils.smoothstep(edge, 0, 3.5);
      if (cam) a *= THREE.MathUtils.smoothstep(m.s.position.distanceTo(cam), 1.2, 4);
      m.s.visible = true;
      // Dim grey wisps against the dark (they're only lit by whatever glows)
      m.s.material.opacity = m.op * a * this.mistK * (0.8 + 0.2 * Math.sin(time * 0.7 + m.phase));
    }
  }

  private buildParticles(count: number, look: ThemeLook, rng: () => number) {
    if (!count) return;
    this.dot ??= softDot();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c1 = new THREE.Color(look.particle);
    const c2 = new THREE.Color(look.particle2);
    const S = this.particleSpan;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * S * 2;
      pos[i * 3 + 1] = rng() * S * 0.6 - 2;
      pos[i * 3 + 2] = (rng() - 0.5) * S * 2;
      const c = rng() < 0.5 ? c1 : c2;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    this.particleBase = pos.slice();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: this.theme === 'castle' ? 0.22 : 0.18,
      map: this.dot,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
  }

  /** Ground decor on the floors, logically grouped by platform surface (grass, stone, wood, cloud, soil, crystal) */
  private buildGroundDecor(world: WorldBuildResult, count: number, rng: () => number) {
    if (!count) return;
    const indoor = !!LOOK[this.theme].indoor;
    const floors = world.platforms.filter(
      (p) =>
        p.type === 'static' &&
        p.size.x >= 3.5 &&
        p.size.z >= 3.5 &&
        p.position.y > -20 &&
        p.position.y < (indoor ? 2 : 60) &&
        !/shield|hatch|cellar|summit_shield|fort_wall|core|rim_|altar|pillar|cover|wall|ceil|roof|mez|shelf/.test(p.id)
    );
    if (!floors.length) return;

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();

    // In closed indoor spaces (Backrooms), spawn only indoor debris (loose tiles, stains, paper)
    if (indoor) {
      const area = floors.reduce((a, f) => a + f.size.x * f.size.z, 0);
      const pickFloor = () => {
        let x = rng() * area;
        for (const f of floors) {
          x -= f.size.x * f.size.z;
          if (x <= 0) return f;
        }
        return floors[floors.length - 1];
      };
      this.instantiateDecorKinds(BACKROOMS_DECOR, count, floors, area, pickFloor, true, rng, m4, q, e, sc, p);
      return;
    }

    // Partition floors strictly by surface type
    const surfaceMap = new Map<PlatformSurfaceType, PlatformItem[]>();
    for (const f of floors) {
      const s = classifyPlatformSurface(f, this.theme);
      const list = surfaceMap.get(s) ?? [];
      list.push(f);
      surfaceMap.set(s, list);
    }

    const totalArea = floors.reduce((a, f) => a + f.size.x * f.size.z, 0);

    // Populate each platform surface only with its logically appropriate decor
    surfaceMap.forEach((surfaceFloors, sType) => {
      const sArea = surfaceFloors.reduce((a, f) => a + f.size.x * f.size.z, 0);
      if (sArea <= 0) return;
      const sShare = sArea / totalArea;
      const sCount = Math.max(8, Math.round(count * sShare));
      const decorList = SURFACE_DECOR[sType] || SURFACE_DECOR.grass;

      const pickFloor = () => {
        let x = rng() * sArea;
        for (const f of surfaceFloors) {
          x -= f.size.x * f.size.z;
          if (x <= 0) return f;
        }
        return surfaceFloors[surfaceFloors.length - 1];
      };

      this.instantiateDecorKinds(decorList, sCount, surfaceFloors, sArea, pickFloor, false, rng, m4, q, e, sc, p);
    });
  }

  private instantiateDecorKinds(
    decorList: DecorKind[],
    count: number,
    floors: PlatformItem[],
    area: number,
    pickFloor: () => PlatformItem,
    indoor: boolean,
    rng: () => number,
    m4: THREE.Matrix4,
    q: THREE.Quaternion,
    e: THREE.Euler,
    sc: THREE.Vector3,
    p: THREE.Vector3
  ) {
    for (const kind of decorList) {
      const n = Math.round(count * kind.share);
      if (!n) continue;
      const meshes = kind.parts.map((part) => {
        const geo = part.geo();
        return part.colors.map((c) => {
          const mat = new THREE.MeshLambertMaterial({
            color: c,
            emissive: part.emissive ? c : 0x000000,
            emissiveIntensity: part.emissive ?? 0,
            transparent: part.opacity !== undefined,
            opacity: part.opacity ?? 1,
            depthWrite: part.opacity === undefined,
          });
          const im = new THREE.InstancedMesh(geo, mat, Math.ceil(n / part.colors.length));
          im.count = 0;
          return im;
        });
      });

      for (let i = 0; i < n; i++) {
        const f = pickFloor();
        p.set(
          f.position.x + (rng() - 0.5) * (f.size.x - 0.6),
          f.position.y + 0.01 + (indoor ? i * 0.00002 : 0),
          f.position.z + (rng() - 0.5) * (f.size.z - 0.6)
        );
        q.setFromEuler(e.set((rng() - 0.5) * kind.tilt, rng() * Math.PI * 2, (rng() - 0.5) * kind.tilt));
        const k = kind.scale[0] + rng() * (kind.scale[1] - kind.scale[0]);
        const st = kind.stretch ? kind.stretch[0] + rng() * (kind.stretch[1] - kind.stretch[0]) : 1;
        sc.set(k, k * st, k);
        m4.compose(p, q, sc);
        const ci = Math.floor(rng() * 1000);
        meshes.forEach((variants, pi) => {
          const im = variants[(kind.parts[pi].colors.length === kind.parts[0].colors.length ? ci : ci + pi) % variants.length];
          if (im.count < im.instanceMatrix.count) im.setMatrixAt(im.count++, m4);
        });
      }

      for (const variants of meshes) {
        for (const im of variants) {
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          im.frustumCulled = true;
          im.receiveShadow = true;
          this.group.add(im);
        }
      }
    }
  }

  /** Far floating islands (some with waterfalls) around the world. */
  private buildIslands(center: THREE.Vector3, maxR: number, count: number, look: ThemeLook, rng: () => number) {
    if (!count) return;
    const topMat = new THREE.MeshLambertMaterial({ color: look.island, flatShading: true });
    const rockMat = new THREE.MeshLambertMaterial({ color: look.rock, flatShading: true });
    const waterMat = new THREE.MeshBasicMaterial({ color: this.theme === 'swamp' ? 0x9bd36b : 0xbfe8ff, transparent: true, opacity: 0.55, depthWrite: false });
    const crystalMat = new THREE.MeshLambertMaterial({ color: 0xc084fc, emissive: 0x7c3aed, emissiveIntensity: 0.8, flatShading: true });
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.4;
      const r = maxR + 45 + rng() * 55;
      const size = 4 + rng() * 9;
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 0.85, size * 0.35, 9), topMat);
      const under = new THREE.Mesh(new THREE.ConeGeometry(size * 0.85, size * 1.6, 9), rockMat);
      under.rotation.x = Math.PI;
      under.position.y = -size * 0.97;
      g.add(top, under);
      // A few things on top, matching the world (round trees, crystals, spires, clouds)
      for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) {
        const r0 = size * (0.15 + rng() * 0.12);
        let tr: THREE.Mesh;
        if (this.theme === 'cosmic') {
          tr = new THREE.Mesh(new THREE.OctahedronGeometry(r0 * 0.6, 0).scale(1, 2.6, 1), crystalMat);
          tr.position.y = size * 0.17 + r0 * 1.4;
        } else if (this.theme === 'castle') {
          tr = new THREE.Mesh(new THREE.ConeGeometry(r0 * 0.45, r0 * 4, 5), rockMat);
          tr.position.y = size * 0.17 + r0 * 2;
        } else if (this.theme === 'aero') {
          tr = new THREE.Mesh(new THREE.IcosahedronGeometry(r0, 1).scale(1.4, 0.6, 1), cloudMat);
          tr.position.y = size * 0.3;
        } else {
          tr = new THREE.Mesh(new THREE.IcosahedronGeometry(r0, 0), topMat);
          tr.position.y = size * 0.35;
        }
        tr.position.x = (rng() - 0.5) * size;
        tr.position.z = (rng() - 0.5) * size;
        g.add(tr);
      }
      if (this.quality === 'high' && this.theme !== 'castle' && this.theme !== 'cosmic' && rng() < 0.45) {
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.25, size * 3.5), waterMat);
        fall.position.set(0, -size * 1.6, size * 0.86);
        g.add(fall);
        this.waterfalls.push(fall);
      }
      const baseY = -8 + rng() * 40;
      g.position.set(center.x + Math.cos(a) * r, baseY, center.z + Math.sin(a) * r);
      g.rotation.y = rng() * Math.PI * 2;
      this.group.add(g);
      this.islands.push({ obj: g, baseY, phase: rng() * Math.PI * 2 });
    }
  }

  private buildFlock(center: THREE.Vector3, maxR: number, look: ThemeLook, rng: () => number, idx: number) {
    const mat = new THREE.MeshBasicMaterial({ color: look.bird, side: THREE.DoubleSide });
    const wingGeo = new THREE.BufferGeometry();
    const bat = this.theme === 'castle';
    wingGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array(
          bat
            ? [0, 0, 0.14, 0, 0, -0.1, 0.3, 0, -0.04, 0, 0, 0.14, 0.3, 0, -0.04, 0.6, 0, 0.1, 0.3, 0, -0.04, 0.6, 0, 0.1, 0.62, 0, -0.12]
            : [0, 0, 0.12, 0, 0, -0.12, 0.55, 0, 0]
        ),
        3
      )
    );
    const birds: Bird[] = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), mat);
      body.scale.set(1, 1, 2.2);
      const wl = new THREE.Mesh(wingGeo, mat);
      const wr = new THREE.Mesh(wingGeo, mat);
      wr.scale.x = -1;
      g.add(body, wl, wr);
      g.position.set(((i % 3) - 1) * 1.4, Math.floor(i / 3) * 0.6, -Math.abs((i % 3) - 1) * 1.2 - Math.floor(i / 3) * 1.4);
      const holder = new THREE.Group();
      holder.add(g);
      birds.push({ mesh: g, wings: [wl, wr], phase: rng() * 6 });
    }
    const flockGroup = new THREE.Group();
    birds.forEach((b) => flockGroup.add(b.mesh));
    this.group.add(flockGroup);
    this.flocks.push({
      center: new THREE.Vector3(center.x, 22 + idx * 7 + rng() * 8, center.z),
      radius: maxR * (0.5 + rng() * 0.5) + 10,
      speed: (0.05 + rng() * 0.04) * (rng() < 0.5 ? 1 : -1),
      angle: rng() * Math.PI * 2,
      birds,
    });
    (this.flocks[this.flocks.length - 1] as Flock & { group?: THREE.Group }).group = flockGroup;
  }

  /** Big soft cloud puffs drifting slowly around the world (high only). */
  private buildPuffs(center: THREE.Vector3, maxR: number, count: number, rng: () => number) {
    if (!count) return;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, flatShading: true });
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + rng() * 2.5, 1), mat);
        s.position.set(k * 2.6 - 4, rng() * 1.2, (rng() - 0.5) * 2);
        s.scale.y = 0.6;
        g.add(s);
      }
      this.group.add(g);
      this.puffs.push({ obj: g, speed: 0.01 + rng() * 0.02, radius: maxR + 15 + rng() * 40, angle: rng() * Math.PI * 2, y: 25 + rng() * 30 });
      g.position.set(center.x, 0, center.z);
    }
  }

  update(dt: number, time: number, focus: THREE.Vector3, cam?: THREE.Vector3, dark = 0) {
    if (this.quality === 'low') return;
    if (this.mist.length) this.updateMist(dt, time, focus, cam, dark);
    // The far scenery travels with you, like the sky
    if (this.backdrop) {
      this.backdrop.group.position.copy(focus);
      this.backdrop.update(dt, time);
    }
    // Particles live in a box around you (wrapping around as you move)
    if (this.particles && this.particleBase) {
      const attr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const base = this.particleBase;
      const S = this.particleSpan;
      const motion = LOOK[this.theme].motion;
      for (let i = 0; i < arr.length; i += 3) {
        const ph = i * 0.37;
        let x = base[i] + Math.sin(time * 0.4 + ph) * 0.8;
        let y = base[i + 1];
        let z = base[i + 2] + Math.cos(time * 0.33 + ph) * 0.8;
        if (motion === 'fall') y = base[i + 1] - ((time * 0.6 + ph) % (S * 0.6));
        else if (motion === 'rise') y = base[i + 1] + ((time * 0.9 + ph) % (S * 0.6));
        else y += Math.sin(time * 0.8 + ph) * 0.6;
        // wrap into the box centered on the player
        x = THREE.MathUtils.euclideanModulo(x - focus.x + S, S * 2) - S + focus.x;
        z = THREE.MathUtils.euclideanModulo(z - focus.z + S, S * 2) - S + focus.z;
        y = THREE.MathUtils.euclideanModulo(y + 2, S * 0.6) - 2 + focus.y;
        arr[i] = x;
        arr[i + 1] = y;
        arr[i + 2] = z;
      }
      attr.needsUpdate = true;
      (this.particles.material as THREE.PointsMaterial).opacity = this.theme === 'swamp' ? 0.55 + Math.sin(time * 3) * 0.3 : 0.85;
    }
    for (const f of this.flocks) {
      f.angle += f.speed * dt;
      const g = (f as Flock & { group?: THREE.Group }).group;
      if (!g) continue;
      g.position.set(f.center.x + Math.cos(f.angle) * f.radius, f.center.y + Math.sin(time * 0.3 + f.radius) * 2, f.center.z + Math.sin(f.angle) * f.radius);
      g.rotation.y = -f.angle + (f.speed > 0 ? Math.PI : 0);
      for (const b of f.birds) {
        const flap = Math.sin(time * (this.theme === 'castle' ? 16 : 9) + b.phase) * 0.7;
        b.wings[0].rotation.z = flap;
        b.wings[1].rotation.z = -flap;
      }
    }
    for (const isl of this.islands) {
      isl.obj.position.y = isl.baseY + Math.sin(time * 0.25 + isl.phase) * 1.2;
    }
    for (const w of this.waterfalls) {
      (w.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 4 + w.id) * 0.08;
    }
    for (const p of this.puffs) {
      p.angle += p.speed * dt;
      const c = this.center;
      p.obj.position.set(c.x + Math.cos(p.angle) * p.radius, p.y, c.z + Math.sin(p.angle) * p.radius);
    }
  }

  private clear() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) {
        const map = (x as THREE.MeshBasicMaterial).map;
        if (map && map !== this.dot && map !== this.mistTex) map.dispose();
        x.dispose();
      }
    });
    this.group.clear();
    this.mist = [];
    this.particles = null;
    this.particleBase = null;
    this.flocks = [];
    this.islands = [];
    this.puffs = [];
    this.waterfalls = [];
    this.backdrop = null;
  }

  dispose() {
    this.clear();
    this.dot?.dispose();
    this.mistTex?.dispose();
    this.scene.remove(this.group);
  }
}
