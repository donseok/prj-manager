import type { MeetingTask } from '../../types';
import { callAI } from '../ai/aiClient';
import { loadAISettings } from '../ai/aiConfig';

// ── 업무 표현 패턴 ──────────────────────────────────────────────
const TASK_INDICATORS = [
  /해야\s*함/,
  /할\s*것/,
  /진행/,
  /완료\s*예정/,
  /필요/,
  /요청/,
  /하기로/,
  /결정/,
  /예정/,
  /추진/,
  /검토/,
  /보고/,
  /준비/,
  /수행/,
  /실시/,
  /조치/,
];

// ── 담당자 패턴 ─────────────────────────────────────────────────
const ASSIGNEE_PATTERNS: RegExp[] = [
  /담당자?\s*[:：]\s*([가-힣]{2,4})/,       // 담당: 홍길동 / 담당자: 홍길동
  /([가-힣]{2,4})\s*담당/,                   // 홍길동 담당
  /([가-힣]{2,4})\s*책임/,                   // 홍길동 책임
  /([가-힣]{2,4})씨/,                        // 홍길동씨
  /\(([가-힣]{2,4})\)/,                      // (홍길동)
];

// ── 날짜 패턴 ───────────────────────────────────────────────────
const DATE_ISO = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/;
const DATE_KOREAN = /(\d{1,2})월\s*(\d{1,2})일/;
const DEADLINE_KEYWORD = /까지/;
const RELATIVE_DATE_PATTERNS: { pattern: RegExp; offsetDays: number }[] = [
  { pattern: /이번\s*주|금주\s*내/, offsetDays: 5 },
  { pattern: /다음\s*주|차주/, offsetDays: 12 },
  { pattern: /이번\s*달|금월/, offsetDays: 28 },
  { pattern: /다음\s*달|차월/, offsetDays: 56 },
];

// ── 레벨 추정 ───────────────────────────────────────────────────
const LEVEL1_KEYWORDS = /프로젝트|단계|Phase/i;
const LEVEL2_KEYWORDS = /활동|Activity/i;
const LEVEL4_KEYWORDS = /세부|상세|Detail|Todo/i;
const NUMBERED_LEVEL2 = /^\s*\d+[.)]\s+/;              // "1." "2)" 등
const NUMBERED_LEVEL3 = /^\s*\d+\.\d+[.)]*\s+/;        // "1.1" "2.3)" 등
const NUMBERED_LEVEL4 = /^\s*\d+\.\d+\.\d+[.)]*\s+/;   // "1.1.1" 등
const SUB_ITEM = /^\s*[-•◦▪▸]\s+/;                      // "- " 서브 항목

/**
 * 주어진 날짜 기준으로 상대적 날짜를 계산한다.
 */
function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 텍스트에서 날짜를 추출한다. 연도가 없으면 현재 연도를 사용한다.
 */
