import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  ExternalLink,
  Sparkles,
  FileText,
  Wand2,
  ClipboardList,
  Bot,
  MessageCircle,
  RefreshCw,
  BookmarkPlus,
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import { useAttendanceStore } from '../store/attendanceStore';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import Modal from '../components/common/Modal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import MemberSelect from '../components/wbs/MemberSelect';
import ContextMenu from '../components/wbs/ContextMenu';
import QuickProgressModal from '../components/wbs/QuickProgressModal';
import WeeklyReportModal from '../components/WeeklyReportModal';
import { getProjectVisualTone } from '../lib/projectVisuals';
import {
  generateId,
  cn,
} from '../lib/utils';
import { exportWbsWorkbook } from '../lib/excel';
import { syncProjectWorkspace } from '../lib/projectTaskSync';
import { syncProjectMembers } from '../lib/dataRepository';
import { autoScheduleTasks, buildSequentialDependencies } from '../lib/taskScheduler';
import { generateTasksFromPrompt } from '../lib/taskDraft';
import { generateTasksFromTemplate, getTaskTemplate, listTaskTemplates } from '../lib/taskTemplates';
import { syncTaskField, isSyncableField } from '../lib/taskFieldSync';
import { autoFillTasks, autoCalculateWeights } from '../lib/taskAutoFill';
import { useAutoSave } from '../hooks/useAutoSave';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { useProjectPermission, useCurrentMemberId } from '../hooks/useProjectPermission';
import { canEditSpecificTask } from '../lib/permissions';
import { logAuditEvent } from '../lib/auditLog';
import { useAuthStore } from '../store/authStore';
import { useCommentStore } from '../store/commentStore';
import TaskCommentPanel from '../components/common/TaskCommentPanel';
import { openPopup } from '../lib/popupWindow';
import type { Task, TaskStatus, ProjectMember } from '../types';
import { TASK_STATUS_LABELS, LEVEL_LABELS } from '../types';
import { useUIStore } from '../store/uiStore';
import { isAIConfigured } from '../lib/ai';
import { generateWbsWithAI } from '../lib/ai/aiWbsGenerator';
import { suggestProgressUpdates, type ProgressSuggestion } from '../lib/ai/aiProgressSuggestion';
import AIReviewPanel from '../components/wbs/AIReviewPanel';
import AISuggestionPanel from '../components/wbs/AISuggestionPanel';
import RecurringTaskModal from '../components/common/RecurringTaskModal';
import SaveTemplateModal from '../components/common/SaveTemplateModal';
import { loadCustomTemplates, applyCustomTemplate } from '../lib/customTemplates';
import { useRecurringTasks } from '../hooks/useRecurringTasks';

