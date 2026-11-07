/**
 * Far scenery painted around the horizon of each world (graphics quality "Alta" only).
 * It follows you, so it always stays far away like the sky:
 *
 *  - cozy     Archipiélago: pastel mountains, a rainbow, hot-air balloons and a windmill.
 *  - aero     Valle Aero: a green meadow of rolling hills with glossy glass towers, a dome
 *             city on a floating island, wind turbines and drifting airships (Frutiger Aero).
 *  - cosmic   Ruta Cósmica: stars, nebulae, a ringed gas giant, a blue planet and a black hole
 *             with a glowing accretion disk bent around it (Interstellar style).
 *  - swamp    Pantano: misty silhouettes of huge dead trees and hills, a sickly moon, will-o'-wisps.
 *  - garden   Jardín Gigante: giant sunflowers, tulips and daisies, grass blades and a picket fence.
 *  - castle   Castillo: a dark castle with lit windows on a crag, jagged peaks and dead trees.
 *  - backrooms (indoors): nothing.
 *
 * Nothing here takes part in the game, and nothing is affected by the fog.
 */
import * as THREE from 'three';
import type { ThemeId } from './progress';

export interface Backdrop {
  group: THREE.Group;
  update: (dt: number, time: number) => void;
}

type Rng = () => number;

const R = 200; // distance of the scenery (the camera sees up to 250 m)

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const glowTex = (inner: string, outer = 'rgba(0,0,0,0)') =>
  canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer);
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });

/** Point on the horizon ring: angle around you, distance, height. */
const at = (az: number, r: number, y: number) => new THREE.Vector3(Math.sin(az) * r, y, Math.cos(az) * r);

function lambert(color: number, extra: THREE.MeshLambertMaterialParameters = {}) {
  return new THREE.MeshLambertMaterial({ color, fog: false, ...extra });
}
function basic(color: number, extra: THREE.MeshBasicMaterialParameters = {}) {
  return new THREE.MeshBasicMaterial({ color, fog: false, ...extra });
}
function glowSprite(tex: THREE.Texture, scale: number, opacity = 1, color = 0xffffff) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale);
  return s;
}
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos?: THREE.Vector3) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.copy(pos);
  return m;
}

/** A starfield on a big sphere around you. */
function stars(g: THREE.Group, rng: Rng, n: number, radius: number, minY = -0.15) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = rng() * Math.PI * 2;
    const y = minY + rng() * (1 - minY);
    const r = Math.sqrt(1 - y * y);
    pos.push(Math.cos(u) * r * radius, y * radius, Math.sin(u) * r * radius);
    c.setHSL(rng() < 0.5 ? 0.6 : 0.12, 0.5, 0.75 + rng() * 0.25);
    col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.5, vertexColors: true, fog: false, transparent: true, opacity: 0.95, depthWrite: false }));
  pts.frustumCulled = false;
  g.add(pts);
  return pts;
}

