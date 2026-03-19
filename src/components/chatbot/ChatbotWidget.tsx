import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, SendHorizonal, X, RotateCcw } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useTaskStore } from '../../store/taskStore';
import { CHATBOT_SUGGESTIONS, createChatbotGreeting, createChatbotReply } from '../../lib/chatbot';
import { cn, generateId } from '../../lib/utils';
import DKBotAvatar from './DKBotAvatar';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

export default function ChatbotWidget() {
  const { projects, currentProject, members } = useProjectStore();
  const { tasks } = useTaskStore();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const timerRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const context = useMemo(
    () => ({
      project: currentProject,
      members,
      tasks,
      allProjects: projects,
    }),
    [currentProject, members, tasks, projects]
  );

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const greeting: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      text: createChatbotGreeting({
        project: currentProject,
        members: [],
        tasks: [],
        allProjects: projects,
      }),
    };
    // 타이머를 사용해 렌더 사이클 후 상태를 업데이트
    timerRef.current = window.setTimeout(() => {
      setMessages([greeting]);
      setDraft('');
      setIsThinking(false);
    }, 0);
  }, [currentProject, projects]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const submitQuestion = (input: string) => {
    const question = input.trim();
    if (!question || isThinking) return;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'user',
        text: question,
      },
    ]);
    setDraft('');
    setIsThinking(true);
    setIsOpen(true);

    timerRef.current = window.setTimeout(() => {
      void createChatbotReply(question, context).then((reply) => {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            text: reply,
          },
        ]);
        setIsThinking(false);
        timerRef.current = null;
      });
    }, 420);
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-4 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section className="pointer-events-auto flex w-[min(92vw,25rem)] flex-col overflow-hidden rounded-[30px] border border-white/15 bg-[image:var(--gradient-surface)] shadow-[0_38px_120px_-48px_rgba(8,17,32,0.65)] backdrop-blur-2xl animate-scale-in dark:bg-[image:var(--gradient-dark)]">
          <div className="relative overflow-hidden rounded-t-[30px] border-b border-white/10 bg-[linear-gradient(160deg,#0E1B45_0%,#152560_48%,#1E3A7B_100%)] px-4 py-3 text-white">
            <div className="pointer-events-none absolute right-[-3.5rem] top-[-2rem] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),transparent_70%)] blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <DKBotAvatar size={40} />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold tracking-[-0.02em]">DK Bot</h2>
                  <p className="text-xs text-white/70">
                    {currentProject ? currentProject.name : `${projects.length}개 프로젝트`}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (timerRef.current) {
                      window.clearTimeout(timerRef.current);
                      timerRef.current = null;
                    }
                    setMessages([{
                      id: generateId(),
                      role: 'assistant',
                      text: createChatbotGreeting({ project: currentProject, members: [], tasks: [], allProjects: projects }),
                    }]);
                    setDraft('');
                    setIsThinking(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/12 text-white/80 transition hover:bg-white/18 hover:text-white"
                  aria-label="대화 초기화"
                  title="대화 초기화"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/12 text-white/80 transition hover:bg-white/18 hover:text-white"
                  aria-label="챗봇 닫기"
                  title="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="app-panel flex max-h-[min(70vh,28rem)] flex-1 flex-col gap-3 p-3">
            <div className="flex flex-wrap gap-2">
              {CHATBOT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submitQuestion(suggestion)}
                  className="surface-badge cursor-pointer border-[rgba(21,37,96,0.14)] bg-[color:var(--bg-elevated)] px-3 py-2 text-left text-xs font-semibold text-[color:var(--text-secondary)] transition hover:-translate-y-0.5 hover:border-[rgba(21,37,96,0.28)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="app-panel-strong flex-1 space-y-3 overflow-y-auto rounded-[24px] p-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'assistant' ? 'justify-start' : 'justify-end'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[88%] whitespace-pre-wrap rounded-[22px] px-4 py-3 text-sm leading-6 shadow-[0_20px_38px_-28px_rgba(15,23,42,0.45)]',
                      message.role === 'assistant'
                        ? 'border border-[rgba(21,37,96,0.12)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]'
                        : 'bg-[linear-gradient(135deg,#152560,#1E3A7B)] text-white'
                    )}
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-[22px] border border-[rgba(21,37,96,0.12)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm text-[color:var(--text-secondary)] shadow-[0_20px_38px_-28px_rgba(15,23,42,0.45)]">
                    <div className="flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#C8102E] [animation-delay:-0.18s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#C8102E] [animation-delay:-0.09s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#C8102E]" />
                      </span>
                      데이터를 정리하는 중입니다.
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitQuestion(draft);
              }}
              className="rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-2 backdrop-blur-xl"
            >
              <div className="flex items-end gap-2">
                <textarea
                  id="dk-bot-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submitQuestion(draft);
                    }
                  }}
                  placeholder="질문을 입력하세요 (Enter로 전송)"
                  rows={2}
                  className="field-input min-h-[56px] flex-1 resize-none rounded-[16px] text-sm"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isThinking}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(135deg,#C8102E,#E8384F)] text-white shadow-[0_22px_44px_-26px_rgba(200,16,46,0.72)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none"
                  aria-label="질문 보내기"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <div className="pointer-events-auto flex items-center gap-3">
        {!isOpen && (
          <div className="hidden rounded-full border border-white/15 bg-[rgba(21,37,96,0.94)] px-4 py-2 text-sm font-medium text-white shadow-[0_28px_68px_-34px_rgba(21,37,96,0.82)] backdrop-blur-xl sm:block">
            물어보면 바로 정리해 드릴게요
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex h-[66px] w-[66px] items-center justify-center rounded-full border border-white/16 bg-[linear-gradient(165deg,#0E1B45_0%,#152560_50%,#1E3A7B_100%)] shadow-[0_28px_72px_-34px_rgba(21,37,96,0.72)] transition duration-300 hover:-translate-y-1 hover:scale-[1.02]"
          aria-label={isOpen ? '챗봇 닫기' : '챗봇 열기'}
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_48%)]" />
          <DKBotAvatar
            size={44}
            className="border-white/0 bg-transparent shadow-none transition duration-300 group-hover:scale-[1.04]"
          />
          {!isOpen && (
            <span className="absolute -right-1 bottom-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white text-[#C8102E] shadow-[0_12px_28px_-18px_rgba(200,16,46,0.62)]">
              <MessageCircle className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
