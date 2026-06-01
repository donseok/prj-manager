# 전역 명함첩(명함등록) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DK Flow에 외부 연락처(거래처)를 명함 형태로 수기 등록·검색·관리하는 전사 공용 명함첩(`/contacts`)을 추가한다.

**Architecture:** 기존 `attendance` 기능의 계층 구조(타입 → dataRepository Row 매핑 → Zustand store → 페이지/모달 UI → Supabase 마이그레이션+RLS)를 그대로 따른다. 명함은 프로젝트에 종속되지 않는 전역 데이터이며, `linkedProjectIds: string[]`로 프로젝트와 느슨하게 연결된다. 명함 사진은 클라이언트에서 리사이즈한 base64 data URL을 행에 저장한다(Storage 버킷 미사용).

**Tech Stack:** React 19 + TypeScript, Zustand 5, React Router 7, Supabase(선택), Tailwind CSS 4, Lucide icons, Vitest(단위 테스트), i18next(ko/en/vi).

**참고 — 단위 테스트 실행:** 이 저장소에는 `test` npm 스크립트가 없다. 단위 테스트는 항상 `npx vitest run <경로>` 로 실행한다. 빌드 검증은 `npm run build`, 린트는 `npm run lint`.

---

## 파일 구조

| 구분 | 파일 | 책임 |
|------|------|------|
| 수정 | `src/types/index.ts` | `Contact` 인터페이스 정의 |
| 수정 | `src/lib/dataRepository.ts` | `ContactRow` + 매핑 + `loadContacts`/`upsertContact`/`deleteContactById` |
| 신규 | `src/lib/contactImage.ts` | 명함 사진 리사이즈/검증 유틸 |
| 신규 | `src/store/contactStore.ts` | 명함 전역 상태 + 낙관적 CRUD |
| 신규 | `supabase/migrations/<ts>_add_contacts.sql` | `contacts` 테이블 + RLS |
| 신규 | `src/components/contacts/ContactModal.tsx` | 명함 추가/수정 폼 모달 |
| 신규 | `src/pages/Contacts.tsx` | 명함첩 목록/검색/필터 페이지 |
| 수정 | `src/App.tsx` | `/contacts` 라우트 |
| 수정 | `src/components/layout/Sidebar.tsx` | "명함첩" 전역 네비 항목 |
| 수정 | `src/i18n/locales/ko.ts`, `en.ts`, `vi.ts` | `contacts` 네임스페이스 + `sidebar.contacts` |
| 신규 | `src/lib/__tests__/contactImage.test.ts` | 리사이즈/검증 유틸 단위 테스트 |
| 신규 | `src/lib/__tests__/contactRepository.test.ts` | Row 매핑 + 로컬 폴백 단위 테스트 |
| 신규 | `src/store/__tests__/contactStore.test.ts` | store 낙관적 CRUD/롤백 단위 테스트 |

---

## Task 1: `Contact` 타입 정의

**Files:**
- Modify: `src/types/index.ts` (파일 끝에 추가)

- [ ] **Step 1: `Contact` 인터페이스 추가**

`src/types/index.ts` 파일 끝(마지막 `export` 다음)에 추가:

```ts
// ─── 명함(연락처) ───────────────────────────────────────────
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

- [ ] **Step 2: 타입 컴파일 확인**

Run: `npx tsc -b`
Expected: 에러 없이 통과 (기존 코드에 영향 없음).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: 명함(Contact) 타입 정의 추가"
```

---

## Task 2: 명함 사진 리사이즈 유틸 (`contactImage.ts`)

순수 함수(`scaleToFit`, `estimateDataUrlBytes`, `isImageFile`)는 jsdom에서 테스트하고, canvas/Image에 의존하는 `fileToResizedDataUrl`은 브라우저에서 동작한다.

**Files:**
- Create: `src/lib/contactImage.ts`
- Test: `src/lib/__tests__/contactImage.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/contactImage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scaleToFit, estimateDataUrlBytes, isImageFile } from '../contactImage';

describe('scaleToFit', () => {
  it('최대 변보다 작으면 원본 크기를 유지한다', () => {
    expect(scaleToFit(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });

  it('가로가 더 길면 가로를 최대 변에 맞춘다', () => {
    expect(scaleToFit(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 });
  });

  it('세로가 더 길면 세로를 최대 변에 맞춘다', () => {
    expect(scaleToFit(1000, 2000, 1024)).toEqual({ width: 512, height: 1024 });
  });
});

describe('estimateDataUrlBytes', () => {
  it('base64 길이로부터 대략적인 바이트 수를 추정한다', () => {
    // "AAAA" (4 base64 chars) ≈ 3 bytes
    expect(estimateDataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3);
  });

  it('콤마가 없으면 0을 반환한다', () => {
    expect(estimateDataUrlBytes('')).toBe(0);
  });
});

describe('isImageFile', () => {
  it('image/* MIME 타입이면 true', () => {
    expect(isImageFile(new File([''], 'a.png', { type: 'image/png' }))).toBe(true);
  });

  it('이미지가 아니면 false', () => {
    expect(isImageFile(new File([''], 'a.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/__tests__/contactImage.test.ts`