function extractDate(text: string): string | undefined {
  // ISO / dot / slash 형식: 2024-03-15, 2024.03.15
  const isoMatch = text.match(DATE_ISO);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 한국어 형식: 3월 15일
  const krMatch = text.match(DATE_KOREAN);
  if (krMatch) {
    const year = new Date().getFullYear();
    const [, m, d] = krMatch;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 상대적 날짜: 이번 주, 다음 주 등
  const today = new Date();
  for (const { pattern, offsetDays } of RELATIVE_DATE_PATTERNS) {
    if (pattern.test(text)) {
      return addDays(today, offsetDays);
    }
  }

  return undefined;
}

/**
 * 텍스트에서 담당자명을 추출한다.
 */
function extractAssignee(text: string): string | undefined {
  for (const pattern of ASSIGNEE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * 줄의 들여쓰기와 번호 체계로 WBS 레벨을 추정한다.
 */
function estimateLevel(line: string): 1 | 2 | 3 | 4 {
  if (NUMBERED_LEVEL4.test(line) || SUB_ITEM.test(line)) return 4;
  if (NUMBERED_LEVEL3.test(line)) return 3;
  if (NUMBERED_LEVEL2.test(line)) return 2;
  if (LEVEL1_KEYWORDS.test(line)) return 1;
  if (LEVEL2_KEYWORDS.test(line)) return 2;
  if (LEVEL4_KEYWORDS.test(line)) return 4;
  return 3; // 기본값: Task
}

/**
 * 줄에서 번호 접두사 및 불릿 기호를 제거하여 깨끗한 업무명을 추출한다.
 */
function cleanTaskName(line: string): string {
  return line
    .replace(/^\s*\d+(\.\d+)*[.)]*\s*/, '')   // 번호 체계 제거
    .replace(/^\s*[-•◦▪▸]\s*/, '')              // 불릿 제거
    .replace(/\s*\(.*?\)\s*/g, ' ')             // 괄호 내용 제거 (담당자 등)
    .replace(/담당자?\s*[:：]\s*[가-힣]{2,4}/g, '')
    .replace(/[가-힣]{2,4}\s*담당/g, '')
    .replace(/[가-힣]{2,4}\s*책임/g, '')
    .replace(/까지/g, '')
    .replace(DATE_ISO, '')
    .replace(DATE_KOREAN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── 규칙 기반 분석 ──────────────────────────────────────────────

/**
 * 규칙 기반으로 회의록 텍스트를 분석하여 업무 항목을 추출한다.
 */
export function analyzeWithRules(text: string): MeetingTask[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
  const tasks: MeetingTask[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 업무 표현 패턴 확인
    const isTaskLine = TASK_INDICATORS.some((p) => p.test(trimmed));
    // 번호 체계가 있는 줄도 업무 후보
    const isNumberedLine =
      NUMBERED_LEVEL2.test(trimmed) ||
      NUMBERED_LEVEL3.test(trimmed) ||
      NUMBERED_LEVEL4.test(trimmed);
    // 불릿 항목
    const isBulletLine = SUB_ITEM.test(trimmed);

    if (!isTaskLine && !isNumberedLine && !isBulletLine) continue;

    // 주변 맥락 (현재 줄 + 인접 줄)
    const contextLines = [
      i > 0 ? lines[i - 1] : '',
      trimmed,
      i < lines.length - 1 ? lines[i + 1] : '',
    ].join(' ');

    const name = cleanTaskName(trimmed);
    if (!name || name.length < 2) continue;

    const assigneeName = extractAssignee(contextLines);
    const dateStr = extractDate(contextLines);
    const hasDeadline = DEADLINE_KEYWORD.test(contextLines);
    const level = estimateLevel(trimmed);

    tasks.push({
      name,
      description: trimmed,
      assigneeName,
      startDate: undefined,
      endDate: hasDeadline || dateStr ? dateStr : undefined,
      level,
      selected: true,
    });
  }

  // 중복 업무명 제거 (첫 번째만 유지)
  const seen = new Set<string>();
  return tasks.filter((t) => {
    const key = t.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── AI 기반 분석 ────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `당신은 회의록에서 실행해야 할 업무를 추출하는 전문가입니다.

다음 회의록을 분석하여 실행 가능한 업무 항목을 JSON 배열로 추출해주세요.

각 항목의 형식:
{
  "name": "업무명 (간결하게)",
  "description": "상세 내용 또는 회의록 원문 발췌",
  "assigneeName": "담당자명 (없으면 null)",
  "startDate": "YYYY-MM-DD (없으면 null)",
  "endDate": "YYYY-MM-DD (없으면 null)",
  "level": 3
}

level 설명: 1=Phase(단계), 2=Activity(활동), 3=Task(업무), 4=Todo(세부작업)

JSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요.`;

/**
 * AI 응답에서 JSON 배열을 파싱한다.
 * 코드 블록(```json ... ```)이나 앞뒤 텍스트가 포함된 경우도 처리한다.
 */
function parseAIResponse(content: string): MeetingTask[] {
  if (!content || !content.trim()) {
    throw new Error('AI 응답이 비어 있습니다');
  }

  // 코드 블록 내부 추출
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : content.trim();

  // JSON 배열 부분만 추출
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('AI 응답에서 JSON 배열을 찾을 수 없습니다');
  }

  const parsed: unknown[] = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI 응답이 유효한 배열이 아닙니다');
  }

  return parsed.map((item: unknown) => {
    const obj = item as Record<string, unknown>;
    const rawLevel = Number(obj.level) || 3;
    const level = ([1, 2, 3, 4].includes(rawLevel) ? rawLevel : 3) as 1 | 2 | 3 | 4;

    return {
      name: String(obj.name || '').trim() || '(업무명 없음)',
      description: obj.description ? String(obj.description).trim() : undefined,
      assigneeName: obj.assigneeName ? String(obj.assigneeName).trim() : undefined,
      startDate: obj.startDate ? String(obj.startDate).trim() : undefined,
      endDate: obj.endDate ? String(obj.endDate).trim() : undefined,
      level,
      selected: true,
    };
  });
}

/**
 * AI를 사용하여 회의록을 분석한다.
 */
async function analyzeWithAI(text: string): Promise<MeetingTask[]> {
  const settings = loadAISettings();
  if (!settings.apiKey) {
    throw new Error('AI API 키가 설정되지 않았습니다');
  }

  const response = await callAI(settings, [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'user', content: `회의록:\n---\n${text}\n---` },
  ]);

  return parseAIResponse(response.content);
}

// ── 메인 함수 ───────────────────────────────────────────────────

/**
 * 회의록 텍스트를 분석하여 업무 항목을 추출한다.
 *
 * @param text - 회의록 원문 텍스트
 * @param useAI - true이면 AI 분석 시도 (실패 시 규칙 기반으로 폴백)
 * @returns 추출된 업무 항목 목록
 */
export async function analyzeMeeting(text: string, useAI: boolean): Promise<MeetingTask[]> {
  if (!text || !text.trim()) return [];

  if (useAI) {
    try {
      return await analyzeWithAI(text);
    } catch (error) {
      console.warn('AI 분석 실패, 규칙 기반으로 전환:', error);
      return analyzeWithRules(text);
    }
  }

  return analyzeWithRules(text);
}
