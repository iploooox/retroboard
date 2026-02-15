import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, AlertCircle, TrendingUp } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { ChartCard } from '@/components/analytics/ChartCard';
import { FilterBar } from '@/components/analytics/FilterBar';
import { HealthTrendChart } from '@/components/analytics/HealthTrendChart';
import { ParticipationChart } from '@/components/analytics/ParticipationChart';
import { SentimentChart } from '@/components/analytics/SentimentChart';
import { WordCloudViz } from '@/components/analytics/WordCloudViz';
import { CardDistributionChart } from '@/components/analytics/CardDistributionChart';
import { TopVotedCards } from '@/components/analytics/TopVotedCards';
import { ActionItemsSummary } from '@/components/analytics/ActionItemsSummary';

interface HealthDataPoint {
  sprintId: string;
  sprintName: string;
  healthScore: number;
  cardCount: number;
  totalMembers: number;
  activeMembers: number;
}

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
}

interface SentimentDataPoint {
  sprintId: string;
  sprintName: string;
  positiveCards: number;
  negativeCards: number;
  neutralCards: number;
  totalCards: number;
  sentimentByColumn?: Array<{
    columnId: string;
    columnName: string;
    averageSentiment: number;
    cardCount: number;
  }>;
}

interface WordFrequency {
  word: string;
  frequency: number;
  sentiment: number;
}

interface CardDistribution {
  columnId: string;
  columnName: string;
  count: number;
}

interface TopCard {
  cardId: string;
  text: string;
  votes: number;
  sentiment?: number;
}

interface ActionItems {
  total: number;
  open: number;
  inProgress: number;
  done: number;
  carriedOver: number;
  completionRate: number;
}

type SprintRangeOption = '5' | '10' | '20' | 'all';
type ViewMode = 'team' | 'sprint' | 'comparison';

