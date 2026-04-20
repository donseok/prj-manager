import type { RagHit } from './ragSearch';
import type { RagSourceType } from './ragDocumentBuilder';

// LLM 호출 없이 pgvector 검색 결과를 사람이 읽기 좋은 형태로 포맷한다.
// API 키가 전혀 필요하지 않은 extractive RAG 방식.

const MAX_HITS = 3;

function sourceLabel(type: RagSourceType): string {
  if (type === 'project') return '프로젝트';
  if (type === 'task') return '작업';
  if (type === 'member') return '멤버';
  return '문서';
}

function formatHit(hit: RagHit, index: number): string {
  const similarityPct = Math.round(hit.similarity * 100);
  const header = `▎ ${sourceLabel(hit.sourceType)} · 유사도 ${similarityPct}%`;
  return index === 0 ? `${header}\n${hit.content}` : `\n${header}\n${hit.content}`;
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
