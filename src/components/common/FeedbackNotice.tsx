import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FeedbackTone } from '../../hooks/usePageFeedback';

interface FeedbackNoticeProps {
  tone: FeedbackTone;
  title: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

const toneStyles: Record<FeedbackTone, { icon: typeof Info; wrapper: string; iconClassName: string }> = {
  success: {
    icon: CheckCircle2,
    wrapper:
      'border-[rgba(31,163,122,0.18)] bg-[color:var(--bg-secondary-solid)]',
    iconClassName: 'text-[color:var(--accent-success)]',
  },
  error: {
    icon: AlertCircle,
    wrapper:
      'border-[rgba(203,75,95,0.18)] bg-[color:var(--bg-secondary-solid)]',
    iconClassName: 'text-[color:var(--accent-danger)]',
  },
  info: {
    icon: Info,
    wrapper:
      'border-[rgba(15,118,110,0.16)] bg-[color:var(--bg-secondary-solid)]',
    iconClassName: 'text-[color:var(--accent-primary)]',
  },
  warning: {
    icon: TriangleAlert,
    wrapper:
      'border-[rgba(203,109,55,0.18)] bg-[color:var(--bg-secondary-solid)]',
    iconClassName: 'text-[color:var(--accent-warning)]',
  },
};

export default function FeedbackNotice({ tone, title, message, onClose, className }: FeedbackNoticeProps) {
  const Icon = toneStyles[tone].icon;

  return (
    <div
      data-testid="feedback-notice"
      className={cn(
        'flex items-start gap-3 rounded-[24px] border px-4 py-3.5 shadow-[0_22px_48px_-36px_rgba(17,24,39,0.2)]',
        toneStyles[tone].wrapper,
        className
      )}
    >
      <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 dark:bg-white/6', toneStyles[tone].iconClassName)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">{message}</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-[color:var(--text-primary)] dark:hover:bg-white/6"
          aria-label="알림 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
