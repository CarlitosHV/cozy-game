/**
 * Companion Powers: every floating companion grants a temporary power.
 *  - Nubi (nube):        float / hover for a while
 *  - Estelita (estrella): run faster
 *  - Chispa (luciernaga): glowing lure that distracts enemies and the Stalker
 *  - Catarina (catarina): rescues you if you fall off the islands
 *  - Lila (hada):         fairy dust — a second jump in mid-air
 *  - Jade (serpiente):    flies around you and knocks down enemies (and their projectiles) that get close
 *
 * A power is triggered with a key (G) or the HUD button, lasts a short time,
 * and then the companion gets hungry: it can't be used again until you feed it
 * a magic berry from your backpack (see items.ts).
 */
import * as THREE from 'three';
import { CompanionStyle } from './character';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import type { AetherStalker, EnemyManager } from './enemies';

export type PowerState = 'ready' | 'active' | 'hungry' | 'none';

export interface CompanionPowerInfo {
  companion: CompanionStyle;
  companionName: string;
  powerName: string;
  desc: string;
  /** Seconds the power lasts */
  duration: number;
  activeText: string;
  color: string;
}

export const COMPANION_POWERS: Partial<Record<CompanionStyle, CompanionPowerInfo>> = {
  nube: {
    companion: 'nube',
    companionName: 'Nubi',
    powerName: 'Flotar',
    desc: 'Caes despacito. Mantén Saltar para elevarte un poco.',
    duration: 8,
    activeText: '¡Nubi te hace flotar!',
    color: '#bae6fd',
  },
  estrella: {
    companion: 'estrella',
    companionName: 'Estelita',
    powerName: 'Supervelocidad',
    desc: 'Corres mucho más rápido por un rato.',
    duration: 7,
    activeText: '¡Estelita te da supervelocidad!',
    color: '#fde047',
  },
  luciernaga: {
    companion: 'luciernaga',
    companionName: 'Chispa',
    powerName: 'Distraer',
    desc: 'Chispa brilla y distrae a los enemigos y al Acechador.',
    duration: 9,
    activeText: '¡Chispa distrae a los enemigos!',
    color: '#d9f99d',
  },
  catarina: {
    companion: 'catarina',
    companionName: 'Catarina',
    powerName: 'Rescate',
    desc: 'Si te caes mientras está activo, Catarina te regresa a tierra firme.',
    duration: 30,
    activeText: '¡Catarina te cuida de las caídas!',
    color: '#fca5a5',
  },
  hada: {
    companion: 'hada',
    companionName: 'Lila',
    powerName: 'Doble Salto',
    desc: 'Polvo de hada: puedes saltar otra vez en el aire.',
    duration: 12,
    activeText: '¡Lila te llena de polvo de hada! Salta otra vez en el aire',
    color: '#f9a8d4',
  },
  serpiente: {
    companion: 'serpiente',
    companionName: 'Jade',
    powerName: 'Guardiana',
    desc: 'Jade vuela a tu alrededor y derriba a los enemigos y proyectiles que se acercan.',
    duration: 10,
    activeText: '¡Jade te protege! Los enemigos cercanos caen',
    color: '#34d399',
  },
};

/** Enemies Jade can reach while guarding */
export interface PowerFoes {
  enemies?: EnemyManager | null;
  stalker?: AetherStalker | null;
}

export interface CompanionPowerStatus {
  companion: CompanionStyle;
  state: PowerState;
  timeLeft: number;
  duration: number;
  /** Increments every time there is a message to show (toast) */
  eventId: number;
  eventText: string;
}

/** Minimal view of the physics controller the powers need to touch. */
export interface PowerPhysicsHooks {
  position: THREE.Vector3;
  isGrounded: boolean;
  lastSafePos: THREE.Vector3;
  speedMultiplier: number;
  floatPower: boolean;
  floatCeiling: number;
  rescueGuard: boolean;
  onRescue: (() => void) | null;
  airJumpPower: boolean;
  onAirJump: (() => void) | null;
}

function createLureModel(): THREE.Group {
  const lure = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshBasicMaterial({ color: 0xeaff9a }));
  const glow1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xd9ff70, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  const glow2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xbef264, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  lure.add(core, glow1, glow2);
  lure.visible = false;
  return lure;
}

export class CompanionPowerSystem {
  public companion: CompanionStyle = 'nube';
  public state: PowerState = 'ready';
  public timeLeft = 0;
  public duration = 0;
  /** Where Chispa's lure is while distracting (null when inactive) */
  public lureTarget: THREE.Vector3 | null = null;

