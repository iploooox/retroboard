import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerDisplayProps {
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
}

export function TimerDisplay({
  durationSeconds,
  remainingSeconds,
  isRunning,
  isPaused,
}: TimerDisplayProps) {
  const [displaySeconds, setDisplaySeconds] = useState(remainingSeconds);

  // Client-side countdown when running
  useEffect(() => {
    if (!isRunning || isPaused) {
      setDisplaySeconds(remainingSeconds);
      return;
    }

    setDisplaySeconds(remainingSeconds);
    const startTime = Date.now();
    const initialRemaining = remainingSeconds;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const newRemaining = Math.max(0, initialRemaining - elapsed);
      setDisplaySeconds(newRemaining);

      if (newRemaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, remainingSeconds]);

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Color coding based on time remaining
  const percentRemaining = (displaySeconds / durationSeconds) * 100;
  const colorClass =
    displaySeconds === 0
      ? 'text-red-600 bg-red-50 animate-pulse'
      : percentRemaining < 20
        ? 'text-red-600 bg-red-50'
        : percentRemaining < 50
          ? 'text-yellow-600 bg-yellow-50'
          : 'text-green-600 bg-green-50';

  const statusClass = isPaused
    ? 'text-yellow-600 bg-yellow-50'
    : !isRunning
      ? 'text-slate-500 bg-slate-50'
      : colorClass;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusClass} transition-colors`}
      role="timer"
      aria-live="polite"
      aria-label={`Timer: ${timeString}`}
    >
      <Clock className="h-4 w-4" />
      <span className="font-mono text-sm font-medium">{timeString}</span>
    </div>
  );
}
