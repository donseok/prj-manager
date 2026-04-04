import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  PageNumber,
  PageBreak,
  LevelFormat,
} from 'docx';
import type { Task, Project, ProjectMember } from '../types';
import {
  calculateOverallProgress,
  getDelayedTasks,
  getWeeklyTasks,
  formatDate,
  getDelayDays,
} from './utils';

// CSS 변수를 실제 값으로 치환하는 헬퍼
function resolveCssVar(value: string): string {
  return value.replace(/var\(--[^)]+\)/g, (match) => {
    const varName = match.slice(4, -1).trim();
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#666666';
  });
}

// SVG를 PNG 버퍼로 변환
async function svgToPng(svgElement: SVGSVGElement, scale: number = 2): Promise<Uint8Array> {
  const bbox = svgElement.getBoundingClientRect();
  const width = bbox.width || svgElement.viewBox?.baseVal?.width || 600;
  const height = bbox.height || svgElement.viewBox?.baseVal?.height || 300;

  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;

  // 고정 크기 설정 (standalone 렌더링을 위해 100% → 픽셀)
  svgClone.setAttribute('width', `${width}`);
  svgClone.setAttribute('height', `${height}`);

  // 배경색 추가
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', `${width}`);
  bgRect.setAttribute('height', `${height}`);
  bgRect.setAttribute('fill', '#ffffff');
  svgClone.insertBefore(bgRect, svgClone.firstChild);

  // 원본의 모든 요소에서 computed style을 읽어 클론에 inline으로 적용
  const sourceAll = svgElement.querySelectorAll('*');
  const targetAll = svgClone.querySelectorAll('*');
  const styleProps = [
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
    'stroke-opacity', 'opacity', 'font-family', 'font-size', 'font-weight',
    'text-anchor', 'dominant-baseline', 'visibility', 'display',
  ];

  for (let i = 0; i < sourceAll.length && i < targetAll.length; i++) {
    const src = sourceAll[i];
    const tgt = targetAll[i];
    if (!(src instanceof SVGElement) || !(tgt instanceof SVGElement)) continue;

    const computed = window.getComputedStyle(src);
    for (const prop of styleProps) {
      const value = computed.getPropertyValue(prop);
      if (value !== '') {
        tgt.style.setProperty(prop, value);
      }
    }

    // SVG 프레젠테이션 속성에 남아있는 CSS 변수도 치환
    const attrs = ['fill', 'stroke', 'color', 'stop-color', 'flood-color'];
    for (const attr of attrs) {
      const attrVal = tgt.getAttribute(attr);
      if (attrVal && attrVal.includes('var(')) {
        tgt.setAttribute(attr, resolveCssVar(attrVal));
      }
    }
  }

  // 직렬화 후 혹시 남아있는 CSS 변수 최종 치환
  const svgStr = new XMLSerializer().serializeToString(svgClone);
  const resolvedSvg = resolveCssVar(svgStr);

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const img = new Image();
  const blob = new Blob([resolvedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG 이미지 로드 실패'));
    };
    img.src = url;
  });
}

// 차트 컨테이너에서 SVG 캡처
async function captureChart(containerId: string): Promise<Uint8Array | null> {
  const container = document.getElementById(containerId);
  if (!container) return null;

  // Recharts는 recharts-wrapper 안에 recharts-surface SVG를 렌더링함
  // recharts-wrapper 내의 최상위 SVG를 우선 찾고, 없으면 아무 SVG나 찾음
  const svg = (
    container.querySelector('.recharts-wrapper > svg') ||
    container.querySelector('svg.recharts-surface') ||
    container.querySelector('svg')
  ) as SVGSVGElement | null;
  if (!svg) return null;

  try {
    return await svgToPng(svg);
  } catch (e) {
    console.warn(`차트 캡처 실패 (${containerId}):`, e);
    return null;
  }
}

// 상태 한글 라벨
const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  in_progress: '진행중',
  completed: '완료',
  on_hold: '보류',
};

interface ReportData {
  project: Project;
  tasks: Task[];
  members: ProjectMember[];
}

