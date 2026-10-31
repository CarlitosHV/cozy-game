/**
 * Theme pack: JARDÍN GIGANTE
 * You are a tiny being in a giant garden: islands of soil with towering grass blades,
 * leaves, daisies and bottle caps as platforms, rulers as bridges, flowerpots as launch
 * pads, a bouncy tulip as trampoline… and mischievous garden gnomes as enemies.
 */
import * as THREE from 'three';
import type { BouncyMushroomModel } from './models';
import type { LevelKit } from './levelKit';
import { makeGlowTexture } from './levelKit';
import type { Builder, ThemePack } from './levelThemes';
import { spawnThemedFlyer, spawnThemedWalker } from './enemiesExtra';

export function gardenPack(kit: LevelKit): ThemePack {
  const grassTop = new THREE.MeshStandardMaterial({ color: 0x6cc644, roughness: 0.75 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.95 });
  const soilDark = new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 1, flatShading: true });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x4caf3a, roughness: 0.6, side: THREE.DoubleSide });
  const bladeMat2 = new THREE.MeshStandardMaterial({ color: 0x7fd34e, roughness: 0.6, side: THREE.DoubleSide });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5fbf3f, roughness: 0.45, side: THREE.DoubleSide });
  const veinMat = new THREE.MeshStandardMaterial({ color: 0xb6e68a, roughness: 0.5 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f8f2f, roughness: 0.7 });
  const petalWhite = new THREE.MeshStandardMaterial({ color: 0xfffdf5, roughness: 0.5, side: THREE.DoubleSide });
  const petalPink = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.5, side: THREE.DoubleSide });
  const petalYellow = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.5, side: THREE.DoubleSide });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.8 });
  const capRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.6 });
  const capInner = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.3, metalness: 0.7 });
  const rulerMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
  const markMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd6a66a, roughness: 0.6 });
  const potMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.7 });
  const potRim = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.6 });
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9, flatShading: true });

  const shadowed = <T extends THREE.Mesh>(m: T) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  /** Grass blades growing out of the edges of a soil island (decor only) */
  const blades = (g: THREE.Group, w: number, d: number) => {
    const per = 2 * (w + d);
    const n = Math.min(70, Math.floor(per / 1.4));
    for (let i = 0; i < n; i++) {
      let t = (i / n) * per + Math.sin(i * 12.9898) * 0.4;
      let x: number;
      let z: number;
      let ox = 0;
      let oz = 0;
      if (t < w) [x, z, oz] = [-w / 2 + t, -d / 2, -1];
      else if ((t -= w) < d) [x, z, ox] = [w / 2, -d / 2 + t, 1];
      else if ((t -= d) < w) [x, z, oz] = [w / 2 - t, d / 2, 1];
      else [x, z, ox] = [-w / 2, d / 2 - (t - w), -1];
      const hgt = 1.0 + ((i * 7) % 5) * 0.35;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.22, hgt, 3), i % 3 ? bladeMat : bladeMat2);
      blade.scale.z = 0.25;
      blade.position.set(x + ox * 0.15, hgt / 2 - 0.1, z + oz * 0.15);
      blade.rotation.set(oz * 0.55, (i * 1.7) % Math.PI, -ox * 0.55);
      blade.castShadow = true;
      g.add(blade);
    }
  };

  const soilIsland: Builder = (g, w, d, h) => {
    const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [soilMat, soilMat, grassTop, soilMat, soilMat, soilMat]));
    body.position.y = -h / 2;
    g.add(body);
    const clod = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.min(w, d) * 0.5, 0), soilDark);
    clod.scale.set(1.05 * (w / Math.min(w, d)), 0.6, 1.05 * (d / Math.min(w, d)));
    clod.position.y = -h - Math.min(w, d) * 0.18;
    g.add(clod);
    // Dangling roots
    for (let i = 0; i < 6; i++) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 2.4, 5), soilDark);
      root.position.set(Math.sin(i * 2.1) * w * 0.3, -h - Math.min(w, d) * 0.35 - 0.8, Math.cos(i * 2.1) * d * 0.3);
      root.rotation.z = Math.sin(i) * 0.4;
      g.add(root);
    }
    if (w * d < 1300) blades(g, w, d);
  };

  /** A giant leaf seen from above: green ellipse with a pale midrib, on a long stem */
  const leaf: Builder = (g, w, d, h) => {
    const r = Math.max(w, d) * 0.6;
    const blade = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), leafMat));
    blade.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    blade.position.y = -h / 2;
    g.add(blade);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, d * 1.1), veinMat);
    rib.position.y = 0.01;
    g.add(rib);
    for (const s of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        const vein = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.03, 0.06), veinMat);
        vein.position.set(s * w * 0.2, 0.01, i * d * 0.25);
        vein.rotation.y = s * 0.5;
        g.add(vein);
      }
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 14, 6), stemMat);
    stem.position.set(0, -h - 7, -d * 0.3);
    stem.rotation.x = 0.15;
    g.add(stem);
  };

  /** A daisy you stand on: yellow center plate with white petals */
  const daisy = (petal: THREE.Material): Builder => (g, w, d, h) => {
    const r = Math.min(w, d) * 0.5;
    const center = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.6, h, 20), centerMat));
    center.position.y = -h / 2;
    g.add(center);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.38, 10, 6), petal);
      p.scale.set(1, 0.18, 0.5);
      p.position.set(Math.cos(a) * r * 0.95, -0.12, Math.sin(a) * r * 0.95);
      p.rotation.y = -a;
      p.castShadow = true;
      g.add(p);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 16, 6), stemMat);
    stem.position.y = -h - 8;
    g.add(stem);
  };

  /** Metal bottle cap */
  const bottleCap: Builder = (g, w, d, h) => {
    const r = Math.min(w, d) * 0.55;
    const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 21), capRed));
    cap.position.y = -h / 2;
    g.add(cap);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.04, 21), capInner);
    inner.position.y = 0.01;
    g.add(inner);
  };

  /** A wooden ruler (bridges) */
  const ruler: Builder = (g, w, d, h) => {
    const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rulerMat));
    body.position.y = -h / 2;
    g.add(body);
    const along = d >= w ? 'z' : 'x';
    const len = Math.max(w, d);
    for (let i = 0; i < len / 0.5; i++) {
      const big = i % 4 === 0;
      const mark = new THREE.Mesh(new THREE.BoxGeometry(along === 'z' ? (big ? w * 0.45 : w * 0.22) : 0.05, 0.02, along === 'z' ? 0.05 : big ? d * 0.45 : d * 0.22), markMat);
      const off = -len / 2 + 0.25 + i * 0.5;
      mark.position.set(along === 'z' ? -w / 2 + (big ? w * 0.22 : w * 0.11) : off, 0.005, along === 'z' ? off : -d / 2 + (big ? d * 0.22 : d * 0.11));
      g.add(mark);
    }
  };

  /** Popsicle-stick deck */
  const sticks: Builder = (g, w, d, h) => {
    const n = Math.max(2, Math.round(w / 1.1));
    for (let i = 0; i < n; i++) {
      const s = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(w / n / 2 - 0.03, d - w / n, 4, 8), woodMat));
      s.rotation.x = Math.PI / 2;
      s.scale.z = (h / (w / n)) * 0.9;
      s.position.set(-w / 2 + (i + 0.5) * (w / n), -h / 2, 0);
      g.add(s);
    }
  };

  /** Terracotta flowerpot full of soil (launch pads) */
  const flowerpot: Builder = (g, w, d, h) => {
    const r = Math.min(w, d) * 0.55;
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.1, 24), soilMat);
    soil.position.y = -0.05;
    soil.receiveShadow = true;
    g.add(soil);
    const rim = shadowed(new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 8, 28), potRim));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.1;
    g.add(rim);
    const pot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, h + 3, 24, 1, true), potMat));
    pot.position.y = -(h + 3) / 2;
    g.add(pot);
  };

  const tulip = (): BouncyMushroomModel => {
    const group = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.55, 10), stemMat);
    stalk.position.y = 0.27;
    group.add(stalk);
    for (const s of [-1, 1]) {
      const lf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6), leafMat);
      lf.scale.set(0.35, 0.12, 1);
      lf.position.set(s * 0.45, 0.2, 0);
      lf.rotation.z = s * 0.5;
      group.add(lf);
    }
    const capGeom = new THREE.SphereGeometry(1.3, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeom.scale(1, 0.62, 1);
    const cap = new THREE.Mesh(capGeom, new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 }));
    cap.position.y = 0.55;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 6), petalPink);
      petal.scale.set(0.6, 0.25, 1);
      petal.position.set(Math.cos(a) * 1.1, 0.1, Math.sin(a) * 1.1);
      petal.rotation.y = -a + Math.PI / 2;
      cap.add(petal);
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

  /** Giant flower on a stem (decor + collider) */
  const flower = (x: number, y: number, z: number, rnd: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const hgt = 3.2 + rnd * 2.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, hgt, 8), stemMat);
    stem.position.y = hgt / 2;
    stem.castShadow = true;
    g.add(stem);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 6), leafMat);
    lf.scale.set(0.35, 0.1, 1);
    lf.position.set(0.35, hgt * 0.35, 0);
    lf.rotation.z = 0.6;
    g.add(lf);
    const head = new THREE.Group();
    head.position.y = hgt;
    head.rotation.x = 0.5;
    const petal = rnd < 0.33 ? petalWhite : rnd < 0.66 ? petalPink : petalYellow;
    const n = rnd < 0.66 ? 10 : 16;
    const r = rnd < 0.66 ? 0.9 : 1.3;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 14, 10), rnd < 0.66 ? centerMat : new THREE.MeshStandardMaterial({ color: 0x5b3a1a, roughness: 0.9 })));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 8, 6), petal);
      p.scale.set(0.45, 0.15, 1);
      p.position.set(Math.cos(a) * r * 0.85, 0, Math.sin(a) * r * 0.85);
      p.rotation.y = -a + Math.PI / 2;
      head.add(p);
    }
    head.children.forEach((c) => (c.castShadow = true));
    g.add(head);
    kit.addDecor(g);
    kit.registerCylinder(`flower_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.3, hgt);
  };

  const pebble = (x: number, y: number, z: number, rnd: number) => {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + rnd * 0.4, 0), pebbleMat);
    p.scale.set(1.2, 0.7, 1);
    p.position.set(x, y + 0.45, z);
    p.rotation.y = rnd * 6;
    p.castShadow = true;
    kit.addDecor(p);
    kit.registerCylinder(`pebble_${x.toFixed(1)}_${z.toFixed(1)}`, x, y, z, 0.95, 1.1);
  };

  return {
    id: 'garden',
    name: 'Jardín Gigante',
    weather: 'garden_day',
    cpNames: ['Maceta del Inicio', 'Bosque de Tréboles', 'Charco del Rocío', 'Jardín de Margaritas', 'Sendero de Hormigas', 'Regadera Vieja'],
    summitName: 'Girasol Gigante',
    big: soilIsland,
    small: [leaf, daisy(petalWhite), bottleCap, daisy(petalYellow)],
    deck: sticks,
    mover: leaf,
    bridge: ruler,
    launchPad: flowerpot,
    trampoline: tulip,
    updraftTint: 0xfef3c7,
    prop: (x, y, z, rnd) => (rnd < 0.8 ? flower(x, y, z, rnd / 0.8) : pebble(x, y, z, (rnd - 0.8) / 0.2)),
    backdrop: (zMax) => {
      // Towering grass blades and sunflowers: you are tiny!
      for (let i = 0; i < 26; i++) {
        const side = i % 2 ? 1 : -1;
        const hgt = 35 + ((i * 13) % 30);
        const blade = new THREE.Mesh(new THREE.ConeGeometry(1.6, hgt, 3), i % 3 ? bladeMat : bladeMat2);
        blade.scale.z = 0.25;
        blade.position.set(side * (40 + ((i * 17) % 35)), hgt / 2 - 25, -10 + (i / 26) * (zMax + 20));
        blade.rotation.set(0, i, side * 0.12);
        kit.addDecor(blade);
      }
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        const g = new THREE.Group();
        const hgt = 60 + i * 6;
        g.position.set(side * (55 + i * 6), -25, 10 + (i / 6) * zMax);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, hgt, 10), stemMat);
        stem.position.y = hgt / 2;
        g.add(stem);
        const head = new THREE.Group();
        head.position.y = hgt;
        head.rotation.x = 0.6;
        head.rotation.y = side > 0 ? -0.9 : 0.9;
        head.add(new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.2, 28), new THREE.MeshStandardMaterial({ color: 0x5b3a1a, roughness: 0.9 })));
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * Math.PI * 2;
          const p = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), petalYellow);
          p.scale.set(0.5, 0.15, 1.3);
          p.position.set(Math.cos(a) * 7, 0, Math.sin(a) * 7);
          p.rotation.y = -a + Math.PI / 2;
          head.add(p);
        }
        head.rotation.order = 'YXZ';
        g.add(head);
        kit.addDecor(g);
      }
      // A huge wooden fence far away
      const fenceMat = new THREE.MeshStandardMaterial({ color: 0xc8a27a, roughness: 0.9 });
      for (let i = 0; i < 14; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(9, 90, 2), fenceMat);
        plank.position.set(-60 + i * 9.6, 15, zMax + 70);
        kit.addDecor(plank);
      }
      // Drifting dandelion seeds and pollen
      const seedTex = makeGlowTexture('rgba(255,255,240,0.95)');
      const seeds: { s: THREE.Sprite; base: THREE.Vector3; ph: number }[] = [];
      for (let i = 0; i < 45; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: seedTex, color: i % 4 === 0 ? 0xfde68a : 0xffffff, transparent: true, depthWrite: false }));
        const base = new THREE.Vector3((Math.random() - 0.5) * 60, Math.random() * 20, -10 + Math.random() * zMax);
        s.position.copy(base);
        s.scale.setScalar(0.25 + Math.random() * 0.25);
        kit.addDecor(s);
        seeds.push({ s, base, ph: Math.random() * 10 });
      }
      kit.animators.push((_dt, time) => {
        for (const sd of seeds) {
          sd.s.position.set(sd.base.x + Math.sin(time * 0.3 + sd.ph) * 3, sd.base.y + Math.sin(time * 0.5 + sd.ph * 2) * 1.5, sd.base.z + ((time * 0.8 + sd.ph * 7) % 30) - 15);
        }
      });
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(255,250,220,0.95)'), transparent: true, depthWrite: false, fog: false }));
      sun.position.set(-50, 85, zMax + 50);
      sun.scale.setScalar(45);
      kit.addDecor(sun);
    },
    walker: (em, id, pos, axis, range) => spawnThemedWalker(em, 'garden', id, pos, axis, range),
    flyer: (em, id, pos, axis, range) => spawnThemedFlyer(em, 'garden', id, pos, axis, range),
  };
}
