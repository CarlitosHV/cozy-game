/**
 * Zelda-style rooms for the generated levels:
 *
 *  - Guardian arena: a fenced ring with a smaller, weaker version of the world's boss.
 *    Walk in and the gate shuts behind you. The guardian charges at you: dodge so it crashes
 *    into the fence, then jump on its head while it's dizzy. Beat it and it drops a crowbar
 *    (palanca) and the gate opens.
 *  - Trapdoor: a little stone crypt with a locked hatch on top. Stand on the hatch with the
 *    crowbar to open it, then take the stairs down to the basement, where an orb waits.
 *
 * In a party the guardian's life and the open trapdoor are shared (world events
 * 'minihit' and 'trapopen'); everything else runs on each computer.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import type { SolidObstacleCollider, PlatformItem } from './levels';
import type { ItemSystem } from './items';
import { BOSS_FOR_THEME, BOSS_INFO, ThemeId } from './progress';
import {
  createBirdBoss,
  createDancer,
  createDracula,
  createGlitchMonster,
  createGnomeKing,
  createUfo,
  makeGlitchMaterial,
} from './bossModels';

export interface DungeonContext {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isGrounded: boolean;
  items: ItemSystem;
  /** Players in the party (1 alone): the guardian gets tougher with friends */
  partySize: number;
  /** Shared events with the party (no-op alone) */
  send: (kind: string, i: number, v: number) => void;
  teleport: (to: THREE.Vector3, yaw: number) => void;
  /** Bounce the player away (knockback) */
  knock: (vx: number, vy: number, vz: number) => void;
  /** Entering the basement (puts its push rock back home) */
  onEnterCellar?: (blockIndex: number) => void;
}

type MiniState = 'sleep' | 'idle' | 'windup' | 'charge' | 'dizzy' | 'hurt' | 'slam' | 'dead';

/** The guardian of an arena: a mini version of the world's boss. */
export class MiniBoss {
  public group = new THREE.Group();
  /** Feet position */
  public pos = new THREE.Vector3();
  public hp = 3;
  public maxHp = 3;
  public name: string;
  public defeated = false;
  public index: number;

  private center: THREE.Vector3;
  private radius: number;
  private floorY: number;
  private body = new THREE.Group();
  private flappers: THREE.Object3D[] = [];
  private height = 2;
  private bodyR = 1;
  private hover = 0;
  private state: MiniState = 'sleep';
  private t = 0;
  private yaw = 0;
  private dir = new THREE.Vector3(0, 0, 1);
  private stars = new THREE.Group();
  private tele: THREE.Mesh;
  private wave: THREE.Mesh;
  private waveT = -1;
  private hurtFlash = 0;
  private warnCooldown = 0;
  private hitCooldown = 0;
  private dropped = false;
  private animT = 0;
  private glitchTick: ((time: number) => void) | null = null;
  /** Gate bars (solid while you're locked in) */
  public gate: { bars: THREE.Group; colliders: SolidObstacleCollider[]; locked: boolean; y: number };

