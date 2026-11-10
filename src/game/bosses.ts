/**
 * The six bosses of "Lucha contra jefes" (one per world):
 *   bird     Plumarroca      — throws rocks from its towers, sends crows, flies off when someone gets close;
 *                              knock it down mid-flight with the slingshot, then hit it on the floor.
 *   glitch   ERR0R.exe       — spawns glitch copies of the player; their light orbs hurt it.
 *   ufo      Nave Nodriza    — lasers and aliens from the sky; slingshot its glass; net the cows it
 *                              abducts — if it takes every cow, you lose.
 *   skeleton Huesudo         — ducks and rises around the arena or out of the lake; dancing skeletons
 *                              carry players to its mouth (it chews and spits them); feed it bombs.
 *   gnome    Rey Gnomo       — mallet slams and shockwaves; he grabs nets to throw at you. Net him,
 *                              beat the gnomes that come to free him, then hit him.
 *   dracula  Conde Drácula   — darkness and swoops; light the 4 candelabra (a torch lights 2) to weaken
 *                              him. Stay too long in the dark and shadow hands grab you.
 * Each controller owns its models (added to the level root) and reports aim targets to the
 * combat system, which handles life, projectiles, the bat, stomps and party sync.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import type { AimTarget, CombatSystem, CompanionAction, HitKind } from './combat';
import type { CompanionStyle } from './character';
import type { BossSetup } from './bossArena';
import type { ItemType, ToolResult } from './items';
import { burstEffect, makeTelegraph, puffEffect, Telegraph } from './combatFx';
import { apiClient } from '../services/apiClient';
import {
  BirdModel,
  CandelabraModel,
  CrowModel,
  AlienModel,
  CowModel,
  createBirdBoss,
  createCandelabra,
  createCrow,
  createAlien,
  createCow,
  createDancer,
  createDracula,
  createGiantSkeleton,
  createGlitchMonster,
  createGnomeKing,
  createGnomeMinion,
  createShadowHands,
  createSkinwalker,
  SkinwalkerModel,
  createNahual,
  NahualModel,
  createUfo,
  DancerModel,
  DraculaModel,
  GiantSkeletonModel,
  GlitchMaterial,
  GlitchMonsterModel,
  GnomeKingModel,
  GnomeMinionModel,
  ShadowHandsModel,
  makeGlitchMaterial,
  UfoModel,
} from './bossModels';
import { createPlayerCharacter, PlayerCharacterModel } from './models';
import { createNameTagSprite } from './RemotePlayersManager';
import { createToolModel, makeNetWrap, makeStone } from './toolModels';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (k: number) => k * k * (3 - 2 * k);

function turnTo(current: number, target: number, rate: number, dt: number): number {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * Math.min(1, rate * dt);
}

function disposeGroup(root: THREE.Object3D, obj: THREE.Object3D) {
  root.remove(obj);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry?.dispose();
  });
}

/** Soft round glow (made once) for the floating obsidian skull */
let _skullGlow: THREE.CanvasTexture | null = null;
function skullGlowTex(): THREE.CanvasTexture {
  if (_skullGlow) return _skullGlow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(216,180,254,0.6)');
  gr.addColorStop(1, 'rgba(168,85,247,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  _skullGlow = new THREE.CanvasTexture(c);
  return _skullGlow;
}

export abstract class BossController {
  public hp: number;
  public maxHp: number;
  protected c: CombatSystem;
  protected s: BossSetup;
  protected root: THREE.Object3D;
  protected group = new THREE.Group();
  protected scaleBase = 1;
  protected pulse = 0;
  protected dead = false;
  protected deadT = 0;
  private pending: { tele: Telegraph; t: number; dur: number; fire: () => void }[] = [];

  constructor(c: CombatSystem, maxHp: number) {
    this.c = c;
    this.s = c.setup;
    this.root = c.deps.root;
    this.maxHp = Math.round(maxHp);
    this.hp = this.maxHp;
    this.root.add(this.group);
  }

  abstract update(dt: number, time: number): void;
  abstract targets(out: AimTarget[]): void;
  abstract hint(): string;

  onHurt(_amount: number) {
    this.pulse = 0.35;
    soundManager.playEnemyBoop();
    const p = this.group.position.clone();
    p.y += 1.5;
    this.c.addEffect(puffEffect(this.root, p, 'rgba(255,255,255,0.95)', 3, 0.3));
  }

  onDefeat(_instant: boolean) {
    this.dead = true;
    this.deadT = 0;
  }

  onEvent(_kind: string, _i: number, _v: number, _from: string, _target?: string) {}

  /** Party sync: what the host sends a few times a second (marker -7777 first), or null. */
  syncPayload(): number[] | null {
    return null;
  }

  /** Party sync: the host's snapshot of this boss. */
  applySync(_from: string, _d: number[]) {}

  /** The special move each companion has against this boss (see the table in each boss). */
  companionAction(_c: CompanionStyle): CompanionAction | null {
    return null;
  }

  /** Hombre Polilla stopped time for this boss (it stays frozen while combat skips its update). */
  onTimeStop() {}

  /** Boss-specific tools (the Skinwalker's obsidian skull and dagger) */
  useItem(type: ItemType): ToolResult {
    this.c.say(type === 'craneo' || type === 'daga' ? 'Esto solo sirve contra el Skinwalker' : 'Aquí no sirve', 'use-' + type, 2);
    return 'none';
  }

  /** Extra goal shown under the boss bar (e.g. cows left) */
  objective(): { label: string; have: number; total: number } | null {
    return null;
  }

  /** Helpers to call: base amount + `perFriend` for every extra player in the party. */
  protected scaled(base: number, perFriend = 1): number {
    return Math.round(base + perFriend * (this.c.partySize - 1));
  }

  /** Puts items in your backpack (or at your feet when it is full). */
  protected gift(type: ItemType, amount = 1) {
    if (this.c.deps.items.grant(type, amount)) {
      soundManager.playCollectible();
      return;
    }
    const p = this.c.playerPos;
    this.c.deps.items.spawnDrop(type, V(p.x + 0.6, p.y + 0.95, p.z));
  }

  /** Quetsy (guardian) eats boss helpers that come close to you. */
  protected guarding(pos: THREE.Vector3): boolean {
    return this.c.guardT > 0 && pos.distanceTo(this.c.playerPos) < 2.6;
  }

  /** What spectators copy from the player they watch (the boss body; minions stay local) */
  syncObjects(): THREE.Object3D[] {
    return [this.group];
  }

  /** Point the camera keeps in view */
  focusPoint(): THREE.Vector3 {
    return this.group.position;
  }

  dispose() {
    for (const p of this.pending) this.root.remove(p.tele.group);
    this.pending = [];
    disposeGroup(this.root, this.group);
  }

  protected applyPulse(dt: number) {
    this.pulse = Math.max(0, this.pulse - dt);
    const k = this.pulse > 0 ? 1 + Math.sin(this.pulse * 40) * 0.08 : 1;
    this.group.scale.setScalar(this.scaleBase * k);
  }

  /** Red circle on the ground; `fire` runs when it fills up. */
  protected warn(pos: THREE.Vector3, radius: number, dur: number, fire: () => void, color = 0xef4444) {
    const tele = makeTelegraph(radius, color);
    tele.group.position.set(pos.x, pos.y + 0.05, pos.z);
    this.root.add(tele.group);
    this.pending.push({ tele, t: 0, dur, fire });
  }

  protected updatePending(dt: number) {
    for (let k = this.pending.length - 1; k >= 0; k--) {
      const p = this.pending[k];
      p.t += dt;
      p.tele.set(p.t / p.dur);
      if (p.t >= p.dur) {
        this.root.remove(p.tele.group);
        this.pending.splice(k, 1);
        if (!this.dead) p.fire();
      }
    }
  }

  protected clearPending() {
    for (const p of this.pending) this.root.remove(p.tele.group);
    this.pending = [];
  }

  /** Where the player will be in `lead` seconds, on the ground they stand on. */
  protected groundAt(lead: number): THREE.Vector3 {
    const ph = this.c.physics;
    const p = ph.position;
    const y = ph.isGrounded ? p.y : Math.min(p.y, ph.lastSafePos.y);
    const h = this.s.half - 1;
    return V(
      THREE.MathUtils.clamp(p.x + ph.velocity.x * lead, -h, h),
      y,
      THREE.MathUtils.clamp(p.z + ph.velocity.z * lead, -h, h)
    );
  }

  protected has(type: ItemType): boolean {
    return this.c.deps.items.has(type);
  }
}

// ===========================================================================
// 1. PLUMARROCA
// ===========================================================================
interface Crow {
  m: CrowModel;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  state: 'circle' | 'dive' | 'fall';
  t: number;
  angle: number;
  center: THREE.Vector3;
}

class BirdBoss extends BossController {
  private m: BirdModel;
  /** Crows that peck the players (more for bigger parties) */
  private crows: Crow[] = [];
  private crowT = 4;
  /** Nubi's rain cloud: no rocks while it lasts */
  private noRockT = 0;
  private cloud: THREE.Group | null = null;
  private perch = 0;
  /**
   * perched  — throws rocks; flies away as soon as someone gets close (or a stone startles it)
   * flying   — between towers: a slingshot stone knocks it down
   * falling  — tumbling to the floor
   * grounded — dizzy on the floor: hit it with the bat or stomp it; then it flies away again
   */
  private state: 'perched' | 'flying' | 'falling' | 'grounded' = 'perched';
  private from = V();
  private to = V();
  private flyT = 0;
  private flyDur = 3;
  private throwT = 3;
  private relocateT = 12;
  private groundT = 0;
  private waitHost = 0;
  private hitCd = 0;
  private yaw = 0;
  private rocks: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number }[] = [];
  private center = V();
  private stars = new THREE.Group();

  constructor(c: CombatSystem) {
    super(c, c.setup.diff >= 0.5 ? 4 : 3);
    this.m = createBirdBoss();
    this.group.add(this.m.group);
    this.scaleBase = 0.9;
    this.group.position.copy(this.s.perches[0]);
    // Dizzy stars shown while it lies on the floor
    const starM = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    for (let k = 0; k < 5; k++) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), starM);
      const a = (k / 5) * Math.PI * 2;
      st.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
      this.stars.add(st);
    }
    this.stars.position.y = 3.2;
    this.stars.visible = false;
    this.group.add(this.stars);
    this.relocateT = 11 - 3 * this.s.diff;
  }

  private near(pos: THREE.Vector3, r: number): boolean {
    return this.c.playerPos.distanceTo(pos) < r;
  }

  /** Someone climbs towards the nest: it feels them and leaves. */
  private sensesLocal(): boolean {
    const top = this.s.perches[this.perch];
    return this.near(top, 7.5);
  }

  private otherPerch(avoid: number): number {
    const n = this.s.perches.length;
    const p = this.c.playerPos;
    // Prefer the tower farthest from the local player
    let best = (avoid + 1) % n;
    let bestD = -1;
    for (let k = 0; k < n; k++) {
      if (k === avoid) continue;
      const d = p.distanceTo(this.s.perches[k]) + Math.random() * 6;
      if (d > bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }

  private flyTo(perch: number, send: boolean) {
    if (this.dead) return;
    this.state = 'flying';
    this.flyT = 0;
    this.from.copy(this.group.position);
    this.to.copy(this.s.perches[perch]);
    this.flyDur = 3.0 + (1 - this.s.diff) * 0.6;
    this.perch = perch;
    this.stars.visible = false;
    this.m.group.rotation.set(0, 0, 0);
    if (send) this.c.deps.send('fly', perch, 0);
    if (this.has('resortera')) this.c.say('¡Plumarroca vuela! Dispárale con la resortera', 'bird-fly', 6);
  }

  private knockDown(send: boolean) {
    if (this.dead || this.state !== 'flying') return;
    this.state = 'falling';
    this.flyT = 0;
    this.from.copy(this.group.position);
    // Land on the floor below it, away from the towers and inside the arena
    const h = this.s.half - 2.5;
    const land = V(THREE.MathUtils.clamp(this.from.x, -h, h), this.s.floorY, THREE.MathUtils.clamp(this.from.z, -h, h));
    for (const t of this.s.perches) {
      const dx = land.x - t.x;
      const dz = land.z - t.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) {
        const k = d > 0.01 ? 6 / d : 0;
        land.x = d > 0.01 ? t.x + dx * k : t.x + 6;
        land.z = d > 0.01 ? t.z + dz * k : t.z;
      }
    }
    this.to.copy(land);
    soundManager.playEnemyBonk();
    if (send) this.c.deps.send('fall', this.perch, 0);
    this.c.say('¡La derribaste! Corre y golpéala en el suelo', 'bird-down', 2);
  }

  onEvent(kind: string, i: number) {
    if (kind === 'fly') {
      if (this.state === 'flying' && this.perch === i) return;
      if (i >= 0 && i < this.s.perches.length) this.flyTo(i, false);
    } else if (kind === 'fall') {
      this.knockDown(false);
    }
  }

  onHurt(amount: number) {
    super.onHurt(amount);
    // Back to the towers after each hit (everybody computes the same tower from the life left)
    if (this.hp > 0 && (this.state === 'grounded' || this.state === 'falling')) {
      this.state = 'grounded';
      this.groundT = Math.min(this.groundT, 0.6);
    }
  }

  update(dt: number, time: number) {
    this.applyPulse(dt);
    this.updatePending(dt);
    this.updateRocks(dt);
    this.updateCrows(dt, time);
    this.updateCloud(dt, time);
    this.hitCd -= dt;
    const pos = this.group.position;
    this.center.copy(pos).add(V(0, 1.5, 0));
    const p = this.c.playerPos;

    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.6);
      pos.lerpVectors(this.from, this.to, ease(k));
      pos.y += Math.sin(Math.PI * k) * 3;
      this.m.group.rotation.z = k * 2.6;
      if (this.deadT > 2.4 && this.group.visible) {
        this.group.visible = false;
        this.c.addEffect(burstEffect(this.root, pos.clone().add(V(0, 1, 0)), new THREE.MeshStandardMaterial({ color: 0x7c7f8a }), 14, 0.35, 7, 1.1));
      }
      return;
    }

    // Wings
    const flap =
      this.state === 'flying' ? Math.sin(time * 14) * 0.7 : this.state === 'grounded' ? -0.9 + Math.sin(time * 3) * 0.1 : this.state === 'falling' ? Math.sin(time * 30) * 0.9 : Math.sin(time * 2) * 0.12;
    this.m.wings[0].rotation.z = flap;
    this.m.wings[1].rotation.z = -flap;
    this.m.head.rotation.x = this.state === 'grounded' ? Math.sin(time * 6) * 0.35 : 0;

    if (this.state === 'flying') {
      this.flyT += dt / this.flyDur;
      const k = Math.min(1, this.flyT);
      pos.lerpVectors(this.from, this.to, ease(k));
      pos.y += Math.sin(Math.PI * k) * 7;
      this.yaw = turnTo(this.yaw, Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z), 5, dt);
      this.group.rotation.y = this.yaw;
      if (k >= 1) {
        this.state = 'perched';
        this.throwT = 1.6;
        this.relocateT = 11 - 3 * this.s.diff + Math.random() * 3;
      }
      return;
    }

    if (this.state === 'falling') {
      this.flyT += dt / 0.9;
      const k = Math.min(1, this.flyT);
      pos.lerpVectors(this.from, this.to, k * k);
      this.m.group.rotation.z = Math.sin(k * Math.PI) * 1.2;
      if (k >= 1) {
        this.state = 'grounded';
        this.groundT = 6.5 - 1.5 * this.s.diff;
        this.waitHost = 0;
        this.m.group.rotation.set(0, 0, 0.5);
        this.stars.visible = true;
        soundManager.playWoodRattle();
        this.c.addEffect(puffEffect(this.root, pos.clone().add(V(0, 0.5, 0)), 'rgba(214,200,180,0.9)', 4, 0.5));
        this.c.strike(pos, 2.4, 10, 9, 6);
      }
      return;
    }

    if (this.state === 'grounded') {
      this.stars.rotation.y += dt * 3;
      this.groundT -= dt;
      if (this.groundT <= 0) {
        // Everybody wakes it towards the same tower; the host announces it in case clocks drift
        const next = (this.perch + 1 + (this.maxHp - this.hp)) % this.s.perches.length;
        this.waitHost += dt;
        if (this.c.deps.isHost() || this.waitHost > 2) this.flyTo(next === this.perch ? (next + 1) % this.s.perches.length : next, this.c.deps.isHost());
      }
      return;
    }

    // Perched
    this.yaw = turnTo(this.yaw, Math.atan2(p.x - pos.x, p.z - pos.z), 4, dt);
    this.group.rotation.y = this.yaw;
    if (this.sensesLocal()) {
      this.c.say('¡Plumarroca te sintió y se fue volando!', 'bird-sense', 4);
      this.flyTo(this.otherPerch(this.perch), true);
      return;
    }
    if (this.c.deps.isHost()) {
      this.relocateT -= dt;
      if (this.relocateT <= 0) {
        this.flyTo(this.otherPerch(this.perch), true);
        return;
      }
    }
    this.throwT -= dt;
    if (this.throwT <= 0 && this.noRockT <= 0) {
      this.throwRock(0);
      if (this.s.diff > 0.55) this.throwRock(2.6);
      this.throwT = 2.6 - 1.0 * this.s.diff;
    }
    // Calls crows from its nest
    this.crowT -= dt;
    if (this.crowT <= 0) {
      this.crowT = 6.5 - 2 * this.s.diff;
      if (this.crows.filter((c) => c.state !== 'fall').length < this.scaled(1 + Math.round(this.s.diff * 2), 2)) this.spawnCrow();
    }
  }

  private spawnCrow() {
    const m = createCrow();
    const at = this.group.position.clone().add(V(0, 1.8, 0));
    m.group.position.copy(at);
    this.root.add(m.group);
    this.crows.push({ m, pos: at, vel: V(), state: 'circle', t: -Math.random(), angle: Math.random() * Math.PI * 2, center: at.clone() });
    soundManager.playWindGust();
  }

  private dropCrow(cr: Crow) {
    if (cr.state === 'fall') return;
    cr.state = 'fall';
    cr.t = 0;
    this.c.addEffect(burstEffect(this.root, cr.pos.clone(), new THREE.MeshStandardMaterial({ color: 0x111827 }), 7, 0.08, 4, 0.6));
    soundManager.playEnemyBoop();
  }

  private updateCrows(dt: number, time: number) {
    const p = this.c.playerPos;
    for (let k = this.crows.length - 1; k >= 0; k--) {
      const cr = this.crows[k];
      cr.t += dt;
      const g = cr.m.group;
      if (cr.state === 'fall') {
        cr.pos.y -= dt * 6;
        g.rotation.z += dt * 8;
        if (cr.t > 0.8 || cr.pos.y < this.s.floorY) {
          disposeGroup(this.root, g);
          this.crows.splice(k, 1);
        }
        g.position.copy(cr.pos);
        continue;
      }
      if (this.dead) {
        this.dropCrow(cr);
        continue;
      }
      if (this.guarding(cr.pos)) {
        this.dropCrow(cr);
        this.c.say('¡Quetsy se comió un cuervo!', 'jade-crow', 2);
        continue;
      }
      const target = V();
      if (cr.state === 'circle') {
        // Circles over your head, then dives
        cr.angle += dt * 2.2;
        target.set(p.x + Math.cos(cr.angle) * 2.8, p.y + 2.6 + Math.sin(time * 3 + k) * 0.3, p.z + Math.sin(cr.angle) * 2.8);
        cr.pos.lerp(target, Math.min(1, dt * 2.5));
        if (cr.t > 2.2 - this.s.diff * 0.8) {
          cr.state = 'dive';
          cr.t = 0;
          cr.vel.copy(V(p.x, p.y + 1.1, p.z).sub(cr.pos).normalize().multiplyScalar(9 + 3 * this.s.diff));
        }
      } else {
        cr.pos.addScaledVector(cr.vel, dt);
        if (cr.pos.distanceTo(V(p.x, p.y + 1.1, p.z)) < 0.8) {
          this.c.damagePlayer(6, cr.pos, 5, 3, 'crow');
          cr.state = 'circle';
          cr.t = -0.5;
        } else if (cr.t > 1.0) {
          cr.state = 'circle';
          cr.t = 0;
        }
      }
      g.position.copy(cr.pos);
      const dir = cr.state === 'dive' ? cr.vel : target.clone().sub(cr.pos);
      g.rotation.y = Math.atan2(dir.x, dir.z);
      g.rotation.x = cr.state === 'dive' ? 0.6 : 0;
      const flap = Math.sin(time * 22 + k) * 0.8;
      cr.m.wings[0].rotation.z = flap;
      cr.m.wings[1].rotation.z = -flap;
      cr.center.copy(cr.pos);
    }
  }

  private updateCloud(dt: number, time: number) {
    if (this.noRockT <= 0) {
      if (this.cloud) {
        disposeGroup(this.root, this.cloud);
        this.cloud = null;
      }
      return;
    }
    this.noRockT -= dt;
    if (!this.cloud) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 1, transparent: true, opacity: 0.92 });
      for (const [x, y, r] of [[0, 0, 1.2], [1.1, -0.1, 0.9], [-1.1, -0.1, 0.9], [0.5, 0.4, 0.8], [-0.5, 0.35, 0.8]]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
        b.position.set(x, y, 0);
        g.add(b);
      }
      this.root.add(g);
      this.cloud = g;
    }
    this.cloud.position.copy(this.group.position).add(V(0, 4.2 + Math.sin(time * 2) * 0.2, 0));
    if (Math.random() < dt * 14) {
      const at = this.cloud.position.clone().add(V((Math.random() - 0.5) * 2.4, -1, (Math.random() - 0.5) * 1.2));
      this.c.addEffect(puffEffect(this.root, at, 'rgba(125,211,252,0.9)', 0.4, 0.4));
    }
  }

  companionAction(c: CompanionStyle): CompanionAction | null {
    const bird = () => this.group.position;
    const me = () => this.c.playerPos;
    switch (c) {
      case 'nube':
        return {
          name: 'Nubarrón',
          desc: 'Una nube de lluvia moja a Plumarroca: no lanza piedras por 9 s',
          target: bird,
          run: () => {
            this.noRockT = 9;
            this.c.say('¡Plumarroca está empapada y no puede lanzar piedras!', 'act-cloud', 1);
          },
        };
      case 'estrella':
        return {
          name: 'Estrella fugaz',
          desc: 'Derriba a Plumarroca si vuela; si está posada, la espanta',
          target: bird,
          run: () => {
            if (this.state === 'flying') this.knockDown(true);
            else if (this.state === 'perched') this.flyTo(this.otherPerch(this.perch), true);
          },
        };
      case 'luciernaga':
        return {
          name: 'Destello',
          desc: 'Un destello deslumbra a todos los cuervos y los tumba',
          target: me,
          run: () => {
            for (const cr of this.crows) this.dropCrow(cr);
          },
        };
      case 'catarina':
        return {
          name: 'Caparazón',
          desc: 'Las piedras de Plumarroca no te hacen daño por 10 s',
          target: me,
          run: () => this.c.immunity('rock', 10),
        };
      case 'hada':
        return {
          name: 'Polvo de hada',
          desc: 'Te da 6 piedras (y una resortera si no tienes)',
          target: me,
          run: () => {
            if (!this.has('resortera')) this.gift('resortera');
            this.gift('piedra', 6);
          },
        };
      case 'serpiente':
        return {
          name: 'Guardiana',
          desc: 'Quetsy se come a los cuervos que se te acerquen por 12 s',
          target: me,
          run: () => {
            this.c.guardT = 12;
          },
        };
      default:
        return null;
    }
  }

  private throwRock(offset: number) {
    const target = this.groundAt(0.7);
    if (offset) {
      const a = Math.random() * Math.PI * 2;
      target.x += Math.cos(a) * offset;
      target.z += Math.sin(a) * offset;
    }
    const from = this.m.talons.getWorldPosition(V());
    const dur = 1.5 - 0.35 * this.s.diff;
    const mesh = makeStone(0.45, 0x8b8378);
    mesh.position.copy(from);
    this.root.add(mesh);
    this.rocks.push({ mesh, from, to: target.clone(), t: 0, dur });
    this.warn(target, 1.8, dur, () => {});
  }

  private updateRocks(dt: number) {
    for (let k = this.rocks.length - 1; k >= 0; k--) {
      const r = this.rocks[k];
      r.t += dt / r.dur;
      const f = Math.min(1, r.t);
      r.mesh.position.lerpVectors(r.from, r.to, f);
      r.mesh.position.y += Math.sin(Math.PI * f) * 4;
      r.mesh.rotation.x += dt * 5;
      r.mesh.rotation.y += dt * 3;
      if (f >= 1) {
        this.root.remove(r.mesh);
        this.rocks.splice(k, 1);
        this.c.strike(r.to, 1.9, 15, 9, 6, 'rock');
        soundManager.playWoodRattle();
        this.c.addEffect(burstEffect(this.root, r.to.clone().add(V(0, 0.3, 0)), r.mesh.material as THREE.Material, 7, 0.22, 4, 0.7));
        this.c.addEffect(puffEffect(this.root, r.to.clone().add(V(0, 0.4, 0)), 'rgba(214,200,180,0.85)', 2.5, 0.4));
      }
    }
  }

  targets(out: AimTarget[]) {
    for (const cr of this.crows) {
      if (cr.state === 'fall') continue;
      out.push({ pos: cr.center, radius: 0.55, accepts: ['bate', 'piedra', 'stomp'], priority: 0.9, hit: () => this.dropCrow(cr) });
    }
    if (this.dead || this.state === 'falling') return;
    if (this.state === 'grounded') {
      out.push({
        pos: this.center,
        radius: 1.6,
        accepts: ['bate', 'stomp', 'piedra'],
        top: this.group.position.y + 2.6,
        priority: 0.5,
        hit: (kind) => this.hit(kind),
      });
      return;
    }
    // Perched or flying: only stones reach it
    out.push({
      pos: this.center,
      radius: this.state === 'flying' ? 1.9 : 1.5,
      accepts: ['piedra'],
      priority: this.state === 'flying' ? 0.6 : 0,
      hit: (kind) => this.hit(kind),
    });
  }

  private hit(kind: HitKind) {
    if (this.dead) return;
    if (this.state === 'flying') {
      if (kind === 'piedra') this.knockDown(true);
      return;
    }
    if (this.state === 'perched') {
      if (kind === 'piedra') {
        this.c.say('¡La espantaste! Ahora dale en el aire', 'bird-scare', 3);
        this.flyTo(this.otherPerch(this.perch), true);
      }
      return;
    }
    if (this.state !== 'grounded') return;
    if (kind === 'piedra') {
      this.c.say('¡Está en el suelo! Golpéala con el bate o cáele encima', 'bird-bat', 3);
      return;
    }
    if (this.hitCd > 0) return;
    this.hitCd = 1.0;
    this.c.damageBoss(1);
    if (!this.dead && this.hp > 0) this.c.say('¡Golpe! Plumarroca se despierta y vuelve a las torres', 'bird-hit', 2);
  }

  hint(): string {
    const sling = this.has('resortera');
    const stones = this.has('piedra');
    if (this.state === 'grounded' || this.state === 'falling')
      return this.has('bate') ? '¡Cayó! Golpéala con el bate (V) o cáele encima' : '¡Cayó! Cáele encima de un salto (o trae un bate)';
    if (this.state === 'flying') return sling && stones ? '¡Está volando! Dispárale con la resortera para derribarla' : '¡Está volando! Con la resortera y piedras puedes derribarla';
    if (!sling) return 'Busca la resortera: Plumarroca huye si te acercas, hay que derribarla en el aire';
    if (!stones) return 'Junta piedras para la resortera y esquiva las rocas que lanza';
    return 'Esquiva las rocas. Dispárale para espantarla y dale otra vez cuando esté volando';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    this.stars.visible = false;
    this.from.copy(this.group.position);
    const top = this.s.perches[this.perch];
    this.to.set(top.x * 0.6, this.s.floorY, top.z * 0.6);
    if (instant) this.group.visible = false;
  }

  dispose() {
    for (const r of this.rocks) this.root.remove(r.mesh);
    for (const cr of this.crows) disposeGroup(this.root, cr.m.group);
    this.crows = [];
    if (this.cloud) disposeGroup(this.root, this.cloud);
    super.dispose();
  }
}

// ===========================================================================
// 2. ERR0R.exe
// ===========================================================================
interface Clone {
  model: PlayerCharacterModel;
  pos: THREE.Vector3;
  from: THREE.Vector3;
  state: 'drop' | 'chase' | 'recoil';
  t: number;
  yaw: number;
  center: THREE.Vector3;
}

class GlitchBoss extends BossController {
  private m: GlitchMonsterModel;
  private glitch: GlitchMaterial;
  private anchors: THREE.Vector3[];
  private clones: Clone[] = [];
  private spawnT = 2.5;
  private waveT = 6;
  private waveWarn = -1;
  private hitCd = 0;
  private yaw = 0;
  private corePos = V();

  constructor(c: CombatSystem) {
    super(c, 5 + (c.setup.diff > 0.5 ? 1 : 0));
    this.glitch = makeGlitchMaterial();
    this.m = createGlitchMonster(this.glitch);
    this.group.add(this.m.group);
    const h = this.s.home;
    this.anchors = [h.clone(), V(h.x + 8, h.y, h.z + 3), V(h.x - 8, h.y, h.z + 3), V(h.x, h.y + 1, h.z - 7)];
    this.group.position.copy(h);
  }

  /** Chispa's flash: no copies and no "pantallazo" while it lasts */
  private stunT = 0;

  private maxClones() {
    return this.scaled(2 + Math.round(this.s.diff * 2), 1);
  }

  private floorAt(x: number, z: number) {
    const h = this.s.home;
    return Math.abs(x - h.x) < 3.5 && Math.abs(z - h.z) < 3.5 ? this.s.floorY + 1.0 : this.s.floorY;
  }

