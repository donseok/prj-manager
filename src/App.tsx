import { BrowserRouter, Routes, Route, Outlet, Navigate, useParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import ProjectList from './pages/ProjectList';
import Dashboard from './pages/Dashboard';
import WBS from './pages/WBS';
import Gantt from './pages/Gantt';
import Members from './pages/Members';
import Settings from './pages/Settings';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import UserManual from './pages/UserManual';
import { useProjectStore } from './store/projectStore';
import { useAuthStore } from './store/authStore';
import { useTaskStore } from './store/taskStore';
import { isSupabaseConfigured, ensureSupabaseSession, subscribeToSupabaseAuthChanges } from './lib/supabase';
import { loadInitialProjects, loadProjectMembers, loadProjectTasks } from './lib/dataRepository';

// 인증 라우트 가드 (현재 비활성화, 추후 로그인 연동 시 사용)
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

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
    let isCancelled = false;
    let unsubscribe = () => {};

    const initializeApp = async () => {
      if (!isSupabaseConfigured) {
        const projects = await loadInitialProjects();
        if (isCancelled) return;
        setProjects(projects);
        setLoading(false);
        return;
      }

      const sessionUser = await ensureSupabaseSession();
      if (isCancelled) return;

      if (sessionUser) {
        setUser(sessionUser);
        const projects = await loadInitialProjects();
        if (isCancelled) return;
        setProjects(projects);
      } else {
        setLoading(false);
      }

      unsubscribe = subscribeToSupabaseAuthChanges((nextUser) => {
        if (nextUser) {
          setUser(nextUser);
          void loadInitialProjects().then((projects) => {
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
            <Route path="settings" element={<Settings />} />
          </Route>
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

// 프로젝트 상세 래퍼 (프로젝트 로드)
function ProjectDetailWrapper() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, setCurrentProject, setMembers } = useProjectStore();
  const { setTasks, expandAll } = useTaskStore();

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
      if (!projectId) return;

      const [members, tasks] = await Promise.all([
        loadProjectMembers(projectId),
        loadProjectTasks(projectId),
      ]);

      if (isCancelled) return;

      setMembers(members, projectId);
      setTasks(tasks, projectId);
      setTimeout(() => expandAll(), 100);
    };

    void loadProjectDetail();

    return () => {
      isCancelled = true;
    };
  }, [projectId, setMembers, setTasks, expandAll]);

  return <Outlet />;
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