export async function generateProjectReport({ project, tasks, members }: ReportData): Promise<void> {
  // ── 데이터 계산 ──
  const leafTasks = tasks.filter(t => !tasks.some(c => c.parentId === t.id));
  const completedTasks = leafTasks.filter(t => t.status === 'completed');
  const inProgressTasks = leafTasks.filter(t => t.status === 'in_progress');
  const pendingTasks = leafTasks.filter(t => t.status === 'pending');
  const onHoldTasks = leafTasks.filter(t => t.status === 'on_hold');
  const delayedTasks = getDelayedTasks(leafTasks);
  const overallProgress = calculateOverallProgress(tasks);
  const thisWeekTasks = getWeeklyTasks(tasks, 'this');
  const nextWeekTasks = getWeeklyTasks(tasks, 'next');

  const phases = tasks.filter(t => t.level === 1).sort((a, b) => a.orderIndex - b.orderIndex);
  const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0);
  const planProgress = totalWeight > 0
    ? Math.round(phases.reduce((sum, p) => sum + p.weight * p.planProgress, 0) / totalWeight)
    : 0;

  // 일정 계산
  let timelineInfo = '';
  if (project.startDate && project.endDate) {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const now = new Date();
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const remaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const elapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedPct = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
    timelineInfo = `총 ${totalDays}일 / 경과 ${Math.max(0, elapsed)}일 (${elapsedPct}%) / ${remaining >= 0 ? `잔여 ${remaining}일` : `초과 ${Math.abs(remaining)}일`}`;
  }

  // ── 차트 캡처 ──
  const [phaseChartImg, assigneeChartImg, weightChartImg] = await Promise.all([
    captureChart('chart-phase-progress'),
    captureChart('chart-assignee'),
    captureChart('chart-weight'),
  ]);

  // ── 스타일 상수 ──
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
  const headerShading = { fill: '1A5F59', type: ShadingType.CLEAR };
  const altShading = { fill: 'F7F9FB', type: ShadingType.CLEAR };

  const PAGE_WIDTH = 11906; // A4
  const MARGIN = 1440;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9026

  // ── 헬퍼 함수 ──
  function headerCell(text: string, width: number) {
    return new TableCell({
      borders,
      width: { size: width, type: WidthType.DXA },
      shading: headerShading,
      margins: cellMargins,
      verticalAlign: 'center' as never,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, font: 'Arial', size: 18, color: 'FFFFFF' })],
      })],
    });
  }

  function dataCell(text: string, width: number, opts?: { alignment?: typeof AlignmentType.CENTER; shading?: typeof altShading; bold?: boolean; color?: string }) {
    return new TableCell({
      borders,
      width: { size: width, type: WidthType.DXA },
      shading: opts?.shading,
      margins: cellMargins,
      children: [new Paragraph({
        alignment: opts?.alignment || AlignmentType.LEFT,
        children: [new TextRun({
          text,
          font: 'Arial',
          size: 18,
          bold: opts?.bold,
          color: opts?.color,
        })],
      })],
    });
  }

  function sectionTitle(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 200 },
      children: [new TextRun({ text, bold: true, font: 'Arial', size: 28, color: '1A5F59' })],
    });
  }

  function chartImage(data: Uint8Array, widthPx: number, heightPx: number) {
    const maxWidth = CONTENT_WIDTH * 0.9;
    const aspectRatio = heightPx / widthPx;
    const displayWidth = Math.min(maxWidth, 7200);
    const displayHeight = Math.round(displayWidth * aspectRatio);

    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
      children: [new ImageRun({
        type: 'png',
        data,
        transformation: { width: displayWidth / 15, height: displayHeight / 15 },
        altText: { title: 'Chart', description: 'Dashboard chart', name: 'chart' },
      })],
    });
  }

  // ── 문서 구성 ──
  const children: (Paragraph | Table)[] = [];
  const today = formatDate(new Date(), 'yyyy년 MM월 dd일');

  // 커버 타이틀
  children.push(
    new Paragraph({ spacing: { before: 800 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: project.name, bold: true, font: 'Arial', size: 48, color: '1A5F59' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: '프로젝트 현황 보고서', font: 'Arial', size: 32, color: '444444' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `보고일: ${today}`, font: 'Arial', size: 20, color: '888888' })],
    }),
  );

  if (project.description) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: project.description, font: 'Arial', size: 20, color: '666666', italics: true })],
    }));
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── 1. 프로젝트 개요 ──
  children.push(sectionTitle('1. 프로젝트 개요'));

  const infoCol1 = 2200;
  const infoCol2 = CONTENT_WIDTH - infoCol1;
  const infoRows: [string, string][] = [
    ['프로젝트명', project.name],
    ['시작일', formatDate(project.startDate) || '-'],
    ['종료일', formatDate(project.endDate) || '-'],
    ['일정 현황', timelineInfo || '-'],
    ['팀 멤버', `${members.length}명`],
    ['전체 작업 수', `${leafTasks.length}개`],
  ];

  children.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [infoCol1, infoCol2],
    rows: infoRows.map(([label, value], i) => new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: infoCol1, type: WidthType.DXA },
          shading: { fill: 'EBF5F4', type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 18, color: '1A5F59' })],
          })],
        }),
        new TableCell({
          borders,
          width: { size: infoCol2, type: WidthType.DXA },
          shading: i % 2 === 1 ? altShading : undefined,
          margins: cellMargins,
          children: [new Paragraph({
            children: [new TextRun({ text: value, font: 'Arial', size: 18 })],
          })],
        }),
      ],
    })),
  }));

  // ── 2. 공정율 현황 ──
  children.push(sectionTitle('2. 공정율 현황'));

  const progCol1 = 3000;
  const progCol2 = CONTENT_WIDTH - progCol1;
  const progressRows: [string, string][] = [
    ['계획 공정율', `${Math.round(planProgress)}%`],
    ['실적 공정율', `${Math.round(overallProgress)}%`],
    ['Gap', `${Math.round(overallProgress - planProgress)}%p`],
  ];

  children.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [progCol1, progCol2],
    rows: progressRows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: progCol1, type: WidthType.DXA },
          shading: { fill: 'EBF5F4', type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 18, color: '1A5F59' })],
          })],
        }),
        new TableCell({
          borders,
          width: { size: progCol2, type: WidthType.DXA },
          margins: cellMargins,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: value, bold: true, font: 'Arial', size: 22 })],
          })],
        }),
      ],
    })),
  }));

  // ── 3. 상태별 작업 분포 ──
  children.push(sectionTitle('3. 상태별 작업 분포'));

  const statCols = [CONTENT_WIDTH / 4, CONTENT_WIDTH / 4, CONTENT_WIDTH / 4, CONTENT_WIDTH / 4].map(Math.round);
  // 정확히 CONTENT_WIDTH에 맞추기
  statCols[3] = CONTENT_WIDTH - statCols[0] - statCols[1] - statCols[2];

  children.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: statCols,
    rows: [
      new TableRow({
        children: [
          headerCell('대기', statCols[0]),
          headerCell('진행중', statCols[1]),
          headerCell('완료', statCols[2]),
          headerCell('보류', statCols[3]),
        ],
      }),
      new TableRow({
        children: [
          dataCell(`${pendingTasks.length}개`, statCols[0], { alignment: AlignmentType.CENTER }),
          dataCell(`${inProgressTasks.length}개`, statCols[1], { alignment: AlignmentType.CENTER, color: '0F766E' }),
          dataCell(`${completedTasks.length}개`, statCols[2], { alignment: AlignmentType.CENTER, color: '2FA67C' }),
          dataCell(`${onHoldTasks.length}개`, statCols[3], { alignment: AlignmentType.CENTER, color: 'D88B44' }),
        ],
      }),
    ],
  }));

  // ── 4. Phase별 진행률 ──
  children.push(sectionTitle('4. Phase별 진행률'));

  if (phaseChartImg) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: '[ Phase별 계획 vs 실적 차트 ]', font: 'Arial', size: 16, color: '888888', italics: true })],
      }),
      chartImage(phaseChartImg, 600, 300),
    );
  }

  const phaseColWidths = [
    Math.round(CONTENT_WIDTH * 0.06),  // No.
    Math.round(CONTENT_WIDTH * 0.30),  // Phase명
    Math.round(CONTENT_WIDTH * 0.12),  // 가중치
    Math.round(CONTENT_WIDTH * 0.15),  // 계획 공정율
    Math.round(CONTENT_WIDTH * 0.15),  // 실적 공정율
  ];
  phaseColWidths.push(CONTENT_WIDTH - phaseColWidths.reduce((s, w) => s + w, 0)); // Gap

  children.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: phaseColWidths,
    rows: [
      new TableRow({
        children: [
          headerCell('No.', phaseColWidths[0]),
          headerCell('Phase명', phaseColWidths[1]),
          headerCell('가중치', phaseColWidths[2]),
          headerCell('계획', phaseColWidths[3]),
          headerCell('실적', phaseColWidths[4]),
          headerCell('Gap', phaseColWidths[5]),
        ],
      }),
      ...phases.map((phase, i) => {
        const gap = Math.round(phase.actualProgress - phase.planProgress);
        const gapColor = gap >= 0 ? '2FA67C' : 'CB4B5F';
        return new TableRow({
          children: [
            dataCell(`${i + 1}`, phaseColWidths[0], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(phase.name, phaseColWidths[1], { shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(`${phase.weight}`, phaseColWidths[2], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(`${Math.round(phase.planProgress)}%`, phaseColWidths[3], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(`${Math.round(phase.actualProgress)}%`, phaseColWidths[4], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(`${gap >= 0 ? '+' : ''}${gap}%p`, phaseColWidths[5], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined, bold: true, color: gapColor }),
          ],
        });
      }),
    ],
  }));

  // ── 5. 담당자별 현황 ──
  children.push(sectionTitle('5. 담당자별 현황'));

  if (assigneeChartImg) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: '[ 담당자별 작업 완료 현황 차트 ]', font: 'Arial', size: 16, color: '888888', italics: true })],
      }),
      chartImage(assigneeChartImg, 600, 270),
    );
  }

  // 담당자 데이터 계산
  const assigneeGrouped = leafTasks.reduce((acc, task) => {
    const assignee = members.find(m => m.id === task.assigneeId);
    const name = assignee?.name || '미지정';
    if (!acc[name]) acc[name] = { total: 0, completed: 0, inProgress: 0, delayed: 0 };
    acc[name].total++;
    if (task.status === 'completed') acc[name].completed++;
    if (task.status === 'in_progress') acc[name].inProgress++;
    if (delayedTasks.some(d => d.id === task.id)) acc[name].delayed++;
    return acc;
  }, {} as Record<string, { total: number; completed: number; inProgress: number; delayed: number }>);

  const assigneeCols = [
    Math.round(CONTENT_WIDTH * 0.22),
    Math.round(CONTENT_WIDTH * 0.16),
    Math.round(CONTENT_WIDTH * 0.16),
    Math.round(CONTENT_WIDTH * 0.16),
    Math.round(CONTENT_WIDTH * 0.16),
  ];
  assigneeCols.push(CONTENT_WIDTH - assigneeCols.reduce((s, w) => s + w, 0));

  children.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: assigneeCols,
    rows: [
      new TableRow({
        children: [
          headerCell('담당자', assigneeCols[0]),
          headerCell('전체', assigneeCols[1]),
          headerCell('진행중', assigneeCols[2]),
          headerCell('완료', assigneeCols[3]),
          headerCell('지연', assigneeCols[4]),
          headerCell('완료율', assigneeCols[5]),
        ],
      }),
      ...Object.entries(assigneeGrouped).map(([name, data], i) => {
        const rate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
        return new TableRow({
          children: [
            dataCell(name, assigneeCols[0], { bold: true, shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(`${data.total}`, assigneeCols[1], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(`${data.inProgress}`, assigneeCols[2], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(`${data.completed}`, assigneeCols[3], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined, color: '2FA67C' }),
            dataCell(`${data.delayed}`, assigneeCols[4], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined, color: data.delayed > 0 ? 'CB4B5F' : undefined }),
            dataCell(`${rate}%`, assigneeCols[5], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined, bold: true }),
          ],
        });
      }),
    ],
  }));

  // ── 6. Phase 가중치 분포 ──
  if (weightChartImg) {
    children.push(sectionTitle('6. Phase 가중치 분포'));
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: '[ Phase 가중치 분포 차트 ]', font: 'Arial', size: 16, color: '888888', italics: true })],
      }),
      chartImage(weightChartImg, 600, 220),
    );
  }

  // ── 7. 지연 작업 목록 ──
  const sectionNum = weightChartImg ? 7 : 6;
  children.push(sectionTitle(`${sectionNum}. 지연 작업 목록`));

  if (delayedTasks.length === 0) {
    children.push(new Paragraph({
      spacing: { before: 80, after: 200 },
      children: [new TextRun({ text: '지연된 작업이 없습니다.', font: 'Arial', size: 20, color: '2FA67C', italics: true })],
    }));
  } else {
    const delayCols = [
      Math.round(CONTENT_WIDTH * 0.06),
      Math.round(CONTENT_WIDTH * 0.38),
      Math.round(CONTENT_WIDTH * 0.14),
      Math.round(CONTENT_WIDTH * 0.16),
      Math.round(CONTENT_WIDTH * 0.14),
    ];
    delayCols.push(CONTENT_WIDTH - delayCols.reduce((s, w) => s + w, 0));

    children.push(new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: delayCols,
      rows: [
        new TableRow({
          children: [
            headerCell('No.', delayCols[0]),
            headerCell('작업명', delayCols[1]),
            headerCell('상태', delayCols[2]),
            headerCell('계획 종료일', delayCols[3]),
            headerCell('실적 공정율', delayCols[4]),
            headerCell('지연일', delayCols[5]),
          ],
        }),
        ...delayedTasks.map((task, i) => {
          const days = getDelayDays(task);
          return new TableRow({
            children: [
              dataCell(`${i + 1}`, delayCols[0], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
              dataCell(task.name, delayCols[1], { shading: i % 2 === 0 ? altShading : undefined }),
              dataCell(STATUS_LABELS[task.status] || task.status, delayCols[2], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
              dataCell(formatDate(task.planEnd), delayCols[3], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
              dataCell(`${Math.round(task.actualProgress)}%`, delayCols[4], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
              dataCell(`${days}일`, delayCols[5], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined, bold: true, color: 'CB4B5F' }),
            ],
          });
        }),
      ],
    }));
  }

  // ── 8. 금주/차주 작업 ──
  children.push(sectionTitle(`${sectionNum + 1}. 금주 / 차주 주요 작업`));

  const weekCols = [
    Math.round(CONTENT_WIDTH * 0.10),
    Math.round(CONTENT_WIDTH * 0.40),
    Math.round(CONTENT_WIDTH * 0.20),
  ];
  weekCols.push(CONTENT_WIDTH - weekCols.reduce((s, w) => s + w, 0));

  const weekTasksRows = [
    ...thisWeekTasks.slice(0, 10).map(t => ({ period: '금주', task: t })),
    ...nextWeekTasks.slice(0, 10).map(t => ({ period: '차주', task: t })),
  ];

  if (weekTasksRows.length > 0) {
    children.push(new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: weekCols,
      rows: [
        new TableRow({
          children: [
            headerCell('구분', weekCols[0]),
            headerCell('작업명', weekCols[1]),
            headerCell('기간', weekCols[2]),
            headerCell('상태', weekCols[3]),
          ],
        }),
        ...weekTasksRows.map(({ period, task }, i) => new TableRow({
          children: [
            dataCell(period, weekCols[0], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined, bold: true, color: period === '금주' ? '0F766E' : 'D88B44' }),
            dataCell(task.name, weekCols[1], { shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(`${formatDate(task.planStart)} ~ ${formatDate(task.planEnd)}`, weekCols[2], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
            dataCell(STATUS_LABELS[task.status] || task.status, weekCols[3], { alignment: AlignmentType.CENTER, shading: i % 2 === 0 ? altShading : undefined }),
          ],
        })),
      ],
    }));
  } else {
    children.push(new Paragraph({
      spacing: { before: 80, after: 200 },
      children: [new TextRun({ text: '금주/차주 예정 작업이 없습니다.', font: 'Arial', size: 20, color: '888888', italics: true })],
    }));
  }

  // ── 문서 생성 ──
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial', color: '1A5F59' },
          paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: '1A5F59' },
          paragraph: { spacing: { before: 280, after: 180 }, outlineLevel: 1 },
        },
      ],
    },
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: 16838 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `${project.name} | 프로젝트 현황 보고서`, font: 'Arial', size: 16, color: 'AAAAAA' }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: 'AAAAAA' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: 'AAAAAA' }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  // ── 다운로드 ──
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fileName = `${project.name}_현황보고서_${formatDate(new Date(), 'yyyyMMdd')}.docx`;
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
