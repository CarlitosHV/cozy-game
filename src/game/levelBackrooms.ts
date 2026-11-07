/**
 * "Los Backrooms" (levels 15, 25, 35…): you no-clipped out of reality.
 *
 *  1. Nivel 0 — an endless-looking maze of yellow rooms: damp carpet, stained wallpaper and
 *     humming fluorescent lamps (a new maze every time).
 *  2. El almacén — a huge concrete warehouse with pits in the floor, shelves and a mezzanine you
 *     reach by climbing crates. Every few seconds the lights go out…
 *  3. ¡Corre! — a long corridor under red emergency lights, with gaps and hurdles, to the EXIT.
 *
 * Monsters (original creepypasta-style creatures; being caught sends you back to the last
 * checkpoint and counts as a death):
 *  - Maniquí: only moves while you're not looking at it. Keep it in view.
 *  - Gateador: crawls around the maze; if it hears you close by it chases you (run!).
 *  - La Sonrisa: lives in the warehouse dark; it only comes out when the lights go off.
 *  - El Corredor: wakes up behind you in the red corridor. Sprint to the exit.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import { createLevelKit } from './levelKit';
import { EnemyManager } from './enemies';
import type { LevelHazardContext, LevelHazards, WorldBuildResult } from './levels';
import type { ProceduralTextures } from './textures';
import type { Builder } from './levelThemes';
import type { ItemSpot } from './items';
import type { BossSetup } from './bossArena';
import type { VictoryPortalModel } from './models';
import { BOSS_INFO } from './progress';

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

// ---------------------------------------------------------------- Textures

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function speckle(g: CanvasRenderingContext2D, s: number, n: number, color: string, r: number) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) g.fillRect(Math.random() * s, Math.random() * s, r, r);
}

const wallpaperTex = () =>
  canvasTex(128, (g, s) => {
    g.fillStyle = '#d9c56b';
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      g.fillStyle = '#ccb65c';
      g.fillRect(x, 0, 6, s);
      g.fillStyle = 'rgba(255,248,200,0.35)';
      g.fillRect(x + 9, 0, 1, s);
    }
    // little chevrons
    g.strokeStyle = 'rgba(150,120,40,0.35)';
    g.lineWidth = 1;
    for (let y = 8; y < s; y += 16)
      for (let x = 11; x < s; x += 16) {
        g.beginPath();
        g.moveTo(x - 2, y);
        g.lineTo(x, y - 2);
        g.lineTo(x + 2, y);
        g.stroke();
      }
    speckle(g, s, 260, 'rgba(120,95,30,0.12)', 2);
    // a damp stain
    const grad = g.createRadialGradient(s * 0.7, s * 0.85, 2, s * 0.7, s * 0.85, s * 0.35);
    grad.addColorStop(0, 'rgba(110,85,30,0.28)');
    grad.addColorStop(1, 'rgba(110,85,30,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });

const carpetTex = () =>
  canvasTex(128, (g, s) => {
    g.fillStyle = '#a58f55';
    g.fillRect(0, 0, s, s);
    speckle(g, s, 2600, 'rgba(70,55,25,0.18)', 1);
    speckle(g, s, 1400, 'rgba(230,210,150,0.12)', 1);
    const grad = g.createRadialGradient(s * 0.3, s * 0.4, 2, s * 0.3, s * 0.4, s * 0.3);
    grad.addColorStop(0, 'rgba(60,48,20,0.3)');
    grad.addColorStop(1, 'rgba(60,48,20,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });

const ceilingTex = () =>
  canvasTex(128, (g, s) => {
    g.fillStyle = '#e6dcb6';
    g.fillRect(0, 0, s, s);
    speckle(g, s, 900, 'rgba(120,110,80,0.14)', 1);
    g.fillStyle = '#9d9478';
    g.fillRect(0, 0, s, 3);
    g.fillRect(0, 0, 3, s);
  });

const concreteTex = () =>
  canvasTex(128, (g, s) => {
    g.fillStyle = '#8d8a80';
    g.fillRect(0, 0, s, s);
    speckle(g, s, 3000, 'rgba(40,40,40,0.12)', 1);
    speckle(g, s, 1500, 'rgba(255,255,255,0.08)', 1);
    g.strokeStyle = 'rgba(50,50,50,0.35)';
    g.strokeRect(0, 0, s, s);
  });

const exitTex = () => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0f5132';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#7dffb0';
  g.font = 'bold 54px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SALIDA', 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Box whose UVs are in world units (one texture tile = `unit` meters) so walls don't stretch. */
function boxUV(w: number, h: number, d: number, unit: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // faces: +x, -x, +y, -y, +z, -z (4 vertices each)
  const spans: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * spans[f][0]) / unit, (uv.getY(i) * spans[f][1]) / unit);
    }
  return geo;
}

// ---------------------------------------------------------------- Monster models

interface MonsterModel {
  group: THREE.Group;
  anim: (t: number, moving: boolean, dt: number) => void;
}

function mannequinModel(): MonsterModel {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: 0.35, metalness: 0.05 });
  const joint = new THREE.MeshStandardMaterial({ color: 0xcdbfa6, roughness: 0.5 });
  const part = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  part(new THREE.CapsuleGeometry(0.22, 0.55, 4, 10), skin, 0, 1.35, 0);
  const head = part(new THREE.SphereGeometry(0.18, 16, 12), skin, 0, 1.98, 0);
  head.scale.set(0.85, 1.15, 0.9);
  part(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), joint, 0, 1.8, 0);
  const limbs: THREE.Group[] = [];
  const limb = (x: number, y: number, len: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    part(new THREE.SphereGeometry(0.07, 8, 6), joint, 0, 0, 0, pivot);
    const seg = part(new THREE.CapsuleGeometry(0.06, len, 4, 8), skin, 0, -len / 2 - 0.05, 0, pivot);
    seg.castShadow = true;
    g.add(pivot);
    limbs.push(pivot);
  };
  limb(0.3, 1.6, 0.55);
  limb(-0.3, 1.6, 0.55);
  limb(0.12, 0.98, 0.78);
  limb(-0.12, 0.98, 0.78);
  // The pose snaps into a new one every time it moves while you're not looking
  let snapT = 0;
  return {
    group: g,
    anim: (_t, moving, dt) => {
      if (!moving) return;
      snapT -= dt;
      if (snapT > 0) return;
      snapT = 0.35;
      for (const l of limbs) l.rotation.set((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 0.8);
      head.rotation.z = (Math.random() - 0.5) * 0.9;
    },
  };
}

