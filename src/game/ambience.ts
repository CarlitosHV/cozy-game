/**
 * Extra eye candy that scales with the graphics quality (Ajustes → Rendimiento y Gráficos):
 *
 *  - Baja: nothing extra (fastest).
 *  - Media: some floating particles, a flock of birds, a few far islands and flowers on the ground.
 *  - Alta: lots of particles, several flocks, a full ring of far islands with waterfalls and
 *    drifting cloud puffs, and many flowers and grass tufts on every floor.
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
}

const LOOK: Record<ThemeId, ThemeLook> = {
  cozy: { particle: 0xfff7d6, particle2: 0xffc8dd, motion: 'fall', island: 0x86c26b, rock: 0xa08a7a, flowers: [0xf9a8d4, 0xfde68a, 0xffffff, 0xc4b5fd], grass: 0x6fbf4a, bird: 0x44403c },
  aero: { particle: 0xbae6fd, particle2: 0xffffff, motion: 'float', island: 0xe0f2fe, rock: 0x6fb7dc, flowers: [0x7dd3fc, 0xffffff, 0xa5f3fc], grass: 0x8fd4a8, bird: 0x1e3a8a },
  cosmic: { particle: 0xc4b5fd, particle2: 0x67e8f9, motion: 'float', island: 0x5b4b8a, rock: 0x6d6a8f, flowers: [0xc084fc, 0x67e8f9, 0xf0abfc], grass: 0x7c6fcf, bird: 0xe9d5ff },
  swamp: { particle: 0xd9f99d, particle2: 0xfde047, motion: 'float', island: 0x4d6b3c, rock: 0x55604a, flowers: [0xbef264, 0xfde047, 0xa3e635], grass: 0x4f772d, bird: 0x1c1917 },
  garden: { particle: 0xfbcfe8, particle2: 0xffffff, motion: 'fall', island: 0x7cc46b, rock: 0x9ca3af, flowers: [0xf472b6, 0xfb7185, 0xfacc15, 0xffffff], grass: 0x65a30d, bird: 0x57534e },
  castle: { particle: 0xfb923c, particle2: 0xfde68a, motion: 'rise', island: 0x3f3a4a, rock: 0x4b4458, flowers: [0xdc2626, 0x7c3aed, 0x1f2937], grass: 0x3f4f2f, bird: 0x0c0a09 },
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
    this.buildFlowers(world, d.flowers, look, rng);
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

  /** Flowers and grass tufts on the floors (one instanced mesh per kind). */
  private buildFlowers(world: WorldBuildResult, count: number, look: ThemeLook, rng: () => number) {
    if (!count) return;
    const floors = world.platforms.filter(
      (p) =>
        p.type === 'static' &&
        p.size.x >= 4 &&
        p.size.z >= 4 &&
        p.position.y > -20 &&
        p.position.y < 60 &&
        !/shield|hatch|cellar|summit_shield|fort_wall|core|rim_|altar|pillar|cover|wall/.test(p.id)
    );
    if (!floors.length) return;
    const area = floors.reduce((a, p) => a + p.size.x * p.size.z, 0);
    const grassGeo = new THREE.ConeGeometry(0.06, 0.38, 3);
    grassGeo.translate(0, 0.19, 0);
    const petalGeo = new THREE.IcosahedronGeometry(0.09, 0);
    petalGeo.translate(0, 0.3, 0);
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 3);
    stemGeo.translate(0, 0.15, 0);
    const grassMat = new THREE.MeshLambertMaterial({ color: look.grass });
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x3f6212 });
    const flowerMats = look.flowers.map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: this.theme === 'cosmic' || this.theme === 'swamp' ? 0.6 : 0.08 }));
    const nGrass = Math.round(count * 0.65);
    const nFlower = count - nGrass;
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, nGrass);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, nFlower);
    const heads = flowerMats.map((m) => new THREE.InstancedMesh(petalGeo, m, Math.ceil(nFlower / flowerMats.length)));
    const headN = heads.map(() => 0);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const pickFloor = () => {
      let x = rng() * area;
      for (const f of floors) {
        x -= f.size.x * f.size.z;
        if (x <= 0) return f;
      }
      return floors[floors.length - 1];
    };
    const spot = () => {
      const f = pickFloor();
      p.set(f.position.x + (rng() - 0.5) * (f.size.x - 0.6), f.position.y + 0.01, f.position.z + (rng() - 0.5) * (f.size.z - 0.6));
      return p;
    };
    for (let i = 0; i < nGrass; i++) {
      spot();
      q.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3));
      const k = 0.7 + rng() * 0.8;
      s.set(k, k * (0.8 + rng() * 0.6), k);
      grass.setMatrixAt(i, m4.compose(p, q, s));
    }
    for (let i = 0; i < nFlower; i++) {
      spot();
      q.identity();
      const k = 0.8 + rng() * 0.6;
      s.set(k, k, k);
      m4.compose(p, q, s);
      stems.setMatrixAt(i, m4);
      const h = i % heads.length;
      if (headN[h] < heads[h].count) heads[h].setMatrixAt(headN[h]++, m4);
    }
    heads.forEach((h, i) => (h.count = headN[i]));
    for (const im of [grass, stems, ...heads]) {
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      im.receiveShadow = true;
      this.group.add(im);
    }
  }

  /** Far floating islands (some with waterfalls) around the world. */
  private buildIslands(center: THREE.Vector3, maxR: number, count: number, look: ThemeLook, rng: () => number) {
    if (!count) return;
    const topMat = new THREE.MeshLambertMaterial({ color: look.island, flatShading: true });
    const rockMat = new THREE.MeshLambertMaterial({ color: look.rock, flatShading: true });
    const waterMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, depthWrite: false });
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
      // A couple of round trees on top
      for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) {
        const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(size * (0.15 + rng() * 0.12), 0), topMat);
        tr.position.set((rng() - 0.5) * size, size * 0.35, (rng() - 0.5) * size);
        g.add(tr);
      }
      if (this.quality === 'high' && rng() < 0.45) {
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
    wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.12, 0, 0, -0.12, 0.55, 0, 0]), 3));
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
        const flap = Math.sin(time * 9 + b.phase) * 0.7;
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
