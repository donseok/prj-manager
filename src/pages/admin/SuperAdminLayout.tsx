import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, KeyRound, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin/super', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/admin/super/users', label: '사용자 관리', icon: Users, end: false },
  { to: '/admin/super/projects', label: '전체 프로젝트', icon: FolderKanban, end: false },
  { to: '/admin/super/access-requests', label: '열람 요청 승인', icon: KeyRound, end: false },
  { to: '/admin/super/settings', label: '시스템 설정', icon: SettingsIcon, end: false },
];

export default function SuperAdminLayout() {
  return (
    <div className="flex flex-1 min-h-0 gap-6">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-4 space-y-3 rounded-[24px] border border-[var(--border-color)] bg-[color:var(--bg-secondary)] p-4">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Super Admin</p>
              <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">슈퍼관리자</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[color:var(--accent-primary)] text-white shadow-sm'
                      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--text-primary)]'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-secondary)] p-1 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[color:var(--accent-primary)] text-white'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
                }`
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </div>
        <Outlet />
      </div>
    </div>
  );
}
