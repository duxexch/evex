import type { GameEngine, MoveData, ValidationResult, ApplyMoveResult, GameStatus, PlayerView, GameEvent } from './types';

interface PlayingCard {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

interface BalootState {
  phase: 'choosing' | 'playing' | 'finished';
  hands: { [playerId: string]: PlayingCard[] };
  currentTrick: { playerId: string; card: PlayingCard }[];
  gameType: 'sun' | 'hokm' | null;
  trumpSuit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | null;
  currentPlayer: string;
  playerOrder: string[];
  choosingPlayer: string;
  tricksWon: { team0: number; team1: number };
  roundPoints: { team0: number; team1: number };
  totalPoints: { team0: number; team1: number };
  projects: { playerId: string; project: string; points: number }[];
  dealerId: string;
  trickLeader: string;
  roundNumber: number;
  targetPoints: number;
  passCount: number;
  lastTrickWinner?: string;
}

const BALOOT_HOKM_VALUES: { [key: string]: number } = {
  'J': 20, '9': 14, 'A': 11, '10': 10, 'K': 4, 'Q': 3, '8': 0, '7': 0
};

const BALOOT_SUN_VALUES: { [key: string]: number } = {
  'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0, '8': 0, '7': 0
};

export class BalootEngine implements GameEngine {
  gameType = 'baloot';
  minPlayers = 4;
  maxPlayers = 4;

  createInitialState(): string {
    return JSON.stringify(this.createNewGame(['', '', '', ''], 152));
  }

  initializeWithPlayers(playerIds: string[], targetPoints: number = 152): string {
    return JSON.stringify(this.createNewGame(playerIds, targetPoints));
  }

