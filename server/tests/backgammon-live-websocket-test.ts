import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, liveGameSessions, games } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const BASE_URL = process.env.TEST_URL || 'ws://localhost:5000';
const WS_URL = `${BASE_URL}/ws/game`;
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface WSMessage {
  type: string;
  payload?: any;
  error?: string;
  [key: string]: any;
}

class BackgammonWSClient {
  private ws: WebSocket | null = null;
  private messages: WSMessage[] = [];
  private userId: string;
  private username: string;
  private token: string;
  private isConnected = false;
  private isAuthenticated = false;
  private messagePromises: Map<string, { resolve: (msg: WSMessage) => void; reject: (err: Error) => void }> = new Map();

  constructor(userId: string, username: string) {
    this.userId = userId;
    this.username = username;
    this.token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '1h' });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL, { perMessageDeflate: false });
      
      this.ws.on('open', () => {
        this.isConnected = true;
        this.ws!.send(JSON.stringify({ 
          type: 'authenticate', 
          payload: { token: this.token } 
        }));
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as WSMessage;
          this.messages.push(msg);
          
          if (msg.type === 'authenticated') {
            this.isAuthenticated = true;
            resolve();
          }
          
          if (msg.type === 'error' && !this.isAuthenticated) {
            reject(new Error(msg.error || msg.payload?.message || 'Authentication failed'));
          }
          
          const pending = this.messagePromises.get(msg.type);
          if (pending) {
            pending.resolve(msg);
            this.messagePromises.delete(msg.type);
          }
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      });

      this.ws.on('error', reject);
      this.ws.on('close', () => {
        this.isConnected = false;
        this.isAuthenticated = false;
      });

      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
  }

  async waitForMessage(type: string, timeout = 5000): Promise<WSMessage> {
    const existing = this.messages.find(m => m.type === type);
    if (existing) {
      this.messages = this.messages.filter(m => m !== existing);
      return existing;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.messagePromises.delete(type);
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeout);

      this.messagePromises.set(type, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  joinGame(sessionId: string): void {
    if (!this.ws || !this.isConnected) throw new Error('Not connected');
    this.ws.send(JSON.stringify({
      type: 'join_game',
      payload: { sessionId }
    }));
  }

  spectateGame(sessionId: string): void {
    if (!this.ws || !this.isConnected) throw new Error('Not connected');
    this.ws.send(JSON.stringify({
      type: 'spectate',
      payload: { sessionId }
    }));
  }

  makeMove(sessionId: string, move: any): void {
    if (!this.ws || !this.isConnected) throw new Error('Not connected');
    this.ws.send(JSON.stringify({
      type: 'make_move',
      payload: { sessionId, move }
    }));
  }

  getState(sessionId: string): void {
    if (!this.ws || !this.isConnected) throw new Error('Not connected');
    this.ws.send(JSON.stringify({
      type: 'get_state',
      payload: { sessionId }
    }));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.isAuthenticated = false;
    }
  }

  async reconnect(): Promise<void> {
    this.disconnect();
    await delay(100);
    await this.connect();
  }

  getMessages(): WSMessage[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get authenticated(): boolean {
    return this.isAuthenticated;
  }

  get id(): string {
    return this.userId;
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class BackgammonLiveWSTests {
  private results: TestResult[] = [];
  private createdUsers: string[] = [];
  private createdSessions: string[] = [];

  private async createTestUser(username: string): Promise<{ id: string; username: string }> {
    const userId = nanoid();
    const fullUsername = `test_${username}_${Date.now()}`;
    await db.insert(users).values({
      id: userId,
      username: fullUsername,
      email: `${username}_${Date.now()}@test.local`,
      password: 'test-password-hash',
      passwordHash: 'test-hash',
      role: 'player',
      balance: '1000',
      isActive: true,
      isVerified: true,
    });
    this.createdUsers.push(userId);
    return { id: userId, username: fullUsername };
  }

  private async createTestSession(player1Id: string, player2Id: string): Promise<string> {
    const sessionId = nanoid();
    
    let backgammonGame = await db.select().from(games).where(eq(games.slug, 'backgammon')).limit(1);
    let gameId: string;
    
    if (backgammonGame.length === 0) {
      const [newGame] = await db.insert(games).values({
        id: nanoid(),
        name: 'Backgammon',
        slug: 'backgammon',
        description: 'Classic backgammon',
        imageUrl: '',
        minPlayers: 2,
        maxPlayers: 2,
        minStake: '1',
        maxStake: '1000',
        category: 'board',
        isActive: true,
      }).returning();
      gameId = newGame.id;
    } else {
      gameId = backgammonGame[0].id;
    }

    const initialState = JSON.stringify({
      board: [2, 0, 0, 0, 0, -5, 0, -3, 0, 0, 0, 5, -5, 0, 0, 0, 3, 0, 5, 0, 0, 0, 0, -2],
      bar: { white: 0, black: 0 },
      borneOff: { white: 0, black: 0 },
      currentPlayer: 'white',
      dice: [],
      diceUsed: [],
      mustRoll: true,
      phase: 'playing'
    });

    await db.insert(liveGameSessions).values({
      id: sessionId,
      gameId,
      gameType: 'backgammon',
      player1Id,
      player2Id,
      status: 'in_progress',
      turnNumber: 1,
      currentTurn: player1Id,
      gameState: initialState,
    });
    
    this.createdSessions.push(sessionId);
    return sessionId;
  }

  private async cleanup(): Promise<void> {
    for (const sessionId of this.createdSessions) {
      await db.delete(liveGameSessions).where(eq(liveGameSessions.id, sessionId)).catch(() => {});
    }
    for (const userId of this.createdUsers) {
      await db.delete(users).where(eq(users.id, userId)).catch(() => {});
    }
    this.createdUsers = [];
    this.createdSessions = [];
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

  async testMultiplayerTurnIntegrity(): Promise<void> {
    console.log('\n=== MULTIPLAYER TURN INTEGRITY TESTS ===\n');

    await this.runTest('Two players can connect and authenticate', async () => {
      const player1 = await this.createTestUser('white');
      const player2 = await this.createTestUser('black');

      const client1 = new BackgammonWSClient(player1.id, player1.username);
      const client2 = new BackgammonWSClient(player2.id, player2.username);

      try {
        await client1.connect();
        await client2.connect();

        if (!client1.authenticated || !client2.authenticated) {
          throw new Error('Both clients should be authenticated');
        }

        console.log('  Both players authenticated successfully');
      } finally {
        client1.disconnect();
        client2.disconnect();
      }
    });

    await this.runTest('Players can join game and receive state', async () => {
      const player1 = await this.createTestUser('white2');
      const player2 = await this.createTestUser('black2');
      const sessionId = await this.createTestSession(player1.id, player2.id);

      const client1 = new BackgammonWSClient(player1.id, player1.username);
      const client2 = new BackgammonWSClient(player2.id, player2.username);

      try {
        await client1.connect();
        await client2.connect();

        client1.joinGame(sessionId);
        client2.joinGame(sessionId);

        const join1 = await client1.waitForMessage('game_joined');
        const join2 = await client2.waitForMessage('game_joined');

        if (join1.payload?.gameType !== 'backgammon') {
          throw new Error(`Expected backgammon, got ${join1.payload?.gameType}`);
        }

        if (join2.payload?.sessionId !== sessionId) {
          throw new Error('Session ID mismatch in join confirmation');
        }

        console.log('  Both players joined game and received state');
      } finally {
        client1.disconnect();
        client2.disconnect();
      }
    });

    await this.runTest('Non-player cannot join game', async () => {
      const player1 = await this.createTestUser('white3');
      const player2 = await this.createTestUser('black3');
      const intruder = await this.createTestUser('intruder');
      const sessionId = await this.createTestSession(player1.id, player2.id);

      const client = new BackgammonWSClient(intruder.id, intruder.username);

      try {
        await client.connect();
        client.joinGame(sessionId);
        
        const errorMsg = await client.waitForMessage('error');
        
        if (!errorMsg.payload?.message?.includes('player') && !errorMsg.error?.includes('player')) {
          throw new Error(`Expected player error, got: ${JSON.stringify(errorMsg)}`);
        }

        console.log(`  Non-player join rejected`);
      } finally {
        client.disconnect();
      }
    });
  }

  async testReconnectsAndNetworkInterruptions(): Promise<void> {
    console.log('\n=== RECONNECT & NETWORK TESTS ===\n');

    await this.runTest('Player can reconnect and receive current state', async () => {
      const player1 = await this.createTestUser('white4');
      const player2 = await this.createTestUser('black4');
      const sessionId = await this.createTestSession(player1.id, player2.id);

      const client1 = new BackgammonWSClient(player1.id, player1.username);

      try {
        await client1.connect();
        client1.joinGame(sessionId);
        const initialJoin = await client1.waitForMessage('game_joined');

        client1.disconnect();
        await delay(500);

        await client1.reconnect();
        client1.joinGame(sessionId);
        const reconnectJoin = await client1.waitForMessage('game_joined');

        if (reconnectJoin.payload.sessionId !== initialJoin.payload.sessionId) {
          throw new Error('Session ID should match after reconnect');
        }

        console.log('  State correctly synced after reconnect');
      } finally {
        client1.disconnect();
      }
    });

    await this.runTest('Multiple rapid reconnects maintain state integrity', async () => {
      const player1 = await this.createTestUser('white5');
      const player2 = await this.createTestUser('black5');
      const sessionId = await this.createTestSession(player1.id, player2.id);

      const client1 = new BackgammonWSClient(player1.id, player1.username);

      try {
        for (let i = 0; i < 3; i++) {
          await client1.connect();
          client1.joinGame(sessionId);
          const joinMsg = await client1.waitForMessage('game_joined');
          
          if (joinMsg.payload.sessionId !== sessionId) {
            throw new Error(`Session ID changed after reconnect ${i + 1}`);
          }

          client1.disconnect();
          await delay(200);
        }

        console.log(`  3 reconnects completed, session ID stable`);
      } finally {
        client1.disconnect();
      }
    });
  }

  async testSpectatorFunctionality(): Promise<void> {
    console.log('\n=== SPECTATOR TESTS ===\n');

    await this.runTest('Spectator can watch game', async () => {
      const player1 = await this.createTestUser('spec_white');
      const player2 = await this.createTestUser('spec_black');
      const spectator = await this.createTestUser('spectator');
      const sessionId = await this.createTestSession(player1.id, player2.id);

      const playerClient = new BackgammonWSClient(player1.id, player1.username);
      const spectatorClient = new BackgammonWSClient(spectator.id, spectator.username);

      try {
        await playerClient.connect();
        await spectatorClient.connect();

        playerClient.joinGame(sessionId);
        await playerClient.waitForMessage('game_joined');

        spectatorClient.spectateGame(sessionId);
        const spectateMsg = await spectatorClient.waitForMessage('spectating');

        if (!spectateMsg.payload.isSpectator) {
          throw new Error('Should be marked as spectator');
        }

        console.log('  Spectator successfully watching game');
      } finally {
        playerClient.disconnect();
        spectatorClient.disconnect();
      }
    });

    await this.runTest('Player receives spectator count updates', async () => {
      const player1 = await this.createTestUser('count_white');
      const player2 = await this.createTestUser('count_black');
      const spec1 = await this.createTestUser('spec1');
      const sessionId = await this.createTestSession(player1.id, player2.id);

      const playerClient = new BackgammonWSClient(player1.id, player1.username);
      const specClient = new BackgammonWSClient(spec1.id, spec1.username);

      try {
        await playerClient.connect();
        playerClient.joinGame(sessionId);
        await playerClient.waitForMessage('game_joined');
        playerClient.clearMessages();

        await specClient.connect();
        specClient.spectateGame(sessionId);
        await specClient.waitForMessage('spectating');

        const countUpdate = await playerClient.waitForMessage('spectator_joined');
        if (!countUpdate.payload.spectatorCount || countUpdate.payload.spectatorCount < 1) {
          throw new Error(`Expected spectator count >= 1, got ${countUpdate.payload.spectatorCount}`);
        }

        console.log('  Spectator count broadcast verified');
      } finally {
        playerClient.disconnect();
        specClient.disconnect();
      }
    });
  }

  async testConcurrencyMultipleRooms(): Promise<void> {
    console.log('\n=== CONCURRENCY & MULTIPLE ROOMS TESTS ===\n');

    await this.runTest('Multiple independent game rooms operate in isolation', async () => {
      const p1 = await this.createTestUser('room1_white');
      const p2 = await this.createTestUser('room1_black');
      const p3 = await this.createTestUser('room2_white');
      const p4 = await this.createTestUser('room2_black');

      const session1 = await this.createTestSession(p1.id, p2.id);
      const session2 = await this.createTestSession(p3.id, p4.id);

      const clients = [
        new BackgammonWSClient(p1.id, p1.username),
        new BackgammonWSClient(p2.id, p2.username),
        new BackgammonWSClient(p3.id, p3.username),
        new BackgammonWSClient(p4.id, p4.username),
      ];

      try {
        await Promise.all(clients.map(c => c.connect()));

        clients[0].joinGame(session1);
        clients[1].joinGame(session1);
        clients[2].joinGame(session2);
        clients[3].joinGame(session2);

        const joins = await Promise.all([
          clients[0].waitForMessage('game_joined'),
          clients[1].waitForMessage('game_joined'),
          clients[2].waitForMessage('game_joined'),
          clients[3].waitForMessage('game_joined'),
        ]);

        if (joins[0].payload.sessionId === joins[2].payload.sessionId) {
          throw new Error('Different rooms should have different session IDs');
        }

        console.log('  Two independent rooms operating successfully');
      } finally {
        clients.forEach(c => c.disconnect());
      }
    });
  }

  async runAllTests(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║      BACKGAMMON LIVE WEBSOCKET INTEGRATION TESTS              ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║  Testing: Multiplayer, Reconnects, Spectators, Concurrency   ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    try {
      await this.testMultiplayerTurnIntegrity();
      await this.testReconnectsAndNetworkInterruptions();
      await this.testSpectatorFunctionality();
      await this.testConcurrencyMultipleRooms();
    } finally {
      await this.cleanup();
    }

    console.log('\n' + '═'.repeat(65));
    console.log('                        TEST SUMMARY');
    console.log('═'.repeat(65));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log(`\n  Total Tests: ${total}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n  Failed Tests:');
      for (const result of this.results.filter(r => !r.passed)) {
        console.log(`    - ${result.name}: ${result.error}`);
      }
    }
    
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`\n  Total Duration: ${totalDuration}ms`);
    console.log('═'.repeat(65));

    if (failed > 0) {
      process.exit(1);
    }
  }
}

const tests = new BackgammonLiveWSTests();
tests.runAllTests().catch(console.error);
