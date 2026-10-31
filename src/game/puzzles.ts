/**
 * Puzzle mechanics for generated levels:
 *  - Push blocks: walk into a rock to push it; climb on it to reach high ledges.
 *    Falls with gravity and respawns if it drops into the void.
 *  - Doors: tall locked gates that open when you arrive with a key 🔑 in the backpack.
 *  - Key carriers: enemies holding a key — stomp on them to make them drop it.
 *  - Sentinels: watchtowers sweeping a cone of light; if it spots you, you're sent
 *    back to the zone entrance. Hide behind walls and move when it looks away.
 *  - Hints: one-time tips shown when you first enter a puzzle area.
 *  - Orbs (open-world levels): find them all at the end of each path to break the shield
 *    around the summit and wake up the wind current that takes you there.
 *  - Return portals: next to each orb, they bring you back to the central valley.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import type { PlatformItem } from './levels';
import type { CozyEnemy } from './enemies';
import { ItemSystem, ItemType, createKeyMesh } from './items';

export const BLOCK_SIZE = 1.4;
/** Door height: taller than any jump, nut super-jump or Nubi float */
export const DOOR_H = 6.2;

export interface PushBlock {
  plat: PlatformItem;
  start: THREE.Vector3;
  vy: number;
  respawnTimer: number;
}

export interface Door {
  plat: PlatformItem;
  closedY: number;
  open: boolean;
  openT: number;
  hintCooldown: number;
}

export interface CoverBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Sentinel {
  pos: THREE.Vector3; // eye position
  baseYaw: number;
  amplitude: number;
  speed: number;
  range: number;
  halfAngle: number;
  zone: { minX: number; maxX: number; minZ: number; maxZ: number; y: number };
  entrance: THREE.Vector3;
  covers: CoverBox[];
  sector: THREE.Mesh;
  sectorMat: THREE.MeshBasicMaterial;
  head: THREE.Object3D;
  yaw: number;
  detect: number;
  cooldown: number;
}

export interface Carrier {
  enemy: CozyEnemy;
  item: ItemType;
  holding: boolean;
  regen: number;
  mesh: THREE.Object3D;
}

export interface Hint {
  pos: THREE.Vector3;
  radius: number;
  text: string;
  shown: boolean;
}

export interface Orb {
  pos: THREE.Vector3;
  group: THREE.Object3D;
  beam: THREE.Object3D;
  socket?: THREE.Mesh;
  color: number;
  collected: boolean;
}

export interface Portal {
  pos: THREE.Vector3;
  to: THREE.Vector3;
  group: THREE.Object3D;
}

export interface SummitGate {
  /** Optional wind current to the summit (only in world.platforms once every orb is found) */
  updraft?: PlatformItem;
  /** Message shown when every orb is found */
  openText?: string;
  /** Invisible wall around the summit while it is locked */
  shield: PlatformItem;
  shieldY: number;
  shieldMesh: THREE.Mesh;
  beam: THREE.Object3D;
  active: boolean;
  fade: number;
}

export interface PuzzleData {
  blocks: PushBlock[];
  doors: Door[];
  sentinels: Sentinel[];
  carriers: Carrier[];
  hints: Hint[];
  pendingDrops: { type: ItemType; pos: THREE.Vector3 }[];
  orbs: Orb[];
  portals: Portal[];
  summit?: SummitGate;
}

export function emptyPuzzles(): PuzzleData {
  return { blocks: [], doors: [], sentinels: [], carriers: [], hints: [], pendingDrops: [], orbs: [], portals: [] };
}

/** Tall beam of light visible from anywhere (marks orbs and the open summit). */
export function makeBeam(color: number, height = 70, radius = 0.3, startY = 0): THREE.Mesh {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.8, radius, height, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, depthWrite: false, fog: false, side: THREE.DoubleSide })
  );
  beam.position.y = startY + height / 2;
  return beam;
}

