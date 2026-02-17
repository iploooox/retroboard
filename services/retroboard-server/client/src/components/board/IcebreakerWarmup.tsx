import { Sparkles } from 'lucide-react';

interface IcebreakerWarmupProps {
  boardId: string;
  teamId: string;
}

/**
 * Fullscreen icebreaker warmup phase component.
 * Renders when board.phase === 'icebreaker'.
 * Placeholder skeleton -- full wall implementation comes in S-002 through S-007.
 */
export function IcebreakerWarmup({ boardId: _boardId, teamId: _teamId }: IcebreakerWarmupProps) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-4"
      data-testid="icebreaker-warmup"
    >
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="flex items-center justify-center">
          <Sparkles className="h-12 w-12 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Icebreaker Warmup
        </h2>
        <p className="text-slate-600">
          Waiting for the facilitator to pick an icebreaker question.
          Take a moment to settle in while the session gets started.
        </p>
      </div>
    </div>
  );
}
