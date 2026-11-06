/**
 * Combat system for the "Lucha contra jefes" levels.
 *  - Player life bar (100). Boss attacks, minions and shockwaves take life away; at 0 you
 *    faint and go back to the entrance with full life. Hamburguesas (+40) and papitas (+20)
 *    lying around the arena heal you (only when you are hurt) and come back after a while.
 *  - Parties: a player who faints stays down where they fell; a friend who stands next to
 *    them for a few seconds gives them CPR and they get up with half their life. If nobody
 *    comes in time (or everybody is down) they wake up at the entrance as usual.
 *  - Tools from the backpack: the slingshot shoots stones, the net and bombs are lobbed and
 *    light orbs are thrown — all at the target marked by the reticle (the one closest to
 *    where the camera looks). The bat hits what is in front of you (key V).
 *  - Falling on a minion's (or a stunned boss') head also hits it.
 *  - Parties: boss damage / healing and key moments (nets, candelabra, abductions,
 *    rescues) are shared through multiplayer "world events" so everybody fights the same boss.
 * The boss behaviours live in bosses.ts.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import type { BossSetup } from './bossArena';
import type { ItemSystem, ItemType, ToolResult } from './items';
import type { ParkourPhysics, PlayerInput } from './physics';
import type { PlayerCharacterModel } from './models';
import type { CharacterAppearance } from './character';
import type { ProceduralTextures } from './textures';
import { Effect, makeReticle, makeWaveRing, puffEffect } from './combatFx';
import { COMPANION_POWERS } from './companionPowers';
import { makeGlowTexture } from './levelKit';
import { makeBat, makeBomb, makeBurger, makeFlame, makeFries, makeLightOrb, makeNetProjectile, makeStone } from './toolModels';
import { BossController, createBossController } from './bosses';

export type ShotKind = 'piedra' | 'red' | 'bomba' | 'luz';
export type HitKind = ShotKind | 'bate' | 'stomp';

export interface AimTarget {
  /** World position (may be a live vector) */
  pos: THREE.Vector3;
  radius: number;
  accepts: HitKind[];
  /** Height of its head, for stomps */
  top?: number;
  /** Not offered to the reticle (still hittable) */
  noAim?: boolean;
  /** Preferred by the reticle */
  priority?: number;
  hit: (kind: HitKind, at: THREE.Vector3) => void;
}

export interface RemoteInfo {
  userId: string;
  username: string;
  pos: THREE.Vector3;
  grabbed: boolean;
  /** Fainted, waiting for CPR */
  down: boolean;
}

export interface CombatDeps {
  root: THREE.Object3D;
  textures: ProceduralTextures;
  items: ItemSystem;
  physics: () => ParkourPhysics;
  playerModel: () => PlayerCharacterModel;
  appearance: () => CharacterAppearance;
  cameraYaw: () => number;
  notify: (text: string) => void;
  /** Broadcast a world event to the party (no-op when playing alone) */
  send: (kind: string, i?: number, v?: number, target?: string) => void;
  /** True for the one player that decides shared random events (always true alone) */
  isHost: () => boolean;
  myId: () => string | null;
  remotes: () => RemoteInfo[];
  setRemoteGrabbed: (userId: string, on: boolean) => void;
  setRemoteDown: (userId: string, on: boolean) => void;
  openPortal: () => void;
  closePortal: () => void;
  /** The fight is lost (e.g. every cow taken): game over with this reason */
  lose: (reason: string) => void;
  /** Gives movement back to the player (unless a menu is open) */
  unlockMovement: () => void;
}

export interface CombatStatus {
  hp: number;
  maxHp: number;
  bossName: string;
  bossShort: string;
  bossHp: number;
  bossMax: number;
  hint: string;
  darkness: number;
  grabbed: { count: number; need: number } | null;
  defeated: boolean;
  portalOpen: boolean;
  /** Increments every time the player gets hurt (HUD flash) */
  hurtId: number;
  /** Fainted in a party, waiting for a friend's CPR */
  down: boolean;
  /** Red, pulsing hint (grabbed, fainted) */
  urgent: boolean;
  /** The companion is giving a tip (press I): who talks and what it says */
  tip: { from: string; text: string } | null;
  /** Companion special move for this boss (power button) */
  action: { name: string; desc: string; cd: number; cdMax: number } | null;
  /** Fight objective counter (e.g. cows left) */
  objective: { label: string; have: number; total: number } | null;
}

interface Shot {
  kind: ShotKind;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  g: number;
  life: number;
  radius: number;
  target: AimTarget | null;
  homing: number;
}

interface Food {
  group: THREE.Group;
  kind: 'burger' | 'fries';
  base: THREE.Vector3;
  available: boolean;
  timer: number;
  phase: number;
}

interface Wave {
  /** Attack kind (a companion can shield you from it) */
  tag?: string;
  center: THREE.Vector3;
  r: number;
  speed: number;
  maxR: number;
  height: number;
  dmg: number;
  hit: boolean;
  mesh: THREE.Mesh;
}

interface Grab {
  holder: { pos: THREE.Vector3; onRelease: (reason: 'struggle' | 'friend' | 'eaten' | 'other') => void };
  count: number;
  need: number;
}

const SHOT_SPEC: Record<ShotKind, { speed: number; g: number; radius: number; range: number; homing: number; color: string }> = {
  piedra: { speed: 30, g: 9, radius: 0.22, range: 46, homing: 3.5, color: '#f8fafc' },
  red: { speed: 17, g: 15, radius: 0.55, range: 26, homing: 0, color: '#22d3ee' },
  bomba: { speed: 17, g: 15, radius: 0.3, range: 28, homing: 1.2, color: '#f87171' },
  luz: { speed: 19, g: 10, radius: 0.3, range: 30, homing: 3, color: '#fde68a' },
};

