import { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
  span?: 'full' | 'half';
  helpText?: string;
}

export function ChartCard({ title, children, span = 'half', helpText }: ChartCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-6 ${
        span === 'full' ? 'col-span-full' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {helpText && (
          <button
            className="text-slate-400 hover:text-slate-600"
            title={helpText}
            aria-label={`Help: ${helpText}`}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
