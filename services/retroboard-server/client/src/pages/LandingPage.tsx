import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BarChart,
  Target,
  Download,
  CheckCircle,
} from 'lucide-react';

interface StatsData {
  teams: number;
  retros: number;
  cards: number;
  actionItems: number;
}

export function LandingPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch('/api/v1/stats', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
      })
      .then((json) => {
        const d = json.data;
        if (d && typeof d.teams === 'number' && typeof d.retros === 'number' && typeof d.cards === 'number') {
          setStats(d);
        } else {
          throw new Error('Invalid stats data');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          setError('Stats temporarily unavailable');
        } else {
          setError('Stats temporarily unavailable');
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        setIsLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-indigo-50 via-white to-slate-50 py-20 px-4 sm:py-32">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-6">
            Retrospectives that actually drive improvement
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            Run effective retrospectives with your team using proven templates and
            real-time collaboration
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg shadow-md text-lg font-semibold transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="py-20 px-4 bg-white" aria-label="Features">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Why RetroBoard Pro?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<LayoutDashboard className="h-12 w-12 text-indigo-600" aria-hidden="true" />}
              title="6 Retro Templates"
              description="Choose from Start/Stop/Continue, Mad/Sad/Glad, 4Ls, Sailboat, Rose/Thorn/Bud, and Icebreaker to fit your team's needs"
            />
            <FeatureCard
              icon={<Users className="h-12 w-12 text-indigo-600" aria-hidden="true" />}
              title="Real-Time Collaboration"
              description="See everyone's cards update live with WebSocket-powered sync. No refreshing, no delays."
            />
            <FeatureCard
              icon={<BarChart className="h-12 w-12 text-indigo-600" aria-hidden="true" />}
              title="Analytics Dashboard"
              description="Track team progress with insights on participation, sentiment, and action item completion rates"
            />
            <FeatureCard
              icon={<Target className="h-12 w-12 text-indigo-600" aria-hidden="true" />}
              title="Facilitation Tools"
              description="Built-in timer, voting, grouping, and phase management to keep your retro focused and productive"
            />
            <FeatureCard
              icon={<Download className="h-12 w-12 text-indigo-600" aria-hidden="true" />}
              title="Export Options"
              description="Export retro results to PDF, CSV, or Markdown for your records and stakeholder reports"
            />
            <FeatureCard
              icon={<CheckCircle className="h-12 w-12 text-indigo-600" aria-hidden="true" />}
              title="Action Items"
              description="Track follow-up tasks and ensure commitments are kept with integrated action item management"
            />
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 bg-slate-900" aria-label="Statistics">
        <div className="max-w-5xl mx-auto px-4">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8" aria-live="polite">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="animate-pulse bg-slate-700 h-12 w-32 rounded mx-auto mb-2" />
                  <div className="animate-pulse bg-slate-700 h-4 w-40 rounded mx-auto" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center" role="alert">
              <p className="text-sm text-slate-400">{error}</p>
            </div>
          )}

          {!isLoading && !error && stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Stat
                value={stats.teams}
                label="Teams using RetroBoard"
              />
              <Stat
                value={stats.retros}
                label="Retrospectives completed"
              />
              <Stat
                value={stats.cards}
                label="Cards created"
              />
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 text-sm">
            <Link
              to="/login"
              className="text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Login
            </Link>
            <span className="text-slate-400">•</span>
            <Link
              to="/register"
              className="text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const formatted = new Intl.NumberFormat('en-US').format(value);

  return (
    <div className="text-center">
      <div className="text-5xl font-bold text-indigo-400 mb-2">{formatted}</div>
      <div className="text-sm text-slate-300">{label}</div>
    </div>
  );
}
