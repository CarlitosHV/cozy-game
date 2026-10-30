/**
 * LEVEL 3 — "Pantano Sombrío" (Chispa's level) — dark fantasy swamp
 * Misty shore with dead trees → lily pads & rotten log → crumbling plank & drifting raft →
 * toxic mushroom bounce → witch ruins (CP2) → stepping stones → spirit updraft → tower balcony (CP3) →
 * spiral ledges around the Witch Tower → spirit lift → Firefly Sanctuary on the tower top.
 * Enemies: mud creatures and hooded wraiths with icy gusts.
 */
import * as THREE from 'three';
import { EnemyManager } from './enemies';
import { createBouncyMushroom } from './models';
import { ProceduralTextures } from './textures';
import { WorldBuildResult } from './levels';
import { createLevelKit, makeGlowTexture } from './levelKit';

export function buildSwampWorld(root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const kit = createLevelKit(root, textures);
  const { addPlatform, animators } = kit;

  // ---------------- Materials ----------------
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x34452b, roughness: 0.95 });
  const mudMat = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 1.0 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x55594f, roughness: 0.92, flatShading: true });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x393d36, roughness: 0.95, flatShading: true });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2d20, roughness: 0.9 });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1.0, flatShading: true });
  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x2f5a2c, roughness: 0.6, side: THREE.DoubleSide });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1b3329, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.9 });
  const runeMat = new THREE.MeshBasicMaterial({ color: 0x86efac });
  const lanternGlow = new THREE.MeshBasicMaterial({ color: 0xd9f99d });
  const glowCyan = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 1.2, roughness: 0.4 });
  const glowPurple = new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0x7e22ce, emissiveIntensity: 1.1, roughness: 0.4 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xd6d3c4, roughness: 0.8 });

  // ---------------- Platform styles ----------------
  const mossIsland = (g: THREE.Group, w: number, d: number, h: number) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mudMat, mudMat, mossMat, mudMat, mudMat, mudMat]);
    body.position.y = -h / 2;
    body.receiveShadow = true;
    body.castShadow = true;
    g.add(body);
    // Roots dangling from the sides
    for (let i = 0; i < Math.round((w + d) / 3); i++) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 1.4 + (i % 3) * 0.5, 5), barkMat);
      const side = i % 4;
      const t = ((i * 0.37) % 1) - 0.5;
      root.position.set(side === 0 ? w / 2 : side === 1 ? -w / 2 : t * w, -h - 0.4, side === 2 ? d / 2 : side === 3 ? -d / 2 : t * d);
      root.rotation.z = (i % 2 ? 1 : -1) * 0.25;
      g.add(root);
    }
  };

  const stoneBlock = (g: THREE.Group, w: number, d: number, h: number) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [stoneMat, stoneMat, mossMat, stoneDark, stoneMat, stoneMat]);
    body.position.y = -h / 2;
    body.receiveShadow = true;
    body.castShadow = true;
    g.add(body);
    // Cracked chunks under the block
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.min(w, d) * 0.25, 0), stoneDark);
      c.position.set((i - 1) * w * 0.3, -h - 0.3 - (i % 2) * 0.3, (i % 2 ? 1 : -1) * d * 0.2);
      g.add(c);
    }
  };

  const lilyPad = (g: THREE.Group, w: number, d: number, h: number) => {
    const r = Math.max(w, d) * 0.6;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, h, 24, 1, false, 0.35, Math.PI * 2 - 0.35), lilyMat);
    pad.position.y = -h / 2;
    pad.receiveShadow = true;
    g.add(pad);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 6, 6), lilyMat);
    stem.position.y = -3.2;
    g.add(stem);
    const flower = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xe9d5ff, emissive: 0x6b21a8, emissiveIntensity: 0.5 }));
    flower.position.set(r * 0.5, 0.15, -r * 0.3);
    g.add(flower);
  };

  const logBridge = (g: THREE.Group, w: number, d: number, h: number) => {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.48, d, 14), barkMat);
    log.rotation.x = Math.PI / 2;
    log.position.y = -w * 0.5;
    log.castShadow = true;
    log.receiveShadow = true;
    g.add(log);
    for (let i = 0; i < 4; i++) {
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mossMat);
      moss.scale.set(1.3, 0.35, 1);
      moss.position.set((i % 2 ? 0.3 : -0.3), -0.02, -d / 2 + (i + 0.5) * (d / 4));
      g.add(moss);
    }
    void h;
  };

  const planks = (g: THREE.Group, w: number, d: number, h: number) => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w / n - 0.06, h, d), woodMat);
      p.position.set(-w / 2 + (i + 0.5) * (w / n), -h / 2 - (i % 2) * 0.03, 0);
      p.rotation.z = (i % 2 ? 1 : -1) * 0.02;
      p.castShadow = true;
      g.add(p);
    }
    for (const z of [-d / 3, d / 3]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.2), barkMat);
      beam.position.set(0, -h - 0.06, z);
      g.add(beam);
    }
  };

  const raft = (g: THREE.Group, w: number, d: number, h: number) => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(w / n / 2, w / n / 2, d, 10), barkMat);
      l.rotation.x = Math.PI / 2;
      l.position.set(-w / 2 + (i + 0.5) * (w / n), -w / n / 2, 0);
      l.castShadow = true;
      g.add(l);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lanternGlow);
    lamp.position.set(w / 2 - 0.3, 0.6, d / 2 - 0.3);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 5), woodMat);
    pole.position.set(w / 2 - 0.3, 0.3, d / 2 - 0.3);
    g.add(lamp, pole);
    void h;
  };

  const ledge = (g: THREE.Group, w: number, d: number, h: number) => {
    stoneBlock(g, w, d, h);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), stoneDark);
    strut.position.set(0, -h - 1.0, 0);
    strut.rotation.z = 0.4;
    g.add(strut);
  };

  const runeCircle = (g: THREE.Group, w: number, d: number, h: number) => {
    stoneBlock(g, w, d, h);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * 0.38, 0.06, 6, 40), runeMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.08), runeMat);
      rune.position.set(Math.cos(a) * Math.min(w, d) * 0.3, 0.04, Math.sin(a) * Math.min(w, d) * 0.3);
      rune.rotation.y = -a;
      g.add(rune);
    }
    animators.push((_dt, time) => {
      runeMat.color.setHSL(0.36, 0.7, 0.55 + Math.sin(time * 2) * 0.12);
    });
  };

  // ---------------- Decor helpers ----------------
  function deadTree(x: number, y: number, z: number, s = 1) {
    const t = new THREE.Group();
    t.position.set(x, y, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.45 * s, 4.5 * s, 7), barkMat);
    trunk.position.y = 2.25 * s;
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    t.add(trunk);
    const branches: [number, number, number, number][] = [
      [3.2, 0.9, 0.3, 2.0],
      [3.8, -1.0, -0.5, 1.6],
      [2.4, -0.6, 0.9, 1.3],
      [4.4, 0.4, -0.2, 1.2],
    ];
    for (const [by, rz, ry, len] of branches) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.14 * s, len * s, 5), barkMat);
      b.position.set(Math.sin(rz) * len * 0.45 * s, by * s, 0);
      b.rotation.set(0, ry, -rz);
      t.add(b);
    }
    // Hanging moss strands
    for (let i = 0; i < 3; i++) {
      const strand = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.2), new THREE.MeshStandardMaterial({ color: 0x4a5d3a, side: THREE.DoubleSide, roughness: 1 }));
      strand.position.set((i - 1) * 0.7 * s, 2.8 * s, 0.3);
      t.add(strand);
    }
    kit.addDecor(t);
    kit.registerCylinder(`deadtree_${x}_${z}`, x, y, z, 0.45 * s, 4 * s);
  }

  function glowShrooms(x: number, y: number, z: number, n = 4) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    for (let i = 0; i < n; i++) {
      const s = 0.4 + ((i * 37) % 10) / 20;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.6 * s, 6), stemMat);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? glowCyan : glowPurple);
      const ox = Math.cos(i * 2.4) * 0.5;
      const oz = Math.sin(i * 2.4) * 0.5;
      stem.position.set(ox, 0.3 * s, oz);
      cap.position.set(ox, 0.58 * s, oz);
      g.add(stem, cap);
    }
    kit.addDecor(g);
  }

  function lanternPost(x: number, y: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), woodMat);
    post.position.y = 1.2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), woodMat);
    arm.position.set(0.25, 2.3, 0);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), lanternGlow);
    lamp.position.set(0.5, 2.05, 0);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(217,249,157,0.7)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.6);
    halo.position.copy(lamp.position);
    g.add(post, arm, lamp, halo);
    kit.addDecor(g);
    kit.registerCylinder(`lantern_${x}_${z}`, x, y, z, 0.15, 2.4);
    animators.push((_dt, time) => halo.scale.setScalar(1.5 + Math.sin(time * 3 + x) * 0.15));
  }

  function gravestone(x: number, y: number, z: number, rot: number) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.15), stoneMat);
    g.position.set(x, y + 0.4, z);
    g.rotation.set(0.08, rot, (rot % 0.3) - 0.1);
    kit.addDecor(g);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.15, 12, 1, false, 0, Math.PI), stoneMat);
    top.rotation.set(Math.PI / 2, 0, 0);
    top.position.set(0, 0.45, 0);
    g.add(top);
  }

  // =====================================================
  // ZONE 1: ORILLA BRUMOSA (misty shore)
  // =====================================================
  addPlatform('shore', 0, 0, 0, 26, 22, 3, mossIsland);
  kit.addCheckpoint(1, 'Orilla Brumosa', new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(0, 0.2, 0), true);
  deadTree(-9, 0, -6, 1.1);
  deadTree(9.5, 0, -7, 1.0);
  deadTree(-10, 0, 7, 0.9);
  deadTree(10, 0, 6, 1.2);
  glowShrooms(-6, 0, 2);
  glowShrooms(7, 0, -2, 5);
  glowShrooms(-3, 0, -8, 3);
  lanternPost(-4, 0, 8.5);
  lanternPost(4.5, 0, 8.5);
  gravestone(-7, 0, -2, 0.2);
  gravestone(-5.6, 0, -3.2, -0.3);
  gravestone(6, 0, 3, 0.4);

  // Murky water everywhere below the route (falling in = sinking back to the checkpoint)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 260), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.2, 80);
  kit.addDecor(water);

  addPlatform('lily_1', -3, 0.3, 14, 3, 3, 0.25, lilyPad);
  addPlatform('lily_2', 1, 0.6, 18.5, 3, 3, 0.25, lilyPad);
  addPlatform('rotten_log', 1, 0.9, 25, 2.2, 8, 0.9, logBridge);
  const plank = addPlatform('rotten_planks', -2.5, 1.5, 32, 3, 3, 0.25, planks);
  kit.makeCrumbling(plank);
  const raftPlat = addPlatform('drifting_raft', -6, 2.0, 37.5, 3.5, 3.5, 0.4, raft);
  kit.makeMoving(raftPlat, 'x', 2.0, 0.7);

  addPlatform('shroom_isle', -6, 2.6, 43, 5, 5, 1.5, mossIsland);
  const toxic = createBouncyMushroom(1.3, textures);
  (toxic.cap.material as THREE.MeshStandardMaterial).color.set(0x7e22ce);
  (toxic.cap.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x3b0764);
  (toxic.cap.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
  kit.addBouncy('toxic_mushroom', toxic, -6, 2.6, 43);

  // =====================================================
  // ZONE 2: RUINAS DEL AQUELARRE (witch ruins)
  // =====================================================
  addPlatform('ruins_deck', -6, 5.4, 49, 6, 6, 1.2, stoneBlock);
  addPlatform('ruins_plaza', -2, 6.2, 58, 10, 9, 3, stoneBlock);
  kit.addCheckpoint(2, 'Ruinas del Aquelarre', new THREE.Vector3(-5.5, 6.2, 55.2), new THREE.Vector3(-2, 6.4, 58.5));

  // Broken gothic pillars & an arch
  const pillarSpots: [number, number, number][] = [
    [-6.4, 61.6, 3.2],
    [2.4, 54.0, 3.6],
  ];
  for (const [px, pz, ph] of pillarSpots) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, ph, 8), stoneMat);
    p.position.set(px, 6.2 + ph / 2, pz);
    p.castShadow = true;
    kit.addDecor(p);
    kit.registerCylinder(`pillar_${px}_${pz}`, px, 6.2, pz, 0.5, ph);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.3, 6, 16, Math.PI), stoneMat);
  arch.position.set(-4.5, 6.2, 62.2);
  kit.addDecor(arch);
  kit.registerCylinder('arch_l', -6.5, 6.2, 62.2, 0.35, 2.2);
  kit.registerCylinder('arch_r', -2.5, 6.2, 62.2, 0.35, 2.2);

  // Bubbling cauldron
  const cauldron = new THREE.Group();
  cauldron.position.set(1, 6.2, 57);
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
  pot.position.y = 0.65;
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0x84cc16 }));
  brew.rotation.x = -Math.PI / 2;
  brew.position.y = 1.15;
  cauldron.add(pot, brew);
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xbef264, transparent: true, opacity: 0.8 }));
    cauldron.add(b);
    bubbles.push(b);
  }
  kit.addDecor(cauldron);
  kit.registerCylinder('cauldron', 1, 6.2, 57, 0.8, 1.2);
  animators.push((_dt, time) => {
    bubbles.forEach((b, i) => {
      const t = (time * 0.7 + i * 0.2) % 1;
      b.position.set(Math.cos(i * 1.3) * 0.3, 1.15 + t * 0.9, Math.sin(i * 1.3) * 0.3);
      b.scale.setScalar(1 - t * 0.7);
    });
  });
  glowShrooms(-6, 6.2, 60.5, 3);
  lanternPost(2.6, 6.2, 55.6);

  addPlatform('stone_hop_1', 4, 6.8, 65, 3, 3, 1.2, stoneBlock);
  addPlatform('stone_hop_2', 7.5, 7.4, 70, 3, 3, 1.2, stoneBlock);
  addPlatform('spirit_pad', 7.5, 8.0, 76, 5, 5, 1.5, runeCircle);
  kit.addUpdraft('spirit_updraft', 7.5, 8.0, 76, 15, 4.6, 0x86efac);
  addPlatform('glide_ledge', 7.5, 13.6, 81.5, 4.8, 4.8, 1.0, stoneBlock);

  // =====================================================
  // ZONE 3: TORRE DE LA BRUJA (spiral climb)
  // =====================================================
  addPlatform('tower_balcony', 7.5, 15.4, 87.5, 8, 6, 1.5, stoneBlock);
  kit.addCheckpoint(3, 'Torre de la Bruja', new THREE.Vector3(10.6, 15.4, 86.2), new THREE.Vector3(6.5, 15.6, 88));
  lanternPost(4.2, 15.4, 85.2);

  // The tower itself (solid), with glowing windows
  const towerH = 54.3;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, towerH, 18), stoneDark);
  tower.position.set(-1, -25 + towerH / 2, 97);
  tower.castShadow = true;
  kit.addDecor(tower);
  kit.registerCylinder('witch_tower', -1, -25, 97, 4.0, towerH);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
  for (let i = 0; i < 9; i++) {
    const a = i * 1.9;
    const wy = 4 + i * 3.2;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), windowMat);
    win.position.set(-1 + Math.cos(a) * 3.82, wy, 97 + Math.sin(a) * 3.82);
    win.lookAt(-1 + Math.cos(a) * 10, wy, 97 + Math.sin(a) * 10);
    kit.addDecor(win);
  }

  addPlatform('ledge_1', 5.5, 16.6, 93.5, 3, 3, 0.8, ledge);
  addPlatform('ledge_2', 5, 17.8, 98.3, 3, 3, 0.8, ledge);
  addPlatform('ledge_3', 1, 19.0, 102.5, 3, 3, 0.8, ledge);
  addPlatform('ledge_4', -3.8, 20.2, 102.5, 3, 3, 0.8, ledge);
  const crumbleLedge = addPlatform('ledge_crumble', -7, 21.4, 97.5, 3, 3, 0.8, ledge);
  kit.makeCrumbling(crumbleLedge);
  addPlatform('ledge_6', -6, 22.6, 92.5, 3, 3, 0.8, ledge);
  addPlatform('spirit_pad_2', -1, 23.8, 88, 5, 5, 1.5, runeCircle);
  kit.addUpdraft('spirit_lift', -1, 23.8, 88, 13, 4.2, 0xa7f3d0);

  // =====================================================
  // SUMMIT: SANTUARIO DE LAS LUCIÉRNAGAS (on the tower top)
  // =====================================================
  const summitY = 32.3;
  addPlatform('sanctuary', -1, summitY, 98, 16, 14, 3, stoneBlock);
  const summitPos = new THREE.Vector3(-1, summitY + 0.2, 98);
  // Crenellations around the edge
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = -1 + Math.cos(a) * 7.4;
    const z = 98 + Math.sin(a) * 6.4;
    if (z < 92.5 && Math.abs(x + 1) < 3.5) continue; // leave the landing side open
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), stoneMat);
    merlon.position.set(x, summitY + 0.45, z);
    kit.addDecor(merlon);
  }
  // Giant firefly lantern (Chispa's home)
  const bigLantern = new THREE.Group();
  bigLantern.position.set(-5, summitY, 102);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.6, 8), stoneMat);
  base.position.y = 0.3;
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.2, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.7, roughness: 0.4, wireframe: true }));
  cage.position.y = 1.7;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), lanternGlow);
  core.position.y = 1.7;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.5, metalness: 0.6 }));
  roof.position.y = 3.25;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(217,249,157,0.8)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 1.7;
  glow.scale.setScalar(5);
  bigLantern.add(base, cage, core, roof, glow);
  kit.addDecor(bigLantern);
  kit.registerCylinder('big_lantern', -5, summitY, 102, 1.2, 3.5);
  animators.push((_dt, time) => glow.scale.setScalar(4.6 + Math.sin(time * 2.2) * 0.5));
  glowShrooms(3.5, summitY, 103, 5);
  glowShrooms(-7, summitY, 95, 4);
  addPlatform('sanctuary_step', 3.5, summitY + 1.1, 100.5, 2.2, 2.2, 1.1, stoneBlock);

  // =====================================================
  // ATMOSPHERE: moon, drifting wisps, distant dead forest
  // =====================================================
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(220,252,231,0.95)', 'rgba(220,252,231,0)'), transparent: true, depthWrite: false, fog: false }));
  moon.position.set(-60, 70, 160);
  moon.scale.setScalar(55);
  kit.addDecor(moon);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xecfccb, fog: false }));
  moonDisc.position.set(-60, 70, 161);
  moonDisc.lookAt(0, 10, 60);
  kit.addDecor(moonDisc);

  const wispTex = makeGlowTexture('rgba(190,242,100,0.9)');
  const wisps: { s: THREE.Sprite; base: THREE.Vector3; ph: number }[] = [];
  for (let i = 0; i < 55; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispTex, color: i % 3 === 0 ? 0x67e8f9 : 0xd9f99d, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const base = new THREE.Vector3((Math.random() - 0.5) * 40, Math.random() * 30, -10 + Math.random() * 120);
    s.position.copy(base);
    s.scale.setScalar(0.35 + Math.random() * 0.3);
    kit.addDecor(s);
    wisps.push({ s, base, ph: Math.random() * 10 });
  }
  animators.push((_dt, time) => {
    for (const w of wisps) {
      w.s.position.set(
        w.base.x + Math.sin(time * 0.5 + w.ph) * 1.5,
        w.base.y + Math.sin(time * 0.8 + w.ph * 2) * 0.8,
        w.base.z + Math.cos(time * 0.4 + w.ph) * 1.5
      );
      (w.s.material as THREE.SpriteMaterial).opacity = 0.5 + Math.sin(time * 3 + w.ph) * 0.4;
    }
  });

  // Distant silhouettes of dead trees standing in the water
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (18 + Math.random() * 30);
    const z = -10 + Math.random() * 130;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 14 + Math.random() * 8, 6), barkMat);
    tr.position.set(x, 5, z);
    tr.rotation.z = (Math.random() - 0.5) * 0.3;
    kit.addDecor(tr);
  }

  // =====================================================
  // COLLECTIBLES
  // =====================================================
  kit.addCollectible('w1', 'sun_crystal', 6, 1.2, 4);
  kit.addCollectible('w2', 'golden_acorn', -8, 1.2, -4);
  kit.addCollectible('w3', 'sun_crystal', 1, 1.9, 18.5);
  kit.addCollectible('w4', 'golden_acorn', 1, 2.1, 25);
  kit.addCollectible('w5', 'sun_crystal', -6, 6.6, 45.2);
  kit.addCollectible('w6', 'sun_crystal', 2, 7.4, 60);
  kit.addCollectible('w7', 'golden_acorn', 7.5, 8.6, 70);
  kit.addCollectible('w8', 'sun_crystal', 7.5, 15.0, 81.5);
  kit.addCollectible('w9', 'sun_crystal', 5, 19.0, 98.3);
  kit.addCollectible('w10', 'golden_acorn', -3.8, 21.4, 102.5);
  kit.addCollectible('w11', 'sun_crystal', -7, 22.6, 97.5);
  kit.addCollectible('w_master', 'sun_crystal', 3.5, summitY + 2.4, 100.5);

  // =====================================================
  // ENEMIES (mud creatures & wraiths)
  // =====================================================
  const enemies = new EnemyManager(root, textures);
  enemies.spawnMudling('mud_1', new THREE.Vector3(-7.9, 5.4, 49), 'z', 1.9);
  enemies.spawnMudling('mud_2', new THREE.Vector3(-5.5, 6.2, 59.5), 'z', 1.4);
  enemies.spawnWraith('wraith_1', new THREE.Vector3(5.5, 8.4, 67.5), 'x', 2.0);
  enemies.spawnWraith('wraith_2', new THREE.Vector3(-7.5, 22.4, 101), 'z', 1.4);
  enemies.spawnMudling('mud_3', new THREE.Vector3(-1, summitY, 103.5), 'x', 3.0);

  return kit.finish(
    summitPos,
    enemies,
    [
      { type: 'baya', pos: new THREE.Vector3(-5, 0.95, 4) },
      { type: 'nuez', pos: new THREE.Vector3(6, 0.95, -5) },
      { type: 'baya', pos: new THREE.Vector3(-4.5, 6.35, 50.5) },
      { type: 'baya', pos: new THREE.Vector3(0, 7.15, 55.5) },
      { type: 'nuez', pos: new THREE.Vector3(10, 16.35, 88.5) },
      { type: 'baya', pos: new THREE.Vector3(-6, 23.55, 92.5) },
    ],
    new THREE.Vector3(-1, summitY + 6, 101)
  );
}
