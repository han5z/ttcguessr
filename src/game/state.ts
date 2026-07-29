import { STATIONS, type Station } from '../data/stations';

export const ROUNDS_PER_GAME = 5;
export const MAX_ATTEMPTS = 4;
/** Points awarded for a correct guess on attempt 1, 2, 3, 4; 0 if never guessed. */
export const POINTS_BY_ATTEMPT = [20, 13, 8, 5] as const;

export interface RoundResult {
  station: Station;
  attemptsUsed: number; // 1..MAX_ATTEMPTS if solved, MAX_ATTEMPTS+1 if revealed unsolved
  points: number;
  solved: boolean;
}

export interface GameSession {
  stations: Station[];
  currentIndex: number;
  results: RoundResult[];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickRoundStations(count: number = ROUNDS_PER_GAME): Station[] {
  const pool = STATIONS.filter((s) => s.includeInPool);
  return shuffle(pool).slice(0, count);
}

export function createSession(): GameSession {
  return {
    stations: pickRoundStations(),
    currentIndex: 0,
    results: [],
  };
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
