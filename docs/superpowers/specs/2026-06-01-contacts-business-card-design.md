# 명함등록(전역 명함첩) 기능 설계

- **작성일**: 2026-06-01
- **상태**: 설계 확정 (구현 대기)
- **접근법**: A — 심플 전역 명함첩

## 1. 개요 및 목표

DK Flow에 외부 연락처(거래처)를 명함 형태로 등록·관리하는 기능을 추가한다.

- **목적**: 고객사·협력사·외부 담당자의 명함을 등록해 **전사 공용 연락처 주소록**을 구축한다.
- **입력 방식**: 수기 입력. 명함 사진은 선택적으로 첨부(OCR 없음, 외부 의존성 없음).
- **소속 범위**: 전사 공용. 명함을 특정 프로젝트에 **태그처럼 연결**해 필터링 가능.
- **권한**: 로그인한 모든 활성 사용자가 조회·등록·수정·삭제 가능(평면 권한). `createdBy`는 기록용.

### 비목표 (YAGNI)
- OCR / AI Vision 자동 인식
- 프로젝트별 별도 연락처 탭(추후 저렴하게 추가 가능 — 본 스펙 범위 외)
- 조인 테이블 정규화, Supabase Storage 버킷
- 명함 공유/내보내기, 즐겨찾기, 변경 이력

## 2. 데이터 모델 (`src/types/index.ts`)

```ts
export interface Contact {
  id: string;
  name: string;               // 이름 (필수)
  company?: string;           // 회사
  department?: string;        // 부서
  title?: string;             // 직책
  mobile?: string;            // 휴대폰
  phone?: string;             // 유선전화
  fax?: string;               // 팩스
  email?: string;             // 이메일
  address?: string;           // 주소
  website?: string;           // 웹사이트
  tags: string[];             // 태그/분류
  memo?: string;              // 메모/비고
  cardImage?: string;         // 명함 사진 (축소된 base64 data URL)
  linkedProjectIds: string[]; // 연결된 프로젝트 ID 목록
  createdBy: string;          // 등록자 userId
  createdAt: string;          // ISO 문자열
  updatedAt: string;          // ISO 문자열
}
```

- **필수 필드**: `name` 만 필수. 나머지는 모두 선택.
- `tags`, `linkedProjectIds`는 항상 배열(빈 배열 허용, `undefined` 아님).
- 신규 명함 `id`는 `crypto.randomUUID()` 사용(코드베이스 기존 관례 따름).

## 3. 데이터 계층 (`src/lib/dataRepository.ts`)

기존 `attendance` 패턴을 그대로 따른다.

- **`ContactRow`** 인터페이스(snake_case): `linked_project_ids`, `card_image`, `created_by`, `created_at`, `updated_at` 등.
- **`mapContactRow(row): Contact`** / **`toContactRow(contact): ContactRow`** — DB ↔ 앱 필드 매핑.
- **`loadContacts(): Promise<Contact[]>`**
  - Supabase 설정 시: `contacts` 테이블 전체 select, `updated_at desc` 정렬.
  - 미설정 시: `storage.get<Contact[]>(LS_CONTACTS_KEY, [])`.
- **`upsertContact(contact): Promise<Contact>`**
  - Supabase: `upsert(row, { onConflict: 'id' }).select().single()`.
  - 폴백: 단일 전역 배열에서 id로 교체/추가 후 `storage.set`.
- **`deleteContactById(id): Promise<void>`**
  - Supabase: `delete().eq('id', id)`. 폴백: 배열 필터링.
- localStorage 키: `LS_CONTACTS_KEY = 'dkflow:contacts'` (전역 단일 배열, projectId 스코프 없음).
- 에러 처리는 attendance와 동일: `isAuthError(error)` → `handleSessionExpired()`, 실패 시 한국어 메시지로 throw, `data` 없을 때 RLS 차단 가능성 안내.

## 4. Supabase 마이그레이션

파일: `supabase/migrations/20260601<HHMMSS>_add_contacts.sql`

```sql
create table if not exists public.contacts (
  id uuid primary key,
  name text not null,
  company text,
  department text,
  title text,
  mobile text,
  phone text,
  fax text,
  email text,
  address text,
  website text,
  tags text[] not null default '{}',
  memo text,
  card_image text,                          -- base64 data URL
  linked_project_ids text[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_name_idx on public.contacts (name);
create index if not exists contacts_tags_idx on public.contacts using gin (tags);
create index if not exists contacts_linked_projects_idx on public.contacts using gin (linked_project_ids);

alter table public.contacts enable row level security;

-- 모든 로그인(authenticated) 사용자: 조회·등록·수정·삭제 허용
create policy "contacts_select" on public.contacts for select to authenticated using (true);
create policy "contacts_insert" on public.contacts for insert to authenticated with check (true);
create policy "contacts_update" on public.contacts for update to authenticated using (true) with check (true);
create policy "contacts_delete" on public.contacts for delete to authenticated using (true);
```

