/**
 * Boss models (procedural, built from primitives):
 *   Plumarroca (stone bird) · ERR0R.exe (glitch monster) + glitch clones · Nave Nodriza (UFO) + cows ·
 *   Huesudo (giant swamp skeleton) + dancing skeletons · Rey Gnomo · Conde Drácula · candelabra.
 * Every model faces +z with its origin at the feet (or at its center when it floats).
 */
import * as THREE from 'three';
import { gnome, vampire } from './enemiesExtra';
import { makeGlowTexture } from './levelKit';
import { makeFlame } from './toolModels';

const std = (color: number, roughness = 0.7, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const basic = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

function add(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function glowSprite(color: string, size: number): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeGlowTexture(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  s.scale.setScalar(size);
  return s;
}

/** Collects every material of an object (to flash it when hit). */
export function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const out = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) out.add(mat);
  });
  return [...out];
}

// ===========================================================================
// 1. PLUMARROCA — the stone bird
// ===========================================================================
export interface BirdModel {
  group: THREE.Group;
  wings: THREE.Group[];
  head: THREE.Group;
  /** Where the carried rock sits */
  talons: THREE.Group;
}

export function createBirdBoss(): BirdModel {
  const group = new THREE.Group();
  const feather = std(0x7c7f8a, 0.85, { flatShading: true });
  const dark = std(0x4b5160, 0.85, { flatShading: true });
  const belly = std(0xe7dfcf, 0.8, { flatShading: true });
  const beakM = std(0xf59e0b, 0.45);
  const legM = std(0xf97316, 0.6);

  const body = add(group, new THREE.SphereGeometry(1.25, 14, 10), feather, 0, 1.6, 0);
  body.scale.set(1, 0.95, 1.3);
  const chest = add(group, new THREE.SphereGeometry(0.95, 12, 8), belly, 0, 1.45, 0.55);
  chest.scale.set(1, 1.05, 0.7);
  // Tail fan
  for (let i = -2; i <= 2; i++) {
    const t = add(group, new THREE.BoxGeometry(0.32, 0.08, 1.3), i % 2 ? dark : feather, i * 0.26, 1.5 - Math.abs(i) * 0.05, -1.75);
    t.rotation.set(0.25, i * 0.22, 0);
  }
  // Legs & talons
  for (const s of [1, -1]) {
    add(group, new THREE.CylinderGeometry(0.1, 0.12, 0.7, 6), legM, 0.45 * s, 0.4, 0.15);
    for (let k = -1; k <= 1; k++) {
      const toe = add(group, new THREE.ConeGeometry(0.07, 0.4, 5), legM, 0.45 * s + k * 0.12, 0.07, 0.38);
      toe.rotation.x = Math.PI / 2;
    }
  }
  // Wings (pivot at the shoulder)
  const wings: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const w = new THREE.Group();
    w.position.set(1.0 * s, 2.0, 0);
    const blade = add(w, new THREE.SphereGeometry(1, 10, 6), feather, 1.35 * s, -0.1, -0.1);
    blade.scale.set(1.6, 0.18, 0.85);
    for (let k = 0; k < 4; k++) {
      const tip = add(w, new THREE.BoxGeometry(0.85, 0.07, 0.26), dark, (2.4 + k * 0.12) * s, -0.15, -0.55 + k * 0.32);
      tip.rotation.y = -0.25 * s;
    }
    group.add(w);
    wings.push(w);
  }
  // Head
  const head = new THREE.Group();
  head.position.set(0, 2.75, 1.05);
  add(head, new THREE.SphereGeometry(0.72, 14, 10), feather);
  const beak = add(head, new THREE.ConeGeometry(0.28, 0.8, 8), beakM, 0, -0.12, 0.85);
  beak.rotation.x = Math.PI / 2 + 0.25;
  for (const s of [1, -1]) {
    add(head, new THREE.SphereGeometry(0.2, 10, 8), basic(0xffffff), 0.36 * s, 0.14, 0.5);
    add(head, new THREE.SphereGeometry(0.1, 8, 6), basic(0x111111), 0.4 * s, 0.14, 0.64);
    const brow = add(head, new THREE.BoxGeometry(0.34, 0.08, 0.1), dark, 0.32 * s, 0.36, 0.58);
    brow.rotation.z = -0.4 * s;
  }
  for (let k = 0; k < 3; k++) {
    const crest = add(head, new THREE.ConeGeometry(0.12, 0.7, 5), dark, (k - 1) * 0.15, 0.75, -0.2 - k * 0.1);
    crest.rotation.x = -0.6;
  }
  group.add(head);
  const talons = new THREE.Group();
  talons.position.set(0, 0.25, 0.9);
  group.add(talons);
  return { group, wings, head, talons };
}

// ===========================================================================
// 2. ERR0R.exe — glitch material, monster, error windows
// ===========================================================================
export interface GlitchMaterial {
  material: THREE.MeshBasicMaterial;
  update: (time: number) => void;
}

/** Animated "corrupted pixels" material (shared by the monster and the clones). */
export function makeGlitchMaterial(opacity = 0.92): GlitchMaterial {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const palette = ['#ff00e6', '#00f0ff', '#39ff14', '#ffffff', '#1e1b4b', '#ff2d55', '#7c3aed', '#000000'];
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = palette[i % palette.length];
    const w = 4 + ((i * 37) % 28);
    const h = 2 + ((i * 13) % 6);
    ctx.fillRect((i * 53) % 64, (i * 29) % 64, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: tex, transparent: opacity < 1, opacity });
  let last = 0;
  return {
    material,
    update: (time: number) => {
      if (time - last < 0.07) return;
      last = time;
      tex.offset.set(Math.floor(Math.random() * 8) / 8, Math.floor(Math.random() * 8) / 8);
      const hue = (time * 0.4) % 1;
      material.color.setHSL(hue, 0.6, 0.75);
    },
  };
}

