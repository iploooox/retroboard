import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Users, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { AuthLayout } from '@/components/layout/AuthLayout';

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!token) return;
    setIsJoining(true);
    setError(null);
    try {
      const data = await api.post<{ team: { id: string; name: string } }>(`/teams/join/${token}`);
      toast.success(`Joined ${data.team.name}!`);
      navigate(`/teams/${data.team.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'TEAM_MEMBER_EXISTS') {
          toast.info('You are already a member of this team');
          navigate('/dashboard', { replace: true });
          return;
        }
        setError(err.message);
      } else {
        setError('Failed to join team');
      }
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    // Auto-join if authenticated
    if (isAuthenticated && token && !error) {
      handleJoin();
    }
  }, [isAuthenticated, token]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthLayout>
        <div className="text-center">
          <Users className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            You've been invited to a team!
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Log in or create an account to join.
          </p>
          <div className="flex flex-col gap-3">
            <Link to={`/login?redirect=/invite/${token}`}>
              <Button className="w-full">Log in to join</Button>
            </Link>
            <Link to={`/register?redirect=/invite/${token}`}>
              <Button variant="secondary" className="w-full">
                Create account
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Unable to join</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <Link to="/dashboard">
            <Button variant="secondary">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Spinner className="h-8 w-8 text-indigo-600 mx-auto mb-4" />
        <p className="text-sm text-slate-500">Joining team...</p>
      </div>
    </div>
  );
}
