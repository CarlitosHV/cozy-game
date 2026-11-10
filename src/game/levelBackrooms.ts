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
import { makeBat, makeStone } from './toolModels';

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

/**
 * La Araña: a spider that came out wrong, like a glitch in the game. A big pale spider with a
 * second, smaller one fused upside down on its back (its legs kick at the air), the folded
 * forelegs of a praying mantis, far too many eyes… and parts that jitter, tear and leave colored
 * ghosts behind like a bad video signal.
 */
function spiderModel(): MonsterModel {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const shell = new THREE.MeshStandardMaterial({ color: 0x221d19, roughness: 0.4, metalness: 0.1 });
  const flesh = new THREE.MeshStandardMaterial({ color: 0xbdb19d, roughness: 0.85, flatShading: true });
  const joint = new THREE.MeshStandardMaterial({ color: 0x4a3f36, roughness: 0.7 });
  const mantis = new THREE.MeshStandardMaterial({ color: 0x7d8a45, roughness: 0.55, flatShading: true });
  const red = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const white = new THREE.MeshBasicMaterial({ color: 0xf3efe4 });
  const black = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  /** A capsule from a to b */
  const bone = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
    const len = a.distanceTo(b);
    const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 6), mat, parent);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  };
  /** A spider body (chest + abdomen) with legs; returns the legs to animate */
  const spiderBody = (parent: THREE.Object3D, nLegs: number, reach: number) => {
    const chest = mesh(new THREE.SphereGeometry(0.42, 14, 10), shell, parent);
    chest.scale.set(1, 0.7, 1.15);
    chest.position.set(0, 0.85, 0.35);
    const abdomen = mesh(new THREE.SphereGeometry(0.62, 16, 12), flesh, parent);
    abdomen.scale.set(1, 0.85, 1.25);
    abdomen.position.set(0, 1.0, -0.6);
    // Dark marks on the pale abdomen
    for (let k = 0; k < 4; k++) {
      const spot = mesh(new THREE.SphereGeometry(0.14, 8, 6), shell, parent);
      spot.scale.set(1.4, 0.25, 0.8);
      spot.position.set((k % 2 ? 0.18 : -0.18), 1.5 - k * 0.04, -0.3 - k * 0.28);
    }
    const legs: { hip: THREE.Group; side: number; phase: number; base: number }[] = [];
    const per = nLegs / 2;
    for (let k = 0; k < per; k++)
      for (const side of [1, -1]) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.3, 0.86, 0.6 - (k * 0.62) / Math.max(1, per - 1));
        const fwd = 0.75 - (k * 1.45) / Math.max(1, per - 1);
        const base = -side * fwd;
        hip.rotation.y = base;
        const knee = new THREE.Vector3(side * 0.7 * reach, 0.55, 0);
        const foot = new THREE.Vector3(side * 1.3 * reach, -0.86, 0);
        mesh(new THREE.SphereGeometry(0.075, 8, 6), joint, hip);
        bone(hip, new THREE.Vector3(), knee, 0.065, shell);
        const kj = mesh(new THREE.SphereGeometry(0.07, 8, 6), joint, hip);
        kj.position.copy(knee);
        bone(hip, knee, foot, 0.045, flesh);
        parent.add(hip);
        legs.push({ hip, side, phase: (k + (side > 0 ? 0 : 1)) % 2 ? Math.PI : 0, base });
      }
    return { chest, abdomen, legs };
  };

  // ---- The big spider ----
  const main = spiderBody(rig, 8, 1);
  // Too many eyes: a cluster of red ones and two human-looking ones
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.98, 0.78);
  rig.add(eyes);
  const blinkers: THREE.Mesh[] = [];
  for (let k = 0; k < 7; k++) {
    const e = mesh(new THREE.SphereGeometry(0.035 + (k % 3) * 0.012, 8, 6), red, eyes);
    e.position.set(((k % 4) - 1.5) * 0.09, (k < 4 ? 0.05 : -0.04) + Math.sin(k) * 0.02, 0.02);
    blinkers.push(e);
  }
  for (const s of [1, -1]) {
    const eye = mesh(new THREE.SphereGeometry(0.075, 12, 10), white, eyes);
    eye.position.set(s * 0.2, -0.02, -0.04);
    const pupil = mesh(new THREE.SphereGeometry(0.03, 8, 6), black, eye);
    pupil.position.set(0, 0, 0.06);
    blinkers.push(eye);
  }
  // Fangs
  for (const s of [1, -1]) {
    const f = mesh(new THREE.ConeGeometry(0.05, 0.28, 6), shell, rig);
    f.position.set(s * 0.1, 0.7, 0.86);
    f.rotation.x = Math.PI * 0.85;
  }
  // ---- The mantis forelegs: folded scythes that snap out ----
  const scythes: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.22, 0.95, 0.7);
    bone(arm, new THREE.Vector3(), new THREE.Vector3(s * 0.08, 0.55, 0.3), 0.06, mantis);
    const fore = new THREE.Group();
    fore.position.set(s * 0.08, 0.55, 0.3);
    bone(fore, new THREE.Vector3(), new THREE.Vector3(0, -0.15, 0.55), 0.05, mantis);
    const bladeTip = mesh(new THREE.ConeGeometry(0.06, 0.55, 4), mantis, fore);
    bladeTip.position.set(0, -0.35, 0.55);
    bladeTip.rotation.x = Math.PI;
    for (let k = 0; k < 4; k++) {
      const spine = mesh(new THREE.ConeGeometry(0.015, 0.09, 4), shell, fore);
      spine.position.set(0, -0.06 - k * 0.04, 0.12 + k * 0.11);
      spine.rotation.x = Math.PI;
    }
    fore.rotation.x = 1.2;
    arm.add(fore);
    rig.add(arm);
    scythes.push(fore);
  }
  // ---- The second spider, fused upside down on its back ----
  const rider = new THREE.Group();
  rider.position.set(0.05, 1.95, -0.5);
  rider.rotation.set(Math.PI, 0.5, 0.18);
  rider.scale.setScalar(0.75);
  rig.add(rider);
  const small = spiderBody(rider, 6, 0.9);
  for (let k = 0; k < 3; k++) {
    const e = mesh(new THREE.SphereGeometry(0.05, 8, 6), red, rider);
    e.position.set((k - 1) * 0.1, 0.98, 0.78);
  }

  // ---- Glitch: colored ghosts that flash around it, parts that jump and vanish ----
  const ghostMat = (color: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const ghosts: THREE.Group[] = [];
  for (const color of [0xff0044, 0x00e5ff]) {
    const gh = new THREE.Group();
    const mat = ghostMat(color);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat);
    c.scale.set(1, 0.7, 1.15);
    c.position.set(0, 0.85, 0.35);
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), mat);
    a.scale.set(1, 0.85, 1.25);
    a.position.set(0, 1.0, -0.6);
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), mat);
    r.position.set(0.05, 1.95, -0.5);
    gh.add(c, a, r);
    gh.visible = false;
    g.add(gh);
    ghosts.push(gh);
  }
  const jumpy: THREE.Object3D[] = [main.chest, main.abdomen, rider, eyes, ...scythes.map((s) => s.parent!), ...main.legs.map((l) => l.hip)];
  const home = jumpy.map((o) => o.position.clone());
  let glitchT = 0.5;
  let glitching = 0;
  let frozen = 0;

  return {
    group: g,
    anim: (t, moving, dt) => {
      // A frozen frame now and then: it stops dead, then jumps ahead
      if (frozen > 0) {
        frozen -= dt;
        return;
      }
      const sp = moving ? 14 : 2.4;
      for (const l of main.legs) {
        const s = Math.sin(t * sp + l.phase);
        l.hip.rotation.y = l.base + s * (moving ? 0.3 : 0.04);
        l.hip.rotation.z = l.side * Math.max(0, Math.cos(t * sp + l.phase)) * (moving ? 0.3 : 0.03);
      }
      // The one on its back kicks at the air out of step, like stop-motion
      small.legs.forEach((l, i) => {
        const q = Math.round(Math.sin(t * 19 + i * 1.7) * 3) / 3;
        l.hip.rotation.y = l.base + q * 0.5;
        l.hip.rotation.z = l.side * (0.2 + Math.abs(q) * 0.4);
      });
      rider.rotation.z = 0.15 + Math.sin(t * 5.3) * 0.12;
      // Scythes: folded… then a snap
      const snap = moving ? Math.pow(Math.max(0, Math.sin(t * 2.7)), 10) : 0;
      for (const s of scythes) s.rotation.x = 1.2 - snap * 1.7;
      main.abdomen.scale.y = 0.85 + Math.sin(t * 3) * 0.03;
      rig.position.y = moving ? Math.abs(Math.sin(t * sp * 2)) * 0.04 : 0;
      for (let i = 0; i < blinkers.length; i++) blinkers[i].visible = Math.sin(t * (2 + i * 0.7) + i * 3) > -0.92;

      glitchT -= dt;
      if (glitchT <= 0) {
        glitchT = moving ? 0.07 + Math.random() * 0.45 : 0.4 + Math.random() * 1.4;
        glitching = 0.04 + Math.random() * 0.12;
        // shuffle a few parts out of place, maybe drop one, maybe stretch the whole thing
        jumpy.forEach((o, i) => {
          o.position.copy(home[i]);
          o.visible = true;
          if (Math.random() < 0.3) o.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.4));
          if (Math.random() < 0.06) o.visible = false;
        });
        rig.scale.set(1 + (Math.random() < 0.3 ? (Math.random() - 0.3) * 0.5 : 0), 1 + (Math.random() < 0.2 ? (Math.random() - 0.5) * 0.4 : 0), 1);
        ghosts[0].position.set(0.08 + Math.random() * 0.12, 0, 0);
        ghosts[1].position.set(-0.08 - Math.random() * 0.12, 0, 0.05);
        if (Math.random() < 0.08) frozen = 0.12 + Math.random() * 0.12;
      }
      if (glitching > 0) {
        glitching -= dt;
        for (const gh of ghosts) gh.visible = true;
        if (glitching <= 0) {
          for (const gh of ghosts) gh.visible = false;
          jumpy.forEach((o, i) => {
            o.position.copy(home[i]);
            o.visible = true;
          });
          rig.scale.set(1, 1, 1);
        }
      }
    },
  };
}