/** A glowing orb on a pedestal standing on the floor at (x, floorY, z). */
export function makeOrb(root: THREE.Object3D, x: number, floorY: number, z: number, color: number): Orb {
  const base = new THREE.Group();
  base.position.set(x, floorY, z);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.5 }));
  pedestal.position.y = 0.35;
  pedestal.castShadow = true;
  base.add(pedestal);
  // Colored beam starting above the orb, visible from anywhere in the world
  const beam = makeBeam(color, 60, 0.28, 2.6);
  base.add(beam);
  root.add(base);

  const group = new THREE.Group();
  group.position.set(x, floorY + 1.6, z);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 24, 18),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.2 })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 20, 14),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ring.rotation.x = Math.PI / 2;
  group.add(orb, halo, ring);
  root.add(group);
  return { pos: group.position.clone(), group, beam, color, collected: false };
}

/** Swirling ring that sends you back to the valley. */
export function makePortal(root: THREE.Object3D, x: number, floorY: number, z: number, to: THREE.Vector3, color: number): Portal {
  const group = new THREE.Group();
  group.position.set(x, floorY, z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 10, 36), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 }));
  ring.position.y = 1.15;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  disc.position.y = 1.15;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
  pad.position.y = 0.05;
  group.add(ring, disc, pad);
  root.add(group);
  return { pos: new THREE.Vector3(x, floorY, z), to: to.clone(), group };
}

// ---------------------------------------------------------------------------
// Builders (called by the level generator)
// ---------------------------------------------------------------------------

/** A pushable rock/crate. Returns the PlatformItem you must add to world.platforms. */
export function makePushBlock(root: THREE.Object3D, id: string, x: number, floorY: number, z: number, mat: THREE.Material, accent = 0xfbbf24): { plat: PlatformItem; block: PushBlock } {
  const s = BLOCK_SIZE;
  const group = new THREE.Group();
  group.position.set(x, floorY + s, z);
  const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
  box.position.y = -s / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  // Bright arrows on every side hint that it can be pushed
  const arrowMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.45, roughness: 0.4 });
  const tri = new THREE.Shape();
  tri.moveTo(-0.28, -0.2);
  tri.lineTo(0.28, -0.2);
  tri.lineTo(0, 0.26);
  tri.closePath();
  const arrowGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.05, bevelEnabled: false });
  for (let i = 0; i < 4; i++) {
    const holder = new THREE.Group();
    holder.rotation.y = (i / 4) * Math.PI * 2;
    for (const yy of [-s * 0.3, -s * 0.7]) {
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.set(0, yy, s / 2 - 0.01);
      arrow.rotation.z = Math.PI / 2;
      holder.add(arrow);
    }
    group.add(holder);
  }
  // Accent band around the middle
  const band = new THREE.Mesh(new THREE.BoxGeometry(s + 0.04, 0.12, s + 0.04), arrowMat);
  band.position.y = -s / 2;
  group.add(band);
  root.add(group);
  const plat: PlatformItem = {
    id,
    type: 'static',
    position: new THREE.Vector3(x, floorY + s, z),
    size: new THREE.Vector3(s, s, s),
    mesh: group,
    originalY: floorY + s,
    solid: true,
  };
  return { plat, block: { plat, start: plat.position.clone(), vy: 0, respawnTimer: 0 } };
}

/** A tall locked gate across a narrow bridge. */
export function makeDoor(root: THREE.Object3D, id: string, x: number, floorY: number, z: number, width: number, accent: number, acrossZ = false): { plat: PlatformItem; door: Door } {
  const H = DOOR_H;
  const group = new THREE.Group();
  group.position.set(x, floorY + H, z);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6, metalness: 0.5 });
  const barMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.7, emissive: accent, emissiveIntensity: 0.25 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, H, 0.35), frameMat);
  panel.position.y = -H / 2;
  panel.castShadow = true;
  group.add(panel);
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, H - 0.4, 0.42), barMat);
    bar.position.set(-width / 2 + (i + 0.5) * (width / 5), -H / 2, 0);
    group.add(bar);
  }
  // Big lock with keyhole on both faces
  for (const side of [1, -1]) {
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.12), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 }));
    lock.position.set(0, -H * 0.55, side * 0.26);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    hole.position.set(0, -H * 0.53, side * 0.33);
    if (side < 0) hole.rotation.y = Math.PI;
    group.add(lock, hole);
  }
  // A gate on a bridge that runs along x spans the z axis instead
  if (acrossZ) group.rotation.y = Math.PI / 2;
  root.add(group);
  const plat: PlatformItem = {
    id,
    type: 'static',
    position: new THREE.Vector3(x, floorY + H, z),
    size: acrossZ ? new THREE.Vector3(0.5, H + 0.4, width) : new THREE.Vector3(width, H + 0.4, 0.5),
    mesh: group,
    originalY: floorY + H,
    solid: true,
  };
  return { plat, door: { plat, closedY: floorY + H, open: false, openT: 0, hintCooldown: 0 } };
}

