/**
 * Items & Backpack (5 slots)
 * Pickups placed around each level (magic berries, walnuts, …) go into a
 * 5-slot backpack when touched. Use them any time with keys 1-5 or the HUD.
 *  - Baya mágica: feeds your companion and recharges its power
 *  - Nuez energética: super jump for a while
 *  - Boss fights: resortera (shoots piedras), bate & red (wear out with use), bombas,
 *    orbes de luz and antorchas. Piedras, bombas and orbes stack in one slot.
 * New item types only need an entry in ITEM_INFO, a 3D model and a use effect.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import { createToolModel } from './toolModels';

export type ItemType =
  | 'baya'
  | 'nuez'
  | 'llave'
  | 'resortera'
  | 'piedra'
  | 'bate'
  | 'red'
  | 'bomba'
  | 'luz'
  | 'antorcha'
  | 'palanca'
  | 'craneo'
  | 'daga';

export interface ItemInfo {
  type: ItemType;
  name: string;
  desc: string;
  color: string;
}

export const ITEM_INFO: Record<ItemType, ItemInfo> = {
  baya: {
    type: 'baya',
    name: 'Baya mágica',
    desc: 'Alimenta a tu compañero y recarga su poder.',
    color: '#f9a8d4',
  },
  nuez: {
    type: 'nuez',
    name: 'Nuez energética',
    desc: 'Súper salto: saltas mucho más alto durante 10 segundos.',
    color: '#fcd34d',
  },
  llave: {
    type: 'llave',
    name: 'Llave',
    desc: 'Abre una puerta cerrada de este nivel. Se usa sola al llegar a la puerta.',
    color: '#facc15',
  },
  resortera: {
    type: 'resortera',
    name: 'Resortera',
    desc: 'Dispara una piedra al objetivo marcado (gira la cámara para elegirlo). En los Backrooms aturde al monstruo más cercano. Necesita piedras.',
    color: '#b45309',
  },
  piedra: {
    type: 'piedra',
    name: 'Piedras',
    desc: 'Munición de la resortera. Junta los montoncitos del suelo.',
    color: '#a8a29e',
  },
  bate: {
    type: 'bate',
    name: 'Bate',
    desc: 'Golpea lo que tengas enfrente (tecla V). En los Backrooms aturde a los monstruos un momento. Se rompe tras varios golpes.',
    color: '#d97706',
  },
  red: {
    type: 'red',
    name: 'Red',
    desc: 'Lánzala al objetivo marcado para atraparlo. Se rompe tras unos usos.',
    color: '#22d3ee',
  },
  bomba: {
    type: 'bomba',
    name: 'Bomba',
    desc: 'Lánzala al objetivo marcado. ¡Explota al llegar!',
    color: '#ef4444',
  },
  luz: {
    type: 'luz',
    name: 'Orbe de luz',
    desc: 'Lánzalo al monstruo glitch para dañarlo. En los Backrooms es una granada de luz: ciega a los monstruos unos segundos.',
    color: '#fde68a',
  },
  antorcha: {
    type: 'antorcha',
    name: 'Antorcha',
    desc: 'Alumbra en la oscuridad y prende 2 candelabros al acercarte; luego se consume.',
    color: '#fb923c',
  },
  palanca: {
    type: 'palanca',
    name: 'Palanca',
    desc: 'La suelta el guardián de la arena. Abre la trampilla del sótano: se usa sola al pararte sobre ella.',
    color: '#94a3b8',
  },
  craneo: {
    type: 'craneo',
    name: 'Cráneo de obsidiana',
    desc: 'Úsalo cuando el Skinwalker esté cerca: lo espanta y huye un rato. Sirve 2 veces.',
    color: '#7c3aed',
  },
  daga: {
    type: 'daga',
    name: 'Daga de obsidiana',
    desc: 'Lo único que lastima al Skinwalker. Úsala cuando lo tengas enfrente; se rompe al primer golpe.',
    color: '#a78bfa',
  },
};

export const ITEM_TYPES: ItemType[] = ['baya', 'nuez', 'llave', 'resortera', 'piedra', 'bate', 'red', 'bomba', 'luz', 'antorcha', 'palanca', 'craneo', 'daga'];

/** Items that pile up in one slot (max per slot) */
export const STACK_MAX: Partial<Record<ItemType, number>> = { piedra: 12, bomba: 3, luz: 3 };
/** Tools that break: uses when new */
export const DURABILITY: Partial<Record<ItemType, number>> = { bate: 12, red: 4, antorcha: 2, craneo: 2, daga: 1 };
/** How many you get from one pickup */
const PICKUP_AMOUNT: Partial<Record<ItemType, number>> = { piedra: 6, bomba: 2 };
/** Only one of these is ever needed in the backpack */
/** Shown when you walk over something you already carry (one of each kind until it's used up) */
const ALREADY_HAVE: Record<ItemType, string> = {
  baya: 'Ya llevas una baya: dásela a tu compañero antes de tomar otra',
  nuez: 'Ya llevas una nuez: úsala antes de tomar otra',
  llave: 'Ya llevas una llave: úsala en su puerta antes de tomar otra',
  resortera: 'Ya tienes una resortera',
  piedra: 'Ya tienes piedras: úsalas todas antes de juntar más',
  bate: 'Ya tienes un bate: úsalo hasta que se rompa para tomar otro',
  red: 'Ya tienes una red: úsala hasta que se rompa para tomar otra',
  bomba: 'Ya tienes bombas: lánzalas antes de tomar más',
  luz: 'Ya tienes orbes de luz: lánzalos antes de tomar más',
  antorcha: 'Ya tienes una antorcha: gástala antes de tomar otra',
  palanca: 'Ya llevas una palanca: úsala en la trampilla antes de tomar otra',
  craneo: 'Ya tienes un cráneo de obsidiana: gástalo antes de tomar otro',
  daga: 'Ya tienes una daga: úsala contra el Skinwalker',
};
/** Seconds before a pickup appears again */
const RESPAWN_BY_TYPE: Partial<Record<ItemType, number>> = { piedra: 8, bate: 14, red: 14, resortera: 10, bomba: 9, antorcha: 6, craneo: 10 };

