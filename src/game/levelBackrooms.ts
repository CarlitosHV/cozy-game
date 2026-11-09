/**
 * "Los Backrooms" (levels 15, 35, 55…): you no-clipped out of reality.
 *
 *  1. Nivel 0 — a maze of yellow rooms: damp carpet, stained wallpaper and humming lamps (a new
 *     maze every time). The way out is LOCKED: the key is in a dead end, deep in the maze.
 *  2. El almacén — a huge dark warehouse with no floor: jump across crates, shelves, hanging
 *     pallets and soggy boxes. Now and then the lights come back for a few seconds (a break);
 *     when they go off, the Sonrisas fly at you.
 *  3. ¡Corre! — a red corridor that repeats forever while the Corredor chases you. Pull the 3
 *     levers hidden in nooks along the walls and it shrinks to let you reach the EXIT. Light
 *     orbs work as light grenades: they blind every monster around you for a few seconds.
 *
 * You have 3 hearts: every bite takes one; with none left you go back to the last checkpoint
 * (and it counts as a death).
 *  - Maniquí: only moves while you're not looking at it. Keep it in view.
 *  - Gateador: crawls around the maze; if it hears you close by it chases you (run!).
 *  - La Sonrisa: floating faces of the dark warehouse; the light sends them away.
 *  - El Corredor: wakes up behind you in the red corridor.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import { createLevelKit } from './levelKit';
import { EnemyManager } from './enemies';
import type { LevelHazardContext, LevelHazards, LevelHazardStatus, PlatformItem, WorldBuildResult } from './levels';
import type { ProceduralTextures } from './textures';
import type { Builder } from './levelThemes';
import type { ItemSpot, ItemType, ToolResult } from './items';
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
const NAMES: Record<MonsterKind, string> = { maniqui: 'el Maniquí', gateador: 'el Gateador', sonrisa: 'una Sonrisa', corredor: 'el Corredor' };

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
  /** Blinded by a light grenade (or knocked back after biting you) */
  stunT: number;
  mats?: THREE.Material[];
}

/** The warehouse: lights that go on now and then (a break), then off again (the Sonrisas come out) */
interface WarehouseInfo {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  lamps: THREE.MeshBasicMaterial;
}

/** The red corridor: a stretch that repeats forever until you pull its three levers */
interface CorridorInfo {
  x: number;
  z0: number;
  /** Where the repeating part starts and the length of one stretch */
  loopZ0: number;
  seg: number;
  /** Stretches 0-2 are real; 3 is a copy of 0 (what you see ahead before it loops) */
  y: number;
  end: number;
  levers: { pos: THREE.Vector3; handle: THREE.Object3D; copies: THREE.Object3D[]; pulled: boolean }[];
  lamps: THREE.MeshBasicMaterial;
}

interface KeyDoor {
  plat: PlatformItem;
  mesh: THREE.Object3D;
  light: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  open: boolean;
  openT: number;
  hintCd: number;
}

class BackroomsHazards implements LevelHazards {
  public darkness = 0;
  private monsters: Monster[] = [];
  private maze: Maze;
  private walls: THREE.Object3D[];
  private ware: WarehouseInfo;
  private corr: CorridorInfo;
  private door: KeyDoor;
  private root: THREE.Object3D;
  private diff: number;
  // Warehouse lights: dark most of the time, now and then a short break with the lights on
  private wareLit = false;
  private wareT = 10;
  private grace = 0;
  private warnCd = 0;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private ray = new THREE.Raycaster();
  private rng = Math.random;
  private flickerMats: THREE.MeshBasicMaterial[];
  // Hearts
  private maxHearts = 3;
  private hearts = 3;
  private hurtId = 0;
  private lastP = new THREE.Vector3();
  private flashes: { mesh: THREE.Mesh; t: number }[] = [];
  private loopMsgCd = 0;
  private quetsyCd = 0;
  private solved = false;

  constructor(
    root: THREE.Object3D,
    diff: number,
    maze: Maze,
    walls: THREE.Object3D[],
    ware: WarehouseInfo,
    corr: CorridorInfo,
    door: KeyDoor,
    flickerMats: THREE.MeshBasicMaterial[]
  ) {
    this.root = root;
    this.diff = diff;
    this.maze = maze;
    this.walls = walls;
    this.ware = ware;
    this.corr = corr;
    this.door = door;
    this.flickerMats = flickerMats;
  }

  add(root: THREE.Object3D, kind: MonsterKind, at: THREE.Vector3) {
    const model =
      kind === 'maniqui' ? mannequinModel() : kind === 'gateador' ? crawlerModel(1, 0xf5f5dc) : kind === 'corredor' ? crawlerModel(1.25, 0xff3030) : smileModel();
    model.group.position.copy(at);
    root.add(model.group);
    const m: Monster = { kind, model, pos: at.clone(), home: at.clone(), yaw: 0, active: false, target: null, wanderT: 0, seenT: 0, seen: false, fade: kind === 'sonrisa' ? 0 : 1, stunT: 0 };
    if (kind === 'sonrisa') m.mats = (model as ReturnType<typeof smileModel>).mats;
    if (kind === 'corredor') model.group.visible = false;
    this.monsters.push(m);
  }

  reset() {
    for (const m of this.monsters) this.sendHome(m);
    this.wareLit = false;
    this.wareT = 10;
    this.darkness = 0;
    this.grace = 2;
    this.hearts = this.maxHearts;
    // A new run: the door locks again and the levers go back up
    const d = this.door;
    d.open = false;
    d.openT = 0;
    d.plat.position.y = d.pos.y;
    d.mesh.visible = true;
    d.mesh.position.y = 0;
    d.light.color.setHex(0xff3030);
    for (const l of this.corr.levers) this.setLever(l, false);
    this.solved = false;
    this.corr.lamps.color.setHex(0xff2a2a);
  }

  private sendHome(m: Monster) {
    m.pos.copy(m.home);
    m.active = false;
    m.target = null;
    m.wanderT = 0;
    m.stunT = 0;
    m.fade = m.kind === 'sonrisa' ? 0 : 1;
    m.model.group.position.copy(m.home);
    if (m.kind === 'corredor') m.model.group.visible = false;
  }

  syncObjects() {
    return this.monsters.map((m) => ({ obj: m.model.group as THREE.Object3D, pos: m.pos }));
  }

  status(): LevelHazardStatus {
    return {
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      hurtId: this.hurtId,
      key: this.door.open ? 'open' : this.keyHeld ? 'have' : 'need',
      levers: { have: this.corr.levers.filter((l) => l.pulled).length, total: this.corr.levers.length },
      darkness: this.darkness,
    };
  }
  private keyHeld = false;

