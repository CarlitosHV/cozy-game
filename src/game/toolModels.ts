/**
 * 3D models for the boss-fight tools (pickups in the arena, projectiles and the bat in hand):
 * resortera, piedras, bate, red, bomba, orbe de luz, antorcha — plus the food that heals
 * (hamburguesa, papitas). All built from primitives, centered around the origin.
 */
import * as THREE from 'three';
import type { ItemType } from './items';
import { makeGlowTexture } from './levelKit';

const std = (color: number, roughness = 0.7, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

function add(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

/** One rock for the slingshot (also the bird's thrown boulders, scaled up). */
export function makeStone(r = 0.13, color = 0x9ca3af): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(r, 0);
  const m = new THREE.Mesh(geo, std(color, 0.95, { flatShading: true }));
  m.castShadow = true;
  return m;
}

export function makeSlingshot(): THREE.Group {
  const g = new THREE.Group();
  const wood = std(0x92400e, 0.8);
  add(g, new THREE.CylinderGeometry(0.035, 0.045, 0.32, 8), wood, 0, -0.12, 0);
  for (const s of [1, -1]) {
    const arm = add(g, new THREE.CylinderGeometry(0.03, 0.035, 0.26, 8), wood, 0.08 * s, 0.13, 0);
    arm.rotation.z = -0.5 * s;
  }
  const band = std(0xef4444, 0.5);
  const b = add(g, new THREE.TorusGeometry(0.14, 0.012, 6, 16, Math.PI), band, 0, 0.2, 0.02);
  b.rotation.z = Math.PI;
  b.scale.y = 0.6;
  add(g, new THREE.SphereGeometry(0.035, 8, 6), std(0x78350f), 0, 0.12, 0.03);
  return g;
}

export function makeStonePile(): THREE.Group {
  const g = new THREE.Group();
  const offs: [number, number, number, number][] = [
    [0, -0.05, 0, 0.13],
    [0.15, -0.08, 0.05, 0.1],
    [-0.12, -0.08, 0.06, 0.11],
    [0.02, 0.08, 0.02, 0.09],
  ];
  for (const [x, y, z, r] of offs) {
    const s = makeStone(r, 0x9ca3af);
    s.position.set(x, y, z);
    s.rotation.set(x * 5, y * 7, z * 3);
    g.add(s);
  }
  return g;
}

/** Wooden bat ~0.8m long, handle at the origin, pointing up (+y). */
export function makeBat(): THREE.Group {
  const g = new THREE.Group();
  const wood = std(0xd97706, 0.55);
  add(g, new THREE.CylinderGeometry(0.075, 0.03, 0.62, 10), wood, 0, 0.42, 0);
  add(g, new THREE.SphereGeometry(0.075, 10, 8), wood, 0, 0.73, 0);
  add(g, new THREE.CylinderGeometry(0.032, 0.032, 0.16, 8), std(0x1f2937, 0.6), 0, 0.06, 0);
  add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), std(0x1f2937, 0.6), 0, -0.02, 0);
  return g;
}

/** A net: hoop + mesh + handle. */
export function makeNet(): THREE.Group {
  const g = new THREE.Group();
  const rim = std(0x0e7490, 0.4, { metalness: 0.3 });
  const hoop = add(g, new THREE.TorusGeometry(0.2, 0.018, 6, 24), rim, 0, 0.18, 0);
  hoop.rotation.x = Math.PI / 2;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xa5f3fc, wireframe: true })
  );
  mesh.position.y = 0.18;
  g.add(mesh);
  add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), std(0x78350f), 0, -0.06, 0);
  return g;
}

/** Thrown net: a flat open mesh that spreads while flying. */
export function makeNetProjectile(): THREE.Group {
  const g = new THREE.Group();
  const web = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.9 })
  );
  g.add(web);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), std(0x475569, 0.6, { metalness: 0.5 }));
    w.position.set(Math.cos(a) * 0.52, 0.12, Math.sin(a) * 0.52);
    g.add(w);
  }
  return g;
}

