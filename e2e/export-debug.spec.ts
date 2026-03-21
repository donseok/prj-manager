import { test } from '@playwright/test';

const PROJECT_ID = 'e2e-export-test';

test('debug: auth-storage 실제 형식 확인', async ({ page }) => {
  // 앱에 접속하여 자동 로그인 후 auth-storage 형식 확인
  await page.goto('/');
  await page.waitForTimeout(3000);

  const authStorage = await page.evaluate(() => localStorage.getItem('auth-storage'));
  console.log('auth-storage 실제 형식:', authStorage);

  const url = page.url();
  console.log('현재 URL:', url);
});

test('debug: 시드된 auth로 WBS 접근', async ({ context, page }) => {
  // Step 1: 먼저 앱에 접속하여 자동 로그인
  const page1 = await context.newPage();
  await page1.goto('/');
  await page1.waitForTimeout(3000);

  // auth-storage 가져오기
  const authStorage = await page1.evaluate(() => localStorage.getItem('auth-storage'));
  console.log('auth-storage:', authStorage);

  // Step 2: 프로젝트 데이터 시드
  const now = new Date().toISOString();
  await page1.evaluate((data) => {
    localStorage.setItem('dk_projects', JSON.stringify(data.projects));
    localStorage.setItem(`dk_members_${data.projectId}`, JSON.stringify(data.members));
    localStorage.setItem(`dk_tasks_${data.projectId}`, JSON.stringify(data.tasks));
  }, {
    projectId: PROJECT_ID,
    projects: [{
      id: PROJECT_ID, ownerId: 'local-user', name: 'Debug Test',
      startDate: '2026-01-05', endDate: '2026-06-30', status: 'active',
      createdAt: now, updatedAt: now,
    }],
    members: [
      { id: 'm1', projectId: PROJECT_ID, userId: 'local-user', name: '홍길동', role: 'owner', createdAt: now },
    ],
    tasks: [
      {
        id: 't1', projectId: PROJECT_ID, parentId: null, level: 1, orderIndex: 0,
        name: '테스트 Phase', output: '', assigneeId: 'm1', weight: 100,
        planStart: '2026-01-05', planEnd: '2026-03-31', planProgress: 50,
        actualStart: '2026-01-05', actualEnd: null, actualProgress: 30,
        status: 'in_progress', createdAt: now, updatedAt: now, isExpanded: true,
      },
    ],
  });

  await page1.close();

  // Step 3: 새 페이지에서 WBS 접근
  await page.goto(`/projects/${PROJECT_ID}/wbs`);
  await page.waitForTimeout(5000);
  console.log('WBS URL:', page.url());
  await page.screenshot({ path: 'e2e/debug-wbs2.png' });

  const body = await page.locator('body').innerText();
  console.log('Body (300 chars):', body.slice(0, 300));
});
