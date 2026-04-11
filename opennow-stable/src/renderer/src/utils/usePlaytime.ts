import { useCallback } from "react";

interface PlaytimeSession {
  gameId: string;
  startTime: number;
  endTime?: number;
}

interface GamePlaytimeStats {
  totalSeconds: number;
  sessionCount: number;
  lastPlayed: number;
}

interface PlaytimeData {
  currentSession: PlaytimeSession | null;
  stats: Record<string, GamePlaytimeStats>;
}

const STORAGE_KEY = "opennow_playtime_v1";

function loadPlaytimeData(): PlaytimeData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PlaytimeData;
      return {
        currentSession: null, // Always reset current session on load
        stats: parsed.stats || {},
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { currentSession: null, stats: {} };
}

function savePlaytimeData(data: PlaytimeData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function usePlaytime() {
  const startSession = useCallback((gameId: string): void => {
    const data = loadPlaytimeData();
    data.currentSession = {
      gameId,
      startTime: getNowSeconds(),
    };
    savePlaytimeData(data);
  }, []);

  const endSession = useCallback((gameId: string): void => {
    const data = loadPlaytimeData();
    if (data.currentSession && data.currentSession.gameId === gameId) {
      const endTime = getNowSeconds();
      const sessionDuration = endTime - data.currentSession.startTime;

      if (sessionDuration > 0) {
        const existing = data.stats[gameId] || {
          totalSeconds: 0,
          sessionCount: 0,
          lastPlayed: 0,
        };

        data.stats[gameId] = {
          totalSeconds: existing.totalSeconds + sessionDuration,
          sessionCount: existing.sessionCount + 1,
          lastPlayed: endTime,
        };
      }

      data.currentSession = null;
      savePlaytimeData(data);
    }
  }, []);

  const getPlaytimeStats = useCallback((gameId: string): GamePlaytimeStats | null => {
    const data = loadPlaytimeData();
    return data.stats[gameId] || null;
  }, []);

  const formatPlaytime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }, []);

  return {
    startSession,
    endSession,
    getPlaytimeStats,
    formatPlaytime,
  };
}
