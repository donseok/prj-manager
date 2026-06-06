# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DK Flow — a web-based project management system with WBS (Work Breakdown Structure) and Gantt chart capabilities. Manages hierarchical tasks across 4 levels: Phase → Activity → Task → Function. All UI text is in Korean.

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm run build` — TypeScript check + Vite production build
- `npm run lint` — ESLint
- `npm run preview` — Preview production build (http://localhost:4173)
- `npm run test:e2e` — Playwright E2E tests (requires `npm run build` first; runs against preview server on port 4173)

## Tech Stack

React 19 + TypeScript 5.9, Vite 7, Tailwind CSS 4, Zustand 5, React Router 7, Recharts 3, Supabase (optional), date-fns 4, ExcelJS, docx (PDF/Word), pptxgenjs (PPT), Lucide icons, Playwright. i18n via `src/i18n` (ko/en/vi; Korean default).

## Architecture

### Routing (App.tsx)

- **Public**: `/login`, `/pending-approval`
- **Protected** (`ProtectedRoute`): `/` Home, `/portfolio`, `/my-tasks`, `/contacts`, `/attendance`, `/manual`, `/account`
- **Project** (`/projects/:projectId` → `ProjectDetailWrapper`, loads members+tasks on `projectId` change, renders `<Outlet />`): Dashboard (index), `/wbs`, `/gantt`, `/kanban`, `/members`, `/settings`
- **Admin**: project-admin area (`ProjectAdminRoute`) and super-admin area (`SuperAdminRoute`) under `src/pages/admin/`

Role gates live in `src/components/common/` (`ProjectAdminRoute`, `SuperAdminRoute`) and `src/lib/permissions.ts`.

### State Management (src/store/)

Zustand only — no Redux. Most important:

- **taskStore** — Flat task list with derived tree views. Key pipeline: `setTasks()` → `normalizeTaskHierarchy()` → `buildTaskTree()` → `flattenTaskTree()`. Undo/redo via 50-item history array. `loadedProjectId` prevents cross-project saves.
- **projectStore** — Projects list, current project, members CRUD. `setMembers(members, projectId)` scopes members to a project.
- **authStore** — User auth, persisted to localStorage via Zustand middleware. `isAdmin` computed from `systemRole`.
- **themeStore** — Light/Dark/System theme, applies `dark` class on `document.documentElement`.

Others: `uiStore`, `contactStore`, `attendanceStore`, `commentStore`, `notificationStore`, `dashboardConfigStore`, `systemSettingsStore`.

### Data Layer

```
User action → Zustand store update → useAutoSave hook (700ms debounce)
  → dataRepository.ts → Supabase (if configured) OR localStorage (fallback)
```

- **dataRepository.ts** — Abstraction over Supabase and localStorage. All functions are async. Uses explicit `Row` interfaces for DB ↔ app field mapping (snake_case ↔ camelCase). Sample projects from `sampleData.ts` are merged into localStorage on first load.
- **projectTaskSync.ts** — `normalizeTaskHierarchy()` rebuilds the task tree bottom-up, auto-aggregating parent dates/progress/status from children. `syncProjectWorkspace()` normalizes tasks and derives project status before persisting.
- **taskAnalytics.ts** — Dashboard calculations. `getLeafTasks()` filters to tasks with no children (excludes parent summary rows).

Supabase is **optional** — controlled by `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars. When absent, everything works with localStorage + 4 preloaded sample projects.

### Task Hierarchy

Tasks have `parentId`, `level` (1-4), and `orderIndex`. The critical invariant: **parent task properties (dates, progress, status) are always derived from children** via `normalizeTaskHierarchy()`. Never set parent progress directly — it will be overwritten on next normalization pass.

### Styling

Tailwind CSS 4 utilities + custom CSS in `src/index.css` (CSS variables, glassmorphism, gradients). Dark mode via class-based toggle. Custom font: Pretendard Variable (configured in `tailwind.config.js`). Key CSS custom properties use `--accent-primary`, `--text-primary`, `--surface-*` naming.

## Key Conventions

- Pages: `src/pages/` (admin screens under `admin/`). Components: `src/components/` (common/, layout/, wbs/, kanban/, dashboard/, chatbot/, settings/, contacts/, attendance/).
- Logic & data: `src/lib/` — domain subfolders `ai/` (WBS/progress AI), `rag/` (chatbot retrieval), `meeting/` (meeting-notes → tasks).
- Types: `src/types/index.ts` — core models: User, Project, ProjectMember, Task, with Korean label/color constants.
- `cn()` and `storage` (typed localStorage) utilities in `src/lib/utils.ts`.
- Exports: `excel.ts` (ExcelJS), `exportReport.ts` (PDF/Word), `exportWeeklyReportPptx.ts` (PPT).
- Auto-save: `src/hooks/useAutoSave.ts` — debounced, checks `loadedProjectId` to prevent saving before hydration.
- Tests colocated in `__tests__/` folders (Vitest); E2E via Playwright.
