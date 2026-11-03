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
import { createBoneCage } from './bossModels';
import { makeLabel } from './combatFx';

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
  /** Boss fights: caught by a dancing skeleton (shows a bone cage + "¡Ayuda!") */
  grabbed: boolean;
  cage?: THREE.Group;
}

function createNameTagSprite(username: string): THREE.Sprite {
  const label = (username || 'Explorador').trim() || 'Explorador';
  const trimmed = label.length > 16 ? `${label.slice(0, 15)}…` : label;

  const padX = 28;
  const padY = 16;
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d');
  const font = '600 34px "Outfit", "Nunito", system-ui, sans-serif';
  let textW = 140;
  if (measure) {
    measure.font = font;
    textW = Math.ceil(measure.measureText(trimmed).width);
  }

  const dotR = 7;
  const gap = 14;
  const contentW = dotR * 2 + gap + textW;
  const w = Math.min(512, Math.max(180, contentW + padX * 2));
  const h = 64;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, w, h);

    const x = 6;
    const y = 6;
    const bw = w - 12;
    const bh = h - 12;
    const r = bh / 2;

    ctx.shadowColor = 'rgba(61, 74, 82, 0.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + bw, y, x + bw, y + bh, r);
    ctx.arcTo(x + bw, y + bh, x, y + bh, r);
    ctx.arcTo(x, y + bh, x, y, r);
    ctx.arcTo(x, y, x + bw, y, r);
    ctx.closePath();

    const fill = ctx.createLinearGradient(0, y, 0, y + bh);
    fill.addColorStop(0, 'rgba(255, 250, 242, 0.94)');
    fill.addColorStop(1, 'rgba(255, 241, 222, 0.92)');
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(214, 184, 148, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const cx = x + padX * 0.55 + dotR;
    const cy = y + bh / 2;
    ctx.fillStyle = '#5b8f72';
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3d4a52';
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(trimmed, cx + dotR + gap, cy + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const sprite = new THREE.Sprite(mat);
  const worldH = 0.42;
  const worldW = worldH * (w / h);
  sprite.scale.set(worldW, worldH, 1);
  sprite.position.set(0, 2.48, 0);
  sprite.renderOrder = 10;
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
          grabbed: false,
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

  /** Positions of everyone else in the room (boss fights: rescues, host choice). */
  public getPlayersInfo(): { userId: string; username: string; pos: THREE.Vector3; grabbed: boolean }[] {
    return [...this.players.values()].map((e) => ({ userId: e.userId, username: e.username, pos: e.currentPos, grabbed: e.grabbed }));
  }

  /** Shows/hides the bone cage on a friend caught by a skeleton. */
  public setGrabbed(userId: string, on: boolean) {
    const e = this.players.get(userId);
    if (!e) return;
    e.grabbed = on;
    if (on && !e.cage) {
      const cage = createBoneCage(0.7, 1.9);
      const label = makeLabel('¡Ayuda!');
      label.position.y = 2.9;
      cage.add(label);
      e.model.group.add(cage);
      e.cage = cage;
    }
    if (e.cage) e.cage.visible = on;
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