function crawlerModel(scale: number, eyeColor: number): MonsterModel {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.8, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 });
  const eyes = new THREE.MeshBasicMaterial({ color: eyeColor });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8), skin);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.85, 0.72);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin);
  skull.scale.set(1, 0.85, 1.1);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 16, Math.PI), dark);
  mouth.position.set(0, -0.06, 0.18);
  mouth.rotation.z = Math.PI;
  head.add(skull, mouth);
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyes);
    e.position.set(0.07 * s, 0.05, 0.18);
    head.add(e);
  }
  g.add(head);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [
    [0.2, 0.45],
    [-0.2, 0.45],
    [0.2, -0.45],
    [-0.2, -0.45],
  ]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.8, z);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.55, 4, 6), skin);
    upper.position.set(Math.sign(x) * 0.22, -0.05, 0);
    upper.rotation.z = Math.sign(x) * 1.2;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.6, 4, 6), skin);
    lower.position.set(Math.sign(x) * 0.45, -0.42, 0);
    lower.rotation.z = -Math.sign(x) * 0.25;
    upper.castShadow = lower.castShadow = true;
    hip.add(upper, lower);
    g.add(hip);
    legs.push(hip);
  }
  g.scale.setScalar(scale);
  return {
    group: g,
    anim: (t, moving) => {
      const sp = moving ? 14 : 2;
      legs.forEach((l, i) => {
        l.rotation.y = Math.sin(t * sp + i * Math.PI * 0.5) * (moving ? 0.5 : 0.08);
        l.position.y = 0.8 + Math.max(0, Math.sin(t * sp + i * Math.PI * 0.5)) * (moving ? 0.08 : 0);
      });
      head.rotation.z = Math.sin(t * (moving ? 9 : 1.3)) * 0.25;
      body.position.y = 0.75 + Math.sin(t * sp * 2) * (moving ? 0.03 : 0.01);
    },
  };
}

function smileModel(): MonsterModel & { mats: THREE.Material[] } {
  const g = new THREE.Group();
  const shadow = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.85, depthWrite: false });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 2), shadow);
  blob.position.y = 1.4;
  blob.scale.set(1, 1.25, 0.8);
  g.add(blob);
  const face = new THREE.Group();
  face.position.set(0, 1.55, 0.72);
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glow);
    eye.position.set(0.25 * s, 0.25, 0);
    eye.scale.set(1, 0.6, 0.4);
    face.add(eye);
  }
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 28, Math.PI * 0.9), glow);
  grin.rotation.z = Math.PI + Math.PI * 0.05;
  grin.position.y = 0.0;
  face.add(grin);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + Math.PI * 0.1 + (i / 8) * Math.PI * 0.8;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), glow);
    tooth.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4 + 0.06, 0);
    face.add(tooth);
  }
  g.add(face);
  return {
    group: g,
    mats: [shadow, glow],
    anim: (t) => {
      blob.scale.set(1 + Math.sin(t * 3) * 0.05, 1.25 + Math.sin(t * 2.3) * 0.06, 0.8);
      face.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
    },
  };
}

// ---------------------------------------------------------------- Maze

const C = 7; // cell size (m)
const NX = 8;
const NZ = 7;
const X0 = -(NX * C) / 2; // -28
const Z0 = 0;
const WALL_H = 4.6;
const cellCenter = (i: number, j: number) => new THREE.Vector3(X0 + (i + 0.5) * C, 0, Z0 + (j + 0.5) * C);
const cellOf = (p: THREE.Vector3): [number, number] | null => {
  const i = Math.floor((p.x - X0) / C);
  const j = Math.floor((p.z - Z0) / C);
  return i >= 0 && j >= 0 && i < NX && j < NZ ? [i, j] : null;
};

interface Maze {
  /** open[i][j] = [east, north] passages */
  east: boolean[][];
  north: boolean[][];
}

function makeMaze(rng: () => number): Maze {
  const east = Array.from({ length: NX }, () => new Array<boolean>(NZ).fill(false));
  const north = Array.from({ length: NX }, () => new Array<boolean>(NZ).fill(false));
  const seen = Array.from({ length: NX }, () => new Array<boolean>(NZ).fill(false));
  const stack: [number, number][] = [[3, 0]];
  seen[3][0] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const opts: [number, number][] = [];
    if (i > 0 && !seen[i - 1][j]) opts.push([i - 1, j]);
    if (i < NX - 1 && !seen[i + 1][j]) opts.push([i + 1, j]);
    if (j > 0 && !seen[i][j - 1]) opts.push([i, j - 1]);
    if (j < NZ - 1 && !seen[i][j + 1]) opts.push([i, j + 1]);
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const [ni, nj] = opts[Math.floor(rng() * opts.length)];
    if (ni > i) east[i][j] = true;
    else if (ni < i) east[ni][nj] = true;
    else if (nj > j) north[i][j] = true;
    else north[ni][nj] = true;
    seen[ni][nj] = true;
    stack.push([ni, nj]);
  }
  // The Backrooms are roomy: knock down extra walls so there are loops and open halls
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NZ; j++) {
      if (i < NX - 1 && !east[i][j] && rng() < 0.3) east[i][j] = true;
      if (j < NZ - 1 && !north[i][j] && rng() < 0.3) north[i][j] = true;
    }
  return { east, north };
}

function neighbors(m: Maze, i: number, j: number): [number, number][] {
  const out: [number, number][] = [];
  if (i < NX - 1 && m.east[i][j]) out.push([i + 1, j]);
  if (i > 0 && m.east[i - 1][j]) out.push([i - 1, j]);
  if (j < NZ - 1 && m.north[i][j]) out.push([i, j + 1]);
  if (j > 0 && m.north[i][j - 1]) out.push([i, j - 1]);
  return out;
}

/** Next cell on the shortest path from a to b, and the distance in cells (-1 = unreachable). */
function bfs(m: Maze, a: [number, number], b: [number, number]): { next: [number, number]; dist: number } {
  if (a[0] === b[0] && a[1] === b[1]) return { next: a, dist: 0 };
  const key = (i: number, j: number) => i * 100 + j;
  const prev = new Map<number, number>([[key(a[0], a[1]), -1]]);
  const q: [number, number][] = [a];
  let found = false;
  for (let h = 0; h < q.length && !found; h++) {
    const [i, j] = q[h];
    for (const [ni, nj] of neighbors(m, i, j)) {
      const k = key(ni, nj);
      if (prev.has(k)) continue;
      prev.set(k, key(i, j));
      if (ni === b[0] && nj === b[1]) {
        found = true;
        break;
      }
      q.push([ni, nj]);
    }
  }
  if (!found) return { next: a, dist: -1 };
  // Walk back from b to the cell right after a
  let k = key(b[0], b[1]);
  let dist = 1;
  while (prev.get(k) !== key(a[0], a[1])) {
    k = prev.get(k)!;
    dist++;
  }
  return { next: [Math.floor(k / 100), k % 100], dist };
}

// ---------------------------------------------------------------- Monsters

type MonsterKind = 'maniqui' | 'gateador' | 'sonrisa' | 'corredor';
const NAMES: Record<MonsterKind, string> = { maniqui: 'el Maniquí', gateador: 'el Gateador', sonrisa: 'la Sonrisa', corredor: 'el Corredor' };

interface Monster {
  kind: MonsterKind;
  model: MonsterModel;
  pos: THREE.Vector3;
  home: THREE.Vector3;
  yaw: number;
  /** Gateador: chasing; Sonrisa: hunting; Corredor: awake */
  active: boolean;
  target: THREE.Vector3 | null;
  wanderT: number;
  seenT: number;
  seen: boolean;
  fade: number;
  mats?: THREE.Material[];
}

