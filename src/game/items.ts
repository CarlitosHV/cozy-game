/**
 * Items & Backpack (5 slots)
 * Pickups placed around each level (magic berries, walnuts, …) go into a
 * 5-slot backpack when touched. Use them any time with keys 1-5 or the HUD.
 *  - Baya mágica: feeds your companion and recharges its power
 *  - Nuez energética: super jump for a while
 * New item types only need an entry in ITEM_INFO, a 3D model and a use effect.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';

export type ItemType = 'baya' | 'nuez';

export interface ItemInfo {
  type: ItemType;
  name: string;
  emoji: string;
  desc: string;
  color: string;
}

export const ITEM_INFO: Record<ItemType, ItemInfo> = {
  baya: {
    type: 'baya',
    name: 'Baya mágica',
    emoji: '🍇',
    desc: 'Alimenta a tu compañero y recarga su poder.',
    color: '#f9a8d4',
  },
  nuez: {
    type: 'nuez',
    name: 'Nuez energética',
    emoji: '🌰',
    desc: 'Súper salto: saltas mucho más alto durante 10 segundos.',
    color: '#fcd34d',
  },
};

export const INVENTORY_SIZE = 5;
const RESPAWN_SECONDS = 30;
const SUPER_JUMP_SECONDS = 10;

export interface ItemSpot {
  type: ItemType;
  pos: THREE.Vector3;
}

export interface InventoryStatus {
  slots: (ItemType | null)[];
  superJumpLeft: number;
  eventId: number;
  eventText: string;
}

/** What using an item can affect (provided by the engine). */
export interface ItemUseContext {
  /** Returns true if the companion actually ate the berry */
  feedCompanion: () => boolean;
  setJumpMultiplier: (mult: number) => void;
}

interface Pickup {
  type: ItemType;
  group: THREE.Group;
  halo: THREE.Mesh;
  baseY: number;
  available: boolean;
  respawnTimer: number;
  phase: number;
  fullWarnCooldown: number;
}

// ---------- 3D models ----------

function createBerryModel(): { group: THREE.Group; halo: THREE.Mesh } {
  const group = new THREE.Group();
  const berryMat = new THREE.MeshStandardMaterial({
    color: 0xc0306a,
    roughness: 0.25,
    metalness: 0.1,
    emissive: 0x6b0f3a,
    emissiveIntensity: 0.35,
  });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const berryGeom = new THREE.SphereGeometry(0.12, 12, 12);
  const shineGeom = new THREE.SphereGeometry(0.025, 6, 6);
  const offsets: [number, number, number][] = [
    [0, 0, 0],
    [0.13, -0.04, 0.05],
    [-0.11, -0.05, 0.06],
    [0.02, -0.06, -0.12],
  ];
  for (const [x, y, z] of offsets) {
    const b = new THREE.Mesh(berryGeom, berryMat);
    b.position.set(x, y, z);
    b.castShadow = true;
    const shine = new THREE.Mesh(shineGeom, shineMat);
    shine.position.set(x + 0.05, y + 0.06, z + 0.07);
    group.add(b, shine);
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f9d4a, roughness: 0.7, side: THREE.DoubleSide });
  for (const side of [1, -1]) {
    const leafGeom = new THREE.SphereGeometry(0.1, 8, 6);
    leafGeom.scale(1.4, 0.25, 0.7);
    const leaf = new THREE.Mesh(leafGeom, leafMat);
    leaf.position.set(0.08 * side, 0.13, 0);
    leaf.rotation.z = 0.5 * side;
    group.add(leaf);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 5), leafMat);
  stem.position.y = 0.14;
  group.add(stem);
  const halo = createHalo(0xf9a8d4);
  group.add(halo);
  return { group, halo };
}

function createWalnutModel(): { group: THREE.Group; halo: THREE.Mesh } {
  const group = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xb07a45,
    roughness: 0.45,
    metalness: 0.15,
    emissive: 0x4a2a0c,
    emissiveIntensity: 0.25,
  });
  const shellGeom = new THREE.SphereGeometry(0.2, 14, 12);
  shellGeom.scale(0.9, 1.1, 0.85);
  const shell = new THREE.Mesh(shellGeom, shellMat);
  shell.castShadow = true;
  group.add(shell);
  // Seam ridge and wrinkles
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.6 });
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 6, 20), ridgeMat);
  ridge.rotation.y = Math.PI / 2;
  ridge.scale.set(1, 1.15, 1);
  group.add(ridge);
  for (let i = -1; i <= 1; i++) {
    const wr = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 4, 14, Math.PI), ridgeMat);
    wr.position.set(0, i * 0.07, 0.03);
    wr.rotation.set(0, 0.3 * i, Math.PI / 2);
    group.add(wr);
  }
  // Golden sparkle (it's an energetic walnut!)
  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xfff1a8 }));
  spark.position.set(0.14, 0.18, 0.1);
  group.add(spark);
  const halo = createHalo(0xfcd34d);
  group.add(halo);
  return { group, halo };
}

