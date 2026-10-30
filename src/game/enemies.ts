/**
 * Cozy Enemies System:
 * 1. "Sproutling" (Acorn Moss-Sprite): Waddles along platforms, spins its acorn leaf propeller,
 *    can be bopped on the head like a trampoline for a high vault or pushes player on side bump.
 * 2. "Zephyr Puff" (Wind Wisp Cloud): Floats near gap bridges, inhales with puffed cheeks (telegraph),
 *    and blows a gentle breeze gust that tests player parkour timing.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import { ProceduralTextures } from './textures';

export type EnemyType = 'sproutling' | 'zephyr_puff';

export interface CozyEnemy {
  id: string;
  type: EnemyType;
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  height: number;
  isSquashed: boolean;
  squashTimer: number;
  // AI Patrol & Telegraph
  patrolAxis: 'x' | 'z';
  minBound: number;
  maxBound: number;
  direction: number; // 1 or -1
  speed: number;
  telegraphTimer: number;
  isTelegraphing: boolean;
  isBlowing: boolean;
  // Sub-mesh animation parts
  animParts: {
    body: THREE.Mesh;
    propeller?: THREE.Group;
    cheeks?: THREE.Group;
    wings?: THREE.Group;
    feet?: THREE.Group;
    windCone?: THREE.Mesh;
  };
  update: (dt: number, time: number, playerPos: THREE.Vector3) => void;
  bop: () => void;
}

export class EnemyManager {
  public enemies: CozyEnemy[] = [];
  private scene: THREE.Scene;
  private textures: ProceduralTextures;

  // Reusable collision vectors
  private _playerPush = new THREE.Vector3();

  constructor(scene: THREE.Scene, textures: ProceduralTextures) {
    this.scene = scene;
    this.textures = textures;
  }

  // --- 1. Sproutling Factory ---
  public spawnSproutling(
    id: string,
    spawnPos: THREE.Vector3,
    patrolAxis: 'x' | 'z',
    range: number = 4.0
  ): CozyEnemy {
    const group = new THREE.Group();
    group.position.copy(spawnPos);

    // Materials
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x6ca34e, // vibrant cozy moss green
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    const acornMat = new THREE.MeshStandardMaterial({
      color: 0x77492c, // warm acorn cup wood
      roughness: 0.75,
      metalness: 0.1,
    });

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x95d55a, // bright sprout green
      roughness: 0.6,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1f1915,
      roughness: 0.1,
      metalness: 0.2,
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x4a3222,
      roughness: 0.8,
      metalness: 0.05,
    });

    // 1. Primary: Round Moss Body
    const bodyGeom = new THREE.SphereGeometry(0.36, 12, 10);
    bodyGeom.scale(1.1, 0.95, 1.1);
    const body = new THREE.Mesh(bodyGeom, mossMat);
    body.position.y = 0.38;
    body.castShadow = true;
    group.add(body);

    // 2. Acorn Cap Helmet
    const helmetGeom = new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const helmet = new THREE.Mesh(helmetGeom, acornMat);
    helmet.position.set(0, 0.58, -0.02);
    helmet.rotation.x = -0.15;
    helmet.castShadow = true;
    group.add(helmet);

    // Helmet acorn stem
    const stemGeom = new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6);
    const stem = new THREE.Mesh(stemGeom, acornMat);
    stem.position.set(0, 0.76, -0.03);
    group.add(stem);

    // 3. Spinning Twin-Leaf Propeller on stem
    const propeller = new THREE.Group();
    propeller.position.set(0, 0.82, -0.03);

    const leafGeom1 = new THREE.ConeGeometry(0.08, 0.24, 5);
    leafGeom1.rotateZ(Math.PI / 2);
    leafGeom1.scale(1, 0.2, 1);
    const leaf1 = new THREE.Mesh(leafGeom1, leafMat);
    leaf1.position.x = 0.12;

    const leaf2 = leaf1.clone();
    leaf2.position.x = -0.12;
    leaf2.rotation.z = Math.PI;
    propeller.add(leaf1, leaf2);
    group.add(propeller);

    // 4. Eyes & Highlights
    const eyeGeom = new THREE.SphereGeometry(0.04, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(0.12, 0.42, 0.32);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(-0.12, 0.42, 0.32);

    const hlGeom = new THREE.SphereGeometry(0.015, 6, 6);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftHl = new THREE.Mesh(hlGeom, hlMat);
    leftHl.position.set(0.13, 0.44, 0.35);
    const rightHl = new THREE.Mesh(hlGeom, hlMat);
    rightHl.position.set(-0.11, 0.44, 0.35);
    group.add(leftEye, rightEye, leftHl, rightHl);

    // Rosy Cheeks
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff9999, transparent: true, opacity: 0.7 });
    const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), cheekMat);
    leftCheek.position.set(0.18, 0.36, 0.28);
    const rightCheek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), cheekMat);
    rightCheek.position.set(-0.18, 0.36, 0.28);
    group.add(leftCheek, rightCheek);

    // 5. Wobbly Wooden Shoes / Feet
    const feet = new THREE.Group();
    const footGeom = new THREE.CapsuleGeometry(0.07, 0.12, 6, 6);
    footGeom.rotateX(Math.PI / 2);
    const leftFoot = new THREE.Mesh(footGeom, bootMat);
    leftFoot.position.set(0.14, 0.08, 0.05);
    leftFoot.castShadow = true;

    const rightFoot = new THREE.Mesh(footGeom, bootMat);
    rightFoot.position.set(-0.14, 0.08, 0.05);
    rightFoot.castShadow = true;
    feet.add(leftFoot, rightFoot);
    group.add(feet);

    // 6. Contact Shadow
    const shadowGeom = new THREE.PlaneGeometry(0.8, 0.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.shadow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);

    this.scene.add(group);

    const minBound = spawnPos[patrolAxis] - range;
    const maxBound = spawnPos[patrolAxis] + range;

    const enemy: CozyEnemy = {
      id,
      type: 'sproutling',
      group,
      position: spawnPos.clone(),
      velocity: new THREE.Vector3(),
      radius: 0.42,
      height: 0.85,
      isSquashed: false,
      squashTimer: 0,
      patrolAxis,
      minBound,
      maxBound,
      direction: 1,
      speed: 1.8,
      telegraphTimer: 0,
      isTelegraphing: false,
      isBlowing: false,
      animParts: {
        body,
        propeller,
        feet,
      },
      bop() {
        this.isSquashed = true;
        this.squashTimer = 4.0;
        soundManager.playEnemyBoop();
      },
      update(dt: number, time: number, playerPos: THREE.Vector3) {
        if (this.isSquashed) {
          this.squashTimer -= dt;
          // Flattened pancake squash animation
          this.group.scale.set(1.4, 0.22, 1.4);
          if (this.squashTimer <= 0) {
            this.isSquashed = false;
            this.group.scale.set(1, 1, 1);
          }
          return;
        }

        // Distance to player for cute telegraph excitement
        const distToPlayer = this.position.distanceTo(playerPos);
        const seesPlayer = distToPlayer < 4.5;

        const currentSpeed = seesPlayer ? this.speed * 1.5 : this.speed;

        // Patrol along assigned axis
        this.position[this.patrolAxis] += this.direction * currentSpeed * dt;

        if (this.position[this.patrolAxis] > this.maxBound) {
          this.position[this.patrolAxis] = this.maxBound;
          this.direction = -1;
        } else if (this.position[this.patrolAxis] < this.minBound) {
          this.position[this.patrolAxis] = this.minBound;
          this.direction = 1;
        }

        // Face movement direction
        const targetRotY =
          this.patrolAxis === 'x'
            ? this.direction > 0
              ? Math.PI / 2
              : -Math.PI / 2
            : this.direction > 0
            ? 0
            : Math.PI;
        this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, targetRotY, 12, dt);

        this.group.position.copy(this.position);

        // Animated waddle walk & leaf spin
        const waddleFreq = currentSpeed * 6.5;
        this.animParts.body.position.y = 0.38 + Math.abs(Math.sin(time * waddleFreq)) * 0.06;
        this.animParts.body.rotation.z = Math.sin(time * waddleFreq) * 0.08;

        if (this.animParts.feet) {
          leftFoot.position.z = Math.sin(time * waddleFreq) * 0.12;
          rightFoot.position.z = -Math.sin(time * waddleFreq) * 0.12;
        }

        if (this.animParts.propeller) {
          // Leaf propeller spins happily
          this.animParts.propeller.rotation.y += dt * (seesPlayer ? 18.0 : 8.0);
        }
      },
    };

    this.enemies.push(enemy);
    return enemy;
  }

  // --- 2. Zephyr Puff Factory ---
  public spawnZephyrPuff(
    id: string,
    spawnPos: THREE.Vector3,
    patrolAxis: 'x' | 'z',
    range: number = 3.5
  ): CozyEnemy {
    const group = new THREE.Group();
    group.position.copy(spawnPos);

    // Materials
    const cloudPuffMat = new THREE.MeshStandardMaterial({
      color: 0xf2f7ff, // soft pillowy cloud lavender-white
      roughness: 0.95,
      metalness: 0.05,
      flatShading: false,
    });

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xe5a93c, // whimsical little brass horn snout
      roughness: 0.3,
      metalness: 0.8,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1a2130,
      roughness: 0.1,
      metalness: 0.2,
    });

    // 1. Primary: Puffy Cloud Body (4 overlapping spheres)
    const body = new THREE.Group();
    const centralGeom = new THREE.SphereGeometry(0.38, 10, 8);
    centralGeom.scale(1.2, 0.9, 1.1);
    const centerMesh = new THREE.Mesh(centralGeom, cloudPuffMat);
    centerMesh.castShadow = true;
    body.add(centerMesh);

    // Billowing cheek puffs
    const cheeks = new THREE.Group();
    const cheekGeom = new THREE.SphereGeometry(0.18, 8, 8);
    const leftCheekPuff = new THREE.Mesh(cheekGeom, cloudPuffMat);
    leftCheekPuff.position.set(0.24, -0.05, 0.18);
    const rightCheekPuff = new THREE.Mesh(cheekGeom, cloudPuffMat);
    rightCheekPuff.position.set(-0.24, -0.05, 0.18);
    cheeks.add(leftCheekPuff, rightCheekPuff);
    body.add(cheeks);

    // 2. Cute Trumpet Snout / Breeze Nozzle
    const snoutGeom = new THREE.CylinderGeometry(0.08, 0.04, 0.16, 8);
    snoutGeom.rotateX(Math.PI / 2);
    const snout = new THREE.Mesh(snoutGeom, brassMat);
    snout.position.set(0, -0.06, 0.38);
    body.add(snout);

    // 3. Sleepy/Mischievous Bead Eyes
    const eyeGeom = new THREE.SphereGeometry(0.035, 6, 6);
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(0.12, 0.1, 0.36);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(-0.12, 0.1, 0.36);
    body.add(leftEye, rightEye);

    // Little brow arches
    const browMat = new THREE.MeshBasicMaterial({ color: 0x4a5568 });
    const browGeom = new THREE.BoxGeometry(0.06, 0.015, 0.01);
    const leftBrow = new THREE.Mesh(browGeom, browMat);
    leftBrow.position.set(0.12, 0.16, 0.38);
    leftBrow.rotation.z = -0.15;
    const rightBrow = new THREE.Mesh(browGeom, browMat);
    rightBrow.position.set(-0.12, 0.16, 0.38);
    rightBrow.rotation.z = 0.15;
    body.add(leftBrow, rightBrow);

    // 4. Fluttering Cloud Wings
    const wings = new THREE.Group();
    const wingGeom = new THREE.ConeGeometry(0.12, 0.32, 6);
    wingGeom.scale(1, 0.25, 1);
    const leftWing = new THREE.Mesh(wingGeom, wingMat);
    leftWing.position.set(0.42, 0.1, 0);
    leftWing.rotation.z = -Math.PI / 3;

    const rightWing = new THREE.Mesh(wingGeom, wingMat);
    rightWing.position.set(-0.42, 0.1, 0);
    rightWing.rotation.z = Math.PI / 3;
    wings.add(leftWing, rightWing);
    body.add(wings);

    // 5. Breeze Wind Vortex Cone (Visible when blowing)
    const windConeGeom = new THREE.ConeGeometry(0.65, 2.2, 8, 1, true);
    windConeGeom.rotateX(-Math.PI / 2);
    windConeGeom.translate(0, 0, 1.1);
    const windConeMat = new THREE.MeshBasicMaterial({
      color: 0xcbf3f0,
      transparent: true,
      opacity: 0,
      wireframe: true,
    });
    const windCone = new THREE.Mesh(windConeGeom, windConeMat);
    windCone.position.set(0, -0.06, 0.4);
    body.add(windCone);

    group.add(body);

    // 6. Contact Shadow
    const shadowGeom = new THREE.PlaneGeometry(0.9, 0.9);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.shadow,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -spawnPos.y + 0.1; // adjust to platform beneath
    group.add(shadow);

    this.scene.add(group);

    const minBound = spawnPos[patrolAxis] - range;
    const maxBound = spawnPos[patrolAxis] + range;

    const enemy: CozyEnemy = {
      id,
      type: 'zephyr_puff',
      group,
      position: spawnPos.clone(),
      velocity: new THREE.Vector3(),
      radius: 0.5,
      height: 0.8,
      isSquashed: false,
      squashTimer: 0,
      patrolAxis,
      minBound,
      maxBound,
      direction: 1,
      speed: 1.2,
      telegraphTimer: 0,
      isTelegraphing: false,
      isBlowing: false,
      animParts: {
        body: centerMesh,
        cheeks,
        wings,
        windCone,
      },
      bop() {
        this.isSquashed = true;
        this.squashTimer = 4.0;
        this.isBlowing = false;
        if (this.animParts.windCone) {
          (this.animParts.windCone.material as THREE.MeshBasicMaterial).opacity = 0;
        }
        soundManager.playEnemyBoop();
      },
      update(dt: number, time: number, playerPos: THREE.Vector3) {
        if (this.isSquashed) {
          this.squashTimer -= dt;
          this.group.scale.set(1.4, 0.25, 1.4);
          if (this.squashTimer <= 0) {
            this.isSquashed = false;
            this.group.scale.set(1, 1, 1);
          }
          return;
        }

        // Cycle through: Hovering Patrol (3.5s) -> Inhale Telegraph (1.2s) -> Blow Breeze (1.6s)
        this.telegraphTimer += dt;
        const cycle = this.telegraphTimer % 6.5;

        if (cycle < 3.5) {
          // 1. Calm patrol
          this.isTelegraphing = false;
          this.isBlowing = false;
          this.position[this.patrolAxis] += this.direction * this.speed * dt;
          if (this.position[this.patrolAxis] > this.maxBound) {
            this.position[this.patrolAxis] = this.maxBound;
            this.direction = -1;
          } else if (this.position[this.patrolAxis] < this.minBound) {
            this.position[this.patrolAxis] = this.minBound;
            this.direction = 1;
          }

          if (this.animParts.cheeks) {
            this.animParts.cheeks.scale.set(1, 1, 1);
          }
          if (this.animParts.windCone) {
            (this.animParts.windCone.material as THREE.MeshBasicMaterial).opacity = 0;
          }
        } else if (cycle < 4.7) {
          // 2. Inhale Telegraph! Cheeks puff up big, wings flutter excitedly!
          this.isTelegraphing = true;
          this.isBlowing = false;
          const inhaleProgress = (cycle - 3.5) / 1.2;
          const puffScale = 1.0 + Math.sin(inhaleProgress * Math.PI * 0.5) * 0.5;

          if (this.animParts.cheeks) {
            this.animParts.cheeks.scale.set(puffScale, puffScale, puffScale);
          }
        } else {
          // 3. Blow Wind Gust!
          this.isTelegraphing = false;
          if (!this.isBlowing) {
            this.isBlowing = true;
            soundManager.playWindGust();
          }

          if (this.animParts.cheeks) {
            this.animParts.cheeks.scale.set(0.9, 0.9, 0.9);
          }

          // Wind cone visuals
          if (this.animParts.windCone) {
            const windMat = this.animParts.windCone.material as THREE.MeshBasicMaterial;
            windMat.opacity = 0.55 + Math.sin(time * 20) * 0.2;
            this.animParts.windCone.rotation.z += dt * 10;
          }
        }

        // Face movement direction or player when blowing
        const targetRotY =
          this.patrolAxis === 'x'
            ? this.direction > 0
              ? Math.PI / 2
              : -Math.PI / 2
            : this.direction > 0
            ? 0
            : Math.PI;
        this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, targetRotY, 8, dt);

        // Sinusoidal floating height
        this.position.y = spawnPos.y + Math.sin(time * 2.8) * 0.18;
        this.group.position.copy(this.position);

        // Wing flutter
        if (this.animParts.wings) {
          const flutterSpeed = this.isTelegraphing ? 25 : 10;
          leftWing.rotation.x = Math.sin(time * flutterSpeed) * 0.4;
          rightWing.rotation.x = Math.sin(time * flutterSpeed) * 0.4;
        }
      },
    };

    this.enemies.push(enemy);
    return enemy;
  }

  // --- Collision resolution with Player ---
  public checkPlayerCollisions(
    playerPosition: THREE.Vector3,
    playerVelocity: THREE.Vector3,
    playerRadius: number,
    onPlayerBounce: () => void,
    onPlayerKnockback: (forceDir: THREE.Vector3) => void
  ) {
    for (const enemy of this.enemies) {
      if (enemy.isSquashed) continue;

      // 1. Zephyr Puff Wind Gust Blast Check
      if (enemy.type === 'zephyr_puff' && enemy.isBlowing) {
        const toPlayer = playerPosition.clone().sub(enemy.position);
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(enemy.group.rotation);
        const dist = toPlayer.length();
        const dirToPlayer = toPlayer.clone().normalize();
        const dot = dirToPlayer.dot(forward);

        if (dot > 0.45 && dist < 4.5 && Math.abs(playerPosition.y - enemy.position.y) < 2.8) {
          // Gale force wind knocks player off bridge!
          playerVelocity.x = forward.x * 15.5;
          playerVelocity.y = 4.8;
          playerVelocity.z = forward.z * 15.5;
          onPlayerKnockback(forward);
          soundManager.playSteamPuff();
          continue;
        }
      }

      // 2. Physical Body Contact Check
      const dx = playerPosition.x - enemy.position.x;
      const dz = playerPosition.z - enemy.position.z;
      const distXZ = Math.hypot(dx, dz);
      const minDist = playerRadius + enemy.radius;

      if (distXZ < minDist) {
        const playerFeetY = playerPosition.y;
        const enemyTopY = enemy.position.y + enemy.height * 0.65;

        // Player jumped on top of enemy's head! -> Bop & Super Trampoline Bounce!
        if (playerFeetY >= enemyTopY - 0.25 && playerVelocity.y <= 0.2) {
          enemy.bop();
          playerVelocity.y = 13.5; // High joyful bop jump!
          onPlayerBounce();
          soundManager.playMushroomBounce();
          return;
        }

        // Side horizontal collision -> Bonk & forcefully push player OFF the platform!
        this._playerPush.set(dx, 0, dz);
        if (this._playerPush.lengthSq() < 0.001) {
          this._playerPush.set(enemy.patrolAxis === 'x' ? enemy.direction : 0, 0, enemy.patrolAxis === 'z' ? enemy.direction : 1);
        }
        this._playerPush.normalize();
        this._playerPush.y = 0.35;
        this._playerPush.normalize();

        // Strong knockback impulse flinging player away and off platform ledge
        playerVelocity.x = this._playerPush.x * 14.8;
        playerVelocity.y = 5.2;
        playerVelocity.z = this._playerPush.z * 14.8;

        onPlayerKnockback(this._playerPush);
        soundManager.playEnemyBonk();
      }
    }
  }

  public update(dt: number, time: number, playerPos: THREE.Vector3) {
    for (const enemy of this.enemies) {
      enemy.update(dt, time, playerPos);
    }
  }

  public dispose() {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.group);
    }
    this.enemies = [];
  }
}
