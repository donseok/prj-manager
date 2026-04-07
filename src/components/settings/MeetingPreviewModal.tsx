import { useState, useMemo, useCallback } from 'react';
import { FileText, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import Modal from '../common/Modal';
import Button from '../common/Button';
import type { Task, ProjectMember } from '../../types';
import { LEVEL_LABELS } from '../../types';

export interface MeetingTask {
  name: string;
  description?: string;
  assigneeName?: string;
  startDate?: string;
  endDate?: string;
  level: 1 | 2 | 3 | 4;
  selected: boolean;
}

interface MeetingPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: MeetingTask[];
  existingTasks: Task[];
  members: ProjectMember[];
  onConfirm: (tasks: MeetingTask[]) => void;
}

/** 기존 WBS 트리를 계층적 드롭다운 옵션으로 변환 */
function buildParentOptions(tasks: Task[]): { id: string; label: string; level: number }[] {
  const sorted = [...tasks].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.orderIndex - b.orderIndex;
  });

  // parentId 기반 트리 순서로 정렬
  const childrenMap = new Map<string | null, Task[]>();
  for (const task of sorted) {
    const parentKey = task.parentId ?? null;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(task);
  }

  const result: { id: string; label: string; level: number }[] = [];

  function walk(parentId: string | null) {
    const children = childrenMap.get(parentId);
    if (!children) return;
    for (const child of children) {
      const indent = '\u00A0\u00A0'.repeat(child.level - 1);
      const levelTag = LEVEL_LABELS[child.level] ?? `L${child.level}`;
      result.push({
        id: child.id,
        label: `${indent}${levelTag} — ${child.name}`,
        level: child.level,
      });
      walk(child.id);
    }
  }

  walk(null);
  return result;
}