Expected: FAIL — `Failed to resolve import "../contactImage"` (모듈 없음).

- [ ] **Step 3: 유틸 구현**

`src/lib/contactImage.ts`:

```ts
// 명함 사진 업로드 처리: 리사이즈 + JPEG 압축 → base64 data URL

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.8;
const MAX_BYTES = 500 * 1024; // 약 500KB

export class ImageTooLargeError extends Error {}

/** image/* MIME 타입 여부 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/** 최대 변(maxEdge)에 맞춰 비율을 유지한 목표 크기를 계산한다 */
export function scaleToFit(
  w: number,
  h: number,
  maxEdge: number,
): { width: number; height: number } {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const ratio = w > h ? maxEdge / w : maxEdge / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/** base64 data URL의 실제 바이트 수를 추정한다 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = src;
  });
}

/**
 * 업로드한 이미지 File을 최대 변 maxEdge로 리사이즈하고 JPEG로 압축하여
 * base64 data URL을 반환한다. 결과가 MAX_BYTES를 초과하면 ImageTooLargeError.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<string> {
  if (!isImageFile(file)) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const { width, height } = scaleToFit(img.width, img.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지 처리를 지원하지 않는 브라우저입니다.');
  ctx.drawImage(img, 0, 0, width, height);
  const result = canvas.toDataURL('image/jpeg', quality);
  if (estimateDataUrlBytes(result) > MAX_BYTES) {
    throw new ImageTooLargeError('이미지 용량이 너무 큽니다. 더 작은 사진을 사용해주세요.');
  }
  return result;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/__tests__/contactImage.test.ts`
Expected: PASS (9개 단언 통과).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contactImage.ts src/lib/__tests__/contactImage.test.ts
git commit -m "feat: 명함 사진 리사이즈/검증 유틸 추가"
```

---

## Task 3: dataRepository에 명함 CRUD 추가

`toProjectRow`가 이미 export되어 있으므로(기존 관례) `mapContactRow`/`toContactRow`도 export하여 테스트 가능하게 한다.

**Files:**
- Modify: `src/lib/dataRepository.ts`
  - 1번째 줄 import에 `Contact` 추가
  - localStorage 키 함수 영역(약 30-34줄)에 `lsContactsKey` 추가
  - attendance 함수 블록(약 642-705줄) 뒤에 명함 코드 추가
- Test: `src/lib/__tests__/contactRepository.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/contactRepository.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Contact } from '../../types';

// Supabase 미설정(로컬 폴백) 분기를 검증한다.
const mockState = { isSupabaseConfigured: false };
vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return mockState.isSupabaseConfigured;
  },
  supabase: {},
}));

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1',
    name: '홍길동',
    company: '대광',
    tags: ['고객'],
    linkedProjectIds: ['p1'],
    createdBy: 'u1',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('contact Row 매핑', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('toContactRow → mapContactRow 라운드트립이 값을 보존한다', async () => {
    const { toContactRow, mapContactRow } = await import('../dataRepository');
    const contact = makeContact({ email: 'a@b.com', memo: undefined, title: '' });
    const restored = mapContactRow(toContactRow(contact));
    expect(restored.name).toBe('홍길동');
    expect(restored.email).toBe('a@b.com');
    expect(restored.tags).toEqual(['고객']);
    expect(restored.linkedProjectIds).toEqual(['p1']);
    // 빈 문자열/undefined 선택 필드는 undefined로 정규화된다
    expect(restored.title).toBeUndefined();
    expect(restored.memo).toBeUndefined();
  });

  it('null 배열 컬럼은 빈 배열로 매핑된다', async () => {
    const { mapContactRow } = await import('../dataRepository');
    const restored = mapContactRow({
      id: 'c2', name: 'A', company: null, department: null, title: null,
      mobile: null, phone: null, fax: null, email: null, address: null,
      website: null, tags: null, memo: null, card_image: null,
      linked_project_ids: null, created_by: null,
      created_at: 'x', updated_at: 'y',
    });
    expect(restored.tags).toEqual([]);
    expect(restored.linkedProjectIds).toEqual([]);
    expect(restored.createdBy).toBe('');
  });
});

