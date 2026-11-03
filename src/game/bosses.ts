/**
 * The six bosses of "Lucha contra jefes" (one per world):
 *   bird     Plumarroca      — throws rocks from the top of a tower; climb up and hit it (3-4 hits).
 *   glitch   ERR0R.exe       — spawns glitch copies of the player; their light orbs hurt it.
 *   ufo      Nave Nodriza    — lasers from the sky; slingshot its glass; net the cows it abducts.
 *   skeleton Huesudo         — dancing skeletons carry players to its mouth; feed it bombs.
 *   gnome    Rey Gnomo       — mallet slams and shockwaves; net him, then hit him.
 *   dracula  Conde Drácula   — darkness and swoops; light the 4 candelabra to weaken him.
 * Each controller owns its models (added to the level root) and reports aim targets to the
 * combat system, which handles life, projectiles, the bat, stomps and party sync.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import type { AimTarget, CombatSystem, HitKind } from './combat';
import type { BossSetup } from './bossArena';
import type { ItemType } from './items';
import { burstEffect, makeTelegraph, puffEffect, Telegraph } from './combatFx';
import {
  BirdModel,
  CandelabraModel,
  CowModel,
  createBirdBoss,
  createCandelabra,
  createCow,
  createDancer,
  createDracula,
  createGiantSkeleton,
  createGlitchMonster,
  createGnomeKing,
  createUfo,
  DancerModel,
  DraculaModel,
  GiantSkeletonModel,
  GlitchMaterial,
  GlitchMonsterModel,
  GnomeKingModel,
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
class BirdBoss extends BossController {
  private m: BirdModel;
  private perch = 0;
  private state: 'perched' | 'flying' = 'perched';
  private from = V();
  private to = V();
  private flyT = 0;
  private throwT = 3;
  private gustT = -1;
  private gustWarn = -1;
  private stunT = 0;
  private hitCd = 0;
  private yaw = 0;
  private rocks: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number }[] = [];
  private center = V();

  constructor(c: CombatSystem) {
    super(c, c.setup.diff >= 0.5 ? 4 : 3);
    this.m = createBirdBoss();
    this.group.add(this.m.group);
    this.scaleBase = 0.9;
    this.group.position.copy(this.s.perches[0]);
  }

  private perchFor(hp: number) {
    return (this.maxHp - hp) % this.s.perches.length;
  }

  private onPerch(): boolean {
    const p = this.c.playerPos;
    const top = this.s.perches[this.perch];
    return Math.hypot(p.x - top.x, p.z - top.z) < 3.4 && p.y > top.y - 0.8;
  }

  update(dt: number, time: number) {
    this.applyPulse(dt);
    this.updatePending(dt);
    this.updateRocks(dt);
    this.hitCd -= dt;
    this.stunT -= dt;
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

    // Wing flapping
    const flap = this.state === 'flying' ? Math.sin(time * 14) * 0.7 : this.gustWarn >= 0 ? -1.1 : Math.sin(time * 2) * 0.12;
    this.m.wings[0].rotation.z = flap;
    this.m.wings[1].rotation.z = -flap;
    this.m.head.rotation.x = this.stunT > 0 ? Math.sin(time * 9) * 0.3 : 0;

    const wanted = this.perchFor(this.hp);
    if (this.state === 'perched' && wanted !== this.perch) {
      this.state = 'flying';
      this.flyT = 0;
      this.from.copy(pos);
      this.to.copy(this.s.perches[wanted]);
      this.perch = wanted;
      this.gustT = -1;
      this.gustWarn = -1;
    }

    if (this.state === 'flying') {
      this.flyT += dt / 2.2;
      const k = Math.min(1, this.flyT);
      pos.lerpVectors(this.from, this.to, ease(k));
      pos.y += Math.sin(Math.PI * k) * 6;
      this.yaw = turnTo(this.yaw, Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z), 5, dt);
      this.group.rotation.y = this.yaw;
      if (k >= 1) {
        this.state = 'perched';
        this.throwT = 1.4;
      }
      return;
    }

    this.yaw = turnTo(this.yaw, Math.atan2(p.x - pos.x, p.z - pos.z), 4, dt);
    this.group.rotation.y = this.yaw;
    const diff = this.s.diff;
    if (this.onPerch()) {
      // Close up: wing gusts push you off the tower
      if (this.gustT < 0 && this.gustWarn < 0) this.gustT = 1.7 + (1 - diff) * 1.0;
      if (this.gustWarn >= 0) {
        this.gustWarn -= dt;
        if (this.gustWarn < 0) {
          soundManager.playWindGust();
          if (Math.hypot(p.x - pos.x, p.z - pos.z) < 4.6) this.c.damagePlayer(10, pos, 15, 8);
          this.gustT = 2.6 - diff * 0.6;
        }
      } else if (this.stunT <= 0) {
        this.gustT -= dt;
        if (this.gustT <= 0) this.gustWarn = 0.8;
      }
    } else {
      this.gustT = -1;
      this.gustWarn = -1;
      if (this.stunT <= 0) this.throwT -= dt;
      if (this.throwT <= 0) {
        this.throwRock(0);
        if (diff > 0.55) this.throwRock(2.6);
        this.throwT = 2.5 - 1.0 * diff;
      }
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
        this.c.strike(r.to, 1.9, 15, 9, 6);
        soundManager.playWoodRattle();
        this.c.addEffect(burstEffect(this.root, r.to.clone().add(V(0, 0.3, 0)), r.mesh.material as THREE.Material, 7, 0.22, 4, 0.7));
        this.c.addEffect(puffEffect(this.root, r.to.clone().add(V(0, 0.4, 0)), 'rgba(214,200,180,0.85)', 2.5, 0.4));
      }
    }
  }

  targets(out: AimTarget[]) {
    if (this.dead || this.state === 'flying') return;
    out.push({
      pos: this.center,
      radius: 1.5,
      accepts: ['bate', 'piedra', 'stomp'],
      top: this.group.position.y + 2.0,
      hit: (kind) => this.hit(kind),
    });
  }

  private hit(kind: HitKind) {
    if (this.dead || this.state === 'flying') return;
    if (kind === 'piedra') {
      this.stunT = 1.8;
      this.c.say('¡Plumarroca está aturdida! Sube y golpéala', 'bird-stun', 4);
      return;
    }
    if (this.hitCd > 0) return;
    this.hitCd = 1.0;
    this.c.damageBoss(1);
    if (!this.dead && this.hp > 0) this.c.say('¡Golpe! Plumarroca vuela a otra torre', 'bird-hit', 2);
  }

  hint(): string {
    if (this.state === 'flying') return 'Plumarroca vuela a otra torre…';
    if (this.onPerch()) return this.has('bate') ? '¡Golpéala con el bate (V) o cáele encima!' : '¡Cáele encima de un salto! (o trae un bate)';
    return 'Esquiva las piedras y sube por los escalones de la torre donde está Plumarroca';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    this.from.copy(this.group.position);
    const top = this.s.perches[this.perch];
    this.to.set(top.x * 0.6, this.s.floorY, top.z * 0.6);
    if (instant) this.group.visible = false;
  }

  dispose() {
    for (const r of this.rocks) this.root.remove(r.mesh);
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

  private maxClones() {
    return 2 + Math.round(this.s.diff * 2);
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
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.clones.length < this.maxClones()) {
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
        this.c.shockwave(V(pos.x, this.s.floorY, pos.z), 34, 9 + 3 * this.s.diff, 14, 0xff00e6, 0.9);
        this.waveT = 6.5 - 2 * this.s.diff;
      }
    } else {
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
          if (this.c.damagePlayer(12, cl.pos, 11, 6)) {
            cl.state = 'recoil';
            cl.t = 0;
          }
        }
      }
      cl.center.copy(cl.model.group.position).add(V(0, 0.8, 0));
      cl.model.updateAnimation(moving, true, dt, time);
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

class UfoBoss extends BossController {
  private m: UfoModel;
  private cows: Cow[] = [];
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
    if (this.abducting < 0 && this.c.deps.isHost()) {
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
      this.c.strike(at, 1.8, 20, 9, 7);
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
      if (cow.state === 'gone') {
        cow.t -= dt;
        if (cow.t <= 0) {
          cow.state = 'graze';
          cow.pos.copy(cow.home);
          g.visible = true;
          g.rotation.set(0, cow.yaw, 0);
          this.c.addEffect(puffEffect(this.root, cow.home.clone().add(V(0, 1, 0)), 'rgba(255,255,255,0.9)', 2.5, 0.4));
        }
        return;
      }
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
          if (this.c.deps.isHost()) {
            this.c.healBoss(16);
            this.c.say('¡La nave se curó con una vaca! Usa la red para salvarlas', 'ufo-heal', 2);
          }
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

  onEvent(kind: string, i: number) {
    if (kind === 'abduct') this.startAbduct(i);
    else if (kind === 'net') this.netCow(i, false);
  }

  hint(): string {
    if (this.abducting >= 0) return this.has('red') ? '¡Secuestra una vaca! Lánzale la red a la vaca' : '¡Secuestra una vaca! Busca una red para salvarla';
    if (!this.has('resortera')) return 'Toma la resortera y junta piedras';
    if (!this.has('piedra')) return 'Junta piedras del suelo para la resortera';
    return 'Dispara al vidrio de la nave con la resortera · esquiva los círculos rojos';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    this.abducting = -1;
    this.crashFrom.copy(this.group.position);
    for (const cow of this.cows) {
      if (cow.state === 'lifting') {
        cow.state = 'netted';
        cow.t = 0.01;
      }
    }
    if (instant) this.group.visible = false;
  }

  dispose() {
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
  private rise = 0;
  private mouthOpen = false;
  private mouthT = 5;
  private chompT = 0;
  private slamT = 5;
  private spawnT = 3;
  private dancers: Dancer[] = [];
  private mouthPos = V();
  private dropPoint: THREE.Vector3;
  private hitCd = 0;

  constructor(c: CombatSystem) {
    super(c, 4 + (c.setup.diff > 0.5 ? 1 : 0));
    this.m = createGiantSkeleton();
    this.group.add(this.m.group);
    this.group.position.copy(this.s.giantBase);
    this.group.position.y -= 10;
    this.dropPoint = V(0, this.s.floorY, this.s.giantBase.z + 5);
  }

  update(dt: number, time: number) {
    this.applyPulse(dt);
    this.updatePending(dt);
    this.hitCd -= dt;
    const base = this.s.giantBase;
    const pos = this.group.position;
    const p = this.c.playerPos;

    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.6);
      pos.y = base.y - 12 * k * k;
      this.m.group.rotation.x = -k * 0.5;
      this.m.jaw.rotation.x = 0.9;
      if (Math.random() < dt * 6) this.c.addEffect(puffEffect(this.root, V(base.x + (Math.random() - 0.5) * 8, this.s.floorY + 0.5, base.z + 2), 'rgba(132,204,22,0.6)', 3, 0.7));
      if (k >= 1) this.group.visible = false;
      return;
    }

    // Rises from the swamp at the start
    if (this.rise < 1) {
      this.rise = Math.min(1, this.rise + dt / 3);
      pos.y = base.y - 10 * (1 - ease(this.rise));
      if (Math.random() < dt * 10) this.c.addEffect(puffEffect(this.root, V(base.x + (Math.random() - 0.5) * 6, this.s.floorY, base.z + 2), 'rgba(132,204,22,0.6)', 3, 0.6));
    }

    // Idle sway, looks at the player
    this.m.skull.rotation.y = turnTo(this.m.skull.rotation.y, THREE.MathUtils.clamp(Math.atan2(p.x - pos.x, p.z - pos.z), -0.6, 0.6), 2, dt);
    this.m.arms.forEach((a, i) => (a.rotation.x = -0.35 + Math.sin(time * 1.2 + i * 2) * 0.12));
    for (const e of this.m.eyes) e.scale.setScalar(1 + Math.sin(time * 5) * 0.2);

    // Mouth cycle
    this.chompT = Math.max(0, this.chompT - dt);
    this.mouthT -= dt;
    if (this.mouthT <= 0 && this.rise >= 1) {
      this.mouthOpen = !this.mouthOpen;
      this.mouthT = this.mouthOpen ? 3.4 : 6.5 - 2 * this.s.diff;
      if (this.mouthOpen) {
        soundManager.playStalkerWarning();
        if (this.has('bomba')) this.c.say('¡Huesudo abrió la boca! ¡Lánzale una bomba!', 'mouth', 5);
      }
    }
    const jawTarget = this.chompT > 0 ? (Math.sin(this.chompT * 30) > 0 ? 0.8 : 0.05) : this.mouthOpen ? 0.85 : 0.04;
    this.m.jaw.rotation.x = THREE.MathUtils.damp(this.m.jaw.rotation.x, jawTarget, 10, dt);
    this.m.mouthGlow.visible = this.mouthOpen;
    this.group.updateMatrixWorld(true);
    this.m.skull.localToWorld(this.mouthPos.set(0, -1.0, 1.6));

    // Hand slams on the north half of the arena
    this.slamT -= dt;
    if (this.slamT <= 0 && this.rise >= 1) {
      this.slamT = 5.5 - 2 * this.s.diff;
      if (p.z < 6 && !this.c.grab) {
        const at = this.groundAt(0.6);
        this.warn(at, 2.5, 1.3, () => this.slam(at));
      }
    }

    // Dancing skeletons
    this.spawnT -= dt;
    const alive = this.dancers.filter((d) => d.state !== 'sink').length;
    if (this.spawnT <= 0 && alive < 2 + Math.round(2 * this.s.diff) && this.rise >= 1) {
      this.spawnDancer();
      this.spawnT = 5 - 1.5 * this.s.diff;
    }
    this.updateDancers(dt, time);
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
    this.c.strike(at, 2.6, 20, 12, 7);
    soundManager.playWoodRattle();
    this.c.addEffect(puffEffect(this.root, at.clone().add(V(0, 0.4, 0)), 'rgba(132,204,22,0.7)', 4, 0.5));
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
        if (dist < 0.85 && Math.abs(p.y - d.pos.y) < 1.5) {
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
        if (dist < 1.2 && this.c.grab) {
          // Chomp!
          this.chompT = 0.6;
          this.c.damagePlayer(35, null);
          if (this.c.grab) {
            this.c.releaseGrab('eaten');
            this.c.physics.respawnAtCheckpoint(0, true);
          }
          this.c.say('¡Huesudo te masticó! Vuelves a la entrada', 'eaten', 2);
        } else if (!this.c.grab) {
          d.state = 'dance';
          d.m.cage.visible = false;
        }
      }
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
    if (g) return `¡Pulsa saltar muchas veces para soltarte! (${g.count}/${g.need})`;
    if (!this.has('bomba')) return 'Junta bombas del suelo y cuidado con los esqueletos bailarines';
    if (this.mouthOpen) return '¡Huesudo abrió la boca! Lánzale una bomba';
    return 'Espera a que Huesudo abra la boca y lánzale una bomba';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
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
class GnomeBoss extends BossController {
  private m: GnomeKingModel;
  private pos: THREE.Vector3;
  private yaw = 0;
  private state: 'walk' | 'windup' | 'slam' | 'recover' | 'leap' | 'netted' = 'walk';
  private t = 0;
  private leapT = 6;
  private leapFrom = V();
  private leapTo = V();
  private net: THREE.Mesh;
  private hitCd = 0;
  private center = V();

  constructor(c: CombatSystem) {
    super(c, 100 + 50 * c.setup.diff);
    this.m = createGnomeKing();
    this.group.add(this.m.group);
    this.pos = this.s.home.clone();
    this.group.position.copy(this.pos);
    this.net = makeNetWrap(1.5, 3.6);
    this.net.visible = false;
    this.group.add(this.net);
    this.m.mallet.rotation.x = 0.6;
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
      if (this.deadT > 2.4 && this.group.visible) {
        this.group.visible = false;
        this.c.addEffect(burstEffect(this.root, this.pos.clone().add(V(0, 1.5, 0)), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7 }), 16, 0.25, 8, 1.2));
      }
      return;
    }

    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    this.t += dt;
    switch (this.state) {
      case 'walk': {
        this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), 3, dt);
        const speed = 2.4 + 1.4 * diff;
        if (dist > 2.6) {
          this.pos.x += Math.sin(this.yaw) * speed * dt;
          this.pos.z += Math.cos(this.yaw) * speed * dt;
        }
        this.m.feet.forEach((f, i) => (f.position.z = 0.03 + Math.sin(time * 8 + i * Math.PI) * 0.08));
        mallet.rotation.x = THREE.MathUtils.damp(mallet.rotation.x, 0.6, 6, dt);
        this.leapT -= dt;
        if (dist < 4.2) {
          this.state = 'windup';
          this.t = 0;
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
      case 'netted':
        this.m.group.rotation.z = Math.sin(time * 10) * 0.08;
        mallet.rotation.x = 0.9;
        if (this.t >= this.netDur) {
          this.net.visible = false;
          this.m.group.rotation.z = 0;
          this.c.addEffect(puffEffect(this.root, this.pos.clone().add(V(0, 1.8, 0)), 'rgba(103,232,249,0.9)', 4, 0.4));
          this.c.say('¡El Rey Gnomo rompió la red!', 'gnome-free', 2);
          this.state = 'recover';
          this.t = 0;
        }
        break;
    }
    const h = this.s.half - 2;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -h, h);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -h, h);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.center.copy(this.pos).add(V(0, 1.7, 0));
  }

  private netDur = 5.5;

  private impact(at: THREE.Vector3, radius: number) {
    this.c.strike(at, radius, 22, 12, 7);
    this.c.shockwave(at, 8 + 4 * this.s.diff, 10, 12, 0xfacc15, 0.9);
    soundManager.playWoodRattle();
    this.c.addEffect(puffEffect(this.root, at.clone().add(V(0, 0.4, 0)), 'rgba(161,98,7,0.8)', 4, 0.5));
  }

  private netKing(local: boolean, dur?: number) {
    if (this.dead || this.state === 'netted') return;
    this.netDur = dur ?? 5.5 - this.s.diff;
    if (local) this.c.deps.send('stun', 0, this.netDur);
    this.state = 'netted';
    this.t = 0;
    this.net.visible = true;
    if (this.pos.y > this.s.floorY) this.pos.y = this.s.floorY;
    this.c.say('¡Atrapado! Golpéalo ahora', 'gnome-net', 2);
  }

  targets(out: AimTarget[]) {
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

  onEvent(kind: string, _i: number, v: number) {
    if (kind === 'stun') this.netKing(false, v > 0 ? v : undefined);
  }

  hint(): string {
    if (this.state === 'netted') return '¡Atrapado! Golpéalo con el bate, piedras o cayéndole encima';
    if (!this.has('red')) return 'Busca una red para atrapar al Rey Gnomo · salta las ondas del mazo';
    return 'Lánzale la red al Rey Gnomo (objetivo marcado) · salta las ondas del mazo';
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    this.net.visible = false;
    if (instant) this.group.visible = false;
  }
}

// ===========================================================================
// 6. CONDE DRÁCULA
// ===========================================================================
class DraculaBoss extends BossController {
  private m: DraculaModel;
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
        this.c.darknessTarget = 1 - 0.17 * this.litCount();
        if (this.swoop) {
          this.swoop.t += dt / 0.9;
          const k = Math.min(1, this.swoop.t);
          this.pos.lerpVectors(this.swoop.from, this.swoop.to, ease(k));
          this.yaw = Math.atan2(this.swoop.to.x - this.swoop.from.x, this.swoop.to.z - this.swoop.from.z);
          if (!this.swoop.hit && this.pos.distanceTo(V(p.x, p.y + 1, p.z)) < 1.5) {
            this.swoop.hit = true;
            this.c.damagePlayer(15, this.pos, 11, 6);
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
        // Torches light the candelabra
        if (this.has('antorcha')) {
          this.candles.forEach((cm, i) => {
            if (cm.lit) return;
            const at = cm.group.position;
            if (Math.hypot(p.x - at.x, p.z - at.z) < 2.4 && Math.abs(p.y - at.y) < 2.5) this.light(i, true);
          });
        }
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

  onEvent(kind: string, i: number) {
    if (kind === 'light') this.light(i, false);
  }

  hint(): string {
    const n = this.litCount();
    if (this.state === 'intro') return 'Drácula se acerca… toma una antorcha';
    if (this.state === 'weak') return '¡Está débil! Golpéalo ahora (bate, piedras o salto)';
    if (this.state === 'rise') return 'Drácula se recupera…';
    if (!this.has('antorcha')) return `Toma una antorcha y prende los candelabros (${n}/${this.candles.length})`;
    return `Acércate a los candelabros con la antorcha (${n}/${this.candles.length}) · esquiva sus picadas`;
  }

  onDefeat(instant: boolean) {
    super.onDefeat(instant);
    this.clearPending();
    this.swoop = null;
    this.c.darknessTarget = 0;
    this.candles.forEach((cm) => cm.setLit(true));
    if (instant) this.group.visible = false;
  }

  dispose() {
    for (const cm of this.candles) disposeGroup(this.root, cm.group);
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