class BackroomsHazards implements LevelHazards {
  public darkness = 0;
  private monsters: Monster[] = [];
  private maze: Maze;
  private walls: THREE.Object3D[];
  private ware: { minX: number; maxX: number; minZ: number; maxZ: number };
  private corridor: { x: number; z0: number; z1: number; y: number };
  private blackoutT = 12;
  private darkT = 0;
  private grace = 0;
  private warnCd = 0;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private ray = new THREE.Raycaster();
  private rng = Math.random;
  private flickerMats: THREE.MeshBasicMaterial[];

  constructor(
    maze: Maze,
    walls: THREE.Object3D[],
    ware: BackroomsHazards['ware'],
    corridor: BackroomsHazards['corridor'],
    flickerMats: THREE.MeshBasicMaterial[]
  ) {
    this.maze = maze;
    this.walls = walls;
    this.ware = ware;
    this.corridor = corridor;
    this.flickerMats = flickerMats;
  }

  add(root: THREE.Object3D, kind: MonsterKind, at: THREE.Vector3) {
    const model =
      kind === 'maniqui' ? mannequinModel() : kind === 'gateador' ? crawlerModel(1, 0xf5f5dc) : kind === 'corredor' ? crawlerModel(1.25, 0xff3030) : smileModel();
    model.group.position.copy(at);
    root.add(model.group);
    const m: Monster = { kind, model, pos: at.clone(), home: at.clone(), yaw: 0, active: false, target: null, wanderT: 0, seenT: 0, seen: false, fade: kind === 'sonrisa' ? 0 : 1 };
    if (kind === 'sonrisa') m.mats = (model as ReturnType<typeof smileModel>).mats;
    if (kind === 'corredor') model.group.visible = false;
    this.monsters.push(m);
  }

  reset() {
    for (const m of this.monsters) {
      m.pos.copy(m.home);
      m.active = false;
      m.target = null;
      m.wanderT = 0;
      m.fade = m.kind === 'sonrisa' ? 0 : 1;
      m.model.group.position.copy(m.home);
      if (m.kind === 'corredor') m.model.group.visible = false;
    }
    this.blackoutT = 12;
    this.darkT = 0;
    this.darkness = 0;
    this.grace = 2;
  }

  syncObjects() {
    return this.monsters.map((m) => ({ obj: m.model.group as THREE.Object3D, pos: m.pos }));
  }

  private inMaze(p: THREE.Vector3) {
    return cellOf(p) !== null && p.y < 3;
  }

  private inWarehouse(p: THREE.Vector3) {
    const w = this.ware;
    return p.x > w.minX && p.x < w.maxX && p.z > w.minZ && p.z < w.maxZ;
  }

  /** You can see it: inside the camera view and not hidden behind a wall. */
  private visible(m: Monster, cam: THREE.Camera): boolean {
    const center = new THREE.Vector3(m.pos.x, m.pos.y + 1.2, m.pos.z);
    if (!this.frustum.containsPoint(center)) return false;
    const from = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const dir = center.clone().sub(from);
    const dist = dir.length();
    if (dist > 45) return false;
    this.ray.set(from, dir.normalize());
    this.ray.far = dist;
    return this.ray.intersectObjects(this.walls, false).length === 0;
  }

  private moveTo(m: Monster, goal: THREE.Vector3, speed: number, dt: number) {
    const dx = goal.x - m.pos.x;
    const dz = goal.z - m.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) return true;
    const step = Math.min(d, speed * dt);
    m.pos.x += (dx / d) * step;
    m.pos.z += (dz / d) * step;
    m.yaw = Math.atan2(dx, dz);
    return d - step < 0.05;
  }

  /** Walks the maze cell by cell toward a point. */
  private mazeStep(m: Monster, goal: THREE.Vector3, speed: number, dt: number) {
    const a = cellOf(m.pos);
    const b = cellOf(goal);
    if (!a || !b) return this.moveTo(m, m.home, speed, dt);
    const r = bfs(this.maze, a, b);
    if (r.dist <= 0) return this.moveTo(m, goal, speed, dt);
    const c = cellCenter(r.next[0], r.next[1]);
    // cut corners a little: aim between the current cell's center line and the next cell
    return this.moveTo(m, c, speed, dt);
  }

  private cellDist(a: THREE.Vector3, b: THREE.Vector3): number {
    const ca = cellOf(a);
    const cb = cellOf(b);
    if (!ca || !cb) return 99;
    const r = bfs(this.maze, ca, cb);
    return r.dist < 0 ? 99 : r.dist;
  }

  update(dt: number, time: number, ctx: LevelHazardContext) {
    const P = ctx.position;
    this.grace = Math.max(0, this.grace - dt);
    this.warnCd = Math.max(0, this.warnCd - dt);
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m4);
    const lure = ctx.lure;
    const target = lure ?? P;

    // ---- Warehouse blackouts (lights flicker, then go out for a few seconds) ----
    const inWare = this.inWarehouse(P);
    if (inWare && !ctx.spectating) {
      if (this.darkT > 0) {
        this.darkT -= dt;
        this.darkness = 0.88;
        if (this.darkT <= 0) {
          this.blackoutT = 9 + this.rng() * 7;
          soundManager.playCheckpoint();
        }
      } else {
        this.blackoutT -= dt;
        // flicker warning during the last 1.4 s
        this.darkness = this.blackoutT < 1.4 && Math.sin(time * 38) > 0.2 ? 0.55 : 0;
        if (this.blackoutT <= 0) {
          this.darkT = 3.4;
          soundManager.playStalkerWarning();
        }
      }
    } else {
      this.darkness = Math.max(0, this.darkness - dt * 3);
      this.darkT = 0;
      this.blackoutT = Math.max(this.blackoutT, 6);
    }
    // Some lamps in the maze flicker on their own
    const fl = Math.sin(time * 23) * Math.sin(time * 7.3) > 0.55 ? 0x3a3520 : 0xfffbe6;
    this.flickerMats[0]?.color.setHex(fl);
    this.flickerMats[1]?.color.setHex(Math.sin(time * 1.7) > 0.93 ? 0x2a2614 : 0xfffbe6);

    for (const m of this.monsters) {
      let moving = false;
      if (m.kind === 'maniqui') {
        // Moves only while you're not looking (checked a few times a second)
        m.seenT -= dt;
        if (m.seenT <= 0) {
          m.seenT = 0.12;
          m.seen = this.visible(m, cam);
        }
        const near = this.inMaze(P) && this.cellDist(m.pos, P) <= 7;
        if (!m.seen && near && !ctx.spectating) {
          this.mazeStep(m, target, 4.4, dt);
          moving = true;
          if (this.rng() < dt * 1.5 && m.pos.distanceTo(P) < 14) soundManager.playFootstep();
        }
      } else if (m.kind === 'gateador') {
        const d = this.inMaze(P) && !ctx.spectating ? this.cellDist(m.pos, P) : 99;
        if (!m.active && d <= 2) {
          m.active = true;
          if (this.warnCd <= 0) {
            this.warnCd = 8;
            soundManager.playStalkerWarning();
            ctx.notify('¡El Gateador te oyó! Corre (Shift) y no te metas a un callejón sin salida');
          }
        } else if (m.active && d > 5) m.active = false;
        if (m.active || lure) {
          this.mazeStep(m, target, lure ? 4 : 5.9, dt);
          moving = true;
        } else {
          m.wanderT -= dt;
          if (!m.target || m.wanderT <= 0) {
            m.target = cellCenter(Math.floor(this.rng() * NX), Math.floor(this.rng() * NZ));
            m.wanderT = 8;
          }
          if (this.mazeStep(m, m.target, 2.2, dt) && m.pos.distanceTo(m.target) < 0.2) m.wanderT = 0;
          moving = true;
        }
      } else if (m.kind === 'sonrisa') {
        const hunting = this.darkness > 0.8 && inWare && !ctx.spectating && m.pos.distanceTo(P) < 18;
        m.fade += ((this.darkness > 0.5 ? 1 : 0) - m.fade) * Math.min(1, dt * 4);
        if (hunting) {
          this.moveTo(m, target, 6.6, dt);
          moving = true;
        } else if (this.darkness < 0.3) {
          this.moveTo(m, m.home, 3, dt);
        }
        for (const mat of m.mats ?? []) (mat as THREE.MeshBasicMaterial).opacity = (mat === m.mats![0] ? 0.85 : 1) * m.fade;
        m.model.group.visible = m.fade > 0.03;
        m.pos.y = m.home.y + Math.sin(time * 2 + m.home.x) * 0.15;
      } else if (m.kind === 'corredor') {
        const c = this.corridor;
        const inCorr = Math.abs(P.x - c.x) < 3 && P.z > c.z0 && P.z < c.z1 + 2 && P.y > c.y - 1.5;
        if (!m.active && inCorr && P.z > c.z0 + 7 && !ctx.spectating) {
          m.active = true;
          m.pos.copy(m.home);
          m.model.group.visible = true;
          soundManager.playStalkerWarning();
          ctx.notify('¡Algo despertó detrás de ti! ¡CORRE hasta la SALIDA!');
        }
        if (m.active) {
          if (!inCorr && !ctx.spectating) {
            m.active = false;
            m.model.group.visible = false;
            m.pos.copy(m.home);
          } else {
            this.moveTo(m, new THREE.Vector3(c.x, 0, Math.max(m.pos.z, P.z)), 8.3, dt);
            m.pos.y = c.y;
            moving = true;
          }
        }
      }
      m.model.anim(time, moving, dt);
      m.model.group.position.copy(m.pos);
      m.model.group.rotation.y = m.yaw;

      // Caught!
      const dangerous = m.kind === 'sonrisa' ? m.fade > 0.6 : m.kind === 'corredor' ? m.active : true;
      if (dangerous && this.grace <= 0 && !ctx.spectating) {
        const dx = m.pos.x - P.x;
        const dz = m.pos.z - P.z;
        if (dx * dx + dz * dz < (m.kind === 'sonrisa' ? 1.1 : 0.85) ** 2 && Math.abs(m.pos.y - P.y) < 1.8) {
          this.grace = 2.5;
          ctx.caught(`¡Te atrapó ${NAMES[m.kind]}!`);
          // Everyone goes back home so you don't get caught again right away
          for (const o of this.monsters) {
            if (o.pos.distanceTo(P) < 12 || o === m) {
              o.pos.copy(o.home);
              o.active = false;
              if (o.kind === 'corredor') o.model.group.visible = false;
            }
          }
          this.darkT = 0;
          this.blackoutT = 8;
        }
      }
    }
  }
}


