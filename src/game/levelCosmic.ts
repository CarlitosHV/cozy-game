/**
 * LEVEL 2 — "Ruta Cósmica" (Estelita's level)
 * Space station deck → floating asteroids → star trampoline → Saturn ring chunks →
 * tractor beam → nebula bridge & crystals → gravity beam → Observatory summit.
 * Enemies: one-eyed alien blobs and little UFOs with tractor gusts.
 */
import * as THREE from 'three';
import { EnemyManager } from './enemies';
import { BouncyMushroomModel } from './models';
import { ProceduralTextures } from './textures';
import { WorldBuildResult } from './levels';
import { createLevelKit, makeGlowTexture } from './levelKit';

export function buildCosmicWorld(root: THREE.Object3D, textures: ProceduralTextures): WorldBuildResult {
  const kit = createLevelKit(root, textures);
  const { addPlatform, animators } = kit;

  // ---------------- Materials ----------------
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x2b2550, roughness: 0.45, metalness: 0.7 });
  const deckTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#4b4380';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#2b2550';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 128; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
    ctx.fillStyle = '#7dd3fc';
    for (let i = 16; i < 128; i += 32) for (let j = 16; j < 128; j += 32) ctx.fillRect(i - 1, j - 1, 2, 2);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.4, metalness: 0.5 });
  const glowCyan = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  const glowPink = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6385, roughness: 0.95, flatShading: true });
  const rockDark = new THREE.MeshStandardMaterial({ color: 0x46405e, roughness: 0.95, flatShading: true });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xb197fc,
    roughness: 0.08,
    metalness: 0.2,
    transparent: true,
    opacity: 0.72,
    emissive: 0x5b21b6,
    emissiveIntensity: 0.45,
  });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.8, emissive: 0xb45309, emissiveIntensity: 0.4 });

  // ---------------- Platform styles ----------------
  const station = (g: THREE.Group, w: number, d: number, h: number) => {
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [hullMat, hullMat, deckMat, hullMat, hullMat, hullMat]);
    top.position.y = -h / 2;
    top.receiveShadow = true;
    top.castShadow = true;
    (deckMat.map as THREE.Texture).repeat.set(4, 4);
    g.add(top);
    // Glowing edge strips
    const strips: [number, number, number, number][] = [
      [w, 0.08, 0, d / 2],
      [w, 0.08, 0, -d / 2],
      [0.08, d, w / 2, 0],
      [0.08, d, -w / 2, 0],
    ];
    strips.forEach(([sw, sd, x, z], i) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.06, 0.08, sd + 0.06), i % 2 ? glowPink : glowCyan);
      s.position.set(x, -0.05, z);
      g.add(s);
    });
    // Underside thrusters
    const thr = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.22, Math.min(w, d) * 0.12, h * 1.5, 12), hullMat);
    thr.position.y = -h - h * 0.75;
    g.add(thr);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(Math.min(w, d) * 0.1, 2.2, 12),
      new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    flame.rotation.x = Math.PI;
    flame.position.y = -h - h * 1.5 - 1.1;
    g.add(flame);
    animators.push((_dt, time) => (flame.scale.y = 1 + Math.sin(time * 18 + w) * 0.15));
  };

  const asteroid = (g: THREE.Group, w: number, d: number, h: number) => {
    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rockMat);
    core.position.y = -h / 2;
    core.receiveShadow = true;
    core.castShadow = true;
    g.add(core);
    // Lumpy chunks hugging the sides and bottom (always below the walkable top)
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = Math.min(w, d) * (0.28 + (i % 3) * 0.06);
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), i % 2 ? rockMat : rockDark);
      chunk.position.set(Math.cos(a) * w * 0.42, -h * 0.55 - (i % 2) * 0.3, Math.sin(a) * d * 0.42);
      chunk.rotation.set(i, i * 2, i * 3);
      g.add(chunk);
    }
    const bottom = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.min(w, d) * 0.55, 0), rockDark);
    bottom.position.y = -h - Math.min(w, d) * 0.25;
    g.add(bottom);
  };

  const crystal = (g: THREE.Group, w: number, d: number, h: number) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crystalMat);
    slab.position.y = -h / 2;
    slab.receiveShadow = true;
    g.add(slab);
    for (const [bw, bd, x, z] of [
      [w + 0.1, 0.1, 0, d / 2],
      [w + 0.1, 0.1, 0, -d / 2],
      [0.1, d, w / 2, 0],
      [0.1, d, -w / 2, 0],
    ] as [number, number, number, number][]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, bd), glowPink);
      e.position.set(x, -0.04, z);
      g.add(e);
    }
    // Hanging crystal shards underneath
    for (let i = 0; i < 4; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 + (i % 2) * 0.2, 0), crystalMat);
      shard.scale.y = 2.2;
      shard.position.set((i % 2 ? 1 : -1) * w * 0.25, -h - 0.6 - (i % 3) * 0.3, (i < 2 ? 1 : -1) * d * 0.25);
      g.add(shard);
    }
  };

  const starBridge = (g: THREE.Group, w: number, d: number, h: number) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat);
    slab.position.y = -h / 2;
    slab.receiveShadow = true;
    g.add(slab);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xfff7c2 }));
      s.position.set((i % 2 ? 1 : -1) * (w / 2 + 0.3), 0.3, -d / 2 + (i + 0.5) * (d / 6));
      g.add(s);
      animators.push((_dt, time) => {
        s.rotation.y = time * 2 + i;
        s.position.y = 0.3 + Math.sin(time * 3 + i) * 0.12;
      });
    }
  };

  /** Star trampoline: same physics interface as the bouncy mushroom. */
  function createStarTrampoline(): BouncyMushroomModel {
    const group = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 20), hullMat);
    stalk.position.y = 0.25;
    group.add(stalk);
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 1.45 : 0.7;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 });
    geom.rotateX(-Math.PI / 2);
    const cap = new THREE.Mesh(geom, goldMat);
    cap.position.y = 0.6;
    cap.castShadow = true;
    group.add(cap);
    let tb = -1;
    let amp = 0.25;
    return {
      group,
      cap,
      stalk,
      triggerBounce: (superBounce = false) => {
        tb = 0;
        amp = superBounce ? 0.45 : 0.3;
      },
      update: (dt: number) => {
        cap.rotation.y += dt * 0.6;
        if (tb >= 0) {
          tb += dt;
          const p = tb / 0.9;
          if (p >= 1) {
            tb = -1;
            cap.scale.set(1, 1, 1);
          } else {
            const sq = 1 - Math.sin(p * Math.PI * 3) * Math.exp(-p * 3.8) * amp;
            cap.scale.set(1 + (1 - sq) * 0.4, sq, 1 + (1 - sq) * 0.4);
          }
        }
      },
    };
  }

  // =====================================================
  // ZONE 1: PUERTO ESTELAR (space station & asteroids)
  // =====================================================
  addPlatform('station', 0, 0, 0, 24, 22, 2, station);
  kit.addCheckpoint(1, 'Puerto Estelar', new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(0, 0.2, 0), true);

  // Antenna & satellite dish decor on the station (with colliders)
  const antenna = new THREE.Group();
  antenna.position.set(-8, 0, -6);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6, 8), hullMat);
  mast.position.y = 3;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), glowPink);
  beacon.position.y = 6.1;
  antenna.add(mast, beacon);
  kit.addDecor(antenna);
  kit.registerCylinder('antenna', -8, 0, -6, 0.3, 6);
  animators.push((_dt, time) => (beacon.visible = Math.floor(time * 2) % 2 === 0));

  const dish = new THREE.Group();
  dish.position.set(8, 0, -5);
  const dishPost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 10), hullMat);
  dishPost.position.y = 1;
  const dishBowl = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4),
    new THREE.MeshStandardMaterial({ color: 0xd4d4f7, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide })
  );
  dishBowl.rotation.x = Math.PI + 0.8;
  dishBowl.position.y = 2.4;
  dish.add(dishPost, dishBowl);
  kit.addDecor(dish);
  kit.registerCylinder('dish', 8, 0, -5, 0.6, 3);
  animators.push((dt) => (dish.rotation.y += dt * 0.3));

  addPlatform('asteroid_1', 3, 0.5, 15, 3.2, 3.2, 1.2, asteroid);
  const ast2 = addPlatform('asteroid_moving', 3, 1.0, 20.5, 3.5, 3.5, 1.2, asteroid);
  kit.makeMoving(ast2, 'x', 2.5, 0.8);
  addPlatform('asteroid_3', -1, 1.6, 26, 3.2, 3.2, 1.2, asteroid);
  const meteor = addPlatform('meteor_crumble', -4, 2.2, 30.5, 3, 3, 1.0, asteroid);
  kit.makeCrumbling(meteor);

  addPlatform('tramp_rock', -4, 2.8, 36.5, 5, 5, 1.5, asteroid);
  kit.addBouncy('star_trampoline', createStarTrampoline(), -4, 2.8, 36.5);
  addPlatform('high_crystal', -4, 5.6, 42.5, 6, 6, 0.6, crystal);

  // =====================================================
  // ZONE 2: ANILLOS DE SATURNO
  // =====================================================
  addPlatform('ring_station', -2, 6.4, 52, 10, 9, 2, station);
  kit.addCheckpoint(2, 'Anillos de Saturno', new THREE.Vector3(-5.5, 6.4, 49.5), new THREE.Vector3(-2, 6.6, 53));

  addPlatform('ring_chunk_1', 4, 7.0, 59, 3, 3, 0.8, asteroid);
  addPlatform('ring_chunk_2', 8.5, 7.6, 62.5, 3, 3, 0.8, asteroid);
  addPlatform('ring_chunk_3', 12.5, 8.2, 66.5, 3, 3, 0.8, asteroid);
  const chunk4 = addPlatform('ring_chunk_moving', 12.5, 8.8, 72, 3.2, 3.2, 0.8, asteroid);
  kit.makeMoving(chunk4, 'z', 1.5, 0.9);

  addPlatform('beam_pad', 9, 9.4, 78, 5, 5, 1.5, station);
  kit.addUpdraft('tractor_beam', 9, 9.4, 78, 15, 4.6, 0xc084fc);

  addPlatform('glide_crystal', 9, 15.0, 83.5, 4.8, 4.8, 0.5, crystal);

  // =====================================================
  // ZONE 3: NEBULOSA
  // =====================================================
  addPlatform('nebula_dock', 9, 16.8, 89.5, 8, 6, 2.5, station);
  kit.addCheckpoint(3, 'Nebulosa Violeta', new THREE.Vector3(12, 16.8, 88.2), new THREE.Vector3(8, 17.0, 90));
  addPlatform('star_bridge', 9, 16.8, 97, 2.6, 9, 0.4, starBridge);
  addPlatform('nebula_crystal_1', 5, 17.6, 104.5, 4, 4, 0.6, crystal);
  const lift = addPlatform('crystal_lift', 0, 18.6, 109, 3.5, 3.5, 0.5, crystal);
  kit.makeMoving(lift, 'y', 1.0, 0.8);
  addPlatform('nebula_crystal_2', -4, 20.2, 114.5, 4.5, 4.5, 0.6, crystal);
  const shard = addPlatform('crumble_crystal', -1, 21.4, 119.5, 3.5, 3.5, 0.5, crystal);
  kit.makeCrumbling(shard);
  addPlatform('gravity_pad', 2.5, 22.6, 124.5, 5, 5, 1.5, station);
  kit.addUpdraft('gravity_beam', 2.5, 22.6, 124.5, 13, 4.2, 0xf0abfc);

  // =====================================================
  // SUMMIT: OBSERVATORIO ESTELAR
  // =====================================================
  const summitY = 31.1;
  addPlatform('observatory', 2.5, summitY, 134.5, 16, 14, 3, station);
  const summitPos = new THREE.Vector3(2.5, summitY + 0.2, 134.5);
  const domeGroup = new THREE.Group();
  domeGroup.position.set(-2.5, summitY, 139);
  const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1.2, 28), hullMat);
  domeBase.position.y = 0.6;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe0e7ff, roughness: 0.25, metalness: 0.6 })
  );
  dome.position.y = 1.2;
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.2, 6.2), new THREE.MeshBasicMaterial({ color: 0x0a0720 }));
  slit.position.y = 2.4;
  slit.rotation.z = 0.5;
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4.2, 14), goldMat);
  scope.position.set(0.9, 3.4, 0);
  scope.rotation.z = -0.9;
  domeGroup.add(domeBase, dome, slit, scope);
  kit.addDecor(domeGroup);
  kit.registerCylinder('observatory_dome', -2.5, summitY, 139, 3.2, 4.5);
  animators.push((dt) => (domeGroup.rotation.y += dt * 0.08));
  addPlatform('obs_step', 7, summitY + 1.1, 137.5, 2.2, 2.2, 1.1, crystal);

  // =====================================================
  // SPACE DECOR: stars, nebulae, planets, comets, debris
  // =====================================================
  const starCount = 2600;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(0xc7d2fe), new THREE.Color(0xfde68a), new THREE.Color(0xf9a8d4)];
  for (let i = 0; i < starCount; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = 260 + Math.random() * 60;
    const s = Math.sqrt(1 - u * u);
    starPos[i * 3] = Math.cos(th) * s * r;
    starPos[i * 3 + 1] = u * r * 0.8 + 20;
    starPos[i * 3 + 2] = Math.sin(th) * s * r + 70;
    const c = palette[i % palette.length];
    starCol.set([c.r, c.g, c.b], i * 3);
  }
  const starGeom = new THREE.BufferGeometry();
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeom.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starField = new THREE.Points(
    starGeom,
    new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: 0.95, depthWrite: false })
  );
  kit.addDecor(starField);

  const nebulaColors: [string, number, number, number, number][] = [
    ['rgba(168,85,247,0.55)', -140, 60, 160, 170],
    ['rgba(56,189,248,0.45)', 150, 30, 120, 150],
    ['rgba(244,114,182,0.45)', 40, 90, 260, 200],
    ['rgba(99,102,241,0.5)', -90, -40, 40, 140],
  ];
  for (const [col, x, y, z, s] of nebulaColors) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeGlowTexture(col), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
    );
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(s);
    kit.addDecor(sprite);
  }

  // Gas giant with rings (the "Saturn" of zone 2)
  const giant = new THREE.Group();
  giant.position.set(30, -4, 66);
  const bandTex = (() => {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const cols = ['#f59e0b', '#fbbf24', '#d97706', '#fde68a', '#ea580c', '#fcd34d'];
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(0, i * 8, 8, 8);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const planet = new THREE.Mesh(new THREE.SphereGeometry(13, 40, 28), new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.7, fog: false }));
  giant.add(planet);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(17, 27, 64),
    new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, fog: false })
  );
  ring.rotation.x = Math.PI / 2 - 0.35;
  giant.add(ring);
  kit.addDecor(giant);
  animators.push((dt) => (planet.rotation.y += dt * 0.05));

  const bluePlanet = new THREE.Mesh(
    new THREE.SphereGeometry(9, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5, emissive: 0x1e3a8a, emissiveIntensity: 0.3, fog: false })
  );
  bluePlanet.position.set(-70, 40, 170);
  kit.addDecor(bluePlanet);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 18), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.9, fog: false, flatShading: true }));
  moon.position.set(-35, 55, 40);
  kit.addDecor(moon);

  // Comets streaking across the sky
  const comets: { m: THREE.Mesh; speed: number; start: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.25, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.8, fog: false, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const start = new THREE.Vector3(-120 + i * 60, 70 + i * 8, 40 + i * 40);
    const dir = new THREE.Vector3(1, -0.35, 0.2).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    kit.addDecor(m);
    comets.push({ m, speed: 40 + i * 8, start, dir });
  }
  animators.push((_dt, time) => {
    comets.forEach((c, i) => {
      const t = (time * 0.12 + i * 0.27) % 1;
      c.m.position.copy(c.start).addScaledVector(c.dir, t * 260);
      c.m.visible = t < 0.85;
    });
  });

  // Floating debris rocks
  const debris: THREE.Mesh[] = [];
  for (let i = 0; i < 26; i++) {
    const d = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.9, 0), i % 2 ? rockMat : rockDark);
    const side = i % 2 ? 1 : -1;
    d.position.set(side * (14 + Math.random() * 18), -8 + Math.random() * 40, -10 + Math.random() * 150);
    kit.addDecor(d);
    debris.push(d);
  }
  animators.push((dt, time) => {
    debris.forEach((d, i) => {
      d.rotation.x += dt * (0.2 + (i % 5) * 0.1);
      d.rotation.y += dt * 0.15;
      d.position.y += Math.sin(time * 0.6 + i) * 0.003;
    });
  });

  // =====================================================
  // COLLECTIBLES
  // =====================================================
  kit.addCollectible('s1', 'sun_crystal', 6, 1.2, 4);
  kit.addCollectible('s2', 'golden_acorn', -7, 1.2, -5);
  kit.addCollectible('s3', 'sun_crystal', 3, 2.4, 20.5);
  kit.addCollectible('s4', 'sun_crystal', -1, 3.0, 26);
  kit.addCollectible('s5', 'sun_crystal', -4, 6.6, 39.2);
  kit.addCollectible('s6', 'golden_acorn', 2, 7.6, 54);
  kit.addCollectible('s7', 'sun_crystal', 12.5, 9.4, 66.5);
  kit.addCollectible('s8', 'sun_crystal', 9, 16.4, 83.5);
  kit.addCollectible('s9', 'golden_acorn', 9, 18.2, 97);
  kit.addCollectible('s10', 'sun_crystal', -4, 21.4, 114.5);
  kit.addCollectible('s11', 'sun_crystal', -1, 22.7, 119.5);
  kit.addCollectible('s_master', 'sun_crystal', 7, summitY + 2.4, 137.5);

  // =====================================================
  // ENEMIES (alien blobs & UFOs)
  // =====================================================
  const enemies = new EnemyManager(root, textures);
  enemies.spawnAlienBlob('blob_1', new THREE.Vector3(-5.9, 5.6, 42.5), 'z', 1.9);
  enemies.spawnAlienBlob('blob_2', new THREE.Vector3(-4, 6.4, 54.5), 'x', 2.0);
  enemies.spawnUfo('ufo_1', new THREE.Vector3(10.5, 9.0, 64.5), 'x', 2.0);
  enemies.spawnUfo('ufo_2', new THREE.Vector3(2.5, 19.6, 107), 'z', 2.0);
  enemies.spawnAlienBlob('blob_3', new THREE.Vector3(2.5, summitY, 140), 'x', 3.0);

  return kit.finish(
    summitPos,
    enemies,
    [
      { type: 'baya', pos: new THREE.Vector3(-5, 0.95, 3) },
      { type: 'nuez', pos: new THREE.Vector3(6, 0.95, -5) },
      { type: 'baya', pos: new THREE.Vector3(-2.5, 6.55, 44) },
      { type: 'baya', pos: new THREE.Vector3(-5, 7.35, 55) },
      { type: 'nuez', pos: new THREE.Vector3(10.5, 17.75, 91) },
      { type: 'baya', pos: new THREE.Vector3(-4.5, 21.15, 115.5) },
    ],
    new THREE.Vector3(-3, summitY + 6.5, 135)
  );
}
