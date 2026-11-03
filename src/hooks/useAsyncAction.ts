import { useCallback, useEffect, useRef, useState } from 'react';

export type ActionFeedback = {
  type: 'success' | 'error';
  message: string;
};

type RunOptions = {
  successMessage?: string | ((result: unknown) => string | null | undefined);
  errorMessage?: string | ((error: unknown) => string);
  silentSuccess?: boolean;
  silentError?: boolean;
};

const LOADING_DELAY_MS = 1000;

export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const timerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearFeedback = useCallback(() => {
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setFeedback(null);
  }, []);

  const showFeedback = useCallback(
    (next: ActionFeedback, autoHideMs = 2800) => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      setFeedback(next);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        feedbackTimerRef.current = null;
      }, autoHideMs);
    },
    []
  );

  const run = useCallback(
    async <T,>(action: () => Promise<T>, options: RunOptions = {}) => {
      clearTimers();
      clearFeedback();
      setBusy(true);
      setShowLoading(false);
      timerRef.current = window.setTimeout(() => {
        setShowLoading(true);
        timerRef.current = null;
      }, LOADING_DELAY_MS);

      try {
        const result = await action();
        clearTimers();
        setShowLoading(false);
        setBusy(false);

        if (!options.silentSuccess) {
          const success =
            typeof options.successMessage === 'function'
              ? options.successMessage(result)
              : options.successMessage;
          if (success) {
            showFeedback({ type: 'success', message: success });
          }
        }

        return { ok: true as const, result };
      } catch (error) {
        clearTimers();
        setShowLoading(false);
        setBusy(false);
        if (!options.silentError) {
          const message =
            typeof options.errorMessage === 'function'
              ? options.errorMessage(error)
              : options.errorMessage ||
                (error as Error)?.message ||
                'Algo salió mal. Tus datos siguen aquí: inténtalo de nuevo.';
          showFeedback({ type: 'error', message });
        }
        return { ok: false as const, error };
      }
    },
    [clearFeedback, clearTimers, showFeedback]
  );

  useEffect(() => {
    return () => {
      clearTimers();
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [clearTimers]);

  return {
    busy,
    showLoading,
    feedback,
    setFeedback,
    showFeedback,
    clearFeedback,
    run,
  };
}
