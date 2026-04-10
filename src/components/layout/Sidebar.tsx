import { NavLink, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListTree, Calendar, Users, Settings, FolderOpen, Plus, ChevronRight, PanelLeftClose, PanelLeftOpen, ShieldCheck, BookOpen, ExternalLink, CalendarCheck, Columns3, Briefcase } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useProjectStore } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { cn } from '../../lib/utils';
import { PROJECT_STATUS_COLORS } from '../../types';
import { loadPendingCount } from '../../lib/supabase';
import { openPopup } from '../../lib/popupWindow';

// ─── Nav item definitions ────────────────────────────────────

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  adminOnly?: boolean;
  badge?: number;
  popupPage?: 'wbs' | 'gantt';
}

function getProjectNavItems(projectId: string, t: TFunction): NavItem[] {
  return [
    { to: `/projects/${projectId}`, icon: LayoutDashboard, label: t('sidebar.dashboard'), end: true },
    { to: `/projects/${projectId}/wbs`, icon: ListTree, label: t('sidebar.wbs'), popupPage: 'wbs' },
    { to: `/projects/${projectId}/gantt`, icon: Calendar, label: t('sidebar.ganttChart'), popupPage: 'gantt' },
    { to: `/projects/${projectId}/kanban`, icon: Columns3, label: t('sidebar.kanbanBoard') },
    { to: `/projects/${projectId}/members`, icon: Users, label: t('sidebar.members') },
    { to: `/projects/${projectId}/attendance`, icon: CalendarCheck, label: t('sidebar.attendance') },
    { to: `/projects/${projectId}/settings`, icon: Settings, label: t('sidebar.settings') },
  ];
}

function getGlobalNavItems(pendingBadge: number, t: TFunction): NavItem[] {
  return [
    { to: '/', icon: LayoutDashboard, label: t('sidebar.home'), end: true },
    { to: '/projects', icon: FolderOpen, label: t('sidebar.allProjects') },
    { to: '/portfolio', icon: Briefcase, label: t('sidebar.portfolio') },
    { to: '/admin/users', icon: ShieldCheck, label: t('sidebar.userManagement'), adminOnly: true, badge: pendingBadge },
    { to: '/manual', icon: BookOpen, label: t('sidebar.userManual') },
  ];
}

// ─── Shared nav link renderer ────────────────────────────────

