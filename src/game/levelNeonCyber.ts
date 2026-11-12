/**
 * Theme packs for "Ciudad Neón" ('neon') and "Cyberpunk" ('cyberpunk').
 * Procedural canvas textures, composite multi-part platforms, props, backdrops,
 * trampolines, and themed enemy spawners — zero external asset dependencies.
 */
import * as THREE from 'three';
import { BouncyMushroomModel } from './models';
import { LevelKit } from './levelKit';
import { Builder, ThemePack, THEME_NAMES } from './levelThemes';
import { ProceduralTextures } from './textures';
import { spawnExtraEnemy } from './enemiesExtra';

function makeNeonGridTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0d0620';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle circuit floor gradient
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 160);
  grad.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
  grad.addColorStop(1, 'rgba(13, 6, 32, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Neon cyan inner grid
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.48)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Hot magenta outer accent lines & corner nodes
  ctx.strokeStyle = 'rgba(232, 121, 249, 0.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);

  ctx.fillStyle = '#67e8f9';
  for (let x = 32; x < 256; x += 64) {
    for (let y = 32; y < 256; y += 64) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCyberPlateTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 256);

  // Brushed gunmetal steel plates
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Diamond tread dots
  ctx.fillStyle = '#334155';
  for (let x = 16; x < 256; x += 32) {
    for (let y = 16; y < 256; y += 32) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  // Hazard yellow-black border stripe
  ctx.save();
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 256, 12);
  ctx.fillRect(0, 244, 256, 12);
  ctx.fillStyle = '#09090b';
  for (let x = -16; x < 272; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 12, 0);
    ctx.lineTo(x + 4, 12);
    ctx.lineTo(x - 8, 12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, 244);
    ctx.lineTo(x + 12, 244);
    ctx.lineTo(x + 4, 256);
    ctx.lineTo(x - 8, 256);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Glowing cyan circuit traces
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, 64);
  ctx.lineTo(128, 64);
  ctx.lineTo(152, 88);
  ctx.lineTo(208, 88);
  ctx.moveTo(48, 192);
  ctx.lineTo(104, 192);
  ctx.lineTo(128, 168);
  ctx.lineTo(208, 168);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeHoloBillboardTexture(accent1: string, accent2: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = accent1;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 116);

  // Scanlines
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 10; y < 118; y += 6) ctx.fillRect(10, y, 236, 2);

  // Stylized cyberbars / signal
  ctx.fillStyle = accent2;
  for (let i = 0; i < 6; i++) {
    const bh = 22 + ((i * 19) % 52);
    ctx.fillRect(24 + i * 22, 92 - bh, 14, bh);
  }
  ctx.fillStyle = accent1;
  ctx.fillRect(166, 28, 66, 14);
  ctx.fillRect(166, 52, 46, 10);
  ctx.fillRect(166, 72, 58, 10);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ===========================================================================
