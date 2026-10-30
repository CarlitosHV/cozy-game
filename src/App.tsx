/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect, useState } from 'react';
import { GameEngine, GameState, GameMode } from './game/GameEngine';
import { GameHUD } from './components/GameHUD';
import { WeatherType } from './audio/SoundtrackSynthesizer';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('title');
  const [checkpointName, setCheckpointName] = useState<string>('Sunrise Meadow');
  const [checkpointIndex, setCheckpointIndex] = useState<number>(1);
  const [collectedCount, setCollectedCount] = useState<number>(0);
  const [totalCollectibles, setTotalCollectibles] = useState<number>(10);
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('golden_hour');
  const [isWeatherTransitioning, setIsWeatherTransitioning] = useState<boolean>(false);
  const [weatherNotice, setWeatherNotice] = useState<{
    weather: WeatherType;
    title: string;
    desc: string;
    reason: 'milestone' | 'manual';
  } | null>(null);

  // Fullscreen and Orientation States
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSimulatedLandscape, setIsSimulatedLandscape] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false;
  });

  // Track Fullscreen state changes across vendor implementations
  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      const fsActive = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(fsActive);
      setTimeout(() => {
        engineRef.current?.handleResize();
        window.dispatchEvent(new Event('resize'));
      }, 120);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  // Track physical window orientation / viewport resize
  useEffect(() => {
    const handleResize = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
      // If user physically rotated their device to landscape, turn off simulated landscape
      if (!portrait) {
        setIsSimulatedLandscape(false);
      }
      engineRef.current?.handleResize();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Sync engine simulated landscape state
  useEffect(() => {
    if (engineRef.current) {
      (engineRef.current as any).isSimulatedLandscape = isSimulatedLandscape;
      engineRef.current.handleResize();
    }
  }, [isSimulatedLandscape]);

  // Fullscreen toggle handler
  const toggleFullscreen = async () => {
    try {
      const doc = document as any;
      const docEl = document.documentElement as any;
      const isFs = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isFs) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  // Screen Orientation toggle handler: Attempts native lock first, with seamless CSS simulated rotation fallback
  const toggleOrientation = async () => {
    const screenAny = window.screen as any;
    const currentIsPortrait = window.innerHeight > window.innerWidth;
    const targetOrientation = (isSimulatedLandscape || !currentIsPortrait) ? 'portrait' : 'landscape';

    let nativeLockSucceeded = false;

    // Try native Screen Orientation API lock
    if (screenAny?.orientation?.lock) {
      try {
        const doc = document as any;
        const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
        // On Android Chrome, orientation lock often requires fullscreen
        if (!isFs && document.documentElement.requestFullscreen) {
          try {
            await document.documentElement.requestFullscreen();
          } catch {
            // continue
          }
        }
        await screenAny.orientation.lock(targetOrientation);
        nativeLockSucceeded = true;
        setIsSimulatedLandscape(false);
      } catch (err) {
        nativeLockSucceeded = false;
      }
    }

    // Fallback: If native lock was rejected or unsupported (e.g. iOS Safari), toggle CSS simulated rotation
    if (!nativeLockSucceeded) {
      setIsSimulatedLandscape((prev) => !prev);
    }

    // Trigger engine resize smoothly
    setTimeout(() => {
      engineRef.current?.handleResize();
      window.dispatchEvent(new Event('resize'));
    }, 150);
  };

  // Game Mode, Time Trial, and Stalker States
  const [gameMode, setGameMode] = useState<GameMode>('free');
  const [timeRemaining, setTimeRemaining] = useState<number>(90);
  const [timeBonus, setTimeBonus] = useState<{ amount: number; reason: string; timestamp: number } | null>(null);
  const [stalkerDistance, setStalkerDistance] = useState<number>(24);
  const [stalkerWarningLevel, setStalkerWarningLevel] = useState<'none' | 'caution' | 'danger'>('none');

  const weatherTimerRef = useRef<number | null>(null);
  const timeBonusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Instantiate Three.js engine once inside isolated container
    const engine = new GameEngine(mountRef.current, {
      onStateChange: (state) => setGameState(state),
      onCheckpointChange: (name, index) => {
        setCheckpointName(name);
        setCheckpointIndex(index);
      },
      onCollectiblesChange: (collected, total) => {
        setCollectedCount(collected);
        setTotalCollectibles(total);
      },
      onWeatherChange: (weather, isTransitioning) => {
        setCurrentWeather(weather);
        setIsWeatherTransitioning(Boolean(isTransitioning));
      },
      onWeatherNotice: (notice) => {
        if (weatherTimerRef.current) window.clearTimeout(weatherTimerRef.current);
        setWeatherNotice(notice);
        weatherTimerRef.current = window.setTimeout(() => {
          setWeatherNotice(null);
        }, 1400);
      },
      onModeChange: (mode) => {
        setGameMode(mode);
      },
      onTimeTrialTick: (time, bonus) => {
        setTimeRemaining(time);
        if (bonus) {
          if (timeBonusTimerRef.current) window.clearTimeout(timeBonusTimerRef.current);
          const bonusObj = { amount: bonus.seconds, reason: bonus.reason, timestamp: Date.now() };
          setTimeBonus(bonusObj);
          timeBonusTimerRef.current = window.setTimeout(() => {
            setTimeBonus(null);
          }, 1100);
        }
      },
      onStalkerProximity: (distance, warningLevel) => {
        setStalkerDistance(distance);
        setStalkerWarningLevel(warningLevel);
      },
    });

    engineRef.current = engine;

    return () => {
      if (weatherTimerRef.current) window.clearTimeout(weatherTimerRef.current);
      if (timeBonusTimerRef.current) window.clearTimeout(timeBonusTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden bg-stone-950 select-none transition-all duration-300 ${
        isSimulatedLandscape
          ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 origin-center z-50'
          : 'w-screen h-screen'
      }`}
      style={
        isSimulatedLandscape
          ? {
              width: '100vh',
              height: '100vw',
              maxWidth: '100vh',
              maxHeight: '100vw',
            }
          : {
              width: '100vw',
              height: '100dvh',
            }
      }
    >
      {/* 3D WebGL Canvas Container - isolated from React state updates */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none select-none"
      />

      {/* World-Matched Minimal HUD & UI Modals Overlay */}
      <GameHUD
        engine={engineRef.current}
        gameState={gameState}
        gameMode={gameMode}
        timeRemaining={timeRemaining}
        timeBonus={timeBonus}
        stalkerDistance={stalkerDistance}
        stalkerWarningLevel={stalkerWarningLevel}
        checkpointName={checkpointName}
        checkpointIndex={checkpointIndex}
        collectedCount={collectedCount}
        totalCollectibles={totalCollectibles}
        currentWeather={currentWeather}
        isWeatherTransitioning={isWeatherTransitioning}
        weatherNotice={weatherNotice}
        onDismissWeatherNotice={() => setWeatherNotice(null)}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        isSimulatedLandscape={isSimulatedLandscape}
        toggleOrientation={toggleOrientation}
        isPortrait={isPortrait}
      />
    </div>
  );
}

