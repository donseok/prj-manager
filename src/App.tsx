import { BrowserRouter, Routes, Route, Outlet, Navigate, useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import ProjectList from './pages/ProjectList';
import Dashboard from './pages/Dashboard';
import WBS from './pages/WBS';
import Gantt from './pages/Gantt';
import Members from './pages/Members';
import Settings from './pages/Settings';
import Attendance from './pages/Attendance';
import Login from './pages/Login';
import PendingApproval from './pages/PendingApproval';
import UserManagement from './pages/UserManagement';
import UserManual from './pages/UserManual';
import AccountSettings from './pages/AccountSettings';
import { useProjectStore } from './store/projectStore';
import { useAuthStore } from './store/authStore';
import { useTaskStore } from './store/taskStore';
import { ensureSupabaseSession, subscribeToSupabaseAuthChanges, isSupabaseConfigured, ensureMigrations } from './lib/supabase';
import { loadInitialProjects, loadProjectMembers, loadProjectTasks, loadProjectsForUser } from './lib/dataRepository';
import { useSystemSettingsStore } from './store/systemSettingsStore';

// 인증 라우트 가드
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isPending, isSuspended } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isPending || isSuspended) {
    return <Navigate to="/pending" replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuthStore();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { setProjects } = useProjectStore();
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    document.title = 'DK Flow';
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let unsubscribe = () => {};

    const initializeApp = async () => {
      // DB 스키마 마이그레이션 확인
      await ensureMigrations();
      // 시스템 설정 로드
      await useSystemSettingsStore.getState().loadSettings();

      if (!isSupabaseConfigured) {
        // localStorage 모드: 로컬 사용자로 자동 로그인
        const localUser = {
          id: 'local-user',
          email: 'local@localhost',
          name: '로컬 사용자',
          systemRole: 'admin' as const,
          accountStatus: 'active' as const,
          createdAt: new Date().toISOString(),
        };
        setUser(localUser);
        // Ensure sample data is loaded, then filter by membership
        await loadInitialProjects();
        const projects = await loadProjectsForUser(localUser.id, localUser.systemRole === 'admin');
        if (!isCancelled) setProjects(projects);
        return;
      }

      const sessionUser = await ensureSupabaseSession();
      if (isCancelled) return;

      if (sessionUser) {
        setUser(sessionUser);
        const projects = await loadProjectsForUser(sessionUser.id, sessionUser.systemRole === 'admin');
        if (isCancelled) return;
        setProjects(projects);
      } else {
        setLoading(false);
      }

      unsubscribe = subscribeToSupabaseAuthChanges((nextUser) => {
        if (nextUser) {
          setUser(nextUser);
          void loadProjectsForUser(nextUser.id, nextUser.systemRole === 'admin').then((projects) => {
            if (!isCancelled) setProjects(projects);
          });
        } else {
          setUser(null);
        }
      });
    };

    void initializeApp();

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [setProjects, setUser, setLoading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<ProjectList />} />
          <Route path="projects/:projectId" element={<ProjectDetailWrapper />}>
            <Route index element={<Dashboard />} />
            <Route path="wbs" element={<WBS />} />
            <Route path="gantt" element={<Gantt />} />
            <Route path="members" element={<Members />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="account" element={<AccountSettings />} />
          <Route path="manual" element={<UserManual />} />
          <Route
            path="admin/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="popup/projects/:projectId" element={<PopupProjectWrapper />}>
          <Route path="wbs" element={<WBS />} />
          <Route path="gantt" element={<Gantt />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

// 프로젝트 상세 래퍼 (프로젝트 로드)
function ProjectDetailWrapper() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, projectsInitialized, setCurrentProject, setMembers } = useProjectStore();
  const { setTasks, expandAll } = useTaskStore();
  const [isLoading, setIsLoading] = useState(true);

  const projectExists = projectId ? projects.some((item) => item.id === projectId) : false;

  useEffect(() => {
    if (!projectId) {
      setCurrentProject(null);
      return;
    }

    const project = projects.find((item) => item.id === projectId) ?? null;
    setCurrentProject(project);

    return () => {
      setCurrentProject(null);
    };
  }, [projectId, projects, setCurrentProject]);

  useEffect(() => {
    let isCancelled = false;

    const loadProjectDetail = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      try {
        const [members, tasks] = await Promise.all([
          loadProjectMembers(projectId),
          loadProjectTasks(projectId),
        ]);

        if (isCancelled) return;

        setMembers(members, projectId);
        setTasks(tasks, projectId);
        setTimeout(() => expandAll(), 100);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    setIsLoading(true);
    void loadProjectDetail();

    return () => {
      isCancelled = true;
    };
  }, [projectId, setMembers, setTasks, expandAll]);

  if (isLoading || !projectsInitialized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)]" />
      </div>
    );
  }

  if (!projectExists) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="text-7xl font-bold text-[color:var(--text-muted)]">404</div>
        <h1 className="text-2xl font-semibold text-[color:var(--text-primary)]">
          프로젝트를 찾을 수 없습니다
        </h1>
        <p className="max-w-md text-sm text-[color:var(--text-secondary)]">
          요청하신 프로젝트가 존재하지 않거나 삭제되었습니다.
        </p>
        <Link
          to="/projects"
          className="mt-2 rounded-full bg-[image:var(--gradient-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-105"
        >
          프로젝트 목록으로
        </Link>
      </div>
    );
  }

  return <Outlet />;
}

