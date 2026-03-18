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
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';
import {
  generateId,
  cn,
  storage,
} from '../lib/utils';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, LEVEL_LABELS } from '../types';

export default function WBS() {
  const { projectId } = useParams<{ projectId: string }>();
  const { members } = useProjectStore();
  const {
    tasks,
    flatTasks,
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
    setTasks,
  } = useTaskStore();

  const [selectedRows] = useState<Set<string>>(new Set());

  // 로컬 스토리지에서 작업 로드
  useEffect(() => {
    if (projectId) {
      const savedTasks = storage.get<Task[]>(`tasks-${projectId}`, []);
      setTasks(savedTasks);
    }
  }, [projectId, setTasks]);

  // 변경 시 자동 저장 (디바운스)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (projectId && tasks.length > 0) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        storage.set(`tasks-${projectId}`, tasks);
      }, 500);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [projectId, tasks]);

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

  // 셀 렌더링
  const renderCell = (task: Task, columnId: string) => {
    const isEditing = editingCell?.taskId === task.id && editingCell?.columnId === columnId;

    switch (columnId) {
      case 'expand':
        const hasChildren = tasks.some((t) => t.parentId === task.id);
        return hasChildren ? (
          <button
            onClick={() => toggleExpand(task.id)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            {task.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-6" />
        );

      case 'level':
        return (
          <span className="text-xs text-gray-500 font-medium">
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
            className="w-full px-1 py-0.5 border-0 focus:ring-0 bg-transparent"
            autoFocus
          />
        ) : (
          <span
            className="cursor-text truncate"
            onClick={() => setEditingCell({ taskId: task.id, columnId })}
            style={{ paddingLeft: `${(task.depth || 0) * 20}px` }}
          >
            {task.name || <span className="text-gray-400">작업명 입력</span>}
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
            className="w-full px-1 py-0.5 border-0 focus:ring-0 bg-transparent"
            autoFocus
          />
        ) : (
          <span
            className="cursor-text truncate"
            onClick={() => setEditingCell({ taskId: task.id, columnId })}
          >
            {task.output || <span className="text-gray-400">-</span>}
          </span>
        );

      case 'assignee':
        return (
          <select
            value={task.assigneeId || ''}
            onChange={(e) => handleCellChange(task.id, 'assigneeId', e.target.value || null)}
            className="w-full px-1 py-0.5 border-0 focus:ring-0 bg-transparent text-sm"
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
            className="w-full px-1 py-0.5 border-0 focus:ring-0 bg-transparent text-right"
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
      case 'actualEnd':
        const dateValue = task[columnId as keyof Task] as string | null;
        return (
          <input
            type="date"
            value={dateValue || ''}
            onChange={(e) => handleCellChange(task.id, columnId as keyof Task, e.target.value || null)}
            className="w-full px-1 py-0.5 border-0 focus:ring-0 bg-transparent text-sm"
          />
        );

      case 'planProgress':
      case 'actualProgress':
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
            className="w-full px-1 py-0.5 border-0 focus:ring-0 bg-transparent text-right"
            min="0"
            max="100"
            autoFocus
          />
        ) : (
          <div
            className="cursor-text flex items-center gap-1"
            onClick={() => setEditingCell({ taskId: task.id, columnId })}
          >
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  columnId === 'planProgress' ? 'bg-blue-400' : 'bg-green-500'
                )}
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <span className="text-xs w-8 text-right">{progressValue}%</span>
          </div>
        );

      case 'status':
        return (
          <select
            value={task.status}
            onChange={(e) => handleCellChange(task.id, 'status', e.target.value as TaskStatus)}
            className={cn(
              'w-full px-1 py-0.5 border-0 focus:ring-0 rounded text-xs font-medium',
              task.status === 'pending' && 'bg-gray-100 text-gray-700',
              task.status === 'in_progress' && 'bg-blue-100 text-blue-700',
              task.status === 'completed' && 'bg-green-100 text-green-700',
              task.status === 'on_hold' && 'bg-yellow-100 text-yellow-700'
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
              className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
              title="하위 작업 추가"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
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
    <div className="h-full flex flex-col">
      {/* 툴바 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button onClick={() => handleAddTask(undefined, 1)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Phase 추가
          </Button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
          <Button variant="ghost" size="sm" onClick={expandAll}>
            <ExpandIcon className="w-4 h-4 mr-1" />
            전체 펼침
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            <ShrinkIcon className="w-4 h-4 mr-1" />
            전체 접기
          </Button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            총 {tasks.length}개 작업
          </span>
        </div>
      </div>

      {/* WBS 테이블 */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="w-8 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700"></th>
                <th className="w-16 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  구분
                </th>
                <th className="min-w-[250px] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  작업명
                </th>
                <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  산출물
                </th>
                <th className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  담당자
                </th>
                <th className="w-20 px-2 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  가중치
                </th>
                <th className="w-28 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  계획시작
                </th>
                <th className="w-28 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  계획종료
                </th>
                <th className="w-28 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  계획공정율
                </th>
                <th className="w-28 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  실적시작
                </th>
                <th className="w-28 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  실적종료
                </th>
                <th className="w-28 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  실적공정율
                </th>
                <th className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-gray-700">
                  상태
                </th>
                <th className="w-20 px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {flatTasks.map((task) => (
                <tr
                  key={task.id}
                  className={cn(
                    'border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors',
                    task.level === 1 && 'bg-gray-50 dark:bg-gray-900/50 font-medium',
                    selectedRows.has(task.id) && 'bg-blue-50 dark:bg-blue-900/30'
                  )}
                >
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'expand')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'level')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      {renderCell(task, 'name')}
                    </div>
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'output')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'assignee')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'weight')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'planStart')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'planEnd')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'planProgress')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'actualStart')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'actualEnd')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'actualProgress')}
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                    {renderCell(task, 'status')}
                  </td>
                  <td className="px-2 py-2">
                    {renderCell(task, 'actions')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {flatTasks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">작업이 없습니다</p>
              <Button onClick={() => handleAddTask(undefined, 1)}>
                <Plus className="w-4 h-4 mr-2" />
                첫 번째 Phase 추가
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
