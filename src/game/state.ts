import { STATIONS, type Station } from '../data/stations';
import { shuffle, dailySeedRng, estDateString } from './rng';

export const MAX_ATTEMPTS = 4;
/** Points awarded for a correct guess on attempt 1, 2, 3, 4; 0 if never guessed. */
export const POINTS_BY_ATTEMPT = [20, 13, 8, 5] as const;
export const QUICKPLAY_ROUNDS = 5;

export type GameMode = 'quickplay' | 'daily' | 'fill-map';

export const MODE_LABEL: Record<GameMode, string> = {
  quickplay: 'Quickplay',
  daily: 'Daily Challenge',
  'fill-map': 'Fill The Map',
};

export interface RoundResult {
  station: Station;
  attemptsUsed: number; // 1..MAX_ATTEMPTS if solved, MAX_ATTEMPTS+1 if revealed unsolved
  points: number;
  solved: boolean;
}

export interface GameSession {
  mode: GameMode;
  stations: Station[];
  currentIndex: number;
  results: RoundResult[];
  /** Daily mode only: the YYYY-MM-DD puzzle date the stations were seeded from. */
  dailyDate?: string;
}

function poolStations(): Station[] {
  return STATIONS.filter((s) => s.includeInPool);
}

export function createSession(mode: GameMode): GameSession {
  if (mode === 'daily') {
    const dailyDate = estDateString();
    const stations = shuffle(poolStations(), dailySeedRng(dailyDate)).slice(0, QUICKPLAY_ROUNDS);
    return { mode, stations, currentIndex: 0, results: [], dailyDate };
  }
  const stations = mode === 'fill-map' ? shuffle(poolStations()) : shuffle(poolStations()).slice(0, QUICKPLAY_ROUNDS);
  return { mode, stations, currentIndex: 0, results: [] };
}

export function pointsForAttempt(attempt: number): number {
  return POINTS_BY_ATTEMPT[attempt - 1] ?? 0;
}

export function recordResult(session: GameSession, result: RoundResult): void {
  session.results.push(result);
}

export function currentStation(session: GameSession): Station {
  return session.stations[session.currentIndex];
}

export function isLastRound(session: GameSession): boolean {
  return session.currentIndex >= session.stations.length - 1;
}

export function totalScore(session: GameSession): number {
  return session.results.reduce((sum, r) => sum + r.points, 0);
}

export function maxPossibleScore(session: GameSession): number {
  return session.stations.length * POINTS_BY_ATTEMPT[0];
}

export interface AttemptBreakdown {
  first: number;
  second: number;
  third: number;
  fourth: number;
  revealed: number;
}

export function attemptBreakdown(session: GameSession): AttemptBreakdown {
  const breakdown: AttemptBreakdown = { first: 0, second: 0, third: 0, fourth: 0, revealed: 0 };
  for (const r of session.results) {
    if (!r.solved) {
      breakdown.revealed += 1;
    } else if (r.attemptsUsed === 1) {
      breakdown.first += 1;
    } else if (r.attemptsUsed === 2) {
      breakdown.second += 1;
    } else if (r.attemptsUsed === 3) {
      breakdown.third += 1;
    } else if (r.attemptsUsed === 4) {
      breakdown.fourth += 1;
    }
  }
  return breakdown;
}