  /** The light orb is a light grenade here: it blinds every monster around you for a few seconds. */
  useItem(type: ItemType): ToolResult {
    if (type !== 'luz') return 'none';
    const P = this.lastP;
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xfffbe6, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    flash.position.set(P.x, P.y + 1.2, P.z);
    this.root.add(flash);
    this.flashes.push({ mesh: flash, t: 0 });
    soundManager.playTimeBonus();
    soundManager.playUpdraft();
    let n = 0;
    for (const m of this.monsters) {
      const d = m.pos.distanceTo(P);
      if (d > 24) continue;
      n++;
      if (m.kind === 'sonrisa') {
        // The light burns them away for a while
        m.stunT = 6;
        m.target = m.home;
      } else {
        m.stunT = 4.5;
      }
    }
    // A short break from the dark too
    if (this.inWarehouse(P) && !this.wareLit) this.wareT = Math.min(this.wareT, 0.01);
    this.notify?.(n ? '¡Granada de luz! Los monstruos quedaron cegados unos segundos: ¡corre!' : '¡Granada de luz! (no había monstruos cerca)');
    return 'wear';
  }
  private notify: ((t: string) => void) | null = null;

  private inMaze(p: THREE.Vector3) {
    return cellOf(p) !== null && p.y < 3;
  }

  private inWarehouse(p: THREE.Vector3) {
    const w = this.ware;
    return p.x > w.minX && p.x < w.maxX && p.z > w.minZ && p.z < w.maxZ;
  }

  private inCorridor(p: THREE.Vector3) {
    const c = this.corr;
    return Math.abs(p.x - c.x) < 5 && p.z > c.z0 && p.z < c.end + 3 && p.y > c.y - 2.5;
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

  private moveTo(m: Monster, goal: THREE.Vector3, speed: number, dt: number, fly = false) {
    const dx = goal.x - m.pos.x;
    const dy = fly ? goal.y - m.pos.y : 0;
    const dz = goal.z - m.pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    const step = Math.min(d, speed * dt);
    m.pos.x += (dx / d) * step;
    m.pos.y += (dy / d) * step;
    m.pos.z += (dz / d) * step;
    if (Math.hypot(dx, dz) > 0.05) m.yaw = Math.atan2(dx, dz);
    return d - step < 0.05;
  }

  /** Walks the maze cell by cell toward a point. */
  private mazeStep(m: Monster, goal: THREE.Vector3, speed: number, dt: number) {
    const a = cellOf(m.pos);
    const b = cellOf(goal);
    if (!a || !b) return this.moveTo(m, m.home, speed, dt);
    const r = bfs(this.maze, a, b);
    if (r.dist <= 0) return this.moveTo(m, goal, speed, dt);
    return this.moveTo(m, cellCenter(r.next[0], r.next[1]), speed, dt);
  }

  private cellDist(a: THREE.Vector3, b: THREE.Vector3): number {
    const ca = cellOf(a);
    const cb = cellOf(b);
    if (!ca || !cb) return 99;
    const r = bfs(this.maze, ca, cb);
    return r.dist < 0 ? 99 : r.dist;
  }

  /** A monster got you: one heart less (at zero, back to the checkpoint). */
  private bite(m: Monster, ctx: LevelHazardContext) {
    this.grace = 1.6;
    this.hearts--;
    this.hurtId++;
    ctx.hurt?.(m.pos);
    if (this.hearts <= 0) {
      this.hearts = this.maxHearts;
      ctx.caught(`¡${NAMES[m.kind][0].toUpperCase() + NAMES[m.kind].slice(1)} te atrapó y te quedaste sin corazones!`);
      for (const o of this.monsters) if (o.pos.distanceTo(ctx.position) < 14 || o === m || o.kind === 'corredor') this.sendHome(o);
      this.wareLit = false;
      this.wareT = 8;
      return;
    }
    soundManager.playEnemyBonk();
    ctx.notify(`¡Te mordió ${NAMES[m.kind]}! Te ${this.hearts === 1 ? 'queda 1 corazón' : `quedan ${this.hearts} corazones`}`);
    // It backs off for a moment so you can get away
    if (m.kind === 'sonrisa') {
      m.stunT = 4;
    } else if (m.kind === 'corredor') {
      m.pos.z = Math.max(this.corr.z0, m.pos.z - 7);
      m.stunT = 1.2;
    } else {
      this.sendHome(m);
    }
  }

  private setLever(l: CorridorInfo['levers'][number], on: boolean) {
    l.pulled = on;
    for (const h of [l.handle, ...l.copies]) h.rotation.x = on ? 0.9 : -0.9;
  }

  update(dt: number, time: number, ctx: LevelHazardContext) {
    const P = ctx.position;
    this.lastP.copy(P);
    this.notify = ctx.notify;
    this.keyHeld = !!ctx.has?.('llave');
    this.grace = Math.max(0, this.grace - dt);
    this.warnCd = Math.max(0, this.warnCd - dt);
    this.loopMsgCd = Math.max(0, this.loopMsgCd - dt);
    this.quetsyCd = Math.max(0, this.quetsyCd - dt);
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m4);
    const lure = ctx.lure;
    const target = lure ?? P;

    // Light grenade flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      f.mesh.scale.setScalar(1 + f.t * 40);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - f.t * 1.8);
      if (f.t > 0.5) {
        this.root.remove(f.mesh);
        f.mesh.geometry.dispose();
        this.flashes.splice(i, 1);
      }
    }

    // ---- The locked door out of the maze ----
    const d = this.door;
    if (d.open) {
      if (d.openT < 1) {
        d.openT = Math.min(1, d.openT + dt * 0.9);
        d.mesh.position.y = -d.openT * 4.8;
        if (d.openT >= 1) d.mesh.visible = false;
      }
    } else {
      d.hintCd = Math.max(0, d.hintCd - dt);
      if (Math.hypot(P.x - d.pos.x, P.z - d.pos.z) < 2.6 && P.y < 3 && !ctx.spectating) {
        if (ctx.consume?.('llave')) {
          d.open = true;
          d.plat.position.y = -100; // no collision any more
          d.light.color.setHex(0x34d399);
          soundManager.playCheckpoint();
          ctx.notify('¡La llave abrió la puerta! Sigue adelante…');
        } else if (d.hintCd <= 0) {
          d.hintCd = 5;
          ctx.notify('Puerta cerrada con llave: la llave está en algún callejón sin salida del laberinto');
        }
      }
    }

