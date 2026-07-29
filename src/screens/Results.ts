import { totalScore, type GameSession } from '../game/state';

export interface ResultsOptions {
  onPlayAgain: () => void;
}

export function renderResults(container: HTMLElement, session: GameSession, opts: ResultsOptions): void {
  const score = totalScore(session);
  const rows = session.results
    .map(
      (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.station.name}</td>
          <td>${r.solved ? r.attemptsUsed : 'Revealed'}</td>
          <td>${r.points}</td>
        </tr>
      `,
    )
    .join('');

  container.innerHTML = `
    <div class="results-screen">
      <h1>Quickplay Results</h1>
      <div class="final-score">${score}<span class="out-of">/100</span></div>
      <table class="results-table">
        <thead><tr><th>#</th><th>Station</th><th>Attempts</th><th>Points</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <button class="btn btn-primary" id="play-again-btn">Play Again</button>
    </div>
  `;
  container.querySelector<HTMLButtonElement>('#play-again-btn')!.addEventListener('click', opts.onPlayAgain);
}
