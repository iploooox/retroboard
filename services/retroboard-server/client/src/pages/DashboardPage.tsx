import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, AlertCircle, Clock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/Button';
// Spinner component not currently used
import { CreateTeamModal } from '@/components/teams/CreateTeamModal';

interface Team {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  your_role: string;
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchTeams = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ teams: Team[] }>('/teams');
      setTeams(data.teams);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTeams(); }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting()}, {user?.display_name?.split(' ')[0]}!
        </h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Create Team
        </Button>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          My Teams
        </h2>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-slate-100 rounded w-1/3 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={fetchTeams} className="text-sm text-red-600 underline mt-1">
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && teams.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">
              You're not on any teams yet.
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Create a team to start running retrospectives.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              Create Your First Team
            </Button>
          </div>
        )}

        {!isLoading && !error && teams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComingSoonPanel title="Recent Activity" icon={<Clock className="h-5 w-5" />} />
        <ComingSoonPanel title="Action Items" icon={<AlertCircle className="h-5 w-5" />} />
      </div>

      <CreateTeamModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => { setShowCreateModal(false); fetchTeams(); }}
      />
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const initials = team.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link
      to={`/teams/${team.id}`}
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold text-sm shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
            {team.name}
          </h3>
          {team.description && (
            <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{team.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
        </span>
        <span className="capitalize">{team.your_role}</span>
      </div>
    </Link>
  );
}

function ComingSoonPanel({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-slate-400">{icon}</span>
        <h3 className="font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="text-center py-8">
        <p className="text-sm text-slate-400">Coming soon</p>
      </div>
    </div>
  );
}
