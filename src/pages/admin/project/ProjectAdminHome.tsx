import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Users as UsersIcon, Settings as SettingsIcon, ArrowRight, KeyRound, Plus } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useProjectStore } from '../../../store/projectStore';
import { loadProjectMembers } from '../../../lib/dataRepository';
import type { Project, ProjectMember } from '../../../types';
import AccessRequestModal from './AccessRequestModal';

interface ManagedProject {
  project: Project;
  myRole: ProjectMember['role'] | 'owner';
}

export default function ProjectAdminHome() {
  const { user, isAdmin } = useAuthStore();
  const projects = useProjectStore((s) => s.projects);
  const [managed, setManaged] = useState<ManagedProject[]>([]);
  const [otherProjects, setOtherProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestTarget, setRequestTarget] = useState<Project | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const activeProjects = projects.filter((p) => p.status !== 'deleted');
      const results: ManagedProject[] = [];
      const others: Project[] = [];

      for (const project of activeProjects) {
        // owner 빠른 판정
        if (project.ownerId === user.id) {
          results.push({ project, myRole: 'owner' });
          continue;
        }
        // admin 여부는 멤버 로드 필요. 시스템 admin이면 전부 관리 가능으로 취급.
        if (isAdmin) {
          results.push({ project, myRole: 'admin' });
          continue;
        }
        const members = await loadProjectMembers(project.id);
        const me = members.find((m) => m.userId === user.id);
        if (me && (me.role === 'owner' || me.role === 'admin')) {
          results.push({ project, myRole: me.role });
        } else {
          others.push(project);
        }
      }

      if (!cancelled) {
        setManaged(results);
        setOtherProjects(others);
        setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [projects, user, isAdmin]);

  const roleBadge = useMemo(
    () => ({
      owner: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    }),
    [],
  );

  return (
    <div className="space-y-6">
      <section className="app-panel-dark relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-3xl" />
        <div className="relative z-10 max-w-2xl">
          <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
            <FolderKanban className="h-3.5 w-3.5 text-[color:var(--accent-primary)]" />
            Project Admin
          </div>
          <h1 className="mt-6 text-[clamp(1.8rem,3.4vw,3rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-white">
            프로젝트 관리자 페이지
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90">
            내가 관리 권한을 가진 프로젝트를 조회하고, 멤버·설정을 편집합니다. 타 프로젝트 열람이 필요하면 슈퍼관리자에게 요청하세요.
          </p>
        </div>
      </section>

      <section className="app-panel p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">내가 관리하는 프로젝트</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">owner 또는 admin 역할을 가진 프로젝트만 표시됩니다.</p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)]" />
          </div>
        ) : managed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[color:var(--text-muted)]">
            <FolderKanban className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">관리 권한이 있는 프로젝트가 없습니다.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {managed.map(({ project, myRole }) => (
              <div key={project.id} className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[color:var(--text-primary)]" title={project.name}>{project.name}</p>
                    {project.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-[color:var(--text-secondary)]">{project.description}</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadge[myRole === 'owner' ? 'owner' : 'admin']}`}>
                    {myRole === 'owner' ? 'Owner' : 'Admin'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/projects/${project.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
                  >
                    진입 <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    to={`/projects/${project.id}/members`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-tertiary)]"
                  >
                    <UsersIcon className="h-3 w-3" /> 멤버
                  </Link>
                  <Link
                    to={`/projects/${project.id}/settings`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-tertiary)]"
                  >
                    <SettingsIcon className="h-3 w-3" /> 설정
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!isAdmin && otherProjects.length > 0 && (
        <section className="app-panel p-6">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">타 프로젝트 열람 요청</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              다른 프로젝트를 열람·관리하려면 슈퍼관리자의 승인이 필요합니다.
            </p>
          </header>
          <div className="grid gap-2 md:grid-cols-2">
            {otherProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{p.name}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">요청 후 슈퍼관리자 승인 대기</p>
                </div>
                <button
                  onClick={() => setRequestTarget(p)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-tertiary)]"
                >
                  <KeyRound className="h-3 w-3" /> 요청
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link
              to="/admin/project/requests"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent-primary)] hover:underline"
            >
              <Plus className="h-3 w-3" /> 내 요청 현황 보기
            </Link>
          </div>
        </section>
      )}

      {requestTarget && (
        <AccessRequestModal
          project={requestTarget}
          onClose={() => setRequestTarget(null)}
        />
      )}
    </div>
  );
}