/** A net wrapped around something (radius r, height h). */
export function makeNetWrap(r: number, h: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.75, r, h, 14, 4, true),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.85 })
  );
  m.position.y = h / 2;
  return m;
}

export function makeBomb(): THREE.Group {
  const g = new THREE.Group();
  add(g, new THREE.SphereGeometry(0.2, 16, 12), std(0x1f2937, 0.35, { metalness: 0.4 }));
  add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.07, 10), std(0x6b7280, 0.5, { metalness: 0.6 }), 0, 0.2, 0);
  const fuse = add(g, new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6), std(0xd6d3d1), 0.03, 0.29, 0);
  fuse.rotation.z = -0.4;
  const spark = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(255,214,102,1)'), blending: THREE.AdditiveBlending, depthWrite: false })
  );
  spark.scale.setScalar(0.22);
  spark.position.set(0.07, 0.37, 0);
  spark.name = 'spark';
  g.add(spark);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0x9ca3af }));
  shine.position.set(-0.08, 0.1, 0.14);
  g.add(shine);
  return g;
}

export function makeLightOrb(): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfde68a, emissiveIntensity: 1.6, roughness: 0.2 })
  );
  g.add(core);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(253,230,138,0.95)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  glow.scale.setScalar(0.9);
  g.add(glow);
  return g;
}

export function makeTorch(): THREE.Group {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.035, 0.05, 0.5, 8), std(0x78350f, 0.85), 0, -0.05, 0);
  add(g, new THREE.CylinderGeometry(0.07, 0.05, 0.1, 8), std(0x44403c, 0.7), 0, 0.22, 0);
  g.add(makeFlame(0.1));
  g.children[g.children.length - 1].position.y = 0.34;
  return g;
}

/** Little flame (cone + glow). */
export function makeFlame(size = 0.1): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(size, size * 2.6, 8),
    new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.9 })
  );
  outer.position.y = size * 0.9;
  g.add(outer);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size * 1.6, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  inner.position.y = size * 0.6;
  g.add(inner);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(251,146,60,0.9)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  glow.scale.setScalar(size * 9);
  glow.position.y = size;
  g.add(glow);
  g.name = 'flame';
  return g;
}

/** Pickup model for each boss-fight item type. */
export function createToolModel(type: ItemType): THREE.Group {
  switch (type) {
    case 'resortera':
      return makeSlingshot();
    case 'piedra':
      return makeStonePile();
    case 'bate': {
      const g = new THREE.Group();
      const b = makeBat();
      b.rotation.z = 0.5;
      b.position.set(-0.15, -0.3, 0);
      g.add(b);
      return g;
    }
    case 'red':
      return makeNet();
    case 'bomba':
      return makeBomb();
    case 'luz':
      return makeLightOrb();
    case 'antorcha':
      return makeTorch();
    case 'palanca':
      return makeCrowbar();
    case 'craneo':
      return makeObsidianSkull();
    case 'daga':
      return makeObsidianDagger();
    default:
      return new THREE.Group();
  }
}

/** Black glassy skull with violet glints (scares the Skinwalker) */
function makeObsidianSkull(): THREE.Group {
  const g = new THREE.Group();
  const obs = std(0x1c1426, 0.12, { metalness: 0.4, emissive: 0x2e1065, emissiveIntensity: 0.5 });
  const cranium = add(g, new THREE.SphereGeometry(0.22, 14, 12), obs, 0, 0.05, 0);
  cranium.scale.set(1, 0.95, 1.1);
  const jaw = add(g, new THREE.BoxGeometry(0.24, 0.1, 0.2), obs, 0, -0.14, 0.07);
  jaw.rotation.x = 0.15;
  const holeM = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
  for (const s of [1, -1]) add(g, new THREE.SphereGeometry(0.05, 8, 6), holeM, 0.08 * s, 0.05, 0.19);
  add(g, new THREE.ConeGeometry(0.03, 0.06, 3), holeM, 0, -0.04, 0.22).rotation.x = Math.PI;
  return g;
}

