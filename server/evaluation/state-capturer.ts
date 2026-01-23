/**
 * State Capturer - Captures database and memory state for evaluation
 */

import { db } from "../db";
import { 
  users, 
  challenges, 
  liveGameSessions, 
  notifications 
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { StateSnapshot } from "./types";

/**
 * Capture current state of the system for a set of users
 */
export async function captureState(
  userIds: string[],
  description: string
): Promise<StateSnapshot> {
  const snapshot: StateSnapshot = {
    timestamp: new Date(),
    description,
    database: {},
    memory: {},
  };

  try {
    // Capture user data
    if (userIds.length > 0) {
      snapshot.database.users = await db
        .select()
        .from(users)
        .where(inArray(users.id, userIds));
    }

    // Capture challenges
    snapshot.database.challenges = await db
      .select()
      .from(challenges)
      .where(
        inArray(
          challenges.player1Id, 
          userIds
        )
      )
      .limit(100);

    // Capture live game sessions
    snapshot.database.liveGameSessions = await db
      .select()
      .from(liveGameSessions)
      .where(
        inArray(
          liveGameSessions.player1Id,
          userIds
        )
      )
      .limit(100);

    // Capture recent notifications
    snapshot.database.notifications = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.userId, userIds))
      .limit(100);

    // Memory state (would be extended with actual implementations)
    snapshot.memory.websocketConnections = 0; // TODO: Get from websocket manager
    snapshot.memory.queuedMessages = 0; // TODO: Get from queue manager

  } catch (error: any) {
    console.error('[StateCapturer] Error capturing state:', error);
  }

  return snapshot;
}

/**
 * Compare two state snapshots and return differences
 */
export function compareStates(
  before: StateSnapshot,
  after: StateSnapshot
): {
  userChanges: any[];
  challengeChanges: any[];
  sessionChanges: any[];
  notificationChanges: any[];
} {
  return {
    userChanges: findChanges(before.database.users || [], after.database.users || [], 'id'),
    challengeChanges: findChanges(before.database.challenges || [], after.database.challenges || [], 'id'),
    sessionChanges: findChanges(before.database.liveGameSessions || [], after.database.liveGameSessions || [], 'id'),
    notificationChanges: findChanges(before.database.notifications || [], after.database.notifications || [], 'id'),
  };
}

/**
 * Find changes between two arrays of records
 */
function findChanges(before: any[], after: any[], idField: string): any[] {
  const changes: any[] = [];
  
  // Find new records
  for (const afterRecord of after) {
    const beforeRecord = before.find(b => b[idField] === afterRecord[idField]);
    if (!beforeRecord) {
      changes.push({
        type: 'created',
        record: afterRecord,
      });
    } else {
      // Find modified fields
      const modifications: any = {};
      for (const key of Object.keys(afterRecord)) {
        if (JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key])) {
          modifications[key] = {
            before: beforeRecord[key],
            after: afterRecord[key],
          };
        }
      }
      if (Object.keys(modifications).length > 0) {
        changes.push({
          type: 'modified',
          id: afterRecord[idField],
          modifications,
        });
      }
    }
  }

  // Find deleted records
  for (const beforeRecord of before) {
    const afterRecord = after.find(a => a[idField] === beforeRecord[idField]);
    if (!afterRecord) {
      changes.push({
        type: 'deleted',
        id: beforeRecord[idField],
      });
    }
  }

  return changes;
}

/**
 * Format state changes for readable output
 */
export function formatStateChanges(
  before: StateSnapshot,
  after: StateSnapshot
): string {
  const changes = compareStates(before, after);
  const lines: string[] = [];

  lines.push(`\n=== State Changes ===`);
  lines.push(`Time: ${before.timestamp.toISOString()} → ${after.timestamp.toISOString()}`);
  lines.push(`Duration: ${after.timestamp.getTime() - before.timestamp.getTime()}ms`);

  if (changes.userChanges.length > 0) {
    lines.push(`\nUser Changes (${changes.userChanges.length}):`);
    for (const change of changes.userChanges) {
      lines.push(`  - ${change.type}: ${JSON.stringify(change, null, 2)}`);
    }
  }

  if (changes.challengeChanges.length > 0) {
    lines.push(`\nChallenge Changes (${changes.challengeChanges.length}):`);
    for (const change of changes.challengeChanges) {
      lines.push(`  - ${change.type}: ${JSON.stringify(change, null, 2)}`);
    }
  }

  if (changes.sessionChanges.length > 0) {
    lines.push(`\nSession Changes (${changes.sessionChanges.length}):`);
    for (const change of changes.sessionChanges) {
      lines.push(`  - ${change.type}: ${JSON.stringify(change, null, 2)}`);
    }
  }

  if (changes.notificationChanges.length > 0) {
    lines.push(`\nNotification Changes (${changes.notificationChanges.length}):`);
    for (const change of changes.notificationChanges.slice(0, 5)) {
      lines.push(`  - ${change.type}`);
    }
  }

  return lines.join('\n');
}