const FOOD_HEAL = { burger: 40, fries: 20 };
/** Seconds between companion actions in a boss fight */
const ACTION_COOLDOWN = 20;

/** A companion's special move against one boss (one per companion and boss). */
export interface CompanionAction {
  name: string;
  desc: string;
  /** Where the companion flies (default: you) */
  target?: () => THREE.Vector3;
  run: () => void;
  /** Can be used while caught or fainted */
  anytime?: boolean;
}
const FOOD_RESPAWN = 25;
/** Seconds a fainted player waits for CPR before waking up at the entrance */
const DOWN_WAIT = 25;
/** Seconds of CPR needed (standing next to the friend) */
const CPR_TIME = 3;
const CPR_RANGE = 1.9;

export class CombatSystem {
  public readonly setup: BossSetup;
  public readonly deps: CombatDeps;
  public hp = 100;
  public readonly maxHp = 100;
  public defeated = false;
  public portalOpen = false;
  /** 0 → 1, Dracula's darkness (applied to the lights by the engine) */
  public darkness = 0;
  public darknessTarget = 0;
  public hurtId = 0;
  public grab: Grab | null = null;
  public time = 0;
  /** Seconds of fight simulated so far */
  public elapsed = 0;

  private boss: BossController;
  public invuln = 0;
  private shots: Shot[] = [];
  private food: Food[] = [];
  private waves: Wave[] = [];
  private effects: Effect[] = [];
  private targets: AimTarget[] = [];
  private reticles: Partial<Record<ShotKind, THREE.Sprite>> = {};
  private bat: THREE.Group;
  private batT = -1;
  private batCooldown = 0;
  private torchLight: THREE.PointLight | null = null;
  private torchFlame: THREE.Group | null = null;
  private prevJump = false;
  private defeatTimer = -1;
  private msgCooldown: Record<string, number> = {};
  private stompCooldown = 0;
  /** Companion tip (key I): it flies around the boss like a fairy guide while it talks */
  private tip: { t: number; dur: number } | null = null;
  /** Companion boss action (power button): it flies to its target and does its thing */
  private mission: { t: number; target: () => THREE.Vector3; run: () => void; done: boolean; color: string } | null = null;
  /** Seconds until the companion can act again */
  private actionCd = 0;
  /** Attacks a companion is shielding you from: tag → seconds left */
  private immune: Record<string, number> = {};
  /** Jade guarding you: helpers of the boss that come close get eaten */
  public guardT = 0;
  private guide: THREE.Group | null = null;
  private tipIntroShown = false;
  private readonly _home = new THREE.Vector3();
  private readonly _orbit = new THREE.Vector3();
  /** Fainted in a party: seconds left to be revived */
  private downT = -1;
  /** CPR being given to a friend */
  private cpr: { userId: string; username: string; k: number; puff: number; active: boolean } | null = null;
  private _v = new THREE.Vector3();
  private _w = new THREE.Vector3();

  constructor(setup: BossSetup, deps: CombatDeps) {
    this.setup = setup;
    this.deps = deps;
    deps.closePortal();
    setup.portal.group.visible = false;

    for (const f of setup.food) {
      const group = f.kind === 'burger' ? makeBurger() : makeFries();
      group.position.copy(f.pos);
      deps.root.add(group);
      this.food.push({ group, kind: f.kind, base: f.pos.clone(), available: true, timer: 0, phase: Math.random() * 6 });
    }
    for (const k of ['piedra', 'red', 'bomba', 'luz'] as ShotKind[]) {
      const r = makeReticle(SHOT_SPEC[k].color);
      deps.root.add(r);
      this.reticles[k] = r;
    }
    this.bat = makeBat();
    this.bat.visible = false;
    deps.root.add(this.bat);
    if (setup.kind === 'dracula') {
      this.torchLight = new THREE.PointLight(0xffa04d, 0, 11, 1.4);
      deps.root.add(this.torchLight);
      this.torchFlame = makeFlame(0.12);
      this.torchFlame.visible = false;
      deps.root.add(this.torchFlame);
    }
    this.boss = createBossController(this);
  }

  // ------------------------------------------------------------------ helpers for bosses
  get physics(): ParkourPhysics {
    return this.deps.physics();
  }
  get playerPos(): THREE.Vector3 {
    return this.deps.physics().position;
  }
  /** Where the boss is (the camera tilts up when it is high above the player) */
  get focus(): THREE.Vector3 | null {
    return this.defeated ? null : this.boss.focusPoint();
  }
  get bossHp(): number {
    return this.boss.hp;
  }
  get bossMax(): number {
    return this.boss.maxHp;
  }

  addEffect(e: Effect) {
    this.effects.push(e);
  }

  /** Shows a message, at most once every `cooldown` seconds per key. */
  say(text: string, key = text, cooldown = 3) {
    const until = this.msgCooldown[key] ?? -1;
    if (this.time < until) return;
    this.msgCooldown[key] = this.time + cooldown;
    this.deps.notify(text);
  }

  /** Hurts the player (ignored while blinking after a hit). Knocks them away from `from`. */
  damagePlayer(amount: number, from: THREE.Vector3 | null, force = 10, up = 6, tag?: string): boolean {
    if (this.invuln > 0 || this.defeated || this.isDown) return false;
    if (tag && this.isImmune(tag)) {
      // A companion shield takes the hit
      this.invuln = 0.4;
      this.addEffect(puffEffect(this.deps.root, this.playerPos.clone().add(this._w.set(0, 1, 0)), 'rgba(253,224,71,0.9)', 1.8, 0.3));
      return false;
    }
    const ph = this.physics;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtId++;
    this.invuln = 1.1;
    soundManager.playEnemyBonk();
    if (from && !this.grab) {
      this._v.set(ph.position.x - from.x, 0, ph.position.z - from.z);
      if (this._v.lengthSq() < 0.001) this._v.set(0, 0, 1);
      this._v.normalize();
      ph.velocity.set(this._v.x * force, up, this._v.z * force);
      ph.isGrounded = false;
      ph.knockbackTimer = 0.35;
    }
    if (this.hp <= 0) this.faint();
    return true;
  }

