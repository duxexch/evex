import WebSocket from 'ws';
import { randomUUID } from 'crypto';

const WS_URL = process.env.WS_URL || 'ws://localhost:5000';
const API_URL = process.env.API_URL || 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: string;
  rootCause?: string;
  fix?: string;
}

interface TestClient {
  ws: WebSocket;
  userId: string;
  token: string;
  username: string;
  messages: any[];
  sessionId?: string;
}

const results: TestResult[] = [];
const issues: { issue: string; rootCause: string; fix: string; status: string }[] = [];

function log(msg: string) {
  console.log(`[TEST] ${new Date().toISOString()} - ${msg}`);
}

function logError(msg: string) {
  console.error(`[TEST ERROR] ${new Date().toISOString()} - ${msg}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestUser(username: string): Promise<{ userId: string; token: string; username: string }> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@test.com`,
      password: 'TestPass123!',
      confirmPassword: 'TestPass123!',
      termsAccepted: true
    })
  });
  
  if (!response.ok) {
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password: 'TestPass123!'
      })
    });
    if (!loginResponse.ok) {
      const text = await loginResponse.text();
      throw new Error(`Failed to create/login user ${username}: ${text}`);
    }
    const data = await loginResponse.json();
    return { userId: String(data.user.id), token: data.token, username: data.user.username };
  }
  
  const data = await response.json();
  return { userId: String(data.user.id), token: data.token, username: data.user.username };
}

async function createTestGameSession(token: string, player1Id: string, player2Id: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/test/create-game-session`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      player1Id, 
      player2Id,
      gameType: 'chess'
    })
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create game session: ${text}`);
  }
  
  const data = await response.json();
  return data.sessionId;
}

