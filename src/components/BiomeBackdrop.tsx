import React, { useEffect, useRef, useState } from 'react';
import type { GameEngine } from '../game/GameEngine';
import type { ThemeId } from '../game/progress';
import { BiomeBackdropLayers, getBiomeBackdropLayers } from '../ui/biomeBackdrops';

interface BiomeBackdropProps {
  theme: ThemeId;
  getEngine?: () => GameEngine | null;
}

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  alpha: number;
  hue: number;
  rot: number;
  rotSpeed: number;
}

function buildParticles(theme: ThemeId, count: number): AmbientParticle[] {
  const arr: AmbientParticle[] = [];
  for (let i = 0; i < count; i++) {
    const p: AmbientParticle = {
      x: Math.random(),
      y: Math.random(),
      vx: 0,
      vy: 0,
      size: 2 + Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.35 + Math.random() * 0.55,
      hue: Math.random(),
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.6,
    };

    switch (theme) {
      case 'lava':
      case 'castle':
        p.vx = (Math.random() - 0.5) * 0.03;
        p.vy = -(0.045 + Math.random() * 0.085);
        p.size = 2 + Math.random() * 4.5;
        break;
      case 'ice':
        p.vx = (Math.random() - 0.3) * 0.035;
        p.vy = 0.03 + Math.random() * 0.055;
        p.size = 1.8 + Math.random() * 3.8;
        break;
      case 'cyberpunk':
        p.vx = -0.14 - Math.random() * 0.08;
        p.vy = 0.55 + Math.random() * 0.42;
        p.size = 14 + Math.random() * 20;
        p.alpha = 0.16 + Math.random() * 0.22;
        break;
      case 'aero':
        p.vx = (Math.random() - 0.5) * 0.02;
        p.vy = -(0.025 + Math.random() * 0.04);
        p.size = 7 + Math.random() * 14;
        p.alpha = 0.26 + Math.random() * 0.3;
        break;
      case 'desert':
        p.vx = 0.08 + Math.random() * 0.12;
        p.vy = (Math.random() - 0.5) * 0.015;
        p.size = 1.5 + Math.random() * 2.5;
        break;
      case 'garden':
      case 'candy':
        p.vx = 0.018 + Math.random() * 0.03;
        p.vy = 0.02 + Math.random() * 0.035;
        p.size = 3.5 + Math.random() * 4;
        break;
      case 'swamp':
      case 'cosmic':
      case 'neon':
      case 'backrooms':
      case 'cozy':
      default:
        p.vx = (Math.random() - 0.5) * 0.018;
        p.vy = (Math.random() - 0.5) * 0.015 - 0.008;
        p.size = 2.2 + Math.random() * 3.8;
        break;
    }
    arr.push(p);
  }
  return arr;
}