    // ---- Warehouse: dark, with short breaks of light ----
    const inWare = this.inWarehouse(P);
    if (inWare && !ctx.spectating) {
      this.wareT -= dt;
      if (this.wareLit) {
        this.darkness = 0;
        this.ware.lamps.color.setHex(this.wareT < 1.3 && Math.sin(time * 40) > 0 ? 0x2a2614 : 0xfffbe6);
        if (this.wareT <= 0) {
          this.wareLit = false;
          this.wareT = 13 + this.rng() * 6 - 4 * this.diff;
          soundManager.playStalkerWarning();
          ctx.notify('Las luces se apagaron… las Sonrisas vuelan hacia ti');
        }
      } else {
        this.darkness = 0.82;
        this.ware.lamps.color.setHex(0x1c1a10);
        if (this.wareT <= 0) {
          this.wareLit = true;
          this.wareT = 5.5;
          soundManager.playCheckpoint();
          ctx.notify('¡Volvió la luz! Aprovecha para avanzar');
        }
      }
    } else {
      this.darkness = Math.max(0, this.darkness - dt * 3);
      this.ware.lamps.color.setHex(0xfffbe6);
      this.wareLit = false;
      this.wareT = Math.max(this.wareT, 5);
    }
    // Some lamps in the maze flicker on their own
    const fl = Math.sin(time * 23) * Math.sin(time * 7.3) > 0.55 ? 0x3a3520 : 0xfffbe6;
    this.flickerMats[0]?.color.setHex(fl);
    this.flickerMats[1]?.color.setHex(Math.sin(time * 1.7) > 0.93 ? 0x2a2614 : 0xfffbe6);

    // ---- The red corridor: levers, and the stretch that repeats ----
    const c = this.corr;
    const inCorr = this.inCorridor(P);
    if (inCorr && !ctx.spectating) {
      for (const l of c.levers) {
        if (!l.pulled && Math.hypot(P.x - l.pos.x, P.z - l.pos.z) < 1.3 && Math.abs(P.y - l.pos.y) < 2) {
          this.setLever(l, true);
          soundManager.playWoodRattle();
          const n = c.levers.filter((x) => x.pulled).length;
          if (n < c.levers.length) ctx.notify(`¡Palanca ${n}/${c.levers.length}! El pasillo tiembla…`);
        }
      }
      const all = c.levers.every((l) => l.pulled);
      if (all && !this.solved) {
        this.solved = true;
        c.lamps.color.setHex(0x34d399);
        soundManager.playVictory();
        ctx.notify('¡Las 3 palancas! El pasillo se ACORTA: ¡la SALIDA está cerca!');
        // It shrinks: you jump ahead to the last real stretch (it looks the same, so it's seamless)
        const u = P.z - c.loopZ0;
        const k = Math.floor(u / c.seg);
        if (k >= 0 && k < 2) this.shiftAll(new THREE.Vector3(0, 0, (2 - k) * c.seg), ctx);
      }
      // Not solved: past the third stretch you're back at the first one (it looks the same)
      if (!this.solved && P.z > c.loopZ0 + 3 * c.seg) {
        this.shiftAll(new THREE.Vector3(0, 0, -3 * c.seg), ctx);
        if (this.loopMsgCd <= 0) {
          this.loopMsgCd = 12;
          ctx.notify('El pasillo se alarga… nunca llegas a la SALIDA. Busca 3 palancas en los huecos de las paredes');
        }
      }
    }

    for (const m of this.monsters) {
      let moving = false;
      m.stunT = Math.max(0, m.stunT - dt);
      const stunned = m.stunT > 0;
      if (m.kind === 'maniqui') {
        // Moves only while you're not looking (checked a few times a second)
        m.seenT -= dt;
        if (m.seenT <= 0) {
          m.seenT = 0.12;
          m.seen = this.visible(m, cam);
        }
        const near = this.inMaze(P) && this.cellDist(m.pos, P) <= 7;
        if (!m.seen && near && !ctx.spectating && !stunned) {
          this.mazeStep(m, target, 4.4, dt);
          moving = true;
          if (this.rng() < dt * 1.5 && m.pos.distanceTo(P) < 14) soundManager.playFootstep();
        }
      } else if (m.kind === 'gateador') {
        const dd = this.inMaze(P) && !ctx.spectating ? this.cellDist(m.pos, P) : 99;
        if (!m.active && dd <= 2) {
          m.active = true;
          if (this.warnCd <= 0) {
            this.warnCd = 8;
            soundManager.playStalkerWarning();
            ctx.notify('¡El Gateador te oyó! Corre (Shift) y no te metas a un callejón sin salida');
          }
        } else if (m.active && dd > 5) m.active = false;
        if (stunned) {
          // blinded: it shakes in place
        } else if (m.active || lure) {
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
        // Flying faces: they come out in the dark and fly at you; the light sends them away
        const dark = this.darkness > 0.5 && inWare;
        const hunting = dark && !ctx.spectating && !stunned && m.pos.distanceTo(P) < 28;
        m.fade += ((dark && !stunned ? 1 : 0) - m.fade) * Math.min(1, dt * (stunned ? 8 : 3));
        if (hunting) {
          const goal = (lure ?? P).clone();
          goal.y += 1.0 + Math.sin(time * 2.2 + m.home.x) * 0.4;
          goal.x += Math.sin(time * 1.3 + m.home.z) * 1.2;
          this.moveTo(m, goal, 3.3 + 1.1 * this.diff, dt, true);
          moving = true;
        } else {
          this.moveTo(m, m.home, stunned ? 9 : 5, dt, true);
        }
        for (const mat of m.mats ?? []) (mat as THREE.MeshBasicMaterial).opacity = (mat === m.mats![0] ? 0.85 : 1) * m.fade;
        m.model.group.visible = m.fade > 0.03;
        // Face the player
        m.yaw = Math.atan2(P.x - m.pos.x, P.z - m.pos.z);
      } else if (m.kind === 'corredor') {
        if (!m.active && inCorr && P.z > c.z0 + 8 && !ctx.spectating) {
          m.active = true;
          m.pos.copy(m.home);
          m.model.group.visible = true;
          soundManager.playStalkerWarning();
          ctx.notify('¡Algo despertó detrás de ti! ¡CORRE! (lanza un orbe de luz para cegarlo)');
        }
        if (m.active) {
          if (!inCorr && !ctx.spectating) {
            this.sendHome(m);
          } else if (!stunned) {
            const goal = new THREE.Vector3(Math.abs(P.x - c.x) > 2 ? P.x : c.x, 0, P.z);
            this.moveTo(m, goal, 8.0 + 0.8 * this.diff, dt);
            m.pos.y = c.y;
            moving = true;
          }
        }
      }
      // Blinded monsters shake
      const shake = stunned && m.kind !== 'sonrisa' ? Math.sin(time * 60) * 0.05 : 0;
      m.model.anim(time, moving, dt);
      m.model.group.position.set(m.pos.x + shake, m.pos.y, m.pos.z);
      m.model.group.rotation.y = m.yaw;

      // Quetsy guarding you: whatever comes close gets bitten and backs off
      if (ctx.guarding && !stunned && !ctx.spectating && (m.kind !== 'sonrisa' || m.fade > 0.3) && (m.kind !== 'corredor' || m.active)) {
        const gx = m.pos.x - P.x;
        const gz = m.pos.z - P.z;
        if (gx * gx + gz * gz < 3.4 * 3.4 && Math.abs(m.pos.y - P.y) < 3) {
          if (m.kind === 'corredor') {
            m.pos.z = Math.max(this.corr.z0, m.pos.z - 8);
            m.stunT = 2.5;
          } else if (m.kind === 'sonrisa') {
            m.stunT = 5;
          } else {
            this.sendHome(m);
          }
          soundManager.playEnemyBonk();
          if (this.quetsyCd <= 0) {
            this.quetsyCd = 2;
            ctx.notify(`¡Quetsy mordió ${NAMES[m.kind].replace(/^el /, 'al ').replace(/^una /, 'a una ')} y lo espantó!`);
          }
          continue;
        }
      }

      // Caught!
      const dangerous = !stunned && (m.kind === 'sonrisa' ? m.fade > 0.6 : m.kind === 'corredor' ? m.active : true);
      if (dangerous && this.grace <= 0 && !ctx.spectating) {
        const dx = m.pos.x - P.x;
        const dz = m.pos.z - P.z;
        const dy = m.kind === 'sonrisa' ? m.pos.y - (P.y + 0.9) : m.pos.y - P.y;
        const r = m.kind === 'sonrisa' ? 1.15 : 0.9;
        if (dx * dx + dz * dz < r * r && Math.abs(dy) < (m.kind === 'sonrisa' ? 1.4 : 1.8)) this.bite(m, ctx);
      }
    }
  }

