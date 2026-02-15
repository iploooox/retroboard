import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, Sparkles, Users, UserPlus, Calendar, Rocket } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';

type OnboardingStep = 'welcome' | 'create_team' | 'invite_members' | 'create_sprint' | 'start_retro';

const STEPS: { id: OnboardingStep; title: string; icon: typeof Sparkles }[] = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'create_team', title: 'Create Team', icon: Users },
  { id: 'invite_members', title: 'Invite Members', icon: UserPlus },
  { id: 'create_sprint', title: 'Create Sprint', icon: Calendar },
  { id: 'start_retro', title: 'Start Retro', icon: Rocket },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Team creation state
  const [teamName, setTeamName] = useState('');
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Sprint creation state
  const [sprintName, setSprintName] = useState('');
  const [createdSprintId, setCreatedSprintId] = useState<string | null>(null);

  // Load onboarding progress
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const response = await api.get<{ ok: boolean; data: { currentStep?: string; completedSteps?: string[] } | null }>(
          '/users/me/onboarding'
        );
        if (response.data) {
          if (response.data.currentStep) {
            setCurrentStep(response.data.currentStep as OnboardingStep);
          }
          if (response.data.completedSteps) {
            setCompletedSteps(response.data.completedSteps as OnboardingStep[]);
          }
        }
      } catch {
        // Use default state
      } finally {
        setIsLoading(false);
      }
    };
    loadProgress();
  }, []);

  const saveProgress = async (step: OnboardingStep, action: 'complete' | 'skip' = 'complete') => {
    try {
      await api.patch('/users/me/onboarding', {
        step: step,
        action: action,
      });
    } catch {
      // Silent fail
    }
  };

  const completeOnboarding = async () => {
    setIsSaving(true);
    try {
      await api.post('/users/me/onboarding/complete', {});

      // Show confetti celebration
      setShowConfetti(true);
      toast.success('Onboarding complete! Welcome to RetroBoard Pro 🎉');

      // Wait for confetti animation before navigating
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch {
      toast.error('Failed to complete onboarding');
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1]!.id;
      setCurrentStep(nextStep);
      setCompletedSteps([...completedSteps, currentStep]);
      await saveProgress(nextStep);
    } else {
      // Complete onboarding
      await completeOnboarding();
    }
  };

  const handleSkip = async () => {
    // Mark current step as skipped
    await saveProgress(currentStep, 'skip');
    navigate('/dashboard');
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post<{ ok: boolean; data: { id: string; name: string } }>('/teams', {
        name: teamName,
      });
      setCreatedTeamId(response.data.id);

      // Generate invite link
      try {
        const inviteResponse = await api.post<{ ok: boolean; data: { token: string } }>(
          `/teams/${response.data.id}/invites`,
          { role: 'member' }
        );
        const link = `${window.location.origin}/invite/${inviteResponse.data.token}`;
        setInviteLink(link);
      } catch {
        // Continue even if invite generation fails
      }

      toast.success('Team created successfully!');
      await saveProgress('create_team');
      handleNext();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create team');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied to clipboard!');
    }
  };

  const handleCreateSprint = async () => {
    if (!sprintName.trim()) {
      toast.error('Please enter a sprint name');
      return;
    }

    if (!createdTeamId) {
      toast.error('No team found. Please create a team first.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post<{ ok: boolean; data: { id: string; name: string } }>(
        `/teams/${createdTeamId}/sprints`,
        { name: sprintName }
      );
      setCreatedSprintId(response.data.id);
      toast.success('Sprint created successfully!');
      await saveProgress('create_sprint');
      handleNext();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create sprint');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartRetro = () => {
    if (createdTeamId && createdSprintId) {
      navigate(`/teams/${createdTeamId}/sprints/${createdSprintId}/board`);
      completeOnboarding();
    } else {
      toast.error('Please complete all previous steps first');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = currentStep === step.id;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                    </div>
                    <p
                      className={`text-xs mt-2 font-medium ${
                        isCurrent ? 'text-indigo-700' : 'text-slate-500'
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded-full transition-colors ${
                        isCompleted ? 'bg-green-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {currentStep === 'welcome' && (
            <div className="text-center">
              <Sparkles className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-slate-900 mb-3">Welcome to RetroBoard Pro!</h1>
              <p className="text-lg text-slate-600 mb-6">
                Let's get you set up with your first retrospective board. This will only take a minute.
              </p>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-indigo-900 mb-2">What you'll do:</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Create your team workspace</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Invite your team members</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Set up your first sprint</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Start your first retro board</span>
                  </li>
                </ul>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                You can skip this setup and explore on your own anytime.
              </p>
            </div>
          )}

          {currentStep === 'create_team' && (
            <div>
              <Users className="h-12 w-12 text-indigo-600 mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Create Your Team</h2>
              <p className="text-slate-600 mb-6">
                A team is your workspace where you'll run retrospectives. Give it a name that represents your team.
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="team-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Team Name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g., Engineering Team, Product Squad, etc."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTeam();
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'invite_members' && (
            <div>
              <UserPlus className="h-12 w-12 text-indigo-600 mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Invite Your Team</h2>
              <p className="text-slate-600 mb-6">
                Share this invite link with your team members so they can join and collaborate on retrospectives.
              </p>
              {inviteLink ? (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-indigo-900 mb-2">Your invite link:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                      <Button type="button" size="sm" onClick={handleCopyInviteLink}>
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-sm text-slate-600">
                      💡 You can also invite members later from your team settings page.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Unable to generate invite link. You can create invite links from your team settings later.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 'create_sprint' && (
            <div>
              <Calendar className="h-12 w-12 text-indigo-600 mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Create Your Sprint</h2>
              <p className="text-slate-600 mb-6">
                Sprints help you organize your retrospectives by time period. Name it after your current iteration.
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="sprint-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Sprint Name
                  </label>
                  <input
                    id="sprint-name"
                    type="text"
                    value={sprintName}
                    onChange={(e) => setSprintName(e.target.value)}
                    placeholder="e.g., Sprint 1, Q1 2024, Jan 15-29, etc."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateSprint();
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'start_retro' && (
            <div className="text-center">
              <Rocket className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-3">You're All Set! 🎉</h2>
              <p className="text-lg text-slate-600 mb-6">
                Your team and sprint are ready. Click below to start your first retrospective board!
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-green-900 mb-2">What's next:</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Your board will open with three columns: What Went Well, What Needs Improvement, Action Items</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Invite team members to collaborate in real-time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Follow the guided phases: Write → Group → Vote → Discuss → Action</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
              Skip for now
            </Button>
            <div className="flex gap-3">
              {currentStepIndex > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const prevStep = STEPS[currentStepIndex - 1]!.id;
                    setCurrentStep(prevStep);
                  }}
                  disabled={isSaving}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {currentStep === 'welcome' && (
                <Button onClick={handleNext} disabled={isSaving}>
                  Get Started
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {currentStep === 'create_team' && (
                <Button onClick={handleCreateTeam} isLoading={isSaving}>
                  Create Team
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {currentStep === 'invite_members' && (
                <Button onClick={handleNext} disabled={isSaving}>
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {currentStep === 'create_sprint' && (
                <Button onClick={handleCreateSprint} isLoading={isSaving}>
                  Create Sprint
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {currentStep === 'start_retro' && (
                <Button onClick={handleStartRetro} isLoading={isSaving}>
                  Start First Retro
                  <Rocket className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* User info */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Logged in as <span className="font-medium">{user?.display_name}</span>
        </p>
      </div>

      {/* Confetti Celebration */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'][
                    Math.floor(Math.random() * 5)
                  ],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}
