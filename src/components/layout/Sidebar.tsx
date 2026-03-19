import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, ListTree, Calendar, Users, Settings, FolderOpen, Plus, ChevronRight, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { cn } from '../../lib/utils';

export default function Sidebar() {
  const { projectId } = useParams();
  const { projects } = useProjectStore();
  const { isAdmin } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const activeProjects = projects.filter((project) => project.status === 'active').length;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
      sidebarCollapsed && 'justify-center px-0',
      isActive
        ? 'border border-white/10 bg-white/12 text-white shadow-[0_18px_40px_-28px_rgba(255,255,255,0.48)]'
        : 'text-white/72 hover:bg-white/6 hover:text-white'
    );

  // 접힌 상태
  if (sidebarCollapsed) {
    return (
      <aside className="w-full shrink-0 lg:sticky lg:top-[6.75rem] lg:w-[68px] lg:self-start transition-all duration-300">
        <div className="app-panel-dark flex overflow-hidden">
          <div className="flex w-full flex-col items-center p-3 gap-3">
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="사이드바 펼치기"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>

            <div className="w-full border-t border-white/10" />

            {/* 프로젝트 아이콘들 */}
            <div className="space-y-2">
              {projects.map((project) => (
                <NavLink
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200',
                      isActive
                        ? 'border-white/14 bg-white/10 text-white shadow-[0_18px_40px_-28px_rgba(255,255,255,0.4)]'
                        : 'border-transparent bg-white/[0.03] text-white/68 hover:border-white/8 hover:bg-white/[0.06] hover:text-white'
                    )
                  }
                  title={project.name}
                >
                  <FolderOpen className="h-4 w-4" />
                </NavLink>
              ))}
            </div>

            <div className="w-full border-t border-white/10" />

            {/* 메뉴 아이콘들 */}
            {projectId ? (
              <nav className="space-y-2">
                <NavLink to={`/projects/${projectId}`} end className={navLinkClass} title="대시보드">
                  <LayoutDashboard className="w-5 h-5" />
                </NavLink>
                <NavLink to={`/projects/${projectId}/wbs`} className={navLinkClass} title="WBS">
                  <ListTree className="w-5 h-5" />
                </NavLink>
                <NavLink to={`/projects/${projectId}/gantt`} className={navLinkClass} title="간트 차트">
                  <Calendar className="w-5 h-5" />
                </NavLink>
                <NavLink to={`/projects/${projectId}/members`} className={navLinkClass} title="멤버">
                  <Users className="w-5 h-5" />
                </NavLink>
                <NavLink to={`/projects/${projectId}/settings`} className={navLinkClass} title="설정">
                  <Settings className="w-5 h-5" />
                </NavLink>
              </nav>
            ) : (
              <nav className="space-y-2">
                <NavLink to="/" end className={navLinkClass} title="홈">
                  <LayoutDashboard className="w-5 h-5" />
                </NavLink>
                <NavLink to="/projects" className={navLinkClass} title="전체 프로젝트">
                  <FolderOpen className="w-5 h-5" />
                </NavLink>
                {isAdmin && (
                  <NavLink to="/admin/users" className={navLinkClass} title="사용자 관리">
                    <ShieldCheck className="w-5 h-5" />
                  </NavLink>
                )}
              </nav>
            )}

            <NavLink
              to="/projects/new"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="새 프로젝트"
            >
              <Plus className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </aside>
    );
  }

  // 펼쳐진 상태 (기존)
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-[6.75rem] lg:w-[310px] lg:self-start transition-all duration-300">
      <div className="app-panel-dark flex overflow-hidden">
        <div className="flex w-full flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <div />
            <button
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="사이드바 접기"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/45">Workspace</p>
            <h2 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.04em] text-white">
              Planning cockpit
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/62">
              일정, WBS, 팀 상태를 하나의 워크스페이스 톤으로 정리했습니다.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Projects</p>
                <p className="mt-1 text-2xl font-semibold text-white">{projects.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Active</p>
                <p className="mt-1 text-2xl font-semibold text-white">{activeProjects}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/42">프로젝트</h3>
              <NavLink
                to="/projects"
                className="text-xs font-medium text-white/48 transition-colors hover:text-white"
              >
                전체 보기
              </NavLink>
            </div>
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {projects.map((project) => (
                <NavLink
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-all duration-200',
                      isActive
                        ? 'border-white/14 bg-white/10 text-white shadow-[0_18px_40px_-28px_rgba(255,255,255,0.4)]'
                        : 'border-transparent bg-white/[0.03] text-white/68 hover:border-white/8 hover:bg-white/[0.06] hover:text-white'
                    )
                  }
                >
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl transition-colors',
                    project.id === projectId
                      ? 'bg-white/14'
                      : 'bg-white/[0.06] group-hover:bg-white/10'
                  )}>
                    <FolderOpen className={cn(
                      'h-4 w-4 transition-colors',
                      project.id === projectId ? 'text-white' : 'text-white/56 group-hover:text-white'
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {project.status === 'active' ? '진행중' : project.status === 'completed' ? '완료' : '준비'}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    'h-4 w-4 transition-all duration-200',
                    project.id === projectId ? 'translate-x-0 text-white' : '-translate-x-1 text-white/0 group-hover:translate-x-0 group-hover:text-white/62'
                  )} />
                </NavLink>
              ))}
              {projects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <FolderOpen className="mx-auto mb-3 h-8 w-8 text-white/22" />
                  <p className="text-sm text-white/52">프로젝트 없음</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/42">메뉴</p>
              <NavLink
                to="/projects/new"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="새 프로젝트"
              >
                <Plus className="w-4 h-4" />
              </NavLink>
            </div>

            {projectId ? (
              <nav className="space-y-2">
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
            ) : (
              <nav className="space-y-2">
                <NavLink to="/" end className={navLinkClass}>
                  <LayoutDashboard className="w-5 h-5" />
                  홈
                </NavLink>
                <NavLink to="/projects" className={navLinkClass}>
                  <FolderOpen className="w-5 h-5" />
                  전체 프로젝트
                </NavLink>
                {isAdmin && (
                  <NavLink to="/admin/users" className={navLinkClass}>
                    <ShieldCheck className="w-5 h-5" />
                    사용자 관리
                  </NavLink>
                )}
              </nav>
            )}
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,118,110,0.18),rgba(203,109,55,0.12))] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/52">Workflow Hint</p>
            <p className="mt-2 text-sm font-medium text-white">WBS에서 드래그로 순서를 바꾸고, 간트에서 일정 흐름을 바로 확인하세요.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
