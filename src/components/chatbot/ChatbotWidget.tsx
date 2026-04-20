import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, SendHorizonal, X, RotateCcw, Sparkles, AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useTaskStore } from '../../store/taskStore';
import {
  CHATBOT_SUGGESTIONS,
  createChatbotGreeting,
  createChatbotReply,
  type ChatbotMessage,
  type ChatbotContext,
} from '../../lib/chatbot';
import {
  detectDelayRisks,
  suggestNextTasks,
  generateWeeklySummary,
} from '../../lib/chatbotInsights';
import { cn, generateId } from '../../lib/utils';
import DKBotAvatar from './DKBotAvatar';

interface UIMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

export default function ChatbotWidget() {
  const { t } = useTranslation();
  const { projects, currentProject, members } = useProjectStore();
  const { tasks } = useTaskStore();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const context = useMemo<ChatbotContext>(
    () => ({
      project: currentProject,
      members,
      tasks,
      allProjects: projects,
    }),
    [currentProject, members, tasks, projects]
  );
  const latestContextRef = useRef(context);

  useEffect(() => {
    latestContextRef.current = context;
  }, [context]);

  // 대화 히스토리 → ChatbotMessage[] 형태로 변환
  const chatHistory = useMemo<ChatbotMessage[]>(
    () => messages.map((m) => ({ role: m.role, text: m.text })),
    [messages]
  );

  // 프로액티브 인사이트 — 현재 프로젝트 기준 결정론적 분석
  const insights = useMemo(() => {
    if (!currentProject || tasks.length === 0) return null;
    const baseDate = currentProject.baseDate ? new Date(currentProject.baseDate) : new Date();
    const risks = detectDelayRisks(tasks, members, baseDate);
    const suggestions = suggestNextTasks(tasks, members, baseDate);
    const summary = generateWeeklySummary(tasks, members, baseDate);
    return { risks, suggestions, summary };
  }, [currentProject, tasks, members]);

  const hasInsights =
    !!insights &&
    (insights.risks.length > 0 ||
      insights.suggestions.length > 0 ||
      insights.summary.startingThisWeek > 0 ||
      insights.summary.completedLastWeek > 0);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const greeting: UIMessage = {
      id: generateId(),
      role: 'assistant',
      text: createChatbotGreeting(latestContextRef.current),
    };
    timerRef.current = window.setTimeout(() => {
      setMessages([greeting]);
      setDraft('');
      setIsThinking(false);
      setDynamicSuggestions([]);
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

  const submitQuestion = useCallback((input: string) => {
    const question = input.trim();
    if (!question || isThinking) return;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    const userMsg: UIMessage = {
      id: generateId(),
      role: 'user',
      text: question,
    };

    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setIsThinking(true);
    setIsOpen(true);

    // 현재 히스토리 + 새 유저 메시지를 ChatbotMessage[]로 구성
    const historyForReply: ChatbotMessage[] = [
      ...chatHistory,
      { role: 'user', text: question },
    ];

    timerRef.current = window.setTimeout(() => {
      void createChatbotReply(question, context, historyForReply).then((reply) => {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            text: reply.text,
          },
        ]);
        setDynamicSuggestions(reply.suggestions);
        setIsThinking(false);
        timerRef.current = null;
      });
    }, 300);
  }, [isThinking, context, chatHistory]);

  // 초기 제안 vs 동적 제안 결정
  const visibleSuggestions = dynamicSuggestions.length > 0 ? dynamicSuggestions : CHATBOT_SUGGESTIONS;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-4 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section className="pointer-events-auto flex w-[min(92vw,30rem)] flex-col overflow-hidden rounded-[30px] border border-white/15 bg-[image:var(--gradient-surface)] shadow-[0_38px_120px_-48px_rgba(8,17,32,0.65)] backdrop-blur-2xl animate-scale-in dark:bg-[image:var(--gradient-dark)]">
          <div className="relative overflow-hidden rounded-t-[30px] border-b border-white/10 bg-[linear-gradient(160deg,#0E1B45_0%,#152560_48%,#1E3A7B_100%)] px-4 py-3 text-white">
            <div className="pointer-events-none absolute right-[-3.5rem] top-[-2rem] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),transparent_70%)] blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <DKBotAvatar size={40} />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold tracking-[-0.02em]">DK Bot</h2>
                  <p className="text-xs text-white/70">
                    {currentProject ? currentProject.name : t('chatbot.projectCount', { count: projects.length })}
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
                      text: createChatbotGreeting({ project: currentProject, members, tasks, allProjects: projects }),
                    }]);
                    setDraft('');
                    setIsThinking(false);
                    setDynamicSuggestions([]);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/12 text-white/80 transition hover:bg-white/18 hover:text-white"
                  aria-label={t('chatbot.resetChat')}
                  title={t('chatbot.resetChat')}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/12 text-white/80 transition hover:bg-white/18 hover:text-white"
                  aria-label={t('chatbot.closeChatbot')}
                  title={t('chatbot.close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="app-panel flex max-h-[min(75vh,36rem)] flex-1 flex-col gap-3 p-3">
            {hasInsights && insights && (
              <div className="rounded-[20px] border border-[rgba(21,37,96,0.14)] bg-[color:var(--bg-elevated)] p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--text-primary)]">
                  <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" />
                  프로액티브 인사이트
                </div>
                <p className="mb-2 text-xs leading-5 text-[color:var(--text-secondary)]">
                  {insights.summary.headline}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {insights.summary.highRiskCount > 0 && (
                    <button
                      type="button"
                      onClick={() => submitQuestion('지연 위험 작업 알려줘')}
                      className="flex items-center gap-1 rounded-full border border-[#C8102E]/30 bg-[#C8102E]/10 px-2.5 py-1 text-xs font-semibold text-[#C8102E] transition hover:bg-[#C8102E]/15"
                      title="고위험 작업 상세 보기"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      지연 위험 {insights.summary.highRiskCount}건
                    </button>
                  )}
                  {insights.summary.riskCount > insights.summary.highRiskCount && (
                    <button
                      type="button"
                      onClick={() => submitQuestion('지연 위험 작업 알려줘')}
                      className="flex items-center gap-1 rounded-full border border-[#F0A167]/40 bg-[#F0A167]/10 px-2.5 py-1 text-xs font-semibold text-[#B26A2F] transition hover:bg-[#F0A167]/20"
                      title="주의 작업 상세 보기"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      주의 {insights.summary.riskCount - insights.summary.highRiskCount}건
                    </button>
                  )}
                  {insights.summary.startingThisWeek > 0 && (
                    <button
                      type="button"
                      onClick={() => submitQuestion('이번 주 작업 알려줘')}
                      className="flex items-center gap-1 rounded-full border border-[#1E3A7B]/25 bg-[#1E3A7B]/10 px-2.5 py-1 text-xs font-semibold text-[#1E3A7B] transition hover:bg-[#1E3A7B]/15"
                      title="이번 주 시작 예정 작업 보기"
                    >
                      <CalendarClock className="h-3 w-3" />
                      이번 주 시작 {insights.summary.startingThisWeek}건
                    </button>
                  )}
                  {insights.summary.completedLastWeek > 0 && (
                    <button
                      type="button"
                      onClick={() => submitQuestion('완료된 작업 목록 보여줘')}
                      className="flex items-center gap-1 rounded-full border border-[#2BAAA0]/30 bg-[#2BAAA0]/10 px-2.5 py-1 text-xs font-semibold text-[#1F7E77] transition hover:bg-[#2BAAA0]/15"
                      title="지난 주 완료 작업 보기"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      지난 주 완료 {insights.summary.completedLastWeek}건
                    </button>
                  )}
                  {insights.summary.nextSuggestionCount > 0 && (
                    <button
                      type="button"
                      onClick={() => submitQuestion('다음 추천 작업 알려줘')}
                      className="flex items-center gap-1 rounded-full border border-[rgba(21,37,96,0.2)] bg-[color:var(--bg-tertiary)] px-2.5 py-1 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--bg-secondary)]"
                      title="다음 추천 작업 보기"
                    >
                      <Sparkles className="h-3 w-3" />
                      추천 작업 {insights.summary.nextSuggestionCount}건
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => submitQuestion('주간 요약 보여줘')}
                    className="flex items-center gap-1 rounded-full border border-[rgba(21,37,96,0.2)] bg-transparent px-2.5 py-1 text-xs font-semibold text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
                    title="주간 전체 요약 보기"
                  >
                    주간 요약
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {visibleSuggestions.map((suggestion) => (
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
                      {t('chatbot.thinking')}
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
                  placeholder={t('chatbot.inputPlaceholder')}
                  rows={2}
                  className="field-input min-h-[56px] flex-1 resize-none rounded-[16px] text-sm"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isThinking}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(135deg,#C8102E,#E8384F)] text-white shadow-[0_22px_44px_-26px_rgba(200,16,46,0.72)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none"
                  aria-label={t('chatbot.send')}
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
            {t('chatbot.greeting')}
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex h-[66px] w-[66px] items-center justify-center rounded-full border border-white/16 bg-[linear-gradient(165deg,#0E1B45_0%,#152560_50%,#1E3A7B_100%)] shadow-[0_28px_72px_-34px_rgba(21,37,96,0.72)] transition duration-300 hover:-translate-y-1 hover:scale-[1.02]"
          aria-label={isOpen ? t('chatbot.closeChatbot') : t('chatbot.openChatbot')}
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