/** Gives an enemy a key to carry above its head; stomping it drops the key. */
export function makeCarrier(enemy: CozyEnemy, data: PuzzleData): Carrier {
  const mesh = createKeyMesh();
  mesh.position.y = enemy.height + 0.75;
  mesh.scale.setScalar(1.3);
  enemy.group.add(mesh);
  const carrier: Carrier = { enemy, item: 'llave', holding: true, regen: 0, mesh };
  enemy.onBopped = () => {
    if (!carrier.holding) return;
    carrier.holding = false;
    carrier.mesh.visible = false;
    carrier.regen = 25;
    data.pendingDrops.push({ type: carrier.item, pos: carrier.enemy.position.clone().add(new THREE.Vector3(0, 0.9, 0)) });
  };
  return carrier;
}

/** Watchtower with a sweeping cone of vision drawn on the floor. */
export function makeSentinel(
  root: THREE.Object3D,
  x: number,
  floorY: number,
  z: number,
  baseYaw: number,
  zone: Sentinel['zone'],
  entrance: THREE.Vector3,
  covers: CoverBox[],
  accent: number
): Sentinel {
  const tower = new THREE.Group();
  tower.position.set(x, floorY, z);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.8 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 2.2, 10), stoneMat);
  post.position.y = 1.1;
  post.castShadow = true;
  tower.add(post);
  const head = new THREE.Group();
  head.position.y = 2.6;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.3, metalness: 0.6 }));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: accent }));
  eye.position.z = 0.38;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 3, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff7cc, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  beam.rotation.x = -Math.PI / 2 - 0.35;
  beam.position.set(0, -0.5, 1.6);
  head.add(ball, eye, beam);
  tower.add(head);
  root.add(tower);

  // Floor sector showing exactly what it can see
  const range = 11;
  const half = 0.42;
  const seg = 20;
  const verts: number[] = [0, 0, 0];
  for (let i = 0; i <= seg; i++) {
    const a = -half + (i / seg) * half * 2;
    verts.push(Math.sin(a) * range, 0, Math.cos(a) * range);
  }
  const idx: number[] = [];
  for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  const sectorMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const sector = new THREE.Mesh(g, sectorMat);
  sector.position.set(x, floorY + 0.04, z);
  root.add(sector);

  return {
    pos: new THREE.Vector3(x, floorY + 2.6, z),
    baseYaw,
    amplitude: 1.0,
    speed: 0.55,
    range,
    halfAngle: half,
    zone,
    entrance,
    covers,
    sector,
    sectorMat,
    head,
    yaw: baseYaw,
    detect: 0,
    cooldown: 0,
  };
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------
export interface PuzzleContext {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  moveDir: THREE.Vector3;
  platforms: PlatformItem[];
  items: ItemSystem;
  hostility: number;
  /** Moves the player (e.g. caught by a sentinel) */
  teleport: (to: THREE.Vector3) => void;
  /** An orb was found (have / total) */
  onOrb?: (have: number, total: number) => void;
}

/** 2D segment vs axis-aligned box (slab test). */
function segmentHitsBox(ax: number, az: number, bx: number, bz: number, b: CoverBox): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, ax - b.minX) && clip(dx, b.maxX - ax) && clip(-dz, az - b.minZ) && clip(dz, b.maxZ - az) && t0 <= t1;
}

export class PuzzleSystem {
  private data: PuzzleData = emptyPuzzles();
  private platforms: PlatformItem[] = [];
  private portalCooldown = 0;

  load(data: PuzzleData | undefined, platforms: PlatformItem[] = []) {
    this.data = data ?? emptyPuzzles();
    this.platforms = platforms;
    this.lockSummit();
  }