function createHalo(color: number): THREE.Mesh {
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.39, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.12;
  return halo;
}

function createItemModel(type: ItemType) {
  return type === 'nuez' ? createWalnutModel() : createBerryModel();
}

// ---------- System ----------

export class ItemSystem {
  public slots: (ItemType | null)[] = new Array(INVENTORY_SIZE).fill(null);
  public superJumpLeft = 0;

  private pickups: Pickup[] = [];
  private root: THREE.Object3D;
  private eventId = 0;
  private eventText = '';

  constructor(root: THREE.Object3D) {
    this.root = root;
  }

  private emit(text: string) {
    this.eventId++;
    this.eventText = text;
  }

  public getStatus(): InventoryStatus {
    return {
      slots: [...this.slots],
      superJumpLeft: this.superJumpLeft,
      eventId: this.eventId,
      eventText: this.eventText,
    };
  }

  /** Builds the pickups for a level (removing the previous level's ones). */
  public loadSpots(spots: ItemSpot[]) {
    for (const p of this.pickups) {
      this.root.remove(p.group);
      p.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    }
    this.pickups = spots.map((s) => {
      const { group, halo } = createItemModel(s.type);
      group.position.copy(s.pos);
      this.root.add(group);
      return {
        type: s.type,
        group,
        halo,
        baseY: s.pos.y,
        available: true,
        respawnTimer: 0,
        phase: Math.random() * 10,
        fullWarnCooldown: 0,
      };
    });
  }

  /** Every pickup back in its place (new run). */
  public resetPickups() {
    for (const p of this.pickups) {
      p.available = true;
      p.respawnTimer = 0;
      p.group.visible = true;
      p.group.scale.setScalar(1);
    }
  }

  /** Empties the backpack and stops item effects (new game). */
  public clearInventory(ctx?: ItemUseContext) {
    this.slots.fill(null);
    this.superJumpLeft = 0;
    ctx?.setJumpMultiplier(1);
  }

  /** Uses the item in a slot (0-4). */
  public use(slot: number, ctx: ItemUseContext): boolean {
    const type = this.slots[slot];
    if (!type) {
      this.emit(`El espacio ${slot + 1} está vacío`);
      return false;
    }
    let used = false;
    switch (type) {
      case 'baya':
        used = ctx.feedCompanion();
        break;
      case 'nuez':
        this.superJumpLeft = SUPER_JUMP_SECONDS;
        ctx.setJumpMultiplier(1.4);
        soundManager.playTimeBonus();
        this.emit('¡Súper salto activado! 🌰');
        used = true;
        break;
    }
    if (used) this.slots[slot] = null;
    return used;
  }

  /** Drops (discards) the item in a slot. */
  public discard(slot: number) {
    const type = this.slots[slot];
    if (!type) return;
    this.slots[slot] = null;
    this.emit(`Tiraste: ${ITEM_INFO[type].name}`);
  }

  public update(dt: number, playerPos: THREE.Vector3, ctx: ItemUseContext) {
    // Timed effects
    if (this.superJumpLeft > 0) {
      this.superJumpLeft -= dt;
      if (this.superJumpLeft <= 0) {
        this.superJumpLeft = 0;
        ctx.setJumpMultiplier(1);
        this.emit('Se acabó el súper salto');
      }
    }

    for (const p of this.pickups) {
      if (!p.available) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.available = true;
          p.group.visible = true;
          p.group.scale.setScalar(1);
        } else if (p.group.visible) {
          p.group.scale.multiplyScalar(Math.max(0, 1 - dt * 8));
          if (p.group.scale.x < 0.02) p.group.visible = false;
        }
        continue;
      }
      p.phase += dt;
      p.fullWarnCooldown = Math.max(0, p.fullWarnCooldown - dt);
      p.group.position.y = p.baseY + Math.sin(p.phase * 2.6) * 0.12;
      p.group.rotation.y += dt * 1.4;
      (p.halo.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(p.phase * 5) * 0.2;

      if (p.group.position.distanceTo(playerPos) < 1.5) {
        const free = this.slots.indexOf(null);
        if (free === -1) {
          if (p.fullWarnCooldown <= 0) {
            this.emit('Tu mochila está llena (5/5). Usa o tira algo');
            p.fullWarnCooldown = 3;
          }
          continue;
        }
        this.slots[free] = p.type;
        p.available = false;
        p.respawnTimer = RESPAWN_SECONDS;
        soundManager.playCollectible();
        const info = ITEM_INFO[p.type];
        this.emit(`Guardaste: ${info.emoji} ${info.name} (tecla ${free + 1})`);
      }
    }
  }

  public dispose() {
    this.loadSpots([]);
  }
}