export function makeErrorWindowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, 256, 160);
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#1d4ed8');
  grad.addColorStop(1, '#60a5fa');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ERR0R.exe', 10, 21);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(226, 5, 22, 20);
  ctx.fillStyle = '#fff';
  ctx.fillText('x', 232, 21);
  ctx.beginPath();
  ctx.arc(46, 90, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#dc2626';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('!', 40, 102);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Error fatal', 86, 80);
  ctx.font = '15px sans-serif';
  ctx.fillText('El mundo no responde', 86, 104);
  ctx.strokeStyle = '#9ca3af';
  ctx.strokeRect(150, 122, 84, 26);
  ctx.fillStyle = '#111827';
  ctx.fillText('Aceptar', 164, 141);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface GlitchMonsterModel {
  group: THREE.Group;
  core: THREE.Mesh;
  cubes: THREE.Mesh[];
  windows: THREE.Mesh[];
  eye: THREE.Group;
}

export function createGlitchMonster(glitch: GlitchMaterial): GlitchMonsterModel {
  const group = new THREE.Group();
  const core = add(group, new THREE.IcosahedronGeometry(1.7, 1), glitch.material);
  core.castShadow = false;
  const inner = add(group, new THREE.IcosahedronGeometry(1.45, 0), basic(0x1e1b4b));
  inner.castShadow = false;
  // Big eye
  const eye = new THREE.Group();
  eye.position.set(0, 0.2, 1.45);
  add(eye, new THREE.SphereGeometry(0.62, 16, 12), basic(0xffffff));
  add(eye, new THREE.SphereGeometry(0.3, 12, 10), basic(0xff2d55), 0, 0, 0.42);
  add(eye, new THREE.SphereGeometry(0.14, 8, 8), basic(0x000000), 0, 0, 0.62);
  group.add(eye);
  const cubes: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const s = 0.3 + (i % 3) * 0.18;
    const cube = add(group, new THREE.BoxGeometry(s, s, s), glitch.material);
    cube.castShadow = false;
    cubes.push(cube);
  }
  const winTex = makeErrorWindowTexture();
  const windows: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: winTex, side: THREE.DoubleSide, transparent: true }));
    group.add(w);
    windows.push(w);
  }
  const halo = glowSprite('rgba(255,0,230,0.55)', 7);
  group.add(halo);
  return { group, core, cubes, windows, eye };
}

// ===========================================================================
// 3. NAVE NODRIZA + cows
// ===========================================================================
export interface UfoModel {
  group: THREE.Group;
  /** The glass bubble under the saucer (the weak point), center in group space */
  glass: THREE.Mesh;
  glassMat: THREE.MeshStandardMaterial;
  cracks: THREE.Mesh;
  lights: THREE.Mesh[];
  beam: THREE.Mesh;
  alien: THREE.Group;
}

export function createUfo(): UfoModel {
  const group = new THREE.Group();
  const hull = std(0x9ca3af, 0.3, { metalness: 0.85 });
  const darkHull = std(0x475569, 0.4, { metalness: 0.8 });
  const saucer = add(group, new THREE.SphereGeometry(5.2, 32, 12), hull);
  saucer.scale.set(1, 0.24, 1);
  const rim = add(group, new THREE.TorusGeometry(5.0, 0.35, 10, 48), darkHull);
  rim.rotation.x = Math.PI / 2;
  const top = add(group, new THREE.SphereGeometry(2.0, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), darkHull, 0, 0.9, 0);
  top.scale.y = 0.55;
  add(group, new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), darkHull, 0, 2.0, 0);
  add(group, new THREE.SphereGeometry(0.2, 8, 8), basic(0xff2d55), 0, 2.6, 0);
  const lights: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const l = add(group, new THREE.SphereGeometry(0.22, 8, 6), basic(i % 2 ? 0xfacc15 : 0x22d3ee), Math.cos(a) * 5.0, -0.1, Math.sin(a) * 5.0);
    l.castShadow = false;
    lights.push(l);
  }
  // Glass bubble underneath with the alien pilot
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    roughness: 0.05,
    metalness: 0.2,
    transparent: true,
    opacity: 0.5,
    emissive: 0x0e7490,
    emissiveIntensity: 0.4,
    side: THREE.DoubleSide,
  });
  const glass = add(group, new THREE.SphereGeometry(2.2, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glassMat, 0, -0.9, 0);
  glass.castShadow = false;
  const cracks = new THREE.Mesh(
    new THREE.SphereGeometry(2.25, 9, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0 })
  );
  cracks.position.y = -0.9;
  group.add(cracks);
  const alien = new THREE.Group();
  alien.position.set(0, -1.9, 0);
  add(alien, new THREE.SphereGeometry(0.55, 14, 10), std(0x84cc16, 0.5));
  for (const s of [1, -1]) {
    const e = add(alien, new THREE.SphereGeometry(0.2, 10, 8), basic(0x111111), 0.22 * s, 0.05, 0.42);
    e.scale.set(0.8, 1.3, 0.6);
    add(alien, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), std(0x65a30d), 0.25 * s, 0.6, 0);
    add(alien, new THREE.SphereGeometry(0.08, 6, 6), basic(0xfacc15), 0.25 * s, 0.86, 0);
  }
  group.add(alien);
  // Tractor beam (hidden until it abducts)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 3.0, 1, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  beam.visible = false;
  group.add(beam);
  return { group, glass, glassMat, cracks, lights, beam, alien };
}

function spotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fafaf9';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#1c1917';
  const spots = [
    [12, 14, 9],
    [44, 10, 7],
    [34, 40, 11],
    [8, 48, 6],
    [56, 50, 6],
  ];
  for (const [x, y, r] of spots) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.75, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface CowModel {
  group: THREE.Group;
  legs: THREE.Mesh[];
  head: THREE.Group;
}

let cowTex: THREE.CanvasTexture | null = null;
export function createCow(): CowModel {
  const group = new THREE.Group();
  if (!cowTex) cowTex = spotTexture();
  const hide = new THREE.MeshStandardMaterial({ map: cowTex, roughness: 0.85 });
  const pink = std(0xf9a8d4, 0.6);
  add(group, new THREE.BoxGeometry(0.85, 0.72, 1.45), hide, 0, 0.95, 0);
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [
    [0.28, 0.5],
    [-0.28, 0.5],
    [0.28, -0.5],
    [-0.28, -0.5],
  ]) {
    const l = add(group, new THREE.CylinderGeometry(0.1, 0.09, 0.62, 6), hide, x, 0.31, z);
    legs.push(l);
  }
  add(group, new THREE.SphereGeometry(0.17, 8, 6), pink, 0, 0.6, -0.15);
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0.85);
  add(head, new THREE.BoxGeometry(0.5, 0.48, 0.5), hide);
  add(head, new THREE.BoxGeometry(0.44, 0.24, 0.16), pink, 0, -0.1, 0.3);
  for (const s of [1, -1]) {
    add(head, new THREE.SphereGeometry(0.06, 6, 6), basic(0x111111), 0.15 * s, 0.08, 0.26);
    const horn = add(head, new THREE.ConeGeometry(0.05, 0.22, 6), std(0xfef3c7), 0.2 * s, 0.32, 0);
    horn.rotation.z = -0.5 * s;
    const ear = add(head, new THREE.BoxGeometry(0.2, 0.08, 0.12), hide, 0.32 * s, 0.12, -0.05);
    ear.rotation.z = 0.3 * s;
  }
  group.add(head);
  const tail = add(group, new THREE.CylinderGeometry(0.025, 0.025, 0.55, 4), hide, 0, 0.95, -0.78);
  tail.rotation.x = 0.35;
  return { group, legs, head };
}

// ===========================================================================
// 4. HUESUDO — giant swamp skeleton + dancing skeletons
// ===========================================================================
export interface GiantSkeletonModel {
  group: THREE.Group;
  skull: THREE.Group;
  jaw: THREE.Group;
  mouthGlow: THREE.Sprite;
  hands: THREE.Group[];
  arms: THREE.Group[];
  eyes: THREE.Mesh[];
}

const bone = () => std(0xe7e0cf, 0.75, { flatShading: true });

export function createGiantSkeleton(): GiantSkeletonModel {
  const group = new THREE.Group();
  const B = bone();
  const dark = basic(0x0b0f0a);
  // Spine & ribs (origin = waist)
  add(group, new THREE.CylinderGeometry(0.45, 0.55, 6.5, 8), B, 0, 3.0, -0.6);
  for (let i = 0; i < 5; i++) {
    const r = 2.1 - Math.abs(i - 2) * 0.22;
    const rib = add(group, new THREE.TorusGeometry(r, 0.2, 6, 18, Math.PI * 1.25), B, 0, 1.6 + i * 0.85, 0);
    rib.rotation.set(Math.PI / 2, 0, Math.PI * -0.125 + Math.PI);
    rib.scale.set(1, 0.85, 1);
  }
  add(group, new THREE.SphereGeometry(0.6, 10, 8), B, 0, 6.3, -0.4);
  // Shoulders & arms (pivot at the shoulder, arm hangs down then the forearm reaches forward)
  const arms: THREE.Group[] = [];
  const hands: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const shoulder = add(group, new THREE.SphereGeometry(0.65, 10, 8), B, 2.5 * s, 6.0, -0.3);
    shoulder.scale.set(1, 0.8, 1);
    const arm = new THREE.Group();
    arm.position.set(2.7 * s, 6.0, -0.3);
    const upper = add(arm, new THREE.CylinderGeometry(0.3, 0.26, 3.6, 8), B, 0, -1.8, 0);
    upper.rotation.z = 0;
    const elbow = new THREE.Group();
    elbow.position.set(0, -3.6, 0);
    add(elbow, new THREE.SphereGeometry(0.38, 8, 6), B);
    add(elbow, new THREE.CylinderGeometry(0.24, 0.2, 3.4, 8), B, 0, 0, 1.7).rotation.x = Math.PI / 2;
    const hand = new THREE.Group();
    hand.position.set(0, 0, 3.5);
    add(hand, new THREE.BoxGeometry(1.0, 0.3, 0.9), B);
    for (let k = 0; k < 4; k++) {
      const f = add(hand, new THREE.CylinderGeometry(0.09, 0.07, 0.9, 5), B, -0.36 + k * 0.24, -0.1, 0.8);
      f.rotation.x = Math.PI / 2 + 0.3;
    }
    const thumb = add(hand, new THREE.CylinderGeometry(0.1, 0.08, 0.7, 5), B, 0.6 * -s, 0, 0.3);
    thumb.rotation.z = Math.PI / 2;
    elbow.add(hand);
    arm.add(elbow);
    group.add(arm);
    arms.push(arm);
    hands.push(hand);
  }
  // Skull
  const skull = new THREE.Group();
  skull.position.set(0, 8.3, 0);
  const cranium = add(skull, new THREE.SphereGeometry(1.8, 16, 12), B, 0, 0.3, 0);
  cranium.scale.set(1, 0.95, 1.05);
  const eyes: THREE.Mesh[] = [];
  for (const s of [1, -1]) {
    add(skull, new THREE.SphereGeometry(0.5, 10, 8), dark, 0.7 * s, 0.35, 1.45);
    const glow = add(skull, new THREE.SphereGeometry(0.2, 8, 8), basic(0x84ff6a), 0.7 * s, 0.35, 1.78);
    eyes.push(glow);
  }
  const nose = add(skull, new THREE.ConeGeometry(0.22, 0.45, 3), dark, 0, -0.25, 1.75);
  nose.rotation.x = Math.PI;
  // Upper teeth
  for (let k = 0; k < 7; k++) add(skull, new THREE.BoxGeometry(0.2, 0.32, 0.2), B, -0.75 + k * 0.25, -0.85, 1.35 - Math.abs(k - 3) * 0.06);
  // Jaw on a hinge at the back of the skull
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.9, -0.2);
  const jawBone = add(jaw, new THREE.BoxGeometry(2.2, 0.45, 1.9), B, 0, -0.35, 0.8);
  jawBone.scale.set(1, 1, 1);
  for (let k = 0; k < 7; k++) add(jaw, new THREE.BoxGeometry(0.2, 0.3, 0.2), B, -0.75 + k * 0.25, 0.0, 1.5 - Math.abs(k - 3) * 0.06);
  skull.add(jaw);
  const mouthGlow = glowSprite('rgba(132,255,106,0.9)', 2.4);
  mouthGlow.position.set(0, -1.05, 1.1);
  mouthGlow.visible = false;
  skull.add(mouthGlow);
  group.add(skull);
  return { group, skull, jaw, mouthGlow, hands, arms, eyes };
}

