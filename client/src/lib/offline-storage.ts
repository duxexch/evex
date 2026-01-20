/**
 * Offline Storage Service
 * Caches challenge data for offline access
 */

import React from "react";
import { Challenge } from "@/lib/challenges-api";

const STORAGE_KEYS = {
  MY_CHALLENGES: "challenges_my",
  AVAILABLE_CHALLENGES: "challenges_available",
  PUBLIC_CHALLENGES: "challenges_public",
  CHALLENGES_TIMESTAMP: "challenges_timestamp",
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const offlineStorage = {
  /**
   * Save challenges to localStorage
   */
  saveMyChallenges(challenges: Challenge[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MY_CHALLENGES, JSON.stringify(challenges));
      localStorage.setItem(STORAGE_KEYS.CHALLENGES_TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.error("[Offline Storage] Failed to save my challenges:", error);
    }
  },

  saveAvailableChallenges(challenges: Challenge[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AVAILABLE_CHALLENGES, JSON.stringify(challenges));
      localStorage.setItem(STORAGE_KEYS.CHALLENGES_TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.error("[Offline Storage] Failed to save available challenges:", error);
    }
  },

  savePublicChallenges(challenges: Challenge[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PUBLIC_CHALLENGES, JSON.stringify(challenges));
      localStorage.setItem(STORAGE_KEYS.CHALLENGES_TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.error("[Offline Storage] Failed to save public challenges:", error);
    }
  },

  /**
   * Retrieve challenges from localStorage
   */
  getMyChallenges(): Challenge[] | null {
    try {
      const timestamp = localStorage.getItem(STORAGE_KEYS.CHALLENGES_TIMESTAMP);
      if (timestamp && Date.now() - parseInt(timestamp) > CACHE_TTL) {
        return null; // Cache expired
      }
      const data = localStorage.getItem(STORAGE_KEYS.MY_CHALLENGES);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("[Offline Storage] Failed to retrieve my challenges:", error);
      return null;
    }
  },

  getAvailableChallenges(): Challenge[] | null {
    try {
      const timestamp = localStorage.getItem(STORAGE_KEYS.CHALLENGES_TIMESTAMP);
      if (timestamp && Date.now() - parseInt(timestamp) > CACHE_TTL) {
        return null;
      }
      const data = localStorage.getItem(STORAGE_KEYS.AVAILABLE_CHALLENGES);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("[Offline Storage] Failed to retrieve available challenges:", error);
      return null;
    }
  },

  getPublicChallenges(): Challenge[] | null {
    try {
      const timestamp = localStorage.getItem(STORAGE_KEYS.CHALLENGES_TIMESTAMP);
      if (timestamp && Date.now() - parseInt(timestamp) > CACHE_TTL) {
        return null;
      }
      const data = localStorage.getItem(STORAGE_KEYS.PUBLIC_CHALLENGES);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("[Offline Storage] Failed to retrieve public challenges:", error);
      return null;
    }
  },

  /**
   * Clear all challenge cache
   */
  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.MY_CHALLENGES);
      localStorage.removeItem(STORAGE_KEYS.AVAILABLE_CHALLENGES);
      localStorage.removeItem(STORAGE_KEYS.PUBLIC_CHALLENGES);
      localStorage.removeItem(STORAGE_KEYS.CHALLENGES_TIMESTAMP);
    } catch (error) {
      console.error("[Offline Storage] Failed to clear cache:", error);
    }
  },

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  },
};

/**
 * Hook to handle offline/online transitions
 */
export function useOfflineSync() {
  const handleOnline = () => {
    console.log("[Offline] Device came online - syncing data");
    // Invalidate queries to refetch latest data
    window.dispatchEvent(new CustomEvent("offline-sync"));
  };

  const handleOffline = () => {
    console.log("[Offline] Device went offline - using cached data");
  };

  React.useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
}
