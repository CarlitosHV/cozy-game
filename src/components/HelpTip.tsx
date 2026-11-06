import React, { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';

/** On-demand tip for tricky terms — never blocks experts who skip it. */
export const HelpTip: React.FC<{
  label: string;
  children?: React.ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}> = ({ label, children, side = 'top', className = '' }) => {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={`relative inline-flex items-center align-middle ${className}`}>
      {children}
      <button
        type="button"
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-cozy-soft hover:text-cozy-sky cursor-pointer shrink-0"
        aria-label={`Qué significa: ${label}`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute z-50 w-52 sm:w-56 px-2.5 py-2 rounded-xl cozy-panel text-[10px] leading-snug text-cozy-ink font-medium shadow-lg left-1/2 -translate-x-1/2 ${
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
};

export const EmptyState: React.FC<{
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({ title, body, actionLabel, onAction, className = '' }) => (
  <div
    className={`flex flex-col items-center justify-center text-center gap-2 p-4 ${className}`}
  >
    <p className="text-xs font-bold text-cozy-ink">{title}</p>
    <p className="text-[11px] text-cozy-muted leading-relaxed max-w-[16rem]">{body}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-1 text-[11px] font-semibold text-cozy-sky hover:text-cozy-ink cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

/** Short glossary for in-UI tips. */
export const TIPS = {
  descanso:
    'Un santuario que guarda tu avance. Si caes, vuelves al último que tocaste.',
  contrarreloj:
    'Llega a la cima antes de que el reloj llegue a cero. Las reliquias y descansos dan segundos extra.',
  persecucion:
    'Un acechador te sigue. Si te alcanza, te empuja: mantente en movimiento.',
  reliquias:
    'Objetos brillantes por el camino. Recógelos para puntos y, en contrarreloj, más tiempo.',
  orbes:
    'Esferas mágicas del mundo abierto. Con todas se abre la fortaleza del centro.',
  mochila:
    'Guarda bayas y nueces que encuentras. Toca un objeto para usarlo (teclas 1 a 5).',
  poder:
    'Habilidad temporal de tu compañero. Si tiene hambre, dale una baya desde la mochila.',
  modoFoto:
    'Congela la vista para sacar capturas. Puedes filtrar, enmarcar y guardar la imagen.',
  ranking:
    'Lista de mejores tiempos de este nivel. Completa un contrarreloj para aparecer.',
  usuario:
    'Tu identificador único para entrar. Solo letras, números o _.',
  displayName:
    'El nombre que ven los demás. Si lo dejas vacío, usamos tu usuario.',
  friends:
    'Busca por usuario, envía solicitud y, cuando acepte, podrás invitarle a una partida privada.',
  invitePlay:
    'Abre una sala privada (hasta 10). Tus amigos deben estar en línea y aceptar en 60 segundos.',
} as const;