/** Materials, builders and helpers shared by the Backrooms levels and the Skinwalker hall. */
function backroomsParts(kit: ReturnType<typeof createLevelKit>, root: THREE.Object3D, textures: ProceduralTextures, cameraColliders: THREE.Object3D[]) {
  // ---- Materials ----
  const wallTex = wallpaperTex();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const carpetMat = new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: 1 });
  const ceilTex = ceilingTex();
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95, side: THREE.DoubleSide, emissive: 0x2a2614, emissiveIntensity: 0.4 });
  const concTex = concreteTex();
  const concMat = new THREE.MeshStandardMaterial({ map: concTex, roughness: 0.95 });
  const crateMat = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0xc2a070, roughness: 0.85 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.5, metalness: 0.6 });
  const lampOn = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  const lampFlickA = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  const lampFlickB = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  const redLamp = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

  const build =
    (mat: THREE.Material, unit: number, collide = true): Builder =>
    (g, w, d, h) => {
      const m = new THREE.Mesh(boxUV(w, h, d, unit), mat);
      m.position.y = -h / 2;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      if (collide) cameraColliders.push(m);
    };
  const wallB = build(wallMat, 1.6);
  const carpetB = build(carpetMat, 2.2, false);
  const concB = build(concMat, 2.5, false);
  const concWallB = build(concMat, 2.5);
  const crateB = build(crateMat, 1.2);
  const metalB = build(metalMat, 2);

  const wall = (id: string, x0: number, z0: number, x1: number, z1: number, top = WALL_H, bottom = -0.5, b = wallB) => {
    const sx = Math.max(0.4, Math.abs(x1 - x0) + (x1 !== x0 ? 0.4 : 0));
    const sz = Math.max(0.4, Math.abs(z1 - z0) + (z1 !== z0 ? 0.4 : 0));
    kit.addPlatform(id, (x0 + x1) / 2, top, (z0 + z1) / 2, sx, sz, top - bottom, b).solid = true;
  };
  const ceiling = (x0: number, z0: number, x1: number, z1: number, y: number, mat = ceilMat, unit = 1.2) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / unit, (uv.getY(i) * d) / unit);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    root.add(m);
    cameraColliders.push(m);
  };

  return { wallMat, carpetMat, ceilMat, concMat, crateMat, metalMat, lampOn, lampFlickA, lampFlickB, redLamp, build, wallB, carpetB, concB, concWallB, crateB, metalB, wall, ceiling };
}

// ---------------------------------------------------------------- Level

