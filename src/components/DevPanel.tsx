import React, { useEffect, useState } from 'react';
import { Bug, Castle, Flag, KeyRound, Lock, Play, Skull, Sparkles, X } from 'lucide-react';
import { BTN } from '../ui/labels';
import { isTypingTarget } from '../ui/shortcuts';
import { checkDevPassword } from '../game/devMode';
import {
  BOSS_FOR_THEME,
  BOSS_INFO,
  DEV_MAX_LEVEL,
  THEME_INFO,
  ThemeId,
  getDevLevelPick,
  levelInfo,
} from '../game/progress';

export type DevPlay =
  | { kind: 'handmade'; level: number }
  | { kind: 'sandbox' | 'boss'; level: number; theme: ThemeId };

interface DevPanelProps {
  open: boolean;
  /** The password was already typed in this browser */
  hasAccess: boolean;
  devOn: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onToggleDev: (on: boolean) => void;
  onPlay: (pick: DevPlay) => void;
  onClose: () => void;
}

const THEMES: ThemeId[] = ['cozy', 'cosmic', 'swamp', 'aero', 'garden', 'castle'];
const HANDMADE = [1, 2, 3, 4].map((level) => ({ level, name: levelInfo(level).name }));
type Kind = DevPlay['kind'];
const KIND_LABEL: Record<Kind, { label: string; icon: React.ReactNode }> = {
  sandbox: { label: 'Caja de arena', icon: <Sparkles className="w-4 h-4" /> },
  boss: { label: 'Lucha contra jefe', icon: <Skull className="w-4 h-4" /> },
  handmade: { label: 'Hecho a mano', icon: <Castle className="w-4 h-4" /> },
};

