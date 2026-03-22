import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { loadAuditLog } from '../../lib/auditLog';
import type { AuditAction, AuditLogEntry } from '../../types/audit';

const ACTION_LABELS: Record<AuditAction, string> = {
  'project.delete': '프로젝트 삭제',
  'project.settings_change': '프로젝트 설정 변경',
  'member.role_change': '멤버 역할 변경',
  'member.add': '멤버 추가',
  'member.remove': '멤버 삭제',
  'task.delete': '태스크 삭제',
  'owner.transfer': '소유권 이전',
};

interface Props {
  projectId: string;
}

export default function AuditLogPanel({ projectId }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAuditLog(projectId).then((data) => {
      if (!cancelled) {
        setEntries(data);
        setLoadedId(projectId);
      }
    });
    return () => { cancelled = true; };
  }, [projectId]);

  const loading = loadedId !== projectId;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)]" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[color:var(--text-muted)]">
        <ScrollText className="mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">감사 로그가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[color:var(--bg-elevated)]">
          <tr className="border-b border-[var(--border-color)]">
            <th className="px-3 py-2 text-left font-semibold text-[color:var(--text-secondary)]">시간</th>
            <th className="px-3 py-2 text-left font-semibold text-[color:var(--text-secondary)]">사용자</th>
            <th className="px-3 py-2 text-left font-semibold text-[color:var(--text-secondary)]">작업</th>
            <th className="px-3 py-2 text-left font-semibold text-[color:var(--text-secondary)]">상세</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-[var(--border-color)] last:border-b-0">
              <td className="whitespace-nowrap px-3 py-2 text-[color:var(--text-secondary)]">
                {new Date(entry.createdAt).toLocaleString('ko-KR', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-3 py-2 text-[color:var(--text-primary)]">{entry.userName}</td>
              <td className="px-3 py-2">
                <span className="inline-block rounded-md bg-[color:var(--bg-tertiary)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-secondary)]">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
              </td>
              <td className="px-3 py-2 text-[color:var(--text-secondary)]">{entry.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