export interface DancerModel {
  group: THREE.Group;
  arms: THREE.Group[];
  legs: THREE.Group[];
  body: THREE.Group;
  cage: THREE.Group;
}

export function createDancer(): DancerModel {
  const group = new THREE.Group();
  const B = bone();
  const body = new THREE.Group();
  group.add(body);
  // Skull with a tiny top hat
  add(body, new THREE.SphereGeometry(0.22, 12, 10), B, 0, 1.42, 0);
  add(body, new THREE.BoxGeometry(0.24, 0.1, 0.18), B, 0, 1.24, 0.04);
  for (const s of [1, -1]) add(body, new THREE.SphereGeometry(0.06, 6, 6), basic(0x84ff6a), 0.08 * s, 1.45, 0.18);
  add(body, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), basic(0x111111), 0, 1.6, 0);
  add(body, new THREE.CylinderGeometry(0.12, 0.13, 0.22, 12), basic(0x111111), 0, 1.72, 0);
  add(body, new THREE.CylinderGeometry(0.035, 0.035, 0.55, 5), B, 0, 0.92, 0);
  for (let i = 0; i < 3; i++) {
    const rib = add(body, new THREE.TorusGeometry(0.16 - i * 0.015, 0.025, 4, 12), B, 0, 1.08 - i * 0.1, 0.02);
    rib.rotation.x = Math.PI / 2;
  }
  // Bow tie
  for (const s of [1, -1]) {
    const bow = add(body, new THREE.ConeGeometry(0.06, 0.12, 4), basic(0xdc2626), 0.06 * s, 1.18, 0.12);
    bow.rotation.z = (Math.PI / 2) * s;
  }
  add(body, new THREE.BoxGeometry(0.28, 0.1, 0.14), B, 0, 0.66, 0);
  const arms: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(0.2 * s, 1.14, 0);
    add(arm, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), B, 0, -0.25, 0);
    add(arm, new THREE.SphereGeometry(0.05, 6, 6), B, 0, -0.52, 0);
    body.add(arm);
    arms.push(arm);
  }
  const legs: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(0.1 * s, 0.62, 0);
    add(leg, new THREE.CylinderGeometry(0.035, 0.03, 0.6, 5), B, 0, -0.3, 0);
    add(leg, new THREE.BoxGeometry(0.1, 0.05, 0.18), B, 0, -0.6, 0.04);
    group.add(leg);
    legs.push(leg);
  }
  // Bone cage shown around a player this dancer carries
  const cage = createBoneCage(0.75, 1.9);
  cage.visible = false;
  group.add(cage);
  return { group, arms, legs, body, cage };
}

/** A ring of bones (around a grabbed player). */
export function createBoneCage(r: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const B = bone();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(g, new THREE.CylinderGeometry(0.05, 0.05, h, 5), B, Math.cos(a) * r, h / 2, Math.sin(a) * r);
  }
  for (const y of [0.05, h]) {
    const ring = add(g, new THREE.TorusGeometry(r, 0.06, 5, 20), B, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
  }
  return g;
}

// ===========================================================================
// 5. REY GNOMO
// ===========================================================================
export interface GnomeKingModel {
  group: THREE.Group;
  /** Mallet arm pivot (rotation.x: 0 = resting, -2.4 = raised) */
  mallet: THREE.Group;
  feet: THREE.Mesh[];
  scale: number;
}