  /** Orbs found / total (total 0 = level without orbs). */
  getOrbStatus(): { have: number; total: number; summitOpen: boolean } {
    const total = this.data.orbs.length;
    const have = this.data.orbs.filter((o) => o.collected).length;
    return { have, total, summitOpen: !!this.data.summit?.active };
  }

  private lockSummit() {
    const s = this.data.summit;
    if (!s) return;
    s.active = false;
    s.fade = 0;
    if (s.updraft) {
      const i = this.platforms.indexOf(s.updraft);
      if (i !== -1) this.platforms.splice(i, 1);
      s.updraft.mesh.visible = false;
    }
    s.beam.visible = false;
    s.shield.position.y = s.shieldY;
    s.shieldMesh.visible = true;
    (s.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0.22;
  }

  private openSummit() {
    const s = this.data.summit;
    if (!s || s.active) return;
    s.active = true;
    if (s.updraft) {
      if (!this.platforms.includes(s.updraft)) this.platforms.push(s.updraft);
      s.updraft.mesh.visible = true;
    }
    s.beam.visible = true;
    s.shield.position.y = -100;
  }

  /** New run: blocks back home, doors closed, carriers holding their keys, hints re-armed. */
  reset() {
    for (const b of this.data.blocks) {
      b.plat.position.copy(b.start);
      b.plat.mesh.position.copy(b.start);
      b.vy = 0;
      b.respawnTimer = 0;
      b.plat.mesh.visible = true;
    }
    for (const d of this.data.doors) {
      d.open = false;
      d.openT = 0;
      d.plat.position.y = d.closedY;
      d.plat.mesh.position.y = d.closedY;
      d.plat.mesh.visible = true;
    }
    for (const c of this.data.carriers) {
      c.holding = true;
      c.mesh.visible = true;
      c.regen = 0;
    }
    for (const h of this.data.hints) h.shown = false;
    this.data.pendingDrops.length = 0;
    for (const o of this.data.orbs) {
      o.collected = false;
      o.group.visible = true;
      o.group.scale.setScalar(1);
      o.beam.visible = true;
      if (o.socket) (o.socket.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05;
    }
    this.lockSummit();
  }

  update(dt: number, time: number, ctx: PuzzleContext) {
    const P = ctx.position;

    // ---- Hints ----
    for (const h of this.data.hints) {
      if (!h.shown && P.distanceTo(h.pos) < h.radius) {
        h.shown = true;
        ctx.items.notify(h.text);
      }
    }

    // ---- Orbs, return portals & the summit ----
    if (this.data.orbs.length) {
      const total = this.data.orbs.length;
      for (const o of this.data.orbs) {
        if (o.collected) {
          if (o.group.visible) {
            o.group.scale.multiplyScalar(Math.max(0, 1 - dt * 6));
            o.group.position.y += dt * 3;
            if (o.group.scale.x < 0.05) o.group.visible = false;
          }
          continue;
        }
        o.group.rotation.y = time * 1.5;
        o.group.position.y = o.pos.y + Math.sin(time * 2 + o.pos.x) * 0.15;
        const dx = P.x - o.pos.x;
        const dz = P.z - o.pos.z;
        const dy = P.y + 0.7 - o.pos.y;
        if (dx * dx + dz * dz + dy * dy < 1.5 * 1.5) {
          o.collected = true;
          o.beam.visible = false;
          if (o.socket) (o.socket.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2;
          const have = this.data.orbs.filter((q) => q.collected).length;
          soundManager.playTimeBonus();
          ctx.onOrb?.(have, total);
          if (have >= total) {
            this.openSummit();
            soundManager.playCheckpoint();
            ctx.items.notify(this.data.summit?.openText ?? '¡Todos los orbes reunidos! El escudo de la cima se rompió: ve a la corriente de viento del valle');
          } else {
            ctx.items.notify(`¡Orbe ${have}/${total}! Usa el portal para volver al valle`);
          }
        }
      }
      const s = this.data.summit;
      if (s && s.active && s.fade < 1) {
        s.fade = Math.min(1, s.fade + dt * 0.8);
        (s.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0.22 * (1 - s.fade);
        s.shieldMesh.scale.setScalar(1 + s.fade * 0.3);
        if (s.fade >= 1) s.shieldMesh.visible = false;
      } else if (s && !s.active) {
        s.shieldMesh.rotation.y = time * 0.1;
        (s.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(time * 1.6) * 0.05;
      }
    }
    this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    for (const pt of this.data.portals) {
      pt.group.rotation.y = time * 1.2;
      if (this.portalCooldown > 0) continue;
      if (Math.hypot(P.x - pt.pos.x, P.z - pt.pos.z) < 1.0 && P.y > pt.pos.y - 0.3 && P.y < pt.pos.y + 1.6) {
        this.portalCooldown = 1.5;
        soundManager.playRespawnPuff();
        ctx.teleport(pt.to);
        ctx.items.notify('¡De vuelta al valle!');
      }
    }

    // ---- Enemy drops & carriers ----
    while (this.data.pendingDrops.length) {
      const d = this.data.pendingDrops.shift()!;
      ctx.items.spawnDrop(d.type, d.pos);
      ctx.items.notify('¡Le quitaste la llave! Recógela');
    }
    for (const c of this.data.carriers) {
      c.mesh.rotation.y = time * 2;
      if (!c.holding) {
        c.regen -= dt;
        // Give it a new key only if the player lost theirs (so the level never gets stuck)
        if (c.regen <= 0 && !ctx.items.has(c.item) && !ctx.items.isLyingAround(c.item) && this.data.doors.some((d) => !d.open)) {
          c.holding = true;
          c.mesh.visible = true;
        }
      }
    }

    // ---- Doors ----
    for (const d of this.data.doors) {
      if (d.open) {
        if (d.openT < 1) {
          d.openT = Math.min(1, d.openT + dt * 1.2);
          d.plat.mesh.position.y = d.closedY - d.openT * (DOOR_H + 0.6);
          if (d.openT >= 1) d.plat.mesh.visible = false;
        }
        continue;
      }
      d.hintCooldown = Math.max(0, d.hintCooldown - dt);
      const c = d.plat.position;
      const near = Math.hypot(P.x - c.x, P.z - c.z) < 2.3 && Math.abs(P.y - (d.closedY - DOOR_H)) < 1.5;
      if (!near) continue;
      if (ctx.items.consume('llave')) {
        d.open = true;
        d.plat.position.y = -100; // collision gone
        soundManager.playCheckpoint();
        ctx.items.notify('¡Puerta abierta!');
      } else if (d.hintCooldown <= 0) {
        d.hintCooldown = 4;
        ctx.items.notify('Puerta cerrada: necesitas una llave');
      }
    }

    // ---- Push blocks ----
    for (const b of this.data.blocks) this.updateBlock(b, dt, ctx);

    // ---- Sentinels ----
    const h = ctx.hostility;
    for (const s of this.data.sentinels) {
      s.yaw = s.baseYaw + Math.sin(time * s.speed * (1 + 0.8 * h)) * s.amplitude;
      s.head.rotation.y = s.yaw;
      s.sector.rotation.y = s.yaw;
      s.cooldown = Math.max(0, s.cooldown - dt);
      const z = s.zone;
      const inZone = P.x > z.minX && P.x < z.maxX && P.z > z.minZ && P.z < z.maxZ && Math.abs(P.y - z.y) < 2.5;
      let seen = false;
      if (inZone && s.cooldown <= 0) {
        const vx = P.x - s.pos.x;
        const vz = P.z - s.pos.z;
        const dist = Math.hypot(vx, vz);
        if (dist < s.range) {
          let diff = Math.atan2(vx, vz) - s.yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          if (Math.abs(diff) < s.halfAngle + 0.12 * h) {
            seen = !s.covers.some((cv) => segmentHitsBox(s.pos.x, s.pos.z, P.x, P.z, cv));
          }
        }
      }
      s.detect = seen ? s.detect + dt : Math.max(0, s.detect - dt * 2);
      const alarm = s.detect > 0;
      s.sectorMat.color.set(alarm ? 0xef4444 : 0xfde047);
      s.sectorMat.opacity = alarm ? 0.4 + Math.sin(time * 30) * 0.1 : 0.28;
      if (s.detect > 0.55 - 0.3 * h) {
        s.detect = 0;
        s.cooldown = 1.2;
        soundManager.playStalkerWarning();
        ctx.teleport(s.entrance);
        ctx.items.notify('¡El vigía te descubrió! Escóndete tras los muros y avanza cuando mire a otro lado');
      }
    }
  }

  private supportUnder(b: PushBlock, ctx: PuzzleContext, bottom: number, newBottom: number): PlatformItem | null {
    const bp = b.plat.position;
    for (const q of ctx.platforms) {
      if (q === b.plat || q.type === 'updraft') continue;
      if (Math.abs(bp.x - q.position.x) > q.size.x / 2 || Math.abs(bp.z - q.position.z) > q.size.z / 2) continue;
      const top = q.position.y;
      if (top <= bottom + 0.06 && top >= newBottom - 0.06) return q;
    }
    return null;
  }

  private overlapsSomething(b: PushBlock, x: number, z: number, ctx: PuzzleContext): boolean {
    const s = BLOCK_SIZE;
    const top = b.plat.position.y;
    const bottom = top - s;
    for (const q of ctx.platforms) {
      if (q === b.plat || q.type === 'updraft' || q.position.y < -50) continue;
      const qTop = q.position.y;
      const qBottom = qTop - q.size.y;
      if (bottom >= qTop - 0.05 || top <= qBottom + 0.05) continue;
      if (Math.abs(x - q.position.x) < (s + q.size.x) / 2 - 0.02 && Math.abs(z - q.position.z) < (s + q.size.z) / 2 - 0.02) return true;
    }
    return false;
  }

  private updateBlock(b: PushBlock, dt: number, ctx: PuzzleContext) {
    const s = BLOCK_SIZE;
    const bp = b.plat.position;

    if (b.respawnTimer > 0) {
      b.respawnTimer -= dt;
      if (b.respawnTimer <= 0) {
        bp.copy(b.start);
        b.vy = 0;
        b.plat.mesh.visible = true;
        soundManager.playRespawnPuff();
      }
      b.plat.mesh.position.copy(bp);
      return;
    }

    const P = ctx.position;
    // Safety net: if you wander off and left it out of place, it quietly goes home
    if (P.distanceTo(bp) > 22 && P.distanceTo(b.start) > 22 && bp.distanceToSquared(b.start) > 0.01) {
      bp.copy(b.start);
      b.vy = 0;
    }

    // Pushing: player beside the block, walking into it
    const top = bp.y;
    const bottom = top - s;
    if (P.y < top - 0.3 && P.y + 1.3 > bottom) {
      const dx = P.x - bp.x;
      const dz = P.z - bp.z;
      const reach = s / 2 + 0.35 + 0.15;
      if (Math.abs(dx) < reach && Math.abs(dz) < reach) {
        const dir = Math.abs(dx) > Math.abs(dz) ? new THREE.Vector3(-Math.sign(dx), 0, 0) : new THREE.Vector3(0, 0, -Math.sign(dz));
        if (ctx.moveDir.dot(dir) > 0.55) {
          const step = 2.6 * dt;
          const nx = bp.x + dir.x * step;
          const nz = bp.z + dir.z * step;
          if (!this.overlapsSomething(b, nx, nz, ctx)) {
            bp.x = nx;
            bp.z = nz;
          }
        }
      }
    }

    // Gravity
    const support = this.supportUnder(b, ctx, bottom, bottom);
    if (support) {
      b.vy = 0;
      bp.y = support.position.y + s;
    } else {
      b.vy -= 20 * dt;
      const newBottom = bottom + b.vy * dt;
      const land = this.supportUnder(b, ctx, bottom, newBottom);
      if (land) {
        bp.y = land.position.y + s;
        b.vy = 0;
      } else {
        bp.y += b.vy * dt;
      }
    }
    if (bp.y < b.start.y - 1.2) {
      b.respawnTimer = 0.8;
      b.plat.mesh.visible = false;
      ctx.items.notify('La roca cayó… vuelve a su lugar');
    }
    b.plat.mesh.position.copy(bp);
  }
}
