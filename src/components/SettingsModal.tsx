import React, { useState, useEffect } from 'react';
import { Settings, X, Volume2, VolumeX, Eye, Gauge, Globe, Type, RotateCcw } from 'lucide-react';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import { GameEngine } from '../game/GameEngine';
import { BTN } from '../ui/labels';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: GameEngine | null;
  isMuted?: boolean;
  onToggleMute?: () => void;
  language: 'es' | 'en';
  onLanguageChange: (lang: 'es' | 'en') => void;
  largeText: boolean;
  onLargeTextChange: (large: boolean) => void;
  showFps: boolean;
  onShowFpsChange: (show: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  engine,
  isMuted,
  onToggleMute,
  language,
  onLanguageChange,
  largeText,
  onLargeTextChange,
  showFps,
  onShowFpsChange,
}) => {
  const [musicVol, setMusicVol] = useState<number>(() => {
    const saved = localStorage.getItem('cozy_music_vol');
    return saved !== null ? parseFloat(saved) : 0.7;
  });
  const [sfxVol, setSfxVol] = useState<number>(() => {
    const saved = localStorage.getItem('cozy_sfx_vol');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [ambientVol, setAmbientVol] = useState<number>(() => {
    const saved = localStorage.getItem('cozy_ambient_vol');
    return saved !== null ? parseFloat(saved) : 0.6;
  });
  const [graphicsQuality, setGraphicsQuality] = useState<'high' | 'medium' | 'low'>(() => {
    return (localStorage.getItem('cozy_graphics_quality') as 'high' | 'medium' | 'low') || 'high';
  });
  const [autoChase, setAutoChase] = useState<boolean>(() => {
    const saved = localStorage.getItem('cozy_auto_chase');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    soundManager.setMusicVolume(musicVol * 0.45);
    localStorage.setItem('cozy_music_vol', String(musicVol));
  }, [musicVol]);

  useEffect(() => {
    soundManager.setSfxVolume(sfxVol * 0.55);
    localStorage.setItem('cozy_sfx_vol', String(sfxVol));
  }, [sfxVol]);

  useEffect(() => {
    soundManager.setAmbientVolume(ambientVol * 0.35);
    localStorage.setItem('cozy_ambient_vol', String(ambientVol));
  }, [ambientVol]);

  useEffect(() => {
    if (engine) {
      engine.setGraphicsQuality(graphicsQuality);
    }
    localStorage.setItem('cozy_graphics_quality', graphicsQuality);
  }, [graphicsQuality, engine]);

  useEffect(() => {
    if (engine) {
      engine.setAutoChaseCamera(autoChase);
    }
    localStorage.setItem('cozy_auto_chase', String(autoChase));
  }, [autoChase, engine]);

  if (!isOpen) return null;

  const isEs = language === 'es';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cozy-scrim pointer-events-auto select-none font-ui">
      <div className="relative w-full max-w-md rounded-[1.75rem] cozy-panel p-6 max-h-[90vh] overflow-y-auto flex flex-col gap-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-2 border-b border-cozy-line">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#fff1de] border border-cozy-line flex items-center justify-center text-cozy-accent-deep">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-cozy-ink">
                {isEs ? 'Ajustes y Opciones' : 'Settings & Options'}
              </h3>
              <p className="text-[11px] text-cozy-muted">
                {isEs ? 'Audio, cámara, gráficos y accesibilidad' : 'Audio, camera, graphics & accessibility'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-cozy-soft hover:text-cozy-ink hover:bg-cozy-panel-deep transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- Audio Section --- */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cozy-accent-deep flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isEs ? 'Volumen y Sonido' : 'Sound & Volume'}</span>
          </span>

          <div className="space-y-2.5 p-3 rounded-2xl bg-cozy-panel-deep border border-cozy-line">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-cozy-ink font-medium">
                <span>{isEs ? 'Música' : 'Music'}</span>
                <span className="text-cozy-accent-deep font-mono">{Math.round(musicVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVol}
                onChange={(e) => setMusicVol(parseFloat(e.target.value))}
                className="w-full accent-cozy-accent cursor-pointer h-1.5 bg-cozy-line rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-cozy-ink font-medium">
                <span>{isEs ? 'Efectos de Sonido' : 'Sound Effects (SFX)'}</span>
                <span className="text-cozy-accent-deep font-mono">{Math.round(sfxVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sfxVol}
                onChange={(e) => setSfxVol(parseFloat(e.target.value))}
                className="w-full accent-cozy-accent cursor-pointer h-1.5 bg-cozy-line rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-cozy-ink font-medium">
                <span>{isEs ? 'Ambiente de la naturaleza' : 'Ambient & Weather'}</span>
                <span className="text-cozy-accent-deep font-mono">{Math.round(ambientVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={ambientVol}
                onChange={(e) => setAmbientVol(parseFloat(e.target.value))}
                className="w-full accent-cozy-accent cursor-pointer h-1.5 bg-cozy-line rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* --- Camera & Controls Section --- */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cozy-accent-deep flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span>{isEs ? 'Cámara' : 'Camera Options'}</span>
          </span>

          <div className="p-3 rounded-2xl bg-cozy-panel-deep border border-cozy-line flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-cozy-ink block">
                {isEs ? 'Seguir al personaje automáticamente' : 'Auto-follow character'}
              </span>
              <span className="text-[10px] text-cozy-muted block">
                {autoChase
                  ? isEs
                    ? 'La cámara rota suavemente detrás al avanzar'
                    : 'Camera smoothly rotates behind while moving'
                  : isEs
                    ? 'Ángulo fijo: solo rota al arrastrar o pulsar Q/E'
                    : 'Fixed angle: only rotates when dragged or pressing Q/E'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAutoChase((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                autoChase ? 'cozy-tab-active' : 'cozy-btn text-cozy-muted'
              }`}
            >
              {autoChase ? (isEs ? 'Activado' : 'On') : (isEs ? 'Fijo' : 'Fixed')}
            </button>
          </div>
        </div>

        {/* --- Graphics Quality Section --- */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cozy-accent-deep flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" />
            <span>{isEs ? 'Rendimiento y Gráficos' : 'Graphics & Performance'}</span>
          </span>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'high' as const, label: isEs ? 'Alta' : 'High', sub: isEs ? 'Sombras suaves' : 'Soft shadows' },
                { id: 'medium' as const, label: isEs ? 'Media' : 'Medium', sub: isEs ? 'Equilibrado' : 'Balanced' },
                { id: 'low' as const, label: isEs ? 'Baja' : 'Low', sub: isEs ? 'Máxima fluidez' : 'Fast FPS' },
              ] as const
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGraphicsQuality(g.id)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                  graphicsQuality === g.id ? 'cozy-tab-active border-cozy-accent' : 'cozy-btn text-cozy-muted border-cozy-line'
                }`}
              >
                <span className="text-xs font-bold">{g.label}</span>
                <span className="text-[9px] opacity-75">{g.sub}</span>
              </button>
            ))}
          </div>

          <div className="p-3 rounded-2xl bg-cozy-panel-deep border border-cozy-line flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-cozy-ink block">
                {isEs ? 'Contador de FPS en pantalla' : 'Show FPS display'}
              </span>
              <span className="text-[10px] text-cozy-muted block">
                {isEs ? 'Muestra fotogramas por segundo en vivo' : 'Displays live frames per second in HUD'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onShowFpsChange(!showFps)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                showFps ? 'cozy-tab-active' : 'cozy-btn text-cozy-muted'
              }`}
            >
              {showFps ? (isEs ? 'Visible' : 'Visible') : (isEs ? 'Oculto' : 'Hidden')}
            </button>
          </div>
        </div>

        {/* --- Accessibility Section --- */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cozy-accent-deep flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            <span>{isEs ? 'Accesibilidad e Idioma' : 'Language & Accessibility'}</span>
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onLanguageChange('es')}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                language === 'es' ? 'cozy-tab-active border-cozy-accent' : 'cozy-btn text-cozy-muted border-cozy-line'
              }`}
            >
              <span>Español</span>
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                language === 'en' ? 'cozy-tab-active border-cozy-accent' : 'cozy-btn text-cozy-muted border-cozy-line'
              }`}
            >
              <span>English</span>
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-cozy-panel-deep border border-cozy-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-cozy-accent-deep shrink-0" />
              <div>
                <span className="text-xs font-bold text-cozy-ink block">
                  {isEs ? 'Texto más grande' : 'Larger text'}
                </span>
                <span className="text-[10px] text-cozy-muted block">
                  {isEs ? 'Mejora la legibilidad de menús y avisos' : 'Increases size of HUD and menus for readability'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onLargeTextChange(!largeText)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                largeText ? 'cozy-tab-active' : 'cozy-btn text-cozy-muted'
              }`}
            >
              {largeText ? (isEs ? 'Grande' : 'Large') : (isEs ? 'Normal' : 'Normal')}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`${BTN.primary} w-full mt-1`}
        >
          {isEs ? 'Listo' : 'Done'}
        </button>
      </div>
    </div>
  );
};
