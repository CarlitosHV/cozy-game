import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { ActionFeedback as Feedback } from '../hooks/useAsyncAction';

interface ActionFeedbackProps {
  feedback: Feedback | null;
  showLoading?: boolean;
  loadingLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

export const ActionFeedbackBanner: React.FC<ActionFeedbackProps> = ({
  feedback,
  showLoading = false,
  loadingLabel = 'Procesando...',
  onDismiss,
  className = '',
}) => {
  if (!showLoading && !feedback) return null;

  if (showLoading) {
    return (
      <div
        className={`flex items-center gap-2.5 p-3 rounded-2xl bg-cozy-sky-soft border border-cozy-line text-[#3f6f86] text-xs ${className}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span className="leading-relaxed">{loadingLabel}</span>
      </div>
    );
  }

  if (!feedback) return null;

  const isError = feedback.type === 'error';

  return (
    <div
      className={`flex items-start gap-2.5 p-3 rounded-2xl border text-xs ${
        isError
          ? 'bg-cozy-blush-soft border-cozy-line text-[#8a4a52]'
          : 'bg-cozy-moss-soft border-cozy-line text-[#2f6a4c]'
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 text-cozy-blush shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-cozy-moss shrink-0 mt-0.5" />
      )}
      <div className="flex-1 leading-relaxed">{feedback.message}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-0.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          aria-label="Cerrar aviso"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
