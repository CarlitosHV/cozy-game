/**
 * Extra enemies — 4 new behaviours, each with a different look in every world:
 *
 *  Behaviour      Acogedor            Cósmico            Pantano             Aero (corrupto)
 *  chaser         Erizo Castaño       Robot Centinela    Esqueleto           Gusano Malware
 *  hopper         Rana Saltarina      Conejo Lunar       Sapo Venenoso       Bloque 404
 *  shooter        Seta Lanzaesporas   Torreta Láser      Planta Carnívora    Torre de Spam
 *  diver          Cuervo Travieso     Mini Meteoro       Murciélago          Cursor Maldito
 *
 *  - chaser: spots you, flashes, then charges along its ledge and bumps you off.
 *  - hopper: hops toward you and releases a shockwave when it lands.
 *  - shooter: stationary turret that aims and fires slow projectiles.
 *  - diver: hovers above the route and dive-bombs you after a short warning.
 * Every value scales with EnemyManager.hostility (0 → 1) as levels advance:
 * speed, detection range, reaction time, fire/dive rate and knockback strength.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import { CozyEnemy, EnemyManager, KnockFn } from './enemies';

export type ExtraKind = 'chaser' | 'hopper' | 'shooter' | 'diver';
export type EnemyTheme = 'cozy' | 'cosmic' | 'swamp' | 'aero';

export const EXTRA_ENEMY_NAMES: Record<EnemyTheme, Record<ExtraKind, string>> = {
  cozy: { chaser: 'Erizo Castaño', hopper: 'Rana Saltarina', shooter: 'Seta Lanzaesporas', diver: 'Cuervo Travieso' },
  cosmic: { chaser: 'Robot Centinela', hopper: 'Conejo Lunar', shooter: 'Torreta Láser', diver: 'Mini Meteoro' },
  swamp: { chaser: 'Esqueleto', hopper: 'Sapo Venenoso', shooter: 'Planta Carnívora', diver: 'Murciélago' },
  aero: { chaser: 'Gusano Malware', hopper: 'Bloque 404', shooter: 'Torre de Spam', diver: 'Cursor Maldito' },
};

type SkinState = 'idle' | 'alert' | 'act';

interface Skin {
  root: THREE.Group;
  /** Materials that flash while the enemy is about to attack */
  alertMats?: THREE.MeshBasicMaterial[];
  normalColor?: number;
  alertColor?: number;
  anim?: (time: number, state: SkinState, dt: number) => void;
  /** Shooters: what they fire and where it leaves from */
  projectile?: () => THREE.Object3D;
  muzzle?: THREE.Object3D;
}

// ---------------------------------------------------------------------------
// Small modelling helpers
// ---------------------------------------------------------------------------
const std = (color: number, rough = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const basic = (color: number) => new THREE.MeshBasicMaterial({ color });
function mesh(geom: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function eyes(root: THREE.Object3D, mat: THREE.Material, y: number, z: number, spread: number, r: number) {
  for (const s of [1, -1]) root.add(mesh(new THREE.SphereGeometry(r, 8, 8), mat, spread * s, y, z));
}
function glowBall(color: number, r: number): THREE.Object3D {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), basic(color)));
  g.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.8, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })
    )
  );
  return g;
}