// CIUDAD NEÓN ('neon')
// ===========================================================================
export function neonPack(kit: LevelKit, _textures: ProceduralTextures): ThemePack {
  const { animators } = kit;
  const gridTex = makeNeonGridTexture();

  const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x160c2e, roughness: 0.35, metalness: 0.65 });
  const neonDeckMat = new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.25, metalness: 0.45, emissive: 0x1e1b4b, emissiveIntensity: 0.4 });
  const holoMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    roughness: 0.12,
    metalness: 0.2,
    transparent: true,
    opacity: 0.78,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.55,
  });
  const cyanNeon = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const pinkNeon = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
  const purpleNeon = new THREE.MeshBasicMaterial({ color: 0xe879f9 });

  const addEdgeTrim = (g: THREE.Group, w: number, d: number, matA: THREE.Material, matB: THREE.Material) => {
    const strips: [number, number, number, number][] = [
      [w + 0.08, 0.08, 0, d / 2],
      [w + 0.08, 0.08, 0, -d / 2],
      [0.08, d, w / 2, 0],
      [0.08, d, -w / 2, 0],
    ];
    strips.forEach(([sw, sd, x, z], i) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.08, sd), i % 2 === 0 ? matA : matB);
      s.position.set(x, -0.04, z);
      g.add(s);
    });
  };

  const big: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [obsidianMat, obsidianMat, neonDeckMat, obsidianMat, obsidianMat, obsidianMat]
    );
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    addEdgeTrim(g, w, d, cyanNeon, pinkNeon);

    // Ventral glowing ring & thruster cone
    const r = Math.min(w, d) * 0.34;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 6, 24), pinkNeon);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -h - 0.12;
    g.add(ring);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r * 0.35, h * 0.85, 8), obsidianMat);
    base.position.y = -h - h * 0.42;
    g.add(base);
  };

  const neonSlab: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [obsidianMat, obsidianMat, neonDeckMat, obsidianMat, obsidianMat, obsidianMat]
    );
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    addEdgeTrim(g, w, d, cyanNeon, purpleNeon);
  };

  const holoPad: Builder = (g, w, d, h) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), holoMat);
    slab.position.y = -h / 2;
    slab.receiveShadow = true;
    g.add(slab);
    addEdgeTrim(g, w, d, pinkNeon, cyanNeon);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.35, 1.1, 4), obsidianMat);
    fin.rotation.x = Math.PI;
    fin.position.y = -h - 0.55;
    g.add(fin);
  };

  const bridge: Builder = (g, w, d, h) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonDeckMat);
    slab.position.y = -h / 2;
    slab.receiveShadow = true;
    g.add(slab);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, d), side > 0 ? cyanNeon : pinkNeon);
      rail.position.set(side * (w / 2 - 0.04), 0.05, 0);
      g.add(rail);
    }
  };

  const launchPad: Builder = (g, w, d, h) => {
    big(g, w, d, h);
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.min(w, d) * 0.24, Math.min(w, d) * 0.36, 24), cyanNeon);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);
  };

  const createNeonTrampoline = (): BouncyMushroomModel => {
    const group = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.55, 16), obsidianMat);
    stalk.position.y = 0.27;
    group.add(stalk);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 8, 24), pinkNeon);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55;
    group.add(ring);

    const capGeom = new THREE.CylinderGeometry(1.25, 1.05, 0.42, 24);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.3,
    });
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.position.y = 0.85;
    cap.castShadow = true;
    group.add(cap);

    let tb = -1;
    let amp = 0.3;
    return {
      group,
      cap,
      stalk,
      triggerBounce: (superBounce = false) => {
        tb = 0;
        amp = superBounce ? 0.45 : 0.3;
      },
      update: (dt: number) => {
        cap.rotation.y += dt * 1.2;
        if (tb >= 0) {
          tb += dt;
          const p = tb / 0.85;
          if (p >= 1) {
            tb = -1;
            cap.scale.set(1, 1, 1);
          } else {
            const sq = 1 - Math.sin(p * Math.PI * 3) * Math.exp(-p * 4) * amp;
            cap.scale.set(1 + (1 - sq) * 0.4, sq, 1 + (1 - sq) * 0.4);
          }
        }
      },
    };
  };

  return {
    id: 'neon',
    name: THEME_NAMES.neon,
    weather: 'neon_night',
    cpNames: ['Bulevar Synth', 'Autopista Láser', 'Plaza Holograma', 'Paso de Neón', 'Distrito Cian', 'Mirador Retrowave'],
    summitName: 'Torre Prisma Neón',
    big,
    small: [neonSlab, holoPad, neonSlab],
    deck: holoPad,
    mover: holoPad,
    bridge,
    launchPad,
    trampoline: createNeonTrampoline,
    updraftTint: 0xe879f9,
    prop: (x, y, z, rnd) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      if (rnd < 0.55) {
        // Composite Neon Palm Tree (segmented trunk + glowing rings + radiating fronds)
        const segs = 5;
        for (let i = 0; i < segs; i++) {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.14 - i * 0.015, 0.17 - i * 0.015, 0.72, 8), obsidianMat);
          seg.position.set(Math.sin(i * 0.25) * 0.18, 0.36 + i * 0.68, 0);
          seg.rotation.z = -i * 0.06;
          g.add(seg);
          if (i % 2 === 1) {
            const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 12), pinkNeon);
            band.rotation.x = Math.PI / 2;
            band.position.set(seg.position.x, seg.position.y + 0.34, 0);
            g.add(band);
          }
        }
        const crown = new THREE.Group();
        crown.position.set(Math.sin(4 * 0.25) * 0.18, 3.55, 0);
        for (let f = 0; f < 6; f++) {
          const a = (f / 6) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 1.35), f % 2 === 0 ? cyanNeon : purpleNeon);
          frond.position.set(Math.cos(a) * 0.65, -0.08, Math.sin(a) * 0.65);
          frond.rotation.y = -a + Math.PI / 2;
          frond.rotation.x = 0.25;
          crown.add(frond);
        }
        g.add(crown);
      } else {
        // Holographic Synth Pylon (base + glowing crystal + spinning halo)
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.6, 6), obsidianMat);
        base.position.y = 0.3;
        const spire = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), cyanNeon);
        spire.scale.y = 2.6;
        spire.position.y = 1.65;
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 20), pinkNeon);
        halo.position.y = 1.7;
        g.add(base, spire, halo);
        animators.push((dt) => {
          spire.rotation.y += dt * 1.4;
          halo.rotation.x += dt * 1.1;
          halo.rotation.y += dt * 0.8;
        });
      }
      kit.addDecor(g);
      kit.registerCylinder(`neon_prop_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.45, 3.6);
    },
    backdrop: (zMax) => {
      // Glowing synth buildings & highway arches framing the horizon
      const bDark = new THREE.MeshStandardMaterial({ color: 0x110824, roughness: 0.4, metalness: 0.6, fog: false });
      for (let i = 0; i < 12; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const h = 24 + (i % 4) * 12;
        const w = 7 + (i % 3) * 3;
        const g = new THREE.Group();
        g.position.set(side * (34 + (i % 3) * 14), -8, -15 + (i / 12) * (zMax + 35));
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), bDark);
        tower.position.y = h / 2;
        g.add(tower);
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.2, 0.45, w + 0.2),
          i % 3 === 0 ? cyanNeon : pinkNeon
        );
        strip.position.y = h - 1.5;
        g.add(strip);
        const vert = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, h - 2, 0.35),
          i % 2 === 0 ? purpleNeon : cyanNeon
        );
        vert.position.set(-side * (w / 2 + 0.1), h / 2, 0);
        g.add(vert);
        kit.addDecor(g);
      }
    },
    walker: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'neon', 'chaser', id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'neon', 'diver', id, pos, axis, range),
  };
}

// ===========================================================================
// CYBERPUNK ('cyberpunk')
// ===========================================================================
export function cyberpunkPack(kit: LevelKit, _textures: ProceduralTextures): ThemePack {
  const { animators } = kit;
  const plateTex = makeCyberPlateTexture();
  const holoTex1 = makeHoloBillboardTexture('#22d3ee', '#facc15');
  const holoTex2 = makeHoloBillboardTexture('#f43f5e', '#22d3ee');

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.78 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.72 });
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.35, metalness: 0.65 });
  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.2,
    metalness: 0.5,
    transparent: true,
    opacity: 0.82,
    emissive: 0x0369a1,
    emissiveIntensity: 0.5,
  });
  const amberNeon = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const cyanNeon = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const crimsonNeon = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

  const addHazardFrame = (g: THREE.Group, w: number, d: number, matA: THREE.Material, matB: THREE.Material) => {
    const edges: [number, number, number, number][] = [
      [w + 0.1, 0.1, 0, d / 2],
      [w + 0.1, 0.1, 0, -d / 2],
      [0.1, d, w / 2, 0],
      [0.1, d, -w / 2, 0],
    ];
    edges.forEach(([sw, sd, x, z], i) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.1, sd), i % 2 === 0 ? matA : matB);
      s.position.set(x, -0.05, z);
      g.add(s);
    });
  };

  const big: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [steelMat, steelMat, plateMat, darkMetal, steelMat, steelMat]
    );
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    addHazardFrame(g, w, d, amberNeon, cyanNeon);

    // Industrial under-chassis ribs & amber turbines
    const rib = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h * 0.45, d * 0.82), darkMetal);
    rib.position.y = -h - h * 0.22;
    g.add(rib);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.18, Math.min(w, d) * 0.1, 0.9, 10), amberNeon);
    jet.position.y = -h - h * 0.45 - 0.35;
    g.add(jet);
  };

  const steelBlock: Builder = (g, w, d, h) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [steelMat, steelMat, plateMat, darkMetal, steelMat, steelMat]
    );
    body.position.y = -h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    addHazardFrame(g, w, d, cyanNeon, crimsonNeon);
  };

  const gratePad: Builder = (g, w, d, h) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), grateMat);
    slab.position.y = -h / 2;
    slab.receiveShadow = true;
    g.add(slab);
    addHazardFrame(g, w, d, amberNeon, cyanNeon);
  };

  const bridge: Builder = (g, w, d, h) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plateMat);
    slab.position.y = -h / 2;
    slab.receiveShadow = true;
    g.add(slab);
    for (const side of [-1, 1]) {
      const girder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, d), darkMetal);
      girder.position.set(side * (w / 2 - 0.05), 0.08, 0);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, d * 0.92), amberNeon);
      strip.position.set(side * (w / 2 - 0.05), 0.22, 0);
      g.add(girder, strip);
    }
  };

  const createMagTrampoline = (): BouncyMushroomModel => {
    const group = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.55, 12), darkMetal);
    stalk.position.y = 0.27;
    group.add(stalk);

    const coil = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.09, 8, 20), amberNeon);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.58;
    group.add(coil);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.15, 0.38, 8),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.7,
        roughness: 0.2,
        metalness: 0.7,
      })
    );
    cap.position.y = 0.85;
    cap.castShadow = true;
    group.add(cap);

    let tb = -1;
    let amp = 0.28;
    return {
      group,
      cap,
      stalk,
      triggerBounce: (superBounce = false) => {
        tb = 0;
        amp = superBounce ? 0.44 : 0.28;
      },
      update: (dt: number) => {
        cap.rotation.y -= dt * 0.9;
        if (tb >= 0) {
          tb += dt;
          const p = tb / 0.85;
          if (p >= 1) {
            tb = -1;
            cap.scale.set(1, 1, 1);
          } else {
            const sq = 1 - Math.sin(p * Math.PI * 3) * Math.exp(-p * 4) * amp;
            cap.scale.set(1 + (1 - sq) * 0.35, sq, 1 + (1 - sq) * 0.35);
          }
        }
      },
    };
  };

  return {
    id: 'cyberpunk',
    name: THEME_NAMES.cyberpunk,
    weather: 'cyber_storm',
    cpNames: ['Sector Industrial', 'Paso Subterráneo', 'Puente Mag-Lev', 'Distrito Cromo', 'Plaza Holográfica', 'Aguja Orbital'],
    summitName: 'Azotea Corporativa',
    big,
    small: [steelBlock, gratePad, steelBlock],
    deck: gratePad,
    mover: gratePad,
    bridge,
    launchPad: big,
    trampoline: createMagTrampoline,
    updraftTint: 0x22d3ee,
    prop: (x, y, z, rnd) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      if (rnd < 0.55) {
        // Holo-Billboard Tower
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 3.2, 8), darkMetal);
        mast.position.y = 1.6;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.25, 0.16), steelMat);
        frame.position.y = 2.7;
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(2.1, 1.05),
          new THREE.MeshBasicMaterial({ map: rnd < 0.28 ? holoTex1 : holoTex2, side: THREE.DoubleSide })
        );
        screen.position.set(0, 2.7, 0.09);
        const screenBack = screen.clone();
        screenBack.position.z = -0.09;
        screenBack.rotation.y = Math.PI;
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), crimsonNeon);
        beacon.position.y = 3.5;
        g.add(mast, frame, screen, screenBack, beacon);
        animators.push((_dt, time) => {
          beacon.visible = Math.floor(time * 2.5 + x) % 2 === 0;
        });
      } else {
        // Industrial Vent Stack
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), darkMetal);
        base.position.y = 0.35;
        const pipeL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.4, 8), steelMat);
        pipeL.position.set(-0.24, 1.5, 0);
        const pipeR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.9, 8), steelMat);
        pipeR.position.set(0.24, 1.25, 0);
        const cap = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.04, 6, 12), amberNeon);
        cap.rotation.x = Math.PI / 2;
        cap.position.set(-0.24, 2.7, 0);
        g.add(base, pipeL, pipeR, cap);
      }
      kit.addDecor(g);
      kit.registerCylinder(`cyber_prop_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.55, 3.4);
    },
    backdrop: (zMax) => {
      for (let i = 0; i < 12; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const h = 30 + (i % 4) * 14;
        const w = 9 + (i % 3) * 3;
        const g = new THREE.Group();
        g.position.set(side * (36 + (i % 3) * 15), -10, -10 + (i / 12) * (zMax + 40));
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), darkMetal);
        tower.position.y = h / 2;
        g.add(tower);
        const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.7, w + 0.3), i % 2 ? amberNeon : cyanNeon);
        band.position.y = h * 0.72;
        const ad = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.75, w * 0.38),
          new THREE.MeshBasicMaterial({ map: i % 2 ? holoTex1 : holoTex2, side: THREE.DoubleSide })
        );
        ad.position.set(-side * (w / 2 + 0.2), h * 0.55, 0);
        ad.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(band, ad);
        kit.addDecor(g);
      }
    },
    walker: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'cyberpunk', 'chaser', id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => spawnExtraEnemy(em, 'cyberpunk', 'diver', id, pos, axis, range),
  };
}