export function AnalyticsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('team');
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  // TODO: Implement sprint comparison feature
  // const [comparisonSprintIds, setComparisonSprintIds] = useState<[string | null, string | null]>([null, null]);

  const [sprintRange, setSprintRange] = useState<SprintRangeOption>('10');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  const [healthData, setHealthData] = useState<HealthDataPoint[]>([]);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [participationMembers, setParticipationMembers] = useState<ParticipationMember[]>([]);
  const [teamAverages, setTeamAverages] = useState({
    avgCardsPerMember: 0,
    avgVotesPerMember: 0,
    avgCompletionRate: 0,
  });
  const [participationError, setParticipationError] = useState<string | null>(null);

  const [sentimentData, setSentimentData] = useState<SentimentDataPoint[]>([]);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  const [wordCloudData, setWordCloudData] = useState<WordFrequency[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [wordCloudError, setWordCloudError] = useState<string | null>(null);

  // Sprint-level data
  const [cardDistribution, setCardDistribution] = useState<CardDistribution[]>([]);
  const [topVotedCards, setTopVotedCards] = useState<TopCard[]>([]);
  const [actionItems, setActionItems] = useState<ActionItems | null>(null);
  const [sprintName, setSprintName] = useState<string>('');

  const handleExportCSV = () => {
    try {
      const rows: string[] = [];

      rows.push('Analytics Export,' + teamName);
      rows.push('Generated,' + new Date().toISOString());
      rows.push('');

      if (viewMode === 'sprint' && selectedSprintId) {
        rows.push('Sprint,' + sprintName);
        rows.push('');

        // Card distribution
        if (cardDistribution.length > 0) {
          rows.push('Card Distribution');
          rows.push('Column,Count');
          cardDistribution.forEach(d => rows.push(`${d.columnName},${d.count}`));
          rows.push('');
        }

        // Top voted cards
        if (topVotedCards.length > 0) {
          rows.push('Top Voted Cards');
          rows.push('Rank,Card Text,Votes');
          topVotedCards.forEach((c, i) => rows.push(`${i + 1},"${c.text.replace(/"/g, '""')}",${c.votes}`));
          rows.push('');
        }

        // Action items
        if (actionItems) {
          rows.push('Action Items');
          rows.push('Total,Open,In Progress,Done,Carried Over,Completion Rate');
          rows.push(`${actionItems.total},${actionItems.open},${actionItems.inProgress},${actionItems.done},${actionItems.carriedOver},${actionItems.completionRate}%`);
          rows.push('');
        }
      } else {
        // Team-wide export
        rows.push('Sprint Health Trend');
        rows.push('Sprint,Health Score,Cards,Active Members,Total Members');
        healthData.forEach(d => {
          rows.push(`${d.sprintName},${d.healthScore},${d.cardCount},${d.activeMembers},${d.totalMembers}`);
        });
        rows.push('');

        rows.push('Participation Metrics');
        rows.push('Member,Cards Submitted,Votes Cast,Action Items Owned,Action Items Completed,Completion Rate');
        participationMembers.forEach(m => {
          rows.push(`${m.userName},${m.totals.cardsSubmitted},${m.totals.votesCast},${m.totals.actionItemsOwned},${m.totals.actionItemsCompleted},${m.totals.completionRate}%`);
        });
        rows.push('');

        rows.push('Sentiment Distribution');
        rows.push('Sprint,Positive,Neutral,Negative,Total');
        sentimentData.forEach(d => {
          rows.push(`${d.sprintName},${d.positiveCards},${d.neutralCards},${d.negativeCards},${d.totalCards}`);
        });
        rows.push('');

        rows.push('Top Words');
        rows.push('Word,Frequency,Sentiment');
        wordCloudData.slice(0, 50).forEach(w => {
          rows.push(`${w.word},${w.frequency},${w.sentiment}`);
        });
      }

      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${teamName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    if (!teamId) return;

    const fetchTeamAnalytics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const teamResponse = await api.get<{ team: { id: string; name: string } }>(
          `/teams/${teamId}`
        );
        setTeamName(teamResponse.team.name);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load team data');
        }
        setIsLoading(false);
        return;
      }

      // Calculate limit based on sprint range
      const limit = sprintRange === 'all' ? 100 : parseInt(sprintRange, 10);

      // Health data
      try {
        const healthResponse = await api.get<{
          teamId: string;
          teamName: string;
          sprints: Array<{
            sprintId: string;
            sprintName: string;
            healthScore: number;
            cardCount: number;
            totalMembers: number;
            activeMembers: number;
          }>;
        }>(`/teams/${teamId}/analytics/health?limit=${limit}`);
        setHealthData(healthResponse.sprints);
        setHealthError(null);
      } catch {
        setHealthError('Failed to load health data');
      }

      // Participation data
      try {
        const participationResponse = await api.get<{
          members: Array<{
            userId: string;
            userName: string;
            totals: {
              cardsSubmitted: number;
              votesCast: number;
              actionItemsOwned: number;
              actionItemsCompleted: number;
              completionRate: number;
            };
          }>;
          teamAverages: {
            avgCardsPerMember: number;
            avgVotesPerMember: number;
            avgCompletionRate: number;
          };
        }>(`/teams/${teamId}/analytics/participation?limit=${limit}`);
        setParticipationMembers(participationResponse.members);
        setTeamAverages(participationResponse.teamAverages);
        setParticipationError(null);
      } catch {
        setParticipationError('Failed to load participation data');
      }

      // Sentiment data
      try {
        const sentimentResponse = await api.get<{
          sprints: Array<{
            sprintId: string;
            sprintName: string;
            positiveCards: number;
            negativeCards: number;
            neutralCards: number;
            totalCards: number;
          }>;
        }>(`/teams/${teamId}/analytics/sentiment?limit=${limit}`);
        setSentimentData(sentimentResponse.sprints);
        setSentimentError(null);
      } catch {
        setSentimentError('Failed to load sentiment data');
      }

      // Word cloud data
      try {
        const wordCloudResponse = await api.get<{
          words: Array<{
            word: string;
            frequency: number;
            sentiment: number;
          }>;
          totalCards: number;
        }>(`/teams/${teamId}/analytics/word-cloud?limit=100`);
        setWordCloudData(wordCloudResponse.words);
        setTotalCards(wordCloudResponse.totalCards);
        setWordCloudError(null);
      } catch {
        setWordCloudError('Failed to load word cloud data');
      }

      setIsLoading(false);
    };

    const fetchSprintAnalytics = async (sprintId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<{
          sprintId: string;
          sprintName: string;
          teamId: string;
          teamName: string;
          cards: {
            total: number;
            byColumn: Array<{ columnId: string; columnName: string; count: number }>;
          };
          sentiment: {
            topPositiveCards: Array<{ cardId: string; text: string; sentiment: number; votes: number }>;
            topNegativeCards: Array<{ cardId: string; text: string; sentiment: number; votes: number }>;
          };
          actionItems: {
            total: number;
            open: number;
            inProgress: number;
            done: number;
            carriedOver: number;
            completionRate: number;
          };
          wordCloud: Array<{ word: string; frequency: number; sentiment: number }>;
        }>(`/sprints/${sprintId}/analytics`);

        setSprintName(response.sprintName);
        setTeamName(response.teamName);
        setCardDistribution(response.cards.byColumn);
        setTopVotedCards([...response.sentiment.topPositiveCards, ...response.sentiment.topNegativeCards].sort((a, b) => b.votes - a.votes));
        setActionItems(response.actionItems);
        setWordCloudData(response.wordCloud);
        setTotalCards(response.cards.total);

        // Also fetch sentiment with column breakdown
        try {
          const sentimentResponse = await api.get<{
            sprints: Array<{
              sprintId: string;
              sprintName: string;
              positiveCards: number;
              negativeCards: number;
              neutralCards: number;
              totalCards: number;
              sentimentByColumn: Array<{
                columnId: string;
                columnName: string;
                averageSentiment: number;
                cardCount: number;
              }>;
            }>;
          }>(`/teams/${response.teamId}/analytics/sentiment?limit=1`);
          if (sentimentResponse.sprints.length > 0) {
            setSentimentData(sentimentResponse.sprints);
          }
        } catch {
          // Silent fail
        }

        setIsLoading(false);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load sprint analytics');
        }
        setIsLoading(false);
      }
    };

    // Check URL params for sprint view
    const sprintParam = searchParams.get('sprint');
    if (sprintParam) {
      setViewMode('sprint');
      setSelectedSprintId(sprintParam);
      fetchSprintAnalytics(sprintParam);
    } else {
      setViewMode('team');
      setSelectedSprintId(null);
      fetchTeamAnalytics();
    }
  }, [teamId, sprintRange, searchParams]);

  const handleSprintSelect = (sprintId: string) => {
    setSearchParams({ sprint: sprintId });
  };

  const handleBackToTeam = () => {
    setSearchParams({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-slate-700 mb-2">{error}</h2>
        <Link to={`/teams/${teamId}`} className="text-sm text-indigo-600 hover:underline">
          Back to Team
        </Link>
      </div>
    );
  }

  const hasEnoughData = healthData.length >= 3 || viewMode === 'sprint';

  return (
    <div>
      <Link
        to={`/teams/${teamId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Team
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        </div>
        <p className="text-slate-500">{teamName}{viewMode === 'sprint' && sprintName ? ` - ${sprintName}` : ''}</p>
      </div>

      {/* View mode selector */}
      {viewMode === 'team' && healthData.length > 0 && (
        <div className="mb-4">
          <label htmlFor="sprint-selector" className="block text-sm font-medium text-slate-700 mb-2">
            View:
          </label>
          <select
            id="sprint-selector"
            onChange={(e) => {
              if (e.target.value) {
                handleSprintSelect(e.target.value);
              }
            }}
            className="text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Team Overview (Multi-Sprint)</option>
            {healthData.map((sprint) => (
              <option key={sprint.sprintId} value={sprint.sprintId}>
                {sprint.sprintName} - Detailed View
              </option>
            ))}
          </select>
        </div>
      )}

      {viewMode === 'sprint' && (
        <button
          onClick={handleBackToTeam}
          className="mb-4 text-sm text-indigo-600 hover:underline"
        >
          ← Back to Team Overview
        </button>
      )}

      {hasEnoughData && (
        <FilterBar
          onExportCSV={handleExportCSV}
          sprintRange={sprintRange}
          onSprintRangeChange={viewMode === 'team' ? setSprintRange : undefined}
          dateRange={dateRange}
          onDateRangeChange={viewMode === 'team' ? setDateRange : undefined}
        />
      )}

      {!hasEnoughData && viewMode === 'team' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <TrendingUp className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">
            Not enough data yet for analytics
          </h2>
          <p className="text-slate-500 mb-4">
            Complete at least 3 retrospectives to see trends and insights for your team.
          </p>
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
              <span>Sprints completed: {healthData.length} of 3 minimum</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min((healthData.length / 3) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : viewMode === 'sprint' ? (
        /* Sprint-level detailed view */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Card Distribution" helpText="Number of cards per column">
            <CardDistributionChart data={cardDistribution} />
          </ChartCard>

          <ChartCard title="Top Voted Cards" helpText="Cards with the most votes">
            <TopVotedCards cards={topVotedCards} limit={10} />
          </ChartCard>

          <ChartCard title="Action Items Summary" helpText="Status and completion of action items">
            {actionItems ? (
              <ActionItemsSummary {...actionItems} />
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-400">
                No action items data
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Sentiment by Column"
            helpText="Average sentiment per board column"
          >
            {sentimentError ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>{sentimentError}</p>
                </div>
              </div>
            ) : (
              <SentimentChart data={sentimentData} showColumnBreakdown={true} />
            )}
          </ChartCard>

          <ChartCard
            title="Word Cloud"
            span="full"
            helpText="Most frequently mentioned words from this sprint"
          >
            {wordCloudError ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>{wordCloudError}</p>
                </div>
              </div>
            ) : (
              <WordCloudViz words={wordCloudData} totalCards={totalCards} />
            )}
          </ChartCard>
        </div>
      ) : (
        /* Team-wide multi-sprint view */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Sprint Health Trend"
            span="full"
            helpText="Health score is a composite of participation, sentiment, and engagement metrics"
          >
            {healthError ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>{healthError}</p>
                </div>
              </div>
            ) : (
              <HealthTrendChart data={healthData} />
            )}
          </ChartCard>

          <ChartCard
            title="Participation"
            helpText="Cards submitted and votes cast per team member"
          >
            {participationError ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>{participationError}</p>
                </div>
              </div>
            ) : (
              <ParticipationChart
                members={participationMembers}
                teamAverages={teamAverages}
                teamId={teamId || ''}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Sentiment Distribution"
            helpText="Breakdown of positive, neutral, and negative cards per sprint"
          >
            {sentimentError ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>{sentimentError}</p>
                </div>
              </div>
            ) : (
              <SentimentChart data={sentimentData} showColumnBreakdown={false} />
            )}
          </ChartCard>

          <ChartCard
            title="Word Cloud"
            span="full"
            helpText="Most frequently mentioned words from retrospective cards"
          >
            {wordCloudError ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>{wordCloudError}</p>
                </div>
              </div>
            ) : (
              <WordCloudViz words={wordCloudData} totalCards={totalCards} />
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
