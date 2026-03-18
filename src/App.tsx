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
import { storage } from './lib/utils';
import { sampleProject, sampleMembers, sampleTasks } from './data/sampleData';
import type { Project, ProjectMember, Task } from './types';

function App() {
  const { setProjects } = useProjectStore();
  const { setUser } = useAuthStore();

  // 초기 데이터 로드
  useEffect(() => {
    // 로컬 스토리지에서 프로젝트 로드
    let savedProjects = storage.get<Project[]>('projects', []);

    // 프로젝트가 없으면 샘플 데이터 로드
    if (savedProjects.length === 0) {
      savedProjects = [sampleProject];
      storage.set('projects', savedProjects);
      storage.set(`members-${sampleProject.id}`, sampleMembers);
      storage.set(`tasks-${sampleProject.id}`, sampleTasks);
    }

    setProjects(savedProjects);

    // 기본 사용자 설정 (로컬 모드)
    setUser({
      id: 'local-user',
      email: 'user@local.dev',
      name: '로컬 사용자',
      createdAt: new Date().toISOString(),
    });
  }, [setProjects, setUser]);

  // 프로젝트 변경 시 저장
  const { projects } = useProjectStore();
  useEffect(() => {
    if (projects.length > 0) {
      storage.set('projects', projects);
    }
  }, [projects]);

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
    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCurrentProject(project);
        // 로컬 멤버 로드
        const savedMembers = storage.get<ProjectMember[]>(`members-${projectId}`, []);
        setMembers(savedMembers);
        // 로컬 태스크 로드
        const savedTasks = storage.get<Task[]>(`tasks-${projectId}`, []);
        setTasks(savedTasks);
        // 모든 태스크 펼치기
        setTimeout(() => expandAll(), 100);
      }
    }

    return () => {
      setCurrentProject(null);
    };
  }, [projectId, projects, setCurrentProject, setMembers, setTasks, expandAll]);

  return <Outlet />;
}

export default App;