export function createGnomeKing(): GnomeKingModel {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  const scale = 3.2;
  inner.scale.setScalar(scale);
  group.add(inner);
  const alert = basic(0x111111);
  const parts = gnome(inner, alert, 0x7c3aed, 0xb91c1c);
  // Royal cape
  const cape = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.55, 14, 1, true, Math.PI * 0.65, Math.PI * 1.7),
    std(0x6d28d9, 0.7, { side: THREE.DoubleSide })
  );
  cape.position.set(0, 0.3, -0.02);
  inner.add(cape);
  // Crown around the hat
  const gold = std(0xfacc15, 0.25, { metalness: 0.85 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.09, 14, 1, true), gold);
  band.position.set(0, 0.83, -0.02);
  inner.add(band);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 4), gold);
    spike.position.set(Math.cos(a) * 0.2, 0.92, -0.02 + Math.sin(a) * 0.2);
    inner.add(spike);
    if (i % 2 === 0) {
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), basic(i % 4 ? 0x22d3ee : 0xef4444));
      gem.position.set(Math.cos(a) * 0.215, 0.84, -0.02 + Math.sin(a) * 0.215);
      inner.add(gem);
    }
  }
  // Mallet in the right hand (pivot at the shoulder)
  const mallet = new THREE.Group();
  mallet.position.set(0.3, 0.4, 0.05);
  const wood = std(0x92400e, 0.8);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.75, 8), wood);
  handle.position.set(0, -0.05, 0.3);
  handle.rotation.x = Math.PI / 2;
  mallet.add(handle);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.38, 14), std(0xa16207, 0.7));
  head.position.set(0, -0.05, 0.68);
  head.rotation.z = Math.PI / 2;
  head.castShadow = true;
  mallet.add(head);
  for (const s of [1, -1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.04, 14), gold);
    cap.position.set(0.19 * s, -0.05, 0.68);
    cap.rotation.z = Math.PI / 2;
    mallet.add(cap);
  }
  inner.add(mallet);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group, mallet, feet: parts.feet, scale };
}

export interface GnomeMinionModel {
  group: THREE.Group;
  /** Turned / tilted for the poke and tug animations */
  inner: THREE.Group;
  arms: THREE.Mesh[];
  feet: THREE.Mesh[];
  /** Warriors only */
  spear: THREE.Group | null;
}

/** Little gnomes the king calls when he is netted: warriors (spear + shield) and helpers. */
export function createGnomeMinion(kind: 'warrior' | 'helper'): GnomeMinionModel {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(1.05);
  group.add(inner);
  const alert = basic(0x111111);
  const parts = kind === 'warrior' ? gnome(inner, alert, 0xb91c1c, 0x475569) : gnome(inner, alert, 0x16a34a, 0xca8a04);
  let spear: THREE.Group | null = null;
  if (kind === 'warrior') {
    // Helmet band, round shield and a little spear
    const steel = std(0x94a3b8, 0.35, { metalness: 0.7 });
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.215, 0.1, 12, 1, true), steel);
    helm.position.set(0, 0.8, -0.02);
    inner.add(helm);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 14), std(0xb45309, 0.6));
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.33, 0.33, 0.1);
    inner.add(shield);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), steel);
    boss.position.set(-0.36, 0.33, 0.1);
    inner.add(boss);
    spear = new THREE.Group();
    spear.position.set(0.33, 0.28, 0.05);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.8, 6), std(0x78350f, 0.8));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.25;
    spear.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), steel);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.7;
    spear.add(tip);
    inner.add(spear);
  }
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group, inner, arms: parts.arms, feet: parts.feet, spear };
}

// ===========================================================================
// 6. CONDE DRÁCULA + candelabra
// ===========================================================================
export interface DraculaModel {
  group: THREE.Group;
  cape: THREE.Mesh;
  wings: THREE.Group[];
  eyes: THREE.MeshBasicMaterial;
}

export function createDracula(): DraculaModel {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(2.4);
  group.add(inner);
  const eyes = basic(0xff1f3d);
  const parts = vampire(inner, eyes, 0x111827, 0xb91c1c);
  // Bat wings on the back
  const wings: THREE.Group[] = [];
  const wingMat = std(0x1f1029, 0.8, { side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const w = new THREE.Group();
    w.position.set(0.12 * s, 0.85, -0.15);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.9 * s, 0.35);
    shape.lineTo(0.75 * s, 0.05);
    shape.lineTo(0.6 * s, -0.12);
    shape.lineTo(0.42 * s, -0.02);
    shape.lineTo(0.25 * s, -0.18);
    shape.lineTo(0, -0.1);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), wingMat);
    w.add(m);
    inner.add(w);
    wings.push(w);
  }
  // Medallion
  const med = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), std(0xfacc15, 0.3, { metalness: 0.8 }));
  med.position.set(0, 0.85, 0.21);
  inner.add(med);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group, cape: parts.cape, wings, eyes };
}

export interface CandelabraModel {
  group: THREE.Group;
  flames: THREE.Group[];
  light: THREE.PointLight;
  ring: THREE.Mesh;
  setLit: (lit: boolean) => void;
  lit: boolean;
}