export function buildBackroomsWorld(level: number, root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const rng = mulberry32(level * 6151 + 99);
  const diff = Math.min(1, Math.max(0, (level - 15) / 40));
  const kit = createLevelKit(root, textures);
  const enemies = new EnemyManager(root, textures);
  const cameraColliders: THREE.Object3D[] = [];

  const P = backroomsParts(kit, root, textures, cameraColliders);
  const { wallMat, ceilMat, concMat, crateMat, metalMat, lampOn, lampFlickA, lampFlickB, redLamp } = P;
  const { carpetB, concB, concWallB, crateB, metalB, wall, ceiling } = P;

  // ======================================================================
  // 1. NIVEL 0 — the yellow maze
  // ======================================================================
  const maze = makeMaze(rng);
  const XE = X0 + NX * C;
  const ZE = Z0 + NZ * C;
  const exitI = 1 + Math.floor(rng() * (NX - 2));
  const exitX = X0 + (exitI + 0.5) * C;

  // Floors (start room + maze)
  kit.addPlatform('br_start_floor', 0, 0, -4.5, 14, 9, 1, carpetB);
  kit.addPlatform('br_maze_floor', 0, 0, (Z0 + ZE) / 2, NX * C, NZ * C, 1, carpetB);
  // Start room walls
  wall('br_start_w', -7, -9, -7, 0);
  wall('br_start_e', 7, -9, 7, 0);
  wall('br_start_s', -7, -9, 7, -9);
  // Outer walls (gap to the start room and the exit)
  wall('br_maze_s1', X0, Z0, -7, Z0);
  wall('br_maze_s2', 7, Z0, XE, Z0);
  wall('br_maze_w', X0, Z0, X0, ZE);
  wall('br_maze_e', XE, Z0, XE, ZE);
  wall('br_maze_n1', X0, ZE, exitX - 1.6, ZE);
  wall('br_maze_n2', exitX + 1.6, ZE, XE, ZE);
  // Inner walls, merged along each line
  let wn = 0;
  for (let j = 0; j < NZ - 1; j++) {
    let start = -1;
    for (let i = 0; i <= NX; i++) {
      const closed = i < NX && !maze.north[i][j];
      if (closed && start < 0) start = i;
      if (!closed && start >= 0) {
        wall(`br_h${wn++}`, X0 + start * C, Z0 + (j + 1) * C, X0 + i * C, Z0 + (j + 1) * C);
        start = -1;
      }
    }
  }
  for (let i = 0; i < NX - 1; i++) {
    let start = -1;
    for (let j = 0; j <= NZ; j++) {
      const closed = j < NZ && !maze.east[i][j];
      if (closed && start < 0) start = j;
      if (!closed && start >= 0) {
        wall(`br_v${wn++}`, X0 + (i + 1) * C, Z0 + start * C, X0 + (i + 1) * C, Z0 + j * C);
        start = -1;
      }
    }
  }
  ceiling(-7, -9, 7, 0, WALL_H);
  ceiling(X0, Z0, XE, ZE, WALL_H);
  // Lamps: one per cell (some flicker)
  const lampGeo = new THREE.PlaneGeometry(1.4, 0.7);
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NZ; j++) {
      const c = cellCenter(i, j);
      const r = rng();
      const lamp = new THREE.Mesh(lampGeo, r < 0.1 ? lampFlickA : r < 0.18 ? lampFlickB : lampOn);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(c.x, WALL_H - 0.02, c.z);
      root.add(lamp);
    }
  const startLamp = new THREE.Mesh(lampGeo, lampOn);
  startLamp.rotation.x = Math.PI / 2;
  startLamp.position.set(0, WALL_H - 0.02, -4.5);
  root.add(startLamp);
  // A few office leftovers: wet floor sign, a lonely chair
  const deco = (x: number, z: number) => {
    const sign = new THREE.Group();
    const yel = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.03), yel);
    a.position.set(0, 0.37, 0.12);
    a.rotation.x = -0.25;
    const b = a.clone();
    b.position.z = -0.12;
    b.rotation.x = 0.25;
    sign.add(a, b);
    sign.position.set(x, 0, z);
    sign.rotation.y = rng() * Math.PI;
    root.add(sign);
  };
  for (let k = 0; k < 4; k++) {
    const c = cellCenter(Math.floor(rng() * NX), 1 + Math.floor(rng() * (NZ - 1)));
    deco(c.x + (rng() - 0.5) * 3, c.z + (rng() - 0.5) * 3);
  }

  kit.addCheckpoint(1, 'Nivel 0', new THREE.Vector3(4.5, 0, -7.5), new THREE.Vector3(0, 0.2, -5.5), true);

  // Relics in dead ends (cells with a single way out)
  const deadEnds: [number, number][] = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (neighbors(maze, i, j).length === 1 && !(j === 0 && (i === 3 || i === 4))) deadEnds.push([i, j]);
  const shuffled = (arr: [number, number][]) => arr.sort(() => rng() - 0.5);
  let relicN = 0;
  const relic = (x: number, y: number, z: number) => {
    kit.addCollectible(`br${relicN}`, relicN % 3 === 0 ? 'golden_acorn' : 'sun_crystal', x, y + 1.2, z);
    relicN++;
  };
  const pool = shuffled(deadEnds.length >= 6 ? deadEnds : [...deadEnds, ...Array.from({ length: 6 }, () => [Math.floor(rng() * NX), 1 + Math.floor(rng() * (NZ - 1))] as [number, number])]);
  for (const [i, j] of pool.slice(0, 6)) {
    const c = cellCenter(i, j);
    relic(c.x, 0, c.z);
  }

  // Corridor from the maze to the warehouse
  const WZ0 = ZE + 4; // warehouse south wall
  kit.addPlatform('br_link_floor', exitX, 0, (ZE + WZ0) / 2, 3.6, WZ0 - ZE, 1, carpetB);
  wall('br_link_w', exitX - 1.8, ZE, exitX - 1.8, WZ0);
  wall('br_link_e', exitX + 1.8, ZE, exitX + 1.8, WZ0);
  ceiling(exitX - 1.8, ZE, exitX + 1.8, WZ0, WALL_H);

  // ======================================================================
  // 2. THE WAREHOUSE — pits, shelves, crates up to the mezzanine; blackouts
  // ======================================================================
  const WX = 22;
  const WZ1 = WZ0 + 44;
  const WH = 9;
  const pit1 = WZ0 + 12 + Math.floor(rng() * 3);
  const pit2 = WZ0 + 27 + Math.floor(rng() * 3);
  const PIT = 3;
  const floorStrip = (id: string, z0: number, z1: number) => kit.addPlatform(id, 0, 0, (z0 + z1) / 2, WX * 2, z1 - z0, 1, concB);
  floorStrip('br_w_floor1', WZ0, pit1);
  floorStrip('br_w_floor2', pit1 + PIT, pit2);
  floorStrip('br_w_floor3', pit2 + PIT, WZ1);
  // A narrow plank over the first pit, for the brave
  const plankX = (rng() - 0.5) * 24;
  kit.addPlatform('br_w_plank', plankX, 0, pit1 + PIT / 2, 0.8, PIT + 0.6, 0.25, crateB);
  // Walls (door from the corridor, door to the red corridor up on the mezzanine)
  wall('br_w_s1', -WX, WZ0, exitX - 1.8, WZ0, WH, -0.5, concWallB);
  wall('br_w_s2', exitX + 1.8, WZ0, WX, WZ0, WH, -0.5, concWallB);
  wall('br_w_slintel', exitX - 1.8, WZ0, exitX + 1.8, WZ0, WH, WALL_H, concWallB);
  wall('br_w_w', -WX, WZ0, -WX, WZ1, WH, -0.5, concWallB);
  wall('br_w_e', WX, WZ0, WX, WZ1, WH, -0.5, concWallB);
  const MEZ_Y = 3.4;
  const doorX = Math.round((rng() - 0.5) * 24);
  wall('br_w_n1', -WX, WZ1, doorX - 1.8, WZ1, WH, -0.5, concWallB);
  wall('br_w_n2', doorX + 1.8, WZ1, WX, WZ1, WH, -0.5, concWallB);
  wall('br_w_nlow', doorX - 1.8, WZ1, doorX + 1.8, WZ1, MEZ_Y - 0.4, -0.5, concWallB);
  wall('br_w_nlintel', doorX - 1.8, WZ1, doorX + 1.8, WZ1, WH, MEZ_Y + 3.6, concWallB);
  ceiling(-WX, WZ0, WX, WZ1, WH, new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 1, side: THREE.DoubleSide }), 4);
  // Mezzanine along the north wall
  const MEZ_D = 7;
  kit.addPlatform('br_w_mezz', 0, MEZ_Y, WZ1 - MEZ_D / 2, WX * 2, MEZ_D, 0.4, metalB);
  for (let x = -WX + 3; x < WX; x += 7) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, MEZ_Y, 8), metalMat);
    col.position.set(x, MEZ_Y / 2 - 0.2, WZ1 - MEZ_D + 0.3);
    col.castShadow = true;
    root.add(col);
    kit.registerCylinder(`br_w_col${x}`, x, 0, WZ1 - MEZ_D + 0.3, 0.22, MEZ_Y - 0.4);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(WX * 2, 0.08, 0.08), metalMat);
  rail.position.set(0, MEZ_Y + 1, WZ1 - MEZ_D + 0.1);
  root.add(rail);
  // Crates up to the mezzanine (on the last strip)
  const crateX = (rng() < 0.5 ? -1 : 1) * (6 + rng() * 10);
  const cz = WZ1 - MEZ_D - 0.7;
  kit.addPlatform('br_w_crate1', crateX - 2.6, 1.1, cz - 2.4, 1.3, 1.3, 1.1, crateB);
  kit.addPlatform('br_w_crate2', crateX - 1.3, 2.2, cz - 1.2, 1.3, 1.3, 2.2, crateB);
  kit.addPlatform('br_w_crate3', crateX, 3.0, cz, 1.3, 1.3, 3.0, crateB).solid = true;
  relic(crateX - 1.3, 2.2, cz - 1.2);
  // Shelves (solid) on the first and third strips make the room a little maze
  let sh = 0;
  const shelf = (x: number, z: number, along: 'x' | 'z') => {
    const len = 7;
    const sx = along === 'x' ? len : 1.1;
    const sz = along === 'z' ? len : 1.1;
    kit.addPlatform(`br_w_shelf${sh++}`, x, 4.2, z, sx, sz, 4.7, metalB).solid = true;
    for (let k = 0; k < 4; k++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), crateMat);
      box.position.set(x + (along === 'x' ? (k - 1.5) * 1.6 : 0), 1.0 + (k % 2) * 1.6, z + (along === 'z' ? (k - 1.5) * 1.6 : 0));
      root.add(box);
    }
  };
  for (let k = 0; k < 4; k++) shelf(-15 + k * 10 + (rng() - 0.5) * 3, WZ0 + 6 + (rng() - 0.5) * 2, 'x');
  for (let k = 0; k < 2; k++) shelf(-12 + k * 24 + (rng() - 0.5) * 3, pit1 + PIT + 6, 'z');
  // Hanging lamps; three broken ones where the Sonrisas live
  const hang = new THREE.PlaneGeometry(2.4, 0.4);
  const dark: THREE.Vector3[] = [];
  const smileSpots = [
    new THREE.Vector3(-14 + rng() * 6, 0.2, (WZ0 + pit1) / 2 + 2),
    new THREE.Vector3(8 + rng() * 6, 0.2, (pit1 + PIT + pit2) / 2),
    new THREE.Vector3(-4 + rng() * 8, 0.2, (pit2 + PIT + WZ1 - MEZ_D) / 2),
  ];
  for (let x = -WX + 4; x < WX; x += 8)
    for (let z = WZ0 + 4; z < WZ1; z += 8) {
      if (smileSpots.some((s) => Math.hypot(s.x - x, s.z - z) < 5)) {
        dark.push(new THREE.Vector3(x, 0, z));
        continue;
      }
      const lamp = new THREE.Mesh(hang, lampOn);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(x, WH - 1, z);
      root.add(lamp);
    }
  relic(plankX, 0.25, pit1 + PIT / 2);
  relic(-crateX * 0.6, MEZ_Y, WZ1 - 3);
  kit.addCheckpoint(2, 'El almacén', new THREE.Vector3(exitX + 3, 0, WZ0 + 2), new THREE.Vector3(exitX, 0.2, WZ0 + 2.2));
  kit.addCheckpoint(3, 'Pasillo de emergencia', new THREE.Vector3(doorX + 3.2, MEZ_Y, WZ1 - 2.2), new THREE.Vector3(doorX, MEZ_Y + 0.2, WZ1 - 2.5));

  // ======================================================================
  // 3. ¡CORRE! — red corridor with gaps and hurdles, to the EXIT
  // ======================================================================
  const CZ0 = WZ1;
  const CLEN = 54;
  const CZ1 = CZ0 + CLEN;
  const CY = MEZ_Y;
  const gaps = [CZ0 + 14, CZ0 + 29, CZ0 + 41].map((z) => z + Math.floor(rng() * 3));
  let z = CZ0;
  let seg = 0;
  for (const gz of [...gaps, CZ1 + 2]) {
    kit.addPlatform(`br_c_floor${seg++}`, doorX, CY, (z + gz) / 2, 3.6, gz - z, 0.5, carpetB);
    z = gz + 2.2;
  }
  wall('br_c_w', doorX - 1.8, CZ0, doorX - 1.8, CZ1 + 2, CY + 4.2, CY - 0.6);
  wall('br_c_e', doorX + 1.8, CZ0, doorX + 1.8, CZ1 + 2, CY + 4.2, CY - 0.6);
  wall('br_c_n', doorX - 1.8, CZ1 + 2, doorX + 1.8, CZ1 + 2, CY + 4.2, CY - 0.6);
  ceiling(doorX - 1.8, CZ0, doorX + 1.8, CZ1 + 2, CY + 4.2, new THREE.MeshStandardMaterial({ color: 0x3b2222, roughness: 1, side: THREE.DoubleSide }), 2);
  // Hurdles to jump over between the gaps
  const hurdles = [CZ0 + 8, CZ0 + 22, CZ0 + 35, CZ0 + 48];
  hurdles.forEach((hz, k) => kit.addPlatform(`br_c_hurdle${k}`, doorX, CY + 0.75, hz, 3.6, 0.5, 0.75, crateB));
  // Red emergency lamps
  const redGeo = new THREE.PlaneGeometry(0.5, 1.6);
  for (let rz = CZ0 + 3; rz < CZ1; rz += 6) {
    const lamp = new THREE.Mesh(redGeo, redLamp);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(doorX, CY + 4.18, rz);
    root.add(lamp);
  }
  relic(doorX, CY, hurdles[0] + 3);
  relic(doorX, CY, hurdles[2] + 3);
  relic(doorX, CY, (gaps[2] + 2.2 + CZ1) / 2);
  // EXIT sign over the end door
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), new THREE.MeshBasicMaterial({ map: exitTex() }));
  sign.position.set(doorX, CY + 3.4, CZ1 + 1.75);
  sign.rotation.y = Math.PI;
  root.add(sign);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.4 }));
  door.position.set(doorX, CY + 1.3, CZ1 + 1.9);
  root.add(door);

  // ======================================================================
  // Monsters
  // ======================================================================
  const flicker = [lampFlickA, lampFlickB];
  const hazards = new BackroomsHazards(
    maze,
    cameraColliders.filter((o) => o instanceof THREE.Mesh && (o as THREE.Mesh).material === wallMat),
    { minX: -WX, maxX: WX, minZ: WZ0, maxZ: WZ1 },
    { x: doorX, z0: CZ0, z1: CZ1, y: CY },
    flicker
  );
  const farCells: [number, number][] = [];
  for (let i = 0; i < NX; i++) for (let j = 2; j < NZ; j++) farCells.push([i, j]);
  shuffled(farCells);
  const nMannequins = 2 + Math.round(diff * 2);
  const nCrawlers = 1 + Math.round(diff);
  let fc = 0;
  for (let k = 0; k < nMannequins; k++) {
    const [i, j] = farCells[fc++ % farCells.length];
    hazards.add(root, 'maniqui', cellCenter(i, j));
  }
  for (let k = 0; k < nCrawlers; k++) {
    const [i, j] = farCells[fc++ % farCells.length];
    hazards.add(root, 'gateador', cellCenter(i, j));
  }
  for (const s of smileSpots) hazards.add(root, 'sonrisa', s);
  hazards.add(root, 'corredor', new THREE.Vector3(doorX, CY, CZ0 - 1));
  void dark;

  const summit = new THREE.Vector3(doorX, CY + 0.2, CZ1 - 0.5);
  // Magic berries so your companion can use its power more than once
  const items: ItemSpot[] = [
    { type: 'baya', pos: new THREE.Vector3(-3.5, 0.95, -6.5) },
    { type: 'baya', pos: new THREE.Vector3(exitX - 1, 0.95, WZ0 + 3.5) },
    { type: 'baya', pos: new THREE.Vector3(doorX - 4, MEZ_Y + 0.95, WZ1 - 3) },
    { type: 'nuez', pos: new THREE.Vector3(cellCenter(exitI, NZ - 1).x, 0.95, cellCenter(exitI, NZ - 1).z) },
  ];
  const world = kit.finish(summit, enemies, items, new THREE.Vector3(doorX + 1.2, CY + 1.2, CZ1 - 3));
  world.levelName = `Los Backrooms · Nivel ${level}`;
  world.summitName = 'SALIDA';
  world.hazards = hazards;
  world.cameraColliders = cameraColliders;
  return world;
}

