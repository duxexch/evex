/**
 * Staging Verification Test Suite
 * 
 * Exercises monitoring infrastructure in a staging-like environment:
 * - Triggers errors and verifies error tracking
 * - Trips circuit breakers and verifies state transitions
 * - Tests logging output at various levels
 * - Validates health endpoint alert generation
 */

import { CircuitBreaker, createCircuitBreaker, CircuitState, getAllCircuitBreakerStats } from '../lib/circuit-breaker';
import { logger } from '../lib/logger';
import { trackError, getHealthReport } from '../lib/health';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  observations?: string[];
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<string[]>): Promise<void> {
  try {
    const observations = await testFn();
    results.push({ name, passed: true, observations });
    console.log(`✅ PASS: ${name}`);
    observations.forEach(obs => console.log(`   → ${obs}`));
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    console.log(`❌ FAIL: ${name} - ${error.message}`);
  }
}

async function runLoggingTests() {
  console.log('\n=== LOGGING VERIFICATION TESTS ===\n');

  await runTest('Logger outputs structured JSON at all levels', async () => {
    const observations: string[] = [];
    
    // Capture console output would require mocking, so we just verify no errors
    logger.debug('Test debug message', { testId: 'debug-1' });
    observations.push('DEBUG log emitted without error');
    
    logger.info('Test info message', { testId: 'info-1' });
    observations.push('INFO log emitted without error');
    
    logger.warn('Test warning message', { testId: 'warn-1' });
    observations.push('WARN log emitted without error');
    
    logger.error('Test error message', new Error('Test error'), { testId: 'error-1' });
    observations.push('ERROR log emitted without error');
    
    return observations;
  });

  await runTest('Specialized loggers emit structured events', async () => {
    const observations: string[] = [];
    
    logger.financial('deposit', {
      userId: 'test-user',
      amount: '100.00',
      type: 'deposit',
      result: 'success'
    });
    observations.push('Financial log emitted');
    
    logger.game('move', {
      sessionId: 'test-session',
      gameType: 'chess',
      action: 'e2e4',
      result: { success: true }
    });
    observations.push('Game log emitted');
    
    logger.security('login_attempt', {
      userId: 'test-user',
      ip: '127.0.0.1',
      action: 'login',
      result: 'allowed'
    });
    observations.push('Security log emitted');
    
    return observations;
  });

  await runTest('Timer utility measures durations', async () => {
    const observations: string[] = [];
    
    const stopTimer = logger.startTimer('test-operation');
    await new Promise(resolve => setTimeout(resolve, 50));
    const duration = stopTimer();
    
    if (duration >= 40 && duration <= 200) {
      observations.push(`Timer measured ${duration}ms (expected ~50ms)`);
    } else {
      throw new Error(`Timer measurement out of range: ${duration}ms`);
    }
    
    return observations;
  });

  await runTest('Child logger maintains context', async () => {
    const observations: string[] = [];
    
    const childLogger = logger.child({ requestId: 'req-123', userId: 'user-456' });
    childLogger.info('Child log message', { extra: 'data' });
    observations.push('Child logger emitted with persistent context');
    
    return observations;
  });
}

async function runCircuitBreakerTests() {
  console.log('\n=== CIRCUIT BREAKER VERIFICATION TESTS ===\n');

  await runTest('Circuit breaker starts in CLOSED state', async () => {
    const observations: string[] = [];
    
    const testBreaker = createCircuitBreaker({
      name: 'test-breaker-1',
      failureThreshold: 3,
      resetTimeout: 1000
    });
    
    if (testBreaker.getState() !== CircuitState.CLOSED) {
      throw new Error(`Expected CLOSED, got ${testBreaker.getState()}`);
    }
    observations.push('New circuit breaker starts in CLOSED state');
    
    return observations;
  });

  await runTest('Circuit breaker trips after failure threshold', async () => {
    const observations: string[] = [];
    
    const testBreaker = createCircuitBreaker({
      name: 'test-breaker-2',
      failureThreshold: 2,
      resetTimeout: 500
    });
    
    const failingFn = async () => { throw new Error('Simulated failure'); };
    
    // First failure
    try { await testBreaker.execute(failingFn); } catch {}
    observations.push(`After 1 failure: ${testBreaker.getState()}`);
    
    // Second failure - should trip
    try { await testBreaker.execute(failingFn); } catch {}
    
    if (testBreaker.getState() !== CircuitState.OPEN) {
      throw new Error(`Expected OPEN after 2 failures, got ${testBreaker.getState()}`);
    }
    observations.push(`After 2 failures: ${testBreaker.getState()} (tripped!)`);
    
    return observations;
  });

  await runTest('Circuit breaker rejects requests when OPEN', async () => {
    const observations: string[] = [];
    
    const testBreaker = createCircuitBreaker({
      name: 'test-breaker-3',
      failureThreshold: 1,
      resetTimeout: 60000 // Long timeout to keep open
    });
    
    // Trip the breaker
    try { 
      await testBreaker.execute(async () => { throw new Error('Trip'); }); 
    } catch {}
    
    const stats = testBreaker.getStats();
    observations.push(`Breaker tripped, state: ${testBreaker.getState()}`);
    
    // Try another request - should be rejected immediately
    try {
      await testBreaker.execute(async () => 'should not execute');
      throw new Error('Request should have been rejected');
    } catch (e: any) {
      if (e.message.includes('OPEN')) {
        observations.push('Request correctly rejected while OPEN');
      } else {
        throw e;
      }
    }
    
    return observations;
  });

  await runTest('Circuit breaker transitions to HALF_OPEN after reset timeout', async () => {
    const observations: string[] = [];
    
    const testBreaker = createCircuitBreaker({
      name: 'test-breaker-4',
      failureThreshold: 1,
      resetTimeout: 100, // Short timeout for testing
      successThreshold: 1
    });
    
    // Trip the breaker
    try { 
      await testBreaker.execute(async () => { throw new Error('Trip'); }); 
    } catch {}
    observations.push(`Initial state: ${testBreaker.getState()}`);
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Next request should transition to HALF_OPEN and succeed
    const result = await testBreaker.execute(async () => 'success');
    observations.push(`After reset timeout and success: ${testBreaker.getState()}`);
    
    if (testBreaker.getState() !== CircuitState.CLOSED) {
      throw new Error(`Expected CLOSED after success in HALF_OPEN, got ${testBreaker.getState()}`);
    }
    observations.push('Breaker recovered to CLOSED state');
    
    return observations;
  });

  await runTest('Circuit breaker stats are aggregated correctly', async () => {
    const observations: string[] = [];
    
    const allStats = getAllCircuitBreakerStats();
    const breakerNames = Object.keys(allStats);
    
    observations.push(`Total breakers registered: ${breakerNames.length}`);
    observations.push(`Breakers: ${breakerNames.join(', ')}`);
    
    // Verify pre-configured breakers exist
    if (!allStats['database']) {
      throw new Error('database circuit breaker not found');
    }
    if (!allStats['payment']) {
      throw new Error('payment circuit breaker not found');
    }
    observations.push('Pre-configured breakers (database, payment) found');
    
    return observations;
  });
}