export function createCandelabra(): CandelabraModel {
  const group = new THREE.Group();
  const iron = std(0x2d2a32, 0.5, { metalness: 0.7 });
  const gold = std(0xb08d3a, 0.35, { metalness: 0.8 });
  add(group, new THREE.CylinderGeometry(0.55, 0.7, 0.3, 10), iron, 0, 0.15, 0);
  add(group, new THREE.CylinderGeometry(0.1, 0.14, 2.3, 8), iron, 0, 1.4, 0);
  add(group, new THREE.SphereGeometry(0.2, 8, 6), gold, 0, 1.6, 0);
  const flames: THREE.Group[] = [];
  const candleM = std(0xf5f0e1, 0.7);
  const tips: [number, number][] = [
    [0, 0],
    [0.7, 0],
    [-0.7, 0],
  ];
  for (const [x, z] of tips) {
    if (x !== 0) {
      const armM = add(group, new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), iron, x / 2, 2.35, z);
      armM.rotation.z = Math.PI / 2;
      add(group, new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), iron, x, 2.5, z);
    }
    const y = x === 0 ? 2.55 : 2.7;
    add(group, new THREE.CylinderGeometry(0.14, 0.12, 0.08, 10), gold, x, y, z);
    add(group, new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), candleM, x, y + 0.24, z);
    const f = makeFlame(0.11);
    f.position.set(x, y + 0.46, z);
    f.visible = false;
    group.add(f);
    flames.push(f);
  }
  const light = new THREE.PointLight(0xffa04d, 0, 16, 1.6);
  light.position.set(0, 3.2, 0);
  group.add(light);
  // Ground ring telling players where to stand
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 1.95, 32),
    new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  const model: CandelabraModel = {
    group,
    flames,
    light,
    ring,
    lit: false,
    setLit: (lit: boolean) => {
      model.lit = lit;
      for (const f of flames) f.visible = lit;
      light.intensity = lit ? 3.2 : 0;
      (ring.material as THREE.MeshBasicMaterial).color.set(lit ? 0xfde68a : 0xfb923c);
    },
  };
  return model;
}

// ===========================================================================
// Shadow hands (Drácula): black arms that come out of a puddle of darkness
// ===========================================================================
export interface ShadowHandsModel {
  group: THREE.Group;
  /** Each arm: pivot at the ground, `hand` at the tip (curls to grab) */
  arms: { pivot: THREE.Group; hand: THREE.Group }[];
  puddle: THREE.Mesh;
}

export function createShadowHands(): ShadowHandsModel {
  const group = new THREE.Group();
  const shadow = std(0x0a0612, 0.9, { emissive: new THREE.Color(0x2e1065), emissiveIntensity: 0.35 });
  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 28),
    new THREE.MeshBasicMaterial({ color: 0x05020a, transparent: true, opacity: 0.85, depthWrite: false })
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = 0.04;
  group.add(puddle);
  const arms: ShadowHandsModel['arms'] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75);
    pivot.rotation.y = -a + Math.PI / 2;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.7, 7), shadow);
    forearm.position.y = 0.85;
    pivot.add(forearm);
    const hand = new THREE.Group();
    hand.position.y = 1.7;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.1), shadow);
    hand.add(palm);
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.3, 5), shadow);
      f.position.set(-0.1 + k * 0.067, 0.28, 0);
      hand.add(f);
    }
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.025, 0.2, 5), shadow);
    thumb.position.set(0.17, 0.08, 0);
    thumb.rotation.z = -0.8;
    hand.add(thumb);
    pivot.add(hand);
    group.add(pivot);
    arms.push({ pivot, hand });
  }
  return { group, arms, puddle };
}

// ===========================================================================
// Crows (Plumarroca's helpers)
// ===========================================================================
export interface CrowModel {
  group: THREE.Group;
  wings: THREE.Group[];
  head: THREE.Mesh;
}

export function createCrow(): CrowModel {
  const group = new THREE.Group();
  const black = std(0x111827, 0.45, { emissive: new THREE.Color(0x0b1020), emissiveIntensity: 0.4 });
  const body = add(group, new THREE.SphereGeometry(0.22, 12, 10), black, 0, 0, 0);
  body.scale.set(0.9, 0.85, 1.5);
  const head = add(group, new THREE.SphereGeometry(0.14, 10, 8), black, 0, 0.1, 0.3);
  const beak = add(group, new THREE.ConeGeometry(0.05, 0.2, 6), std(0xfacc15, 0.5), 0, 0.08, 0.48);
  beak.rotation.x = Math.PI / 2;
  for (const sx of [1, -1]) add(group, new THREE.SphereGeometry(0.028, 6, 6), basic(0xef4444), 0.07 * sx, 0.15, 0.4);
  const tail = add(group, new THREE.BoxGeometry(0.18, 0.03, 0.26), black, 0, 0.02, -0.38);
  tail.rotation.x = 0.2;
  const wings: THREE.Group[] = [];
  for (const sx of [1, -1]) {
    const w = new THREE.Group();
    w.position.set(0.16 * sx, 0.06, 0);
    const blade = add(w, new THREE.BoxGeometry(0.5, 0.025, 0.28), black, 0.25 * sx, 0, -0.02);
    blade.rotation.y = 0.15 * sx;
    group.add(w);
    wings.push(w);
  }
  return { group, wings, head };
}

// ===========================================================================
// Aliens (Nave Nodriza's helpers): long-headed, ribbed, with a tail
// ===========================================================================
export interface AlienModel {
  group: THREE.Group;
  /** Leans forward when it lunges */
  body: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Mesh;
  legs: THREE.Group[];
  arms: THREE.Group[];
  tail: THREE.Group[];
}

