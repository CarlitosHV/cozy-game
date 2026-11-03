import React from 'react';

/** Icon control with a visible text label (recognition over recall). */
export const IconAction: React.FC<{
  label: string;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  badge?: boolean;
  compact?: boolean;
}> = ({ label, title, onClick, children, className = '', badge = false, compact = false }) => (
  <button
    type="button"
    onClick={onClick}
    title={title ?? label}
    aria-label={label}
    className={`relative flex items-center justify-center gap-1 rounded-xl cozy-chip text-cozy-ink cursor-pointer ${
      compact ? 'flex-col px-1.5 py-1 min-w-[2.75rem]' : 'px-2.5 py-1.5'
    } ${className}`}
  >
    {children}
    <span
      className={`font-semibold leading-tight text-center ${
        compact ? 'text-[9px] max-w-[3.2rem] truncate' : 'text-[10px]'
      }`}
    >
      {label}
    </span>
    {badge && (
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cozy-accent border-2 border-white rounded-full" />
    )}
  </button>
);
