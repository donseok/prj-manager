import { useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, UserCircle, Edit2, Check, X, ShieldCheck, Users, Save, Loader2, CheckCircle2, AlertCircle, ClipboardPaste, ListPlus, Crown, Activity } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useTaskStore } from '../store/taskStore';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import Modal from '../components/common/Modal';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { cn, generateId } from '../lib/utils';
import { syncProjectMembers, upsertProject } from '../lib/dataRepository';
import { logAuditEvent } from '../lib/auditLog';
import { useAutoSave } from '../hooks/useAutoSave';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { useProjectPermission } from '../hooks/useProjectPermission';
import { useAuthStore } from '../store/authStore';
import type { ProjectMember } from '../types';
import { analyzeWorkload, type OverloadLevel } from '../lib/resourceAnalytics';

export default function Members() {
  const { t, i18n } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { members, membersLoadedProjectId, addMember, updateMember, removeMember, currentProject } = useProjectStore();
  const tasks = useTaskStore((s) => s.tasks);

  const workloadMap = useMemo(() => {
    const summary = analyzeWorkload(tasks, members);
    const map = new Map<string, { activeTasks: number; overloadLevel: OverloadLevel }>();
    for (const w of summary.members) {
      map.set(w.memberId, { activeTasks: w.activeTasks, overloadLevel: w.overloadLevel });
    }
    return map;
  }, [tasks, members]);
  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [pendingDeleteMember, setPendingDeleteMember] = useState<ProjectMember | null>(null);

  // 일괄 등록 상태
  const [bulkMode, setBulkMode] = useState<'single' | 'paste'>('single');
  const [singleRole, setSingleRole] = useState<ProjectMember['role']>('member');
  const [singleName, setSingleName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const singleNameRef = useRef<HTMLInputElement>(null);

  const [pendingTransferTarget, setPendingTransferTarget] = useState<ProjectMember | null>(null);

  const { user } = useAuthStore();
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const { canManageMembers, canTransferOwnership, isReadOnly } = useProjectPermission();

  const saveMembers = useCallback(
    (data: ProjectMember[]) => syncProjectMembers(projectId!, data),
    [projectId]
  );
  const { saveStatus, lastSavedAt, saveNow } = useAutoSave(members, saveMembers, {
    projectId,
    loadedProjectId: membersLoadedProjectId,
    delay: 500,
  });

  const handleManualSave = () => {
    requestAnimationFrame(() => {
      void saveNow(useProjectStore.getState().members);
    });
  };

  const resetBulkForm = () => {
    setSingleRole('member');
    setSingleName('');
    setPasteText('');
    setBulkMode('single');
  };

  const [pendingDuplicateName, setPendingDuplicateName] = useState<string | null>(null);

  const roleLabels: Record<ProjectMember['role'], string> = {
    owner: t('members.roles.owner'),
    admin: t('members.roles.admin'),
    editor: t('members.roles.editor'),
    member: t('members.roles.member'),
    restricted_member: t('members.roles.restricted_member'),
    viewer: t('members.roles.viewer'),
  };

  const executeSingleAdd = (name: string) => {
    addMember({
      id: generateId(),
      projectId: projectId!,
      name,
      role: singleRole,
      createdAt: new Date().toISOString(),
    });

    if (user && projectId) {
      void logAuditEvent({
        projectId,
        userId: user.id,
        userName: user.name,
        action: 'member.add',
        details: `멤버 "${name}" (${roleLabels[singleRole]}) 추가`,
      });
    }
    showFeedback({
      tone: 'success',
      title: t('members.addSuccess'),
      message: t('members.addSuccessMsg', { name }),
    });
    setSingleName('');
    setPendingDuplicateName(null);
    requestAnimationFrame(() => singleNameRef.current?.focus());
  };

  const handleSingleAdd = () => {
    const trimmed = singleName.trim();
    if (!trimmed) return;

    const duplicate = members.find((m) => m.name === trimmed);
    if (duplicate) {
      setPendingDuplicateName(trimmed);
      return;
    }

    executeSingleAdd(trimmed);
  };

  const getValidPasteMembers = (): { name: string; role: ProjectMember['role'] }[] => {
    return pasteText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name, role: 'member' as const }));
  };

  const handlePasteAdd = () => {
    const validMembers = getValidPasteMembers();
    if (validMembers.length === 0) return;

    for (const { name, role } of validMembers) {
      addMember({
        id: generateId(),
        projectId: projectId!,
        name,
        role,
        createdAt: new Date().toISOString(),
      });
    }

    if (user && projectId) {
      void logAuditEvent({
        projectId,
        userId: user.id,
        userName: user.name,
        action: 'member.add',
        details: `${validMembers.length}명 일괄 추가`,
      });
    }
    showFeedback({
      tone: 'success',
      title: t('members.addSuccess'),
      message: t('members.bulkAddSuccessMsg', { count: validMembers.length }),
    });
    setShowAddModal(false);
    resetBulkForm();
  };

  const handleDeleteMember = (member: ProjectMember) => {
    setPendingDeleteMember(member);
  };

  const confirmDeleteMember = () => {
    if (!pendingDeleteMember) return;
    removeMember(pendingDeleteMember.id);
    if (user && projectId) {
      void logAuditEvent({
        projectId,
        userId: user.id,
        userName: user.name,
        action: 'member.remove',
        details: `멤버 "${pendingDeleteMember.name}" 삭제`,
      });
    }
    showFeedback({
      tone: 'success',
      title: t('members.deleteSuccess'),
      message: t('members.deleteSuccessMsg', { name: pendingDeleteMember.name }),
    });
    setPendingDeleteMember(null);
  };

  const handleStartEdit = (member: ProjectMember) => {
    setEditingId(member.id);
    setEditName(member.name);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateMember(id, { name: editName });
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleRoleChange = (id: string, role: ProjectMember['role']) => {
    const member = members.find((m) => m.id === id);
    updateMember(id, { role });
    if (user && projectId && member) {
      void logAuditEvent({
        projectId,
        userId: user.id,
        userName: user.name,
        action: 'member.role_change',
        details: `"${member.name}" 역할 변경: ${roleLabels[member.role]} → ${roleLabels[role]}`,
      });
    }
  };

  const handleTransferOwnership = async (target: ProjectMember) => {
    if (!projectId || !currentProject) return;
    const currentOwner = members.find((m) => m.role === 'owner');
    if (!currentOwner) return;

    // Change current owner to admin
    updateMember(currentOwner.id, { role: 'admin' });
    // Change target to owner
    updateMember(target.id, { role: 'owner' });
    // Update project ownerId
    try {
      const updatedProject = await upsertProject({
        ...currentProject,
        ownerId: target.userId || currentProject.ownerId,
        updatedAt: new Date().toISOString(),
      });
      useProjectStore.getState().updateProject(projectId, updatedProject);
      // Persist member changes
      const updatedMembers = useProjectStore.getState().members;
      await syncProjectMembers(projectId, updatedMembers);
      if (user) {
        void logAuditEvent({
          projectId,
          userId: user.id,
          userName: user.name,
          action: 'owner.transfer',
          details: `소유권 이전: ${currentOwner.name} → ${target.name}`,
        });
      }
      showFeedback({
        tone: 'success',
        title: t('members.transferSuccess'),
        message: t('members.transferSuccessMsg', { name: target.name }),
      });
    } catch (error) {
      console.error('Failed to transfer ownership:', error);
      // Revert
      updateMember(currentOwner.id, { role: 'owner' });
      updateMember(target.id, { role: target.role });
      showFeedback({
        tone: 'error',
        title: t('members.transferFail'),
        message: t('members.transferFailMsg'),
      });
    }
    setPendingTransferTarget(null);
  };

  const roleStyles: Record<ProjectMember['role'], string> = {
    owner: 'bg-[rgba(18,61,100,0.12)] text-[color:var(--accent-ink)]',
    admin: 'bg-[rgba(15,118,110,0.12)] text-[color:var(--accent-primary)]',
    editor: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]',
    member: 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]',
    restricted_member: 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]',
    viewer: 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]',
  };

  const getDateLocale = () => {
    if (i18n.language === 'ko') return 'ko-KR';
    if (i18n.language === 'vi') return 'vi-VN';
    return 'en-US';
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
            backgroundImage: `radial-gradient(circle at 84% 18%, ${(projectTone?.accent || '#18a79b')}2c, transparent 26%), radial-gradient(circle at 20% 84%, ${(projectTone?.accent || '#18a79b')}16, transparent 32%), linear-gradient(165deg, rgba(17,20,26,0.98), rgba(10,12,16,0.94))`,
          }}
        >
          <div className="pointer-events-none absolute right-[-5rem] top-[-5rem] h-56 w-56 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${(projectTone?.accent || '#18a79b')}24, transparent 70%)` }} />
          <div className="relative">
            <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
              {ToneIcon ? <ToneIcon className="h-3.5 w-3.5" style={{ color: projectTone?.accent }} /> : <Users className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />}
              {projectTone?.label || 'Team Workspace'}
            </div>
            <h1 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-[-0.06em] text-white">
              {currentProject?.name || t('common.project')} {t('members.teamComposition')}
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {projectTone.note}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 md:text-base">
              {t('members.teamDesc')}
            </p>
            <div className="mt-8 flex items-center gap-3">
              {canManageMembers && (
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" />
                  {t('members.addMember')}
                </Button>
              )}
              {isReadOnly && (
                <span className="rounded-full border border-[rgba(203,109,55,0.2)] bg-[rgba(203,109,55,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-warning)]">
                  {t('common.readOnly')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-1">
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Team Size</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {members.length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('members.registeredMembers')}</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Admins</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {members.filter((member) => member.role === 'admin' || member.role === 'owner').length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('members.adminUsers')}</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Contributors</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {members.filter((member) => member.role === 'member').length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('members.contributors')}</p>
          </div>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-6">
          <div>
            <p className="page-kicker">Member Board</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              {t('members.memberList')}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={!projectId || saveStatus === 'saving'}
              data-testid="members-save-button"
            >
              {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </Button>
            <div className={cn(
              'surface-badge',
              saveStatus === 'error' && 'border-[rgba(203,75,95,0.22)] text-[color:var(--accent-danger)]'
            )}>
              {saveStatus === 'pending' && t('members.savePending')}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('common.saving')}
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--accent-success)]" />
                  {formatSaveStatus(lastSavedAt, t, getDateLocale())}
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t('members.saveFail')}
                </>
              )}
              {saveStatus === 'idle' && t('members.autoSaveReady')}
            </div>
            {canManageMembers && (
              <Button variant="outline" onClick={() => setShowAddModal(true)} data-testid="members-add-button">
                <Plus className="w-4 h-4" />
                {t('members.addMember')}
              </Button>
            )}
          </div>
        </div>

        {members.length > 0 ? (
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {members.map((member) => (
              <div
                key={member.id}
                data-testid={`member-card-${member.id}`}
                className="rounded-[24px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5 shadow-[0_20px_48px_-34px_rgba(17,24,39,0.18)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[image:var(--gradient-primary)] text-white shadow-[0_24px_48px_-28px_rgba(15,118,110,0.78)]">
                      <UserCircle className="h-7 w-7" />
                    </div>

                    {editingId === member.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="field-input min-w-[12rem] py-2.5"
                          autoFocus
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSaveEdit(member.id);
                            if (event.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(member.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)] transition-colors hover:bg-[rgba(31,163,122,0.18)]"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(203,75,95,0.08)] text-[color:var(--accent-danger)] transition-colors hover:bg-[rgba(203,75,95,0.14)]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                          {member.name}
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                          {t('members.addedOn', { date: new Date(member.createdAt).toLocaleDateString(getDateLocale()) })}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${roleStyles[member.role]}`}>
                      {roleLabels[member.role]}
                    </div>
                    {(() => {
                      const wl = workloadMap.get(member.id);
                      if (!wl) return null;
                      const colors: Record<OverloadLevel, string> = { normal: '#2FA67C', warning: '#D88B44', critical: '#CB4B5F' };
                      const labels: Record<OverloadLevel, string> = { normal: '정상', warning: '주의', critical: '과부하' };
                      return (
                        <div
                          className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: `${colors[wl.overloadLevel]}14`, color: colors[wl.overloadLevel] }}
                        >
                          <Activity className="h-3 w-3" />
                          {wl.activeTasks}개 · {labels[wl.overloadLevel]}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--accent-primary)]" />
                    {t('members.roleAssign')}
                  </div>
                  <select
                    value={member.role}
                    onChange={(event) => handleRoleChange(member.id, event.target.value as ProjectMember['role'])}
                    disabled={!canManageMembers || member.role === 'owner'}
                    className={cn('field-select w-auto min-w-[8rem] py-2', (!canManageMembers || member.role === 'owner') && 'cursor-not-allowed opacity-60')}
                  >
                    {Object.entries(roleLabels)
                      .filter(([value]) => value !== 'owner')
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    {member.role === 'owner' && (
                      <option value="owner">{roleLabels.owner}</option>
                    )}
                  </select>
                </div>

                {editingId !== member.id && canManageMembers && (
                  <div className="mt-4 flex items-center justify-end gap-2">
                    {canTransferOwnership && member.role !== 'owner' && (
                      <button
                        onClick={() => setPendingTransferTarget(member)}
                        aria-label={`${member.name}에게 소유권 이전`}
                        className="flex h-10 items-center gap-1.5 rounded-full border border-[rgba(18,61,100,0.16)] bg-[rgba(18,61,100,0.05)] px-3 text-xs font-semibold text-[color:var(--accent-ink)] transition-colors hover:bg-[rgba(18,61,100,0.12)]"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        {t('members.transferOwnership')}
                      </button>
                    )}
                    <button
                      onClick={() => handleStartEdit(member)}
                      aria-label={`${member.name} 편집`}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleDeleteMember(member)}
                        aria-label={`${member.name} 삭제`}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(203,75,95,0.16)] bg-[rgba(203,75,95,0.05)] text-[color:var(--accent-danger)] transition-colors hover:bg-[rgba(203,75,95,0.12)]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state px-6 py-14">
            <UserCircle className="h-14 w-14 text-[color:var(--text-muted)]" />
            <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              {t('members.noMembersYet')}
            </h3>
            <p className="max-w-md text-sm leading-6 text-[color:var(--text-secondary)]">
              {t('members.noMembersDesc')}
            </p>
            {canManageMembers && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4" />
                {t('members.addFirstMember')}
              </Button>
            )}
          </div>
        )}
      </section>

      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetBulkForm(); }}
        title={t('members.addMember')}
        size="md"
      >
        <div className="p-6">
          {/* 모드 전환 탭 */}
          <div className="mb-5 flex rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-tertiary)] p-1">
            <button
              onClick={() => setBulkMode('single')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                bulkMode === 'single'
                  ? 'bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-sm'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              )}
            >
              <ListPlus className="h-4 w-4" />
              {t('members.singleInput')}
            </button>
            <button
              onClick={() => setBulkMode('paste')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                bulkMode === 'paste'
                  ? 'bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-sm'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              )}
            >
              <ClipboardPaste className="h-4 w-4" />
              {t('members.pasteInput')}
            </button>
          </div>

          {bulkMode === 'single' ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">{t('members.roleLabel')}</label>
                <select
                  value={singleRole}
                  onChange={(e) => setSingleRole(e.target.value as ProjectMember['role'])}
                  className="field-select w-full py-2.5"
                  data-testid="member-role-select"
                >
                  <option value="member">{t('members.roles.member')}</option>
                  <option value="admin">{t('members.roles.admin')}</option>
                  <option value="editor">{t('members.roles.editor')}</option>
                  <option value="restricted_member">{t('members.roles.restricted_member')}</option>
                  <option value="viewer">{t('members.roles.viewer')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">{t('members.nameLabel')}</label>
                <input
                  ref={singleNameRef}
                  type="text"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSingleAdd();
                    }
                  }}
                  className="field-input w-full py-2.5"
                  placeholder={t('members.namePlaceholder')}
                  autoFocus
                  data-testid="member-name-input"
                />
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
                <Button variant="ghost" onClick={() => { setShowAddModal(false); resetBulkForm(); }}>
                  {t('common.close')}
                </Button>
                <Button
                  onClick={handleSingleAdd}
                  disabled={!singleName.trim()}
                  data-testid="members-confirm-add-button"
                >
                  <Plus className="h-4 w-4" />
                  {t('common.add')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[color:var(--text-secondary)]">
                {t('members.pasteHint')}
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="field-input min-h-[180px] resize-y"
                placeholder={t('members.bulkAddPlaceholder')}
                autoFocus
              />
              <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
                <span className="text-sm text-[color:var(--text-secondary)]">
                  {getValidPasteMembers().length > 0 && t('members.addCountPersons', { count: getValidPasteMembers().length })}
                </span>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { setShowAddModal(false); resetBulkForm(); }}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handlePasteAdd}
                    disabled={getValidPasteMembers().length === 0}
                    data-testid="members-paste-add-button"
                  >
                    {getValidPasteMembers().length > 0 ? t('members.addCount', { count: getValidPasteMembers().length }) : t('common.add')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={pendingDuplicateName !== null}
        onClose={() => setPendingDuplicateName(null)}
        onConfirm={() => pendingDuplicateName && executeSingleAdd(pendingDuplicateName)}
        title={t('members.duplicateTitle')}
        description={t('members.duplicateDesc', { name: pendingDuplicateName })}
        confirmLabel={t('common.add')}
        confirmVariant="primary"
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteMember)}
        onClose={() => setPendingDeleteMember(null)}
        onConfirm={confirmDeleteMember}
        title={t('members.deleteTitle')}
        description={
          pendingDeleteMember
            ? t('members.deleteDesc', { name: pendingDeleteMember.name })
            : ''
        }
        confirmLabel={t('members.deleteLabel')}
        confirmVariant="danger"
      />

      <ConfirmModal
        isOpen={Boolean(pendingTransferTarget)}
        onClose={() => setPendingTransferTarget(null)}
        onConfirm={() => { if (pendingTransferTarget) void handleTransferOwnership(pendingTransferTarget); }}
        title={t('members.transferOwnership')}
        description={
          pendingTransferTarget
            ? t('members.transferDesc', { name: pendingTransferTarget.name })
            : ''
        }
        confirmLabel={t('members.transferOwnership')}
        confirmVariant="danger"
      />
    </div>
  );
}

function formatSaveStatus(
  lastSavedAt: string | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  locale: string,
) {
  if (!lastSavedAt) return t('members.saved');
  const time = new Date(lastSavedAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return t('members.savedAt', { time });
}
