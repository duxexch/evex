# Evaluation Framework Documentation

## Overview

The Evaluation Framework provides a comprehensive testing infrastructure for the challenge system workspace. It validates complete workflows including challenge creation, acceptance, WebSocket connections, and game state management with detailed state tracking and database verification.

## Features

- **State Capture**: Snapshots database and memory state before and after each action
- **Automated Validation**: Validates expected state changes and database writes
- **Detailed Reporting**: Generates JSON and Markdown reports with step-by-step results
- **Scenario-Based**: Organized into reusable evaluation scenarios
- **Clean Testing**: Automatic setup and teardown of test data

## Architecture

```
server/evaluation/
├── index.ts                 # Main entry point
├── types.ts                 # Type definitions
├── runner.ts                # Scenario execution engine
├── state-capturer.ts        # State snapshot utilities
└── scenarios/
    ├── index.ts             # Scenario exports
    ├── challenge-creation.ts    # Challenge creation workflow
    └── challenge-acceptance.ts  # Challenge acceptance workflow
```

## Running Evaluations

### Command Line

```bash
# Run all evaluation scenarios
npm run eval

# Or using tsx directly
tsx scripts/run-evaluation.ts
```

### Programmatic Usage

```typescript
import { runEvaluation } from './server/evaluation/runner';
import { createChallengeScenario } from './server/evaluation/scenarios';

const report = await runEvaluation([createChallengeScenario], []);
console.log(report);
```

## Evaluation Scenarios

### 1. Challenge Creation Workflow

**Purpose**: Validates the complete challenge creation process

**Steps**:
1. Create challenge with $50 bet
2. Verify challenge state in database
3. Verify user balance decreased by $50
4. Verify challenge is in 'waiting' status

**Validation**:
- Challenge record created in database
- Correct challenge fields (gameType, betAmount, status, etc.)
- Currency properly deducted from user balance
- Challenge visible in public listings

### 2. Challenge Acceptance Workflow

**Purpose**: Validates joining a challenge and starting a game

**Steps**:
1. Player 1 creates a challenge
2. Player 2 accepts the challenge
3. Verify game session created
4. Verify both players' balances updated

**Validation**:
- Challenge status changes to 'active'
- player2Id is set correctly
- Both players' currencies deducted
- Live game session created with correct players
- Game state initialized

## State Validation

The framework captures state snapshots that include:

```typescript
{
  timestamp: Date,
  description: string,
  database: {
    users: [],           // User records
    challenges: [],      // Challenge records
    liveGameSessions: [], // Game session records
    notifications: []    // Notification records
  },
  memory: {
    websocketConnections: number,
    queuedMessages: number
  }
}
```

## Creating New Scenarios

### Step 1: Define Scenario Structure

```typescript
import { EvaluationScenario } from "../types";

export const myScenario: EvaluationScenario = {
  name: "My Test Scenario",
  description: "Description of what this tests",
  
  async setup() {
    // Create test data (users, etc.)
  },
  
  steps: [
    {
      name: "Step 1",
      description: "What this step does",
      
      async action() {
        // Execute the action
        return result;
      },
      
      async validate(result, beforeState, afterState) {
        // Validate the result
        return {
          passed: true,
          message: "Validation message",
        };
      },
    },
  ],
  
  async cleanup() {
    // Clean up test data
  },
};
```

### Step 2: Add to Scenario Index

```typescript
// server/evaluation/scenarios/index.ts
export { myScenario } from './my-scenario';
```

### Step 3: Include in Main Runner

```typescript
// server/evaluation/index.ts
import { myScenario } from "./scenarios";

const scenarios = [
  createChallengeScenario,
  challengeAcceptanceScenario,
  myScenario, // Add here
];
```

## Report Format

### JSON Report

```json
{
  "totalScenarios": 2,
  "passedScenarios": 2,
  "failedScenarios": 0,
  "scenarios": [
    {
      "scenarioName": "Challenge Creation Workflow",
      "startTime": "2026-01-23T22:30:00Z",
      "duration": 1250,
      "totalSteps": 2,
      "passedSteps": 2,
      "steps": [...]
    }
  ],
  "timestamp": "2026-01-23T22:30:05Z"
}
```

### Markdown Report

```markdown
# Evaluation Report

Generated: 2026-01-23T22:30:05Z

## Summary

- **Total Scenarios**: 2
- **Passed**: 2 ✓
- **Failed**: 0 ✗
- **Success Rate**: 100%

## Scenarios

### ✓ PASSED: Challenge Creation Workflow

**Duration**: 1250ms
**Steps**: 2/2 passed

#### Steps:

1. ✓ **Create Challenge** (850ms)
   - Challenge created successfully with correct state changes
2. ✓ **Verify Challenge State** (400ms)
   - Challenge state verified successfully
```

## State Change Tracking

The framework automatically tracks and displays all state changes:

```
=== State Changes ===
Time: 2026-01-23T22:30:00.000Z → 2026-01-23T22:30:01.250Z
Duration: 1250ms

Challenge Changes (1):
  - created: {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "waiting",
      "betAmount": "50"
    }

User Changes (1):
  - modified: {
      "id": "user-123",
      "modifications": {
        "balance": {
          "before": "1000.00",
          "after": "950.00"
        }
      }
    }
```

## Best Practices

1. **Isolation**: Each scenario should be independent and clean up after itself
2. **Validation**: Validate all expected state changes, not just success flags
3. **Error Handling**: Provide clear error messages in validation failures
4. **Test Data**: Use unique identifiers (timestamps, UUIDs) to avoid conflicts
5. **Cleanup**: Always clean up test data in the cleanup phase

## Extending the Framework

### Adding Database Tables

To track additional tables, update `state-capturer.ts`:

```typescript
// Add to StateSnapshot interface
export interface StateSnapshot {
  database: {
    users?: any[];
    challenges?: any[];
    myNewTable?: any[];  // Add here
  };
}

// Add to captureState function
snapshot.database.myNewTable = await db
  .select()
  .from(myNewTable)
  .where(...)
  .limit(100);
```

### Adding Memory State

To track in-memory state:

```typescript
// In state-capturer.ts
snapshot.memory.myMetric = getMyMetric();
```

## Troubleshooting

### Scenario Fails to Run

- Check database connection
- Verify test user creation succeeds
- Check for missing dependencies

### State Not Captured

- Verify user IDs are passed to `captureState()`
- Check database queries in state-capturer.ts
- Ensure tables exist in schema

### Validation Fails

- Add detailed logging in validation functions
- Check state snapshots in report
- Verify expected values match actual database state

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Run Evaluations
  run: npm run eval
  
- name: Upload Reports
  uses: actions/upload-artifact@v2
  with:
    name: evaluation-reports
    path: evaluation-reports/
```

## Future Enhancements

Planned features:
- WebSocket connection simulation
- Multi-player game flow evaluation
- Performance benchmarking
- Load testing scenarios
- Real-time state monitoring
