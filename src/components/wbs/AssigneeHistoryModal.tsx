import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowRight, History, UserCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { loadAssigneeHistoryForTask } from '../../lib/taskAssigneeHistory';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId: string;
  taskName: string;
}

const UNASSIGNED_LABEL = '미배정';

export default function AssigneeHistoryModal({ isOpen, onClose, projectId, taskId, taskName }: Props) {
  const entries = useMemo(
    () => (isOpen ? loadAssigneeHistoryForTask(projectId, taskId) : []),
    [isOpen, projectId, taskId],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="담당자 변경 이력" size="lg">
      <div className="px-6 pb-6">
        <p className="mb-4 text-sm text-[color:var(--text-secondary)]">
          작업: <span className="font-semibold text-[color:var(--text-primary)]">{taskName || '이름 없음'}</span>
        </p>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[color:var(--text-muted)]">
            <History className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">변경 이력이 없습니다.</p>
          </div>
        ) : (
          <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {entries.map((entry) => {
              const ts = format(parseISO(entry.createdAt), 'yyyy-MM-dd (EEE) HH:mm', { locale: ko });
              const oldName = entry.oldAssigneeName || UNASSIGNED_LABEL;
              const newName = entry.newAssigneeName || UNASSIGNED_LABEL;
              return (
                <li
                  key={entry.id}
                  className="rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3"
                >
                  <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)]">
                    <span>{ts}</span>
                    <span className="inline-flex items-center gap-1 text-[color:var(--text-secondary)]">
                      <UserCircle className="h-3.5 w-3.5" />
                      {entry.actorName}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="rounded-md bg-[color:var(--bg-tertiary)] px-2 py-1 text-[color:var(--text-secondary)]">
                      {oldName}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[color:var(--text-muted)]" />
                    <span className="rounded-md bg-[color:var(--accent-primary)]/10 px-2 py-1 font-semibold text-[color:var(--accent-primary)]">
                      {newName}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