  update(dt: number, time: number) {
    this.glitch.update(time);
    this.applyPulse(dt);
    this.updatePending(dt);
    this.hitCd -= dt;
    const pos = this.group.position;
    const p = this.c.playerPos;

    // Orbiting junk around the core
    this.m.cubes.forEach((cube, i) => {
      const a = time * (0.8 + (i % 3) * 0.3) + i;
      const r = 2.4 + (i % 4) * 0.35;
      cube.position.set(Math.cos(a) * r, Math.sin(a * 1.3 + i) * 1.2, Math.sin(a) * r);
      cube.rotation.set(a, a * 1.5, 0);
    });
    this.m.windows.forEach((w, i) => {
      const a = -time * 0.5 + (i / 3) * Math.PI * 2;
      w.position.set(Math.cos(a) * 3.6, 1.6 + Math.sin(time + i) * 0.4, Math.sin(a) * 3.6);
      w.lookAt(this.c.playerPos.x, pos.y + 1.6, this.c.playerPos.z);
      w.visible = Math.random() > 0.03;
    });

    if (this.dead) {
      this.deadT += dt;
      this.m.group.rotation.y += dt * 12;
      this.m.group.scale.setScalar(Math.max(0.01, 1 - this.deadT / 2.2));
      if (this.deadT > 2.2 && this.group.visible) {
        this.group.visible = false;
        this.c.addEffect(burstEffect(this.root, pos.clone(), this.glitch.material, 22, 0.4, 9, 1.2));
      }
      return;
    }

    // Glitch-teleport to the anchor that matches its health (same for the whole party)
    const anchor = this.anchors[(this.maxHp - this.hp) % this.anchors.length];
    if (pos.distanceTo(anchor) > 0.3) {
      this.c.addEffect(puffEffect(this.root, pos.clone(), 'rgba(255,0,230,0.9)', 5, 0.35));
      pos.copy(anchor);
      this.c.addEffect(puffEffect(this.root, pos.clone(), 'rgba(0,240,255,0.9)', 5, 0.35));
    }
    const jitter = this.waveWarn >= 0 ? 0.25 : 0.04;
    this.m.group.position.set((Math.random() - 0.5) * jitter, Math.sin(time * 1.5) * 0.4 + (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter);
    this.yaw = turnTo(this.yaw, Math.atan2(p.x - pos.x, p.z - pos.z), 3, dt);
    this.group.rotation.y = this.yaw;
    this.corePos.copy(pos).add(this.m.group.position);

    // Copies of the player
    this.stunT = Math.max(0, this.stunT - dt);
    this.spawnT -= dt;
    if (this.stunT > 0) {
      this.waveWarn = -1;
      this.waveT = Math.max(this.waveT, 1);
      this.m.eye.scale.setScalar(0.6);
    }
    if (this.spawnT <= 0 && this.clones.length < this.maxClones() && this.stunT <= 0) {
      this.spawnClone();
      this.spawnT = 4.6 - 1.6 * this.s.diff;
    }
    // "Pantallazo": a ring over the floor
    if (this.waveWarn >= 0) {
      this.waveWarn -= dt;
      this.m.eye.scale.setScalar(1.3);
      if (this.waveWarn < 0) {
        this.m.eye.scale.setScalar(1);
        soundManager.playStalkerWarning();
        this.c.shockwave(V(pos.x, this.s.floorY, pos.z), 34, 9 + 3 * this.s.diff, 14, 0xff00e6, 0.9, 'wave');
        this.waveT = 6.5 - 2 * this.s.diff;
      }
    } else if (this.stunT <= 0) {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveWarn = 1.0;
        this.c.say('¡Pantallazo! Salta la onda', 'glitch-wave', 8);
      }
    }
    this.updateClones(dt, time);
  }

  private spawnClone() {
    const model = createPlayerCharacter(this.c.deps.textures, this.c.deps.appearance());
    model.companionSprite.visible = false;
    model.shadow.visible = false;
    model.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m !== model.shadow) m.material = this.glitch.material;
    });
    const a = Math.random() * Math.PI * 2;
    const pos = this.group.position;
    const spot = V(pos.x + Math.cos(a) * 4.5, 0, pos.z + Math.sin(a) * 4.5);
    spot.y = this.floorAt(spot.x, spot.z);
    model.group.position.copy(pos);
    this.root.add(model.group);
    this.clones.push({ model, pos: spot, from: pos.clone(), state: 'drop', t: 0, yaw: 0, center: spot.clone() });
    soundManager.playEnemyBoop();
  }

  private updateClones(dt: number, time: number) {
    const p = this.c.playerPos;
    const speed = 3.6 + 1.6 * this.s.diff;
    for (const cl of this.clones) {
      cl.t += dt;
      let moving = 0;
      if (cl.state === 'drop') {
        const k = Math.min(1, cl.t / 0.7);
        cl.model.group.position.lerpVectors(cl.from, cl.pos, ease(k));
        if (k >= 1) {
          cl.state = 'chase';
          cl.t = 0;
        }
      } else {
        const dx = p.x - cl.pos.x;
        const dz = p.z - cl.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        if (cl.state === 'recoil') {
          cl.pos.x -= (dx / d) * 2.5 * dt;
          cl.pos.z -= (dz / d) * 2.5 * dt;
          if (cl.t > 0.9) {
            cl.state = 'chase';
            cl.t = 0;
          }
        } else if (d > 0.6) {
          cl.pos.x += (dx / d) * speed * dt;
          cl.pos.z += (dz / d) * speed * dt;
          moving = speed;
        }
        const h = this.s.half - 1;
        cl.pos.x = THREE.MathUtils.clamp(cl.pos.x, -h, h);
        cl.pos.z = THREE.MathUtils.clamp(cl.pos.z, -h, h);
        cl.pos.y = this.floorAt(cl.pos.x, cl.pos.z);
        cl.yaw = turnTo(cl.yaw, Math.atan2(dx, dz), 8, dt);
        cl.model.group.position.copy(cl.pos);
        cl.model.group.position.x += (Math.random() - 0.5) * 0.06;
        cl.model.group.rotation.y = cl.yaw;
        if (cl.state === 'chase' && d < 0.9 && Math.abs(p.y - cl.pos.y) < 1.5) {
          if (this.c.damagePlayer(12, cl.pos, 11, 6, 'clone')) {
            cl.state = 'recoil';
            cl.t = 0;
          }
        }
      }
      cl.center.copy(cl.model.group.position).add(V(0, 0.8, 0));
      cl.model.updateAnimation(moving, true, dt, time);
    }
    for (const cl of [...this.clones]) {
      if (cl.state !== 'drop' && this.guarding(cl.pos)) {
        this.killClone(cl, true);
        this.c.say('¡Quetsy se comió una copia! Recoge su orbe', 'jade-clone', 2);
      }
    }
  }

  companionAction(c: CompanionStyle): CompanionAction | null {
    const core = () => this.corePos;
    const me = () => this.c.playerPos;
    switch (c) {
      case 'nube':
        return {
          name: 'Lluvia eléctrica',
          desc: 'La lluvia hace cortocircuito: todas las copias desaparecen',
          target: core,
          run: () => {
            for (const cl of [...this.clones]) this.killClone(cl, false);
          },
        };
      case 'estrella':
        return {
          name: 'Luz estelar',
          desc: 'Te da 2 orbes de luz para lanzarle',
          target: me,
          run: () => this.gift('luz', 2),
        };
      case 'luciernaga':
        return {
          name: 'Destello cegador',
          desc: 'ERR0R.exe queda cegado 8 s: no hace copias ni pantallazos',
          target: core,
          run: () => {
            this.stunT = 8;
          },
        };
      case 'catarina':
        return {
          name: 'Escudo de catarina',
          desc: 'Los golpes de las copias no te hacen daño por 10 s',
          target: me,
          run: () => this.c.immunity('clone', 10),
        };
      case 'hada':
        return {
          name: 'Hechizo sanador',
          desc: 'Te cura 2 corazones',
          target: me,
          run: () => this.c.healPlayer(40),
        };
      case 'serpiente':
        return {
          name: 'Guardiana',
          desc: 'Quetsy se come las copias que se te acercan (sueltan su orbe) por 12 s',
          target: me,
          run: () => {
            this.c.guardT = 12;
          },
        };
      default:
        return null;
    }
  }

  private killClone(cl: Clone, drop: boolean) {
    const i = this.clones.indexOf(cl);
    if (i === -1) return;
    this.clones.splice(i, 1);
    const at = cl.model.group.position.clone();
    disposeGroup(this.root, cl.model.group);
    this.c.addEffect(burstEffect(this.root, at.clone().add(V(0, 0.8, 0)), this.glitch.material, 12, 0.22, 6, 0.8));
    if (drop) {
      this.c.deps.items.spawnDrop('luz', at.clone().add(V(0, 0.95, 0)));
      this.c.say('¡Copia eliminada! Recoge su orbe de luz', 'clone-kill', 3);
    }
  }

  targets(out: AimTarget[]) {
    if (this.dead) return;
    out.push({
      pos: this.corePos,
      radius: 2.0,
      accepts: ['luz', 'piedra', 'bate'],
      priority: 0.5,
      hit: (kind) => {
        if (kind !== 'luz') {
          this.c.say('Solo la luz le hace daño: derrota copias y lánzale sus orbes', 'glitch-immune', 3);
          return;
        }
        if (this.hitCd > 0) return;
        this.hitCd = 0.3;
        this.c.damageBoss(1);
      },
    });
    for (const cl of this.clones) {
      if (cl.state === 'drop') continue;
      out.push({
        pos: cl.center,
        radius: 0.75,
        accepts: ['bate', 'piedra', 'stomp', 'bomba'],
        top: cl.pos.y + 1.45,
        hit: () => this.killClone(cl, true),
      });
    }
  }

  hint(): string {
    if (this.has('luz')) return '¡Lanza el orbe de luz a ERR0R.exe! (usa el objeto)';
    return 'Derrota a las copias glitch (bate, piedras o salto): sueltan orbes de luz';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    for (const cl of [...this.clones]) this.killClone(cl, false);
    if (instant) this.group.visible = false;
  }

  dispose() {
    for (const cl of this.clones) disposeGroup(this.root, cl.model.group);
    this.clones = [];
    super.dispose();
  }
}

// ===========================================================================
// 3. NAVE NODRIZA
// ===========================================================================
interface Cow {
  m: CowModel;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  state: 'graze' | 'lifting' | 'netted' | 'gone';
  t: number;
  yaw: number;
  wander: THREE.Vector3;
  vy: number;
  net: THREE.Mesh;
  center: THREE.Vector3;
}

interface Alien {
  m: AlienModel;
  pos: THREE.Vector3;
  yaw: number;
  state: 'drop' | 'hunt' | 'windup' | 'lunge' | 'recover' | 'dead';
  t: number;
  hp: number;
  from: THREE.Vector3;
  lungeTo: THREE.Vector3;
  hit: boolean;
  center: THREE.Vector3;
  beam: THREE.Mesh | null;
}

class UfoBoss extends BossController {
  private m: UfoModel;
  private cows: Cow[] = [];
  /** Xenomorph-like aliens it drops on the players (more for bigger parties) */
  private aliens: Alien[] = [];
  private alienT = 5;
  /** Nubi's fog: it can't find cows while it lasts */
  private noAbductT = 0;
  private lost = false;
  private abducting = -1;
  private abductT = 9;
  private laserT = 3;
  private orbit = 0;
  private glassPos = V();
  private beams: { mesh: THREE.Mesh; t: number }[] = [];
  private crashFrom = V();

  constructor(c: CombatSystem) {
    super(c, 100 + 40 * c.setup.diff);
    this.m = createUfo();
    this.group.add(this.m.group);
    this.group.position.copy(this.s.home);
    this.s.cowSpots.forEach((spot) => {
      const m = createCow();
      m.group.position.copy(spot);
      this.root.add(m.group);
      const net = makeNetWrap(1.0, 1.7);
      net.visible = false;
      m.group.add(net);
      this.cows.push({ m, home: spot.clone(), pos: spot.clone(), state: 'graze', t: 0, yaw: Math.random() * 6, wander: spot.clone(), vy: 0, net, center: spot.clone() });
    });
  }

  update(dt: number, time: number) {
    this.applyPulse(dt);
    this.updatePending(dt);
    const pos = this.group.position;
    this.m.lights.forEach((l, i) => (l.visible = Math.floor(time * 6 + i) % 3 !== 0));
    this.m.alien.position.y = -1.9 + Math.sin(time * 3) * 0.08;
    this.m.group.rotation.y += dt * 0.5;
    const frac = 1 - this.hp / this.maxHp;
    (this.m.cracks.material as THREE.MeshBasicMaterial).opacity = Math.min(0.95, frac * 1.1);
    this.m.glassMat.color.setRGB(0.4 + frac * 0.6, 0.9 - frac * 0.5, 0.98 - frac * 0.4);
    this.glassPos.copy(pos).add(V(0, -1.6, 0));
    this.updateBeams(dt);

    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2);
      pos.lerpVectors(this.crashFrom, V(this.crashFrom.x * 0.5, this.s.floorY + 0.8, this.crashFrom.z * 0.5), k * k);
      this.m.group.rotation.z = k * 0.5;
      this.m.group.rotation.y += dt * 4;
      if (Math.random() < dt * 8) this.c.addEffect(puffEffect(this.root, pos.clone(), 'rgba(120,113,108,0.8)', 3, 0.8));
      if (this.deadT > 2.2 && this.group.visible) {
        this.group.visible = false;
        this.c.addEffect(puffEffect(this.root, pos.clone(), 'rgba(255,138,76,1)', 10, 0.9));
        this.c.addEffect(burstEffect(this.root, pos.clone(), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8 }), 18, 0.5, 9, 1.3));
      }
      this.m.beam.visible = false;
      return;
    }

    // Movement: circle the arena, or hover over the cow it is abducting
    const target = V();
    if (this.abducting >= 0) {
      const cow = this.cows[this.abducting];
      target.set(cow.home.x, this.s.home.y - 1.2, cow.home.z);
    } else {
      this.orbit += dt * 0.28;
      target.set(Math.cos(this.orbit) * 8, this.s.home.y + Math.sin(time) * 0.6, this.s.home.z + Math.sin(this.orbit) * 8);
    }
    const step = Math.min(1, (this.abducting >= 0 ? 1.4 : 0.8) * dt);
    pos.lerp(target, step);

    // Lasers
    if (this.abducting < 0) {
      this.laserT -= dt;
      if (this.laserT <= 0) {
        this.laserAt(this.groundAt(0.5));
        if (this.s.diff > 0.45) {
          const p2 = this.groundAt(1.2);
          p2.x += (Math.random() - 0.5) * 6;
          p2.z += (Math.random() - 0.5) * 6;
          this.laserAt(p2);
        }
        this.laserT = 3.0 - 1.1 * this.s.diff;
      }
    }

    // The host decides which cow gets abducted (so the whole party sees the same)
    this.noAbductT = Math.max(0, this.noAbductT - dt);
    if (this.abducting < 0 && this.c.deps.isHost() && this.noAbductT <= 0) {
      this.abductT -= dt;
      if (this.abductT <= 0) {
        const free = this.cows.map((cw, i) => (cw.state === 'graze' ? i : -1)).filter((i) => i >= 0);
        if (free.length) {
          const i = free[Math.floor(Math.random() * free.length)];
          this.c.deps.send('abduct', i);
          this.startAbduct(i);
        }
        this.abductT = 11 - 4 * this.s.diff;
      }
    }
    this.updateCows(dt, time);

    // Aliens down the green beam
    this.alienT -= dt;
    if (this.alienT <= 0) {
      this.alienT = 8 - 2.5 * this.s.diff;
      if (this.aliens.filter((a) => a.state !== 'dead').length < this.scaled(1 + Math.round(this.s.diff * 2), 1)) this.spawnAlien();
    }
    this.updateAliens(dt, time);

    // Every cow taken: the mission is lost
    if (!this.lost && this.cowsLeft() === 0) {
      this.lost = true;
      this.c.lose('¡La Nave Nodriza se llevó todas las vacas!');
    }
  }

  private cowsLeft(): number {
    return this.cows.filter((cw) => cw.state !== 'gone').length;
  }

  objective() {
    return { label: 'Vacas', have: this.cowsLeft(), total: this.cows.length };
  }

  private spawnAlien() {
    const m = createAlien();
    const u = this.group.position;
    const h = this.s.half - 3;
    const at = V(THREE.MathUtils.clamp(u.x, -h, h), this.s.floorY, THREE.MathUtils.clamp(u.z, -h, h));
    const from = V(at.x, u.y - 1.6, at.z);
    m.group.position.copy(from);
    this.root.add(m.group);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.4, u.y - 1.4 - at.y, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    beam.position.set(at.x, (u.y - 1.4 + at.y) / 2, at.z);
    this.root.add(beam);
    this.aliens.push({ m, pos: at, yaw: Math.random() * 6, state: 'drop', t: 0, hp: 2, from, lungeTo: V(), hit: false, center: at.clone(), beam });
    soundManager.playStalkerWarning();
    this.c.say('¡Bajó un alien! Pégale con el bate o la resortera', 'alien', 6);
  }

  private hurtAlien(a: Alien, dmg: number) {
    if (a.state === 'dead' || a.state === 'drop') return;
    a.hp -= dmg;
    this.c.addEffect(puffEffect(this.root, a.center.clone(), 'rgba(134,239,172,0.9)', 1.6, 0.3));
    if (a.hp > 0) {
      a.state = 'recover';
      a.t = 0;
      return;
    }
    a.state = 'dead';
    a.t = 0;
    this.c.addEffect(burstEffect(this.root, a.center.clone(), new THREE.MeshStandardMaterial({ color: 0x84cc16 }), 10, 0.1, 5, 0.8));
    soundManager.playEnemyBoop();
  }

  private updateAliens(dt: number, time: number) {
    const p = this.c.playerPos;
    const floor = this.s.floorY;
    for (let k = this.aliens.length - 1; k >= 0; k--) {
      const a = this.aliens[k];
      a.t += dt;
      const g = a.m.group;
      if (a.beam && a.state !== 'drop') {
        disposeGroup(this.root, a.beam);
        a.beam = null;
      }
      if (a.state === 'dead') {
        a.m.body.rotation.x = Math.min(1.4, a.t * 3);
        g.position.y = a.pos.y - Math.max(0, a.t - 0.5) * 1.5;
        if (a.t > 1.6) {
          disposeGroup(this.root, g);
          this.aliens.splice(k, 1);
        }
        continue;
      }
      if (this.dead) {
        a.state = 'dead';
        a.t = 0;
        continue;
      }
      if (a.state !== 'drop' && this.guarding(a.pos)) {
        a.hp = 0;
        this.hurtAlien(a, 9);
        this.c.say('¡Quetsy se comió un alien!', 'jade-alien', 2);
        continue;
      }
      const dx = p.x - a.pos.x;
      const dz = p.z - a.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      let run = 0;
      switch (a.state) {
        case 'drop': {
          const k2 = Math.min(1, a.t / 1.2);
          g.position.lerpVectors(a.from, a.pos, ease(k2));
          if (a.beam) (a.beam.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - k2 * 0.5);
          if (k2 >= 1) {
            a.state = 'hunt';
            a.t = 0;
          }
          break;
        }
        case 'hunt': {
          a.yaw = turnTo(a.yaw, Math.atan2(dx, dz), 7, dt);
          const speed = 3.6 + 1.6 * this.s.diff;
          if (dist > 2.4) {
            a.pos.x += (dx / dist) * speed * dt;
            a.pos.z += (dz / dist) * speed * dt;
            run = 1;
          } else if (Math.abs(p.y - a.pos.y) < 1.6) {
            a.state = 'windup';
            a.t = 0;
          }
          break;
        }
        case 'windup':
          a.yaw = turnTo(a.yaw, Math.atan2(dx, dz), 10, dt);
          if (a.t >= 0.45 - 0.15 * this.s.diff) {
            a.state = 'lunge';
            a.t = 0;
            a.hit = false;
            a.from.copy(a.pos);
            a.lungeTo.set(a.pos.x + (dx / dist) * 3.4, floor, a.pos.z + (dz / dist) * 3.4);
            soundManager.playWindGust();
          }
          break;
        case 'lunge': {
          const k2 = Math.min(1, a.t / 0.38);
          a.pos.lerpVectors(a.from, a.lungeTo, k2);
          if (!a.hit && Math.hypot(p.x - a.pos.x, p.z - a.pos.z) < 1.0 && Math.abs(p.y - a.pos.y) < 1.6) {
            a.hit = true;
            this.c.damagePlayer(12, a.pos, 9, 5, 'alien');
          }
          if (k2 >= 1) {
            a.state = 'recover';
            a.t = 0;
          }
          break;
        }
        case 'recover':
          if (a.t >= 0.8) {
            a.state = 'hunt';
            a.t = 0;
          }
          break;
      }
      const h = this.s.half - 1;
      a.pos.x = THREE.MathUtils.clamp(a.pos.x, -h, h);
      a.pos.z = THREE.MathUtils.clamp(a.pos.z, -h, h);
      if (a.state !== 'drop') {
        a.pos.y = floor;
        g.position.copy(a.pos);
        g.position.y += a.state === 'lunge' ? Math.sin(Math.min(1, a.t / 0.38) * Math.PI) * 0.8 : 0;
      }
      g.rotation.y = a.yaw;
      // Animation: crouch before the jump, legs running, tail swaying, jaw snapping
      const crouch = a.state === 'windup' ? 0.35 : a.state === 'lunge' ? -0.2 : 0;
      a.m.body.rotation.x = crouch;
      a.m.body.position.y = 0.95 - (a.state === 'windup' ? 0.18 : 0);
      a.m.legs.forEach((l, i) => (l.rotation.x = run ? Math.sin(time * 16 + i * Math.PI) * 0.7 : 0));
      a.m.arms.forEach((l, i) => (l.rotation.x = (a.state === 'lunge' ? -1.2 : 0) + (run ? Math.sin(time * 16 + i * Math.PI + 1) * 0.5 : 0)));
      a.m.tail.forEach((t, i) => (t.rotation.y = Math.sin(time * 4 + i * 0.6) * 0.25));
      a.m.jaw.position.y = -0.13 - (a.state === 'windup' || a.state === 'lunge' ? 0.05 + Math.abs(Math.sin(time * 20)) * 0.04 : 0);
      a.center.copy(a.pos).add(V(0, 1.0, 0));
    }
  }

  companionAction(c: CompanionStyle): CompanionAction | null {
    const ufo = () => this.glassPos;
    const me = () => this.c.playerPos;
    switch (c) {
      case 'nube':
        return {
          name: 'Neblina',
          desc: 'Una niebla esconde las vacas: la nave no puede secuestrar por 12 s',
          target: ufo,
          run: () => this.calm(12, true),
        };
      case 'estrella':
        return {
          name: 'Estrella fugaz',
          desc: 'Una estrella golpea el vidrio de la nave',
          target: ufo,
          run: () => this.c.damageBoss(7),
        };
      case 'luciernaga':
        return {
          name: 'Destello',
          desc: 'Un destello deslumbra a todos los aliens y los tumba',
          target: me,
          run: () => {
            for (const a of this.aliens) this.hurtAlien(a, 9);
          },
        };
      case 'catarina':
        return {
          name: 'Escudo antiláser',
          desc: 'Los láseres de la nave no te hacen daño por 12 s',
          target: me,
          run: () => this.c.immunity('laser', 12),
        };
      case 'hada':
        return {
          name: 'Burbuja mágica',
          desc: 'Envuelve a todas las vacas: la nave no se las puede llevar por un rato',
          target: () => (this.abducting >= 0 ? this.cows[this.abducting].center : ufo()),
          run: () => {
            this.cows.forEach((cw, i) => {
              if (cw.state === 'graze' || cw.state === 'lifting') this.netCow(i, true);
            });
          },
        };
      case 'serpiente':
        return {
          name: 'Guardiana',
          desc: 'Quetsy se come a los aliens que se te acercan por 12 s',
          target: me,
          run: () => {
            this.c.guardT = 12;
          },
        };
      default:
        return null;
    }
  }

  /** No abductions for a while (Nubi's fog); the whole party gets it. */
  private calm(seconds: number, local: boolean) {
    this.noAbductT = Math.max(this.noAbductT, seconds);
    if (local) this.c.deps.send('calm', 0, seconds);
    if (this.abducting >= 0) {
      const cow = this.cows[this.abducting];
      cow.state = 'netted';
      cow.t = 0.01;
      cow.vy = 0;
      this.abducting = -1;
    }
  }

  private laserAt(at: THREE.Vector3) {
    this.warn(at, 1.7, 1.1, () => {
      const top = this.group.position.clone().add(V(0, -1.2, 0));
      const h = top.y - at.y;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 1, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      beam.scale.y = h;
      beam.position.set((top.x + at.x) / 2, at.y + h / 2, (top.z + at.z) / 2);
      beam.lookAt(top);
      beam.rotateX(Math.PI / 2);
      this.root.add(beam);
      this.beams.push({ mesh: beam, t: 0.35 });
      this.c.strike(at, 1.8, 20, 9, 7, 'laser');
      soundManager.playSteamPuff();
      this.c.addEffect(puffEffect(this.root, at.clone().add(V(0, 0.3, 0)), 'rgba(255,45,85,0.95)', 3, 0.35));
    });
  }

  private updateBeams(dt: number) {
    for (let k = this.beams.length - 1; k >= 0; k--) {
      const b = this.beams[k];
      b.t -= dt;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, b.t / 0.35) * 0.85;
      if (b.t <= 0) {
        disposeGroup(this.root, b.mesh);
        this.beams.splice(k, 1);
      }
    }
  }

  private startAbduct(i: number) {
    const cow = this.cows[i];
    if (!cow || cow.state !== 'graze' || this.dead) return;
    cow.state = 'lifting';
    cow.t = 0;
    this.abducting = i;
    this.c.say('¡La nave secuestra una vaca! Lánzale la red a la vaca', 'abduct', 4);
  }

  private netCow(i: number, local: boolean) {
    const cow = this.cows[i];
    if (!cow || (cow.state !== 'graze' && cow.state !== 'lifting')) return;
    if (local) this.c.deps.send('net', i);
    cow.state = 'netted';
    cow.t = 18;
    cow.vy = 0;
    cow.net.visible = true;
    if (this.abducting === i) {
      this.abducting = -1;
      this.c.say('¡Vaca a salvo! La nave no se pudo curar', 'cow-safe', 2);
    }
  }

  private updateCows(dt: number, time: number) {
    const pos = this.group.position;
    const floor = this.s.floorY;
    this.m.beam.visible = false;
    this.cows.forEach((cow, i) => {
      const g = cow.m.group;
      if (cow.state === 'gone') return; // taken for good
      if (cow.state === 'graze') {
        if (cow.pos.distanceTo(cow.wander) < 0.3 || Math.random() < dt * 0.15) {
          const a = Math.random() * Math.PI * 2;
          cow.wander.set(cow.home.x + Math.cos(a) * 3, floor, cow.home.z + Math.sin(a) * 3);
        }
        const dx = cow.wander.x - cow.pos.x;
        const dz = cow.wander.z - cow.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          cow.pos.x += (dx / d) * 0.8 * dt;
          cow.pos.z += (dz / d) * 0.8 * dt;
          cow.yaw = turnTo(cow.yaw, Math.atan2(dx, dz), 3, dt);
        }
        cow.pos.y = floor;
        cow.m.legs.forEach((l, k) => (l.rotation.x = Math.sin(time * 6 + k * 1.6) * 0.3));
        cow.m.head.rotation.x = Math.sin(time * 0.8 + i) * 0.25 + 0.15;
      } else if (cow.state === 'lifting') {
        const under = Math.hypot(pos.x - cow.pos.x, pos.z - cow.pos.z) < 2.2;
        if (under) {
          cow.pos.y += 1.5 * dt;
          cow.pos.x += (pos.x - cow.pos.x) * Math.min(1, dt);
          cow.pos.z += (pos.z - cow.pos.z) * Math.min(1, dt);
          this.m.beam.visible = true;
          const h = pos.y - 1.0 - floor;
          this.m.beam.scale.set(1, h, 1);
          this.m.beam.position.set(0, -1.0 - h / 2, 0);
          g.rotation.z = Math.sin(time * 3) * 0.4;
          cow.m.legs.forEach((l, k) => (l.rotation.x = Math.sin(time * 14 + k) * 0.6));
        }
        if (cow.pos.y >= pos.y - 2.4) {
          cow.state = 'gone';
          cow.t = 20;
          g.visible = false;
          this.abducting = -1;
          if (this.c.deps.isHost()) this.c.healBoss(16);
          const left = this.cowsLeft();
          this.c.say(
            left > 0 ? `¡Se llevó una vaca! Quedan ${left}. Si se lleva todas, pierdes` : '¡Se llevó la última vaca!',
            'ufo-heal',
            1
          );
        }
      } else if (cow.state === 'netted') {
        cow.t -= dt;
        if (cow.pos.y > floor) {
          cow.vy -= 20 * dt;
          cow.pos.y = Math.max(floor, cow.pos.y + cow.vy * dt);
        }
        g.rotation.z = THREE.MathUtils.damp(g.rotation.z, 0, 6, dt);
        if (cow.t <= 0) {
          cow.state = 'graze';
          cow.net.visible = false;
        }
      }
      g.position.copy(cow.pos);
      g.rotation.y = cow.yaw;
      cow.center.copy(cow.pos).add(V(0, 0.9, 0));
    });
  }

  targets(out: AimTarget[]) {
    for (const a of this.aliens) {
      if (a.state === 'dead' || a.state === 'drop') continue;
      out.push({
        pos: a.center,
        radius: 0.75,
        accepts: ['bate', 'piedra', 'stomp'],
        top: a.pos.y + 1.6,
        priority: 0.9,
        hit: (kind) => this.hurtAlien(a, kind === 'piedra' ? 1 : 2),
      });
    }
    if (this.dead) return;
    out.push({
      pos: this.glassPos,
      radius: 2.4,
      accepts: ['piedra'],
      hit: () => this.c.damageBoss(7),
    });
    this.cows.forEach((cow, i) => {
      if (cow.state !== 'graze' && cow.state !== 'lifting') return;
      out.push({
        pos: cow.center,
        radius: 1.3,
        accepts: ['red'],
        priority: cow.state === 'lifting' ? 0.8 : 0,
        hit: () => this.netCow(i, true),
      });
    });
  }

  onEvent(kind: string, i: number, v: number) {
    if (kind === 'abduct') this.startAbduct(i);
    else if (kind === 'net') this.netCow(i, false);
    else if (kind === 'calm') this.calm(v, false);
  }

  hint(): string {
    if (this.abducting >= 0) return this.has('red') ? '¡Secuestra una vaca! Lánzale la red a la vaca' : '¡Secuestra una vaca! Busca una red para salvarla';
    if (this.aliens.some((a) => a.state !== 'dead' && a.state !== 'drop')) return '¡Aliens! Pégales con el bate (o 2 piedras) antes de que salten sobre ti';
    if (!this.has('resortera')) return 'Toma la resortera y junta piedras';
    if (!this.has('piedra')) return 'Junta piedras del suelo para la resortera';
    return 'Dispara al vidrio de la nave con la resortera · esquiva los círculos rojos';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    this.abducting = -1;
    this.crashFrom.copy(this.group.position);
    if (!instant) this.c.say(`¡Salvaste ${this.cowsLeft()} de ${this.cows.length} vacas!`, 'cows-saved', 99);
    for (const cow of this.cows) {
      if (cow.state === 'lifting') {
        cow.state = 'netted';
        cow.t = 0.01;
      }
    }
    if (instant) this.group.visible = false;
  }

  dispose() {
    for (const a of this.aliens) {
      disposeGroup(this.root, a.m.group);
      if (a.beam) disposeGroup(this.root, a.beam);
    }
    this.aliens = [];
    for (const cow of this.cows) disposeGroup(this.root, cow.m.group);
    for (const b of this.beams) disposeGroup(this.root, b.mesh);
    super.dispose();
  }
}

// ===========================================================================
// 4. HUESUDO
// ===========================================================================
interface Dancer {
  m: DancerModel;
  pos: THREE.Vector3;
  state: 'rise' | 'dance' | 'carry' | 'sink';
  t: number;
  yaw: number;
  phase: number;
  center: THREE.Vector3;
}