  /** Moves you, the camera and whoever chases you along the corridor by the same amount. */
  private shiftAll(o: THREE.Vector3, ctx: LevelHazardContext) {
    ctx.shift?.(o);
    for (const m of this.monsters) {
      if (m.kind !== 'corredor' || !m.active) continue;
      m.pos.add(o);
      if (m.pos.z < this.corr.z0) m.pos.z = this.corr.z0;
      m.model.group.position.copy(m.pos);
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

/** Glowing amber tape around the top of a platform, so you can see where to jump in the dark. */
function addTape(g: THREE.Object3D, w: number, d: number, mat: THREE.Material) {
  const t = 0.07;
  for (const [sx, sz, x, z] of [
    [w, t, 0, d / 2],
    [w, t, 0, -d / 2],
    [t, d, w / 2, 0],
    [t, d, -w / 2, 0],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.02, 0.05, sz + 0.02), mat);
    m.position.set(x, 0.02, z);
    g.add(m);
  }
}

/** A floor lever on the wall of a corridor nook: the handle tips over when you pull it. */
function leverModel(): { group: THREE.Group; handle: THREE.Group } {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6, roughness: 0.4 }));
  base.position.y = 1.1;
  group.add(base);
  const handle = new THREE.Group();
  handle.position.set(0, 1.1, 0.12);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.7, roughness: 0.3 }));
  bar.position.y = 0.35;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
  knob.position.y = 0.72;
  handle.add(bar, knob);
  handle.rotation.x = -0.9;
  group.add(handle);
  return { group, handle };
}