describe('contact 로컬 폴백 CRUD', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mockState.isSupabaseConfigured = false;
  });

  it('upsert → load → delete 가 로컬스토리지에서 동작한다', async () => {
    const { upsertContact, loadContacts, deleteContactById } = await import('../dataRepository');
    await upsertContact(makeContact());
    let list = await loadContacts();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('홍길동');

    await upsertContact(makeContact({ name: '김철수' }));
    list = await loadContacts();
    expect(list).toHaveLength(1); // 같은 id면 교체
    expect(list[0].name).toBe('김철수');

    await deleteContactById('c1');
    list = await loadContacts();
    expect(list).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/__tests__/contactRepository.test.ts`
Expected: FAIL — `toContactRow`/`mapContactRow`/`loadContacts` 등이 export되지 않음.

- [ ] **Step 3: import에 `Contact` 추가**

`src/lib/dataRepository.ts` 1번째 줄을 수정:

```ts
import type { Project, ProjectMember, Task, Attendance, WeeklyMemberReport, Contact } from '../types';
```

- [ ] **Step 4: localStorage 키 함수 추가**

`src/lib/dataRepository.ts`의 `function lsAttendanceKey(pid: string) { return ... }` 줄 바로 다음에 추가:

```ts
function lsContactsKey() { return 'dkflow:contacts'; }
```

- [ ] **Step 5: 명함 Row/매핑/CRUD 구현**

`src/lib/dataRepository.ts`의 `deleteAttendanceById` 함수 정의가 끝나는 `}` 바로 다음(`// ─── Account Deletion ───` 주석 앞)에 추가:

```ts
// ─── Contacts (명함) ─────────────────────────────────────────

interface ContactRow {
  id: string;
  name: string;
  company: string | null;
  department: string | null;
  title: string | null;
  mobile: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  tags: string[] | null;
  memo: string | null;
  card_image: string | null;
  linked_project_ids: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    company: row.company || undefined,
    department: row.department || undefined,
    title: row.title || undefined,
    mobile: row.mobile || undefined,
    phone: row.phone || undefined,
    fax: row.fax || undefined,
    email: row.email || undefined,
    address: row.address || undefined,
    website: row.website || undefined,
    tags: row.tags ?? [],
    memo: row.memo || undefined,
    cardImage: row.card_image || undefined,
    linkedProjectIds: row.linked_project_ids ?? [],
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toContactRow(c: Contact): ContactRow {
  return {
    id: c.id,
    name: c.name,
    company: c.company || null,
    department: c.department || null,
    title: c.title || null,
    mobile: c.mobile || null,
    phone: c.phone || null,
    fax: c.fax || null,
    email: c.email || null,
    address: c.address || null,
    website: c.website || null,
    tags: c.tags ?? [],
    memo: c.memo || null,
    card_image: c.cardImage || null,
    linked_project_ids: c.linkedProjectIds ?? [],
    created_by: c.createdBy || null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export async function loadContacts(): Promise<Contact[]> {
  if (!isSupabaseConfigured) return storage.get<Contact[]>(lsContactsKey(), []);

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    if (isAuthError(error)) { handleSessionExpired(); return []; }
    console.error('[contacts] load 실패:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return [];
  }

  return (data as ContactRow[]).map(mapContactRow);
}

export async function upsertContact(contact: Contact): Promise<Contact> {
  if (!isSupabaseConfigured) {
    const list = storage.get<Contact[]>(lsContactsKey(), []);
    const idx = list.findIndex((c) => c.id === contact.id);
    if (idx >= 0) list[idx] = contact; else list.unshift(contact);
    storage.set(lsContactsKey(), list);
    return contact;
  }

  const row = toContactRow(contact);
  const { data, error } = await supabase
    .from('contacts')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    if (isAuthError(error)) { handleSessionExpired(); throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.'); }
    console.error('[contacts] upsert 실패:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
    throw new Error(`명함 저장 실패 [${error.code}]: ${error.message}${error.hint ? ` (${error.hint})` : ''}`);
  }

  if (!data) {
    console.error('[contacts] upsert 결과 없음 (RLS 차단 가능성)');
    throw new Error('명함 저장 실패: 권한이 없거나 데이터가 반환되지 않았습니다.');
  }

  return mapContactRow(data as ContactRow);
}

export async function deleteContactById(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const list = storage.get<Contact[]>(lsContactsKey(), []);
    storage.set(lsContactsKey(), list.filter((c) => c.id !== id));
    return;
  }
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete contact:', error);
    throw new Error(`명함 삭제 실패: ${error.message}`);
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/lib/__tests__/contactRepository.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dataRepository.ts src/lib/__tests__/contactRepository.test.ts
git commit -m "feat: dataRepository에 명함 CRUD 및 Row 매핑 추가"
```

---

## Task 4: 명함 store (`contactStore.ts`)

전역 데이터이므로 projectId 스코프가 없고, 액션 내부에서 dataRepository를 직접 호출하며 낙관적 업데이트 + 실패 시 롤백한다. 액션 이름과 import한 repository 함수 이름이 겹치므로 import에 별칭을 쓴다.

**Files:**
- Create: `src/store/contactStore.ts`
- Test: `src/store/__tests__/contactStore.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/store/__tests__/contactStore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Contact } from '../../types';

const repo = {
  loadContacts: vi.fn(),
  upsertContact: vi.fn(),
  deleteContactById: vi.fn(),
};
vi.mock('../../lib/dataRepository', () => ({
  loadContacts: (...a: unknown[]) => repo.loadContacts(...a),
  upsertContact: (...a: unknown[]) => repo.upsertContact(...a),
  deleteContactById: (...a: unknown[]) => repo.deleteContactById(...a),
}));

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1', name: '홍길동', tags: [], linkedProjectIds: [],
    createdBy: 'u1', createdAt: 't', updatedAt: 't', ...overrides,
  };
}

describe('useContactStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useContactStore } = await import('../contactStore');
    useContactStore.setState({ contacts: [], isLoading: false });
  });

  it('loadContacts가 repository 결과로 상태를 채운다', async () => {
    repo.loadContacts.mockResolvedValue([makeContact()]);
    const { useContactStore } = await import('../contactStore');
    await useContactStore.getState().loadContacts();
    expect(useContactStore.getState().contacts).toHaveLength(1);
    expect(useContactStore.getState().isLoading).toBe(false);
  });

  it('saveContact가 신규 명함을 낙관적으로 추가하고 저장 결과로 교체한다', async () => {
    const saved = makeContact({ name: '저장됨' });
    repo.upsertContact.mockResolvedValue(saved);
    const { useContactStore } = await import('../contactStore');
    await useContactStore.getState().saveContact(makeContact());
    expect(useContactStore.getState().contacts[0].name).toBe('저장됨');
  });

  it('saveContact 실패 시 이전 상태로 롤백하고 에러를 전파한다', async () => {
    repo.upsertContact.mockRejectedValue(new Error('boom'));
    const { useContactStore } = await import('../contactStore');
    await expect(useContactStore.getState().saveContact(makeContact())).rejects.toThrow('boom');
    expect(useContactStore.getState().contacts).toHaveLength(0);
  });

  it('removeContact가 낙관적으로 제거하고 실패 시 롤백한다', async () => {
    const { useContactStore } = await import('../contactStore');
    useContactStore.setState({ contacts: [makeContact()], isLoading: false });
    repo.deleteContactById.mockRejectedValue(new Error('del-fail'));
    await expect(useContactStore.getState().removeContact('c1')).rejects.toThrow('del-fail');
    expect(useContactStore.getState().contacts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/store/__tests__/contactStore.test.ts`
Expected: FAIL — `Failed to resolve import "../contactStore"`.

- [ ] **Step 3: store 구현**

`src/store/contactStore.ts`:

```ts
import { create } from 'zustand';
import type { Contact } from '../types';
import {
  loadContacts as repoLoadContacts,
  upsertContact as repoUpsertContact,
  deleteContactById as repoDeleteContact,
} from '../lib/dataRepository';

interface ContactState {
  contacts: Contact[];
  isLoading: boolean;

  loadContacts: () => Promise<void>;
  /** 추가/수정 공용 (id가 이미 있으면 교체, 없으면 앞에 추가) */
  saveContact: (contact: Contact) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  isLoading: false,

  loadContacts: async () => {
    set({ isLoading: true });
    const contacts = await repoLoadContacts();
    set({ contacts, isLoading: false });
  },

  saveContact: async (contact) => {
    const prev = get().contacts;
    const exists = prev.some((c) => c.id === contact.id);
    const optimistic = exists
      ? prev.map((c) => (c.id === contact.id ? contact : c))
      : [contact, ...prev];
    set({ contacts: optimistic });
    try {
      const saved = await repoUpsertContact(contact);
      set((state) => ({
        contacts: state.contacts.map((c) => (c.id === saved.id ? saved : c)),
      }));
    } catch (e) {
      set({ contacts: prev });
      throw e;
    }
  },

  removeContact: async (id) => {
    const prev = get().contacts;
    set({ contacts: prev.filter((c) => c.id !== id) });
    try {
      await repoDeleteContact(id);
    } catch (e) {
      set({ contacts: prev });
      throw e;
    }
  },
}));
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/store/__tests__/contactStore.test.ts`
Expected: PASS (4개 테스트 통과).

- [ ] **Step 5: Commit**

```bash
git add src/store/contactStore.ts src/store/__tests__/contactStore.test.ts
git commit -m "feat: 명함 전역 store(낙관적 CRUD) 추가"
```

---

## Task 5: Supabase 마이그레이션

**Files:**
- Create: `supabase/migrations/<timestamp>_add_contacts.sql`

- [ ] **Step 1: 타임스탬프로 파일명 결정**

기존 마이그레이션 명명 규칙(`YYYYMMDDHHMMSS_설명.sql`)을 따른다. 가장 최근 마이그레이션이 `20260530140000_...` 이므로 그보다 큰 값을 사용한다. 파일명: `supabase/migrations/20260601100000_add_contacts.sql`.

- [ ] **Step 2: 마이그레이션 작성**

`supabase/migrations/20260601100000_add_contacts.sql`:

```sql
-- 전역 명함첩(contacts) 테이블
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
drop policy if exists "contacts_select" on public.contacts;
drop policy if exists "contacts_insert" on public.contacts;
drop policy if exists "contacts_update" on public.contacts;
drop policy if exists "contacts_delete" on public.contacts;

create policy "contacts_select" on public.contacts for select to authenticated using (true);
create policy "contacts_insert" on public.contacts for insert to authenticated with check (true);
create policy "contacts_update" on public.contacts for update to authenticated using (true) with check (true);
create policy "contacts_delete" on public.contacts for delete to authenticated using (true);

grant select, insert, update, delete on public.contacts to authenticated;
```

- [ ] **Step 3: SQL 문법 자체 점검**

마이그레이션은 Supabase가 설정된 환경에서만 적용된다. 로컬(localStorage) 모드 개발에는 영향이 없다. 파일 내용만 검토하고 커밋한다(실제 적용은 `npm run db:migrate` 또는 Supabase 대시보드에서 별도 수행).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260601100000_add_contacts.sql
git commit -m "feat: contacts 테이블 마이그레이션 및 RLS 추가"
```

---

## Task 6: i18n 키 추가 (ko / en / vi)

세 로케일 모두에 `sidebar.contacts` 와 최상위 `contacts` 네임스페이스를 추가한다. 각 로케일 파일의 동일한 위치(구조)에 넣는다.

**Files:**
- Modify: `src/i18n/locales/ko.ts`
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/vi.ts`

- [ ] **Step 1: `ko.ts` 에 sidebar 라벨 추가**

`src/i18n/locales/ko.ts` 의 `sidebar:` 객체에서 `portfolio: '포트폴리오',` 줄 바로 다음에 추가:

```ts
      contacts: '명함첩',
```

- [ ] **Step 2: `ko.ts` 에 contacts 네임스페이스 추가**

`src/i18n/locales/ko.ts` 의 최상위 번역 객체에서 `attendance: { ... }` 블록이 끝나는 `},` 바로 다음에 추가(다른 최상위 네임스페이스와 같은 들여쓰기 레벨):

```ts
    contacts: {
      title: '명함첩',
      subtitle: '거래처 연락처를 등록하고 관리합니다',
      addContact: '명함 등록',
      editContact: '명함 수정',
      searchPlaceholder: '이름·회사·이메일 검색',
      filterByTag: '태그',
      filterByProject: '프로젝트',
      allTags: '전체 태그',
      allProjects: '전체 프로젝트',
      empty: '등록된 명함이 없습니다',
      emptyHint: '오른쪽 위 “명함 등록” 버튼으로 첫 명함을 추가하세요',
      deleteConfirm: '이 명함을 삭제할까요?',
      saving: '저장 중…',
      fields: {
        name: '이름',
        company: '회사',
        department: '부서',
        title: '직책',
        mobile: '휴대폰',
        phone: '유선전화',
        fax: '팩스',
        email: '이메일',
        address: '주소',
        website: '웹사이트',
        tags: '태그',
        memo: '메모',
        cardImage: '명함 사진',
        linkedProjects: '연결 프로젝트',
      },
      tagInputPlaceholder: '태그 입력 후 Enter',
      uploadImage: '사진 업로드',
      removeImage: '사진 제거',
      nameRequired: '이름은 필수입니다',
      invalidEmail: '이메일 형식이 올바르지 않습니다',
      save: '저장',
      cancel: '취소',
      delete: '삭제',
    },
```

- [ ] **Step 3: `en.ts` 에 동일 키 추가 (영문)**

`src/i18n/locales/en.ts` 의 `sidebar` 객체 `portfolio` 다음에:

```ts
      contacts: 'Contacts',
```

`attendance` 네임스페이스가 끝나는 `},` 다음에:

```ts
    contacts: {
      title: 'Contacts',
      subtitle: 'Register and manage business contacts',
      addContact: 'Add Contact',
      editContact: 'Edit Contact',
      searchPlaceholder: 'Search name, company, email',
      filterByTag: 'Tag',
      filterByProject: 'Project',
      allTags: 'All tags',
      allProjects: 'All projects',
      empty: 'No contacts yet',
      emptyHint: 'Use the “Add Contact” button to create your first one',
      deleteConfirm: 'Delete this contact?',
      saving: 'Saving…',
      fields: {
        name: 'Name',
        company: 'Company',
        department: 'Department',
        title: 'Title',
        mobile: 'Mobile',
        phone: 'Phone',
        fax: 'Fax',
        email: 'Email',
        address: 'Address',
        website: 'Website',
        tags: 'Tags',
        memo: 'Memo',
        cardImage: 'Business card photo',
        linkedProjects: 'Linked projects',
      },
      tagInputPlaceholder: 'Type a tag and press Enter',
      uploadImage: 'Upload photo',
      removeImage: 'Remove photo',
      nameRequired: 'Name is required',
      invalidEmail: 'Invalid email format',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
    },
```

- [ ] **Step 4: `vi.ts` 에 동일 키 추가 (베트남어)**

`src/i18n/locales/vi.ts` 의 `sidebar` 객체 `portfolio` 다음에:

```ts
      contacts: 'Danh thiếp',
```

`attendance` 네임스페이스가 끝나는 `},` 다음에:

```ts
    contacts: {
      title: 'Danh thiếp',
      subtitle: 'Đăng ký và quản lý liên hệ đối tác',
      addContact: 'Thêm danh thiếp',
      editContact: 'Sửa danh thiếp',
      searchPlaceholder: 'Tìm tên, công ty, email',
      filterByTag: 'Thẻ',
      filterByProject: 'Dự án',
      allTags: 'Tất cả thẻ',
      allProjects: 'Tất cả dự án',
      empty: 'Chưa có danh thiếp',
      emptyHint: 'Dùng nút “Thêm danh thiếp” để tạo mục đầu tiên',
      deleteConfirm: 'Xóa danh thiếp này?',
      saving: 'Đang lưu…',
      fields: {
        name: 'Tên',
        company: 'Công ty',
        department: 'Phòng ban',
        title: 'Chức danh',
        mobile: 'Di động',
        phone: 'Điện thoại',
        fax: 'Fax',
        email: 'Email',
        address: 'Địa chỉ',
        website: 'Website',
        tags: 'Thẻ',
        memo: 'Ghi chú',
        cardImage: 'Ảnh danh thiếp',
        linkedProjects: 'Dự án liên kết',
      },
      tagInputPlaceholder: 'Nhập thẻ rồi nhấn Enter',
      uploadImage: 'Tải ảnh lên',
      removeImage: 'Xóa ảnh',
      nameRequired: 'Tên là bắt buộc',
      invalidEmail: 'Định dạng email không hợp lệ',
      save: 'Lưu',
      cancel: 'Hủy',
      delete: 'Xóa',
    },
```

- [ ] **Step 5: 타입/빌드 확인**

Run: `npx tsc -b`
Expected: 통과. (en.ts가 타입 소스인 경우 ko/vi가 동일 키를 가져야 하므로 누락 시 여기서 오류가 난다. 오류가 나면 누락 키를 보완한다.)

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales/ko.ts src/i18n/locales/en.ts src/i18n/locales/vi.ts
git commit -m "feat: 명함첩 i18n 키(ko/en/vi) 추가"
```

---

## Task 7: 명함 추가/수정 모달 (`ContactModal.tsx`)

**Files:**
- Create: `src/components/contacts/ContactModal.tsx`

- [ ] **Step 1: 모달 컴포넌트 구현**

`src/components/contacts/ContactModal.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, Loader2 } from 'lucide-react';
import type { Contact } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';
import { fileToResizedDataUrl } from '../../lib/contactImage';
import { cn } from '../../lib/utils';