class SkeletonBoss extends BossController {
  private m: GiantSkeletonModel;
  /**
   * rise   — coming out of the bog at `spot`
   * up     — fighting: opens its mouth, slams its hands, calls the dancers
   * crouch — ducks down into the bog…
   * under  — …and moves underground to `next` (a green circle shows where it will come out)
   */
  private phase: 'rise' | 'up' | 'crouch' | 'under' = 'rise';
  private phaseT = 0;
  private upT = 14;
  private waitT = 0;
  private spot = 0;
  private next = 0;
  private yaw = 0;
  private mouthOpen = false;
  private mouthT = 4;
  private chompT = 0;
  private slamT = 5;
  private spawnT = 3;
  private dancers: Dancer[] = [];
  private mouthPos = V();
  private dropPoint = V();
  private chewPos = V();
  /** Chewing a grabbed player */
  private chew: { t: number; bites: number } | null = null;
  private hitCd = 0;
  /** Nubi's steam: it can't see you to slam its hands */
  private noSlamT = 0;

  constructor(c: CombatSystem) {
    super(c, 4 + (c.setup.diff > 0.5 ? 1 : 0));
    this.m = createGiantSkeleton();
    this.group.add(this.m.group);
    if (!this.s.giantSpots.length) this.s.giantSpots.push(this.s.giantBase.clone());
    this.yaw = this.faceYaw(0);
    this.placeAt(0, -11);
  }

  private get spots() {
    return this.s.giantSpots;
  }

  /** The middle lake has nothing in front: it turns to the players. The edges face the arena. */
  private isLake(i: number) {
    const g = this.spots[i];
    return Math.hypot(g.x, g.z) < 3;
  }

  private faceYaw(i: number): number {
    const g = this.spots[i];
    if (this.isLake(i)) return Math.atan2(this.c.playerPos.x - g.x, this.c.playerPos.z - g.z);
    return Math.atan2(-g.x, -g.z);
  }

  private placeAt(i: number, dy: number) {
    const g = this.spots[i];
    this.group.position.set(g.x, g.y + dy, g.z);
    this.group.rotation.y = this.yaw;
  }

  private bogPuff(at: THREE.Vector3, size = 3) {
    this.c.addEffect(puffEffect(this.root, V(at.x + (Math.random() - 0.5) * 6, this.s.floorY + 0.2, at.z + (Math.random() - 0.5) * 6), 'rgba(132,204,22,0.6)', size, 0.6));
  }

  update(dt: number, time: number) {
    this.applyPulse(dt);
    this.updatePending(dt);
    this.hitCd -= dt;
    const p = this.c.playerPos;
    const base = this.spots[this.spot];
    const pos = this.group.position;

    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.6);
      pos.y = base.y - 12 * k * k;
      this.m.group.rotation.x = -k * 0.5;
      this.m.jaw.rotation.x = 0.9;
      if (Math.random() < dt * 6) this.bogPuff(base, 3);
      if (k >= 1) this.group.visible = false;
      return;
    }

    this.phaseT += dt;
    this.chompT = Math.max(0, this.chompT - dt);
    switch (this.phase) {
      case 'rise': {
        const k = Math.min(1, this.phaseT / 2.2);
        this.yaw = this.faceYaw(this.spot);
        this.placeAt(this.spot, -11 * (1 - ease(k)));
        this.m.group.rotation.x = 0.5 * (1 - k);
        if (Math.random() < dt * 10) this.bogPuff(base);
        if (k >= 1) {
          this.phase = 'up';
          this.phaseT = 0;
          this.upT = 15 - 4 * this.s.diff + Math.random() * 4;
          this.mouthT = 2.5;
          this.waitT = 0;
        }
        break;
      }
      case 'up': {
        // Turns a little towards the player (the lake one turns all the way)
        const toP = Math.atan2(p.x - base.x, p.z - base.z);
        let want = this.isLake(this.spot) ? toP : this.faceYaw(this.spot);
        if (!this.isLake(this.spot)) {
          let d = toP - want;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          want += THREE.MathUtils.clamp(d, -0.5, 0.5);
        }
        this.yaw = turnTo(this.yaw, want, 0.8, dt);
        this.group.rotation.y = this.yaw;
        this.m.group.rotation.x = THREE.MathUtils.damp(this.m.group.rotation.x, 0, 4, dt);
        this.upT -= dt;
        const busy = this.chew || this.chompT > 0 || this.dancers.some((d) => d.state === 'carry');
        if (this.upT <= 0 && !busy) {
          // The host decides where it goes next and tells the party; the rest wait a moment
          if (this.c.deps.isHost()) {
            this.startCrouch(this.randomSpot(), true);
          } else {
            this.waitT += dt;
            if (this.waitT > 3) this.startCrouch((this.spot + 1 + (this.maxHp - this.hp)) % this.spots.length, false);
          }
        }
        break;
      }
      case 'crouch': {
        // Leans forward, then ducks into the bog
        const k = Math.min(1, this.phaseT / 1.6);
        this.m.group.rotation.x = 0.55 * ease(Math.min(1, k * 1.6));
        const sink = Math.max(0, (k - 0.35) / 0.65);
        this.placeAt(this.spot, -11 * sink * sink);
        if (Math.random() < dt * 12) this.bogPuff(base);
        if (k >= 1) {
          this.phase = 'under';
          this.phaseT = 0;
          this.spot = this.next;
          const g = this.spots[this.spot];
          const floorAt = V(g.x, this.s.floorY, g.z);
          // A green circle shows where it will come out — and it knocks back whoever stands there
          const lake = this.isLake(this.spot);
          this.warn(floorAt, lake ? 4.2 : 3.4, 1.4, () => this.c.strike(floorAt, lake ? 4.2 : 3.4, 15, 12, 9), 0x84cc16);
          this.c.say(lake ? '¡Huesudo va a salir del lago!' : '¡Huesudo cambia de lugar!', 'skel-move', 3);
        }
        break;
      }
      case 'under': {
        const g = this.spots[this.spot];
        this.yaw = this.faceYaw(this.spot);
        this.placeAt(this.spot, -11);
        if (Math.random() < dt * 14) this.bogPuff(g, 2.4);
        if (this.phaseT >= 1.4) {
          this.phase = 'rise';
          this.phaseT = 0;
          soundManager.playStalkerWarning();
        }
        break;
      }
    }

    // Idle sway, looks at the player
    const up = this.phase === 'up';
    this.m.skull.rotation.y = turnTo(this.m.skull.rotation.y, THREE.MathUtils.clamp(Math.atan2(p.x - pos.x, p.z - pos.z) - this.yaw, -0.6, 0.6), 2, dt);
    this.m.arms.forEach((a, i) => (a.rotation.x = -0.35 + Math.sin(time * 1.2 + i * 2) * 0.12 + (this.phase === 'crouch' ? -0.6 : 0)));
    for (const e of this.m.eyes) e.scale.setScalar(1 + Math.sin(time * 5) * 0.2);

    // Mouth cycle (only while it's up)
    if (up && !this.chew) {
      this.mouthT -= dt;
      if (this.mouthT <= 0) {
        this.mouthOpen = !this.mouthOpen;
        this.mouthT = this.mouthOpen ? 3.4 : 6.5 - 2 * this.s.diff;
        if (this.mouthOpen) {
          soundManager.playStalkerWarning();
          if (this.has('bomba')) this.c.say('¡Huesudo abrió la boca! ¡Lánzale una bomba!', 'mouth', 5);
        }
      }
    } else if (!up) {
      this.mouthOpen = false;
    }
    const chewing = !!this.chew || this.chompT > 0;
    const jawTarget = chewing ? 0.45 + Math.sin(time * 16) * 0.42 : this.mouthOpen ? 0.85 : 0.04;
    this.m.jaw.rotation.x = THREE.MathUtils.damp(this.m.jaw.rotation.x, jawTarget, chewing ? 22 : 10, dt);
    this.m.skull.rotation.x = chewing ? Math.sin(time * 8) * 0.12 : THREE.MathUtils.damp(this.m.skull.rotation.x, 0, 6, dt);
    this.m.mouthGlow.visible = this.mouthOpen;
    this.group.updateMatrixWorld(true);
    this.m.skull.localToWorld(this.mouthPos.set(0, -1.0, 1.6));

    // Where the dancers bring their catch: in front of the giant
    const fwd = V(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const h = this.s.half - 2;
    this.dropPoint.set(
      THREE.MathUtils.clamp(base.x + fwd.x * (this.isLake(this.spot) ? 3.2 : 5), -h, h),
      this.s.floorY,
      THREE.MathUtils.clamp(base.z + fwd.z * (this.isLake(this.spot) ? 3.2 : 5), -h, h)
    );

    // Hand slams on whoever is close to the giant
    this.noSlamT = Math.max(0, this.noSlamT - dt);
    if (up && this.noSlamT <= 0) {
      this.slamT -= dt;
      if (this.slamT <= 0) {
        this.slamT = 5.5 - 2 * this.s.diff;
        if (Math.hypot(p.x - base.x, p.z - base.z) < 24 && !this.c.grab) {
          const at = this.groundAt(0.6);
          this.warn(at, 2.5, 1.3, () => this.slam(at));
        }
      }
    }

    this.updateChew(dt, fwd);

    // Dancing skeletons
    this.spawnT -= dt;
    const alive = this.dancers.filter((d) => d.state !== 'sink').length;
    if (this.spawnT <= 0 && alive < this.scaled(2 + Math.round(2 * this.s.diff), 1) && (up || this.phase === 'under')) {
      this.spawnDancer();
      this.spawnT = 5 - 1.5 * this.s.diff;
    }
    this.updateDancers(dt, time);
  }

  private randomSpot(): number {
    const n = this.spots.length;
    if (n < 2) return 0;
    let i = Math.floor(Math.random() * (n - 1));
    if (i >= this.spot) i++;
    return i;
  }

  private startCrouch(next: number, send: boolean) {
    if (this.dead || next < 0 || next >= this.spots.length) return;
    this.next = next;
    if (this.phase !== 'up' && this.phase !== 'rise') return;
    this.phase = 'crouch';
    this.phaseT = 0;
    this.mouthOpen = false;
    if (send) this.c.deps.send('move', next, 0);
    soundManager.playWoodRattle();
  }

  onEvent(kind: string, i: number) {
    if (kind === 'move') {
      if (this.phase === 'up' || this.phase === 'rise') this.startCrouch(i, false);
      else this.next = i;
    } else if (kind === 'chew') {
      // A friend is being chewed: same animation here
      this.chompT = 2.2;
    }
  }

  /** The dancer reached the giant: it takes the player into its mouth and chews. */
  private startChew() {
    const g = this.c.grab;
    if (!g || this.chew) return;
    const before = g.holder;
    g.holder = {
      pos: this.chewPos,
      onRelease: () => {
        this.chew = null;
      },
    };
    before.onRelease('eaten');
    g.need = g.count + 8 + Math.round(this.s.diff * 4);
    this.chew = { t: 0, bites: 0 };
    this.mouthOpen = false;
    this.c.deps.send('chew', 0, 0);
    soundManager.playStalkerWarning();
    this.c.say('¡Huesudo te está masticando! Pulsa saltar para escapar', 'chew', 2);
  }

  private updateChew(dt: number, fwd: THREE.Vector3) {
    this.chewPos.copy(this.mouthPos).addScaledVector(fwd, 0.35);
    this.chewPos.y -= 1.35;
    const c = this.chew;
    if (!c) return;
    if (!this.c.grab) {
      this.chew = null;
      return;
    }
    c.t += dt;
    // Three bites, crumbs flying
    const biteAt = [0.55, 1.15, 1.75];
    if (c.bites < biteAt.length && c.t >= biteAt[c.bites]) {
      c.bites++;
      this.c.invuln = 0;
      this.c.damagePlayer(12, null, 0, 0);
      soundManager.playEnemyBonk();
      this.c.addEffect(burstEffect(this.root, this.mouthPos.clone(), new THREE.MeshStandardMaterial({ color: 0xe7e0cf }), 5, 0.12, 4, 0.5));
      if (!this.c.grab) {
        this.chew = null;
        return;
      }
    }
    if (c.t >= 2.2) {
      // Spits the player back into the arena
      this.chew = null;
      this.c.releaseGrab('eaten');
      const ph = this.c.physics;
      ph.velocity.set(fwd.x * 11, 10, fwd.z * 11);
      ph.isGrounded = false;
      this.c.invuln = Math.max(this.c.invuln, 1.5);
      this.c.addEffect(puffEffect(this.root, this.mouthPos.clone(), 'rgba(132,204,22,0.75)', 3, 0.5));
      this.c.say('¡Huesudo te masticó y te escupió!', 'eaten', 2);
    }
  }

  private slam(at: THREE.Vector3) {
    const hand = new THREE.Group();
    const bone = new THREE.MeshStandardMaterial({ color: 0xe7e0cf, roughness: 0.75, flatShading: true });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.0), bone);
    hand.add(palm);
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 1.8, 6), bone);
      f.position.set(-0.8 + k * 0.53, -0.1, 1.6);
      f.rotation.x = Math.PI / 2;
      hand.add(f);
    }
    hand.position.set(at.x, at.y + 8, at.z - 1);
    this.root.add(hand);
    this.c.addEffect({
      obj: hand,
      t: 0,
      dur: 1.1,
      tick: (k) => {
        const y = k < 0.2 ? 8 * (1 - k / 0.2) : k < 0.65 ? 0 : ((k - 0.65) / 0.35) * 8;
        hand.position.y = at.y + 0.3 + y;
        hand.scale.setScalar(k > 0.8 ? Math.max(0.01, 1 - (k - 0.8) * 5) : 1);
      },
    });
    this.c.strike(at, 2.6, 20, 12, 7, 'slam');
    soundManager.playWoodRattle();
    this.c.addEffect(puffEffect(this.root, at.clone().add(V(0, 0.4, 0)), 'rgba(132,204,22,0.7)', 4, 0.5));
  }

  companionAction(c: CompanionStyle): CompanionAction | null {
    const mouth = () => this.mouthPos;
    const me = () => this.c.playerPos;
    switch (c) {
      case 'nube':
        return {
          name: 'Nube de vapor',
          desc: 'El pantano echa vapor: Huesudo no te ve y no golpea con las manos por 12 s',
          target: mouth,
          run: () => {
            this.noSlamT = 12;
            this.clearPending();
          },
        };
      case 'estrella':
        return {
          name: 'Bombas estelares',
          desc: 'Te da 2 bombas',
          target: me,
          run: () => this.gift('bomba', 2),
        };
      case 'luciernaga':
        return {
          name: 'Luz de pantano',
          desc: 'La luz hace que Huesudo abra la boca: ¡lánzale una bomba!',
          target: mouth,
          run: () => {
            if (this.phase !== 'up' || this.chew) {
              this.c.say('Huesudo está escondido… inténtalo cuando salga', 'act-skel', 1);
              return;
            }
            this.mouthOpen = true;
            this.mouthT = 5;
            this.c.say('¡Huesudo abrió la boca! ¡Lánzale una bomba!', 'mouth', 1);
          },
        };
      case 'catarina':
        return {
          name: 'Concha dura',
          desc: 'Los esqueletos bailarines no te pueden agarrar por 12 s',
          target: me,
          run: () => this.c.immunity('grab', 12),
        };
      case 'hada':
        return {
          name: 'Rescate de hada',
          desc: 'Te suelta si te tienen atrapado y te cura 1 corazón',
          target: me,
          anytime: true,
          run: () => {
            if (this.c.grab) this.c.releaseGrab('friend');
            this.c.healPlayer(20);
          },
        };
      case 'serpiente':
        return {
          name: 'Cazadora de huesos',
          desc: 'Quetsy derriba a todos los esqueletos bailarines',
          target: me,
          run: () => {
            for (const d of this.dancers) {
              if (d.state === 'carry' && this.c.grab) this.c.releaseGrab('friend');
              this.collapse(d);
            }
          },
        };
      default:
        return null;
    }
  }

  private spawnDancer() {
    const spots = [V(-12, 0, -27), V(12, 0, -27), V(-27, 0, -6), V(27, 0, -6), V(-22, 0, 12), V(22, 0, 12)];
    const spot = spots[Math.floor(Math.random() * spots.length)];
    spot.y = this.s.floorY;
    const m = createDancer();
    m.group.position.set(spot.x, spot.y - 1.8, spot.z);
    this.root.add(m.group);
    this.dancers.push({ m, pos: spot, state: 'rise', t: 0, yaw: 0, phase: Math.random() * 6, center: spot.clone() });
  }

  private updateDancers(dt: number, time: number) {
    const p = this.c.playerPos;
    const floor = this.s.floorY;
    const speed = 2.6 + 1.2 * this.s.diff;
    for (let k = this.dancers.length - 1; k >= 0; k--) {
      const d = this.dancers[k];
      d.t += dt;
      const g = d.m.group;
      if (d.state === 'sink') {
        g.position.y -= dt * 2.5;
        g.rotation.z += dt * 2;
        if (d.t > 1) {
          disposeGroup(this.root, g);
          this.dancers.splice(k, 1);
        }
        continue;
      }
      if (d.state === 'rise') {
        d.pos.y = floor - 1.8 * (1 - Math.min(1, d.t / 0.9));
        if (d.t >= 0.9) {
          d.state = 'dance';
          d.pos.y = floor;
        }
      } else if (d.state === 'dance') {
        const dx = p.x - d.pos.x;
        const dz = p.z - d.pos.z;
        const dist = Math.hypot(dx, dz) || 1;
        if (!this.c.grab) {
          d.pos.x += (dx / dist) * speed * dt;
          d.pos.z += (dz / dist) * speed * dt;
        }
        d.yaw = turnTo(d.yaw, Math.atan2(dx, dz), 6, dt);
        if (this.guarding(d.pos)) {
          this.collapse(d);
          this.c.say('¡Quetsy derribó a un esqueleto!', 'jade-dancer', 2);
          continue;
        }
        if (dist < 0.85 && Math.abs(p.y - d.pos.y) < 1.5 && !this.c.isImmune('grab')) {
          const need = 7 + Math.round(this.s.diff * 4);
          const ok = this.c.grabPlayer(
            {
              pos: d.pos,
              onRelease: (reason) => {
                d.m.cage.visible = false;
                if (reason === 'eaten') {
                  d.state = 'sink';
                  d.t = 0;
                } else this.collapse(d);
              },
            },
            need
          );
          if (ok) {
            d.state = 'carry';
            d.m.cage.visible = true;
          }
        }
      } else if (d.state === 'carry') {
        const dx = this.dropPoint.x - d.pos.x;
        const dz = this.dropPoint.z - d.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.05) {
          d.pos.x += (dx / dist) * 2.4 * dt;
          d.pos.z += (dz / dist) * 2.4 * dt;
          d.yaw = turnTo(d.yaw, Math.atan2(dx, dz), 6, dt);
        }
        if (dist < 1.2 && this.c.grab && this.phase === 'up') {
          this.startChew();
        } else if (!this.c.grab) {
          d.state = 'dance';
          d.m.cage.visible = false;
        }
      }
      if ((d.state as Dancer['state']) === 'sink') continue;
      // Dance moves
      const beat = time * 6 + d.phase;
      g.position.set(d.pos.x, d.pos.y + Math.abs(Math.sin(beat)) * 0.18, d.pos.z);
      g.rotation.y = d.yaw + (d.state === 'dance' ? Math.sin(beat * 0.5) * 0.6 : 0);
      d.m.arms[0].rotation.z = 2.4 + Math.sin(beat) * 0.6;
      d.m.arms[1].rotation.z = -2.4 + Math.sin(beat + 1) * 0.6;
      d.m.legs[0].rotation.x = Math.sin(beat) * 0.5;
      d.m.legs[1].rotation.x = -Math.sin(beat) * 0.5;
      d.m.body.rotation.z = Math.sin(beat) * 0.15;
      d.center.copy(d.pos).add(V(0, 0.9, 0));
    }
  }

  focusPoint(): THREE.Vector3 {
    return this.mouthPos;
  }

  private collapse(d: Dancer) {
    if (d.state === 'sink') return;
    d.m.cage.visible = false;
    d.state = 'sink';
    d.t = 0;
    this.c.addEffect(burstEffect(this.root, d.pos.clone().add(V(0, 0.9, 0)), new THREE.MeshStandardMaterial({ color: 0xe7e0cf }), 9, 0.14, 4, 0.8));
    soundManager.playWoodRattle();
  }

  targets(out: AimTarget[]) {
    if (this.dead) return;
    if (this.phase === 'up') {
      out.push({
        pos: this.mouthPos,
        radius: 1.9,
        accepts: ['bomba', 'piedra'],
        priority: 1.5,
        hit: (kind) => {
          if (kind === 'piedra') {
            this.c.say('Las piedras no le hacen nada: dale bombas', 'skel-stone', 3);
            return;
          }
          if (!this.mouthOpen) {
            this.c.say('¡Clank! Espera a que abra la boca', 'skel-closed', 2);
            return;
          }
          if (this.hitCd > 0) return;
          this.hitCd = 0.5;
          this.mouthOpen = false;
          this.mouthT = 4;
          this.c.damageBoss(1);
          if (this.hp > 0) this.c.say('¡Bum! Huesudo se tragó la bomba', 'skel-hit', 2);
        },
      });
    }
    for (const d of this.dancers) {
      if (d.state === 'sink') continue;
      out.push({
        pos: d.center,
        radius: 0.7,
        accepts: ['bate', 'piedra', 'stomp', 'bomba'],
        top: d.pos.y + 1.75,
        hit: () => {
          if (d.state === 'carry' && this.c.grab) {
            this.c.releaseGrab('friend');
            return;
          }
          this.collapse(d);
        },
      });
    }
  }

  hint(): string {
    const g = this.c.grab;
    if (this.chew && g) return `¡Te está masticando! Pulsa saltar muchas veces (${g.count}/${g.need})`;
    if (g) return `¡Pulsa saltar muchas veces para soltarte! (${g.count}/${g.need})`;
    if (this.phase === 'crouch' || this.phase === 'under') return 'Huesudo se escondió en el pantano: mira el círculo verde, por ahí va a salir';
    if (!this.has('bomba')) return 'Junta bombas del suelo y cuidado con los esqueletos bailarines: te llevan a su boca';
    if (this.mouthOpen) return '¡Huesudo abrió la boca! Lánzale una bomba';
    return 'Espera a que Huesudo abra la boca y lánzale una bomba';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    if (this.chew && this.c.grab) this.c.releaseGrab('other');
    this.chew = null;
    for (const d of this.dancers) this.collapse(d);
    if (instant) this.group.visible = false;
  }

  dispose() {
    for (const d of this.dancers) disposeGroup(this.root, d.m.group);
    this.dancers = [];
    super.dispose();
  }
}

// ===========================================================================
// 5. REY GNOMO
// ===========================================================================
interface Minion {
  kind: 'warrior' | 'helper';
  m: GnomeMinionModel;
  pos: THREE.Vector3;
  yaw: number;
  state: 'rise' | 'go' | 'act' | 'sink';
  t: number;
  cd: number;
  center: THREE.Vector3;
}

class GnomeBoss extends BossController {
  private m: GnomeKingModel;
  private pos: THREE.Vector3;
  private yaw = 0;
  /**
   * walk / windup / slam / recover / leap — mallet attacks
   * fetch  — walks to a net lying on the floor and takes it
   * aim    — spins the net over his head (a cyan circle shows where it lands)
   * netted — caught by your net: warrior gnomes protect him, helpers pull the net off
   */
  private state: 'walk' | 'windup' | 'slam' | 'recover' | 'leap' | 'fetch' | 'aim' | 'netted' = 'walk';
  private t = 0;
  private leapT = 6;
  private leapFrom = V();
  private leapTo = V();
  private net: THREE.Mesh;
  private handNet: THREE.Mesh;
  private hitCd = 0;
  private center = V();
  private netCd = 7;
  private fetchTo = V();
  private aimAt = V();
  private minions: Minion[] = [];
  /** The net he threw, wrapped around the local player */
  private playerNet: THREE.Mesh | null = null;
  private trapPos = V();
  private netDur = 5.5;
  private minionMat = new THREE.MeshStandardMaterial({ color: 0xe7e0cf });
  /** Nubi's puddle: he slips around, slow and without leaps */
  private slowT = 0;
  /** Lila's spell: asleep (like netted, but nobody comes to help) */
  private asleep = false;
  private zzz: THREE.Sprite | null = null;

  constructor(c: CombatSystem) {
    super(c, 100 + 50 * c.setup.diff);
    this.m = createGnomeKing();
    this.group.add(this.m.group);
    this.pos = this.s.home.clone();
    this.group.position.copy(this.pos);
    this.net = makeNetWrap(1.5, 3.6);
    this.net.visible = false;
    this.group.add(this.net);
    // The net he carries before throwing it
    this.handNet = makeNetWrap(0.45, 0.7);
    this.handNet.visible = false;
    this.root.add(this.handNet);
    this.m.mallet.rotation.x = 0.6;
    this.netCd = 8 - 3 * c.setup.diff;
  }

