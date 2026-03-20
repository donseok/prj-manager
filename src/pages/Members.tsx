import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2, UserCircle, Edit2, Check, X, ShieldCheck, Users, Save, Loader2, CheckCircle2, AlertCircle, ClipboardPaste, ListPlus } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import Modal from '../components/common/Modal';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { cn, generateId } from '../lib/utils';
import { syncProjectMembers } from '../lib/dataRepository';
import { useAutoSave } from '../hooks/useAutoSave';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { useProjectPermission } from '../hooks/useProjectPermission';
import type { ProjectMember } from '../types';

export default function Members() {
  const { projectId } = useParams<{ projectId: string }>();
  const { members, membersLoadedProjectId, addMember, updateMember, removeMember, currentProject } = useProjectStore();
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

  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const { canManageMembers, isReadOnly } = useProjectPermission();

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

  const handleSingleAdd = () => {
    const trimmed = singleName.trim();
    if (!trimmed) return;

    addMember({
      id: generateId(),
      projectId: projectId!,
      name: trimmed,
      role: singleRole,
      createdAt: new Date().toISOString(),
    });

    showFeedback({
      tone: 'success',
      title: '멤버 추가 완료',
      message: `"${trimmed}" 멤버를 추가했습니다.`,
    });
    setSingleName('');
    requestAnimationFrame(() => singleNameRef.current?.focus());
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

    showFeedback({
      tone: 'success',
      title: '멤버 추가 완료',
      message: `${validMembers.length}명의 멤버를 추가했습니다.`,
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
    showFeedback({
      tone: 'success',
      title: '멤버 삭제 완료',
      message: `"${pendingDeleteMember.name}" 멤버를 팀 구성에서 제거했습니다.`,
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
    updateMember(id, { role });
  };

  const roleLabels: Record<ProjectMember['role'], string> = {
    owner: '소유자',
    admin: '관리자',
    member: '멤버',
    viewer: '뷰어',
  };

  const roleStyles: Record<ProjectMember['role'], string> = {
    owner: 'bg-[rgba(18,61,100,0.12)] text-[color:var(--accent-ink)]',
    admin: 'bg-[rgba(15,118,110,0.12)] text-[color:var(--accent-primary)]',
    member: 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]',
    viewer: 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]',
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
              {currentProject?.name || '프로젝트'} 팀 구성
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {projectTone.note}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 md:text-base">
              참여자를 단순 목록이 아니라 역할과 편집 상태가 명확하게 보이는 팀 보드 형태로 정리했습니다.
            </p>
            <div className="mt-8 flex items-center gap-3">
              {canManageMembers && (
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" />
                  멤버 추가
                </Button>
              )}
              {isReadOnly && (
                <span className="rounded-full border border-[rgba(203,109,55,0.2)] bg-[rgba(203,109,55,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-warning)]">
                  읽기 전용
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
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">등록된 전체 멤버</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Admins</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {members.filter((member) => member.role === 'admin' || member.role === 'owner').length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">관리 권한 사용자</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Contributors</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {members.filter((member) => member.role === 'member').length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">실무 작업 참여자</p>
          </div>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-6">
          <div>
            <p className="page-kicker">Member Board</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              멤버 목록
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
              저장
            </Button>
            <div className={cn(
              'surface-badge',
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
            {canManageMembers && (
              <Button variant="outline" onClick={() => setShowAddModal(true)} data-testid="members-add-button">
                <Plus className="w-4 h-4" />
                멤버 추가
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
                          추가됨: {new Date(member.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${roleStyles[member.role]}`}>
                    {roleLabels[member.role]}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--accent-primary)]" />
                    역할 지정
                  </div>
                  <select
                    value={member.role}
                    onChange={(event) => handleRoleChange(member.id, event.target.value as ProjectMember['role'])}
                    disabled={!canManageMembers}
                    className={cn('field-select w-auto min-w-[8rem] py-2', !canManageMembers && 'cursor-not-allowed opacity-60')}
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {editingId !== member.id && canManageMembers && (
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleStartEdit(member)}
                      aria-label={`${member.name} 편집`}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member)}
                      aria-label={`${member.name} 삭제`}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(203,75,95,0.16)] bg-[rgba(203,75,95,0.05)] text-[color:var(--accent-danger)] transition-colors hover:bg-[rgba(203,75,95,0.12)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state px-6 py-14">
            <UserCircle className="h-14 w-14 text-[color:var(--text-muted)]" />
            <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              아직 멤버가 없습니다
            </h3>
            <p className="max-w-md text-sm leading-6 text-[color:var(--text-secondary)]">
              첫 멤버를 추가하면 역할 관리와 이름 편집이 같은 카드 안에서 바로 가능해집니다.
            </p>
            {canManageMembers && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4" />
                첫 멤버 추가
              </Button>
            )}
          </div>
        )}
      </section>

      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetBulkForm(); }}
        title="멤버 추가"
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
              개별 입력
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
              일괄 붙여넣기
            </button>
          </div>

          {bulkMode === 'single' ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">역할</label>
                <select
                  value={singleRole}
                  onChange={(e) => setSingleRole(e.target.value as ProjectMember['role'])}
                  className="field-select w-full py-2.5"
                  data-testid="member-role-select"
                >
                  <option value="member">멤버</option>
                  <option value="admin">관리자</option>
                  <option value="viewer">뷰어</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">이름</label>
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
                  placeholder="멤버 이름을 입력하세요"
                  autoFocus
                  data-testid="member-name-input"
                />
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
                <Button variant="ghost" onClick={() => { setShowAddModal(false); resetBulkForm(); }}>
                  닫기
                </Button>
                <Button
                  onClick={handleSingleAdd}
                  disabled={!singleName.trim()}
                  data-testid="members-confirm-add-button"
                >
                  <Plus className="h-4 w-4" />
                  추가
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[color:var(--text-secondary)]">
                한 줄에 한 명씩 이름을 입력하세요. 기본 역할은 '멤버'로 설정됩니다.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="field-input min-h-[180px] resize-y"
                placeholder={"홍길동\n김철수\n이영희"}
                autoFocus
              />
              <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
                <span className="text-sm text-[color:var(--text-secondary)]">
                  {getValidPasteMembers().length > 0 && `${getValidPasteMembers().length}명`}
                </span>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { setShowAddModal(false); resetBulkForm(); }}>
                    취소
                  </Button>
                  <Button
                    onClick={handlePasteAdd}
                    disabled={getValidPasteMembers().length === 0}
                    data-testid="members-paste-add-button"
                  >
                    {getValidPasteMembers().length > 0 ? `${getValidPasteMembers().length}명 추가` : '추가'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteMember)}
        onClose={() => setPendingDeleteMember(null)}
        onConfirm={confirmDeleteMember}
        title="멤버 삭제"
        description={
          pendingDeleteMember
            ? `"${pendingDeleteMember.name}" 멤버를 프로젝트 팀 구성에서 제거합니다. 저장되면 멤버 보드와 관련 필터에서 바로 반영됩니다.`
            : ''
        }
        confirmLabel="멤버 삭제"
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