export function buildBackroomsWorld(level: number, root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const rng = mulberry32(level * 6151 + 99);
  const diff = Math.min(1, Math.max(0, (level - 15) / 40));
  const kit = createLevelKit(root, textures);
  const enemies = new EnemyManager(root, textures);
  const cameraColliders: THREE.Object3D[] = [];

  const P = backroomsParts(kit, root, textures, cameraColliders);
  const { wallMat, concMat, crateMat, metalMat, lampOn, lampFlickA, lampFlickB, redLamp } = P;
  const { carpetB, concB, concWallB, crateB, metalB, wall, ceiling } = P;
  const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffb02e });
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x050403 });
  const voidPlane = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), voidMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    root.add(m);
  };

  // ======================================================================
  // 1. NIVEL 0 — the yellow maze (the way out is locked: find the key)
  // ======================================================================
  const maze = makeMaze(rng);
  const XE = X0 + NX * C;
  const ZE = Z0 + NZ * C;
  const exitI = 1 + Math.floor(rng() * (NX - 2));
  const exitX = X0 + (exitI + 0.5) * C;

  kit.addPlatform('br_start_floor', 0, 0, -4.5, 14, 9, 1, carpetB);
  kit.addPlatform('br_maze_floor', 0, 0, (Z0 + ZE) / 2, NX * C, NZ * C, 1, carpetB);
  wall('br_start_w', -7, -9, -7, 0);
  wall('br_start_e', 7, -9, 7, 0);
  wall('br_start_s', -7, -9, 7, -9);
  wall('br_maze_s1', X0, Z0, -7, Z0);
  wall('br_maze_s2', 7, Z0, XE, Z0);
  wall('br_maze_w', X0, Z0, X0, ZE);
  wall('br_maze_e', XE, Z0, XE, ZE);
  wall('br_maze_n1', X0, ZE, exitX - 1.6, ZE);
  wall('br_maze_n2', exitX + 1.6, ZE, XE, ZE);
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

  // Locked door at the way out of the maze
  const doorPlat = kit.addPlatform('br_keydoor', exitX, WALL_H, ZE, 3.2, 0.4, WALL_H + 0.5, () => {});
  doorPlat.solid = true;
  const doorMesh = new THREE.Group();
  const doorBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, WALL_H, 0.3), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.55, roughness: 0.45 }));
  doorBody.position.y = WALL_H / 2;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.8, roughness: 0.3 }));
  plate.rotation.x = Math.PI / 2;
  plate.position.set(0.9, 1.3, -0.18);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  hole.position.set(0.9, 1.3, -0.22);
  const doorLightMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  const doorLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), doorLightMat);
  doorLight.position.set(0, WALL_H - 0.4, -0.25);
  doorMesh.add(doorBody, plate, hole, doorLight);
  const doorHolder = new THREE.Group();
  doorHolder.position.set(exitX, 0, ZE);
  doorHolder.add(doorMesh);
  root.add(doorHolder);

  // Dead ends: the key in the farthest one, relics in others
  const deadEnds: [number, number][] = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (neighbors(maze, i, j).length === 1 && !(j === 0 && (i === 3 || i === 4))) deadEnds.push([i, j]);
  const fromStart = (i: number, j: number) => bfs(maze, [3, 0], [i, j]).dist;
  const byFar = deadEnds.slice().sort((a, b) => fromStart(b[0], b[1]) - fromStart(a[0], a[1]));
  const keyCell: [number, number] = byFar[0] ?? [NX - 1, NZ - 1];
  const keyAt = cellCenter(keyCell[0], keyCell[1]);
  const shuffled = (arr: [number, number][]) => arr.sort(() => rng() - 0.5);
  let relicN = 0;
  const relic = (x: number, y: number, z: number) => {
    kit.addCollectible(`br${relicN}`, relicN % 3 === 0 ? 'golden_acorn' : 'sun_crystal', x, y + 1.2, z);
    relicN++;
  };
  const others = deadEnds.filter((c) => c !== keyCell);
  const pool = shuffled(others.length >= 4 ? others : [...others, ...Array.from({ length: 4 }, () => [Math.floor(rng() * NX), 1 + Math.floor(rng() * (NZ - 1))] as [number, number])]);
  for (const [i, j] of pool.slice(0, 4)) {
    const c = cellCenter(i, j);
    relic(c.x, 0, c.z);
  }
  // A little golden glow under the key, so it catches your eye from the doorway
  const keyGlow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.35, depthWrite: false }));
  keyGlow.rotation.x = -Math.PI / 2;
  keyGlow.position.set(keyAt.x, 0.03, keyAt.z);
  root.add(keyGlow);
  kit.animators.push((_dt, time) => ((keyGlow.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(time * 3) * 0.12));

  // Corridor from the maze to the warehouse
  const WZ0 = ZE + 4;
  kit.addPlatform('br_link_floor', exitX, 0, (ZE + WZ0) / 2, 3.6, WZ0 - ZE, 1, carpetB);
  wall('br_link_w', exitX - 1.8, ZE, exitX - 1.8, WZ0);
  wall('br_link_e', exitX + 1.8, ZE, exitX + 1.8, WZ0);
  ceiling(exitX - 1.8, ZE, exitX + 1.8, WZ0, WALL_H);

  // ======================================================================
  // 2. THE WAREHOUSE — no floor: jump across crates, shelves and swinging pallets in the dark.
  //    Now and then the lights come back for a few seconds; when they go off, the Sonrisas fly.
  // ======================================================================
  const WX = 20;
  const WL = 84;
  const WZ1 = WZ0 + WL;
  const WH = 11;
  const MEZ_Y = 4.4;
  const doorX = Math.round((rng() - 0.5) * 22);
  const lineX = (z: number) => THREE.MathUtils.lerp(exitX, doorX, THREE.MathUtils.clamp((z - WZ0) / (WL - 12), 0, 1));
  const step = (id: string, z: number, top: number, w: number, d: number, b: Builder = crateB, jitter = 1.4, h = top + 9) => {
    const x = lineX(z) + (rng() - 0.5) * 2 * jitter;
    const plat = kit.addPlatform(id, x, top, z, w, d, h, b);
    addTape(plat.mesh, w, d, tapeMat);
    return plat;
  };
  // Start ledge (full width) by the door from the maze
  const startLedge = kit.addPlatform('br_w_floor1', 0, 0, WZ0 + 3.5, WX * 2, 7, 9, concB);
  addTape(startLedge.mesh, WX * 2, 7, tapeMat);
  // Crates going up
  step('br_w_c1', WZ0 + 9.6, 0.5, 1.6, 1.6);
  step('br_w_c2', WZ0 + 12.2, 1.0, 1.6, 1.6);
  step('br_w_c3', WZ0 + 14.8, 1.5, 1.6, 1.6);
  // Two long shelves to run along the top of
  const shelfA = step('br_w_shelfA', WZ0 + 21, 2.0, 1.5, 8, metalB, 0.6);
  const shelfB = kit.addPlatform('br_w_shelfB', shelfA.position.x + (rng() < 0.5 ? -1.2 : 1.2), 2.6, WZ0 + 31, 1.5, 8, 11.6, metalB);
  addTape(shelfB.mesh, 1.5, 8, tapeMat);
  for (const s of [shelfA, shelfB])
    for (let k = 0; k < 3; k++) {
      // boxes on the lower shelves (looks)
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), crateMat);
      box.position.set(s.position.x + (k % 2 ? 0.95 : -0.95), s.position.y - 1.6 - k * 1.7, s.position.z - 2.5 + k * 2.5);
      root.add(box);
    }
  // A big concrete block halfway (checkpoint)
  const mid = kit.addPlatform('br_w_island1', lineX(WZ0 + 40), 2.0, WZ0 + 40, 6, 6, 11, concB);
  addTape(mid.mesh, 6, 6, tapeMat);
  // Pallets hanging from chains, sliding sideways
  const pallets: PlatformItem[] = [];
  [46, 50, 54].forEach((dz, k) => {
    const pl = kit.addPlatform(`br_w_pallet${k}`, lineX(WZ0 + dz), 2.0, WZ0 + dz, 2.2, 2.2, 0.3, crateB);
    addTape(pl.mesh, 2.2, 2.2, tapeMat);
    for (const [cx, cz] of [
      [0.9, 0.9],
      [-0.9, -0.9],
    ]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, WH - 2.2, 4), metalMat);
      chain.position.set(cx, (WH - 2.2) / 2, cz);
      pl.mesh.add(chain);
    }
    kit.makeMoving(pl, 'x', 3.0, 0.9 + 0.25 * k + 0.4 * diff, k * 2.1);
    pallets.push(pl);
  });
  const island2 = kit.addPlatform('br_w_island2', lineX(WZ0 + 59), 2.4, WZ0 + 59, 5, 4, 11.4, concB);
  addTape(island2.mesh, 5, 4, tapeMat);
  // Soggy cardboard boxes: they give way a moment after you land
  [63.4, 65.8, 68.2].forEach((dz, k) => {
    const bx = step(`br_w_box${k}`, WZ0 + dz, 2.8 + k * 0.4, 1.6, 1.6, crateB, 1.0, 1.0);
    kit.makeCrumbling(bx);
  });
  step('br_w_last', WZ0 + 70.6, 4.0, 2, 2, crateB, 0.4);
  // Mezzanine at the far end, with the door to the red corridor
  const MEZ_D = 12;
  const mezz = kit.addPlatform('br_w_mezz', 0, MEZ_Y, WZ1 - MEZ_D / 2, WX * 2, MEZ_D, 13.4, metalB);
  addTape(mezz.mesh, WX * 2, MEZ_D, tapeMat);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(WX * 2, 0.08, 0.08), metalMat);
  rail.position.set(0, MEZ_Y + 1, WZ1 - MEZ_D + 0.1);
  root.add(rail);
  // Walls and ceiling
  wall('br_w_s1', -WX, WZ0, exitX - 1.8, WZ0, WH, -9.5, concWallB);
  wall('br_w_s2', exitX + 1.8, WZ0, WX, WZ0, WH, -9.5, concWallB);
  wall('br_w_slintel', exitX - 1.8, WZ0, exitX + 1.8, WZ0, WH, WALL_H, concWallB);
  wall('br_w_w', -WX, WZ0, -WX, WZ1, WH, -9.5, concWallB);
  wall('br_w_e', WX, WZ0, WX, WZ1, WH, -9.5, concWallB);
  wall('br_w_n1', -WX, WZ1, doorX - 1.8, WZ1, WH, -9.5, concWallB);
  wall('br_w_n2', doorX + 1.8, WZ1, WX, WZ1, WH, -9.5, concWallB);
  wall('br_w_nlintel', doorX - 1.8, WZ1, doorX + 1.8, WZ1, WH, MEZ_Y + 3.6, concWallB);
  ceiling(-WX, WZ0, WX, WZ1, WH, new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 1, side: THREE.DoubleSide }), 4);
  voidPlane(-WX, WZ0 + 7, WX, WZ1 - MEZ_D, -8.5);
  // Ceiling lamps: they all go off (and come back) together
  const wareLamp = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  const hang = new THREE.PlaneGeometry(2.4, 0.4);
  for (let x = -WX + 4; x < WX; x += 8)
    for (let z = WZ0 + 4; z < WZ1; z += 8) {
      const lamp = new THREE.Mesh(hang, wareLamp);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(x, WH - 1, z);
      root.add(lamp);
    }
  relic(lineX(WZ0 + 12.2), 1.0, WZ0 + 12.2);
  relic(shelfB.position.x, 2.6, WZ0 + 33);
  relic(mid.position.x + 2, 2.0, WZ0 + 41.5);
  relic(-doorX * 0.5, MEZ_Y, WZ1 - 3);
  kit.addCheckpoint(2, 'El almacén', new THREE.Vector3(exitX + 3, 0, WZ0 + 2), new THREE.Vector3(exitX, 0.2, WZ0 + 2.2));
  kit.addCheckpoint(3, 'Mitad del almacén', new THREE.Vector3(mid.position.x + 2, 2.0, WZ0 + 38.5), new THREE.Vector3(mid.position.x, 2.2, WZ0 + 39));
  kit.addCheckpoint(4, 'Pasillo de emergencia', new THREE.Vector3(doorX + 3.2, MEZ_Y, WZ1 - 2.2), new THREE.Vector3(doorX, MEZ_Y + 0.2, WZ1 - 2.5));

  // ======================================================================
  // 3. ¡CORRE! — the red corridor. It repeats forever… until you pull the 3 levers hidden
  //    in nooks along the walls. Light orbs (granadas de luz) blind the Corredor for a while.
  // ======================================================================
  const CZ0 = WZ1;
  const CY = MEZ_Y;
  const SEG = 18;
  const LZ0 = CZ0 + 10;
  const NSEG = 4; // 0-2 real, 3 = a copy of 0 (what you see ahead before the loop takes you back)
  const CEND = LZ0 + NSEG * SEG;
  const corrLamp = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const corrCeil = new THREE.MeshStandardMaterial({ color: 0x3b2222, roughness: 1, side: THREE.DoubleSide });
  const cw = (id: string, z0: number, z1: number, side: number) => wall(id, doorX + side * 1.8, z0, doorX + side * 1.8, z1, CY + 4.2, CY - 9.5);
  // Entrance stretch
  kit.addPlatform('br_c_floorA', doorX, CY, (CZ0 + LZ0) / 2, 3.6, LZ0 - CZ0, 0.5, carpetB);
  cw('br_c_wA', CZ0, LZ0, -1);
  cw('br_c_eA', CZ0, LZ0, 1);
  // The repeating stretches
  const levers: CorridorInfo['levers'] = [];
  const NOOK0 = 2.4;
  const NOOK1 = 4.8;
  for (let k = 0; k < NSEG; k++) {
    const z = LZ0 + k * SEG;
    const side = k === 1 ? 1 : -1;
    kit.addPlatform(`br_c_f${k}a`, doorX, CY, z + 3.7, 3.6, 7.4, 0.5, carpetB);
    kit.addPlatform(`br_c_f${k}b`, doorX, CY, z + 13.8, 3.6, 8.4, 0.5, carpetB);
    kit.addPlatform(`br_c_h${k}`, doorX, CY + 0.75, z + 13.5, 3.6, 0.5, 0.75, crateB);
    // Wall with a nook on one side
    cw(`br_c_s${k}a`, z, z + NOOK0, side);
    cw(`br_c_s${k}b`, z + NOOK1, z + SEG, side);
    cw(`br_c_o${k}`, z, z + SEG, -side);
    const nx = doorX + side * 3.0;
    kit.addPlatform(`br_c_nook${k}`, nx, CY, z + (NOOK0 + NOOK1) / 2, 2.4, NOOK1 - NOOK0, 0.5, carpetB);
    wall(`br_c_nb${k}`, doorX + side * 4.2, z + NOOK0, doorX + side * 4.2, z + NOOK1, CY + 4.2, CY - 0.6);
    wall(`br_c_ns${k}`, doorX + side * 1.8, z + NOOK0, doorX + side * 4.2, z + NOOK0, CY + 4.2, CY - 0.6);
    wall(`br_c_nn${k}`, doorX + side * 1.8, z + NOOK1, doorX + side * 4.2, z + NOOK1, CY + 4.2, CY - 0.6);
    ceiling(doorX + Math.min(side * 1.8, side * 4.2), z + NOOK0, doorX + Math.max(side * 1.8, side * 4.2), z + NOOK1, CY + 4.2, corrCeil, 2);
    const lv = leverModel();
    lv.group.position.set(doorX + side * 4.0, CY, z + (NOOK0 + NOOK1) / 2);
    lv.group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    root.add(lv.group);
    if (k < 3) levers.push({ pos: new THREE.Vector3(doorX + side * 3.4, CY, z + (NOOK0 + NOOK1) / 2), handle: lv.handle, copies: [], pulled: false });
    else levers[0].copies.push(lv.handle);
    for (let u = 3; u < SEG; u += 6) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), corrLamp);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(doorX, CY + 4.18, z + u);
      root.add(lamp);
    }
  }
  wall('br_c_n', doorX - 1.8, CEND + 2, doorX + 1.8, CEND + 2, CY + 4.2, CY - 0.6);
  cw('br_c_wE', CEND, CEND + 2, -1);
  cw('br_c_eE', CEND, CEND + 2, 1);
  kit.addPlatform('br_c_floorE', doorX, CY, CEND + 1, 3.6, 2, 0.5, carpetB);
  ceiling(doorX - 1.8, CZ0, doorX + 1.8, CEND + 2, CY + 4.2, corrCeil, 2);
  voidPlane(doorX - 1.8, LZ0, doorX + 1.8, CEND, CY - 9);
  // EXIT sign over the end door
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), new THREE.MeshBasicMaterial({ map: exitTex() }));
  sign.position.set(doorX, CY + 3.4, CEND + 1.75);
  sign.rotation.y = Math.PI;
  root.add(sign);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.4 }));
  door.position.set(doorX, CY + 1.3, CEND + 1.9);
  root.add(door);
  relic(doorX, CY, CZ0 + 6);
  relic(doorX, CY, LZ0 + SEG + 11);
  relic(island2.position.x, 2.4, WZ0 + 59);
  relic(keyAt.x + 1.5, 0, keyAt.z + 1.5);

  // ======================================================================
  // Monsters
  // ======================================================================
  const hazards = new BackroomsHazards(
    root,
    diff,
    maze,
    cameraColliders.filter((o) => o instanceof THREE.Mesh && (o as THREE.Mesh).material === wallMat),
    { minX: -WX, maxX: WX, minZ: WZ0, maxZ: WZ1 - 0.5, lamps: wareLamp },
    { x: doorX, z0: CZ0, loopZ0: LZ0, seg: SEG, y: CY, end: CEND, levers, lamps: corrLamp },
    { plat: doorPlat, mesh: doorMesh, light: doorLightMat, pos: new THREE.Vector3(exitX, WALL_H, ZE), open: false, openT: 0, hintCd: 0 },
    [lampFlickA, lampFlickB]
  );
  void redLamp;
  void concMat;
  const farCells: [number, number][] = [];
  for (let i = 0; i < NX; i++) for (let j = 2; j < NZ; j++) if (i !== keyCell[0] || j !== keyCell[1]) farCells.push([i, j]);
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
  // Sonrisas wait up in the dark, over the pit
  const nSmiles = 4 + Math.round(diff * 2);
  for (let k = 0; k < nSmiles; k++) {
    const z = WZ0 + 14 + (k / Math.max(1, nSmiles - 1)) * (WL - 26);
    const x = (k % 2 ? 1 : -1) * (6 + rng() * 9);
    hazards.add(root, 'sonrisa', new THREE.Vector3(x, 6.5 + rng() * 2, z));
  }
  hazards.add(root, 'corredor', new THREE.Vector3(doorX, CY, CZ0 - 1));

  const summit = new THREE.Vector3(doorX, CY + 0.2, CEND + 0.6);
  const items: ItemSpot[] = [
    { type: 'llave', pos: new THREE.Vector3(keyAt.x, 0.95, keyAt.z) },
    { type: 'baya', pos: new THREE.Vector3(-3.5, 0.95, -6.5) },
    { type: 'baya', pos: new THREE.Vector3(exitX - 1, 0.95, WZ0 + 3.5) },
    { type: 'baya', pos: new THREE.Vector3(doorX - 4, MEZ_Y + 0.95, WZ1 - 3) },
    { type: 'nuez', pos: new THREE.Vector3(cellCenter(exitI, NZ - 1).x, 0.95, cellCenter(exitI, NZ - 1).z) },
    // Light orbs: here they're light grenades that blind the monsters
    { type: 'luz', pos: new THREE.Vector3(exitX + 1.5, 0.95, WZ0 + 4.5) },
    { type: 'luz', pos: new THREE.Vector3(doorX + 2.5, MEZ_Y + 0.95, WZ1 - 4) },
    { type: 'luz', pos: new THREE.Vector3(doorX, CY + 0.95, CZ0 + 4) },
  ];
  const world = kit.finish(summit, enemies, items, new THREE.Vector3(doorX + 1.2, CY + 1.2, CEND - 3));
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
  const N = 15;
  const CELL = 6.5;
  const g = gridMaze(rng, N, N, CELL, 0.12);
  // Two open halls (2×2) to fight in
  const halls: [number, number][] = [
    [3 + Math.floor(rng() * 2), 9 + Math.floor(rng() * 2)],
    [9 + Math.floor(rng() * 2), 3 + Math.floor(rng() * 2)],
  ];
  for (const [hi, hj] of halls) {
    g.east[hi][hj] = g.east[hi][hj + 1] = true;
    g.north[hi][hj] = g.north[hi + 1][hj] = true;
  }
  // The middle cell is open on every side (the portal appears there)
  const mid = Math.floor(N / 2);
  g.east[mid][mid] = g.east[mid - 1][mid] = g.north[mid][mid] = g.north[mid][mid - 1] = true;
  const HALF = (N * CELL) / 2;
  const fixedCell = (i: number, j: number) => (i === mid && j === mid) || halls.some(([hi, hj]) => i >= hi && i <= hi + 1 && j >= hj && j <= hj + 1);

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

  // ---- Moving walls: about a quarter of the inner walls can rise from the floor or sink into it,
  //      so the maze changes shape while you fight (the Skinwalker does it when it's hurt) ----
  interface MovingWall {
    dir: 'e' | 'n';
    i: number;
    j: number;
    plat: PlatformItem;
    obs: { x: number; z: number; hx: number; hz: number };
    home: { x: number; z: number; hx: number; hz: number };
    cur: number;
    target: number;
  }
  const moving: MovingWall[] = [];
  const isMoving = new Set<string>();
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (const dir of ['e', 'n'] as const) {
        if (dir === 'e' && i >= N - 1) continue;
        if (dir === 'n' && j >= N - 1) continue;
        const [i2, j2] = dir === 'e' ? [i + 1, j] : [i, j + 1];
        if (fixedCell(i, j) || fixedCell(i2, j2)) continue;
        if (rng() < 0.27) isMoving.add(`${dir}${i},${j}`);
      }
  // Fixed walls (merged into long runs)
  let wn = 0;
  for (let j = 0; j < N - 1; j++) {
    let start = -1;
    for (let i = 0; i <= N; i++) {
      const closed = i < N && !g.north[i][j] && !isMoving.has(`n${i},${j}`);
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
      const closed = j < N && !g.east[i][j] && !isMoving.has(`e${i},${j}`);
      if (closed && start < 0) start = j;
      if (!closed && start >= 0) {
        const x = g.x0 + (i + 1) * CELL;
        wallSeg(`sw_v${wn++}`, x, g.z0 + start * CELL, x, g.z0 + j * CELL);
        start = -1;
      }
    }
  }
  const WH = WALL_H + 0.5;
  for (const key of isMoving) {
    const dir = key[0] as 'e' | 'n';
    const [i, j] = key.slice(1).split(',').map(Number);
    const x0 = dir === 'e' ? g.x0 + (i + 1) * CELL : g.x0 + i * CELL;
    const z0 = dir === 'e' ? g.z0 + j * CELL : g.z0 + (j + 1) * CELL;
    const x1 = dir === 'e' ? x0 : x0 + CELL;
    const z1 = dir === 'e' ? z0 + CELL : z0;
    const sx = Math.max(0.4, Math.abs(x1 - x0) + (x1 !== x0 ? 0.4 : 0));
    const sz = Math.max(0.4, Math.abs(z1 - z0) + (z1 !== z0 ? 0.4 : 0));
    const plat = kit.addPlatform(`sw_m${key}`, (x0 + x1) / 2, WALL_H, (z0 + z1) / 2, sx, sz, WH, P.wallB);
    plat.solid = true;
    const home = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2 + 0.2, hz: Math.abs(z1 - z0) / 2 + 0.2 };
    const closed = dir === 'e' ? !g.east[i][j] : !g.north[i][j];
    const obs = closed ? { ...home } : { x: 1e6, z: 1e6, hx: 0, hz: 0 };
    obstacles.push(obs);
    const w: MovingWall = { dir, i, j, plat, obs, home, cur: closed ? 1 : 0, target: closed ? 1 : 0 };
    moving.push(w);
  }
  const setOpen = (w: MovingWall, open: boolean) => {
    if (w.dir === 'e') g.east[w.i][w.j] = open;
    else g.north[w.i][w.j] = open;
  };
  const placeWall = (w: MovingWall) => {
    w.plat.mesh.position.y = THREE.MathUtils.lerp(-0.7, WALL_H, w.cur);
    w.plat.mesh.visible = w.cur > 0.01;
    // Solid only once it's mostly up (and gone as soon as it starts to sink)
    const solid = w.target > 0.5 && w.cur > 0.55;
    w.plat.position.y = solid ? WALL_H : -100;
    if (solid) Object.assign(w.obs, w.home);
    else Object.assign(w.obs, { x: 1e6, z: 1e6, hx: 0, hz: 0 });
  };
  moving.forEach(placeWall);
  let shiftN = 0;
  const allConnected = () => {
    const seen = new Set<number>([0]);
    const q: [number, number][] = [[0, 0]];
    for (let h = 0; h < q.length; h++)
      for (const [a, b] of gNeighbors(g, q[h][0], q[h][1])) if (!seen.has(a * 100 + b)) (seen.add(a * 100 + b), q.push([a, b]));
    return seen.size === N * N ? null : seen;
  };
  const shiftMaze = (avoid: THREE.Vector3[]) => {
    const r2 = mulberry32(level * 911 + ++shiftN * 7919);
    const near = (w: MovingWall) => avoid.some((a) => Math.abs(a.x - w.home.x) < w.home.hx + 1.4 && Math.abs(a.z - w.home.z) < w.home.hz + 1.4);
    let changed = 0;
    const want = new Map<MovingWall, boolean>();
    for (const w of moving) {
      const close = r2() < 0.55 && !near(w);
      want.set(w, close);
      setOpen(w, !close);
    }
    // Make sure you can still reach every room: open walls between the parts that got cut off
    for (let guard = 0; guard < 400; guard++) {
      const seen = allConnected();
      if (!seen) break;
      const cand = moving.filter((w) => {
        if (!want.get(w)) return false;
        const a = w.i * 100 + w.j;
        const b = w.dir === 'e' ? (w.i + 1) * 100 + w.j : w.i * 100 + w.j + 1;
        return seen.has(a) !== seen.has(b);
      });
      if (!cand.length) break;
      const w = cand[Math.floor(r2() * cand.length)];
      want.set(w, false);
      setOpen(w, true);
    }
    for (const w of moving) {
      const t = want.get(w) ? 1 : 0;
      if (t !== w.target) changed++;
      w.target = t;
      placeWall(w);
    }
    return changed;
  };
  kit.animators.push((dt) => {
    for (const w of moving) {
      if (w.cur === w.target) continue;
      w.cur = THREE.MathUtils.clamp(w.cur + Math.sign(w.target - w.cur) * dt * 0.85, 0, 1);
      placeWall(w);
    }
  });
  // A wall of the room you're in, to burst out of
  const wallNear = (p: THREE.Vector3) => {
    const [ci, cj] = gCell(g, p);
    const c = gCenter(g, ci, cj);
    const sides: { d: THREE.Vector3; closed: boolean }[] = [
      { d: new THREE.Vector3(1, 0, 0), closed: ci >= N - 1 || !g.east[ci][cj] },
      { d: new THREE.Vector3(-1, 0, 0), closed: ci <= 0 || !g.east[ci - 1][cj] },
      { d: new THREE.Vector3(0, 0, 1), closed: cj >= N - 1 || !g.north[ci][cj] },
      { d: new THREE.Vector3(0, 0, -1), closed: cj <= 0 || !g.north[ci][cj - 1] },
    ];
    const opts = sides
      .filter((s) => s.closed)
      .map((s) => ({
        pos: c
          .clone()
          .addScaledVector(s.d, CELL / 2 - 0.22)
          .setY(Y),
        normal: s.d.clone().negate(),
      }))
      // not right next to you
      .filter((o) => Math.hypot(o.pos.x - p.x, o.pos.z - p.z) > 2.4);
    if (!opts.length) return null;
    return opts[Math.floor(Math.random() * opts.length)];
  };
  P.ceiling(-HALF, -HALF, HALF, HALF, WALL_H);
  // Lamps: many broken, a few flickering; a blackout turns them all off
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
  let lights = 1;
  const OFF = 0x14120a;
  kit.animators.push((_dt, time) => {
    if (lights < 0.5) {
      P.lampOn.color.setHex(OFF);
      P.lampFlickA.color.setHex(OFF);
      P.lampFlickB.color.setHex(OFF);
      return;
    }
    P.lampOn.color.setHex(0xfffbe6);
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
    shiftMaze,
    wallNear,
    setLights: (on) => {
      lights = on;
    },
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
  // Magic berries, so your companion's power can be used again (Hombre Polilla's rewind too)
  shuffledCells.slice(10, 14).forEach((c) => items.push({ type: 'baya', pos: new THREE.Vector3(c.x - 1, Y + 0.95, c.z - 1) }));

  // Relics in dead ends (or anywhere if there aren't enough)
  const relicCells = [...deadEnds.sort(() => rng() - 0.5).map(([i, j]) => gCenter(g, i, j)), ...shuffledCells.slice(14)];
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