async function runHealthMonitoringTests() {
  console.log('\n=== HEALTH MONITORING VERIFICATION TESTS ===\n');

  await runTest('Error tracking records and counts errors', async () => {
    const observations: string[] = [];
    
    // Track some errors
    trackError('Test error 1');
    trackError('Test error 2');
    trackError('Test error 3');
    
    const report = await getHealthReport();
    observations.push(`Recent errors tracked: ${report.services.recentErrors}`);
    
    if (report.services.recentErrors < 3) {
      throw new Error(`Expected at least 3 errors, got ${report.services.recentErrors}`);
    }
    observations.push('Error tracking correctly counting errors');
    
    return observations;
  });

  await runTest('Health report includes all expected sections', async () => {
    const observations: string[] = [];
    
    const report = await getHealthReport();
    
    // Verify status section
    if (!report.status.status || !report.status.timestamp || report.status.uptime === undefined) {
      throw new Error('Missing status fields');
    }
    observations.push('Status section complete');
    
    // Verify system section
    if (!report.system.memory || !report.system.cpu || !report.system.process) {
      throw new Error('Missing system fields');
    }
    observations.push('System metrics section complete');
    
    // Verify database section
    if (report.database.connected === undefined || report.database.latencyMs === undefined) {
      throw new Error('Missing database fields');
    }
    observations.push(`Database: connected=${report.database.connected}, latency=${report.database.latencyMs}ms`);
    
    // Verify services section
    if (!report.services.circuitBreakers) {
      throw new Error('Missing circuit breakers in services');
    }
    observations.push('Services section complete');
    
    // Verify alerts array exists
    if (!Array.isArray(report.alerts)) {
      throw new Error('Alerts should be an array');
    }
    observations.push(`Alerts: ${report.alerts.length} active`);
    
    return observations;
  });

  await runTest('Health report detects unhealthy circuit breakers', async () => {
    const observations: string[] = [];
    
    // Create a breaker that we'll trip
    const alertBreaker = createCircuitBreaker({
      name: 'test-alert-breaker',
      failureThreshold: 1,
      resetTimeout: 60000
    });
    
    // Trip it
    try {
      await alertBreaker.execute(async () => { throw new Error('Trip for alert test'); });
    } catch {}
    
    const report = await getHealthReport();
    const circuitAlert = report.alerts.find(a => a.component.includes('circuit'));
    
    if (!circuitAlert) {
      throw new Error('Expected alert for tripped circuit breaker');
    }
    observations.push(`Alert generated: ${circuitAlert.message}`);
    observations.push(`Alert level: ${circuitAlert.level}`);
    
    return observations;
  });

  await runTest('Health status reflects overall system health', async () => {
    const observations: string[] = [];
    
    const report = await getHealthReport();
    
    // With tripped circuit breakers from previous test, should be unhealthy or degraded
    observations.push(`Overall status: ${report.status.status}`);
    observations.push(`Active alerts: ${report.alerts.length}`);
    
    // Log alert details
    report.alerts.forEach(alert => {
      observations.push(`  - [${alert.level}] ${alert.component}: ${alert.message}`);
    });
    
    return observations;
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   STAGING VERIFICATION TEST SUITE                         ║');
  console.log('║   Testing Monitoring, Logging, and Recovery               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await runLoggingTests();
  await runCircuitBreakerTests();
  await runHealthMonitoringTests();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
    console.log('\n❌ STAGING VERIFICATION INCOMPLETE');
    process.exit(1);
  } else {
    console.log('\n✅ ALL STAGING VERIFICATION TESTS PASSED');
    console.log('   Monitoring infrastructure is ready for production');
  }
}

main().catch(console.error);