/** Count shown for a slot: stack size, uses left, or 1. */
export function defaultCount(type: ItemType): number {
  return DURABILITY[type] ?? PICKUP_AMOUNT[type] ?? 1;
}

/** Result of a combat tool action: not done, done, or done and it wore the tool / spent ammo. */
export type ToolResult = 'none' | 'used' | 'wear';

export const INVENTORY_SIZE = 5;
const RESPAWN_SECONDS = 30;
const SUPER_JUMP_SECONDS = 10;

export interface ItemSpot {
  type: ItemType;
  pos: THREE.Vector3;
}

export interface InventoryStatus {
  slots: (ItemType | null)[];
  /** Stack size (piedras, bombas…) or uses left (bate, red); 1 for the rest */
  counts: number[];
  superJumpLeft: number;
  eventId: number;
  eventText: string;
}

/** What using an item can affect (provided by the engine). */
export interface ItemUseContext {
  /** Returns true if the companion actually ate the berry */
  feedCompanion: () => boolean;
  setJumpMultiplier: (mult: number) => void;
  /** Boss fights: shoot, swing or throw (provided while a combat system is active) */
  tool?: (type: ItemType) => ToolResult;
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
  /** One-shot drops (e.g. stolen from an enemy) disappear for good once picked up */
  oneShot?: boolean;
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

function createKeyModel(): { group: THREE.Group; halo: THREE.Mesh } {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.9, emissive: 0x8a5a00, emissiveIntensity: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20), gold);
  ring.position.y = 0.2;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.07), gold);
  shaft.position.y = -0.1;
  const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.07), gold);
  tooth1.position.set(0.08, -0.24, 0);
  const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.07), gold);
  tooth2.position.set(0.06, -0.12, 0);
  for (const m of [ring, shaft, tooth1, tooth2]) {
    m.castShadow = true;
    group.add(m);
  }
  const halo = createHalo(0xfde047);
  halo.position.y = -0.35;
  group.add(halo);
  return { group, halo };
}

function createItemModel(type: ItemType): { group: THREE.Group; halo: THREE.Mesh } {
  if (type === 'llave') return createKeyModel();
  if (type === 'nuez') return createWalnutModel();
  if (type === 'baya') return createBerryModel();
  const group = createToolModel(type);
  const halo = createHalo(new THREE.Color(ITEM_INFO[type].color).getHex());
  group.add(halo);
  return { group, halo };
}

/** The 3D item mesh for world pickups or UI previews (halo optional). */
export function createItemMesh(type: ItemType, withHalo = false): THREE.Group {
  const built = createItemModel(type);
  if (!withHalo) built.group.remove(built.halo);
  return built.group;
}

/** The 3D key model (also used on enemies that carry it). */
export function createKeyMesh(): THREE.Group {
  return createItemMesh('llave', false);
}

let itemPreviewUrls: Record<ItemType, string> | null = null;

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
}

