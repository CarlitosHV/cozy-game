import React, { useEffect, useState } from 'react';
import type { ThemeId } from '../game/progress';
import { getBiomeBackdropUrl } from '../ui/biomeBackdrops';

interface BiomeBackdropProps {
  theme: ThemeId;
}

export const BiomeBackdrop: React.FC<BiomeBackdropProps> = ({ theme }) => {
  const [prevUrl, setPrevUrl] = useState<string>('');
  const [activeUrl, setActiveUrl] = useState<string>(() => getBiomeBackdropUrl(theme));
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    const nextUrl = getBiomeBackdropUrl(theme);
    if (!nextUrl || nextUrl === activeUrl) return;
    setPrevUrl(activeUrl);
    setActiveUrl(nextUrl);
    setFadeIn(false);
    const raf = window.requestAnimationFrame(() => setFadeIn(true));
    return () => window.cancelAnimationFrame(raf);
  }, [theme, activeUrl]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
    >
      {prevUrl && (
        <img
          src={prevUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-[1.01]"
        />
      )}
      {activeUrl && (
        <img
          src={activeUrl}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover scale-[1.01] transition-opacity duration-500 ease-out ${
            fadeIn ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {/* Soft radial vignette keeping central 3D character focal */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 54%, rgba(255,255,255,0.03) 0%, rgba(15,23,42,0.12) 100%)',
        }}
      />
    </div>
  );
};
