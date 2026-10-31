/**
 * Theme pack: CASTILLO EMBRUJADO
 * Floating fragments of a haunted castle under a huge moon: stone courtyards, coffins,
 * stained glass, chandeliers that drift, red-carpet bridges, rune circles as launch pads,
 * a velvet drum as trampoline, candelabras and pumpkins… guarded by vampires,
 * werewolves and gargoyles.
 */
import * as THREE from 'three';
import type { BouncyMushroomModel } from './models';
import type { LevelKit } from './levelKit';
import { makeGlowTexture } from './levelKit';
import type { ProceduralTextures } from './textures';
import type { Builder, ThemePack } from './levelThemes';
import { spawnThemedFlyer, spawnThemedWalker } from './enemiesExtra';

export function castlePack(kit: LevelKit, textures: ProceduralTextures): ThemePack {
  const floorMat = new THREE.MeshStandardMaterial({ map: textures.stone, color: 0x9a8fb0, roughness: 0.85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4b4458, roughness: 0.9, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2435, roughness: 0.95, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6d6380, roughness: 0.8 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a72c, roughness: 0.35, metalness: 0.8 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f1d24, roughness: 0.5, metalness: 0.6 });
  const coffinMat = new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.7 });
  const velvetMat = new THREE.MeshStandardMaterial({ color: 0x7e1d3b, roughness: 0.9 });
  const carpetMat = new THREE.MeshStandardMaterial({ color: 0xa3122a, roughness: 0.95 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2f20, roughness: 0.75 });
  const glassMats = [0x7c3aed, 0xdb2777, 0x2563eb, 0xf59e0b].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.2, transparent: true, opacity: 0.8 })
  );
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const pumpkinMat = new THREE.MeshStandardMaterial({ color: 0xea7317, roughness: 0.6 });
  const glowTex = makeGlowTexture('rgba(255,190,90,0.9)');

  const shadowed = <T extends THREE.Mesh>(m: T) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const candle = (g: THREE.Object3D, x: number, y: number, z: number, s = 1) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.3 * s, 6), new THREE.MeshStandardMaterial({ color: 0xf5f0e1, roughness: 0.6 }));
    c.position.set(x, y + 0.15 * s, z);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.045 * s, 0.14 * s, 6), flameMat);
    f.position.set(x, y + 0.37 * s, z);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(x, y + 0.38 * s, z);
    glow.scale.setScalar(0.6 * s);
    g.add(c, f, glow);
  };

  /** Stone courtyard with a low rim, hanging from an upside-down tower */
  const courtyard: Builder = (g, w, d, h) => {
    const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wallMat, wallMat, floorMat, wallMat, wallMat, wallMat]));
    body.position.y = -h / 2;
    g.add(body);
    // Thin rim at floor level (decor, flush with the floor so it never trips you)
    for (const [bw, bd, x, z] of [
      [w + 0.3, 0.3, 0, d / 2],
      [w + 0.3, 0.3, 0, -d / 2],
      [0.3, d, w / 2, 0],
      [0.3, d, -w / 2, 0],
    ] as [number, number, number, number][]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.5, bd), trimMat);
      bar.position.set(x, -0.25, z);
      g.add(bar);
    }
    const m = Math.min(w, d);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(m * 0.42, m * 0.12, m * 0.8, 8), darkMat);
    under.position.y = -h - m * 0.4;
    g.add(under);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(m * 0.16, m * 0.4, 8), darkMat);
    cone.rotation.x = Math.PI;
    cone.position.y = -h - m * 0.8 - m * 0.2;
    g.add(cone);
  };

  const stoneBlock: Builder = (g, w, d, h) => {
    const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h + 0.6, d), [wallMat, wallMat, floorMat, wallMat, wallMat, wallMat]));
    b.position.y = -(h + 0.6) / 2;
    g.add(b);
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.min(w, d) * 0.45, 0), darkMat);
    chunk.scale.y = 0.6;
    chunk.position.y = -h - 0.8;
    g.add(chunk);
  };

  /** A closed coffin to stand on */
  const coffin: Builder = (g, w, d, h) => {
    const shape = new THREE.Shape();
    const hw = w / 2;
    const hd = d / 2;
    shape.moveTo(-hw * 0.6, -hd);
    shape.lineTo(hw * 0.6, -hd);
    shape.lineTo(hw, hd * 0.3);
    shape.lineTo(hw * 0.7, hd);
    shape.lineTo(-hw * 0.7, hd);
    shape.lineTo(-hw, hd * 0.3);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    const box = shadowed(new THREE.Mesh(geo, coffinMat));
    g.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, d * 0.55), goldMat);
    lid.position.set(0, 0.02, 0.05);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.04, 0.16), goldMat);
    bar.position.set(0, 0.02, d * 0.12);
    g.add(lid, bar);
  };

  /** Floating stained-glass panel in a gold frame */
  const stainedGlass: Builder = (g, w, d, h) => {
    const cols = 2;
    const rows = 2;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(w / cols - 0.06, h, d / rows - 0.06), glassMats[(i + j * 2) % glassMats.length]);
        pane.position.set(-w / 2 + (i + 0.5) * (w / cols), -h / 2, -d / 2 + (j + 0.5) * (d / rows));
        pane.receiveShadow = true;
        g.add(pane);
      }
    for (const [bw, bd, x, z] of [
      [w + 0.1, 0.1, 0, d / 2],
      [w + 0.1, 0.1, 0, -d / 2],
      [0.1, d, w / 2, 0],
      [0.1, d, -w / 2, 0],
      [0.08, d, 0, 0],
      [w, 0.08, 0, 0],
    ] as [number, number, number, number][]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, h + 0.04, bd), goldMat);
      bar.position.set(x, -h / 2, z);
      g.add(bar);
    }
  };

  /** Wooden balcony floor with gold edges */
  const balcony: Builder = (g, w, d, h) => {
    const n = Math.max(2, Math.round(d / 0.7));
    for (let i = 0; i < n; i++) {
      const plank = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d / n - 0.04), woodMat));
      plank.position.set(0, -h / 2, -d / 2 + (i + 0.5) * (d / n));
      g.add(plank);
    }
    for (const s of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.1, h + 0.05, d), goldMat);
      edge.position.set(s * w / 2, -h / 2, 0);
      g.add(edge);
    }
  };

  /** A drifting chandelier: gold ring with candles around a plate */
  const chandelier: Builder = (g, w, d, h) => {
    const r = Math.min(w, d) * 0.5;
    const plate = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 20), ironMat));
    plate.position.y = -h / 2;
    g.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 28), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -h / 2;
    g.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 5), goldMat);
      arm.position.set(Math.cos(a) * (r + 0.25), -h - 0.05, Math.sin(a) * (r + 0.25));
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = -a;
      g.add(arm);
      candle(g, Math.cos(a) * (r + 0.5), -h - 0.05, Math.sin(a) * (r + 0.5), 1.2);
    }
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 12, 4), ironMat);
    chain.position.y = 6;
    g.add(chain);
  };

  /** Stone bridge with a red carpet */
  const carpetBridge: Builder = (g, w, d, h) => {
    const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat));
    base.position.y = -h / 2;
    g.add(base);
    const alongZ = d >= w;
    const carpet = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? w * 0.6 : w, 0.03, alongZ ? d : d * 0.6), carpetMat);
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    g.add(carpet);
  };

  /** Round dais with a glowing rune circle (launch pads) */
  const runeDais: Builder = (g, w, d, h) => {
    courtyard(g, w, d, h);
    const r = Math.min(w, d) * 0.42;
    const circle = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 40), runeMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.03;
    g.add(circle);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rune = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 3), runeMat);
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(Math.cos(a) * r * 0.6, 0.03, Math.sin(a) * r * 0.6);
      g.add(rune);
    }
  };

  const velvetDrum = (): BouncyMushroomModel => {
    const group = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.55, 20), goldMat);
    stalk.position.y = 0.27;
    group.add(stalk);
    const capGeom = new THREE.SphereGeometry(1.3, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeom.scale(1, 0.5, 1);
    const cap = new THREE.Mesh(capGeom, velvetMat);
    cap.position.y = 0.55;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), goldMat);
      tassel.position.set(Math.cos(a) * 1.25, -0.1, Math.sin(a) * 1.25);
      cap.add(tassel);
    }
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

  const candelabra = (x: number, y: number, z: number, rnd: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const s = 1.4 + rnd * 0.6;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 1.8 * s, 6), ironMat);
    pole.position.y = 0.9 * s;
    pole.castShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.4 * s, 0.12, 8), ironMat);
    foot.position.y = 0.06;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.05, 0.05), goldMat);
    bar.position.y = 1.8 * s;
    g.add(pole, foot, bar);
    for (const cx of [-0.45, 0, 0.45]) candle(g, cx * s, 1.8 * s + (cx === 0 ? 0.12 : 0), 0, s * 0.9);
    kit.addDecor(g);
    kit.registerCylinder(`candelabra_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.3, 2.2 * s);
  };

  const pumpkin = (x: number, y: number, z: number, rnd: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const s = 0.8 + rnd * 0.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.45 * s, 12, 10), pumpkinMat);
      lobe.scale.set(0.7, 0.85, 1);
      lobe.position.set(Math.cos(a) * 0.22 * s, 0.4 * s, Math.sin(a) * 0.22 * s);
      lobe.rotation.y = -a;
      lobe.castShadow = true;
      g.add(lobe);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.25 * s, 6), new THREE.MeshStandardMaterial({ color: 0x3f6212 }));
    stem.position.y = 0.85 * s;
    g.add(stem);
    // Carved glowing face
    const faceMat = new THREE.MeshBasicMaterial({ color: 0xffd36b });
    for (const ex of [-0.15, 0.15]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.08 * s, 3), faceMat);
      eye.position.set(ex * s, 0.5 * s, 0.6 * s);
      g.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.18 * s, 12, 0, Math.PI), faceMat);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 0.32 * s, 0.6 * s);
    g.add(mouth);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    glow.position.y = 0.45 * s;
    glow.scale.setScalar(1.6 * s);
    g.add(glow);
    g.rotation.y = rnd * 1.2 - 0.6;
    kit.addDecor(g);
    kit.registerCylinder(`pumpkin_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.55 * s, 0.9 * s);
  };

  const tombstone = (x: number, y: number, z: number, rnd: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.25), trimMat);
    slab.position.y = 0.55;
    slab.castShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 12, 1, false, 0, Math.PI), trimMat);
    top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    top.position.y = 1.1;
    g.add(slab, top);
    g.rotation.set(0, rnd * 0.8 - 0.4, (rnd - 0.5) * 0.2);
    kit.addDecor(g);
    kit.registerCylinder(`tomb_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.5, 1.4);
  };

  return {
    id: 'castle',
    name: 'Castillo Embrujado',
    weather: 'castle_night',
    cpNames: ['Puente Levadizo', 'Patio de las Gárgolas', 'Biblioteca Prohibida', 'Salón de los Espejos', 'Cripta del Conde', 'Torre del Reloj'],
    summitName: 'Torre del Vampiro',
    big: courtyard,
    small: [stoneBlock, coffin, stainedGlass],
    deck: balcony,
    mover: chandelier,
    bridge: carpetBridge,
    launchPad: runeDais,
    trampoline: velvetDrum,
    updraftTint: 0xc084fc,
    prop: (x, y, z, rnd) => (rnd < 0.45 ? candelabra(x, y, z, rnd / 0.45) : rnd < 0.8 ? pumpkin(x, y, z, (rnd - 0.45) / 0.35) : tombstone(x, y, z, (rnd - 0.8) / 0.2)),
    backdrop: (zMax) => {
      // Moon
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(245,240,255,0.95)', 'rgba(200,180,255,0)'), transparent: true, depthWrite: false, fog: false }));
      moon.position.set(40, 75, zMax + 90);
      moon.scale.setScalar(70);
      kit.addDecor(moon);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(14, 40), new THREE.MeshBasicMaterial({ color: 0xf5f3ff, fog: false }));
      disc.position.set(40, 75, zMax + 91);
      disc.lookAt(0, 10, zMax / 2);
      kit.addDecor(disc);
      // Castle silhouettes: towers with pointed roofs and lit windows
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x3b1f4a, roughness: 0.8 });
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false });
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1;
        const g = new THREE.Group();
        const r = 4 + (i % 3) * 1.5;
        const hgt = 50 + ((i * 11) % 30);
        g.position.set(side * (50 + ((i * 13) % 30)), -30, -10 + (i / 12) * (zMax + 40));
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, hgt, 12), wallMat);
        tower.position.y = hgt / 2;
        g.add(tower);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, r * 3, 12), roofMat);
        roof.position.y = hgt + r * 1.5;
        g.add(roof);
        for (let k = 0; k < 5; k++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), winMat);
          const a = k * 1.3;
          win.position.set(Math.sin(a) * (r + 0.05), hgt * (0.5 + k * 0.09), Math.cos(a) * (r + 0.05));
          win.rotation.y = a;
          g.add(win);
        }
        kit.addDecor(g);
      }
      // Bats circling the sky
      const batMat = new THREE.MeshBasicMaterial({ color: 0x0f0a16, side: THREE.DoubleSide });
      const bats: { g: THREE.Group; wings: THREE.Mesh[]; c: THREE.Vector3; r: number; sp: number; ph: number }[] = [];
      for (let i = 0; i < 18; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), batMat));
        const wings: THREE.Mesh[] = [];
        for (const s of [-1, 1]) {
          const wg = new THREE.PlaneGeometry(0.8, 0.4);
          wg.translate(0.4 * s, 0, 0);
          const w = new THREE.Mesh(wg, batMat);
          w.rotation.x = -Math.PI / 2;
          g.add(w);
          wings.push(w);
        }
        kit.addDecor(g);
        bats.push({ g, wings, c: new THREE.Vector3((Math.random() - 0.5) * 50, 14 + Math.random() * 18, Math.random() * zMax), r: 6 + Math.random() * 12, sp: 0.3 + Math.random() * 0.4, ph: Math.random() * 10 });
      }
      kit.animators.push((_dt, time) => {
        for (const b of bats) {
          const a = time * b.sp + b.ph;
          b.g.position.set(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(a * 2) * 1.5, b.c.z + Math.sin(a) * b.r);
          b.g.rotation.y = -a;
          const flap = Math.sin(time * 14 + b.ph) * 0.7;
          b.wings[0].rotation.y = flap;
          b.wings[1].rotation.y = -flap;
        }
      });
    },
    walker: (em, id, pos, axis, range) => spawnThemedWalker(em, 'castle', id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => spawnThemedFlyer(em, 'castle', id, pos, axis, range),
  };
}