// ---------------------------------------------------------------------------
// Skins (4 worlds × 4 behaviours)
// ---------------------------------------------------------------------------
function makeSkin(theme: EnemyTheme, kind: ExtraKind): Skin {
  const root = new THREE.Group();
  const alert = basic(0xffffff);
  const skin: Skin = { root, alertMats: [alert] };

  // ======================= COZY =======================
  if (theme === 'cozy' && kind === 'chaser') {
    // Erizo Castaño: spiky chestnut ball
    const body = mesh(new THREE.SphereGeometry(0.42, 16, 12), std(0x7c4a26, 0.8), 0, 0.42, 0);
    root.add(body);
    const spikeMat = std(0x4a2c14, 0.7);
    for (let i = 0; i < 22; i++) {
      const a = i * 2.39996;
      const yv = 1 - (i / 21) * 1.4;
      const r = Math.sqrt(Math.max(0, 1 - yv * yv));
      const dir = new THREE.Vector3(Math.cos(a) * r, yv, Math.sin(a) * r * 0.9 - 0.1).normalize();
      if (dir.z > 0.55) continue;
      const sp = mesh(new THREE.ConeGeometry(0.06, 0.28, 5), spikeMat, dir.x * 0.45, 0.42 + dir.y * 0.45, dir.z * 0.45);
      sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      root.add(sp);
    }
    const face = mesh(new THREE.SphereGeometry(0.22, 12, 10), std(0xe8c49a), 0, 0.38, 0.3);
    face.scale.set(1, 0.85, 0.6);
    root.add(face);
    eyes(root, alert, 0.45, 0.42, 0.08, 0.04);
    root.add(mesh(new THREE.SphereGeometry(0.04, 6, 6), basic(0x1a1a1a), 0, 0.37, 0.45));
    Object.assign(skin, { normalColor: 0x111111, alertColor: 0xff2a2a, anim: (t: number, st: SkinState) => (body.rotation.x = st === 'act' ? t * 14 : 0) });
  }
  if (theme === 'cozy' && kind === 'hopper') {
    // Rana Saltarina
    const body = mesh(new THREE.SphereGeometry(0.45, 16, 12), std(0x4caf50, 0.5), 0, 0.35, 0);
    body.scale.set(1.1, 0.7, 1);
    root.add(body);
    const belly = mesh(new THREE.SphereGeometry(0.36, 12, 10), std(0xd9f99d, 0.6), 0, 0.3, 0.12);
    belly.scale.set(1, 0.6, 0.8);
    root.add(belly);
    for (const s of [1, -1]) {
      root.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), std(0x4caf50, 0.5), 0.2 * s, 0.62, 0.15));
      root.add(mesh(new THREE.SphereGeometry(0.07, 8, 8), alert, 0.2 * s, 0.68, 0.23));
      const leg = mesh(new THREE.SphereGeometry(0.16, 8, 6), std(0x3e8e41, 0.5), 0.36 * s, 0.12, -0.15);
      leg.scale.set(0.8, 0.5, 1.3);
      root.add(leg);
    }
    Object.assign(skin, { normalColor: 0x111111, alertColor: 0xffd400 });
  }
  if (theme === 'cozy' && kind === 'shooter') {
    // Seta Lanzaesporas
    root.add(mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.7, 12), std(0xf5ecd7, 0.7), 0, 0.35, 0));
    const cap = mesh(new THREE.SphereGeometry(0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd9443a, 0.5), 0, 0.68, 0);
    root.add(cap);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      root.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0xffffff, 0.6), Math.cos(a) * 0.38, 0.95, Math.sin(a) * 0.38));
    }
    eyes(root, alert, 0.5, 0.22, 0.09, 0.045);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.42, 0.35);
    root.add(muzzle, mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), basic(0x3b1d10), 0, 0.42, 0.29));
    Object.assign(skin, {
      muzzle,
      normalColor: 0x111111,
      alertColor: 0xfde047,
      projectile: () => glowBall(0xd9f99d, 0.16),
      anim: (t: number, st: SkinState) => cap.scale.setScalar(st === 'alert' ? 1 + Math.sin(t * 30) * 0.06 : 1),
    });
  }
  if (theme === 'cozy' && kind === 'diver') {
    // Cuervo Travieso
    const body = mesh(new THREE.SphereGeometry(0.32, 14, 10), std(0x1f2937, 0.5), 0, 0, 0);
    body.scale.set(0.9, 0.85, 1.3);
    root.add(body);
    root.add(mesh(new THREE.ConeGeometry(0.08, 0.25, 6), std(0xf59e0b, 0.4), 0, 0.02, 0.48).rotateX(Math.PI / 2));
    eyes(root, alert, 0.12, 0.3, 0.1, 0.045);
    const wings: THREE.Mesh[] = [];
    for (const s of [1, -1]) {
      const g = new THREE.PlaneGeometry(0.7, 0.35);
      g.translate(0.35 * s, 0, 0);
      const w = mesh(g, std(0x111827, 0.6, { side: THREE.DoubleSide }));
      root.add(w);
      wings.push(w);
    }
    Object.assign(skin, {
      normalColor: 0xffffff,
      alertColor: 0xff2222,
      anim: (t: number, st: SkinState) => wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (st === 'act' ? 0.6 : Math.sin(t * 12) * 0.6))),
    });
  }

  // ======================= COSMIC =======================
  if (theme === 'cosmic' && kind === 'chaser') {
    // Robot Centinela
    const metal = std(0x9ca3af, 0.3, { metalness: 0.8 });
    const body = mesh(new THREE.BoxGeometry(0.62, 0.55, 0.5), metal, 0, 0.5, 0);
    root.add(body);
    const visor = mesh(new THREE.BoxGeometry(0.46, 0.14, 0.04), alert, 0, 0.58, 0.26);
    root.add(visor);
    root.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), metal, 0.18, 0.92, 0));
    root.add(mesh(new THREE.SphereGeometry(0.05, 8, 8), basic(0xf472b6), 0.18, 1.08, 0));
    const wheels: THREE.Mesh[] = [];
    for (const s of [1, -1]) {
      const wh = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 14), std(0x374151, 0.6), 0.33 * s, 0.17, 0);
      wh.rotation.z = Math.PI / 2;
      root.add(wh);
      wheels.push(wh);
    }
    Object.assign(skin, { normalColor: 0x22d3ee, alertColor: 0xff2a2a, anim: (t: number, st: SkinState) => wheels.forEach((w) => (w.rotation.x = t * (st === 'act' ? 18 : 5))) });
  }
  if (theme === 'cosmic' && kind === 'hopper') {
    // Conejo Lunar
    const fur = std(0xf1f5f9, 0.8);
    const body = mesh(new THREE.SphereGeometry(0.38, 16, 12), fur, 0, 0.38, 0);
    root.add(body);
    for (const s of [1, -1]) {
      const ear = mesh(new THREE.CapsuleGeometry(0.07, 0.38, 4, 8), fur, 0.12 * s, 0.88, -0.02);
      ear.rotation.z = -0.15 * s;
      root.add(ear);
      root.add(mesh(new THREE.SphereGeometry(0.05, 8, 8), alert, 0.12 * s, 0.48, 0.32));
    }
    root.add(mesh(new THREE.SphereGeometry(0.1, 8, 8), fur, 0, 0.3, -0.38));
    Object.assign(skin, { normalColor: 0xef4444, alertColor: 0xfde047 });
  }
  if (theme === 'cosmic' && kind === 'shooter') {
    // Torreta Láser
    const metal = std(0x6b7280, 0.35, { metalness: 0.8 });
    root.add(mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.35, 16), metal, 0, 0.17, 0));
    const head = new THREE.Group();
    head.position.y = 0.55;
    head.add(mesh(new THREE.SphereGeometry(0.33, 16, 12), std(0x4b5563, 0.3, { metalness: 0.7 })));
    head.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 10), metal, 0, 0, 0.35).rotateX(Math.PI / 2));
    head.add(mesh(new THREE.SphereGeometry(0.09, 8, 8), alert, 0, 0.12, 0.28));
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, 0.65);
    head.add(muzzle);
    root.add(head);
    Object.assign(skin, {
      muzzle,
      normalColor: 0x22d3ee,
      alertColor: 0xf0abfc,
      projectile: () => {
        const g = glowBall(0xf0abfc, 0.13);
        g.scale.set(1, 1, 2.2);
        return g;
      },
    });
  }
  if (theme === 'cosmic' && kind === 'diver') {
    // Mini Meteoro
    const rock = mesh(new THREE.DodecahedronGeometry(0.38, 0), std(0x57534e, 0.9, { flatShading: true }));
    root.add(rock);
    const fire = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 1.1, 10),
      new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    fire.rotation.x = -Math.PI / 2;
    fire.position.z = -0.6;
    root.add(fire);
    eyes(root, alert, 0.08, 0.33, 0.12, 0.05);
    Object.assign(skin, {
      normalColor: 0xfde047,
      alertColor: 0xff2222,
      anim: (t: number, st: SkinState) => {
        rock.rotation.x = t * 2;
        fire.scale.set(1, st === 'act' ? 1.8 : 1 + Math.sin(t * 20) * 0.1, 1);
      },
    });
  }

  // ======================= SWAMP =======================
  if (theme === 'swamp' && kind === 'chaser') {
    // Esqueleto
    const bone = std(0xe7e5e4, 0.7);
    const skull = mesh(new THREE.SphereGeometry(0.22, 14, 12), bone, 0, 1.0, 0);
    root.add(skull);
    root.add(mesh(new THREE.BoxGeometry(0.2, 0.1, 0.16), bone, 0, 0.84, 0.05));
    eyes(root, alert, 1.02, 0.18, 0.08, 0.05);
    root.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), bone, 0, 0.55, 0));
    for (let i = 0; i < 3; i++) root.add(mesh(new THREE.TorusGeometry(0.16 - i * 0.02, 0.025, 4, 12, Math.PI), bone, 0, 0.7 - i * 0.1, 0).rotateY(Math.PI / 2));
    const legs: THREE.Mesh[] = [];
    for (const s of [1, -1]) {
      const leg = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 6), bone, 0.09 * s, 0.16, 0);
      root.add(leg);
      legs.push(leg);
      const arm = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 6), bone, 0.22 * s, 0.6, 0.08);
      arm.rotation.x = -0.9;
      root.add(arm);
    }
    Object.assign(skin, { normalColor: 0x22c55e, alertColor: 0xff2a2a, anim: (t: number, st: SkinState) => legs.forEach((l, i) => (l.rotation.x = Math.sin(t * (st === 'act' ? 18 : 7) + i * Math.PI) * 0.5)) });
  }
  if (theme === 'swamp' && kind === 'hopper') {
    // Sapo Venenoso
    const body = mesh(new THREE.SphereGeometry(0.47, 16, 12), std(0x6b21a8, 0.45), 0, 0.34, 0);
    body.scale.set(1.15, 0.68, 1);
    root.add(body);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      root.add(mesh(new THREE.SphereGeometry(0.06, 6, 6), basic(0xfacc15), Math.cos(a) * 0.32, 0.5, Math.sin(a) * 0.25 - 0.05));
    }
    for (const s of [1, -1]) root.add(mesh(new THREE.SphereGeometry(0.08, 8, 8), alert, 0.2 * s, 0.6, 0.25));
    Object.assign(skin, { normalColor: 0xfb923c, alertColor: 0x84cc16 });
  }
  if (theme === 'swamp' && kind === 'shooter') {
    // Planta Carnívora
    const stem = mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.8, 8), std(0x365314, 0.7), 0, 0.4, 0);
    root.add(stem);
    for (const s of [1, -1]) {
      const leaf = mesh(new THREE.SphereGeometry(0.25, 8, 6), std(0x4d7c0f, 0.7), 0.25 * s, 0.15, 0);
      leaf.scale.set(1.2, 0.2, 0.6);
      root.add(leaf);
    }
    const head = new THREE.Group();
    head.position.set(0, 0.92, 0);
    const top = mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x991b1b, 0.5));
    top.rotation.x = -0.3;
    const bottom = mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(0x991b1b, 0.5));
    bottom.rotation.x = 0.3;
    head.add(top, bottom);
    for (let i = 0; i < 6; i++) head.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 4), std(0xffffff, 0.4), -0.2 + i * 0.08, 0.02, 0.27).rotateX(Math.PI));
    head.add(mesh(new THREE.SphereGeometry(0.07, 8, 8), alert, 0, 0.0, 0.1));
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, 0.42);
    head.add(muzzle);
    root.add(head);
    Object.assign(skin, {
      muzzle,
      normalColor: 0x84cc16,
      alertColor: 0xd9f99d,
      projectile: () => glowBall(0x84cc16, 0.17),
      anim: (t: number, st: SkinState) => {
        const open = st === 'alert' ? 0.7 : 0.3 + Math.sin(t * 3) * 0.1;
        top.rotation.x = -open;
        bottom.rotation.x = open;
      },
    });
  }
  if (theme === 'swamp' && kind === 'diver') {
    // Murciélago
    const body = mesh(new THREE.SphereGeometry(0.25, 12, 10), std(0x2e1065, 0.6), 0, 0, 0);
    root.add(body);
    for (const s of [1, -1]) root.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), std(0x2e1065, 0.6), 0.12 * s, 0.25, 0));
    eyes(root, alert, 0.05, 0.22, 0.08, 0.045);
    const wings: THREE.Mesh[] = [];
    for (const s of [1, -1]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.75 * s, 0.25);
      shape.lineTo(0.6 * s, -0.05);
      shape.lineTo(0.45 * s, 0.05);
      shape.lineTo(0.3 * s, -0.1);
      shape.lineTo(0, -0.05);
      const w = mesh(new THREE.ShapeGeometry(shape), std(0x4c1d95, 0.7, { side: THREE.DoubleSide }));
      root.add(w);
      wings.push(w);
    }
    Object.assign(skin, {
      normalColor: 0xef4444,
      alertColor: 0xfef08a,
      anim: (t: number) => wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * Math.sin(t * 16) * 0.7)),
    });
  }

  // ======================= AERO (corrupted) =======================
  if (theme === 'aero' && kind === 'chaser') {
    // Gusano Malware: segmented black/red worm
    const segs: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const sg = mesh(new THREE.SphereGeometry(0.24 - i * 0.025, 12, 10), std(i % 2 ? 0x111111 : 0xb91c1c, 0.4), 0, 0.26, -i * 0.3);
      root.add(sg);
      segs.push(sg);
    }
    eyes(root, alert, 0.34, 0.2, 0.09, 0.05);
    Object.assign(skin, {
      normalColor: 0x22ff88,
      alertColor: 0xff00ff,
      anim: (t: number, st: SkinState) => segs.forEach((s, i) => (s.position.x = Math.sin(t * (st === 'act' ? 16 : 6) - i * 0.9) * 0.12)),
    });
  }
  if (theme === 'aero' && kind === 'hopper') {
    // Bloque 404
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('404', 10, 40);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = std(0xffffff, 0.9, { map: tex });
    const grey = std(0x6b7280, 0.9);
    root.add(mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), [grey, grey, grey, grey, face, grey], 0, 0.35, 0));
    root.add(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.02), alert, 0, 0.64, 0.36));
    Object.assign(skin, { normalColor: 0x111111, alertColor: 0xff0033 });
  }
  if (theme === 'aero' && kind === 'shooter') {
    // Torre de Spam
    const grey = std(0x9ca3af, 0.9);
    root.add(mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), grey, 0, 0.55, 0));
    root.add(mesh(new THREE.BoxGeometry(0.62, 0.1, 0.62), std(0x4b5563, 0.8), 0, 1.12, 0));
    root.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), grey, 0, 1.4, 0));
    root.add(mesh(new THREE.SphereGeometry(0.07, 8, 8), alert, 0, 1.66, 0));
    root.add(mesh(new THREE.BoxGeometry(0.36, 0.22, 0.03), basic(0x1d4ed8), 0, 0.8, 0.26));
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.8, 0.4);
    root.add(muzzle);
    Object.assign(skin, {
      muzzle,
      normalColor: 0xfde047,
      alertColor: 0xff0033,
      projectile: () => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.05), basic(0xdc2626)));
        const bang = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), basic(0xffffff));
        bang.position.y = 0.03;
        const dot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.06), basic(0xffffff));
        dot.position.y = -0.08;
        g.add(bang, dot);
        return g;
      },
    });
  }
  if (theme === 'aero' && kind === 'diver') {
    // Cursor Maldito: a giant black mouse pointer with a glitchy trail
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, -0.8);
    shape.lineTo(0.2, -0.6);
    shape.lineTo(0.35, -0.9);
    shape.lineTo(0.45, -0.85);
    shape.lineTo(0.3, -0.56);
    shape.lineTo(0.56, -0.56);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    geo.translate(-0.2, 0.45, -0.04);
    const pointer = mesh(geo, std(0x0a0a0a, 0.4));
    const outline = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
    root.add(pointer, outline);
    root.add(mesh(new THREE.SphereGeometry(0.06, 8, 8), alert, 0, 0.1, 0.08));
    Object.assign(skin, {
      normalColor: 0xff00ff,
      alertColor: 0xff0033,
      anim: (t: number, st: SkinState) => {
        root.rotation.z = st === 'act' ? 0 : Math.sin(t * 2) * 0.2;
        outline.visible = Math.floor(t * 10) % 3 !== 0;
      },
    });
  }
  return skin;
}