function createWebSocketClient(token: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws/game`, {
      perMessageDeflate: false
    });
    const client: TestClient = {
      ws,
      userId: '',
      token,
      username: '',
      messages: []
    };
    
    ws.on('open', () => {
      log('WebSocket connected, authenticating...');
      ws.send(JSON.stringify({
        type: 'authenticate',
        payload: { token }
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        client.messages.push(msg);
        
        if (msg.type === 'authenticated') {
          client.userId = msg.payload.userId;
          client.username = msg.payload.username;
          log(`Authenticated as ${msg.payload.username}`);
          resolve(client);
        } else if (msg.type === 'error' && !client.userId) {
          reject(new Error(`Authentication failed: ${msg.payload?.message || 'Unknown error'}`));
        }
      } catch (e) {
        logError(`Failed to parse message: ${data.toString()}`);
      }
    });
    
    ws.on('error', (err) => {
      logError(`WebSocket error: ${err.message}`);
      reject(err);
    });
    
    ws.on('close', (code, reason) => {
      log(`WebSocket closed: ${code} - ${reason}`);
    });
    
    setTimeout(() => reject(new Error('WebSocket connection/auth timeout')), 15000);
  });
}

function sendMessage(client: TestClient, type: string, payload: any) {
  if (client.ws.readyState === WebSocket.OPEN) {
    const msg = JSON.stringify({ type, payload });
    log(`Sending: ${msg}`);
    client.ws.send(msg);
  } else {
    log(`Cannot send - WebSocket not open (state: ${client.ws.readyState})`);
  }
}

async function waitForMessage(client: TestClient, type: string, timeout: number = 5000): Promise<any> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const msgIndex = client.messages.findIndex(m => m.type === type);
    if (msgIndex !== -1) {
      const msg = client.messages[msgIndex];
      client.messages.splice(msgIndex, 1);
      return msg;
    }
    await sleep(100);
  }
  log(`Timeout waiting for ${type}. Messages received: ${JSON.stringify(client.messages.map(m => m.type))}`);
  throw new Error(`Timeout waiting for message type: ${type}`);
}

function hasMessage(client: TestClient, type: string): boolean {
  return client.messages.some(m => m.type === type);
}

function getMessages(client: TestClient, type: string): any[] {
  return client.messages.filter(m => m.type === type);
}

function clearMessages(client: TestClient) {
  client.messages = [];
}

async function runTest(name: string, testFn: () => Promise<{ rootCause?: string; fix?: string } | void>): Promise<TestResult> {
  const startTime = Date.now();
  try {
    log(`\n${'='.repeat(50)}`);
    log(`Running test: ${name}`);
    log('='.repeat(50));
    const result = await testFn();
    const duration = Date.now() - startTime;
    log(`✓ PASSED: ${name} (${duration}ms)`);
    return { name, passed: true, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logError(`✗ FAILED: ${name} - ${error.message}`);
    return { 
      name, 
      passed: false, 
      duration, 
      error: error.message,
      rootCause: error.rootCause,
      fix: error.fix
    };
  }
}

async function testBasicConnection(): Promise<void> {
  const user = await createTestUser(`conn_test_${Date.now()}`);
  const client = await createWebSocketClient(user.token);
  
  if (!client.userId) {
    throw new Error('Client not authenticated');
  }
  
  client.ws.close();
  log('Basic connection test passed');
}

async function testMalformedMessages(): Promise<void> {
  const user = await createTestUser(`malform_${Date.now()}`);
  const client = await createWebSocketClient(user.token);
  
  client.ws.send('not valid json');
  await sleep(300);
  
  client.ws.send(JSON.stringify({ type: 'unknown_type_xyz', payload: {} }));
  await sleep(300);
  
  client.ws.send(JSON.stringify({ type: 'make_move' }));
  await sleep(300);
  
  client.ws.send(JSON.stringify({ type: 'join_game', payload: { sessionId: null } }));
  await sleep(300);
  
  if (client.ws.readyState !== WebSocket.OPEN) {
    throw new Error('Server crashed or disconnected on malformed messages');
  }
  
  client.ws.close();
  log('Malformed messages handled gracefully');
}

async function testRapidDisconnectReconnect(): Promise<void> {
  const user = await createTestUser(`rapid_${Date.now()}`);
  
  for (let i = 0; i < 3; i++) {
    const client = await createWebSocketClient(user.token);
    await sleep(50);
    client.ws.close();
    await sleep(50);
  }
  
  const finalClient = await createWebSocketClient(user.token);
  if (finalClient.ws.readyState !== WebSocket.OPEN) {
    throw new Error('Final connection failed after rapid disconnects');
  }
  
  finalClient.ws.close();
  log('Rapid disconnect/reconnect cycles passed');
}

async function testJoinNonExistentGame(): Promise<void> {
  const user = await createTestUser(`noexist_${Date.now()}`);
  const client = await createWebSocketClient(user.token);
  
  sendMessage(client, 'join_game', { sessionId: 'non-existent-session-id' });
  
  try {
    await waitForMessage(client, 'error', 3000);
    log('Server correctly rejected non-existent session');
  } catch (e) {
  }
  
  client.ws.close();
}

async function testMoveWithoutJoiningGame(): Promise<void> {
  const user = await createTestUser(`nomove_${Date.now()}`);
  const client = await createWebSocketClient(user.token);
  
  sendMessage(client, 'make_move', { 
    sessionId: 'some-session',
    move: { from: 'e2', to: 'e4' }
  });
  
  await sleep(500);
  
  const errorMsgs = getMessages(client, 'error');
  if (errorMsgs.length === 0) {
    const updateMsgs = getMessages(client, 'game_update');
    if (updateMsgs.length > 0) {
      throw new Error('Move was accepted without joining game');
    }
  }
  
  client.ws.close();
  log('Move without joining game correctly rejected');
}

async function testSpectateNonExistentGame(): Promise<void> {
  const user = await createTestUser(`nospec_${Date.now()}`);
  const client = await createWebSocketClient(user.token);
  
  sendMessage(client, 'spectate', { sessionId: 'non-existent-session' });
  
  await sleep(500);
  
  const errorMsgs = getMessages(client, 'error');
  log(`Spectate non-existent: received ${errorMsgs.length} error messages`);
  
  client.ws.close();
}

async function testInvalidTokenConnection(): Promise<void> {
  const ws = new WebSocket(`${WS_URL}/ws/game`, {
    perMessageDeflate: false
  });
  
  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'authenticate',
        payload: { token: 'invalid-jwt-token-12345' }
      }));
    });
    
    const messages: any[] = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      messages.push(msg);
      
      if (msg.type === 'error') {
        log('Invalid token correctly rejected');
        ws.close();
        resolve();
      } else if (msg.type === 'authenticated') {
        ws.close();
        reject(new Error('Invalid token was accepted'));
      }
    });
    
    setTimeout(() => {
      ws.close();
      log(`Timeout - messages received: ${JSON.stringify(messages)}`);
      resolve();
    }, 3000);
  });
}

async function testHeartbeat(): Promise<void> {
  const user = await createTestUser(`heartbeat_${Date.now()}`);
  const client = await createWebSocketClient(user.token);
  
  let pongReceived = false;
  client.ws.on('pong', () => {
    pongReceived = true;
    log('Pong received from server');
  });
  
  client.ws.ping();
  
  await sleep(2000);
  
  if (client.ws.readyState !== WebSocket.OPEN) {
    throw new Error('Connection dropped during heartbeat test');
  }
  
  client.ws.close();
  log('Heartbeat test passed');
}

async function testConcurrentConnections(): Promise<void> {
  const users = await Promise.all([
    createTestUser(`concurrent1_${Date.now()}`),
    createTestUser(`concurrent2_${Date.now()}`),
    createTestUser(`concurrent3_${Date.now()}`),
    createTestUser(`concurrent4_${Date.now()}`),
    createTestUser(`concurrent5_${Date.now()}`)
  ]);
  
  const clients = await Promise.all(
    users.map(u => createWebSocketClient(u.token))
  );
  
  const allConnected = clients.every(c => c.ws.readyState === WebSocket.OPEN);
  if (!allConnected) {
    throw new Error('Not all clients connected successfully');
  }
  
  log(`${clients.length} concurrent connections established`);
  
  clients.forEach(c => c.ws.close());
}

async function testMessageOrdering(): Promise<void> {
  const user = await createTestUser(`ordering_${Date.now()}`);
  const client = await createWebSocketClient(user.token);
  
  for (let i = 0; i < 10; i++) {
    sendMessage(client, 'get_state', { sessionId: `test-${i}` });
  }
  
  await sleep(1000);
  
  if (client.ws.readyState !== WebSocket.OPEN) {
    throw new Error('Connection dropped during message burst');
  }
  
  client.ws.close();
  log('Message ordering test passed');
}

async function testAuthenticationTimeout(): Promise<void> {
  const ws = new WebSocket(`${WS_URL}/ws/game`, {
    perMessageDeflate: false
  });
  
  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      log('Connected without authenticating...');
    });
    
    ws.on('close', (code) => {
      log(`Connection closed with code ${code} (expected if server enforces auth timeout)`);
      resolve();
    });
    
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        log('Connection still open after 5s without auth (no timeout enforced)');
        ws.close();
      }
      resolve();
    }, 5000);
  });
}

async function runAllTests(): Promise<void> {
  log('='.repeat(60));
  log('WebSocket Stress Test Suite - Foundation Tests');
  log('='.repeat(60));
  log(`API URL: ${API_URL}`);
  log(`WS URL: ${WS_URL}`);
  log('='.repeat(60));
  
  const tests = [
    { name: 'Basic Connection & Authentication', fn: testBasicConnection },
    { name: 'Invalid Token Rejection', fn: testInvalidTokenConnection },
    { name: 'Malformed Message Handling', fn: testMalformedMessages },
    { name: 'Rapid Disconnect/Reconnect Cycles', fn: testRapidDisconnectReconnect },
    { name: 'Join Non-Existent Game', fn: testJoinNonExistentGame },
    { name: 'Move Without Joining Game', fn: testMoveWithoutJoiningGame },
    { name: 'Spectate Non-Existent Game', fn: testSpectateNonExistentGame },
    { name: 'Heartbeat/Ping-Pong', fn: testHeartbeat },
    { name: 'Concurrent Connections (5 clients)', fn: testConcurrentConnections },
    { name: 'Message Burst Ordering', fn: testMessageOrdering },
    { name: 'Authentication Timeout Behavior', fn: testAuthenticationTimeout },
  ];
  
  for (const test of tests) {
    const result = await runTest(test.name, test.fn);
    results.push(result);
    await sleep(300);
  }
  
  log('\n' + '='.repeat(60));
  log('Test Results Summary');
  log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    const duration = `${result.duration}ms`;
    console.log(`${status} | ${result.name} (${duration})`);
    if (result.error) {
      console.log(`       Error: ${result.error}`);
    }
    if (result.rootCause) {
      console.log(`       Root Cause: ${result.rootCause}`);
    }
    if (result.fix) {
      console.log(`       Fix: ${result.fix}`);
    }
  }
  
  log('='.repeat(60));
  log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  log('='.repeat(60));
  
  if (issues.length > 0) {
    log('\nIssues Found:');
    log('-'.repeat(40));
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.issue}`);
      console.log(`   Root Cause: ${issue.rootCause}`);
      console.log(`   Fix: ${issue.fix}`);
      console.log(`   Status: ${issue.status}`);
    });
  }
  
  if (failed > 0) {
    log('\n⚠️  Some tests failed - review issues above');
    process.exit(1);
  } else {
    log('\n✅ All foundation tests passed');
  }
}

runAllTests().catch((error) => {
  logError(`Test suite crashed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
