import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/lib/toast';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isSubmitting, loginError, fieldErrors, clearErrors } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!email.trim()) errors['email'] = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors['email'] = 'Enter a valid email address';
    if (!password) errors['password'] = 'Password is required';
    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!validate()) return;

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch {
      // Error state is handled by the store
    }
  };

  const allErrors = { ...localErrors, ...fieldErrors };

  return (
    <AuthLayout>
      <div className="flex mb-6" role="tablist">
        <Link
          to="/login"
          role="tab"
          aria-selected="true"
          className="flex-1 text-center py-2 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600"
        >
          Login
        </Link>
        <Link
          to="/register"
          role="tab"
          aria-selected="false"
          className="flex-1 text-center py-2 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-700"
        >
          Register
        </Link>
      </div>

      {loginError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm">{loginError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} aria-label="Login form" className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setLocalErrors((p) => { const { email: _, ...rest } = p; return rest; }); }}
          error={allErrors['email']}
          autoComplete="email"
          required
        />

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLocalErrors((p) => { const { password: _, ...rest } = p; return rest; }); }}
              autoComplete="current-password"
              className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                allErrors['password'] ? 'border-red-300' : 'border-slate-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {allErrors['password'] && (
            <p className="text-sm text-red-600">{allErrors['password']}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => toast.info('Password reset coming soon!')}
          className="text-sm text-slate-500 hover:text-indigo-600"
        >
          Forgot password?
        </button>

        <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
          Log In
        </Button>
      </form>
    </AuthLayout>
  );
}
