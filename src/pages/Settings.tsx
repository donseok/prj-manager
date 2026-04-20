import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Bot,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  Database,
  RefreshCw,
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
import MeetingImport from '../components/settings/MeetingImport';
import BaselineManager from '../components/settings/BaselineManager';
import { logAuditEvent } from '../lib/auditLog';
import type { AIProvider, ProjectStatus, Task } from '../types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../types';
import { loadAISettings, saveAISettings, hasEnvAIConfig, getDefaultModel } from '../lib/ai';
import { testConnection } from '../lib/ai/aiClient';
import { isRagReady, loadIndexStats, reindexProject, type ReindexProgress } from '../lib/rag';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Settings() {
  const { t } = useTranslation();
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
  const [isProgressModeSaving, setIsProgressModeSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const { canEditProject, canDeleteProject, isReadOnly } = useProjectPermission();

  // AI 설정 상태
  const envAIConfigured = hasEnvAIConfig();
  const [aiSettings, setAiSettings] = useState(() => loadAISettings());
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isAiTesting, setIsAiTesting] = useState(false);

  const handleAiProviderChange = (provider: AIProvider) => {
    const updated = { ...aiSettings, provider, model: getDefaultModel(provider) };
    setAiSettings(updated);
    saveAISettings(updated);
    setAiTestResult(null);
  };

  const handleAiApiKeyChange = (apiKey: string) => {
    const updated = { ...aiSettings, apiKey };
    setAiSettings(updated);
    saveAISettings(updated);
    setAiTestResult(null);
  };

  const handleAiTestConnection = async () => {
    setIsAiTesting(true);
    setAiTestResult(null);
    try {
      const result = await testConnection(aiSettings);
      setAiTestResult(result);
    } catch {
      setAiTestResult({ success: false, message: t('settings.testConnectionError') });
    } finally {
      setIsAiTesting(false);
    }
  };

  // RAG 지식베이스 상태 (Supabase 연결만 있으면 동작 — API 키 불필요)
  const ragReady = isRagReady();
  const [ragStats, setRagStats] = useState<{ count: number; lastUpdatedAt: string | null }>({ count: 0, lastUpdatedAt: null });
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<ReindexProgress | null>(null);

  useEffect(() => {
    if (!currentProject || !isSupabaseConfigured) return;
    let cancelled = false;
    void loadIndexStats(currentProject.id).then((s) => {
      if (!cancelled) setRagStats(s);
    });
    return () => { cancelled = true; };
  }, [currentProject]);

  const handleReindex = async () => {
    if (!currentProject) return;
    setIsReindexing(true);
    setReindexProgress(null);
    try {
      const result = await reindexProject(currentProject, {
        membersOverride: members,
        tasksOverride: tasks,
        onProgress: (p) => setReindexProgress(p),
      });
      const stats = await loadIndexStats(currentProject.id);
      setRagStats(stats);
      showFeedback({
        tone: 'success',
        title: t('settings.rag.rebuildSuccess'),
        message: t('settings.rag.rebuildSuccessMsg', {
          added: result.added,
          updated: result.updated,
          deleted: result.deleted,
          unchanged: result.unchanged,
        }),
      });
    } catch (err) {
      console.error('RAG reindex failed:', err);
      showFeedback({
        tone: 'error',
        title: t('settings.rag.rebuildFail'),
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsReindexing(false);
      setReindexProgress(null);
    }
  };

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
  const progressMode = currentProject?.settings?.progressMode ?? 'auto';
  const isManualProgress = progressMode === 'manual';

  // 실시간 유효성 검사
  const nameError = (() => {
    const trimmed = resolvedFormData.name.trim();
    if (!trimmed) return t('validation.projectNameRequired');
    if (trimmed.length < 2) return t('validation.projectNameMinLength');
    if (!/[a-zA-Z0-9가-힣]/.test(trimmed)) return t('validation.projectNamePattern');
    return null;
  })();

  const dateError = (() => {
    if (resolvedFormData.startDate && resolvedFormData.endDate &&
        new Date(resolvedFormData.startDate) >= new Date(resolvedFormData.endDate)) {
      return t('validation.endDateAfterStart');
    }
    return null;
  })();

  const handleSave = async () => {
    if (!projectId || !currentProject) return;

    if (nameError) {
      showFeedback({ tone: 'error', title: t('validation.projectNameError'), message: nameError });
      return;
    }
    if (dateError) {
      showFeedback({ tone: 'error', title: t('validation.dateError'), message: dateError });
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
          details: t('settings.auditCoreInfoChange'),
        });
      }
      showFeedback({
        tone: 'success',
        title: t('settings.saveSuccess'),
        message: t('settings.saveSuccessMsg'),
      });
    } catch (error) {
      console.error('Failed to save project settings:', error);
      showFeedback({
        tone: 'error',
        title: t('settings.saveFail'),
        message: t('settings.saveFailMsg'),
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
        title: t('settings.deleteFail'),
        message: error instanceof Error ? error.message : t('settings.deleteFailMsg'),
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
        title: t('settings.statusChangeSuccess'),
        message: t('settings.statusChangeSuccessMsg', { status: PROJECT_STATUS_LABELS[newStatus] }),
      });
    } catch (error) {
      console.error('Failed to change project status:', error);
      showFeedback({
        tone: 'error',
        title: t('settings.statusChangeFail'),
        message: t('settings.statusChangeFailMsg'),
      });
    }
  };

  const handleExportExcel = async () => {
    if (tasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: t('settings.noTasksToExport'),
        message: t('settings.noTasksToExportMsg'),
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
        title: t('settings.exportFail'),
        message: error instanceof Error ? error.message : t('settings.exportFailMsg'),
      });
    }
  };

  const applyImportedTasks = useCallback(
    async (importedTasks: Task[]) => {
      if (!currentProject || !projectId) {
        console.warn('[Import] No currentProject or projectId', { currentProject: !!currentProject, projectId });
        return;
      }

      try {
        console.log('[Import] Starting with', importedTasks.length, 'tasks');
        const { project, tasks: normalizedTasks } = await syncProjectWorkspace(currentProject, importedTasks);
        console.log('[Import] Normalized:', normalizedTasks.length, 'tasks');
        setTasks(normalizedTasks, projectId);
        updateProject(project.id, project);
        console.log('[Import] Done successfully');
        showFeedback({
          tone: 'success',
          title: t('settings.importSuccess'),
          message: t('settings.importSuccessMsg', { count: normalizedTasks.length }),
        });
      } catch (error) {
        console.error('Import error:', error);
        showFeedback({
          tone: 'error',
          title: t('settings.importFail'),
          message: t('settings.importFailMsg'),
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
          title: t('settings.importFail'),
          message: t('settings.importFailMsg'),
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
          title: t('settings.autoSyncEnabled'),
          message: t('settings.autoSyncEnabledMsg'),
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
        title: t('settings.manualFixEnabled'),
        message: t('settings.manualFixEnabledMsg'),
      });
    } catch (error) {
      console.error('Failed to update status mode:', error);
      showFeedback({
        tone: 'error',
        title: t('settings.statusPolicyFail'),
        message: t('settings.statusPolicyFailMsg'),
      });
    } finally {
      setIsStatusModeSaving(false);
    }
  };

  const handleProgressModeChange = async (mode: 'auto' | 'manual') => {
    if (!currentProject || !isAdmin || progressMode === mode) return;

    setIsProgressModeSaving(true);
    try {
      const nextProject = {
        ...currentProject,
        settings: {
          ...currentProject.settings,
          progressMode: mode,
        },
      };
      // 모드 전환 시 현재 작업을 새 규칙으로 재정규화한다.
      const { project, tasks: normalizedTasks } = await syncProjectWorkspace(nextProject, tasks);
      setTasks(normalizedTasks, projectId ?? undefined);
      updateProject(project.id, project);
      showFeedback({
        tone: mode === 'auto' ? 'info' : 'success',
        title: mode === 'auto' ? t('settings.progressAutoEnabled') : t('settings.progressManualEnabled'),
        message: mode === 'auto' ? t('settings.progressAutoEnabledMsg') : t('settings.progressManualEnabledMsg'),
      });
      if (user) {
        void logAuditEvent({
          projectId: project.id,
          userId: user.id,
          userName: user.name,
          action: 'project.settings_change',
          details:
            mode === 'auto'
              ? t('settings.progressAutoEnabled')
              : t('settings.progressManualEnabled'),
        });
      }
    } catch (error) {
      console.error('Failed to update progress mode:', error);
      showFeedback({
        tone: 'error',
        title: t('settings.progressModeFail'),
        message: t('settings.progressModeFailMsg'),
      });
    } finally {
      setIsProgressModeSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-8">
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
              {currentProject?.name || t('common.project')} {t('settings.pageTitle')}
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {projectTone.note}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 md:text-base">
              {t('settings.heroDesc')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} isLoading={isSaving} disabled={!canEditProject || !!nameError || !!dateError}>
                <Save className="w-4 h-4" />
                {t('common.save')}
              </Button>
              {isReadOnly && (
                <span className="rounded-full border border-[rgba(203,109,55,0.2)] bg-[rgba(203,109,55,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-warning)]">
                  {t('common.readOnly')}
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
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('settings.registeredTasks')}</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Base Date</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {resolvedFormData.baseDate || t('settings.notSet')}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('settings.baseDateLabel')}</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Schedule</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {resolvedFormData.startDate || t('settings.pending')}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              {resolvedFormData.endDate ? `~ ${resolvedFormData.endDate}` : t('settings.endDatePending')}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="app-panel p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_22px_44px_-26px_rgba(15,118,110,0.76)]">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="page-kicker">Core Information</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                  {t('settings.coreInfo')}
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="field-label">{t('settings.projectName')}</label>
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
                <label className="field-label">{t('settings.descriptionLabel')}</label>
                <textarea
                  value={resolvedFormData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  disabled={!canEditProject}
                  className={cn('field-textarea', !canEditProject && 'cursor-not-allowed opacity-60')}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="field-label">{t('settings.startDate')}</label>
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
                  <label className="field-label">{t('settings.endDate')}</label>
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
                <label className="field-label">{t('settings.baseDate')}</label>
                <input
                  type="date"
                  value={resolvedFormData.baseDate}
                  onChange={(event) => setFormData({ ...formData, baseDate: event.target.value })}
                  disabled={!canEditProject}
                  className={cn('field-input', !canEditProject && 'cursor-not-allowed opacity-60')}
                />
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                  {t('settings.baseDateDesc')}
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} isLoading={isSaving} disabled={!canEditProject || !!nameError || !!dateError}>
                  <Save className="w-4 h-4" />
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </div>

          <div className="app-panel p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              {t('settings.dataManagement')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {t('settings.dataManagementDesc')}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExportExcel}>
                <Download className="w-4 h-4" />
                {t('settings.excelExport')}
              </Button>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-5 py-3 text-sm font-semibold text-[color:var(--text-primary)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-tertiary)]">
                <Upload className="w-4 h-4" />
                {t('settings.excelImport')}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>

              <Button variant="outline" onClick={generateWbsTemplate}>
                <FileSpreadsheet className="w-4 h-4" />
                {t('settings.templateDownload')}
              </Button>
            </div>
          </div>

          {/* 회의록 임포트 — 추출된 Task를 기존 WBS에 병합 저장 */}
          {projectId && (
            <MeetingImport
              projectId={projectId}
              tasks={tasks}
              members={members}
              onTasksAdded={(newTasks) => {
                if (newTasks.length === 0) return;
                void applyImportedTasks([...tasks, ...newTasks]);
              }}
            />
          )}

          {/* 기준선(Baseline) 관리 — 계획 스냅샷 저장 & 실적 비교 */}
          {currentProject && user && (
            <BaselineManager
              project={currentProject}
              tasks={tasks}
              currentUserId={user.id}
              currentUserName={user.name}
              canEdit={canEditProject}
              onFeedback={(tone, title, message) => showFeedback({ tone, title, message })}
            />
          )}

          <div className="app-panel p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#7c3aed,#a78bfa)] text-white shadow-[0_18px_36px_-22px_rgba(124,58,237,0.7)]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                  {t('settings.aiSettings')}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  {t('settings.aiSettingsDesc')}
                </p>
              </div>
            </div>

            {envAIConfigured && (
              <div className="mt-4 rounded-[16px] border border-[rgba(31,163,122,0.2)] bg-[rgba(31,163,122,0.06)] px-4 py-3 text-sm text-[color:var(--accent-success)]">
                {t('settings.aiEnvConfigured')}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="field-label">AI Provider</label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {([
                    { key: 'claude' as const, label: 'Claude (Anthropic)', desc: t('settings.aiClaudeDesc') },
                    { key: 'openai' as const, label: 'OpenAI', desc: t('settings.aiOpenaiDesc') },
                    { key: 'gemini' as const, label: 'Gemini (Google)', desc: t('settings.aiGeminiDesc') },
                  ]).map((provider) => {
                    const isSelected = aiSettings.provider === provider.key;
                    return (
                      <button
                        key={provider.key}
                        type="button"
                        onClick={() => handleAiProviderChange(provider.key)}
                        disabled={envAIConfigured}
                        className={`rounded-[18px] border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.08)]'
                            : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] hover:bg-[color:var(--bg-tertiary)]'
                        } ${envAIConfigured ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <p className="font-medium text-[color:var(--text-primary)]">
                          {provider.label}
                          {isSelected && (
                            <span className="ml-2 text-xs font-semibold text-violet-500">{t('settings.selected')}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">{provider.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="field-label">API Key</label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={aiSettings.apiKey}
                      onChange={(e) => handleAiApiKeyChange(e.target.value)}
                      disabled={envAIConfigured}
                      placeholder={envAIConfigured ? t('settings.aiEnvSet') : t('settings.aiApiKeyPlaceholder')}
                      className={cn(
                        'field-input pr-10',
                        envAIConfigured && 'cursor-not-allowed opacity-60'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleAiTestConnection()}
                    disabled={!aiSettings.apiKey || isAiTesting}
                  >
                    {isAiTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('settings.testConnection')}
                  </Button>
                </div>
                {aiTestResult && (
                  <div className={cn(
                    'mt-2 flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm',
                    aiTestResult.success
                      ? 'bg-[rgba(31,163,122,0.08)] text-[color:var(--accent-success)]'
                      : 'bg-[rgba(203,75,95,0.08)] text-[color:var(--accent-danger)]'
                  )}>
                    {aiTestResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {aiTestResult.message}
                  </div>
                )}
              </div>

              <div className="rounded-[16px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm leading-6 text-[color:var(--text-secondary)]">
                {t('settings.aiModeDesc')}
              </div>
            </div>
          </div>

          <div className="app-panel p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#0ea5e9,#6366f1)] text-white shadow-[0_18px_36px_-22px_rgba(14,165,233,0.7)]">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                  {t('settings.rag.title')}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  {t('settings.rag.desc')}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {!isSupabaseConfigured && (
                <div className="rounded-[14px] border border-[rgba(203,109,55,0.2)] bg-[rgba(203,109,55,0.08)] px-4 py-3 text-sm text-[color:var(--accent-warning)]">
                  {t('settings.rag.requireSupabase')}
                </div>
              )}
              {ragReady && !currentProject && (
                <div className="rounded-[14px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                  {t('settings.rag.requireProject')}
                </div>
              )}

              {ragReady && currentProject && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[16px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                        {t('settings.rag.indexedCount')}
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                        {t('settings.rag.countUnit', { count: ragStats.count })}
                      </p>
                    </div>
                    <div className="rounded-[16px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                        {t('settings.rag.lastIndexed')}
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--text-primary)]">
                        {ragStats.lastUpdatedAt
                          ? new Date(ragStats.lastUpdatedAt).toLocaleString()
                          : t('settings.rag.notIndexed')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => void handleReindex()}
                      isLoading={isReindexing}
                      disabled={isReindexing}
                    >
                      <RefreshCw className="w-4 h-4" />
                      {isReindexing ? t('settings.rag.rebuilding') : t('settings.rag.rebuild')}
                    </Button>
                    {isReindexing && reindexProgress && (
                      <span className="text-sm text-[color:var(--text-secondary)]">
                        {reindexProgress.message}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-panel p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              {t('settings.statusManagement')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {t('settings.statusDesc')}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {([
                {
                  key: 'auto' as const,
                  title: t('settings.autoSync'),
                  description: t('settings.autoSyncDesc'),
                },
                {
                  key: 'manual' as const,
                  title: t('settings.manualFix'),
                  description: t('settings.manualFixDesc'),
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
                        <span className="ml-2 text-xs font-semibold text-[color:var(--accent-primary)]">{t('settings.currentPolicy')}</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">{mode.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm leading-6 text-[color:var(--text-secondary)]">
              {isManualStatus
                ? t('settings.manualFixActiveDesc')
                : t('settings.autoSyncActiveDesc')}
            </div>

            <div className="mt-5 space-y-3">
              {([
                { status: 'preparing' as ProjectStatus, icon: <Clock3 className="w-4 h-4" />, desc: t('settings.statusPreparing') },
                { status: 'active' as ProjectStatus, icon: <Play className="w-4 h-4" />, desc: t('settings.statusActive') },
                { status: 'completed' as ProjectStatus, icon: <CheckCircle2 className="w-4 h-4" />, desc: t('settings.statusCompleted') },
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
                          <span className="ml-2 text-xs font-semibold text-[color:var(--accent-primary)]">{t('settings.currentStatus')}</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-[color:var(--text-secondary)]">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {!isAdmin && (
              <p className="mt-3 text-xs text-[color:var(--text-muted)]">{t('settings.adminOnlyStatus')}</p>
            )}
            {isAdmin && !isManualStatus && (
              <p className="mt-3 text-xs text-[color:var(--text-muted)]">{t('settings.enableManualHint')}</p>
            )}

            {currentProject?.completedAt && (
              <p className="mt-4 text-sm text-[color:var(--text-secondary)]">
                {t('settings.completedDate')}: {new Date(currentProject.completedAt).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>

          <div className="app-panel p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              {t('settings.progressManagement')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {t('settings.progressDesc')}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {([
                {
                  key: 'auto' as const,
                  title: t('settings.progressAuto'),
                  description: t('settings.progressAutoDesc'),
                },
                {
                  key: 'manual' as const,
                  title: t('settings.progressManual'),
                  description: t('settings.progressManualDesc'),
                },
              ]).map((mode) => {
                const isCurrentMode = progressMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => void handleProgressModeChange(mode.key)}
                    disabled={!isAdmin || isCurrentMode || isProgressModeSaving}
                    data-testid={`settings-progress-mode-${mode.key}`}
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
                        <span className="ml-2 text-xs font-semibold text-[color:var(--accent-primary)]">{t('settings.currentPolicy')}</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">{mode.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm leading-6 text-[color:var(--text-secondary)]">
              {isManualProgress
                ? t('settings.progressManualActiveDesc')
                : t('settings.progressAutoActiveDesc')}
            </div>
            {!isAdmin && (
              <p className="mt-3 text-xs text-[color:var(--text-muted)]">{t('settings.adminOnlyProgress')}</p>
            )}
          </div>

          {canDeleteProject && (
            <div className="danger-zone-container rounded-[30px] border border-[rgba(203,75,95,0.16)] p-6 shadow-[0_28px_60px_-36px_rgba(203,75,95,0.26)]">
              <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--accent-danger)]">
                <AlertTriangle className="w-5 h-5" />
                {t('settings.dangerZone')}
              </h2>

              <div className="mt-5">
                <div className="danger-zone-inner rounded-[22px] border border-[rgba(203,75,95,0.16)] p-4">
                  <p className="font-medium text-[color:var(--text-primary)]">{t('settings.deleteProject')}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">
                    {t('settings.deleteDesc')}
                  </p>
                  <div className="mt-4">
                    <Button variant="danger" onClick={() => setShowDeleteModal(true)} data-testid="settings-delete-project-button">
                      <Trash2 className="w-4 h-4" />
                      {t('common.delete')}
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
            {t('settings.auditLog')}
          </h2>
          <p className="mt-2 mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">
            {t('settings.auditLogDesc')}
          </p>
          <AuditLogPanel projectId={projectId} />
        </section>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => void handleDelete()}
        title={t('settings.deleteProject')}
        description={t('settings.deleteConfirmDesc', { name: currentProject?.name })}
        confirmLabel={t('settings.deleteProject')}
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={pendingStatus !== null}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => pendingStatus && void executeStatusChange(pendingStatus)}
        title={t('settings.skipStepConfirmTitle')}
        description={t('settings.skipStepConfirmDesc', { current: PROJECT_STATUS_LABELS[currentProject?.status ?? 'preparing'], target: PROJECT_STATUS_LABELS[pendingStatus ?? 'preparing'] })}
        confirmLabel={t('settings.statusChange')}
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
        title={t('settings.importReplaceTitle')}
        description={t('settings.importReplaceDesc', { count: tasks.length })}
        confirmLabel={t('settings.importReplaceLabel')}
        confirmVariant="primary"
      />
    </div>
  );
}
