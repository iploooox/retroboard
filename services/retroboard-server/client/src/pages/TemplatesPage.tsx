import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { AlertCircle, LayoutTemplate } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  column_count: number;
  is_system: boolean;
}

export function TemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await api.get<{ templates: Template[] }>('/templates');
        setTemplates(data.templates);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load templates');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Retro Templates</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-300 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <LayoutTemplate className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900">{template.name}</h4>
                <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {template.column_count} {template.column_count === 1 ? 'column' : 'columns'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