export default function WBS() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { members, currentProject, updateProject, addMember } = useProjectStore();
  const attendancesForReport = useAttendanceStore((s) => s.attendances);
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
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('steel-project');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [isWeeklyReportOpen, setIsWeeklyReportOpen] = useState(false);
  const [isQuickProgressOpen, setIsQuickProgressOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null);
  const [copiedTask, setCopiedTask] = useState<Task | null>(null);
  const [editingNameBackup, setEditingNameBackup] = useState<string | null>(null);
  const [templateTab, setTemplateTab] = useState<'template' | 'ai'>('template');
  const [aiDescription, setAiDescription] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreviewTasks, setAiPreviewTasks] = useState<Task[] | null>(null);
  const inputMode = useUIStore((s) => s.inputMode);
  const aiConfigured = isAIConfigured();
  const [aiSuggestions, setAiSuggestions] = useState<ProgressSuggestion[]>([]);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const commentCounts = useCommentStore((s) => s.comments);
  const loadComments = useCommentStore((s) => s.loadComments);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  const dragOverCounterRef = useRef(0);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const permissions = useProjectPermission();
  const currentMemberId = useCurrentMemberId();
  const authUser = useAuthStore((s) => s.user);
  const isInPopup = window.location.pathname.startsWith('/popup/');
  const templates = listTaskTemplates();
  const customTemplates = loadCustomTemplates();
  const selectedTemplate = getTaskTemplate(selectedTemplateId) ?? templates[0];

  const commentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of commentCounts) {
      map.set(c.taskId, (map.get(c.taskId) || 0) + 1);
    }
    return map;
  }, [commentCounts]);

  useEffect(() => {
    if (projectId) loadComments(projectId);
  }, [projectId, loadComments]);

  // Auto-generate recurring tasks on WBS entry
  useRecurringTasks(projectId, (count) => {
    showFeedback({
      tone: 'success',
      title: '반복 작업 자동 생성',
      message: `반복 작업 ${count}건이 자동 생성되었습니다.`,
    });
  });

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

    // 상단 25% = before, 하단 25% = after, 중간 50% = child (하위 레벨이 3 미만일 때)
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
      try {
        const { project } = await syncProjectWorkspace(currentProject, data, { skipNormalize: true });
        updateProject(project.id, project);
      } catch (error) {
        console.error('WBS auto-save failed:', error);
        throw error;
      }
    },
    [currentProject, projectId, updateProject]
  );
  const { saveStatus, lastSavedAt, saveNow } = useAutoSave(tasks, saveTasks, {
    projectId,
    loadedProjectId,
  });

  const handleManualSave = () => {
    requestAnimationFrame(() => {
      void saveNow(useTaskStore.getState().tasks);
    });
  };

  // 셀이 실제로 수정되었는지 추적 (중복 히스토리 엔트리 방지)
  const cellDirtyRef = useRef(false);

  // 셀 값 변경 (텍스트 입력 중에는 히스토리 기록 안 함, blur 시 기록)
  const handleCellChange = (taskId: string, field: keyof Task, value: unknown, recordHistory = false) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task && !canEditSpecificTask(permissions, task, currentMemberId)) return;
    const hasChildren = task ? tasks.some((t) => t.parentId === taskId) : false;

    if (!recordHistory) cellDirtyRef.current = true;

    // leaf task의 동기화 대상 필드가 변경되면 연관 필드를 자동 동기화
    if (task && !hasChildren && isSyncableField(field)) {
      const { updates, changed } = syncTaskField(
        { ...task, [field]: value },
        field as 'status' | 'actualProgress' | 'actualStart' | 'actualEnd' | 'planProgress',
        value
      );
      if (changed) {
        updateTask(taskId, { [field]: value, ...updates, updatedAt: new Date().toISOString() }, { recordHistory });
        return;
      }
    }

    updateTask(taskId, { [field]: value, updatedAt: new Date().toISOString() }, { recordHistory });
  };

  // 셀 편집 완료 시 히스토리 기록 (실제 변경이 있을 때만)
  const handleCellCommit = () => {
    if (cellDirtyRef.current) {
      const { tasks: currentTasks } = useTaskStore.getState();
      useTaskStore.getState().setTasks(currentTasks, undefined, { recordHistory: true });
      cellDirtyRef.current = false;
    }
    setEditingCell(null);
  };

  // 셀 내비게이션에 사용할 컬럼 순서
  const navigableColumns = ['name', 'output', 'weight', 'planStart', 'planEnd', 'planProgress', 'actualStart', 'actualEnd', 'actualProgress'];

  // 키보드 단축키 (Ctrl+Z/Y/S + Tab/Enter/Arrow 내비게이션)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            // 셀 편집 중이면 먼저 커밋 후 undo (편집 내용 손실 방지)
            if (useTaskStore.getState().editingCell) {
              handleCellCommit();
            }
            undo();
            break;
          case 'y':
            e.preventDefault();
            if (useTaskStore.getState().editingCell) {
              handleCellCommit();
            }
            redo();
            break;
          case 's':
            e.preventDefault();
            handleManualSave();
            break;
          case 'ArrowUp': {
            e.preventDefault();
            const taskId = editingCell?.taskId || useTaskStore.getState().selectedTaskId;
            const task = taskId ? tasks.find((t) => t.id === taskId) : null;
            if (task) handleMoveUp(task);
            break;
          }
          case 'ArrowDown': {
            e.preventDefault();
            const taskId = editingCell?.taskId || useTaskStore.getState().selectedTaskId;
            const task = taskId ? tasks.find((t) => t.id === taskId) : null;
            if (task) handleMoveDown(task);
            break;
          }
        }
        return;
      }

      // Tab / Enter / Arrow navigation when editing
      if (!editingCell) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        handleCellCommit();
        const colIdx = navigableColumns.indexOf(editingCell.columnId);
        const taskIdx = flatTasks.findIndex((t) => t.id === editingCell.taskId);
        if (e.shiftKey) {
          // Shift+Tab: previous column or previous row last column
          if (colIdx > 0) {
            setEditingCell({ taskId: editingCell.taskId, columnId: navigableColumns[colIdx - 1] });
          } else if (taskIdx > 0) {
            setEditingCell({ taskId: flatTasks[taskIdx - 1].id, columnId: navigableColumns[navigableColumns.length - 1] });
          }
        } else {
          // Tab: next column or next row first column
          if (colIdx < navigableColumns.length - 1) {
            setEditingCell({ taskId: editingCell.taskId, columnId: navigableColumns[colIdx + 1] });
          } else if (taskIdx < flatTasks.length - 1) {
            setEditingCell({ taskId: flatTasks[taskIdx + 1].id, columnId: navigableColumns[0] });
          }
        }
      } else if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault();
        handleCellCommit();
        const taskIdx = flatTasks.findIndex((t) => t.id === editingCell.taskId);
        if (taskIdx < flatTasks.length - 1) {
          setEditingCell({ taskId: flatTasks[taskIdx + 1].id, columnId: editingCell.columnId });
        }
      } else if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault();
        handleCellCommit();
        const taskIdx = flatTasks.findIndex((t) => t.id === editingCell.taskId);
        if (taskIdx > 0) {
          setEditingCell({ taskId: flatTasks[taskIdx - 1].id, columnId: editingCell.columnId });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCell, flatTasks, redo, saveNow, undo]);

  // 새 작업 추가
  const suggestOutput = (parentId: string | undefined, level: number): string | undefined => {
    if (level < 4) return undefined;
    // Phase 이름 기반으로 산출물 제안
    let phaseParentId = parentId;
    let current = tasks.find((t) => t.id === phaseParentId);
    while (current && current.level > 1) {
      phaseParentId = current.parentId || undefined;
      current = tasks.find((t) => t.id === phaseParentId);
    }
    const phaseName = current?.name || '';
    const outputMap: Record<string, string> = {
      '분석': '분석 보고서',
      '설계': '설계서',
      '개발': '개발 결과물',
      '테스트': '테스트 보고서',
      '적용': '적용 결과 보고서',
      '안정화': '안정화 보고서',
      '기획': '기획서',
      '디자인': '디자인 산출물',
      '구현': '구현 결과물',
      '검증': '검증 보고서',
      '출시': '출시 보고서',
      '착수': '착수 보고서',
      '오픈': '오픈 체크리스트',
      '이관': '이관 결과서',
    };
    for (const [key, value] of Object.entries(outputMap)) {
      if (phaseName.includes(key)) return value;
    }
    return undefined;
  };

  const handleAddTask = (parentId?: string, level: number = 1) => {
    const normalizedParentId = parentId || null;
    const siblings = tasks.filter((t) => (t.parentId || null) === normalizedParentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((t) => t.orderIndex)) : -1;
    const output = suggestOutput(parentId, level);

    // 부모의 현재 실적을 상속 (leaf→parent 전환 + 형제 추가 시 모두 적용)
    const parent = parentId ? tasks.find((t) => t.id === parentId) : null;
    const inheritedProgress = parent ? (parent.actualProgress || 0) : 0;
    const parentWasLeaf = parent && !tasks.some((t) => t.parentId === parentId);
    const inheritedStatus = parentWasLeaf && parent.status !== 'pending' ? parent.status : 'pending';
    const inheritedActualStart = parentWasLeaf ? parent.actualStart : undefined;
    const inheritedActualEnd = parentWasLeaf ? parent.actualEnd : undefined;

    const newTask: Task = {
      id: generateId(),
      projectId: projectId!,
      parentId: parentId || null,
      level,
      orderIndex: maxOrder + 1,
      name: '',
      output,
      weight: 0,
      durationDays: level >= 4 ? 2 : null,
      predecessorIds: [],
      taskSource: 'manual',
      planProgress: 0,
      actualProgress: inheritedProgress,
      status: inheritedStatus,
      actualStart: inheritedActualStart,
      actualEnd: inheritedActualEnd,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExpanded: true,
    };

    addTask(newTask);
    setEditingCell({ taskId: newTask.id, columnId: 'name' });
  };

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  };

  const handleAddTaskAbove = (task: Task) => {
    const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;
    const inheritedProgress = parent ? (parent.actualProgress || 0) : 0;
    const newTask: Task = {
      id: generateId(),
      projectId: projectId!,
      parentId: task.parentId || null,
      level: task.level,
      orderIndex: task.orderIndex,
      name: '',
      weight: 0,
      planProgress: 0,
      actualProgress: inheritedProgress,
      status: 'pending',
      taskSource: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExpanded: true,
    };
    // Shift orderIndex of siblings at and after this position
    const updated = tasks.map((t) =>
      t.parentId === task.parentId && t.orderIndex >= task.orderIndex
        ? { ...t, orderIndex: t.orderIndex + 1 }
        : t
    );
    setTasks(autoCalculateWeights([...updated, newTask]), undefined, { recordHistory: true });
    setEditingCell({ taskId: newTask.id, columnId: 'name' });
  };

  const handleAddTaskBelow = (task: Task) => {
    const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;
    const inheritedProgress = parent ? (parent.actualProgress || 0) : 0;
    const newTask: Task = {
      id: generateId(),
      projectId: projectId!,
      parentId: task.parentId || null,
      level: task.level,
      orderIndex: task.orderIndex + 1,
      name: '',
      weight: 0,
      planProgress: 0,
      actualProgress: inheritedProgress,
      status: 'pending',
      taskSource: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExpanded: true,
    };
    const updated = tasks.map((t) =>
      t.parentId === task.parentId && t.orderIndex > task.orderIndex
        ? { ...t, orderIndex: t.orderIndex + 1 }
        : t
    );
    setTasks(autoCalculateWeights([...updated, newTask]), undefined, { recordHistory: true });
    setEditingCell({ taskId: newTask.id, columnId: 'name' });
  };

  const handleCopyTask = (task: Task) => {
    setCopiedTask(task);
    showFeedback({ tone: 'info', title: t('wbs.copied'), message: t('wbs.copiedMsg', { name: task.name || t('wbs.taskFallback') }) });
  };

  const handlePasteTask = (targetTask: Task) => {
    if (!copiedTask) return;
    const newTask: Task = {
      ...copiedTask,
      id: generateId(),
      parentId: targetTask.parentId || null,
      orderIndex: targetTask.orderIndex + 1,
      level: targetTask.level,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = tasks.map((t) =>
      t.parentId === targetTask.parentId && t.orderIndex > targetTask.orderIndex
        ? { ...t, orderIndex: t.orderIndex + 1 }
        : t
    );
    setTasks(autoCalculateWeights([...updated, newTask]), undefined, { recordHistory: true });
  };

  const handleMoveUp = (task: Task) => {
    const siblings = tasks
      .filter((t) => t.parentId === task.parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = siblings.findIndex((s) => s.id === task.id);
    if (idx <= 0) return;
    const prev = siblings[idx - 1];
    const updated = tasks.map((t) => {
      if (t.id === task.id) return { ...t, orderIndex: prev.orderIndex, updatedAt: new Date().toISOString() };
      if (t.id === prev.id) return { ...t, orderIndex: task.orderIndex, updatedAt: new Date().toISOString() };
      return t;
    });
    setTasks(updated, undefined, { recordHistory: true });
  };

  const handleMoveDown = (task: Task) => {
    const siblings = tasks
      .filter((t) => t.parentId === task.parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = siblings.findIndex((s) => s.id === task.id);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const next = siblings[idx + 1];
    const updated = tasks.map((t) => {
      if (t.id === task.id) return { ...t, orderIndex: next.orderIndex, updatedAt: new Date().toISOString() };
      if (t.id === next.id) return { ...t, orderIndex: task.orderIndex, updatedAt: new Date().toISOString() };
      return t;
    });
    setTasks(updated, undefined, { recordHistory: true });
  };

  const handleIndent = (task: Task) => {
    // Find previous sibling to become new parent
    const siblings = tasks
      .filter((t) => t.parentId === task.parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = siblings.findIndex((s) => s.id === task.id);
    if (idx <= 0 || task.level >= 4) return;
    const newParent = siblings[idx - 1];
    moveTask(task.id, newParent.id, tasks.filter((t) => t.parentId === newParent.id).length);
  };

  const handleOutdent = (task: Task) => {
    if (!task.parentId) return;
    const parent = tasks.find((t) => t.id === task.parentId);
    if (!parent) return;
    const grandParentId = parent.parentId || null;
    const grandSiblings = tasks.filter((t) => t.parentId === grandParentId);
    const parentIdx = grandSiblings.findIndex((s) => s.id === parent.id);
    moveTask(task.id, grandParentId, parentIdx + 1);
  };

  const handleMarkComplete = (task: Task) => {
    handleCellChange(task.id, 'status', 'completed' as TaskStatus, true);
  };

  // 빠른 실적 입력에서 작업 업데이트
  const handleQuickProgressUpdate = (taskId: string, updates: Partial<Task>) => {
    const task = tasks.find((t) => t.id === taskId);
    const hasChildren = task ? tasks.some((t) => t.parentId === taskId) : false;

    // Apply sync logic
    if (task && !hasChildren && updates.actualProgress !== undefined) {
      const { updates: syncUpdates, changed } = syncTaskField(
        { ...task, ...updates },
        'actualProgress',
        updates.actualProgress
      );
      if (changed) {
        updateTask(taskId, { ...updates, ...syncUpdates }, { recordHistory: true });
        return;
      }
    }
    if (task && !hasChildren && updates.status !== undefined) {
      const { updates: syncUpdates, changed } = syncTaskField(
        { ...task, ...updates },
        'status',
        updates.status
      );
      if (changed) {
        updateTask(taskId, { ...updates, ...syncUpdates }, { recordHistory: true });
        return;
      }
    }
    updateTask(taskId, updates, { recordHistory: true });
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
    if (!projectId) return;

    // Handle custom templates
    if (selectedTemplateId.startsWith('custom:')) {
      const customId = selectedTemplateId.replace('custom:', '');
      const ct = customTemplates.find((t) => t.id === customId);
      if (!ct) return;
      const generatedTasks = applyCustomTemplate(customId, projectId);
      setTasks(generatedTasks, undefined, { recordHistory: true });
      setIsTemplateModalOpen(false);
      setDraftPrompt('');
      showFeedback({
        tone: 'success',
        title: 'WBS 초안 생성 완료',
        message: `"${ct.name}" 템플릿으로 ${generatedTasks.length}개 작업을 생성했습니다.`,
      });
      return;
    }

    if (!selectedTemplate) return;

    const generatedTasks = generateTasksFromTemplate({
      templateId: selectedTemplate.id,
      projectId,
      projectStartDate: currentProject?.startDate,
      members,
    });

    setTasks(generatedTasks, undefined, { recordHistory: true });
    setIsTemplateModalOpen(false);
    setDraftPrompt('');
    showFeedback({
      tone: 'success',
      title: t('wbs.draftGenSuccess'),
      message: t('wbs.draftGenSuccessMsg', { name: selectedTemplate.name, count: generatedTasks.length }),
    });
  };

  const handleSmartMatch = () => {
    if (!projectId) return;
    const trimmedPrompt = draftPrompt.trim();
    if (!trimmedPrompt) return;

    const result = generateTasksFromPrompt({
      prompt: trimmedPrompt,
      projectId,
      projectStartDate: currentProject?.startDate,
      members,
    });

    setSelectedTemplateId(result.templateId);
  };

  const handleAIGenerate = async () => {
    if (!projectId || !aiDescription.trim()) return;
    setAiGenerating(true);
    setAiPreviewTasks(null);
    try {
      const result = await generateWbsWithAI({
        projectName: currentProject?.name || t('wbs.project'),
        description: aiDescription.trim(),
        startDate: currentProject?.startDate,
        members,
        projectId,
      });
      setAiPreviewTasks(result.tasks);
    } catch (error) {
      console.error('AI WBS generation failed:', error);
      showFeedback({
        tone: 'error',
        title: t('wbs.aiGenFail'),
        message: error instanceof Error ? error.message : t('wbs.aiGenFailMsg'),
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAIPreviewApply = (selectedTasks: Task[]) => {
    if (selectedTasks.length === 0) return;
    setTasks(selectedTasks, undefined, { recordHistory: true });
    setIsTemplateModalOpen(false);
    setAiPreviewTasks(null);
    setAiDescription('');
    showFeedback({
      tone: 'success',
      title: t('wbs.aiApplySuccess'),
      message: t('wbs.aiApplySuccessMsg', { count: selectedTasks.length }),
    });
  };

  const handleAISuggestProgress = async () => {
    if (!aiConfigured || tasks.length === 0) return;
    setAiSuggestionsLoading(true);
    setShowAiSuggestions(true);
    try {
      const suggestions = await suggestProgressUpdates({
        tasks,
        members,
        baseDate: currentProject?.baseDate || undefined,
      });
      setAiSuggestions(suggestions);
      if (suggestions.length === 0) {
        showFeedback({
          tone: 'info',
          title: t('wbs.aiAnalysisDone'),
          message: t('wbs.aiAnalysisDoneMsg'),
        });
      }
    } catch (error) {
      console.error('AI progress suggestion failed:', error);
      showFeedback({
        tone: 'error',
        title: t('wbs.aiSuggestFail'),
        message: error instanceof Error ? error.message : t('wbs.aiSuggestFailMsg'),
      });
    } finally {
      setAiSuggestionsLoading(false);
    }
  };

  const handleAcceptSuggestion = (suggestion: ProgressSuggestion) => {
    handleQuickProgressUpdate(suggestion.taskId, {
      actualProgress: suggestion.suggestedProgress,
      status: suggestion.suggestedStatus,
      updatedAt: new Date().toISOString(),
    });
    setAiSuggestions((prev) => prev.filter((s) => s.taskId !== suggestion.taskId));
  };

  const handleAcceptAllSuggestions = (suggestions: ProgressSuggestion[]) => {
    for (const suggestion of suggestions) {
      handleQuickProgressUpdate(suggestion.taskId, {
        actualProgress: suggestion.suggestedProgress,
        status: suggestion.suggestedStatus,
        updatedAt: new Date().toISOString(),
      });
    }
    setAiSuggestions([]);
    showFeedback({
      tone: 'success',
      title: t('wbs.aiSuggestApply'),
      message: t('wbs.aiSuggestApplyMsg', { count: suggestions.length }),
    });
  };

  const handleDismissSuggestion = (taskId: string) => {
    setAiSuggestions((prev) => prev.filter((s) => s.taskId !== taskId));
  };

  const handleAutoSchedule = () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: t('wbs.noTasksSchedule'),
        message: t('wbs.noTasksScheduleMsg'),
      });
      return;
    }

    const scheduledTasks = autoScheduleTasks(tasks, currentProject?.startDate);
    setTasks(scheduledTasks, undefined, { recordHistory: true });
    showFeedback({
      tone: 'success',
      title: t('wbs.scheduleSuccess'),
      message: t('wbs.scheduleSuccessMsg'),
    });
  };

  const handleBuildDependencies = () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: t('wbs.noTasksLink'),
        message: t('wbs.noTasksLinkMsg'),
      });
      return;
    }

    const dependencyTasks = buildSequentialDependencies(tasks);
    setTasks(dependencyTasks, undefined, { recordHistory: true });
    showFeedback({
      tone: 'success',
      title: t('wbs.linkSuccess'),
      message: t('wbs.linkSuccessMsg'),
    });
  };

  const handleAutoFill = () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: t('wbs.noTasksAutoFill'),
        message: t('wbs.noTasksAutoFillMsg'),
      });
      return;
    }

    const result = autoFillTasks(tasks, members);
    setTasks(result.tasks, undefined, { recordHistory: true });

    const details: string[] = [];
    if (result.outputsFilled > 0) details.push(t('wbs.autoFillOutputs', { count: result.outputsFilled }));
    if (result.assigneesFilled > 0) details.push(t('wbs.autoFillAssignees', { count: result.assigneesFilled }));
    if (result.weightsCalculated) details.push(t('wbs.autoFillWeights'));

    showFeedback({
      tone: 'success',
      title: t('wbs.autoFillSuccess'),
      message: details.length > 0 ? details.join(', ') : t('wbs.autoFillNoChange'),
    });
  };

  const handleExportExcel = async () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: t('wbs.noTasksExport'),
        message: t('wbs.noTasksExportMsg'),
      });
      return;
    }

    try {
      await exportWbsWorkbook({
        projectName: currentProject?.name,
        tasks,
        members,
      });
    } catch (error) {
      console.error('WBS export failed:', error);
      showFeedback({
        tone: 'error',
        title: t('wbs.exportFail'),
        message: error instanceof Error ? error.message : t('wbs.exportFailMsg'),
      });
    }
  };

  // 셀 렌더링
  const renderCell = (task: Task, columnId: string) => {
    const taskEditable = canEditSpecificTask(permissions, task, currentMemberId);
    const isEditing = taskEditable && editingCell?.taskId === task.id && editingCell?.columnId === columnId;

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

      case 'name': {
        const commitName = () => {
          if (!task.name.trim()) {
            // 빈 작업명이면 이전 값으로 복원
            const fallback = editingNameBackup || t('wbs.newTask');
            handleCellChange(task.id, 'name', fallback);
          }
          setEditingNameBackup(null);
          handleCellCommit();
        };
        return isEditing ? (
          <input
            type="text"
            value={task.name}
            onChange={(e) => handleCellChange(task.id, 'name', e.target.value)}
            onBlur={() => commitName()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                if (editingNameBackup !== null) {
                  handleCellChange(task.id, 'name', editingNameBackup);
                }
                setEditingNameBackup(null);
                handleCellCommit();
              }
            }}
            className="cell-input"
            autoFocus
          />
        ) : (
          <span
            className={cn('truncate font-medium text-[color:var(--text-primary)]', taskEditable && 'cursor-text')}
            onClick={() => {
              if (!taskEditable) return;
              setEditingNameBackup(task.name);
              setEditingCell({ taskId: task.id, columnId });
            }}
            style={{ paddingLeft: `${(task.depth || 0) * 20}px` }}
            title={task.name || undefined}
          >
            {task.name || <span className="text-[color:var(--accent-danger)] opacity-70">{t('wbs.enterTaskName')}</span>}
            {task.taskSource === 'ai_generated' && (
              <span title={t('wbs.aiGenerated')}><Sparkles className="ml-1 inline h-3 w-3 shrink-0 text-violet-400" /></span>
            )}
          </span>
        );
      }

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
            className={cn('truncate text-[color:var(--text-secondary)]', taskEditable && 'cursor-text')}
            onClick={() => { if (taskEditable) setEditingCell({ taskId: task.id, columnId }); }}
            title={task.output || undefined}
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

      case 'weight': {
        const commitWeight = () => {
          if (task.weight === 0) {
            showFeedback({
              tone: 'warning',
              title: t('wbs.weightZero'),
              message: t('wbs.weightZeroMsg'),
            });
          }
          handleCellCommit();
        };
        return isEditing ? (
          <input
            type="text"
            inputMode="numeric"
            defaultValue={Math.round(task.weight)}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              const num = Math.max(0, parseInt(raw) || 0);
              e.target.value = raw === '' ? '' : String(num);
              if (raw !== '') {
                handleCellChange(task.id, 'weight', num);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') commitWeight();
              if (e.key === '.' || e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault();
            }}
            onBlur={() => commitWeight()}
            className="cell-input text-right"
            autoFocus
            onFocus={(e) => e.target.select()}
          />
        ) : (
          <span
            className={cn('text-right block', taskEditable && 'cursor-text')}
            onClick={() => { if (taskEditable) setEditingCell({ taskId: task.id, columnId }); }}
          >
            {Math.round(task.weight)}
          </span>
        );
      }

      case 'planStart':
      case 'planEnd':
      case 'actualStart':
      case 'actualEnd': {
        const dateValue = task[columnId as keyof Task] as string | null;
        // Date validation: warn if actualStart > actualEnd or planStart > planEnd
        let hasWarning = false;
        if (columnId === 'actualEnd' && task.actualStart && task.actualEnd && task.actualStart > task.actualEnd) {
          hasWarning = true;
        }
        if (columnId === 'actualStart' && task.actualStart && task.actualEnd && task.actualStart > task.actualEnd) {
          hasWarning = true;
        }
        if (columnId === 'planEnd' && task.planStart && task.planEnd && task.planStart > task.planEnd) {
          hasWarning = true;
        }
        if (columnId === 'planStart' && task.planStart && task.planEnd && task.planStart > task.planEnd) {
          hasWarning = true;
        }
        // Warn if actual date is later than planned (delayed)
        const isDelayedDate =
          (columnId === 'actualEnd' && task.planEnd && task.actualEnd && task.actualEnd > task.planEnd) ||
          (columnId === 'actualStart' && task.planStart && task.actualStart && task.actualStart > task.planStart);
        return (
          <div className="relative">
            <input
              type="date"
              value={dateValue || ''}
              onChange={(e) => handleCellChange(task.id, columnId as keyof Task, e.target.value || null, true)}
              disabled={!taskEditable}
              className={cn(
                'cell-input text-sm',
                hasWarning && 'text-[color:var(--accent-danger)] ring-1 ring-[rgba(203,75,95,0.3)]',
                isDelayedDate && !hasWarning && 'text-[color:var(--accent-warning)]'
              )}
              title={hasWarning ? t('wbs.dateStartAfterEnd') : isDelayedDate ? t('wbs.dateDelayed') : undefined}
            />
          </div>
        );
      }

      case 'planProgress': {
        const planValue = task.planProgress as number;
        return (
          <div className="flex items-center gap-1">
            <div className="flex-1 h-2 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
              <div
                className="h-full rounded-full bg-[image:linear-gradient(135deg,#155e75,#1f8f86)]"
                style={{ width: `${planValue}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs text-[color:var(--text-secondary)]">{planValue}%</span>
          </div>
        );
      }

      case 'actualProgress': {
        const actualValue = task.actualProgress as number;
        return isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              defaultValue={actualValue}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                const num = Math.min(100, Math.max(0, parseInt(raw) || 0));
                e.target.value = raw === '' ? '' : String(num);
                if (raw !== '') {
                  handleCellChange(task.id, columnId as keyof Task, num);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') handleCellCommit();
                if (e.key === '.' || e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault();
              }}
              onBlur={() => handleCellCommit()}
              className="cell-input w-full text-right text-xs"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          </div>
        ) : (
          <div
            className={cn('flex items-center gap-1', taskEditable && 'cursor-text')}
            onClick={() => { if (taskEditable) setEditingCell({ taskId: task.id, columnId }); }}
          >
            <div className="flex-1 h-2 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
              <div
                className="h-full rounded-full bg-[image:linear-gradient(135deg,#1fa37a,#34c997)]"
                style={{ width: `${actualValue}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs text-[color:var(--text-secondary)]">{actualValue}%</span>
          </div>
        );
      }

      case 'status':
        return (
          <select
            value={task.status}
            onChange={(e) => handleCellChange(task.id, 'status', e.target.value as TaskStatus, true)}
            disabled={!taskEditable}
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

      case 'predecessors': {
        const predNames = (task.predecessorIds || [])
          .map((id) => tasks.find((t) => t.id === id)?.name)
          .filter(Boolean);
        return (
          <span
            className="truncate text-xs text-[color:var(--text-secondary)]"
            title={predNames.join(', ') || undefined}
          >
            {predNames.length > 0 ? predNames.join(', ') : <span className="text-[color:var(--text-muted)]">-</span>}
          </span>
        );
      }

      case 'actions': {
        if (!taskEditable && !permissions.canCreateTask) return null;
        const childLabel = task.level === 1 ? 'Activity' : task.level === 2 ? 'Task' : task.level === 3 ? 'Todo' : null;
        return (
          <div className="flex items-center gap-1">
            {permissions.canCreateTask && childLabel && (
              <button
                onClick={() => handleAddTask(task.id, task.level + 1)}
                className="flex h-7 items-center gap-0.5 whitespace-nowrap rounded-full px-2 text-xs text-[color:var(--accent-primary)] transition-colors hover:bg-[rgba(15,118,110,0.08)]"
                title={t('wbs.addChild', { label: childLabel })}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                {childLabel}
              </button>
            )}
            <span className="mx-0.5 h-4 w-px bg-[var(--border-color)]" />
            <button
              onClick={() => setCommentTaskId(task.id)}
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[rgba(15,118,110,0.08)] hover:text-[color:var(--accent-primary)]"
              title="코멘트"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {(commentCountMap.get(task.id) || 0) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] px-0.5 text-[9px] font-bold text-white">
                  {commentCountMap.get(task.id)}
                </span>
              )}
            </button>
            {permissions.canDeleteTask && (
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[rgba(203,75,95,0.08)] hover:text-[color:var(--accent-danger)]"
                title={t('wbs.deleteLabel')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  const getResponsiveWidth = useCallback((basis: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, Math.round(basis)));
  }, []);

  const getWbsLayout = useCallback((fullscreen: boolean) => {
    const workspaceWidth = Math.max(
      fullscreen ? viewportWidth - 120 : viewportWidth - 460,
      fullscreen ? 1280 : 1024
    );

    const columns = [
      { key: 'handle', label: '', width: 72, sticky: true, className: 'text-center' },
      {
        key: 'level',
        label: t('wbs.colLevel'),
        width: getResponsiveWidth(workspaceWidth * 0.06, 100, fullscreen ? 132 : 112),
        sticky: true,
        className: 'text-center',
      },
      {
        key: 'name',
        label: t('wbs.colName'),
        width: getResponsiveWidth(workspaceWidth * 0.22, 260, fullscreen ? 520 : 420),
        sticky: true,
        className: 'text-center',
      },
      {
        key: 'output',
        label: t('wbs.colOutput'),
        width: getResponsiveWidth(workspaceWidth * 0.12, 140, fullscreen ? 260 : 210),
        sticky: true,
        className: 'text-center',
      },
      {
        key: 'assignee',
        label: t('wbs.colAssignee'),
        width: getResponsiveWidth(workspaceWidth * 0.095, 120, fullscreen ? 190 : 160),
        sticky: true,
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'weight',
        label: t('wbs.colWeight'),
        width: getResponsiveWidth(workspaceWidth * 0.055, 88, fullscreen ? 120 : 104),
        sticky: true,
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'planStart',
        label: t('wbs.colPlanStart'),
        width: getResponsiveWidth(workspaceWidth * 0.095, 150, 200),
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'planEnd',
        label: t('wbs.colPlanEnd'),
        width: getResponsiveWidth(workspaceWidth * 0.095, 150, 200),
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'planProgress',
        label: t('wbs.colPlanProgress'),
        width: getResponsiveWidth(workspaceWidth * 0.078, 108, fullscreen ? 150 : 132),
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'actualStart',
        label: t('wbs.colActualStart'),
        width: getResponsiveWidth(workspaceWidth * 0.095, 150, 200),
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'actualEnd',
        label: t('wbs.colActualEnd'),
        width: getResponsiveWidth(workspaceWidth * 0.095, 150, 200),
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'actualProgress',
        label: t('wbs.colActualProgress'),
        width: getResponsiveWidth(workspaceWidth * 0.078, 108, fullscreen ? 150 : 132),
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'status',
        label: t('wbs.colStatus'),
        width: getResponsiveWidth(workspaceWidth * 0.07, 104, fullscreen ? 150 : 128),
        className: 'text-center whitespace-nowrap',
      },
      {
        key: 'actions',
        label: t('wbs.colActions'),
        width: getResponsiveWidth(workspaceWidth * 0.12, 160, fullscreen ? 220 : 190),
        className: 'text-center',
      },
    ];

    const stickyLefts = columns.reduce<number[]>((acc, _column, index) => {
      const previous = index === 0 ? 0 : acc[index - 1] + columns[index - 1].width;
      acc.push(previous);
      return acc;
    }, []);

    const tableWidth = columns.reduce((total, column) => total + column.width, 0);

    return { columns, stickyLefts, tableWidth };
  }, [getResponsiveWidth, viewportWidth, t]);

  const baseWbsLayout = useMemo(() => getWbsLayout(isInPopup), [getWbsLayout, isInPopup]);

  const renderWbsTable = (layout: ReturnType<typeof getWbsLayout>) => (
    <table className="app-table wbs-fixed-table" style={{ width: layout.tableWidth }}>
      <thead>
        <tr>
          {layout.columns.map((column, index) => (
            <th
              key={column.key}
              className={cn(column.className, column.sticky && `sticky-col sticky-col-${index}`)}
              style={{
                width: column.width,
                minWidth: column.width,
                ...(column.sticky ? { left: layout.stickyLefts[index] } : {}),
              }}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {flatTasks.map((task, idx) => {
          const nextTask = flatTasks[idx + 1];
          const isLastChildOfPhase = task.level >= 2 && (!nextTask || nextTask.level <= 1);
          const isLastChildOfActivity = task.level >= 3 && (!nextTask || nextTask.level <= 2);
          const isLastChildOfTask = task.level >= 4 && (!nextTask || nextTask.level <= 3);
          const addLabel = isLastChildOfTask ? 'Todo' : isLastChildOfActivity ? 'Task' : isLastChildOfPhase ? 'Activity' : null;
          const addParentId = isLastChildOfTask
            ? task.parentId || undefined
            : isLastChildOfActivity
              ? task.parentId || undefined
              : isLastChildOfPhase
                ? tasks.find((t) => t.id === task.parentId)?.parentId || undefined
                : undefined;
          const addLevel = isLastChildOfTask ? 4 : isLastChildOfActivity ? 3 : isLastChildOfPhase ? 2 : 0;

          return (
            <React.Fragment key={task.id}>
              <tr
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
                onClick={() => useTaskStore.getState().selectTask(task.id)}
                onContextMenu={(e) => handleContextMenu(e, task)}
                className={cn(
                  task.level === 1 && 'wbs-level-1 bg-[color:var(--bg-tertiary)]',
                  dragTaskId === task.id && 'opacity-40',
                  dropTargetId === task.id && dropPosition === 'before' && 'border-t-2 !border-t-[var(--accent-primary)]',
                  dropTargetId === task.id && dropPosition === 'after' && 'border-b-2 !border-b-[var(--accent-primary)]',
                  dropTargetId === task.id && dropPosition === 'child' && 'bg-[rgba(15,118,110,0.08)]',
                )}
              >
                {layout.columns.map((column, index) => {
                  const cellClassName = cn(
                    column.key !== 'actions' && 'border-r border-[var(--border-color)]',
                    column.sticky && `sticky-col sticky-col-${index}`,
                  );
                  const stickyStyle = column.sticky ? { left: layout.stickyLefts[index] } : undefined;

                  if (column.key === 'handle') {
                    return (
                      <td key={column.key} className={cellClassName} style={stickyStyle}>
                        <div className="flex items-center">
                          <span className="mr-0.5 cursor-grab text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] active:cursor-grabbing">
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                          {renderCell(task, 'expand')}
                        </div>
                      </td>
                    );
                  }

                  if (column.key === 'name') {
                    return (
                      <td key={column.key} className={cn(cellClassName, !task.name && 'bg-[rgba(220,38,38,0.04)]')} style={stickyStyle}>
                        <div className="flex items-center">{renderCell(task, column.key)}</div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={column.key}
                      className={cn(cellClassName, column.key === 'actions' && 'overflow-visible')}
                      style={stickyStyle}
                    >
                      {renderCell(task, column.key)}
                    </td>
                  );
                })}
              </tr>
              {addLabel && (
                <tr className="group/add">
                  <td colSpan={layout.columns.length} className="!p-0">
                    <button
                      onClick={() => handleAddTask(addParentId, addLevel)}
                      className="flex w-full items-center gap-1.5 py-1 text-xs text-[color:var(--text-muted)] opacity-0 transition-opacity group-hover/add:opacity-100 hover:text-[color:var(--accent-primary)]"
                      style={{ paddingLeft: `${addLevel * 24 + 12}px` }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t('wbs.addInline', { label: addLabel })}
                    </button>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

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

      <section className="app-panel relative overflow-hidden px-5 py-4">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-80" style={{ backgroundColor: projectTone?.accent || 'var(--accent-primary)' }} />

        {/* Row 1: Title + Save/Status */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]" title={`${currentProject?.name || t('wbs.project')} WBS`}>
              {currentProject?.name || t('wbs.project')} WBS
            </h1>
            {projectTone && (
              <div className="hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] sm:inline-flex" style={{ borderColor: `${projectTone.accent}22`, backgroundColor: `${projectTone.accent}10`, color: projectTone.accent }}>
                {ToneIcon ? <ToneIcon className="h-3 w-3" /> : null}
                {projectTone.label}
              </div>
            )}
            <div className="surface-badge shrink-0 !py-1 !px-2.5 !text-[11px]">
              {t('wbs.taskCount', { count: tasks.length })}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={!currentProject || saveStatus === 'saving'}
              data-testid="wbs-save-button"
            >
              {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { handleCellCommit(); undo(); }} disabled={historyIndex <= 0}>
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { handleCellCommit(); redo(); }} disabled={historyIndex >= history.length - 1}>
              <Redo2 className="w-4 h-4" />
            </Button>
            <div className={cn(
              'surface-badge shrink-0 !py-1 !px-2.5 !text-[11px]',
              saveStatus === 'error' && 'border-[rgba(203,75,95,0.22)] text-[color:var(--accent-danger)]'
            )}>
              {saveStatus === 'pending' && t('wbs.savePending')}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('wbs.saving')}
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-[color:var(--accent-success)]" />
                  {formatSaveStatus(lastSavedAt, t)}
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle className="h-3 w-3" />
                  {t('wbs.error')}
                </>
              )}
              {saveStatus === 'idle' && t('wbs.ready')}
              </div>
            </div>
          </div>

        {/* Row 2: Action buttons — single compact row */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {/* Primary actions */}
          <Button onClick={() => handleAddTask(undefined, 1)} size="sm">
            <Plus className="w-3.5 h-3.5" />
            Phase
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const phases = tasks.filter((t) => t.level === 1);
              if (phases.length === 0) return;
              const lastPhase = phases.reduce((a, b) => (a.orderIndex > b.orderIndex ? a : b));
              handleAddTask(lastPhase.id, 2);
            }}
            disabled={tasks.filter((t) => t.level === 1).length === 0}
          >
            <Plus className="w-3.5 h-3.5" />
            Activity
          </Button>

          <div className="mx-1 h-5 w-px bg-[var(--border-color)]" />

          {/* Generation & scheduling */}
          <Button variant="outline" size="sm" onClick={() => { setTemplateTab(inputMode === 'ai' && aiConfigured ? 'ai' : 'template'); setIsTemplateModalOpen(true); }}>
            <Sparkles className="w-3.5 h-3.5" />
            {t('wbs.draftGen')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleAutoSchedule} disabled={tasks.length === 0}>
            {t('wbs.scheduleCalc')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleBuildDependencies} disabled={tasks.length === 0}>
            {t('wbs.dependencies')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={tasks.length === 0}>
            <Wand2 className="w-3.5 h-3.5" />
            {t('wbs.autoFill')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsRecurringModalOpen(true)}>
            <RefreshCw className="w-3.5 h-3.5" />
            반복 작업
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsSaveTemplateModalOpen(true)} disabled={tasks.length === 0}>
            <BookmarkPlus className="w-3.5 h-3.5" />
            템플릿 저장
          </Button>

          <div className="mx-1 h-5 w-px bg-[var(--border-color)]" />

          {/* Progress & reports */}
          <Button variant="outline" size="sm" onClick={() => setIsQuickProgressOpen(true)} disabled={tasks.length === 0}>
            <ClipboardList className="w-3.5 h-3.5" />
            {t('wbs.progressInput')}
          </Button>
          {inputMode === 'ai' && aiConfigured && (
            <Button variant="outline" size="sm" onClick={() => void handleAISuggestProgress()} disabled={tasks.length === 0 || aiSuggestionsLoading}>
              {aiSuggestionsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              {t('wbs.aiSuggest')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setIsWeeklyReportOpen(true)} disabled={tasks.length === 0}>
            <FileText className="w-3.5 h-3.5" />
            {t('wbs.weeklyReport')}
          </Button>

          <div className="mx-1 h-5 w-px bg-[var(--border-color)]" />

          {/* View & export */}
          <Button variant="ghost" size="sm" onClick={expandAll}>
            <ExpandIcon className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            <ShrinkIcon className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={tasks.length === 0}>
            <Download className="w-3.5 h-3.5" />
            {t('wbs.excel')}
          </Button>
        </div>
      </section>

      {showAiSuggestions && (
        <AISuggestionPanel
          suggestions={aiSuggestions}
          isLoading={aiSuggestionsLoading}
          onAccept={handleAcceptSuggestion}
          onAcceptAll={handleAcceptAllSuggestions}
          onDismiss={handleDismissSuggestion}
          onRefresh={() => void handleAISuggestProgress()}
          onClose={() => { setShowAiSuggestions(false); setAiSuggestions([]); }}
        />
      )}

      <div className="app-panel relative flex-1 overflow-hidden">
        {!isInPopup && projectId && (
          <button
            onClick={() => openPopup({ projectId, page: 'wbs' })}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
            title={t('wbs.openNewWindow')}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
        <div ref={tableScrollRef} className="h-full overflow-auto scrollbar-visible">
          {renderWbsTable(baseWbsLayout)}

          {flatTasks.length === 0 && (
            <div className="empty-state px-6 py-12">
              <p>{t('wbs.noTasks')}</p>
              <Button onClick={() => handleAddTask(undefined, 1)}>
                <Plus className="w-4 h-4" />
                {t('wbs.addFirstPhase')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => { setIsTemplateModalOpen(false); setAiPreviewTasks(null); }}
        title={t('wbs.draftGenTitle')}
        size="xl"
      >
        <div className="p-6 space-y-5">
          {/* 탭 헤더 */}
          <div className="flex items-center gap-1 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-1">
            <button
              type="button"
              onClick={() => { setTemplateTab('template'); setAiPreviewTasks(null); }}
              className={cn(
                'flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all',
                templateTab === 'template'
                  ? 'bg-[image:var(--gradient-primary)] text-white shadow-md'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              )}
            >
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
              {t('wbs.templateBased')}
            </button>
            <button
              type="button"
              onClick={() => setTemplateTab('ai')}
              disabled={!aiConfigured}
              className={cn(
                'flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all',
                templateTab === 'ai'
                  ? 'bg-[linear-gradient(135deg,#7c3aed,#a78bfa)] text-white shadow-md'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]',
                !aiConfigured && 'cursor-not-allowed opacity-40'
              )}
              title={!aiConfigured ? t('wbs.aiKeyRequired') : undefined}
            >
              <Bot className="mr-1.5 inline h-3.5 w-3.5" />
              {t('wbs.aiGen')}
            </button>
          </div>

          {templateTab === 'template' ? (
            <>
              {/* 키워드 자동 매칭 입력 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftPrompt}
                  onChange={(event) => setDraftPrompt(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') handleSmartMatch(); }}
                  placeholder={t('wbs.smartMatchPlaceholder')}
                  className="flex-1 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] px-4 py-2.5 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-[rgba(15,118,110,0.34)]"
                />
                <Button size="sm" onClick={handleSmartMatch} disabled={!draftPrompt.trim()}>
                  {t('wbs.smartMatchBtn')}
                </Button>
              </div>

              {/* 템플릿 카드 목록 */}
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((template) => {
                  const isSelected = template.id === selectedTemplate?.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={cn(
                        'rounded-[22px] border p-4 text-left transition-all',
                        isSelected
                          ? 'border-[rgba(15,118,110,0.4)] bg-[rgba(15,118,110,0.08)] shadow-[0_20px_40px_-28px_rgba(15,118,110,0.5)]'
                          : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] hover:border-[rgba(15,118,110,0.2)] hover:bg-[color:var(--bg-secondary-solid)]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-base font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                          {template.name}
                        </p>
                        {isSelected && (
                          <span className="shrink-0 rounded-full bg-[rgba(15,118,110,0.14)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--accent-primary)]">
                            {t('wbs.selected')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-[color:var(--text-secondary)]">
                        {template.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-[color:var(--text-secondary)]">
                        <span className="surface-badge">{template.audience}</span>
                        <span className="surface-badge">{t('wbs.phaseCount', { count: template.phases })}</span>
                        <span className="surface-badge">{t('wbs.taskCountBadge', { count: template.taskCount })}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 내 템플릿 */}
              {customTemplates.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">내 템플릿</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {customTemplates.map((ct) => {
                      const isSelected = selectedTemplateId === `custom:${ct.id}`;
                      return (
                        <button
                          key={ct.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(`custom:${ct.id}`)}
                          className={cn(
                            'rounded-[22px] border p-4 text-left transition-all',
                            isSelected
                              ? 'border-[rgba(15,118,110,0.4)] bg-[rgba(15,118,110,0.08)] shadow-[0_20px_40px_-28px_rgba(15,118,110,0.5)]'
                              : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] hover:border-[rgba(15,118,110,0.2)] hover:bg-[color:var(--bg-secondary-solid)]'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-base font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                              {ct.name}
                            </p>
                            {isSelected && (
                              <span className="shrink-0 rounded-full bg-[rgba(15,118,110,0.14)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--accent-primary)]">
                                선택됨
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-[color:var(--text-secondary)]">
                            <span className="surface-badge">내 템플릿</span>
                            <span className="surface-badge">{ct.phases}개 Phase</span>
                            <span className="surface-badge">{ct.taskCount}건</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* 선택된 템플릿 요약 + 적용 */}
              {(selectedTemplate || selectedTemplateId.startsWith('custom:')) && (
                <div className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                        {selectedTemplateId.startsWith('custom:')
                          ? customTemplates.find((ct) => ct.id === selectedTemplateId.replace('custom:', ''))?.name ?? '커스텀 템플릿'
                          : selectedTemplate?.name}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[color:var(--text-secondary)]">
                        <span>{t('wbs.target')}: <span className="font-medium text-[color:var(--text-primary)]">{currentProject?.name || t('wbs.currentProject')}</span></span>
                        <span>{t('wbs.startDate')}: <span className="font-medium text-[color:var(--text-primary)]">{currentProject?.startDate || t('wbs.notSet')}</span></span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[color:var(--accent-warning)]">
                        {t('wbs.replaceWarning')}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="ghost" onClick={() => setIsTemplateModalOpen(false)}>
                        {t('wbs.cancel')}
                      </Button>
                      <Button onClick={handleApplyTemplate}>
                        <Sparkles className="w-4 h-4" />
                        {t('wbs.generate')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* AI 생성 탭 */}
              {!aiPreviewTasks ? (
                <div className="space-y-4">
                  <div>
                    <label className="field-label">{t('wbs.projectDesc')}</label>
                    <textarea
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder={t('wbs.projectDescPlaceholder')}
                      className="field-textarea mt-2"
                      rows={5}
                    />
                    {currentProject?.description && !aiDescription && (
                      <button
                        type="button"
                        onClick={() => setAiDescription(currentProject.description || '')}
                        className="mt-2 text-xs text-[color:var(--accent-primary)] hover:underline"
                      >
                        {t('wbs.loadProjectDesc')}
                      </button>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[color:var(--text-secondary)]">
                      <span>{t('wbs.target')}: <span className="font-medium text-[color:var(--text-primary)]">{currentProject?.name || t('wbs.currentProject')}</span></span>
                      <span>{t('wbs.startDate')}: <span className="font-medium text-[color:var(--text-primary)]">{currentProject?.startDate || t('wbs.notSet')}</span></span>
                      <span>{t('wbs.memberCount')}: <span className="font-medium text-[color:var(--text-primary)]">{t('wbs.membersUnit', { count: members.length })}</span></span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--accent-warning)]">
                      {t('wbs.aiPreviewNote')}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIsTemplateModalOpen(false)}>
                      {t('wbs.cancel')}
                    </Button>
                    <Button
                      onClick={() => void handleAIGenerate()}
                      disabled={!aiDescription.trim() || aiGenerating}
                    >
                      {aiGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('wbs.aiGenInProgress')}
                        </>
                      ) : (
                        <>
                          <Bot className="h-4 w-4" />
                          {t('wbs.aiGenWbs')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <AIReviewPanel
                  tasks={aiPreviewTasks}
                  onApply={handleAIPreviewApply}
                  onCancel={() => setAiPreviewTasks(null)}
                />
              )}
            </>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteTask)}
        onClose={() => setPendingDeleteTask(null)}
        onConfirm={() => {
          if (!pendingDeleteTask) return;
          deleteTask(pendingDeleteTask.id);
          if (authUser && projectId) {
            void logAuditEvent({
              projectId,
              userId: authUser.id,
              userName: authUser.name,
              action: 'task.delete',
              details: t('wbs.auditDeleteTask', { name: pendingDeleteTask.name || t('wbs.noName') }),
            });
          }
          showFeedback({
            tone: 'warning',
            title: t('wbs.deleteTaskDone'),
            message: t('wbs.deleteTaskDoneMsg', { name: pendingDeleteTask.name || t('wbs.unnamedTask') }),
          });
          setPendingDeleteTask(null);
        }}
        title={t('wbs.deleteTaskTitle')}
        description={
          pendingDeleteTask
            ? t('wbs.deleteTaskDesc', { name: pendingDeleteTask.name || t('wbs.unnamedTask') })
            : ''
        }
        confirmLabel={t('wbs.deleteTaskConfirm')}
        confirmVariant="danger"
      />

      {projectId && (
        <WeeklyReportModal
          isOpen={isWeeklyReportOpen}
          onClose={() => setIsWeeklyReportOpen(false)}
          projectId={projectId}
          projectName={currentProject?.name || t('wbs.project')}
          tasks={tasks}
          members={members}
          attendances={attendancesForReport}
        />
      )}

      <QuickProgressModal
        isOpen={isQuickProgressOpen}
        onClose={() => setIsQuickProgressOpen(false)}
        tasks={tasks}
        members={members}
        onUpdateTask={handleQuickProgressUpdate}
      />

      {commentTaskId && projectId && (
        <TaskCommentPanel
          taskId={commentTaskId}
          projectId={projectId}
          isOpen={!!commentTaskId}
          onClose={() => setCommentTaskId(null)}
        />
      )}

      {projectId && (
        <RecurringTaskModal
          isOpen={isRecurringModalOpen}
          onClose={() => setIsRecurringModalOpen(false)}
          projectId={projectId}
          members={members}
          onTasksGenerated={(count) => {
            showFeedback({
              tone: 'success',
              title: '반복 작업 생성',
              message: `반복 작업 ${count}건이 생성되었습니다.`,
            });
          }}
        />
      )}

      <SaveTemplateModal
        isOpen={isSaveTemplateModalOpen}
        onClose={() => setIsSaveTemplateModalOpen(false)}
        tasks={tasks}
        onSaved={(templateName) => {
          showFeedback({
            tone: 'success',
            title: '템플릿 저장 완료',
            message: `"${templateName}" 템플릿이 저장되었습니다.`,
          });
        }}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={contextMenu.task}
          onClose={() => setContextMenu(null)}
          onAddAbove={() => handleAddTaskAbove(contextMenu.task)}
          onAddBelow={() => handleAddTaskBelow(contextMenu.task)}
          onAddChild={() => handleAddTask(contextMenu.task.id, contextMenu.task.level + 1)}
          onDelete={() => handleDeleteTask(contextMenu.task.id)}
          onCopy={() => handleCopyTask(contextMenu.task)}
          onPaste={() => handlePasteTask(contextMenu.task)}
          onIndent={() => handleIndent(contextMenu.task)}
          onOutdent={() => handleOutdent(contextMenu.task)}
          onMoveUp={() => handleMoveUp(contextMenu.task)}
          onMoveDown={() => handleMoveDown(contextMenu.task)}
          onMarkComplete={() => handleMarkComplete(contextMenu.task)}
          canPaste={copiedTask !== null}
          canIndent={(() => {
            const siblings = tasks
              .filter((t) => t.parentId === contextMenu.task.parentId)
              .sort((a, b) => a.orderIndex - b.orderIndex);
            const idx = siblings.findIndex((s) => s.id === contextMenu.task.id);
            return idx > 0 && contextMenu.task.level < 4;
          })()}
          canOutdent={!!contextMenu.task.parentId}
          canMoveUp={(() => {
            const siblings = tasks
              .filter((t) => t.parentId === contextMenu.task.parentId)
              .sort((a, b) => a.orderIndex - b.orderIndex);
            return siblings.findIndex((s) => s.id === contextMenu.task.id) > 0;
          })()}
          canMoveDown={(() => {
            const siblings = tasks
              .filter((t) => t.parentId === contextMenu.task.parentId)
              .sort((a, b) => a.orderIndex - b.orderIndex);
            const idx = siblings.findIndex((s) => s.id === contextMenu.task.id);
            return idx >= 0 && idx < siblings.length - 1;
          })()}
        />
      )}
    </div>
  );
}

function formatSaveStatus(lastSavedAt: string | null, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (!lastSavedAt) return t('wbs.saved');
  return t('wbs.savedAt', {
    time: new Date(lastSavedAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
  });
}
