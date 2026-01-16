import { DominoEngine } from '../game-engines/domino';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class DominoTestClient {
  private engine: DominoEngine;
  private stateJson: string;
  private turnNumber: number = 0;
  
  constructor(playerIds: string[]) {
    this.engine = new DominoEngine();
    this.stateJson = this.engine.initializeWithPlayers(playerIds);
  }

  getState(): any {
    return JSON.parse(this.stateJson);
  }

  getStateJson(): string {
    return this.stateJson;
  }

  getTurnNumber(): number {
    return this.turnNumber;
  }

  placeTile(playerId: string, tileLeft: number, tileRight: number, end: 'left' | 'right'): { success: boolean; error?: string } {
    const move = { type: 'place', tileLeft, tileRight, end };
    const validation = this.engine.validateMove(this.stateJson, playerId, move);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const result = this.engine.applyMove(this.stateJson, playerId, move);
    if (result.success) {
      this.stateJson = result.newState;
      this.turnNumber++;
      return { success: true };
    }
    return { success: false, error: result.error };
  }

  draw(playerId: string): { success: boolean; tile?: { left: number; right: number }; error?: string } {
    const move = { type: 'draw' };
    const validation = this.engine.validateMove(this.stateJson, playerId, move);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const result = this.engine.applyMove(this.stateJson, playerId, move);
    if (result.success) {
      this.stateJson = result.newState;
      this.turnNumber++;
      return { success: true };
    }
    return { success: false, error: result.error };
  }

  pass(playerId: string): { success: boolean; error?: string } {
    const move = { type: 'pass' };
    const validation = this.engine.validateMove(this.stateJson, playerId, move);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const result = this.engine.applyMove(this.stateJson, playerId, move);
    if (result.success) {
      this.stateJson = result.newState;
      this.turnNumber++;
      return { success: true };
    }
    return { success: false, error: result.error };
  }

  getValidMoves(playerId: string): any[] {
    return this.engine.getValidMoves(this.stateJson, playerId);
  }

  getGameStatus(): any {
    return this.engine.getGameStatus(this.stateJson);
  }

  loadState(stateJson: string): void {
    this.stateJson = stateJson;
  }

  getPlayerView(playerId: string): any {
    return this.engine.getPlayerView(this.stateJson, playerId);
  }
}

class DominoWebSocketTests {
  private results: TestResult[] = [];
  private testCounter = 0;

