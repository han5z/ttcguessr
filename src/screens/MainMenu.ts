import type { GameMode } from '../game/state';

export interface MainMenuOptions {
  onPlay: (mode: GameMode) => void;
}

export function renderMainMenu(container: HTMLElement, opts: MainMenuOptions): void {
  container.innerHTML = `
    <div class="menu-screen">
      <h1>TTC Guessr</h1>
      <p class="subtitle">How well do you know Toronto's rapid transit map?</p>
      <div class="menu-modes">
        <button class="btn btn-primary" id="daily-btn">Daily Challenge</button>
        <button class="btn btn-primary" id="quickplay-btn">Quickplay</button>
        <button class="btn btn-primary" id="fillmap-btn">Fill The Map</button>
      </div>
    </div>
  `;
  container.querySelector<HTMLButtonElement>('#quickplay-btn')!.addEventListener('click', () => opts.onPlay('quickplay'));
  container.querySelector<HTMLButtonElement>('#daily-btn')!.addEventListener('click', () => opts.onPlay('daily'));
  container.querySelector<HTMLButtonElement>('#fillmap-btn')!.addEventListener('click', () => opts.onPlay('fill-map'));
}
