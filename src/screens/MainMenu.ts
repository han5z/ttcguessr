export interface MainMenuOptions {
  onQuickplay: () => void;
}

export function renderMainMenu(container: HTMLElement, opts: MainMenuOptions): void {
  container.innerHTML = `
    <div class="menu-screen">
      <h1>TTC Guessr</h1>
      <p class="subtitle">How well do you know Toronto's rapid transit map?</p>
      <button class="btn btn-primary" id="quickplay-btn">Quickplay</button>
    </div>
  `;
  container.querySelector<HTMLButtonElement>('#quickplay-btn')!.addEventListener('click', opts.onQuickplay);
}