  private createDeck(): PlayingCard[] {
    const suits: PlayingCard['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: PlayingCard[] = [];

    for (const suit of suits) {
      for (let i = 0; i < ranks.length; i++) {
        deck.push({ suit, rank: ranks[i], value: i });
      }
    }

    return deck;
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private createNewGame(playerIds: string[], targetPoints: number): BalootState {
    if (playerIds.length !== 4) {
      throw new Error('Baloot requires exactly 4 players');
    }

    const deck = this.shuffle(this.createDeck());
    const hands: { [playerId: string]: PlayingCard[] } = {};

    for (let i = 0; i < 4; i++) {
      hands[playerIds[i]] = deck.slice(i * 8, (i + 1) * 8);
    }

    return {
      phase: 'choosing',
      hands,
      currentTrick: [],
      gameType: null,
      trumpSuit: null,
      currentPlayer: playerIds[1],
      playerOrder: playerIds,
      choosingPlayer: playerIds[1],
      tricksWon: { team0: 0, team1: 0 },
      roundPoints: { team0: 0, team1: 0 },
      totalPoints: { team0: 0, team1: 0 },
      projects: [],
      dealerId: playerIds[0],
      trickLeader: playerIds[1],
      roundNumber: 1,
      targetPoints,
      passCount: 0,
    };
  }

  private getCardStrength(card: PlayingCard, gameType: 'sun' | 'hokm', trumpSuit: string | null, leadSuit: string): number {
    const values = gameType === 'hokm' && card.suit === trumpSuit ? BALOOT_HOKM_VALUES : BALOOT_SUN_VALUES;
    let value = values[card.rank] || 0;

    if (trumpSuit && card.suit === trumpSuit) {
      value += 100;
    } else if (card.suit === leadSuit) {
      value += 50;
    }

    return value;
  }

  private getCardPoints(card: PlayingCard, gameType: 'sun' | 'hokm', isTrump: boolean): number {
    const values = gameType === 'hokm' && isTrump ? BALOOT_HOKM_VALUES : BALOOT_SUN_VALUES;
    return values[card.rank] || 0;
  }

  validateMove(stateJson: string, playerId: string, move: MoveData): ValidationResult {
    try {
      const state: BalootState = JSON.parse(stateJson);

      if (state.phase === 'finished') {
        return { valid: false, error: 'Game is finished', errorKey: 'baloot.gameFinished' };
      }

      if (move.type === 'choose') {
        if (state.phase !== 'choosing') {
          return { valid: false, error: 'Not in choosing phase', errorKey: 'baloot.notChoosingPhase' };
        }
        if (state.choosingPlayer !== playerId) {
          return { valid: false, error: 'Not your turn to choose', errorKey: 'baloot.notYourTurn' };
        }
        const gameType = move.gameType as 'sun' | 'hokm';
        if (gameType === 'hokm' && !move.trumpSuit) {
          return { valid: false, error: 'Must specify trump suit for hokm', errorKey: 'baloot.mustSpecifyTrump' };
        }
        return { valid: true };
      }

      if (move.type === 'pass') {
        if (state.phase !== 'choosing') {
          return { valid: false, error: 'Not in choosing phase', errorKey: 'baloot.notChoosingPhase' };
        }
        if (state.choosingPlayer !== playerId) {
          return { valid: false, error: 'Not your turn', errorKey: 'baloot.notYourTurn' };
        }
        return { valid: true };
      }

      if (move.type === 'playCard') {
        if (state.phase !== 'playing') {
          return { valid: false, error: 'Not in playing phase', errorKey: 'baloot.notPlayingPhase' };
        }
        if (state.currentPlayer !== playerId) {
          return { valid: false, error: 'Not your turn', errorKey: 'baloot.notYourTurn' };
        }

        const card = typeof move.card === 'string' ? JSON.parse(move.card) : move.card;
        const hand = state.hands[playerId];
        const hasCard = hand.some(c => c.suit === card.suit && c.rank === card.rank);

        if (!hasCard) {
          return { valid: false, error: 'Card not in hand', errorKey: 'baloot.cardNotInHand' };
        }

        if (state.currentTrick.length > 0) {
          const leadSuit = state.currentTrick[0].card.suit;
          const hasSuit = hand.some(c => c.suit === leadSuit);

          if (hasSuit && card.suit !== leadSuit) {
            return { valid: false, error: 'Must follow suit', errorKey: 'baloot.mustFollowSuit' };
          }

          if (state.gameType === 'hokm' && !hasSuit && state.trumpSuit) {
            const hasTrump = hand.some(c => c.suit === state.trumpSuit);
            if (hasTrump && card.suit !== state.trumpSuit) {
              return { valid: false, error: 'Must play trump', errorKey: 'baloot.mustPlayTrump' };
            }
          }
        }

        return { valid: true };
      }

      return { valid: false, error: 'Invalid move type', errorKey: 'baloot.invalidMoveType' };
    } catch {
      return { valid: false, error: 'Invalid game state', errorKey: 'baloot.invalidState' };
    }
  }

  applyMove(stateJson: string, playerId: string, move: MoveData): ApplyMoveResult {
    try {
      const state: BalootState = JSON.parse(stateJson);
      const events: GameEvent[] = [];

      const validation = this.validateMove(stateJson, playerId, move);
      if (!validation.valid) {
        return { success: false, newState: stateJson, events: [], error: validation.error };
      }

      if (move.type === 'choose') {
        const gameType = move.gameType as 'sun' | 'hokm';
        state.phase = 'playing';
        state.gameType = gameType;
        state.trumpSuit = gameType === 'hokm' ? move.trumpSuit as BalootState['trumpSuit'] : null;
        state.currentPlayer = state.playerOrder[(state.playerOrder.indexOf(playerId) + 1) % 4];

        events.push({ type: 'move', data: { action: 'choose', playerId, gameType, trumpSuit: state.trumpSuit } });
        return { success: true, newState: JSON.stringify(state), events };
      }

      if (move.type === 'pass') {
        state.passCount++;
        const currentIndex = state.playerOrder.indexOf(playerId);
        const nextIndex = (currentIndex + 1) % 4;

        events.push({ type: 'move', data: { action: 'pass', playerId } });

        if (state.playerOrder[nextIndex] === state.dealerId || state.passCount >= 4) {
          state.phase = 'playing';
          state.gameType = 'sun';
          state.trumpSuit = null;
          state.currentPlayer = state.playerOrder[(state.playerOrder.indexOf(state.dealerId) + 1) % 4];
          events.push({ type: 'move', data: { action: 'forcedSun' } });
        } else {
          state.choosingPlayer = state.playerOrder[nextIndex];
          state.currentPlayer = state.playerOrder[nextIndex];
        }

        return { success: true, newState: JSON.stringify(state), events };
      }

      if (move.type === 'playCard') {
        const card = typeof move.card === 'string' ? JSON.parse(move.card) : move.card;
        const hand = state.hands[playerId];
        const cardIndex = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);

        state.hands[playerId] = hand.filter((_, i) => i !== cardIndex);
        state.currentTrick.push({ playerId, card });

        events.push({ type: 'move', data: { action: 'playCard', playerId, card } });

        if (state.currentTrick.length === 4) {
          const leadSuit = state.currentTrick[0].card.suit;
          let winnerIndex = 0;
          let highestValue = this.getCardStrength(state.currentTrick[0].card, state.gameType!, state.trumpSuit, leadSuit);
          let trickPoints = 0;

          for (let i = 0; i < 4; i++) {
            const c = state.currentTrick[i].card;
            const value = this.getCardStrength(c, state.gameType!, state.trumpSuit, leadSuit);
            if (value > highestValue) {
              highestValue = value;
              winnerIndex = i;
            }
            trickPoints += this.getCardPoints(c, state.gameType!, state.trumpSuit === c.suit);
          }

          const winnerId = state.currentTrick[winnerIndex].playerId;
          const winnerTeam = state.playerOrder.indexOf(winnerId) % 2;

          if (winnerTeam === 0) {
            state.tricksWon.team0++;
            state.roundPoints.team0 += trickPoints;
          } else {
            state.tricksWon.team1++;
            state.roundPoints.team1 += trickPoints;
          }

          state.lastTrickWinner = winnerId;
          state.currentTrick = [];
          state.currentPlayer = winnerId;
          state.trickLeader = winnerId;

          events.push({ type: 'win', data: { action: 'trickWon', winner: winnerId, team: winnerTeam, points: trickPoints } });

          if (state.tricksWon.team0 + state.tricksWon.team1 === 8) {
            if (winnerTeam === 0) {
              state.roundPoints.team0 += 10;
            } else {
              state.roundPoints.team1 += 10;
            }

            state.totalPoints.team0 += state.roundPoints.team0;
            state.totalPoints.team1 += state.roundPoints.team1;

            events.push({ type: 'score', data: { roundPoints: state.roundPoints, totalPoints: state.totalPoints } });

            if (state.totalPoints.team0 >= state.targetPoints || state.totalPoints.team1 >= state.targetPoints) {
              state.phase = 'finished';
              const winningTeam = state.totalPoints.team0 >= state.targetPoints ? 0 : 1;
              events.push({ type: 'game_over', data: { winningTeam, points: state.totalPoints } });
            } else {
              const nextDealerIndex = (state.playerOrder.indexOf(state.dealerId) + 1) % 4;
              const newOrder = [...state.playerOrder.slice(nextDealerIndex), ...state.playerOrder.slice(0, nextDealerIndex)];
              const newState = this.createNewGame(newOrder, state.targetPoints);
              newState.totalPoints = state.totalPoints;
              newState.roundNumber = state.roundNumber + 1;
              events.push({ type: 'move', data: { action: 'newRound', round: newState.roundNumber } });
              return { success: true, newState: JSON.stringify(newState), events };
            }
          }
        } else {
          const currentIndex = state.playerOrder.indexOf(playerId);
          state.currentPlayer = state.playerOrder[(currentIndex + 1) % 4];
        }

        return { success: true, newState: JSON.stringify(state), events };
      }

      return { success: false, newState: stateJson, events: [], error: 'Unknown move type' };
    } catch (error) {
      return { success: false, newState: stateJson, events: [], error: 'Failed to apply move' };
    }
  }

  getGameStatus(stateJson: string): GameStatus {
    try {
      const state: BalootState = JSON.parse(stateJson);
      const winningTeam = state.totalPoints.team0 >= state.targetPoints ? 0 :
                         state.totalPoints.team1 >= state.targetPoints ? 1 : undefined;
      return {
        isOver: state.phase === 'finished',
        winningTeam,
        teamScores: { team1: state.totalPoints.team0, team2: state.totalPoints.team1 },
        reason: state.phase === 'finished' ? 'targetReached' : undefined
      };
    } catch {
      return { isOver: false };
    }
  }

  getValidMoves(stateJson: string, playerId: string): MoveData[] {
    try {
      const state: BalootState = JSON.parse(stateJson);

      if (state.phase === 'finished') {
        return [];
      }

      if (state.phase === 'choosing') {
        if (state.choosingPlayer !== playerId) {
          return [];
        }
        const moves: MoveData[] = [{ type: 'pass' }];
        moves.push({ type: 'choose', gameType: 'sun' });
        for (const suit of ['hearts', 'diamonds', 'clubs', 'spades']) {
          moves.push({ type: 'choose', gameType: 'hokm', trumpSuit: suit });
        }
        return moves;
      }

      if (state.phase === 'playing' && state.currentPlayer === playerId) {
        const hand = state.hands[playerId];
        let playableCards = hand;

        if (state.currentTrick.length > 0) {
          const leadSuit = state.currentTrick[0].card.suit;
          const suitCards = hand.filter(c => c.suit === leadSuit);

          if (suitCards.length > 0) {
            playableCards = suitCards;
          } else if (state.gameType === 'hokm' && state.trumpSuit) {
            const trumpCards = hand.filter(c => c.suit === state.trumpSuit);
            if (trumpCards.length > 0) {
              playableCards = trumpCards;
            }
          }
        }

        return playableCards.map(card => ({ type: 'playCard', card: JSON.stringify(card) }));
      }

      return [];
    } catch {
      return [];
    }
  }

  getPlayerView(stateJson: string, playerId: string): PlayerView {
    try {
      const state: BalootState = JSON.parse(stateJson);
      const isPlayer = state.playerOrder.includes(playerId);
      const playerIndex = state.playerOrder.indexOf(playerId);
      const team = playerIndex !== -1 ? playerIndex % 2 : undefined;

      const otherHandCounts: { [id: string]: number } = {};
      for (const pid of state.playerOrder) {
        if (pid !== playerId) {
          otherHandCounts[pid] = state.hands[pid]?.length || 0;
        }
      }

      return {
        hand: isPlayer ? state.hands[playerId] : [],
        otherHandCounts,
        currentTrick: state.currentTrick,
        gameType: state.gameType,
        trumpSuit: state.trumpSuit,
        currentTurn: state.currentPlayer,
        isMyTurn: state.currentPlayer === playerId || state.choosingPlayer === playerId,
        gamePhase: state.phase,
        choosingPlayer: state.choosingPlayer,
        tricksWon: state.tricksWon,
        roundPoints: state.roundPoints,
        totalPoints: state.totalPoints,
        projects: state.projects,
        playerOrder: state.playerOrder,
        myTeam: team,
        partner: team !== undefined ? state.playerOrder[(playerIndex + 2) % 4] : undefined,
        trickLeader: state.trickLeader,
        roundNumber: state.roundNumber,
        targetPoints: state.targetPoints,
        validMoves: this.getValidMoves(stateJson, playerId),
        lastTrickWinner: state.lastTrickWinner
      };
    } catch {
      return { hand: undefined };
    }
  }
}

export const balootEngine = new BalootEngine();