  constructor(root: THREE.Object3D, index: number, theme: ThemeId, center: THREE.Vector3, radius: number, gate: MiniBoss['gate']) {
    this.index = index;
    this.center = center.clone();
    this.radius = radius;
    this.floorY = center.y;
    this.gate = gate;
    const kind = BOSS_FOR_THEME[theme];
    this.name = `${BOSS_INFO[kind].short} menor`;

    // ---- Model: the world's boss, much smaller ----
    let model: THREE.Object3D;
    let scale = 0.5;
    if (kind === 'bird') {
      const m = createBirdBoss();
      model = m.group;
      this.flappers = m.wings;
      scale = 0.42;
    } else if (kind === 'glitch') {
      const mat = makeGlitchMaterial();
      this.glitchTick = mat.update;
      model = createGlitchMonster(mat).group;
      scale = 0.42;
    } else if (kind === 'ufo') {
      const m = createUfo();
      m.beam.visible = false;
      model = m.group;
      scale = 0.32;
      this.hover = 0.9;
    } else if (kind === 'skeleton') {
      const m = createDancer();
      m.cage.visible = false;
      model = m.group;
      this.flappers = m.arms;
      scale = 1.7;
    } else if (kind === 'gnome') {
      const m = createGnomeKing();
      model = m.group;
      this.flappers = [m.mallet];
      scale = 0.62;
    } else {
      const m = createDracula();
      model = m.group;
      this.flappers = m.wings;
      scale = 0.7;
    }
    model.scale.multiplyScalar(scale);
    this.body.add(model);
    this.group.add(this.body);
    const box = new THREE.Box3().setFromObject(this.body);
    this.height = Math.max(1.2, Math.min(3.2, box.max.y - Math.min(0, box.min.y)));
    this.bodyR = THREE.MathUtils.clamp(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2, 0.7, 1.35);
    this.body.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });

    // Dizzy stars
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), starMat);
      const a = (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
      this.stars.add(s);
    }
    this.stars.visible = false;
    this.group.add(this.stars);

    // Charge warning (red stripe) and slam shockwave
    this.tele = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.4, depthWrite: false })
    );
    this.tele.rotation.x = -Math.PI / 2;
    this.tele.visible = false;
    root.add(this.tele);
    this.wave = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    this.wave.rotation.x = -Math.PI / 2;
    this.wave.visible = false;
    root.add(this.wave);

    root.add(this.group);
    this.reset(1);
  }

  reset(partySize: number) {
    this.maxHp = 3 + Math.max(0, partySize - 1);
    this.hp = this.maxHp;
    this.defeated = false;
    this.dropped = false;
    this.state = 'sleep';
    this.t = 0;
    this.pos.copy(this.center);
    this.yaw = 0;
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.body.scale.y = 1;
    this.stars.visible = false;
    this.tele.visible = false;
    this.wave.visible = false;
    this.waveT = -1;
    this.setGate(false);
    this.place();
  }

  get alive() {
    return !this.defeated;
  }

  private place() {
    this.group.position.set(this.pos.x, this.pos.y + this.hover, this.pos.z);
    this.group.rotation.y = this.yaw;
  }

  setGate(locked: boolean) {
    if (this.gate.locked === locked) return;
    this.gate.locked = locked;
    for (const c of this.gate.colliders) {
      c.bottomY = locked ? this.floorY - 0.5 : -1000;
      c.topY = locked ? this.floorY + 3.2 : -999;
    }
    if (locked) soundManager.playWoodRattle();
  }

  inside(p: THREE.Vector3, margin = 0.4): boolean {
    return Math.hypot(p.x - this.center.x, p.z - this.center.z) < this.radius - margin && Math.abs(p.y - this.floorY) < 3;
  }

  /** Damage from this or another player (v = life left). */
  applyHit(hpLeft: number, ctx: DungeonContext | null) {
    if (this.defeated) return;
    this.hp = Math.min(this.hp, Math.max(0, hpLeft));
    this.hurtFlash = 0.3;
    if (this.hp <= 0) this.defeat(ctx);
    else if (this.state === 'dizzy') {
      this.state = 'hurt';
      this.t = 0;
    }
  }

  private defeat(ctx: DungeonContext | null) {
    this.defeated = true;
    this.state = 'dead';
    this.t = 0;
    this.stars.visible = false;
    this.tele.visible = false;
    this.setGate(false);
    soundManager.playCheckpoint();
    if (ctx && !this.dropped) this.drop(ctx);
  }

  private drop(ctx: DungeonContext) {
    this.dropped = true;
    if (!ctx.items.has('palanca')) ctx.items.spawnDrop('palanca', new THREE.Vector3(this.pos.x, this.floorY + 0.95, this.pos.z));
    ctx.items.notify(`¡Derrotaste a ${this.name}! Soltó una palanca: llévala a la trampilla del sótano`);
  }

  update(dt: number, time: number, ctx: DungeonContext) {
    this.glitchTick?.(time);
    // Gate bars rise while you're locked in, and sink into the ground when it opens
    const barsY = this.gate.locked ? this.floorY : this.floorY - 3.1;
    this.gate.bars.position.y += (barsY - this.gate.bars.position.y) * Math.min(1, dt * 7);
    this.animT += dt;
    this.warnCooldown = Math.max(0, this.warnCooldown - dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    const P = ctx.position;

    // Shockwave ring
    if (this.waveT >= 0) {
      this.waveT += dt;
      const r = 0.6 + this.waveT * (this.radius / 0.65);
      this.wave.scale.setScalar(r);
      (this.wave.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - this.waveT / 0.7);
      const d = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
      if (this.hitCooldown <= 0 && ctx.isGrounded && Math.abs(d - r) < 0.55 && Math.abs(P.y - this.floorY) < 0.8) {
        this.hitCooldown = 0.8;
        const nx = (P.x - this.pos.x) / Math.max(0.01, d);
        const nz = (P.z - this.pos.z) / Math.max(0.01, d);
        ctx.knock(nx * 9, 7, nz * 9);
      }
      if (this.waveT > 0.7) {
        this.waveT = -1;
        this.wave.visible = false;
      }
    }

    if (this.state === 'dead') {
      this.t += dt;
      const k = Math.max(0, 1 - this.t / 0.8);
      this.group.scale.setScalar(Math.max(0.001, k));
      this.group.rotation.y += dt * 12;
      if (k <= 0) this.group.visible = false;
      if (!this.dropped && this.t > 0.1) this.drop(ctx);
      return;
    }

    // You're locked in with it until it's beaten
    const inside = this.inside(P, 0.5);
    if (inside && !this.gate.locked) {
      this.setGate(true);
      if (this.state === 'sleep') {
        this.state = 'idle';
        this.t = 0;
        ctx.items.notify(`¡${this.name} despierta! Esquiva su embestida para que choque con la cerca y cáele encima cuando esté mareado`);
      }
    } else if (!inside && this.gate.locked && Math.hypot(P.x - this.center.x, P.z - this.center.z) > this.radius + 0.6) {
      this.setGate(false);
    }

    // Idle animation
    const flap = Math.sin(this.animT * (this.state === 'charge' ? 18 : 7));
    this.flappers.forEach((f, i) => {
      f.rotation.z = (i % 2 === 0 ? 1 : -1) * flap * 0.35;
    });
    this.body.position.y = this.state === 'dizzy' ? -0.15 : Math.abs(Math.sin(this.animT * 3)) * 0.12;
    // Dizzy: it slumps down, so even the tall ones can be jumped on
    const slump = this.state === 'dizzy' ? 0.6 : 1;
    this.body.scale.y += (slump - this.body.scale.y) * Math.min(1, dt * 8);
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dt;
      this.body.visible = Math.floor(this.hurtFlash * 30) % 2 === 0;
    } else this.body.visible = true;

    if (this.state === 'sleep') {
      this.body.rotation.z = Math.sin(this.animT * 1.2) * 0.05;
      this.place();
      return;
    }
    this.body.rotation.z = 0;

    this.t += dt;
    const toP = new THREE.Vector3(P.x - this.pos.x, 0, P.z - this.pos.z);
    const distP = toP.length();
    const faceP = () => {
      const want = Math.atan2(toP.x, toP.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 6);
    };
    const fast = this.hp < this.maxHp ? 0.75 : 1;

    switch (this.state) {
      case 'idle': {
        if (inside) {
          faceP();
          if (distP > 2.2) this.moveBy(toP.normalize().multiplyScalar(1.3 * dt));
        } else {
          // Nobody in the ring: wander back to the middle
          const home = new THREE.Vector3(this.center.x - this.pos.x, 0, this.center.z - this.pos.z);
          if (home.length() > 0.3) this.moveBy(home.normalize().multiplyScalar(1.2 * dt));
        }
        if (inside && this.t > 1.5 * fast) {
          this.t = 0;
          if (distP < 3.2 && Math.random() < 0.35) {
            this.state = 'slam';
          } else {
            this.state = 'windup';
            this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          }
        }
        break;
      }
      case 'windup': {
        faceP();
        this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        this.body.position.x = Math.sin(this.animT * 60) * 0.06;
        const len = this.radius * 2;
        this.tele.visible = true;
        this.tele.scale.set(this.bodyR * 1.2, len, 1);
        this.tele.position.set(this.pos.x + this.dir.x * (len / 2), this.floorY + 0.04, this.pos.z + this.dir.z * (len / 2));
        this.tele.rotation.set(-Math.PI / 2, 0, -this.yaw + Math.PI);
        (this.tele.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.25 * Math.abs(Math.sin(this.animT * 12));
        if (this.t > 0.9 * fast) {
          this.state = 'charge';
          this.t = 0;
          this.tele.visible = false;
          this.body.position.x = 0;
          soundManager.playWindGust();
        }
        break;
      }
      case 'charge': {
        this.moveBy(this.dir.clone().multiplyScalar(8.5 * dt), false);
        if (distP < this.bodyR + 0.45 && Math.abs(P.y - this.floorY) < this.height && this.hitCooldown <= 0) {
          this.hitCooldown = 0.8;
          ctx.knock(this.dir.x * 13, 6, this.dir.z * 13);
        }
        const fromC = Math.hypot(this.pos.x - this.center.x, this.pos.z - this.center.z);
        if (fromC > this.radius - this.bodyR - 0.25) {
          // Crashed into the fence: dizzy!
          this.state = 'dizzy';
          this.t = 0;
          this.stars.visible = true;
          soundManager.playEnemyBonk();
        } else if (this.t > 2.2) {
          this.state = 'idle';
          this.t = 0;
        }
        break;
      }
      case 'slam': {
        const up = 0.45;
        const down = 0.35;
        if (this.t < up) this.hover = Math.sin((this.t / up) * (Math.PI / 2)) * 2.2;
        else if (this.t < up + down) this.hover = 2.2 * (1 - (this.t - up) / down);
        else {
          this.hover = 0;
          this.waveT = 0;
          this.wave.visible = true;
          this.wave.position.set(this.pos.x, this.floorY + 0.06, this.pos.z);
          soundManager.playEnemyBonk();
          this.state = 'idle';
          this.t = 0;
        }
        break;
      }
      case 'dizzy': {
        this.stars.position.set(0, this.height * this.body.scale.y + 0.35 + this.hover, 0);
        this.stars.rotation.y += dt * 5;
        if (this.t > 2.8) {
          this.state = 'idle';
          this.t = 0;
          this.stars.visible = false;
        }
        break;
      }
      case 'hurt': {
        this.stars.visible = false;
        if (this.t > 0.6) {
          this.state = 'idle';
          this.t = 0;
        }
        break;
      }
    }

    // Jumping on its head
    const top = this.floorY + this.hover + this.height * this.body.scale.y;
    const dxz = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    if (dxz < this.bodyR + 0.3 && ctx.velocity.y <= 0 && P.y > top - 0.55 && P.y < top + 0.6 && this.hitCooldown <= 0) {
      this.hitCooldown = 0.5;
      if (this.state === 'dizzy') {
        const left = this.hp - 1;
        ctx.velocity.y = 11;
        soundManager.playEnemyBoop();
        ctx.send('minihit', this.index, left);
        this.applyHit(left, ctx);
        if (!this.defeated) ctx.items.notify(`¡Golpe! A ${this.name} le quedan ${this.hp} de ${this.maxHp}`);
      } else {
        const nx = (P.x - this.pos.x) / Math.max(0.01, dxz);
        const nz = (P.z - this.pos.z) / Math.max(0.01, dxz);
        ctx.knock(nx * 6, 9, nz * 6);
        soundManager.playMushroomBounce();
        if (this.warnCooldown <= 0) {
          this.warnCooldown = 5;
          ctx.items.notify('¡Está en guardia! Haz que choque contra la cerca y cáele encima cuando esté mareado');
        }
      }
    } else if (dxz < this.bodyR + 0.35 && P.y < top - 0.6 && P.y > this.floorY - 0.5 && this.state !== 'charge') {
      // Its body is solid: slide around it
      const nx = (P.x - this.pos.x) / Math.max(0.01, dxz);
      const nz = (P.z - this.pos.z) / Math.max(0.01, dxz);
      P.x = this.pos.x + nx * (this.bodyR + 0.35);
      P.z = this.pos.z + nz * (this.bodyR + 0.35);
    }
    this.place();
  }

  /** Moves inside the ring (never through the fence). */
  private moveBy(step: THREE.Vector3, turn = true) {
    this.pos.add(step);
    const dx = this.pos.x - this.center.x;
    const dz = this.pos.z - this.center.z;
    const d = Math.hypot(dx, dz);
    const max = this.radius - this.bodyR - 0.2;
    if (d > max) {
      this.pos.x = this.center.x + (dx / d) * max;
      this.pos.z = this.center.z + (dz / d) * max;
    }
    if (turn && step.lengthSq() > 1e-6) this.yaw = Math.atan2(step.x, step.z);
  }

  dispose(root: THREE.Object3D) {
    root.remove(this.group, this.tele, this.wave);
  }
}