/** Renders each item's 3D model once to a transparent PNG for HUD thumbs. */
export function getItemPreviewUrl(type: ItemType): string {
  if (typeof document === 'undefined') return '';
  if (!itemPreviewUrls) {
    const size = 128;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(2);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
    camera.position.set(0.55, 0.42, 0.85);
    camera.lookAt(0, 0.02, 0);
    const key = new THREE.DirectionalLight(0xfff6e8, 1.35);
    key.position.set(2.2, 3.4, 4);
    scene.add(key, new THREE.AmbientLight(0xffffff, 0.62));
    const fill = new THREE.DirectionalLight(0xb8d4ff, 0.45);
    fill.position.set(-2, 1.2, -1.5);
    scene.add(fill);

    const urls = {} as Record<ItemType, string>;
    for (const itemType of ITEM_TYPES) {
      const mesh = createItemMesh(itemType, false);
      mesh.scale.setScalar(itemType === 'llave' ? 1.55 : itemType === 'nuez' ? 2.05 : itemType === 'baya' ? 2.35 : 1.3);
      if (itemType === 'llave') mesh.rotation.z = -0.35;
      scene.add(mesh);
      renderer.render(scene, camera);
      urls[itemType] = renderer.domElement.toDataURL('image/png');
      scene.remove(mesh);
      disposeObject(mesh);
    }
    renderer.dispose();
    itemPreviewUrls = urls;
  }
  return itemPreviewUrls[type];
}

// ---------- System ----------

