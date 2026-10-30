import { createMapView } from '../game/mapView';
import { LINES, type LineId } from '../data/lines';
import { stopsBetween } from '../data/network';
import { STATIONS, type Region } from '../data/stations';
import { playSound, isMuted, toggleMuted } from '../game/audio';
import {
  createSession,
  currentStation,
  isLastRound,
  pointsForAttempt,
  recordResult,
  totalScore,
  maxPossibleScore,
  attemptBreakdown,
  MAX_ATTEMPTS,
  MODE_LABEL,
  type GameMode,
  type GameSession,
  type RoundResult,
} from '../game/state';

export interface QuickplayOptions {
  mode: GameMode;
  onHome: () => void;
}

const REGION_LABEL: Record<Region, string> = {
  downtown: 'Downtown',
  west: 'West',
  east: 'East',
  north: 'North',
};

const HOME_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 19V14H14V19C14 19.55 14.45 20 15 20H18C18.55 20 19 19.55 19 19V12H20.7C21.16 12 21.38 11.43 21.03 11.13L12.67 3.59997C12.29 3.25997 11.71 3.25997 11.33 3.59997L2.97001 11.13C2.63001 11.43 2.84001 12 3.30001 12H5.00001V19C5.00001 19.55 5.45001 20 6.00001 20H9.00001C9.55001 20 10 19.55 10 19Z" fill="currentColor"/></svg>`;
const REFRESH_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.6498 6.34999C16.0198 4.71999 13.7098 3.77999 11.1698 4.03999C7.49978 4.40999 4.47978 7.38999 4.06978 11.06C3.51978 15.91 7.26978 20 11.9998 20C15.1898 20 17.9298 18.13 19.2098 15.44C19.5298 14.77 19.0498 14 18.3098 14C17.9398 14 17.5898 14.2 17.4298 14.53C16.2998 16.96 13.5898 18.5 10.6298 17.84C8.40978 17.35 6.61978 15.54 6.14978 13.32C5.30978 9.43999 8.25978 5.99999 11.9998 5.99999C13.6598 5.99999 15.1398 6.68999 16.2198 7.77999L14.7098 9.28999C14.0798 9.91999 14.5198 11 15.4098 11H18.9998C19.5498 11 19.9998 10.55 19.9998 9.99999V6.40999C19.9998 5.51999 18.9198 5.06999 18.2898 5.69999L17.6498 6.34999Z" fill="currentColor"/></svg>`;
const VOLUME_ON_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9.99996V14C3 14.55 3.45 15 4 15H7L10.29 18.29C10.92 18.92 12 18.47 12 17.58V6.40996C12 5.51996 10.92 5.06996 10.29 5.69996L7 8.99996H4C3.45 8.99996 3 9.44996 3 9.99996ZM16.5 12C16.5 10.23 15.48 8.70996 14 7.96996V16.02C15.48 15.29 16.5 13.77 16.5 12ZM14 4.44996V4.64996C14 5.02996 14.25 5.35996 14.6 5.49996C17.18 6.52996 19 9.05996 19 12C19 14.94 17.18 17.47 14.6 18.5C14.24 18.64 14 18.97 14 19.35V19.55C14 20.18 14.63 20.62 15.21 20.4C18.6 19.11 21 15.84 21 12C21 8.15996 18.6 4.88996 15.21 3.59996C14.63 3.36996 14 3.81996 14 4.44996Z" fill="currentColor"/></svg>`;
const VOLUME_OFF_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.63 3.63002C3.24 4.02002 3.24 4.65002 3.63 5.04002L7.29 8.70002L7 9.00002H4C3.45 9.00002 3 9.45002 3 10V14C3 14.55 3.45 15 4 15H7L10.29 18.29C10.92 18.92 12 18.47 12 17.58V13.41L16.18 17.59C15.69 17.96 15.16 18.27 14.58 18.5C14.22 18.65 14 19.03 14 19.42C14 20.14 14.73 20.6 15.39 20.33C16.19 20 16.94 19.56 17.61 19.02L18.95 20.36C19.34 20.75 19.97 20.75 20.36 20.36C20.75 19.97 20.75 19.34 20.36 18.95L5.05 3.63002C4.66 3.24002 4.03 3.24002 3.63 3.63002ZM19 12C19 12.82 18.85 13.61 18.59 14.34L20.12 15.87C20.68 14.7 21 13.39 21 12C21 8.17002 18.6 4.89002 15.22 3.60002C14.63 3.37002 14 3.83002 14 4.46002V4.65002C14 5.03002 14.25 5.36002 14.61 5.50002C17.18 6.54002 19 9.06002 19 12ZM10.29 5.71002L10.12 5.88002L12 7.76002V6.41002C12 5.52002 10.92 5.08002 10.29 5.71002ZM16.5 12C16.5 10.23 15.48 8.71002 14 7.97002V9.76002L16.48 12.24C16.49 12.16 16.5 12.08 16.5 12Z" fill="currentColor"/></svg>`;
const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 1H4C2.9 1 2 1.9 2 3V16C2 16.55 2.45 17 3 17C3.55 17 4 16.55 4 16V4C4 3.45 4.45 3 5 3H15C15.55 3 16 2.55 16 2C16 1.45 15.55 1 15 1ZM15.59 5.59L20.42 10.42C20.79 10.79 21 11.3 21 11.83V21C21 22.1 20.1 23 19 23H7.99C6.89 23 6 22.1 6 21L6.01 7C6.01 5.9 6.9 5 8 5H14.17C14.7 5 15.21 5.21 15.59 5.59ZM15 12H19.5L14 6.5V11C14 11.55 14.45 12 15 12Z" fill="currentColor"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.3 5.71C17.91 5.32 17.28 5.32 16.89 5.71L12 10.59L7.10997 5.7C6.71997 5.31 6.08997 5.31 5.69997 5.7C5.30997 6.09 5.30997 6.72 5.69997 7.11L10.59 12L5.69997 16.89C5.30997 17.28 5.30997 17.91 5.69997 18.3C6.08997 18.69 6.71997 18.69 7.10997 18.3L12 13.41L16.89 18.3C17.28 18.69 17.91 18.69 18.3 18.3C18.69 17.91 18.69 17.28 18.3 16.89L13.41 12L18.3 7.11C18.68 6.73 18.68 6.09 18.3 5.71Z" fill="currentColor"/></svg>`;

/** Initial view frames from York Mills down to Union. */
const INITIAL_VIEW_TOP = STATIONS.find((s) => s.id === 'york-mills')!;
const INITIAL_VIEW_BOTTOM = STATIONS.find((s) => s.id === 'union')!;
const INITIAL_VIEW_PADDING = 70;

function focusInitialView(map: Awaited<ReturnType<typeof createMapView>>) {
  map.focusOnBounds(
    INITIAL_VIEW_TOP.x,
    INITIAL_VIEW_TOP.y,
    INITIAL_VIEW_BOTTOM.x,
    INITIAL_VIEW_BOTTOM.y,
    INITIAL_VIEW_PADDING,
  );
}

const KEYCAP_EMOJI = [
  '1\u{FE0F}\u{20E3}',
  '2\u{FE0F}\u{20E3}',
  '3\u{FE0F}\u{20E3}',
  '4\u{FE0F}\u{20E3}',
  '5\u{FE0F}\u{20E3}',
];
const ATTEMPT_LABELS = ['1st', '2nd', '3rd', '4th'];

function attemptLabel(result: RoundResult): string {
  return result.solved ? (ATTEMPT_LABELS[result.attemptsUsed - 1] ?? `${result.attemptsUsed}th`) : 'Revealed';
}

const SHARE_URL = 'https://ttcguessr.pages.dev';

function buildShareText(session: GameSession): string {
  return `${buildShareBody(session)}\n\n${SHARE_URL}`;
}

/** "Daily Challenge (30.10.2026)" for daily games, otherwise just the mode name. */
function shareModeLabel(session: GameSession): string {
  if (!session.dailyDate) return MODE_LABEL[session.mode];
  const [y, m, d] = session.dailyDate.split('-');
  return `${MODE_LABEL[session.mode]} (${d}.${m}.${y})`;
}

function buildShareBody(session: GameSession): string {
  if (session.mode === 'fill-map') {
    const lines = ['TTC Guessr', shareModeLabel(session), '', `I scored ${totalScore(session)}/${maxPossibleScore(session)}!`, ''];
    const b = attemptBreakdown(session);
    lines.push(`1st try: ${b.first}`);
    lines.push(`2nd try: ${b.second}`);
    lines.push(`3rd try: ${b.third}`);
    lines.push(`4th try: ${b.fourth}`);
    lines.push(`Revealed: ${b.revealed}`);
    return lines.join('\n');
  }

  const lines = ['TTC Guessr', shareModeLabel(session), '', `I scored ${totalScore(session)}/${maxPossibleScore(session)}!`, ''];
  session.results.forEach((r, i) => {
    const numeral = KEYCAP_EMOJI[i] ?? `${i + 1}.`;
    lines.push(`${numeral} ${r.station.name} - ${attemptLabel(r)}`);
  });
  return lines.join('\n');
}

export async function renderQuickplay(container: HTMLElement, opts: QuickplayOptions): Promise<void> {
  const mode = opts.mode;

  container.innerHTML = `
    <div class="quickplay-screen">
      <div class="map-wrap" id="map-wrap">
        <div class="map-loading">Loading map…</div>
      </div>
      <div class="game-hud">
        <div class="hud-counter">
          <div class="round-indicator">Station <span id="round-num"></span>/<span id="round-total"></span></div>
          <div class="score-indicator">Score: <span id="running-score">0</span></div>
        </div>
        <div class="hud-prompt">
          <div class="station-name-pill" id="prompt-name"></div>
          <div class="attempt-dots" id="attempt-dots">
            <span class="attempt-dot"></span><span class="attempt-dot"></span><span class="attempt-dot"></span><span class="attempt-dot"></span>
          </div>
        </div>
        <div class="hud-controls">
          <button class="icon-btn" id="volume-btn" type="button" title="Toggle sound" aria-label="Toggle sound"></button>
          <button class="icon-btn" id="home-btn" type="button" title="Main menu" aria-label="Main menu">${HOME_ICON}</button>
          <button class="icon-btn" id="refresh-btn" type="button" title="Restart" aria-label="Restart">${REFRESH_ICON}</button>
        </div>
      </div>
      <div class="hints-box" id="hints-box">
        <div class="hints-title">Hints</div>
        <div class="hints-chips" id="hints-chips"></div>
      </div>
      <div class="results-overlay" id="results-overlay" hidden>
        <div class="results-card">
          <h2 id="results-mode-title"></h2>
          <div class="final-score" id="results-score"></div>
          <div class="results-breakdown" id="results-breakdown"></div>
          <div class="results-actions" id="results-primary-actions">
            <button class="btn btn-primary" id="play-again-btn">Play Again</button>
          </div>
          <div class="results-actions results-actions--secondary">
            <button class="btn btn-secondary" id="share-btn" type="button">Share</button>
            <button class="btn btn-secondary" id="results-home-btn" type="button">Home</button>
          </div>
        </div>
      </div>
      <div class="share-overlay" id="share-overlay" hidden>
        <div class="share-modal">
          <button class="icon-btn share-modal-close" id="share-close-btn" type="button" title="Close" aria-label="Close">${CLOSE_ICON}</button>
          <h3>Share</h3>
          <div class="share-panel">
            <pre class="share-text" id="share-text"></pre>
            <button class="icon-btn" id="copy-btn" type="button" title="Copy to clipboard" aria-label="Copy to clipboard">${COPY_ICON}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const mapWrap = container.querySelector<HTMLElement>('#map-wrap')!;
  const map = await createMapView();
  mapWrap.replaceChildren(map.svg);
  focusInitialView(map);

  const roundNumEl = container.querySelector('#round-num')!;
  const roundTotalEl = container.querySelector('#round-total')!;
  const scoreEl = container.querySelector('#running-score')!;
  const promptEl = container.querySelector('#prompt-name')!;
  const dots = Array.from(container.querySelectorAll<HTMLElement>('.attempt-dot'));
  const chipsEl = container.querySelector<HTMLElement>('#hints-chips')!;
  const volumeBtn = container.querySelector<HTMLButtonElement>('#volume-btn')!;
  const homeBtn = container.querySelector<HTMLButtonElement>('#home-btn')!;
  const refreshBtn = container.querySelector<HTMLButtonElement>('#refresh-btn')!;

  const resultsOverlay = container.querySelector<HTMLElement>('#results-overlay')!;
  const resultsModeTitle = container.querySelector<HTMLElement>('#results-mode-title')!;
  const resultsScoreEl = container.querySelector<HTMLElement>('#results-score')!;
  const resultsBreakdownEl = container.querySelector<HTMLElement>('#results-breakdown')!;
  const primaryActions = container.querySelector<HTMLElement>('#results-primary-actions')!;
  const playAgainBtn = container.querySelector<HTMLButtonElement>('#play-again-btn')!;
  const shareBtn = container.querySelector<HTMLButtonElement>('#share-btn')!;
  const resultsHomeBtn = container.querySelector<HTMLButtonElement>('#results-home-btn')!;
  const shareOverlay = container.querySelector<HTMLElement>('#share-overlay')!;
  const shareCloseBtn = container.querySelector<HTMLButtonElement>('#share-close-btn')!;
  const shareTextEl = container.querySelector<HTMLElement>('#share-text')!;
  const copyBtn = container.querySelector<HTMLButtonElement>('#copy-btn')!;

  function updateVolumeIcon() {
    volumeBtn.innerHTML = isMuted() ? VOLUME_OFF_ICON : VOLUME_ON_ICON;
  }
  updateVolumeIcon();
  volumeBtn.addEventListener('click', () => {
    toggleMuted();
    updateVolumeIcon();
  });

  let session: GameSession = createSession(mode);
  let attempt = 1;
  let awaitingRevealConfirm = false;
  let pendingAdvance: number | undefined;

  function updateAttemptDots() {
    const wrongCount = Math.min(attempt - 1, dots.length);
    dots.forEach((dot, i) => dot.classList.toggle('attempt-dot--used', i < wrongCount));
  }

  function addLineChips(lineIds: LineId[]) {
    const row = document.createElement('div');
    row.className = 'hint-row';
    for (const id of lineIds) {
      const chip = document.createElement('span');
      chip.className = 'hint-chip hint-chip--line';
      chip.style.backgroundColor = LINES[id].color;
      chip.textContent = LINES[id].shortName;
      row.appendChild(chip);
    }
    chipsEl.appendChild(row);
  }

  function addChip(text: string, kind: 'region' | 'proximity') {
    const row = document.createElement('div');
    row.className = 'hint-row';
    const chip = document.createElement('span');
    chip.className = `hint-chip hint-chip--${kind}`;
    chip.textContent = text;
    row.appendChild(chip);
    chipsEl.appendChild(row);
  }

  function startRound() {
    attempt = 1;
    awaitingRevealConfirm = false;
    map.setInteractive(true);
    map.resetHighlights();
    chipsEl.replaceChildren();
    updateAttemptDots();
    roundNumEl.textContent = String(session.currentIndex + 1);
    roundTotalEl.textContent = String(session.stations.length);
    scoreEl.textContent = String(totalScore(session));
    promptEl.textContent = currentStation(session).name;
  }

  function showResults() {
    resultsModeTitle.textContent = MODE_LABEL[mode];
    const score = totalScore(session);
    const max = maxPossibleScore(session);
    resultsScoreEl.innerHTML = `${score}<span class="out-of">/${max}</span>`;
    const b = attemptBreakdown(session);
    resultsBreakdownEl.innerHTML = `
      <div class="breakdown-row"><span>1st try</span><strong>${b.first}</strong></div>
      <div class="breakdown-row"><span>2nd try</span><strong>${b.second}</strong></div>
      <div class="breakdown-row"><span>3rd try</span><strong>${b.third}</strong></div>
      <div class="breakdown-row"><span>4th try</span><strong>${b.fourth}</strong></div>
      <div class="breakdown-row"><span>Revealed</span><strong>${b.revealed}</strong></div>
    `;
    primaryActions.style.display = mode === 'daily' ? 'none' : '';
    shareOverlay.hidden = true;
    resultsOverlay.hidden = false;
    playSound(score > max * 0.3 ? 'gameFinished' : 'gameOverFail');
  }

  function finishRound(result: RoundResult) {
    recordResult(session, result);
    scoreEl.textContent = String(totalScore(session));
    map.setInteractive(false);
    pendingAdvance = window.setTimeout(() => {
      if (isLastRound(session)) {
        showResults();
      } else {
        session.currentIndex += 1;
        startRound();
      }
    }, 900);
  }

  function cancelPendingAdvance() {
    if (pendingAdvance !== undefined) {
      clearTimeout(pendingAdvance);
      pendingAdvance = undefined;
    }
  }

  function startNewGame() {
    cancelPendingAdvance();
    resultsOverlay.hidden = true;
    shareOverlay.hidden = true;
    map.clearSolvedLabels();
    map.clearDisabledStations();
    session = createSession(mode);
    startRound();
    focusInitialView(map);
  }

  homeBtn.addEventListener('click', () => {
    cancelPendingAdvance();
    opts.onHome();
  });
  resultsHomeBtn.addEventListener('click', () => {
    cancelPendingAdvance();
    opts.onHome();
  });
  refreshBtn.addEventListener('click', startNewGame);
  playAgainBtn.addEventListener('click', startNewGame);

  shareBtn.addEventListener('click', () => {
    shareTextEl.textContent = buildShareText(session);
    shareOverlay.hidden = false;
  });

  shareCloseBtn.addEventListener('click', () => {
    shareOverlay.hidden = true;
  });

  shareOverlay.addEventListener('click', (ev) => {
    if (ev.target === shareOverlay) shareOverlay.hidden = true;
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard
      .writeText(shareTextEl.textContent ?? '')
      .then(() => {
        copyBtn.classList.add('icon-btn--copied');
        setTimeout(() => copyBtn.classList.remove('icon-btn--copied'), 1200);
      })
      .catch(() => {});
  });

  map.onClick(({ station }) => {
    const target = currentStation(session);

    if (awaitingRevealConfirm) {
      if (station.id === target.id) {
        map.flashStation(target.id, 'correct');
        map.markSolved(target.id);
        map.disableStation(target.id);
        playSound('correct');
        finishRound({ station: target, attemptsUsed: MAX_ATTEMPTS + 1, points: 0, solved: false });
      }
      return;
    }

    if (station.id === target.id) {
      const points = pointsForAttempt(attempt);
      map.flashStation(target.id, 'correct');
      map.markSolved(target.id);
      map.disableStation(target.id);
      playSound('correct');
      finishRound({ station: target, attemptsUsed: attempt, points, solved: true });
      return;
    }

    playSound('incorrect');
    map.flashStation(station.id, 'incorrect');
    map.showLabel(station.id);

    attempt += 1;
    updateAttemptDots();

    if (attempt > MAX_ATTEMPTS) {
      awaitingRevealConfirm = true;
      map.revealStation(target.id);
      map.showLabel(target.id);
      map.panToStation(target.id);
    } else if (attempt === 2) {
      map.highlightLines(target.lines);
      addLineChips(target.lines);
    } else if (attempt === 3) {
      addChip(REGION_LABEL[target.region], 'region');
    } else if (attempt === 4 && station) {
      const stops = stopsBetween(station.id, target.id);
      addChip(stops <= 2 ? 'Within 2 Stops' : 'Not Within 2 Stops', 'proximity');
    }
  });

  startRound();
}