/** A locked hatch on a stone crypt; open it with the crowbar and go down to the basement. */
export interface Trapdoor {
  index: number;
  /** Center of the pit at the rim's top */
  top: THREE.Vector3;
  /** Pit floor area that takes you down (center + half size) */
  stairs: { x: number; z: number; hx: number; hz: number; y: number };
  hatch: PlatformItem;
  /** Rotates the lid open (around its hinge) */
  pivot: THREE.Group;
  /** Hinge axis: 'x' → lid rotates around x */
  hingeAxis: 'x' | 'z';
  hingeSign: number;
  open: boolean;
  openT: number;
  hintCooldown: number;
  /** Where you appear in the basement, and facing */
  cellarSpawn: THREE.Vector3;
  cellarYaw: number;
  /** The basement's push rock (puzzles.blocks index) */
  blockIndex: number;
}

export interface DungeonData {
  miniBosses: MiniBoss[];
  trapdoors: Trapdoor[];
}

export function emptyDungeon(): DungeonData {
  return { miniBosses: [], trapdoors: [] };
}

export class DungeonSystem {
  private data: DungeonData = emptyDungeon();
  private downCooldown = 0;

  load(data: DungeonData | undefined) {
    this.data = data ?? emptyDungeon();
  }

  get miniBosses(): MiniBoss[] {
    return this.data.miniBosses;
  }

