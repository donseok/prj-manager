/**
 * export-content-validation.spec.ts
 * 다운로드된 엑셀/Word 파일의 내용이 올바른지 검증
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

const PROJECT_ID = 'e2e-content-test';
const PROJECT_NAME = 'Content Validation Test';
const MEMBER_ID = 'member-1';

function buildSeedData() {
  const now = new Date().toISOString();

  const authStorage = {
    state: {
      user: {
        id: 'local-user', email: 'local@localhost', name: '로컬 사용자',
        systemRole: 'admin', accountStatus: 'active', createdAt: now,
      },
    },
    version: 0,
  };

  const projects = [{
    id: PROJECT_ID, ownerId: 'local-user', name: PROJECT_NAME,
    description: '콘텐츠 검증 테스트', startDate: '2026-01-05', endDate: '2026-06-30',
    status: 'active', createdAt: now, updatedAt: now,
  }];

  const members = [
    { id: MEMBER_ID, projectId: PROJECT_ID, userId: 'local-user', name: '홍길동', role: 'owner', createdAt: now },
    { id: 'member-2', projectId: PROJECT_ID, userId: 'u2', name: '김철수', role: 'member', createdAt: now },
  ];

  const tasks = [
    {
      id: 't-p1', projectId: PROJECT_ID, parentId: null, level: 1, orderIndex: 0,
      name: '설계', output: '설계서', assigneeId: null, weight: 50,
      planStart: '2026-01-05', planEnd: '2026-03-31', planProgress: 80,
      actualStart: '2026-01-05', actualEnd: null, actualProgress: 60,
      status: 'in_progress', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-a11', projectId: PROJECT_ID, parentId: 't-p1', level: 2, orderIndex: 0,
      name: '기본설계', output: '기본설계서', assigneeId: MEMBER_ID, weight: 25,
      planStart: '2026-01-05', planEnd: '2026-02-28', planProgress: 100,
      actualStart: '2026-01-05', actualEnd: '2026-02-25', actualProgress: 100,
      status: 'completed', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-t111', projectId: PROJECT_ID, parentId: 't-a11', level: 3, orderIndex: 0,
      name: '요구사항 분석', output: '요구사항 정의서', assigneeId: MEMBER_ID, weight: 12.5,
      planStart: '2026-01-05', planEnd: '2026-01-31', planProgress: 100,
      actualStart: '2026-01-05', actualEnd: '2026-01-28', actualProgress: 100,
      status: 'completed', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-a12', projectId: PROJECT_ID, parentId: 't-p1', level: 2, orderIndex: 1,
      name: '상세설계', output: '상세설계서', assigneeId: 'member-2', weight: 25,
      planStart: '2026-02-15', planEnd: '2026-03-15', planProgress: 60,
      actualStart: '2026-02-20', actualEnd: null, actualProgress: 30,
      status: 'in_progress', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-p2', projectId: PROJECT_ID, parentId: null, level: 1, orderIndex: 1,
      name: '개발', output: '소스코드', assigneeId: null, weight: 50,
      planStart: '2026-03-15', planEnd: '2026-06-30', planProgress: 0,
      actualStart: null, actualEnd: null, actualProgress: 0,
      status: 'pending', createdAt: now, updatedAt: now, isExpanded: true,
    },
  ];

  return { authStorage, projects, members, tasks, projectId: PROJECT_ID };
}

test.describe('내보내기 콘텐츠 검증', () => {
  test.beforeEach(async ({ context }) => {
    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const seed = buildSeedData();
    await context.addInitScript((data) => {
      localStorage.setItem('auth-storage', JSON.stringify(data.authStorage));
      localStorage.setItem('dk_projects', JSON.stringify(data.projects));
      localStorage.setItem(`dk_members_${data.projectId}`, JSON.stringify(data.members));
      localStorage.setItem(`dk_tasks_${data.projectId}`, JSON.stringify(data.tasks));
    }, seed);
  });

  test.afterEach(async () => {
    if (fs.existsSync(DOWNLOADS_DIR)) {
      for (const f of fs.readdirSync(DOWNLOADS_DIR)) {
        fs.unlinkSync(path.join(DOWNLOADS_DIR, f));
      }
    }
  });

  test('WBS 엑셀 — 시트 구성 및 데이터 정확성 검증', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/wbs`);
    await expect(page.getByText('설계', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('button:has-text("엑셀")').click();
    const download = await downloadPromise;

    const downloadPath = path.join(DOWNLOADS_DIR, download.suggestedFilename());
    await download.saveAs(downloadPath);

    // ExcelJS로 파일 내용 검증
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(downloadPath);

    // 시트 2개 (WBS 보기, WBS 데이터)
    expect(wb.worksheets.length).toBe(2);
    const viewSheet = wb.getWorksheet('WBS 보기');
    const dataSheet = wb.getWorksheet('WBS 데이터');
    expect(viewSheet).toBeTruthy();
    expect(dataSheet).toBeTruthy();

    console.log('  WBS 보기 시트: 행 수 =', viewSheet!.rowCount);
    console.log('  WBS 데이터 시트: 행 수 =', dataSheet!.rowCount);

    // WBS 보기 시트: 제목 행 확인
    const titleCell = viewSheet!.getRow(1).getCell(1).value;
    expect(String(titleCell)).toContain(PROJECT_NAME);

    // WBS 데이터 시트: 헤더 확인
    const dataHeaders = dataSheet!.getRow(1);
    expect(String(dataHeaders.getCell(1).value)).toContain('WBS');
    expect(String(dataHeaders.getCell(4).value)).toContain('작업명');

    // 데이터 행 수 확인 (5개 작업 + 헤더 1줄)
    expect(dataSheet!.rowCount).toBeGreaterThanOrEqual(6);

    // 작업명 확인
    const taskNames: string[] = [];
    for (let r = 2; r <= dataSheet!.rowCount; r++) {
      const name = String(dataSheet!.getRow(r).getCell(4).value || '');
      if (name) taskNames.push(name);
    }
    expect(taskNames).toContain('설계');
    expect(taskNames).toContain('기본설계');
    expect(taskNames).toContain('요구사항 분석');
    expect(taskNames).toContain('상세설계');
    expect(taskNames).toContain('개발');

    console.log('  작업명 목록:', taskNames);
  });

  test('간트 엑셀 — 타임라인 및 시트 구성 검증', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/gantt`);
    await expect(page.getByText('설계', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('button:has-text("엑셀")').click();
    const download = await downloadPromise;

    const downloadPath = path.join(DOWNLOADS_DIR, download.suggestedFilename());
    await download.saveAs(downloadPath);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(downloadPath);

    // 시트 2개 (간트 보기, 간트 데이터)
    expect(wb.worksheets.length).toBe(2);
    const viewSheet = wb.getWorksheet('간트 보기');
    const dataSheet = wb.getWorksheet('간트 데이터');
    expect(viewSheet).toBeTruthy();
    expect(dataSheet).toBeTruthy();

    console.log('  간트 보기 시트: 행 수 =', viewSheet!.rowCount, ', 열 수 =', viewSheet!.columnCount);
    console.log('  간트 데이터 시트: 행 수 =', dataSheet!.rowCount);

    // 제목 확인
    const titleCell = viewSheet!.getRow(1).getCell(1).value;
    expect(String(titleCell)).toContain(PROJECT_NAME);

    // 간트 보기: 고정 헤더 8열 + 타임라인 주차 열
    const headerRow = viewSheet!.getRow(5); // row 5 is header (title + 2 meta + spacer + header)
    const wbsHeader = String(headerRow.getCell(1).value || '');
    expect(wbsHeader).toBe('WBS');

    // 간트 데이터: 작업명 확인
    const taskNames: string[] = [];
    for (let r = 2; r <= dataSheet!.rowCount; r++) {
      const name = String(dataSheet!.getRow(r).getCell(4).value || '');
      if (name) taskNames.push(name);
    }
    expect(taskNames.length).toBe(5);
    console.log('  간트 작업명:', taskNames);
  });

  test('주간보고 엑셀 — 요약 및 섹션 구성 검증', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/wbs`);
    await expect(page.getByText('설계', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("주간보고")').click();
    await expect(page.getByText('전체 작업')).toBeVisible({ timeout: 5000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('button:has-text("엑셀 내보내기")').click();
    const download = await downloadPromise;

    const downloadPath = path.join(DOWNLOADS_DIR, download.suggestedFilename());
    await download.saveAs(downloadPath);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(downloadPath);

    // 시트 1개 (주간보고)
    expect(wb.worksheets.length).toBe(1);
    const ws = wb.getWorksheet('주간보고');
    expect(ws).toBeTruthy();

    console.log('  주간보고 시트: 행 수 =', ws!.rowCount);

    // 제목 확인
    const titleCell = String(ws!.getRow(1).getCell(1).value || '');
    expect(titleCell).toContain(PROJECT_NAME);
    expect(titleCell).toContain('주간보고');

    // "요약" 섹션 존재 확인
    let foundSummary = false;
    let foundThisWeek = false;
    let foundNextWeek = false;
    let foundDelayed = false;
    let foundCompleted = false;

    for (let r = 1; r <= ws!.rowCount; r++) {
      const cellValue = String(ws!.getRow(r).getCell(1).value || '');
      if (cellValue === '요약') foundSummary = true;
      if (cellValue === '금주 실적') foundThisWeek = true;
      if (cellValue === '차주 계획') foundNextWeek = true;
      if (cellValue === '지연 작업') foundDelayed = true;
      if (cellValue === '금주 완료') foundCompleted = true;
    }

    expect(foundSummary).toBe(true);
    expect(foundThisWeek).toBe(true);
    expect(foundNextWeek).toBe(true);
    expect(foundDelayed).toBe(true);
    expect(foundCompleted).toBe(true);

    console.log('  주간보고 섹션: 요약, 금주 실적, 차주 계획, 지연 작업, 금주 완료 — 모두 존재');
  });

  test('현황보고서(Word) — 파일 크기 및 구조 검증', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);
    await expect(page.locator('button:has-text("현황 보고서")').first()).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("현황 보고서")').first().click();
    const download = await downloadPromise;

    const downloadPath = path.join(DOWNLOADS_DIR, download.suggestedFilename());
    await download.saveAs(downloadPath);

    const stat = fs.statSync(downloadPath);
    console.log(`  현황보고서 크기: ${(stat.size / 1024).toFixed(1)} KB`);

    // .docx는 ZIP 포맷이므로 ZIP 시그니처 확인 (PK\x03\x04)
    const buffer = fs.readFileSync(downloadPath);
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4B); // 'K'
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);

    // 파일명에 프로젝트명 포함
    expect(download.suggestedFilename()).toContain('현황보고서');

    // 크기가 충분히 큰지 (테이블+텍스트 포함)
    expect(stat.size).toBeGreaterThan(5000);

    console.log('  Word 파일 구조: 유효한 DOCX(ZIP) 형식 확인');
  });
});
