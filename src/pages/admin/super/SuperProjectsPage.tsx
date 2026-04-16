import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FolderKanban, ArrowRight } from 'lucide-react';
import { useProjectStore } from '../../../store/projectStore';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '../../../types';

const STATUS_FILTERS: { key: 'all' | ProjectStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'preparing', label: '준비' },
  { key: 'active', label: '진행' },
  { key: 'completed', label: '완료' },
];

export default function SuperProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return projects
      .filter((p) => p.status !== 'deleted')
      .filter((p) => filter === 'all' || p.status === filter)
      .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  }, [projects, filter, query]);

  return (
    <section className="app-panel p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">전체 프로젝트</h2>
          <p className="text-sm text-[color:var(--text-secondary)]">
            슈퍼관리자는 모든 프로젝트를 조회하고 진입할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-2">
          <Search className="h-4 w-4 text-[color:var(--text-secondary)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로젝트 이름 검색"
            className="w-56 bg-transparent text-sm outline-none placeholder:text-[color:var(--text-secondary)]"
          />
        </div>
      </header>

      <div className="mb-4 flex gap-1 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-[color:var(--accent-primary)] text-white'
                : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-secondary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[color:var(--text-muted)]">
          <FolderKanban className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">표시할 프로젝트가 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-color)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-left text-[color:var(--text-secondary)]">
                <th className="px-4 py-3 font-semibold">프로젝트</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">시작</th>
                <th className="px-4 py-3 font-semibold">종료</th>
                <th className="px-4 py-3 font-semibold text-right">진입</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[color:var(--bg-elevated)]">
                  <td className="px-4 py-3 font-medium text-[color:var(--text-primary)]">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-lg bg-[color:var(--bg-elevated)] px-2 py-1 text-xs font-semibold text-[color:var(--text-secondary)]">
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">{p.startDate || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">{p.endDate || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/projects/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
                    >
                      이동 <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
