import React from 'react';
import { Star } from 'lucide-react';

/** 0–3 stars of a level rating (filled ones in gold). */
export const RatingStars: React.FC<{ stars: number; size?: string; className?: string }> = ({ stars, size = 'w-4 h-4', className = '' }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${stars} de 3 estrellas`}>
    {[0, 1, 2].map((i) => (
      <Star
        key={i}
        className={`${size} ${i < stars ? 'text-amber-400 fill-amber-400' : 'text-stone-300 fill-transparent'}`}
        strokeWidth={2.2}
      />
    ))}
  </span>
);