// ---------------------------------------------------------------- Skinwalker maze (boss)

/** A grid maze of any size (the boss level uses a much bigger one than Nivel 0). */
interface Grid {
  nx: number;
  nz: number;
  c: number;
  x0: number;
  z0: number;
  east: boolean[][];
  north: boolean[][];
}

function gridMaze(rng: () => number, nx: number, nz: number, c: number, extra: number): Grid {
  const g: Grid = {
    nx,
    nz,
    c,
    x0: -(nx * c) / 2,
    z0: -(nz * c) / 2,
    east: Array.from({ length: nx }, () => new Array<boolean>(nz).fill(false)),
    north: Array.from({ length: nx }, () => new Array<boolean>(nz).fill(false)),
  };
  const seen = Array.from({ length: nx }, () => new Array<boolean>(nz).fill(false));
  const stack: [number, number][] = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const opts: [number, number][] = [];
    if (i > 0 && !seen[i - 1][j]) opts.push([i - 1, j]);
    if (i < nx - 1 && !seen[i + 1][j]) opts.push([i + 1, j]);
    if (j > 0 && !seen[i][j - 1]) opts.push([i, j - 1]);
    if (j < nz - 1 && !seen[i][j + 1]) opts.push([i, j + 1]);
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const [ni, nj] = opts[Math.floor(rng() * opts.length)];
    if (ni > i) g.east[i][j] = true;
    else if (ni < i) g.east[ni][nj] = true;
    else if (nj > j) g.north[i][j] = true;
    else g.north[ni][nj] = true;
    seen[ni][nj] = true;
    stack.push([ni, nj]);
  }
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      if (i < nx - 1 && !g.east[i][j] && rng() < extra) g.east[i][j] = true;
      if (j < nz - 1 && !g.north[i][j] && rng() < extra) g.north[i][j] = true;
    }
  return g;
}

