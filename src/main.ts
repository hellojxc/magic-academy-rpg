import { ThreeAcademyGame } from './three/ThreeAcademyGame';
import { FpsCounter } from './ui/FpsCounter';

interface GameInstance {
  start(): void;
  destroy(): void;
  getDebugState?(): unknown;
  setFrameListener?(listener: ((now: number) => void) | null): void;
}

const container = document.getElementById('game-container');
if (!container) {
  throw new Error('Missing #game-container');
}

const fpsCounter = new FpsCounter(container, false);
const game = await createGame(container);
if (game.setFrameListener) {
  game.setFrameListener((now) => fpsCounter.frame(now));
} else {
  fpsCounter.start();
}
game.start();

if (typeof window !== 'undefined') {
  (window as unknown as { __game?: GameInstance }).__game = game;
  window.addEventListener('beforeunload', () => fpsCounter.destroy(), { once: true });
}

export { game };

async function createGame(target: HTMLElement): Promise<GameInstance> {
  const params = new URLSearchParams(window.location.search);
  if (params.get('renderer') === 'r3f') {
    const { R3FAcademyGame } = await import('./r3f/R3FAcademyGame');
    return new R3FAcademyGame(target);
  }
  return new ThreeAcademyGame(target);
}
