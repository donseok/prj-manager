/**
 * weeklyReportTemplate.ts
 *
 * 프로젝트별 주간보고 엑셀 양식을 **결정론적**으로 생성·고정한다.
 *
 * - 프로젝트가 처음 주간보고 엑셀을 다운로드할 때 템플릿이 생성되어
 *   `project.settings.reportTemplate` 에 저장된다.
 * - 이후 다운로드에서는 저장된 템플릿을 그대로 사용하므로
 *   **동일 프로젝트는 항상 같은 제목/컬러/항목 구성**을 유지한다.
 * - 프로젝트명으로부터 해시를 계산해 테마 컬러를 정한다 (프로젝트별로 다르지만 같은 프로젝트에서는 불변).
 */

import type { Project, Task, WeeklyReportTemplate } from '../types';

const TEMPLATE_VERSION = 1;

/** 다양한 프로젝트 도메인에 어울리는 차분한 기본 팔레트 */
const THEME_PALETTE = [
  '0F766E', // teal
  '1E3A8A', // deep blue
  '7C2D12', // deep orange
  '065F46', // dark green
  '6B21A8', // purple
  '92400E', // amber brown
  '0E7490', // cyan
  '9F1239', // rose
  '1F2937', // slate
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickTheme(seed: string): string {
  return THEME_PALETTE[hashString(seed) % THEME_PALETTE.length];
}

/**
 * 템플릿 최초 생성.
 * 이미 존재하는 템플릿은 절대 재생성하지 않는다 — ensureReportTemplate 참고.
 */
export function createReportTemplate(project: Project, tasks: Task[]): WeeklyReportTemplate {
  const phases = tasks
    .filter((t) => t.level === 1)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const totalPhaseWeight = phases.reduce((s, p) => s + (p.weight || 0), 0);

  const progressCategories = phases.length > 0
    ? phases.map((p) => ({
        section: p.name,
        item: p.name,
        weight: totalPhaseWeight > 0
          ? Math.round(((p.weight || 0) / totalPhaseWeight) * 1000) / 10
          : Math.round((100 / phases.length) * 10) / 10,
      }))
    : [{ section: '전체', item: '프로젝트 진행', weight: 100 }];

  return {
    version: TEMPLATE_VERSION,
    createdAt: new Date().toISOString(),
    titlePrefix: project.name,
    themeColor: pickTheme(project.id || project.name),
    progressCategories,
    labels: {
      progressSection: '1) 공정 진도 현황',
      planSection: '2) 공정 실적 및 계획',
      wbsSheet: '2.WBS',
      devSheet: '3.프로그램개발현황',
      reportSheet: '1.공정보고',
    },
  };
}

/**
 * 프로젝트 설정에 템플릿이 있으면 그대로 사용하고,
 * 없으면 새로 만들어 반환한다 (호출자가 저장 책임).
 */
export function ensureReportTemplate(
  project: Project,
  tasks: Task[],
): { template: WeeklyReportTemplate; wasCreated: boolean } {
  const existing = project.settings?.reportTemplate;
  if (existing && existing.version === TEMPLATE_VERSION) {
    return { template: existing, wasCreated: false };
  }
  return { template: createReportTemplate(project, tasks), wasCreated: true };
}

/** 테마 HEX로부터 밝은 배경 톤을 만든다 (ARGB 6자) */
export function lightenHex(hex: string, ratio = 0.88): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * ratio).toString(16).padStart(2, '0').toUpperCase();
  return `${mix(r)}${mix(g)}${mix(b)}`;
}