const gCenter = (g: Grid, i: number, j: number) => new THREE.Vector3(g.x0 + (i + 0.5) * g.c, 0, g.z0 + (j + 0.5) * g.c);
const gCell = (g: Grid, p: THREE.Vector3): [number, number] => [
  THREE.MathUtils.clamp(Math.floor((p.x - g.x0) / g.c), 0, g.nx - 1),
  THREE.MathUtils.clamp(Math.floor((p.z - g.z0) / g.c), 0, g.nz - 1),
];
function gNeighbors(g: Grid, i: number, j: number): [number, number][] {
  const out: [number, number][] = [];
  if (i < g.nx - 1 && g.east[i][j]) out.push([i + 1, j]);
  if (i > 0 && g.east[i - 1][j]) out.push([i - 1, j]);
  if (j < g.nz - 1 && g.north[i][j]) out.push([i, j + 1]);
  if (j > 0 && g.north[i][j - 1]) out.push([i, j - 1]);
  return out;
}
/** Next cell toward b and the distance in cells (BFS). */
function gBfs(g: Grid, a: [number, number], b: [number, number]): { next: [number, number]; dist: number } {
  if (a[0] === b[0] && a[1] === b[1]) return { next: a, dist: 0 };
  const key = (i: number, j: number) => i * 1000 + j;
  const prev = new Map<number, number>([[key(a[0], a[1]), -1]]);
  const q: [number, number][] = [a];
  let found = false;
  for (let h = 0; h < q.length && !found; h++) {
    for (const [ni, nj] of gNeighbors(g, q[h][0], q[h][1])) {
      const k = key(ni, nj);
      if (prev.has(k)) continue;
      prev.set(k, key(q[h][0], q[h][1]));
      if (ni === b[0] && nj === b[1]) {
        found = true;
        break;
      }
      q.push([ni, nj]);
    }
  }
  if (!found) return { next: a, dist: 99 };
  let k = key(b[0], b[1]);
  let dist = 1;
  while (prev.get(k) !== key(a[0], a[1])) {
    k = prev.get(k)!;
    dist++;
  }
  return { next: [Math.floor(k / 1000), k % 1000], dist };
}

/**
 * Boss level of the Backrooms (25, 45, 65…): a huge maze of yellow rooms where it's easy to get
 * lost. In a party every player starts in a different corner, so the copies the Skinwalker makes
 * of your friends can walk up to you pretending to be them… (see SkinwalkerBoss in bosses.ts).
 */
