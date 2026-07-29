import './style.css';
import { renderMainMenu } from './screens/MainMenu';
import { renderQuickplay } from './screens/Quickplay';
import type { GameMode } from './game/state';

const app = document.getElementById('app')!;

function showMainMenu(): void {
  app.classList.remove('app--game');
  app.replaceChildren();
  renderMainMenu(app, { onPlay: showPlay });
}

function showPlay(mode: GameMode): void {
  app.classList.add('app--game');
  app.replaceChildren();
  void renderQuickplay(app, { mode, onHome: showMainMenu });
}

showMainMenu();