export class ItemSystem {
  public slots: (ItemType | null)[] = new Array(INVENTORY_SIZE).fill(null);
  public counts: number[] = new Array(INVENTORY_SIZE).fill(0);
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
      counts: [...this.counts],
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
    // One-time drops (keys taken from enemies) disappear on a new run
    for (const p of this.pickups) {
      if (p.oneShot) this.root.remove(p.group);
    }
    this.pickups = this.pickups.filter((p) => !p.oneShot);
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
    this.counts.fill(0);
    this.superJumpLeft = 0;
    ctx?.setJumpMultiplier(1);
  }

  /** Sets inventory slots directly (used when syncing from backend). */
  public setSlots(newSlots: (ItemType | null)[]) {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const t = newSlots[i] ?? null;
      this.slots[i] = t && ITEM_INFO[t] ? t : null;
      this.counts[i] = this.slots[i] ? defaultCount(this.slots[i]!) : 0;
    }
    this.emit('Mochila sincronizada');
  }

  /** Uses the item in a slot (0-4). */
  public use(slot: number, ctx: ItemUseContext): boolean {
    const type = this.slots[slot];
    if (!type) {
      this.emit(`El espacio ${slot + 1} está vacío`);
      return false;
    }
    // Boss-fight tools
    if (type === 'resortera' || type === 'piedra') return this.shoot(ctx);
    if (type === 'antorcha') {
      const left = this.counts[slot];
      this.emit(`La antorcha prende los candelabros sola: acércate a uno (le ${left === 1 ? 'queda 1 uso' : `quedan ${left} usos`})`);
      return false;
    }
    if (type === 'bate' || type === 'red' || type === 'bomba' || type === 'luz' || type === 'craneo' || type === 'daga') {
      const r = ctx.tool ? ctx.tool(type) : 'none';
      if (r === 'none') {
        if (!ctx.tool) this.emit(`${ITEM_INFO[type].name}: sirve en las luchas contra jefes`);
        return false;
      }
      if (r === 'wear') this.spend(slot);
      return true;
    }
    let used = false;
    switch (type) {
      case 'baya':
        used = ctx.feedCompanion();
        break;
      case 'llave':
        this.emit('La llave se usa sola: acércate a una puerta cerrada');
        return false;
      case 'palanca':
        this.emit('La palanca se usa sola: párate sobre la trampilla del sótano');
        return false;
      case 'nuez':
        this.superJumpLeft = SUPER_JUMP_SECONDS;
        ctx.setJumpMultiplier(1.4);
        soundManager.playTimeBonus();
        this.emit('¡Súper salto activado!');
        used = true;
        break;
    }
    if (used) this.clearSlot(slot);
    return used;
  }

  private clearSlot(slot: number) {
    this.slots[slot] = null;
    this.counts[slot] = 0;
  }

  /** One less stone/bomb/orb, or one use less of a tool (it breaks at 0). */
  private spend(slot: number) {
    const type = this.slots[slot];
    if (!type) return;
    this.counts[slot] = Math.max(0, this.counts[slot] - 1);
    if (this.counts[slot] > 0) return;
    this.clearSlot(slot);
    if (DURABILITY[type] !== undefined) {
      soundManager.playEnemyBonk();
      this.emit(
        type === 'bate'
          ? '¡Tu bate se rompió! Busca otro en la arena'
          : type === 'antorcha'
            ? '¡Tu antorcha se consumió! Toma otra para seguir prendiendo'
            : type === 'craneo'
              ? 'El cráneo de obsidiana se hizo polvo: toma otro'
              : type === 'daga'
                ? 'La daga se rompió dentro de él… ¡busca otra!'
                : '¡Tu red se rompió! Busca otra en la arena'
      );
    }
  }

  /** A gift (companion actions): tops up a stack, refills a tool you carry, or takes a free slot. */
  public grant(type: ItemType, amount = 1): boolean {
    const max = STACK_MAX[type];
    const full = DURABILITY[type];
    let slot = this.slots.indexOf(type);
    if (slot !== -1 && (max !== undefined || full !== undefined)) {
      this.counts[slot] = full !== undefined ? full : Math.min(max!, this.counts[slot] + amount);
      return true;
    }
    if (slot !== -1) return false;
    slot = this.slots.indexOf(null);
    if (slot === -1) return false;
    this.slots[slot] = type;
    this.counts[slot] = full ?? (max !== undefined ? Math.min(max, amount) : 1);
    return true;
  }

  /** One use less of a tool you carry (e.g. the torch lit a candelabra). */
  public wear(type: ItemType): boolean {
    const slot = this.slots.indexOf(type);
    if (slot === -1) return false;
    this.spend(slot);
    return true;
  }

  /** Slingshot: needs the slingshot and at least one stone. */
  private shoot(ctx: ItemUseContext): boolean {
    if (!this.has('resortera')) {
      this.emit('Las piedras se lanzan con una resortera: busca una');
      return false;
    }
    const s = this.slots.indexOf('piedra');
    if (s === -1) {
      this.emit('No tienes piedras: junta los montoncitos del suelo');
      return false;
    }
    const r = ctx.tool ? ctx.tool('resortera') : 'none';
    if (r === 'none') {
      if (!ctx.tool) this.emit('La resortera sirve en las luchas contra jefes');
      return false;
    }
    if (r === 'wear') this.spend(s);
    return true;
  }

  /** Total of a stackable item (e.g. stones) across slots. */
  public total(type: ItemType): number {
    let n = 0;
    for (let i = 0; i < this.slots.length; i++) if (this.slots[i] === type) n += Math.max(1, this.counts[i]);
    return n;
  }

  /** First slot holding a type (−1 if none). */
  public slotOf(type: ItemType): number {
    return this.slots.indexOf(type);
  }

  /** Shows a message in the HUD toast (used by puzzles). */
  public notify(text: string) {
    this.emit(text);
  }

  public has(type: ItemType): boolean {
    return this.slots.includes(type);
  }

  public count(type: ItemType): number {
    let n = 0;
    for (const slot of this.slots) if (slot === type) n++;
    return n;
  }

  /** Uses every slot of a type. Stops early for berries once the companion is full. */
  public useAllOfType(type: ItemType, ctx: ItemUseContext): number {
    if (type === 'llave') return 0;
    let used = 0;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] !== type) continue;
      if (this.use(i, ctx)) used++;
      else if (type === 'baya') break;
    }
    return used;
  }

  /** Removes one item of a type from the backpack. Returns false if there wasn't any. */
  public consume(type: ItemType): boolean {
    const i = this.slots.indexOf(type);
    if (i === -1) return false;
    this.clearSlot(i);
    return true;
  }

  /** Removes every item of a type (e.g. keys when changing level). */
  public removeAllOfType(type: ItemType) {
    for (let i = 0; i < this.slots.length; i++) if (this.slots[i] === type) this.clearSlot(i);
  }

  /** True if a pickup of this type is currently lying in the world. */
  public isLyingAround(type: ItemType): boolean {
    return this.pickups.some((p) => p.type === type && p.available);
  }

  /** Nearest pickup of a type lying on the ground within `maxDist` (horizontal), or null. */
  public nearestLying(type: ItemType, from: THREE.Vector3, maxDist: number): THREE.Vector3 | null {
    let best: (typeof this.pickups)[number] | null = null;
    let bestD = maxDist;
    for (const p of this.pickups) {
      if (p.type !== type || !p.available) continue;
      const d = Math.hypot(p.group.position.x - from.x, p.group.position.z - from.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best ? new THREE.Vector3(best.group.position.x, best.baseY, best.group.position.z) : null;
  }

  /** Someone else (a boss) takes a pickup off the ground; it comes back after the usual time. */
  public takeLying(type: ItemType, near: THREE.Vector3, maxDist = 1.8): boolean {
    for (const p of this.pickups) {
      if (p.type !== type || !p.available) continue;
      if (Math.hypot(p.group.position.x - near.x, p.group.position.z - near.z) > maxDist) continue;
      p.available = false;
      p.respawnTimer = p.oneShot ? 1e9 : RESPAWN_BY_TYPE[p.type] ?? RESPAWN_SECONDS;
      return true;
    }
    return false;
  }

  /** Spawns a one-time pickup (e.g. a key dropped by an enemy). */
  public spawnDrop(type: ItemType, pos: THREE.Vector3) {
    const { group, halo } = createItemModel(type);
    group.position.copy(pos);
    this.root.add(group);
    this.pickups.push({ type, group, halo, baseY: pos.y, available: true, respawnTimer: 0, phase: 0, fullWarnCooldown: 0, oneShot: true });
  }

  /** Drops (discards) the item in a slot. Returns the removed type. */
  public discard(slot: number): ItemType | null {
    const type = this.slots[slot];
    if (!type) return null;
    this.clearSlot(slot);
    this.emit(`Tiraste: ${ITEM_INFO[type].name}`);
    return type;
  }

  /** Puts an item back after discard. Prefers the original slot. */
  public restore(slot: number, type: ItemType): boolean {
    if (this.slots[slot] === null) {
      this.slots[slot] = type;
      this.counts[slot] = defaultCount(type);
      this.emit(`Recuperaste: ${ITEM_INFO[type].name}`);
      return true;
    }
    const free = this.slots.indexOf(null);
    if (free === -1) {
      this.emit('Tu mochila está llena; no se pudo recuperar');
      return false;
    }
    this.slots[free] = type;
    this.counts[free] = defaultCount(type);
    this.emit(`Recuperaste: ${ITEM_INFO[type].name}`);
    return true;
  }

  /** Removes every item of a type and returns what was taken (for undo). */
  public discardAllOfType(type: ItemType): { slot: number; type: ItemType }[] {
    const removed: { slot: number; type: ItemType }[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] !== type) continue;
      removed.push({ slot: i, type });
      this.clearSlot(i);
    }
    return removed;
  }

  public restoreMany(entries: { slot: number; type: ItemType }[]): number {
    let n = 0;
    for (const entry of entries) {
      if (this.slots[entry.slot] === null) {
        this.slots[entry.slot] = entry.type;
        this.counts[entry.slot] = defaultCount(entry.type);
        n++;
        continue;
      }
      const free = this.slots.indexOf(null);
      if (free === -1) break;
      this.slots[free] = entry.type;
      this.counts[free] = defaultCount(entry.type);
      n++;
    }
    if (n > 0) this.emit(`Recuperaste ${n} objeto${n === 1 ? '' : 's'}`);
    return n;
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
        // A key only comes back if you don't already carry one
        if (!(p.type === 'llave' && !p.oneShot && this.has('llave'))) p.respawnTimer -= dt;
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

      const dx = p.group.position.x - playerPos.x;
      const dz = p.group.position.z - playerPos.z;
      const dy = p.group.position.y - playerPos.y;
      const distXZ = Math.hypot(dx, dz);

      if (distXZ < 1.45 && dy >= -0.5 && dy <= 2.2) {
        const info = ITEM_INFO[p.type];
        // One of each kind: use up (or break) what you carry before taking another
        if (this.has(p.type)) {
          if (p.fullWarnCooldown <= 0) {
            this.emit(ALREADY_HAVE[p.type]);
            p.fullWarnCooldown = 4;
          }
          continue;
        }
        const amount = PICKUP_AMOUNT[p.type] ?? 1;
        const max = STACK_MAX[p.type];
        const slot = this.slots.indexOf(null);
        if (slot === -1) {
          if (p.fullWarnCooldown <= 0) {
            this.emit('¡Mochila llena (5/5)! Usa o tira un objeto primero');
            p.fullWarnCooldown = 2.5;
          }
          continue;
        }
        this.slots[slot] = p.type;
        this.counts[slot] = max !== undefined ? Math.min(max, amount) : defaultCount(p.type);
        p.available = false;
        p.respawnTimer = p.oneShot ? 1e9 : p.type === 'llave' ? 6 : RESPAWN_BY_TYPE[p.type] ?? RESPAWN_SECONDS;
        soundManager.playCollectible();
        const extra = max !== undefined ? ` (${this.total(p.type)})` : '';
        this.emit(`Guardaste: ${info.name}${extra} (tecla ${slot + 1})`);
      }
    }
  }

  public dispose() {
    this.loadSpots([]);
  }
}
