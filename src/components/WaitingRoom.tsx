import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock, Loader2, Play, Users } from 'lucide-react';
import type { GameEngine } from '../game/GameEngine';
import { BTN, UI } from '../ui/labels';

type Roster = ReturnType<GameEngine['getLobbyRoster']>;

interface WaitingRoomProps {
  engine: GameEngine | null;
  title: string;
  goal: string;
  steps: string[];
  /** Everybody is ready (or you play alone): the level starts */
  onStart: () => void;
  /** Leave to the main menu */
  onExit: () => void;
}

/** Seconds of 3-2-1 once everybody is ready */
const COUNTDOWN = 3;
/** Friends still loading only hold the room this long */
const LOADING_WAIT_MS = 15000;
/** After this, you can start without the ones who are still reading */
const SKIP_AFTER_MS = 25000;

const GIF_URL = `${import.meta.env.BASE_URL}lobby/skinwalker.gif`;

const STATUS_LABEL: Record<Roster[number]['status'], string> = {
  ready: 'Listo',
  waiting: 'Leyendo…',
  playing: 'Ya está jugando',
  loading: 'Cargando…',
};

/**
 * Waiting room before a level starts: the goal of the level, who's in the party and who is
 * ready. In a party it waits until everybody is ready and then counts 3-2-1 for everyone; alone
 * it's just the brief and a button. The Skinwalker's level plays its own clip in the background.
 */