  update(dt: number, time: number) {
    this.applyPulse(dt);
    this.updatePending(dt);
    this.hitCd -= dt;
    const p = this.c.playerPos;
    const diff = this.s.diff;
    const mallet = this.m.mallet;
    const fwd = V(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.8);
      this.m.group.rotation.x = -k * 1.2;
      this.m.group.position.y = k * 0.4;
      this.handNet.visible = false;
      if (this.deadT > 2.4 && this.group.visible) {
        this.group.visible = false;
        this.c.addEffect(burstEffect(this.root, this.pos.clone().add(V(0, 1.5, 0)), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7 }), 16, 0.25, 8, 1.2));
      }
      this.updateMinions(dt, time);
      return;
    }

    this.slowT = Math.max(0, this.slowT - dt);
    if (this.slowT > 0) this.m.group.rotation.z = Math.sin(time * 6) * 0.12;
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const walkAnim = () => this.m.feet.forEach((f, i) => (f.position.z = 0.03 + Math.sin(time * 8 + i * Math.PI) * 0.08));
    this.t += dt;
    switch (this.state) {
      case 'walk': {
        this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), 3, dt);
        // A trapped player gets the king's full attention
        const speed = (2.4 + 1.4 * diff) * (this.c.grab && this.playerNet ? 1.5 : 1) * (this.slowT > 0 ? 0.5 : 1);
        if (this.slowT > 0) this.leapT = Math.max(this.leapT, 1);
        if (dist > 2.6) {
          this.pos.x += Math.sin(this.yaw) * speed * dt;
          this.pos.z += Math.cos(this.yaw) * speed * dt;
        }
        walkAnim();
        mallet.rotation.x = THREE.MathUtils.damp(mallet.rotation.x, 0.6, 6, dt);
        this.leapT -= dt;
        this.netCd -= dt;
        if (dist < 4.2) {
          this.state = 'windup';
          this.t = 0;
        } else if (this.netCd <= 0 && dist > 5 && !this.c.grab) {
          // Is there a net lying around? He goes for it
          const at = this.c.deps.items.nearestLying('red', this.pos, 20);
          if (at) {
            this.state = 'fetch';
            this.t = 0;
            this.fetchTo.copy(at);
            this.c.say('¡El Rey Gnomo va por una red!', 'gnome-fetch', 4);
          } else {
            this.netCd = 3;
          }
        } else if (this.leapT <= 0 && dist > 8) {
          this.state = 'leap';
          this.t = 0;
          this.leapFrom.copy(this.pos);
          this.leapTo.copy(this.groundAt(1.1));
          this.leapTo.y = this.s.floorY;
          this.warn(this.leapTo, 3.0, 1.1, () => {}, 0xf59e0b);
          this.leapT = 7 - 2 * diff;
        }
        break;
      }
      case 'fetch': {
        const fx = this.fetchTo.x - this.pos.x;
        const fz = this.fetchTo.z - this.pos.z;
        const fd = Math.hypot(fx, fz) || 1;
        this.yaw = turnTo(this.yaw, Math.atan2(fx, fz), 5, dt);
        const speed = 3.6 + 1.6 * diff;
        this.pos.x += (fx / fd) * Math.min(fd, speed * dt);
        this.pos.z += (fz / fd) * Math.min(fd, speed * dt);
        walkAnim();
        // Someone took it first (or it takes too long): back to chasing
        if (!this.c.deps.items.nearestLying('red', this.fetchTo, 1.5) || this.t > 9) {
          this.state = 'walk';
          this.netCd = 4;
          break;
        }
        if (fd < 1.4 && this.c.deps.items.takeLying('red', this.fetchTo, 1.8)) {
          this.state = 'aim';
          this.t = 0;
          this.handNet.visible = true;
          this.aimAt.copy(this.groundAt(1.0));
          this.warn(this.aimAt, 2.0, 1.1, () => this.throwNet(), 0x22d3ee);
          soundManager.playWindGust();
          this.c.say('¡El Rey Gnomo te va a lanzar la red! Muévete del círculo', 'gnome-aim', 2);
        }
        break;
      }
      case 'aim': {
        this.yaw = turnTo(this.yaw, Math.atan2(this.aimAt.x - this.pos.x, this.aimAt.z - this.pos.z), 6, dt);
        mallet.rotation.x = THREE.MathUtils.damp(mallet.rotation.x, 0.9, 6, dt);
        // Net spinning over his head
        const a = time * 9;
        this.handNet.position.set(this.pos.x + Math.cos(a) * 1.2, this.pos.y + 4.3, this.pos.z + Math.sin(a) * 1.2);
        this.handNet.rotation.y = a;
        if (this.t > 2) this.state = 'recover';
        break;
      }
      case 'windup': {
        const dur = 0.85 - 0.25 * diff;
        this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), 2, dt);
        mallet.rotation.x = THREE.MathUtils.lerp(0.6, -2.3, Math.min(1, this.t / dur));
        if (this.t >= dur) {
          this.state = 'slam';
          this.t = 0;
        }
        break;
      }
      case 'slam': {
        mallet.rotation.x = THREE.MathUtils.lerp(-2.3, 0.5, Math.min(1, this.t / 0.12));
        if (this.t >= 0.12) {
          const at = this.pos.clone().addScaledVector(fwd, 2.4);
          at.y = this.s.floorY;
          this.impact(at, 2.4);
          this.state = 'recover';
          this.t = 0;
        }
        break;
      }
      case 'leap': {
        const k = Math.min(1, this.t / 1.1);
        this.pos.lerpVectors(this.leapFrom, this.leapTo, k);
        this.pos.y = this.s.floorY + Math.sin(Math.PI * k) * 6;
        mallet.rotation.x = -2.0;
        if (k >= 1) {
          this.pos.y = this.s.floorY;
          this.impact(this.pos.clone(), 3.0);
          this.state = 'recover';
          this.t = 0;
        }
        break;
      }
      case 'recover':
        mallet.rotation.x = THREE.MathUtils.damp(mallet.rotation.x, 0.6, 4, dt);
        if (this.t >= 0.9) {
          this.state = 'walk';
          this.t = 0;
        }
        break;
      case 'netted': {
        this.m.group.rotation.z = Math.sin(time * 10) * 0.08;
        mallet.rotation.x = 0.9;
        // Every helper pulling at the net makes it come off sooner
        const pulling = this.minions.filter((mi) => mi.kind === 'helper' && mi.state === 'act').length;
        this.t += dt * 0.6 * pulling;
        this.net.scale.setScalar(1 - Math.min(0.25, (this.t / this.netDur) * 0.25));
        if (this.zzz) {
          this.zzz.position.set(this.pos.x + Math.sin(time * 2) * 0.4, this.pos.y + 4.4 + ((time * 0.8) % 1) * 0.8, this.pos.z);
          (this.zzz.material as THREE.SpriteMaterial).opacity = 1 - ((time * 0.8) % 1);
        }
        if (this.t >= this.netDur) {
          this.net.visible = false;
          this.net.scale.setScalar(1);
          this.m.group.rotation.z = 0;
          this.c.addEffect(puffEffect(this.root, this.pos.clone().add(V(0, 1.8, 0)), 'rgba(103,232,249,0.9)', 4, 0.4));
          this.c.say(this.asleep ? '¡El Rey Gnomo despertó!' : pulling ? '¡Los gnomos le quitaron la red al rey!' : '¡El Rey Gnomo rompió la red!', 'gnome-free', 2);
          this.wake();
          this.state = 'recover';
          this.t = 0;
          this.dismissMinions();
        }
        break;
      }
    }
    if (this.state !== 'aim') this.handNet.visible = false;
    const h = this.s.half - 2;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -h, h);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -h, h);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.center.copy(this.pos).add(V(0, 1.7, 0));

    // The net around a trapped player
    if (this.playerNet) {
      if (!this.c.grab) this.freePlayerNet();
      else this.playerNet.position.set(this.trapPos.x, this.trapPos.y + 0.9, this.trapPos.z);
    }
    this.updateMinions(dt, time);
  }

  /** The king throws the net he picked up at the cyan circle. */
  private throwNet() {
    if (this.dead || this.state !== 'aim') return;
    this.handNet.visible = false;
    this.state = 'recover';
    this.t = 0;
    this.netCd = 10 - 3 * this.s.diff;
    const from = this.pos.clone().add(V(0, 4, 0));
    const to = this.aimAt.clone();
    const flying = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 18),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    flying.rotation.x = -Math.PI / 2;
    this.root.add(flying);
    this.c.addEffect({
      obj: flying,
      t: 0,
      dur: 0.45,
      tick: (k) => {
        flying.position.lerpVectors(from, to, k);
        flying.position.y += Math.sin(Math.PI * k) * 2.5 + 0.3;
        flying.scale.setScalar(0.4 + 0.6 * k);
        flying.rotation.z += 0.3;
      },
    });
    // Landing check right when it arrives
    this.c.addEffect({
      obj: new THREE.Object3D(),
      t: 0,
      dur: 0.46,
      tick: (k) => {
        if (k < 1 || this.dead) return;
        const p = this.c.playerPos;
        if (Math.hypot(p.x - to.x, p.z - to.z) < 2.0 && Math.abs(p.y - to.y) < 2.2) this.trapPlayer();
        else this.c.addEffect(puffEffect(this.root, to.clone().add(V(0, 0.3, 0)), 'rgba(103,232,249,0.7)', 2.5, 0.4));
      },
    });
  }

  private trapPlayer() {
    const p = this.c.physics.position;
    this.trapPos.set(p.x, p.y - 0.9, p.z);
    const need = 6 + Math.round(3 * this.s.diff);
    const ok = this.c.grabPlayer({ pos: this.trapPos, onRelease: () => this.freePlayerNet() }, need);
    if (!ok) return;
    this.playerNet = makeNetWrap(0.75, 1.9);
    this.playerNet.position.set(this.trapPos.x, this.trapPos.y + 0.9, this.trapPos.z);
    this.root.add(this.playerNet);
    soundManager.playEnemyBonk();
    this.c.say('¡Te atrapó con la red! Pulsa saltar muchas veces para romperla', 'gnome-trap', 2);
  }

  private freePlayerNet() {
    if (!this.playerNet) return;
    this.root.remove(this.playerNet);
    this.playerNet.geometry.dispose();
    this.playerNet = null;
    this.c.addEffect(puffEffect(this.root, this.trapPos.clone().add(V(0, 1.2, 0)), 'rgba(103,232,249,0.9)', 3, 0.4));
  }

  private impact(at: THREE.Vector3, radius: number) {
    this.c.strike(at, radius, 22, 12, 7, 'quake');
    this.c.shockwave(at, 8 + 4 * this.s.diff, 10, 12, 0xfacc15, 0.9, 'quake');
    soundManager.playWoodRattle();
    this.c.addEffect(puffEffect(this.root, at.clone().add(V(0, 0.4, 0)), 'rgba(161,98,7,0.8)', 4, 0.5));
  }

  private netKing(local: boolean, dur?: number) {
    if (this.dead || this.state === 'netted') return;
    this.netDur = dur ?? 6.5 - this.s.diff;
    if (local) this.c.deps.send('stun', 0, this.netDur);
    this.state = 'netted';
    this.t = 0;
    this.wake();
    this.handNet.visible = false;
    this.clearPending();
    this.net.visible = true;
    this.net.scale.setScalar(1);
    if (this.pos.y > this.s.floorY) this.pos.y = this.s.floorY;
    this.callMinions();
    this.c.say('¡Atrapado! Salen gnomos a protegerlo: pégales a los que le quitan la red', 'gnome-net', 2);
  }

  /** Lila's spell: he falls asleep for a few seconds (nobody comes to wake him). */
  private sleepKing(dur: number, local: boolean) {
    if (this.dead || this.state === 'netted') return;
    if (local) this.c.deps.send('stun', 1, dur);
    this.state = 'netted';
    this.t = 0;
    this.netDur = dur;
    this.asleep = true;
    this.handNet.visible = false;
    this.clearPending();
    if (this.pos.y > this.s.floorY) this.pos.y = this.s.floorY;
    if (!this.zzz) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 64;
      const g = c.getContext('2d');
      if (g) {
        g.font = 'bold 44px sans-serif';
        g.fillStyle = '#e0f2fe';
        g.strokeStyle = '#1e3a8a';
        g.lineWidth = 6;
        g.strokeText('Zzz', 10, 48);
        g.fillText('Zzz', 10, 48);
      }
      const tex = new THREE.CanvasTexture(c);
      this.zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      this.zzz.scale.set(1.6, 0.8, 1);
      this.root.add(this.zzz);
    }
    this.zzz.visible = true;
    this.c.say('¡El Rey Gnomo se durmió! Golpéalo', 'gnome-sleep', 1);
  }

  private wake() {
    this.asleep = false;
    if (this.zzz) this.zzz.visible = false;
  }

  /** Warriors defend the king; helpers run to him and pull the net off. */
  private callMinions() {
    const warriors = this.scaled(1 + Math.round(2 * this.s.diff), 1);
    const helpers = this.scaled(2, 1);
    const total = warriors + helpers;
    for (let k = 0; k < total; k++) {
      const kind: Minion['kind'] = k < warriors ? 'warrior' : 'helper';
      const a = (k / total) * Math.PI * 2 + Math.random() * 0.4;
      const r = kind === 'warrior' ? 4.5 : 6.5;
      const h = this.s.half - 2;
      const pos = V(
        THREE.MathUtils.clamp(this.pos.x + Math.cos(a) * r, -h, h),
        this.s.floorY,
        THREE.MathUtils.clamp(this.pos.z + Math.sin(a) * r, -h, h)
      );
      const m = createGnomeMinion(kind);
      m.group.position.set(pos.x, pos.y - 1.2, pos.z);
      this.root.add(m.group);
      this.minions.push({ kind, m, pos, yaw: 0, state: 'rise', t: 0, cd: 0.8, center: pos.clone() });
      this.c.addEffect(puffEffect(this.root, pos.clone().add(V(0, 0.3, 0)), 'rgba(120,83,48,0.8)', 1.6, 0.4));
    }
    soundManager.playWoodRattle();
  }

  private dismissMinions() {
    for (const mi of this.minions) {
      if (mi.state === 'sink') continue;
      mi.state = 'sink';
      mi.t = 0;
    }
  }

  private poof(mi: Minion) {
    if (mi.state === 'sink') return;
    mi.state = 'sink';
    mi.t = 0.6; // skips most of the sink: it vanishes in a puff
    mi.m.group.visible = false;
    this.c.addEffect(burstEffect(this.root, mi.center.clone(), this.minionMat, 8, 0.12, 4, 0.7));
    this.c.addEffect(puffEffect(this.root, mi.center.clone(), 'rgba(255,255,255,0.9)', 1.8, 0.35));
    soundManager.playEnemyBoop();
  }

  private updateMinions(dt: number, time: number) {
    const p = this.c.playerPos;
    const floor = this.s.floorY;
    for (let k = this.minions.length - 1; k >= 0; k--) {
      const mi = this.minions[k];
      mi.t += dt;
      const g = mi.m.group;
      if (mi.state === 'sink') {
        g.position.y -= dt * 2.5;
        if (mi.t > 1) {
          disposeGroup(this.root, g);
          this.minions.splice(k, 1);
        }
        continue;
      }
      if (mi.state !== 'rise' && this.guarding(mi.pos)) {
        this.poof(mi);
        this.c.say('¡Quetsy se comió un gnomo!', 'jade-gnome', 2);
        continue;
      }
      if (mi.state === 'rise') {
        mi.pos.y = floor - 1.2 * (1 - Math.min(1, mi.t / 0.6));
        if (mi.t >= 0.6) {
          mi.state = 'go';
          mi.pos.y = floor;
        }
      } else {
        const target = mi.kind === 'helper' ? this.pos : p;
        const dx = target.x - mi.pos.x;
        const dz = target.z - mi.pos.z;
        const dist = Math.hypot(dx, dz) || 1;
        mi.yaw = turnTo(mi.yaw, Math.atan2(dx, dz), 8, dt);
        const reach = mi.kind === 'helper' ? 1.9 : 1.0;
        if (dist > reach) {
          const speed = mi.kind === 'helper' ? 3.4 : 3.0 + 1.2 * this.s.diff;
          mi.pos.x += (dx / dist) * speed * dt;
          mi.pos.z += (dz / dist) * speed * dt;
          mi.state = 'go';
        } else {
          mi.state = 'act';
        }
        mi.cd -= dt;
        if (mi.kind === 'warrior' && mi.state === 'act' && mi.cd <= 0 && Math.abs(p.y - mi.pos.y) < 1.6) {
          mi.cd = 1.3 - 0.4 * this.s.diff;
          this.c.damagePlayer(8, mi.pos, 7, 4);
        }
      }
      // Animations
      const walk = mi.state === 'go' || mi.state === 'rise';
      mi.m.feet.forEach((f, i) => (f.position.z = 0.03 + (walk ? Math.sin(time * 14 + i * Math.PI) * 0.07 : 0)));
      if (mi.kind === 'helper' && mi.state === 'act') {
        // Tugging at the net: lean back, arms pulling
        const tug = Math.sin(time * 10 + k);
        mi.m.inner.rotation.x = -0.35 + tug * 0.12;
        mi.m.arms[0].rotation.x = -1.4 + tug * 0.5;
        mi.m.arms[1].rotation.x = -1.4 - tug * 0.5;
      } else if (mi.kind === 'warrior' && mi.m.spear) {
        mi.m.inner.rotation.x = 0;
        mi.m.spear.position.z = 0.05 + (mi.state === 'act' && mi.cd > 0.9 ? 0.25 : 0);
      } else {
        mi.m.inner.rotation.x = 0;
      }
      g.position.set(mi.pos.x, mi.pos.y + (walk ? Math.abs(Math.sin(time * 14)) * 0.05 : 0), mi.pos.z);
      g.rotation.y = mi.yaw;
      mi.center.copy(mi.pos).add(V(0, 0.55, 0));
    }
  }

  targets(out: AimTarget[]) {
    for (const mi of this.minions) {
      if (mi.state === 'sink') continue;
      out.push({
        pos: mi.center,
        radius: 0.6,
        accepts: ['bate', 'piedra', 'stomp'],
        top: mi.pos.y + 1.25,
        priority: mi.kind === 'helper' ? 1.2 : 0.8,
        hit: () => this.poof(mi),
      });
    }
    if (this.dead) return;
    out.push({
      pos: this.center,
      radius: 1.6,
      accepts: ['red', 'bate', 'piedra', 'stomp'],
      top: this.pos.y + 3.3,
      hit: (kind) => {
        if (kind === 'red') {
          if (this.state === 'netted') this.c.say('Ya está atrapado: ¡golpéalo!', 'gnome-already', 2);
          else this.netKing(true);
          return;
        }
        if (this.state !== 'netted') {
          this.c.say('¡Su corona lo protege! Atrápalo primero con la red', 'crown', 3);
          return;
        }
        if (this.hitCd > 0) return;
        this.hitCd = 0.25;
        this.c.damageBoss(kind === 'bate' ? 18 : kind === 'stomp' ? 14 : kind === 'piedra' ? 5 : 8);
      },
    });
  }

  onEvent(kind: string, i: number, v: number) {
    if (kind === 'stun') {
      if (i === 1) this.sleepKing(v > 0 ? v : 4.5, false);
      else this.netKing(false, v > 0 ? v : undefined);
    }
  }

  companionAction(c: CompanionStyle): CompanionAction | null {
    const king = () => this.center;
    const me = () => this.c.playerPos;
    switch (c) {
      case 'nube':
        return {
          name: 'Charco',
          desc: 'Llueve bajo el rey: se resbala, camina lento y no salta por 10 s',
          target: king,
          run: () => {
            this.slowT = 10;
            this.c.addEffect(puffEffect(this.root, this.pos.clone().add(V(0, 0.3, 0)), 'rgba(125,211,252,0.85)', 4, 0.6));
          },
        };
      case 'estrella':
        return {
          name: 'Red estelar',
          desc: 'Te da una red nueva (4 usos)',
          target: me,
          run: () => this.gift('red'),
        };
      case 'luciernaga':
        return {
          name: 'Luciérnagas',
          desc: 'Deslumbra a los gnomos guerreros y ayudantes: desaparecen',
          target: king,
          run: () => {
            for (const mi of this.minions) this.poof(mi);
          },
        };
      case 'catarina':
        return {
          name: 'Rebote',
          desc: 'Los golpes del mazo y sus ondas no te hacen daño por 12 s',
          target: me,
          run: () => this.c.immunity('quake', 12),
        };
      case 'hada':
        return {
          name: 'Hechizo de sueño',
          desc: 'El Rey Gnomo se duerme 4 s: ¡golpéalo!',
          target: king,
          run: () => {
            if (this.state === 'netted') this.c.say('Ya está atrapado: ¡golpéalo!', 'gnome-already', 1);
            else this.sleepKing(4.5, true);
          },
        };
      case 'serpiente':
        return {
          name: 'Guardiana',
          desc: 'Quetsy se come a los gnomos que se te acercan por 12 s',
          target: me,
          run: () => {
            this.c.guardT = 12;
          },
        };
      default:
        return null;
    }
  }

  hint(): string {
    const g = this.c.grab;
    if (g && this.playerNet) return `¡Estás atrapado en la red! Pulsa saltar muchas veces (${g.count}/${g.need})`;
    if (this.state === 'netted') {
      const helpers = this.minions.some((mi) => mi.kind === 'helper' && mi.state !== 'sink');
      return helpers
        ? '¡Atrapado! Pégales a los gnomos que le quitan la red y luego golpea al rey'
        : '¡Atrapado! Golpéalo con el bate, piedras o cayéndole encima';
    }
    if (this.state === 'fetch' || this.state === 'aim') return '¡El rey tiene una red! Sal del círculo celeste antes de que la lance';
    if (!this.has('red')) return 'Toma una red antes que el rey: si la agarra él, te la lanza a ti';
    return 'Lánzale la red al Rey Gnomo (objetivo marcado) · salta las ondas del mazo';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    this.net.visible = false;
    this.handNet.visible = false;
    this.wake();
    this.dismissMinions();
    if (this.playerNet && this.c.grab) this.c.releaseGrab('other');
    if (instant) this.group.visible = false;
  }

  dispose() {
    for (const mi of this.minions) disposeGroup(this.root, mi.m.group);
    this.minions = [];
    this.freePlayerNet();
    this.root.remove(this.handNet);
    if (this.zzz) this.root.remove(this.zzz);
    super.dispose();
  }
}

// ===========================================================================
// 6. CONDE DRÁCULA
// ===========================================================================
interface ShadowHands {
  m: ShadowHandsModel;
  pos: THREE.Vector3;
  t: number;
  phase: 'warn' | 'rise' | 'hold' | 'sink';
  /** Someone else's hands (party): only shown */
  visual: boolean;
  squeeze: number;
}

class DraculaBoss extends BossController {
  private m: DraculaModel;
  /** Seconds spent in the dark (far from lit candelabra) */
  private darkT = 0;
  private hands: ShadowHands[] = [];
  /** Nubi's moonlight: no darkness while it lasts */
  private moonT = 0;
  private candles: CandelabraModel[] = [];
  private state: 'intro' | 'dark' | 'weak' | 'rise' = 'intro';
  private t = 3.5;
  private pos: THREE.Vector3;
  private orbit = 0;
  private swoopT = 3;
  private swoopWarn = -1;
  private swoop: { from: THREE.Vector3; to: THREE.Vector3; t: number; hit: boolean } | null = null;
  private hitCd = 0;
  private yaw = 0;
  private center = V();

  constructor(c: CombatSystem) {
    super(c, 100 + 40 * c.setup.diff);
    this.m = createDracula();
    this.group.add(this.m.group);
    this.pos = this.s.home.clone();
    this.group.position.copy(this.pos);
    for (const at of this.s.candelabra) {
      const cm = createCandelabra();
      cm.group.position.copy(at);
      this.root.add(cm.group);
      this.candles.push(cm);
    }
  }

  private litCount() {
    return this.candles.filter((c) => c.lit).length;
  }

