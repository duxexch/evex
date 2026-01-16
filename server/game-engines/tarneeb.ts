import type { GameEngine, MoveData, ValidationResult, ApplyMoveResult, GameStatus, PlayerView, GameEvent } from './types';

interface PlayingCard {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

interface TarneebState {
  phase: 'bidding' | 'playing' | 'finished';
  hands: { [playerId: string]: PlayingCard[] };
  currentTrick: { playerId: string; card: PlayingCard }[];
  trumpSuit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | null;
  currentPlayer: string;
  playerOrder: string[];
  bids: { playerId: string; bid: number | null }[];
  highestBid: { playerId: string; bid: number } | null;
  biddingTeam: number | null;
  tricksWon: { team0: number; team1: number };
  roundScores: { team0: number; team1: number };
  totalScores: { team0: number; team1: number };
  dealerId: string;
  trickLeader: string;
  roundNumber: number;
  targetScore: number;
  lastTrickWinner?: string;
}

export class TarneebEngine implements GameEngine {
  gameType = 'tarneeb';
  minPlayers = 4;
  maxPlayers = 4;

  createInitialState(): string {
    return JSON.stringify(this.createNewGame(['', '', '', ''], 31));
  }

  initializeWithPlayers(playerIds: string[], targetScore: number = 31): string {
    return JSON.stringify(this.createNewGame(playerIds, targetScore));
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

  private createNewGame(playerIds: string[], targetScore: number): TarneebState {
    if (playerIds.length !== 4) {
      throw new Error('Tarneeb requires exactly 4 players');
    }

    const deck = this.shuffle(this.createDeck());
    const hands: { [playerId: string]: PlayingCard[] } = {};

    for (let i = 0; i < 4; i++) {
      hands[playerIds[i]] = deck.slice(i * 8, (i + 1) * 8);
    }

    return {
      phase: 'bidding',
      hands,
      currentTrick: [],
      trumpSuit: null,
      currentPlayer: playerIds[1],
      playerOrder: playerIds,
      bids: [],
      highestBid: null,
      biddingTeam: null,
      tricksWon: { team0: 0, team1: 0 },
      roundScores: { team0: 0, team1: 0 },
      totalScores: { team0: 0, team1: 0 },
      dealerId: playerIds[0],
      trickLeader: playerIds[1],
      roundNumber: 1,
      targetScore,
    };
  }

  private getCardValue(card: PlayingCard, trumpSuit: string | null, leadSuit: string): number {
    let value = card.value;
    if (trumpSuit && card.suit === trumpSuit) {
      value += 100;
    } else if (card.suit === leadSuit) {
      value += 50;
    }
    return value;
  }

  validateMove(stateJson: string, playerId: string, move: MoveData): ValidationResult {
    try {
      const state: TarneebState = JSON.parse(stateJson);

      if (state.phase === 'finished') {
        return { valid: false, error: 'Game is finished', errorKey: 'tarneeb.gameFinished' };
      }

      if (state.currentPlayer !== playerId) {
        return { valid: false, error: 'Not your turn', errorKey: 'tarneeb.notYourTurn' };
      }

      if (move.type === 'bid') {
        if (state.phase !== 'bidding') {
          return { valid: false, error: 'Not in bidding phase', errorKey: 'tarneeb.notBiddingPhase' };
        }
        const bid = move.bid as number | null;
        if (bid !== null) {
          if (bid < 7 || bid > 13) {
            return { valid: false, error: 'Bid must be between 7 and 13', errorKey: 'tarneeb.invalidBidRange' };
          }
          if (state.highestBid && bid <= state.highestBid.bid) {
            return { valid: false, error: 'Bid must be higher than current highest', errorKey: 'tarneeb.bidTooLow' };
          }
        }
        return { valid: true };
      }

      if (move.type === 'setTrump') {
        if (state.phase !== 'playing' || state.trumpSuit !== null) {
          return { valid: false, error: 'Cannot set trump now', errorKey: 'tarneeb.cannotSetTrump' };
        }
        if (!state.highestBid || state.highestBid.playerId !== playerId) {
          return { valid: false, error: 'Only winning bidder can set trump', errorKey: 'tarneeb.notBidWinner' };
        }
        return { valid: true };
      }

      if (move.type === 'playCard') {
        if (state.phase !== 'playing') {
          return { valid: false, error: 'Not in playing phase', errorKey: 'tarneeb.notPlayingPhase' };
        }
        if (!state.trumpSuit) {
          return { valid: false, error: 'Trump suit not set yet', errorKey: 'tarneeb.trumpNotSet' };
        }

        const card = typeof move.card === 'string' ? JSON.parse(move.card) : move.card;
        const hand = state.hands[playerId];
        const hasCard = hand.some(c => c.suit === card.suit && c.rank === card.rank);

        if (!hasCard) {
          return { valid: false, error: 'Card not in hand', errorKey: 'tarneeb.cardNotInHand' };
        }

        if (state.currentTrick.length > 0) {
          const leadSuit = state.currentTrick[0].card.suit;
          const hasSuit = hand.some(c => c.suit === leadSuit);
          if (hasSuit && card.suit !== leadSuit) {
            return { valid: false, error: 'Must follow suit', errorKey: 'tarneeb.mustFollowSuit' };
          }
        }

        return { valid: true };
      }

      return { valid: false, error: 'Invalid move type', errorKey: 'tarneeb.invalidMoveType' };
    } catch {
      return { valid: false, error: 'Invalid game state', errorKey: 'tarneeb.invalidState' };
    }
  }

  applyMove(stateJson: string, playerId: string, move: MoveData): ApplyMoveResult {
    try {
      const state: TarneebState = JSON.parse(stateJson);
      const events: GameEvent[] = [];

      const validation = this.validateMove(stateJson, playerId, move);
      if (!validation.valid) {
        return { success: false, newState: stateJson, events: [], error: validation.error };
      }

      if (move.type === 'bid') {
        const bid = move.bid as number | null;
        state.bids.push({ playerId, bid });
        if (bid !== null) {
          state.highestBid = { playerId, bid };
        }

        events.push({ type: 'move', data: { action: 'bid', playerId, bid } });

        const currentIndex = state.playerOrder.indexOf(playerId);
        state.currentPlayer = state.playerOrder[(currentIndex + 1) % 4];

        if (state.bids.length === 4) {
          if (!state.highestBid) {
            const newState = this.createNewGame(state.playerOrder, state.targetScore);
            newState.totalScores = state.totalScores;
            newState.roundNumber = state.roundNumber;
            events.push({ type: 'move', data: { action: 'redeal', reason: 'allPassed' } });
            return { success: true, newState: JSON.stringify(newState), events };
          }

          state.phase = 'playing';
          state.currentPlayer = state.highestBid.playerId;
          state.trickLeader = state.highestBid.playerId;
          state.biddingTeam = state.playerOrder.indexOf(state.highestBid.playerId) % 2;
          events.push({ type: 'move', data: { action: 'biddingComplete', winner: state.highestBid.playerId, bid: state.highestBid.bid } });
        }

        return { success: true, newState: JSON.stringify(state), events };
      }

      if (move.type === 'setTrump') {
        state.trumpSuit = move.suit as TarneebState['trumpSuit'];
        events.push({ type: 'move', data: { action: 'setTrump', playerId, suit: state.trumpSuit } });
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
          let highestValue = this.getCardValue(state.currentTrick[0].card, state.trumpSuit, leadSuit);

          for (let i = 1; i < 4; i++) {
            const value = this.getCardValue(state.currentTrick[i].card, state.trumpSuit, leadSuit);
            if (value > highestValue) {
              highestValue = value;
              winnerIndex = i;
            }
          }

          const winnerId = state.currentTrick[winnerIndex].playerId;
          const winnerTeam = state.playerOrder.indexOf(winnerId) % 2;

          if (winnerTeam === 0) {
            state.tricksWon.team0++;
          } else {
            state.tricksWon.team1++;
          }

          state.lastTrickWinner = winnerId;
          state.currentTrick = [];
          state.currentPlayer = winnerId;
          state.trickLeader = winnerId;

          events.push({ type: 'win', data: { action: 'trickWon', winner: winnerId, team: winnerTeam } });

          if (state.tricksWon.team0 + state.tricksWon.team1 === 8) {
            const biddingTeam = state.biddingTeam!;
            const biddingTeamTricks = biddingTeam === 0 ? state.tricksWon.team0 : state.tricksWon.team1;
            const bidValue = state.highestBid!.bid;

            if (biddingTeamTricks >= bidValue) {
              if (biddingTeam === 0) {
                state.roundScores.team0 = bidValue;
              } else {
                state.roundScores.team1 = bidValue;
              }
            } else {
              if (biddingTeam === 0) {
                state.roundScores.team0 = -bidValue;
                state.roundScores.team1 = 8 - biddingTeamTricks;
              } else {
                state.roundScores.team1 = -bidValue;
                state.roundScores.team0 = 8 - biddingTeamTricks;
              }
            }

            state.totalScores.team0 += state.roundScores.team0;
            state.totalScores.team1 += state.roundScores.team1;

            events.push({ type: 'score', data: { roundScores: state.roundScores, totalScores: state.totalScores } });

            if (state.totalScores.team0 >= state.targetScore || state.totalScores.team1 >= state.targetScore) {
              state.phase = 'finished';
              const winningTeam = state.totalScores.team0 >= state.targetScore ? 0 : 1;
              events.push({ type: 'game_over', data: { winningTeam, scores: state.totalScores } });
            } else {
              const nextDealerIndex = (state.playerOrder.indexOf(state.dealerId) + 1) % 4;
              const newOrder = [...state.playerOrder.slice(nextDealerIndex), ...state.playerOrder.slice(0, nextDealerIndex)];
              const newState = this.createNewGame(newOrder, state.targetScore);
              newState.totalScores = state.totalScores;
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
      const state: TarneebState = JSON.parse(stateJson);
      const winningTeam = state.totalScores.team0 >= state.targetScore ? 0 :
                         state.totalScores.team1 >= state.targetScore ? 1 : undefined;
      return {
        isOver: state.phase === 'finished',
        winningTeam,
        teamScores: { team1: state.totalScores.team0, team2: state.totalScores.team1 },
        reason: state.phase === 'finished' ? 'targetReached' : undefined
      };
    } catch {
      return { isOver: false };
    }
  }

  getValidMoves(stateJson: string, playerId: string): MoveData[] {
    try {
      const state: TarneebState = JSON.parse(stateJson);

      if (state.phase === 'finished' || state.currentPlayer !== playerId) {
        return [];
      }

      if (state.phase === 'bidding') {
        const moves: MoveData[] = [{ type: 'bid', bid: undefined }];
        const minBid = state.highestBid ? state.highestBid.bid + 1 : 7;
        for (let bid = minBid; bid <= 13; bid++) {
          moves.push({ type: 'bid', bid });
        }
        return moves;
      }

      if (state.phase === 'playing' && !state.trumpSuit && state.highestBid?.playerId === playerId) {
        return [
          { type: 'setTrump', suit: 'hearts' },
          { type: 'setTrump', suit: 'diamonds' },
          { type: 'setTrump', suit: 'clubs' },
          { type: 'setTrump', suit: 'spades' }
        ];
      }

      if (state.phase === 'playing' && state.trumpSuit) {
        const hand = state.hands[playerId];
        let playableCards = hand;

        if (state.currentTrick.length > 0) {
          const leadSuit = state.currentTrick[0].card.suit;
          const suitCards = hand.filter(c => c.suit === leadSuit);
          if (suitCards.length > 0) {
            playableCards = suitCards;
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
      const state: TarneebState = JSON.parse(stateJson);
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
        trumpSuit: state.trumpSuit,
        currentTurn: state.currentPlayer,
        isMyTurn: state.currentPlayer === playerId,
        gamePhase: state.phase,
        bids: state.bids,
        highestBid: state.highestBid,
        biddingTeam: state.biddingTeam,
        tricksWon: state.tricksWon,
        roundScores: state.roundScores,
        totalScores: state.totalScores,
        playerOrder: state.playerOrder,
        myTeam: team,
        partner: team !== undefined ? state.playerOrder[(playerIndex + 2) % 4] : undefined,
        trickLeader: state.trickLeader,
        roundNumber: state.roundNumber,
        targetScore: state.targetScore,
        validMoves: state.currentPlayer === playerId ? this.getValidMoves(stateJson, playerId) : [],
        lastTrickWinner: state.lastTrickWinner
      };
    } catch {
      return { hand: undefined };
    }
  }
}

export const tarneebEngine = new TarneebEngine();
