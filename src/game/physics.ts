/**
 * Enhanced Parkour Physics & Character Controller
 * - Responsive keyboard movement with snappy acceleration, curb step-assist & air-strafe
 * - Analog mobile touch input support (360-degree virtual joystick & dynamic touch buttons)
 * - Dynamic interactive physical objects: Rolling wool yarn balls, super-bouncy mushrooms,
 *   kinematic moving platforms with momentum transfer, and crumbling/regenerating lilypads.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import { CheckpointItem, PlatformItem, SolidObstacleCollider, WorldBuildResult } from './levels';
import { PlayerCharacterModel } from './models';

export interface PlayerInput {
  forward: number;  // -1 to 1 (analog thumbstick or keys)
  right: number;    // -1 to 1 (analog thumbstick or keys)
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
}

export class ParkourPhysics {
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public isGrounded: boolean = false;
  public currentCheckpointIndex: number = 0;
  public collectedCount: number = 0;
  public totalCollectibles: number = 0;
  public hasReachedSummit: boolean = false;
  public knockbackTimer: number = 0;

  // Companion power hooks (driven by CompanionPowerSystem)
  /** Estelita: multiplies run speed */
  public speedMultiplier: number = 1;
  /** Walnut item: multiplies jump strength */
  public jumpMultiplier: number = 1;
  /** Direction the player is trying to walk this frame (XZ, zero when idle) — used to push blocks */
  public moveDir: THREE.Vector3 = new THREE.Vector3();
  /** Nubi: slow, floaty falling; holding jump rises up to floatCeiling */
  public floatPower: boolean = false;
  public floatCeiling: number = 0;
  /** Lila (hada): one extra jump in mid-air */
  public airJumpPower: boolean = false;
  public onAirJump: (() => void) | null = null;
  private airJumpsLeft: number = 0;
  /** Catarina: catches the player on a fall and carries them back to solid ground */
  public rescueGuard: boolean = false;
  public onRescue: (() => void) | null = null;
  /** Last solid ground the player stood on (a little inward from the edge) */
  public lastSafePos: THREE.Vector3 = new THREE.Vector3(0, 0.2, 0);
  private carryTimer: number = 0;
  private readonly carryDuration = 1.3;
  private carryFrom = new THREE.Vector3();
  private carryTo = new THREE.Vector3();

  // Jump feel parameters
  private coyoteTimer: number = 0;
  private jumpBufferTimer: number = 0;
  private wasJumpPressed: boolean = false;
  private footstepTimer: number = 0;
  private isRespawning: boolean = false;

  // Attached moving platform
  private currentPlatform: PlatformItem | null = null;
  private platformVelocity: THREE.Vector3 = new THREE.Vector3();

  // Character dimensions & physical parameters
  private readonly playerRadius = 0.35;
  private readonly playerHeight = 1.35;
  private readonly stepClimbHeight = 0.45; // Max height player can step up smoothly
  private readonly gravity = 25.0;
  private readonly walkSpeed = 6.4;
  private readonly sprintSpeed = 10.2;
  private readonly jumpForce = 10.2;

  // Scratch vectors for zero GC in frame tick
  private _moveDir = new THREE.Vector3();
  private _horizontalVel = new THREE.Vector3();
  private _obsPos = new THREE.Vector3();
  private _pinwheelPaddles: THREE.Vector3[] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  private updraftFloatTimer: number = 0;

  constructor(public world: WorldBuildResult, public playerModel: PlayerCharacterModel) {
    this.totalCollectibles = world.collectibles.length;
    // Start at checkpoint 1
    if (world.checkpoints.length > 0) {
      this.respawnAtCheckpoint(0, false);
    }
  }

  public respawnAtCheckpoint(index: number = this.currentCheckpointIndex, playSound: boolean = true) {
    const cp = this.world.checkpoints[index];
    if (cp) {
      this.currentCheckpointIndex = index;
      this.position.copy(cp.spawnPos);
      this.lastSafePos.copy(cp.spawnPos);
      this.carryTimer = 0;
      this.velocity.set(0, 0, 0);
      this.isGrounded = true;
      this.knockbackTimer = 0;
      this.currentPlatform = null;
      if (playSound) {
        soundManager.playRespawnPuff();
      }
    }
  }

  public update(
    dt: number,
    input: PlayerInput,
    cameraYaw: number,
    onCheckpointActivated?: (name: string) => void,
    onVictory?: () => void
  ) {
    if (this.isRespawning) return;

    // Catarina rescue flight: gently carried along an arc back to solid ground
    if (this.carryTimer > 0) {
      this.carryTimer = Math.max(0, this.carryTimer - dt);
      const t = 1 - this.carryTimer / this.carryDuration;
      const e = t * t * (3 - 2 * t);
      this.position.lerpVectors(this.carryFrom, this.carryTo, e);
      // Swoop high enough to clear the island's side on the way back up
      const drop = Math.max(0, this.carryTo.y - this.carryFrom.y);
      this.position.y += Math.sin(t * Math.PI) * (2.0 + drop * 0.8);
      this.velocity.set(0, 0, 0);
      this.playerModel.group.position.copy(this.position);
      this.playerModel.updateAnimation(0, false, dt, performance.now() * 0.001);
      if (this.carryTimer === 0) {
        this.position.copy(this.carryTo);
        this.isGrounded = true;
        this.currentPlatform = null;
      }
      this.wasJumpPressed = input.jump;
      return;
    }

    if (this.knockbackTimer > 0) {
      this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
    }

    // 1. Coyote Time & Jump Buffer
    if (this.isGrounded) {
      this.coyoteTimer = 0.18;
      this.airJumpsLeft = 1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (input.jump && !this.wasJumpPressed) {
      this.jumpBufferTimer = 0.18;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // 2. Horizontal Movement relative to camera (Correct Screen-Space Orientation)
    const maxSpeed = (input.sprint ? this.sprintSpeed : this.walkSpeed) * this.speedMultiplier;
    const inputMagnitude = Math.min(1.0, Math.hypot(input.forward, input.right));

    if (inputMagnitude > 0.05) {
      // Camera forward vector in XZ plane
      const fwdX = Math.sin(cameraYaw);
      const fwdZ = Math.cos(cameraYaw);
      // In Three.js right-handed coordinates looking along (fwdX, 0, fwdZ),
      // the true screen right vector is (-fwdZ, 0, fwdX)
      const rightX = -fwdZ;
      const rightZ = fwdX;

      this._moveDir.set(
        fwdX * input.forward + rightX * input.right,
        0,
        fwdZ * input.forward + rightZ * input.right
      );
      this._moveDir.normalize();
      this.moveDir.copy(this._moveDir);
    } else {
      this._moveDir.set(0, 0, 0);
      this.moveDir.set(0, 0, 0);
    }

    // Snappy acceleration and friction (with knockback freedom)
    if (this.knockbackTimer > 0) {
      // Free flight while knocked back: natural air drag only so the push carries all the way
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 1.4, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 1.4, dt);
    } else {
      const targetVelX = this._moveDir.x * maxSpeed * inputMagnitude;
      const targetVelZ = this._moveDir.z * maxSpeed * inputMagnitude;
      const accelRate = this.isGrounded
        ? (inputMagnitude > 0.05 ? 24.0 : 18.0) // high ground responsiveness
        : 9.0; // agile air-strafe

      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVelX, accelRate, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVelZ, accelRate, dt);
    }

    // 3. Jump Execution with platform momentum transfer
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velocity.y = this.jumpForce * this.jumpMultiplier;

      // Transfer moving platform linear momentum on jump!
      if (this.currentPlatform && this.currentPlatform.type === 'moving') {
        this.velocity.x += this.platformVelocity.x * 0.9;
        this.velocity.z += this.platformVelocity.z * 0.9;
        if (this.platformVelocity.y > 0) {
          this.velocity.y += this.platformVelocity.y;
        }
      }

      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.isGrounded = false;
      this.currentPlatform = null;
      soundManager.playJump();
    } else if (this.airJumpPower && this.jumpBufferTimer > 0 && !this.isGrounded && this.airJumpsLeft > 0 && this.carryTimer <= 0) {
      // Fairy dust: a second jump in mid-air
      this.velocity.y = this.jumpForce * this.jumpMultiplier * 0.92;
      this.airJumpsLeft--;
      this.jumpBufferTimer = 0;
      soundManager.playJump();
      this.onAirJump?.();
    }

    // 4. Updraft Geyser check
    let insideUpdraft = false;
    if (this.updraftFloatTimer > 0) {
      this.updraftFloatTimer -= dt;
    }

    for (const plat of this.world.platforms) {
      if (plat.type === 'updraft') {
        const dx = this.position.x - plat.position.x;
        const dz = this.position.z - plat.position.z;
        const distSq = dx * dx + dz * dz;
        const radius = plat.size.x * 0.65;
        if (
          distSq < radius * radius &&
          this.position.y >= plat.position.y - 0.5 &&
          this.position.y <= plat.position.y + plat.size.y
        ) {
          insideUpdraft = true;
          this.updraftFloatTimer = 0.95; // Extra hangtime & gentle glide upon leaving thermal!

          // High buoyant vertical lift (swift & soaring to +15.5 m/s)
          this.velocity.y = THREE.MathUtils.damp(this.velocity.y, 15.5, 6.5, dt);
          this.isGrounded = false;

          // Atmospheric forward wind boost towards next platform (+Z)
          if (this.position.y > plat.position.y + 4.0) {
            this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 6.8, 4.0, dt);
          }

          soundManager.playUpdraft();
          break;
        }
      }
    }

    // 5. Gravity & Variable Jump Height (with Updraft Glide float)
    if (!this.isGrounded && !insideUpdraft) {
      // Shorter hop if jump key is released early
      let gravityMult = !input.jump && this.velocity.y > 0 ? 1.75 : 1.0;
      // Gentle air float when exiting high updraft
      if (this.updraftFloatTimer > 0 && this.velocity.y <= 0) {
        gravityMult *= 0.42; // 58% softer gravity float for easy glide to platform!
      }
      if (this.floatPower) {
        // Nubi: hold jump to drift upward (up to a ceiling), otherwise glide down slowly
        if (input.jump && this.position.y < this.floatCeiling) {
          this.velocity.y = THREE.MathUtils.damp(this.velocity.y, 3.2, 5.0, dt);
        } else {
          this.velocity.y -= this.gravity * 0.25 * dt;
          if (this.velocity.y < -1.8) this.velocity.y = THREE.MathUtils.damp(this.velocity.y, -1.8, 8.0, dt);
        }
      } else {
        this.velocity.y -= this.gravity * gravityMult * dt;
      }
    }

    // Clamp terminal fall velocity
    if (this.velocity.y < -32) {
      this.velocity.y = -32;
    }

    // 6. Integrate Position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Inherit moving platform velocity if standing on one
    if (this.isGrounded && this.currentPlatform && this.currentPlatform.type === 'moving') {
      this.position.addScaledVector(this.platformVelocity, dt);
    }

    // 7. Collision Detection against Platforms (with Step Curb Assist)
    this.resolvePlatformCollisions(input);

    // 7b. Solid World Objects (Trees, Checkpoint bells, Stone pillars, Obstacle posts)
    this.resolveSolidObstacleCollisions();

    // 7c. Remember the last safe ground (static islands only), nudged toward the island center
    if (this.isGrounded && this.currentPlatform && this.currentPlatform.type === 'static') {
      const plat = this.currentPlatform;
      this.lastSafePos.copy(this.position);
      const dx = plat.position.x - this.position.x;
      const dz = plat.position.z - this.position.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) {
        const step = Math.min(len, 1.0);
        this.lastSafePos.x += (dx / len) * step;
        this.lastSafePos.z += (dz / len) * step;
      }
    }

    // 8. Update Crumbling Platforms
    this.updateCrumblingPlatforms(dt);

    // 9. Interactive Rolling Wool Balls Physics
    this.updateRollingBallsPhysics(dt);

    // 10. Swinging Chime Obstacle Hitbox Check
    for (const obs of this.world.obstacles) {
      obs.getHitboxPosition(this._obsPos);
      const dist = this.position.distanceTo(this._obsPos);
      if (dist < this.playerRadius + obs.bobRadius) {
        // Forceful physical bonk pushing player away from bob
        const pushDir = this.position.clone().sub(this._obsPos).normalize();
        pushDir.y = 0.35;
        pushDir.normalize();
        this.velocity.set(pushDir.x * 12.5, 4.5, pushDir.z * 12.5);
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.knockbackTimer = 0.35;
        soundManager.playMushroomBounce();
      }
    }

    // 10a. Rotating Floral Pinwheels Hitbox Check
    if (this.world.pinwheels) {
      for (const pin of this.world.pinwheels) {
        pin.getHitboxPositions(this._pinwheelPaddles);
        for (const paddlePos of this._pinwheelPaddles) {
          const dist = this.position.distanceTo(paddlePos);
          if (dist < this.playerRadius + 0.65) {
            const pushDir = this.position.clone().sub(paddlePos).normalize();
            pushDir.y = 0.32;
            pushDir.normalize();
            this.velocity.set(pushDir.x * 11.8, 4.2, pushDir.z * 11.8);
            this.isGrounded = false;
            this.coyoteTimer = 0;
            this.knockbackTimer = 0.32;
            soundManager.playWoodRattle();
            break;
          }
        }
      }
    }

    // 10b. Rotating Balance Log Surface Velocity Check
    if (this.world.balanceLogs) {
      for (const log of this.world.balanceLogs) {
        const b = log.bounds;
        if (
          this.position.x >= b.minX - this.playerRadius &&
          this.position.x <= b.maxX + this.playerRadius &&
          this.position.z >= b.minZ - this.playerRadius &&
          this.position.z <= b.maxZ + this.playerRadius
        ) {
          const feetY = this.position.y;
          if (feetY >= b.y - 0.45 && feetY <= b.y + 0.6) {
            // Player standing on rotating balance log -> apply surface roll!
            const surfaceSpeed = log.speed * log.radius * 2.2;
            if (log.axis === 'z') {
              this.position.x += surfaceSpeed * dt;
            } else {
              this.position.z += surfaceSpeed * dt;
            }
          }
        }
      }
    }

    // 10c. Spore Steam Vent Eruptions
    if (this.world.steamVents) {
      for (const vent of this.world.steamVents) {
        vent.getHitboxPosition(this._obsPos);
        const distXZ = Math.hypot(this.position.x - this._obsPos.x, this.position.z - this._obsPos.z);
        if (distXZ < this.playerRadius + vent.radius && Math.abs(this.position.y - this._obsPos.y) < 2.5) {
          if (vent.isErupting) {
            this.velocity.y = 14.5;
            this.isGrounded = false;
            this.coyoteTimer = 0;
            soundManager.playSteamPuff();
          }
        }
      }
    }

    // 10d. Cozy Enemies (Sproutlings & Zephyr Puffs) AI & Collision Check
    if (this.world.enemyManager) {
      this.world.enemyManager.update(dt, performance.now() * 0.001, this.position);
      this.world.enemyManager.checkPlayerCollisions(
        this.position,
        this.velocity,
        this.playerRadius,
        () => {
          // Bop enemy on head: super vault jump!
          this.isGrounded = false;
          this.coyoteTimer = 0;
          this.knockbackTimer = 0;
        },
        () => {
          // Body hit / wind gust: push player OFF the platform!
          this.isGrounded = false;
          this.coyoteTimer = 0;
          this.currentPlatform = null;
          this.knockbackTimer = 0.45; // 0.45 seconds of pure flight without input damping
        }
      );
    }

    // 11. Collectibles Pickup Check
    for (const col of this.world.collectibles) {
      if (!col.collected) {
        const dist = this.position.distanceTo(col.group.position);
        if (dist < 1.4) {
          col.collected = true;
          this.collectedCount++;
          soundManager.playCollectible();
        }
      }
    }

    // 12. Checkpoint Activation Check
    for (let i = 0; i < this.world.checkpoints.length; i++) {
      const cp = this.world.checkpoints[i];
      const dist = this.position.distanceTo(cp.spawnPos);
      if (dist < 3.2 && !cp.shrine.activated) {
        cp.shrine.activate();
        this.currentCheckpointIndex = i;
        soundManager.playCheckpoint();
        if (onCheckpointActivated) {
          onCheckpointActivated(cp.name);
        }
      }
    }

    // 13. Summit Reached Check
    if (!this.hasReachedSummit) {
      const distToSummit = this.position.distanceTo(this.world.summitPosition);
      if (distToSummit < 5.0 && (this.isGrounded || !this.world.summitRequiresLanding)) {
        this.hasReachedSummit = true;
        soundManager.playVictory();
        if (onVictory) {
          onVictory();
        }
      }
    }

    // 14. Gentle Respawn on falling off into clouds
    if (
      this.rescueGuard &&
      !this.isGrounded &&
      this.velocity.y < 0 &&
      (this.position.y < this.lastSafePos.y - 6.5 || this.position.y < -8.0)
    ) {
      // Catarina swoops in and carries the player back
      this.rescueGuard = false;
      this.carryFrom.copy(this.position);
      this.carryTo.copy(this.lastSafePos);
      this.carryTimer = this.carryDuration;
      this.velocity.set(0, 0, 0);
      this.knockbackTimer = 0;
      const cb = this.onRescue;
      this.onRescue = null;
      cb?.();
    } else if (this.position.y < -9.0) {
      this.respawnAtCheckpoint();
    }

    // 15. Update Player Visual Model
    this.playerModel.group.position.copy(this.position);
    this._horizontalVel.set(this.velocity.x, 0, this.velocity.z);
    const horizSpeed = this._horizontalVel.length();

    // Rotate player mesh toward direction of movement smoothly
    if (horizSpeed > 0.25) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      this.playerModel.group.rotation.y = THREE.MathUtils.damp(
        this.playerModel.group.rotation.y,
        targetAngle,
        15.0,
        dt
      );
    }

    // Play footstep sounds periodically
    if (this.isGrounded && horizSpeed > 0.4) {
      this.footstepTimer -= dt * (input.sprint ? 1.6 : 1.1);
      if (this.footstepTimer <= 0) {
        soundManager.playFootstep();
        this.footstepTimer = 0.3;
      }
    } else {
      this.footstepTimer = 0.08;
    }

    // Update animations on composite model
    this.playerModel.updateAnimation(horizSpeed, this.isGrounded, dt, performance.now() * 0.001);

    this.wasJumpPressed = input.jump;
  }

  private resolvePlatformCollisions(input: PlayerInput) {
    let wasOnGround = false;
    this.currentPlatform = null;

    const feetY = this.position.y;
    const headY = this.position.y + this.playerHeight;

    for (const plat of this.world.platforms) {
      if (plat.type === 'updraft') continue;
      // Skip platforms that are temporarily fallen
      if (plat.type === 'crumbling' && plat.crumbleTimer !== undefined && plat.crumbleTimer <= 0) {
        continue;
      }

      const halfW = plat.size.x * 0.5;
      const halfD = plat.size.z * 0.5;
      const topY = plat.position.y;
      const bottomY = plat.position.y - plat.size.y;

      // Check XZ bounding overlap with player radius
      if (
        this.position.x + this.playerRadius > plat.position.x - halfW &&
        this.position.x - this.playerRadius < plat.position.x + halfW &&
        this.position.z + this.playerRadius > plat.position.z - halfD &&
        this.position.z - this.playerRadius < plat.position.z + halfD
      ) {
        // Step Curb Climbing Assist: If player runs into a slight elevation step, smoothly climb
        if (
          feetY < topY &&
          topY - feetY <= this.stepClimbHeight &&
          this.velocity.y <= 0.1
        ) {
          this.position.y = topY;
          this.velocity.y = 0;
          wasOnGround = true;
          this.currentPlatform = plat;
          break;
        }

        // Landing on top surface
        if (
          feetY >= topY - 0.5 &&
          feetY <= topY + 0.35 &&
          this.velocity.y <= 0.05
        ) {
          // Check for Bouncy Mushroom trampoline
          if (plat.type === 'bouncy' && plat.bouncyModel) {
            // Super Bounce check: if player hits Jump right at contact, super launch!
            const isSuper = input.jump || this.jumpBufferTimer > 0;
            const bounceForce = isSuper ? 23.5 : 18.0;

            plat.bouncyModel.triggerBounce(isSuper);
            this.velocity.y = bounceForce;
            this.position.y = topY + 0.15;
            wasOnGround = false;
            this.jumpBufferTimer = 0;
            soundManager.playMushroomBounce();
            return;
          }

          // Trigger crumbling on fragile lilypad platforms
          if (plat.type === 'crumbling') {
            plat.isCrumbling = true;
          }

          this.position.y = topY;
          this.velocity.y = 0;
          wasOnGround = true;
          this.currentPlatform = plat;
          break;
        }

        // Side horizontal wall resolution
        if (feetY < topY - 0.1 && headY > bottomY) {
          const dx1 = this.position.x - (plat.position.x - halfW);
          const dx2 = (plat.position.x + halfW) - this.position.x;
          const dz1 = this.position.z - (plat.position.z - halfD);
          const dz2 = (plat.position.z + halfD) - this.position.z;

          const minOver = Math.min(dx1, dx2, dz1, dz2);
          if (minOver === dx1) this.position.x = plat.position.x - halfW - this.playerRadius;
          else if (minOver === dx2) this.position.x = plat.position.x + halfW + this.playerRadius;
          else if (minOver === dz1) this.position.z = plat.position.z - halfD - this.playerRadius;
          else if (minOver === dz2) this.position.z = plat.position.z + halfD + this.playerRadius;
        }
      }
    }

    // Solid pieces (doors, walls, push rocks) block you even while you stand on another floor
    const feetNow = this.position.y;
    for (const plat of this.world.platforms) {
      if (!plat.solid || plat === this.currentPlatform) continue;
      const halfW = plat.size.x * 0.5;
      const halfD = plat.size.z * 0.5;
      const topY = plat.position.y;
      const bottomY = plat.position.y - plat.size.y;
      if (
        this.position.x + this.playerRadius <= plat.position.x - halfW ||
        this.position.x - this.playerRadius >= plat.position.x + halfW ||
        this.position.z + this.playerRadius <= plat.position.z - halfD ||
        this.position.z - this.playerRadius >= plat.position.z + halfD
      ) continue;
      if (feetNow >= topY - 0.1 || feetNow + this.playerHeight <= bottomY) continue;
      if (topY - feetNow <= this.stepClimbHeight && this.velocity.y <= 0.1) {
        this.position.y = topY;
        this.velocity.y = 0;
        wasOnGround = true;
        this.currentPlatform = plat;
        continue;
      }
      const dx1 = this.position.x - (plat.position.x - halfW);
      const dx2 = plat.position.x + halfW - this.position.x;
      const dz1 = this.position.z - (plat.position.z - halfD);
      const dz2 = plat.position.z + halfD - this.position.z;
      const minOver = Math.min(dx1, dx2, dz1, dz2);
      if (minOver === dx1) this.position.x = plat.position.x - halfW - this.playerRadius;
      else if (minOver === dx2) this.position.x = plat.position.x + halfW + this.playerRadius;
      else if (minOver === dz1) this.position.z = plat.position.z - halfD - this.playerRadius;
      else this.position.z = plat.position.z + halfD + this.playerRadius;
    }

    this.isGrounded = wasOnGround;
  }

  // --- Solid World Objects Collision Resolution (Trees, Checkpoint bells, Stone pillars, Obstacle posts) ---
  private resolveSolidObstacleCollisions() {
    if (!this.world.solidObstacles || this.world.solidObstacles.length === 0) return;

    const feetY = this.position.y;
    const headY = this.position.y + this.playerHeight;

    for (const obs of this.world.solidObstacles) {
      // Check vertical intersection
      if (headY <= obs.bottomY || feetY >= obs.topY) continue;

      if (obs.type === 'cylinder' && obs.radius) {
        const dx = this.position.x - obs.position.x;
        const dz = this.position.z - obs.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = this.playerRadius + obs.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const pushX = dist > 0.0001 ? (dx / dist) : 1;
          const pushZ = dist > 0.0001 ? (dz / dist) : 0;

          // Push player out of obstacle cylinder bounds
          this.position.x = obs.position.x + pushX * minDist;
          this.position.z = obs.position.z + pushZ * minDist;

          // Zero out velocity heading directly into the object
          const dot = this.velocity.x * pushX + this.velocity.z * pushZ;
          if (dot < 0) {
            this.velocity.x -= dot * pushX;
            this.velocity.z -= dot * pushZ;
          }
        }
      }
    }
  }

  // --- Dynamic Physical Obstacles & Crumbling Platforms ---
  private updateCrumblingPlatforms(dt: number) {
    for (const plat of this.world.platforms) {
      if (plat.type === 'crumbling' && plat.originalY !== undefined) {
        if (plat.isCrumbling) {
          plat.crumbleTimer = (plat.crumbleTimer ?? 1.6) - dt;

          if (plat.crumbleTimer > 0) {
            // Wobble and sink under player's weight
            const elapsed = 1.6 - plat.crumbleTimer;
            const wobble = Math.sin(elapsed * 25) * 0.05;
            plat.mesh.position.y = plat.originalY - elapsed * 0.2 + wobble;
            plat.position.y = plat.mesh.position.y;
          } else {
            // Drop away fast
            plat.mesh.position.y -= 18.0 * dt;
            plat.position.y = -100; // remove collision
            plat.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 3));

            // Regenerate after 2.8 seconds
            if (plat.crumbleTimer < -2.8) {
              plat.isCrumbling = false;
              plat.crumbleTimer = 1.6;
              plat.mesh.position.y = plat.originalY;
              plat.position.y = plat.originalY;
              plat.mesh.scale.set(1, 1, 1);
            }
          }
        }
      }
    }
  }

  private updateRollingBallsPhysics(dt: number) {
    if (!this.world.rollingBalls) return;

    for (const ball of this.world.rollingBalls) {
      ball.update(dt);

      // Check collision between player and rolling ball
      const dx = this.position.x - ball.position.x;
      const dz = this.position.z - ball.position.z;
      const distXZ = Math.sqrt(dx * dx + dz * dz);
      const minDist = this.playerRadius + ball.radius;

      if (distXZ < minDist) {
        const playerBottom = this.position.y;
        const ballTop = ball.position.y + ball.radius * 1.5;

        // Player jumped on top of the rolling ball -> Joyful trampoline vault!
        if (playerBottom >= ballTop - 0.4 && this.velocity.y <= 0) {
          this.velocity.y = 12.0;
          this.isGrounded = false;
          ball.applyImpulse(new THREE.Vector3(dx * 1.5, 0, dz * 1.5));
          soundManager.playMushroomBounce();
        } else {
          // Ball bumps into player horizontally -> Newton impulse transfer
          const normal = new THREE.Vector3(dx, 0, dz).normalize();
          this.velocity.addScaledVector(normal, 8.5);
          ball.velocity.addScaledVector(normal, -1.5);
          soundManager.playFootstep();
        }
      }
    }
  }

  public updateMovingPlatforms(time: number, dt: number) {
    for (const plat of this.world.platforms) {
      if (plat.type === 'moving' && plat.movement && plat.initialPos) {
        const m = plat.movement;
        const oldPosVal = plat.position[m.axis];
        const newPosVal = plat.initialPos[m.axis] + Math.sin(time * m.speed + m.offset) * m.amplitude;

        plat.position[m.axis] = newPosVal;
        plat.mesh.position[m.axis] = newPosVal;

        // Calculate velocity of platform for player inheritance
        const velVal = (newPosVal - oldPosVal) / Math.max(0.001, dt);
        if (this.currentPlatform === plat) {
          this.platformVelocity.set(0, 0, 0);
          this.platformVelocity[m.axis] = velVal;
        }
      }
    }
  }
}
