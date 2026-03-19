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

React 19 + TypeScript 5.9, Vite 7, Tailwind CSS 4, Zustand 5, React Router 7, Recharts 3, Supabase (optional), date-fns 4 (Korean locale), ExcelJS, docx, Lucide icons, Playwright

## Architecture

### Routing (App.tsx)

```
/login                   → Login (public)
/                        → Home (protected — ProtectedRoute)
├── /projects            → Project list
├── /projects/new        → Create project
├── /projects/:projectId → ProjectDetailWrapper (loads members + tasks)
│   ├── index            → Dashboard
│   ├── /wbs             → WBS table editor
│   ├── /gantt           → Gantt chart
│   ├── /members         → Team members
│   └── /settings        → Project settings & import/export
├── /manual              → User manual
├── /admin/users         → User management (AdminRoute — systemRole='admin' only)
└── *                    → 404
```

`ProjectDetailWrapper` is a nested route that loads project members and tasks via `dataRepository` when `projectId` changes, then renders child routes via `<Outlet />`.

### State Management (src/store/)

Five Zustand stores — no Redux:

- **projectStore** — Projects list, current project, members CRUD. `setMembers(members, projectId)` scopes members to a project.
- **taskStore** — Flat task list with derived tree views. Key pipeline: `setTasks()` → `normalizeTaskHierarchy()` → `buildTaskTree()` → `flattenTaskTree()`. Undo/redo via 50-item history array. `loadedProjectId` prevents cross-project saves.
- **authStore** — User auth, persisted to localStorage via Zustand middleware. `isAdmin` computed from `systemRole`.
- **themeStore** — Light/Dark/System theme, applies `dark` class on `document.documentElement`.
- **uiStore** — UI-specific transient state.

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

- Components: `src/components/` (common/, layout/, wbs/, chatbot/). Pages: `src/pages/`.
- Types: `src/types/index.ts` — core models: User, Project, ProjectMember, Task, with Korean label/color constants.
- `cn()` utility in `src/lib/utils.ts` for conditional class merging.
- `storage` wrapper in `src/lib/utils.ts` — typed localStorage get/set/has/remove.
- Export modules: `src/lib/excel.ts` (ExcelJS WBS/Gantt), `src/lib/exportReport.ts` (PDF/Word via docx).
- Auto-save: `src/hooks/useAutoSave.ts` — debounced, checks `loadedProjectId` to prevent saving before hydration.