  get isDown(): boolean {
    return this.downT >= 0;
  }

  /** Someone in the party who is up and could give CPR */
  private rescuerAvailable(): boolean {
    return this.deps.remotes().some((r) => !r.down);
  }

  private faint() {
    if (this.grab) this.releaseGrab('other');
    if (this.rescuerAvailable()) {
      // Stay down where you fell until a friend gives you CPR
      this.downT = DOWN_WAIT;
      this.hp = 0;
      this.cpr = null;
      const ph = this.physics;
      ph.velocity.set(0, Math.min(0, ph.velocity.y), 0);
      ph.isMovementLocked = true;
      const me = this.deps.myId();
      if (me) this.deps.send('down', 0, 1, me);
      this.deps.notify('¡Te desmayaste! Un amigo puede hacerte RCP');
      return;
    }
    this.wakeAtEntrance();
  }

  private wakeAtEntrance() {
    const wasDown = this.isDown;
    this.downT = -1;
    this.layDown(false);
    this.deps.unlockMovement();
    if (wasDown) {
      const me = this.deps.myId();
      if (me) this.deps.send('down', 0, 0, me);
    }
    this.deps.notify('¡Te desmayaste! Vuelves a la entrada con la vida llena');
    this.physics.respawnAtCheckpoint(0, true);
    this.hp = this.maxHp;
    this.invuln = 2;
  }

  /** A friend finished CPR on you: up again with half your life. */
  private revive(by: string) {
    if (!this.isDown) return;
    this.downT = -1;
    this.layDown(false);
    this.deps.unlockMovement();
    this.hp = Math.round(this.maxHp / 2);
    this.invuln = 2.5;
    this.physics.velocity.set(0, 6, 0);
    this.physics.isGrounded = false;
    const me = this.deps.myId();
    if (me) this.deps.send('down', 0, 0, me);
    soundManager.playCollectible();
    this.deps.notify(`¡${by} te revivió con RCP! Tienes la mitad de tu vida`);
  }

  /** Lying on the floor (fainted) or standing. */
  private layDown(on: boolean) {
    const g = this.deps.playerModel().group;
    if (on) {
      g.rotation.order = 'YXZ';
      g.rotation.x = -Math.PI / 2;
      g.position.y += 0.3;
    } else {
      g.rotation.x = 0;
      g.rotation.order = 'XYZ';
    }
  }

  /** Instant hit in an area (rock impact, laser, slam). */
  strike(pos: THREE.Vector3, radius: number, dmg: number, force = 10, up = 6, tag?: string) {
    const p = this.playerPos;
    const dxz = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (dxz < radius && p.y > pos.y - 1.2 && p.y < pos.y + 2.4) this.damagePlayer(dmg, pos, force, up, tag);
  }

  /** The fight is lost: the game shows why and lets you try again. */
  lose(reason: string) {
    if (this.defeated) return;
    if (this.grab) this.releaseGrab('other');
    this.deps.lose(reason);
  }

  /** Players in this boss fight (you + friends on this level). Bosses call more helpers for bigger parties. */
  get partySize(): number {
    return 1 + this.deps.remotes().length;
  }

  /** A companion shields you from one kind of attack for a while. */
  immunity(tag: string, seconds: number) {
    this.immune[tag] = Math.max(this.immune[tag] ?? 0, seconds);
  }

  isImmune(tag: string): boolean {
    return (this.immune[tag] ?? 0) > 0;
  }

  /** Life back (companion actions). */
  healPlayer(amount: number) {
    if (this.isDown) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.addEffect(puffEffect(this.deps.root, this.playerPos.clone().add(this._w.set(0, 1.2, 0)), 'rgba(244,114,182,0.95)', 2.4, 0.5));
    soundManager.playCollectible();
  }

  /** Expanding ring on the floor: jump over it! */
  shockwave(center: THREE.Vector3, maxR: number, speed: number, dmg: number, color = 0xfacc15, height = 0.8, tag?: string) {
    const mesh = makeWaveRing(color, height);
    mesh.position.copy(center);
    mesh.scale.set(0.1, 1, 0.1);
    this.deps.root.add(mesh);
    this.waves.push({ center: center.clone(), r: 0.1, speed, maxR, height, dmg, hit: false, mesh, tag });
  }

  /** Boss damage dealt by the local player (shared with the party). */
  damageBoss(amount: number) {
    if (this.defeated || amount <= 0) return;
    const dealt = Math.min(amount, this.boss.hp);
    this.applyBossDelta(-amount);
    this.deps.send('dmg', 0, dealt);
  }

  /** Boss healing (only the host decides it, the rest receive it). */
  healBoss(amount: number) {
    if (this.defeated) return;
    this.applyBossDelta(amount);
    this.deps.send('heal', 0, amount);
  }

  private applyBossDelta(delta: number, silent = false) {
    if (this.defeated) return;
    const before = this.boss.hp;
    this.boss.hp = Math.max(0, Math.min(this.boss.maxHp, this.boss.hp + delta));
    if (delta < 0 && !silent) this.boss.onHurt(before - this.boss.hp);
    if (this.boss.hp <= 0) this.startDefeat(silent);
  }

