import type { ReactNode } from 'react';
import { LayoutDashboard } from 'lucide-react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 text-indigo-600">
            <LayoutDashboard className="h-10 w-10" />
            <span className="text-2xl font-bold">RetroBoard Pro</span>
          </div>
        </div>
        <div className="bg-white shadow-lg rounded-xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
