/**
 * Character Creator: live 3D character generator shown from the title screen.
 * Every change rebuilds the player model in the engine so the turntable preview
 * updates instantly. Includes a harmonious random generator and undo history.
 */
import React, { useRef, useState } from 'react';
import {
  Dices,
  Shuffle,
  Undo2,
  RotateCcw,
  Check,
  Smile,
  Scissors,
  Shirt,
  Sparkles,
  Backpack,
  Cloud,
  Star,
  Bug,
  X,
  Mars,
  Venus,
  Lock,
} from 'lucide-react';
import {
  BodyType,
  BODY_TYPES,
  CharacterAppearance,
  defaultAppearanceFor,
  hairStylesFor,
  SKIN_TONES,
  HAIR_COLORS,
  CLOTH_COLORS,
  BOOT_COLORS,
  hatStylesFor,
  outfitStylesFor,
  EYE_STYLES,
  ACCESSORIES,
  COMPANIONS,
  CompanionStyle,
  generateRandomAppearance,
  generateRandomName,
} from '../game/character';
import { COMPANION_POWERS } from '../game/companionPowers';
import { isCompanionUnlocked, unlockLevelFor } from '../game/progress';

type Tab = 'cuerpo' | 'pelo' | 'ropa' | 'companero';

interface CharacterCreatorProps {
  appearance: CharacterAppearance;
  onChange: (next: CharacterAppearance) => void;
  /** Switches to the other character; each one keeps its own saved look */
  onSwitchBody: (body: BodyType) => void;
  onClose: () => void;
  portrait: boolean;
}

const TABS: { id: Tab; name: string; icon: React.ReactNode }[] = [
  { id: 'cuerpo', name: 'Cuerpo', icon: <Smile className="w-3.5 h-3.5" /> },
  { id: 'pelo', name: 'Pelo', icon: <Scissors className="w-3.5 h-3.5" /> },
  { id: 'ropa', name: 'Ropa', icon: <Shirt className="w-3.5 h-3.5" /> },
  { id: 'companero', name: 'Compañero', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

export const COMPANION_ICONS: Record<CompanionStyle, React.ReactNode> = {
  nube: <Cloud className="w-4 h-4" />,
  estrella: <Star className="w-4 h-4" />,
  luciernaga: <Bug className="w-4 h-4" />,
  catarina: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <circle cx="12" cy="5.5" r="3" fill="currentColor" />
      <path d="M4 14a8 8 0 0 1 16 0v1a7 7 0 0 1-16 0z" fill="#e63946" />
      <path d="M12 7v15" stroke="#1b1b1f" strokeWidth="1.5" />
      <circle cx="8" cy="12" r="1.6" fill="#1b1b1f" />
      <circle cx="16" cy="12" r="1.6" fill="#1b1b1f" />
      <circle cx="8.5" cy="17" r="1.4" fill="#1b1b1f" />
      <circle cx="15.5" cy="17" r="1.4" fill="#1b1b1f" />
    </svg>
  ),
  hada: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <ellipse cx="7" cy="9" rx="5" ry="3.6" fill="#f9a8d4" opacity="0.85" transform="rotate(-25 7 9)" />
      <ellipse cx="17" cy="9" rx="5" ry="3.6" fill="#f9a8d4" opacity="0.85" transform="rotate(25 17 9)" />
      <ellipse cx="8" cy="15.5" rx="3.6" ry="2.4" fill="#c4b5fd" opacity="0.85" transform="rotate(25 8 15.5)" />
      <ellipse cx="16" cy="15.5" rx="3.6" ry="2.4" fill="#c4b5fd" opacity="0.85" transform="rotate(-25 16 15.5)" />
      <circle cx="12" cy="6" r="2.6" fill="currentColor" />
      <path d="M9.5 21 L12 9 L14.5 21 Z" fill="#ec4899" />
      <path d="M19.5 2.5 l0.7 1.6 1.6 0.7 -1.6 0.7 -0.7 1.6 -0.7 -1.6 -1.6 -0.7 1.6 -0.7z" fill="#fde047" />
    </svg>
  ),
  serpiente: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M3 17c3-6 6 2 9-4s6-3 6-7" fill="none" stroke="#34d399" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M3 17c3-6 6 2 9-4s6-3 6-7" fill="none" stroke="#fde68a" strokeWidth="1" strokeDasharray="1 2.2" strokeLinecap="round" />
      <circle cx="18.5" cy="5" r="3" fill="#10b981" />
      <circle cx="19.5" cy="4.3" r="0.8" fill="#111" />
      <path d="M16.5 3 l-1.5 -2 M20 2.6 l0.6 -2.2" stroke="#fde047" strokeWidth="1" strokeLinecap="round" />
      <path d="M10 11 l-2.5 -3.5 3.8 1.6z" fill="#fde047" />
    </svg>
  ),
  ninguno: <X className="w-4 h-4" />,
};

