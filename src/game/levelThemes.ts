/**
 * Theme packs for the procedural level generator.
 * Each pack knows how to dress every kind of platform, which trampoline and enemies
 * to use, decor props and the sky backdrop — for the 4 worlds:
 *   cozy (Archipiélago), cosmic (Ruta Cósmica), swamp (Pantano Sombrío), aero (Valle Aero).
 */
import * as THREE from 'three';
import { WeatherType } from '../audio/SoundtrackSynthesizer';
import { EnemyManager } from './enemies';
import { BouncyMushroomModel, createBouncyMushroom, createCozyTree } from './models';
import { ProceduralTextures } from './textures';
import { LevelKit, makeGlowTexture } from './levelKit';
import { addCosmicBackdrop, createCosmicStyle } from './levelCosmic';
import { addSwampBackdrop, createSwampStyle } from './levelSwamp';

export type ThemeId = 'cozy' | 'cosmic' | 'swamp' | 'aero';
export type Builder = (g: THREE.Group, w: number, d: number, h: number) => void;
type Spawner = (em: EnemyManager, id: string, pos: THREE.Vector3, axis: 'x' | 'z', range: number) => void;

export interface ThemePack {
  id: ThemeId;
  name: string;
  weather: WeatherType;
  cpNames: string[];
  summitName: string;
  big: Builder;
  small: Builder[];
  deck: Builder;
  mover: Builder;
  bridge: Builder;
  launchPad: Builder;
  trampoline: () => BouncyMushroomModel;
  updraftTint?: number;
  /** Decorative prop with collider, standing on a surface at (x,y,z) */
  prop: (x: number, y: number, z: number, rnd: number) => void;
  backdrop: (zMax: number) => void;
  walker: Spawner;
  flyer: Spawner;
}

export const THEME_NAMES: Record<ThemeId, string> = {
  cozy: 'Archipiélago Acogedor',
  cosmic: 'Ruta Cósmica',
  swamp: 'Pantano Sombrío',
  aero: 'Valle Aero',
};

export const THEME_ACCENTS: Record<ThemeId, string> = {
  cozy: '#f59e0b',
  cosmic: '#a78bfa',
  swamp: '#84cc16',
  aero: '#38bdf8',
};

