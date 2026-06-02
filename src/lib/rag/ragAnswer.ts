import type { RagHit } from './ragSearch';
import type { RagSourceType } from './ragDocumentBuilder';
import { callAI, isAIConfigured, loadAISettings } from '../ai';
import { isSupabaseConfigured, supabase } from '../supabase';

// LLM 호출 없이 pgvector 검색 결과를 사람이 읽기 좋은 형태로 포맷한다.
// API 키가 전혀 필요하지 않은 extractive RAG 방식.

const MAX_HITS = 3;
const MAX_GENERATED_HITS = 5;
const MAX_CONTEXT_CHARS = 1400;
const MAX_HISTORY_MESSAGES = 6;

export interface RagConversationMessage {
  role: 'assistant' | 'user';
  text: string;
}

export interface GeneratedRagAnswerOptions {
  projectName?: string;
  history?: RagConversationMessage[];
}

interface EdgeRagAnswerResponse {
  answer?: string;
  error?: string;
}

interface EdgeRagHit {
  sourceType: RagSourceType;
  sourceId: string;
  title: string;
  content: string;
  similarity: number;
}

function sourceLabel(type: RagSourceType): string {
  if (type === 'project') return '프로젝트';
  if (type === 'task') return '작업';
  if (type === 'member') return '멤버';
  return '문서';
}

function sourceTitle(hit: RagHit): string {
  const name = hit.metadata.name;
  return typeof name === 'string' && name.trim() ? name.trim() : hit.sourceId;
}

function formatHit(hit: RagHit, index: number): string {
  const similarityPct = Math.round(hit.similarity * 100);
  const title = sourceTitle(hit);
  const header = `▎ ${sourceLabel(hit.sourceType)} · ${title} · 유사도 ${similarityPct}%`;
  return index === 0 ? `${header}\n${hit.content}` : `\n${header}\n${hit.content}`;
}

function truncateForPrompt(value: string): string {
  if (value.length <= MAX_CONTEXT_CHARS) return value;
  return `${value.slice(0, MAX_CONTEXT_CHARS).trimEnd()}\n...`;
}

function formatContextBlock(hit: RagHit, index: number): string {
  return [
    `[S${index + 1}] ${sourceLabel(hit.sourceType)} · ${sourceTitle(hit)} · 유사도 ${Math.round(hit.similarity * 100)}%`,
    truncateForPrompt(hit.content),
  ].join('\n');
}

function formatHistory(history?: RagConversationMessage[]): string {
  if (!history || history.length === 0) return '없음';
  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => `${message.role === 'user' ? '사용자' : 'DK Bot'}: ${message.text}`)
    .join('\n');
}

function appendSourceSummary(answer: string, hits: RagHit[]): string {
  const sourceLines = hits.slice(0, MAX_HITS).map((hit, index) => (
    `[S${index + 1}] ${sourceLabel(hit.sourceType)} · ${sourceTitle(hit)} · 유사도 ${Math.round(hit.similarity * 100)}%`
  ));
  return `${answer.trim()}\n\n근거\n${sourceLines.join('\n')}`;
}

function toEdgeHit(hit: RagHit): EdgeRagHit {
  return {
    sourceType: hit.sourceType,
    sourceId: hit.sourceId,
    title: sourceTitle(hit),
    content: hit.content,
    similarity: hit.similarity,
  };
}

async function answerWithEdgeFunction(
  question: string,
  hits: RagHit[],
  options: GeneratedRagAnswerOptions,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase.functions.invoke<EdgeRagAnswerResponse>('rag-answer', {
      body: {
        question,
        projectName: options.projectName || '',
        history: options.history || [],
        hits: hits.slice(0, MAX_GENERATED_HITS).map(toEdgeHit),
      },
    });

    if (error) {
      console.warn('[RAG] Edge Function 답변 생성 실패, 클라이언트 폴백 사용:', error.message);
      return null;
    }

    if (data?.answer && data.answer.trim()) {
      return appendSourceSummary(data.answer, hits);
    }

    if (data?.error) {
      console.warn('[RAG] Edge Function 답변 생성 오류:', data.error);
    }
  } catch (err) {
    console.warn('[RAG] Edge Function 호출 실패, 클라이언트 폴백 사용:', err);
  }

  return null;
}

export function answerWithRag(hits: RagHit[]): string | null {
  if (hits.length === 0) return null;
  const top = hits.slice(0, MAX_HITS);
  const intro = top.length === 1
    ? '관련 내용을 찾았습니다.'
    : `관련 내용 ${top.length}건을 찾았습니다.`;
  const sections = top.map((hit, idx) => formatHit(hit, idx));
  return [intro, ...sections].join('\n');
}

export async function answerWithGeneratedRag(
  question: string,
  hits: RagHit[],
  options: GeneratedRagAnswerOptions = {},
): Promise<string | null> {
  if (hits.length === 0) return null;

  const edgeAnswer = await answerWithEdgeFunction(question, hits, options);
  if (edgeAnswer) return edgeAnswer;

  if (!isAIConfigured()) return null;
  const settings = loadAISettings();
  if (!settings.apiKey) return null;

  const topHits = hits.slice(0, MAX_GENERATED_HITS);
  const systemPrompt = [
    '당신은 DK Flow 프로젝트 관리 챗봇입니다.',
    '제공된 검색 근거만 사용해서 한국어로 답변하세요.',
    '근거에 없는 사실은 추측하지 말고, 확인 가능한 범위와 부족한 정보를 구분하세요.',
    '프로젝트 관리자가 바로 행동할 수 있도록 핵심 요약, 관련 항목, 다음 액션을 짧게 제안하세요.',
    '중요한 주장에는 [S1], [S2]처럼 검색 근거 번호를 붙이세요.',
    '마크다운 표는 꼭 필요할 때만 사용하고, 답변은 간결하게 유지하세요.',
  ].join('\n');

  const userPrompt = [
    `프로젝트: ${options.projectName || '현재 프로젝트'}`,
    '',
    `최근 대화:\n${formatHistory(options.history)}`,
    '',
    `사용자 질문:\n${question}`,
    '',
    `검색 근거:\n${topHits.map(formatContextBlock).join('\n\n')}`,
  ].join('\n');

  const response = await callAI(settings, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  const generated = response.content.trim();
  if (!generated) return null;

  return appendSourceSummary(generated, topHits);
}