// ---------- Small building blocks ----------

const Section: React.FC<{ title: string; children: React.ReactNode; aside?: React.ReactNode }> = ({
  title,
  children,
  aside,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">{title}</span>
      {aside}
    </div>
    {children}
  </div>
);

const Swatches: React.FC<{
  colors: string[];
  value: string;
  onPick: (c: string) => void;
  label: string;
}> = ({ colors, value, onPick, label }) => {
  const isCustom = !colors.includes(value.toLowerCase());
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {colors.map((c) => {
        const selected = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c}
            onClick={() => onPick(c)}
            className={`w-7 h-7 rounded-full border transition-transform cursor-pointer active:scale-90 ${
              selected
                ? 'border-amber-300 ring-2 ring-amber-400/70 ring-offset-2 ring-offset-stone-900 scale-110'
                : 'border-stone-950/40 hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
          />
        );
      })}
      {/* Custom color picker */}
      <label
        title="Color personalizado"
        className={`relative w-7 h-7 rounded-full border cursor-pointer overflow-hidden transition-transform hover:scale-110 ${
          isCustom
            ? 'border-amber-300 ring-2 ring-amber-400/70 ring-offset-2 ring-offset-stone-900 scale-110'
            : 'border-stone-950/40'
        }`}
        style={{
          background: isCustom
            ? value
            : 'conic-gradient(#f87171, #fbbf24, #a3e635, #34d399, #38bdf8, #a78bfa, #f472b6, #f87171)',
        }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          aria-label={`${label}: color personalizado`}
        />
      </label>
    </div>
  );
};

function Chips<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { id: T; name: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
              selected
                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-900/30'
                : 'bg-stone-800/70 text-stone-200 border-stone-700 hover:border-stone-500 hover:bg-stone-800'
            }`}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  label: string;
}> = ({ value, min, max, onChange, leftLabel, rightLabel, label }) => (
  <div className="flex flex-col gap-1">
    <input
      type="range"
      min={min}
      max={max}
      step={0.01}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-amber-500 cursor-pointer"
    />
    <div className="flex justify-between text-[10px] text-stone-400">
      <span>{leftLabel}</span>
      <span>{rightLabel}</span>
    </div>
  </div>
);

// ---------- Main component ----------

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ appearance, onChange, onSwitchBody, onClose, portrait }) => {
  const [tab, setTab] = useState<Tab>('cuerpo');
  const [history, setHistory] = useState<CharacterAppearance[]>([]);
  const lastKeyRef = useRef<string | null>(null);

  /**
   * Applies a change. Consecutive edits of the same field (e.g. dragging a slider
   * or a color picker) collapse into a single undo step.
   */
  const apply = (next: CharacterAppearance, key: string) => {
    if (key !== lastKeyRef.current || key === 'random' || key === 'reset') {
      setHistory((h) => [...h.slice(-29), appearance]);
    }
    lastKeyRef.current = key;
    onChange(next);
  };

  const set = <K extends keyof CharacterAppearance>(key: K, value: CharacterAppearance[K]) =>
    apply({ ...appearance, [key]: value }, key);

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    lastKeyRef.current = null;
    onChange(prev);
  };

  const body = appearance.bodyType;
  const randomize = () => apply(generateRandomAppearance(body), 'random');
  const randomizeLook = () => apply(generateRandomAppearance(body, appearance.name), 'random');
  const reset = () => apply(defaultAppearanceFor(body), 'reset');

  const switchBody = (next: BodyType) => {
    if (next === body) return;
    // Undo history belongs to the character being edited
    setHistory([]);
    lastKeyRef.current = null;
    onSwitchBody(next);
  };

  const panelPosition = portrait
    ? 'inset-x-0 bottom-0 max-h-[56%] rounded-t-3xl border-t'
    : 'right-0 top-0 bottom-0 w-[min(390px,46vw)] border-l';

  return (
    <div className="absolute inset-0 pointer-events-none text-stone-100">
      {/* Floating title over the 3D preview */}
      <div
        className={`absolute flex flex-col gap-1 ${
          portrait ? 'top-4 inset-x-4 items-center text-center' : 'top-6 left-6 max-w-[40%]'
        }`}
      >
        <span className={`inline-flex items-center gap-1.5 ${portrait ? 'self-center' : 'self-start'} px-3 py-1 rounded-full bg-stone-900/75 border border-stone-700/60 text-[10px] tracking-widest text-amber-300 font-semibold uppercase`}>
          <Sparkles className="w-3 h-3" />
          Generador de Personajes
        </span>
        <h2
          className="text-2xl sm:text-3xl font-bold text-amber-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] truncate max-w-full"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {appearance.name || 'Sin nombre'}
        </h2>
        <span
          className={`${portrait ? 'self-center' : 'self-start'} px-2.5 py-0.5 rounded-full bg-stone-900/60 text-[10px] text-stone-200`}
        >
          {portrait ? 'Desliza para girar' : 'Arrastra para girar · rueda para acercar'}
        </span>
      </div>

      {/* Editor panel */}
      <div
        className={`absolute ${panelPosition} pointer-events-auto flex flex-col bg-stone-900/92 border-stone-700/70 backdrop-blur-md shadow-2xl`}
      >
        {/* Character selector + name + randomizers */}
        <div className="flex flex-col gap-3 p-4 pb-3 border-b border-stone-800">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-stone-950/70 border border-stone-800" role="radiogroup" aria-label="Personaje">
            {BODY_TYPES.map((b) => {
              const selected = body === b.id;
              const Icon = b.id === 'chica' ? Venus : Mars;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => switchBody(b.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    selected
                      ? b.id === 'chica'
                        ? 'bg-rose-400 text-stone-950 shadow-md shadow-rose-950/40'
                        : 'bg-sky-400 text-stone-950 shadow-md shadow-sky-950/40'
                      : 'text-stone-400 hover:text-stone-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {b.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={appearance.name}
              maxLength={24}
              placeholder={body === 'chica' ? 'Nombre de tu viajera' : 'Nombre de tu viajero'}
              onChange={(e) => set('name', e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-stone-950/70 border border-stone-700 focus:border-amber-400 focus:outline-none text-sm font-semibold text-stone-100 placeholder:text-stone-500 select-text"
              aria-label="Nombre del personaje"
            />
            <button
              type="button"
              onClick={() => set('name', generateRandomName(body))}
              title="Nombre aleatorio"
              aria-label="Nombre aleatorio"
              className="p-2 rounded-xl bg-stone-800 border border-stone-700 hover:border-amber-400 text-amber-300 cursor-pointer active:scale-95"
            >
              <Dices className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={randomize}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-950 font-bold text-xs shadow-lg shadow-amber-950/30 cursor-pointer active:scale-95"
            >
              <Dices className="w-4 h-4" />
              ¡Generar al azar!
            </button>
            <button
              type="button"
              onClick={randomizeLook}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-stone-800 border border-stone-700 hover:border-amber-400 text-stone-100 font-semibold text-xs cursor-pointer active:scale-95"
              title="Cambia la apariencia y conserva el nombre"
            >
              <Shuffle className="w-4 h-4 text-amber-300" />
              Solo apariencia
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-3" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-stone-800 text-amber-300 border border-stone-600'
                  : 'text-stone-400 hover:text-stone-200 border border-transparent'
              }`}
            >
              {t.icon}
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 overscroll-contain touch-pan-y">
          {tab === 'cuerpo' && (
            <>
              <Section title="Tono de piel">
                <Swatches label="Tono de piel" colors={SKIN_TONES} value={appearance.skinColor} onPick={(c) => set('skinColor', c)} />
              </Section>
              <Section title="Ojos">
                <Chips options={EYE_STYLES} value={appearance.eyeStyle} onPick={(v) => set('eyeStyle', v)} />
              </Section>
              <Section title="Detalle">
                <Chips options={ACCESSORIES} value={appearance.accessory} onPick={(v) => set('accessory', v)} />
              </Section>
              <Section title="Estatura">
                <Slider
                  label="Estatura"
                  value={appearance.height}
                  min={0.88}
                  max={1.12}
                  onChange={(v) => set('height', v)}
                  leftLabel="Bajito"
                  rightLabel="Alto"
                />
              </Section>
              <Section title="Complexión">
                <Slider
                  label="Complexión"
                  value={appearance.build}
                  min={0.88}
                  max={1.15}
                  onChange={(v) => set('build', v)}
                  leftLabel="Delgado"
                  rightLabel="Rellenito"
                />
              </Section>
            </>
          )}

          {tab === 'pelo' && (
            <>
              <Section title="Peinado">
                <Chips options={hairStylesFor(body)} value={appearance.hairStyle} onPick={(v) => set('hairStyle', v)} />
              </Section>
              <Section title="Color de pelo">
                <Swatches label="Color de pelo" colors={HAIR_COLORS} value={appearance.hairColor} onPick={(c) => set('hairColor', c)} />
              </Section>
            </>
          )}

          {tab === 'ropa' && (
            <>
              <Section title="Estilo de ropa">
                <Chips options={outfitStylesFor(body)} value={appearance.outfitStyle} onPick={(v) => set('outfitStyle', v)} />
              </Section>
              <Section title="Color de la ropa">
                <Swatches label="Color de la ropa" colors={CLOTH_COLORS} value={appearance.sweaterColor} onPick={(c) => set('sweaterColor', c)} />
              </Section>
              <Section title="Color de detalles">
                <Swatches label="Color de detalles" colors={CLOTH_COLORS} value={appearance.detailColor} onPick={(c) => set('detailColor', c)} />
              </Section>
              <Section title="Para la cabeza">
                <Chips options={hatStylesFor(body)} value={appearance.hatStyle} onPick={(v) => set('hatStyle', v)} />
              </Section>
              <Section title="Color del gorro y puños">
                <Swatches label="Color del gorro" colors={CLOTH_COLORS} value={appearance.hatColor} onPick={(c) => set('hatColor', c)} />
              </Section>
              <Section title="Bufanda">
                <Swatches label="Bufanda" colors={CLOTH_COLORS} value={appearance.scarfColor} onPick={(c) => set('scarfColor', c)} />
              </Section>
              <Section title="Botas">
                <Swatches label="Botas" colors={BOOT_COLORS} value={appearance.bootColor} onPick={(c) => set('bootColor', c)} />
              </Section>
              <Section title="Equipo">
                <button
                  type="button"
                  role="switch"
                  aria-checked={appearance.backpack}
                  onClick={() => set('backpack', !appearance.backpack)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left cursor-pointer transition-colors ${
                    appearance.backpack
                      ? 'bg-amber-950/40 border-amber-500/60'
                      : 'bg-stone-800/60 border-stone-700 hover:border-stone-500'
                  }`}
                >
                  <Backpack className={`w-5 h-5 ${appearance.backpack ? 'text-amber-300' : 'text-stone-400'}`} />
                  <div className="flex-1">
                    <div className="text-xs font-bold">Mochila de aventurero</div>
                    <div className="text-[10px] text-stone-400">Con petate, cantimplora y farolito</div>
                  </div>
                  <span
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${appearance.backpack ? 'bg-amber-500' : 'bg-stone-600'}`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        appearance.backpack ? 'translate-x-4' : ''
                      }`}
                    />
                  </span>
                </button>
              </Section>
            </>
          )}

          {tab === 'companero' && (
            <Section title="Compañero flotante">
              <div className="grid grid-cols-2 gap-2">
                {COMPANIONS.map((c) => {
                  const selected = appearance.companion === c.id;
                  const unlocked = isCompanionUnlocked(c.id);
                  const lvl = unlockLevelFor(c.id);
                  if (!unlocked) {
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col gap-1 p-3 rounded-2xl border border-dashed border-stone-700 bg-stone-950/50 text-left opacity-80"
                        aria-disabled="true"
                      >
                        <span className="flex items-center gap-1.5 text-stone-500">
                          {COMPANION_ICONS[c.id]}
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs font-bold text-stone-300">{c.name}</span>
                        <span className="text-[10px] text-amber-300/90 leading-snug">
                          🔒 Completa el nivel {lvl} para desbloquearlo
                        </span>
                        {COMPANION_POWERS[c.id] && (
                          <span className="text-[10px] leading-snug text-stone-500">
                            Poder: {COMPANION_POWERS[c.id]!.powerName}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set('companion', c.id)}
                      className={`flex flex-col gap-1 p-3 rounded-2xl border text-left cursor-pointer transition-all active:scale-95 ${
                        selected
                          ? 'bg-amber-950/40 border-amber-400 ring-1 ring-amber-400/50'
                          : 'bg-stone-800/60 border-stone-700 hover:border-stone-500'
                      }`}
                    >
                      <span className={selected ? 'text-amber-300' : 'text-stone-400'}>{COMPANION_ICONS[c.id]}</span>
                      <span className="text-xs font-bold">{c.name}</span>
                      <span className="text-[10px] text-stone-400 leading-snug">{c.desc}</span>
                      {COMPANION_POWERS[c.id] && (
                        <span className="mt-1 text-[10px] leading-snug text-emerald-300">
                          <strong>Poder (G): {COMPANION_POWERS[c.id]!.powerName}.</strong> {COMPANION_POWERS[c.id]!.desc}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 p-3 border-t border-stone-800 pb-safe">
          <button
            type="button"
            onClick={undo}
            disabled={!history.length}
            title="Deshacer"
            aria-label="Deshacer"
            className="p-2.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 enabled:hover:border-stone-500 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={reset}
            title="Restablecer personaje original"
            aria-label="Restablecer"
            className="p-2.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 hover:border-stone-500 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm cursor-pointer active:scale-95 shadow-lg shadow-emerald-950/30"
          >
            <Check className="w-4 h-4" />
            ¡Listo!
          </button>
        </div>
      </div>
    </div>
  );
};
