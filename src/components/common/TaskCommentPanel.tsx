import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, Trash2, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn, generateId } from '../../lib/utils';
import { useCommentStore } from '../../store/commentStore';
import { useAuthStore } from '../../store/authStore';

interface TaskCommentPanelProps {
  taskId: string;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskCommentPanel({ taskId, projectId, isOpen, onClose }: TaskCommentPanelProps) {
  const { comments, loadComments, addComment, deleteComment } = useCommentStore();
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadComments(projectId);
    }
  }, [isOpen, projectId, loadComments]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const taskComments = useMemo(
    () => comments
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [comments, taskId]
  );

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || !user) return;

    addComment({
      id: generateId(),
      taskId,
      projectId,
      authorId: user.id,
      authorName: user.name,
      content: trimmed,
      createdAt: new Date().toISOString(),
    });
    setContent('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDelete = (id: string) => {
    deleteComment(id);
    setDeleteTarget(null);
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-[#0c1016]/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[image:var(--gradient-surface)] shadow-[0_52px_120px_-56px_rgba(0,0,0,0.72)] backdrop-blur-2xl animate-slide-in-right"
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.2),transparent_70%)] blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-[var(--border-color)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[image:var(--gradient-primary)] text-white shadow-[0_12px_32px_-12px_rgba(15,118,110,0.6)]">
              <MessageCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="page-kicker text-[0.62rem]">Task Comments</p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                코멘트
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-secondary-solid)] hover:text-[color:var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {taskComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--bg-elevated)]">
                <MessageCircle className="h-7 w-7 text-[color:var(--text-muted)]" />
              </div>
              <p className="mt-4 text-sm font-medium text-[color:var(--text-secondary)]">
                아직 코멘트가 없습니다
              </p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                첫 번째 코멘트를 남겨보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {taskComments.map((comment) => (
                <div
                  key={comment.id}
                  className="group rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-semibold text-white">
                      {getInitials(comment.authorName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {comment.authorName}
                          </span>
                          <span className="text-xs text-[color:var(--text-muted)]">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko })}
                          </span>
                          {comment.updatedAt && (
                            <span className="text-[10px] text-[color:var(--text-muted)]">(수정됨)</span>
                          )}
                        </div>
                        {user && user.id === comment.authorId && (
                          <>
                            {deleteTarget === comment.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(comment.id)}
                                  className="rounded-full px-2.5 py-1 text-xs font-medium text-[color:var(--accent-danger)] transition-colors hover:bg-[rgba(203,75,95,0.08)]"
                                >
                                  삭제
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(null)}
                                  className="rounded-full px-2.5 py-1 text-xs font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteTarget(comment.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--text-muted)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[rgba(203,75,95,0.08)] hover:text-[color:var(--accent-danger)]"
                                title="삭제"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[color:var(--text-secondary)]">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-[var(--border-color)] p-4">
          <div className="flex gap-3">
            {user && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-semibold text-white">
                {getInitials(user.name)}
              </div>
            )}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="코멘트를 입력하세요..."
                className="field-input min-h-[80px] resize-none"
                rows={3}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-[color:var(--text-muted)]">
                  Ctrl+Enter 로 등록
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={!content.trim()}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                    content.trim()
                      ? 'bg-[image:var(--gradient-primary)] text-white shadow-[0_8px_24px_-8px_rgba(15,118,110,0.5)] hover:-translate-y-0.5'
                      : 'cursor-not-allowed bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)]'
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
