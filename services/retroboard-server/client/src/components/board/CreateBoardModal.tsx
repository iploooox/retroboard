import { useEffect, useState, type FormEvent } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { boardApi } from '@/lib/board-api';
import { toast } from '@/lib/toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface Template {
  id: string;
  name: string;
  description: string;
  column_count: number;
}

interface CreateBoardModalProps {
  open: boolean;
  onClose: () => void;
  sprintId: string;
  onCreated: () => void;
}

export function CreateBoardModal({ open, onClose, sprintId, onCreated }: CreateBoardModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    api.get<{ templates: Template[] }>('/templates')
      .then((data) => {
        setTemplates(data.templates);
        if (data.templates.length > 0 && data.templates[0]) {
          setSelectedTemplate(data.templates[0].id);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load templates');
      })
      .finally(() => setIsLoading(false));
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    setIsSubmitting(true);
    try {
      await boardApi.createBoard(sprintId, { template_id: selectedTemplate });
      toast.success('Board created!');
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create board');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Start Retro">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 py-4">{error}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">Choose a template for your retrospective board.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.map((t) => (
              <label
                key={t.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTemplate === t.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={selectedTemplate === t.id}
                  onChange={() => setSelectedTemplate(t.id)}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-medium text-slate-800">{t.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.column_count} columns</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} disabled={!selectedTemplate}>
              Create Board
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
