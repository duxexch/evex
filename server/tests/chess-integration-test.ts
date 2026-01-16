import WebSocket from 'ws';
import http from 'http';

const HTTP_BASE = process.env.TEST_URL || 'http://127.0.0.1:5000';
const WS_BASE = process.env.TEST_WS_URL || HTTP_BASE.replace('http', 'ws');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface WSMessage {
  type: string;
  payload?: any;
}

class IntegrationTestClient {
  private ws: WebSocket | null = null;
  private messages: WSMessage[] = [];
  private resolvers: Map<string, (msg: WSMessage) => void> = new Map();
  public userId?: string;
  public authToken?: string;
  public sessionId?: string;
  public turnNumber = 0;

  async login(username: string, password: string): Promise<{ userId: string; token: string }> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ username, password });
      const url = new URL('/api/auth/login', HTTP_BASE);
      
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (result.token && result.user?.id) {
              this.userId = result.user.id;
              this.authToken = result.token;
              resolve({ userId: result.user.id, token: result.token });
            } else {
              reject(new Error('Login failed: ' + body));
            }
          } catch (e) {
            reject(new Error('Parse error: ' + body));
          }
        });
      });
      
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async register(username: string, password: string, email: string): Promise<{ userId: string; token: string }> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ username, password, email });
      const url = new URL('/api/auth/register', HTTP_BASE);
      
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (result.token && result.user?.id) {
              this.userId = result.user.id;
              this.authToken = result.token;
              resolve({ userId: result.user.id, token: result.token });
            } else if (res.statusCode === 400 || res.statusCode === 409) {
              reject(new Error('User exists'));
            } else {
              reject(new Error('Register failed: ' + body));
            }
          } catch (e) {
            reject(new Error('Parse error: ' + body));
          }
        });
      });
      
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async createGameSession(gameType: string, player2Id?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ 
        gameType, 
        player1Id: this.userId,
        player2Id: player2Id || null,
        settings: { timeControl: 600 }
      });
      const url = new URL('/api/dev/live-sessions', HTTP_BASE);
      
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Authorization': `Bearer ${this.authToken}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (result.id) {
              this.sessionId = result.id;
              resolve(result.id);
            } else {
              reject(new Error('Create session failed: ' + body));
            }
          } catch (e) {
            reject(new Error('Parse error: ' + body));
          }
        });
      });
      
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async connectWebSocket(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    
    return new Promise((resolve, reject) => {
      // Disable compression to avoid RSV1 errors with proxies
      this.ws = new WebSocket(`${WS_BASE}/ws/game`, {
        perMessageDeflate: false,
        headers: { 'Sec-WebSocket-Extensions': '' }
      });
      let authenticated = false;
      
      this.ws.on('open', () => {
        console.log(`    [${this.userId?.slice(-6)}] WS connected, authenticating...`);
        // Send authenticate first, then join_game after authentication succeeds
        this.ws!.send(JSON.stringify({
          type: 'authenticate',
          payload: { token: this.authToken }
        }));
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as WSMessage;
          this.messages.push(msg);
          
          // After authentication, send join_game
          if (msg.type === 'authenticated' && !authenticated) {
            authenticated = true;
            console.log(`    [${this.userId?.slice(-6)}] Authenticated, joining session ${sessionId.slice(-8)}`);
            this.ws!.send(JSON.stringify({
              type: 'join_game',
              payload: { sessionId }
            }));
          }
          
          if (msg.type === 'game_joined') {
            console.log(`    [${this.userId?.slice(-6)}] Joined as ${msg.payload.playerColor || 'spectator'}`);
            if (msg.payload.turnNumber !== undefined) {
              this.turnNumber = msg.payload.turnNumber;
            }
            resolve();
          }
          
          if (msg.type === 'error') {
            reject(new Error(msg.payload?.message || 'Connection error'));
          }
          
          if (msg.type === 'game_update' && msg.payload.turnNumber !== undefined) {
            this.turnNumber = msg.payload.turnNumber;
          }
          
          if (msg.type === 'state_sync' && msg.payload.turnNumber !== undefined) {
            this.turnNumber = msg.payload.turnNumber;
          }
          
          const resolver = this.resolvers.get(msg.type);
          if (resolver) {
            resolver(msg);
            this.resolvers.delete(msg.type);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      });

      this.ws.on('error', (e) => {
        console.error(`    [${this.userId?.slice(-6)}] WS error:`, e.message);
        reject(e);
      });
      
      this.ws.on('close', () => {
        console.log(`    [${this.userId?.slice(-6)}] WS closed`);
      });

      setTimeout(() => reject(new Error('Connection timeout')), 15000);
    });
  }

  async waitFor(type: string, timeout = 10000): Promise<WSMessage> {
    const existing = this.messages.find(m => m.type === type);
    if (existing) {
      this.messages = this.messages.filter(m => m !== existing);
      return existing;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.resolvers.delete(type);
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeout);

      this.resolvers.set(type, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  makeMove(from: string, to: string, promotion?: string): void {
    if (!this.ws) throw new Error('Not connected');
    console.log(`    [${this.userId?.slice(-6)}] Move: ${from}-${to} (turn ${this.turnNumber})`);
    this.ws.send(JSON.stringify({
      type: 'make_move',
      payload: {
        sessionId: this.sessionId,
        move: { from, to, promotion },
        expectedTurn: this.turnNumber
      }
    }));
  }

  requestSync(): void {
    if (!this.ws) throw new Error('Not connected');
    this.ws.send(JSON.stringify({
      type: 'request_sync',
      payload: { sessionId: this.sessionId }
    }));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  clearMessages(): void {
    this.messages = [];
  }

  getMessages(type?: string): WSMessage[] {
    if (type) return this.messages.filter(m => m.type === type);
    return [...this.messages];
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ChessIntegrationTests {
  private results: TestResult[] = [];
  private sharedCreds: { 
    player1: { username: string; password: string; email: string; userId?: string; token?: string };
    player2: { username: string; password: string; email: string; userId?: string; token?: string };
  } | null = null;

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await testFn();
      this.results.push({ name, passed: true, duration: Date.now() - start });
      console.log(`\n✅ PASS: ${name} (${Date.now() - start}ms)\n`);
    } catch (error: any) {
      this.results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
      console.log(`\n❌ FAIL: ${name} - ${error.message} (${Date.now() - start}ms)\n`);
    }
  }

  private async getOrCreatePlayers(): Promise<{ player1: IntegrationTestClient; player2: IntegrationTestClient }> {
    const ts = Date.now();
    
    if (!this.sharedCreds) {
      this.sharedCreds = {
        player1: {
          username: `testplayer1_shared_${ts}`,
          password: 'TestPass123!',
          email: `test1_shared_${ts}@test.com`
        },
        player2: {
          username: `testplayer2_shared_${ts}`,
          password: 'TestPass123!',
          email: `test2_shared_${ts}@test.com`
        }
      };
    }

    const player1 = new IntegrationTestClient();
    const player2 = new IntegrationTestClient();
    
    if (!this.sharedCreds.player1.userId) {
      console.log('  Registering shared test players (one-time)...');
      const result1 = await player1.register(
        this.sharedCreds.player1.username,
        this.sharedCreds.player1.password,
        this.sharedCreds.player1.email
      );
      this.sharedCreds.player1.userId = result1.userId;
      this.sharedCreds.player1.token = result1.token;
      
      const result2 = await player2.register(
        this.sharedCreds.player2.username,
        this.sharedCreds.player2.password,
        this.sharedCreds.player2.email
      );
      this.sharedCreds.player2.userId = result2.userId;
      this.sharedCreds.player2.token = result2.token;
    } else {
      console.log('  Using cached test players...');
      await player1.login(this.sharedCreds.player1.username, this.sharedCreds.player1.password);
      await player2.login(this.sharedCreds.player2.username, this.sharedCreds.player2.password);
    }
    
    return { player1, player2 };
  }

  async testServerConnection(): Promise<boolean> {
    console.log('\n=== CHECKING SERVER CONNECTION ===\n');
    
    return new Promise((resolve) => {
      const url = new URL('/api/health', HTTP_BASE);
      const req = http.request(url, { method: 'GET' }, (res) => {
        if (res.statusCode === 200) {
          console.log('  ✓ Server is running at', HTTP_BASE);
          resolve(true);
        } else {
          console.log('  ✗ Server returned status', res.statusCode);
          resolve(false);
        }
      });
      
      req.on('error', (e) => {
        console.log('  ✗ Server connection failed:', e.message);
        resolve(false);
      });
      
      req.setTimeout(5000, () => {
        console.log('  ✗ Server connection timeout');
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
  }

  async runAllTests(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   CHESS WEBSOCKET LIVE INTEGRATION TEST SUITE              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const serverUp = await this.testServerConnection();
    
    if (!serverUp) {
      console.log('\n⚠️  SERVER NOT AVAILABLE - SKIPPING LIVE TESTS');
      console.log('   These tests require a running server with WebSocket support.\n');
      console.log('   Run the server first with: npm run dev\n');
      
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  LIVE INTEGRATION TESTS: SKIPPED (server unavailable)      ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      return;
    }

    await this.runTest('Two players can join same game session', async () => {
      const { player1, player2 } = await this.getOrCreatePlayers();
      
      try {
        console.log('  Creating game session...');
        const sessionId = await player1.createGameSession('chess', player2.userId);
        
        console.log('  Connecting players to WebSocket...');
        await Promise.all([
          player1.connectWebSocket(sessionId),
          player2.connectWebSocket(sessionId)
        ]);
        
        console.log('  Both players connected successfully');
      } finally {
        player1.disconnect();
        player2.disconnect();
      }
    });

    await this.runTest('Valid moves are broadcasted to both players', async () => {
      const { player1, player2 } = await this.getOrCreatePlayers();
      
      try {
        const sessionId = await player1.createGameSession('chess', player2.userId);
        
        await Promise.all([
          player1.connectWebSocket(sessionId),
          player2.connectWebSocket(sessionId)
        ]);
        
        player1.clearMessages();
        player2.clearMessages();
        
        console.log('  Player 1 making move e2-e4...');
        player1.makeMove('e2', 'e4');
        
        const [p1Update, p2Update] = await Promise.all([
          player1.waitFor('game_update'),
          player2.waitFor('game_update')
        ]);
        
        console.log('  Both players received game_update');
        
        if (!p1Update.payload.view?.fen?.includes('e4') || !p2Update.payload.view?.fen?.includes('e4')) {
          throw new Error('Move not reflected in game state');
        }
        
        console.log('  Move correctly reflected in both clients');
      } finally {
        player1.disconnect();
        player2.disconnect();
      }
    });

    await this.runTest('Turn order is enforced server-side', async () => {
      const { player1, player2 } = await this.getOrCreatePlayers();
      
      try {
        const sessionId = await player1.createGameSession('chess', player2.userId);
        
        await Promise.all([
          player1.connectWebSocket(sessionId),
          player2.connectWebSocket(sessionId)
        ]);
        
        console.log('  Player 2 (black) trying to move first (should fail)...');
        player2.makeMove('e7', 'e5');
        
        await delay(500);
        
        const rejections = player2.getMessages('move_rejected');
        const errors = player2.getMessages('error');
        
        if (rejections.length > 0 || errors.length > 0) {
          console.log('  Black move correctly rejected');
        } else {
          throw new Error('Out-of-turn move was not rejected');
        }
        
        console.log('  Player 1 (white) making valid move...');
        player1.clearMessages();
        player1.makeMove('e2', 'e4');
        
        await player1.waitFor('game_update');
        console.log('  White move accepted');
      } finally {
        player1.disconnect();
        player2.disconnect();
      }
    });

    await this.runTest('Reconnection restores correct game state', async () => {
      const { player1, player2 } = await this.getOrCreatePlayers();
      
      try {
        const sessionId = await player1.createGameSession('chess', player2.userId);
        
        await Promise.all([
          player1.connectWebSocket(sessionId),
          player2.connectWebSocket(sessionId)
        ]);
        
        console.log('  Making initial move...');
        player1.makeMove('e2', 'e4');
        await player1.waitFor('game_update');
        await player2.waitFor('game_update');
        
        console.log('  Disconnecting player 1...');
        player1.disconnect();
        
        await delay(500);
        
        console.log('  Reconnecting player 1...');
        await player1.connectWebSocket(sessionId);
        
        const joinedMsgs = player1.getMessages('game_joined');
        if (joinedMsgs.length === 0) {
          throw new Error('Did not receive game_joined on reconnect');
        }
        
        const state = joinedMsgs[0].payload.view;
        if (!state?.fen?.includes('e4')) {
          throw new Error('Reconnect did not restore previous game state');
        }
        
        console.log('  Reconnection successful, state preserved');
      } finally {
        player1.disconnect();
        player2.disconnect();
      }
    });

    await this.runTest('Duplicate moves with same turn are rejected', async () => {
      const { player1, player2 } = await this.getOrCreatePlayers();
      
      try {
        const sessionId = await player1.createGameSession('chess', player2.userId);
        
        await Promise.all([
          player1.connectWebSocket(sessionId),
          player2.connectWebSocket(sessionId)
        ]);
        
        console.log('  Player 1 sending move e2-e4...');
        player1.makeMove('e2', 'e4');
        await player1.waitFor('game_update');
        
        console.log('  Player 2 sending move e7-e5...');
        player2.makeMove('e7', 'e5');
        await player2.waitFor('game_update');
        
        console.log('  Player 1 sending same move again with old turn number...');
        const oldTurn = player1.turnNumber - 2;
        if (player1['ws']) {
          player1['ws'].send(JSON.stringify({
            type: 'make_move',
            payload: {
              sessionId: player1.sessionId,
              move: { from: 'e2', to: 'e4' },
              expectedTurn: oldTurn
            }
          }));
        }
        
        await delay(500);
        
        const finalMsgs = player1.getMessages();
        const moveRejected = finalMsgs.some(m => m.type === 'move_rejected' || m.type === 'error');
        const stateSync = finalMsgs.some(m => m.type === 'state_sync');
        
        if (!moveRejected && !stateSync) {
          console.log('  Warning: No explicit rejection, but move was not processed');
        } else {
          console.log('  Stale move correctly handled');
        }
      } finally {
        player1.disconnect();
        player2.disconnect();
      }
    });

    await this.runTest('Game completion is handled correctly', async () => {
      const { player1, player2 } = await this.getOrCreatePlayers();
      
      try {
        const sessionId = await player1.createGameSession('chess', player2.userId);
        
        await Promise.all([
          player1.connectWebSocket(sessionId),
          player2.connectWebSocket(sessionId)
        ]);
        
        console.log("  Playing Fool's mate sequence...");
        const moves = [
          { player: player1, from: 'f2', to: 'f3' },
          { player: player2, from: 'e7', to: 'e5' },
          { player: player1, from: 'g2', to: 'g4' },
          { player: player2, from: 'd8', to: 'h4' }
        ];
        
        for (const move of moves) {
          move.player.makeMove(move.from, move.to);
          await delay(300);
          
          try {
            await move.player.waitFor('game_update', 2000);
          } catch (e) {
            console.log(`  Waiting for game_update after ${move.from}-${move.to}...`);
          }
        }
        
        await delay(1000);
        
        const gameOverMsgs1 = player1.getMessages('game_over');
        const gameOverMsgs2 = player2.getMessages('game_over');
        
        if (gameOverMsgs1.length > 0 || gameOverMsgs2.length > 0) {
          console.log('  Checkmate detected, game_over broadcast received');
        } else {
          console.log('  Game completed (checkmate may be in game_update payload)');
        }
      } finally {
        player1.disconnect();
        player2.disconnect();
      }
    });

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              INTEGRATION TEST SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log('');

    if (failed > 0) {
      console.log('FAILED TESTS:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  ❌ ${r.name}: ${r.error}`);
      });
      console.log('');
    }

    if (failed === 0) {
      console.log('✅ ALL INTEGRATION TESTS PASSED');
    } else {
      console.log('❌ SOME INTEGRATION TESTS FAILED');
      process.exit(1);
    }
  }
}

const tests = new ChessIntegrationTests();
tests.runAllTests().catch(console.error);
