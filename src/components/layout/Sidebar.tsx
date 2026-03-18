import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, ListTree, Calendar, Users, Settings, FolderOpen, Plus } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { cn } from '../../lib/utils';

export default function Sidebar() {
  const { projectId } = useParams();
  const { projects } = useProjectStore();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
      isActive
        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 font-medium'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
    );

  return (
    <aside className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors">
      {/* 프로젝트 목록 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">프로젝트</h3>
          <NavLink
            to="/projects/new"
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <Plus className="w-4 h-4" />
          </NavLink>
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {projects.map((project) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-sm',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                )
              }
            >
              <FolderOpen className="w-4 h-4" />
              <span className="truncate">{project.name}</span>
            </NavLink>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 px-2 py-1">프로젝트 없음</p>
          )}
        </div>
      </div>

      {/* 메뉴 */}
      {projectId && (
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to={`/projects/${projectId}`} end className={navLinkClass}>
            <LayoutDashboard className="w-5 h-5" />
            대시보드
          </NavLink>
          <NavLink to={`/projects/${projectId}/wbs`} className={navLinkClass}>
            <ListTree className="w-5 h-5" />
            WBS
          </NavLink>
          <NavLink to={`/projects/${projectId}/gantt`} className={navLinkClass}>
            <Calendar className="w-5 h-5" />
            간트 차트
          </NavLink>
          <NavLink to={`/projects/${projectId}/members`} className={navLinkClass}>
            <Users className="w-5 h-5" />
            멤버
          </NavLink>
          <NavLink to={`/projects/${projectId}/settings`} className={navLinkClass}>
            <Settings className="w-5 h-5" />
            설정
          </NavLink>
        </nav>
      )}

      {!projectId && (
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/" end className={navLinkClass}>
            <LayoutDashboard className="w-5 h-5" />
            홈
          </NavLink>
          <NavLink to="/projects" className={navLinkClass}>
            <FolderOpen className="w-5 h-5" />
            전체 프로젝트
          </NavLink>
        </nav>
      )}
    </aside>
  );
}
