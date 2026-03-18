import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, ListTree, Calendar, Users, Settings, FolderOpen, Plus, ChevronRight } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { cn } from '../../lib/utils';

export default function Sidebar() {
  const { projectId } = useParams();
  const { projects } = useProjectStore();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 group',
      isActive
        ? 'bg-gradient-to-r from-blue-500/10 to-violet-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200/50 dark:border-blue-700/50 shadow-sm'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
    );

  return (
    <aside className="w-64 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-r border-gray-200/50 dark:border-gray-700/50 flex flex-col transition-all">
      {/* 프로젝트 목록 */}
      <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">프로젝트</h3>
          <NavLink
            to="/projects/new"
            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="새 프로젝트"
          >
            <Plus className="w-4 h-4" />
          </NavLink>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {projects.map((project) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 group',
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-900/30 dark:to-violet-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                )
              }
            >
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                project.id === projectId
                  ? 'bg-blue-100 dark:bg-blue-800/50'
                  : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30'
              )}>
                <FolderOpen className={cn(
                  'w-3.5 h-3.5 transition-colors',
                  project.id === projectId
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 group-hover:text-blue-500'
                )} />
              </div>
              <span className="truncate flex-1">{project.name}</span>
              <ChevronRight className={cn(
                'w-4 h-4 opacity-0 -translate-x-2 transition-all',
                project.id === projectId && 'opacity-100 translate-x-0'
              )} />
            </NavLink>
          ))}
          {projects.length === 0 && (
            <div className="text-center py-4">
              <FolderOpen className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400 dark:text-gray-500">프로젝트 없음</p>
            </div>
          )}
        </div>
      </div>

      {/* 메뉴 */}
      {projectId && (
        <nav className="flex-1 p-4 space-y-1.5">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">메뉴</p>
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
        <nav className="flex-1 p-4 space-y-1.5">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">메뉴</p>
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

      {/* Footer */}
      <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
        <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-900/20 dark:to-violet-900/20 border border-blue-100 dark:border-blue-800/50">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Pro Tip</p>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">WBS에서 작업을 드래그하여 순서 변경</p>
        </div>
      </div>
    </aside>
  );
}
