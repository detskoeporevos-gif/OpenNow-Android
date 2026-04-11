import { useEffect, useState } from "react";

/**
 * Hook that returns elapsed seconds since a given timestamp.
 * Updates on second boundaries to avoid excessive re-renders.
 * Only counts when `isRunning` is true.
 */
export function useElapsedSeconds(
  startTimeMs: number | null,
  isRunning: boolean
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || startTimeMs === null) {
      setElapsed(0);
      return;
    }

    // Calculate initial elapsed
    const now = Date.now();
    const initialElapsed = Math.max(0, Math.floor((now - startTimeMs) / 1000));
    setElapsed(initialElapsed);

    // Calculate time until next second boundary
    const elapsedMs = now - startTimeMs;
    const nextSecondBoundary = (Math.floor(elapsedMs / 1000) + 1) * 1000;
    const delayToNextBoundary = nextSecondBoundary - elapsedMs;

    let intervalId: number | null = null;

    // Schedule first update at the next second boundary
    const timeoutId = window.setTimeout(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000)));

      // Then update every second
      intervalId = window.setInterval(() => {
        setElapsed(Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000)));
      }, 1000);
    }, delayToNextBoundary);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [startTimeMs, isRunning]);

  return elapsed;
}