// ---------------------------------------------------------------------------
// Behaviours
// ---------------------------------------------------------------------------
function baseEnemy(type: CozyEnemy['type'], id: string, group: THREE.Group, pos: THREE.Vector3, axis: 'x' | 'z', range: number, radius: number, height: number): CozyEnemy {
  return {
    id,
    type,
    group,
    position: pos.clone(),
    velocity: new THREE.Vector3(),
    radius,
    height,
    isSquashed: false,
    squashTimer: 0,
    patrolAxis: axis,
    minBound: pos[axis] - range,
    maxBound: pos[axis] + range,
    direction: 1,
    speed: 1.4,
    telegraphTimer: 0,
    isTelegraphing: false,
    isBlowing: false,
    animParts: { body: new THREE.Mesh() },
    update: () => {},
    bop() {
      this.isSquashed = true;
      this.squashTimer = 4.0;
      soundManager.playEnemyBoop();
    },
  };
}

function applyAlert(skin: Skin, on: boolean) {
  if (!skin.alertMats || skin.normalColor === undefined || skin.alertColor === undefined) return;
  for (const m of skin.alertMats) m.color.set(on ? skin.alertColor : skin.normalColor);
}

function handleSquash(e: CozyEnemy, dt: number): boolean {
  if (!e.isSquashed) return false;
  e.squashTimer -= dt;
  e.group.scale.set(1.4, 0.25, 1.4);
  if (e.squashTimer <= 0) {
    e.isSquashed = false;
    e.group.scale.set(1, 1, 1);
  }
  return true;
}

