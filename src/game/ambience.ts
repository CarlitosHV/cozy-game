/**
 * Extra eye candy that scales with the graphics quality (Ajustes → Rendimiento y Gráficos):
 *
 *  - Baja: nothing extra (fastest).
 *  - Media: some floating particles, a flock of birds, a few far islands and ground decor.
 *  - Alta: lots of particles, several flocks, a full ring of far islands with waterfalls and
 *    drifting cloud puffs, and lots of ground decor on every floor.
 *
 * The ground decor depends on the world: flowers and grass in the meadow, cloud tufts and
 * crystals in the sky, glowing crystals and mushrooms in space, reeds and moss in the swamp,
 * tulips and topiaries in the garden, tombstones, candles and dead grass at the castle, and
 * papers, stains and fallen ceiling tiles in the Backrooms.
 *
 * Purely decorative: nothing here collides or takes part in the game.
 */
import * as THREE from 'three';
import type { WorldBuildResult } from './levels';
import { ThemeId } from './progress';

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
  tombTop: () => new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 0.55, 0),
};

const DECOR: Record<ThemeId, DecorKind[]> = {
  cozy: [
    { share: 0.6, parts: [{ geo: G.tuft, colors: [0x6fbf4a, 0x5aa83a] }], scale: [0.7, 1.5], tilt: 0.3, stretch: [0.8, 1.4] },
    { share: 0.32, parts: [{ geo: G.stem(0.3), colors: [0x3f6212] }, { geo: G.head(0.09, 0.3), colors: [0xf9a8d4, 0xfde68a, 0xffffff, 0xc4b5fd] }], scale: [0.8, 1.4], tilt: 0.1 },
    { share: 0.08, parts: [{ geo: G.post(0.035, 0.16), colors: [0xfef3c7] }, { geo: G.cap(0.12, 0.15), colors: [0xef4444, 0xf97316] }], scale: [0.8, 1.5], tilt: 0.15 },
  ],
  aero: [
    { share: 0.35, parts: [{ geo: G.puff, colors: [0xffffff, 0xe0f2fe] }], scale: [0.6, 1.6], tilt: 0 },
    { share: 0.3, parts: [{ geo: G.stem(0.38), colors: [0x86efac] }, { geo: G.ball(0.075, 0.4), colors: [0xffffff], emissive: 0.15 }], scale: [0.8, 1.4], tilt: 0.25 },
    { share: 0.2, parts: [{ geo: G.crystal(0.09, 0.4), colors: [0x7dd3fc, 0xa5f3fc, 0xbae6fd], emissive: 0.25 }], scale: [0.7, 1.8], tilt: 0.35 },
    { share: 0.15, parts: [{ geo: G.tuft, colors: [0x8fd4a8] }], scale: [0.6, 1.2], tilt: 0.5 },
  ],
  cosmic: [
    { share: 0.38, parts: [{ geo: G.crystal(0.1, 0.5), colors: [0xc084fc, 0x67e8f9, 0xf0abfc], emissive: 0.75 }], scale: [0.6, 2.0], tilt: 0.4 },
    { share: 0.27, parts: [{ geo: G.post(0.03, 0.22), colors: [0xe9d5ff] }, { geo: G.cap(0.13, 0.21), colors: [0x22d3ee, 0xa855f7, 0xf472b6], emissive: 0.8 }], scale: [0.7, 1.6], tilt: 0.15 },
    { share: 0.35, parts: [{ geo: G.head(0.05, 0.05), colors: [0xfef08a, 0x67e8f9], emissive: 1 }], scale: [0.6, 1.4], tilt: 0 },
  ],
  swamp: [
    { share: 0.35, parts: [{ geo: () => new THREE.CylinderGeometry(0.014, 0.02, 0.95, 3).translate(0, 0.475, 0), colors: [0x4d7c0f, 0x65a30d] }, { geo: G.post(0.045, 0.2, 0.68), colors: [0x78350f] }], scale: [0.8, 1.5], tilt: 0.18 },
    { share: 0.35, parts: [{ geo: G.puff, colors: [0x3f6212, 0x4d6b3c] }], scale: [0.5, 1.2], tilt: 0.1 },
    { share: 0.2, parts: [{ geo: G.post(0.04, 0.12), colors: [0xd9f99d] }, { geo: G.cap(0.14, 0.11), colors: [0xbef264, 0xfde047], emissive: 0.7 }], scale: [0.6, 1.4], tilt: 0.2 },
    { share: 0.1, parts: [{ geo: G.slab(0.32), colors: [0x14532d], opacity: 0.85 }], scale: [0.7, 1.6], tilt: 0 },
  ],
  garden: [
    { share: 0.3, parts: [{ geo: G.tuft, colors: [0x65a30d, 0x84cc16] }], scale: [0.7, 1.3], tilt: 0.3 },
    { share: 0.3, parts: [{ geo: G.stem(0.32), colors: [0x3f6212] }, { geo: () => new THREE.CylinderGeometry(0.075, 0.045, 0.15, 6).translate(0, 0.38, 0), colors: [0xf472b6, 0xfb7185, 0xfacc15, 0xffffff, 0xa855f7] }], scale: [0.8, 1.3], tilt: 0.1 },
    { share: 0.28, parts: [{ geo: G.stem(0.3), colors: [0x3f6212] }, { geo: G.head(0.09, 0.3), colors: [0xf472b6, 0xfacc15, 0xffffff] }], scale: [0.8, 1.4], tilt: 0.12 },
    { share: 0.12, parts: [{ geo: G.post(0.05, 0.12), colors: [0x78350f] }, { geo: G.ball(0.3, 0.38), colors: [0x4d7c0f, 0x65a30d] }], scale: [0.8, 1.4], tilt: 0 },
  ],
  castle: [
    { share: 0.58, parts: [{ geo: G.tuft, colors: [0x78716c, 0x8a7653, 0x57534e] }], scale: [0.7, 1.5], tilt: 0.55, stretch: [0.7, 1.5] },
    { share: 0.08, parts: [{ geo: () => new THREE.ConeGeometry(0.018, 0.6, 3).translate(0, 0.3, 0), colors: [0x44403c] }], scale: [0.5, 1.0], tilt: 0.9 },
    { share: 0.14, parts: [{ geo: G.post(0.04, 0.24), colors: [0xfef3c7, 0xe7e5e4] }, { geo: G.cone(0.03, 0.08, 0.25), colors: [0xfb923c], emissive: 1 }], scale: [0.7, 1.4], tilt: 0.05, stretch: [0.6, 1.8] },
    { share: 0.1, parts: [{ geo: G.box(0.5, 0.55, 0.12), colors: [0x6b7280, 0x57534e] }, { geo: G.tombTop, colors: [0x6b7280, 0x57534e] }], scale: [0.7, 1.1], tilt: 0.2 },
    { share: 0.1, parts: [{ geo: G.ball(0.09, 0.08), colors: [0xe7e5e4] }], scale: [0.8, 1.3], tilt: 0.3 },
  ],
  backrooms: [
    { share: 0.4, parts: [{ geo: G.box(0.3, 0.004, 0.42, 0.004), colors: [0xfafaf9, 0xfef9c3] }], scale: [0.8, 1.2], tilt: 0.03 },
    { share: 0.25, parts: [{ geo: G.slab(0.5), colors: [0x8a7a3a, 0x6b5f2e], opacity: 0.55 }], scale: [0.6, 2.2], tilt: 0 },
    { share: 0.2, parts: [{ geo: G.box(0.6, 0.03, 0.6, 0.02), colors: [0xe7e0bf, 0xd6cc9c] }], scale: [0.9, 1.1], tilt: 0.12 },
    { share: 0.15, parts: [{ geo: G.post(0.05, 0.22), colors: [0xbae6fd], opacity: 0.8 }, { geo: G.post(0.022, 0.05, 0.22), colors: [0x1d4ed8] }], scale: [0.9, 1.1], tilt: 0 },
  ],
};

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
  private center = new THREE.Vector3();

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
    if (look.indoor) {
      this.buildGroundDecor(world, Math.round(d.flowers * 0.12), rng);
      return;
    }
    this.buildGroundDecor(world, d.flowers, rng);
    this.buildIslands(center, maxR, d.islands, look, rng);
    for (let i = 0; i < d.flocks; i++) this.buildFlock(center, maxR, look, rng, i);
    this.buildPuffs(center, maxR, d.puffs, rng);
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

  /** Ground decor on the floors, picked for this world (one instanced mesh per part and color). */
  private buildGroundDecor(world: WorldBuildResult, count: number, rng: () => number) {
    if (!count) return;
    const indoor = !!LOOK[this.theme].indoor;
    const floors = world.platforms.filter(
      (p) =>
        p.type === 'static' &&
        p.size.x >= 4 &&
        p.size.z >= 4 &&
        p.position.y > -20 &&
        p.position.y < (indoor ? 2 : 60) &&
        !/shield|hatch|cellar|summit_shield|fort_wall|core|rim_|altar|pillar|cover|wall|ceil|roof|mez|shelf/.test(p.id)
    );
    if (!floors.length) return;
    const area = floors.reduce((a, p) => a + p.size.x * p.size.z, 0);
    const pickFloor = () => {
      let x = rng() * area;
      for (const f of floors) {
        x -= f.size.x * f.size.z;
        if (x <= 0) return f;
      }
      return floors[floors.length - 1];
    };
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (const kind of DECOR[this.theme]) {
      const n = Math.round(count * kind.share);
      if (!n) continue;
      // Per part: one instanced mesh per color, filled round-robin
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
        p.set(f.position.x + (rng() - 0.5) * (f.size.x - 0.6), f.position.y + 0.01 + (indoor ? i * 0.00002 : 0), f.position.z + (rng() - 0.5) * (f.size.z - 0.6));
        q.setFromEuler(e.set((rng() - 0.5) * kind.tilt, rng() * Math.PI * 2, (rng() - 0.5) * kind.tilt));
        const k = kind.scale[0] + rng() * (kind.scale[1] - kind.scale[0]);
        const st = kind.stretch ? kind.stretch[0] + rng() * (kind.stretch[1] - kind.stretch[0]) : 1;
        sc.set(k, k * st, k);
        m4.compose(p, q, sc);
        const ci = Math.floor(rng() * 1000);
        meshes.forEach((variants, pi) => {
          // Parts of one decor keep matching colors when they have the same palette size (tombstone body + top)
          const im = variants[(kind.parts[pi].colors.length === kind.parts[0].colors.length ? ci : ci + pi) % variants.length];
          if (im.count < im.instanceMatrix.count) im.setMatrixAt(im.count++, m4);
        });
      }
      for (const variants of meshes)
        for (const im of variants) {
          im.instanceMatrix.needsUpdate = true;
          im.frustumCulled = false;
          im.receiveShadow = true;
          this.group.add(im);
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

  update(dt: number, time: number, focus: THREE.Vector3) {
    if (this.quality === 'low') return;
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
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.group.clear();
    this.particles = null;
    this.particleBase = null;
    this.flocks = [];
    this.islands = [];
    this.puffs = [];
    this.waterfalls = [];
  }

  dispose() {
    this.clear();
    this.dot?.dispose();
    this.scene.remove(this.group);
  }
}