// ---------------------------------------------------------------------------
// COZY (Level 1 look)
// ---------------------------------------------------------------------------
function cozyPack(kit: LevelKit, textures: ProceduralTextures): ThemePack {
  const grassMat = new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.8, metalness: 0.05 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.85, metalness: 0.1 });
  const woodMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.7, metalness: 0.1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7c6a5a, roughness: 0.95, flatShading: true });
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf0f7ff, roughness: 0.95, transparent: true, opacity: 0.94 });

  const island: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [dirtMat, dirtMat, grassMat, dirtMat, dirtMat, dirtMat]);
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const under = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.5, Math.min(w, d) * 0.6, 7), rockMat);
    under.rotation.x = Math.PI;
    under.position.y = -h - Math.min(w, d) * 0.3;
    g.add(under);
  };
  const block = (mat: THREE.Material): Builder => (g, w, d, h) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
  };
  const cloud: Builder = (g, w, d) => {
    const r = Math.min(w, d) * 0.36;
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r * (0.9 + (i % 2) * 0.2), 10, 8), cloudMat);
      puff.scale.set(1.2, 0.55, 1.2);
      const a = (i / 5) * Math.PI * 2;
      puff.position.set(i === 0 ? 0 : Math.cos(a) * w * 0.28, -r * 0.5, i === 0 ? 0 : Math.sin(a) * d * 0.28);
      puff.castShadow = true;
      g.add(puff);
    }
  };
  return {
    id: 'cozy',
    name: THEME_NAMES.cozy,
    weather: 'golden_hour',
    cpNames: ['Prado del Viento', 'Colina de Bellotas', 'Mirador del Arce', 'Nido de Nubes', 'Jardín de Pétalos', 'Puente del Alba'],
    summitName: 'Cima Acogedora',
    big: island,
    small: [block(stoneMat), block(woodMat), island],
    deck: block(woodMat),
    mover: cloud,
    bridge: block(woodMat),
    launchPad: block(stoneMat),
    trampoline: () => createBouncyMushroom(1.3, textures),
    prop: (x, y, z, rnd) => {
      const kind = rnd < 0.4 ? 'sakura' : rnd < 0.75 ? 'autumn' : 'pine';
      const t = createCozyTree(kind, 0.9 + rnd * 0.3, textures);
      t.position.set(x, y, z);
      kit.addDecor(t);
      kit.registerCylinder(`tree_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.42, 3.5);
    },
    backdrop: (zMax) => {
      // Distant floating islands
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        const g = new THREE.Group();
        g.position.set(side * (28 + (i * 7) % 20), -6 + (i * 5) % 18, -10 + (i / 10) * zMax);
        island(g, 6 + (i % 3) * 2, 6 + (i % 2) * 3, 2.5);
        kit.addDecor(g);
      }
    },
    walker: (em, id, pos, axis, range) => em.spawnSproutling(id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => em.spawnZephyrPuff(id, pos, axis, range),
  };
}

// ---------------------------------------------------------------------------
// COSMIC (reuses the Ruta Cósmica style)
// ---------------------------------------------------------------------------
function cosmicPack(kit: LevelKit): ThemePack {
  const s = createCosmicStyle(kit);
  return {
    id: 'cosmic',
    name: THEME_NAMES.cosmic,
    weather: 'cosmic',
    cpNames: ['Dársena Lunar', 'Cinturón de Asteroides', 'Faro Galáctico', 'Muelle de Cometas', 'Órbita Violeta', 'Estación Polaris'],
    summitName: 'Observatorio Estelar',
    big: s.station,
    small: [s.asteroid, s.asteroid, s.crystal],
    deck: s.crystal,
    mover: s.asteroid,
    bridge: s.starBridge,
    launchPad: s.station,
    trampoline: s.createStarTrampoline,
    updraftTint: 0xc084fc,
    prop: (x, y, z, rnd) => {
      // Glowing crystal cluster or beacon antenna
      const g = new THREE.Group();
      g.position.set(x, y, z);
      if (rnd < 0.5) {
        for (let i = 0; i < 4; i++) {
          const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + i * 0.08, 0), s.crystalMat);
          c.scale.y = 2.4;
          c.position.set(Math.cos(i * 1.7) * 0.4, 0.6 + i * 0.1, Math.sin(i * 1.7) * 0.4);
          c.rotation.z = (i - 1.5) * 0.25;
          g.add(c);
        }
      } else {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 4, 8), s.hullMat);
        mast.position.y = 2;
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), s.glowPink);
        beacon.position.y = 4.1;
        g.add(mast, beacon);
        kit.animators.push((_dt, time) => (beacon.visible = Math.floor(time * 2 + x) % 2 === 0));
      }
      kit.addDecor(g);
      kit.registerCylinder(`prop_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.6, 2.5);
    },
    backdrop: (zMax) => addCosmicBackdrop(kit, s, zMax),
    walker: (em, id, pos, axis, range) => em.spawnAlienBlob(id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => em.spawnUfo(id, pos, axis, range),
  };
}

// ---------------------------------------------------------------------------
// SWAMP (reuses the Pantano Sombrío style)
// ---------------------------------------------------------------------------
function swampPack(kit: LevelKit, textures: ProceduralTextures): ThemePack {
  const s = createSwampStyle(kit);
  return {
    id: 'swamp',
    name: THEME_NAMES.swamp,
    weather: 'swamp_mist',
    cpNames: ['Ciénaga Susurrante', 'Altar Hundido', 'Claro de Hongos', 'Puente del Ahorcado', 'Ruinas del Búho', 'Cripta Musgosa'],
    summitName: 'Santuario de las Luciérnagas',
    big: s.mossIsland,
    small: [s.lilyPad, s.stoneBlock, s.planks, s.lilyPad],
    deck: s.stoneBlock,
    mover: s.raft,
    bridge: s.logBridge,
    launchPad: s.runeCircle,
    trampoline: () => {
      const m = createBouncyMushroom(1.3, textures);
      const mat = m.cap.material as THREE.MeshStandardMaterial;
      mat.color.set(0x7e22ce);
      mat.emissive = new THREE.Color(0x3b0764);
      mat.emissiveIntensity = 0.6;
      return m;
    },
    updraftTint: 0x86efac,
    prop: (x, y, z, rnd) => {
      if (rnd < 0.45) s.deadTree(x, y, z, 0.9 + rnd * 0.4);
      else if (rnd < 0.75) s.lanternPost(x, y, z);
      else {
        s.glowShrooms(x, y, z, 4);
        s.gravestone(x + 0.8, y, z + 0.4, rnd * 3);
      }
    },
    backdrop: (zMax) => {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(240, zMax + 140), s.waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, -1.2, zMax / 2);
      kit.addDecor(water);
      addSwampBackdrop(kit, s, zMax);
    },
    walker: (em, id, pos, axis, range) => em.spawnMudling(id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => em.spawnWraith(id, pos, axis, range),
  };
}

