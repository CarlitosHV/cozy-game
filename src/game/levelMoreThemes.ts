/**
 * Theme packs for 4 vibrant additional worlds:
 *  - 'lava'   (Volcán Infernal)
 *  - 'ice'    (Cumbre Glacial)
 *  - 'desert' (Dunas Doradas)
 *  - 'candy'  (Reino Dulce)
 * Procedural canvas textures, composite multi-part platforms, props, trampolines,
 * and themed enemy spawners — zero external asset dependencies.
 */
import * as THREE from 'three';
import { BouncyMushroomModel } from './models';
import { LevelKit } from './levelKit';
import { Builder, ThemePack, THEME_NAMES } from './levelThemes';
import { ProceduralTextures } from './textures';
import { spawnExtraEnemy } from './enemiesExtra';

function makeBasaltLavaTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1d1414';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle dark rock flecks
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2b1e1c' : '#120b0b';
    ctx.fillRect((i * 53) % 250, (i * 97) % 250, 5 + (i % 6), 4 + (i % 5));
  }

  // Glowing molten magma veins
  ctx.strokeStyle = '#ea580c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(80, 96);
  ctx.lineTo(148, 48);
  ctx.lineTo(256, 76);
  ctx.moveTo(42, 0);
  ctx.lineTo(96, 128);
  ctx.lineTo(64, 256);
  ctx.moveTo(188, 0);
  ctx.lineTo(156, 160);
  ctx.lineTo(220, 256);
  ctx.stroke();

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeGlacierIceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#bae6fd');
  grad.addColorStop(0.5, '#7dd3fc');
  grad.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Crystalline fracture lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    const x0 = (i * 41) % 256;
    const y0 = (i * 73) % 256;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + 48, y0 + 26);
    ctx.lineTo(x0 + 72, y0 - 14);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 250, 250);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeSandstoneTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e7b972';
  ctx.fillRect(0, 0, 256, 256);

  // Stratified sandstone blocks
  ctx.strokeStyle = '#c28b40';
  ctx.lineWidth = 3;
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    ctx.fillStyle = row % 2 === 0 ? 'rgba(245, 194, 114, 0.35)' : 'rgba(212, 154, 76, 0.25)';
    ctx.fillRect(0, y, 256, 64);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();

    const offset = row % 2 === 0 ? 0 : 64;
    for (let x = offset; x < 256; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 64);
      ctx.stroke();
    }
  }

  // Golden border trim
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 250);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCandyWaferTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fbcfe8';
  ctx.fillRect(0, 0, 256, 256);

  // Diagonal wafer diamond pattern
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.42)';
  ctx.lineWidth = 3;
  for (let i = -256; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.moveTo(i, 256);
    ctx.lineTo(i + 256, 0);
    ctx.stroke();
  }

  // Colorful sugar sprinkles
  const sprinkleCols = ['#f43f5e', '#38bdf8', '#facc15', '#4ade80', '#ffffff'];
  for (let i = 0; i < 42; i++) {
    ctx.save();
    ctx.translate((i * 61) % 236 + 10, (i * 89) % 236 + 10);
    ctx.rotate((i * 0.7) % Math.PI);
    ctx.fillStyle = sprinkleCols[i % sprinkleCols.length];
    ctx.fillRect(-6, -2.5, 12, 5);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createThemedTrampoline(
  baseColor: number,
  capColor: number,
  emissiveColor: number,
  ringColor: number
): BouncyMushroomModel {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.4, metalness: 0.45 });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 0.55, 16), baseMat);
  stalk.position.y = 0.27;
  group.add(stalk);

  const capMat = new THREE.MeshStandardMaterial({
    color: capColor,
    roughness: 0.25,
    metalness: 0.2,
    emissive: emissiveColor,
    emissiveIntensity: 0.55,
  });
  const capGeom = new THREE.CylinderGeometry(1.25, 1.05, 0.36, 18);
  const cap = new THREE.Mesh(capGeom, capMat);
  cap.position.y = 0.65;
  group.add(cap);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.08, 8, 24),
    new THREE.MeshBasicMaterial({ color: ringColor })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.82;
  group.add(rim);

  let tb = -1;
  let amp = 0.3;
  return {
    group,
    cap,
    stalk,
    triggerBounce: (sup = false) => {
      tb = 0;
      amp = sup ? 0.46 : 0.3;
    },
    update: (dt: number) => {
      if (tb < 0) return;
      tb += dt;
      const p = tb / 0.8;
      if (p >= 1) {
        tb = -1;
        cap.scale.set(1, 1, 1);
        cap.position.y = 0.65;
        return;
      }
      const sq = 1 - Math.sin(p * Math.PI * 3) * Math.exp(-p * 3.8) * amp;
      cap.scale.set(1 + (1 - sq) * 0.35, sq, 1 + (1 - sq) * 0.35);
      cap.position.y = 0.65 + Math.sin(p * Math.PI) * 0.24;
    },
  };
}

