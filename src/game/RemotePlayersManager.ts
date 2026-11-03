/**
 * RemotePlayersManager
 * Manages 3D avatars for other online players in the Three.js scene.
 * Receives multiplayerClient events, instantiates PlayerCharacterModel,
 * manages billboard name tags, and applies smooth linear (lerp) & angular interpolation.
 */

import * as THREE from 'three';
import { ProceduralTextures } from './textures';
import { sanitizeAppearance } from './character';
import { createPlayerCharacter, PlayerCharacterModel } from './models';
import { multiplayerClient, RemotePlayer } from '../services/multiplayerClient';
import { apiClient } from '../services/apiClient';

interface RemotePlayerEntity {
  userId: string;
  username: string;
  model: PlayerCharacterModel;
  nameTag: THREE.Sprite;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentYaw: number;
  targetYaw: number;
  anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall';
  lastSeen: number;
}

function createNameTagSprite(username: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);

    // Rounded badge background
    ctx.fillStyle = 'rgba(28, 25, 23, 0.78)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
    ctx.lineWidth = 3;

    const x = 8, y = 8, w = 240, h = 48, r = 24;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Online dot
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(28, 32, 6, 0, Math.PI * 2);
    ctx.fill();

    // Username text
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const trimmed = username.length > 14 ? `${username.substring(0, 13)}…` : username;
    ctx.fillText(trimmed, 44, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.8, 0.45, 1);
  sprite.position.set(0, 2.3, 0);
  return sprite;
}

export class RemotePlayersManager {
  private scene: THREE.Scene;
  private textures: ProceduralTextures;
  private players: Map<string, RemotePlayerEntity> = new Map();
  private windTime: number = 0;

  constructor(scene: THREE.Scene, textures: ProceduralTextures) {
    this.scene = scene;
    this.textures = textures;
    this.setupNetworkCallbacks();
  }

  private isLocalPlayer(player: { userId?: string; username?: string }): boolean {
    const me = apiClient.getCurrentUser();
    if (!me) return false;
    return player.userId === me._id || player.username === me.username;
  }

  private normalizePlayer(player: RemotePlayer & { position?: { x?: number; y?: number; z?: number; yaw?: number } }): RemotePlayer {
    const nested = player.position;
    return {
      ...player,
      x: Number.isFinite(player.x) ? player.x : Number(nested?.x) || 0,
      y: Number.isFinite(player.y) ? player.y : Number(nested?.y) || 0,
      z: Number.isFinite(player.z) ? player.z : Number(nested?.z) || 0,
      yaw: Number.isFinite(player.yaw) ? player.yaw : Number(nested?.yaw) || 0,
      anim: player.anim || 'idle',
      lastUpdate: player.lastUpdate || performance.now(),
    };
  }

  private setupNetworkCallbacks() {
    multiplayerClient.onRoomState = (players: RemotePlayer[]) => {
      const seenIds = new Set<string>();

      for (const raw of players) {
        const p = this.normalizePlayer(raw);
        if (this.isLocalPlayer(p)) continue;
        if (!p.userId) continue;
        seenIds.add(p.userId);
        this.addOrUpdatePlayer(p);
      }

      for (const [id] of this.players) {
        if (!seenIds.has(id)) {
          this.removePlayer(id);
        }
      }
    };

    multiplayerClient.onPlayerJoined = (player: RemotePlayer) => {
      const p = this.normalizePlayer(player);
      if (this.isLocalPlayer(p) || !p.userId) return;
      this.addOrUpdatePlayer(p);
    };

    multiplayerClient.onPlayerMoved = (update) => {
      let entity = this.players.get(update.userId);
      if (!entity) {
        this.addOrUpdatePlayer({
          userId: update.userId,
          username: 'Explorador',
          x: update.x,
          y: update.y,
          z: update.z,
          yaw: update.yaw,
          anim: update.anim,
          action: update.action,
          lastUpdate: performance.now(),
        });
        entity = this.players.get(update.userId);
      }
      if (entity) {
        entity.targetPos.set(update.x, update.y, update.z);
        entity.targetYaw = update.yaw;
        entity.anim = update.anim;
        entity.lastSeen = performance.now();
      }
    };

    multiplayerClient.onPlayerLeft = (data) => {
      this.removePlayer(data.userId);
    };

    multiplayerClient.onCompanionPower = (data) => {
      const entity = this.players.get(data.userId);
      if (entity) {
        // Visual indicator that this remote player activated companion power
        const spark = createNameTagSprite(String(data.powerType));
        spark.position.set(entity.currentPos.x, entity.currentPos.y + 3.0, entity.currentPos.z);
        this.scene.add(spark);
        setTimeout(() => {
          this.scene.remove(spark);
          spark.material.dispose();
        }, 1600);
      }
    };
  }

