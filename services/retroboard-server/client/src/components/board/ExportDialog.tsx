import { useState } from 'react';
import { Download, FileJson, FileText, Code } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { boardApi } from '@/lib/board-api';
import { toast } from '@/lib/toast';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
}

type ExportFormat = 'json' | 'markdown' | 'html';

const formatOptions: Array<{
  value: ExportFormat;
  label: string;
  description: string;
  icon: typeof FileJson;
  extension: string;
}> = [
  {
    value: 'json',
    label: 'JSON',
    description: 'Raw data for integration with other tools',
    icon: FileJson,
    extension: 'json',
  },
  {
    value: 'markdown',
    label: 'Markdown',
    description: 'Human-readable text format',
    icon: FileText,
    extension: 'md',
  },
  {
    value: 'html',
    label: 'HTML',
    description: 'Formatted page for printing or sharing',
    icon: Code,
    extension: 'html',
  },
];

export function ExportDialog({ open, onClose, boardId, boardName }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await boardApi.exportBoard(boardId, selectedFormat);
      const formatOption = formatOptions.find((f) => f.value === selectedFormat);
      const extension = formatOption?.extension || 'txt';
      const filename = `${boardName.toLowerCase().replace(/\s+/g, '-')}-export.${extension}`;

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Export downloaded successfully');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export board');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Export Retro Board">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Choose a format to export your retrospective data.
        </p>

        <div className="space-y-2">
          {formatOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setSelectedFormat(option.value)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                  selectedFormat === option.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <Icon
                  className={`h-5 w-5 mt-0.5 ${
                    selectedFormat === option.value ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900">{option.label}</div>
                  <div className="text-sm text-slate-500">{option.description}</div>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                    selectedFormat === option.value
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-slate-300'
                  }`}
                >
                  {selectedFormat === option.value && (
                    <div className="h-full w-full flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} isLoading={isExporting}>
            <Download className="h-4 w-4" />
            Download Export
          </Button>
        </div>
      </div>
    </Modal>
  );
}
