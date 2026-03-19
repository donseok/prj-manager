import { useState } from 'react';
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
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { deleteProjectById, syncProjectTasks, upsertProject } from '../lib/dataRepository';
import { exportWbsWorkbook, parseTasksFromWorkbook } from '../lib/excel';
import type { ProjectStatus } from '../types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../types';

export default function Settings() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, members, updateProject, deleteProject } = useProjectStore();
  const { isAdmin } = useAuthStore();
  const { tasks, setTasks } = useTaskStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    if (!projectId || !currentProject) return;
    setIsSaving(true);

    const savedProject = await upsertProject({
      ...currentProject,
      id: projectId,
      ownerId: currentProject.ownerId,
      ...resolvedFormData,
      updatedAt: new Date().toISOString(),
    });

    updateProject(projectId, savedProject);

    setTimeout(() => {
      setIsSaving(false);
      alert('저장되었습니다.');
    }, 500);
  };

  const handleDelete = async () => {
    if (!projectId) return;

    await deleteProjectById(projectId);
    deleteProject(projectId);

    navigate('/projects');
  };

  const handleChangeStatus = async (newStatus: ProjectStatus) => {
    if (!projectId || !currentProject) return;

    const now = new Date().toISOString();
    const updates: Partial<typeof currentProject> = {
      status: newStatus,
      updatedAt: now,
    };

    if (newStatus === 'completed') {
      updates.completedAt = now;
    } else {
      updates.completedAt = undefined;
    }

    const savedProject = await upsertProject({
      ...currentProject,
      ...updates,
    } as typeof currentProject);

    updateProject(projectId, savedProject);

    alert(`프로젝트 상태가 "${PROJECT_STATUS_LABELS[newStatus]}"(으)로 변경되었습니다.`);
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

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const importedTasks = parseTasksFromWorkbook(loadEvent.target?.result as ArrayBuffer, projectId!);

        if (tasks.length > 0 && !confirm('기존 작업을 덮어쓰시겠습니까?')) {
          return;
        }

        setTasks(importedTasks);
        void syncProjectTasks(projectId!, importedTasks);
        alert(`${importedTasks.length}개의 작업을 가져왔습니다.`);
      } catch (error) {
        console.error('Import error:', error);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-panel-dark relative overflow-hidden p-7 md:p-8">
          <div className="pointer-events-none absolute right-[-5rem] top-[-6rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_70%)] blur-3xl" />
          <div className="relative">
            <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
              Project Settings
            </div>
            <h1 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-[-0.06em] text-white">
              {currentProject?.name || '프로젝트'} 설정
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 md:text-base">
              프로젝트 메타 정보와 데이터 관리, 위험 작업을 분리해서 조정 포인트가 더 명확하게 보이도록 정리했습니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} isLoading={isSaving}>
                <Save className="w-4 h-4" />
                저장
              </Button>
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
              {formData.baseDate || '미설정'}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">공정율 기준일</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Schedule</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {formData.startDate || '미정'}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              {formData.endDate ? `~ ${formData.endDate}` : '종료일 미정'}
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
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">설명</label>
              <textarea
                value={resolvedFormData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                className="field-textarea"
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
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">종료일</label>
                <input
                  type="date"
                  value={resolvedFormData.endDate}
                  onChange={(event) => setFormData({ ...formData, endDate: event.target.value })}
                  className="field-input"
                />
              </div>
            </div>

            <div>
              <label className="field-label">진척기준일</label>
              <input
                type="date"
                value={resolvedFormData.baseDate}
                onChange={(event) => setFormData({ ...formData, baseDate: event.target.value })}
                className="field-input"
              />
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                공정율 계산의 기준이 되는 날짜입니다.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} isLoading={isSaving}>
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
              프로젝트의 진행 상태를 변경합니다. 완료 처리 시 완료일이 자동 기록됩니다.
            </p>

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
                    onClick={() => !isCurrent && isAdmin && handleChangeStatus(item.status)}
                    disabled={isCurrent || !isAdmin}
                    className={`flex w-full items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-200 ${
                      isCurrent
                        ? 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.06)]'
                        : !isAdmin
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
            </div>
          </div>

          {isAdmin && (
            <div className="rounded-[30px] border border-[rgba(203,75,95,0.16)] bg-[linear-gradient(180deg,rgba(255,244,245,0.88),rgba(255,248,244,0.72))] p-6 shadow-[0_28px_60px_-36px_rgba(203,75,95,0.26)] dark:bg-[linear-gradient(180deg,rgba(49,20,28,0.66),rgba(23,16,20,0.72))]">
              <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--accent-danger)]">
                <AlertTriangle className="w-5 h-5" />
                위험 영역
              </h2>

              <div className="mt-5">
              <div className="rounded-[22px] border border-[rgba(203,75,95,0.16)] bg-[rgba(203,75,95,0.08)] p-4 dark:bg-[rgba(203,75,95,0.12)]">
                  <p className="font-medium text-[color:var(--text-primary)]">프로젝트 삭제</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">
                    프로젝트와 모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.
                  </p>
                  <div className="mt-4">
                    <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
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

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="프로젝트 삭제"
        size="sm"
      >
        <div className="space-y-5 p-6">
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
            프로젝트와 모든 관련 데이터가 영구 삭제됩니다. 정말 진행하시겠습니까?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
              삭제
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