interface ContactModalProps {
  contact: Contact | null; // null이면 신규
  onClose: () => void;
  onSave: (contact: Contact) => Promise<void>;
}

const EMPTY = {
  name: '', company: '', department: '', title: '', mobile: '',
  phone: '', fax: '', email: '', address: '', website: '', memo: '',
};

export default function ContactModal({ contact, onClose, onSave }: ContactModalProps) {
  const { t } = useTranslation();
  const projects = useProjectStore((s) => s.projects);
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');

  const [form, setForm] = useState({
    name: contact?.name ?? EMPTY.name,
    company: contact?.company ?? EMPTY.company,
    department: contact?.department ?? EMPTY.department,
    title: contact?.title ?? EMPTY.title,
    mobile: contact?.mobile ?? EMPTY.mobile,
    phone: contact?.phone ?? EMPTY.phone,
    fax: contact?.fax ?? EMPTY.fax,
    email: contact?.email ?? EMPTY.email,
    address: contact?.address ?? EMPTY.address,
    website: contact?.website ?? EMPTY.website,
    memo: contact?.memo ?? EMPTY.memo,
  });
  const [tags, setTags] = useState<string[]>(contact?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [linkedProjectIds, setLinkedProjectIds] = useState<string[]>(contact?.linkedProjectIds ?? []);
  const [cardImage, setCardImage] = useState<string | undefined>(contact?.cardImage);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addTag = () => {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };

  const toggleProject = (id: string) =>
    setLinkedProjectIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setCardImage(await fileToResizedDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('contacts.nameRequired')); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t('contacts.invalidEmail')); return;
    }
    const now = new Date().toISOString();
    const next: Contact = {
      id: contact?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      department: form.department.trim() || undefined,
      title: form.title.trim() || undefined,
      mobile: form.mobile.trim() || undefined,
      phone: form.phone.trim() || undefined,
      fax: form.fax.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      website: form.website.trim() || undefined,
      tags,
      memo: form.memo.trim() || undefined,
      cardImage,
      linkedProjectIds,
      createdBy: contact?.createdBy || currentUserId,
      createdAt: contact?.createdAt ?? now,
      updatedAt: now,
    };
    setError(null);
    setSaving(true);
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, labelKey: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--text-secondary)]">{t(`contacts.fields.${labelKey}`)}</span>
      <input
        className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--surface-0)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {contact ? t('contacts.editContact') : t('contacts.addContact')}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--surface-2)]" aria-label={t('contacts.cancel')}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('name', 'name')}
          {field('company', 'company')}
          {field('department', 'department')}
          {field('title', 'title')}
          {field('mobile', 'mobile')}
          {field('phone', 'phone')}
          {field('fax', 'fax')}
          {field('email', 'email')}
          {field('website', 'website')}
        </div>

        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="text-[var(--text-secondary)]">{t('contacts.fields.address')}</span>
          <input className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2"
            value={form.address} onChange={(e) => set('address', e.target.value)} />
        </label>

        {/* 태그 */}
        <div className="mt-3 text-sm">
          <span className="text-[var(--text-secondary)]">{t('contacts.fields.tags')}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">
                {tag}
                <button onClick={() => setTags(tags.filter((x) => x !== tag))} aria-label={`${tag} ${t('contacts.delete')}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2"
            placeholder={t('contacts.tagInputPlaceholder')}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          />
        </div>

        {/* 연결 프로젝트 */}
        <div className="mt-3 text-sm">
          <span className="text-[var(--text-secondary)]">{t('contacts.fields.linkedProjects')}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleProject(p.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  linkedProjectIds.includes(p.id)
                    ? 'border-transparent bg-[var(--accent-primary)] text-white'
                    : 'border-[var(--border)] text-[var(--text-secondary)]',
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 메모 */}
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="text-[var(--text-secondary)]">{t('contacts.fields.memo')}</span>
          <textarea rows={3} className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2"
            value={form.memo} onChange={(e) => set('memo', e.target.value)} />
        </label>

        {/* 명함 사진 */}
        <div className="mt-3 text-sm">
          <span className="text-[var(--text-secondary)]">{t('contacts.fields.cardImage')}</span>
          <div className="mt-1 flex items-center gap-3">
            {cardImage && <img src={cardImage} alt="" className="h-20 rounded-lg border border-[var(--border)] object-cover" />}
            <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-2)]">
              <Upload size={16} /> {t('contacts.uploadImage')}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => handleImage(e.target.files?.[0])} />
            </label>
            {cardImage && (
              <button onClick={() => setCardImage(undefined)} className="text-xs text-red-600">
                {t('contacts.removeImage')}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-[var(--surface-2)]">
            {t('contacts.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? t('contacts.saving') : t('contacts.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

> **참고:** `var(--border)`, `var(--surface-0/1/2)`, `var(--accent-primary)`, `var(--text-secondary)` 등 CSS 변수가 `src/index.css`에 정의되어 있는지 확인하고, 다른 이름이면 기존 모달(예: `src/components/WeeklyReportModal.tsx`)에서 쓰는 실제 클래스/변수로 맞춘다.

- [ ] **Step 2: 타입/빌드 확인**

Run: `npx tsc -b`
Expected: 통과. (`useProjectStore`/`useAuthStore`의 실제 셀렉터 시그니처와 `projects`, `user.id` 필드명을 확인하고 다르면 맞춘다.)

- [ ] **Step 3: Commit**

```bash
git add src/components/contacts/ContactModal.tsx
git commit -m "feat: 명함 추가/수정 모달 컴포넌트 추가"
```

---

## Task 8: 명함첩 페이지 (`Contacts.tsx`)

**Files:**
- Create: `src/pages/Contacts.tsx`

- [ ] **Step 1: 페이지 구현**

`src/pages/Contacts.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Mail, Phone, Building2, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { Contact } from '../types';
import { useContactStore } from '../store/contactStore';
import { useProjectStore } from '../store/projectStore';
import ContactModal from '../components/contacts/ContactModal';

export default function Contacts() {
  const { t } = useTranslation();
  const { contacts, isLoading, loadContacts, saveContact, removeContact } = useContactStore();
  const projects = useProjectStore((s) => s.projects);

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

  const allTags = useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags))).sort(),
    [contacts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      const matchesQuery = !q ||
        c.name.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q);
      const matchesTag = !tagFilter || c.tags.includes(tagFilter);
      const matchesProject = !projectFilter || c.linkedProjectIds.includes(projectFilter);
      return matchesQuery && matchesTag && matchesProject;
    });
  }, [contacts, query, tagFilter, projectFilter]);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setModalOpen(true); };

  const handleDelete = async (c: Contact) => {
    if (!window.confirm(t('contacts.deleteConfirm'))) return;
    try { await removeContact(c.id); } catch (e) { window.alert(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('contacts.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('contacts.subtitle')}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm text-white">
          <Plus size={16} /> {t('contacts.addContact')}
        </button>
      </div>

      {/* 검색/필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] py-2 pl-9 pr-3 text-sm"
            placeholder={t('contacts.searchPlaceholder')}
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm"
          value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="">{t('contacts.allTags')}</option>
          {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <select className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm"
          value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">{t('contacts.allProjects')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-[var(--text-secondary)]"><Loader2 className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] py-20 text-center text-[var(--text-secondary)]">
          <p className="font-medium">{t('contacts.empty')}</p>
          <p className="mt-1 text-sm">{t('contacts.emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-0)] p-4">
              {c.cardImage && <img src={c.cardImage} alt="" className="mb-3 h-28 w-full rounded-lg object-cover" />}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  {(c.company || c.title) && (
                    <p className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                      <Building2 size={12} /> {[c.company, c.title].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => openEdit(c)} className="rounded p-1 hover:bg-[var(--surface-2)]" aria-label={t('contacts.editContact')}><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(c)} className="rounded p-1 text-red-600 hover:bg-[var(--surface-2)]" aria-label={t('contacts.delete')}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                {c.mobile && <p className="flex items-center gap-1"><Phone size={12} /> {c.mobile}</p>}
                {c.email && <p className="flex items-center gap-1"><Mail size={12} /> {c.email}</p>}
              </div>
              {c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">{tag}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ContactModal
          contact={editing}
          onClose={() => setModalOpen(false)}
          onSave={saveContact}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입/빌드 확인**

Run: `npx tsc -b`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Contacts.tsx
git commit -m "feat: 명함첩 목록/검색/필터 페이지 추가"
```

---

## Task 9: 라우팅 + 사이드바 네비 연결

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: `App.tsx` 에 Contacts import 추가**

`src/App.tsx` 상단의 페이지 import들(예: `Portfolio` import) 근처에 추가:

```ts
import Contacts from './pages/Contacts';
```

- [ ] **Step 2: `/contacts` 라우트 추가**

`src/App.tsx` 의 `<Route path="portfolio" element={<Portfolio />} />` 줄(약 185줄, ProtectedRoute 하위) 바로 다음에 추가:

```tsx
          <Route path="contacts" element={<Contacts />} />
```

(Portfolio 라우트의 실제 표기가 `path="portfolio"`인지 확인하고 같은 형식·들여쓰기로 맞춘다.)

- [ ] **Step 3: 사이드바 아이콘 import 추가**

`src/components/layout/Sidebar.tsx` 의 lucide-react import 목록(2번째 줄)에 `Contact` 추가:

```ts
import { LayoutDashboard, ListTree, Calendar, Users, Settings, FolderOpen, Plus, ChevronRight, PanelLeftClose, PanelLeftOpen, ShieldCheck, BookOpen, ExternalLink, CalendarCheck, Columns3, Briefcase, UserCheck, Contact } from 'lucide-react';
```

- [ ] **Step 4: 전역 네비 항목 추가**

`src/components/layout/Sidebar.tsx` 의 `getGlobalNavItems` 함수에서 `{ to: '/portfolio', icon: Briefcase, label: t('sidebar.portfolio') },` 줄 바로 다음에 추가:

```ts
    { to: '/contacts', icon: Contact, label: t('sidebar.contacts') },
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: `tsc -b` + Vite 빌드 모두 통과.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: /contacts 라우트 및 명함첩 사이드바 메뉴 연결"
```

---

## Task 10: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 단위 테스트 실행**

Run: `npx vitest run`
Expected: 신규 테스트 포함 전체 PASS.

- [ ] **Step 2: 린트**

Run: `npm run lint`
Expected: 신규 파일에 에러 없음. (경고가 있으면 해당 파일만 수정.)

- [ ] **Step 3: 프로덕션 빌드**

Run: `npm run build`
Expected: 통과.

- [ ] **Step 4: 수동 동작 확인 (로컬 모드)**

Run: `npm run dev` → http://localhost:5173

확인 항목:
1. 사이드바에 "명함첩" 메뉴가 보이고 클릭 시 `/contacts` 로 이동.
2. "명함 등록" → 이름 입력 후 저장 → 카드가 목록에 나타남.
3. 명함 사진 업로드 시 미리보기 표시, 저장 후 카드 썸네일 표시.
4. 검색어/태그/프로젝트 필터가 목록을 좁힘.
5. 카드 hover 시 수정/삭제 버튼 동작, 삭제 확인 후 제거.
6. 새로고침 후에도 명함이 유지됨(localStorage 폴백).
7. 언어 전환(ko/en/vi) 시 라벨이 번역됨.

- [ ] **Step 5: 최종 커밋 (필요 시)**

검증 중 수정이 있었다면:

```bash
git add -A
git commit -m "fix: 명함첩 검증 중 발견한 문제 보완"
```

---

## 자기 검토 (Self-Review) 결과

- **스펙 커버리지:** 데이터 모델(Task 1), 데이터 계층(Task 3), 마이그레이션/RLS(Task 5), store(Task 4), UI/라우팅(Task 7·8·9), 사진 처리(Task 2), i18n(Task 6), 에러 처리(Task 3·4 + 모달/페이지), 테스트(Task 2·3·4) — 스펙 11개 섹션 모두 대응됨.
- **플레이스홀더:** 모든 코드 단계에 실제 코드 포함. "적절히 처리" 류 표현 없음.
- **타입 일관성:** `Contact` 필드명이 Task 1 정의와 Row 매핑(Task 3)·store(Task 4)·모달(Task 7)에서 동일. store 액션명 `loadContacts`/`saveContact`/`removeContact`가 페이지(Task 8) 사용처와 일치. repository 함수는 별칭(`repoLoadContacts` 등)으로 충돌 회피.
- **알려진 확인 포인트(구현 중 검증):** (1) CSS 변수/유틸 클래스 이름 — 기존 모달과 대조, (2) `useProjectStore`/`useAuthStore` 셀렉터 시그니처와 `projects`/`user.id` 필드명, (3) `App.tsx`의 Portfolio 라우트 표기, (4) en.ts가 i18n 타입 소스일 경우 키 누락 시 tsc에서 검출. 각 Task의 빌드 단계에서 잡힌다.
