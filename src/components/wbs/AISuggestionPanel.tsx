import { useState } from 'react';
import {
  Bot,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Button from '../common/Button';
import { cn } from '../../lib/utils';
import { TASK_STATUS_LABELS } from '../../types';
import type { ProgressSuggestion } from '../../lib/ai/aiProgressSuggestion';

interface AISuggestionPanelProps {
  suggestions: ProgressSuggestion[];
  isLoading: boolean;
  onAccept: (suggestion: ProgressSuggestion) => void;
  onAcceptAll: (suggestions: ProgressSuggestion[]) => void;
  onDismiss: (taskId: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export default function AISuggestionPanel({
  suggestions,
  isLoading,
  onAccept,
  onAcceptAll,
  onDismiss,
  onRefresh,
  onClose,
}: AISuggestionPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (suggestions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="rounded-[22px] border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.04)]">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2"
        >
          <Bot className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
            AI 실적 제안
          </span>
          {suggestions.length > 0 && (
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-500">
              {suggestions.length}건
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />
          )}
        </button>
        <div className="flex items-center gap-1.5">
          {suggestions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAcceptAll(suggestions)}
              disabled={isLoading}
            >
              <Check className="h-3.5 w-3.5" />
              전체 적용
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[rgba(124,58,237,0.12)] px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-[color:var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              AI가 작업 진행 상황을 분석하고 있습니다...
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div
                  key={s.taskId}
                  className="flex items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                      {s.taskName}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                      <span>{s.currentProgress}%</span>
                      <ArrowRight className="h-3 w-3 text-violet-400" />
                      <span className="font-semibold text-violet-500">{s.suggestedProgress}%</span>
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                        s.suggestedStatus === 'in_progress' && 'bg-[rgba(15,118,110,0.1)] text-[color:var(--accent-primary)]',
                        s.suggestedStatus === 'completed' && 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]',
                        s.suggestedStatus === 'pending' && 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]',
                        s.suggestedStatus === 'on_hold' && 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]',
                      )}>
                        {TASK_STATUS_LABELS[s.suggestedStatus]}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-muted)]">
                      {s.reason}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onAccept(s)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--accent-success)] transition-colors hover:bg-[rgba(31,163,122,0.1)]"
                      title="수락"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(s.taskId)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[rgba(203,75,95,0.08)] hover:text-[color:var(--accent-danger)]"
                      title="거절"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