export function createAlien(): AlienModel {
  const group = new THREE.Group();
  const skin = std(0x0b0f14, 0.25, { metalness: 0.35, emissive: new THREE.Color(0x0f1a14), emissiveIntensity: 0.3 });
  const ribs = std(0x1f2937, 0.3, { metalness: 0.4 });
  const body = new THREE.Group();
  body.position.y = 0.95;
  group.add(body);
  // Ribbed torso, leaning forward
  const torso = add(body, new THREE.CapsuleGeometry(0.17, 0.5, 4, 10), skin, 0, 0.1, 0);
  torso.rotation.x = 0.55;
  for (let k = 0; k < 4; k++) {
    const rib = add(body, new THREE.TorusGeometry(0.18, 0.03, 6, 14), ribs, 0, 0.3 - k * 0.13, 0.08 - k * 0.07);
    rib.rotation.x = Math.PI / 2 + 0.55;
  }
  // Long curved head
  const head = new THREE.Group();
  head.position.set(0, 0.45, 0.32);
  const dome = add(head, new THREE.CapsuleGeometry(0.13, 0.55, 4, 10), skin, 0, 0.05, -0.22);
  dome.rotation.x = Math.PI / 2 + 0.35;
  add(head, new THREE.SphereGeometry(0.12, 10, 8), ribs, 0, -0.04, 0.08);
  const jaw = add(head, new THREE.BoxGeometry(0.12, 0.05, 0.16), ribs, 0, -0.13, 0.08);
  for (let k = 0; k < 5; k++) add(head, new THREE.BoxGeometry(0.018, 0.04, 0.018), std(0xe5e7eb, 0.4), -0.04 + k * 0.02, -0.1, 0.16);
  body.add(head);
  // Spines on the back
  for (let k = 0; k < 3; k++) {
    const sp = add(body, new THREE.CylinderGeometry(0.02, 0.05, 0.35, 6), skin, 0, 0.35 - k * 0.05, -0.2 - k * 0.08);
    sp.rotation.x = -0.9;
  }
  // Thin limbs (pivots at the joints)
  const arms: THREE.Group[] = [];
  const legs: THREE.Group[] = [];
  for (const sx of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(0.17 * sx, 0.25, 0.12);
    const a1 = add(arm, new THREE.CylinderGeometry(0.035, 0.03, 0.5, 6), skin, 0, -0.22, 0.08);
    a1.rotation.x = -0.5;
    for (let f = 0; f < 3; f++) {
      const claw = add(arm, new THREE.ConeGeometry(0.015, 0.14, 4), std(0xe5e7eb, 0.4), (f - 1) * 0.03, -0.46, 0.22);
      claw.rotation.x = Math.PI * 0.7;
    }
    body.add(arm);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(0.12 * sx, 0.95, -0.05);
    const thigh = add(leg, new THREE.CylinderGeometry(0.05, 0.04, 0.5, 6), skin, 0, -0.22, 0.1);
    thigh.rotation.x = 0.45;
    const shin = add(leg, new THREE.CylinderGeometry(0.04, 0.03, 0.55, 6), skin, 0, -0.62, 0.05);
    shin.rotation.x = -0.35;
    group.add(leg);
    legs.push(leg);
  }
  // Segmented tail ending in a blade
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = body;
  let z = -0.25;
  let y = -0.15;
  for (let k = 0; k < 6; k++) {
    const seg = new THREE.Group();
    seg.position.set(0, y, z);
    add(seg, new THREE.SphereGeometry(0.06 - k * 0.007, 8, 6), skin, 0, 0, -0.1);
    if (k === 5) {
      const blade = add(seg, new THREE.ConeGeometry(0.05, 0.25, 4), ribs, 0, 0, -0.25);
      blade.rotation.x = -Math.PI / 2;
    }
    parent.add(seg);
    tail.push(seg);
    parent = seg;
    z = -0.2;
    y = 0;
  }
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group, body, head, jaw, legs, arms, tail };
}


// ---------------------------------------------------------------------------
// Skinwalker (Backrooms boss): gaunt, hunched, a ragged hide over its back and a deer skull
// ---------------------------------------------------------------------------
export interface SkinwalkerModel {
  group: THREE.Group;
  /** Upper body pivot (hunch / crouch / rear back / crawl) */
  torso: THREE.Group;
  /** Neck pivot (the head twitches and tilts from here) */
  neck: THREE.Group;
  head: THREE.Group;
  /** Lower jaw (opens to scream and bite) */
  jaw: THREE.Group;
  arms: THREE.Group[];
  /** Elbows (bend when it crawls) */
  forearms: THREE.Group[];
  legs: THREE.Group[];
  eyes: THREE.MeshBasicMaterial;
  /** Glow around the eyes (brighter when it's about to attack) */
  eyeGlow: THREE.MeshBasicMaterial;
}

