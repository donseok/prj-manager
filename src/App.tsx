import { BrowserRouter, Routes, Route, Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import ProjectList from './pages/ProjectList';
import Dashboard from './pages/Dashboard';
import WBS from './pages/WBS';
import Gantt from './pages/Gantt';
import Members from './pages/Members';
import Settings from './pages/Settings';
import { useProjectStore } from './store/projectStore';
import { useAuthStore } from './store/authStore';
import { useTaskStore } from './store/taskStore';
import { createLocalFallbackUser, ensureSupabaseSession, subscribeToSupabaseAuthChanges } from './lib/supabase';
import { loadInitialProjects, loadProjectMembers, loadProjectTasks } from './lib/dataRepository';

function App() {
  const { setProjects } = useProjectStore();
  const { setUser } = useAuthStore();

  useEffect(() => {
    let isCancelled = false;
    let unsubscribe = () => {};

    const initializeApp = async () => {
      const sessionUser = await ensureSupabaseSession();
      const effectiveUser = sessionUser || createLocalFallbackUser();
      const projects = await loadInitialProjects(effectiveUser);

      if (isCancelled) return;

      setUser(effectiveUser);
      setProjects(projects);

      unsubscribe = subscribeToSupabaseAuthChanges((nextUser) => {
        const nextEffectiveUser = nextUser || createLocalFallbackUser();

        void (async () => {
          const nextProjects = await loadInitialProjects(nextEffectiveUser);
          if (isCancelled) return;

          setUser(nextEffectiveUser);
          setProjects(nextProjects);
        })();
      });
    };

    void initializeApp();

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [setProjects, setUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
        </Route>
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
    let isCancelled = false;

    const loadProjectDetail = async () => {
      if (!projectId) return;

      const project = projects.find((item) => item.id === projectId);
      if (!project) return;

      setCurrentProject(project);

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
      setCurrentProject(null);
    };
  }, [projectId, projects, setCurrentProject, setMembers, setTasks, expandAll]);

  return <Outlet />;
}

export default App;
