import type { GameEngine } from './types';
import { chessEngine } from './chess';

const engines: Map<string, GameEngine> = new Map();

engines.set('chess', chessEngine);

export function getGameEngine(gameType: string): GameEngine | undefined {
  return engines.get(gameType);
}

export function getSupportedGameTypes(): string[] {
  return Array.from(engines.keys());
}

export function registerGameEngine(engine: GameEngine): void {
  engines.set(engine.gameType, engine);
}

export * from './types';
export { chessEngine } from './chess';
