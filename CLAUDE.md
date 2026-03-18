# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A project management system with WBS (Work Breakdown Structure) and Gantt chart capabilities. Built for managing hierarchical tasks across 4 levels: Phase → Activity → Task → Function. UI is in Korean.

## Commands

- `npm run dev` — Start Vite dev server (http://localhost:5173)
- `npm run build` — TypeScript check + Vite production build
- `npm run lint` — ESLint
- No test framework is configured

## Tech Stack

React 19 + TypeScript 5.9, Vite 7, Tailwind CSS 4, Zustand 5, React Router 7, Recharts 3, Supabase (optional), TanStack React Table, date-fns (Korean locale), Lucide icons

## Architecture

### Routing (App.tsx)

```
/                        → Home
/projects                → Project list
/projects/new            → Create project
/projects/:projectId     → Dashboard (nested layout)
  /wbs                   → WBS table (hierarchical task editor)
  /gantt                 → Gantt chart
  /members               → Team members
  /settings              → Project settings
```

### State Management (src/store/)

Four Zustand stores — no Redux:

- **projectStore** — Projects list, current project, CRUD operations
- **taskStore** — Task tree with undo/redo (50-item history). Key helpers: `buildTaskTree`, `flattenTaskTree`, `calculateParentProgress`. Tasks are stored flat and built into a tree on demand.
- **authStore** — User auth state, persisted to localStorage via Zustand middleware
- **themeStore** — Light/Dark/System theme with system preference detection

### Data Flow

All data persists to **localStorage** by default. Supabase integration exists (`src/lib/supabase.ts`) but is optional — requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars. The supabase module includes `toCamelCase`/`toSnakeCase` converters for DB ↔ app field mapping.

### Task Hierarchy

Tasks have `parentId`, `level` (1-4), and `orderIndex`. The task store rebuilds the tree structure whenever tasks change. Parent progress is auto-calculated from weighted child progress.

### Styling

Tailwind CSS utilities + extensive custom CSS in `src/index.css` (CSS variables, glassmorphism, gradients, animations). Dark mode via class-based toggle on document root. Custom color palette defined in `tailwind.config.js`.

## Key Conventions

- Components in `src/components/` (common/, layout/, wbs/), pages in `src/pages/`
- Types defined in `src/types/index.ts` — core models: User, Project, ProjectMember, Task
- Utility functions in `src/lib/utils.ts` (date formatting, tree manipulation, localStorage wrapper)
- Sample data in `src/data/sampleData.ts` (MES rebuild project demo)
- `cn()` utility for conditional class merging (similar to clsx)
