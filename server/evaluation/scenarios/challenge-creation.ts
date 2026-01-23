/**
 * Challenge Creation Scenario
 * Tests the complete flow of creating a challenge
 */

import { v4 as uuidv4 } from 'uuid';
import { EvaluationScenario } from "../types";
import { createChallenge } from "../../services/challenges/core/challenge-creator";
import { db } from "../../db";
import { users, challenges as challengesTable } from "@shared/schema";
import { eq } from "drizzle-orm";

interface TestContext {
  userId: string;
  username: string;
  initialBalance: number;
  challengeId?: string;
}

const testContext: TestContext = {
  userId: '',
  username: '',
  initialBalance: 0,
};

export const createChallengeScenario: EvaluationScenario = {
  name: "Challenge Creation Workflow",
  description: "Tests creating a new challenge with currency deduction and database writes",

  async setup() {
    // Create a test user with sufficient balance
    const userId = uuidv4();
    const username = `test_creator_${Date.now()}`;
    
    await db.insert(users).values({
      id: userId,
      username: username,
      password: 'hashed_password',
      balance: '1000.00',
      projectCurrency: '500.00',
      createdAt: new Date(),
    });

    testContext.userId = userId;
    testContext.username = username;
    testContext.initialBalance = 1000;

    console.log(`    Created test user: ${username} (${userId})`);
    console.log(`    Initial balance: $${testContext.initialBalance}`);
  },

  steps: [
    {
      name: "Create Challenge",
      description: "Create a chess challenge with $50 bet",
      
      async action() {
        const result = await createChallenge({
          gameType: 'chess',
          betAmount: 50,
          currencyType: 'usd',
          visibility: 'public',
          opponentType: 'random',
          userId: testContext.userId,
          timeLimit: 300,
        });

        if (result.success && result.challengeId) {
          testContext.challengeId = result.challengeId;
        }

        return result;
      },

      async validate(result, beforeState, afterState) {
        const errors: string[] = [];

        // Validate result structure
        if (!result.success) {
          errors.push(`Challenge creation failed: ${result.error}`);
          return {
            passed: false,
            message: 'Challenge creation returned failure',
            errors,
          };
        }

        if (!result.challengeId) {
          errors.push('No challengeId returned');
        }

        // Validate user balance decreased by $50
        const userBefore = beforeState.database.users?.[0];
        const userAfter = afterState.database.users?.[0];

        if (userBefore && userAfter) {
          const balanceBefore = parseFloat(userBefore.balance || '0');
          const balanceAfter = parseFloat(userAfter.balance || '0');
          const expectedBalance = balanceBefore - 50;

          if (Math.abs(balanceAfter - expectedBalance) > 0.01) {
            errors.push(
              `Balance incorrect: expected ${expectedBalance}, got ${balanceAfter}`
            );
          }
        } else {
          errors.push('Could not find user in state snapshots');
        }

        // Validate challenge was created in database
        const challengesAfter = afterState.database.challenges || [];
        const newChallenge = challengesAfter.find(c => c.id === result.challengeId);

        if (!newChallenge) {
          errors.push('Challenge not found in database');
        } else {
          // Validate challenge fields
          if (newChallenge.status !== 'waiting') {
            errors.push(`Challenge status should be 'waiting', got '${newChallenge.status}'`);
          }
          if (newChallenge.player1Id !== testContext.userId) {
            errors.push('Challenge player1Id does not match creator');
          }
          if (newChallenge.player2Id !== null) {
            errors.push('Challenge player2Id should be null initially');
          }
          if (newChallenge.gameType !== 'chess') {
            errors.push(`Challenge gameType should be 'chess', got '${newChallenge.gameType}'`);
          }
          if (parseFloat(newChallenge.betAmount) !== 50) {
            errors.push(`Challenge betAmount should be 50, got ${newChallenge.betAmount}`);
          }
        }

        const passed = errors.length === 0;
        return {
          passed,
          message: passed 
            ? 'Challenge created successfully with correct state changes'
            : 'Challenge creation validation failed',
          errors: errors.length > 0 ? errors : undefined,
          details: {
            challengeId: result.challengeId,
            balanceChange: userBefore && userAfter 
              ? parseFloat(userBefore.balance) - parseFloat(userAfter.balance)
              : 'unknown',
          },
        };
      },
    },

    {
      name: "Verify Challenge State",
      description: "Verify the challenge is visible and has correct status",

      async action() {
        if (!testContext.challengeId) {
          throw new Error('No challengeId available from previous step');
        }

        const [challenge] = await db
          .select()
          .from(challengesTable)
          .where(eq(challengesTable.id, testContext.challengeId))
          .limit(1);

        return { challenge };
      },

      async validate(result, beforeState, afterState) {
        const errors: string[] = [];
        const { challenge } = result;

        if (!challenge) {
          errors.push('Challenge not found in database');
          return {
            passed: false,
            message: 'Challenge verification failed',
            errors,
          };
        }

        // Verify all required fields are set
        if (!challenge.id) errors.push('Missing challenge.id');
        if (!challenge.gameType) errors.push('Missing challenge.gameType');
        if (!challenge.betAmount) errors.push('Missing challenge.betAmount');
        if (!challenge.player1Id) errors.push('Missing challenge.player1Id');
        if (challenge.status !== 'waiting') {
          errors.push(`Status should be 'waiting', got '${challenge.status}'`);
        }

        const passed = errors.length === 0;
        return {
          passed,
          message: passed
            ? 'Challenge state verified successfully'
            : 'Challenge state verification failed',
          errors: errors.length > 0 ? errors : undefined,
          details: {
            challengeId: challenge.id,
            status: challenge.status,
            gameType: challenge.gameType,
          },
        };
      },
    },
  ],

  async cleanup() {
    // Clean up test data
    if (testContext.challengeId) {
      await db
        .delete(challengesTable)
        .where(eq(challengesTable.id, testContext.challengeId));
      console.log(`    Deleted test challenge: ${testContext.challengeId}`);
    }

    if (testContext.userId) {
      await db
        .delete(users)
        .where(eq(users.id, testContext.userId));
      console.log(`    Deleted test user: ${testContext.username}`);
    }
  },
};
