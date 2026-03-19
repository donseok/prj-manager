import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2, UserCircle, Edit2, Check, X, ShieldCheck, Users } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { generateId } from '../lib/utils';
import { syncProjectMembers } from '../lib/dataRepository';
import type { ProjectMember } from '../types';

export default function Members() {
  const { projectId } = useParams<{ projectId: string }>();
  const { members, membersLoadedProjectId, addMember, updateMember, removeMember, currentProject } = useProjectStore();
  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newMember, setNewMember] = useState<{ name: string; role: ProjectMember['role'] }>({
    name: '',
    role: 'member',
  });

  useEffect(() => {
    if (!projectId || membersLoadedProjectId !== projectId) return;

    const timeoutId = setTimeout(() => {
      void syncProjectMembers(projectId, members);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [members, membersLoadedProjectId, projectId]);

  const handleAddMember = () => {
    if (!newMember.name.trim()) return;

    const member: ProjectMember = {
      id: generateId(),
      projectId: projectId!,
      name: newMember.name,
      role: newMember.role,
      createdAt: new Date().toISOString(),
    };

    addMember(member);
    setShowAddModal(false);
    setNewMember({ name: '', role: 'member' });
  };

  const handleDeleteMember = (id: string) => {
    if (confirm('멤버를 삭제하시겠습니까?')) {
      removeMember(id);
    }
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
            <div className="mt-8">
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4" />
                멤버 추가
              </Button>
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
          <Button variant="outline" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            멤버 추가
          </Button>
        </div>

        {members.length > 0 ? (
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {members.map((member) => (
              <div
                key={member.id}
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
                    className="field-select w-auto min-w-[8rem] py-2"
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {editingId !== member.id && (
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleStartEdit(member)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member.id)}
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
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              첫 멤버 추가
            </Button>
          </div>
        )}
      </section>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="멤버 추가"
        size="sm"
      >
        <div className="space-y-5 p-6">
          <div>
            <label className="field-label">이름 *</label>
            <input
              type="text"
              value={newMember.name}
              onChange={(event) => setNewMember({ ...newMember, name: event.target.value })}
              className="field-input"
              placeholder="멤버 이름을 입력하세요"
              autoFocus
            />
          </div>

          <div>
            <label className="field-label">역할</label>
            <select
              value={newMember.role}
              onChange={(event) => setNewMember({ ...newMember, role: event.target.value as ProjectMember['role'] })}
              className="field-select"
            >
              <option value="member">멤버</option>
              <option value="admin">관리자</option>
              <option value="viewer">뷰어</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              취소
            </Button>
            <Button onClick={handleAddMember} disabled={!newMember.name.trim()}>
              추가
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
