import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, ListTree, Calendar, Users, Settings, FolderOpen, Plus, ChevronRight, PanelLeftClose, PanelLeftOpen, ShieldCheck, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { cn } from '../../lib/utils';

// ─── Nav item definitions ────────────────────────────────────

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  adminOnly?: boolean;
}

function getProjectNavItems(projectId: string): NavItem[] {
  return [
    { to: `/projects/${projectId}`, icon: LayoutDashboard, label: '대시보드', end: true },
    { to: `/projects/${projectId}/wbs`, icon: ListTree, label: 'WBS' },
    { to: `/projects/${projectId}/gantt`, icon: Calendar, label: '간트 차트' },
    { to: `/projects/${projectId}/members`, icon: Users, label: '멤버' },
    { to: `/projects/${projectId}/settings`, icon: Settings, label: '설정' },
  ];
}

const GLOBAL_NAV_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: '홈', end: true },
  { to: '/projects', icon: FolderOpen, label: '전체 프로젝트' },
  { to: '/admin/users', icon: ShieldCheck, label: '사용자 관리', adminOnly: true },
  { to: '/manual', icon: BookOpen, label: '사용자 매뉴얼' },
];

// ─── Shared nav link renderer ────────────────────────────────

function SidebarNav({
  items,
  collapsed,
  isAdmin,
  navLinkClass,
}: {
  items: NavItem[];
  collapsed: boolean;
  isAdmin: boolean;
  navLinkClass: (props: { isActive: boolean }) => string;
}) {
  const visibleItems = items.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="space-y-2">
      {visibleItems.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass} title={collapsed ? item.label : undefined}>
          <item.icon className="w-5 h-5" />
          {!collapsed && item.label}
        </NavLink>
      ))}
    </nav>
  );
}

// ─── Main Sidebar ────────────────────────────────────────────

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
        : 'text-white/84 hover:bg-white/10 hover:text-white'
    );

  const navItems = projectId ? getProjectNavItems(projectId) : GLOBAL_NAV_ITEMS;

  if (sidebarCollapsed) {
    return (
      <aside className="w-full shrink-0 lg:sticky lg:top-[6.75rem] lg:w-[68px] lg:self-start transition-all duration-300">
        <div className="app-panel-dark flex overflow-hidden">
          <div className="flex w-full flex-col items-center p-3 gap-3">
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.1] text-white/82 transition-colors hover:bg-white/14 hover:text-white"
              title="사이드바 펼치기"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>

            <div className="w-full border-t border-white/10" />

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
                        : 'border-transparent bg-white/[0.08] text-white/80 hover:border-white/12 hover:bg-white/[0.12] hover:text-white'
                    )
                  }
                  title={project.name}
                >
                  <FolderOpen className="h-4 w-4" />
                </NavLink>
              ))}
            </div>

            <div className="w-full border-t border-white/10" />

            <SidebarNav items={navItems} collapsed={true} isAdmin={isAdmin} navLinkClass={navLinkClass} />

            <NavLink
              to="/projects/new"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.1] text-white/82 transition-colors hover:bg-white/14 hover:text-white"
              title="새 프로젝트"
            >
              <Plus className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-[6.75rem] lg:w-[310px] lg:self-start transition-all duration-300">
      <div className="app-panel-dark flex overflow-hidden">
        <div className="flex w-full flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <div />
            <button
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.1] text-white/82 transition-colors hover:bg-white/14 hover:text-white"
              title="사이드바 접기"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-[26px] border border-white/12 bg-white/[0.08] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/86">Workspace</p>
            <h2 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.04em] text-white">
              Planning cockpit
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/82">
              일정, WBS, 팀 상태를 하나의 워크스페이스 톤으로 정리했습니다.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/12 bg-white/[0.1] p-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/82">Projects</p>
                <p className="mt-1 text-2xl font-semibold text-white">{projects.length}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/[0.1] p-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/82">Active</p>
                <p className="mt-1 text-2xl font-semibold text-white">{activeProjects}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/12 bg-white/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/86">프로젝트</h3>
              <NavLink
                to="/projects"
                className="text-xs font-medium text-white/80 transition-colors hover:text-white"
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
                        : 'border-transparent bg-white/[0.08] text-white/82 hover:border-white/12 hover:bg-white/[0.12] hover:text-white'
                    )
                  }
                >
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl transition-colors',
                    project.id === projectId
                      ? 'bg-white/14'
                      : 'bg-white/[0.1] group-hover:bg-white/14'
                  )}>
                    <FolderOpen className={cn(
                      'h-4 w-4 transition-colors',
                      project.id === projectId ? 'text-white' : 'text-white/84 group-hover:text-white'
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="mt-0.5 text-xs text-white/84">
                      {project.status === 'active' ? '진행중' : project.status === 'completed' ? '완료' : '준비'}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    'h-4 w-4 transition-all duration-200',
                    project.id === projectId ? 'translate-x-0 text-white' : '-translate-x-1 text-white/0 group-hover:translate-x-0 group-hover:text-white/82'
                  )} />
                </NavLink>
              ))}
              {projects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center">
                  <FolderOpen className="mx-auto mb-3 h-8 w-8 text-white/40" />
                  <p className="text-sm text-white/82">프로젝트 없음</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/86">메뉴</p>
              <NavLink
                to="/projects/new"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.1] text-white/82 transition-colors hover:bg-white/14 hover:text-white"
                title="새 프로젝트"
              >
                <Plus className="w-4 h-4" />
              </NavLink>
            </div>

            <SidebarNav items={navItems} collapsed={false} isAdmin={isAdmin} navLinkClass={navLinkClass} />
          </div>

          <div className="mt-4 rounded-[24px] border border-white/12 bg-[linear-gradient(135deg,rgba(15,118,110,0.24),rgba(203,109,55,0.16))] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">Workflow Hint</p>
            <p className="mt-2 text-sm font-medium text-white">WBS에서 드래그로 순서를 바꾸고, 간트에서 일정 흐름을 바로 확인하세요.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