// ===========================================================================
// 1. VOLCÁN INFERNAL ('lava')
// ===========================================================================
export function lavaPack(kit: LevelKit, _textures: ProceduralTextures): ThemePack {
  const { animators } = kit;
  const basaltTex = makeBasaltLavaTexture();
  const basaltMat = new THREE.MeshStandardMaterial({ map: basaltTex, roughness: 0.72, metalness: 0.25 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x1c1212, roughness: 0.85, metalness: 0.2 });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.35,
    emissive: 0xea580c,
    emissiveIntensity: 0.75,
  });
  const goldTrimMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.55, metalness: 0.7 });

  const lavaIsland: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [sideMat, sideMat, basaltMat, sideMat, sideMat, sideMat]
    );
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // Glowing lava trim lip
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.14, d + 0.14), emberMat);
    trim.position.y = -h * 0.55;
    g.add(trim);
    // Volcanic rock spire underside
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.45, Math.min(w, d) * 0.65, 6), sideMat);
    cone.rotation.x = Math.PI;
    cone.position.y = -h - Math.min(w, d) * 0.32;
    g.add(cone);
  };

  const obsidianPad: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basaltMat);
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), emberMat);
    edge.position.y = -0.07;
    g.add(edge);
  };

  const forgedBridge: Builder = (g, w, d, h) => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ironMat);
    deck.position.y = -h / 2;
    deck.castShadow = true;
    deck.receiveShadow = true;
    g.add(deck);
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, d), goldTrimMat);
      rail.position.set((w * 0.5 - 0.08) * sx, 0.06, 0);
      g.add(rail);
    }
  };

  return {
    id: 'lava',
    name: THEME_NAMES.lava,
    weather: 'lava_ash',
    cpNames: ['Cráter de Ceniza', 'Puente Basalto', 'Fragua de Magma', 'Altar Obsidiana', 'Caldera Ardiente', 'Aguja del Volcán'],
    summitName: 'Cumbre del Magma',
    big: lavaIsland,
    small: [obsidianPad, forgedBridge, obsidianPad],
    deck: lavaIsland,
    mover: obsidianPad,
    bridge: forgedBridge,
    launchPad: obsidianPad,
    trampoline: () => createThemedTrampoline(0x292524, 0xf97316, 0xea580c, 0xfacc15),
    updraftTint: 0xf97316,
    prop: (x, y, z, rnd) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      if (rnd < 0.55) {
        // Obsidian spire cluster with glowing magma core
        for (let i = 0; i < 3; i++) {
          const spH = 1.6 + ((i + rnd) % 1) * 1.4;
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.32 - i * 0.05, spH, 5), sideMat);
          sp.position.set((i - 1) * 0.3, spH / 2, (i % 2 === 0 ? 0.15 : -0.15));
          sp.rotation.z = (i - 1) * 0.16;
          sp.castShadow = true;
          g.add(sp);
        }
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), emberMat);
        core.position.y = 0.65;
        g.add(core);
      } else {
        // Iron magma brazier
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.34, 0.8, 8), ironMat);
        bowl.position.y = 0.4;
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 8), emberMat);
        pool.position.y = 0.8;
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 6), goldTrimMat);
        flame.position.y = 1.18;
        animators.push((_dt, t) => {
          flame.scale.y = 0.85 + Math.sin(t * 7 + x) * 0.25;
        });
        g.add(bowl, pool, flame);
      }
      kit.addDecor(g);
      kit.registerCylinder(`lava_prop_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.55, 2.4);
    },
    backdrop: () => {},
    walker: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'lava', 'chaser', id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'lava', 'diver', id, pos, axis, range),
  };
}

// ===========================================================================
// 2. CUMBRE GLACIAL ('ice')
// ===========================================================================
export function icePack(kit: LevelKit, _textures: ProceduralTextures): ThemePack {
  const { animators } = kit;
  const iceTex = makeGlacierIceTexture();
  const snowTopMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.05 });
  const iceMat = new THREE.MeshStandardMaterial({
    map: iceTex,
    roughness: 0.14,
    metalness: 0.22,
    transparent: true,
    opacity: 0.9,
  });
  const deepIceMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.22, metalness: 0.25 });
  const crystalGlowMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.1,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.55,
  });

  const snowIsland: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [iceMat, iceMat, snowTopMat, deepIceMat, iceMat, iceMat]
    );
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const icicle = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.44, Math.min(w, d) * 0.72, 6), deepIceMat);
    icicle.rotation.x = Math.PI;
    icicle.position.y = -h - Math.min(w, d) * 0.36;
    g.add(icicle);
  };

  const crystalSlab: Builder = (g, w, d, h) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), iceMat);
    slab.position.y = -h / 2;
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.1, d + 0.12), snowTopMat);
    trim.position.y = -0.05;
    g.add(trim);
  };

  const frostBridge: Builder = (g, w, d, h) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), iceMat);
    plank.position.y = -h / 2;
    plank.receiveShadow = true;
    g.add(plank);
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, d), crystalGlowMat);
      rail.position.set((w * 0.5 - 0.08) * sx, 0.08, 0);
      g.add(rail);
    }
  };

  return {
    id: 'ice',
    name: THEME_NAMES.ice,
    weather: 'blizzard',
    cpNames: ['Lago Congelado', 'Glaciar Espejo', 'Cresta de Escarcha', 'Caverna de Hielo', 'Mirador Boreal', 'Pico Ártico'],
    summitName: 'Trono de la Aurora',
    big: snowIsland,
    small: [crystalSlab, frostBridge, snowIsland],
    deck: crystalSlab,
    mover: crystalSlab,
    bridge: frostBridge,
    launchPad: crystalSlab,
    trampoline: () => createThemedTrampoline(0xe0f2fe, 0x38bdf8, 0x0ea5e9, 0xffffff),
    updraftTint: 0x7dd3fc,
    prop: (x, y, z, rnd) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      if (rnd < 0.5) {
        // Frosted crystalline icicle cluster
        for (let i = 0; i < 4; i++) {
          const ch = 1.4 + ((i * 0.4 + rnd) % 1.6);
          const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), crystalGlowMat);
          shard.scale.set(0.8, ch * 1.4, 0.8);
          shard.position.set(Math.cos(i * 1.6) * 0.32, ch * 0.5, Math.sin(i * 1.6) * 0.32);
          shard.rotation.z = (i - 1.5) * 0.15;
          g.add(shard);
        }
        animators.push((_dt, t) => {
          crystalGlowMat.emissiveIntensity = 0.45 + Math.sin(t * 2 + x) * 0.15;
        });
      } else {
        // Snow-dusted pine tree
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 7), new THREE.MeshStandardMaterial({ color: 0x57534e }));
        trunk.position.y = 0.65;
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.4, 7), deepIceMat);
        c1.position.y = 1.65;
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 7), snowTopMat);
        c2.position.y = 2.45;
        g.add(trunk, c1, c2);
      }
      kit.addDecor(g);
      kit.registerCylinder(`ice_prop_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.5, 2.6);
    },
    backdrop: () => {},
    walker: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'ice', 'chaser', id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'ice', 'diver', id, pos, axis, range),
  };
}