// ---------------------------------------------------------------- Maze

const C = 7; // cell size (m)
// The yellow maze changes size from level to level: buildBackroomsWorld sets these first
// (only one Backrooms level exists at a time)
let NX = 8;
let NZ = 7;
let X0 = -(NX * C) / 2;
const Z0 = 0;
/** First of the two cells the start room opens into */
let SI = NX / 2 - 1;
function configureMaze(nx: number, nz: number) {
  NX = nx;
  NZ = nz;
  X0 = -(NX * C) / 2;
  SI = NX / 2 - 1;
}
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
  const stack: [number, number][] = [[SI, 0]];
  seen[SI][0] = true;
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

type MonsterKind = 'maniqui' | 'gateador' | 'sonrisa' | 'arana';
const NAMES: Record<MonsterKind, string> = { maniqui: 'el Maniquí', gateador: 'el Gateador', sonrisa: 'una Sonrisa', arana: 'la Araña' };
/** "al Maniquí", "a la Araña", "a una Sonrisa" */
const toWhom = (k: MonsterKind) => NAMES[k].replace(/^el /, 'al ').replace(/^la /, 'a la ').replace(/^una /, 'a una ');

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
  /** La Araña: crawling on the ceiling (1) or on the floor (0), and when it switches */
  ceil?: number;
  ceilT?: number;
  ceilWant?: boolean;
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
  /** The door at the end of the loop: it opens when the 3 levers are pulled (the run is behind it) */
  gate: { plat: PlatformItem; mesh: THREE.Object3D; top: number; t: number };
  end: number;
  levers: { pos: THREE.Vector3; handle: THREE.Object3D; copies: THREE.Object3D[]; pulled: boolean }[];
  lamps: THREE.MeshBasicMaterial;
  /** The run at the end: from z0 to z1, with holes in the floor (the spider crosses them on the ceiling) */
  run: { z0: number; z1: number; gaps: [number, number][]; lamps: THREE.MeshBasicMaterial; ceilY: number };
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
  private giggleCd = 0;
  private solved = false;
  /** La Araña waits a moment before coming back after it caught you */
  private spiderDelay = 0;
  private glitchCd = 0;
  private skitterCd = 0;
  private runMsg = false;

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
      kind === 'maniqui' ? mannequinModel() : kind === 'gateador' ? crawlerModel(1, 0xf5f5dc) : kind === 'arana' ? spiderModel() : smileModel();
    model.group.position.copy(at);
    root.add(model.group);
    const m: Monster = { kind, model, pos: at.clone(), home: at.clone(), yaw: 0, active: false, target: null, wanderT: 0, seenT: 0, seen: false, fade: kind === 'sonrisa' ? 0 : 1, stunT: 0 };
    if (kind === 'sonrisa') m.mats = (model as ReturnType<typeof smileModel>).mats;
    if (kind === 'arana') {
      model.group.visible = false;
      m.ceil = 0;
      m.ceilT = 3;
    }
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
    const gate = this.corr.gate;
    gate.t = 0;
    gate.plat.position.y = gate.top;
    gate.mesh.position.y = 0;
    gate.mesh.visible = true;
    this.solved = false;
    this.corr.lamps.color.setHex(0xff2a2a);
    this.spiderDelay = 0;
    this.runMsg = false;
  }

  private sendHome(m: Monster) {
    m.pos.copy(m.home);
    m.active = false;
    m.target = null;
    m.wanderT = 0;
    m.stunT = 0;
    m.fade = m.kind === 'sonrisa' ? 0 : 1;
    m.model.group.position.copy(m.home);
    if (m.kind === 'arana') {
      m.model.group.visible = false;
      m.ceil = 0;
      m.model.group.rotation.z = 0;
    }
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
  // ---- Bat and slingshot: they don't kill the monsters, but they stun them for a moment ----
  private bat: THREE.Group | null = null;
  private batT = -1;
  private batCd = 0;
  private hasBat = false;
  private yaw = 0;
  private stones: { mesh: THREE.Mesh; pos: THREE.Vector3; target: Monster; life: number }[] = [];

  /** A monster you could hit right now (not hidden, not a sleeping spider) */
  private hittable(m: Monster) {
    if (m.kind === 'arana') return m.active && (m.ceil ?? 0) < 0.5;
    if (m.kind === 'sonrisa') return m.fade > 0.3;
    return true;
  }

  /** It reels back, stunned (the maze ones just freeze: pushing them could put them in a wall). */
  private stun(m: Monster, seconds: number, from: THREE.Vector3, push: number) {
    m.stunT = Math.max(m.stunT, seconds);
    if (m.kind === 'sonrisa' || m.kind === 'arana') {
      const d = new THREE.Vector3(m.pos.x - from.x, 0, m.pos.z - from.z);
      if (d.lengthSq() > 1e-4) {
        d.normalize();
        if (m.kind === 'arana') m.pos.z += Math.sign(d.z || -1) * push;
        else m.pos.addScaledVector(d, push);
      }
    }
    soundManager.playBoneCrack(0.6);
    if (m.kind === 'arana') soundManager.playGlitch(1);
  }

  private swingBat(): ToolResult {
    if (this.batCd > 0) return 'none';
    this.batCd = 0.45;
    this.batT = 0;
    soundManager.playWindGust();
    const P = this.lastP;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    let best: Monster | null = null;
    let bestD = 2.9;
    for (const m of this.monsters) {
      if (!this.hittable(m)) continue;
      const dx = m.pos.x - P.x;
      const dz = m.pos.z - P.z;
      const d = Math.hypot(dx, dz);
      // in reach, and roughly in front (or right on top of you)
      if (d > bestD || Math.abs(m.pos.y - P.y) > 2.6 || (d > 1 && (dx * fx + dz * fz) / d < 0.1)) continue;
      bestD = d;
      best = m;
    }
    if (!best) return 'used';
    this.stun(best, best.kind === 'arana' ? 1.6 : 3, P, best.kind === 'arana' ? 4 : 2.5);
    this.notify?.(`¡Pum! Aturdiste ${toWhom(best.kind)} un momento: ¡aléjate!`);
    return 'wear';
  }

  private shootStone(): ToolResult {
    const P = this.lastP;
    const here = cellOf(P);
    let best: Monster | null = null;
    let bestD = 22;
    for (const m of this.monsters) {
      if (!this.hittable(m)) continue;
      const d = m.pos.distanceTo(P);
      if (d > bestD) continue;
      // in the maze, only what's in your room or the next one (the walls stop the stone)
      if (here && this.inMaze(m.pos)) {
        const there = cellOf(m.pos);
        if (!there || bfs(this.maze, here, there).dist > 1) continue;
      }
      bestD = d;
      best = m;
    }
    if (!best) {
      this.notify?.('No hay ningún monstruo a tiro');
      return 'none';
    }
    const mesh = makeStone(0.13);
    mesh.position.set(P.x, P.y + 1.2, P.z);
    this.root.add(mesh);
    this.stones.push({ mesh, pos: mesh.position, target: best, life: 1.6 });
    soundManager.playWoodRattle();
    return 'wear';
  }

  /** The bat in your hand (and its swing), and the stones in the air. */
  private updateWeapons(dt: number, P: THREE.Vector3) {
    this.batCd = Math.max(0, this.batCd - dt);
    if (this.hasBat || this.batT >= 0) {
      if (!this.bat) {
        this.bat = makeBat();
        this.root.add(this.bat);
      }
      const bat = this.bat;
      bat.visible = true;
      const side = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
      const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (this.batT >= 0) {
        this.batT += dt / 0.28;
        const k = Math.min(1, this.batT);
        const a = -1.2 + k * 2.6;
        const dir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(fwd, Math.sin(a) + 0.4).normalize();
        bat.position.set(P.x + dir.x * 0.4, P.y + 0.95, P.z + dir.z * 0.4);
        bat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().setY(0.15).normalize());
        if (this.batT >= 1) this.batT = -1;
      } else {
        bat.position.set(P.x + side.x * 0.42 - fwd.x * 0.05, P.y + 0.55, P.z + side.z * 0.42 - fwd.z * 0.05);
        bat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(fwd.x * 0.3, 1, fwd.z * 0.3).normalize());
      }
    } else if (this.bat) this.bat.visible = false;
    for (let i = this.stones.length - 1; i >= 0; i--) {
      const s = this.stones[i];
      s.life -= dt;
      const to = new THREE.Vector3(s.target.pos.x, s.target.pos.y + 0.9, s.target.pos.z).sub(s.pos);
      const d = to.length();
      const step = 30 * dt;
      if (d <= step + 0.3) {
        if (this.hittable(s.target)) {
          this.stun(s.target, s.target.kind === 'arana' ? 1.2 : 2.5, P, s.target.kind === 'arana' ? 2.5 : 1.5);
          this.notify?.(`¡Le diste ${toWhom(s.target.kind)}! ${s.target.kind === 'arana' || s.target.kind === 'sonrisa' ? 'Quedó aturdida' : 'Quedó aturdido'} un momento`);
        }
        s.life = 0;
      } else s.pos.addScaledVector(to, step / d);
      if (s.life <= 0) {
        this.root.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.stones.splice(i, 1);
      }
    }
  }

  useItem(type: ItemType): ToolResult {
    if (type === 'bate') return this.swingBat();
    if (type === 'resortera') return this.shootStone();
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
    return Math.abs(p.x - c.x) < 5 && p.z > c.z0 && p.z < c.end + 3 && p.y > c.y - 6;
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
      for (const o of this.monsters) if (o.pos.distanceTo(ctx.position) < 14 || o === m || o.kind === 'arana') this.sendHome(o);
      this.spiderDelay = 2.5;
      this.wareLit = false;
      this.wareT = 8;
      return;
    }
    soundManager.playEnemyBonk();
    ctx.notify(`¡Te mordió ${NAMES[m.kind]}! Te ${this.hearts === 1 ? 'queda 1 corazón' : `quedan ${this.hearts} corazones`}`);
    // It backs off for a moment so you can get away
    if (m.kind === 'sonrisa') {
      m.stunT = 4;
    } else if (m.kind === 'arana') {
      m.pos.z = Math.max(this.corr.z0, m.pos.z - 7);
      m.stunT = 1.2;
      soundManager.playGlitch(1);
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
    this.hasBat = !!ctx.has?.('bate') && !ctx.spectating;
    if (ctx.yaw !== undefined) this.yaw = ctx.yaw;
    this.updateWeapons(dt, P);
    this.grace = Math.max(0, this.grace - dt);
    this.warnCd = Math.max(0, this.warnCd - dt);
    this.loopMsgCd = Math.max(0, this.loopMsgCd - dt);
    this.quetsyCd = Math.max(0, this.quetsyCd - dt);
    this.giggleCd = Math.max(0, this.giggleCd - dt);
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
          soundManager.playDoorCreak();
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
          soundManager.playPowerDown();
          ctx.notify('Las luces se apagaron… las Sonrisas vuelan hacia ti');
        }
      } else {
        this.darkness = 0.82;
        this.ware.lamps.color.setHex(0x1c1a10);
        if (this.wareT <= 0) {
          this.wareLit = true;
          this.wareT = 5.5;
          soundManager.playPowerUp();
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
          soundManager.playClank();
          const n = c.levers.filter((x) => x.pulled).length;
          if (n < c.levers.length) ctx.notify(`¡Palanca ${n}/${c.levers.length}! El pasillo tiembla…`);
        }
      }
      const all = c.levers.every((l) => l.pulled);
      if (all && !this.solved) {
        this.solved = true;
        c.lamps.color.setHex(0x34d399);
        c.gate.plat.position.y = -100;
        soundManager.playVictory();
        soundManager.playDoorCreak();
        ctx.notify('¡Las 3 palancas! Se abrió el final del pasillo… ¡CORRE y salta hasta la SALIDA!');
      }
      // Not solved: past the third stretch you're back at the first one (it looks the same)
      if (!this.solved && P.z > c.loopZ0 + 3 * c.seg) {
        this.shiftAll(new THREE.Vector3(0, 0, -3 * c.seg), ctx);
        soundManager.playStretch();
        if (this.loopMsgCd <= 0) {
          this.loopMsgCd = 12;
          ctx.notify('El pasillo se alarga… nunca llegas a la SALIDA. Busca 3 palancas en los huecos de las paredes');
        }
      }
    }

    // The door at the end of the corridor slides down once it's solved
    if (this.solved && c.gate.t < 1) {
      c.gate.t = Math.min(1, c.gate.t + dt * 0.8);
      c.gate.mesh.position.y = -c.gate.t * 4.4;
      if (c.gate.t >= 1) c.gate.mesh.visible = false;
    }

    // ---- The run: holes in the floor (falling = back to the start of the run) ----
    const run = c.run;
    const inRun = inCorr && P.z > run.z0 - 0.5;
    this.spiderDelay = Math.max(0, this.spiderDelay - dt);
    if (inRun && !ctx.spectating) {
      run.lamps.color.setHex(Math.sin(time * 31) * Math.sin(time * 4.7) > 0.6 ? 0x3a0808 : 0xff2a2a);
      if (!this.runMsg) {
        this.runMsg = true;
        ctx.notify('¡No te detengas! Salta las vallas y los hoyos: la Araña no se cansa');
      }
      if (P.y < c.y - 2.5 && this.grace <= 0) {
        this.grace = 1.5;
        for (const o of this.monsters) if (o.kind === 'arana') this.sendHome(o);
        this.spiderDelay = 2.5;
        ctx.caught('¡Caíste al vacío! Vuelves al inicio de la carrera');
        return;
      }
    }

    soundManager.setTension(ctx.spectating ? 0 : this.tensionFor(P, inWare));

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
          if (this.rng() < dt * 0.25 && m.pos.distanceTo(P) < 18) soundManager.playCreak();
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
          if (this.giggleCd <= 0 && m.pos.distanceTo(P) < 7) {
            this.giggleCd = 5 + this.rng() * 4;
            soundManager.playGiggle(0.9);
          }
        } else {
          this.moveTo(m, m.home, stunned ? 9 : 5, dt, true);
        }
        for (const mat of m.mats ?? []) (mat as THREE.MeshBasicMaterial).opacity = (mat === m.mats![0] ? 0.85 : 1) * m.fade;
        m.model.group.visible = m.fade > 0.03;
        // Face the player
        m.yaw = Math.atan2(P.x - m.pos.x, P.z - m.pos.z);
      } else if (m.kind === 'arana') {
        if (!m.active && inCorr && P.z > c.z0 + 8 && !ctx.spectating && this.spiderDelay <= 0) {
          m.active = true;
          // In the run it drops from the ceiling a little behind you; in the corridor it comes from the door
          if (inRun) m.pos.set(c.x, c.y, P.z - 16);
          else m.pos.copy(m.home);
          m.ceil = 0;
          m.ceilT = 3;
          m.model.group.visible = true;
          soundManager.playStalkerWarning();
          soundManager.playGlitch(1);
          soundManager.playScream(0.6);
          ctx.notify(
            inRun
              ? '¡La Araña se cayó del techo detrás de ti! ¡CORRE!'
              : '¡Algo salió mal detrás de ti… una araña sobre otra araña, como un error del juego! ¡CORRE! (lanza un orbe de luz para cegarla)'
          );
        }
        if (m.active) {
          if (!inCorr && !ctx.spectating) {
            this.sendHome(m);
          } else if (!stunned) {
            // In the run it never lets you get away (nor jumps on you right away): it keeps pace
            const behind = P.z - m.pos.z;
            const sp = inRun ? (behind > 16 ? 11.6 : behind < 5 ? 8.7 + 0.6 * this.diff : 9.7 + 0.5 * this.diff) : 8.0 + 0.8 * this.diff;
            const half = 1.5;
            const goal = new THREE.Vector3(THREE.MathUtils.clamp(P.x, c.x - half, c.x + half), 0, P.z);
            this.moveTo(m, goal, sp, dt);
            m.pos.y = c.y;
            moving = true;
            // It crawls on the ceiling over the holes, and now and then just because
            if (inRun) {
              m.ceilT = (m.ceilT ?? 0) - dt;
              if (m.ceilT <= 0) {
                m.ceilWant = !m.ceilWant;
                m.ceilT = m.ceilWant ? 1.5 + this.rng() * 2 : 3 + this.rng() * 4;
              }
            }
            const overGap = run.gaps.some(([a, b]) => m.pos.z > a - 0.6 && m.pos.z < b + 0.6);
            const wantCeil = inRun && (overGap || (!!m.ceilWant && behind > 4));
            if (wantCeil !== (m.ceil ?? 0) > 0.5) {
              // it doesn't climb: it glitches from the floor to the ceiling in one frame
              m.ceil = wantCeil ? 1 : 0;
              if (m.pos.distanceTo(P) < 25) soundManager.playGlitch(0.8);
            }
          }
          // Sounds: legs tapping, and the digital stutter
          const dd = m.pos.distanceTo(P);
          this.skitterCd -= dt;
          this.glitchCd -= dt;
          if (moving && this.skitterCd <= 0 && dd < 20) {
            this.skitterCd = 0.35 + this.rng() * 0.3;
            soundManager.playSkitter(1 - dd / 22);
          }
          if (this.glitchCd <= 0 && dd < 22) {
            this.glitchCd = 2 + this.rng() * 3;
            soundManager.playGlitch(0.4 + 0.5 * (1 - dd / 22));
          }
        }
      }
      // Blinded monsters shake
      const shake = stunned && m.kind !== 'sonrisa' ? Math.sin(time * 60) * 0.05 : 0;
      m.model.anim(time, moving, dt);
      const onCeil = m.kind === 'arana' && (m.ceil ?? 0) > 0.5;
      m.model.group.position.set(m.pos.x + shake, onCeil ? c.run.ceilY : m.pos.y, m.pos.z);
      m.model.group.rotation.set(0, m.yaw, onCeil ? Math.PI : 0);

      // Quetsy guarding you: whatever comes close gets bitten and backs off
      if (ctx.guarding && !stunned && !ctx.spectating && (m.kind !== 'sonrisa' || m.fade > 0.3) && (m.kind !== 'arana' || m.active)) {
        const gx = m.pos.x - P.x;
        const gz = m.pos.z - P.z;
        if (gx * gx + gz * gz < 3.4 * 3.4 && Math.abs(m.pos.y - P.y) < 3) {
          if (m.kind === 'arana') {
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
            ctx.notify(`¡Quetsy mordió ${NAMES[m.kind].replace(/^el /, 'al ').replace(/^una /, 'a una ').replace(/^la /, 'a la ')} y ${m.kind === 'arana' ? 'la' : 'lo'} espantó!`);
          }
          continue;
        }
      }

      // Caught!
      const dangerous = !stunned && (m.kind === 'sonrisa' ? m.fade > 0.6 : m.kind === 'arana' ? m.active && !onCeil : true);
      if (dangerous && this.grace <= 0 && !ctx.spectating) {
        const dx = m.pos.x - P.x;
        const dz = m.pos.z - P.z;
        const dy = m.kind === 'sonrisa' ? m.pos.y - (P.y + 0.9) : m.pos.y - P.y;
        const r = m.kind === 'sonrisa' ? 1.15 : m.kind === 'arana' ? 1.2 : 0.9;
        if (dx * dx + dz * dz < r * r && Math.abs(dy) < (m.kind === 'sonrisa' ? 1.4 : 1.8)) this.bite(m, ctx);
      }
    }
  }

  /** How scared the music should be: something close, chasing you, the dark, 1 heart left. */
  private tensionFor(P: THREE.Vector3, inWare: boolean): number {
    let t = this.hearts === 1 ? 0.6 : 0;
    if (inWare && this.darkness > 0.5) t = Math.max(t, 0.3);
    for (const m of this.monsters) {
      if (m.stunT > 0) continue;
      const d = m.pos.distanceTo(P);
      if (m.kind === 'arana' && m.active) t = Math.max(t, 0.7, 1 - Math.max(0, d - 4) / 30);
      else if (m.kind === 'gateador' && m.active) t = Math.max(t, 0.95 - d / 30);
      else if (m.kind === 'sonrisa' && m.fade > 0.5) t = Math.max(t, 1 - d / 18);
      else if (m.kind === 'maniqui' && d < 10) t = Math.max(t, 0.6 * (1 - d / 10));
    }
    return t;
  }

  /** Moves you, the camera and whoever chases you along the corridor by the same amount. */
  private shiftAll(o: THREE.Vector3, ctx: LevelHazardContext) {
    ctx.shift?.(o);
    for (const m of this.monsters) {
      if (m.kind !== 'arana' || !m.active) continue;
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
  // Everything below comes out of the level's seed: every Backrooms is laid out differently
  configureMaze(rng() < 0.45 + 0.3 * diff ? 10 : 8, 6 + Math.floor(rng() * 3) + (diff > 0.5 ? 1 : 0));

  const P = backroomsParts(kit, root, textures, cameraColliders);
  const { wallMat, concMat, crateMat, metalMat, lampOn, lampFlickA, lampFlickB, redLamp } = P;
  const { carpetB, concB, concWallB, crateB, metalB, wall, ceiling, wallB } = P;
  const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffb02e });
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x050403 });
  const voidPlane = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), voidMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    root.add(m);
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  // ======================================================================
  // 1. NIVEL 0 — the yellow maze (the way out is locked: find the key).
  //    Its size, its walls and a few open halls with columns change every time.
  // ======================================================================
  const maze = makeMaze(rng);
  // Open halls (2×2 or 3×2 rooms) with columns at the inner corners
  const halls: { i: number; j: number; w: number; h: number }[] = [];
  const wantHalls = 1 + Math.floor(rng() * 2) + (NX > 8 ? 1 : 0);
  for (let tries = 0; tries < 30 && halls.length < wantHalls; tries++) {
    const w = rng() < 0.35 ? 3 : 2;
    const h = 2;
    const i = Math.floor(rng() * (NX - w + 1));
    const j = 1 + Math.floor(rng() * (NZ - h));
    if (j + h > NZ) continue;
    if (halls.some((o) => i < o.i + o.w + 1 && o.i < i + w + 1 && j < o.j + o.h + 1 && o.j < j + h + 1)) continue;
    halls.push({ i, j, w, h });
    for (let a = i; a < i + w; a++)
      for (let b = j; b < j + h; b++) {
        if (a < i + w - 1) maze.east[a][b] = true;
        if (b < j + h - 1) maze.north[a][b] = true;
      }
  }
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
  // Columns inside the halls (at the corners between cells, so the monsters still walk through)
  let pn = 0;
  for (const hl of halls)
    for (let a = hl.i + 1; a < hl.i + hl.w; a++)
      for (let b = hl.j + 1; b < hl.j + hl.h; b++) kit.addPlatform(`br_pillar${pn++}`, X0 + a * C, WALL_H, Z0 + b * C, 0.8, 0.8, WALL_H + 0.5, wallB).solid = true;
  ceiling(-7, -9, 7, 0, WALL_H);
  ceiling(X0, Z0, XE, ZE, WALL_H);
  const lampGeo = new THREE.PlaneGeometry(1.4, 0.7);
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NZ; j++) {
      const c = cellCenter(i, j);
      const r = rng();
      if (r > 0.94) continue; // a dead lamp here and there
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
  for (let k = 0; k < 3 + Math.floor(rng() * 4); k++) {
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
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (neighbors(maze, i, j).length === 1 && !(j === 0 && (i === SI || i === SI + 1))) deadEnds.push([i, j]);
  const fromStart = (i: number, j: number) => bfs(maze, [SI, 0], [i, j]).dist;
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
  //    The course is put together from random pieces (crates, shelves, beams, pallets, soggy
  //    boxes, concrete blocks) that climb up to the mezzanine at the far end.
  // ======================================================================
  const WX = 20;
  const WH = 11;
  const MEZ_Y = 4.4;
  const MEZ_D = 12;
  const doorX = Math.round((rng() - 0.5) * 22);
  const courseLen = 60 + Math.floor(rng() * 22) + Math.round(diff * 8);
  const lineX = (z: number) => THREE.MathUtils.lerp(exitX, doorX, THREE.MathUtils.clamp((z - WZ0) / (courseLen + 7), 0, 1));
  // Start ledge (full width) by the door from the maze
  const startLedge = kit.addPlatform('br_w_floor1', 0, 0, WZ0 + 3.5, WX * 2, 7, 9, concB);
  addTape(startLedge.mesh, WX * 2, 7, tapeMat);
  let cz = WZ0 + 7; // where the last piece ends
  let ctop = 0; // how high it is
  let cn = 0;
  const landings: PlatformItem[] = [];
  /** Height of the next piece: climbs toward the mezzanine, never more than an easy jump up */
  const nextTop = (zc: number) => {
    const goal = THREE.MathUtils.lerp(0.6, MEZ_Y - 0.3, THREE.MathUtils.clamp((zc - WZ0 - 7) / courseLen, 0, 1));
    return ctop + THREE.MathUtils.clamp(goal - ctop + (rng() - 0.5) * 0.4, -0.8, 0.5);
  };
  /** A piece of the course `len` deep, after a gap of `gap` */
  const piece = (len: number, w: number, b: Builder, jitter: number, gap: number, fixedTop?: number, depth?: number) => {
    cz += gap;
    const zc = cz + len / 2;
    const top = fixedTop ?? nextTop(zc);
    const x = lineX(zc) + (rng() - 0.5) * 2 * jitter;
    const plat = kit.addPlatform(`br_w_p${cn++}`, x, top, zc, w, len, depth ?? top + 9, b);
    addTape(plat.mesh, w, len, tapeMat);
    cz += len;
    ctop = top;
    return plat;
  };
  const gap = (min = 0.9) => min + rng() * 0.7 + diff * 0.3;
  type WPiece = 'crates' | 'shelf' | 'beam' | 'pallets' | 'soggy' | 'block';
  let lastPiece: WPiece | '' = '';
  let midIsland: PlatformItem | null = null;
  const courseEnd = WZ0 + 7 + courseLen;
  while (cz < courseEnd) {
    // The middle concrete block (checkpoint) comes once you're about halfway
    let kind: WPiece;
    if (!midIsland && cz > WZ0 + 7 + courseLen * 0.42) kind = 'block';
    else {
      const opts: WPiece[] = ['crates', 'shelf', 'pallets', 'soggy', 'block', 'crates'];
      if (diff > 0.15 || rng() < 0.5) opts.push('beam');
      do kind = pick(opts);
      while (kind === lastPiece || (lastPiece === 'pallets' && kind === 'soggy'));
    }
    lastPiece = kind;
    if (kind === 'crates') {
      const n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) landings.push(piece(1.6, 1.6, crateB, 1.2, gap()));
    } else if (kind === 'shelf') {
      const s = piece(6 + rng() * 3, 1.5, metalB, 0.6, gap(1.1));
      landings.push(s);
      for (let k = 0; k < 3; k++) {
        // boxes on the lower shelves (looks)
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), crateMat);
        box.position.set(s.position.x + (k % 2 ? 0.95 : -0.95), s.position.y - 1.6 - k * 1.7, s.position.z - s.size.z / 3 + k * (s.size.z / 3));
        root.add(box);
      }
    } else if (kind === 'beam') {
      // A narrow steel beam: walk it carefully
      landings.push(piece(5 + rng() * 2, 0.7, metalB, 0.3, gap(1.0)));
    } else if (kind === 'pallets') {
      // Pallets hanging from chains, sliding sideways (same height: you can't see far in the dark)
      const n = 2 + Math.floor(rng() * 2);
      const top = ctop;
      for (let k = 0; k < n; k++) {
        const pl = piece(2.2, 2.2, crateB, 0, 1.6 + rng() * 0.3, top, 0.3);
        for (const [cx, cz2] of [
          [0.9, 0.9],
          [-0.9, -0.9],
        ]) {
          const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, WH - top, 4), metalMat);
          chain.position.set(cx, (WH - top) / 2, cz2);
          pl.mesh.add(chain);
        }
        kit.makeMoving(pl, 'x', 3.0, 0.9 + 0.25 * k + 0.4 * diff, rng() * 6);
      }
      // and something solid right after
      landings.push(piece(2.4, 2.4, crateB, 0.4, gap(1.0)));
    } else if (kind === 'soggy') {
      // Soggy cardboard boxes: they give way a moment after you land
      const n = 2 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) kit.makeCrumbling(piece(1.6, 1.6, crateB, 1.0, gap(0.8), undefined, 1.0));
    } else {
      const b = piece(4 + rng() * 2, 4 + rng() * 2, concB, 0.8, gap(1.1));
      landings.push(b);
      if (!midIsland) midIsland = b;
    }
  }
  // Last steps up to the mezzanine
  while (ctop < MEZ_Y - 0.55) landings.push(piece(1.8, 1.8, crateB, 0.4, gap(0.9), Math.min(MEZ_Y - 0.3, ctop + 0.5)));
  const WZ1 = cz + 1.3 + MEZ_D;
  const WL = WZ1 - WZ0;
  const mezz = kit.addPlatform('br_w_mezz', 0, MEZ_Y, WZ1 - MEZ_D / 2, WX * 2, MEZ_D, 13.4, metalB);
  addTape(mezz.mesh, WX * 2, MEZ_D, tapeMat);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(WX * 2, 0.08, 0.08), metalMat);
  rail.position.set(0, MEZ_Y + 1, WZ1 - MEZ_D + 0.1);
  root.add(rail);
  const mid = midIsland ?? landings[Math.floor(landings.length / 2)];
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
  // Relics on a few of the pieces
  const relicSpots = landings.filter((l) => l !== mid).sort(() => rng() - 0.5);
  for (const l of relicSpots.slice(0, 3)) relic(l.position.x, l.position.y, l.position.z);
  relic(mid.position.x + 1.2, mid.position.y, mid.position.z + 1.2);
  relic(-doorX * 0.5, MEZ_Y, WZ1 - 3);
  kit.addCheckpoint(2, 'El almacén', new THREE.Vector3(exitX + 3, 0, WZ0 + 2), new THREE.Vector3(exitX, 0.2, WZ0 + 2.2));
  kit.addCheckpoint(
    3,
    'Mitad del almacén',
    new THREE.Vector3(mid.position.x + Math.max(0, mid.size.x / 2 - 1.0), mid.position.y, mid.position.z + Math.max(0, mid.size.z / 2 - 1.0)),
    new THREE.Vector3(mid.position.x - 0.6, mid.position.y + 0.2, mid.position.z - 0.6)
  );
  kit.addCheckpoint(4, 'Pasillo de emergencia', new THREE.Vector3(doorX + 3.2, MEZ_Y, WZ1 - 2.2), new THREE.Vector3(doorX, MEZ_Y + 0.2, WZ1 - 2.5));

  // ======================================================================
  // 3. ¡CORRE! — the red corridor. It repeats forever… until you pull the 3 levers hidden
  //    in nooks along the walls (each stretch has its nook, its hole and its hurdle in a
  //    different place). Then the door at the end opens onto the run.
  // ======================================================================
  const CZ0 = WZ1;
  const CY = MEZ_Y;
  const SEG = 16 + Math.floor(rng() * 5);
  const LZ0 = CZ0 + 10;
  const NSEG = 4; // 0-2 real, 3 = a copy of 0 (what you see ahead before the loop takes you back)
  const CEND = LZ0 + NSEG * SEG;
  const corrLamp = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const corrCeil = new THREE.MeshStandardMaterial({ color: 0x3b2222, roughness: 1, side: THREE.DoubleSide });
  const cw = (id: string, z0: number, z1: number, side: number) => wall(id, doorX + side * 1.8, z0, doorX + side * 1.8, z1, CY + 4.2, CY - 9.5);
  // The corridor floor glows a little red, so the holes (pitch black) stand out while you run
  const redCarpetBase = P.build(new THREE.MeshStandardMaterial({ map: P.carpetMat.map, color: 0xd9c7a6, emissive: 0x3a120a, emissiveIntensity: 1, roughness: 1 }), 2.2, false);
  // (no shadows on it: the walls' shadow made a black stripe that looked like a hole)
  const redCarpetB: Builder = (g, w, d, h) => {
    redCarpetBase(g, w, d, h);
    g.traverse((o) => (o.receiveShadow = false));
  };
  // Entrance stretch
  kit.addPlatform('br_c_floorA', doorX, CY, (CZ0 + LZ0) / 2, 3.6, LZ0 - CZ0, 0.5, redCarpetB);
  cw('br_c_wA', CZ0, LZ0, -1);
  cw('br_c_eA', CZ0, LZ0, 1);
  // Where the nook, the hole and the hurdle are in each stretch
  const NOOK_W = 2.4;
  const layouts = [0, 1, 2].map(() => {
    const side = rng() < 0.5 ? -1 : 1;
    const n0 = 1.5 + rng() * (SEG - 4.5);
    const nook: [number, number] = [n0, n0 + NOOK_W];
    const holeLen = 1.8 + rng() * 0.5 + diff * 0.4;
    const holeOpts: number[] = [];
    for (let h = 1.5; h + holeLen < SEG - 1.5; h += 0.5) if (h > nook[1] + 0.8 || h + holeLen < nook[0] - 0.8) holeOpts.push(h);
    const h0 = holeOpts.length ? pick(holeOpts) : SEG - holeLen - 1.5;
    const hole: [number, number] = [h0, h0 + holeLen];
    const hurdleOpts: number[] = [];
    for (let u = 1; u < SEG - 1; u += 0.5) if ((u < hole[0] - 1.6 || u > hole[1] + 1.6) && (u < nook[0] - 0.4 || u > nook[1] + 0.4)) hurdleOpts.push(u);
    const hurdle = hurdleOpts.length ? pick(hurdleOpts) : -1;
    return { side, nook, hole, hurdle };
  });
  layouts.push(layouts[0]);
  const levers: CorridorInfo['levers'] = [];
  for (let k = 0; k < NSEG; k++) {
    const z = LZ0 + k * SEG;
    const L = layouts[k];
    const side = L.side;
    const [NOOK0, NOOK1] = L.nook;
    kit.addPlatform(`br_c_f${k}a`, doorX, CY, z + L.hole[0] / 2, 3.6, L.hole[0], 0.5, redCarpetB);
    kit.addPlatform(`br_c_f${k}b`, doorX, CY, z + (L.hole[1] + SEG) / 2, 3.6, SEG - L.hole[1], 0.5, redCarpetB);
    if (L.hurdle > 0) kit.addPlatform(`br_c_h${k}`, doorX, CY + 0.75, z + L.hurdle, 3.6, 0.5, 0.75, crateB);
    // Wall with a nook on one side
    cw(`br_c_s${k}a`, z, z + NOOK0, side);
    cw(`br_c_s${k}b`, z + NOOK1, z + SEG, side);
    cw(`br_c_o${k}`, z, z + SEG, -side);
    const nx = doorX + side * 3.0;
    kit.addPlatform(`br_c_nook${k}`, nx, CY, z + (NOOK0 + NOOK1) / 2, 2.4, NOOK1 - NOOK0, 0.5, redCarpetB);
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
  ceiling(doorX - 1.8, CZ0, doorX + 1.8, CEND, CY + 4.2, corrCeil, 2);
  voidPlane(doorX - 1.8, LZ0, doorX + 1.8, CEND, CY - 9);
  // The door at the end of the loop, under a SALIDA sign: it slides down when the levers are pulled
  const gatePlat = kit.addPlatform('br_c_gate', doorX, CY + 4.2, CEND, 3.6, 0.3, 4.7, () => {});
  gatePlat.solid = true;
  const gateMesh = new THREE.Group();
  const gateBody = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.2, 0.25), new THREE.MeshStandardMaterial({ color: 0x7c8087, metalness: 0.6, roughness: 0.45 }));
  gateBody.position.set(doorX, CY + 2.1, CEND);
  for (let k = 0; k < 5; k++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: k % 2 ? 0x111111 : 0xfacc15 }));
    stripe.position.set(doorX, CY + 0.4 + k * 0.16, CEND - 0.15);
    gateMesh.add(stripe);
  }
  gateMesh.add(gateBody);
  root.add(gateMesh);
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: exitTex() }));
  gateSign.position.set(doorX, CY + 3.7, CEND - 0.2);
  gateSign.rotation.y = Math.PI;
  root.add(gateSign);

  // ======================================================================
  // 4. THE RUN — behind the door: a long corridor full of hurdles, holes, crates sliding across,
  //    floors that fall apart and columns. La Araña follows you all the way (it crosses the
  //    holes on the ceiling). Every level puts the obstacles in a different order.
  // ======================================================================
  const RZ0 = CEND;
  const RW = 4.0;
  const runLamp = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  /** Holes, and stretches with something in the way: the spider crosses them on the ceiling */
  const gaps: [number, number][] = [];
  let rz = RZ0;
  let rn = 0;
  const runFloor = (len: number) => {
    kit.addPlatform(`br_r_f${rn++}`, doorX, CY, rz + len / 2, RW, len, 0.5, redCarpetB);
    rz += len;
  };
  const hurdle = (zc: number, h: number) => {
    gaps.push([zc - 0.5, zc + 0.5]);
    const p = kit.addPlatform(`br_r_h${rn++}`, doorX, CY + h, zc, RW, 0.45, h, crateB);
    addTape(p.mesh, RW, 0.45, tapeMat);
  };
  const edgeTape = (zz: number) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.05, 0.12), tapeMat);
    t.position.set(doorX, CY + 0.02, zz);
    root.add(t);
  };
  runFloor(10); // a breath before it starts (the checkpoint is here)
  type RunPiece = 'valla' | 'doble' | 'hueco' | 'escalon' | 'pilares' | 'deslizante' | 'cae';
  const runOpts: RunPiece[] = ['valla', 'doble', 'hueco', 'hueco', 'escalon', 'pilares', 'deslizante', 'cae'];
  const nRun = 9 + Math.round(diff * 5) + Math.floor(rng() * 2);
  let lastRun: RunPiece | '' = '';
  for (let k = 0; k < nRun; k++) {
    let kind: RunPiece;
    do kind = pick(runOpts);
    while (kind === lastRun);
    lastRun = kind;
    if (kind === 'valla') {
      // a barrier across the whole corridor: jump it
      const z0 = rz;
      runFloor(7);
      hurdle(z0 + 3.5, 0.8 + rng() * 0.25 + diff * 0.1);
    } else if (kind === 'doble') {
      const z0 = rz;
      runFloor(10);
      hurdle(z0 + 3, 0.8 + rng() * 0.2);
      hurdle(z0 + 6.6, 0.8 + rng() * 0.2);
    } else if (kind === 'hueco') {
      // a hole in the floor
      const g = 2.0 + rng() * 0.8 + diff * 0.8;
      edgeTape(rz - 0.06);
      gaps.push([rz, rz + g]);
      rz += g;
      edgeTape(rz + 0.06);
      runFloor(5);
    } else if (kind === 'escalon') {
      // a pile of crates: up, up, and down again
      const z0 = rz;
      runFloor(10);
      gaps.push([z0 + 2.4, z0 + 6.4]);
      const a = kit.addPlatform(`br_r_s${rn++}`, doorX, CY + 0.75, z0 + 3, RW, 1.2, 0.75, crateB);
      const b = kit.addPlatform(`br_r_s${rn++}`, doorX, CY + 1.45, z0 + 5.2, RW, 2.4, 1.45, crateB);
      addTape(a.mesh, RW, 1.2, tapeMat);
      addTape(b.mesh, RW, 2.4, tapeMat);
    } else if (kind === 'pilares') {
      // columns from alternating sides: zig-zag between them
      const z0 = rz;
      runFloor(12);
      gaps.push([z0 + 2.5, z0 + 10.5]);
      let s0 = rng() < 0.5 ? 1 : -1;
      for (const dz of [3, 6.5, 10]) {
        kit.addPlatform(`br_r_c${rn++}`, doorX + s0 * (RW / 2 - 1.1), CY + 4.2, z0 + dz, 2.2, 0.8, 4.7, wallB).solid = true;
        s0 = -s0;
      }
    } else if (kind === 'deslizante') {
      // a crate sliding from wall to wall: time it or jump it
      const z0 = rz;
      runFloor(9);
      gaps.push([z0 + 3.6, z0 + 5.4]);
      const box = kit.addPlatform(`br_r_d${rn++}`, doorX, CY + 1.0, z0 + 4.5, 1.3, 1.3, 1.0, crateB);
      addTape(box.mesh, 1.3, 1.3, tapeMat);
      kit.makeMoving(box, 'x', RW / 2 - 0.75, 1.8 + diff * 0.8, rng() * 6);
    } else {
      // floor tiles over the void that fall apart once you step on them: don't stop
      const z0 = rz;
      edgeTape(z0 - 0.06);
      for (let t = 0; t < 3; t++) {
        const tile = kit.addPlatform(`br_r_t${rn++}`, doorX, CY, z0 + 1.1 + t * 2.35, RW - 0.2, 2.2, 0.5, redCarpetB);
        kit.makeCrumbling(tile);
      }
      rz = z0 + 7.0;
      gaps.push([z0, rz]);
      edgeTape(rz + 0.06);
      runFloor(3);
    }
  }
  runFloor(8); // the last stretch to the door
  const REND = rz;
  // Walls, the joint with the corridor, ceiling, lamps, the void under the holes
  wall('br_r_w', doorX - RW / 2, RZ0, doorX - RW / 2, REND, CY + 4.2, CY - 9.5);
  wall('br_r_e', doorX + RW / 2, RZ0, doorX + RW / 2, REND, CY + 4.2, CY - 9.5);
  wall('br_r_jw', doorX - RW / 2, RZ0, doorX - 1.8, RZ0, CY + 4.2, CY - 9.5);
  wall('br_r_je', doorX + 1.8, RZ0, doorX + RW / 2, RZ0, CY + 4.2, CY - 9.5);
  wall('br_r_n', doorX - RW / 2, REND, doorX + RW / 2, REND, CY + 4.2, CY - 0.6);
  ceiling(doorX - RW / 2, RZ0, doorX + RW / 2, REND, CY + 4.2, corrCeil, 2);
  voidPlane(doorX - RW / 2, RZ0, doorX + RW / 2, REND, CY - 9);
  for (let u = RZ0 + 3; u < REND; u += 5) {
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), runLamp);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(doorX, CY + 4.18, u);
    root.add(lamp);
  }
  kit.addCheckpoint(5, '¡Corre!', new THREE.Vector3(doorX + 1.3, CY, RZ0 + 4), new THREE.Vector3(doorX - 0.8, CY + 0.2, RZ0 + 2.5));
  // The real EXIT, at the very end
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), new THREE.MeshBasicMaterial({ map: exitTex() }));
  sign.position.set(doorX, CY + 3.4, REND - 0.25);
  sign.rotation.y = Math.PI;
  root.add(sign);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.4 }));
  door.position.set(doorX, CY + 1.3, REND - 0.1);
  root.add(door);
  relic(doorX, CY, CZ0 + 6);
  relic(doorX, CY, LZ0 + SEG + (layouts[1].hole[0] > 3 ? 1.2 : SEG - 1.2));
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
    {
      x: doorX,
      z0: CZ0,
      loopZ0: LZ0,
      seg: SEG,
      y: CY,
      end: REND,
      levers,
      lamps: corrLamp,
      gate: { plat: gatePlat, mesh: gateMesh, top: CY + 4.2, t: 0 },
      run: { z0: RZ0, z1: REND, gaps, lamps: runLamp, ceilY: CY + 4.15 },
    },
    { plat: doorPlat, mesh: doorMesh, light: doorLightMat, pos: new THREE.Vector3(exitX, WALL_H, ZE), open: false, openT: 0, hintCd: 0 },
    [lampFlickA, lampFlickB]
  );
  void redLamp;
  void concMat;
  const farCells: [number, number][] = [];
  for (let i = 0; i < NX; i++) for (let j = 2; j < NZ; j++) if (i !== keyCell[0] || j !== keyCell[1]) farCells.push([i, j]);
  shuffled(farCells);
  const nMannequins = 2 + Math.round(diff * 2) + (NX * NZ > 60 ? 1 : 0);
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
  const nSmiles = 4 + Math.round(diff * 2) + Math.floor(WL / 40);
  for (let k = 0; k < nSmiles; k++) {
    const z = WZ0 + 14 + (k / Math.max(1, nSmiles - 1)) * (WL - 26);
    const x = (k % 2 ? 1 : -1) * (6 + rng() * 9);
    hazards.add(root, 'sonrisa', new THREE.Vector3(x, 6.5 + rng() * 2, z));
  }
  hazards.add(root, 'arana', new THREE.Vector3(doorX, CY, CZ0 - 1));

  const summit = new THREE.Vector3(doorX, CY + 0.2, REND - 0.8);
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
    { type: 'luz', pos: new THREE.Vector3(doorX - 1, CY + 0.95, RZ0 + 6) },
    // A bat and a slingshot (with stones): they don't kill the monsters, but they stun them
    { type: 'bate', pos: new THREE.Vector3(3.5, 0.95, -3.5) },
    { type: 'resortera', pos: new THREE.Vector3(-3.5, 0.95, -3.5) },
    { type: 'piedra', pos: new THREE.Vector3(0, 0.95, -7.5) },
    { type: 'piedra', pos: new THREE.Vector3(cellCenter(SI + 1, 2).x, 0.95, cellCenter(SI + 1, 2).z) },
    { type: 'piedra', pos: new THREE.Vector3(exitX - 1.5, 0.95, WZ0 + 5.5) },
    { type: 'bate', pos: new THREE.Vector3(doorX - 2.5, MEZ_Y + 0.95, WZ1 - 5) },
    { type: 'piedra', pos: new THREE.Vector3(doorX + 1, CY + 0.95, CZ0 + 6.5) },
  ];
  const world = kit.finish(summit, enemies, items, new THREE.Vector3(doorX + 1.2, CY + 1.2, REND - 3));
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
    exits: (p) => {
      const [i, j] = gCell(g, p);
      return gNeighbors(g, i, j).length;
    },
    cornersNear: (p, reach) => {
      const [ci, cj] = gCell(g, p);
      const out: { pos: THREE.Vector3; dir: THREE.Vector3 }[] = [];
      for (let i = Math.max(0, ci - reach); i <= Math.min(N - 1, ci + reach); i++)
        for (let j = Math.max(0, cj - reach); j <= Math.min(N - 1, cj + reach); j++) {
          const openE = i < N - 1 && g.east[i][j];
          const openW = i > 0 && g.east[i - 1][j];
          const openN = j < N - 1 && g.north[i][j];
          const openS = j > 0 && g.north[i][j - 1];
          const c = gCenter(g, i, j);
          for (const sx of [1, -1])
            for (const sz of [1, -1]) {
              // both walls of this corner are up
              if ((sx > 0 ? openE : openW) || (sz > 0 ? openN : openS)) continue;
              out.push({ pos: new THREE.Vector3(c.x + sx * (CELL / 2 - 0.2), Y, c.z + sz * (CELL / 2 - 0.2)), dir: new THREE.Vector3(-sx, 0, -sz).normalize() });
            }
        }
      return out;
    },
    sightSpot: (p, minCells, maxCells) => {
      const [ci, cj] = gCell(g, p);
      const opts: THREE.Vector3[] = [];
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        let i = ci;
        let j = cj;
        for (let k = 1; k <= maxCells; k++) {
          if (!gNeighbors(g, i, j).some(([a, b]) => a === i + di && b === j + dj)) break;
          i += di;
          j += dj;
          if (k >= minCells) opts.push(gCenter(g, i, j).setY(Y));
        }
      }
      return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
    },
    portalSpotNear: (p, yaw) => {
      const gap = (q: THREE.Vector3) => {
        let m = 1e9;
        for (const o of obstacles) {
          const cx = THREE.MathUtils.clamp(q.x, o.x - o.hx, o.x + o.hx);
          const cz = THREE.MathUtils.clamp(q.z, o.z - o.hz, o.z + o.hz);
          m = Math.min(m, Math.hypot(q.x - cx, q.z - cz));
        }
        return m;
      };
      let best: THREE.Vector3 | null = null;
      let bestScore = -1e9;
      for (const r of [2.6, 2.2, 3.2, 1.9])
        for (let k = 0; k < 16; k++) {
          const a = yaw + (k * Math.PI) / 8;
          const q = new THREE.Vector3(p.x + Math.sin(a) * r, Y, p.z + Math.cos(a) * r);
          if (gap(q) < 1.2) continue;
          // no wall between you and it
          let blocked = false;
          for (let s = 0.5; s < r && !blocked; s += 0.5) blocked = gap(new THREE.Vector3(p.x + Math.sin(a) * s, Y, p.z + Math.cos(a) * s)) < 0.15;
          if (blocked) continue;
          // in front of you (where the camera looks), a little to the side
          const score = Math.cos((k * Math.PI) / 8 - 0.5) - Math.abs(r - 2.6) * 0.4;
          if (score > bestScore) {
            bestScore = score;
            best = q;
          }
        }
      if (best) return best;
      const [i, j] = gCell(g, p);
      return gCenter(g, i, j).setY(Y);
    },
    mazeMask: () => {
      const out: number[] = [];
      moving.forEach((w, k) => {
        if (k % 16 === 0) out.push(0);
        if (w.target > 0.5) out[out.length - 1] |= 1 << k % 16;
      });
      return out;
    },
    applyMazeMask: (mask) => {
      let changed = 0;
      moving.forEach((w, k) => {
        const t = ((mask[Math.floor(k / 16)] ?? 0) >> k % 16) & 1;
        if (t === w.target) return;
        changed++;
        w.target = t;
        setOpen(w, t === 0);
        placeWall(w);
      });
      return changed;
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

  // A skull next to every start corner, more around the maze; food to heal (no berries or nuts)
  const items: ItemSpot[] = [];
  corners.slice(0, 4).forEach(([i, j]) => {
    const c = gCenter(g, i, j);
    items.push({ type: 'craneo', pos: new THREE.Vector3(c.x + 1.2, Y + 0.95, c.z - 1.2) });
  });
  const shuffledCells = setup.searchSpots!.slice().sort(() => rng() - 0.5);
  shuffledCells.slice(0, 4).forEach((c) => items.push({ type: 'craneo', pos: new THREE.Vector3(c.x, Y + 0.95, c.z) }));
  // Bats and slingshots to beat the copies (and the Nahual): one bat at every start corner
  corners.slice(0, 4).forEach(([i, j], k) => {
    const c = gCenter(g, i, j);
    items.push({ type: 'bate', pos: new THREE.Vector3(c.x - 1.2, Y + 0.95, c.z + 1.2) });
    if (k % 2 === 0) items.push({ type: 'resortera', pos: new THREE.Vector3(c.x + 1.2, Y + 0.95, c.z + 1.2) });
    items.push({ type: 'piedra', pos: new THREE.Vector3(c.x - 1.2, Y + 0.95, c.z - 1.2) });
  });
  shuffledCells.slice(10, 14).forEach((c) => items.push({ type: 'piedra', pos: new THREE.Vector3(c.x - 1, Y + 0.95, c.z - 1) }));
  shuffledCells.slice(4, 10).forEach((c, k) => setup.food.push({ pos: new THREE.Vector3(c.x + 1, Y + 1.0, c.z + 1), kind: k % 2 ? 'burger' : 'fries' }));

  // Relics in dead ends (or anywhere if there aren't enough)
  const relicCells = [...deadEnds.sort(() => rng() - 0.5).map(([i, j]) => gCenter(g, i, j)), ...shuffledCells.slice(14)];
  for (let k = 0; k < 8; k++) {
    const c = relicCells[k];
    // Only crystals here (no acorns: in this fight they looked like useless nuts)
    kit.addCollectible(`swc${k}`, 'sun_crystal', c.x - 1.2, Y + 1.2, c.z + 1.2);
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
