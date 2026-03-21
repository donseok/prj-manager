/**
 * export-downloads.spec.ts
 * WBS 엑셀, 간트 엑셀, 주간보고 엑셀, 현황보고서(Word) 내보내기 E2E 테스트
 *
 * localStorage 모드(Supabase 없음)에서 동작.
 * addInitScript로 페이지 로드 전에 localStorage를 시드 (auth 포함).
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

const PROJECT_ID = 'e2e-export-test';
const PROJECT_NAME = 'E2E Export Test';
const MEMBER_ID = 'member-1';

function buildSeedData() {
  const now = new Date().toISOString();

  // Zustand persist 형식의 auth storage
  const authStorage = {
    state: {
      user: {
        id: 'local-user',
        email: 'local@localhost',
        name: '로컬 사용자',
        systemRole: 'admin',
        accountStatus: 'active',
        createdAt: now,
      },
    },
    version: 0,
  };

  const projects = [
    {
      id: PROJECT_ID,
      ownerId: 'local-user',
      name: PROJECT_NAME,
      description: 'E2E 테스트용',
      startDate: '2026-01-05',
      endDate: '2026-06-30',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const members = [
    { id: MEMBER_ID, projectId: PROJECT_ID, userId: 'local-user', name: '홍길동', role: 'owner', createdAt: now },
    { id: 'member-2', projectId: PROJECT_ID, userId: 'u2', name: '김철수', role: 'member', createdAt: now },
    { id: 'member-3', projectId: PROJECT_ID, userId: 'u3', name: '이영희', role: 'member', createdAt: now },
  ];

  const tasks = [
    {
      id: 't-p1', projectId: PROJECT_ID, parentId: null, level: 1, orderIndex: 0,
      name: '기획 Phase', output: '기획서', assigneeId: null, weight: 40,
      planStart: '2026-01-05', planEnd: '2026-03-31', planProgress: 80,
      actualStart: '2026-01-05', actualEnd: null, actualProgress: 60,
      status: 'in_progress', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-a11', projectId: PROJECT_ID, parentId: 't-p1', level: 2, orderIndex: 0,
      name: '기본설계', output: '기본설계서', assigneeId: MEMBER_ID, weight: 20,
      planStart: '2026-01-05', planEnd: '2026-02-28', planProgress: 100,
      actualStart: '2026-01-05', actualEnd: '2026-02-25', actualProgress: 100,
      status: 'completed', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-t111', projectId: PROJECT_ID, parentId: 't-a11', level: 3, orderIndex: 0,
      name: '요구사항 분석', output: '요구사항 정의서', assigneeId: MEMBER_ID, weight: 10,
      planStart: '2026-01-05', planEnd: '2026-01-31', planProgress: 100,
      actualStart: '2026-01-05', actualEnd: '2026-01-28', actualProgress: 100,
      status: 'completed', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-t112', projectId: PROJECT_ID, parentId: 't-a11', level: 3, orderIndex: 1,
      name: '아키텍처 설계', output: '아키텍처 설계서', assigneeId: 'member-2', weight: 10,
      planStart: '2026-02-01', planEnd: '2026-02-28', planProgress: 100,
      actualStart: '2026-02-01', actualEnd: '2026-02-25', actualProgress: 100,
      status: 'completed', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-a12', projectId: PROJECT_ID, parentId: 't-p1', level: 2, orderIndex: 1,
      name: '상세설계', output: '상세설계서', assigneeId: 'member-2', weight: 20,
      planStart: '2026-02-15', planEnd: '2026-03-15', planProgress: 80,
      actualStart: '2026-02-20', actualEnd: null, actualProgress: 40,
      status: 'in_progress', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-t121', projectId: PROJECT_ID, parentId: 't-a12', level: 3, orderIndex: 0,
      name: 'DB 설계', output: 'ERD', assigneeId: 'member-2', weight: 10,
      planStart: '2026-02-15', planEnd: '2026-03-01', planProgress: 100,
      actualStart: '2026-02-20', actualEnd: null, actualProgress: 70,
      status: 'in_progress', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-t122', projectId: PROJECT_ID, parentId: 't-a12', level: 3, orderIndex: 1,
      name: 'API 설계', output: 'API 명세서', assigneeId: 'member-3', weight: 10,
      planStart: '2026-03-01', planEnd: '2026-03-15', planProgress: 50,
      actualStart: '2026-03-05', actualEnd: null, actualProgress: 20,
      status: 'in_progress', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-p2', projectId: PROJECT_ID, parentId: null, level: 1, orderIndex: 1,
      name: '개발 Phase', output: '소스코드', assigneeId: null, weight: 60,
      planStart: '2026-03-15', planEnd: '2026-06-30', planProgress: 20,
      actualStart: null, actualEnd: null, actualProgress: 0,
      status: 'pending', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-a21', projectId: PROJECT_ID, parentId: 't-p2', level: 2, orderIndex: 0,
      name: '프론트엔드 개발', output: '화면', assigneeId: 'member-3', weight: 30,
      planStart: '2026-03-15', planEnd: '2026-05-31', planProgress: 10,
      actualStart: null, actualEnd: null, actualProgress: 0,
      status: 'pending', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-t211', projectId: PROJECT_ID, parentId: 't-a21', level: 3, orderIndex: 0,
      name: '로그인 화면 개발', output: '로그인 페이지', assigneeId: 'member-3', weight: 15,
      planStart: '2026-03-15', planEnd: '2026-04-15', planProgress: 0,
      actualStart: null, actualEnd: null, actualProgress: 0,
      status: 'pending', createdAt: now, updatedAt: now, isExpanded: true,
    },
    {
      id: 't-t212', projectId: PROJECT_ID, parentId: 't-a21', level: 3, orderIndex: 1,
      name: '대시보드 화면 개발', output: '대시보드 페이지', assigneeId: 'member-3', weight: 15,
      planStart: '2026-04-15', planEnd: '2026-05-31', planProgress: 0,
      actualStart: null, actualEnd: null, actualProgress: 0,
      status: 'pending', createdAt: now, updatedAt: now, isExpanded: true,
    },
  ];

  return { authStorage, projects, members, tasks, projectId: PROJECT_ID };
}

function ensureDownloadsDir() {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
}

function cleanDownloadsDir() {
  if (fs.existsSync(DOWNLOADS_DIR)) {
    for (const f of fs.readdirSync(DOWNLOADS_DIR)) {
      fs.unlinkSync(path.join(DOWNLOADS_DIR, f));
    }
  }
}

test.describe('내보내기 기능 E2E 테스트', () => {
  test.beforeEach(async ({ context }) => {
    ensureDownloadsDir();
    const seed = buildSeedData();
    // 페이지 로드 전에 localStorage에 auth + project 데이터 시드
    await context.addInitScript((data) => {
      // Auth store (Zustand persist 형식)
      localStorage.setItem('auth-storage', JSON.stringify(data.authStorage));
      // 프로젝트 데이터
      localStorage.setItem('dk_projects', JSON.stringify(data.projects));
      localStorage.setItem(`dk_members_${data.projectId}`, JSON.stringify(data.members));
      localStorage.setItem(`dk_tasks_${data.projectId}`, JSON.stringify(data.tasks));
    }, seed);
  });

  test.afterEach(async () => {
    cleanDownloadsDir();
  });

  test('WBS 엑셀 내보내기 — 파일 다운로드 및 크기 확인', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/wbs`);

    // WBS 테이블 로드 대기 — 작업명이 표시될 때까지
    await expect(page.getByText('기획 Phase', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    // 다운로드 이벤트 감지
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('button:has-text("엑셀")').click();
    const download = await downloadPromise;

    // 파일명 확인
    const fileName = download.suggestedFilename();
    expect(fileName).toContain('WBS');
    expect(fileName).toContain('.xlsx');

    // 파일 저장 후 크기 확인 (최소 5KB)
    const downloadPath = path.join(DOWNLOADS_DIR, fileName);
    await download.saveAs(downloadPath);
    const stat = fs.statSync(downloadPath);
    console.log(`  WBS Excel: ${fileName} (${(stat.size / 1024).toFixed(1)} KB)`);
    expect(stat.size).toBeGreaterThan(5000);
  });

  test('주간보고 모달 — 데이터 표시 및 엑셀 내보내기', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/wbs`);
    await expect(page.getByText('기획 Phase', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    // 주간보고 버튼 클릭
    await page.locator('button:has-text("주간보고")').click();

    // 모달이 열렸는지 확인 — KPI 카드
    await expect(page.getByText('전체 작업')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('실적 공정율').first()).toBeVisible();

    // 요약 현황 탭의 "계획 vs 실적" 섹션
    await expect(page.getByText('계획 vs 실적')).toBeVisible();

    // 상세 작업 탭 전환
    await page.locator('button:has-text("상세 작업")').click();
    await page.waitForTimeout(300);
    await expect(page.getByText('금주 실적')).toBeVisible();
    await expect(page.getByText('차주 계획')).toBeVisible();
    await expect(page.getByText('지연 작업')).toBeVisible();
    await expect(page.getByText('금주 완료')).toBeVisible();

    // 엑셀 내보내기 버튼 클릭
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('button:has-text("엑셀 내보내기")').click();
    const download = await downloadPromise;

    const fileName = download.suggestedFilename();
    expect(fileName).toContain('주간보고');
    expect(fileName).toContain('.xlsx');

    const downloadPath = path.join(DOWNLOADS_DIR, fileName);
    await download.saveAs(downloadPath);
    const stat = fs.statSync(downloadPath);
    console.log(`  주간보고 Excel: ${fileName} (${(stat.size / 1024).toFixed(1)} KB)`);
    expect(stat.size).toBeGreaterThan(4000);
  });

  test('간트 엑셀 내보내기 — 파일 다운로드 및 크기 확인', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/gantt`);

    // 간트 차트 로드 대기
    await expect(page.getByText('기획 Phase', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    // 엑셀 내보내기 버튼 클릭
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('button:has-text("엑셀")').click();
    const download = await downloadPromise;

    const fileName = download.suggestedFilename();
    expect(fileName).toContain('간트');
    expect(fileName).toContain('.xlsx');

    const downloadPath = path.join(DOWNLOADS_DIR, fileName);
    await download.saveAs(downloadPath);
    const stat = fs.statSync(downloadPath);
    console.log(`  간트 Excel: ${fileName} (${(stat.size / 1024).toFixed(1)} KB)`);
    expect(stat.size).toBeGreaterThan(5000);
  });

  test('현황보고서(Word) 내보내기 — 파일 다운로드 및 크기 확인', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);

    // 대시보드 로드 대기 — 현황 보고서 버튼
    await expect(page.locator('button:has-text("현황 보고서")').first()).toBeVisible({ timeout: 15000 });

    // 현황 보고서 버튼 클릭
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("현황 보고서")').first().click();
    const download = await downloadPromise;

    const fileName = download.suggestedFilename();
    expect(fileName).toContain('현황보고서');
    expect(fileName).toContain('.docx');

    const downloadPath = path.join(DOWNLOADS_DIR, fileName);
    await download.saveAs(downloadPath);
    const stat = fs.statSync(downloadPath);
    console.log(`  현황보고서 Word: ${fileName} (${(stat.size / 1024).toFixed(1)} KB)`);
    expect(stat.size).toBeGreaterThan(3000);
  });

  test('주간보고 — 스냅샷 저장 동작 확인', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/wbs`);
    await expect(page.getByText('기획 Phase', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("주간보고")').click();
    await expect(page.getByText('전체 작업')).toBeVisible({ timeout: 5000 });

    // 스냅샷 저장 버튼 클릭
    await page.locator('button:has-text("스냅샷 저장")').click();
    await page.waitForTimeout(500);

    // "저장됨" 텍스트 확인
    await expect(page.locator('button:has-text("저장됨")')).toBeVisible({ timeout: 3000 });

    // localStorage에 스냅샷이 저장되었는지 확인
    const snapshots = await page.evaluate((pid) => {
      return localStorage.getItem(`weekly_snapshots_${pid}`);
    }, PROJECT_ID);
    expect(snapshots).not.toBeNull();
    const parsed = JSON.parse(snapshots!);
    expect(parsed.length).toBeGreaterThan(0);
  });

  test('주간보고 — 주차 네비게이션 동작 확인', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/wbs`);
    await expect(page.getByText('기획 Phase', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("주간보고")').click();
    await expect(page.getByText('전체 작업')).toBeVisible({ timeout: 5000 });

    // 현재 주차 라벨 확인
    const weekLabelBefore = await page.locator('.weekly-report-week-label span').textContent();
    expect(weekLabelBefore).toContain('주차');

    // 이전 주 버튼 클릭
    await page.locator('.weekly-report-nav-btn').first().click();
    await page.waitForTimeout(300);

    // 주차 라벨이 변경되었는지 확인
    const weekLabelAfter = await page.locator('.weekly-report-week-label span').textContent();
    expect(weekLabelAfter).toContain('주차');
    expect(weekLabelAfter).not.toBe(weekLabelBefore);

    // "이번 주" 버튼이 나타나는지 확인
    await expect(page.locator('button:has-text("이번 주")')).toBeVisible();
  });
});
