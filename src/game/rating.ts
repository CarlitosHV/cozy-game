/**
 * Level rating: a 0–1000 score and 0–3 stars from the time, the deaths and the relics.
 *
 *  - Time (up to 400): full points at or under the level's par time, falling to 0 at 3× par.
 *  - Relics (up to 400): the share of relics found.
 *  - Survival (up to 200): 200 with no deaths, 50 less for each death.
 *  - Every death also takes 8 % off the whole score (down to half).
 *  - A player who did not finish before the party timer ran out gets 0.
 */
import { levelKind } from './progress';

export interface LevelRating {
  score: number;
  stars: number;
  deaths: number;
  timeSeconds: number;
  forfeited: boolean;
}

export interface RatingInput {
  levelId: number;
  timeSeconds: number;
  deaths: number;
  relics: number;
  totalRelics: number;
  forfeited?: boolean;
}

/** Seconds a good (not perfect) run takes on this level. */
export function parTime(levelId: number): number {
  const kind = levelKind(levelId);
  if (kind === 'handmade') return 60 + levelId * 20;
  if (kind === 'boss') return 210;
  return 170 + Math.min(120, levelId * 2);
}

export function starsForScore(score: number): number {
  if (score >= 850) return 3;
  if (score >= 600) return 2;
  if (score >= 300) return 1;
  return 0;
}

export function computeRating(input: RatingInput): LevelRating {
  const deaths = Math.max(0, Math.floor(input.deaths));
  const timeSeconds = Math.max(0, input.timeSeconds);
  if (input.forfeited) return { score: 0, stars: 0, deaths, timeSeconds, forfeited: true };
  const par = parTime(input.levelId);
  const over = Math.max(0, timeSeconds - par) / (par * 2);
  const timePts = 400 * Math.max(0, 1 - over);
  const relicPts = input.totalRelics > 0 ? (400 * Math.min(input.relics, input.totalRelics)) / input.totalRelics : 400;
  const survivalPts = Math.max(0, 200 - 50 * deaths);
  const mult = Math.max(0.5, 1 - 0.08 * deaths);
  const score = Math.round(Math.min(1000, (timePts + relicPts + survivalPts) * mult));
  return { score, stars: starsForScore(score), deaths, timeSeconds, forfeited: false };
}

// --- Best rating per level, saved in this browser ---

const KEY = 'cozy_level_ratings';

export interface SavedRating {
  score: number;
  stars: number;
  deaths: number;
}

function readAll(): Record<string, SavedRating> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, SavedRating>) : {};
  } catch {
    return {};
  }
}

export function bestRating(levelId: number): SavedRating | null {
  return readAll()[String(levelId)] ?? null;
}

/** Saves the rating if it beats the best one; returns true when it is a new best. */
export function saveRating(levelId: number, r: LevelRating): boolean {
  const all = readAll();
  const prev = all[String(levelId)];
  if (prev && prev.score >= r.score) return false;
  all[String(levelId)] = { score: r.score, stars: r.stars, deaths: r.deaths };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
  return true;
}
