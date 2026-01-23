# Evaluation Framework Quick Start

## Overview

The Evaluation Framework tests the challenge system workflows with automated state validation.

## Quick Start

```bash
# Run all evaluation scenarios
npm run eval
```

## What It Tests

1. **Challenge Creation**
   - Creates a chess challenge with $50 bet
   - Verifies currency deduction
   - Validates challenge database record
   - Checks challenge is in 'waiting' status

2. **Challenge Acceptance**
   - Player 1 creates a challenge
   - Player 2 accepts the challenge
   - Verifies both players' balances updated
   - Validates game session created
   - Checks challenge status changes to 'active'

## Output

The framework generates:
- Console output with step-by-step results
- JSON report in `evaluation-reports/`
- Markdown report in `evaluation-reports/`

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║          EVALUATION FRAMEWORK - Challenge System          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

Running Scenario: Challenge Creation Workflow
[Step 1/2] Create Challenge
  ✓ PASSED (850ms)
  Challenge created successfully with correct state changes

[Step 2/2] Verify Challenge State
  ✓ PASSED (400ms)
  Challenge state verified successfully

Scenario Complete: Challenge Creation Workflow
Result: 2/2 steps passed (100%)
```

## Reports Location

Reports are saved in `evaluation-reports/` with timestamp:
- `evaluation-2026-01-23T22-30-05-000Z.json`
- `evaluation-2026-01-23T22-30-05-000Z.md`

## Documentation

See [EVALUATION_FRAMEWORK.md](./EVALUATION_FRAMEWORK.md) for detailed documentation.

## Adding New Scenarios

1. Create scenario file in `server/evaluation/scenarios/`
2. Export from `server/evaluation/scenarios/index.ts`
3. Add to scenario list in `server/evaluation/index.ts`

## Requirements

- Node.js with TypeScript support
- Database connection configured
- Test users will be created and cleaned up automatically