export const BiomeBackdrop: React.FC<BiomeBackdropProps> = ({ theme, getEngine }) => {
  const [prevLayers, setPrevLayers] = useState<BiomeBackdropLayers | null>(null);
  const [activeLayers, setActiveLayers] = useState<BiomeBackdropLayers>(() =>
    getBiomeBackdropLayers(theme)
  );
  const [fadeIn, setFadeIn] = useState(true);

  const farRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const groundPoolRef = useRef<HTMLDivElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef<ThemeId>(theme);
  themeRef.current = theme;

  useEffect(() => {
    const next = getBiomeBackdropLayers(theme);
    if (!next.farUrl || next.farUrl === activeLayers.farUrl) return;
    setPrevLayers(activeLayers);
    setActiveLayers(next);
    setFadeIn(false);
    const raf = window.requestAnimationFrame(() => setFadeIn(true));
    return () => window.cancelAnimationFrame(raf);
  }, [theme, activeLayers]);

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let pointerX = 0;
    let pointerY = 0;
    let smoothPx = 0;
    let smoothPy = 0;
    let smoothFeetX = 0.5;
    let smoothFeetY = 0.72;
    let baseYaw: number | null = null;
    let lastTime = performance.now();
    let particles = buildParticles(themeRef.current, reducedMotion ? 0 : 42);
    let lastParticleTheme = themeRef.current;
    let shootingStar = { active: false, x: 0.2, y: 0.15, vx: 0.45, vy: 0.18, life: 0 };

    const handlePointerMove = (e: PointerEvent) => {
      if (reducedMotion || window.innerWidth <= 0 || window.innerHeight <= 0) return;
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const resizeCanvas = () => {
      const canvas = fxCanvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let rafId = 0;
    const step = (now: number) => {
      rafId = window.requestAnimationFrame(step);
      if (document.hidden) {
        lastTime = now;
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const tSec = now * 0.001;

      const curTheme = themeRef.current;
      if (curTheme !== lastParticleTheme) {
        lastParticleTheme = curTheme;
        particles = buildParticles(curTheme, reducedMotion ? 0 : 42);
      }

      // Query 3D camera turntable + projected character feet position without React state
      const motion = getEngine?.()?.getLobbyMotion();
      const targetFeetX = motion?.feetX ?? 0.5;
      const targetFeetY = motion?.feetY ?? 0.72;
      smoothFeetX += (targetFeetX - smoothFeetX) * Math.min(1, dt * 10);
      smoothFeetY += (targetFeetY - smoothFeetY) * Math.min(1, dt * 10);

      let camParallaxX = 0;
      let camParallaxY = 0;
      if (!reducedMotion && motion) {
        if (baseYaw === null) baseYaw = motion.yawOffset;
        const yawSin = Math.sin(motion.yawOffset - baseYaw) * 0.45;
        camParallaxX = -yawSin * 16;
        camParallaxY = motion.pitchOffset * 18;
      }

      const targetPx = reducedMotion ? 0 : pointerX * 14 + camParallaxX;
      const targetPy = reducedMotion ? 0 : pointerY * 7 + camParallaxY;
      smoothPx += (targetPx - smoothPx) * Math.min(1, dt * 6);
      smoothPy += (targetPy - smoothPy) * Math.min(1, dt * 6);

      if (farRef.current) {
        const driftX = reducedMotion ? 0 : Math.sin(tSec * 0.25) * 4;
        farRef.current.style.transform = `translate3d(${(smoothPx * 0.28 + driftX).toFixed(2)}px, ${(smoothPy * 0.22).toFixed(2)}px, 0) scale(1.055)`;
      }
      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${(smoothPx * 0.88).toFixed(2)}px, ${(smoothPy * 0.55).toFixed(2)}px, 0) scale(1.045)`;
      }
      if (groundPoolRef.current) {
        const w = window.innerWidth || 1280;
        const h = window.innerHeight || 720;
        const gx = smoothFeetX * w;
        const gy = smoothFeetY * h;
        const pulse = reducedMotion ? 1 : 1 + Math.sin(tSec * 2.1) * 0.04;
        groundPoolRef.current.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${pulse.toFixed(3)})`;
      }

      // Live atmospheric 2D canvas particles & biome light FX
      const canvas = fxCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || reducedMotion) return;

      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      // Subtle animated biome ambient sweep (aurora / underwater shimmer / fluorescent pulse / cyber scan)
      if (curTheme === 'ice') {
        const pulse = 0.08 + Math.sin(tSec * 0.9) * 0.04;
        const g = ctx.createLinearGradient(0, ch * 0.06, cw, ch * 0.34);
        g.addColorStop(0, 'rgba(52, 211, 153, 0)');
        g.addColorStop(0.4 + Math.sin(tSec * 0.4) * 0.1, `rgba(52, 211, 153, ${pulse})`);
        g.addColorStop(0.65, `rgba(56, 189, 248, ${pulse})`);
        g.addColorStop(1, 'rgba(167, 139, 250, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, ch * 0.05, cw, ch * 0.32);
      } else if (curTheme === 'backrooms') {
        const flicker = Math.sin(tSec * 23) > 0.94 ? 0.04 : 0.1;
        drawCanvasLightCone(ctx, cw * 0.5, ch * 0.08, cw * 0.24, ch * 0.72, `rgba(254, 249, 195, ${flicker})`);
      } else if (curTheme === 'neon' || curTheme === 'cyberpunk') {
        const scanY = ((tSec * 0.11) % 1) * ch;
        const g = ctx.createLinearGradient(0, scanY - 24, 0, scanY + 24);
        g.addColorStop(0, 'rgba(34, 211, 238, 0)');
        g.addColorStop(0.5, 'rgba(34, 211, 238, 0.06)');
        g.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, scanY - 24, cw, 48);
      }

      if (curTheme === 'cosmic') {
        if (!shootingStar.active && Math.random() < dt * 0.18) {
          shootingStar = {
            active: true,
            x: 0.15 + Math.random() * 0.5,
            y: 0.08 + Math.random() * 0.22,
            vx: 0.48,
            vy: 0.19,
            life: 0,
          };
        }
        if (shootingStar.active) {
          shootingStar.life += dt;
          shootingStar.x += shootingStar.vx * dt;
          shootingStar.y += shootingStar.vy * dt;
          const sx = shootingStar.x * cw;
          const sy = shootingStar.y * ch;
          const fade = Math.max(0, 1 - shootingStar.life / 0.85);
          ctx.strokeStyle = `rgba(224, 242, 254, ${(fade * 0.85).toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - 68, sy - 27);
          ctx.stroke();
          if (shootingStar.life >= 0.85) shootingStar.active = false;
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += (p.vx + Math.sin(tSec * 1.4 + p.phase) * 0.008) * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpeed * dt;

        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05;
        if (p.y > 1.05) p.y = -0.05;

        const px = p.x * cw;
        const py = p.y * ch;
        const pulseAlpha = p.alpha * (0.65 + 0.35 * Math.sin(tSec * 2.4 + p.phase));

        if (curTheme === 'cyberpunk') {
          ctx.strokeStyle =
            p.hue > 0.5
              ? `rgba(34, 211, 238, ${pulseAlpha.toFixed(3)})`
              : `rgba(250, 204, 21, ${(pulseAlpha * 0.7).toFixed(3)})`;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + p.size * 0.25, py - p.size);
          ctx.stroke();
        } else if (curTheme === 'aero') {
          ctx.strokeStyle = `rgba(255, 255, 255, ${(pulseAlpha * 0.95).toFixed(3)})`;
          ctx.fillStyle = `rgba(224, 247, 255, ${(pulseAlpha * 0.22).toFixed(3)})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (curTheme === 'garden' || curTheme === 'candy') {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.fillStyle =
            curTheme === 'candy'
              ? p.hue > 0.5
                ? `rgba(244, 114, 182, ${pulseAlpha.toFixed(3)})`
                : `rgba(192, 132, 252, ${pulseAlpha.toFixed(3)})`
              : p.hue > 0.45
                ? `rgba(251, 207, 232, ${pulseAlpha.toFixed(3)})`
                : `rgba(255, 255, 255, ${pulseAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.52, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (curTheme === 'lava' || curTheme === 'castle') {
          ctx.fillStyle =
            p.hue > 0.4
              ? `rgba(253, 224, 71, ${pulseAlpha.toFixed(3)})`
              : `rgba(249, 115, 22, ${pulseAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.65, 0, Math.PI * 2);
          ctx.fill();
        } else if (curTheme === 'swamp') {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3.2);
          glow.addColorStop(0, `rgba(217, 249, 157, ${pulseAlpha.toFixed(3)})`);
          glow.addColorStop(1, 'rgba(217, 249, 157, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(px - p.size * 3.2, py - p.size * 3.2, p.size * 6.4, p.size * 6.4);
        } else if (curTheme === 'neon') {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.strokeStyle =
            p.hue > 0.5
              ? `rgba(34, 211, 238, ${pulseAlpha.toFixed(3)})`
              : `rgba(232, 121, 249, ${pulseAlpha.toFixed(3)})`;
          ctx.lineWidth = 1.4;
          ctx.strokeRect(-p.size * 0.6, -p.size * 0.6, p.size * 1.2, p.size * 1.2);
          ctx.restore();
        } else {
          ctx.fillStyle =
            curTheme === 'cozy' || curTheme === 'desert'
              ? `rgba(255, 248, 220, ${pulseAlpha.toFixed(3)})`
              : curTheme === 'backrooms'
                ? `rgba(254, 249, 195, ${(pulseAlpha * 0.65).toFixed(3)})`
                : `rgba(255, 255, 255, ${pulseAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [getEngine]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
    >
      {/* Layer 0: Far sky & distant vista with slow 2.5D parallax */}
      <div
        ref={farRef}
        className="absolute inset-0 will-change-transform"
        style={{ transform: 'scale(1.055)' }}
      >
        {prevLayers?.farUrl && (
          <img
            src={prevLayers.farUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {activeLayers.farUrl && (
          <img
            src={activeLayers.farUrl}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-out ${
              fadeIn ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>

      {/* Layer 1: Midground perspective 3D terrace deck & pillars */}
      <div
        ref={stageRef}
        className="absolute inset-0 will-change-transform"
        style={{ transform: 'scale(1.045)' }}
      >
        {prevLayers?.stageUrl && (
          <img
            src={prevLayers.stageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {activeLayers.stageUrl && (
          <img
            src={activeLayers.stageUrl}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-out ${
              fadeIn ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>

      {/* Layer 1.5: Dynamic floor light / ambient rim pool locked under projected 3D character feet */}
      <div
        ref={groundPoolRef}
        className="absolute left-0 top-0 w-64 h-16 rounded-full will-change-transform transition-colors duration-500"
        style={{
          background: `radial-gradient(ellipse at center, ${activeLayers.floorTint} 0%, rgba(255,255,255,0) 72%)`,
          filter: 'blur(6px)',
        }}
      />

      {/* Layer 2: Live 60fps biome-specific atmospheric canvas FX */}
      <canvas
        ref={fxCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Subtle framing vignette keeping central hero & solid terrace crisp */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 52%, rgba(255,255,255,0) 42%, ${activeLayers.ambientColor} 88%, rgba(15,23,42,0.2) 100%)`,
        }}
      />
    </div>
  );
};

function drawCanvasLightCone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  halfW: number,
  height: number,
  color: string
) {
  const g = ctx.createLinearGradient(cx, topY, cx, topY + height);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.4, topY);
  ctx.lineTo(cx + halfW * 0.4, topY);
  ctx.lineTo(cx + halfW * 1.15, topY + height);
  ctx.lineTo(cx - halfW * 1.15, topY + height);
  ctx.closePath();
  ctx.fill();
}
