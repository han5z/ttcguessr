import { createMapView } from '../game/mapView';
import { LINES } from '../data/lines';
import { stopsBetween } from '../data/network';
import type { Region } from '../data/stations';
import {
  createSession,
  currentStation,
  isLastRound,
  pointsForAttempt,
  recordResult,
  totalScore,
  MAX_ATTEMPTS,
  type GameSession,
  type RoundResult,
} from '../game/state';

export interface QuickplayOptions {
  onFinish: (session: GameSession) => void;
}

const REGION_LABEL: Record<Region, string> = {
  downtown: 'downtown core',
  west: 'west end',
  east: 'east end',
  north: 'north end',
};

export async function renderQuickplay(container: HTMLElement, opts: QuickplayOptions): Promise<void> {
  const session = createSession();
  let attempt = 1;
  let awaitingRevealConfirm = false;

  container.innerHTML = `
    <div class="quickplay-screen">
      <div class="hud">
        <div class="hud-round">Station <span id="round-num"></span> of ${session.stations.length}</div>
        <div class="hud-score">Score: <span id="running-score">0</span></div>
      </div>
      <div class="prompt">Find: <strong id="prompt-name"></strong></div>
      <div class="hint" id="hint-banner"></div>
      <div class="map-wrap" id="map-wrap">
        <div class="map-loading">Loading map…</div>
      </div>
      <div class="feedback" id="feedback"></div>
    </div>
  `;

  const mapWrap = container.querySelector<HTMLElement>('#map-wrap')!;
  const map = await createMapView();
  mapWrap.replaceChildren(map.svg);

  const roundNumEl = container.querySelector('#round-num')!;
  const scoreEl = container.querySelector('#running-score')!;
  const promptEl = container.querySelector('#prompt-name')!;
  const hintEl = container.querySelector<HTMLElement>('#hint-banner')!;
  const feedbackEl = container.querySelector<HTMLElement>('#feedback')!;

  function startRound() {
    attempt = 1;
    awaitingRevealConfirm = false;
    map.setInteractive(true);
    map.resetHighlights();
    hintEl.textContent = '';
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    roundNumEl.textContent = String(session.currentIndex + 1);
    scoreEl.textContent = String(totalScore(session));
    promptEl.textContent = currentStation(session).name;
  }

  function finishRound(result: RoundResult) {
    recordResult(session, result);
    scoreEl.textContent = String(totalScore(session));
    map.setInteractive(false);
    setTimeout(() => {
      if (isLastRound(session)) {
        opts.onFinish(session);
      } else {
        session.currentIndex += 1;
        startRound();
      }
    }, 900);
  }

  map.onClick(({ station, x, y }) => {
    const target = currentStation(session);

    if (awaitingRevealConfirm) {
      if (station && station.id === target.id) {
        map.flashStation(target.id, 'correct');
        feedbackEl.textContent = `That's ${target.name}.`;
        feedbackEl.className = 'feedback feedback--neutral';
        finishRound({ station: target, attemptsUsed: MAX_ATTEMPTS + 1, points: 0, solved: false });
      }
      return;
    }

    if (station && station.id === target.id) {
      const points = pointsForAttempt(attempt);
      map.flashStation(target.id, 'correct');
      feedbackEl.textContent = attempt === 1 ? 'Correct!' : `Correct! (+${points} pts)`;
      feedbackEl.className = 'feedback feedback--correct';
      finishRound({ station: target, attemptsUsed: attempt, points, solved: true });
      return;
    }

    if (station) {
      map.flashStation(station.id, 'incorrect');
      map.showLabel(station.id);
    } else {
      map.flashPoint(x, y, 'incorrect');
    }

    if (attempt >= MAX_ATTEMPTS) {
      awaitingRevealConfirm = true;
      map.revealStation(target.id);
      map.showLabel(target.id);
      feedbackEl.textContent = 'Out of attempts.';
      feedbackEl.className = 'feedback feedback--incorrect';
      hintEl.textContent = `The answer is revealed on the map — click it to confirm.`;
    } else {
      attempt += 1;
      feedbackEl.textContent = 'Not quite — try again.';
      feedbackEl.className = 'feedback feedback--incorrect';
      if (attempt === 2) {
        map.highlightLines(target.lines);
        const lineNames = target.lines.map((id) => LINES[id].name).join(' / ');
        hintEl.textContent = `Hint: it's on ${lineNames}.`;
      } else if (attempt === 3) {
        hintEl.textContent = `Hint: it's in the ${REGION_LABEL[target.region]} of the network.`;
      } else if (attempt === 4) {
        if (station) {
          const stops = stopsBetween(station.id, target.id);
          const within = stops <= 2;
          hintEl.textContent = `Hint: your last guess, ${station.name}, ${within ? 'is' : "isn't"} within 2 stops of the answer.`;
        } else {
          hintEl.textContent = `Hint: that click wasn't near a station, so no proximity clue there.`;
        }
      }
    }
  });

  startRound();
}
