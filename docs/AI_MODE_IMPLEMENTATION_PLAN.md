# AI 자동입력/수동입력 모드 구현 계획

## 개요
DK Flow에 AI 기반 WBS 자동 생성 및 실적 자동 입력 기능을 추가하여, AI 자동입력 모드와 수동입력 모드를 전환할 수 있게 구현한다.

- **AI Provider**: Claude + OpenAI 둘 다 지원
- **API Key**: 환경변수(`VITE_AI_PROVIDER`, `VITE_AI_API_KEY`) 우선, 없으면 Settings UI에서 입력
- **모드 토글 위치**: 전역 헤더(Header.tsx)

---

## Phase 1: 모드 토글 인프라 + AI 설정

### Task 1-1: 타입 정의 확장
**파일:** `src/types/index.ts`
- `Task.taskSource`에 `'ai_generated'` 추가
- `AIProvider`, `AISettings` 타입 추가

### Task 1-2: UIStore에 입력모드 상태 추가
**파일:** `src/store/uiStore.ts`
- `inputMode: 'ai' | 'manual'` 상태 (localStorage 영속)
- `setInputMode(mode)` 액션

### Task 1-3: AI 서비스 레이어 생성
**새 파일들:** `src/lib/ai/` 디렉토리

| 파일 | 역할 |
|------|------|
| `aiConfig.ts` | AI 설정 로드/저장, `isAIConfigured()` 체크 |
| `aiClient.ts` | Claude/OpenAI API 호출 추상화, fetch 기반 |
| `aiPrompts.ts` | WBS 생성/실적 제안 프롬프트 템플릿 |
| `index.ts` | barrel export |

### Task 1-4: Header에 AI/수동 모드 토글 추가
**파일:** `src/components/layout/Header.tsx`
- 날짜 표시 옆에 pill 형태 스위치 배치
- AI 미설정 시 비활성화 + 툴팁

### Task 1-5: Settings에 AI 설정 섹션 추가
**파일:** `src/pages/Settings.tsx`
- Provider 선택 (Claude / OpenAI)
- API Key 입력 (마스킹)
- "연결 테스트" 버튼
- 환경변수 설정 시 안내 표시

---

## Phase 2: AI WBS 자동 생성

### Task 2-1: AI WBS 생성 서비스
**새 파일:** `src/lib/ai/aiWbsGenerator.ts`
- `generateWbsWithAI()` 함수
- AI 응답 → Task[] 파싱, `taskSource: 'ai_generated'`
- 실패 시 기존 템플릿 폴백

### Task 2-2: WBS 초안생성 모달 확장
**파일:** `src/pages/WBS.tsx`
- 기존 모달에 탭 추가: "템플릿 기반" / "AI 생성"
- AI 탭: 프로젝트 설명 textarea + "AI로 WBS 생성" 버튼
- 미리보기 트리 표시

### Task 2-3: AI 생성 미리보기 컴포넌트
**새 파일:** `src/components/wbs/AIReviewPanel.tsx`
- 트리 형태 미리보기
- 개별 작업 체크/해제
- "AI 생성" 배지

### Task 2-4: WBS 테이블에 AI 생성 표시
**파일:** `src/pages/WBS.tsx`
- `taskSource === 'ai_generated'` → Sparkles 아이콘

---

## Phase 3: AI 실적 자동입력

### Task 3-1: AI 실적 제안 서비스
**새 파일:** `src/lib/ai/aiProgressSuggestion.ts`
- `suggestProgressUpdates()` 함수
- 결과: `{ taskId, suggestedProgress, suggestedStatus, reason }[]`

### Task 3-2: AI 실적입력 패널
**새 파일:** `src/components/wbs/AISuggestionPanel.tsx`
- WBS 상단에 제안 패널
- 각 제안에 수락/거절
- "전체 적용" 기능

### Task 3-3: QuickProgressModal 연동
**파일:** `src/components/wbs/QuickProgressModal.tsx`
- AI 모드일 때 AI 추천값 미리 채움

---

## 수정 대상 파일 요약

| Phase | 신규 파일 | 수정 파일 |
|-------|-----------|-----------|
| 1 | `src/lib/ai/aiConfig.ts`, `aiClient.ts`, `aiPrompts.ts`, `index.ts` | `types/index.ts`, `store/uiStore.ts`, `Header.tsx`, `Settings.tsx` |
| 2 | `src/lib/ai/aiWbsGenerator.ts`, `components/wbs/AIReviewPanel.tsx` | `pages/WBS.tsx` |
| 3 | `src/lib/ai/aiProgressSuggestion.ts`, `components/wbs/AISuggestionPanel.tsx` | `pages/WBS.tsx`, `QuickProgressModal.tsx` |

## 검증
1. `npm run build` — 빌드 에러 없음
2. 헤더 AI/수동 모드 전환 (새로고침 유지)
3. Settings AI 설정 → 연결 테스트
4. WBS AI 탭 → 생성 → 미리보기 → 적용
5. AI 실적 제안 → 수락 → 반영
6. `npm run test:e2e` — 기존 테스트 통과
