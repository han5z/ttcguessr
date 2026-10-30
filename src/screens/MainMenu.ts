import type { GameMode } from '../game/state';

export interface MainMenuOptions {
  onPlay: (mode: GameMode) => void;
}

// Exported from the Canva mockup. Falls back to a CSS banner if missing.
const LOGO_URL = `${import.meta.env.BASE_URL}menu-logo.svg`;

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.3 5.71C17.91 5.32 17.28 5.32 16.89 5.71L12 10.59L7.10997 5.7C6.71997 5.31 6.08997 5.31 5.69997 5.7C5.30997 6.09 5.30997 6.72 5.69997 7.11L10.59 12L5.69997 16.89C5.30997 17.28 5.30997 17.91 5.69997 18.3C6.08997 18.69 6.71997 18.69 7.10997 18.3L12 13.41L16.89 18.3C17.28 18.69 17.91 18.69 18.3 18.3C18.69 17.91 18.69 17.28 18.3 16.89L13.41 12L18.3 7.11C18.68 6.73 18.68 6.09 18.3 5.71Z" fill="currentColor"/></svg>`;

export function renderMainMenu(container: HTMLElement, opts: MainMenuOptions): void {
  container.innerHTML = `
    <div class="menu-screen">
      <div class="menu-bg" aria-hidden="true"></div>
      <h1 class="menu-logo">
        <img class="menu-logo-img" src="${LOGO_URL}" alt="TTC Guessr" />
        <span class="menu-logo-fallback">TTC Guessr</span>
      </h1>
      <div class="menu-content">
        <div class="menu-modes">
          <button class="menu-mode-btn" id="daily-btn">Daily Challenge</button>
          <button class="menu-mode-btn" id="quickplay-btn">Quickplay</button>
          <button class="menu-mode-btn" id="fillmap-btn">Fill The Map</button>
        </div>
      </div>
      <button class="menu-mode-btn credits-btn" id="credits-btn" type="button">Credits</button>
      <div class="share-overlay credits-overlay" id="credits-overlay" hidden>
        <div class="share-modal">
          <button class="icon-btn share-modal-close" id="credits-close-btn" type="button" title="Close" aria-label="Close">${CLOSE_ICON}</button>
          <h3>Credits</h3>
          <div class="credits-body">
            <p>Website by <a href="https://www.linkedin.com/in/hansel-jia/" target="_blank" rel="noopener noreferrer">Hansel</a>.</p>
            <p>Map by <a href="https://commons.wikimedia.org/wiki/File:Toronto_rapid_transit_map_2026.svg" target="_blank" rel="noopener noreferrer">Transportfan70</a>.</p>
            <p>Inspired by <a href="https://mrt.ratgames.studio/" target="_blank" rel="noopener noreferrer">mrt.ratgames.studio</a>.</p>
            <p>Sound effects:</p>
            <ul>
              <li>Incorrect &mdash; Sound Effect by <a href="https://pixabay.com/users/universfield-28281460/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=206492" target="_blank" rel="noopener noreferrer">Universfield</a> from <a href="https://pixabay.com/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=206492" target="_blank" rel="noopener noreferrer">Pixabay</a></li>
              <li>Correct &mdash; Sound Effect by <a href="https://pixabay.com/users/freesound_gamestudio-49769582/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=394489" target="_blank" rel="noopener noreferrer">freesound_gamestudio</a> from <a href="https://pixabay.com/sound-effects/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=394489" target="_blank" rel="noopener noreferrer">Pixabay</a></li>
              <li>Game over &mdash; Sound Effect by <a href="https://pixabay.com/users/freesound_gamestudio-49769582/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=394521" target="_blank" rel="noopener noreferrer">freesound_gamestudio</a> from <a href="https://pixabay.com/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=394521" target="_blank" rel="noopener noreferrer">Pixabay</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
  const logo = container.querySelector<HTMLElement>('.menu-logo')!;
  logo.querySelector('img')!.addEventListener('error', () => logo.classList.add('menu-logo--fallback'));

  container.querySelector<HTMLButtonElement>('#quickplay-btn')!.addEventListener('click', () => opts.onPlay('quickplay'));
  container.querySelector<HTMLButtonElement>('#daily-btn')!.addEventListener('click', () => opts.onPlay('daily'));
  container.querySelector<HTMLButtonElement>('#fillmap-btn')!.addEventListener('click', () => opts.onPlay('fill-map'));

  const creditsOverlay = container.querySelector<HTMLElement>('#credits-overlay')!;
  container.querySelector<HTMLButtonElement>('#credits-btn')!.addEventListener('click', () => {
    creditsOverlay.hidden = false;
  });
  container.querySelector<HTMLButtonElement>('#credits-close-btn')!.addEventListener('click', () => {
    creditsOverlay.hidden = true;
  });
  creditsOverlay.addEventListener('click', (ev) => {
    if (ev.target === creditsOverlay) creditsOverlay.hidden = true;
  });
}
