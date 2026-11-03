import React from 'react';
import { Check, Circle } from 'lucide-react';
import type { Requirement } from '../ui/validation';

export const RequirementList: React.FC<{
  items: Requirement[];
  show: boolean;
}> = ({ items, show }) => {
  if (!show) return null;
  return (
    <ul className="mt-1.5 space-y-1" aria-live="polite">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-center gap-1.5 text-[10px] ${
            item.ok ? 'text-cozy-moss' : 'text-cozy-muted'
          }`}
        >
          {item.ok ? (
            <Check className="w-3 h-3 shrink-0" />
          ) : (
            <Circle className="w-3 h-3 shrink-0 opacity-50" />
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
};

export const FieldError: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-[11px] text-cozy-blush leading-snug font-medium" role="alert">
      {message}
    </p>
  );
};