function faceYaw(e: CozyEnemy, yaw: number, dt: number, rate = 10) {
  let diff = yaw - e.group.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  e.group.rotation.y += diff * Math.min(1, dt * rate);
}

export function spawnExtraEnemy(
  mgr: EnemyManager,
  theme: EnemyTheme,
  kind: ExtraKind,
  id: string,
  spawnPos: THREE.Vector3,
  axis: 'x' | 'z',
  range: number
): CozyEnemy {
  const group = new THREE.Group();
  group.position.copy(spawnPos);
  const skin = makeSkin(theme, kind);
  applyAlert(skin, false);
  group.add(skin.root);
  // Soft contact shadow (not for flyers)
  if (kind !== 'diver') {
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    group.add(sh);
  }
  mgr.addObject(group);
  const H = () => mgr.hostility;
  let state: SkinState = 'idle';
  let time = 0;

  let enemy: CozyEnemy;

  if (kind === 'chaser') {
    enemy = baseEnemy('chaser', id, group, spawnPos, axis, range, 0.45, kind === 'chaser' && theme === 'swamp' ? 1.2 : 0.85);
    let alertT = 0;
    enemy.update = function (this: CozyEnemy, dt, t, playerPos) {
      time = t;
      if (handleSquash(this, dt)) return;
      const h = H();
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const sees = Math.hypot(dx, dz) < 3.5 + 3.5 * h && Math.abs(playerPos.y - this.position.y) < 2;
      if (sees) {
        alertT += dt;
        state = alertT > 0.55 - 0.35 * h ? 'act' : 'alert';
      } else {
        alertT = 0;
        state = 'idle';
      }
      const a = this.patrolAxis;
      if (state === 'act') {
        const target = THREE.MathUtils.clamp(playerPos[a], this.minBound, this.maxBound);
        const sp = 2.4 + 2.6 * h;
        const delta = target - this.position[a];
        this.direction = Math.sign(delta) || this.direction;
        this.position[a] += THREE.MathUtils.clamp(delta, -sp * dt, sp * dt);
      } else if (state === 'idle') {
        this.position[a] += this.direction * 1.3 * (1 + 0.5 * h) * dt;
        if (this.position[a] > this.maxBound) {
          this.position[a] = this.maxBound;
          this.direction = -1;
        } else if (this.position[a] < this.minBound) {
          this.position[a] = this.minBound;
          this.direction = 1;
        }
      }
      const yaw = state === 'idle' ? (a === 'x' ? (this.direction > 0 ? Math.PI / 2 : -Math.PI / 2) : this.direction > 0 ? 0 : Math.PI) : Math.atan2(dx, dz);
      faceYaw(this, yaw, dt);
      this.group.position.copy(this.position);
      this.group.position.y += state === 'alert' ? Math.abs(Math.sin(t * 20)) * 0.08 : 0;
      applyAlert(skin, state !== 'idle');
      skin.anim?.(t, state, dt);
    };
  } else if (kind === 'hopper') {
    enemy = baseEnemy('hopper', id, group, spawnPos, axis, range, 0.45, 0.7);
    const groundY = spawnPos.y;
    let wait = 1 + Math.random();
    let vy = 0;
    let airborne = false;
    let targetA = spawnPos[axis];
    let landed = false;
    // Shockwave ring
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    mgr.addObject(ring);
    let ringT = 1;
    enemy.update = function (this: CozyEnemy, dt, t, playerPos) {
      time = t;
      if (handleSquash(this, dt)) return;
      const h = H();
      const a = this.patrolAxis;
      if (!airborne) {
        wait -= dt;
        state = wait < 0.45 ? 'alert' : 'idle';
        if (wait <= 0) {
          airborne = true;
          vy = 7 + 2 * h;
          const near = Math.hypot(playerPos.x - this.position.x, playerPos.z - this.position.z) < 6 + 3 * h;
          const goal = near ? playerPos[a] : this.minBound + Math.random() * (this.maxBound - this.minBound);
          targetA = THREE.MathUtils.clamp(goal, this.minBound, this.maxBound);
          soundManager.playJump();
        }
      } else {
        state = 'act';
        vy -= 20 * dt;
        this.position.y += vy * dt;
        const delta = targetA - this.position[a];
        this.position[a] += THREE.MathUtils.clamp(delta, -4 * dt, 4 * dt);
        if (this.position.y <= groundY) {
          this.position.y = groundY;
          airborne = false;
          landed = true;
          wait = 2.6 - 1.4 * h;
          ringT = 0;
          ring.position.set(this.position.x, groundY + 0.05, this.position.z);
        }
      }
      // Squash & stretch
      const s = airborne ? 1.15 : state === 'alert' ? 0.8 : 1;
      skin.root.scale.set(2 - s, s, 2 - s);
      faceYaw(this, Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z), dt, 4);
      this.group.position.copy(this.position);
      if (ringT < 1) {
        ringT += dt * 2.2;
        const r = 1 + ringT * (1.8 + 1.3 * h);
        ring.scale.setScalar(r);
        ringMat.opacity = 0.7 * (1 - ringT);
      }
      applyAlert(skin, state !== 'idle');
      skin.anim?.(t, state, dt);
    };
    enemy.onCheck = function (this: CozyEnemy, pp, _pv, _pr, knock: KnockFn) {
      if (!landed) return false;
      landed = false;
      const h = H();
      const dx = pp.x - this.position.x;
      const dz = pp.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.8 + 1.3 * h && Math.abs(pp.y - this.position.y) < 1.0) {
        const dir = new THREE.Vector3(dx, 0, dz);
        if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
        knock(dir.normalize(), 9 + 6 * h, 6.5);
        return true;
      }
      return false;
    };
  } else if (kind === 'shooter') {
    enemy = baseEnemy('shooter', id, group, spawnPos, axis, 0, 0.5, theme === 'aero' ? 1.6 : 1.0);
    let cool = 1.5 + Math.random();
    let charge = 0;
    const tmp = new THREE.Vector3();
    enemy.update = function (this: CozyEnemy, dt, t, playerPos) {
      time = t;
      if (handleSquash(this, dt)) return;
      const h = H();
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const inRange = Math.hypot(dx, dz) < 9 + 7 * h && Math.abs(playerPos.y - this.position.y) < 4;
      if (inRange) faceYaw(this, Math.atan2(dx, dz), dt, 6);
      cool -= dt;
      if (cool <= 0 && inRange) {
        state = 'alert';
        charge += dt;
        if (charge > 0.7 - 0.35 * h) {
          // Fire!
          const from = new THREE.Vector3();
          (skin.muzzle ?? skin.root).getWorldPosition(from);
          const root = this.group.parent;
          if (root) root.worldToLocal(from);
          tmp.set(playerPos.x, playerPos.y + 0.7, playerPos.z).sub(from).normalize().multiplyScalar(6 + 5 * h);
          const proj = skin.projectile ? skin.projectile() : glowBall(0xffffff, 0.15);
          proj.lookAt(tmp);
          mgr.spawnProjectile(proj, from, tmp, 10 + 5 * h, 0.28, 4);
          soundManager.playSteamPuff();
          cool = 3.4 - 1.9 * h;
          charge = 0;
          state = 'act';
        }
      } else if (cool > 0) {
        state = 'idle';
      }
      this.group.position.copy(this.position);
      applyAlert(skin, state !== 'idle');
      skin.anim?.(t, state, dt);
    };
  } else {
    // diver
    enemy = baseEnemy('diver', id, group, spawnPos, axis, range, 0.5, 0.6);
    enemy.bodyContact = false;
    const home = spawnPos.clone().add(new THREE.Vector3(0, 3.2, 0));
    enemy.position.copy(home);
    let mode: 'hover' | 'warn' | 'dive' | 'back' = 'hover';
    let timer = 2 + Math.random() * 2;
    const target = new THREE.Vector3();
    const vel = new THREE.Vector3();
    let phase = Math.random() * 10;
    enemy.update = function (this: CozyEnemy, dt, t, playerPos) {
      time = t;
      if (handleSquash(this, dt)) return;
      const h = H();
      phase += dt;
      const a = this.patrolAxis;
      if (mode === 'hover') {
        state = 'idle';
        const span = (this.maxBound - this.minBound) / 2;
        this.position.copy(home);
        this.position[a] = (this.minBound + this.maxBound) / 2 + Math.sin(phase * 0.9) * span;
        this.position.y = home.y + Math.sin(phase * 2.3) * 0.25;
        timer -= dt;
        const dXZ = Math.hypot(playerPos.x - this.position.x, playerPos.z - this.position.z);
        if (timer <= 0 && dXZ < 6 + 4 * h && playerPos.y < this.position.y + 1) {
          mode = 'warn';
          timer = 0.85 - 0.4 * h;
        }
      } else if (mode === 'warn') {
        state = 'alert';
        timer -= dt;
        this.group.position.x = this.position.x + (Math.random() - 0.5) * 0.1;
        if (timer <= 0) {
          mode = 'dive';
          target.set(playerPos.x, playerPos.y + 0.5, playerPos.z);
          vel.copy(target).sub(this.position).normalize().multiplyScalar(9 + 6 * h);
          timer = 1.3;
          soundManager.playWindGust();
        }
      } else if (mode === 'dive') {
        state = 'act';
        this.position.addScaledVector(vel, dt);
        timer -= dt;
        if (timer <= 0 || this.position.distanceTo(target) < 0.3) {
          mode = 'back';
        }
      } else {
        state = 'idle';
        const toHome = home.clone().sub(this.position);
        const dist = toHome.length();
        if (dist < 0.2) {
          mode = 'hover';
          timer = 3.6 - 1.9 * h;
        } else {
          this.position.addScaledVector(toHome.normalize(), Math.min(dist, 5 * dt));
        }
      }
      const look = mode === 'dive' ? vel : new THREE.Vector3(playerPos.x - this.position.x, 0, playerPos.z - this.position.z);
      faceYaw(this, Math.atan2(look.x, look.z), dt, 8);
      if (mode !== 'warn') this.group.position.copy(this.position);
      else this.group.position.y = this.position.y;
      applyAlert(skin, state !== 'idle');
      skin.anim?.(t, state, dt);
    };
    enemy.onCheck = function (this: CozyEnemy, pp, _pv, _pr, knock: KnockFn) {
      if (mode !== 'dive') return false;
      const dx = pp.x - this.position.x;
      const dy = pp.y + 0.6 - this.position.y;
      const dz = pp.z - this.position.z;
      if (dx * dx + dy * dy + dz * dz < 0.95 * 0.95) {
        const dir = new THREE.Vector3(vel.x, 0, vel.z);
        if (dir.lengthSq() < 1e-4) dir.set(dx, 0, dz);
        knock(dir.normalize(), 11 + 5 * H(), 6);
        mode = 'back';
        return true;
      }
      return false;
    };
  }
  void time;
  mgr.registerEnemy(enemy);
  return enemy;
}