/** Lets the developer jump straight into any world, generator or boss. */
export const DevPanel: React.FC<DevPanelProps> = ({ open, hasAccess, devOn, onUnlock, onLock, onToggleDev, onPlay, onClose }) => {
  const last = getDevLevelPick();
  const [kind, setKind] = useState<Kind>(last?.kind ?? 'boss');
  const [theme, setTheme] = useState<ThemeId>(last?.theme ?? 'cozy');
  const [level, setLevel] = useState<number>(last?.level ?? 12);
  const [handmade, setHandmade] = useState(1);
  const [password, setPassword] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setWrong(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  if (!hasAccess) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      if (checkDevPassword(password)) {
        setWrong(false);
        setPassword('');
        onUnlock();
      } else {
        setWrong(true);
      }
    };
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 cozy-scrim pointer-events-auto font-ui">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="dev-pass-title"
          onSubmit={submit}
          className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-5 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-cozy-line bg-[#e8f3ff] text-cozy-sky">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="dev-pass-title" className="text-base font-display font-bold text-cozy-ink leading-snug">
                Modo desarrollador
              </h3>
              <p className="mt-0.5 text-xs text-cozy-muted leading-relaxed">Escribe la contraseña de desarrollador.</p>
            </div>
            <button type="button" onClick={onClose} className={BTN.icon} aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="password"
            autoFocus
            autoComplete="off"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setWrong(false);
            }}
            placeholder="Contraseña"
            aria-label="Contraseña de desarrollador"
            aria-invalid={wrong}
            className={`w-full px-3.5 py-2.5 rounded-2xl border bg-white/85 text-sm text-cozy-ink outline-none focus:ring-2 ${
              wrong ? 'border-rose-400 focus:ring-rose-300' : 'border-cozy-line focus:ring-amber-300'
            }`}
          />
          {wrong && <p className="text-xs font-semibold text-rose-600 -mt-1">Contraseña incorrecta</p>}
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} className={`flex-1 ${BTN.secondary}`}>
              Cancelar
            </button>
            <button type="submit" disabled={!password} className={`flex-1 ${BTN.primary}`}>
              Entrar
            </button>
          </div>
        </form>
      </div>
    );
  }

  const lvl = Math.min(DEV_MAX_LEVEL, Math.max(5, Math.floor(level) || 5));
  const play = () => onPlay(kind === 'handmade' ? { kind, level: handmade } : { kind, level: lvl, theme });
  const summary =
    kind === 'handmade'
      ? `Nivel ${handmade} · ${HANDMADE[handmade - 1].name}`
      : kind === 'boss'
        ? `Nivel ${lvl} · Jefe: ${BOSS_INFO[BOSS_FOR_THEME[theme]].short} (${THEME_INFO[theme].name})`
        : `Nivel ${lvl} · Caja de arena en ${THEME_INFO[theme].name}`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 cozy-scrim pointer-events-auto font-ui">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-title"
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-[1.75rem] cozy-panel p-4 sm:p-5 flex flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-cozy-line bg-[#e8f3ff] text-cozy-sky">
            <Bug className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="dev-title" className="text-base font-display font-bold text-cozy-ink leading-snug">
              Modo desarrollador
            </h3>
            <p className="mt-0.5 text-xs text-cozy-muted leading-relaxed">
              Solo en este navegador. No cambia tu progreso guardado.
            </p>
          </div>
          <button type="button" onClick={onClose} className={BTN.icon} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Unlock everything */}
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-cozy-line bg-cozy-panel-deep/40 px-3.5 py-2.5 cursor-pointer">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-cozy-ink">Todo desbloqueado</span>
            <span className="block text-[11px] text-cozy-muted">Niveles 1–{DEV_MAX_LEVEL} y todos los compañeros</span>
          </span>
          <input
            type="checkbox"
            className="w-5 h-5 accent-amber-500 cursor-pointer"
            checked={devOn}
            onChange={(e) => onToggleDev(e.target.checked)}
          />
        </label>

        {/* Generator */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cozy-soft">Tipo de nivel</span>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Tipo de nivel">
            {(['sandbox', 'boss', 'handmade'] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 rounded-xl text-[11px] sm:text-xs font-semibold cursor-pointer border transition-colors ${
                  kind === k ? 'bg-amber-400 text-stone-950 border-amber-500 shadow' : 'cozy-btn border-transparent'
                }`}
              >
                {KIND_LABEL[k].icon}
                {KIND_LABEL[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* World / boss */}
        {kind !== 'handmade' ? (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cozy-soft">{kind === 'boss' ? 'Jefe' : 'Mundo'}</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" role="radiogroup" aria-label={kind === 'boss' ? 'Jefe' : 'Mundo'}>
              {THEMES.map((t) => {
                const boss = BOSS_INFO[BOSS_FOR_THEME[t]];
                const on = theme === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTheme(t)}
                    className={`text-left px-2.5 py-2 rounded-xl border cursor-pointer transition-colors ${
                      on ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/60' : 'cozy-btn border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: THEME_INFO[t].accent }} />
                      <span className="text-xs font-bold text-cozy-ink truncate">{kind === 'boss' ? boss.short : THEME_INFO[t].name}</span>
                    </span>
                    <span className="block text-[10px] text-cozy-muted truncate">{kind === 'boss' ? THEME_INFO[t].name : THEME_INFO[t].desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cozy-soft">Nivel</span>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Nivel hecho a mano">
              {HANDMADE.map((h) => (
                <button
                  key={h.level}
                  type="button"
                  role="radio"
                  aria-checked={handmade === h.level}
                  onClick={() => setHandmade(h.level)}
                  className={`text-left px-2.5 py-2 rounded-xl border cursor-pointer text-xs font-bold text-cozy-ink ${
                    handmade === h.level ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/60' : 'cozy-btn border-transparent'
                  }`}
                >
                  {h.level} · {h.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Difficulty */}
        {kind !== 'handmade' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="dev-level" className="text-[11px] font-bold uppercase tracking-wider text-cozy-soft">
                Número de nivel (dificultad)
              </label>
              <input
                type="number"
                min={5}
                max={DEV_MAX_LEVEL}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                onBlur={() => setLevel(lvl)}
                className="w-16 px-2 py-1 rounded-lg border border-cozy-line bg-white/80 text-sm font-bold text-cozy-ink text-center tabular-nums"
                aria-label="Número de nivel"
              />
            </div>
            <input
              id="dev-level"
              type="range"
              min={5}
              max={DEV_MAX_LEVEL}
              value={lvl}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="text-[10px] text-cozy-muted">
              Más alto = enemigos más rápidos y jefes con más vida.
            </span>
          </div>
        )}

        <div className="rounded-xl bg-cozy-panel-deep/40 border border-cozy-line px-3 py-2 text-xs text-cozy-ink flex items-center gap-2">
          <Flag className="w-4 h-4 text-cozy-accent-deep shrink-0" />
          <span className="min-w-0">{summary}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onLock}
            className={`sm:flex-1 ${BTN.secondary} flex items-center justify-center gap-1.5`}
            title="Desactiva el modo y vuelve a pedir la contraseña"
          >
            <Lock className="w-4 h-4" />
            Bloquear
          </button>
          <button type="button" onClick={play} className={`sm:flex-[2] ${BTN.primary} flex items-center justify-center gap-1.5`}>
            <Play className="w-4 h-4" fill="currentColor" />
            Jugar ahora
          </button>
        </div>
      </div>
    </div>
  );
};
