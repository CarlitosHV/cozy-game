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
import type { ItemType } from './items';
import { burstEffect, makeTelegraph, puffEffect, Telegraph } from './combatFx';
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
import { makeNetWrap, makeStone } from './toolModels';

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

  onEvent(_kind: string, _i: number, _v: number, _from: string) {}

  /** The special move each companion has against this boss (see the table in each boss). */
  companionAction(_c: CompanionStyle): CompanionAction | null {
    return null;
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

  /** Jade (guardian) eats boss helpers that come close to you. */
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
        this.c.say('¡Jade se comió un cuervo!', 'jade-crow', 2);
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
          desc: 'Jade se come a los cuervos que se te acerquen por 12 s',
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
        this.c.say('¡Jade se comió una copia! Recoge su orbe', 'jade-clone', 2);
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
          desc: 'Jade se come las copias que se te acercan (sueltan su orbe) por 12 s',
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
        this.c.say('¡Jade se comió un alien!', 'jade-alien', 2);
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
          desc: 'Jade se come a los aliens que se te acercan por 12 s',
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
          desc: 'Jade derriba a todos los esqueletos bailarines',
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
          this.c.say('¡Jade derribó a un esqueleto!', 'jade-dancer', 2);
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
        this.c.say('¡Jade se comió un gnomo!', 'jade-gnome', 2);
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
          desc: 'Jade se come a los gnomos que se te acercan por 12 s',
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
          desc: 'Jade te rodea: las manos de sombra no te agarran por 15 s',
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
  }
}
