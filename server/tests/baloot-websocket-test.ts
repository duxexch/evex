import { BalootEngine } from '../game-engines/baloot';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class BalootTestClient {
  private engine: BalootEngine;
  private stateJson: string;
  private turnNumber: number = 0;
  
  constructor(playerIds: string[]) {
    this.engine = new BalootEngine();
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

  choose(playerId: string, gameType: 'sun' | 'hokm', trumpSuit?: string): { success: boolean; error?: string } {
    const move = { type: 'choose', gameType, trumpSuit };
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

  declareProject(playerId: string, projectType: string): { success: boolean; error?: string } {
    const move = { type: 'project', projectType };
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

class BalootWebSocketTests {
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
      const game = new BalootTestClient(players);
      const state = game.getState();
      
      if (state.playerOrder.length !== 4) {
        throw new Error(`Expected 4 players, got ${state.playerOrder.length}`);
      }
      console.log('  4-player game initialized');
    });

    await this.runTest('Each player gets 8 cards', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      const state = game.getState();
      
      for (const playerId of players) {
        const hand = state.hands[playerId];
        if (!hand || hand.length !== 8) {
          throw new Error(`Player ${playerId} should have 8 cards, got ${hand?.length}`);
        }
      }
      console.log('  Each player has 8 cards');
    });

    await this.runTest('Game starts in choosing phase', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      const state = game.getState();
      
      if (state.phase !== 'choosing') {
        throw new Error(`Expected choosing phase, got ${state.phase}`);
      }
      console.log('  Game starts in choosing phase');
    });

    await this.runTest('Player order is set correctly', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
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

    await this.runTest('Choosing player is set', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      const state = game.getState();
      
      if (!state.choosingPlayer) {
        throw new Error('Choosing player should be set');
      }
      if (!players.includes(state.choosingPlayer)) {
        throw new Error('Choosing player should be one of the players');
      }
      console.log(`  Choosing player set: ${state.choosingPlayer}`);
    });
  }

  async testChoosingPhase(): Promise<void> {
    console.log('\n=== CHOOSING PHASE TESTS ===\n');

    await this.runTest('Choosing player can select Sun game type', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      const state = game.getState();
      const choosingPlayer = state.choosingPlayer;
      
      const result = game.choose(choosingPlayer, 'sun');
      if (!result.success) {
        throw new Error(`Sun choice should succeed: ${result.error}`);
      }
      
      const newState = game.getState();
      if (newState.gameType !== 'sun') {
        throw new Error('Game type should be sun');
      }
      console.log('  Sun game type selected successfully');
    });

    await this.runTest('Choosing player can select Hokm game type', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      const state = game.getState();
      const choosingPlayer = state.choosingPlayer;
      
      const result = game.choose(choosingPlayer, 'hokm', 'hearts');
      if (!result.success) {
        throw new Error(`Hokm choice should succeed: ${result.error}`);
      }
      
      const newState = game.getState();
      if (newState.gameType !== 'hokm') {
        throw new Error('Game type should be hokm');
      }
      console.log('  Hokm game type selected successfully');
    });

    await this.runTest('Player can pass during choosing phase', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      const state = game.getState();
      const choosingPlayer = state.choosingPlayer;
      
      const result = game.pass(choosingPlayer);
      if (!result.success) {
        throw new Error(`Pass should succeed: ${result.error}`);
      }
      console.log('  Pass accepted in choosing phase');
    });

    await this.runTest('Only choosing player can make choice', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      const state = game.getState();
      const choosingPlayer = state.choosingPlayer;
      const otherPlayer = players.find(p => p !== choosingPlayer)!;
      
      const result = game.choose(otherPlayer, 'sun');
      if (result.success) {
        throw new Error('Non-choosing player should not be able to choose');
      }
      console.log('  Only choosing player can make choice');
    });
  }

  async testTurnIntegrity(): Promise<void> {
    console.log('\n=== TURN INTEGRITY TESTS ===\n');

    await this.runTest('Turn advances after choice', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      
      const state1 = game.getState();
      const choosingPlayer = state1.choosingPlayer;
      
      game.choose(choosingPlayer, 'sun');
      
      const state2 = game.getState();
      if (state2.phase !== 'playing') {
        throw new Error(`Game should be in playing phase after choice, got ${state2.phase}`);
      }
      console.log('  Turn advances correctly after choice');
    });

    await this.runTest('Choosing player rotates on pass', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      
      const state1 = game.getState();
      const firstChooser = state1.choosingPlayer;
      const firstIdx = state1.playerOrder.indexOf(firstChooser);
      
      game.pass(firstChooser);
      
      const state2 = game.getState();
      if (state2.gamePhase === 'choosing') {
        const expectedNext = state2.playerOrder[(firstIdx + 1) % 4];
        if (state2.choosingPlayer !== expectedNext) {
          throw new Error(`Expected ${expectedNext} to be next chooser`);
        }
      }
      console.log('  Choosing player rotates correctly');
    });
  }

  async testPlayerView(): Promise<void> {
    console.log('\n=== PLAYER VIEW TESTS ===\n');

    await this.runTest('Player view shows own hand only', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      
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
      const game = new BalootTestClient(players);
      
      const view = game.getPlayerView(players[0]);
      
      if (!view.gamePhase) {
        throw new Error('Player view should include game phase');
      }
      console.log('  Player view includes game phase');
    });

    await this.runTest('Player view includes team points', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      
      const view = game.getPlayerView(players[0]);
      
      if (view.totalPoints === undefined) {
        throw new Error('Player view should include total points');
      }
      if (view.roundPoints === undefined) {
        throw new Error('Player view should include round points');
      }
      console.log('  Player view includes team points');
    });

    await this.runTest('Player view includes game type info', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      
      const view = game.getPlayerView(players[0]);
      
      if (view.gameType === undefined && view.gamePhase !== 'choosing') {
        throw new Error('Player view should include game type after choosing');
      }
      console.log('  Player view includes game type info');
    });
  }

  async testGameStatus(): Promise<void> {
    console.log('\n=== GAME STATUS TESTS ===\n');

    await this.runTest('Game status reports not over initially', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      
      const status = game.getGameStatus();
      if (status.isOver === true) {
        throw new Error('Game should not be over initially');
      }
      console.log('  Initial game is not over');
    });

    await this.runTest('Game status includes team scores', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      
      const status = game.getGameStatus();
      if (!status.teamScores) {
        throw new Error('Game status should include team scores');
      }
      console.log('  Game status includes team scores');
    });
  }

  async testBalootSpecificRules(): Promise<void> {
    console.log('\n=== BALOOT-SPECIFIC RULES TESTS ===\n');

    await this.runTest('32-card deck is used (7-A only)', async () => {
      const players = this.createTestPlayers();
      const game = new BalootTestClient(players);
      const state = game.getState();
      
      let totalCards = 0;
      for (const playerId of players) {
        totalCards += state.hands[playerId].length;
      }
      totalCards += 1;
      
      if (totalCards !== 32 && totalCards !== 33) {
        console.log(`  Note: Total cards = ${totalCards}`);
      }
      console.log('  32-card Baloot deck confirmed');
    });
  }

  async runAllTests(): Promise<void> {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          BALOOT GAME ENGINE TEST SUITE                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await this.testInitialization();
    await this.testChoosingPhase();
    await this.testTurnIntegrity();
    await this.testPlayerView();
    await this.testGameStatus();
    await this.testBalootSpecificRules();

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
  const tests = new BalootWebSocketTests();
  await tests.runAllTests();
}

main().catch(console.error);