export function buildSkinwalkerArena(level: number, root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const rng = mulberry32(level * 3343 + 5);
  const diff = Math.min(1, Math.max(0, (level - 25) / 40));
  const kit = createLevelKit(root, textures);
  const enemies = new EnemyManager(root, textures);
  const cameraColliders: THREE.Object3D[] = [];
  const P = backroomsParts(kit, root, textures, cameraColliders);
  const info = BOSS_INFO.skinwalker;
  const Y = 0;
  const N = 11;
  const CELL = 6.5;
  const g = gridMaze(rng, N, N, CELL, 0.12);
  // Two open halls (2×2) to fight in
  for (const [hi, hj] of [
    [2 + Math.floor(rng() * 2), 6 + Math.floor(rng() * 2)],
    [6 + Math.floor(rng() * 2), 2 + Math.floor(rng() * 2)],
  ]) {
    g.east[hi][hj] = g.east[hi][hj + 1] = true;
    g.north[hi][hj] = g.north[hi + 1][hj] = true;
  }
  // The middle cell is open on every side (the portal appears there)
  const mid = Math.floor(N / 2);
  g.east[mid][mid] = g.east[mid - 1][mid] = g.north[mid][mid] = g.north[mid][mid - 1] = true;
  const HALF = (N * CELL) / 2;

  kit.addPlatform('sw_floor', 0, Y, 0, HALF * 2, HALF * 2, 1, P.carpetB);
  const obstacles: { x: number; z: number; hx: number; hz: number }[] = [];
  const wallSeg = (id: string, x0: number, z0: number, x1: number, z1: number) => {
    P.wall(id, x0, z0, x1, z1);
    obstacles.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2 + 0.2, hz: Math.abs(z1 - z0) / 2 + 0.2 });
  };
  wallSeg('sw_n', -HALF, -HALF, HALF, -HALF);
  wallSeg('sw_s', -HALF, HALF, HALF, HALF);
  wallSeg('sw_w', -HALF, -HALF, -HALF, HALF);
  wallSeg('sw_e', HALF, -HALF, HALF, HALF);
  let wn = 0;
  for (let j = 0; j < N - 1; j++) {
    let start = -1;
    for (let i = 0; i <= N; i++) {
      const closed = i < N && !g.north[i][j];
      if (closed && start < 0) start = i;
      if (!closed && start >= 0) {
        const z = g.z0 + (j + 1) * CELL;
        wallSeg(`sw_h${wn++}`, g.x0 + start * CELL, z, g.x0 + i * CELL, z);
        start = -1;
      }
    }
  }
  for (let i = 0; i < N - 1; i++) {
    let start = -1;
    for (let j = 0; j <= N; j++) {
      const closed = j < N && !g.east[i][j];
      if (closed && start < 0) start = j;
      if (!closed && start >= 0) {
        const x = g.x0 + (i + 1) * CELL;
        wallSeg(`sw_v${wn++}`, x, g.z0 + start * CELL, x, g.z0 + j * CELL);
        start = -1;
      }
    }
  }
  P.ceiling(-HALF, -HALF, HALF, HALF, WALL_H);
  // Lamps: many broken, a few flickering
  const lampGeo = new THREE.PlaneGeometry(1.4, 0.7);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const r = rng();
      if (r < 0.28) continue;
      const c = gCenter(g, i, j);
      const lamp = new THREE.Mesh(lampGeo, r < 0.42 ? P.lampFlickA : r < 0.5 ? P.lampFlickB : P.lampOn);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(c.x, WALL_H - 0.02, c.z);
      root.add(lamp);
    }
  kit.animators.push((_dt, time) => {
    P.lampFlickA.color.setHex(Math.sin(time * 21) * Math.sin(time * 6.1) > 0.45 ? 0x2a2614 : 0xfffbe6);
    P.lampFlickB.color.setHex(Math.sin(time * 1.3) > 0.9 ? 0x2a2614 : 0xfffbe6);
  });

  // Start corners: you start in one, your friends in the others
  const corners: [number, number][] = [
    [0, N - 1],
    [N - 1, 0],
    [N - 1, N - 1],
    [0, 0],
    [mid, N - 1],
    [mid, 0],
    [0, mid],
    [N - 1, mid],
  ];
  const spawn = gCenter(g, corners[0][0], corners[0][1]).setY(Y + 0.2);
  kit.addCheckpoint(0, `Entrada · ${info.short}`, gCenter(g, corners[0][0], corners[0][1]).add(new THREE.Vector3(2, 0, 2)), spawn, true);
  const partySpawns = corners.map(([i, j]) => {
    const c = gCenter(g, i, j);
    return { x: c.x - spawn.x, z: c.z - spawn.z };
  });

  const setup: BossSetup = {
    kind: 'skinwalker',
    level,
    diff,
    name: info.name,
    short: info.short,
    floorY: Y,
    half: HALF,
    spawn,
    home: gCenter(g, mid, mid),
    perches: [],
    cowSpots: [],
    candelabra: [],
    giantBase: new THREE.Vector3(),
    giantSpots: [],
    food: [],
    portal: null as unknown as VictoryPortalModel,
    portalPos: gCenter(g, mid, mid),
    obstacles,
    searchSpots: [],
    navStep: (from, to) => {
      const r = gBfs(g, gCell(g, from), gCell(g, to));
      return r.dist <= 0 ? to : gCenter(g, r.next[0], r.next[1]);
    },
    cellDist: (a, b) => gBfs(g, gCell(g, a), gCell(g, b)).dist,
  };
  const isCorner = (i: number, j: number) => corners.slice(0, 4).some(([a, b]) => a === i && b === j);
  const deadEnds: [number, number][] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      if (isCorner(i, j)) continue;
      setup.searchSpots!.push(gCenter(g, i, j));
      if (gNeighbors(g, i, j).length === 1) deadEnds.push([i, j]);
    }

  // A skull next to every start corner, more around the maze; food to heal
  const items: ItemSpot[] = [];
  corners.slice(0, 4).forEach(([i, j]) => {
    const c = gCenter(g, i, j);
    items.push({ type: 'craneo', pos: new THREE.Vector3(c.x + 1.2, Y + 0.95, c.z - 1.2) });
  });
  const shuffledCells = setup.searchSpots!.slice().sort(() => rng() - 0.5);
  shuffledCells.slice(0, 4).forEach((c) => items.push({ type: 'craneo', pos: new THREE.Vector3(c.x, Y + 0.95, c.z) }));
  shuffledCells.slice(4, 10).forEach((c, k) => setup.food.push({ pos: new THREE.Vector3(c.x + 1, Y + 1.0, c.z + 1), kind: k % 2 ? 'burger' : 'fries' }));

  // Relics in dead ends (or anywhere if there aren't enough)
  const relicCells = [...deadEnds.sort(() => rng() - 0.5).map(([i, j]) => gCenter(g, i, j)), ...shuffledCells.slice(10)];
  for (let k = 0; k < 8; k++) {
    const c = relicCells[k];
    kit.addCollectible(`swc${k}`, k % 3 === 0 ? 'golden_acorn' : 'sun_crystal', c.x - 1.2, Y + 1.2, c.z + 1.2);
  }

  const world = kit.finish(setup.portalPos.clone(), enemies, items, new THREE.Vector3(spawn.x + 2, Y + 3, spawn.z - 3));
  // The portal only appears once the boss is defeated
  setup.portal = world.victoryPortal!;
  setup.portal.group.visible = false;
  world.victoryPortal = undefined;
  world.summitPosition = new THREE.Vector3(0, -999, 0);
  world.levelName = `${info.name} · Nivel ${level}`;
  world.summitName = 'Portal del jefe';
  world.cameraColliders = cameraColliders;
  world.partySpawns = partySpawns;
  world.boss = setup;
  return world;
}