// ======================================================================== Cosmic
function cosmic(g: THREE.Group, rng: Rng): Backdrop['update'] {
  const starPts = stars(g, rng, 1800, 228, -0.6);
  // Nebulae
  const neb = [
    ['rgba(168,85,247,0.55)', 0.4, 60, 150],
    ['rgba(34,211,238,0.45)', 2.2, 90, 130],
    ['rgba(244,114,182,0.45)', 3.6, 40, 160],
    ['rgba(99,102,241,0.5)', 5.2, 110, 140],
  ] as const;
  for (const [c, az, y, s] of neb) {
    const sp = glowSprite(glowTex(c), s, 0.55);
    sp.position.copy(at(az, R + 15, y));
    g.add(sp);
  }

  // --- Black hole with its accretion disk (Interstellar style) ---
  const bh = new THREE.Group();
  bh.position.copy(at(0.55, R - 5, 32));
  g.add(bh);
  bh.lookAt(0, 0, 0);
  const core = mesh(new THREE.SphereGeometry(15, 40, 28), basic(0x000000));
  bh.add(core);
  // Disk texture: hot white inside, orange, deep red, with swirling streaks
  const diskTex = canvasTexture(512, 512, (ctx) => {
    const gr = ctx.createRadialGradient(256, 256, 70, 256, 256, 256);
    gr.addColorStop(0, 'rgba(255,255,245,1)');
    gr.addColorStop(0.18, 'rgba(255,236,190,1)');
    gr.addColorStop(0.4, 'rgba(255,170,80,0.95)');
    gr.addColorStop(0.7, 'rgba(200,70,30,0.55)');
    gr.addColorStop(1, 'rgba(80,10,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) {
      const r = 80 + Math.random() * 170;
      const a0 = Math.random() * Math.PI * 2;
      ctx.strokeStyle = `rgba(255,${180 + Math.floor(Math.random() * 70)},${120 + Math.floor(Math.random() * 80)},${0.08 + Math.random() * 0.12})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      ctx.arc(256, 256, r, a0, a0 + 0.4 + Math.random() * 1.2);
      ctx.stroke();
    }
  });
  const diskMat = basic(0xffffff, { map: diskTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const disk = mesh(new THREE.RingGeometry(17, 60, 128, 1), diskMat);
  // Almost edge-on, slightly tilted, like the movie
  const diskHolder = new THREE.Group();
  diskHolder.rotation.x = Math.PI / 2 - 0.13;
  diskHolder.rotation.z = -0.18;
  diskHolder.add(disk);
  bh.add(diskHolder);
  // The light of the far side of the disk bent over and under the hole (a ring facing you)
  const haloTex = canvasTexture(256, 256, (ctx) => {
    const gr = ctx.createRadialGradient(128, 128, 56, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,250,235,0)');
    gr.addColorStop(0.06, 'rgba(255,248,225,1)');
    gr.addColorStop(0.25, 'rgba(255,200,120,0.7)');
    gr.addColorStop(0.6, 'rgba(230,110,40,0.25)');
    gr.addColorStop(1, 'rgba(120,30,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 256, 256);
  });
  const halo = mesh(new THREE.RingGeometry(15.2, 34, 96, 1), basic(0xffffff, { map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.z = -1; // just behind the core (the core hides its middle)
  bh.add(halo);
  const bhGlow = glowSprite(glowTex('rgba(255,170,90,0.55)'), 150, 0.6);
  bhGlow.position.z = -4;
  bh.add(bhGlow);
  core.renderOrder = 1;
  disk.renderOrder = 2;

  // --- Ringed gas giant ---
  const bandTex = canvasTexture(64, 256, (ctx) => {
    const cols = ['#e9c99a', '#d4a373', '#f1dcb5', '#b9805a', '#e6c08f', '#c98f5f', '#f4e3c3'];
    let y = 0;
    while (y < 256) {
      const h = 6 + Math.random() * 22;
      ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
      ctx.fillRect(0, y, 64, h);
      y += h;
    }
  });
  const giant = new THREE.Group();
  giant.position.copy(at(2.55, R, 26));
  g.add(giant);
  const giantBall = mesh(new THREE.SphereGeometry(24, 40, 28), lambert(0xffffff, { map: bandTex, emissive: 0x3a2412, emissiveIntensity: 0.35 }));
  giant.add(giantBall);
  const ringTex = canvasTexture(256, 256, (ctx) => {
    for (let r = 128; r > 0; r -= 1) {
      const k = r / 128;
      if (k < 0.62) break;
      const a = 0.25 + 0.5 * Math.abs(Math.sin(r * 0.45)) * (k > 0.95 ? 0.3 : 1);
      ctx.strokeStyle = `rgba(${220 - Math.floor(k * 40)},${190 - Math.floor(k * 30)},150,${a})`;
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  const rings = mesh(new THREE.RingGeometry(30, 50, 96, 1), basic(0xffffff, { map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  rings.rotation.x = Math.PI / 2 - 0.35;
  rings.rotation.y = 0.3;
  giant.add(rings);

  // --- Blue ocean planet with clouds and a soft atmosphere ---
  const oceanTex = canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#1e5fbf';
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(52,168,83,0.85)' : 'rgba(250,250,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, 20 + Math.random() * 88, 8 + Math.random() * 26, 4 + Math.random() * 10, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const blue = mesh(new THREE.SphereGeometry(10, 32, 24), lambert(0xffffff, { map: oceanTex, emissive: 0x0b2350, emissiveIntensity: 0.4 }), at(4.05, R - 10, 78));
  g.add(blue);
  const atmo = glowSprite(glowTex('rgba(125,211,252,0.6)'), 34, 0.8);
  atmo.position.copy(blue.position);
  g.add(atmo);
  // A small red moon and a pale one
  g.add(mesh(new THREE.SphereGeometry(5, 20, 14), lambert(0xc2410c, { emissive: 0x401006, emissiveIntensity: 0.6 }), at(4.6, R + 10, 22)));
  g.add(mesh(new THREE.SphereGeometry(3.2, 16, 12), lambert(0xd6d3d1, { emissive: 0x2a2a2a }), at(2.15, R - 20, 62)));

  return (dt, time) => {
    disk.rotation.z += dt * 0.08;
    giantBall.rotation.y += dt * 0.02;
    blue.rotation.y += dt * 0.05;
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.9 + Math.sin(time * 0.7) * 0.1;
    (starPts.material as THREE.PointsMaterial).opacity = 0.85 + Math.sin(time * 1.3) * 0.1;
  };
}

// ======================================================================== Aero
function aero(g: THREE.Group, rng: Rng): Backdrop['update'] {
  // Rolling meadow hills all around (a little below you)
  const greens = [0x7ed957, 0x95e06c, 0x6cc644, 0xa6e77f];
  for (let i = 0; i < 26; i++) {
    const az = (i / 26) * Math.PI * 2 + rng() * 0.2;
    const s = 38 + rng() * 34;
    const hill = mesh(new THREE.SphereGeometry(s, 20, 12), lambert(greens[i % greens.length]), at(az, R - 5 + rng() * 15, -46));
    hill.scale.y = 0.38 + rng() * 0.12;
    g.add(hill);
  }
  // little white flower dots on the hills
  const dotGeo = new THREE.SphereGeometry(0.9, 6, 4);
  const dotMat = basic(0xffffff);
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, 220);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 220; i++) {
    const az = rng() * Math.PI * 2;
    m4.makeTranslation(...at(az, R - 30 + rng() * 15, -27 + rng() * 6).toArray());
    dots.setMatrixAt(i, m4);
  }
  dots.frustumCulled = false;
  g.add(dots);

  // Glossy glass with a sky reflection running up it (vertical gradient)
  const glassTex = canvasTexture(16, 128, (ctx) => {
    const gr = ctx.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#e0f7ff');
    gr.addColorStop(0.45, '#7dd3fc');
    gr.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 16, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = 4; y < 128; y += 8) ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(3, 0, 2, 128);
  });
  const glass = new THREE.MeshPhongMaterial({ color: 0xffffff, map: glassTex, specular: 0xffffff, shininess: 140, fog: false, emissive: 0x0c4a6e, emissiveIntensity: 0.2 });
  const white = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 90, fog: false });
  const aqua = new THREE.MeshPhongMaterial({ color: 0x38bdf8, specular: 0xffffff, shininess: 140, fog: false, emissive: 0x0c4a6e, emissiveIntensity: 0.3 });
  const leaf = lambert(0x4ade80);
  const turbines: THREE.Object3D[] = [];
  const floaters: { o: THREE.Object3D; y: number; ph: number }[] = [];
  const ships: { o: THREE.Object3D; az: number; sp: number; r: number; y: number }[] = [];

  /** Rounded glass tower with white rings and a garden on top */
  const tower = (az: number, h: number, r: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R, -30));
    t.add(mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 28), glass, new THREE.Vector3(0, h / 2, 0)));
    for (let y = 8; y < h; y += 9) t.add(mesh(new THREE.TorusGeometry(r * 0.95, 0.5, 6, 32), white, new THREE.Vector3(0, y, 0)).rotateX(Math.PI / 2));
    t.add(mesh(new THREE.SphereGeometry(r * 0.86, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, new THREE.Vector3(0, h, 0)));
    t.add(mesh(new THREE.SphereGeometry(r * 0.5, 12, 8), leaf, new THREE.Vector3(0, h + r * 0.15, 0)));
    t.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, r * 1.6, 6), white, new THREE.Vector3(0, h + r * 1.3, 0)));
    t.add(mesh(new THREE.SphereGeometry(1.2, 10, 8), aqua, new THREE.Vector3(0, h + r * 2.1, 0)));
    g.add(t);
    return t;
  };
  /** Twisting tower of rounded white floors with blue glass */
  const twist = (az: number, floors: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R + 5, -30));
    for (let k = 0; k < floors; k++) {
      const f = mesh(new THREE.BoxGeometry(14, 3.4, 9), k % 2 ? aqua : white, new THREE.Vector3(0, 4 + k * 4, 0));
      f.rotation.y = k * 0.17;
      t.add(f);
    }
    t.add(mesh(new THREE.CylinderGeometry(2.6, 2.6, floors * 4 + 6, 12), glass, new THREE.Vector3(0, (floors * 4 + 6) / 2, 0)));
    g.add(t);
  };
  /** Big glass sphere on a slender stalk */
  const bubble = (az: number, h: number, r: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R - 5, -30));
    t.add(mesh(new THREE.CylinderGeometry(1.2, 2.4, h, 10), white, new THREE.Vector3(0, h / 2, 0)));
    t.add(mesh(new THREE.SphereGeometry(r, 28, 20), glass, new THREE.Vector3(0, h + r * 0.8, 0)));
    t.add(mesh(new THREE.TorusGeometry(r * 1.05, 0.6, 6, 40), white, new THREE.Vector3(0, h + r * 0.8, 0)).rotateX(Math.PI / 2 - 0.2));
    g.add(t);
  };
  /** Floating island with a dome city */
  const island = (az: number, y: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R - 10, y));
    t.add(mesh(new THREE.CylinderGeometry(20, 18, 4, 24), lambert(0x86d96b), new THREE.Vector3(0, 0, 0)));
    t.add(mesh(new THREE.ConeGeometry(18, 26, 18), lambert(0x8b7d6b), new THREE.Vector3(0, -15, 0)).rotateX(Math.PI));
    t.add(mesh(new THREE.SphereGeometry(13, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass, new THREE.Vector3(0, 2, 0)));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const hh = 6 + rng() * 9;
      t.add(mesh(new THREE.CylinderGeometry(1.4, 1.6, hh, 10), k % 2 ? white : aqua, new THREE.Vector3(Math.cos(a) * 6, 2 + hh / 2, Math.sin(a) * 6)));
    }
    const fall = mesh(new THREE.PlaneGeometry(3, 34), basic(0xd6f3ff, { transparent: true, opacity: 0.6, depthWrite: false }), new THREE.Vector3(0, -17, 18.5));
    t.add(fall);
    g.add(t);
    floaters.push({ o: t, y, ph: rng() * 6 });
  };
  /** Wind turbine on the hills */
  const turbine = (az: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R - 25, -30));
    t.add(mesh(new THREE.CylinderGeometry(0.6, 1.1, 30, 8), white, new THREE.Vector3(0, 15, 0)));
    const hub = new THREE.Group();
    hub.position.set(0, 30, 1.2);
    for (let k = 0; k < 3; k++) {
      const b = mesh(new THREE.BoxGeometry(1.2, 13, 0.3), white, new THREE.Vector3(0, 6.5, 0));
      const arm = new THREE.Group();
      arm.rotation.z = (k / 3) * Math.PI * 2;
      arm.add(b);
      hub.add(arm);
    }
    t.add(hub);
    t.lookAt(0, -30, 0);
    g.add(t);
    turbines.push(hub);
  };
  /** Glossy airship drifting around */
  const airship = (az: number, y: number, r: number) => {
    const t = new THREE.Group();
    const env = mesh(new THREE.SphereGeometry(5, 20, 14), aqua);
    env.scale.set(1, 1, 2.4);
    t.add(env);
    t.add(mesh(new THREE.BoxGeometry(2.2, 1.6, 4), white, new THREE.Vector3(0, -5.6, 0)));
    t.add(mesh(new THREE.ConeGeometry(2.2, 3, 4), white, new THREE.Vector3(0, 0, -12)).rotateX(-Math.PI / 2));
    g.add(t);
    ships.push({ o: t, az, sp: 0.01 + rng() * 0.01, r, y });
  };

  tower(0.3, 95, 7);
  tower(1.15, 70, 5.5);
  twist(1.9, 16);
  bubble(2.6, 55, 12);
  tower(3.3, 110, 8);
  island(3.95, 38);
  twist(4.6, 13);
  bubble(5.35, 40, 9);
  island(5.9, 52);
  // A big white arch standing on the meadow
  const arch = mesh(new THREE.TorusGeometry(30, 1.8, 10, 56, Math.PI), white, at(0.72, R + 2, -30));
  arch.lookAt(0, -30, 0);
  g.add(arch);
  for (const az of [0.9, 1.5, 2.25, 3.0, 3.6, 4.3, 5.0, 5.6]) turbine(az + rng() * 0.15);
  airship(0.8, 45, R - 30);
  airship(3.0, 60, R - 40);
  airship(4.9, 35, R - 35);

  return (dt, time) => {
    for (const h of turbines) h.rotation.z += dt * 1.4;
    for (const f of floaters) f.o.position.y = f.y + Math.sin(time * 0.35 + f.ph) * 2.5;
    for (const s of ships) {
      s.az += s.sp * dt;
      s.o.position.copy(at(s.az, s.r, s.y + Math.sin(time * 0.5 + s.r) * 2));
      s.o.rotation.y = s.az + Math.PI / 2;
    }
  };
}

// ======================================================================== Cozy (golden hour)
function cozy(g: THREE.Group, rng: Rng): Backdrop['update'] {
  const tints = [0xd8b4fe, 0xf9a8d4, 0xfcd5b5, 0xc4b5fd];
  for (let i = 0; i < 22; i++) {
    const az = (i / 22) * Math.PI * 2 + rng() * 0.15;
    const h = 45 + rng() * 55;
    const mnt = mesh(new THREE.ConeGeometry(28 + rng() * 22, h, 7), lambert(tints[i % tints.length], { flatShading: true, emissive: 0x3b2a4a, emissiveIntensity: 0.25 }), at(az, R + 10, -40 + h / 2));
    mnt.rotation.y = rng() * 3;
    g.add(mnt);
    if (h > 80) g.add(mesh(new THREE.ConeGeometry(9, h * 0.22, 7), lambert(0xffffff, { flatShading: true }), at(az, R + 10, -40 + h - h * 0.11)));
  }
  // Rainbow
  const rbTex = canvasTexture(8, 128, (ctx) => {
    const cols = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (i / cols.length) * 128, 8, 128 / cols.length + 1);
    });
  });
  const rainbow = mesh(new THREE.RingGeometry(70, 82, 64, 1, 0, Math.PI), basic(0xffffff, { map: rbTex, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }), at(1.8, R, -20));
  // map the bands across the ring width
  const uv = rainbow.geometry.getAttribute('uv') as THREE.BufferAttribute;
  const pos = rainbow.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, (Math.hypot(pos.getX(i), pos.getY(i)) - 70) / 12);
  rainbow.lookAt(0, -20, 0);
  g.add(rainbow);
  // Hot-air balloons
  const balloons: { o: THREE.Object3D; y: number; ph: number }[] = [];
  const bcols = [0xf87171, 0xfbbf24, 0x60a5fa, 0x34d399, 0xf472b6];
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Group();
    const env = mesh(new THREE.SphereGeometry(4, 16, 12), lambert(bcols[k], { emissive: bcols[k], emissiveIntensity: 0.2 }));
    env.scale.y = 1.2;
    b.add(env);
    b.add(mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), lambert(0x92400e), new THREE.Vector3(0, -6.5, 0)));
    const y = 20 + rng() * 40;
    b.position.copy(at(k * 1.25 + rng() * 0.4, R - 40 - rng() * 30, y));
    g.add(b);
    balloons.push({ o: b, y, ph: rng() * 6 });
  }
  // A windmill on a hill
  const mill = new THREE.Group();
  mill.position.copy(at(4.2, R - 20, -32));
  mill.add(mesh(new THREE.SphereGeometry(30, 16, 10), lambert(0x86c26b), new THREE.Vector3(0, -22, 0)));
  mill.add(mesh(new THREE.CylinderGeometry(3, 4.5, 16, 8), lambert(0xfff7ed), new THREE.Vector3(0, 14, 0)));
  mill.add(mesh(new THREE.ConeGeometry(4.2, 5, 8), lambert(0xb45309), new THREE.Vector3(0, 24.5, 0)));
  const sails = new THREE.Group();
  sails.position.set(0, 20, 4.6);
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.rotation.z = (k / 4) * Math.PI * 2;
    arm.add(mesh(new THREE.BoxGeometry(2.4, 11, 0.3), lambert(0xfef3c7), new THREE.Vector3(0, 6, 0)));
    sails.add(arm);
  }
  mill.add(sails);
  mill.lookAt(0, -32, 0);
  g.add(mill);
  return (dt, time) => {
    sails.rotation.z += dt * 0.6;
    for (const b of balloons) b.o.position.y = b.y + Math.sin(time * 0.3 + b.ph) * 3;
  };
}

// ======================================================================== Swamp (misty)
function swamp(g: THREE.Group, rng: Rng): Backdrop['update'] {
  const mist = (c: number, o: number) => basic(c, { transparent: true, opacity: o, depthWrite: false });
  const far = mist(0x16201a, 0.8);
  const near = mist(0x080d0a, 0.92);
  for (let i = 0; i < 18; i++) {
    const az = (i / 18) * Math.PI * 2 + rng() * 0.2;
    const hill = mesh(new THREE.SphereGeometry(45 + rng() * 30, 14, 10), far, at(az, R + 15, -48));
    hill.scale.y = 0.45;
    g.add(hill);
  }
  // Huge dead trees
  const tree = (az: number, h: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R - 10, -35));
    t.add(mesh(new THREE.CylinderGeometry(1.6, 4, h, 7), near, new THREE.Vector3(0, h / 2, 0)));
    for (let k = 0; k < 6; k++) {
      const y = h * (0.45 + k * 0.09);
      const len = 10 + rng() * 14;
      const b = mesh(new THREE.CylinderGeometry(0.3, 1.1, len, 5), near, new THREE.Vector3(0, y, 0));
      b.geometry.translate(0, len / 2, 0);
      b.rotation.set((rng() - 0.5) * 0.6, rng() * 6, (k % 2 ? 1 : -1) * (0.7 + rng() * 0.6));
      t.add(b);
    }
    g.add(t);
  };
  for (let k = 0; k < 9; k++) tree((k / 9) * Math.PI * 2 + rng() * 0.3, 55 + rng() * 40);
  // Sickly moon behind the mist
  const moon = glowSprite(glowTex('rgba(230,248,190,1)', 'rgba(140,170,110,0)'), 70, 0.95);
  const moonDisk = mesh(new THREE.CircleGeometry(11, 32), basic(0xe8f5c8));
  moonDisk.position.copy(at(2.4, R + 14, 85));
  moonDisk.lookAt(0, 0, 0);
  g.add(moonDisk);
  moon.position.copy(at(2.4, R + 10, 85));
  g.add(moon);
  // Will-o'-wisps
  const wisps: { s: THREE.Sprite; base: THREE.Vector3; ph: number }[] = [];
  const wt = glowTex('rgba(190,255,140,1)');
  for (let k = 0; k < 14; k++) {
    const s = glowSprite(wt, 4 + rng() * 3, 0.9);
    const base = at(rng() * Math.PI * 2, R - 40 - rng() * 40, -10 + rng() * 25);
    s.position.copy(base);
    g.add(s);
    wisps.push({ s, base, ph: rng() * 6 });
  }
  return (_dt, time) => {
    for (const w of wisps) {
      w.s.position.set(w.base.x + Math.sin(time * 0.4 + w.ph) * 6, w.base.y + Math.sin(time * 0.9 + w.ph) * 3, w.base.z + Math.cos(time * 0.3 + w.ph) * 6);
      (w.s.material as THREE.SpriteMaterial).opacity = 0.5 + Math.sin(time * 2 + w.ph) * 0.4;
    }
  };
}

// ======================================================================== Giant garden
function garden(g: THREE.Group, rng: Rng): Backdrop['update'] {
  const stemM = lambert(0x4d7c0f);
  const heads: THREE.Object3D[] = [];
  const sunflower = (az: number, h: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R, -40));
    t.add(mesh(new THREE.CylinderGeometry(1.4, 2.2, h, 8), stemM, new THREE.Vector3(0, h / 2, 0)));
    for (const s of [1, -1]) {
      const lf = mesh(new THREE.SphereGeometry(9, 10, 6), lambert(0x65a30d), new THREE.Vector3(s * 8, h * 0.45, 0));
      lf.scale.set(1, 0.25, 0.55);
      lf.rotation.z = s * 0.4;
      t.add(lf);
    }
    const head = new THREE.Group();
    head.position.set(0, h, 0);
    head.add(mesh(new THREE.CylinderGeometry(9, 9, 2.5, 24), lambert(0x78350f), undefined).rotateX(Math.PI / 2));
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const p = mesh(new THREE.SphereGeometry(4, 8, 6), lambert(0xfacc15, { emissive: 0x7a5200, emissiveIntensity: 0.25 }), new THREE.Vector3(Math.cos(a) * 12, Math.sin(a) * 12, 0));
      p.scale.set(0.55, 1.4, 0.25);
      p.rotation.z = a - Math.PI / 2;
      head.add(p);
    }
    t.add(head);
    head.lookAt(0, h - 40, 0);
    head.position.set(0, h, 0);
    g.add(t);
    heads.push(head);
  };
  const tulip = (az: number, h: number, color: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R - 12, -40));
    t.add(mesh(new THREE.CylinderGeometry(0.9, 1.3, h, 8), stemM, new THREE.Vector3(0, h / 2, 0)));
    const cup = mesh(new THREE.SphereGeometry(7, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), lambert(color, { emissive: color, emissiveIntensity: 0.15, side: THREE.DoubleSide }), new THREE.Vector3(0, h + 6, 0));
    cup.rotation.x = Math.PI;
    cup.scale.y = 1.3;
    t.add(cup);
    g.add(t);
  };
  const daisy = (az: number, h: number) => {
    const t = new THREE.Group();
    t.position.copy(at(az, R - 25, -40));
    t.add(mesh(new THREE.CylinderGeometry(0.7, 1, h, 8), stemM, new THREE.Vector3(0, h / 2, 0)));
    const head = new THREE.Group();
    head.position.set(0, h, 0);
    head.add(mesh(new THREE.SphereGeometry(2.6, 12, 8), lambert(0xfacc15)));
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const p = mesh(new THREE.SphereGeometry(2.2, 8, 6), lambert(0xffffff), new THREE.Vector3(Math.cos(a) * 5.5, Math.sin(a) * 5.5, 0));
      p.scale.set(0.5, 1.5, 0.2);
      p.rotation.z = a - Math.PI / 2;
      head.add(p);
    }
    t.add(head);
    head.lookAt(0, h - 40, 0);
    g.add(t);
  };
  // Grass blades wall
  const bladeGeo = new THREE.ConeGeometry(2.2, 1, 4);
  bladeGeo.translate(0, 0.5, 0);
  const blades = new THREE.InstancedMesh(bladeGeo, lambert(0x84cc16), 160);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  for (let i = 0; i < 160; i++) {
    const az = rng() * Math.PI * 2;
    const p = at(az, R - 35 + rng() * 25, -40);
    q.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.4, rng() * 3, (rng() - 0.5) * 0.4));
    sc.set(1, 35 + rng() * 45, 1);
    blades.setMatrixAt(i, m4.compose(p, q, sc));
  }
  blades.frustumCulled = false;
  g.add(blades);
  // A giant white picket fence on one side
  const fence = new THREE.Group();
  for (let k = -9; k <= 9; k++) {
    const p = mesh(new THREE.BoxGeometry(5, 46, 1.4), lambert(0xfafaf9), new THREE.Vector3(k * 8, 23, 0));
    fence.add(p, mesh(new THREE.ConeGeometry(3.6, 5, 4), lambert(0xfafaf9), new THREE.Vector3(k * 8, 48.5, 0)).rotateY(Math.PI / 4));
  }
  fence.add(mesh(new THREE.BoxGeometry(150, 4, 1), lambert(0xf5f5f4), new THREE.Vector3(0, 12, -1)));
  fence.add(mesh(new THREE.BoxGeometry(150, 4, 1), lambert(0xf5f5f4), new THREE.Vector3(0, 34, -1)));
  fence.position.copy(at(3.2, R + 15, -40));
  fence.lookAt(0, -40, 0);
  g.add(fence);
  sunflower(0.2, 110);
  sunflower(1.4, 95);
  sunflower(4.6, 120);
  sunflower(5.7, 100);
  const tc = [0xf472b6, 0xef4444, 0xa855f7, 0xfb923c];
  for (let k = 0; k < 8; k++) tulip(0.7 + k * 0.72 + rng() * 0.2, 45 + rng() * 25, tc[k % tc.length]);
  for (let k = 0; k < 7; k++) daisy(0.4 + k * 0.85 + rng() * 0.3, 30 + rng() * 18);
  return (_dt, time) => {
    heads.forEach((h, i) => (h.rotation.z = Math.sin(time * 0.3 + i) * 0.05));
  };
}

// ======================================================================== Haunted castle
function castle(g: THREE.Group, rng: Rng): Backdrop['update'] {
  const dark = basic(0x150f22);
  const darker = basic(0x0d0916);
  // Jagged peaks
  for (let i = 0; i < 26; i++) {
    const az = (i / 26) * Math.PI * 2 + rng() * 0.15;
    const h = 40 + rng() * 60;
    g.add(mesh(new THREE.ConeGeometry(14 + rng() * 14, h, 5), i % 2 ? dark : darker, at(az, R + 12, -45 + h / 2)));
  }
  // The castle on its crag, with lit windows
  const c = new THREE.Group();
  c.position.copy(at(1.2, R - 8, -40));
  c.add(mesh(new THREE.ConeGeometry(38, 55, 6), darker, new THREE.Vector3(0, 27, 0)));
  const winMat = basic(0xffc861);
  const windows: THREE.Mesh[] = [];
  const towerAt = (x: number, z: number, h: number, r: number) => {
    c.add(mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 10), dark, new THREE.Vector3(x, 50 + h / 2, z)));
    c.add(mesh(new THREE.ConeGeometry(r * 1.35, r * 3.2, 10), darker, new THREE.Vector3(x, 50 + h + r * 1.6, z)));
    for (let k = 0; k < 3; k++) {
      if (rng() < 0.3) continue;
      const w = mesh(new THREE.PlaneGeometry(1.2, 2), winMat.clone(), new THREE.Vector3(x, 52 + (k + 0.5) * (h / 3.2), z + r + 0.05));
      c.add(w);
      windows.push(w);
    }
  };
  c.add(mesh(new THREE.BoxGeometry(40, 18, 14), dark, new THREE.Vector3(0, 58, 0)));
  for (let k = -3; k <= 3; k++) c.add(mesh(new THREE.BoxGeometry(3, 3, 14), dark, new THREE.Vector3(k * 6, 68.5, 0)));
  towerAt(-20, 0, 32, 4.5);
  towerAt(20, 0, 28, 4);
  towerAt(0, -4, 48, 5.5);
  towerAt(-9, 5, 22, 3);
  towerAt(11, 5, 18, 3);
  for (let k = 0; k < 6; k++) {
    const w = mesh(new THREE.PlaneGeometry(1.6, 2.4), winMat.clone(), new THREE.Vector3(-15 + k * 6, 58, 7.05));
    c.add(w);
    windows.push(w);
  }
  c.lookAt(0, -40, 0);
  g.add(c);
  const glow = glowSprite(glowTex('rgba(150,90,255,0.5)'), 160, 0.5);
  glow.position.copy(at(1.2, R + 20, 40));
  g.add(glow);
  // Dead trees on the near hills
  for (let k = 0; k < 10; k++) {
    const t = new THREE.Group();
    t.position.copy(at(rng() * Math.PI * 2, R - 30, -36));
    const h = 22 + rng() * 16;
    t.add(mesh(new THREE.CylinderGeometry(0.6, 1.6, h, 6), darker, new THREE.Vector3(0, h / 2, 0)));
    for (let b = 0; b < 4; b++) {
      const len = 6 + rng() * 8;
      const br = mesh(new THREE.CylinderGeometry(0.15, 0.5, len, 4), darker, new THREE.Vector3(0, h * (0.55 + b * 0.1), 0));
      br.geometry.translate(0, len / 2, 0);
      br.rotation.set(0, rng() * 6, (b % 2 ? 1 : -1) * (0.6 + rng() * 0.6));
      t.add(br);
    }
    g.add(t);
  }
  return (_dt, time) => {
    windows.forEach((w, i) => (w.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(time * 0.7 + i * 1.7) > 0.96 ? 0x5a3a10 : 0xffc861));
  };
}

/** Builds the far scenery for a world (null for indoor worlds). */
export function buildBackdrop(theme: ThemeId, rng: Rng): Backdrop | null {
  const group = new THREE.Group();
  group.name = 'backdrop';
  let update: Backdrop['update'];
  switch (theme) {
    case 'cosmic':
      update = cosmic(group, rng);
      break;
    case 'aero':
      update = aero(group, rng);
      break;
    case 'cozy':
      update = cozy(group, rng);
      break;
    case 'swamp':
      update = swamp(group, rng);
      break;
    case 'garden':
      update = garden(group, rng);
      break;
    case 'castle':
      update = castle(group, rng);
      break;
    default:
      return null;
  }
  group.traverse((o) => {
    o.frustumCulled = false;
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  return { group, update };
}
