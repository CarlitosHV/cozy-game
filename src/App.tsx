/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect, useState } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
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
        setWeatherNotice(notice);
      },
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950 select-none">
      {/* 3D WebGL Canvas Container - isolated from React state updates */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* World-Matched Minimal HUD & UI Modals Overlay */}
      <GameHUD
        engine={engineRef.current}
        gameState={gameState}
        checkpointName={checkpointName}
        checkpointIndex={checkpointIndex}
        collectedCount={collectedCount}
        totalCollectibles={totalCollectibles}
        currentWeather={currentWeather}
        isWeatherTransitioning={isWeatherTransitioning}
        weatherNotice={weatherNotice}
      />
    </div>
  );
}