- `<HHMMSS>`는 기존 마이그레이션 명명 규칙(타임스탬프)에 맞춰 생성 시 확정.
- 기존 마이그레이션과 동일하게 `grant` 가 필요한 경우 같은 파일에 포함.

## 5. 상태 관리 (`src/store/contactStore.ts`)

`attendanceStore` 패턴(Zustand). 전역 데이터이므로 projectId 스코프 없음.

```ts
interface ContactStore {
  contacts: Contact[];
  isLoading: boolean;
  loadContacts: () => Promise<void>;
  addContact: (contact: Contact) => Promise<void>;
  updateContact: (contact: Contact) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
}
```

- `add/update`: 낙관적 업데이트 후 `upsertContact` 호출, 실패 시 롤백 + 에러 전파(상위 모달에서 toast/alert).
- `remove`: 낙관적 제거 후 `deleteContactById`.
- `updatedAt`은 저장 시점에 갱신.

## 6. UI & 라우팅

### 라우팅 (`src/App.tsx`)
- 신규 최상위 라우트 `/contacts` 를 `ProtectedRoute` 하위(`/portfolio`, `/me` 와 동일 레벨)에 추가.
- 사이드바/레이아웃 네비게이션에 **"명함첩"** 항목 추가(아이콘: Lucide `Contact` 또는 `IdCard` 계열).

### `src/pages/Contacts.tsx`
- 상단 툴바: 검색창(이름·회사·이메일 부분일치), 태그 필터(칩), 프로젝트 필터 드롭다운, **"명함 등록"** 버튼.
- 본문: 명함 카드 그리드(이름·회사·직책·연락처·태그·썸네일). 빈 상태 메시지.
- 카드 클릭 → 상세/수정 모달. 삭제는 확인 후 실행.
- 마운트 시 `loadContacts()` 호출.

### `src/components/contacts/ContactModal.tsx`
- 추가/수정 공용 폼. 필드: 이름(필수) 외 위 모델의 모든 항목.
- 명함 사진: 파일 선택/드래그&드롭 → `contactImage` 유틸로 리사이즈 후 미리보기. 삭제 가능.
- 프로젝트 연결: `projectStore`의 프로젝트 목록으로 다중 선택.
- 태그: 입력 후 칩 추가/삭제.
- 저장 시 유효성: `name` 비어있으면 막기, `email` 형식 가벼운 검증.

## 7. 사진 처리 (`src/lib/contactImage.ts`)

```ts
// 업로드 File → canvas 리사이즈(최대 변 ~1024px) → JPEG 압축 → base64 data URL
export async function fileToResizedDataUrl(file: File, maxEdge?: number, quality?: number): Promise<string>;
```

- 최대 변 ~1024px, JPEG 품질 ~0.8로 압축해 대략 100~200KB 목표.
- 결과 크기가 임계치(예: 500KB) 초과 시 경고하고 더 강하게 압축 또는 거부.
- 비이미지 파일 거부.

## 8. i18n

`src/i18n/locales/ko.ts` / `en.ts` / `vi.ts` 에 `contacts` 네임스페이스 추가:
- 메뉴 라벨("명함첩"), 페이지 제목, 필드 라벨 전체, 버튼(등록/수정/삭제/저장/취소), 빈 상태·검색 placeholder·삭제 확인 문구.
- 기존 다국어 키 구조/관례를 그대로 따른다.

## 9. 에러 처리

- repository: attendance와 동일하게 인증 만료 처리 및 한국어 에러 메시지.
- store: 낙관적 업데이트 실패 시 롤백 + 에러 throw, UI에서 사용자 안내.
- 사진: 용량 초과·형식 오류 시 사용자에게 명확히 안내.

## 10. 테스트

기존 위치 규칙(`src/lib/__tests__`, `src/store/__tests__`) 준수.

- `mapContactRow` / `toContactRow` 라운드트립 + 배열/`undefined` 경계.
- `contactStore` CRUD(낙관적 업데이트, 실패 롤백) — repository 모킹.
- `contactImage.fileToResizedDataUrl` 리사이즈/압축 동작(가능 범위 내 단위 테스트).

## 11. 변경/생성 파일 요약

| 구분 | 파일 |
|------|------|
| 신규 | `src/pages/Contacts.tsx` |
| 신규 | `src/components/contacts/ContactModal.tsx` |
| 신규 | `src/store/contactStore.ts` |
| 신규 | `src/lib/contactImage.ts` |
| 신규 | `supabase/migrations/20260601<HHMMSS>_add_contacts.sql` |
| 수정 | `src/types/index.ts` (Contact 인터페이스) |
| 수정 | `src/lib/dataRepository.ts` (Contact CRUD + Row 매핑) |
| 수정 | `src/App.tsx` (`/contacts` 라우트) |
| 수정 | 레이아웃 네비게이션 컴포넌트 (명함첩 메뉴) |
| 수정 | `src/i18n/locales/{ko,en,vi}.ts` (contacts 네임스페이스) |
| 신규 | 테스트: `src/lib/__tests__`, `src/store/__tests__` |