export function WaitingRoom({ engine, title, goal, steps, onStart, onExit }: WaitingRoomProps) {
  const [ready, setReady] = useState(false);
  const [roster, setRoster] = useState<Roster>([]);
  const [count, setCount] = useState<number | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  const openedAt = useRef(performance.now());
  const countFrom = useRef<number | null>(null);
  const readyRef = useRef(false);
  const done = useRef(false);
  const style = engine?.getLobbyStyle() ?? 'cozy';
  const inParty = Boolean(engine?.partyRoomId);
  const alone = !inParty || roster.length === 0;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    engine?.announceLobby(true, false);
    onStart();
  };

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  // Twice a second: tell the party how we are, see how they are, and run the 3-2-1
  useEffect(() => {
    if (!engine || !inParty) return;
    const tick = () => {
      if (done.current) return;
      engine.announceLobby(readyRef.current, true);
      const list = engine.getLobbyRoster();
      setRoster(list);
      const elapsed = performance.now() - openedAt.current;
      const blockers = list.filter((r) => r.status === 'waiting' || (r.status === 'loading' && elapsed < LOADING_WAIT_MS));
      setCanSkip(readyRef.current && blockers.length > 0 && elapsed > SKIP_AFTER_MS);
      if (readyRef.current && list.length > 0 && blockers.length === 0) {
        if (countFrom.current === null) countFrom.current = performance.now();
        const left = COUNTDOWN - Math.floor((performance.now() - countFrom.current) / 1000);
        if (left <= 0) finish();
        else setCount(left);
      } else {
        countFrom.current = null;
        setCount(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => {
      window.clearInterval(id);
      // Closed without starting (back to the menu…): we're not in the room any more
      if (!done.current) engine.announceLobby(false, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, inParty]);

  const press = () => {
    if (alone) finish();
    else setReady((v) => !v);
  };

  // Enter / Space: ready (or start, alone)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      e.stopPropagation();
      press();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const horror = style !== 'cozy';
  const card = horror
    ? 'bg-[#16130b]/90 border border-[#6b5a2a]/60 text-[#f1e6bf] shadow-[0_0_60px_rgba(0,0,0,0.8)]'
    : 'cozy-panel text-cozy-ink';
  const muted = horror ? 'text-[#c9b98a]' : 'text-cozy-muted';
  const chip = (s: Roster[number]['status'] | 'me') => {
    if (s === 'ready' || s === 'me') return horror ? 'bg-[#3d4a1c] text-[#e3f0b5]' : 'bg-emerald-100 text-emerald-800';
    if (s === 'playing') return horror ? 'bg-[#2b3a4a] text-[#cfe3f5]' : 'bg-sky-100 text-sky-800';
    return horror ? 'bg-[#3a3016] text-[#e8d79c]' : 'bg-amber-100 text-amber-800';
  };

  const button = alone
    ? UI.letsPlay
    : count !== null
      ? `Empezando en ${count}…`
      : ready
        ? 'Listo · esperando a los demás (toca para cancelar)'
        : '¡Estoy listo!';

  return (
    <div className={`absolute inset-0 z-[55] pointer-events-auto flex items-center justify-center p-4 pt-safe pb-safe overflow-hidden ${horror ? 'bg-black' : 'cozy-scrim'}`}>
      {style === 'skinwalker' && (
        <>
          {/* The clip fills the screen, blurred and dark, behind the room */}
          <img src={GIF_URL} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm opacity-60" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.05),rgba(0,0,0,0.7))]" />
        </>
      )}
      {style === 'backrooms' && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#3b3418,#0b0905)]" />}

      <div className={`relative w-full max-w-md max-h-full overflow-y-auto rounded-[1.75rem] p-5 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 ${card}`}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 shrink-0" />
          <span className={`text-xs font-bold uppercase tracking-[0.18em] ${horror ? 'text-[#e8d79c]' : 'text-cozy-accent-deep'}`}>Sala de espera</span>
        </div>

        {style === 'skinwalker' && (
          <div className="relative shrink-0 rounded-2xl overflow-hidden border border-[#6b5a2a]/60 bg-black">
            <img src={GIF_URL} alt="El Skinwalker sale de la pared" className="w-full h-[min(34vh,260px)] object-cover block" />
            {/* Old-monitor scanlines */}
            <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0px,rgba(0,0,0,0.18)_1px,transparent_1px,transparent_3px)]" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-display font-bold leading-snug">{title}</h3>
          <p className="text-sm font-semibold leading-snug">{goal}</p>
          <ul className={`space-y-2 text-xs leading-relaxed ${muted}`}>
            {steps.slice(0, 3).map((step) => (
              <li key={step} className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {!alone && (
          <div className="flex flex-col gap-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Equipo</span>
            <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${horror ? 'bg-black/30' : 'bg-cozy-panel-deep'}`}>
              <span className="text-sm font-semibold">Tú</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${chip(ready ? 'me' : 'waiting')}`}>
                {ready ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {ready ? 'Listo' : 'Leyendo…'}
              </span>
            </div>
            {roster.map((r) => (
              <div key={r.userId} className={`flex items-center justify-between rounded-xl px-3 py-2 ${horror ? 'bg-black/30' : 'bg-cozy-panel-deep'}`}>
                <span className="text-sm font-semibold truncate pr-2">{r.name}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${chip(r.status)}`}>
                  {r.status === 'ready' ? <Check className="w-3 h-3" /> : r.status === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : r.status === 'playing' ? <Play className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            ))}
            <span className={`text-[11px] ${muted}`}>
              {count !== null ? 'Todos listos.' : 'El nivel empieza cuando todos estén listos.'}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={press}
          className={
            horror
              ? `w-full py-3 rounded-2xl font-bold text-sm cursor-pointer transition-colors ${ready && !alone ? 'bg-[#3d4a1c] text-[#e3f0b5] hover:bg-[#4a5a22]' : 'bg-[#d8c06a] text-[#1a1608] hover:bg-[#e6cf7a]'}`
              : `${BTN.primary}`
          }
        >
          {button}
        </button>
        {canSkip && (
          <button type="button" onClick={finish} className={horror ? `text-xs font-semibold underline ${muted} cursor-pointer` : BTN.ghost}>
            Empezar sin esperar
          </button>
        )}
        <button type="button" onClick={onExit} className={`text-[11px] font-semibold ${muted} hover:underline cursor-pointer self-center`}>
          {UI.mainMenu}
        </button>
      </div>
    </div>
  );
}
