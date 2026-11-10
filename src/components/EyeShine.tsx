import { useEffect, useRef } from 'react';
import type { GameEngine } from '../game/GameEngine';

/**
 * The Skinwalker's eyes shining from far down a hall, drawn over the darkness overlay (so in a
 * blackout you only see two little lights staring at you). Moves every frame without re-rendering.
 */
export default function EyeShine({ engine }: { engine: GameEngine | null }) {
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = engine.getEyeShine();
      refs.forEach((r, i) => {
        const el = r.current;
        if (!el) return;
        if (!s) {
          el.style.opacity = '0';
          return;
        }
        const p = s.pts[i];
        const size = s.size;
        const core = s.red ? '255,70,50' : '255,236,190';
        const halo = s.red ? '255,30,20' : '255,210,140';
        el.style.width = `${size}px`;
        el.style.height = `${size * 0.8}px`;
        el.style.transform = `translate(${p.x - size / 2}px, ${p.y - size * 0.4}px)`;
        el.style.background = `radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(${core},0.9) 35%, rgba(${core},0) 75%)`;
        el.style.boxShadow = `0 0 ${size * 1.6}px ${size * 0.5}px rgba(${halo},0.45)`;
        el.style.opacity = String(Math.min(1, s.op));
      });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {refs.map((r, i) => (
        <div key={i} ref={r} className="absolute left-0 top-0 rounded-full" style={{ opacity: 0, willChange: 'transform' }} />
      ))}
    </div>
  );
}