// 팝업 전용 래퍼 (사이드바/헤더 없는 최소 레이아웃)
function PopupProjectWrapper() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setProjects, projects, setCurrentProject, setMembers } = useProjectStore();
  const { setUser } = useAuthStore();
  const { setTasks, expandAll } = useTaskStore();
  const [ready, setReady] = useState(false);

  // Initialize app state (same as main App, since popup is a separate React instance)
  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      await ensureMigrations();

      if (!isSupabaseConfigured) {
        const localUser = {
          id: 'local-user',
          email: 'local@localhost',
          name: '로컬 사용자',
          systemRole: 'admin' as const,
          accountStatus: 'active' as const,
          createdAt: new Date().toISOString(),
        };
        setUser(localUser);
        await loadInitialProjects();
        const loadedProjects = await loadProjectsForUser(localUser.id, localUser.systemRole === 'admin');
        if (!isCancelled) {
          setProjects(loadedProjects);
          setReady(true);
        }
        return;
      }

      const sessionUser = await ensureSupabaseSession();
      if (isCancelled) return;

      if (sessionUser) {
        setUser(sessionUser);
        const loadedProjects = await loadProjectsForUser(sessionUser.id, sessionUser.systemRole === 'admin');
        if (!isCancelled) {
          setProjects(loadedProjects);
          setReady(true);
        }
      }
    };

    void init();
    return () => { isCancelled = true; };
  }, [setProjects, setUser]);

  // Load project details once ready
  useEffect(() => {
    if (!ready || !projectId) return;
    let isCancelled = false;

    const project = projects.find((item) => item.id === projectId) ?? null;
    setCurrentProject(project);

    const load = async () => {
      const [members, tasks] = await Promise.all([
        loadProjectMembers(projectId),
        loadProjectTasks(projectId),
      ]);
      if (isCancelled) return;
      setMembers(members, projectId);
      setTasks(tasks, projectId);
      setTimeout(() => expandAll(), 100);
    };

    void load();

    return () => {
      isCancelled = true;
      setCurrentProject(null);
    };
  }, [ready, projectId, projects, setCurrentProject, setMembers, setTasks, expandAll]);

  const currentProject = useProjectStore((s) => s.currentProject);
  const page = window.location.pathname.includes('/wbs') ? 'WBS' : '간트 차트';

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg-primary)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[color:var(--bg-primary)]">
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-[color:var(--text-primary)] truncate" title={`${currentProject?.name || '프로젝트'} — ${page}`}>
            {currentProject?.name || '프로젝트'} — {page}
          </span>
          <span className="surface-badge !py-0.5 !px-2 !text-[10px]">팝업</span>
        </div>
        <button
          onClick={() => window.close()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
          title="닫기"
        >
          ✕
        </button>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-7xl font-bold text-[color:var(--text-muted)]">404</div>
      <h1 className="text-2xl font-semibold text-[color:var(--text-primary)]">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="max-w-md text-sm text-[color:var(--text-secondary)]">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-full bg-[image:var(--gradient-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-105"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}

export default App;
