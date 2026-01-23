/**
 * Challenge Acceptance Scenario
 * Tests the complete flow of joining/accepting a challenge
 */

import { v4 as uuidv4 } from 'uuid';
import { EvaluationScenario } from "../types";
import { createChallenge } from "../../services/challenges/core/challenge-creator";
import { acceptChallenge } from "../../services/challenges/core/challenge-acceptor";
import { db } from "../../db";
import { users, challenges as challengesTable, liveGameSessions } from "@shared/schema";
import { eq } from "drizzle-orm";

interface TestContext {
  player1Id: string;
  player2Id: string;
  challengeId?: string;
  sessionId?: string;
}

const testContext: TestContext = {
  player1Id: '',
  player2Id: '',
};

export const challengeAcceptanceScenario: EvaluationScenario = {
  name: "Challenge Acceptance Workflow",
  description: "Tests joining a challenge, currency deduction, and game session creation",

  async setup() {
    // Create two test users
    const player1Id = uuidv4();
    const player2Id = uuidv4();
    
    await db.insert(users).values([
      {
        id: player1Id,
        username: `player1_${Date.now()}`,
        password: 'hashed_password',
        balance: '1000.00',
        projectCurrency: '500.00',
        createdAt: new Date(),
      },
      {
        id: player2Id,
        username: `player2_${Date.now()}`,
        password: 'hashed_password',
        balance: '1000.00',
        projectCurrency: '500.00',
        createdAt: new Date(),
      },
    ]);

    testContext.player1Id = player1Id;
    testContext.player2Id = player2Id;

    console.log(`    Created player1: ${player1Id}`);
    console.log(`    Created player2: ${player2Id}`);
  },

  steps: [
    {
      name: "Create Challenge (Player 1)",
      description: "Player 1 creates a chess challenge",
      
      async action() {
        const result = await createChallenge({
          gameType: 'chess',
          betAmount: 50,
          currencyType: 'usd',
          visibility: 'public',
          opponentType: 'random',
          userId: testContext.player1Id,
          timeLimit: 300,
        });

        if (result.success && result.challengeId) {
          testContext.challengeId = result.challengeId;
        }

        return result;
      },

      async validate(result, beforeState, afterState) {
        const errors: string[] = [];

        if (!result.success) {
          errors.push(`Challenge creation failed: ${result.error}`);
        }

        if (!result.challengeId) {
          errors.push('No challengeId returned');
        }

        const passed = errors.length === 0;
        return {
          passed,
          message: passed ? 'Challenge created' : 'Challenge creation failed',
          errors: errors.length > 0 ? errors : undefined,
        };
      },
    },

    {
      name: "Accept Challenge (Player 2)",
      description: "Player 2 accepts the challenge",

      async action() {
        if (!testContext.challengeId) {
          throw new Error('No challengeId available');
        }

        const result = await acceptChallenge({
          challengeId: testContext.challengeId,
          userId: testContext.player2Id,
        });

        if (result.success && result.challenge?.sessionId) {
          testContext.sessionId = result.challenge.sessionId;
        }

        return result;
      },

      async validate(result, beforeState, afterState) {
        const errors: string[] = [];

        // Validate acceptance result
        if (!result.success) {
          errors.push(`Challenge acceptance failed: ${result.error}`);
          return {
            passed: false,
            message: 'Challenge acceptance failed',
            errors,
          };
        }

        // Validate player 2 balance decreased
        const player2Before = beforeState.database.users?.find(
          u => u.id === testContext.player2Id
        );
        const player2After = afterState.database.users?.find(
          u => u.id === testContext.player2Id
        );

        if (player2Before && player2After) {
          const balanceBefore = parseFloat(player2Before.balance || '0');
          const balanceAfter = parseFloat(player2After.balance || '0');
          const expectedBalance = balanceBefore - 50;

          if (Math.abs(balanceAfter - expectedBalance) > 0.01) {
            errors.push(
              `Player2 balance incorrect: expected ${expectedBalance}, got ${balanceAfter}`
            );
          }
        }

        // Validate challenge status changed to 'active'
        const challengeAfter = afterState.database.challenges?.find(
          c => c.id === testContext.challengeId
        );

        if (!challengeAfter) {
          errors.push('Challenge not found after acceptance');
        } else {
          if (challengeAfter.status !== 'active') {
            errors.push(`Challenge status should be 'active', got '${challengeAfter.status}'`);
          }
          if (challengeAfter.player2Id !== testContext.player2Id) {
            errors.push('Challenge player2Id not set correctly');
          }
        }

        // Validate game session created
        const sessions = afterState.database.liveGameSessions || [];
        const gameSession = sessions.find(s => 
          s.player1Id === testContext.player1Id && 
          s.player2Id === testContext.player2Id
        );

        if (!gameSession) {
          errors.push('Live game session not created');
        } else {
          testContext.sessionId = gameSession.id;
        }

        const passed = errors.length === 0;
        return {
          passed,
          message: passed
            ? 'Challenge accepted successfully with game session created'
            : 'Challenge acceptance validation failed',
          errors: errors.length > 0 ? errors : undefined,
          details: {
            sessionId: testContext.sessionId,
            challengeStatus: challengeAfter?.status,
          },
        };
      },
    },

    {
      name: "Verify Game Session",
      description: "Verify the game session is properly initialized",

      async action() {
        if (!testContext.sessionId) {
          throw new Error('No sessionId available');
        }

        const [session] = await db
          .select()
          .from(liveGameSessions)
          .where(eq(liveGameSessions.id, testContext.sessionId))
          .limit(1);

        return { session };
      },

      async validate(result, beforeState, afterState) {
        const errors: string[] = [];
        const { session } = result;

        if (!session) {
          errors.push('Game session not found');
          return {
            passed: false,
            message: 'Game session verification failed',
            errors,
          };
        }

        // Verify session fields
        if (session.player1Id !== testContext.player1Id) {
          errors.push('Session player1Id mismatch');
        }
        if (session.player2Id !== testContext.player2Id) {
          errors.push('Session player2Id mismatch');
        }
        if (session.gameType !== 'chess') {
          errors.push(`Session gameType should be 'chess', got '${session.gameType}'`);
        }
        if (!session.gameState) {
          errors.push('Session gameState not initialized');
        }

        const passed = errors.length === 0;
        return {
          passed,
          message: passed
            ? 'Game session verified successfully'
            : 'Game session verification failed',
          errors: errors.length > 0 ? errors : undefined,
          details: {
            sessionId: session.id,
            gameType: session.gameType,
            status: session.status,
          },
        };
      },
    },
  ],

  async cleanup() {
    // Clean up test data
    if (testContext.sessionId) {
      await db
        .delete(liveGameSessions)
        .where(eq(liveGameSessions.id, testContext.sessionId));
      console.log(`    Deleted game session: ${testContext.sessionId}`);
    }

    if (testContext.challengeId) {
      await db
        .delete(challengesTable)
        .where(eq(challengesTable.id, testContext.challengeId));
      console.log(`    Deleted challenge: ${testContext.challengeId}`);
    }

    if (testContext.player1Id) {
      await db.delete(users).where(eq(users.id, testContext.player1Id));
      console.log(`    Deleted player1`);
    }

    if (testContext.player2Id) {
      await db.delete(users).where(eq(users.id, testContext.player2Id));
      console.log(`    Deleted player2`);
    }
  },
};