export default function MeetingPreviewModal({
  isOpen,
  onClose,
  tasks: initialTasks,
  existingTasks,
  members,
  onConfirm,
}: MeetingPreviewModalProps) {
  const [editedTasks, setEditedTasks] = useState<MeetingTask[]>([]);
  const [parentTaskId, setParentTaskId] = useState<string>('');

  // 모달이 열릴 때 tasks 복사
  const [prevOpen, setPrevOpen] = useState(false);
  if (isOpen && !prevOpen) {
    setEditedTasks(initialTasks.map((t) => ({ ...t })));
    setParentTaskId('');
  }
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
  }

  const parentOptions = useMemo(() => buildParentOptions(existingTasks), [existingTasks]);

  const selectedCount = editedTasks.filter((t) => t.selected).length;
  const allSelected = editedTasks.length > 0 && selectedCount === editedTasks.length;

  const updateTask = useCallback((index: number, patch: Partial<MeetingTask>) => {
    setEditedTasks((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }, []);

  const toggleAll = useCallback(() => {
    const nextValue = !allSelected;
    setEditedTasks((prev) => prev.map((t) => ({ ...t, selected: nextValue })));
  }, [allSelected]);

  const handleConfirm = () => {
    const selected = editedTasks.filter((t) => t.selected);
    if (selected.length === 0) return;
    onConfirm(selected);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="회의록 업무 추출 결과" size="3xl">
      <div className="flex flex-col gap-4 p-6">
        {/* 상위 항목 선택 */}
        <div className="flex items-center gap-3">
          <label className="shrink-0 text-sm font-medium text-[color:var(--text-secondary)]">
            상위 항목
          </label>
          <select
            value={parentTaskId}
            onChange={(e) => setParentTaskId(e.target.value)}
            className={cn(
              'flex-1 rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-2 text-sm text-[color:var(--text-primary)]',
              'focus:border-[rgba(15,118,110,0.5)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,118,110,0.2)]'
            )}
          >
            <option value="">최상위 (새 Phase)</option>
            {parentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 전체 선택 */}
        <label className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-[var(--border-color)] accent-[var(--accent-primary)]"
          />
          전체 선택 / 해제
        </label>

        {/* 테이블 */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[color:var(--bg-secondary-solid)] text-[color:var(--text-secondary)]">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">
                    <span className="sr-only">선택</span>
                  </th>
                  <th className="min-w-[200px] px-3 py-2.5 text-left font-medium">업무명</th>
                  <th className="w-28 px-3 py-2.5 text-left font-medium">레벨</th>
                  <th className="w-32 px-3 py-2.5 text-left font-medium">담당자</th>
                  <th className="w-36 px-3 py-2.5 text-left font-medium">시작일</th>
                  <th className="w-36 px-3 py-2.5 text-left font-medium">종료일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {editedTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[color:var(--text-muted)]">
                      추출된 업무가 없습니다.
                    </td>
                  </tr>
                )}
                {editedTasks.map((task, index) => (
                  <tr
                    key={index}
                    className={cn(
                      'transition-colors',
                      task.selected
                        ? 'bg-[rgba(15,118,110,0.04)] dark:bg-[rgba(15,118,110,0.08)]'
                        : 'bg-transparent hover:bg-[color:var(--bg-hover)]'
                    )}
                  >
                    {/* 선택 체크박스 */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={task.selected}
                        onChange={() => updateTask(index, { selected: !task.selected })}
                        className="h-4 w-4 rounded border-[var(--border-color)] accent-[var(--accent-primary)]"
                      />
                    </td>

                    {/* 업무명 (편집 가능) + 설명 툴팁 */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={task.name}
                          onChange={(e) => updateTask(index, { name: e.target.value })}
                          className={cn(
                            'flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-[color:var(--text-primary)]',
                            'hover:border-[var(--border-color)] focus:border-[rgba(15,118,110,0.5)] focus:bg-[color:var(--bg-elevated)] focus:outline-none'
                          )}
                        />
                        {task.description && (
                          <div className="group relative shrink-0">
                            <Info className="h-3.5 w-3.5 text-[color:var(--text-muted)] cursor-help" />
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                              <div className="max-w-xs rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-2 text-xs text-[color:var(--text-secondary)] shadow-lg">
                                {task.description}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 레벨 드롭다운 */}
                    <td className="px-3 py-2">
                      <select
                        value={task.level}
                        onChange={(e) =>
                          updateTask(index, { level: Number(e.target.value) as 1 | 2 | 3 | 4 })
                        }
                        className={cn(
                          'w-full rounded-md border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-2 py-1 text-sm text-[color:var(--text-primary)]',
                          'focus:border-[rgba(15,118,110,0.5)] focus:outline-none'
                        )}
                      >
                        {([1, 2, 3, 4] as const).map((lv) => (
                          <option key={lv} value={lv}>
                            {LEVEL_LABELS[lv]}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 담당자 드롭다운 */}
                    <td className="px-3 py-2">
                      <select
                        value={task.assigneeName ?? ''}
                        onChange={(e) =>
                          updateTask(index, { assigneeName: e.target.value || undefined })
                        }
                        className={cn(
                          'w-full rounded-md border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-2 py-1 text-sm text-[color:var(--text-primary)]',
                          'focus:border-[rgba(15,118,110,0.5)] focus:outline-none'
                        )}
                      >
                        <option value="">미지정</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {/* 회의록에서 추출된 담당자 힌트 */}
                      {task.assigneeName &&
                        !members.some((m) => m.name === task.assigneeName) && (
                          <p className="mt-0.5 truncate text-[10px] text-[color:var(--text-muted)]">
                            회의록: {task.assigneeName}
                          </p>
                        )}
                    </td>

                    {/* 시작일 */}
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={task.startDate ?? ''}
                        onChange={(e) =>
                          updateTask(index, { startDate: e.target.value || undefined })
                        }
                        className={cn(
                          'w-full rounded-md border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-2 py-1 text-sm text-[color:var(--text-primary)]',
                          'focus:border-[rgba(15,118,110,0.5)] focus:outline-none'
                        )}
                      />
                    </td>

                    {/* 종료일 */}
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={task.endDate ?? ''}
                        onChange={(e) =>
                          updateTask(index, { endDate: e.target.value || undefined })
                        }
                        className={cn(
                          'w-full rounded-md border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-2 py-1 text-sm text-[color:var(--text-primary)]',
                          'focus:border-[rgba(15,118,110,0.5)] focus:outline-none'
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 푸터: 선택 개수 + 버튼 */}
        <div className="flex items-center justify-between pt-1">
          <p className="flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)]">
            <FileText className="h-4 w-4" />
            <span className="font-medium text-[color:var(--text-primary)]">{selectedCount}개</span>
            선택됨
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={selectedCount === 0}>
              WBS에 등록
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