  private startDefeat(instant: boolean) {
    if (this.defeated) return;
    this.defeated = true;
    this.darknessTarget = 0;
    if (this.grab) this.releaseGrab('other');
    this.boss.onDefeat(instant);
    if (instant) {
      this.openPortal();
    } else {
      this.defeatTimer = 2.6;
      soundManager.playVictory();
      this.deps.notify(`¡Derrotaste a ${this.setup.short}!`);
    }
  }

  private openPortal() {
    if (this.portalOpen) return;
    this.portalOpen = true;
    this.setup.portal.group.visible = true;
    this.deps.openPortal();
    this.deps.notify('¡Se abrió el portal en el centro de la arena!');
    this.addEffect(puffEffect(this.deps.root, this.setup.portalPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 'rgba(125,211,252,0.9)', 7, 1.2));
  }

  /** Something grabs the player (dancing skeletons). */
  grabPlayer(holder: Grab['holder'], need: number): boolean {
    if (this.grab || this.invuln > 0 || this.defeated || this.isDown) return false;
    this.grab = { holder, count: 0, need };
    this.physics.velocity.set(0, 0, 0);
    this.physics.isMovementLocked = true;
    soundManager.playEnemyBonk();
    this.deps.notify('¡Te atrapó un esqueleto! Pulsa saltar muchas veces');
    const me = this.deps.myId();
    if (me) this.deps.send('grab', 0, 1, me);
    return true;
  }

  releaseGrab(reason: 'struggle' | 'friend' | 'eaten' | 'other') {
    const g = this.grab;
    if (!g) return;
    this.grab = null;
    this.deps.unlockMovement();
    this.invuln = Math.max(this.invuln, 1.2);
    const me = this.deps.myId();
    if (me) this.deps.send('grab', 0, 0, me);
    g.holder.onRelease(reason);
    if (reason === 'struggle' || reason === 'friend') {
      this.physics.velocity.set(0, 9, 0);
      this.physics.isGrounded = false;
      this.deps.notify(reason === 'friend' ? '¡Un amigo te rescató!' : '¡Te soltaste!');
    }
  }

  // ------------------------------------------------------------------ tools
  /** Called by the backpack when a combat item is used. */
  tool(type: ItemType): ToolResult {
    if (this.isDown) {
      this.say('Estás desmayado: espera a que un amigo te haga RCP', 'down-tool', 2);
      return 'none';
    }
    if (this.grab) {
      this.say('¡Primero suéltate! (pulsa saltar)', 'grab-tool', 1.5);
      return 'none';
    }
    if (type === 'bate') return this.swing();
    if (type === 'resortera') return this.shoot('piedra');
    if (type === 'red' || type === 'bomba' || type === 'luz') return this.shoot(type);
    return 'none';
  }