/** Single-use obsidian dagger (the only thing that hurts the Skinwalker) */
function makeObsidianDagger(): THREE.Group {
  const g = new THREE.Group();
  const blade = std(0x241a33, 0.08, { metalness: 0.5, emissive: 0x4c1d95, emissiveIntensity: 0.6 });
  const b = add(g, new THREE.ConeGeometry(0.07, 0.5, 4), blade, 0, 0.18, 0);
  b.scale.z = 0.35;
  add(g, new THREE.BoxGeometry(0.22, 0.04, 0.06), std(0x9ca3af, 0.4, { metalness: 0.8 }), 0, -0.08, 0);
  add(g, new THREE.CylinderGeometry(0.03, 0.035, 0.2, 8), std(0x5b3a1e, 0.8), 0, -0.2, 0);
  g.rotation.z = 0.4;
  return g;
}

/** Iron crowbar (opens the basement trapdoor in generated levels) */
function makeCrowbar(): THREE.Group {
  const g = new THREE.Group();
  const iron = std(0x64748b, 0.35, { metalness: 0.8 });
  add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.9, 8), iron, 0, 0, 0);
  const hook = add(g, new THREE.TorusGeometry(0.12, 0.045, 8, 14, Math.PI), iron, 0.12, 0.45, 0);
  hook.rotation.z = Math.PI / 2;
  const tip = add(g, new THREE.BoxGeometry(0.16, 0.05, 0.09), iron, 0.06, -0.46, 0);
  tip.rotation.z = -0.4;
  const grip = add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), std(0xb91c1c, 0.6), 0, -0.15, 0);
  grip.castShadow = true;
  g.rotation.z = 0.35;
  return g;
}

// ---------- Food that heals ----------

export function makeBurger(): THREE.Group {
  const g = new THREE.Group();
  const bun = std(0xd97706, 0.6);
  const top = add(g, new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), bun, 0, 0.1, 0);
  top.scale.y = 0.7;
  add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16), bun, 0, -0.16, 0);
  add(g, new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), std(0x5b2c12, 0.8), 0, -0.06, 0);
  const cheese = add(g, new THREE.BoxGeometry(0.5, 0.025, 0.5), std(0xfacc15, 0.5), 0, 0.0, 0);
  cheese.rotation.y = Math.PI / 4;
  add(g, new THREE.CylinderGeometry(0.34, 0.33, 0.03, 12), std(0x4ade80, 0.6), 0, 0.05, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const seed = add(g, new THREE.SphereGeometry(0.02, 4, 4), std(0xfef3c7), Math.cos(a) * 0.15, 0.27, Math.sin(a) * 0.15);
    seed.scale.set(1, 0.5, 1.6);
  }
  return g;
}

export function makeFries(): THREE.Group {
  const g = new THREE.Group();
  const box = add(g, new THREE.CylinderGeometry(0.2, 0.14, 0.32, 4, 1), std(0xdc2626, 0.5), 0, -0.04, 0);
  box.rotation.y = Math.PI / 4;
  add(g, new THREE.SphereGeometry(0.06, 8, 6), std(0xfacc15, 0.4), 0, -0.02, 0.15);
  const fry = std(0xfcd34d, 0.6);
  for (let i = 0; i < 9; i++) {
    const x = ((i % 3) - 1) * 0.07;
    const z = (Math.floor(i / 3) - 1) * 0.07;
    const f = add(g, new THREE.BoxGeometry(0.04, 0.3 + (i % 2) * 0.06, 0.04), fry, x, 0.16, z);
    f.rotation.set(z * 1.5, 0, -x * 1.5);
  }
  return g;
}
