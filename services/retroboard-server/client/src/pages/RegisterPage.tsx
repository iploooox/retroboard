import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isSubmitting, registerError, fieldErrors, clearErrors } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const clearField = (field: string) => {
    setLocalErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    const trimmedName = displayName.trim();
    if (!trimmedName) errors['display_name'] = 'Display name is required';
    else if (trimmedName.length < 2) errors['display_name'] = 'Display name must be at least 2 characters';
    else if (trimmedName.length > 50) errors['display_name'] = 'Display name must be 50 characters or fewer';

    if (!email.trim()) errors['email'] = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors['email'] = 'Enter a valid email address';

    if (!password) errors['password'] = 'Password is required';
    else if (password.length < 8) errors['password'] = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      errors['password'] = 'Password must contain an uppercase letter, a lowercase letter, and a digit';
    }

    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!validate()) return;

    try {
      await register(email, password, displayName.trim());
      navigate('/dashboard', { replace: true });
    } catch {
      // Error state handled by store
    }
  };

  const allErrors = { ...localErrors, ...fieldErrors };

  return (
    <AuthLayout>
      <div className="flex mb-6" role="tablist">
        <Link
          to="/login"
          role="tab"
          aria-selected="false"
          className="flex-1 text-center py-2 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-700"
        >
          Login
        </Link>
        <Link
          to="/register"
          role="tab"
          aria-selected="true"
          className="flex-1 text-center py-2 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600"
        >
          Register
        </Link>
      </div>

      {registerError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm">{registerError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} aria-label="Registration form" className="space-y-4">
        <Input
          label="Display Name"
          type="text"
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); clearField('display_name'); }}
          error={allErrors['display_name']}
          autoComplete="name"
          required
        />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); clearField('email'); }}
          error={allErrors['email']}
          autoComplete="email"
          required
        />

        <div className="space-y-1">
          <label htmlFor="register-password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearField('password'); }}
              autoComplete="new-password"
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
          <p className="text-xs text-slate-400">Min 8 chars, 1 upper, 1 lower, 1 digit</p>
          {allErrors['password'] && (
            <p className="text-sm text-red-600">{allErrors['password']}</p>
          )}
        </div>

        <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
          Create Account
        </Button>
      </form>
    </AuthLayout>
  );
}
