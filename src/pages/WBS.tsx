import { useCallback, useEffect, useRef, useState } from 'react';
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
  GripVertical,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import Modal from '../components/common/Modal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import MemberSelect from '../components/wbs/MemberSelect';
import { getProjectVisualTone } from '../lib/projectVisuals';
import {
  generateId,
  cn,
} from '../lib/utils';
import { exportWbsWorkbook } from '../lib/excel';
import { syncProjectWorkspace } from '../lib/projectTaskSync';
import { syncProjectMembers } from '../lib/dataRepository';
import { autoScheduleTasks, buildSequentialDependencies } from '../lib/taskScheduler';
import { generateTasksFromPrompt, type TaskDraftResult } from '../lib/taskDraft';
import { generateTasksFromTemplate, getTaskTemplate, listTaskTemplates } from '../lib/taskTemplates';
import { useAutoSave } from '../hooks/useAutoSave';
import { usePageFeedback } from '../hooks/usePageFeedback';
import type { Task, TaskStatus, ProjectMember } from '../types';
import { TASK_STATUS_LABELS, LEVEL_LABELS } from '../types';

export default function WBS() {
  const { projectId } = useParams<{ projectId: string }>();
  const { members, currentProject, updateProject, addMember } = useProjectStore();
  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;
  const {
    tasks,
    flatTasks,
    loadedProjectId,
    setTasks,
    addTask,
    updateTask,
    deleteTask,
    toggleExpand,
    expandAll,
    collapseAll,
    editingCell,
    setEditingCell,
    moveTask,
    undo,
    redo,
    history,
    historyIndex,
  } = useTaskStore();

  // 드래그앤드롭 상태
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'child' | null>(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('web-launch');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftResult, setDraftResult] = useState<TaskDraftResult | null>(null);
  const dragOverCounterRef = useRef(0);
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const templates = listTaskTemplates();
  const selectedTemplate = getTaskTemplate(selectedTemplateId) ?? templates[0];

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // 드래그 이미지를 약간 투명하게
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragTaskId(null);
    setDropTargetId(null);
    setDropPosition(null);
    dragOverCounterRef.current = 0;
  };

  const handleDragOver = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    if (!dragTaskId || dragTaskId === targetTask.id) return;

    // 자기 자신의 자식으로 이동 방지
    const isDescendant = (parentId: string, childId: string): boolean => {
      const children = tasks.filter((t) => t.parentId === parentId);
      return children.some((c) => c.id === childId || isDescendant(c.id, childId));
    };
    if (isDescendant(dragTaskId, targetTask.id)) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // 상단 25% = before, 하단 25% = after, 중간 50% = child (하위 레벨이 4 미만일 때)
    let pos: 'before' | 'after' | 'child';
    if (y < height * 0.25) {
      pos = 'before';
    } else if (y > height * 0.75) {
      pos = 'after';
    } else {
      pos = targetTask.level < 4 ? 'child' : 'after';
    }

    setDropTargetId(targetTask.id);
    setDropPosition(pos);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    if (!dragTaskId || !dropPosition || dragTaskId === targetTask.id) return;

    const draggedTask = tasks.find((t) => t.id === dragTaskId);
    if (!draggedTask) return;

    if (dropPosition === 'child') {
      // 타겟 하위로 이동
      const childCount = tasks.filter((t) => t.parentId === targetTask.id).length;
      moveTask(dragTaskId, targetTask.id, childCount);
    } else if (dropPosition === 'before') {
      // 타겟 앞에 삽입
      const parentId = targetTask.parentId ?? null;
      const siblings = tasks
        .filter((t) => t.parentId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const targetIndex = siblings.findIndex((s) => s.id === targetTask.id);
      moveTask(dragTaskId, parentId, Math.max(0, targetIndex));
    } else {
      // 타겟 뒤에 삽입
      const parentId = targetTask.parentId ?? null;
      const siblings = tasks
        .filter((t) => t.parentId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const targetIndex = siblings.findIndex((s) => s.id === targetTask.id);
      moveTask(dragTaskId, parentId, targetIndex + 1);
    }

    setDragTaskId(null);
    setDropTargetId(null);
    setDropPosition(null);
  };

  // 변경 시 자동 저장 (디바운스)
  const saveTasks = useCallback(
    async (data: Task[]) => {
      if (!projectId || !currentProject) return;
      const { project } = await syncProjectWorkspace(currentProject, data);
      updateProject(project.id, project);
    },
    [currentProject, projectId, updateProject]
  );
  const { saveStatus, lastSavedAt, saveNow } = useAutoSave(tasks, saveTasks, {
    projectId,
    loadedProjectId,
  });

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
          case 's':
            e.preventDefault();
            void saveNow();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, saveNow, undo]);

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
      durationDays: level >= 3 ? 2 : null,
      predecessorIds: [],
      taskSource: 'manual',
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
    const targetTask = tasks.find((task) => task.id === taskId);
    if (targetTask) {
      setPendingDeleteTask(targetTask);
    }
  };

  // 셀 값 변경 (텍스트 입력 중에는 히스토리 기록 안 함, blur 시 기록)
  const handleApplyTemplate = () => {
    if (!projectId || !selectedTemplate) return;

    const generatedTasks = generateTasksFromTemplate({
      templateId: selectedTemplate.id,
      projectId,
      projectStartDate: currentProject?.startDate,
    });

    setTasks(generatedTasks, undefined, { recordHistory: true });
    setIsTemplateModalOpen(false);
    showFeedback({
      tone: 'success',
      title: '템플릿 적용 완료',
      message: `${selectedTemplate.name} 템플릿으로 ${generatedTasks.length}개 작업 초안을 생성했습니다.`,
    });
  };

  const handleGenerateDraft = () => {
    if (!projectId) return;

    const trimmedPrompt = draftPrompt.trim();
    if (!trimmedPrompt) {
      showFeedback({
        tone: 'info',
        title: '설명 입력 필요',
        message: '프로젝트 설명을 한 줄로 입력하면 빠른 초안을 생성할 수 있습니다.',
      });
      return;
    }

    const result = generateTasksFromPrompt({
      prompt: trimmedPrompt,
      projectId,
      projectStartDate: currentProject?.startDate,
    });

    setSelectedTemplateId(result.templateId);
    setDraftResult(result);
    showFeedback({
      tone: 'success',
      title: '빠른 초안 생성 완료',
      message: `${result.templateName} 기반으로 ${result.tasks.length}개 작업 초안을 준비했습니다.`,
    });
  };

  const handleApplyDraft = () => {
    if (!draftResult) return;

    setTasks(draftResult.tasks, undefined, { recordHistory: true });
    setIsTemplateModalOpen(false);
    showFeedback({
      tone: 'success',
      title: '빠른 초안 반영 완료',
      message: `${draftResult.templateName} 기반 초안을 WBS에 반영했습니다.`,
    });
  };

  const handleAutoSchedule = () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: '계산할 작업 없음',
        message: '자동 일정 계산을 하려면 먼저 작업을 추가하거나 템플릿을 적용하세요.',
      });
      return;
    }

    const scheduledTasks = autoScheduleTasks(tasks, currentProject?.startDate);
    setTasks(scheduledTasks, undefined, { recordHistory: true });
    showFeedback({
      tone: 'success',
      title: '일정 자동 계산 완료',
      message: '작업 순서와 기존 기간을 기준으로 계획 일정을 다시 계산했습니다.',
    });
  };

  const handleBuildDependencies = () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: '연결할 작업 없음',
        message: '선후행 연결을 만들려면 먼저 작업을 준비하세요.',
      });
      return;
    }

    const dependencyTasks = buildSequentialDependencies(tasks);
    setTasks(dependencyTasks, undefined, { recordHistory: true });
    showFeedback({
      tone: 'success',
      title: '선후행 연결 생성 완료',
      message: '같은 계층의 leaf task 기준으로 기본 선후행 관계를 생성했습니다.',
    });
  };

  const handleCellChange = (taskId: string, field: keyof Task, value: unknown, recordHistory = false) => {
    updateTask(taskId, { [field]: value, updatedAt: new Date().toISOString() }, { recordHistory });
  };

  // 셀 편집 완료 시 히스토리 기록
  const handleCellCommit = () => {
    const { tasks: currentTasks } = useTaskStore.getState();
    useTaskStore.getState().setTasks(currentTasks, undefined, { recordHistory: true });
    setEditingCell(null);
  };

  const handleExportExcel = () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: '내보낼 작업 없음',
        message: 'WBS에 작업을 추가한 뒤 엑셀 다운로드를 진행해주세요.',
      });
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
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--bg-elevated)]"
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-secondary)]">
            {LEVEL_LABELS[task.level] || `L${task.level}`}
          </span>
        );

      case 'name':
        return isEditing ? (
          <input
            type="text"
            value={task.name}
            onChange={(e) => handleCellChange(task.id, 'name', e.target.value)}
            onBlur={() => handleCellCommit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCellCommit();
              if (e.key === 'Escape') handleCellCommit();
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
            {task.name || <span className="text-[color:var(--text-secondary)]">작업명 입력</span>}
          </span>
        );

      case 'output':
        return isEditing ? (
          <input
            type="text"
            value={task.output || ''}
            onChange={(e) => handleCellChange(task.id, 'output', e.target.value)}
            onBlur={() => handleCellCommit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') handleCellCommit();
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
          <MemberSelect
            members={members}
            value={task.assigneeId || null}
            onChange={(memberId) => handleCellChange(task.id, 'assigneeId', memberId, true)}
            onCreateMember={(name) => {
              const member: ProjectMember = {
                id: generateId(),
                projectId: projectId!,
                name,
                role: 'member',
                createdAt: new Date().toISOString(),
              };
              addMember(member);
              const updatedMembers = [...useProjectStore.getState().members];
              void syncProjectMembers(projectId!, updatedMembers);
              return member.id;
            }}
          />
        );

      case 'weight':
        return isEditing ? (
          <input
            type="number"
            value={task.weight}
            onChange={(e) => handleCellChange(task.id, 'weight', parseFloat(e.target.value) || 0)}
            onBlur={() => handleCellCommit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') handleCellCommit();
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
            onChange={(e) => handleCellChange(task.id, columnId as keyof Task, e.target.value || null, true)}
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
            onBlur={() => handleCellCommit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') handleCellCommit();
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
            onChange={(e) => handleCellChange(task.id, 'status', e.target.value as TaskStatus, true)}
            data-testid={`wbs-status-${task.id}`}
            className={cn(
              'cell-select rounded-full px-2 py-1 text-xs font-semibold',
              task.status === 'pending' && 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]',
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
              className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--text-primary)]"
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
      {feedback && (
        <FeedbackNotice
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={clearFeedback}
        />
      )}

      <section className="app-panel relative overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-80" style={{ backgroundColor: projectTone?.accent || 'var(--accent-primary)' }} />
        <div
          className="pointer-events-none absolute -right-8 top-[-2.5rem] h-24 w-24 rounded-full blur-3xl opacity-70"
          style={{ backgroundColor: `${projectTone?.accent || '#18a79b'}14` }}
        />
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-kicker">Structured Work Breakdown</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {currentProject?.name || '프로젝트'} WBS
            </h1>
            {projectTone && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: `${projectTone.accent}22`, backgroundColor: `${projectTone.accent}10`, color: projectTone.accent }}>
                {ToneIcon ? <ToneIcon className="h-3.5 w-3.5" /> : null}
                {projectTone.label}
              </div>
            )}
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {projectTone ? `${projectTone.note} 흐름을 반영해 계층형 작업 구조를 더 또렷하게 정리했습니다.` : '계층형 작업 구조를 유지하면서 입력 컨트롤과 표면 질감을 모두 정리해 더 또렷하게 읽히도록 구성했습니다.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => handleAddTask(undefined, 1)} size="sm">
                <Plus className="w-4 h-4" />
                Phase 추가
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(true)}>
                빠른 초안 생성
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(true)}>
                <Sparkles className="w-4 h-4" />
                템플릿 적용
              </Button>
              <Button variant="outline" size="sm" onClick={handleAutoSchedule} disabled={tasks.length === 0}>
                일정 자동 계산
              </Button>
              <Button variant="outline" size="sm" onClick={handleBuildDependencies} disabled={tasks.length === 0}>
                선후행 연결
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => void saveNow()}
                disabled={!currentProject || saveStatus === 'saving'}
                data-testid="wbs-save-button"
              >
                {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                저장
              </Button>
              <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0}>
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
                <Redo2 className="w-4 h-4" />
              </Button>
              <div className="surface-badge shrink-0">
                총 {tasks.length}개 작업
              </div>
              <div className={cn(
                'surface-badge shrink-0',
                saveStatus === 'error' && 'border-[rgba(203,75,95,0.22)] text-[color:var(--accent-danger)]'
              )}>
                {saveStatus === 'pending' && '변경사항 저장 대기'}
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    저장중...
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--accent-success)]" />
                    {formatSaveStatus(lastSavedAt)}
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <AlertCircle className="h-3.5 w-3.5" />
                    저장 실패
                  </>
                )}
                {saveStatus === 'idle' && '자동 저장 준비'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="app-panel relative flex-1 overflow-hidden">
        <button
          onClick={() => setIsPopupOpen(true)}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
          title="크게 보기"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <div className="h-full overflow-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th className="w-8 text-center"></th>
                <th className="w-20 text-center">구분</th>
                <th className="min-w-[280px] text-center">작업명</th>
                <th className="w-40 text-center">산출물</th>
                <th className="min-w-[120px] text-center whitespace-nowrap">담당자</th>
                <th className="w-24 text-center whitespace-nowrap">가중치</th>
                <th className="w-32 text-center whitespace-nowrap">계획시작</th>
                <th className="w-32 text-center whitespace-nowrap">계획종료</th>
                <th className="min-w-[100px] text-center whitespace-nowrap">계획공정율</th>
                <th className="w-32 text-center whitespace-nowrap">실적시작</th>
                <th className="w-32 text-center whitespace-nowrap">실적종료</th>
                <th className="min-w-[100px] text-center whitespace-nowrap">실적공정율</th>
                <th className="min-w-[100px] text-center whitespace-nowrap">상태</th>
                <th className="w-24 text-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {flatTasks.map((task) => (
                <tr
                  key={task.id}
                  data-testid={`wbs-row-${task.id}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, task)}
                  onDragLeave={() => {
                    if (dropTargetId === task.id) {
                      setDropTargetId(null);
                      setDropPosition(null);
                    }
                  }}
                  onDrop={(e) => handleDrop(e, task)}
                  className={cn(
                    task.level === 1 && 'bg-[color:var(--bg-tertiary)]',
                    dragTaskId === task.id && 'opacity-40',
                    dropTargetId === task.id && dropPosition === 'before' && 'border-t-2 !border-t-[var(--accent-primary)]',
                    dropTargetId === task.id && dropPosition === 'after' && 'border-b-2 !border-b-[var(--accent-primary)]',
                    dropTargetId === task.id && dropPosition === 'child' && 'bg-[rgba(15,118,110,0.08)]',
                  )}
                >
                  <td className="border-r border-[var(--border-color)]">
                    <div className="flex items-center">
                      <span className="cursor-grab active:cursor-grabbing text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] mr-0.5">
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                      {renderCell(task, 'expand')}
                    </div>
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

      <Modal isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)} title="WBS 전체 보기" size="fullscreen">
        <div className="h-full overflow-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th className="w-8 text-center"></th>
                <th className="w-20 text-center">구분</th>
                <th className="min-w-[280px] text-center">작업명</th>
                <th className="w-40 text-center">산출물</th>
                <th className="min-w-[120px] text-center whitespace-nowrap">담당자</th>
                <th className="w-24 text-center whitespace-nowrap">가중치</th>
                <th className="w-32 text-center whitespace-nowrap">계획시작</th>
                <th className="w-32 text-center whitespace-nowrap">계획종료</th>
                <th className="min-w-[100px] text-center whitespace-nowrap">계획공정율</th>
                <th className="w-32 text-center whitespace-nowrap">실적시작</th>
                <th className="w-32 text-center whitespace-nowrap">실적종료</th>
                <th className="min-w-[100px] text-center whitespace-nowrap">실적공정율</th>
                <th className="min-w-[100px] text-center whitespace-nowrap">상태</th>
                <th className="w-24 text-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {flatTasks.map((task) => (
                <tr
                  key={task.id}
                  className={cn(
                    task.level === 1 && 'bg-[color:var(--bg-tertiary)]',
                  )}
                >
                  <td className="border-r border-[var(--border-color)]">
                    <div className="flex items-center">
                      {renderCell(task, 'expand')}
                    </div>
                  </td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'level')}</td>
                  <td className="border-r border-[var(--border-color)]">
                    <div className="flex items-center">{renderCell(task, 'name')}</div>
                  </td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'output')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'assignee')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'weight')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'planStart')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'planEnd')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'planProgress')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'actualStart')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'actualEnd')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'actualProgress')}</td>
                  <td className="border-r border-[var(--border-color)]">{renderCell(task, 'status')}</td>
                  <td>{renderCell(task, 'actions')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="템플릿으로 WBS 시작"
        size="xl"
      >
        <div className="p-6">
          <div className="mb-6 rounded-[28px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="page-kicker">Quick Draft</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                  한 줄 설명으로 WBS 초안 만들기
                </h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                  프로젝트 설명을 입력하면 키워드 기반으로 템플릿을 추론하고 필요한 작업을 추가합니다.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDraftPrompt('쇼핑몰 리뉴얼 / 6월 오픈 / 디자인, 프론트, 백엔드, QA 필요')}>
                  예시 채우기
                </Button>
                <Button onClick={handleGenerateDraft}>
                  빠른 초안 생성
                </Button>
              </div>
            </div>

            <textarea
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              placeholder="예: 쇼핑몰 리뉴얼 / 6월 오픈 / 디자인, 프론트, 백엔드, QA 필요"
              className="mt-4 min-h-[110px] w-full rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-[rgba(15,118,110,0.34)]"
            />

            {draftResult && (
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-[20px] border border-[rgba(15,118,110,0.2)] bg-[rgba(15,118,110,0.08)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-primary)]">
                    추천 결과
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
                    {draftResult.templateName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                    {draftResult.reason}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--text-secondary)]">
                    <span className="surface-badge">Tasks {draftResult.tasks.length}</span>
                    {draftResult.matchedKeywords.map((keyword) => (
                      <span key={keyword} className="surface-badge">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                    반영 방식
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                    생성된 초안이 현재 WBS를 교체합니다. 반영 후에는 기존 표 편집기로 바로 수정할 수 있습니다.
                  </p>
                  <Button className="mt-4 w-full" onClick={handleApplyDraft}>
                    초안 바로 반영
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              {templates.map((template) => {
                const isSelected = template.id === selectedTemplate?.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={cn(
                      'w-full rounded-[24px] border p-5 text-left transition-all',
                      isSelected
                        ? 'border-[rgba(15,118,110,0.34)] bg-[rgba(15,118,110,0.08)] shadow-[0_24px_50px_-34px_rgba(15,118,110,0.5)]'
                        : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] hover:border-[rgba(15,118,110,0.2)] hover:bg-[color:var(--bg-secondary-solid)]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                          {template.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                          {template.description}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="rounded-full bg-[rgba(15,118,110,0.14)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-primary)]">
                          선택됨
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--text-secondary)]">
                      <span className="surface-badge">{template.audience}</span>
                      <span className="surface-badge">Phase {template.phases}</span>
                      <span className="surface-badge">Tasks {template.taskCount}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5">
              <p className="page-kicker">Template Summary</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {selectedTemplate?.name || '템플릿 선택'}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">
                {selectedTemplate?.description || '적용할 템플릿을 선택하세요.'}
              </p>

              <div className="mt-5 grid gap-3">
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                    대상 프로젝트
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
                    {currentProject?.name || '현재 프로젝트'}
                  </p>
                </div>

                <div className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                    시작일 기준
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
                    {currentProject?.startDate || '프로젝트 시작일 미설정'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                    시작일이 있으면 leaf task에 계획 일정을 순차 배치합니다.
                  </p>
                </div>

                <div className="rounded-[20px] border border-[rgba(216,139,68,0.22)] bg-[rgba(216,139,68,0.08)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-warning)]">
                    적용 방식
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-primary)]">
                    현재 WBS 작업을 템플릿 초안으로 교체합니다. 적용 후에는 기존 편집기에서 바로 수정할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsTemplateModalOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleApplyTemplate} disabled={!selectedTemplate}>
                  <Sparkles className="w-4 h-4" />
                  템플릿 적용
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteTask)}
        onClose={() => setPendingDeleteTask(null)}
        onConfirm={() => {
          if (!pendingDeleteTask) return;
          deleteTask(pendingDeleteTask.id);
          showFeedback({
            tone: 'warning',
            title: '작업 삭제 완료',
            message: `"${pendingDeleteTask.name || '이름 없는 작업'}"과 하위 작업을 제거했습니다.`,
          });
          setPendingDeleteTask(null);
        }}
        title="작업 삭제"
        description={
          pendingDeleteTask
            ? `"${pendingDeleteTask.name || '이름 없는 작업'}"과 연결된 하위 작업도 함께 삭제됩니다. 변경 내용은 저장 시 일정과 지표에 반영됩니다.`
            : ''
        }
        confirmLabel="작업 삭제"
        confirmVariant="danger"
      />
    </div>
  );
}

function formatSaveStatus(lastSavedAt: string | null) {
  if (!lastSavedAt) return '저장됨';
  return `${new Date(lastSavedAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })} 저장됨`;
}