/** Tall, gaunt thing with a deer skull: backward-bent legs, too-long arms, a jaw that opens too wide. */
export function createSkinwalker(): SkinwalkerModel {
  const group = new THREE.Group();
  const skin = std(0x9a8f84, 0.9, { flatShading: true });
  const dark = std(0x5b5048, 0.9, { flatShading: true });
  const hide = std(0x3b2d22, 0.95, { flatShading: true });
  const bone = std(0xe9e2d0, 0.55, { flatShading: true });
  const claw = std(0x1c1714, 0.35);
  const mouth = basic(0x1a0505);
  const eyes = basic(0xfafafa);
  const eyeGlow = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });

  // Legs: bent backwards like an animal's, very long
  const legs: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0.22 * s, 1.45, 0);
    const thigh = add(hip, new THREE.CapsuleGeometry(0.1, 0.7, 4, 8), skin, 0, -0.36, 0.16);
    thigh.rotation.x = -0.55;
    const shin = add(hip, new THREE.CapsuleGeometry(0.065, 0.75, 4, 8), dark, 0, -1.0, 0.06);
    shin.rotation.x = 0.6;
    for (let f = -1; f <= 1; f++) {
      const c = add(hip, new THREE.ConeGeometry(0.035, 0.26, 4), claw, f * 0.05, -1.4, 0.2);
      c.rotation.x = Math.PI / 2;
    }
    group.add(hip);
    legs.push(hip);
  }

  const torso = new THREE.Group();
  torso.position.y = 1.5;
  torso.rotation.x = 0.45;
  group.add(torso);
  // Starved chest: you can count the ribs
  const chest = add(torso, new THREE.CapsuleGeometry(0.22, 0.85, 4, 10), skin, 0, 0.6, 0);
  chest.scale.set(1, 1, 0.7);
  const belly = add(torso, new THREE.CapsuleGeometry(0.13, 0.3, 4, 8), dark, 0, 0.12, 0.02);
  belly.scale.set(1, 1, 0.8);
  for (let i = 0; i < 5; i++) {
    const rib = add(torso, new THREE.TorusGeometry(0.2 - i * 0.008, 0.02, 4, 12, Math.PI), bone, 0, 0.38 + i * 0.13, 0.05);
    rib.rotation.set(0, 0, Math.PI / 2);
    rib.scale.set(1, 1.15, 0.85);
  }
  // Spine poking out of the back
  for (let i = 0; i < 7; i++) add(torso, new THREE.ConeGeometry(0.04, 0.12, 4), bone, 0, 0.15 + i * 0.16, -0.17).rotation.x = -Math.PI / 2 - 0.4;
  // Ragged hide over the shoulders
  const pelt = add(torso, new THREE.IcosahedronGeometry(0.4, 1), hide, 0, 1.0, -0.17);
  pelt.scale.set(1.15, 0.42, 0.85);
  for (let i = 0; i < 8; i++) {
    const strip = add(torso, new THREE.ConeGeometry(0.06, 0.55 + (i % 3) * 0.2, 4), hide, -0.36 + i * 0.1, 0.6, -0.3);
    strip.rotation.x = Math.PI + 0.25;
  }

  // Arms far too long, with elbows and hooked claws
  const arms: THREE.Group[] = [];
  const forearms: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(0.32 * s, 1.08, 0.05);
    add(sh, new THREE.CapsuleGeometry(0.055, 0.85, 4, 8), skin, 0, -0.48, 0);
    const el = new THREE.Group();
    el.position.set(0, -0.95, 0);
    sh.add(el);
    add(el, new THREE.CapsuleGeometry(0.045, 0.9, 4, 8), dark, 0, -0.5, 0);
    for (let f = -1.5; f <= 1.5; f++) {
      const c = add(el, new THREE.ConeGeometry(0.022, 0.32, 4), claw, f * 0.035, -1.06, 0.1);
      c.rotation.x = Math.PI - 0.55;
    }
    torso.add(sh);
    arms.push(sh);
    forearms.push(el);
  }

  // Long neck and a deer skull with antlers and a jaw that opens too wide
  const neck = new THREE.Group();
  neck.position.set(0, 1.2, 0.08);
  torso.add(neck);
  const neckBone = add(neck, new THREE.CapsuleGeometry(0.07, 0.32, 4, 8), dark, 0, 0.16, 0.04);
  neckBone.rotation.x = 0.35;
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.14);
  head.scale.setScalar(1.3);
  neck.add(head);
  const skull = add(head, new THREE.SphereGeometry(0.18, 12, 10), bone, 0, 0.05, 0);
  skull.scale.set(0.9, 0.85, 1.05);
  const snout = add(head, new THREE.BoxGeometry(0.14, 0.09, 0.4), bone, 0, 0.0, 0.26);
  snout.rotation.x = 0.22;
  // Upper teeth
  for (let i = 0; i < 6; i++) {
    const t = add(head, new THREE.ConeGeometry(0.014, 0.07, 4), bone, (i % 2 ? 1 : -1) * 0.05, -0.08 + i * 0.012, 0.12 + i * 0.05);
    t.rotation.x = Math.PI;
  }
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.06, 0.05);
  head.add(jaw);
  const jawBone = add(jaw, new THREE.BoxGeometry(0.12, 0.05, 0.38), bone, 0, -0.03, 0.2);
  jawBone.rotation.x = 0.12;
  add(jaw, new THREE.BoxGeometry(0.1, 0.04, 0.3), mouth, 0, 0.0, 0.18);
  for (let i = 0; i < 6; i++) add(jaw, new THREE.ConeGeometry(0.013, 0.06, 4), bone, (i % 2 ? 1 : -1) * 0.045, 0.03, 0.08 + i * 0.05);
  const socket = basic(0x050505);
  for (const s of [1, -1]) {
    add(head, new THREE.SphereGeometry(0.055, 8, 6), socket, 0.08 * s, 0.08, 0.12);
    add(head, new THREE.SphereGeometry(0.02, 6, 6), eyes, 0.08 * s, 0.08, 0.17);
    add(head, new THREE.SphereGeometry(0.06, 8, 6), eyeGlow, 0.08 * s, 0.08, 0.17);
    const beam = new THREE.Group();
    beam.position.set(0.08 * s, 0.19, -0.02);
    beam.rotation.z = -0.55 * s;
    beam.rotation.x = -0.3;
    add(beam, new THREE.CylinderGeometry(0.016, 0.028, 0.7, 5), bone, 0, 0.35, 0);
    for (let t = 0; t < 4; t++) {
      const tine = add(beam, new THREE.CylinderGeometry(0.008, 0.017, 0.24, 4), bone, 0.06 * s, 0.2 + t * 0.14, 0.03);
      tine.rotation.z = -0.9 * s;
    }
    head.add(beam);
  }
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).material !== eyeGlow) (o as THREE.Mesh).castShadow = true;
  });
  group.scale.setScalar(1.25);
  return { group, torso, neck, head, jaw, arms, forearms, legs, eyes, eyeGlow };
}
