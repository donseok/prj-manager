import type { AISettings } from '../../types';
import { callAI } from '../ai/aiClient';
import type { ChatbotMessage } from '../chatbot';
import type { RagHit } from './ragSearch';

const NOT_FOUND_MARK = '__RAG_NO_INFO__';

const SYSTEM_PROMPT = [
  '당신은 DK Flow 프로젝트 관리 시스템의 전담 비서 "DK Bot"입니다.',
  '아래 [컨텍스트] 블록에 주어진 정보만을 근거로 한국어로 간결하게 답하세요.',
  '규칙:',
  '1) 컨텍스트에 명시되지 않은 수치·이름·일정을 추측하거나 꾸며내지 마세요.',
  '2) 답변 근거가 컨텍스트에 충분하지 않다면 정확히 다음 문자열만 출력하세요: ' + NOT_FOUND_MARK,
  '3) 답변은 한국어 자연문으로 3~6줄 내외로 작성하세요. 목록이 필요하면 "- "로 시작하는 불릿을 사용하세요.',
  '4) 수치·날짜는 컨텍스트 표기를 그대로 인용하세요.',
].join('\n');

function formatContext(hits: RagHit[]): string {
  return hits
    .map((hit, idx) => `[문서 ${idx + 1} · 유형:${hit.sourceType} · 유사도:${hit.similarity.toFixed(2)}]\n${hit.content}`)
    .join('\n\n---\n\n');
}

function formatHistory(history: ChatbotMessage[], max = 6): string {
  if (history.length === 0) return '';
  const recent = history.slice(-max);
  return recent
    .map((m) => `${m.role === 'user' ? '사용자' : '봇'}: ${m.text}`)
    .join('\n');
}

export async function answerWithRag(
  question: string,
  hits: RagHit[],
  history: ChatbotMessage[],
  settings: AISettings,
): Promise<string | null> {
  if (hits.length === 0) return null;

  const contextBlock = formatContext(hits);
  const historyBlock = formatHistory(history);

  const userParts: string[] = [];
  if (historyBlock) {
    userParts.push(`[이전 대화]\n${historyBlock}`);
  }
  userParts.push(`[컨텍스트]\n${contextBlock}`);
  userParts.push(`[질문]\n${question}`);

  const result = await callAI(settings, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n\n') },
  ]);

  const text = result.content.trim();
  if (!text) return null;
  if (text.includes(NOT_FOUND_MARK)) return null;
  return text;
}
