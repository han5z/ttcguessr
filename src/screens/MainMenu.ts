import type { GameMode } from '../game/state';

export interface MainMenuOptions {
  onPlay: (mode: GameMode) => void;
}

const MAP_URL = `${import.meta.env.BASE_URL}ttc-map.svg`;
const LABELS_URL = `${import.meta.env.BASE_URL}ttc-map-labels.svg`;

export function renderMainMenu(container: HTMLElement, opts: MainMenuOptions): void {
  container.innerHTML = `
    <div class="menu-screen">
      <div class="menu-bg" aria-hidden="true">
        <div class="menu-bg-track">
          <img class="menu-bg-img" src="${MAP_URL}" alt="" />
          <img class="menu-bg-img" src="${LABELS_URL}" alt="" />
        </div>
      </div>
      <div class="menu-content">
        <h1>TTC Guessr</h1>
        <p class="subtitle">How well do you know Toronto's rapid transit map?</p>
        <div class="menu-modes">
          <button class="btn btn-primary" id="daily-btn">Daily Challenge</button>
          <button class="btn btn-primary" id="quickplay-btn">Quickplay</button>
          <button class="btn btn-primary" id="fillmap-btn">Fill The Map</button>
        </div>
      </div>
    </div>
  `;
  container.querySelector<HTMLButtonElement>('#quickplay-btn')!.addEventListener('click', () => opts.onPlay('quickplay'));
  container.querySelector<HTMLButtonElement>('#daily-btn')!.addEventListener('click', () => opts.onPlay('daily'));
  container.querySelector<HTMLButtonElement>('#fillmap-btn')!.addEventListener('click', () => opts.onPlay('fill-map'));
}
