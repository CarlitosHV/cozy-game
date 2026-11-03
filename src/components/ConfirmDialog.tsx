import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BTN, UI } from '../ui/labels';
import { isTypingTarget } from '../ui/shortcuts';

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
};

interface ConfirmDialogProps {
  request: ConfirmRequest | null;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ request, onCancel }) => {
  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        const run = request.onConfirm;
        onCancel();
        run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onCancel]);

  if (!request) return null;

  const danger = request.tone === 'danger';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 cozy-scrim pointer-events-auto font-ui">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-5 flex flex-col gap-3"
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-cozy-line ${
              danger ? 'bg-cozy-blush-soft text-cozy-blush' : 'bg-[#fff1de] text-cozy-accent-deep'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 id="confirm-title" className="text-base font-display font-bold text-cozy-ink leading-snug">
              {request.title}
            </h3>
            <p className="mt-1 text-xs text-cozy-muted leading-relaxed">{request.message}</p>
          </div>
        </div>

        <div className="flex gap-2.5 pt-1">
          <button type="button" onClick={onCancel} className={`flex-1 ${BTN.secondary}`}>
            {request.cancelLabel ?? UI.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              const run = request.onConfirm;
              onCancel();
              run();
            }}
            className={`flex-1 ${danger ? 'w-full py-3 rounded-2xl font-bold text-sm cursor-pointer bg-cozy-blush text-white border border-cozy-line' : BTN.primary}`}
          >
            {request.confirmLabel ?? UI.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};
