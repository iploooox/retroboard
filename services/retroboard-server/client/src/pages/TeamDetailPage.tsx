import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Settings, AlertCircle, ChevronLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { MembersTab } from '@/components/teams/MembersTab';
import { SprintsTab } from '@/components/teams/SprintsTab';
import { SettingsTab } from '@/components/teams/SettingsTab';

interface Team {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  your_role: string;
  created_at: string;
  icebreaker_enabled?: boolean;
  icebreaker_default_category?: string | null;
  icebreaker_timer_seconds?: number | null;
}

const roleBadgeVariant = {
  admin: 'purple' as const,
  facilitator: 'blue' as const,
  member: 'gray' as const,
};

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'sprints';

  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = async () => {
    if (!teamId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ team: Team }>(`/teams/${teamId}`);
      setTeam(data.team);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === 'TEAM_NOT_FOUND' ? 'Team not found' : err.message);
      } else {
        setError('Failed to load team');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTeam(); }, [teamId]);

  const setTab = (tab: string) => {
    // Navigate to dedicated analytics page instead of showing as tab
    if (tab === 'analytics') {
      navigate(`/teams/${teamId}/analytics`);
      return;
    }
    setSearchParams({ tab });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-slate-700 mb-2">{error || 'Team not found'}</h2>
        <Link to="/dashboard" className="text-sm text-indigo-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isAdmin = team.your_role === 'admin';
  const isFacilitatorOrAdmin = team.your_role === 'admin' || team.your_role === 'facilitator';

  const tabs = [
    { id: 'sprints', label: 'Sprints' },
    { id: 'members', label: 'Members' },
    { id: 'analytics', label: 'Analytics' },
    ...(isAdmin ? [{ id: 'settings', label: 'Settings' }] : []),
  ];

  return (
    <div>
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
              {team.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{team.name}</h1>
              {team.description && (
                <p className="text-sm text-slate-500 mt-1">{team.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                <span>{team.member_count} {team.member_count === 1 ? 'member' : 'members'}</span>
                <Badge variant={roleBadgeVariant[team.your_role as keyof typeof roleBadgeVariant] || 'gray'}>
                  {team.your_role}
                </Badge>
              </div>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setTab('settings')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              aria-label="Team settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200 mb-6" role="tablist">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {activeTab === 'sprints' && (
          <SprintsTab teamId={team.id} canCreate={isFacilitatorOrAdmin} />
        )}
        {activeTab === 'members' && (
          <MembersTab teamId={team.id} userRole={team.your_role} />
        )}
        {activeTab === 'analytics' && (
          <div className="text-center py-8 text-slate-500">
            Redirecting to analytics...
          </div>
        )}
        {activeTab === 'settings' && isAdmin && (
          <SettingsTab team={team} onUpdated={fetchTeam} />
        )}
      </div>
    </div>
  );
}
