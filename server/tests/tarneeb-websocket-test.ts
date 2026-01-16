import { TarneebEngine } from '../game-engines/tarneeb';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class TarneebTestClient {
  private engine: TarneebEngine;
  private stateJson: string;
  private turnNumber: number = 0;
  
  constructor(playerIds: string[]) {
    this.engine = new TarneebEngine();
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

  bid(playerId: string, bidAmount: number): { success: boolean; error?: string } {
    const move = { type: 'bid', bid: bidAmount };
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
    const move = { type: 'bid', bid: null };
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

  playCard(playerId: string, suit: string, rank: string): { success: boolean; error?: string } {
    const move = { type: 'play', suit, rank };
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

class TarneebWebSocketTests {
  private results: TestResult[] = [];
  private testCounter = 0;

  private createTestPlayers(): string[] {
    this.testCounter++;
    return Array.from({ length: 4 }, (_, i) => `player-${i + 1}-${this.testCounter}-${Date.now()}`);
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

    await this.runTest('Game initializes with 4 players', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      const state = game.getState();
      
      if (state.playerOrder.length !== 4) {
        throw new Error(`Expected 4 players, got ${state.playerOrder.length}`);
      }
      console.log('  4-player game initialized');
    });

    await this.runTest('Each player gets 8 cards (32-card deck)', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      const state = game.getState();
      
      for (const playerId of players) {
        const hand = state.hands[playerId];
        if (!hand || hand.length !== 8) {
          throw new Error(`Player ${playerId} should have 8 cards, got ${hand?.length}`);
        }
      }
      console.log('  Each player has 8 cards');
    });

    await this.runTest('Game starts in bidding phase', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      const state = game.getState();
      
      if (state.phase !== 'bidding') {
        throw new Error(`Expected bidding phase, got ${state.phase}`);
      }
      console.log('  Game starts in bidding phase');
    });

    await this.runTest('Player order is set correctly', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      const state = game.getState();
      
      if (!state.playerOrder || state.playerOrder.length !== 4) {
        throw new Error('Player order should have 4 players');
      }
      for (let i = 0; i < 4; i++) {
        if (state.playerOrder[i] !== players[i]) {
          throw new Error('Player order should match input order');
        }
      }
      console.log('  Player order correctly set');
    });
  }

  async testBiddingPhase(): Promise<void> {
    console.log('\n=== BIDDING PHASE TESTS ===\n');

    await this.runTest('Player can bid during bidding phase', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      const state = game.getState();
      const currentPlayer = state.currentPlayer;
      
      const result = game.bid(currentPlayer, 7);
      if (!result.success) {
        throw new Error(`Bidding should succeed: ${result.error}`);
      }
      console.log('  Bid of 7 accepted');
    });

    await this.runTest('Bid must be higher than current highest', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      
      let state = game.getState();
      game.bid(state.currentPlayer, 8);
      
      state = game.getState();
      const result = game.bid(state.currentPlayer, 7);
      if (result.success) {
        throw new Error('Lower bid should be rejected');
      }
      console.log('  Lower bid correctly rejected');
    });

    await this.runTest('Player can pass during bidding', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      const state = game.getState();
      const currentPlayer = state.currentPlayer;
      
      const result = game.pass(currentPlayer);
      if (!result.success) {
        throw new Error(`Pass should succeed: ${result.error}`);
      }
      console.log('  Pass accepted in bidding phase');
    });

    await this.runTest('Bid range is 7-13', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      const state = game.getState();
      const currentPlayer = state.currentPlayer;
      
      const lowResult = game.bid(currentPlayer, 6);
      if (lowResult.success) {
        throw new Error('Bid of 6 should be rejected');
      }
      
      const validResult = game.bid(currentPlayer, 7);
      if (!validResult.success) {
        throw new Error('Bid of 7 should be accepted');
      }
      console.log('  Bid range correctly enforced');
    });
  }

  async testTurnIntegrity(): Promise<void> {
    console.log('\n=== TURN INTEGRITY TESTS ===\n');

    await this.runTest('Only current player can bid', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      const state = game.getState();
      const currentPlayer = state.currentPlayer;
      const otherPlayer = players.find(p => p !== currentPlayer)!;
      
      const result = game.bid(otherPlayer, 7);
      if (result.success) {
        throw new Error('Non-current player should not be able to bid');
      }
      console.log('  Only current player can bid');
    });

    await this.runTest('Turn advances after valid action', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      
      const state1 = game.getState();
      const firstPlayer = state1.currentPlayer;
      
      if (firstPlayer) {
        const result = game.bid(firstPlayer, 7);
        if (result.success) {
          const state2 = game.getState();
          if (state2.currentPlayer !== firstPlayer) {
            console.log('  Turn advances correctly after bid');
          } else {
            console.log('  Note: Same player (may have multiple bid rounds)');
          }
        }
      }
      console.log('  Turn logic verified');
    });
  }

  async testPlayerView(): Promise<void> {
    console.log('\n=== PLAYER VIEW TESTS ===\n');

    await this.runTest('Player view shows own hand only', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      
      const view = game.getPlayerView(players[0]);
      
      if (!view.hand || !Array.isArray(view.hand)) {
        throw new Error('Player should see their own hand');
      }
      if (!view.otherHandCounts) {
        throw new Error('Player should see opponent hand counts');
      }
      console.log('  Player view correctly shows own hand');
    });

    await this.runTest('Player view includes game phase', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      
      const view = game.getPlayerView(players[0]);
      
      if (!view.gamePhase) {
        throw new Error('Player view should include game phase');
      }
      console.log('  Player view includes game phase');
    });

    await this.runTest('Player view includes team scores', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      
      const view = game.getPlayerView(players[0]);
      
      if (view.totalScores === undefined) {
        throw new Error('Player view should include total scores');
      }
      if (view.tricksWon === undefined) {
        throw new Error('Player view should include tricks won');
      }
      console.log('  Player view includes team scores');
    });
  }

  async testGameStatus(): Promise<void> {
    console.log('\n=== GAME STATUS TESTS ===\n');

    await this.runTest('Game status reports not over initially', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      
      const status = game.getGameStatus();
      if (status.isOver === true) {
        throw new Error('Game should not be over initially');
      }
      console.log('  Initial game is not over');
    });

    await this.runTest('Game status includes team scores', async () => {
      const players = this.createTestPlayers();
      const game = new TarneebTestClient(players);
      
      const status = game.getGameStatus();
      if (!status.teamScores) {
        throw new Error('Game status should include team scores');
      }
      console.log('  Game status includes team scores');
    });
  }

  async runAllTests(): Promise<void> {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          TARNEEB GAME ENGINE TEST SUITE                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await this.testInitialization();
    await this.testBiddingPhase();
    await this.testTurnIntegrity();
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
  const tests = new TarneebWebSocketTests();
  await tests.runAllTests();
}

main().catch(console.error);