  private createTestPlayers(count: number = 2): string[] {
    this.testCounter++;
    return Array.from({ length: count }, (_, i) => `player-${i + 1}-${this.testCounter}-${Date.now()}`);
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await testFn();
      this.results.push({ name, passed: true, duration: Date.now() - start });
      console.log(`✅ PASS: ${name} (${Date.now() - start}ms)`);
    } catch (error: any) {
      this.results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
      console.log(`❌ FAIL: ${name} - ${error.message} (${Date.now() - start}ms)`);
    }
  }

  async testInitialization(): Promise<void> {
    console.log('\n=== INITIALIZATION TESTS ===\n');

    await this.runTest('Game initializes with 2 players correctly', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      const state = game.getState();
      
      if (state.playerOrder.length !== 2) {
        throw new Error(`Expected 2 players, got ${state.playerOrder.length}`);
      }
      if (!state.hands || Object.keys(state.hands).length !== 2) {
        throw new Error('Hands not initialized for all players');
      }
      if (state.boneyard.length !== 28 - 14) {
        throw new Error(`Expected 14 tiles in boneyard, got ${state.boneyard.length}`);
      }
      console.log('  2-player game initialized correctly');
    });

    await this.runTest('Game initializes with 4 players correctly', async () => {
      const players = this.createTestPlayers(4);
      const game = new DominoTestClient(players);
      const state = game.getState();
      
      if (state.playerOrder.length !== 4) {
        throw new Error(`Expected 4 players, got ${state.playerOrder.length}`);
      }
      const totalTiles = Object.values(state.hands as Record<string, any[]>).reduce((sum: number, hand: any[]) => sum + hand.length, 0);
      if (totalTiles !== 28) {
        throw new Error(`Expected 28 tiles dealt, got ${totalTiles}`);
      }
      console.log('  4-player game initialized correctly with all tiles dealt');
    });

    await this.runTest('Each player gets 7 tiles in 2-player game', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      const state = game.getState();
      
      for (const playerId of players) {
        const hand = state.hands[playerId];
        if (!hand || hand.length !== 7) {
          throw new Error(`Player ${playerId} should have 7 tiles, got ${hand?.length}`);
        }
      }
      console.log('  Each player has 7 tiles');
    });
  }

  async testTurnIntegrity(): Promise<void> {
    console.log('\n=== TURN INTEGRITY TESTS ===\n');

    await this.runTest('Only current player can make a move', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      const state = game.getState();
      const currentPlayer = state.currentTurn;
      const otherPlayer = players.find(p => p !== currentPlayer)!;
      
      const otherHand = state.hands[otherPlayer];
      if (otherHand && otherHand.length > 0) {
        const tile = otherHand[0];
        const result = game.placeTile(otherPlayer, tile.left, tile.right, 'right');
        if (result.success) {
          throw new Error('Non-current player should not be able to move');
        }
      }
      console.log('  Turn order correctly enforced');
    });

    await this.runTest('Turn advances after valid move', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      
      const state1 = game.getState();
      const currentPlayer = state1.currentTurn;
      const validMoves = game.getValidMoves(currentPlayer);
      
      if (validMoves.length > 0) {
        const move = validMoves[0];
        if (move.type === 'place') {
          game.placeTile(currentPlayer, move.tileLeft, move.tileRight, move.end);
        } else if (move.type === 'draw') {
          game.draw(currentPlayer);
        }
        
        const state2 = game.getState();
        if (state2.currentTurn === currentPlayer && state2.gamePhase !== 'finished') {
          throw new Error('Turn should advance after valid move');
        }
      }
      console.log('  Turn advances correctly');
    });
  }

  async testMoveValidation(): Promise<void> {
    console.log('\n=== MOVE VALIDATION TESTS ===\n');

    await this.runTest('Cannot place tile player does not have', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      const state = game.getState();
      const currentPlayer = state.currentTurn;
      
      const result = game.placeTile(currentPlayer, 99, 99, 'right');
      if (result.success) {
        throw new Error('Should not be able to place tile not in hand');
      }
      console.log('  Invalid tile placement rejected');
    });

    await this.runTest('Valid moves are returned for current player', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      const state = game.getState();
      const currentPlayer = state.currentTurn;
      
      const validMoves = game.getValidMoves(currentPlayer);
      console.log(`  Valid moves calculated: ${validMoves.length} options`);
    });
  }

  async testBoneyardMechanics(): Promise<void> {
    console.log('\n=== BONEYARD MECHANICS TESTS ===\n');

    await this.runTest('Boneyard exists in 2-player game', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      const state = game.getState();
      
      if (!state.boneyard || !Array.isArray(state.boneyard)) {
        throw new Error('Boneyard should exist');
      }
      console.log(`  Boneyard has ${state.boneyard.length} tiles`);
    });
  }

  async testPlayerView(): Promise<void> {
    console.log('\n=== PLAYER VIEW TESTS ===\n');

    await this.runTest('Player view hides opponent hands', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      
      const view = game.getPlayerView(players[0]);
      
      if (!view.hand) {
        throw new Error('Player should see their own hand');
      }
      if (!view.otherHandCounts) {
        throw new Error('Player should see opponent hand counts');
      }
      if (view.hands) {
        throw new Error('Player should not see full hands object');
      }
      console.log('  Player view correctly hides opponent hands');
    });

    await this.runTest('Player view includes board state', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      
      const view = game.getPlayerView(players[0]);
      
      if (view.board === undefined) {
        throw new Error('Player view should include board');
      }
      if (view.boneyardCount === undefined) {
        throw new Error('Player view should include boneyard count');
      }
      console.log('  Player view includes all required state');
    });
  }

  async testGameStatus(): Promise<void> {
    console.log('\n=== GAME STATUS TESTS ===\n');

    await this.runTest('Game status reports not over initially', async () => {
      const players = this.createTestPlayers(2);
      const game = new DominoTestClient(players);
      
      const status = game.getGameStatus();
      if (status.isOver === true) {
        throw new Error('Game should not be over initially');
      }
      console.log('  Initial game is not over');
    });
  }

  async runAllTests(): Promise<void> {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          DOMINO GAME ENGINE TEST SUITE                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await this.testInitialization();
    await this.testTurnIntegrity();
    await this.testMoveValidation();
    await this.testBoneyardMechanics();
    await this.testPlayerView();
    await this.testGameStatus();

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST RESULTS SUMMARY                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('Failed Tests:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }

    console.log('\n════════════════════════════════════════════════════════════════\n');
  }
}

async function main() {
  const tests = new DominoWebSocketTests();
  await tests.runAllTests();
}

main().catch(console.error);
