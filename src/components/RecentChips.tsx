import React from 'react';

/** Recent picks / autocomplete chips — only render when there is history. */
export const RecentChips: React.FC<{
  label?: string;
  items: string[];
  onPick: (value: string) => void;
  emptyHint?: string;
}> = ({ label = 'Recientes', items, onPick, emptyHint }) => {
  if (items.length === 0) {
    if (!emptyHint) return null;
    return <p className="mt-1.5 text-[10px] text-cozy-soft">{emptyHint}</p>;
  }
  return (
    <div className="mt-1.5">
      <span className="block text-[10px] font-semibold text-cozy-muted mb-1">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="px-2.5 py-1 rounded-xl cozy-btn text-[10px] font-semibold text-cozy-ink cursor-pointer max-w-full truncate"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};

export const SuggestionList: React.FC<{
  query: string;
  options: string[];
  onPick: (value: string) => void;
  max?: number;
}> = ({ query, options, onPick, max = 5 }) => {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return null;
  const matches = options
    .filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q)
    .slice(0, max);
  if (matches.length === 0) return null;
  return (
    <ul className="mt-1 rounded-xl border border-cozy-line bg-cozy-panel overflow-hidden shadow-sm">
      {matches.map((m) => (
        <li key={m}>
          <button
            type="button"
            onClick={() => onPick(m)}
            className="w-full text-left px-3 py-2 text-xs text-cozy-ink hover:bg-cozy-panel-deep cursor-pointer truncate"
          >
            {m}
          </button>
        </li>
      ))}
    </ul>
  );
};
