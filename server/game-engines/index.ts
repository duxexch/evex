import type { GameEngine } from './types';
import { chessEngine } from './chess';
import { backgammonEngine } from './backgammon';

const engines: Map<string, GameEngine> = new Map();

engines.set('chess', chessEngine);
engines.set('backgammon', backgammonEngine);

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
export { backgammonEngine } from './backgammon';
