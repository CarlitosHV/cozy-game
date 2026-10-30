/**
 * LEVEL 2 — "Valle Aero" (Frutiger Aero aesthetic)
 * Glossy green meadow, bubbly lakes, waterfalls pouring off crystal cliffs,
 * a glass-skyscraper city and a shiny globe at the summit plaza.
 * Enemies here are "corrupted": glitch cubes and crash/error windows that
 * deliberately break the clean glossy look.
 *
 * Route (all jumps tuned to the same physics as level 1):
 *  Zone 1  Pradera Aero      → glass lily pads → bubble trampoline → glass deck
 *  Zone 2  Cascadas          → crystal cliff (CP2) → moving glass → water spout updraft → falls cliff
 *  Zone 3  Ciudad de Cristal → glass bridge → tower rooftops, elevator, CP3, crumbling pad → vent updraft → summit plaza
 */
import * as THREE from 'three';
import { EnemyManager } from './enemies';
import {
  BouncyMushroomModel,
  CollectibleModel,
  createCheckpointShrine,
  createCollectible,
  createUpdraftVortex,
} from './models';
import { ProceduralTextures } from './textures';
import { CheckpointItem, PlatformItem, SolidObstacleCollider, WorldBuildResult } from './levels';

type Surface = 'meadow' | 'glass' | 'cliff' | 'roof' | 'white';

