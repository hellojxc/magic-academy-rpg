import { ThreeAcademyGame } from './three/ThreeAcademyGame';

const container = document.getElementById('game-container');
if (!container) {
  throw new Error('Missing #game-container');
}

const game = new ThreeAcademyGame(container);
game.start();

if (typeof window !== 'undefined') {
  (window as unknown as { __game?: ThreeAcademyGame }).__game = game;
}

export { game };
