import { useCallback, useEffect, useState } from 'react';

export type FeedbackTone = 'success' | 'error' | 'info' | 'warning';

export interface PageFeedback {
  tone: FeedbackTone;
  title: string;
  message: string;
}

export function usePageFeedback(autoHideMs: number = 4200) {
  const [feedback, setFeedback] = useState<PageFeedback | null>(null);

  useEffect(() => {
    if (!feedback || autoHideMs <= 0) return;

    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, autoHideMs);

    return () => window.clearTimeout(timeoutId);
  }, [autoHideMs, feedback]);

  const showFeedback = useCallback((nextFeedback: PageFeedback) => {
    setFeedback(nextFeedback);
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return { feedback, showFeedback, clearFeedback };
}