  private eventId = 0;
  private eventText = '';
  private lure: THREE.Group;
  private lurePos = new THREE.Vector3();
  private lureGoal = new THREE.Vector3();
  private scene: THREE.Scene;
  /** Lila: pink ring burst under your feet on every air jump */
  private dustRing: THREE.Mesh;
  private dustT = 1;
  /** Jade: glowing ring circling the player while guarding */
  private guardRing: THREE.Group;
  private guardPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.lure = createLureModel();
    scene.add(this.lure);
    this.dustRing = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.62, 28),
      new THREE.MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    this.dustRing.rotation.x = -Math.PI / 2;
    this.dustRing.visible = false;
    scene.add(this.dustRing);
    this.guardRing = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.05, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    torus.rotation.x = Math.PI / 2;
    this.guardRing.add(torus);
    for (let i = 0; i < 3; i++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xa7f3d0 }));
      const a = (i / 3) * Math.PI * 2;
      orb.position.set(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6);
      this.guardRing.add(orb);
    }
    this.guardRing.visible = false;
    scene.add(this.guardRing);
  }

  get info(): CompanionPowerInfo | undefined {
    return COMPANION_POWERS[this.companion];
  }

  private emit(text: string) {
    this.eventId++;
    this.eventText = text;
  }

  public getStatus(): CompanionPowerStatus {
    return {
      companion: this.companion,
      state: this.state,
      timeLeft: this.timeLeft,
      duration: this.duration,
      eventId: this.eventId,
      eventText: this.eventText,
    };
  }

  /** Called when the player picks a different companion. A new friend arrives with a full belly. */
  public setCompanion(companion: CompanionStyle, physics: PowerPhysicsHooks) {
    if (companion === this.companion) return;
    this.endEffects(physics);
    this.companion = companion;
    this.state = COMPANION_POWERS[companion] ? 'ready' : 'none';
    this.timeLeft = 0;
  }

  /** Full reset for a new run: power ready. */
  public reset(physics: PowerPhysicsHooks) {
    this.endEffects(physics);
    this.state = this.info ? 'ready' : 'none';
    this.timeLeft = 0;
  }

  /** Feed a magic berry. Returns true if the berry was eaten (companion was hungry). */
  public feed(): boolean {
    const info = this.info;
    if (!info) {
      this.emit('No tienes compañero para darle la baya');
      return false;
    }
    if (this.state !== 'hungry') {
      this.emit(`${info.companionName} no tiene hambre ahora`);
      return false;
    }
    this.state = 'ready';
    soundManager.playCollectible();
    this.emit(`¡${info.companionName} comió y está listo! Pulsa G`);
    return true;
  }

  /** Trigger the power (key G / HUD button). Returns false when it can't be used right now. */
  public activate(physics: PowerPhysicsHooks, stalkerPos: THREE.Vector3 | null): boolean {
    const info = this.info;
    if (!info) {
      this.emit('No tienes compañero: elige uno en el generador de personajes');
      return false;
    }
    if (this.state === 'active') return false;
    if (this.state === 'hungry') {
      this.emit(`${info.companionName} tiene hambre: dale una baya mágica de tu mochila`);
      return false;
    }

    this.state = 'active';
    this.duration = info.duration;
    this.timeLeft = info.duration;
    this.emit(info.activeText);
    soundManager.playCheckpoint();

    switch (this.companion) {
      case 'nube':
        physics.floatPower = true;
        physics.floatCeiling = Math.max(physics.position.y, physics.lastSafePos.y) + 3.0;
        break;
      case 'estrella':
        physics.speedMultiplier = 1.65;
        break;
      case 'luciernaga': {
        // The lure flies off toward the Stalker (if any) or just ahead, pulling attention away
        this.lurePos.copy(physics.position).add(new THREE.Vector3(0, 1.4, 0));
        if (stalkerPos) {
          const dir = new THREE.Vector3().subVectors(stalkerPos, physics.position);
          dir.y = 0;
          if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
          dir.normalize();
          this.lureGoal.copy(physics.position).addScaledVector(dir, 9).add(new THREE.Vector3(0, 2.2, 0));
        } else {
          this.lureGoal.copy(physics.position).add(new THREE.Vector3(2.5, 2.4, 1.5));
        }
        this.lureTarget = this.lurePos;
        this.lure.visible = true;
        this.lure.position.copy(this.lurePos);
        break;
      }
      case 'hada':
        physics.airJumpPower = true;
        physics.onAirJump = () => {
          this.dustT = 0;
          this.dustRing.visible = true;
          this.dustRing.position.set(physics.position.x, physics.position.y + 0.05, physics.position.z);
        };
        break;
      case 'serpiente':
        this.guardRing.visible = true;
        break;
      case 'catarina':
        physics.rescueGuard = true;
        physics.onRescue = () => {
          this.emit('¡Catarina te rescató!');
          soundManager.playRespawnPuff();
          this.finish(physics, true);
        };
        break;
    }
    return true;
  }

  private endEffects(physics: PowerPhysicsHooks) {
    physics.floatPower = false;
    physics.speedMultiplier = 1;
    physics.rescueGuard = false;
    physics.onRescue = null;
    physics.airJumpPower = false;
    physics.onAirJump = null;
    this.lureTarget = null;
    this.lure.visible = false;
    this.guardRing.visible = false;
  }

  /** Power is over: the companion is now hungry until it eats a snack. */
  private finish(physics: PowerPhysicsHooks, silent = false) {
    this.endEffects(physics);
    this.timeLeft = 0;
    this.state = 'hungry';
    const info = this.info;
    if (info && !silent) this.emit(`${info.companionName} tiene hambre: dale una baya mágica de tu mochila`);
  }

  /**
   * Per-frame update while playing.
   * @param companionSprite the floating companion mesh on the player (for visual feedback)
   */
  public update(dt: number, time: number, physics: PowerPhysicsHooks, companionSprite: THREE.Object3D | null, foes: PowerFoes = {}) {
    // Lila's fairy-dust ring fades out
    if (this.dustT < 1) {
      this.dustT = Math.min(1, this.dustT + dt * 2.2);
      this.dustRing.scale.setScalar(1 + this.dustT * 2.2);
      (this.dustRing.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - this.dustT);
      if (this.dustT >= 1) this.dustRing.visible = false;
    }

    // Active power countdown
    if (this.state === 'active') {
      this.timeLeft -= dt;

      // Jade guards you: enemies and projectiles that get close are knocked down
      if (this.companion === 'serpiente') {
        this.guardPos.set(physics.position.x, physics.position.y + 0.7, physics.position.z);
        this.guardRing.position.copy(this.guardPos);
        this.guardRing.rotation.y = time * 3;
        this.guardRing.scale.setScalar(1 + Math.sin(time * 8) * 0.05);
        const em = foes.enemies;
        if (em) {
          for (const e of em.enemies) {
            if (e.isSquashed) continue;
            const dx = e.position.x - physics.position.x;
            const dz = e.position.z - physics.position.z;
            const dy = e.position.y - physics.position.y;
            if (dx * dx + dz * dz < 3.2 * 3.2 && Math.abs(dy) < 3) {
              e.bop();
              e.onBopped?.();
            }
          }
          em.clearProjectilesNear(this.guardPos, 2.6);
        }
        const st = foes.stalker;
        if (st && !st.isStunned && st.position.distanceTo(physics.position) < 4.5) {
          st.isStunned = true;
          st.stunTimer = 3;
          this.emit('¡Jade espantó al Acechador! 🐉');
        }
      }

      // Float ceiling follows the ground you stand on while floating
      if (this.companion === 'nube' && physics.isGrounded) {
        physics.floatCeiling = physics.position.y + 3.0;
      }

      // Chispa's lure glides to its spot and dances there
      if (this.companion === 'luciernaga') {
        const k = 1 - Math.exp(-dt * 2.5);
        this.lurePos.lerp(this.lureGoal, k);
        this.lure.position.set(
          this.lurePos.x + Math.sin(time * 3.1) * 0.5,
          this.lurePos.y + Math.sin(time * 4.3) * 0.35,
          this.lurePos.z + Math.cos(time * 2.7) * 0.5
        );
        const pulse = 1 + Math.sin(time * 9) * 0.15;
        this.lure.scale.setScalar(pulse);
      }

      if (this.timeLeft <= 0) {
        this.finish(physics);
      }
    }

    // Companion visual feedback: glows/pulses while active, droops while hungry, hides while it is the lure
    if (companionSprite) {
      if (this.state === 'active' && this.companion === 'luciernaga') {
        companionSprite.visible = false;
      } else {
        companionSprite.visible = this.companion !== 'ninguno';
        const s =
          this.state === 'active'
            ? 1.3 + Math.sin(time * 10) * 0.12
            : this.state === 'hungry'
            ? 0.82
            : 1;
        companionSprite.scale.setScalar(s);
      }
    }
  }

  public dispose() {
    this.scene.remove(this.lure);
    this.scene.remove(this.dustRing);
    this.scene.remove(this.guardRing);
  }
}