// ---------------------------------------------------------------------------
// AERO (Frutiger Aero look)
// ---------------------------------------------------------------------------
function aeroPack(kit: LevelKit): ThemePack {
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4fc23f, roughness: 0.5, metalness: 0.02 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xd9eef9, roughness: 0.25, metalness: 0.15 });
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x8fe3f5, roughness: 0.12, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.88 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x7fd8ff, roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.42, envMapIntensity: 1.6 });
  const towerGlass = new THREE.MeshPhysicalMaterial({ color: 0x3fb2e8, roughness: 0.05, metalness: 0.25, clearcoat: 1, transparent: true, opacity: 0.62, envMapIntensity: 1.8 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe6f0f7, roughness: 0.28, metalness: 0.25 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4ccf3c, roughness: 0.2 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x8be04e, roughness: 0.22 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xf1e6d6, roughness: 0.3 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });

  const frame = (g: THREE.Group, w: number, d: number) => {
    for (const [bw, bd, x, z] of [
      [w + 0.12, 0.12, 0, d / 2],
      [w + 0.12, 0.12, 0, -d / 2],
      [0.12, d, w / 2, 0],
      [0.12, d, -w / 2, 0],
    ] as [number, number, number, number][]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.1, bd), whiteMat);
      bar.position.set(x, -0.05, z);
      g.add(bar);
    }
  };
  const meadow: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, grassMat, sideMat, sideMat, sideMat]);
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const under = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.55, Math.min(w, d) * 0.7, 7), crystalMat);
    under.rotation.x = Math.PI;
    under.position.y = -h - Math.min(w, d) * 0.35;
    g.add(under);
  };
  const glass: Builder = (g, w, d, h) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
    slab.position.y = -h / 2;
    slab.receiveShadow = true;
    g.add(slab);
    frame(g, w, d);
  };
  const roof: Builder = (g, w, d, h) => {
    // White rooftop on a glass tower that reaches down into the haze (visual only)
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), whiteMat);
    top.position.y = -h / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    const bodyH = 30;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, bodyH, d - 0.3), towerGlass);
    body.position.y = -h - bodyH / 2;
    g.add(body);
    for (let yy = -h - 3.2; yy > -h - bodyH + 2; yy -= 3.4) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.1, d - 0.2), whiteMat);
      band.position.y = yy;
      g.add(band);
    }
  };
  const bubbleTrampoline = (): BouncyMushroomModel => {
    const group = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.1, 0.55, 24), whiteMat);
    stalk.position.y = 0.27;
    group.add(stalk);
    const capGeom = new THREE.SphereGeometry(1.3, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeom.scale(1, 0.62, 1);
    const cap = new THREE.Mesh(capGeom, new THREE.MeshPhysicalMaterial({ color: 0x9ae6ff, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.55, envMapIntensity: 2 }));
    cap.position.y = 0.55;
    group.add(cap);
    let tb = -1;
    let amp = 0.28;
    return {
      group,
      cap,
      stalk,
      triggerBounce: (sup = false) => {
        tb = 0;
        amp = sup ? 0.42 : 0.28;
      },
      update: (dt: number) => {
        if (tb < 0) return;
        tb += dt;
        const p = tb / 0.9;
        if (p >= 1) {
          tb = -1;
          cap.scale.set(1, 1, 1);
          return;
        }
        const sq = 1 - Math.sin(p * Math.PI * 3) * Math.exp(-p * 3.8) * amp;
        cap.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
      },
    };
  };
  return {
    id: 'aero',
    name: THEME_NAMES.aero,
    weather: 'aero_day',
    cpNames: ['Lago Burbuja', 'Terraza de Cristal', 'Fuente Aqua', 'Mirador Arcoíris', 'Avenida Brillante', 'Jardín Ecológico'],
    summitName: 'Plaza del Globo',
    big: meadow,
    small: [glass, glass, roof],
    deck: roof,
    mover: glass,
    bridge: glass,
    launchPad: meadow,
    trampoline: bubbleTrampoline,
    prop: (x, y, z, rnd) => {
      const s = 0.85 + rnd * 0.35;
      const tree = new THREE.Group();
      tree.position.set(x, y, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 2.6 * s, 10), trunkMat);
      trunk.position.y = 1.3 * s;
      tree.add(trunk);
      const blobs: [number, number, number, number, THREE.Material][] = [
        [0, 3.4, 0, 1.5, leafMat],
        [0.9, 2.85, 0.3, 1.0, leafMat2],
        [-0.85, 2.95, -0.2, 1.05, leafMat2],
      ];
      for (const [bx, by, bz, r, m] of blobs) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(r * s, 18, 14), m);
        blob.position.set(bx * s, by * s, bz * s);
        blob.castShadow = true;
        tree.add(blob);
        const hl = new THREE.Mesh(new THREE.SphereGeometry(r * s * 0.3, 10, 8), shineMat);
        hl.scale.set(1.3, 0.6, 1);
        hl.position.set((bx - r * 0.35) * s, (by + r * 0.55) * s, (bz + r * 0.45) * s);
        tree.add(hl);
      }
      kit.addDecor(tree);
      kit.registerCylinder(`aerotree_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.38 * s, 3.2 * s);
    },
    backdrop: (zMax) => {
      [0xff5d5d, 0xffa94d, 0xffe066, 0x69db7c, 0x4dabf7, 0x9775fa].forEach((col, i) => {
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(95 - i * 2.2, 1.1, 8, 96, Math.PI),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32, depthWrite: false, fog: false })
        );
        band.position.set(0, -20, zMax + 80);
        kit.addDecor(band);
      });
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x58c94a, roughness: 0.3 });
      for (let i = 0; i < 6; i++) {
        const hill = new THREE.Mesh(new THREE.SphereGeometry(35 + (i % 3) * 10, 28, 14), hillMat);
        hill.scale.y = 0.45;
        hill.position.set((i % 2 ? 1 : -1) * (60 + (i * 13) % 30), -28, (i / 6) * zMax);
        kit.addDecor(hill);
      }
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        const top = 40 + (i * 9) % 25;
        const g = new THREE.Group();
        g.position.set(side * (50 + (i * 11) % 20), top, 20 + (i / 10) * (zMax + 40));
        const b = new THREE.Mesh(new THREE.BoxGeometry(8, top + 45, 8), towerGlass);
        b.position.y = -(top + 45) / 2;
        g.add(b, new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.6, 8.4), whiteMat));
        kit.addDecor(g);
      }
      const bubbleMat = new THREE.MeshPhysicalMaterial({ color: 0xe0f7ff, roughness: 0, clearcoat: 1, transparent: true, opacity: 0.28, iridescence: 1, iridescenceIOR: 1.3, depthWrite: false });
      const bubbles: { m: THREE.Mesh; sp: number; ph: number; bx: number }[] = [];
      const geom = new THREE.SphereGeometry(1, 16, 12);
      for (let i = 0; i < 40; i++) {
        const m = new THREE.Mesh(geom, bubbleMat);
        m.scale.setScalar(0.15 + Math.random() * 0.45);
        const bx = (Math.random() - 0.5) * 50;
        m.position.set(bx, -6 + Math.random() * 50, -15 + Math.random() * (zMax + 20));
        kit.addDecor(m);
        bubbles.push({ m, sp: 0.5 + Math.random() * 0.9, ph: Math.random() * 10, bx });
      }
      kit.animators.push((dt, time) => {
        for (const b of bubbles) {
          b.m.position.y += b.sp * dt;
          b.m.position.x = b.bx + Math.sin(time * 0.8 + b.ph) * 0.8;
          if (b.m.position.y > 55) b.m.position.y = -8;
        }
      });
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(255,255,240,0.9)'), transparent: true, depthWrite: false, fog: false }));
      sun.position.set(60, 80, zMax + 60);
      sun.scale.setScalar(40);
      kit.addDecor(sun);
    },
    walker: (em, id, pos, axis, range) => em.spawnGlitchCube(id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => em.spawnErrorPopup(id, pos, axis, range),
  };
}

export function createThemePack(id: ThemeId, kit: LevelKit, textures: ProceduralTextures): ThemePack {
  switch (id) {
    case 'cosmic':
      return cosmicPack(kit);
    case 'swamp':
      return swampPack(kit, textures);
    case 'aero':
      return aeroPack(kit);
    default:
      return cozyPack(kit, textures);
  }
}
