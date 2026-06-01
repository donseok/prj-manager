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
 * 저장된 progressCategory 형태 (선택적 phaseId 포함).
 *
 * `WeeklyReportTemplate.progressCategories` 의 선언 타입에는 phaseId 가 없지만,
 * 신규 생성 템플릿은 런타임에 phaseId 를 함께 저장한다 (rename 추적용).
 * 구버전 템플릿은 phaseId 가 없으므로 reconcile 시 이름 매칭으로 폴백한다.
 */
export interface FrozenProgressCategory {
  section: string;
  item: string;
  weight: number;
  /** 최초 고정 시점의 live phase id — 구 템플릿엔 없을 수 있음 */
  phaseId?: string | null;
}

/** reconcile 결과 — 항상 live phase 기준으로 phaseId 가 채워진다 (phase 없을 때만 null) */
export interface ResolvedProgressCategory {
  section: string;
  item: string;
  weight: number;
  phaseId: string | null;
}

/**
 * H-3: 고정된 progressCategories 를 매 내보내기마다 **live Level-1 Phase 들과
 * phase.id 기준으로 재조정**한다.
 *
 * - rename: 이름이 바뀌어도 phaseId(또는 이전 이름) 매칭으로 live phase 에 귀속,
 *   item 라벨은 live 이름으로 갱신 → 진척률이 0% 로 누락되지 않는다.
 * - 신규 phase: 결과에 새 항목으로 추가 (frozen 항목이 없으면 균등 가중치).
 * - 삭제된 phase: live phase 만 순회하므로 자동으로 제외.
 *
 * 결과는 live phase 순서(orderIndex)를 따른다. 결과 항목의 phaseId 로
 * phaseMap(phaseId 키) 을 조회하면 항상 올바른 breakdown 을 얻는다.
 *
 * live phase 가 하나도 없으면(예: 단일 '전체' 항목 템플릿) 고정 항목을 그대로 사용한다.
 */
export function reconcileProgressCategories(
  frozenCategories: ReadonlyArray<FrozenProgressCategory>,
  phases: ReadonlyArray<Task>,
): ResolvedProgressCategory[] {
  const sortedPhases = phases
    .filter((p) => p.level === 1)
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (sortedPhases.length === 0) {
    return frozenCategories.map((c) => ({
      section: c.section,
      item: c.item,
      weight: c.weight,
      phaseId: c.phaseId ?? null,
    }));
  }

  const byId = new Map<string, FrozenProgressCategory>();
  const byName = new Map<string, FrozenProgressCategory>();
  for (const c of frozenCategories) {
    if (c.phaseId) byId.set(c.phaseId, c);
    // 첫 항목 우선 (이름 중복 시 이전 동작과 동일하게 첫 매칭 유지)
    if (!byName.has(c.item)) byName.set(c.item, c);
  }

  const totalPhaseWeight = sortedPhases.reduce((s, p) => s + (p.weight || 0), 0);
  const evenShare = Math.round((100 / sortedPhases.length) * 10) / 10;

  return sortedPhases.map((phase) => {
    const matched = byId.get(phase.id) ?? byName.get(phase.name);
    if (matched) {
      return {
        // 고정 구분/가중치는 유지, 항목 라벨은 live 이름으로 갱신
        section: matched.section,
        item: phase.name,
        weight: matched.weight,
        phaseId: phase.id,
      };
    }
    // 신규 phase — 고정 가중치가 없으므로 가중치 기반(또는 균등) 산정
    return {
      section: phase.name,
      item: phase.name,
      weight: totalPhaseWeight > 0
        ? Math.round(((phase.weight || 0) / totalPhaseWeight) * 1000) / 10
        : evenShare,
      phaseId: phase.id,
    };
  });
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

  // H-3: phaseId 를 함께 저장해 두면 이후 phase 가 rename 돼도 가중치가 유지된다.
  // (stored 타입엔 phaseId 가 없으므로 런타임 값만 캐스팅으로 부착)
  const progressCategories: FrozenProgressCategory[] = phases.length > 0
    ? phases.map((p) => ({
        section: p.name,
        item: p.name,
        weight: totalPhaseWeight > 0
          ? Math.round(((p.weight || 0) / totalPhaseWeight) * 1000) / 10
          : Math.round((100 / phases.length) * 10) / 10,
        phaseId: p.id,
      }))
    : [{ section: '전체', item: '프로젝트 진행', weight: 100, phaseId: null }];

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
