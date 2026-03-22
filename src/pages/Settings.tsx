import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  Sparkles,
  CalendarDays,
  Clock3,
  Play,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { cn } from '../lib/utils';
import { deleteProjectById, upsertProject } from '../lib/dataRepository';
import { exportWbsWorkbook, generateWbsTemplate, parseTasksFromWorkbook } from '../lib/excel';
import { syncProjectWorkspace } from '../lib/projectTaskSync';
import { useProjectStatus } from '../hooks/useProjectStatus';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { useProjectPermission } from '../hooks/useProjectPermission';
import AuditLogPanel from '../components/common/AuditLogPanel';
import { logAuditEvent } from '../lib/auditLog';
import type { ProjectStatus, Task } from '../types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../types';

export default function Settings() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, members, updateProject, deleteProject } = useProjectStore();
  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;
  const { user, isAdmin } = useAuthStore();
  const { changeStatus } = useProjectStatus();
  const { tasks, setTasks } = useTaskStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportReplaceModal, setShowImportReplaceModal] = useState(false);
  const [pendingImportTasks, setPendingImportTasks] = useState<Task[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusModeSaving, setIsStatusModeSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const { canEditProject, canDeleteProject, isReadOnly } = useProjectPermission();

  const [formData, setFormData] = useState<{
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    baseDate?: string;
  }>({});

  const resolvedFormData = {
    name: formData.name ?? currentProject?.name ?? '',
    description: formData.description ?? currentProject?.description ?? '',
    startDate: formData.startDate ?? currentProject?.startDate ?? '',
    endDate: formData.endDate ?? currentProject?.endDate ?? '',
    baseDate: formData.baseDate ?? currentProject?.baseDate ?? '',
  };
  const statusMode = currentProject?.settings?.statusMode ?? 'auto';
  const isManualStatus = statusMode === 'manual';

  // 실시간 유효성 검사
  const nameError = (() => {
    const trimmed = resolvedFormData.name.trim();
    if (!trimmed) return '프로젝트명을 입력해주세요.';
    if (trimmed.length < 2) return '프로젝트명은 2자 이상이어야 합니다.';
    if (!/[a-zA-Z0-9가-힣]/.test(trimmed)) return '프로젝트명에는 한글, 영문 또는 숫자가 포함되어야 합니다.';
    return null;
  })();

  const dateError = (() => {
    if (resolvedFormData.startDate && resolvedFormData.endDate &&
        new Date(resolvedFormData.startDate) >= new Date(resolvedFormData.endDate)) {
      return '종료일은 시작일보다 이후여야 합니다.';
    }
    return null;
  })();

  const handleSave = async () => {
    if (!projectId || !currentProject) return;

    if (nameError) {
      showFeedback({ tone: 'error', title: '프로젝트명 오류', message: nameError });
      return;
    }
    if (dateError) {
      showFeedback({ tone: 'error', title: '날짜 오류', message: dateError });
      return;
    }

    setIsSaving(true);
    try {
      const savedProject = await upsertProject({
        ...currentProject,
        id: projectId,
        ownerId: currentProject.ownerId,
        ...resolvedFormData,
        name: resolvedFormData.name.trim(),
        updatedAt: new Date().toISOString(),
      });

      updateProject(projectId, savedProject);
      if (user) {
        void logAuditEvent({
          projectId,
          userId: user.id,
          userName: user.name,
          action: 'project.settings_change',
          details: '프로젝트 기본 정보 변경',
        });
      }
      showFeedback({
        tone: 'success',
        title: '설정 저장 완료',
        message: '프로젝트 기본 정보와 기준일을 저장했습니다.',
      });
    } catch (error) {
      console.error('Failed to save project settings:', error);
      showFeedback({
        tone: 'error',
        title: '설정 저장 실패',
        message: '프로젝트 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    setIsDeleting(true);
    try {
      await deleteProjectById(projectId);
      deleteProject(projectId);
      navigate('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
      showFeedback({
        tone: 'error',
        title: '프로젝트 삭제 실패',
        message: error instanceof Error ? error.message : '프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleChangeStatus = async (newStatus: ProjectStatus) => {
    if (!currentProject) return;
    // 단계 건너뛰기 시 확인 모달 표시
    const currentStatus = currentProject.status;
    const order: ProjectStatus[] = ['preparing', 'active', 'completed'];
    const currentIdx = order.indexOf(currentStatus ?? 'preparing');
    const newIdx = order.indexOf(newStatus);
    if (Math.abs(newIdx - currentIdx) > 1) {
      setPendingStatus(newStatus);
      return;
    }
    await executeStatusChange(newStatus);
  };

  const executeStatusChange = async (newStatus: ProjectStatus) => {
    if (!currentProject) return;
    setPendingStatus(null);
    try {
      await changeStatus(currentProject, newStatus);
      showFeedback({
        tone: 'success',
        title: '프로젝트 상태 변경',
        message: `프로젝트 상태를 "${PROJECT_STATUS_LABELS[newStatus]}"로 고정했습니다.`,
      });
    } catch (error) {
      console.error('Failed to change project status:', error);
      showFeedback({
        tone: 'error',
        title: '상태 변경 실패',
        message: '프로젝트 상태를 변경하지 못했습니다. 다시 시도해주세요.',
      });
    }
  };

  const handleExportExcel = () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: '내보낼 작업 없음',
        message: 'WBS에 작업을 추가한 뒤 다시 내보내기를 시도해주세요.',
      });
      return;
    }

    exportWbsWorkbook({
      projectName: currentProject?.name,
      tasks,
      members,
    });
  };

  const applyImportedTasks = useCallback(
    async (importedTasks: Task[]) => {
      if (!currentProject || !projectId) return;

      try {
        const { project, tasks: normalizedTasks } = await syncProjectWorkspace(currentProject, importedTasks);
        setTasks(normalizedTasks, projectId);
        updateProject(project.id, project);
        showFeedback({
          tone: 'success',
          title: '엑셀 가져오기 완료',
          message: `${normalizedTasks.length}개의 작업을 현재 프로젝트에 반영했습니다.`,
        });
      } catch (error) {
        console.error('Import error:', error);
        showFeedback({
          tone: 'error',
          title: '엑셀 가져오기 실패',
          message: '엑셀 파일을 읽는 중 오류가 발생했습니다.',
        });
      } finally {
        setPendingImportTasks(null);
        setShowImportReplaceModal(false);
      }
    },
    [currentProject, projectId, setTasks, showFeedback, updateProject]
  );

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const importedTasks = parseTasksFromWorkbook(loadEvent.target?.result as ArrayBuffer, projectId!);

        if (tasks.length > 0) {
          setPendingImportTasks(importedTasks);
          setShowImportReplaceModal(true);
          return;
        }

        void applyImportedTasks(importedTasks);
      } catch (error) {
        console.error('Import error:', error);
        showFeedback({
          tone: 'error',
          title: '엑셀 가져오기 실패',
          message: '엑셀 파일을 읽는 중 오류가 발생했습니다.',
        });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleStatusModeChange = async (mode: 'auto' | 'manual') => {
    if (!currentProject || !isAdmin || statusMode === mode) return;

    setIsStatusModeSaving(true);
    try {
      if (mode === 'auto') {
        const { project } = await syncProjectWorkspace(
          {
            ...currentProject,
            settings: {
              ...currentProject.settings,
              statusMode: 'auto',
              manualStatus: undefined,
            },
          },
          tasks
        );
        updateProject(project.id, project);
        showFeedback({
          tone: 'info',
          title: '자동 상태 동기화 활성화',
          message: '이제 WBS와 간트 변경 내용이 프로젝트 상태에 자동 반영됩니다.',
        });
        return;
      }

      const manualStatus = currentProject.settings?.manualStatus || currentProject.status;
      const savedProject = await upsertProject({
        ...currentProject,
        status: manualStatus,
        completedAt:
          manualStatus === 'completed'
            ? currentProject.completedAt || new Date().toISOString()
            : undefined,
        settings: {
          ...currentProject.settings,
          statusMode: 'manual',
          manualStatus,
        },
        updatedAt: new Date().toISOString(),
      });
      updateProject(savedProject.id, savedProject);
      showFeedback({
        tone: 'success',
        title: '수동 상태 고정 활성화',
        message: '이제 프로젝트 상태를 직접 선택할 수 있고 작업 변경은 상태를 덮어쓰지 않습니다.',
      });
    } catch (error) {
      console.error('Failed to update status mode:', error);
      showFeedback({
        tone: 'error',
        title: '상태 정책 변경 실패',
        message: '상태 동기화 방식을 변경하지 못했습니다.',
      });
    } finally {
      setIsStatusModeSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {feedback && (
        <FeedbackNotice
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={clearFeedback}
        />
      )}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          className="app-panel-dark relative overflow-hidden p-6 md:p-8"
          style={{
            backgroundImage: `radial-gradient(circle at 84% 16%, ${(projectTone?.accent || '#18a79b')}30, transparent 26%), radial-gradient(circle at 18% 84%, ${(projectTone?.accent || '#18a79b')}16, transparent 32%), linear-gradient(165deg, rgba(17,20,26,0.98), rgba(10,12,16,0.94))`,
          }}
        >
          <div className="pointer-events-none absolute right-[-5rem] top-[-6rem] h-56 w-56 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${(projectTone?.accent || '#18a79b')}24, transparent 70%)` }} />
          <div className="relative">
            <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
              {ToneIcon ? <ToneIcon className="h-3.5 w-3.5" style={{ color: projectTone?.accent }} /> : <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />}
              {projectTone?.label || 'Project Settings'}
            </div>
            <h1 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-[-0.06em] text-white">
              {currentProject?.name || '프로젝트'} 설정
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {projectTone.note}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 md:text-base">
              프로젝트 메타 정보와 데이터 관리, 위험 작업을 분리해서 조정 포인트가 더 명확하게 보이도록 정리했습니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} isLoading={isSaving} disabled={!canEditProject || !!nameError || !!dateError}>
                <Save className="w-4 h-4" />
                저장
              </Button>
              {isReadOnly && (
                <span className="rounded-full border border-[rgba(203,109,55,0.2)] bg-[rgba(203,109,55,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-warning)]">
                  읽기 전용
                </span>
              )}
              {currentProject && (
                <span
                  className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold"
                  style={{ color: PROJECT_STATUS_COLORS[currentProject.status] }}
                >
                  {PROJECT_STATUS_LABELS[currentProject.status]}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-1">
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Tasks</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {tasks.length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">등록된 작업 수</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Base Date</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {resolvedFormData.baseDate || '미설정'}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">공정율 기준일</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Schedule</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {resolvedFormData.startDate || '미정'}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              {resolvedFormData.endDate ? `~ ${resolvedFormData.endDate}` : '종료일 미정'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-panel p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_22px_44px_-26px_rgba(15,118,110,0.76)]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="page-kicker">Core Information</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                기본 정보
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="field-label">프로젝트명 *</label>
              <input
                type="text"
                value={resolvedFormData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                disabled={!canEditProject}
                maxLength={100}
                className={cn(
                  'field-input',
                  !canEditProject && 'cursor-not-allowed opacity-60',
                  nameError && formData.name !== undefined && 'border-[rgba(203,75,95,0.4)]'
                )}
              />
              {nameError && formData.name !== undefined && (
                <p className="mt-1.5 text-xs text-[color:var(--accent-danger)]">{nameError}</p>
              )}
            </div>

            <div>
              <label className="field-label">설명</label>
              <textarea
                value={resolvedFormData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                disabled={!canEditProject}
                className={cn('field-textarea', !canEditProject && 'cursor-not-allowed opacity-60')}
                rows={5}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">시작일</label>
                <input
                  type="date"
                  value={resolvedFormData.startDate}
                  onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
                  disabled={!canEditProject}
                  className={cn(
                    'field-input',
                    !canEditProject && 'cursor-not-allowed opacity-60',
                    dateError && 'border-[rgba(203,75,95,0.4)]'
                  )}
                />
              </div>
              <div>
                <label className="field-label">종료일</label>
                <input
                  type="date"
                  value={resolvedFormData.endDate}
                  onChange={(event) => setFormData({ ...formData, endDate: event.target.value })}
                  disabled={!canEditProject}
                  className={cn(
                    'field-input',
                    !canEditProject && 'cursor-not-allowed opacity-60',
                    dateError && 'border-[rgba(203,75,95,0.4)]'
                  )}
                />
              </div>
            </div>
            {dateError && (
              <p className="text-xs text-[color:var(--accent-danger)]">{dateError}</p>
            )}

            <div>
              <label className="field-label">진척기준일</label>
              <input
                type="date"
                value={resolvedFormData.baseDate}
                onChange={(event) => setFormData({ ...formData, baseDate: event.target.value })}
                disabled={!canEditProject}
                className={cn('field-input', !canEditProject && 'cursor-not-allowed opacity-60')}
              />
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                공정율 계산의 기준이 되는 날짜입니다.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} isLoading={isSaving} disabled={!canEditProject || !!nameError || !!dateError}>
                <Save className="w-4 h-4" />
                저장
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-panel p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              프로젝트 상태 관리
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              작업 기반 자동 동기화와 수동 상태 고정 중 하나를 선택할 수 있습니다. 상태 정책이 명확해야 WBS, 간트, 대시보드 지표가 서로 충돌하지 않습니다.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {([
                {
                  key: 'auto' as const,
                  title: '자동 상태 동기화',
                  description: '작업 일정과 진행률에 따라 프로젝트 상태를 자동 계산합니다.',
                },
                {
                  key: 'manual' as const,
                  title: '수동 상태 고정',
                  description: '관리자가 직접 프로젝트 상태를 고정합니다.',
                },
              ]).map((mode) => {
                const isCurrentMode = statusMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => void handleStatusModeChange(mode.key)}
                    disabled={!isAdmin || isCurrentMode || isStatusModeSaving}
                    data-testid={`settings-status-mode-${mode.key}`}
                    className={`rounded-[22px] border p-4 text-left transition-all duration-200 ${
                      isCurrentMode
                        ? 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.06)]'
                        : !isAdmin
                          ? 'cursor-not-allowed border-[var(--border-color)] bg-[color:var(--bg-elevated)] opacity-60'
                          : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] hover:bg-[color:var(--bg-tertiary)]'
                    }`}
                  >
                    <p className="font-medium text-[color:var(--text-primary)]">
                      {mode.title}
                      {isCurrentMode && (
                        <span className="ml-2 text-xs font-semibold text-[color:var(--accent-primary)]">현재 정책</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">{mode.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm leading-6 text-[color:var(--text-secondary)]">
              {isManualStatus
                ? '수동 상태 고정이 켜져 있습니다. 아래 상태 선택은 프로젝트 상태를 직접 고정하며, 이후 작업 저장은 상태를 자동 변경하지 않습니다.'
                : '자동 상태 동기화가 켜져 있습니다. WBS와 간트에서 작업 상태를 저장하면 프로젝트 상태도 자동으로 다시 계산됩니다.'}
            </div>

            <div className="mt-5 space-y-3">
              {([
                { status: 'preparing' as ProjectStatus, icon: <Clock3 className="w-4 h-4" />, desc: '프로젝트 준비 단계입니다.' },
                { status: 'active' as ProjectStatus, icon: <Play className="w-4 h-4" />, desc: '프로젝트가 진행 중입니다.' },
                { status: 'completed' as ProjectStatus, icon: <CheckCircle2 className="w-4 h-4" />, desc: '프로젝트가 완료되었습니다.' },
              ]).map((item) => {
                const isCurrent = currentProject?.status === item.status;
                return (
                  <button
                    key={item.status}
                    onClick={() => !isCurrent && isAdmin && isManualStatus && handleChangeStatus(item.status)}
                    disabled={isCurrent || !isAdmin || !isManualStatus}
                    data-testid={`settings-project-status-${item.status}`}
                    className={`flex w-full items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-200 ${
                      isCurrent
                        ? 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.06)]'
                        : !isAdmin || !isManualStatus
                          ? 'cursor-not-allowed border-[var(--border-color)] bg-[color:var(--bg-elevated)] opacity-60'
                          : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] hover:bg-[color:var(--bg-tertiary)]'
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `${PROJECT_STATUS_COLORS[item.status]}18`,
                        color: PROJECT_STATUS_COLORS[item.status],
                      }}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[color:var(--text-primary)]">
                        {PROJECT_STATUS_LABELS[item.status]}
                        {isCurrent && (
                          <span className="ml-2 text-xs font-semibold text-[color:var(--accent-primary)]">현재 상태</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-[color:var(--text-secondary)]">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {!isAdmin && (
              <p className="mt-3 text-xs text-[color:var(--text-muted)]">상태 변경은 관리자만 가능합니다.</p>
            )}
            {isAdmin && !isManualStatus && (
              <p className="mt-3 text-xs text-[color:var(--text-muted)]">수동 상태 고정을 켜면 아래 상태를 직접 선택할 수 있습니다.</p>
            )}

            {currentProject?.completedAt && (
              <p className="mt-4 text-sm text-[color:var(--text-secondary)]">
                완료일: {new Date(currentProject.completedAt).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>

          <div className="app-panel p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              데이터 관리
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              WBS 데이터를 내보내거나 다시 가져와 현재 프로젝트 구조를 재정렬할 수 있습니다.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExportExcel}>
                <Download className="w-4 h-4" />
                WBS 엑셀 내보내기
              </Button>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-5 py-3 text-sm font-semibold text-[color:var(--text-primary)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-tertiary)]">
                <Upload className="w-4 h-4" />
                엑셀 가져오기
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>

              <Button variant="outline" onClick={generateWbsTemplate}>
                <FileSpreadsheet className="w-4 h-4" />
                업로드 양식 다운로드
              </Button>
            </div>
          </div>

          {canDeleteProject && (
            <div className="danger-zone-container rounded-[30px] border border-[rgba(203,75,95,0.16)] p-6 shadow-[0_28px_60px_-36px_rgba(203,75,95,0.26)]">
              <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--accent-danger)]">
                <AlertTriangle className="w-5 h-5" />
                위험 영역
              </h2>

              <div className="mt-5">
                <div className="danger-zone-inner rounded-[22px] border border-[rgba(203,75,95,0.16)] p-4">
                  <p className="font-medium text-[color:var(--text-primary)]">프로젝트 삭제</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">
                    프로젝트와 모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.
                  </p>
                  <div className="mt-4">
                    <Button variant="danger" onClick={() => setShowDeleteModal(true)} data-testid="settings-delete-project-button">
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {projectId && (canEditProject || isAdmin) && (
        <section className="app-panel p-6">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
            감사 로그
          </h2>
          <p className="mt-2 mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">
            프로젝트에서 발생한 주요 변경 이력을 확인합니다.
          </p>
          <AuditLogPanel projectId={projectId} />
        </section>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => void handleDelete()}
        title="프로젝트 삭제"
        description="프로젝트와 모든 관련 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="프로젝트 삭제"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={pendingStatus !== null}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => pendingStatus && void executeStatusChange(pendingStatus)}
        title="상태 단계 건너뛰기"
        description={`현재 "${PROJECT_STATUS_LABELS[currentProject?.status ?? 'preparing']}" 상태에서 "${PROJECT_STATUS_LABELS[pendingStatus ?? 'preparing']}"(으)로 건너뛰어 변경합니다. 계속하시겠습니까?`}
        confirmLabel="상태 변경"
        confirmVariant="primary"
      />

      <ConfirmModal
        isOpen={showImportReplaceModal}
        onClose={() => {
          setShowImportReplaceModal(false);
          setPendingImportTasks(null);
        }}
        onConfirm={() => {
          if (pendingImportTasks) {
            void applyImportedTasks(pendingImportTasks);
          }
        }}
        title="기존 작업 덮어쓰기"
        description="현재 WBS 작업을 엑셀 파일 내용으로 교체합니다. 가져오기 후에는 새 작업 구조와 일정이 프로젝트 전체 지표에 반영됩니다."
        confirmLabel="덮어쓰기 후 가져오기"
        confirmVariant="primary"
      />
    </div>
  );
}