  update(dt: number, time: number) {
    this.applyPulse(dt);
    this.updatePending(dt);
    this.hitCd -= dt;
    const p = this.c.playerPos;
    const floor = this.s.floorY;
    const flap = Math.sin(time * (this.state === 'weak' ? 2 : 9)) * 0.5;
    this.m.wings[0].rotation.y = flap;
    this.m.wings[1].rotation.y = -flap;
    this.m.cape.rotation.y = Math.sin(time * 2) * 0.1;
    for (const cm of this.candles) {
      if (!cm.lit) continue;
      for (const f of cm.flames) f.scale.setScalar(1 + Math.sin(time * 18 + f.position.x * 7) * 0.12);
    }

    if (this.dead) {
      this.deadT += dt;
      this.c.darknessTarget = 0;
      this.m.group.rotation.y += dt * (4 + this.deadT * 6);
      this.pos.y += dt * 2;
      this.m.group.scale.setScalar(Math.max(0.01, 1 - this.deadT / 2.2));
      this.group.position.copy(this.pos);
      if (this.deadT > 2.2 && this.group.visible) {
        this.group.visible = false;
        this.c.addEffect(burstEffect(this.root, this.pos.clone(), new THREE.MeshStandardMaterial({ color: 0x1f1029 }), 18, 0.3, 7, 1.3));
      }
      this.updateHands(dt, time);
      return;
    }

    this.t -= dt;
    switch (this.state) {
      case 'intro':
        this.c.darknessTarget = 0;
        this.hover(this.s.home, dt, time);
        if (this.t <= 0) this.enterDark(true);
        break;
      case 'dark': {
        this.moonT = Math.max(0, this.moonT - dt);
        this.c.darknessTarget = this.moonT > 0 ? 0.1 : 1 - 0.17 * this.litCount();
        if (this.swoop) {
          this.swoop.t += dt / 0.9;
          const k = Math.min(1, this.swoop.t);
          this.pos.lerpVectors(this.swoop.from, this.swoop.to, ease(k));
          this.yaw = Math.atan2(this.swoop.to.x - this.swoop.from.x, this.swoop.to.z - this.swoop.from.z);
          if (!this.swoop.hit && this.pos.distanceTo(V(p.x, p.y + 1, p.z)) < 1.5) {
            this.swoop.hit = true;
            this.c.damagePlayer(15, this.pos, 11, 6, 'swoop');
          }
          if (k >= 1) this.swoop = null;
        } else if (this.swoopWarn >= 0) {
          this.swoopWarn -= dt;
          this.m.eyes.color.setRGB(1, 0.6 + Math.sin(time * 30) * 0.4, 0.6);
          this.yaw = turnTo(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), 6, dt);
          if (this.swoopWarn < 0) {
            this.m.eyes.color.set(0xff1f3d);
            const to = V(p.x, p.y + 1, p.z);
            const dir = to.clone().sub(this.pos).setY(0).normalize();
            to.addScaledVector(dir, 4);
            this.swoop = { from: this.pos.clone(), to, t: 0, hit: false };
            soundManager.playWindGust();
          }
        } else {
          this.orbit += dt * 0.45;
          this.hover(V(Math.cos(this.orbit) * 9, floor + 4.5, -2 + Math.sin(this.orbit) * 9), dt, time);
          this.swoopT -= dt;
          if (this.swoopT <= 0) {
            this.swoopWarn = 0.8;
            soundManager.playStalkerWarning();
            this.swoopT = 4.2 - 1.4 * this.s.diff;
          }
        }
        // Torches light the candelabra (each torch lights two, then it burns out)
        if (this.has('antorcha')) {
          this.candles.forEach((cm, i) => {
            if (cm.lit || !this.has('antorcha')) return;
            const at = cm.group.position;
            if (Math.hypot(p.x - at.x, p.z - at.z) < 2.4 && Math.abs(p.y - at.y) < 2.5) {
              this.light(i, true);
              this.c.deps.items.wear('antorcha');
            }
          });
        }
        this.updateDarkness(dt);
        break;
      }
      case 'weak': {
        this.c.darknessTarget = 0;
        this.pos.y = THREE.MathUtils.damp(this.pos.y, floor, 6, dt);
        this.m.group.rotation.z = Math.sin(time * 3) * 0.25;
        if (this.t <= 0) {
          this.state = 'rise';
          this.t = 1.4;
          this.m.group.rotation.z = 0;
          this.c.say('¡Drácula se recupera!', 'drac-rise', 2);
        }
        break;
      }
      case 'rise':
        this.hover(V(this.pos.x, floor + 4.5, this.pos.z), dt, time);
        if (this.t <= 0) this.enterDark(false);
        break;
    }
    if (!this.swoop && this.state !== 'weak') this.yaw = turnTo(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), 3, dt);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.center.copy(this.pos).add(V(0, 1.4, 0));
    if (this.state !== 'dark') {
      this.darkT = 0;
      this.releaseHands();
    }
    this.updateHands(dt, time);
  }

  /** Too long far from the light: shadow hands come out of the floor under you. */
  private updateDarkness(dt: number) {
    const p = this.c.playerPos;
    if (this.c.grab || this.c.isDown || this.hands.some((h) => !h.visual && h.phase !== 'sink')) return;
    if (this.moonT > 0 || this.c.isImmune('hands')) {
      this.darkT = 0;
      return;
    }
    const nearLight = this.candles.some((cm) => cm.lit && Math.hypot(p.x - cm.group.position.x, p.z - cm.group.position.z) < 7.5);
    if (nearLight) {
      this.darkT = Math.max(0, this.darkT - dt * 2);
      return;
    }
    // The torch keeps them away a bit longer
    this.darkT += dt * (this.has('antorcha') ? 0.5 : 1);
    const limit = 8 - 2 * this.s.diff;
    if (this.darkT > limit * 0.6) this.c.say('Las sombras se acercan… ¡ve a la luz de un candelabro!', 'drac-shadows', 6);
    if (this.darkT >= limit) {
      this.darkT = limit * 0.4;
      const at = this.groundAt(0.3);
      this.spawnHands(at, false);
      this.c.deps.send('hands', 0, 1);
    }
  }

  private spawnHands(at: THREE.Vector3, visual: boolean) {
    const m = createShadowHands();
    m.group.position.copy(at);
    for (const a of m.arms) a.pivot.position.y = -1.9;
    this.root.add(m.group);
    this.hands.push({ m, pos: at.clone(), t: 0, phase: 'warn', visual, squeeze: 1 });
    if (!visual) soundManager.playStalkerWarning();
  }

  private releaseHands() {
    for (const h of this.hands) {
      if (h.phase === 'hold' && !h.visual && this.c.grab) this.c.releaseGrab('other');
      if (h.phase !== 'sink') {
        h.phase = 'sink';
        h.t = 0;
      }
    }
  }

  private updateHands(dt: number, time: number) {
    const p = this.c.playerPos;
    for (let k = this.hands.length - 1; k >= 0; k--) {
      const h = this.hands[k];
      h.t += dt;
      const arms = h.m.arms;
      (h.m.puddle.material as THREE.MeshBasicMaterial).opacity = h.phase === 'sink' ? Math.max(0, 0.85 - h.t) : Math.min(0.85, h.t * 1.5);
      if (h.phase === 'warn') {
        // The puddle spreads for a moment: time to run
        h.m.puddle.scale.setScalar(0.4 + Math.min(1, h.t / 0.9) * 0.6);
        if (h.t >= 0.9) {
          h.phase = 'rise';
          h.t = 0;
        }
      } else if (h.phase === 'rise') {
        const k2 = Math.min(1, h.t / 0.35);
        for (const a of arms) a.pivot.position.y = -1.9 * (1 - k2);
        if (k2 >= 1) {
          if (!h.visual && !this.c.isImmune('hands') && Math.hypot(p.x - h.pos.x, p.z - h.pos.z) < 1.6 && Math.abs(p.y - h.pos.y) < 1.5) {
            const need = 6 + Math.round(3 * this.s.diff);
            const ok = this.c.grabPlayer(
              {
                pos: h.pos,
                onRelease: () => {
                  if (h.phase !== 'sink') {
                    h.phase = 'sink';
                    h.t = 0;
                  }
                  this.darkT = 0;
                },
              },
              need
            );
            if (ok) {
              h.phase = 'hold';
              h.t = 0;
              this.c.say('¡Las manos de sombra te atraparon! Pulsa saltar para soltarte', 'drac-hands', 2);
              continue;
            }
          }
          h.phase = h.visual ? 'hold' : 'sink';
          h.t = 0;
        }
      } else if (h.phase === 'hold') {
        // Squeezes a little while you're caught
        if (!h.visual) {
          if (!this.c.grab) {
            h.phase = 'sink';
            h.t = 0;
          } else {
            h.squeeze -= dt;
            if (h.squeeze <= 0) {
              h.squeeze = 1.3;
              this.c.invuln = 0;
              this.c.damagePlayer(6, null, 0, 0);
            }
          }
        } else if (h.t > 2.5) {
          h.phase = 'sink';
          h.t = 0;
        }
      } else if (h.phase === 'sink') {
        for (const a of arms) a.pivot.position.y = -1.9 * Math.min(1, h.t / 0.5);
        if (h.t > 0.9) {
          disposeGroup(this.root, h.m.group);
          this.hands.splice(k, 1);
          continue;
        }
      }
      // Arms lean in and fingers curl around the player
      const grip = h.phase === 'hold' ? 1 : 0;
      arms.forEach((a, i) => {
        a.pivot.rotation.x = -0.35 - grip * 0.35 + Math.sin(time * 6 + i) * 0.08;
        a.hand.rotation.x = -0.3 - grip * 0.9 + Math.sin(time * 9 + i * 2) * 0.1;
      });
    }
  }

  private hover(target: THREE.Vector3, dt: number, time: number) {
    this.pos.x = THREE.MathUtils.damp(this.pos.x, target.x, 2, dt);
    this.pos.y = THREE.MathUtils.damp(this.pos.y, target.y + Math.sin(time * 2) * 0.3, 2, dt);
    this.pos.z = THREE.MathUtils.damp(this.pos.z, target.z, 2, dt);
  }

  private enterDark(first: boolean) {
    this.state = 'dark';
    this.swoopT = 3;
    this.candles.forEach((cm) => cm.setLit(false));
    soundManager.playStalkerWarning();
    this.c.say(first ? '¡Drácula apagó las luces! Prende los candelabros con una antorcha' : '¡Drácula apagó los candelabros otra vez!', 'drac-dark', 2);
  }

  private light(i: number, local: boolean) {
    const cm = this.candles[i];
    if (!cm || cm.lit || this.state !== 'dark') return;
    cm.setLit(true);
    if (local) this.c.deps.send('light', i);
    soundManager.playCheckpoint();
    this.c.addEffect(puffEffect(this.root, cm.group.position.clone().add(V(0, 2.8, 0)), 'rgba(251,146,60,0.95)', 3, 0.5));
    const n = this.litCount();
    if (n >= this.candles.length) {
      this.state = 'weak';
      this.t = 7.5 - 1.5 * this.s.diff;
      this.swoop = null;
      this.swoopWarn = -1;
      this.c.say('¡Drácula cayó debilitado! ¡Golpéalo!', 'drac-weak', 2);
    } else {
      this.c.say(`¡Candelabro encendido! (${n}/${this.candles.length})`, `drac-lit-${n}`, 1);
    }
  }

  targets(out: AimTarget[]) {
    if (this.dead) return;
    out.push({
      pos: this.center,
      radius: 1.4,
      accepts: ['bate', 'piedra', 'stomp'],
      top: this.pos.y + 2.9,
      hit: (kind) => {
        if (this.state !== 'weak') {
          this.c.say('La oscuridad lo protege: prende los 4 candelabros', 'drac-immune', 3);
          return;
        }
        if (this.hitCd > 0) return;
        this.hitCd = 0.25;
        this.c.damageBoss(kind === 'bate' ? 20 : kind === 'stomp' ? 15 : 6);
      },
    });
  }

  companionAction(c: CompanionStyle): CompanionAction | null {
    const drac = () => this.center;
    const me = () => this.c.playerPos;
    switch (c) {
      case 'nube':
        return {
          name: 'Claro de luna',
          desc: 'La nube se abre y entra la luna: no hay oscuridad ni manos por 10 s',
          target: drac,
          run: () => {
            this.moonT = 10;
            this.darkT = 0;
          },
        };
      case 'estrella':
        return {
          name: 'Estrella guía',
          desc: 'Prende el candelabro apagado más cercano',
          target: () => {
            const i = this.nearestUnlit();
            return i >= 0 ? this.candles[i].group.position : me();
          },
          run: () => {
            const i = this.nearestUnlit();
            if (i >= 0 && this.state === 'dark') this.light(i, true);
            else this.c.say('No hay candelabros que prender ahora', 'act-candle', 1);
          },
        };
      case 'luciernaga':
        return {
          name: 'Linterna viva',
          desc: 'Te da una antorcha nueva (o recarga la tuya)',
          target: me,
          run: () => this.gift('antorcha'),
        };
      case 'catarina':
        return {
          name: 'Ala protectora',
          desc: 'Las picadas de Drácula no te hacen daño por 12 s',
          target: me,
          run: () => this.c.immunity('swoop', 12),
        };
      case 'hada':
        return {
          name: 'Polvo de hada',
          desc: 'Drácula estornuda y cae mareado unos segundos: ¡golpéalo!',
          target: drac,
          run: () => {
            if (this.state !== 'dark') {
              this.c.say('Ahora no tiene efecto', 'act-drac', 1);
              return;
            }
            this.state = 'weak';
            this.t = 3.5;
            this.swoop = null;
            this.swoopWarn = -1;
            this.c.say('¡Drácula cayó mareado! ¡Golpéalo!', 'drac-weak', 1);
          },
        };
      case 'serpiente':
        return {
          name: 'Muralla',
          desc: 'Quetsy te rodea: las manos de sombra no te agarran por 15 s',
          target: me,
          anytime: true,
          run: () => {
            if (this.c.grab && this.hands.some((h) => h.phase === 'hold' && !h.visual)) this.c.releaseGrab('friend');
            this.c.immunity('hands', 15);
            this.darkT = 0;
          },
        };
      default:
        return null;
    }
  }

  private nearestUnlit(): number {
    const p = this.c.playerPos;
    let best = -1;
    let bestD = Infinity;
    this.candles.forEach((cm, i) => {
      if (cm.lit) return;
      const d = Math.hypot(p.x - cm.group.position.x, p.z - cm.group.position.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  onEvent(kind: string, i: number, _v: number, from: string) {
    if (kind === 'light') this.light(i, false);
    else if (kind === 'hands' && this.state === 'dark') {
      // A friend got caught in the dark: show the hands under them
      const r = this.c.deps.remotes().find((x) => x.userId === from);
      if (r) this.spawnHands(V(r.pos.x, this.s.floorY, r.pos.z), true);
    }
  }

  hint(): string {
    const n = this.litCount();
    const g = this.c.grab;
    if (g) return `¡Las manos de sombra te tienen! Pulsa saltar muchas veces (${g.count}/${g.need})`;
    if (this.state === 'intro') return 'Drácula se acerca… toma una antorcha';
    if (this.state === 'weak') return '¡Está débil! Golpéalo ahora (bate, piedras o salto)';
    if (this.state === 'rise') return 'Drácula se recupera…';
    if (!this.has('antorcha')) return `Toma una antorcha: cada una prende 2 candelabros (${n}/${this.candles.length}) · no te quedes mucho en la oscuridad`;
    return `Acércate a los candelabros con la antorcha (${n}/${this.candles.length}) · quédate cerca de la luz y esquiva sus picadas`;
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    this.swoop = null;
    this.releaseHands();
    this.c.darknessTarget = 0;
    this.candles.forEach((cm) => cm.setLit(true));
    if (instant) this.group.visible = false;
  }

  dispose() {
    for (const cm of this.candles) disposeGroup(this.root, cm.group);
    for (const h of this.hands) disposeGroup(this.root, h.m.group);
    this.hands = [];
    super.dispose();
  }
}

// ===========================================================================
// 7. EL SKINWALKER (Backrooms)
// It hunts you through the yellow rooms. Only an obsidian skull scares it away, and only an
// obsidian dagger (single use) hurts it: scare it, find the dagger while it's gone, then let it
// come close and stab it. Sometimes it takes YOUR shape and walks toward you…
// ===========================================================================
/**
 * stalk: it follows its prey from a distance, out of sight · peek: it shows itself down a hall,
 * staring · feint: it rushes at you and stops short · call: it screams and copies crawl out of the
 * wall corners next to you · hunt: it stopped playing (the real attack: windup → lunge)
 */
type SkinState = 'intro' | 'hunt' | 'windup' | 'lunge' | 'recover' | 'scared' | 'hurt' | 'mimic' | 'tear' | 'stalk' | 'peek' | 'feint' | 'call' | 'escape' | 'gone' | 'arrive';
const SKIN_STATES: SkinState[] = ['intro', 'hunt', 'windup', 'lunge', 'recover', 'scared', 'hurt', 'mimic', 'tear', 'stalk', 'peek', 'feint', 'call', 'escape', 'gone', 'arrive'];
/** escape: it opens a portal in a wall or the floor and goes through · gone: away · arrive: it climbs out of a portal somewhere else */
const ESCAPE_T = 1.6;
const ARRIVE_T = 1.4;
/** First number of a boss snapshot from the party host (the rest of that channel is for spectators) */
export const BOSS_SYNC_MARK = -7777;
/** What the AI director (xAI, on the server) can tell a copy to do */
type CopyAct = 'follow' | 'lure' | 'stare' | 'hide' | 'whisper' | 'strike' | 'gather';

/**
 * A copy of a player that the Skinwalker sheds. Close up it twists into a tall, gaunt dog-man (a
 * werewolf) that still wears the player's clothes and colors; if you get far enough away, it
 * shrinks back into your friend's shape and tries to fool you again.
 */
interface SkinCopy {
  m: PlayerCharacterModel;
  holder: THREE.Group;
  /** Hunches the upper body forward (pivots at the hips) */
  pitch: THREE.Group;
  /** The werewolf parts, grown out of the character (same clothes/skin/hair materials) */
  wolf: {
    legs: THREE.Group[];
    snout: THREE.Group;
    ears: THREE.Group;
    fur: THREE.Group;
    headGroup: THREE.Object3D;
    feet: THREE.Object3D[];
    claws: THREE.Object3D[];
    /** Hips that join the body to the legs */
    pelvis: THREE.Mesh;
  };
  /** Seconds you've been far from it (it turns back into a copy) */
  lostT: number;
  /** Seconds it has been tagging along with you, pretending (it turns at the worst moment) */
  tailT: number;
  /** Number the AI director knows it by */
  id: number;
  /** What the AI director told it to do (null: the game's own rules) */
  order: { act: CopyAct; t: number; spot: THREE.Vector3 | null } | null;
  /** What it's saying, over its head */
  bubble: THREE.Sprite | null;
  bubbleT: number;
  pos: THREE.Vector3;
  center: THREE.Vector3;
  yaw: number;
  /** emerge: crawling out of a wall corner · merge: fusing with other copies into the Nahual */
  phase: 'copy' | 'distort' | 'hunt' | 'revert' | 'die' | 'emerge' | 'merge';
  /**
   * As a copy: wandering the maze like a player looking for the dagger (roam), pretending to be
   * your friend next to you (engaged), or walking to meet the other copies (gather)
   */
  mode: 'roam' | 'engaged' | 'gather';
  /** Where it's wandering to, and how long it stays there "searching" */
  roamTo: THREE.Vector3 | null;
  searchT: number;
  /** Coming out of a wall corner: the corner, which way is out, how far out it is, stuck for a moment */
  emerge: { base: THREE.Vector3; dir: THREE.Vector3; k: number; stall: number; dustT: number; rip: { slit: THREE.Mesh; flaps: THREE.Mesh[] } | null } | null;
  /** Fusing: where they all meet */
  mergeAt: THREE.Vector3 | null;
  t: number;
  hp: number;
  mats: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[];
  eyes: THREE.Mesh[];
  hitCd: number;
  /** Who it pretends to be */
  name: string;
  tag: THREE.Sprite;
}

/** El Nahual: what several copies become when they fuse (tall, pale, long arms) */
interface Nahual {
  m: NahualModel;
  pos: THREE.Vector3;
  center: THREE.Vector3;
  yaw: number;
  state: 'rise' | 'stalk' | 'charge' | 'swipe' | 'recover' | 'die';
  t: number;
  hp: number;
  /** It doesn't last: after a while it falls apart */
  life: number;
  hitCd: number;
  swiped: boolean;
  stride: number;
}

class SkinwalkerBoss extends BossController {
  private m: SkinwalkerModel;
  private state: SkinState = 'intro';
  private t = 3;
  private pos: THREE.Vector3;
  private yaw = Math.PI;
  private lungeDir = V();
  private lungeHit = false;
  private fleeTo = V();
  private mimicCd = 22;
  private voiceCd = 14;
  private hitCd = 0;
  private center = V();
  private beam: THREE.Mesh;
  private daggerAt: THREE.Vector3 | null = null;
  /** One dagger for the whole party: the n-th one lies in the same place for everybody */
  private daggerN = 0;
  /** Who carries it ('me', a friend's userId, or nobody) */
  private daggerHeldBy: string | null = null;
  private hadDagger = false;
  /** Seconds until the next dagger shows up after one was used */
  private daggerDelay = 0;
  /** Obsidian skulls floating over someone's head before the flash */
  private skulls: { g: THREE.Group; glow: THREE.Sprite; flash: THREE.Mesh | null; t: number; at: () => THREE.Vector3 | null; mine: boolean; flashed: boolean }[] = [];
  private copy: PlayerCharacterModel | null = null;
  /** Nubi's fog: it lost your trail */
  private fogT = 0;
  private copies: SkinCopy[] = [];
  private spawnT = 9;
  /** Head twitch: a sudden sideways snap of the head */
  private twitchT = 0;
  private twitchCd = 2;
  private twitchAng = 0;
  /** Scream: jaw wide open, head shaking */
  private screamT = 0;
  /** Running on all fours (when you're far) */
  private crawlK = 0;
  // ---- The more it's hurt, the more erratic it gets ----
  /** Bursting out of a wall: where, and the rip it leaves */
  private tearCd = 20;
  private tearAt: { pos: THREE.Vector3; normal: THREE.Vector3 } | null = null;
  private rips: { g: THREE.Group; slit: THREE.Mesh; flaps: THREE.Mesh[]; t: number }[] = [];
  /** Sudden sideways darts while it runs */
  private dartT = 0;
  private dartCd = 1;
  private dartSide = 1;
  /** The maze moves: at 75/50/25 % life, then every so often */
  private shiftsDone = 0;
  private shiftCd = 30;
  /** Blackouts when it has little life left */
  private lightT = 10;
  private lightsOff = false;
  // ---- Party: the host runs the Skinwalker and streams it, so everybody sees the same one ----
  /** When the last snapshot from the host arrived (performance.now) */
  private lastSync = -1e9;
  private syncPos = V();
  private syncYaw = 0;
  private syncCrawl = 0;
  /** A stab we did ourselves shows right away, until the host's answer arrives */
  private holdT = 0;
  private maskKey = '';
  /** Who it's after (host): null = the host's own player, else a friend's userId */
  private tgtId: string | null = null;
  private retargetT = 0;
  /** Friends hidden in Nubi's fog (host) */
  private fogBy = new Map<string, number>();
  /** How fast you walk, so a copy can tag along like a friend */
  private prevP = V();
  private pSpeed = 0;
  // ---- AI director (xAI): decides what each copy does, to make you paranoid ----
  private copyN = 0;
  private aiCd = 4;
  private aiBusy = false;
  /** No AI on this server (or you're not logged in): the game's own rules only */
  private aiOff = false;
  /** When the AI last answered (performance.now) */
  private aiLive = -1e9;
  /** What happened lately (the AI reads it) */
  private recent: { t: number; what: string }[] = [];
  private lastHp = -1;
  // ---- The hunter playing with its prey ----
  /** Where it lurks: close enough to watch, out of sight */
  private lurkTo: THREE.Vector3 | null = null;
  private lurkT = 0;
  /** Until its next "game" (show itself, fake a charge, call the copies) */
  private playT = 7;
  /** Grows while it plays; when it's full, it stops playing and really attacks */
  private huntUrge = 0;
  private callCd = 22;
  private feintStop = false;
  private peekStanding = false;
  private prevPos = V();
  private moveK = 0;
  // ---- Escaping through a portal (instead of running away) ----
  /** Where the portal opened (normal 0,0,0 = in the floor) */
  private portalAt: { pos: THREE.Vector3; normal: THREE.Vector3 } | null = null;
  private portals: { g: THREE.Group; k: number; open: boolean; rings: THREE.Mesh[] }[] = [];
  private curPortal: { g: THREE.Group; k: number; open: boolean; rings: THREE.Mesh[] } | null = null;
  private escapeAway = 0;
  /** How far it has sunk into the floor (portal) */
  private sinkY = 0;
  // ---- Copies that fuse into the Nahual ----
  private nahuales: Nahual[] = [];
  private gatherAt: THREE.Vector3 | null = null;
  private gatherCd = 40;
  private gatherT = 0;

  constructor(c: CombatSystem) {
    super(c, 100 + 40 * c.setup.diff);
    this.m = createSkinwalker();
    this.group.add(this.m.group);
    this.pos = this.s.home.clone();
    this.group.position.copy(this.pos);
    // Faint violet beam over the dagger, so you can find it in the dim rooms
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.12, 4.2, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.35, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    this.beam.renderOrder = 5;
    this.beam.visible = false;
    this.root.add(this.beam);
  }

  /** 0 → 1: how hurt (and how erratic) it is */
  private get rage() {
    return THREE.MathUtils.clamp(1 - this.hp / this.maxHp, 0, 1);
  }

  private get speed() {
    return (4.9 + 1.8 * this.s.diff) * (1 + 0.35 * this.rage);
  }

  /** You're in the same room (or the next one, through an opening) */
  private sameArea(at: THREE.Vector3): boolean {
    return !this.s.cellDist || this.s.cellDist(at, this.c.playerPos) <= 1;
  }

  private dist(): number {
    const p = this.c.playerPos;
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  private get inParty(): boolean {
    return this.c.deps.remotes().length > 0;
  }

  /** Somebody else in the party runs the Skinwalker: we only show what the host sends */
  private get following(): boolean {
    return this.inParty && !this.c.deps.isHost() && performance.now() - this.lastSync < 1500;
  }

  /** Who it hunts (host or alone): the nearest player that is up and not hidden in Nubi's fog. */
  private target(dt: number): { id: string | null; pos: THREE.Vector3; down: boolean; fog: number } {
    const cands: { id: string | null; pos: THREE.Vector3; down: boolean; fog: number }[] = [{ id: null, pos: this.c.playerPos, down: this.c.isDown, fog: this.fogT }];
    for (const r of this.c.deps.remotes()) cands.push({ id: r.userId, pos: r.pos, down: r.down, fog: this.fogBy.get(r.userId) ?? 0 });
    let cur = cands.find((c) => c.id === this.tgtId);
    this.retargetT -= dt;
    if (!cur || this.retargetT <= 0 || cur.down) {
      this.retargetT = 1.2;
      let best = cands[0];
      let bestScore = Infinity;
      for (const c of cands) {
        const e = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
        let sc = this.s.cellDist ? this.s.cellDist(this.pos, c.pos) + e * 0.01 : e / 6;
        if (c.down) sc += 1000;
        if (c.fog > 0) sc += 500;
        // sticks to who it's chasing unless someone else is clearly closer
        if (c.id === this.tgtId) sc -= 0.6;
        if (sc < bestScore) {
          bestScore = sc;
          best = c;
        }
      }
      this.tgtId = best.id;
      cur = best;
    }
    return cur;
  }

  /** Walk through the maze (room by room), sliding along the walls. */
  private walk(target: THREE.Vector3, speed: number, dt: number) {
    const goal = this.s.navStep ? this.s.navStep(this.pos, target) : target;
    const dx = goal.x - this.pos.x;
    const dz = goal.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const step = Math.min(d, speed * dt);
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), 8, dt);
    }
    this.collide();
  }

  private collide() {
    const R = 0.55;
    for (const o of this.s.obstacles ?? []) {
      const cx = THREE.MathUtils.clamp(this.pos.x, o.x - o.hx, o.x + o.hx);
      const cz = THREE.MathUtils.clamp(this.pos.z, o.z - o.hz, o.z + o.hz);
      const ex = this.pos.x - cx;
      const ez = this.pos.z - cz;
      const e = Math.hypot(ex, ez);
      if (e < R) {
        if (e > 1e-4) {
          this.pos.x = cx + (ex / e) * R;
          this.pos.z = cz + (ez / e) * R;
        } else {
          this.pos.x += R;
        }
      }
    }
    const h = this.s.half - 1;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -h, h);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -h, h);
  }

  /**
   * The dagger lies somewhere in the maze: only one for the whole party at a time (nobody gets
   * a new one until it's used). The n-th dagger is in the same place for everybody.
   */
  private ensureDagger() {
    const items = this.c.deps.items;
    if (this.has('daga') || items.isLyingAround('daga') || this.daggerDelay > 0) return;
    if (this.daggerHeldBy && this.daggerHeldBy !== 'me') {
      // A friend carries it… unless they left the party
      if (this.c.deps.remotes().some((r) => r.userId === this.daggerHeldBy)) return;
      this.daggerHeldBy = null;
    }
    const spots = this.s.searchSpots ?? [];
    if (!spots.length) return;
    const h = Math.abs(Math.sin((this.s.level * 31 + this.daggerN * 7919) * 12.9898) * 43758.5453) % 1;
    const at = spots[Math.floor(h * spots.length)];
    items.spawnDrop('daga', V(at.x, this.s.floorY + 0.95, at.z));
    this.daggerAt = at.clone();
  }

  /** Keeps the one dagger in sync with the party (who took it, when it was used). */
  private trackDagger(dt: number) {
    const hasD = this.has('daga');
    if (hasD && !this.hadDagger) {
      this.daggerHeldBy = 'me';
      this.daggerAt = null;
      this.c.deps.send('dagtake', this.daggerN);
    } else if (!hasD && this.hadDagger && this.daggerHeldBy === 'me') {
      // Lost it without using it (it'll show up again where it was)
      this.daggerHeldBy = null;
      this.c.deps.send('dagfree', this.daggerN);
    }
    this.hadDagger = hasD;
    if (this.daggerDelay > 0) {
      this.daggerDelay -= dt;
      if (this.daggerDelay <= 0) {
        this.daggerDelay = 0;
        this.ensureDagger();
        if (this.c.deps.items.isLyingAround('daga')) this.c.say('Apareció otra daga de obsidiana en el laberinto (brillo morado)', 'skin-new-dagger', 2);
      }
    }
  }

  onEvent(kind: string, i: number, _v: number, from: string, target?: string) {
    const who = this.c.deps.remotes().find((r) => r.userId === from);
    if (kind === 'skcall') {
      // The host's Skinwalker screamed at us: the copies come out of our walls
      if (target && target === this.c.deps.myId() && !this.dead) this.callClones();
      return;
    }
    if (kind === 'dagtake') {
      this.daggerHeldBy = from;
      this.c.deps.items.takeLying('daga', this.daggerAt ?? this.c.playerPos, this.daggerAt ? 3 : 999);
      this.daggerAt = null;
      this.c.say(`${who?.username ?? 'Un amigo'} encontró la daga de obsidiana`, 'skin-dag-taken', 2);
    } else if (kind === 'dagused') {
      this.daggerN = Math.max(this.daggerN, i);
      this.daggerHeldBy = null;
      this.daggerDelay = 4;
    } else if (kind === 'dagfree') {
      if (this.daggerHeldBy === from) this.daggerHeldBy = null;
    } else if (kind === 'skull' && who) {
      // A friend's skull flashes over there (it scares whatever is near them)
      this.startSkull(() => this.c.deps.remotes().find((r) => r.userId === from)?.pos ?? null, false);
    } else if (this.dead || this.following) {
      return;
    } else if (kind === 'skhit') {
      // (host) A friend stabbed it with the dagger
      if (this.state === 'mimic') this.endMimic(false);
      this.state = 'hurt';
      this.t = 1.1;
      const at = who?.pos ?? this.c.playerPos;
      this.lungeDir.set(at.x - this.pos.x, 0, at.z - this.pos.z).normalize();
    } else if (kind === 'skscare') {
      // (host) Quetsy bit it or Estrella flashed it, next to a friend
      if (this.state !== 'intro') this.scare(_v === 1, who?.pos);
    } else if (kind === 'skfog') {
      // (host) A friend hid in Nubi's fog: it loses their trail
      this.fogBy.set(from, 8);
      if (this.tgtId === from && (this.state === 'windup' || this.state === 'lunge')) {
        this.state = 'recover';
        this.t = 0.9;
      }
      this.retargetT = 0;
    }
  }

  /** (host) Where it is and what it's doing, plus the lights and the maze walls. */
  syncPayload(): number[] | null {
    if (this.dead || this.following) return null;
    const r = (n: number) => Math.round(n * 100) / 100;
    const w = this.state === 'escape' || this.state === 'arrive' ? this.portalAt : this.tearAt;
    return [
      BOSS_SYNC_MARK,
      r(this.pos.x),
      r(this.pos.z),
      r(Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw))),
      SKIN_STATES.indexOf(this.state),
      r(THREE.MathUtils.clamp(this.t, 0, 99)),
      this.crawlK > 0.5 ? 1 : 0,
      this.lightsOff ? 1 : 0,
      w ? r(w.pos.x) : 0,
      w ? r(w.pos.z) : 0,
      w ? r(w.normal.x) : 0,
      w ? r(w.normal.z) : 0,
      ...(this.s.mazeMask?.() ?? []),
    ];
  }

  /** (everybody else) The host's Skinwalker: same place, same moves, same maze and lights. */
  applySync(_from: string, d: number[]) {
    if (this.dead || this.c.deps.isHost() || d.length < 12) return;
    this.lastSync = performance.now();
    this.syncPos.set(d[1], this.s.floorY, d[2]);
    this.syncYaw = d[3];
    this.syncCrawl = d[6];
    const off = d[7] === 1;
    if (off !== this.lightsOff) this.setBlackout(off);
    const mask = d.slice(12);
    if (mask.length && this.s.applyMazeMask) {
      const key = mask.join(',');
      if (key !== this.maskKey) {
        const first = this.maskKey === '';
        this.maskKey = key;
        const n = this.s.applyMazeMask(mask);
        if (n && !first) {
          soundManager.playRumble(1);
          this.scream(0.8);
          this.c.say('¡Las paredes se mueven! El laberinto cambió de forma', 'skin-shift', 1);
          this.note('las paredes del laberinto se movieron');
        }
      }
    }
    const st = SKIN_STATES[d[4]] ?? 'hunt';
    // Our own stab shows until the host's answer gets here
    if (this.holdT > 0 && st !== 'hurt' && st !== 'scared') return;
    this.enterSynced(st, d);
    this.t = d[5];
  }

  /** Plays the moment the host's Skinwalker changed what it's doing. */
  private enterSynced(st: SkinState, d: number[]) {
    const prev = this.state;
    if (st === prev) return;
    if (prev === 'mimic' && this.copy) this.endMimic(false);
    if (prev === 'tear' && this.tearAt) {
      this.pos.copy(this.tearAt.pos).addScaledVector(this.tearAt.normal, 0.8);
      this.syncPos.copy(this.pos);
      this.m.group.visible = true;
      if (st !== 'scared') this.burstOut(this.tearAt);
    }
    if (st === 'tear') {
      this.startTear({ pos: V(d[8], this.s.floorY, d[9]), normal: V(d[10], 0, d[11]) });
      return;
    }
    if (st === 'escape' || st === 'arrive') {
      this.portalAt = { pos: V(d[8], this.s.floorY, d[9]), normal: V(d[10], 0, d[11]) };
      this.openPortal(this.portalAt);
      if (st === 'arrive') this.pos.copy(this.syncPos);
    }
    if (prev === 'escape' && this.curPortal) this.curPortal.open = false;
    if (prev === 'arrive' && this.curPortal) this.curPortal.open = false;
    this.state = st;
    if (st === 'windup' && prev !== 'tear') this.scream(0.55);
    if (st === 'lunge') {
      this.lungeHit = false;
      soundManager.playWindGust();
    }
    if (st === 'scared') {
      this.scream(0.9);
      this.ensureDagger();
    }
    if (prev === 'intro') this.c.say('El Skinwalker los está cazando… y le gusta jugar con su presa. Toma un cráneo de obsidiana', 'skin-start', 3);
    if (st === 'call') this.scream(1.4);
    if (st === 'feint') soundManager.playWindGust();
    if (prev === 'feint') this.scream(0.8);
    if (st === 'hunt' && (prev === 'stalk' || prev === 'peek' || prev === 'feint' || prev === 'call') && this.dist() < 30)
      this.c.say('¡El Skinwalker dejó de jugar! Viene por alguien…', 'skin-hunt', 4);
  }

  /** (everybody else) Glide to where the host has it. */
  private followHost(dt: number) {
    if (this.pos.distanceTo(this.syncPos) > 6) this.pos.copy(this.syncPos);
    else {
      this.pos.x = THREE.MathUtils.damp(this.pos.x, this.syncPos.x, 12, dt);
      this.pos.z = THREE.MathUtils.damp(this.pos.z, this.syncPos.z, 12, dt);
    }
    this.yaw = turnTo(this.yaw, this.syncYaw, 14, dt);
    if (this.state !== 'tear' && this.state !== 'mimic') this.m.group.visible = true;
  }

  /** It bursts out of the wall, screaming. */
  private burstOut(w: { pos: THREE.Vector3; normal: THREE.Vector3 }) {
    this.m.group.visible = true;
    this.scream(1.1);
    soundManager.playRip(1);
    this.c.addEffect(burstEffect(this.root, w.pos.clone().add(V(0, 1.6, 0)), new THREE.MeshStandardMaterial({ color: 0xd4c27a }), 14, 0.18, 5, 1));
    if (this.dist() < 16) this.c.say('¡Salió de la pared! ¡CORRE!', 'skin-tear', 1);
  }

  /** The obsidian skull floats up over the head, spinning, and bursts into a flash that fills the room. */
  private startSkull(at: () => THREE.Vector3 | null, mine: boolean) {
    const p0 = at();
    if (!p0) return;
    const g = new THREE.Group();
    const skull = createToolModel('craneo');
    skull.scale.setScalar(1.7);
    g.add(skull);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: skullGlowTex(), color: 0xc084fc, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    glow.scale.setScalar(1.6);
    g.add(glow);
    g.position.copy(p0).add(V(0, 1.6, 0));
    this.root.add(g);
    this.skulls.push({ g, glow, flash: null, t: 0, at, mine, flashed: false });
    soundManager.playUpdraft();
    if (mine) this.c.say('¡El cráneo de obsidiana flota sobre tu cabeza…!', 'skin-skull-up', 1);
  }

  private updateSkulls(dt: number, time: number) {
    for (let i = this.skulls.length - 1; i >= 0; i--) {
      const s = this.skulls[i];
      s.t += dt;
      const p = s.at();
      const rise = Math.min(1, s.t / 0.9);
      if (p && !s.flashed) s.g.position.set(p.x, p.y + 1.6 + rise * 1.1 + Math.sin(time * 6) * 0.05, p.z);
      s.g.children[0].rotation.y += dt * (3 + rise * 9);
      s.glow.scale.setScalar(1.6 + rise * 2.2 + Math.sin(time * 20) * 0.2);
      (s.glow.material as THREE.SpriteMaterial).opacity = 0.5 + rise * 0.45;
      if (!s.flashed && s.t >= 0.9) {
        s.flashed = true;
        // FLASH: a burst of violet-white light that fills the whole room
        const flash = new THREE.Mesh(
          new THREE.SphereGeometry(1, 24, 16),
          new THREE.MeshBasicMaterial({ color: 0xf3e8ff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
        );
        flash.position.copy(s.g.position);
        this.root.add(flash);
        s.flash = flash;
        soundManager.playTimeBonus();
        soundManager.playWindGust();
        this.skullBlast(s.g.position.clone().setY(this.s.floorY), s.mine);
      }
      if (s.flash) {
        const k = Math.min(1, (s.t - 0.9) / 0.55);
        s.flash.scale.setScalar(1 + k * 16);
        (s.flash.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - k);
        s.g.scale.setScalar(Math.max(0.01, 1 - k));
      }
      if (s.t > 1.5) {
        if (s.flash) disposeGroup(this.root, s.flash);
        disposeGroup(this.root, s.g);
        this.skulls.splice(i, 1);
      }
    }
  }

  /** What the flash does: undoes the copies around and sends the Skinwalker running. */
  private skullBlast(at: THREE.Vector3, mine: boolean) {
    let n = 0;
    for (const c of this.copies)
      if (c.phase !== 'die' && Math.hypot(c.pos.x - at.x, c.pos.z - at.z) < 14) {
        this.killCopy(c);
        n++;
      }
    for (const nh of this.nahuales)
      if (nh.state !== 'die' && Math.hypot(nh.pos.x - at.x, nh.pos.z - at.z) < 14) {
        this.killNahual(nh, '¡El destello deshizo al Nahual!');
        n++;
      }
    const near = Math.hypot(this.pos.x - at.x, this.pos.z - at.z) < 13 && this.state !== 'intro' && this.state !== 'scared' && !this.dead;
    if (near) this.scare(true, at, false);
    if (mine) {
      if (near) this.c.say(n ? '¡El destello lo espantó y deshizo a las copias! Busca la daga (brillo morado)' : '¡El destello lo espantó! Busca la daga (brillo morado)', 'skin-scared', 1);
      else if (n) this.c.say(n === 1 ? '¡El destello deshizo a la copia!' : `¡El destello deshizo ${n} copias!`, 'skin-scared', 1);
    }
  }

  private startMimic() {
    // It takes your shape (and your clothes) and walks toward you, slowly, like a friend would…
    this.state = 'mimic';
    this.t = 12;
    // In a party it becomes one of your friends (name tag and all); alone, it becomes you
    const friends = this.c.deps.remotes().filter((r) => r.look);
    const f = friends.length ? friends[Math.floor(Math.random() * friends.length)] : null;
    this.copy = createPlayerCharacter(this.c.deps.textures, f?.look ?? this.c.deps.appearance());
    this.copy.companionSprite.visible = false;
    if (f) this.copy.group.add(createNameTagSprite(f.username));
    this.group.add(this.copy.group);
    this.m.group.visible = false;
    if (!f) this.c.say('¿Ese eres… tú? Algo con tu forma camina hacia ti', 'skin-mimic', 4);
  }

  private endMimic(lunge: boolean) {
    if (this.copy) {
      this.group.remove(this.copy.group);
      this.copy = null;
    }
    this.m.group.visible = true;
    if (lunge) {
      soundManager.playStalkerWarning();
      this.c.addEffect(puffEffect(this.root, this.pos.clone().add(V(0, 1.4, 0)), 'rgba(40,30,25,0.9)', 3.5, 0.5));
      this.startWindup(0.35);
    } else {
      this.state = 'stalk';
    }
  }

  private startWindup(dur = 0.6 - 0.15 * this.s.diff) {
    this.state = 'windup';
    this.t = dur;
    this.scream(0.55);
  }

  /** Jaw wide open, head shaking, a screech you hear louder the closer it is. */
  private scream(dur = 1) {
    this.screamT = Math.max(this.screamT, dur);
    soundManager.playStalkerWarning();
    soundManager.playScream(1 - Math.min(1, this.dist() / 40) * 0.8);
  }

  update(dt: number, time: number) {
    this.applyPulse(dt);
    this.updatePending(dt);
    this.hitCd -= dt;
    this.fogT = Math.max(0, this.fogT - dt);
    const p = this.c.playerPos;
    const m = this.m;

    // Dagger beacon
    const lying = this.c.deps.items.isLyingAround('daga');
    this.beam.visible = lying && !!this.daggerAt;
    if (this.beam.visible && this.daggerAt) {
      this.beam.position.set(this.daggerAt.x, this.s.floorY + 2.1, this.daggerAt.z);
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(time * 4) * 0.1;
    }

    this.updateRips(dt);
    this.updateSkulls(dt, time);
    this.trackDagger(dt);
    if (this.dead) {
      this.deadT += dt;
      this.c.darknessTarget = 0;
      soundManager.setTension(0);
      if (this.lightsOff) this.setBlackout(false);
      this.updateCopies(dt, time);
      m.torso.rotation.x = Math.min(1.4, 0.45 + this.deadT);
      m.jaw.rotation.x = Math.min(0.9, this.deadT);
      this.m.group.scale.setScalar(1.25 * Math.max(0.01, 1 - this.deadT / 2.4));
      this.group.position.copy(this.pos);
      if (this.deadT > 2.4 && this.group.visible) {
        this.group.visible = false;
        this.c.addEffect(burstEffect(this.root, this.pos.clone().add(V(0, 1, 0)), new THREE.MeshStandardMaterial({ color: 0x2a221c }), 20, 0.3, 6, 1.4));
      }
      return;
    }

    const d = this.dist();
    this.t -= dt;
    this.holdT = Math.max(0, this.holdT - dt);
    for (const [id, f] of this.fogBy) {
      if (f - dt <= 0) this.fogBy.delete(id);
      else this.fogBy.set(id, f - dt);
    }
    // In a party only the host thinks for it (it chases whoever is closest); the rest copy it
    const follow = this.following;
    const T = follow ? null : this.target(dt);
    const tp = T ? T.pos : p;
    const dT = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z);
    // Dim rooms; darker when it's close; pitch black in a blackout
    this.c.darknessTarget = this.lightsOff ? 0.93 : this.state === 'scared' || this.state === 'gone' ? 0.35 : d < 9 ? 0.55 + Math.max(0, Math.sin(time * 17)) * 0.15 : 0.45;
    if (!follow) this.updateRage(dt);
    // Music: heartbeat and strings the closer it (or a werewolf copy) is
    let tension = this.lightsOff ? 0.6 : 0;
    if (this.state === 'windup' || this.state === 'lunge' || this.state === 'tear' || this.state === 'feint' || this.state === 'call') tension = 1;
    else if (this.state !== 'scared' && this.state !== 'intro' && this.state !== 'gone') tension = Math.max(tension, 1 - Math.max(0, d - 4) / 24);
    for (const cp of this.copies) if (cp.phase === 'hunt' || cp.phase === 'distort' || cp.phase === 'emerge' || cp.phase === 'merge') tension = Math.max(tension, 1 - cp.pos.distanceTo(p) / 20);
    for (const nh of this.nahuales) if (nh.state !== 'die') tension = Math.max(tension, 1 - nh.pos.distanceTo(p) / 26);
    soundManager.setTension(tension);

    // It sheds copies of the players that stretch into long, crawling animals
    this.updateCopies(dt, time);
    this.updateGathering(dt);
    this.updateNahuales(dt, time);
    this.askDirector(dt);
    this.callCd -= dt;
    if (this.lastHp >= 0 && this.c.hp < this.lastHp - 0.5) this.note('el jugador recibió daño');
    this.lastHp = this.c.hp;
    if (this.state !== 'intro') {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        // Copies wander the maze pretending to be players looking for the dagger
        this.spawnT = 10 - 3.5 * this.s.diff;
        if (this.copies.filter((c) => c.phase === 'copy').length < this.scaled(4, 1)) this.spawnCopy();
      }
    }

    // Animation: twitchy, sometimes on all fours, screaming with the jaw wide open
    // Moving or not (measured, so it also works for the copy the host streams)
    const vel = this.pos.distanceTo(this.prevPos) / Math.max(dt, 1e-3);
    this.prevPos.copy(this.pos);
    this.moveK = THREE.MathUtils.damp(this.moveK, vel > 0.6 && vel < 40 ? 1 : 0, 10, dt);
    const moving = this.moveK > 0.5 || this.state === 'hunt' || this.state === 'scared' || this.state === 'mimic';
    // Low on all fours while it stalks and charges; upright when it shows itself or screams
    const crawl = follow
      ? this.syncCrawl > 0.5
      : (this.state === 'hunt' && dT > 7 && T!.fog <= 0) ||
        this.state === 'scared' ||
        this.state === 'stalk' ||
        (this.state === 'feint' && !this.feintStop) ||
        (this.state === 'peek' && !this.peekStanding);
    this.crawlK = THREE.MathUtils.damp(this.crawlK, crawl ? 1 : 0, 5, dt);
    const ck = this.crawlK;
    const rage = this.rage;
    const sp = (this.state === 'scared' ? 17 : 10 + 4 * ck) + 7 * rage;
    const gait = (i: number) => Math.sin(time * sp + i * Math.PI);
    m.legs.forEach((l, i) => (l.rotation.x = moving ? gait(i) * (0.6 + 0.3 * ck) : 0));
    m.arms.forEach((a, i) => {
      // Upright: arms swing and hang; crawling: they reach forward like front legs
      const upright = moving ? -gait(i) * 0.5 : this.state === 'windup' ? -1.4 : this.state === 'lunge' ? -1.9 : -0.2;
      a.rotation.x = THREE.MathUtils.lerp(upright, -1.25 + gait(i + 0.5) * 0.55, ck);
      // Hurt and furious: the arms flail as it runs
      a.rotation.z = (i ? -1 : 1) * (this.state === 'windup' ? 0.5 : 0.08 + (moving ? rage * (0.35 + Math.sin(time * 19 + i * 2) * 0.35) : 0));
    });
    m.forearms.forEach((f, i) => (f.rotation.x = THREE.MathUtils.lerp(this.state === 'windup' ? -0.9 : -0.25, -0.5 + gait(i) * 0.3, ck)));
    const hunch = this.state === 'windup' ? 0.95 : this.state === 'scared' ? 1.25 : this.state === 'hurt' ? -0.35 : THREE.MathUtils.lerp(0.5, 1.3, ck);
    m.torso.rotation.x = THREE.MathUtils.damp(m.torso.rotation.x, hunch, 8, dt);
    m.torso.position.y = THREE.MathUtils.lerp(1.5, 1.05, ck);
    // Jerky, broken movement the more it's hurt
    m.torso.rotation.z = moving ? Math.sin(time * 23) * Math.sin(time * 7.7) * 0.22 * rage + (this.dartT > 0 ? this.dartSide * 0.35 : 0) : 0;
    // Head twitches: a sudden snap sideways, held for a moment
    this.twitchCd -= dt;
    if (this.twitchCd <= 0 && this.state !== 'mimic') {
      this.twitchCd = (1.2 + Math.random() * 2.8) * (1 - 0.7 * this.rage);
      this.twitchT = 0.25 + Math.random() * 0.5;
      this.twitchAng = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.9);
    }
    this.twitchT = Math.max(0, this.twitchT - dt);
    this.screamT = Math.max(0, this.screamT - dt);
    const shake = this.screamT > 0 ? Math.sin(time * 70) * 0.25 : 0;
    m.neck.rotation.z = (this.twitchT > 0 ? this.twitchAng : Math.sin(time * 1.7) * 0.12) + shake;
    // Showing itself at the end of a hall: still, staring, the head tilting slowly to one side
    if (this.state === 'peek' && !moving) m.neck.rotation.z = 0.65 + Math.sin(time * 0.8) * 0.08;
    m.neck.rotation.x = -m.torso.rotation.x * 0.75 + (this.screamT > 0 ? -0.35 : 0);
    m.head.rotation.y = this.twitchT > 0 ? Math.sin(time * 40) * 0.08 : 0;
    const jawOpen = this.screamT > 0 ? 1.05 : this.state === 'lunge' ? 0.9 : this.state === 'windup' ? 0.6 : 0.08 + Math.max(0, Math.sin(time * 2.3)) * 0.06;
    m.jaw.rotation.x = THREE.MathUtils.damp(m.jaw.rotation.x, jawOpen, 18, dt);
    const angry = this.state === 'windup' || this.state === 'lunge' || this.screamT > 0 || this.lightsOff;
    m.eyes.color.setHex(angry ? 0xff2020 : 0xf5f5f5);
    m.eyeGlow.color.setHex(angry ? 0xff3030 : 0xfff1d6);
    m.eyeGlow.opacity = angry ? 0.75 : 0.35 + Math.sin(time * 3) * 0.1;
    this.m.group.position.y = ck * -0.05;

    // Voices: it calls you with a friend's voice (everybody hears their own)
    if (this.state === 'hunt' || this.state === 'stalk') {
      this.voiceCd -= dt;
      if (this.voiceCd <= 0 && d > 10) {
        this.voiceCd = (16 + Math.random() * 10) * (1 - 0.5 * this.rage);
        if (Math.random() < 0.5 + 0.5 * this.rage) this.scream(1.2);
        const r = this.c.deps.remotes();
        const who = r.length ? r[Math.floor(Math.random() * r.length)].username : 'tu compañero';
        this.c.say(`Escuchas a ${who}: "¿Hola? ¡Ven, ayúdame!"… no es ${r.length ? 'él' : 'real'}`, 'skin-voice', 6);
      }
    }

    if (follow) this.followHost(dt);
    else
      switch (this.state) {
        case 'intro':
          this.yaw = turnTo(this.yaw, Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z), 3, dt);
          if (this.t <= 0) {
            this.state = 'stalk';
            this.c.say('El Skinwalker te está cazando… y le gusta jugar con su presa. Toma un cráneo de obsidiana', 'skin-start', 3);
          }
          break;
        case 'stalk':
          this.stalkStep(T!, tp, dT, dt);
          break;
        case 'peek':
          if (!this.peekStanding) {
            // It walks to a spot down a straight hall from you…
            if (this.lurkTo) this.walk(this.lurkTo, this.speed * 0.9, dt);
            if (!this.lurkTo || this.pos.distanceTo(this.lurkTo) < 0.8 || this.t <= 0) {
              this.peekStanding = true;
              this.t = 2.5 + Math.random() * 2;
              if (T!.id === null) this.c.say('Al fondo del pasillo… algo te está mirando', 'skin-peek', 6);
            }
          } else {
            // …and stands there, staring. Walk toward it and it skitters away
            this.yaw = turnTo(this.yaw, Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z), 4, dt);
            if (dT < 7 || this.t <= 0) {
              if (dT < 7) this.twitchT = 0.4;
              this.state = 'stalk';
              this.huntUrge += dT < 7 ? 0.1 : 0.2;
              this.lurkTo = this.pickLurk(tp, true);
              this.lurkT = 5;
            }
          }
          break;
        case 'feint':
          if (!this.feintStop) {
            // It charges straight at you…
            this.walk(tp, this.speed * 1.7, dt);
            if (dT < 3.1) {
              // …and stops right in front of you, screaming. It was only playing (this time)
              this.feintStop = true;
              this.t = 0.9;
              this.scream(0.9);
              this.twitchT = 0.5;
            } else if (this.t <= 0 || T!.fog > 0) this.state = 'stalk';
          } else {
            this.yaw = turnTo(this.yaw, Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z), 10, dt);
            if (this.t <= 0) {
              this.state = 'stalk';
              this.huntUrge += 0.25;
              this.lurkTo = this.pickLurk(tp, true);
              this.lurkT = 5;
            }
          }
          break;
        case 'call':
          // Stands tall and screams at its prey: copies crawl out of the wall corners around them
          this.yaw = turnTo(this.yaw, Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z), 6, dt);
          if (this.t <= 0) this.state = 'stalk';
          break;
        case 'escape': {
          // Into the portal: through the wall, or sinking into the floor
          const at = this.portalAt;
          const k = 1 - this.t / ESCAPE_T;
          if (at && at.normal.lengthSq() > 0.01) {
            const front = V(at.pos.x + at.normal.x * 0.7, this.s.floorY, at.pos.z + at.normal.z * 0.7);
            const inside = V(at.pos.x - at.normal.x * 1.2, this.s.floorY, at.pos.z - at.normal.z * 1.2);
            const goal = k < 0.45 ? front : inside;
            const dx = goal.x - this.pos.x;
            const dz = goal.z - this.pos.z;
            const d = Math.hypot(dx, dz);
            if (d > 0.05) {
              const step = Math.min(d, (k < 0.45 ? 6 : 2.2) * dt);
              this.pos.x += (dx / d) * step;
              this.pos.z += (dz / d) * step;
            }
            this.yaw = turnTo(this.yaw, Math.atan2(-at.normal.x, -at.normal.z), 8, dt);
          } else this.yaw += dt * 2.5;
          if (this.t <= 0) {
            this.state = 'gone';
            this.t = this.escapeAway;
            if (this.curPortal) this.curPortal.open = false;
          }
          break;
        }
        case 'gone':
          if (this.t <= 0) {
            // It climbs out of another portal, far from everybody
            this.pos.copy(this.arrivalSpot());
            this.portalAt = { pos: this.pos.clone(), normal: V(0, 0, 0) };
            this.openPortal(this.portalAt);
            this.state = 'arrive';
            this.t = ARRIVE_T;
          }
          break;
        case 'arrive':
          this.yaw = turnTo(this.yaw, Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z), 3, dt);
          if (this.t <= 0) {
            if (this.curPortal) this.curPortal.open = false;
            this.state = 'stalk';
            this.lurkTo = null;
            this.c.say(this.has('daga') ? 'Volvió por otro lado… tienes la daga: espera a que se acerque' : 'Volvió a salir de un portal… y aún no tienes la daga', 'skin-back', 2);
          }
          break;
        case 'hunt': {
          // It stopped playing… but if it can't reach you in a while, it goes back to stalking
          if (this.t <= 0 && dT > 6) {
            this.state = 'stalk';
            this.lurkTo = null;
            break;
          }
          if (T!.fog > 0) {
            // Lost the trail in Nubi's fog: it wanders
            this.walk(this.s.home, this.speed * 0.5, dt);
            break;
          }
          this.walk(tp, this.speed * (1 + 0.25 * this.crawlK), dt);
          // Erratic: sudden darts to the side (more often the more it's hurt)
          this.dartCd -= dt;
          if (this.dartCd <= 0 && this.rage > 0.25) {
            this.dartCd = (0.6 + Math.random() * 1.6) / (0.4 + this.rage);
            this.dartT = 0.18 + Math.random() * 0.15;
            this.dartSide = Math.random() < 0.5 ? -1 : 1;
            this.twitchT = 0.3;
          }
          if (this.dartT > 0) {
            this.dartT -= dt;
            this.pos.x += Math.cos(this.yaw) * this.dartSide * 9 * dt;
            this.pos.z -= Math.sin(this.yaw) * this.dartSide * 9 * dt;
            this.collide();
          }
          // Hurt enough, it stops walking the halls: it rips out of the wall of the room you're in
          this.tearCd -= dt * (this.lightsOff ? 2 : 1);
          if (this.tearCd <= 0 && this.rage > 0.25 && dT > 9 && !T!.down && this.s.wallNear) {
            this.tearCd = THREE.MathUtils.lerp(24, 9, this.rage) * (0.8 + Math.random() * 0.4);
            const w = this.s.wallNear(tp);
            if (w) {
              this.startTear(w);
              break;
            }
          }
          if (dT < 4.4 && Math.abs(tp.y - this.pos.y) < 2.5 && !T!.down && (!this.s.cellDist || this.s.cellDist(this.pos, tp) <= 1)) this.startWindup();
          break;
        }
        case 'mimic':
          this.walk(tp, 2.6, dt);
          if (this.copy) this.copy.updateAnimation(2.6, true, dt, time);
          if (dT < 4.5) this.endMimic(true);
          else if (this.t <= 0) this.endMimic(false);
          break;
        case 'windup':
          this.yaw = turnTo(this.yaw, Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z), 10, dt);
          if (this.t <= 0) {
            this.state = 'lunge';
            this.t = 0.42;
            this.lungeHit = false;
            this.lungeDir.set(tp.x - this.pos.x, 0, tp.z - this.pos.z).normalize();
            soundManager.playWindGust();
          }
          break;
        case 'lunge':
          this.pos.addScaledVector(this.lungeDir, 15 * dt);
          this.collide();
          if (this.t <= 0) {
            this.state = 'recover';
            this.t = 0.9;
          }
          break;
        case 'recover':
          // After the attack (hit or miss) it backs off and starts playing again
          if (this.t <= 0) {
            this.state = 'stalk';
            this.huntUrge = 0;
            this.lurkTo = this.pickLurk(tp, true);
            this.lurkT = 5;
          }
          break;
        case 'tear': {
          if (this.t <= 0) {
            // …and it bursts out, screaming, right at whoever is in that room
            const w = this.tearAt!;
            this.pos.copy(w.pos).addScaledVector(w.normal, 0.8);
            this.yaw = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
            this.burstOut(w);
            this.startWindup(0.3);
          }
          break;
        }
        case 'scared':
          this.walk(this.fleeTo, this.speed * 1.4, dt);
          if (this.t <= 0) {
            this.state = 'stalk';
            this.lurkTo = null;
            this.c.say(this.has('daga') ? '¡Ya viene! Déjalo acercarse y usa la daga cuando lo tengas enfrente' : 'Volvió… y aún no tienes la daga', 'skin-back', 2);
          }
          break;
        case 'hurt':
          this.pos.addScaledVector(this.lungeDir, -4 * dt * Math.max(0, this.t));
          this.collide();
          if (this.t <= 0) this.scare(false);
          break;
      }

    // Inside the wall: the wallpaper bulges and rips open like cloth… (everybody sees it)
    if (this.state === 'tear' && this.tearAt) {
      const w = this.tearAt;
      const rip = this.rips[this.rips.length - 1];
      if (rip) {
        const k = THREE.MathUtils.clamp(1 - this.t / 1.3, 0, 1);
        rip.slit.scale.set(0.2 + k * 0.9, 0.15 + k * 1.0, 1);
        rip.flaps.forEach((f, i) => (f.rotation.y = (i % 2 ? 1 : -1) * k * 1.3 + Math.sin(time * 40 + i) * 0.05 * k));
        rip.g.position.copy(w.pos).addScaledVector(w.normal, 0.02 + Math.sin(time * 30) * 0.015 * k);
      }
    }

    // Its claws: everybody checks their own player (it may be lunging at a friend next to you)
    if (this.state === 'lunge' && !this.lungeHit && this.dist() < 1.6 && Math.abs(p.y - this.pos.y) < 2.2 && !this.c.isDown) {
      this.lungeHit = true;
      if (this.guarding(this.pos)) {
        this.c.say('¡Quetsy lo mordió! Retrocede', 'skin-jade', 2);
        this.scare(false);
      } else {
        this.c.damagePlayer(18 + 8 * this.s.diff, this.pos, 12, 5, 'claw');
      }
    }

    // Through the portal: it sinks into the floor (or walks into the wall), hidden while it's away
    this.updatePortals(dt);
    let sink = 0;
    if (this.state === 'escape') {
      const k = 1 - this.t / ESCAPE_T;
      const floor = !this.portalAt || this.portalAt.normal.lengthSq() < 0.01;
      sink = floor ? -Math.max(0, (k - 0.3) / 0.7) * 3.4 : 0;
      this.m.group.visible = floor ? k < 0.98 : k < 0.9;
    } else if (this.state === 'gone') {
      sink = -3.4;
      this.m.group.visible = false;
    } else if (this.state === 'arrive') {
      sink = -3.4 * (1 - ease(Math.min(1, 1 - this.t / ARRIVE_T)));
      this.m.group.visible = true;
    }
    this.sinkY = sink;
    this.group.position.copy(this.pos);
    this.group.position.y += this.sinkY;
    this.group.rotation.y = this.yaw;
    this.center.copy(this.pos).add(V(0, 1.9 - 0.6 * this.crawlK, 0));
  }

  /**
   * Stalking, like a hunter playing with its prey: it keeps two or three rooms away, out of
   * sight, backs off if you get close… and every few seconds plays a game with you (shows itself
   * down a hall, fakes a charge, or screams to call the copies out of the walls). The longer it
   * plays — or if you're helpless (in the dark, in a dead end) — the closer it is to really attacking.
   */
  private stalkStep(T: { id: string | null; pos: THREE.Vector3; down: boolean; fog: number }, tp: THREE.Vector3, dT: number, dt: number) {
    if (T.fog > 0) {
      this.walk(this.s.home, this.speed * 0.5, dt);
      return;
    }
    const cd = this.s.cellDist ? this.s.cellDist(this.pos, tp) : Math.round(dT / 6.5);
    const tooClose = cd <= 1 && dT < 7;
    this.lurkT -= dt;
    if (!this.lurkTo || this.lurkT <= 0 || this.pos.distanceTo(this.lurkTo) < 0.8 || (tooClose && this.lurkT < 4)) {
      this.lurkTo = this.pickLurk(tp, tooClose);
      this.lurkT = 4 + Math.random() * 3;
    }
    if (this.lurkTo) this.walk(this.lurkTo, this.speed * (tooClose ? 1.15 : 0.7), dt);
    // Hurt enough, it rips out of the wall of the room its prey is in
    this.tearCd -= dt * (this.lightsOff ? 2 : 1);
    if (this.tearCd <= 0 && this.rage > 0.25 && dT > 9 && !T.down && this.s.wallNear) {
      this.tearCd = THREE.MathUtils.lerp(24, 9, this.rage) * (0.8 + Math.random() * 0.4);
      const w = this.s.wallNear(tp);
      if (w) {
        this.startTear(w);
        return;
      }
    }
    // It gets tired of playing (sooner when it's hurt), or its prey is helpless: the real attack
    this.huntUrge += dt * (0.012 + 0.03 * this.rage);
    const helpless = this.lightsOff || (cd <= 3 && !!this.s.exits && this.s.exits(tp) <= 1);
    if (!T.down && (this.huntUrge >= 1 || (helpless && this.huntUrge > 0.4 && Math.random() < dt * 0.1))) {
      this.state = 'hunt';
      this.t = 10;
      this.huntUrge = 0;
      this.scream(1);
      if (T.id === null) this.c.say('¡Se cansó de jugar contigo! ¡Viene por ti!', 'skin-hunt', 4);
      return;
    }
    // Its games
    this.playT -= dt;
    if (this.playT <= 0 && !T.down) {
      this.playT = (6 + Math.random() * 6) * (1 - 0.4 * this.rage);
      const r = Math.random();
      if (this.callCd <= 0 && dT < 20 && r < 0.4) {
        this.state = 'call';
        this.t = 2.4;
        this.callCd = THREE.MathUtils.lerp(40, 22, this.rage) * (0.85 + Math.random() * 0.3);
        this.huntUrge += 0.15;
        this.scream(1.4);
        // The copies crawl out next to its prey (on that player's screen)
        if (T.id === null) this.callClones();
        else this.c.deps.send('skcall', 0, 0, T.id);
      } else if (cd <= 4 && r < 0.72) {
        this.state = 'feint';
        this.t = 5;
        this.feintStop = false;
        soundManager.playWindGust();
      } else {
        const spot = this.s.sightSpot?.(tp, 2, 4) ?? null;
        if (spot) {
          this.state = 'peek';
          this.t = 12;
          this.peekStanding = false;
          this.lurkTo = spot;
        }
      }
      return;
    }
    // Alone, it can also take your shape
    this.mimicCd -= dt;
    if (this.mimicCd <= 0 && dT > 14 && !this.inParty) {
      this.mimicCd = 26 + Math.random() * 12;
      this.startMimic();
    }
  }

  /** A room 2-3 rooms from its prey, out of its line of sight (the nearest one, or one farther away). */
  private pickLurk(tp: THREE.Vector3, away: boolean): THREE.Vector3 | null {
    const cd = this.s.cellDist;
    const spots = this.s.searchSpots ?? [];
    if (!cd || !spots.length) return null;
    let best: THREE.Vector3 | null = null;
    let bestScore = Infinity;
    for (const q of spots) {
      const r = cd(q, tp);
      if (r < (away ? 3 : 2) || r > 4) continue;
      // not straight down a hall from its prey (it would be seen)
      if (Math.abs(q.x - tp.x) < 3 || Math.abs(q.z - tp.z) < 3) continue;
      const score = Math.hypot(q.x - this.pos.x, q.z - this.pos.z) + Math.random() * 6;
      if (score < bestScore) {
        bestScore = score;
        best = q;
      }
    }
    return best ? best.clone().setY(this.s.floorY) : null;
  }

  /**
   * It screamed at you: copies crawl out of the wall corners around you, struggling, clawing at
   * the walls with their arms and kicking with their legs until they tear free.
   */
  private callClones() {
    const p = this.c.playerPos;
    const corners = (this.s.cornersNear?.(p, 1) ?? [])
      .map((c) => ({ c, d: Math.hypot(c.pos.x - p.x, c.pos.z - p.z) }))
      .filter((o) => o.d > 2.2 && o.d < 11)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .sort(() => Math.random() - 0.5);
    const n = Math.min(corners.length, 2 + (this.rage > 0.5 ? 1 : 0));
    for (let k = 0; k < n; k++) this.spawnCopy(corners[k].c.pos, corners[k].c.dir);
    if (n) {
      soundManager.playRip(0.8);
      soundManager.playStalkerWarning();
      this.c.say('¡El Skinwalker te gritó… y algo sale de las esquinas de las paredes!', 'skin-call', 2);
      this.note('el Skinwalker gritó y salieron copias de las esquinas');
    }
  }

  /** It vanishes into the walls and tears its way out of one in your room. */
  private startTear(w: { pos: THREE.Vector3; normal: THREE.Vector3 }) {
    this.state = 'tear';
    this.t = 1.3;
    this.tearAt = w;
    this.m.group.visible = false;
    if (this.copy) (this.endMimic(false), (this.state = 'tear'));
    this.addRip(w, 1.75, true);
    soundManager.playRip(0.6);
    soundManager.playStalkerWarning();
    if (w.pos.distanceTo(this.c.playerPos) < 18) this.c.say('Algo rasga el papel tapiz de las paredes…', 'skin-tear-warn', 3);
  }

  /** A rip in the wallpaper: a dark slit that opens, with flaps curling outwards (eyes inside, maybe). */
  private addRip(w: { pos: THREE.Vector3; normal: THREE.Vector3 }, y: number, withEyes: boolean) {
    const g = new THREE.Group();
    g.position.copy(w.pos);
    g.rotation.y = Math.atan2(w.normal.x, w.normal.z);
    // A ragged, lens-shaped hole (jagged edges like torn cloth)
    const lens = new THREE.Shape();
    const H = 1.6;
    const pts = 9;
    lens.moveTo(0, -H);
    for (let k = 1; k < pts; k++) {
      const y = -H + (2 * H * k) / pts;
      lens.lineTo(0.55 * Math.sqrt(1 - (y / H) ** 2) + (Math.random() - 0.3) * 0.12, y);
    }
    lens.lineTo(0, H);
    for (let k = pts - 1; k > 0; k--) {
      const y = -H + (2 * H * k) / pts;
      lens.lineTo(-0.55 * Math.sqrt(1 - (y / H) ** 2) - (Math.random() - 0.3) * 0.12, y);
    }
    const slit = new THREE.Mesh(new THREE.ShapeGeometry(lens), new THREE.MeshBasicMaterial({ color: 0x030202 }));
    slit.scale.set(0.2, 0.15, 1);
    slit.position.y = y;
    g.add(slit);
    // Its eyes, watching from inside the hole
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    if (withEyes) for (const sx of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), eyeMat);
      eye.position.set(sx, 0.55, 0.01);
      slit.add(eye);
    }
    // Torn wallpaper curling out from the edges (the back of the paper is paler)
    const paper = new THREE.MeshStandardMaterial({ color: 0xc9b56a, roughness: 0.95, side: THREE.FrontSide });
    const back = new THREE.MeshStandardMaterial({ color: 0xefe6c4, roughness: 0.95, side: THREE.BackSide });
    const flaps: THREE.Mesh[] = [];
    for (let k = 0; k < 8; k++) {
      const shape = new THREE.Shape();
      const h = 0.55 + Math.random() * 0.45;
      shape.moveTo(0, 0);
      shape.lineTo(0, h);
      shape.lineTo(0.22 + Math.random() * 0.2, h * (0.55 + Math.random() * 0.3));
      shape.lineTo(0.12 + Math.random() * 0.25, h * 0.25);
      const geo = new THREE.ShapeGeometry(shape);
      const f = new THREE.Mesh(geo, paper);
      f.add(new THREE.Mesh(geo, back));
      const side = k % 2 ? 1 : -1;
      f.position.set(side * 0.12, 0.45 + Math.floor(k / 2) * 0.68, 0.03);
      f.scale.x = side;
      g.add(f);
      flaps.push(f);
    }
    this.root.add(g);
    const rip = { g, slit, flaps, t: 0 };
    this.rips.push(rip);
    return rip;
  }

  /** Old rips fade away after a while. */
  private updateRips(dt: number) {
    for (let i = this.rips.length - 1; i >= 0; i--) {
      const r = this.rips[i];
      if (this.state === 'tear' && i === this.rips.length - 1) continue;
      r.t += dt;
      if (r.t > 9) {
        disposeGroup(this.root, r.g);
        this.rips.splice(i, 1);
      }
    }
  }

  /** The maze moves and the lights fail as it gets hurt. */
  private updateRage(dt: number) {
    if (this.state === 'intro') return;
    const rage = this.rage;
    // The maze rearranges itself at 75 %, 50 % and 25 % life, then every so often when it's badly hurt
    const due = rage >= 0.25 * (this.shiftsDone + 1) && this.shiftsDone < 3;
    this.shiftCd -= dt;
    if (this.s.shiftMaze && (due || (rage >= 0.5 && this.shiftCd <= 0))) {
      if (due) this.shiftsDone++;
      this.shiftCd = THREE.MathUtils.lerp(34, 18, rage);
      const avoid = [this.c.playerPos.clone(), this.pos.clone(), ...this.c.deps.remotes().map((r) => r.pos.clone()), ...this.copies.map((c) => c.pos.clone())];
      const n = this.s.shiftMaze(avoid);
      if (n) {
        soundManager.playRumble(1);
        this.scream(0.8);
        this.c.say('¡Las paredes se mueven! El laberinto cambió de forma', 'skin-shift', 1);
        this.note('las paredes del laberinto se movieron');
      }
    }
    // Blackouts below 40 % life
    if (rage >= 0.6 && this.s.setLights) {
      this.lightT -= dt;
      if (!this.lightsOff && this.lightT <= 1 && this.lightT > 0) {
        // flicker before it goes out
        this.s.setLights(Math.sin(this.lightT * 40) > 0 ? 1 : 0);
      }
      if (this.lightT <= 0) {
        this.setBlackout(!this.lightsOff);
        this.lightT = this.lightsOff ? 3.5 + Math.random() * 2 : THREE.MathUtils.lerp(14, 7, rage) + Math.random() * 3;
      }
    }
  }

  private setBlackout(off: boolean) {
    if (off !== this.lightsOff) {
      if (off) soundManager.playPowerDown();
      else soundManager.playPowerUp();
    }
    if (off !== this.lightsOff) this.note(off ? 'se fue la luz' : 'volvió la luz');
    this.lightsOff = off;
    this.s.setLights?.(off ? 0 : 1);
    if (off) {
      soundManager.playStalkerWarning();
      this.c.say('Se fue la luz… solo ves sus ojos', 'skin-dark', 4);
    }
  }

  /** It screams and runs to the far side of the hall for a while. */
  private scare(fromSkull: boolean, away?: THREE.Vector3, tellHost = true) {
    if (this.following) {
      // The host runs it: ask it to flee (its snapshot shows it to us in a moment)
      if (tellHost) this.c.deps.send('skscare', 0, fromSkull ? 1 : 0);
      this.ensureDagger();
      return;
    }
    const p = away ?? this.c.playerPos;
    if (this.state === 'tear' && this.tearAt) {
      // Caught inside the wall: it comes out where it was going to, and runs away
      this.pos.copy(this.tearAt.pos).addScaledVector(this.tearAt.normal, 0.8);
      this.m.group.visible = true;
    }
    const h = this.s.half - 3;
    const corners = [V(h, 0, h), V(-h, 0, h), V(h, 0, -h), V(-h, 0, -h)];
    corners.sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z));
    this.fleeTo.copy(corners[0]);
    this.state = 'scared';
    this.t = fromSkull ? 9 - 2 * this.s.diff : 4;
    if (this.copy) this.endMimic(false), (this.state = 'scared');
    this.scream(0.9);
    this.ensureDagger();
    // Sometimes it runs away… other times it opens a portal in a wall or the floor and escapes
    if (Math.random() < 0.5) this.startEscape(this.t + 2);
  }

  /** It tears a portal open (in the nearest wall, or under its feet) and goes through it. */
  private startEscape(away: number) {
    const w = this.s.wallNear?.(this.pos) ?? null;
    const floor = !w || Math.random() < 0.5 || Math.hypot(w.pos.x - this.pos.x, w.pos.z - this.pos.z) > 4;
    this.portalAt = floor ? { pos: V(this.pos.x, this.s.floorY, this.pos.z), normal: V(0, 0, 0) } : { pos: w!.pos.clone(), normal: w!.normal.clone() };
    this.state = 'escape';
    this.t = ESCAPE_T;
    this.escapeAway = away;
    this.openPortal(this.portalAt);
    if (this.dist() < 24) this.c.say(floor ? '¡Abrió un portal en el suelo y se está hundiendo en él!' : '¡Abrió un portal en la pared y se mete por ahí!', 'skin-portal', 2);
  }

  /** A swirling dark portal, in a wall (a tall oval) or flat on the floor. */
  private openPortal(at: { pos: THREE.Vector3; normal: THREE.Vector3 }) {
    if (this.curPortal) this.curPortal.open = false;
    const g = new THREE.Group();
    const floor = at.normal.lengthSq() < 0.01;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshBasicMaterial({ color: 0x040106 }));
    g.add(hole);
    const rings: THREE.Mesh[] = [];
    [1.18, 0.98, 0.76, 0.52].forEach((r, k) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.05 + 0.02 * (k % 2), 6, 40, Math.PI * (1.2 + 0.25 * k)),
        new THREE.MeshBasicMaterial({ color: k % 2 ? 0xb91c1c : 0x7c3aed, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.position.z = 0.01 + k * 0.005;
      g.add(ring);
      rings.push(ring);
    });
    const holder = new THREE.Group();
    holder.add(g);
    if (floor) {
      g.rotation.x = -Math.PI / 2;
      holder.position.set(at.pos.x, this.s.floorY + 0.03, at.pos.z);
    } else {
      g.scale.set(1, 1.5, 1);
      holder.position.copy(at.pos).addScaledVector(at.normal, 0.04);
      holder.position.y = this.s.floorY + 1.75;
      holder.rotation.y = Math.atan2(at.normal.x, at.normal.z);
    }
    holder.scale.setScalar(0.01);
    this.root.add(holder);
    const portal = { g: holder, k: 0, open: true, rings };
    this.portals.push(portal);
    this.curPortal = portal;
    const vol = Math.max(0.2, 1 - at.pos.distanceTo(this.c.playerPos) / 30);
    soundManager.playRumble(vol);
    soundManager.playWhisper(vol);
  }

  /** Portals swirl, open and close. */
  private updatePortals(dt: number) {
    for (let i = this.portals.length - 1; i >= 0; i--) {
      const pt = this.portals[i];
      pt.k = THREE.MathUtils.damp(pt.k, pt.open ? 1 : 0, pt.open ? 5 : 4, dt);
      pt.g.scale.setScalar(Math.max(0.01, pt.k));
      pt.rings.forEach((r, k) => (r.rotation.z += dt * (k % 2 ? -3 : 4) * (1 + k * 0.3)));
      if (!pt.open && pt.k < 0.03) {
        disposeGroup(this.root, pt.g);
        this.portals.splice(i, 1);
        if (this.curPortal === pt) this.curPortal = null;
      }
    }
  }

  /** Somewhere away from everybody, to climb out of a portal. */
  private arrivalSpot(): THREE.Vector3 {
    const players = [this.c.playerPos, ...this.c.deps.remotes().map((r) => r.pos)];
    const cd = this.s.cellDist;
    const spots = (this.s.searchSpots ?? []).filter((q) => players.every((pp) => (cd ? cd(q, pp) >= 4 : Math.hypot(q.x - pp.x, q.z - pp.z) > 22)));
    const pick = spots.length ? spots[Math.floor(Math.random() * spots.length)] : this.fleeTo;
    return V(pick.x, this.s.floorY, pick.z);
  }

  /**
   * A new copy: somewhere in the maze out of sight (it wanders like a player looking for the
   * dagger), or — `out` given — crawling out of the wall corner at `at`.
   */
  private spawnCopy(atCorner?: THREE.Vector3, out?: THREE.Vector3): SkinCopy {
    const p = this.c.playerPos;
    let at: THREE.Vector3;
    if (atCorner) at = atCorner.clone();
    else {
      // A few rooms away from everybody, out of sight
      const cd = this.s.cellDist;
      const players = [p, ...this.c.deps.remotes().map((r) => r.pos)];
      let spots = (this.s.searchSpots ?? []).filter((q) => players.every((pp) => (cd ? cd(q, pp) >= 3 : Math.hypot(q.x - pp.x, q.z - pp.z) > 14)));
      if (!spots.length) spots = (this.s.searchSpots ?? []).filter((q) => Math.hypot(q.x - p.x, q.z - p.z) > 8);
      at = spots.length ? spots[Math.floor(Math.random() * spots.length)].clone() : this.pos.clone();
    }
    at.y = this.s.floorY;
    // A copy of you or of a friend in the party
    const looks: { name: string; look: ReturnType<CombatSystem['deps']['appearance']> }[] = [{ name: 'ti', look: this.c.deps.appearance() }];
    for (const r of this.c.deps.remotes()) if (r.look) looks.push({ name: r.username, look: r.look });
    // In a party it prefers to look like one of your friends (they're lost somewhere else in the maze)
    // In a party you only see copies of your friends (so you never know who's who); alone, of you
    const pick = looks.length > 1 ? looks[1 + Math.floor(Math.random() * (looks.length - 1))] : looks[0];
    const m = createPlayerCharacter(this.c.deps.textures, pick.look);
    m.companionSprite.visible = false;
    m.shadow.visible = false;
    const holder = new THREE.Group();
    const pitch = new THREE.Group();
    pitch.add(m.group);
    holder.add(pitch);
    holder.position.copy(at);
    this.root.add(holder);
    const mats: SkinCopy['mats'] = [];
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
      const mat = mesh.material.clone();
      mesh.material = mat;
      mats.push({ mat, base: mat.color.clone() });
    });
    const wolf = this.buildWolf(m, pick.look.hairColor, holder);
    for (const o of [wolf.snout, wolf.ears, wolf.fur, ...wolf.legs])
      o.traverse((x) => {
        const mesh = x as THREE.Mesh;
        if (mesh.isMesh && mesh.material instanceof THREE.MeshStandardMaterial && !mats.some((q) => q.mat === mesh.material)) mats.push({ mat: mesh.material, base: mesh.material.color.clone() });
      });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe14a });
    const eyes: THREE.Mesh[] = [];
    for (const sgn of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
      e.position.set(0.085 * sgn, 0.04, 0.2);
      e.visible = false;
      m.head.add(e);
      eyes.push(e);
    }
    // Same name tag as a real friend: you can't tell it apart… until it changes
    const tag = createNameTagSprite(pick.name === 'ti' ? this.c.deps.playerModel().appearance.name || 'Tú' : pick.name);
    if (!out) m.group.add(tag);
    const copy: SkinCopy = {
      m,
      holder,
      pitch,
      wolf,
      lostT: 0,
      pos: at,
      center: at.clone(),
      yaw: out ? Math.atan2(out.x, out.z) : Math.random() * Math.PI * 2,
      phase: out ? 'emerge' : 'copy',
      mode: 'roam',
      roamTo: null,
      searchT: 0,
      emerge: out ? { base: at.clone(), dir: out.clone(), k: 0, stall: 0, dustT: 0, rip: this.addRip({ pos: at.clone().addScaledVector(out, 0.12), normal: out.clone() }, 1.0, false) } : null,
      mergeAt: null,
      t: 0,
      hp: 2,
      mats,
      eyes,
      hitCd: 0,
      name: pick.name,
      tag,
      tailT: 0,
      id: ++this.copyN,
      order: null,
      bubble: null,
      bubbleT: 0,
    };
    this.copies.push(copy);
    return copy;
  }

  /**
   * Werewolf parts that grow out of a copy, made with the character's own materials: digitigrade
   * legs (trousers, bare skin, boots for paws), a long snout with teeth, pointed ears and tufts of
   * fur in the hair color, and claws on the hands.
   */
  private buildWolf(m: PlayerCharacterModel, hairColor: string, holder: THREE.Group): SkinCopy['wolf'] {
    const skin = m.head.material as THREE.MeshStandardMaterial;
    const cloth = m.body.material as THREE.MeshStandardMaterial;
    const boot = m.leftFoot.material as THREE.MeshStandardMaterial;
    const hair = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85 });
    const claw = new THREE.MeshStandardMaterial({ color: 0x1c1714, roughness: 0.35 });
    const tooth = new THREE.MeshStandardMaterial({ color: 0xf2eee3, roughness: 0.5 });
    const gum = new THREE.MeshBasicMaterial({ color: 0x2a0606 });
    /** A capsule from a to b */
    const bone = (g: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
      const len = a.distanceTo(b);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 8), mat);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };
    // Legs bent like a dog's (for a drop of 1, scaled to the real height every frame)
    const legs: THREE.Group[] = [];
    for (const sx of [0.085, -0.085]) {
      const leg = new THREE.Group();
      leg.position.x = sx;
      const hip = new THREE.Vector3(0, 0, 0);
      const knee = new THREE.Vector3(0, -0.42, 0.17);
      const hock = new THREE.Vector3(0, -0.8, -0.13);
      const paw = new THREE.Vector3(0, -0.96, 0.02);
      bone(leg, hip, knee, 0.085, cloth);
      bone(leg, knee, hock, 0.06, skin);
      bone(leg, hock, paw, 0.05, skin);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), boot);
      foot.scale.set(1, 0.55, 1.5);
      foot.position.set(0, -0.965, 0.07);
      leg.add(foot);
      for (const cx of [-0.035, 0, 0.035]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.07, 4), claw);
        c.rotation.x = Math.PI / 2;
        c.position.set(cx, -0.975, 0.18);
        leg.add(c);
      }
      leg.visible = false;
      holder.add(leg);
      legs.push(leg);
    }
    // Hips (same clothes) so the legs are joined to the body
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), cloth);
    pelvis.scale.set(1.35, 0.95, 1.1);
    pelvis.castShadow = true;
    pelvis.visible = false;
    holder.add(pelvis);
    // Long snout with teeth and a black nose
    const snout = new THREE.Group();
    snout.position.set(0, -0.06, 0.16);
    // Furry muzzle in the hair color, bare skin underneath
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.34, 8), hair);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.scale.set(1, 1, 0.8);
    muzzle.position.z = 0.14;
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.26), skin);
    jaw.position.set(0, -0.09, 0.1);
    jaw.rotation.x = 0.25;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.24), gum);
    mouth.position.set(0, -0.06, 0.12);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }));
    nose.position.set(0, 0.03, 0.31);
    snout.add(muzzle, jaw, mouth, nose);
    // Shaggy cheeks
    for (const sx of [1, -1])
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 4), hair);
        t.position.set(sx * 0.17, -0.04 - k * 0.05, -0.06);
        t.rotation.z = sx * (1.9 + k * 0.25);
        snout.add(t);
      }
    for (let k = 0; k < 5; k++)
      for (const sx of [-0.06, 0.06]) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 4), tooth);
        t.rotation.x = Math.PI;
        t.position.set(sx, -0.065, 0.02 + k * 0.05);
        snout.add(t);
      }
    snout.visible = false;
    m.head.add(snout);
    // Pointed ears (they poke through hats)
    const ears = new THREE.Group();
    for (const sx of [0.12, -0.12]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.3, 4), hair);
      ear.position.set(sx, 0.27, -0.03);
      ear.rotation.z = -sx * 1.6;
      ears.add(ear);
    }
    ears.visible = false;
    m.head.add(ears);
    // Tufts of fur along the back and on the shoulders
    const fur = new THREE.Group();
    for (let k = 0; k < 7; k++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), hair);
      t.position.set((k % 2 ? 1 : -1) * 0.03, 0.4 + k * 0.07, -0.21);
      t.rotation.x = -2.2;
      fur.add(t);
    }
    for (const sx of [0.22, -0.22])
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 4), hair);
        t.position.set(sx, 0.7, -0.05 + k * 0.06);
        t.rotation.z = -sx * 4;
        fur.add(t);
      }
    // Claws on the hands
    const claws: THREE.Object3D[] = [];
    for (const arm of [m.leftArm, m.rightArm]) {
      const cg = new THREE.Group();
      for (const cx of [-0.03, 0, 0.03]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.08, 4), claw);
        c.rotation.x = Math.PI;
        c.position.set(cx, -0.31, 0.03);
        cg.add(c);
      }
      cg.visible = false;
      arm.add(cg);
      claws.push(cg);
    }
    fur.visible = false;
    m.group.add(fur);
    const feet = [m.leftFoot.parent ?? m.leftFoot, m.rightFoot.parent ?? m.rightFoot];
    return { legs, snout, ears, fur, headGroup: m.head.parent ?? m.head, feet, claws, pelvis };
  }

  /** The copy stops pretending: it twists and stretches. */
  private reveal(c: SkinCopy, why: 'hit' | 'dark' | 'hurt' | 'boss' | 'trap' | 'late' | 'ai' = 'hit') {
    if (c.phase !== 'copy') return;
    c.phase = 'distort';
    c.t = 0;
    c.order = null;
    c.m.group.remove(c.tag);
    this.dropBubble(c);
    this.note(`la copia de ${c.name === 'ti' ? 'el jugador' : c.name} se transformó`);
    soundManager.playStalkerWarning();
    soundManager.playBoneCrack(1 - Math.min(0.8, c.pos.distanceTo(this.c.playerPos) / 40));
    const who = c.name === 'ti' ? 'tu copia' : c.name;
    const base = c.name === 'ti' ? '¡Era una copia tuya! ¡Se convierte en un hombre lobo!' : `¡No era ${c.name}! Se convierte en un hombre lobo…`;
    const msg =
      why === 'dark'
        ? `Se fue la luz… y ${who} empezó a crujir a tu lado. ¡No era ${c.name === 'ti' ? 'real' : 'tu amigo'}!`
        : why === 'boss'
          ? `¡Justo ahora! ${c.name === 'ti' ? 'Tu copia' : c.name} se retuerce mientras el Skinwalker se acerca… ¡era una copia!`
          : why === 'trap'
            ? `Te siguió hasta un callejón sin salida… ${c.name === 'ti' ? 'tu copia' : c.name} se convierte en un hombre lobo`
            : why === 'hurt'
              ? `Te vio débil… ¡${c.name === 'ti' ? 'tu copia' : c.name} no era quien creías!`
              : why === 'ai'
                ? c.name === 'ti'
                  ? 'Tu copia sonríe… y se retuerce en un hombre lobo'
                  : `${c.name} se te queda viendo… no era tu amigo. ¡Se convierte en un hombre lobo!`
                : base;
    this.c.say(msg, 'skin-reveal', 1.5);
  }

  /**
   * A copy tags along like a friend and waits for the worst moment to turn: the lights go out,
   * the Skinwalker is coming, you're low on life, or it followed you into a dead end.
   */
  private worstMoment(c: SkinCopy): 'dark' | 'hurt' | 'boss' | 'trap' | 'late' | null {
    if (this.c.isDown || c.tailT < 9) return null;
    if (this.lightsOff) return 'dark';
    if (this.c.hp <= this.c.maxHp * 0.4) return 'hurt';
    if (this.state === 'windup' || this.state === 'lunge' || this.state === 'tear' || this.state === 'feint' || this.state === 'call' || ((this.state === 'hunt' || this.state === 'stalk' || this.state === 'peek') && this.dist() < 16)) return 'boss';
    if (c.tailT > 12 && this.s.exits && this.s.exits(this.c.playerPos) <= 1) return 'trap';
    if (c.tailT > 45) return 'late';
    return null;
  }

  /** Keeps a copy out of the walls. */
  private pushOut(q: THREE.Vector3) {
    for (const o of this.s.obstacles ?? []) {
      const cx = THREE.MathUtils.clamp(q.x, o.x - o.hx, o.x + o.hx);
      const cz = THREE.MathUtils.clamp(q.z, o.z - o.hz, o.z + o.hz);
      const e = Math.hypot(q.x - cx, q.z - cz);
      if (e < 0.5 && e > 1e-4) {
        q.x = cx + ((q.x - cx) / e) * 0.5;
        q.z = cz + ((q.z - cz) / e) * 0.5;
      }
    }
  }

  private killCopy(c: SkinCopy) {
    if (c.phase === 'die') return;
    this.dropBubble(c);
    this.note('una copia fue destruida');
    c.phase = 'die';
    c.t = 0;
    this.c.addEffect(puffEffect(this.root, c.center.clone(), 'rgba(40,32,26,0.9)', 2.4, 0.5));
  }

  /** Remembers something that happened, for the AI director. */
  private note(what: string) {
    const now = performance.now();
    this.recent = this.recent.filter((r) => now - r.t < 30000).slice(-4);
    this.recent.push({ t: now, what });
  }

  /** The AI answered lately: it decides when the copies turn (the game's rules are only a backup) */
  private get aiActive(): boolean {
    return performance.now() - this.aiLive < 20000;
  }

  /**
   * Every few seconds, asks the AI director (xAI, through our server: the key never reaches the
   * browser) what each copy should do. If there's no AI, the copies follow the game's own rules.
   */
  private askDirector(dt: number) {
    if (this.aiOff || this.aiBusy || this.dead) return;
    this.aiCd -= dt;
    if (this.aiCd > 0 || !this.copies.some((c) => c.phase === 'copy' && c.mode === 'engaged')) return;
    if (!apiClient.getAccessToken()) {
      this.aiOff = true;
      return;
    }
    this.aiCd = 6;
    this.aiBusy = true;
    const p = this.c.playerPos;
    const yaw = this.c.deps.playerModel().group.rotation.y;
    const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
    const now = performance.now();
    const state = {
      hp: Math.round(this.c.hp),
      lightsOff: this.lightsOff,
      deadEnd: (this.s.exits?.(p) ?? 2) <= 1,
      hasDagger: this.has('daga'),
      hasSkull: this.has('craneo'),
      speed: Math.round(this.pSpeed * 10) / 10,
      friends: this.c.deps.remotes().length,
      boss: { state: this.state, dist: Math.round(this.dist()), rage: Math.round(this.rage * 100) / 100 },
      copies: this.copies
        .filter((c) => (c.phase === 'copy' && c.mode === 'engaged') || ((c.phase === 'hunt' || c.phase === 'distort') && c.pos.distanceTo(p) < 30))
        .map((c) => {
          const to = V(c.pos.x - p.x, 0, c.pos.z - p.z);
          const d = to.length();
          return { id: c.id, as: c.name, phase: c.phase, dist: Math.round(d * 10) / 10, tail: Math.round(c.tailT), seen: d > 0.1 && to.dot(fwd) / d > 0.5 };
        }),
      recent: this.recent.filter((r) => now - r.t < 30000).map((r) => r.what),
    };
    apiClient
      .aiSkinwalker(state)
      .then((res) => {
        if (this.dead) return;
        this.aiLive = performance.now();
        for (const o of res.copies ?? []) {
          const c = this.copies.find((q) => q.id === o.id && q.phase === 'copy' && q.mode === 'engaged');
          if (c) this.applyOrder(c, o.act);
        }
      })
      .catch((err: { status?: number }) => {
        // No AI on this server, or not allowed: don't ask again in this fight
        if (err?.status === 503 || err?.status === 401 || err?.status === 403 || err?.status === 404) this.aiOff = true;
        else this.aiCd = err?.status === 429 ? 5 : 15;
      })
      .finally(() => {
        this.aiBusy = false;
      });
  }

  /** The AI director's order for one copy. */
  private applyOrder(c: SkinCopy, act: CopyAct) {
    // (the copies never talk: they only act)
    if (act === 'gather') {
      // It leaves you "to look for the others"… to fuse with them
      if (this.gatherAt) c.mode = 'gather';
      else {
        const others = this.copies.filter((q) => q !== c && q.phase === 'copy' && q.mode === 'roam');
        if (others.length >= 2) this.startGathering([c, ...others]);
      }
      return;
    }
    c.order = { act, t: 0, spot: null };
    if (act === 'lure') c.order.spot = this.pickSpot(1, 3, true);
    if (act === 'hide') c.order.spot = this.pickSpot(3, 6, false);
    if (act === 'whisper') soundManager.playWhisper(Math.max(0.25, 1 - c.pos.distanceTo(this.c.playerPos) / 25));
  }

  /** A room some rooms away from you (dead ends first, to trap you there). */
  private pickSpot(minCells: number, maxCells: number, deadEnds: boolean): THREE.Vector3 | null {
    const p = this.c.playerPos;
    const cd = this.s.cellDist;
    let spots = (this.s.searchSpots ?? []).filter((q) => {
      const r = cd ? cd(q, p) : Math.hypot(q.x - p.x, q.z - p.z) / 6.5;
      return r >= minCells && r <= maxCells;
    });
    if (deadEnds && this.s.exits) {
      const ends = spots.filter((q) => this.s.exits!(q) === 1);
      if (ends.length) spots = ends;
    }
    if (!spots.length) return null;
    return spots[Math.floor(Math.random() * spots.length)].clone().setY(this.s.floorY);
  }

  private dropBubble(c: SkinCopy) {
    if (!c.bubble) return;
    c.m.group.remove(c.bubble);
    (c.bubble.material as THREE.SpriteMaterial).map?.dispose();
    (c.bubble.material as THREE.SpriteMaterial).dispose();
    c.bubble = null;
  }

  private updateCopies(dt: number, time: number) {
    const p = this.c.playerPos;
    // How fast you're walking (a copy keeps your pace, like a friend would)
    const ps = Math.hypot(p.x - this.prevP.x, p.z - this.prevP.z) / Math.max(dt, 1e-3);
    this.pSpeed = THREE.MathUtils.damp(this.pSpeed, ps > 30 ? 0 : ps, 6, dt);
    this.prevP.copy(p);
    for (let i = this.copies.length - 1; i >= 0; i--) {
      const c = this.copies[i];
      c.t += dt;
      c.hitCd = Math.max(0, c.hitCd - dt);
      const m = c.m;
      if (c.phase === 'die') {
        c.holder.scale.multiplyScalar(Math.max(0, 1 - dt * 5));
        if (c.t > 0.5) {
          disposeGroup(this.root, c.holder);
          this.copies.splice(i, 1);
        }
        continue;
      }
      if (c.bubble && (c.bubbleT -= dt) <= 0) this.dropBubble(c);
      const toYaw = Math.atan2(p.x - c.pos.x, p.z - c.pos.z);
      // How twisted it is: 0 = looks just like the player, 1 = a long crawling thing
      let k = 0;
      if (c.phase === 'copy' && c.mode !== 'engaged') {
        // Wandering the maze like a player looking for the dagger (or going to meet the others)…
        const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
        const cellD = this.s.cellDist ? this.s.cellDist(c.pos, p) : Math.round(d / 6.5);
        c.order = null;
        if (c.mode === 'roam' && d < 9 && cellD <= 1 && !this.c.isDown) {
          // …until it runs into you: from now on it's "your friend"
          c.mode = 'engaged';
          c.tailT = 0;
          c.lostT = 0;
          c.searchT = 0;
        } else this.roamCopy(c, dt, time);
      } else if (c.phase === 'copy') {
        // Walks to you calmly, like your friend would… and then tags along a couple of steps
        // behind you, stopping when you stop, as if it were helping you look for the dagger
        const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
        const close = d < 5 && (!this.s.cellDist || this.s.cellDist(c.pos, p) <= 1);
        // You left it behind: it goes back to wandering (and will find you again)
        const lost = d > 22 || (this.s.cellDist ? this.s.cellDist(c.pos, p) >= 4 : false);
        c.lostT = lost ? c.lostT + dt : 0;
        if (c.lostT > 4) {
          c.mode = 'roam';
          c.order = null;
          c.roamTo = null;
          c.lostT = 0;
        }
        if (close) c.tailT += dt;
        // The AI director's order (follow / lure / stare / hide / whisper / strike), if any
        const o = c.order;
        if (o) {
          o.t += dt;
          const limit = o.act === 'stare' ? 7 : o.act === 'lure' ? 14 : o.act === 'hide' ? 12 : o.act === 'strike' ? 20 : 1e9;
          if (o.t > limit || ((o.act === 'lure' || o.act === 'hide') && !o.spot)) c.order = null;
        }
        const act: CopyAct = c.order?.act ?? 'follow';
        // Where it walks and how fast
        let goal: THREE.Vector3 = p;
        let speed = !close ? 3.8 : d > 2.6 ? THREE.MathUtils.clamp(this.pSpeed + (d - 2.6) * 1.2, 1.5, 7) : 0;
        if (act === 'stare') speed = 0;
        else if ((act === 'lure' || act === 'hide') && c.order?.spot) {
          goal = c.order.spot;
          const dg = Math.hypot(goal.x - c.pos.x, goal.z - c.pos.z);
          speed = dg > 0.6 ? (act === 'hide' ? 4.6 : 4) : 0;
          // You followed it there: it goes back to tagging along
          if (act === 'lure' && Math.hypot(goal.x - p.x, goal.z - p.z) < 2.5) c.order = null;
        } else if (act === 'strike') {
          speed = d > 2 ? 5 : 0;
          if (close && d < 6) {
            this.reveal(c, this.lightsOff ? 'dark' : 'ai');
            continue;
          }
        }
        if (speed > 0) {
          const wp = this.s.navStep ? this.s.navStep(c.pos, goal) : goal;
          const wy = Math.atan2(wp.x - c.pos.x, wp.z - c.pos.z);
          c.yaw = turnTo(c.yaw, wy, 6, dt);
          c.pos.x += Math.sin(c.yaw) * speed * dt;
          c.pos.z += Math.cos(c.yaw) * speed * dt;
          this.pushOut(c.pos);
          m.updateAnimation(speed, true, dt, time);
        } else {
          c.yaw = turnTo(c.yaw, toYaw, act === 'stare' ? 2 : 6, dt);
          m.updateAnimation(0, true, dt, time);
          // Waiting where it lured you: it waves at you to come
          if (act === 'lure') {
            m.rightArm.rotation.z = -2.5 + Math.sin(time * 7) * 0.35;
            m.rightArm.rotation.x = 0;
          }
        }
        // Staring: the head tilts slowly to one side
        const head = c.wolf.headGroup;
        head.rotation.z = act === 'stare' ? Math.min(0.45, (c.order?.t ?? 0) * 0.12) : THREE.MathUtils.damp(head.rotation.z, 0, 6, dt);
        // …until the worst possible moment (the AI picks it; the game's rules are the backup)
        const why = close ? this.worstMoment(c) : null;
        if (why && (!this.aiActive || (why === 'late' && c.tailT > 70))) this.reveal(c, why);
      } else if (c.phase === 'emerge' && c.emerge) {
        // Crawling out of the wall corner: it pulls in jerks, gets stuck, pulls again
        const e = c.emerge;
        e.stall -= dt;
        if (e.stall <= 0 && Math.random() < dt * 1.4) e.stall = 0.3 + Math.random() * 0.5;
        const pulling = e.stall <= 0;
        e.k = Math.min(1, e.k + dt * (pulling ? 0.42 : 0.03));
        const off = THREE.MathUtils.lerp(-1.05, 0.85, ease(e.k));
        // The wallpaper in the corner tears open as it pushes through
        if (e.rip) {
          const o = Math.min(1, 0.25 + e.k * 1.3);
          e.rip.slit.scale.set(0.35 + o * 0.75, 0.4 + o * 0.6, 1);
          e.rip.flaps.forEach((f, fi) => (f.rotation.y = (fi % 2 ? 1 : -1) * o * 1.3 + Math.sin(time * 30 + fi) * (pulling ? 0.08 : 0.02)));
        }
        c.pos.set(e.base.x + e.dir.x * off, this.s.floorY, e.base.z + e.dir.z * off);
        c.yaw = Math.atan2(e.dir.x, e.dir.z);
        e.dustT -= dt;
        if (e.dustT <= 0 && pulling) {
          e.dustT = 0.35 + Math.random() * 0.4;
          this.c.addEffect(puffEffect(this.root, e.base.clone().add(V(0, 0.6 + Math.random() * 1.2, 0)), 'rgba(205,190,120,0.7)', 0.8, 0.35));
          const vol = Math.max(0.15, 1 - c.pos.distanceTo(p) / 25);
          if (Math.random() < 0.5) soundManager.playRip(0.3 * vol);
          else soundManager.playBoneCrack(0.5 * vol);
        }
        m.updateAnimation(0, true, dt, time);
        if (e.k >= 1) {
          // Free: it straightens up… and turns into a werewolf
          c.emerge = null;
          c.phase = 'distort';
          c.t = 0;
          c.wolf.headGroup.rotation.y = 0;
          soundManager.playBoneCrack(1);
        }
      } else if (c.phase === 'merge' && c.mergeAt) {
        // Fusing: dragged toward the others, spinning and twisting into each other
        const at = c.mergeAt;
        const pull = Math.min(1, c.t / 2.2);
        c.pos.x = THREE.MathUtils.lerp(c.pos.x, at.x, Math.min(1, dt * (0.6 + 2.4 * pull)));
        c.pos.z = THREE.MathUtils.lerp(c.pos.z, at.z, Math.min(1, dt * (0.6 + 2.4 * pull)));
        c.yaw += dt * (1.5 + 7 * pull) * (c.id % 2 ? 1 : -1);
        k = ease(Math.min(1, c.t / 1.6)) * 0.85;
        m.updateAnimation(0, true, dt, time);
      } else if (c.phase === 'distort') {
        k = ease(Math.min(1, c.t / 1.4));
        if (c.t > 1.4) {
          c.phase = 'hunt';
          c.t = 0;
          c.lostT = 0;
        }
      } else if (c.phase === 'revert') {
        // Far from you, it shrinks back into your friend's shape… and comes to fool you again
        k = 1 - ease(Math.min(1, c.t / 1.2));
        if (c.t > 1.2) {
          c.phase = 'copy';
          c.mode = 'roam';
          c.roamTo = null;
          c.t = 0;
          c.tailT = 0;
          c.order = null;
          m.group.add(c.tag);
          for (const f of c.wolf.feet) f.visible = true;
        }
      } else {
        k = 1;
        // Lost in Nubi's fog: they sniff around instead of chasing you
        const goal = this.fogT > 0 ? this.s.home : p;
        const wp = this.s.navStep ? this.s.navStep(c.pos, goal) : goal;
        c.yaw = turnTo(c.yaw, Math.atan2(wp.x - c.pos.x, wp.z - c.pos.z), 6, dt);
        const sp = (5.4 + 1.3 * this.s.diff) * (this.fogT > 0 ? 0.4 : 1);
        c.pos.x += Math.sin(c.yaw) * sp * dt;
        c.pos.z += Math.cos(c.yaw) * sp * dt;
        // around the pillars
        this.pushOut(c.pos);
        const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
        // You got away: if it stays far from you for a moment, it turns back into a copy
        const far = d > 20 || (this.s.cellDist ? this.s.cellDist(c.pos, p) >= 5 : false);
        c.lostT = far ? c.lostT + dt : 0;
        if (c.lostT > 1.5) {
          c.phase = 'revert';
          soundManager.playWhisper(0.6);
          c.t = 0;
          c.lostT = 0;
          this.c.say('Te alejaste y la copia volvió a parecer normal… cuidado con quién se te acerque', 'skin-revert', 10);
        }
        if (this.guarding(c.pos)) {
          this.c.say('¡Quetsy se comió una copia!', 'skin-jade-copy', 2);
          this.killCopy(c);
          continue;
        }
        if (d < 2.0 && Math.abs(p.y - c.pos.y) < 2.4 && !this.c.isDown && this.fogT <= 0) {
          this.c.damagePlayer(10 + 4 * this.s.diff, c.pos, 9, 4, 'copy');
          this.killCopy(c);
          continue;
        }
      }
      // Turn into a tall, hunched werewolf that still wears the character's clothes
      const S = 1 + 0.75 * k;
      const lift = 0.78 * k;
      const HIP = 0.26;
      const running = c.phase === 'hunt';
      const stride = running ? time * 11 + i : 0;
      const shiver = c.phase === 'distort' || c.phase === 'revert' ? Math.sin(time * 50) * 0.02 * k : 0;
      c.holder.position.set(c.pos.x + shiver, c.pos.y + (running ? Math.abs(Math.sin(stride)) * 0.06 * S : 0), c.pos.z);
      c.holder.rotation.set(0, c.yaw, 0, 'YXZ');
      c.holder.scale.setScalar(S);
      // Upper body: pivots at the hips, hunched forward, a bit taller and thinner
      c.pitch.position.set(0, (lift + HIP) * k, 0);
      c.pitch.rotation.x = 0.5 * k + (running ? Math.sin(stride * 2) * 0.05 : 0);
      c.pitch.scale.set(1 - 0.12 * k, 1 + 0.3 * k, 1 - 0.05 * k);
      m.group.position.y = -HIP * k;
      // Head held up and forward, looking at you
      const W = c.wolf;
      const hb = -0.5 * k;
      if (k > 0.001) {
        W.headGroup.rotation.x = hb;
        W.headGroup.position.set(0, 0.95 - 0.95 * Math.cos(hb), -0.95 * Math.sin(hb));
      } else {
        W.headGroup.rotation.x = 0;
      }
      W.snout.visible = W.ears.visible = W.fur.visible = k > 0.05;
      for (const cg of W.claws) cg.visible = k > 0.05;
      W.snout.scale.set(k, k, k * (1 + 0.3 * k));
      (W.snout.children[1] as THREE.Mesh).rotation.x = running ? 0.25 + Math.max(0, Math.sin(time * 7 + i)) * 0.35 : 0.3;
      W.ears.scale.setScalar(k);
      W.fur.scale.setScalar(Math.max(0.01, k));
      for (const f of W.feet) f.visible = k < 0.3;
      W.pelvis.visible = k > 0.08;
      W.pelvis.position.set(0, lift + HIP + 0.02, 0.03);
      W.pelvis.scale.set(1.35 * k, 0.95 * k, 1.1 * k);
      W.legs.forEach((leg, li) => {
        leg.visible = k > 0.08;
        leg.position.set(li ? -0.085 : 0.085, lift + HIP - 0.02, 0.03);
        leg.scale.setScalar(Math.max(0.01, lift + HIP));
        leg.rotation.x = running ? Math.sin(stride + li * Math.PI) * 0.55 : 0;
      });
      // Long arms hanging to the knees, swinging as it runs (as a copy, it walks like your friend)
      m.leftArm.scale.y = m.rightArm.scale.y = 1 + 2.1 * k;
      if (k > 0.001) {
        m.leftArm.rotation.x = -0.25 * k + (running ? Math.sin(stride + Math.PI) * 0.6 : 0);
        m.rightArm.rotation.x = -0.25 * k + (running ? Math.sin(stride) * 0.6 : 0);
        m.leftArm.rotation.z = 0.12 + 0.15 * k;
        m.rightArm.rotation.z = -0.12 - 0.15 * k;
      }
      for (const e of c.eyes) e.visible = k > 0.3;
      // Same clothes and colors, just a little grimier
      for (const { mat, base } of c.mats) {
        mat.color.copy(base).lerp(new THREE.Color(0x3a322c), 0.15 * k);
        mat.emissive.setHex(0x000000);
      }
      c.center.set(c.pos.x, c.pos.y + (0.75 + lift + HIP * k) * S, c.pos.z);

      if (c.phase === 'copy' && c.mode === 'roam' && c.searchT > 0) {
        // "Searching": crouching to look at the floor, a hand along the wall
        const crouch = Math.max(0, Math.sin(time * 0.9 + c.id * 2));
        c.pitch.rotation.x = crouch * 0.5;
        m.rightArm.rotation.x = -0.4 - crouch * 0.9;
      } else if (c.phase === 'emerge' && c.emerge) {
        // Straining out of the corner: arms out to both sides clawing at the two walls,
        // legs kicking inside, the head thrashing
        const e = c.emerge;
        const pulling = e.stall <= 0;
        const w = time * (pulling ? 9 : 24);
        c.pitch.rotation.x = 0.8 - 0.5 * e.k + Math.sin(w) * (pulling ? 0.07 : 0.03);
        m.leftArm.rotation.x = -1.75 + Math.sin(w) * 0.5;
        m.rightArm.rotation.x = -1.75 + Math.sin(w + Math.PI) * 0.5;
        m.leftArm.rotation.z = 0.95 + Math.sin(w * 0.7) * 0.25;
        m.rightArm.rotation.z = -0.95 - Math.sin(w * 0.7 + 1) * 0.25;
        W.feet[0].rotation.x = Math.sin(w * 1.3) * 0.9;
        W.feet[1].rotation.x = Math.sin(w * 1.3 + Math.PI) * 0.9;
        W.headGroup.rotation.z = Math.sin(time * 15) * 0.4 * (1 - e.k);
        W.headGroup.rotation.y = Math.sin(time * 11) * 0.35 * (1 - e.k);
      } else if (c.phase === 'merge') {
        // Twisting into each other: limbs flailing, bodies stretching
        const f = Math.min(1, c.t / 2.4);
        m.leftArm.rotation.x = -1.2 + Math.sin(time * 13 + c.id) * 1.2;
        m.rightArm.rotation.x = -1.2 + Math.sin(time * 11 + c.id * 2) * 1.2;
        m.leftArm.rotation.z = 0.6 + Math.sin(time * 9) * 0.5;
        m.rightArm.rotation.z = -0.6 - Math.sin(time * 8) * 0.5;
        c.pitch.rotation.x += Math.sin(time * 17 + c.id) * 0.25 * f;
        c.holder.scale.set(S * (1 - 0.35 * f), S * (1 + 0.6 * f), S * (1 - 0.35 * f));
      }
    }
  }

  /**
   * A copy wandering the maze like a player looking for the dagger: it walks from room to room,
   * stops to "search" (looks around, crouches, runs a hand along the wall) and moves on. When it's
   * going to meet the others, it walks straight there.
   */
  private roamCopy(c: SkinCopy, dt: number, time: number) {
    const m = c.m;
    if (c.mode === 'gather' && !this.gatherAt) c.mode = 'roam';
    const gathering = c.mode === 'gather' && this.gatherAt;
    if (!gathering && c.searchT > 0) {
      c.searchT -= dt;
      c.yaw += Math.sin(time * 1.3 + c.id) * dt * 1.4;
      m.updateAnimation(0, true, dt, time);
      if (c.searchT <= 0) c.roamTo = null;
      return;
    }
    if (!gathering && !c.roamTo) {
      const cd = this.s.cellDist;
      const spots = (this.s.searchSpots ?? []).filter((q) => {
        const r = cd ? cd(q, c.pos) : Math.hypot(q.x - c.pos.x, q.z - c.pos.z) / 6.5;
        return r >= 1 && r <= 4;
      });
      c.roamTo = spots.length ? spots[Math.floor(Math.random() * spots.length)].clone().setY(this.s.floorY) : null;
    }
    const goal = gathering ? this.gatherAt! : c.roamTo;
    if (!goal) {
      m.updateAnimation(0, true, dt, time);
      return;
    }
    const dg = Math.hypot(goal.x - c.pos.x, goal.z - c.pos.z);
    if (dg < (gathering ? 1.2 : 0.7)) {
      if (gathering) {
        // Waiting for the others, twitching
        c.yaw = turnTo(c.yaw, Math.atan2(goal.x - c.pos.x, goal.z - c.pos.z) + Math.PI, 3, dt);
        m.updateAnimation(0, true, dt, time);
      } else c.searchT = 1.8 + Math.random() * 2.6;
      return;
    }
    const speed = gathering ? 4.2 : 3.0;
    const wp = this.s.navStep ? this.s.navStep(c.pos, goal) : goal;
    c.yaw = turnTo(c.yaw, Math.atan2(wp.x - c.pos.x, wp.z - c.pos.z), 6, dt);
    c.pos.x += Math.sin(c.yaw) * speed * dt;
    c.pos.z += Math.cos(c.yaw) * speed * dt;
    this.pushOut(c.pos);
    m.updateAnimation(speed, true, dt, time);
  }

  /**
   * Copies that get together fuse into a Nahual. Three copies that happen to meet fuse on the
   * spot; and every so often the wandering copies arrange to meet in a room near you.
   */
  private updateGathering(dt: number) {
    if (this.dead) return;
    const fakes = this.copies.filter((c) => c.phase === 'copy');
    const merging = this.copies.filter((c) => c.phase === 'merge');
    if (merging.length) {
      if (merging.some((c) => c.t > 2.4)) this.finishMerge(merging);
      return;
    }
    if (this.nahuales.some((n) => n.state !== 'die')) return;
    for (const c of fakes) {
      const near = fakes.filter((o) => Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) < 3.2);
      if (near.length >= 3) {
        this.startMerge(near.slice(0, 4));
        return;
      }
    }
    this.gatherCd -= dt;
    const roamers = fakes.filter((c) => c.mode === 'roam');
    if (!this.gatherAt && this.gatherCd <= 0 && roamers.length >= 3) this.startGathering(roamers);
    if (this.gatherAt) {
      this.gatherT += dt;
      const at = this.gatherAt;
      const there = fakes.filter((c) => c.mode === 'gather' && Math.hypot(c.pos.x - at.x, c.pos.z - at.z) < 3);
      if (there.length >= 3) this.startMerge(there);
      else if (this.gatherT > 40) {
        this.gatherAt = null;
        this.gatherCd = 30;
      }
    }
  }

  /** The wandering copies agree to meet in a room a couple of rooms from you. */
  private startGathering(cands: SkinCopy[]) {
    const p = this.c.playerPos;
    const cd = this.s.cellDist;
    const spots = (this.s.searchSpots ?? []).filter((q) => {
      const r = cd ? cd(q, p) : Math.hypot(q.x - p.x, q.z - p.z) / 6.5;
      return r >= 2 && r <= 3;
    });
    if (!spots.length) return;
    const at = spots[Math.floor(Math.random() * spots.length)].clone().setY(this.s.floorY);
    const dist = (c: SkinCopy) => (cd ? cd(c.pos, at) : c.pos.distanceTo(at));
    const group = cands.slice().sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    if (group.length < 3) return;
    this.gatherAt = at;
    this.gatherT = 0;
    this.gatherCd = THREE.MathUtils.lerp(70, 40, this.rage) * (0.8 + Math.random() * 0.4);
    for (const c of group) {
      c.mode = 'gather';
      c.searchT = 0;
      c.order = null;
    }
    if (Math.hypot(at.x - p.x, at.z - p.z) < 26) this.c.say('Varios "jugadores" caminan hacia el mismo cuarto… algo no está bien', 'skin-gather', 20);
  }

  /** They found each other: they start twisting into one thing. */
  private startMerge(group: SkinCopy[]) {
    const at = V();
    for (const c of group) at.add(c.pos);
    at.multiplyScalar(1 / group.length).setY(this.s.floorY);
    for (const c of group) {
      c.phase = 'merge';
      c.t = 0;
      c.mergeAt = at;
      c.order = null;
      c.mode = 'roam';
      c.m.group.remove(c.tag);
      this.dropBubble(c);
    }
    this.gatherAt = null;
    for (const c of this.copies) if (c.mode === 'gather') c.mode = 'roam';
    const d = Math.hypot(at.x - this.c.playerPos.x, at.z - this.c.playerPos.z);
    soundManager.playStalkerWarning();
    soundManager.playBoneCrack(Math.max(0.25, 1 - d / 35));
    if (d < 30) this.c.say('¡Las copias se están juntando… se retuercen unas con otras!', 'skin-merge', 3);
    this.note('varias copias se están fusionando');
  }

  /** …and become a Nahual (if one of them was beaten in time, the rest just turn into werewolves). */
  private finishMerge(group: SkinCopy[]) {
    const at = group[0].mergeAt ?? group[0].pos.clone();
    if (group.length < 2) {
      for (const c of group) {
        c.phase = 'distort';
        c.t = 0;
        c.holder.scale.setScalar(1);
      }
      return;
    }
    // Rags of their clothes stay on it
    const scraps = group.flatMap((c) => c.mats.slice(0, 2).map((x) => x.mat.clone()));
    for (const c of group) {
      const i = this.copies.indexOf(c);
      if (i >= 0) this.copies.splice(i, 1);
      disposeGroup(this.root, c.holder);
    }
    this.c.addEffect(burstEffect(this.root, at.clone().add(V(0, 1.4, 0)), new THREE.MeshBasicMaterial({ color: 0xd6d0c4 }), 18, 0.2, 6, 1));
    const m = createNahual(scraps);
    this.root.add(m.group);
    m.group.position.copy(at);
    const n: Nahual = { m, pos: at.clone(), center: at.clone().add(V(0, 2.4, 0)), yaw: Math.atan2(this.c.playerPos.x - at.x, this.c.playerPos.z - at.z), state: 'rise', t: 0, hp: 6, life: 45, hitCd: 0, swiped: false, stride: 0 };
    this.nahuales.push(n);
    const d = Math.hypot(at.x - this.c.playerPos.x, at.z - this.c.playerPos.z);
    soundManager.playScream(Math.max(0.3, 1 - d / 40));
    if (d < 30) this.c.say('¡Se volvieron UNA SOLA COSA… alta, flaca, con brazos larguísimos! ¡Un Nahual! Corre o pégale', 'skin-nahual', 3);
    else this.c.say('A lo lejos se escuchan huesos tronando… algo enorme se levantó en el laberinto', 'skin-nahual', 3);
    this.note('las copias se fusionaron en un Nahual');
  }

  /** The Nahual: it rises, walks toward you with long strides, then charges and swipes with its long arms. */
  private updateNahuales(dt: number, time: number) {
    const p = this.c.playerPos;
    for (let i = this.nahuales.length - 1; i >= 0; i--) {
      const n = this.nahuales[i];
      const M = n.m;
      n.t += dt;
      n.hitCd = Math.max(0, n.hitCd - dt);
      if (n.state === 'die') {
        // It falls apart: shrinks and sinks, leaving dust
        M.group.scale.y = Math.max(0.01, M.group.scale.y - dt * 0.9);
        M.torso.rotation.x += dt * 0.8;
        if (n.t > 1.2) {
          this.c.addEffect(puffEffect(this.root, n.pos.clone().add(V(0, 0.6, 0)), 'rgba(220,214,200,0.85)', 3, 0.6));
          disposeGroup(this.root, M.group);
          this.nahuales.splice(i, 1);
        }
        continue;
      }
      n.life -= dt;
      if (n.life <= 0 || this.dead) {
        this.killNahual(n, this.dead ? '' : 'El Nahual se desmoronó… no aguanta mucho tiempo junto');
        continue;
      }
      const dx = p.x - n.pos.x;
      const dz = p.z - n.pos.z;
      const d = Math.hypot(dx, dz);
      const near = !this.s.cellDist || this.s.cellDist(n.pos, p) <= 1;
      let speed = 0;
      const toward = (goal: THREE.Vector3, sp: number) => {
        const wp = this.s.navStep ? this.s.navStep(n.pos, goal) : goal;
        n.yaw = turnTo(n.yaw, Math.atan2(wp.x - n.pos.x, wp.z - n.pos.z), 5, dt);
        n.pos.x += Math.sin(n.yaw) * sp * dt;
        n.pos.z += Math.cos(n.yaw) * sp * dt;
        this.pushOut(n.pos);
        speed = sp;
      };
      switch (n.state) {
        case 'rise':
          // Unfolds out of the heap of copies, taller and taller
          M.group.scale.set(1, Math.min(1, 0.3 + n.t / 1.6 * 0.7), 1);
          if (n.t > 1.6) {
            n.state = 'stalk';
            n.t = 0;
            M.group.scale.set(1, 1, 1);
          }
          break;
        case 'stalk':
          toward(this.fogT > 0 ? this.s.home : p, 2.6);
          if (d < 12 && near && this.fogT <= 0 && !this.c.isDown) {
            n.state = 'charge';
            n.t = 0;
            soundManager.playScream(0.7);
          }
          break;
        case 'charge':
          toward(p, 7.2 + 1.4 * this.s.diff);
          if (d < 2.9 && !this.c.isDown) {
            n.state = 'swipe';
            n.t = 0;
            n.swiped = false;
          } else if (d > 22 || this.fogT > 0) n.state = 'stalk';
          break;
        case 'swipe':
          n.yaw = turnTo(n.yaw, Math.atan2(dx, dz), 10, dt);
          if (n.t > 0.32 && !n.swiped) {
            n.swiped = true;
            if (d < 3.3 && Math.abs(p.y - n.pos.y) < 2.6 && !this.c.isDown) {
              if (this.guarding(n.pos)) {
                this.c.say('¡Quetsy mordió al Nahual!', 'skin-jade-nahual', 2);
                n.state = 'recover';
                n.t = -1.5;
                break;
              }
              this.c.damagePlayer(20 + 8 * this.s.diff, n.pos, 13, 6, 'claw');
            }
          }
          if (n.t > 0.75) {
            n.state = 'recover';
            n.t = 0;
          }
          break;
        case 'recover':
          if (n.t > 0.9) n.state = d < 14 ? 'charge' : 'stalk';
          break;
      }
      // Long, loping strides; the arms swing almost to the floor
      n.stride += dt * speed * 1.6;
      const st = n.stride;
      const run = n.state === 'charge';
      M.legs.forEach((l, li) => {
        const ph = st + li * Math.PI;
        l.hip.rotation.x = speed > 0 ? Math.sin(ph) * (run ? 0.7 : 0.45) : 0;
        l.knee.rotation.x = speed > 0 ? Math.max(0, -Math.cos(ph)) * (run ? 1.1 : 0.7) : 0.05;
      });
      M.arms.forEach((a, ai) => {
        const ph = st + ai * Math.PI;
        let ax = speed > 0 ? Math.sin(ph) * (run ? 0.7 : 0.35) - (run ? 0.6 : 0) : Math.sin(time * 1.3 + ai) * 0.06;
        let ex = run ? -0.5 : -0.15;
        if (n.state === 'swipe' && ai === 1) {
          // the right arm sweeps across
          const k = Math.min(1, n.t / 0.45);
          ax = -2.4 + k * 2.9;
          ex = -0.2;
        }
        a.shoulder.rotation.x = ax;
        a.elbow.rotation.x = ex;
      });
      M.torso.rotation.x = THREE.MathUtils.damp(M.torso.rotation.x, (run ? 0.75 : 0.42) + Math.sin(st * 2) * 0.04, 6, dt);
      M.torso.rotation.z = Math.sin(st) * 0.06;
      // The head tilts like a curious dog… with sudden snaps
      M.neck.rotation.z = Math.sin(time * 0.7 + i) * 0.3 + (Math.sin(time * 5.3) > 0.97 ? 0.5 : 0);
      M.neck.rotation.x = -M.torso.rotation.x * 0.8;
      M.jaw.rotation.x = n.state === 'rise' || n.state === 'swipe' || run ? 0.45 + Math.sin(time * 20) * 0.08 : 0.05;
      M.group.position.set(n.pos.x, this.s.floorY + (speed > 0 ? Math.abs(Math.sin(st)) * 0.08 : 0), n.pos.z);
      M.group.rotation.y = n.yaw;
      n.center.set(n.pos.x, this.s.floorY + 2.4, n.pos.z);
    }
  }

  private killNahual(n: Nahual, msg: string) {
    if (n.state === 'die') return;
    n.state = 'die';
    n.t = 0;
    soundManager.playBoneCrack(1);
    if (msg && n.pos.distanceTo(this.c.playerPos) < 30) this.c.say(msg, 'skin-nahual-end', 2);
    this.note('el Nahual se deshizo');
  }

  useItem(type: ItemType): ToolResult {
    const d = this.dist();
    if (this.dead) return 'none';
    if (type === 'craneo') {
      // Works when the Skinwalker or any of its copies is close
      const p = this.c.playerPos;
      const nearCopy = this.copies.some((c) => c.phase !== 'die' && c.pos.distanceTo(p) < 14);
      const nearBoss = d <= 13 && this.state !== 'scared' && this.state !== 'intro';
      if (!nearCopy && !nearBoss) {
        this.c.say('No hay nada cerca: úsalo cuando el Skinwalker o una copia se acerquen', 'skin-skull-far', 2);
        return 'none';
      }
      if (this.skulls.some((s) => s.mine && !s.flashed)) return 'none';
      this.startSkull(() => this.c.playerPos, true);
      this.note('el jugador usó el cráneo de obsidiana');
      this.c.deps.send('skull');
      return 'wear';
    }
    if (type === 'daga') {
      if (d > 3.3 || this.state === 'intro' || this.state === 'gone' || this.state === 'escape') {
        this.c.say('Acércate más… cuando se lance contra ti, ¡apuñálalo!', 'skin-dagger-far', 2);
        return 'none';
      }
      if (this.state === 'mimic') this.endMimic(false);
      this.c.damageBoss(25);
      this.c.addEffect(burstEffect(this.root, this.center.clone(), new THREE.MeshBasicMaterial({ color: 0xa855f7 }), 14, 0.15, 6, 0.8));
      this.state = 'hurt';
      this.t = 1.1;
      this.lungeDir.set(this.c.playerPos.x - this.pos.x, 0, this.c.playerPos.z - this.pos.z).normalize();
      if (this.following) {
        this.holdT = 0.8;
        this.c.deps.send('skhit');
      }
      this.c.say('¡Lo heriste! La daga se quedó en su piel… pronto aparecerá otra', 'skin-stab', 1);
      // The dagger is gone: the next one shows up in a while (the same one for the whole party)
      this.daggerHeldBy = null;
      this.daggerN++;
      this.daggerDelay = 4;
      this.c.deps.send('dagused', this.daggerN);
      return 'wear';
    }
    return 'none';
  }

  targets(out: AimTarget[]) {
    if (this.dead) return;
    if (this.state !== 'tear' && this.state !== 'gone' && this.state !== 'escape')
      out.push({
        pos: this.center,
        radius: 1.35,
        accepts: ['bate', 'piedra', 'stomp'],
        top: this.pos.y + 3.0 - 0.9 * this.crawlK,
        hit: () => {
          if (this.hitCd > 0) return;
          this.hitCd = 0.5;
          this.c.say('Nada lo lastima… solo la daga de obsidiana', 'skin-immune', 3);
        },
      });
    // The Nahual: a few good hits bring it down
    for (const n of this.nahuales) {
      if (n.state === 'die' || n.state === 'rise') continue;
      out.push({
        pos: n.center,
        radius: 1.3,
        accepts: ['bate', 'piedra', 'stomp', 'red', 'bomba'],
        top: n.center.y + 1.3,
        priority: 0.3,
        hit: (kind) => {
          if (n.hitCd > 0) return;
          n.hitCd = 0.35;
          n.hp -= kind === 'bomba' ? 3 : kind === 'piedra' ? 1 : 2;
          this.c.addEffect(puffEffect(this.root, n.center.clone(), 'rgba(235,230,220,0.85)', 1.4, 0.3));
          if (n.hp <= 0) this.killNahual(n, '¡Derribaste al Nahual! Se deshace en pedazos de copias');
          else if (n.state !== 'swipe') {
            n.state = 'recover';
            n.t = 0.3;
          }
        },
      });
    }
    // Its copies can be beaten with anything
    for (const c of this.copies) {
      if (c.phase === 'die') continue;
      out.push({
        pos: c.center,
        radius: c.phase === 'copy' ? 0.9 : 1.3,
        accepts: ['bate', 'piedra', 'stomp', 'red', 'bomba'],
        top: c.center.y + (c.phase === 'copy' ? 0.4 : 0.6),
        priority: 0.2,
        hit: (kind) => {
          if (c.hitCd > 0) return;
          c.hitCd = 0.3;
          this.reveal(c);
          c.hp -= kind === 'piedra' ? 1 : 2;
          if (c.hp <= 0) this.killCopy(c);
          else this.c.addEffect(puffEffect(this.root, c.center.clone(), 'rgba(255,255,255,0.8)', 1.2, 0.3));
        },
      });
    }
  }

  companionAction(c: CompanionStyle): CompanionAction | null {
    const me = () => this.c.playerPos;
    const him = () => this.center;
    switch (c) {
      case 'nube':
        return {
          name: 'Niebla',
          desc: 'Nubi te esconde en la niebla: él y sus perros pierden tu rastro por 8 s',
          target: me,
          run: () => {
            this.fogT = 8;
            if (this.following) this.c.deps.send('skfog');
            else if ((this.state === 'windup' || this.state === 'lunge') && this.tgtId === null) {
              this.state = 'recover';
              this.t = 0.9;
            }
            this.retargetT = 0;
          },
        };
      case 'estrella':
        return {
          name: 'Destello',
          desc: 'Un destello como el del cráneo: lo espanta y deshace a los perros cercanos',
          target: him,
          run: () => {
            let n = 0;
            for (const cp of this.copies)
              if (cp.phase !== 'die' && cp.pos.distanceTo(this.c.playerPos) < 16) {
                this.killCopy(cp);
                n++;
              }
            for (const nh of this.nahuales)
              if (nh.state !== 'die' && nh.pos.distanceTo(this.c.playerPos) < 16) {
                this.killNahual(nh, '¡El destello deshizo al Nahual!');
                n++;
              }
            if (this.state === 'scared' || this.state === 'intro') this.c.say(n ? '¡El destello deshizo a las copias!' : 'Ahora no hace falta', 'act-skin', 1);
            else this.scare(true);
          },
        };
      case 'luciernaga':
        return {
          name: 'Rastro de luz',
          desc: 'Chispa vuela hasta la daga (o hace aparecer una) y su luz desenmascara a las copias',
          target: () => {
            this.ensureDagger();
            return this.daggerAt ?? me();
          },
          run: () => {
            this.ensureDagger();
            const fakes = this.copies.filter((cp) => cp.phase === 'copy');
            fakes.forEach((cp) => this.reveal(cp));
            if (fakes.length) this.c.say(`¡La luz de Chispa desenmascaró ${fakes.length === 1 ? 'una copia' : fakes.length + ' copias'}!`, 'act-unmask', 1);
          },
        };
      case 'catarina':
        return {
          name: 'Caparazón',
          desc: 'Ni sus garras ni las mordidas de los perros te hacen daño por 10 s',
          target: me,
          run: () => {
            this.c.immunity('claw', 10);
            this.c.immunity('copy', 10);
          },
        };
      case 'hada':
        return {
          name: 'Polvo de hada',
          desc: 'Te da un cráneo de obsidiana nuevo (y una daga si aún no la encuentras)',
          target: me,
          run: () => {
            this.gift('craneo');
            // …and brings you the dagger if it's lying somewhere (or makes one, if nobody has it)
            if (!this.has('daga') && (!this.daggerHeldBy || this.daggerHeldBy === 'me') && this.daggerDelay <= 0) {
              if (this.daggerAt) this.c.deps.items.takeLying('daga', this.daggerAt, 3);
              this.daggerAt = null;
              this.gift('daga');
            }
          },
        };
      case 'serpiente':
        return {
          name: 'Guardiana emplumada',
          desc: 'Quetsy se come a los perros cercanos y, por 12 s, muerde al Skinwalker si se lanza y a cualquier copia que se acerque',
          target: me,
          run: () => {
            this.c.guardT = 12;
            let n = 0;
            for (const cp of this.copies)
              if (cp.phase !== 'die' && cp.pos.distanceTo(this.c.playerPos) < 8) {
                this.killCopy(cp);
                n++;
              }
            if (n) this.c.say(`¡Quetsy se comió ${n === 1 ? 'una copia' : n + ' copias'}!`, 'act-quetsy', 1);
          },
        };
      default:
        return null;
    }
  }

  onTimeStop() {
    // Frozen in time, the copies can't hold their disguise
    for (const cp of this.copies) if (cp.phase === 'copy') this.reveal(cp);
    if (this.copy) this.endMimic(false);
    if (this.state === 'windup' || this.state === 'lunge') this.state = 'recover';
  }

  hint(): string {
    if (this.state === 'intro') return 'Algo se mueve entre los cuartos amarillos…';
    if (this.state === 'mimic') return '¿Eres tú? No te acerques: ¡espántalo o prepárate!';
    if (this.state === 'scared') return this.has('daga') ? 'Tienes la daga: espera a que vuelva' : 'Huyó: busca la daga de obsidiana (brillo morado)';
    if (this.state === 'hurt') return '¡Le diste! Ahora huirá un momento';
    if (this.state === 'gone' || this.state === 'escape') return 'Se fue por un portal… volverá por otro lado. Aprovecha para buscar la daga (brillo morado)';
    if (this.nahuales.some((n) => n.state !== 'die')) return '¡Un Nahual! Pégale con el bate o piedras, usa el cráneo… o huye: no dura mucho';
    if (this.state === 'peek') return 'Te mira desde el fondo del pasillo… si vas hacia él, huye';
    if (this.state === 'feint') return '¡Viene corriendo! A veces solo juega contigo… a veces no';
    if (this.state === 'stalk' && !this.has('daga')) return 'Te está acechando, como un cazador. Busca la daga (brillo morado) y desconfía de quien veas';
    if (this.has('daga')) return 'Déjalo acercarse y usa la daga cuando lo tengas enfrente';
    if (this.copies.some((c) => c.phase === 'hunt')) return '¡Un hombre lobo te persigue! Pégale con el bate o piedras… o aléjate y volverá a ser una copia';
    if (this.has('craneo')) return 'Cuando se acerque, usa el cráneo de obsidiana para espantarlo';
    return 'Toma un cráneo de obsidiana (brillo violeta) y escapa de él';
  }

  syncObjects(): THREE.Object3D[] {
    return [this.group];
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    if (this.copy) this.endMimic(false);
    for (const c of this.copies) this.killCopy(c);
    for (const n of this.nahuales) this.killNahual(n, '');
    this.beam.visible = false;
    this.c.darknessTarget = 0;
    if (instant) this.group.visible = false;
  }

  dispose() {
    this.root.remove(this.beam);
    for (const c of this.copies) disposeGroup(this.root, c.holder);
    this.copies = [];
    for (const n of this.nahuales) disposeGroup(this.root, n.m.group);
    this.nahuales = [];
    for (const pt of this.portals) disposeGroup(this.root, pt.g);
    this.portals = [];
    super.dispose();
  }
}

export function createBossController(c: CombatSystem): BossController {
  switch (c.setup.kind) {
    case 'bird':
      return new BirdBoss(c);
    case 'glitch':
      return new GlitchBoss(c);
    case 'ufo':
      return new UfoBoss(c);
    case 'skeleton':
      return new SkeletonBoss(c);
    case 'gnome':
      return new GnomeBoss(c);
    case 'dracula':
      return new DraculaBoss(c);
    case 'skinwalker':
      return new SkinwalkerBoss(c);
  }
}