  private addOrUpdatePlayer(p: RemotePlayer) {
    let entity = this.players.get(p.userId);
    if (!entity) {
      try {
        const appearance = sanitizeAppearance({
          ...(p.appearance || {}),
          name: (p.appearance as { name?: string } | undefined)?.name || p.username || 'Explorador',
        });
        const model = createPlayerCharacter(this.textures, appearance);
        const nameTag = createNameTagSprite(p.username || appearance.name || 'Explorador');
        model.group.add(nameTag);

        const pos = new THREE.Vector3(
          Number.isFinite(p.x) ? p.x : 0,
          Number.isFinite(p.y) ? p.y : 0,
          Number.isFinite(p.z) ? p.z : 0
        );
        model.group.position.copy(pos);
        model.group.rotation.y = Number.isFinite(p.yaw) ? p.yaw : 0;
        this.scene.add(model.group);

        entity = {
          userId: p.userId,
          username: p.username || 'Explorador',
          model,
          nameTag,
          currentPos: pos.clone(),
          targetPos: pos.clone(),
          currentYaw: Number.isFinite(p.yaw) ? p.yaw : 0,
          targetYaw: Number.isFinite(p.yaw) ? p.yaw : 0,
          anim: p.anim || 'idle',
          lastSeen: performance.now(),
        };
        this.players.set(p.userId, entity);
      } catch (err) {
        console.error('[RemotePlayers] Failed to spawn remote player', p.userId, err);
        return;
      }
    } else {
      if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
        entity.targetPos.set(p.x, p.y, p.z);
      }
      if (Number.isFinite(p.yaw)) entity.targetYaw = p.yaw;
      if (p.anim) entity.anim = p.anim;
      entity.lastSeen = performance.now();
    }
  }

  private removePlayer(userId: string) {
    const entity = this.players.get(userId);
    if (entity) {
      this.scene.remove(entity.model.group);
      entity.nameTag.material.dispose();
      this.players.delete(userId);
    }
  }

  public clearAll() {
    for (const [id] of this.players) {
      this.removePlayer(id);
    }
  }

  public update(dt: number) {
    this.windTime += dt;
    const lerpFactor = Math.min(1.0, dt * 14);

    for (const [, entity] of this.players) {
      // Linear position interpolation
      entity.currentPos.lerp(entity.targetPos, lerpFactor);
      entity.model.group.position.copy(entity.currentPos);

      // Shortest-arc angular yaw interpolation
      let dyaw = entity.targetYaw - entity.currentYaw;
      while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
      while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      entity.currentYaw += dyaw * lerpFactor;
      entity.model.group.rotation.y = entity.currentYaw;

      // Animate limbs & companion
      let speed = 0;
      let isGrounded = true;

      if (entity.anim === 'walk') {
        speed = 5.0;
      } else if (entity.anim === 'run') {
        speed = 10.0;
      } else if (entity.anim === 'jump') {
        speed = 6.0;
        isGrounded = false;
      } else if (entity.anim === 'fall') {
        speed = 3.0;
        isGrounded = false;
      }

      entity.model.updateAnimation(speed, isGrounded, dt, this.windTime);
    }
  }
}