// ===========================================================================
// 3. DUNAS DORADAS ('desert')
// ===========================================================================
export function desertPack(kit: LevelKit, _textures: ProceduralTextures): ThemePack {
  const { animators } = kit;
  const sandTex = makeSandstoneTexture();
  const sandTopMat = new THREE.MeshStandardMaterial({ color: 0xf6c978, roughness: 0.85, metalness: 0.04 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.72, metalness: 0.1 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.22,
    metalness: 0.78,
    emissive: 0xb45309,
    emissiveIntensity: 0.25,
  });
  const tealJewelMat = new THREE.MeshStandardMaterial({
    color: 0x14b8a6,
    roughness: 0.2,
    metalness: 0.3,
    emissive: 0x0d9488,
    emissiveIntensity: 0.4,
  });

  const duneIsland: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [stoneMat, stoneMat, sandTopMat, stoneMat, stoneMat, stoneMat]
    );
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const tier = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h * 0.8, d * 0.82), stoneMat);
    tier.position.y = -h - h * 0.4;
    g.add(tier);
  };

  const sandstoneBlock: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.14, d + 0.1), goldMat);
    rim.position.y = -0.08;
    g.add(rim);
  };

  const oasisBridge: Builder = (g, w, d, h) => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    deck.position.y = -h / 2;
    deck.receiveShadow = true;
    g.add(deck);
    for (const sx of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, d), goldMat);
      curb.position.set((w * 0.5 - 0.08) * sx, 0.06, 0);
      g.add(curb);
    }
  };

  return {
    id: 'desert',
    name: THEME_NAMES.desert,
    weather: 'desert_sun',
    cpNames: ['Oasis del Alba', 'Arco de Arenisca', 'Patio del Escarabajo', 'Cámara Dorada', 'Obelisco Solar', 'Cima de la Esfinge'],
    summitName: 'Templo del Sol',
    big: duneIsland,
    small: [sandstoneBlock, oasisBridge, sandstoneBlock],
    deck: sandstoneBlock,
    mover: sandstoneBlock,
    bridge: oasisBridge,
    launchPad: sandstoneBlock,
    trampoline: () => createThemedTrampoline(0xb45309, 0xfbbf24, 0xd97706, 0x2dd4bf),
    updraftTint: 0xfbbf24,
    prop: (x, y, z, rnd) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      if (rnd < 0.52) {
        // Golden Egyptian obelisk with floating teal crystal
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 2.5, 4), stoneMat);
        shaft.position.y = 1.25;
        shaft.rotation.y = Math.PI / 4;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 4), goldMat);
        cap.position.y = 2.8;
        cap.rotation.y = Math.PI / 4;
        const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), tealJewelMat);
        jewel.position.y = 3.45;
        animators.push((_dt, t) => {
          jewel.rotation.y = t * 1.4;
          jewel.position.y = 3.45 + Math.sin(t * 2.5 + x) * 0.12;
        });
        g.add(shaft, cap, jewel);
      } else {
        // Stylized desert palm
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.55 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 2.6, 7), trunkMat);
        trunk.position.y = 1.3;
        trunk.rotation.z = 0.08;
        g.add(trunk);
        for (let k = 0; k < 5; k++) {
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 1.35), leafMat);
          const a = (k / 5) * Math.PI * 2;
          leaf.position.set(Math.sin(a) * 0.6 + 0.1, 2.55, Math.cos(a) * 0.6);
          leaf.rotation.y = a;
          leaf.rotation.x = 0.35;
          g.add(leaf);
        }
      }
      kit.addDecor(g);
      kit.registerCylinder(`desert_prop_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.48, 2.8);
    },
    backdrop: () => {},
    walker: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'desert', 'chaser', id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'desert', 'diver', id, pos, axis, range),
  };
}

// ===========================================================================
// 4. REINO DULCE ('candy')
// ===========================================================================
export function candyPack(kit: LevelKit, _textures: ProceduralTextures): ThemePack {
  const { animators } = kit;
  const waferTex = makeCandyWaferTexture();
  const frostingMat = new THREE.MeshStandardMaterial({ map: waferTex, roughness: 0.35, metalness: 0.05 });
  const chocoMat = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.45, metalness: 0.08 });
  const mintMat = new THREE.MeshStandardMaterial({ color: 0x6ee7b7, roughness: 0.25, metalness: 0.1 });
  const strawberryMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.28, metalness: 0.08 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff8f1, roughness: 0.4 });

  const cakeIsland: Builder = (g, w, d, h) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.72, d), chocoMat);
    base.position.y = -h * 0.64;
    base.castShadow = true;
    base.receiveShadow = true;
    const icing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h * 0.32, d + 0.2), frostingMat);
    icing.position.y = -h * 0.16;
    icing.receiveShadow = true;
    g.add(base, icing);
  };

  const waferPad: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frostingMat);
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const border = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.14, d + 0.12), creamMat);
    border.position.y = -0.08;
    g.add(border);
  };

  const candyBridge: Builder = (g, w, d, h) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mintMat);
    plank.position.y = -h / 2;
    plank.receiveShadow = true;
    g.add(plank);
    for (const sx of [-1, 1]) {
      const cane = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, d), strawberryMat);
      cane.position.set((w * 0.5 - 0.08) * sx, 0.07, 0);
      g.add(cane);
    }
  };

  return {
    id: 'candy',
    name: THEME_NAMES.candy,
    weather: 'candy_sky',
    cpNames: ['Plaza del Barquillo', 'Puente de Menta', 'Colina Glaseada', 'Jardín de Gomitas', 'Torre de Caramelo', 'Nube de Algodón'],
    summitName: 'Palacio del Azúcar',
    big: cakeIsland,
    small: [waferPad, candyBridge, cakeIsland],
    deck: waferPad,
    mover: waferPad,
    bridge: candyBridge,
    launchPad: waferPad,
    trampoline: () => createThemedTrampoline(0xf472b6, 0xfef08a, 0xf472b6, 0x6ee7b7),
    updraftTint: 0xf472b6,
    prop: (x, y, z, rnd) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      if (rnd < 0.55) {
        // Giant swirl lollipop
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), creamMat);
        stick.position.y = 1.1;
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.24, 18), strawberryMat);
        head.rotation.x = Math.PI / 2;
        head.position.y = 2.6;
        const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 6, 16), creamMat);
        swirl.position.set(0, 2.6, 0.12);
        animators.push((_dt, t) => {
          head.rotation.z = t * 0.8 + x;
        });
        g.add(stick, head, swirl);
      } else {
        // Mint & berry candy tree
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.5, 8), creamMat);
        stem.position.y = 0.75;
        const puff1 = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), strawberryMat);
        puff1.position.y = 1.9;
        const puff2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mintMat);
        puff2.position.set(0.35, 2.4, 0.15);
        g.add(stem, puff1, puff2);
      }
      kit.addDecor(g);
      kit.registerCylinder(`candy_prop_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.45, 2.6);
    },
    backdrop: () => {},
    walker: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'candy', 'chaser', id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'candy', 'diver', id, pos, axis, range),
  };
}