  reset(partySize: number) {
    for (const b of this.data.miniBosses) b.reset(partySize);
    for (const t of this.data.trapdoors) {
      t.open = false;
      t.openT = 0;
      t.hatch.position.y = t.top.y;
      t.pivot.rotation.set(0, 0, 0);
    }
    this.downCooldown = 0;
  }

  /** Shared with the party (also replayed for late joiners). */
  onEvent(kind: string, i: number, v: number, ctx: DungeonContext | null) {
    if (kind === 'minihit') this.data.miniBosses[i]?.applyHit(v, ctx);
    else if (kind === 'trapopen') {
      const t = this.data.trapdoors[i];
      if (t && !t.open) this.openTrap(t, false);
    }
  }

  private openTrap(t: Trapdoor, sound = true) {
    t.open = true;
    t.hatch.position.y = -100; // no more lid to stand on
    if (sound) soundManager.playCheckpoint();
  }

  update(dt: number, time: number, ctx: DungeonContext) {
    for (const b of this.data.miniBosses) b.update(dt, time, ctx);
    this.downCooldown = Math.max(0, this.downCooldown - dt);
    const P = ctx.position;
    for (const t of this.data.trapdoors) {
      if (t.open) {
        if (t.openT < 1) {
          t.openT = Math.min(1, t.openT + dt * 1.6);
          const a = t.hingeSign * t.openT * 1.9;
          if (t.hingeAxis === 'x') t.pivot.rotation.x = a;
          else t.pivot.rotation.z = a;
        }
        const s = t.stairs;
        if (this.downCooldown <= 0 && Math.abs(P.x - s.x) < s.hx && Math.abs(P.z - s.z) < s.hz && P.y < s.y + 0.6 && P.y > s.y - 1) {
          this.downCooldown = 1.5;
          soundManager.playRespawnPuff();
          ctx.onEnterCellar?.(t.blockIndex);
          ctx.teleport(t.cellarSpawn, t.cellarYaw);
          ctx.items.notify('Bajaste al sótano… ¡Busca el orbe! (si atascas la roca, sal y vuelve a bajar)');
        }
        continue;
      }
      t.hintCooldown = Math.max(0, t.hintCooldown - dt);
      const onLid = Math.abs(P.x - t.top.x) < 1.6 && Math.abs(P.z - t.top.z) < 1.6 && Math.abs(P.y - t.top.y) < 0.5;
      if (!onLid) continue;
      if (ctx.items.consume('palanca')) {
        this.openTrap(t);
        ctx.send('trapopen', t.index, 1);
        ctx.items.notify('¡Abriste la trampilla! Baja las escaleras al sótano');
      } else if (t.hintCooldown <= 0) {
        t.hintCooldown = 5;
        ctx.items.notify('Trampilla cerrada: necesitas una palanca. ¡La tiene el guardián de la arena!');
      }
    }
  }

  dispose(root: THREE.Object3D) {
    for (const b of this.data.miniBosses) b.dispose(root);
    this.data = emptyDungeon();
  }
}
