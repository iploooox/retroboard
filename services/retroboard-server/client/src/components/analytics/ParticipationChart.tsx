import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ParticipationMember {
  userId: string;
  userName: string;
  totals: {
    cardsSubmitted: number;
    votesCast: number;
    actionItemsOwned: number;
    actionItemsCompleted: number;
    completionRate: number;
  };
  perSprint?: Array<{
    sprintId: string;
    sprintName: string;
    cardsSubmitted: number;
    votesCast: number;
  }>;
}

interface ParticipationChartProps {
  members: ParticipationMember[];
  teamAverages: {
    avgCardsPerMember: number;
    avgVotesPerMember: number;
    avgCompletionRate: number;
  };
  teamId: string;
}

export function ParticipationChart({ members, teamAverages, teamId }: ParticipationChartProps) {
  const [selectedSprint, setSelectedSprint] = useState<string>('all');
  const [sprints, setSprints] = useState<Array<{ sprintId: string; sprintName: string }>>([]);
  const [sprintMembers, setSprintMembers] = useState<ParticipationMember[]>(members);

  useEffect(() => {
    // Fetch available sprints for dropdown
    const fetchSprints = async () => {
      try {
        const response = await api.get<{
          sprints: Array<{ sprintId: string; sprintName: string }>;
        }>(`/teams/${teamId}/analytics/health?limit=20`);
        setSprints(response.sprints);
      } catch {
        // Silently fail - sprint selector will just show "All Time"
      }
    };
    if (teamId) fetchSprints();
  }, [teamId]);

  useEffect(() => {
    const fetchSprintData = async () => {
      if (selectedSprint === 'all') {
        setSprintMembers(members);
        return;
      }
      try {
        const response = await api.get<{
          members: ParticipationMember[];
        }>(`/teams/${teamId}/analytics/participation?sprintId=${selectedSprint}`);
        setSprintMembers(response.members);
      } catch {
        setSprintMembers(members);
      }
    };
    fetchSprintData();
  }, [selectedSprint, members, teamId]);

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No participation data available
      </div>
    );
  }

  const displayMembers = selectedSprint === 'all' ? members : sprintMembers;
  const maxValue = Math.max(...displayMembers.map((m) => m.totals.cardsSubmitted + m.totals.votesCast));

  return (
    <div>
      {/* Sprint selector */}
      <div className="mb-4">
        <select
          value={selectedSprint}
          onChange={(e) => setSelectedSprint(e.target.value)}
          className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Time (Aggregated)</option>
          {sprints.map((sprint) => (
            <option key={sprint.sprintId} value={sprint.sprintId}>
              {sprint.sprintName}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
        {displayMembers.map((member) => {
          const cardWidth = (member.totals.cardsSubmitted / maxValue) * 100;
          const voteWidth = (member.totals.votesCast / maxValue) * 100;
          const engagementScore = member.totals.cardsSubmitted + member.totals.votesCast + (member.totals.actionItemsOwned * 2);

          return (
            <div key={member.userId}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-700 font-medium truncate max-w-[120px]">
                  {member.userName}
                </span>
                <span className="text-slate-500 text-xs">
                  {member.totals.cardsSubmitted}c + {member.totals.votesCast}v | Score: {engagementScore}
                </span>
              </div>
              <div className="flex gap-1">
                <div
                  className="h-6 bg-blue-500 rounded-l"
                  style={{ width: `${cardWidth}%` }}
                  title={`${member.totals.cardsSubmitted} cards`}
                />
                <div
                  className="h-6 bg-green-500 rounded-r"
                  style={{ width: `${voteWidth}%` }}
                  title={`${member.totals.votesCast} votes`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>Cards</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span>Votes</span>
        </div>
      </div>

      {/* Summary */}
      <div className="pt-4 border-t border-slate-200 space-y-2">
        <div className="text-sm">
          <span className="text-slate-500">Team average: </span>
          <span className="font-semibold text-slate-900">
            {teamAverages.avgCardsPerMember.toFixed(1)} cards, {teamAverages.avgVotesPerMember.toFixed(1)} votes
          </span>
        </div>
        <div className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded p-2">
          <strong>Privacy Notice:</strong> Participation metrics are tracked to help improve team engagement.
          Individual metrics are only visible to team admins and facilitators.
        </div>
      </div>
    </div>
  );
}