export function buildAeroWorld(root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const platforms: PlatformItem[] = [];
  const checkpoints: CheckpointItem[] = [];
  const collectibles: CollectibleModel[] = [];
  const solidObstacles: SolidObstacleCollider[] = [];
  const decorativeMeshes: THREE.Object3D[] = [];
  const animators: ((dt: number, time: number) => void)[] = [];

  // ---------------- Materials ----------------
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4fc23f, roughness: 0.5, metalness: 0.02 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xd9eef9, roughness: 0.25, metalness: 0.15 });
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0xb9e3f0, roughness: 0.3, metalness: 0.1, flatShading: true });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x8fe3f5,
    roughness: 0.12,
    metalness: 0.2,
    flatShading: true,
    transparent: true,
    opacity: 0.88,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7fd8ff,
    roughness: 0.04,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.42,
    envMapIntensity: 1.6,
  });
  const towerGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x3fb2e8,
    roughness: 0.05,
    metalness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.62,
    envMapIntensity: 1.8,
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe6f0f7, roughness: 0.28, metalness: 0.25 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.04,
    metalness: 0.2,
    transparent: true,
    opacity: 0.78,
  });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4ccf3c, roughness: 0.2, metalness: 0.05 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x8be04e, roughness: 0.22, metalness: 0.05 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xf1e6d6, roughness: 0.3, metalness: 0.05 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });

  // ---------------- Helpers ----------------
  function registerCylinderCollider(name: string, x: number, y: number, z: number, radius: number, height: number) {
    solidObstacles.push({ name, type: 'cylinder', position: new THREE.Vector3(x, y, z), radius, height, bottomY: y, topY: y + height });
  }

  function registerShrineColliders(name: string, pos: THREE.Vector3) {
    registerCylinderCollider(`${name}_pl`, pos.x + 0.65, pos.y, pos.z, 0.22, 2.5);
    registerCylinderCollider(`${name}_pr`, pos.x - 0.65, pos.y, pos.z, 0.22, 2.5);
    registerCylinderCollider(`${name}_bell`, pos.x, pos.y, pos.z, 0.42, 2.0);
  }

  /** Thin white frame around the top edge of a pad (helps read edges on glass). */
  function addTopFrame(group: THREE.Group, w: number, d: number, y: number) {
    const t = 0.12;
    const bars: [number, number, number, number][] = [
      [w + t, t, 0, d / 2],
      [w + t, t, 0, -d / 2],
      [t, d, w / 2, 0],
      [t, d, -w / 2, 0],
    ];
    for (const [bw, bd, x, z] of bars) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.1, bd), whiteMat);
      bar.position.set(x, y, z);
      bar.castShadow = true;
      group.add(bar);
    }
  }

  function addPlatform(
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    surface: Surface
  ): PlatformItem {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    if (surface === 'meadow' || surface === 'cliff') {
      // Grass top + glossy sides, with a crystal underside so it floats
      const mats = surface === 'meadow'
        ? [sideMat, sideMat, grassMat, sideMat, sideMat, sideMat]
        : [cliffMat, cliffMat, grassMat, cliffMat, cliffMat, cliffMat];
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      body.position.y = -h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      // Rounded grass lip
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.25, d + 0.12), grassMat);
      lip.position.y = -0.1;
      lip.receiveShadow = true;
      group.add(lip);
      const under = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.55, Math.min(w, d) * 0.7, 7), crystalMat);
      under.rotation.x = Math.PI;
      under.position.y = -h - Math.min(w, d) * 0.35;
      group.add(under);
    } else if (surface === 'glass') {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
      slab.position.y = -h / 2;
      slab.receiveShadow = true;
      group.add(slab);
      addTopFrame(group, w, d, -0.05);
    } else if (surface === 'white') {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), whiteMat);
      slab.position.y = -h / 2;
      slab.castShadow = true;
      slab.receiveShadow = true;
      group.add(slab);
    }

    root.add(group);
    const plat: PlatformItem = {
      id,
      type: 'static',
      position: new THREE.Vector3(x, y, z),
      size: new THREE.Vector3(w, h, d),
      mesh: group,
      originalY: y,
    };
    platforms.push(plat);
    return plat;
  }

  /** Glass skyscraper whose white rooftop is a walkable platform (solid all the way down). */
  function addTower(id: string, x: number, roofY: number, z: number, w: number, d: number) {
    const bottomY = -45;
    const height = roofY - bottomY;
    const group = new THREE.Group();
    group.position.set(x, roofY, z);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), whiteMat);
    roof.position.y = -0.175;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);

    const bodyH = height - 0.35;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, bodyH, d - 0.3), towerGlassMat);
    body.position.y = -0.35 - bodyH / 2;
    group.add(body);

    // White mullions at the corners and floor bands
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, bodyH, 0.18), whiteMat);
        m.position.set(sx * (w / 2 - 0.15), -0.35 - bodyH / 2, sz * (d / 2 - 0.15));
        group.add(m);
      }
    }
    const bandGeom = new THREE.BoxGeometry(w - 0.2, 0.1, d - 0.2);
    for (let yy = -3.2; yy > -bodyH + 2; yy -= 3.4) {
      const band = new THREE.Mesh(bandGeom, whiteMat);
      band.position.y = yy;
      group.add(band);
    }
    // Glossy rooftop railing posts at the corners (decor)
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const post = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.05, metalness: 0.3 }));
        post.position.set(sx * (w / 2 - 0.2), 0.12, sz * (d / 2 - 0.2));
        group.add(post);
      }
    }

    root.add(group);
    const plat: PlatformItem = {
      id,
      type: 'static',
      position: new THREE.Vector3(x, roofY, z),
      size: new THREE.Vector3(w, height, d),
      mesh: group,
      originalY: roofY,
    };
    platforms.push(plat);
    return plat;
  }

  /** Glossy round "Aero" tree with a solid trunk collider. */
  function addTree(x: number, y: number, z: number, s: number = 1) {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 2.6 * s, 10), trunkMat);
    trunk.position.y = 1.3 * s;
    trunk.castShadow = true;
    tree.add(trunk);
    const blobs: [number, number, number, number, THREE.Material][] = [
      [0, 3.4, 0, 1.55, leafMat],
      [0.95, 2.85, 0.35, 1.05, leafMat2],
      [-0.9, 2.95, -0.25, 1.1, leafMat2],
      [0.1, 4.35, -0.2, 0.95, leafMat2],
    ];
    for (const [bx, by, bz, r, m] of blobs) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r * s, 20, 16), m);
      blob.position.set(bx * s, by * s, bz * s);
      blob.castShadow = true;
      tree.add(blob);
      // Glossy highlight (the classic shiny "Aero" bubble look)
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * s * 0.32, 12, 10), shineMat);
      hl.scale.set(1.3, 0.6, 1);
      hl.position.set((bx - r * 0.35) * s, (by + r * 0.55) * s, (bz + r * 0.45) * s);
      tree.add(hl);
    }
    root.add(tree);
    decorativeMeshes.push(tree);
    registerCylinderCollider(`tree_${x}_${z}`, x, y, z, 0.38 * s, 3.2 * s);
  }

  // Waterfall texture: bright streaks, scrolled downward every frame
  function makeWaterfallTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#5cc8f5';
    ctx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 256;
      const len = 20 + Math.random() * 60;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${0.5 + Math.random() * 0.5})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 1 + Math.random() * 2.5, len);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const waterfallTex = makeWaterfallTexture();
  const waterfallMats: THREE.MeshBasicMaterial[] = [];

  /** A waterfall sheet hanging from a cliff edge; fades out as it falls into the mist. */
  function addWaterfall(x: number, yTop: number, yBottom: number, z: number, width: number, rotY: number) {
    const h = yTop - yBottom;
    const geom = new THREE.PlaneGeometry(width, h, 1, 8);
    // RGBA vertex colors: opaque at the lip, transparent at the bottom
    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + h / 2) / h; // 0 bottom → 1 top
      colors[i * 4] = 1;
      colors[i * 4 + 1] = 1;
      colors[i * 4 + 2] = 1;
      colors[i * 4 + 3] = Math.min(1, t * 1.6);
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    const tex = waterfallTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, width / 3), h / 12);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      vertexColors: true,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    waterfallMats.push(mat);
    const sheet = new THREE.Mesh(geom, mat);
    sheet.position.set(x, yTop - h / 2, z);
    sheet.rotation.y = rotY;
    root.add(sheet);
    decorativeMeshes.push(sheet);

    // White foam lip where the water pours over the edge
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, width, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    lip.rotation.z = Math.PI / 2;
    lip.rotation.y = rotY + Math.PI / 2;
    lip.position.set(x, yTop - 0.1, z);
    root.add(lip);

    // Mist puffs drifting at the bottom
    const mistMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    const mist: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 1.2, 10, 8), mistMat);
      m.position.set(x + (Math.random() - 0.5) * width, yBottom + h * 0.25 + Math.random() * 2, z + (Math.random() - 0.5) * width);
      root.add(m);
      mist.push(m);
    }
    animators.push((dt, time) => {
      tex.offset.y += dt * 0.9;
      mist.forEach((m, i) => m.scale.setScalar(1 + Math.sin(time * 1.3 + i) * 0.12));
    });
  }

  /** Bubble trampoline: same physics interface as the bouncy mushroom. */
  function createBubbleTrampoline(radius: number): BouncyMushroomModel {
    const group = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.75, radius * 0.85, 0.55, 24), whiteMat);
    stalk.position.y = 0.27;
    stalk.castShadow = true;
    group.add(stalk);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.8, 0.09, 8, 28), new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.1, metalness: 0.2 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55;
    group.add(ring);
    const capGeom = new THREE.SphereGeometry(radius, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeom.scale(1, 0.62, 1);
    const cap = new THREE.Mesh(
      capGeom,
      new THREE.MeshPhysicalMaterial({
        color: 0x9ae6ff,
        roughness: 0.02,
        metalness: 0.05,
        clearcoat: 1,
        transparent: true,
        opacity: 0.55,
        envMapIntensity: 2,
      })
    );
    cap.position.y = 0.55;
    group.add(cap);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.28, 12, 10), shineMat);
    hl.scale.set(1.4, 0.5, 1);
    hl.position.set(-radius * 0.35, 0.55 + radius * 0.45, radius * 0.3);
    cap.add(hl);
    hl.position.y -= 0.55;

    let bounceTime = -1;
    let amp = 0.25;
    return {
      group,
      cap,
      stalk,
      triggerBounce: (superBounce = false) => {
        bounceTime = 0;
        amp = superBounce ? 0.42 : 0.28;
      },
      update: (dt: number) => {
        if (bounceTime >= 0) {
          bounceTime += dt;
          const p = bounceTime / 0.9;
          if (p >= 1) {
            bounceTime = -1;
            cap.scale.set(1, 1, 1);
          } else {
            const squash = 1 - Math.sin(p * Math.PI * 3) * Math.exp(-p * 3.8) * amp;
            const stretch = 1 + (1 - squash) * 0.5;
            cap.scale.set(stretch, squash, stretch);
          }
        }
      },
    };
  }

  function addCheckpoint(id: number, name: string, shrinePos: THREE.Vector3, spawn: THREE.Vector3, active = false) {
    const shrine = createCheckpointShrine(textures);
    shrine.group.position.copy(shrinePos);
    if (active) shrine.activate();
    root.add(shrine.group);
    checkpoints.push({ id, name, spawnPos: spawn, shrine });
    registerShrineColliders(`shrine_${id}`, shrinePos);
  }

  // =====================================================
  // ZONE 1: PRADERA AERO (glossy meadow, lake & lily pads)
  // =====================================================
  addPlatform('aero_meadow', 0, 0, 0, 30, 26, 3, 'meadow');
  addCheckpoint(1, 'Pradera Aero', new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(0, 0.2, 0), true);

  addTree(-10, 0, -8, 1.1);
  addTree(10.5, 0, -7, 1.0);
  addTree(-11.5, 0, 8, 0.9);
  addTree(11, 0, 6.5, 1.15);
  addTree(-4.5, 0, -10, 0.8);

  // Glossy pond with a little fountain
  const pond = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), waterMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-7, 0.04, 2.5);
  root.add(pond);
  const pondRim = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.18, 10, 48), whiteMat);
  pondRim.rotation.x = Math.PI / 2;
  pondRim.position.set(-7, 0.08, 2.5);
  root.add(pondRim);
  const fountainBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 0.5, 20), whiteMat);
  fountainBowl.position.set(-7, 0.3, 2.5);
  root.add(fountainBowl);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 1.6, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xcff4ff, transparent: true, opacity: 0.6, depthWrite: false }));
  jet.position.set(-7, 1.3, 2.5);
  root.add(jet);
  registerCylinderCollider('fountain', -7, 0, 2.5, 0.75, 1.0);
  animators.push((_dt, time) => {
    jet.scale.y = 1 + Math.sin(time * 4) * 0.12;
  });

  // Glass lily pads over the lake below
  addPlatform('lily_1', 3, 0.6, 16.5, 3, 3, 0.5, 'glass');
  addPlatform('lily_2', -0.5, 1.2, 21, 3, 3, 0.5, 'glass');
  addPlatform('lily_3', 2.5, 1.8, 25.5, 3, 3, 0.5, 'glass');
  const lake = new THREE.Mesh(new THREE.CircleGeometry(16, 48), waterMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(1, -6, 23);
  root.add(lake);

  // Bubble trampoline isle
  addPlatform('bubble_isle', 0, 2.2, 31, 5, 5, 1.5, 'meadow');
  const tramp = createBubbleTrampoline(1.3);
  tramp.group.position.set(0, 2.2, 31);
  root.add(tramp.group);
  platforms.push({
    id: 'bubble_trampoline',
    type: 'bouncy',
    position: new THREE.Vector3(0, 2.2 + 1.1, 31),
    size: new THREE.Vector3(2.6, 0.8, 2.6),
    mesh: tramp.group,
    bouncyModel: tramp,
  });

  // High glass deck caught by the bounce
  addPlatform('glass_deck', 0, 5.0, 37, 6, 6, 0.6, 'glass');
  addPlatform('glass_step', 3.5, 6.4, 43.5, 3.2, 3.2, 0.5, 'glass');

  // =====================================================
  // ZONE 2: CASCADAS (crystal cliffs & waterfalls)
  // =====================================================
  addPlatform('cascade_cliff', 6, 7.4, 51, 11, 9, 10, 'cliff');
  addCheckpoint(2, 'Cascadas Cristalinas', new THREE.Vector3(9.5, 7.4, 48.5), new THREE.Vector3(6, 7.6, 52));
  // River running across the cliff top into the falls
  const river = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 2.4), waterMat);
  river.position.set(9.6, 7.45, 54.0);
  root.add(river);
  addWaterfall(11.56, 7.35, -26, 54.0, 2.4, Math.PI / 2);

  // Moving glass panel across the gorge
  const mover = addPlatform('moving_glass_1', 6, 8.2, 59.5, 4, 4, 0.5, 'glass');
  mover.type = 'moving';
  mover.initialPos = new THREE.Vector3(6, 8.2, 59.5);
  mover.movement = { axis: 'x', amplitude: 2.0, speed: 0.9, offset: 0 };

  addPlatform('glass_hop', 2, 9.2, 65, 3.6, 3.6, 0.5, 'glass');

  // Water-spout updraft
  addPlatform('spout_pad', -2, 9.8, 71, 5, 5, 1.6, 'meadow');
  const spoutRing = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.18, 10, 40), whiteMat);
  spoutRing.rotation.x = Math.PI / 2;
  spoutRing.position.set(-2, 9.86, 71);
  root.add(spoutRing);
  const spoutWater = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), waterMat);
  spoutWater.rotation.x = -Math.PI / 2;
  spoutWater.position.set(-2, 9.84, 71);
  root.add(spoutWater);
  const spout = createUpdraftVortex(2.2, 15.0);
  spout.group.position.set(-2, 9.8, 71);
  root.add(spout.group);
  platforms.push({
    id: 'water_spout',
    type: 'updraft',
    position: new THREE.Vector3(-2, 9.8, 71),
    size: new THREE.Vector3(4.6, 15.0, 4.6),
    mesh: spout.group,
    updraftModel: spout,
  });

  addPlatform('glide_glass', -2, 15.4, 76.5, 4.8, 4.8, 0.5, 'glass');
  addPlatform('falls_cliff', -2, 17.2, 82.5, 8, 6, 14, 'cliff');
  addWaterfall(-6.06, 17.1, -24, 82.5, 3.0, -Math.PI / 2);

  // Big background cliffs with waterfalls
  function addBackdropCliff(x: number, top: number, z: number, w: number, d: number, fallX: number, fallRot: number, fallW: number) {
    const group = new THREE.Group();
    group.position.set(x, top, z);
    const h = top + 40;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [cliffMat, cliffMat, grassMat, cliffMat, cliffMat, cliffMat]);
    body.position.y = -h / 2;
    group.add(body);
    root.add(group);
    decorativeMeshes.push(group);
    addTree(x - w * 0.25, top, z - d * 0.2, 1.3);
    addWaterfall(fallX, top - 0.1, -30, z, fallW, fallRot);
  }
  addBackdropCliff(-24, 30, 66, 10, 12, -18.96, Math.PI / 2, 5);
  addBackdropCliff(26, 26, 92, 9, 11, 21.46, -Math.PI / 2, 4);

  // =====================================================
  // ZONE 3: CIUDAD DE CRISTAL (glass towers)
  // =====================================================
  addPlatform('glass_bridge', -2, 17.2, 90, 2.6, 9, 0.4, 'glass');
  for (const sx of [1, -1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 9), whiteMat);
    rail.position.set(-2 + sx * 1.25, 18.0, 90);
    root.add(rail);
    for (let i = 0; i <= 4; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), whiteMat);
      post.position.set(-2 + sx * 1.25, 17.6, 85.7 + i * 2.15);
      root.add(post);
    }
  }

  addTower('tower_a', -2, 18.0, 98, 6, 6);
  addTower('tower_b', 3.5, 19.2, 104, 5, 5);

  // Glass elevator
  const elevator = addPlatform('glass_elevator', 9, 20.2, 109, 3.5, 3.5, 0.5, 'glass');
  elevator.type = 'moving';
  elevator.initialPos = new THREE.Vector3(9, 20.2, 109);
  elevator.movement = { axis: 'y', amplitude: 1.0, speed: 0.8, offset: 0 };

  addTower('tower_c', 9, 21.6, 116, 8, 8);
  addCheckpoint(3, 'Ciudad de Cristal', new THREE.Vector3(12, 21.6, 113.6), new THREE.Vector3(9, 21.8, 117));
  addTower('tower_d', 3, 22.8, 123, 4.5, 4.5);

  // Crumbling glass pad on a slim antenna mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 34, 10), whiteMat);
  mast.position.set(-2.5, 24.0 - 0.5 - 17, 125.5);
  root.add(mast);
  const crumble = addPlatform('crumble_glass', -2.5, 24.0, 125.5, 3.5, 3.5, 0.4, 'glass');
  crumble.type = 'crumbling';
  crumble.crumbleTimer = 1.6;
  crumble.isCrumbling = false;

  addTower('tower_f', -4, 25.2, 131.5, 5, 5);
  // Rooftop air vent updraft to the summit
  const vent = createUpdraftVortex(2.0, 13.0);
  vent.group.position.set(-4, 25.2, 131.5);
  root.add(vent.group);
  platforms.push({
    id: 'roof_vent',
    type: 'updraft',
    position: new THREE.Vector3(-4, 25.2, 131.5),
    size: new THREE.Vector3(4.2, 13.0, 4.2),
    mesh: vent.group,
    updraftModel: vent,
  });
  const ventGrill = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.7 }));
  ventGrill.position.set(-4, 25.26, 131.5);
  root.add(ventGrill);

  // Background skyline (decor only)
  const skyline: [number, number, number, number, number][] = [
    [-55, 110, 45, 8, 8],
    [-62, 150, 60, 10, 8],
    [55, 120, 50, 9, 9],
    [62, 165, 65, 11, 10],
    [-45, 195, 55, 9, 9],
    [48, 200, 48, 8, 8],
    [-22, 235, 62, 10, 10],
    [24, 240, 52, 9, 9],
  ];
  for (const [x, z, top, w, d] of skyline) {
    const g = new THREE.Group();
    g.position.set(x, top, z);
    const h = top + 45;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), towerGlassMat);
    b.position.y = -h / 2;
    g.add(b);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4), whiteMat);
    g.add(cap);
    for (let yy = -4; yy > -h + 4; yy -= 5) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.15, d + 0.1), whiteMat);
      band.position.y = yy;
      g.add(band);
    }
    root.add(g);
    decorativeMeshes.push(g);
  }

  // =====================================================
  // SUMMIT: PLAZA DEL GLOBO
  // =====================================================
  const summitY = 33.7;
  addPlatform('summit_plaza', -7, summitY, 141.5, 16, 14, 3, 'meadow');
  const summitPos = new THREE.Vector3(-7, summitY + 0.2, 141.5);
  // Glossy globe monument
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.4, 28), whiteMat);
  pedestal.position.set(-7, summitY + 0.7, 146.5);
  pedestal.castShadow = true;
  root.add(pedestal);
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 40, 28),
    new THREE.MeshPhysicalMaterial({ color: 0x1fa2ff, roughness: 0.04, metalness: 0.2, clearcoat: 1, envMapIntensity: 2 })
  );
  globe.position.set(-7, summitY + 3.2, 146.5);
  globe.castShadow = true;
  root.add(globe);
  // Green "continents"
  const landMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.3 });
  for (let i = 0; i < 6; i++) {
    const land = new THREE.Mesh(new THREE.SphereGeometry(0.55 + Math.random() * 0.3, 12, 10), landMat);
    const a = (i / 6) * Math.PI * 2;
    const el = (Math.random() - 0.5) * 1.2;
    land.position.set(Math.cos(a) * Math.cos(el) * 1.45, Math.sin(el) * 1.45, Math.sin(a) * Math.cos(el) * 1.45);
    land.scale.set(1, 0.45, 1);
    land.lookAt(0, 0, 0);
    globe.add(land);
  }
  const globeHl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), shineMat);
  globeHl.scale.set(1.4, 0.6, 1);
  globeHl.position.set(-7 - 0.6, summitY + 4.3, 146.5 + 0.9);
  root.add(globeHl);
  const orbitRings: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.5 + i * 0.5, 0.06, 8, 64), whiteMat);
    r.position.copy(globe.position);
    r.rotation.set(Math.PI / 2 + 0.4 * (i ? -1 : 1), 0.3, 0);
    root.add(r);
    orbitRings.push(r);
  }
  registerCylinderCollider('globe_pedestal', -7, summitY, 146.5, 1.9, 5.2);
  animators.push((dt) => {
    globe.rotation.y += dt * 0.35;
    orbitRings.forEach((r, i) => (r.rotation.z += dt * (i ? -0.5 : 0.4)));
  });
  addPlatform('globe_step', -2.5, summitY + 1.1, 144, 2.2, 2.2, 1.1, 'white');
  addTree(-13, summitY, 138.5, 1.0);
  addTree(-0.5, summitY, 147.5, 0.9);

  // =====================================================
  // SKY DECOR: rainbow, glossy hills, floating bubbles & orbs
  // =====================================================
  const rainbowColors = [0xff5d5d, 0xffa94d, 0xffe066, 0x69db7c, 0x4dabf7, 0x9775fa];
  rainbowColors.forEach((col, i) => {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(95 - i * 2.2, 1.1, 8, 96, Math.PI),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32, depthWrite: false, fog: false })
    );
    band.position.set(0, -20, 230);
    root.add(band);
  });

  const hillMat = new THREE.MeshStandardMaterial({ color: 0x58c94a, roughness: 0.3 });
  const hills: [number, number, number, number][] = [
    [-70, -26, 60, 40],
    [80, -28, 110, 45],
    [-60, -30, 170, 50],
    [50, -24, 20, 35],
    [0, -34, 210, 60],
  ];
  for (const [x, y, z, r] of hills) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), hillMat);
    hill.scale.y = 0.45;
    hill.position.set(x, y, z);
    root.add(hill);
  }

  // Rising soap bubbles
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f7ff,
    roughness: 0,
    metalness: 0,
    clearcoat: 1,
    transparent: true,
    opacity: 0.28,
    iridescence: 1,
    iridescenceIOR: 1.3,
    depthWrite: false,
  });
  const bubbles: { mesh: THREE.Mesh; speed: number; phase: number; baseX: number }[] = [];
  const bubbleGeom = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 45; i++) {
    const m = new THREE.Mesh(bubbleGeom, bubbleMat);
    const r = 0.15 + Math.random() * 0.45;
    m.scale.setScalar(r);
    const x = (Math.random() - 0.5) * 50;
    m.position.set(x, -6 + Math.random() * 46, -15 + Math.random() * 170);
    root.add(m);
    bubbles.push({ mesh: m, speed: 0.5 + Math.random() * 0.9, phase: Math.random() * 10, baseX: x });
  }

  // Glossy aqua orbs floating along the route
  const orbMat = new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.7, envMapIntensity: 2 });
  const orbs: THREE.Mesh[] = [];
  const orbSpots: [number, number, number][] = [
    [-6, 4, 18], [7, 6, 30], [-5, 10, 46], [12, 13, 66], [-8, 20, 92], [14, 25, 110], [-12, 30, 128],
  ];
  for (const [x, y, z] of orbSpots) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 16), orbMat);
    o.position.set(x, y, z);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), shineMat);
    hl.position.set(-0.25, 0.35, 0.3);
    o.add(hl);
    root.add(o);
    orbs.push(o);
  }

  animators.push((dt, time) => {
    for (const b of bubbles) {
      b.mesh.position.y += b.speed * dt;
      b.mesh.position.x = b.baseX + Math.sin(time * 0.8 + b.phase) * 0.8;
      if (b.mesh.position.y > 42) b.mesh.position.y = -8;
    }
    orbs.forEach((o, i) => {
      o.position.y += Math.sin(time * 1.2 + i) * 0.004;
    });
  });

  // =====================================================
  // COLLECTIBLES (aqua crystals & golden acorns)
  // =====================================================
  collectibles.push(
    createCollectible('a1', 'sun_crystal', new THREE.Vector3(6, 1.2, 5)),
    createCollectible('a2', 'golden_acorn', new THREE.Vector3(-9, 1.2, -3)),
    createCollectible('a3', 'sun_crystal', new THREE.Vector3(2.5, 3.0, 25.5)),
    createCollectible('a4', 'sun_crystal', new THREE.Vector3(0, 6.6, 33.2)),
    createCollectible('a5', 'golden_acorn', new THREE.Vector3(9, 8.6, 54)),
    createCollectible('a6', 'sun_crystal', new THREE.Vector3(6, 9.6, 59.5)),
    createCollectible('a7', 'sun_crystal', new THREE.Vector3(-2, 16.8, 76.5)),
    createCollectible('a8', 'golden_acorn', new THREE.Vector3(-2, 18.6, 90)),
    createCollectible('a9', 'sun_crystal', new THREE.Vector3(3.5, 20.4, 104)),
    createCollectible('a10', 'golden_acorn', new THREE.Vector3(3, 24.0, 123)),
    createCollectible('a11', 'sun_crystal', new THREE.Vector3(-2.5, 25.3, 125.5)),
    createCollectible('a_master', 'sun_crystal', new THREE.Vector3(-2.5, summitY + 2.4, 144))
  );
  collectibles.forEach((c) => root.add(c.group));

  // =====================================================
  // CORRUPTED ENEMIES (they don't belong in this glossy world!)
  // =====================================================
  const enemyManager = new EnemyManager(root, textures);
  enemyManager.spawnGlitchCube('glitch_1', new THREE.Vector3(-1.9, 5.0, 37), 'z', 1.9);
  enemyManager.spawnErrorPopup('error_1', new THREE.Vector3(0.5, 10.6, 68), 'x', 2.2);
  enemyManager.spawnGlitchCube('glitch_2', new THREE.Vector3(-2, 18.0, 98), 'x', 1.8);
  enemyManager.spawnErrorPopup('error_2', new THREE.Vector3(6.5, 23.6, 121.5), 'x', 2.0);
  enemyManager.spawnGlitchCube('glitch_3', new THREE.Vector3(-7, summitY, 147.5), 'x', 3.0);

  return {
    platforms,
    checkpoints,
    collectibles,
    obstacles: [],
    rollingBalls: [],
    pinwheels: [],
    balanceLogs: [],
    steamVents: [],
    solidObstacles,
    decorativeMeshes,
    summitPosition: summitPos,
    enemyManager,
    itemSpots: [
      { type: 'baya', pos: new THREE.Vector3(-4, 0.95, 6) },
      { type: 'nuez', pos: new THREE.Vector3(5, 0.95, -6) },
      { type: 'baya', pos: new THREE.Vector3(2, 5.95, 38.5) },
      { type: 'baya', pos: new THREE.Vector3(3, 8.35, 53.5) },
      { type: 'nuez', pos: new THREE.Vector3(-4.5, 18.15, 83.5) },
      { type: 'baya', pos: new THREE.Vector3(11.5, 22.55, 118.5) },
    ],
    levelUpdate: (dt, time) => {
      for (const a of animators) a(dt, time);
    },
  };
}
