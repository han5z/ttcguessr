import './style.css';
import { renderMainMenu } from './screens/MainMenu';
import { renderQuickplay } from './screens/Quickplay';
import { renderResults } from './screens/Results';
import type { GameSession } from './game/state';

const app = document.getElementById('app')!;

function showMainMenu(): void {
  app.classList.remove('app--game');
  app.replaceChildren();
  renderMainMenu(app, { onQuickplay: showQuickplay });
}

function showQuickplay(): void {
  app.classList.add('app--game');
  app.replaceChildren();
  void renderQuickplay(app, { onFinish: showResults });
}

function showResults(session: GameSession): void {
  app.classList.remove('app--game');
  app.replaceChildren();
  renderResults(app, session, { onPlayAgain: showMainMenu });
}

showMainMenu();