function SidebarNav({
  items,
  collapsed,
  isAdmin,
  navLinkClass,
  projectId,
  t,
}: {
  items: NavItem[];
  collapsed: boolean;
  isAdmin: boolean;
  navLinkClass: (props: { isActive: boolean }) => string;
  projectId?: string;
  t: TFunction;
}) {
  const visibleItems = items.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="space-y-2">
      {visibleItems.map((item) => (
        <div key={item.to} className="group/nav relative">
          <NavLink to={item.to} end={item.end} className={navLinkClass} title={collapsed ? item.label : undefined}>
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {collapsed && item.badge != null && item.badge > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </div>
            {!collapsed && item.label}
            {!collapsed && item.badge != null && item.badge > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </NavLink>
          {!collapsed && item.popupPage && projectId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openPopup({ projectId, page: item.popupPage! });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-white/0 transition-all group-hover/nav:text-white/60 hover:!bg-white/14 hover:!text-white"
              title={t('sidebar.openInNewWindow', { label: item.label })}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}

// ─── Workflow Hints ──────────────────────────────────────────

function getWorkflowHint(pathname: string, t: TFunction): string {
  let context = 'default';
  if (pathname.includes('/wbs')) context = 'wbs';
  else if (pathname.includes('/gantt')) context = 'gantt';
  else if (pathname.includes('/kanban')) context = 'kanban';
  else if (pathname.includes('/members')) context = 'members';
  else if (pathname.includes('/settings')) context = 'settings';
  else if (/\/projects\/[^/]+$/.test(pathname) || pathname.endsWith('/')) context = 'dashboard';

  const hints = t(`sidebar.workflowHint.${context}`, { returnObjects: true }) as string[];
  const fallback = t('sidebar.workflowHint.default', { returnObjects: true }) as string[];
  const resolved = Array.isArray(hints) ? hints : fallback;
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return resolved[dayOfYear % resolved.length];
}

// ─── Main Sidebar ────────────────────────────────────────────

export default function Sidebar() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const location = useLocation();
  const { projects } = useProjectStore();
  const { isAdmin } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const [pendingCount, setPendingCount] = useState(0);

  const MAX_VISIBLE_PROJECTS = 8;
  const visibleProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        // active 프로젝트 우선
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        // updatedAt 내림차순
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
      })
      .slice(0, MAX_VISIBLE_PROJECTS);
  }, [projects]);
  const hasMoreProjects = projects.length > MAX_VISIBLE_PROJECTS;

  useEffect(() => {
    if (!isAdmin) return;
    const fetchCount = () => void loadPendingCount().then(setPendingCount);
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
      sidebarCollapsed && 'justify-center px-0',
      isActive
        ? 'border border-white/10 bg-white/12 text-white shadow-[0_18px_40px_-28px_rgba(255,255,255,0.48)]'
        : 'text-white/84 hover:bg-white/10 hover:text-white'
    );

  const navItems = projectId ? getProjectNavItems(projectId, t) : getGlobalNavItems(pendingCount, t);

  if (sidebarCollapsed) {
    return (
      <aside className="z-30 w-full shrink-0 lg:sticky lg:top-[6.75rem] lg:w-[68px] lg:self-start transition-all duration-300">
        <div className="app-panel-dark flex overflow-hidden lg:max-h-[calc(100vh-9.75rem)] lg:overflow-y-auto overscroll-contain sidebar-scroll">
          <div className="flex w-full flex-col items-center p-3 gap-3">
            <div className="sticky top-0 z-10 w-full flex justify-center pb-3" style={{ background: 'var(--gradient-dark)' }}>
              <button
                onClick={toggleSidebar}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.1] text-white/82 transition-colors hover:bg-white/14 hover:text-white"
                title={t('sidebar.expandSidebar')}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>

            <div className="w-full border-t border-white/10" />

            <div className="space-y-2">
              {visibleProjects.map((project) => (
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
              {hasMoreProjects && (
                <NavLink
                  to="/projects"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent bg-white/[0.08] text-xs font-medium text-white/80 hover:border-white/12 hover:bg-white/[0.12] hover:text-white transition-all duration-200"
                  title={t('sidebar.moreProjects', { count: projects.length - MAX_VISIBLE_PROJECTS })}
                >
                  +{projects.length - MAX_VISIBLE_PROJECTS}
                </NavLink>
              )}
            </div>

            <div className="w-full border-t border-white/10" />

            <SidebarNav items={navItems} collapsed={true} isAdmin={isAdmin} navLinkClass={navLinkClass} projectId={projectId} t={t} />

            <NavLink
              to="/projects/new"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.1] text-white/82 transition-colors hover:bg-white/14 hover:text-white"
              title={t('sidebar.newProject')}
            >
              <Plus className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="z-30 w-full shrink-0 lg:sticky lg:top-[6.75rem] lg:w-[310px] lg:self-start transition-all duration-300">
      <div className="app-panel-dark flex overflow-hidden lg:max-h-[calc(100vh-9.75rem)] lg:overflow-y-auto overscroll-contain sidebar-scroll">
        <div className="flex w-full flex-col p-4">
          <div className="sticky top-0 z-10 flex items-center justify-between pb-4" style={{ background: 'var(--gradient-dark)' }}>
            <div />
            <button
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.1] text-white/82 transition-colors hover:bg-white/14 hover:text-white"
              title={t('sidebar.collapseSidebar')}
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
              {t('sidebar.workspaceDescription')}
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
              <h3 className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/86">{t('sidebar.projects')}</h3>
              <NavLink
                to="/projects"
                className="text-xs font-medium text-white/80 transition-colors hover:text-white"
              >
                {t('common.viewAll')}
              </NavLink>
            </div>
            <div className="space-y-2.5">
              {visibleProjects.map((project) => (
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
                  <div className="min-w-0 flex-1" title={project.name}>
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/84">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLORS[project.status] }} />
                      {t(`sidebar.projectStatus.${project.status === 'active' ? 'active' : project.status === 'completed' ? 'completed' : 'preparing'}`)}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    'h-4 w-4 transition-all duration-200',
                    project.id === projectId ? 'translate-x-0 text-white' : '-translate-x-1 text-white/0 group-hover:translate-x-0 group-hover:text-white/82'
                  )} />
                </NavLink>
              ))}
              {hasMoreProjects && (
                <NavLink
                  to="/projects"
                  className="flex items-center justify-center rounded-2xl border border-dashed border-white/12 px-3 py-2.5 text-xs font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                >
                  {t('sidebar.moreProjects', { count: projects.length - MAX_VISIBLE_PROJECTS })}
                </NavLink>
              )}
              {projects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center">
                  <FolderOpen className="mx-auto mb-3 h-8 w-8 text-white/40" />
                  <p className="text-sm text-white/82">{t('sidebar.noProjects')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/86">{t('sidebar.menu')}</p>
              <NavLink
                to="/projects/new"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.1] text-white/82 transition-colors hover:bg-white/14 hover:text-white"
                title={t('sidebar.newProject')}
              >
                <Plus className="w-4 h-4" />
              </NavLink>
            </div>

            <SidebarNav items={navItems} collapsed={false} isAdmin={isAdmin} navLinkClass={navLinkClass} projectId={projectId} t={t} />
          </div>

          <div className="mt-4 rounded-[24px] border border-white/12 bg-[linear-gradient(135deg,rgba(15,118,110,0.24),rgba(203,109,55,0.16))] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">Workflow Hint</p>
            <p className="mt-2 text-sm font-medium text-white">{getWorkflowHint(location.pathname, t)}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
