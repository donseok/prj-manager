import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Playwright 스펙(e2e/*.spec.ts)은 vitest 가 아니라 `npm run test:e2e` 로 실행한다.
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    // vi.resetModules() 후 dataRepository 를 동적 import 하는 테스트가 있다. 전체 스위트
    // 부하에서 콜드 import 가 기본 5s 를 넘겨 타임아웃 → 중단된 비동기가 다음 테스트의
    // mock 카운터를 오염시킨다(allowFullClear 테스트가 산발적으로 실패했던 원인).
    testTimeout: 20000,
  },
})