  private chest(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.playerPos).add(this._w.set(0, 1.2, 0));
  }

  /** Best target for a throw: the one closest to where the camera looks. */
  pickTarget(kind: ShotKind): AimTarget | null {
    const yaw = this.deps.cameraYaw();
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const from = this.chest(this._v);
    let best: AimTarget | null = null;
    let bestScore = Infinity;
    for (const t of this.targets) {
      if (t.noAim || !t.accepts.includes(kind)) continue;
      const dx = t.pos.x - from.x;
      const dz = t.pos.z - from.z;
      const dy = t.pos.y - from.y;
      const h = Math.hypot(dx, dz);
      const dist = Math.hypot(h, dy);
      if (dist > SHOT_SPEC[kind].range) continue;
      const ang = h < 1.5 ? 0 : Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / h)));
      if (ang > 0.75) continue;
      const score = ang + dist * 0.006 - (t.priority ?? 0);
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  private shoot(kind: ShotKind): ToolResult {
    const spec = SHOT_SPEC[kind];
    const target = this.pickTarget(kind);
    const from = this.chest(new THREE.Vector3());
    const yaw = this.deps.cameraYaw();
    from.x += Math.sin(yaw) * 0.5;
    from.z += Math.cos(yaw) * 0.5;
    const vel = new THREE.Vector3();
    if (target) {
      const to = target.pos;
      const dist = from.distanceTo(to);
      const t = Math.max(0.25, dist / spec.speed);
      vel.subVectors(to, from).divideScalar(t);
      vel.y += 0.5 * spec.g * t;
    } else {
      const lift = kind === 'piedra' ? 0.18 : 0.45;
      vel.set(Math.sin(yaw), lift, Math.cos(yaw)).normalize().multiplyScalar(spec.speed);
    }
    const mesh =
      kind === 'piedra' ? makeStone(0.14) : kind === 'red' ? makeNetProjectile() : kind === 'bomba' ? makeBomb() : makeLightOrb();
    mesh.position.copy(from);
    this.deps.root.add(mesh);
    this.shots.push({ kind, mesh, pos: from, vel, g: spec.g, life: 3.2, radius: spec.radius, target, homing: target ? spec.homing : 0 });
    if (kind === 'piedra') soundManager.playWoodRattle();
    else soundManager.playJump();
    // Face the throw
    this.deps.playerModel().group.rotation.y = Math.atan2(vel.x, vel.z);
    return 'wear';
  }

  private swing(): ToolResult {
    if (this.batCooldown > 0) return 'none';
    this.batCooldown = 0.42;
    this.batT = 0;
    soundManager.playWindGust();
    const p = this.playerPos;
    const model = this.deps.playerModel();
    // Turn towards the nearest thing worth hitting
    let best: AimTarget | null = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (!t.accepts.includes('bate')) continue;
      const dx = t.pos.x - p.x;
      const dz = t.pos.z - p.z;
      const dy = t.pos.y - (p.y + 1);
      const reach = Math.hypot(dx, dz) - t.radius;
      if (reach > 2.1 || dy < -1.8 || dy > 2.6) continue;
      if (reach < bestD) {
        bestD = reach;
        best = t;
      }
    }
    if (!best) return 'used';
    model.group.rotation.y = Math.atan2(best.pos.x - p.x, best.pos.z - p.z);
    best.hit('bate', best.pos.clone());
    this.addEffect(puffEffect(this.deps.root, best.pos.clone(), 'rgba(255,255,255,0.95)', 1.6, 0.25));
    soundManager.playEnemyBoop();
    return 'wear';
  }

  // ------------------------------------------------------------------ events (party)
  onEvent(kind: string, i: number, v: number, target: string | undefined, from: string, replay: boolean) {
    if (kind === 'dmg') {
      this.applyBossDelta(-v, replay);
      return;
    }
    if (kind === 'heal') {
      this.applyBossDelta(v, replay);
      return;
    }
    if (replay) return;
    if (kind === 'grab') {
      if (target) this.deps.setRemoteGrabbed(target, v === 1);
      return;
    }
    if (kind === 'free') {
      if (target && target === this.deps.myId() && this.grab) this.releaseGrab('friend');
      return;
    }
    if (kind === 'down') {
      if (target && target !== this.deps.myId()) this.deps.setRemoteDown(target, v === 1);
      return;
    }
    if (kind === 'revive') {
      if (target && target === this.deps.myId()) {
        const who = this.deps.remotes().find((r) => r.userId === from);
        this.revive(who?.username || 'Un amigo');
      } else if (target) {
        this.deps.setRemoteDown(target, false);
      }
      return;
    }
    this.boss.onEvent(kind, i, v, from);
  }

  // ------------------------------------------------------------------ frame
  update(dt: number, time: number, input: PlayerInput) {
    this.time = time;
    this.elapsed += dt;
    const ph = this.physics;
    const p = ph.position;
    if (this.invuln > 0) this.invuln -= dt;
    this.batCooldown = Math.max(0, this.batCooldown - dt);
    this.stompCooldown = Math.max(0, this.stompCooldown - dt);

    // Targets offered this frame: the boss' plus grabbed friends to rescue
    this.targets.length = 0;
    this.boss.targets(this.targets);
    for (const r of this.deps.remotes()) {
      if (!r.grabbed) continue;
      this.targets.push({
        pos: r.pos.clone().add(new THREE.Vector3(0, 1, 0)),
        radius: 0.9,
        accepts: ['bate', 'piedra'],
        priority: 0.4,
        hit: () => {
          this.deps.send('free', 0, 0, r.userId);
          this.deps.setRemoteGrabbed(r.userId, false);
          this.deps.notify(`¡Rescataste a ${r.username}!`);
        },
      });
    }

    this.boss.update(dt, time);

    this.updateDown(dt);
    this.updateCpr(dt);

    // Stomps: falling on a head
    if (!this.grab && !this.isDown && ph.velocity.y < -1 && this.stompCooldown <= 0) {
      for (const t of this.targets) {
        if (!t.accepts.includes('stomp') || t.top === undefined) continue;
        const dxz = Math.hypot(p.x - t.pos.x, p.z - t.pos.z);
        if (dxz < t.radius + 0.35 && p.y > t.top - 0.7 && p.y < t.top + 0.5) {
          this.stompCooldown = 0.5;
          ph.velocity.y = 12.5;
          ph.isGrounded = false;
          soundManager.playMushroomBounce();
          t.hit('stomp', p.clone());
          break;
        }
      }
    }

    this.updateShots(dt);
    this.updateWaves(dt);
    this.updateFood(dt);
    this.updateReticles();
    this.updateBat(dt);
    this.updateGrab(input);

    // Effects
    for (let k = this.effects.length - 1; k >= 0; k--) {
      const e = this.effects[k];
      e.t += dt;
      const f = Math.min(1, e.t / e.dur);
      e.tick(f, dt);
      if (f >= 1) {
        this.deps.root.remove(e.obj);
        this.effects.splice(k, 1);
      }
    }

    // Blink while invulnerable
    const model = this.deps.playerModel();
    model.group.visible = this.invuln > 0 && !this.isDown ? Math.floor(this.invuln * 12) % 2 === 0 : true;
    if (this.isDown) this.layDown(true);
    this.updateTip(dt, time);

    // Darkness & torch
    this.darkness = THREE.MathUtils.damp(this.darkness, this.darknessTarget, 2.2, dt);
    if (this.torchLight && this.torchFlame) {
      const hasTorch = this.deps.items.has('antorcha');
      const yaw = model.group.rotation.y;
      this.torchFlame.visible = hasTorch;
      this.torchFlame.position.set(p.x + Math.cos(yaw) * 0.45, p.y + 1.25, p.z - Math.sin(yaw) * 0.45);
      this.torchLight.position.set(p.x, p.y + 2.2, p.z);
      this.torchLight.intensity = hasTorch ? 1.6 + this.darkness * 2.4 : 0;
    }

    if (this.defeatTimer > 0) {
      this.defeatTimer -= dt;
      if (this.defeatTimer <= 0) this.openPortal();
    }
  }

  private updateShots(dt: number) {
    const floor = this.setup.floorY;
    for (let k = this.shots.length - 1; k >= 0; k--) {
      const s = this.shots[k];
      s.life -= dt;
      s.vel.y -= s.g * dt;
      if (s.homing > 0 && s.target) {
        const desired = this._v.subVectors(s.target.pos, s.pos);
        const d = desired.length();
        if (d > 0.01) {
          desired.multiplyScalar(s.vel.length() / d);
          s.vel.lerp(desired, Math.min(1, dt * s.homing));
        }
      }
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      if (s.kind === 'red') {
        s.mesh.rotation.y += dt * 6;
        s.mesh.scale.setScalar(Math.min(1.6, 0.6 + (3.2 - s.life) * 2));
      } else {
        s.mesh.rotation.x += dt * 9;
        s.mesh.rotation.z += dt * 7;
      }
      // Hits
      let hit: AimTarget | null = null;
      for (const t of this.targets) {
        if (!t.accepts.includes(s.kind)) continue;
        if (s.pos.distanceTo(t.pos) < t.radius + s.radius) {
          hit = t;
          break;
        }
      }
      const inPlaza = Math.abs(s.pos.x) < this.setup.half && Math.abs(s.pos.z) < this.setup.half;
      const landed = s.pos.y < floor + 0.15 && inPlaza;
      if (!hit && !landed && s.life > 0 && s.pos.y > floor - 12) continue;
      if (hit) hit.hit(s.kind, s.pos.clone());
      this.finishShot(s, hit);
      this.deps.root.remove(s.mesh);
      this.shots.splice(k, 1);
    }
  }

  private finishShot(s: Shot, hit: AimTarget | null) {
    const at = s.pos.clone();
    if (s.kind === 'bomba') {
      this.addEffect(puffEffect(this.deps.root, at, 'rgba(255,138,76,1)', 5, 0.55));
      this.addEffect(puffEffect(this.deps.root, at, 'rgba(255,240,180,1)', 2.6, 0.3));
      soundManager.playSteamPuff();
      // Splash: small things nearby are hit too
      for (const t of this.targets) {
        if (t === hit || !t.accepts.includes('bomba') || (t.priority ?? 0) > 1) continue;
        if (t.radius < 1.2 && at.distanceTo(t.pos) < 2.4 + t.radius) t.hit('bomba', at);
      }
    } else if (s.kind === 'luz') {
      this.addEffect(puffEffect(this.deps.root, at, 'rgba(253,230,138,1)', hit ? 4 : 2, 0.45));
    } else if (s.kind === 'piedra') {
      this.addEffect(puffEffect(this.deps.root, at, 'rgba(214,211,209,0.9)', 0.9, 0.25));
    } else if (!hit) {
      this.addEffect(puffEffect(this.deps.root, at, 'rgba(103,232,249,0.8)', 1.4, 0.3));
    }
  }

  private updateWaves(dt: number) {
    const p = this.playerPos;
    for (let k = this.waves.length - 1; k >= 0; k--) {
      const w = this.waves[k];
      w.r += w.speed * dt;
      w.mesh.scale.set(w.r, 1, w.r);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - w.r / w.maxR);
      if (!w.hit) {
        const d = Math.hypot(p.x - w.center.x, p.z - w.center.z);
        const feet = p.y - w.center.y;
        if (Math.abs(d - w.r) < 0.55 && feet < w.height && feet > -1.2) {
          w.hit = true;
          this.damagePlayer(w.dmg, w.center, 9, 7, w.tag);
        }
      }
      if (w.r >= w.maxR) {
        this.deps.root.remove(w.mesh);
        this.waves.splice(k, 1);
      }
    }
  }

  private updateFood(dt: number) {
    const p = this.playerPos;
    for (const f of this.food) {
      if (!f.available) {
        f.timer -= dt;
        if (f.timer <= 0) {
          f.available = true;
          f.group.visible = true;
        }
        continue;
      }
      f.phase += dt;
      f.group.position.y = f.base.y + Math.sin(f.phase * 2.4) * 0.15;
      f.group.rotation.y += dt * 1.3;
      if (this.hp >= this.maxHp || this.grab || this.isDown) continue;
      const dxz = Math.hypot(p.x - f.base.x, p.z - f.base.z);
      const dy = f.base.y - p.y;
      if (dxz < 1.4 && dy > -0.6 && dy < 2.2) {
        const heal = FOOD_HEAL[f.kind];
        this.hp = Math.min(this.maxHp, this.hp + heal);
        f.available = false;
        f.timer = FOOD_RESPAWN;
        f.group.visible = false;
        soundManager.playCollectible();
        this.deps.notify(f.kind === 'burger' ? `¡Hamburguesa! +${heal} de vida` : `¡Papitas! +${heal} de vida`);
      }
    }
  }

  /** One marker per throwable you can use right now, on the target it would go to. */
  private updateReticles() {
    const items = this.deps.items;
    const can: Record<ShotKind, boolean> = {
      piedra: items.has('resortera') && items.has('piedra'),
      red: items.has('red'),
      bomba: items.has('bomba'),
      luz: items.has('luz'),
    };
    let n = 0;
    for (const k of ['luz', 'bomba', 'red', 'piedra'] as ShotKind[]) {
      const r = this.reticles[k]!;
      const t = can[k] && !this.defeated ? this.pickTarget(k) : null;
      r.visible = !!t;
      if (!t) continue;
      r.position.copy(t.pos);
      const s = Math.max(0.9, t.radius * 1.5) * (1 + n * 0.22) * (1 + Math.sin(this.time * 6) * 0.05);
      r.scale.set(s, s, 1);
      n++;
    }
  }

  private updateBat(dt: number) {
    const items = this.deps.items;
    const p = this.playerPos;
    const model = this.deps.playerModel();
    const yaw = model.group.rotation.y;
    const holding = items.has('bate');
    if (!holding && this.batT < 0) {
      this.bat.visible = false;
      return;
    }
    this.bat.visible = true;
    // Carried on the right side; swings around in front when used
    const side = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    if (this.batT >= 0) {
      this.batT += dt / 0.28;
      const k = Math.min(1, this.batT);
      const a = -1.2 + k * 2.6; // sweep from right to left
      const dir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(fwd, Math.sin(a) + 0.4).normalize();
      this.bat.position.set(p.x + dir.x * 0.4, p.y + 0.95, p.z + dir.z * 0.4);
      this.bat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().setY(0.15).normalize());
      if (this.batT >= 1) this.batT = -1;
    } else {
      this.bat.position.set(p.x + side.x * 0.42 - fwd.x * 0.05, p.y + 0.55, p.z + side.z * 0.42 - fwd.z * 0.05);
      this.bat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(fwd.x * 0.3, 1, fwd.z * 0.3).normalize());
    }
  }

  private updateGrab(input: PlayerInput) {
    const g = this.grab;
    const jump = !!input.jump;
    if (g) {
      const ph = this.physics;
      ph.position.set(g.holder.pos.x, g.holder.pos.y + 0.9, g.holder.pos.z);
      ph.velocity.set(0, 0, 0);
      ph.isMovementLocked = true;
      this.deps.playerModel().group.position.copy(ph.position);
      if (jump && !this.prevJump) {
        g.count++;
        soundManager.playJump();
        if (g.count >= g.need) this.releaseGrab('struggle');
      }
    }
    this.prevJump = jump;
  }

  /** Name of the one giving tips: your companion, or a little guide light without one. */
  get guideName(): string {
    const c = this.deps.playerModel().appearance.companion;
    return (c && COMPANION_POWERS[c]?.companionName) || 'Lucecita';
  }

  /** Key I: the companion flies around the boss and tells you how to beat it. */
  askTip() {
    if (this.tip && this.tip.t < this.tip.dur - 0.8) {
      this.tip.dur = this.tip.t + 0.8; // pressing again sends it back
      return;
    }
    this.tip = { t: 0, dur: 7 };
    soundManager.playTimeBonus();
  }

  /** What your companion can do in this fight (power button), or null without a companion. */
  companionAction(): CompanionAction | null {
    const c = this.deps.playerModel().appearance.companion;
    if (!c || c === 'ninguno' || this.defeated) return null;
    return this.boss.companionAction(c);
  }

  /** Power button in a boss fight: the companion's special move against this boss. */
  useCompanionAction(): boolean {
    const act = this.companionAction();
    if (!act) return false;
    if ((this.isDown || this.grab) && !act.anytime) {
      this.say(this.isDown ? 'Estás desmayado…' : '¡Primero suéltate!', 'act-busy', 2);
      return true;
    }
    if (this.actionCd > 0) {
      this.say(`${this.guideName} está descansando (${Math.ceil(this.actionCd)} s)`, 'act-cd', 2);
      return true;
    }
    this.actionCd = ACTION_COOLDOWN;
    this.tip = null;
    const color = COMPANION_POWERS[this.deps.playerModel().appearance.companion]?.color ?? '#fde68a';
    this.mission = { t: 0, target: act.target ?? (() => this.playerPos), run: act.run, done: false, color };
    soundManager.playTimeBonus();
    this.deps.notify(`${this.guideName}: ¡${act.name}!`);
    return true;
  }

  /** Moves the companion (or the guide light) to the boss for a tip, or to its target for an action. */
  private updateTip(dt: number, time: number) {
    if (!this.tipIntroShown && this.elapsed > 2.5) {
      this.tipIntroShown = true;
      this.deps.notify(`Pulsa I y ${this.guideName} te dirá cómo vencer a ${this.setup.short}`);
    }
    this.actionCd = Math.max(0, this.actionCd - dt);
    for (const k of Object.keys(this.immune)) {
      this.immune[k] -= dt;
      if (this.immune[k] <= 0) delete this.immune[k];
    }
    this.guardT = Math.max(0, this.guardT - dt);
    const model = this.deps.playerModel();
    const sprite = model.companionSprite;
    const useSprite = model.appearance.companion !== 'ninguno';
    model.group.updateMatrixWorld(true);
    model.group.localToWorld(this._home.set(0.42, 1.25, 0.15));
    let world: THREE.Vector3 | null = null;
    let grow = 0;

    const m = this.mission;
    if (m) {
      // Out in 0.6 s, does its thing, back in 0.7 s
      m.t += dt;
      const tgt = m.target();
      const out = Math.min(1, m.t / 0.6, Math.max(0, (1.6 - m.t) / 0.7));
      const k = out * out * (3 - 2 * out);
      this._orbit.set(tgt.x + Math.cos(time * 8) * 0.5, tgt.y + 1.4, tgt.z + Math.sin(time * 8) * 0.5);
      world = this._home.lerp(this._orbit, k);
      grow = k;
      if (!m.done && m.t >= 0.6) {
        m.done = true;
        this.addEffect(puffEffect(this.deps.root, this._orbit.clone(), m.color, 3.2, 0.5));
        m.run();
      }
      if (m.t >= 1.6) this.mission = null;
    } else if (this.tip) {
      const tip = this.tip;
      tip.t += dt;
      if (tip.t >= tip.dur) {
        this.tip = null;
      } else {
        // Out (0.7 s), orbiting, back (0.7 s)
        const out = Math.min(1, tip.t / 0.7, (tip.dur - tip.t) / 0.7);
        const k = out * out * (3 - 2 * out);
        const focus = this.focus ?? this.playerPos;
        const a = time * 2.6;
        const r = 2.4;
        this._orbit.set(focus.x + Math.cos(a) * r, focus.y + 0.8 + Math.sin(time * 3.3) * 0.5, focus.z + Math.sin(a) * r);
        world = this._home.lerp(this._orbit, k);
        grow = k;
      }
    }
    if (!world) {
      if (this.guide) this.guide.visible = false;
      return;
    }
    if (useSprite) {
      sprite.position.copy(model.group.worldToLocal(world.clone()));
      sprite.scale.setScalar(1 + grow * 0.6);
    } else {
      if (!this.guide) {
        const g = new THREE.Group();
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
        g.add(core);
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(125,211,252,0.95)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
        );
        glow.scale.setScalar(1.1);
        g.add(glow);
        for (const s of [1, -1]) {
          const wing = new THREE.Mesh(
            new THREE.CircleGeometry(0.16, 10),
            new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
          );
          wing.position.set(0.14 * s, 0.05, 0);
          wing.name = 'wing';
          g.add(wing);
        }
        this.deps.root.add(g);
        this.guide = g;
      }
      this.guide.visible = true;
      this.guide.position.copy(world);
      this.guide.children.forEach((c, i) => {
        if (c.name === 'wing') c.rotation.y = Math.sin(time * 30 + i) * 0.9;
      });
    }
  }

  /** Fainted: wait for CPR (or wake up at the entrance when nobody can come). */
  private updateDown(dt: number) {
    if (!this.isDown) return;
    this.downT -= dt;
    const ph = this.physics;
    ph.isMovementLocked = true;
    ph.velocity.x = 0;
    ph.velocity.z = 0;
    if (this.downT <= 0 || !this.rescuerAvailable()) this.wakeAtEntrance();
  }

  /** Standing next to a fainted friend gives them CPR. */
  private updateCpr(dt: number) {
    if (this.isDown || this.grab || this.defeated) {
      this.cpr = null;
      return;
    }
    const p = this.playerPos;
    let best: RemoteInfo | null = null;
    let bestD = CPR_RANGE;
    for (const r of this.deps.remotes()) {
      if (!r.down) continue;
      const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
      if (d < bestD && Math.abs(r.pos.y - p.y) < 1.6) {
        bestD = d;
        best = r;
      }
    }
    if (!best) {
      // Pushed away (a rock, a wave…): the progress fades slowly instead of starting over
      const c = this.cpr;
      if (c) {
        c.active = false;
        c.k -= dt * 0.35;
        const still = this.deps.remotes().some((r) => r.userId === c.userId && r.down);
        if (c.k <= 0 || !still) this.cpr = null;
      }
      return;
    }
    if (!this.cpr || this.cpr.userId !== best.userId) this.cpr = { userId: best.userId, username: best.username, k: 0, puff: 0, active: true };
    const c = this.cpr;
    c.active = true;
    c.k += dt / CPR_TIME;
    c.puff -= dt;
    const model = this.deps.playerModel();
    model.group.rotation.y = Math.atan2(best.pos.x - p.x, best.pos.z - p.z);
    if (c.puff <= 0) {
      c.puff = 0.5;
      soundManager.playJump();
      this.addEffect(puffEffect(this.deps.root, best.pos.clone().add(this._w.set(0, 0.6, 0)), 'rgba(244,114,182,0.9)', 1.2, 0.35));
    }
    if (c.k >= 1) {
      this.deps.send('revive', 0, 0, best.userId);
      this.deps.setRemoteDown(best.userId, false);
      soundManager.playCollectible();
      this.deps.notify(`¡Reviviste a ${best.username}!`);
      this.cpr = null;
    }
  }

  getStatus(): CombatStatus {
    const act = this.companionAction();
    const tipText = this.tip ? (this.defeated ? `¡Lo lograste! Ve al portal del centro` : this.boss.hint()) : null;
    let hint = this.defeated ? `¡Venciste a ${this.setup.short}!` : this.boss.hint();
    let urgent = !!this.grab;
    if (this.isDown) {
      hint = `¡Te desmayaste! Espera a que un amigo te haga RCP (${Math.ceil(this.downT)} s)`;
      urgent = true;
    } else if (this.cpr?.active) {
      hint = `Haciendo RCP a ${this.cpr.username}… ${Math.min(99, Math.round(this.cpr.k * 100))}% (no te muevas)`;
    } else if (!this.defeated) {
      const fallen = this.deps.remotes().find((r) => r.down);
      if (fallen) hint = `¡${fallen.username} se desmayó! Ve y quédate a su lado para hacerle RCP`;
    }
    return {
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      bossName: this.setup.name,
      bossShort: this.setup.short,
      bossHp: this.boss.hp,
      bossMax: this.boss.maxHp,
      hint,
      darkness: this.darkness,
      grabbed: this.grab ? { count: this.grab.count, need: this.grab.need } : null,
      defeated: this.defeated,
      portalOpen: this.portalOpen,
      hurtId: this.hurtId,
      down: this.isDown,
      urgent,
      tip: tipText ? { from: this.guideName, text: tipText } : null,
      action: act ? { name: act.name, desc: act.desc, cd: this.actionCd, cdMax: ACTION_COOLDOWN } : null,
      objective: this.boss.objective(),
    };
  }

  dispose() {
    if (this.guide) {
      this.deps.root.remove(this.guide);
      this.guide = null;
    }
    this.tip = null;
    this.deps.playerModel().companionSprite.scale.setScalar(1);
    if (this.grab) {
      this.grab = null;
      this.deps.unlockMovement();
    }
    if (this.isDown) {
      this.downT = -1;
      this.layDown(false);
      this.deps.unlockMovement();
      const me = this.deps.myId();
      if (me) this.deps.send('down', 0, 0, me);
    }
    this.boss.dispose();
    for (const s of this.shots) this.deps.root.remove(s.mesh);
    for (const w of this.waves) this.deps.root.remove(w.mesh);
    for (const e of this.effects) this.deps.root.remove(e.obj);
    for (const f of this.food) this.deps.root.remove(f.group);
    for (const r of Object.values(this.reticles)) if (r) this.deps.root.remove(r);
    this.deps.root.remove(this.bat);
    if (this.torchLight) this.deps.root.remove(this.torchLight);
    if (this.torchFlame) this.deps.root.remove(this.torchFlame);
    this.shots = [];
    this.waves = [];
    this.effects = [];
    this.deps.playerModel().group.visible = true;
  }
}
