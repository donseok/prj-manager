import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Undo2,
  Redo2,
  ExpandIcon,
  ShrinkIcon,
  Download,
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';
import {
  generateId,
  cn,
} from '../lib/utils';
import { exportWbsWorkbook } from '../lib/excel';
import { syncProjectTasks } from '../lib/dataRepository';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, LEVEL_LABELS } from '../types';

export default function WBS() {
  const { projectId } = useParams<{ projectId: string }>();
  const { members, currentProject } = useProjectStore();
  const {
    tasks,
    flatTasks,
    loadedProjectId,
    addTask,
    updateTask,
    deleteTask,
    toggleExpand,
    expandAll,
    collapseAll,
    editingCell,
    setEditingCell,
    undo,
    redo,
    history,
    historyIndex,
  } = useTaskStore();

  const [selectedRows] = useState<Set<string>>(new Set());

  // 변경 시 자동 저장 (디바운스)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (projectId && loadedProjectId === projectId) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        void syncProjectTasks(projectId, tasks);
      }, 700);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [loadedProjectId, projectId, tasks]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // 새 작업 추가
  const handleAddTask = (parentId?: string, level: number = 1) => {
    const siblings = tasks.filter((t) => t.parentId === parentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((t) => t.orderIndex)) : -1;

    const newTask: Task = {
      id: generateId(),
      projectId: projectId!,
      parentId: parentId || null,
      level,
      orderIndex: maxOrder + 1,
      name: '',
      weight: 0,
      planProgress: 0,
      actualProgress: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExpanded: true,
    };

    addTask(newTask);
    setEditingCell({ taskId: newTask.id, columnId: 'name' });
  };

  // 작업 삭제
  const handleDeleteTask = (taskId: string) => {
    if (confirm('이 작업과 하위 작업이 모두 삭제됩니다. 계속하시겠습니까?')) {
      deleteTask(taskId);
    }
  };

  // 셀 값 변경
  const handleCellChange = (taskId: string, field: keyof Task, value: unknown) => {
    updateTask(taskId, { [field]: value, updatedAt: new Date().toISOString() });
  };

  const handleExportExcel = () => {
    if (tasks.length === 0) {
      alert('내보낼 작업이 없습니다.');
      return;
    }

    exportWbsWorkbook({
      projectName: currentProject?.name,
      tasks,
      members,
    });
  };

  // 셀 렌더링
  const renderCell = (task: Task, columnId: string) => {
    const isEditing = editingCell?.taskId === task.id && editingCell?.columnId === columnId;

    switch (columnId) {
      case 'expand': {
        const hasChildren = tasks.some((t) => t.parentId === task.id);
        return hasChildren ? (
          <button
            onClick={() => toggleExpand(task.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/8"
          >
            {task.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[color:var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[color:var(--text-secondary)]" />
            )}
          </button>
        ) : (
          <span className="w-6" />
        );
      }

      case 'level':
        return (
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            {LEVEL_LABELS[task.level] || `L${task.level}`}
          </span>
        );

      case 'name':
        return isEditing ? (
          <input
            type="text"
            value={task.name}
            onChange={(e) => handleCellChange(task.id, 'name', e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditingCell(null);
              if (e.key === 'Escape') setEditingCell(null);
            }}
            className="cell-input"
            autoFocus
          />
        ) : (
          <span
            className="cursor-text truncate font-medium text-[color:var(--text-primary)]"
            onClick={() => setEditingCell({ taskId: task.id, columnId })}
            style={{ paddingLeft: `${(task.depth || 0) * 20}px` }}
          >
            {task.name || <span className="text-[color:var(--text-muted)]">작업명 입력</span>}
          </span>
        );

      case 'output':
        return isEditing ? (
          <input
            type="text"
            value={task.output || ''}
            onChange={(e) => handleCellChange(task.id, 'output', e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
            }}
            className="cell-input"
            autoFocus
          />
        ) : (
          <span
            className="cursor-text truncate text-[color:var(--text-secondary)]"
            onClick={() => setEditingCell({ taskId: task.id, columnId })}
          >
            {task.output || <span className="text-[color:var(--text-muted)]">-</span>}
          </span>
        );

      case 'assignee':
        return (
          <select
            value={task.assigneeId || ''}
            onChange={(e) => handleCellChange(task.id, 'assigneeId', e.target.value || null)}
            className="cell-select text-sm"
          >
            <option value="">-</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        );

      case 'weight':
        return isEditing ? (
          <input
            type="number"
            value={task.weight}
            onChange={(e) => handleCellChange(task.id, 'weight', parseFloat(e.target.value) || 0)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
            }}
            className="cell-input text-right"
            step="0.01"
            autoFocus
          />
        ) : (
          <span
            className="cursor-text text-right block"
            onClick={() => setEditingCell({ taskId: task.id, columnId })}
          >
            {task.weight.toFixed(3)}
          </span>
        );

      case 'planStart':
      case 'planEnd':
      case 'actualStart':
      case 'actualEnd': {
        const dateValue = task[columnId as keyof Task] as string | null;
        return (
          <input
            type="date"
            value={dateValue || ''}
            onChange={(e) => handleCellChange(task.id, columnId as keyof Task, e.target.value || null)}
            className="cell-input text-sm"
          />
        );
      }

      case 'planProgress':
      case 'actualProgress': {
        const progressValue = task[columnId as keyof Task] as number;
        return isEditing ? (
          <input
            type="number"
            value={progressValue}
            onChange={(e) =>
              handleCellChange(task.id, columnId as keyof Task, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
            }
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
            }}
            className="cell-input text-right"
            min="0"
            max="100"
            autoFocus
          />
        ) : (
          <div
            className="cursor-text flex items-center gap-1"
            onClick={() => setEditingCell({ taskId: task.id, columnId })}
          >
            <div className="flex-1 h-2 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
              <div
                className={cn(
                  'h-full rounded-full',
                  columnId === 'planProgress'
                    ? 'bg-[image:linear-gradient(135deg,#155e75,#1f8f86)]'
                    : 'bg-[image:linear-gradient(135deg,#1fa37a,#34c997)]'
                )}
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs text-[color:var(--text-secondary)]">{progressValue}%</span>
          </div>
        );
      }

      case 'status':
        return (
          <select
            value={task.status}
            onChange={(e) => handleCellChange(task.id, 'status', e.target.value as TaskStatus)}
            className={cn(
              'cell-select rounded-full px-2 py-1 text-xs font-semibold',
              task.status === 'pending' && 'bg-black/5 text-[color:var(--text-secondary)] dark:bg-white/8',
              task.status === 'in_progress' && 'bg-[rgba(15,118,110,0.1)] text-[color:var(--accent-primary)]',
              task.status === 'completed' && 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]',
              task.status === 'on_hold' && 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]'
            )}
          >
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        );

      case 'actions':
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAddTask(task.id, task.level + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-[color:var(--text-primary)] dark:hover:bg-white/8"
              title="하위 작업 추가"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-[rgba(203,75,95,0.08)] hover:text-[color:var(--accent-danger)]"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <section className="app-panel p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-kicker">Structured Work Breakdown</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {currentProject?.name || '프로젝트'} WBS
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              계층형 작업 구조를 유지하면서 입력 컨트롤과 표면 질감을 모두 정리해 더 또렷하게 읽히도록 구성했습니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => handleAddTask(undefined, 1)} size="sm">
                <Plus className="w-4 h-4" />
                Phase 추가
              </Button>
              <Button variant="outline" size="sm" onClick={expandAll}>
                <ExpandIcon className="w-4 h-4" />
                전체 펼침
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                <ShrinkIcon className="w-4 h-4" />
                전체 접기
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={tasks.length === 0}>
                <Download className="w-4 h-4" />
                엑셀 다운로드
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0}>
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
                <Redo2 className="w-4 h-4" />
              </Button>
              <div className="surface-badge">
                총 {tasks.length}개 작업
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="app-panel flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th className="w-8 text-left"></th>
                <th className="w-20 text-left">
                  구분
                </th>
                <th className="min-w-[280px] text-left">
                  작업명
                </th>
                <th className="w-40 text-left">
                  산출물
                </th>
                <th className="w-28 text-left">
                  담당자
                </th>
                <th className="w-24 text-right">
                  가중치
                </th>
                <th className="w-32 text-left">
                  계획시작
                </th>
                <th className="w-32 text-left">
                  계획종료
                </th>
                <th className="w-32 text-left">
                  계획공정율
                </th>
                <th className="w-32 text-left">
                  실적시작
                </th>
                <th className="w-32 text-left">
                  실적종료
                </th>
                <th className="w-32 text-left">
                  실적공정율
                </th>
                <th className="w-28 text-left">
                  상태
                </th>
                <th className="w-24 text-center">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {flatTasks.map((task) => (
                <tr
                  key={task.id}
                  className={cn(
                    task.level === 1 && 'bg-black/[0.025] dark:bg-white/[0.03]',
                    selectedRows.has(task.id) && 'bg-[rgba(15,118,110,0.08)]'
                  )}
                >
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'expand')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'level')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    <div className="flex items-center">
                      {renderCell(task, 'name')}
                    </div>
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'output')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'assignee')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'weight')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'planStart')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'planEnd')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'planProgress')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'actualStart')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'actualEnd')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'actualProgress')}
                  </td>
                  <td className="border-r border-[var(--border-color)]">
                    {renderCell(task, 'status')}
                  </td>
                  <td>
                    {renderCell(task, 'actions')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {flatTasks.length === 0 && (
            <div className="empty-state px-6 py-12">
              <p>작업이 없습니다</p>
              <Button onClick={() => handleAddTask(undefined, 1)}>
                <Plus className="w-4 h-4" />
                첫 번째 Phase 추가
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
