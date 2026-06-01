import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Crown, KeyRound, Loader2, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import FeedbackNotice from '../../../components/common/FeedbackNotice';
import { usePageFeedback } from '../../../hooks/usePageFeedback';
import { loadProjectMembers, syncProjectMembers } from '../../../lib/dataRepository';
import { loadAllProfiles } from '../../../lib/supabase';
import { logAuditEvent } from '../../../lib/auditLog';
import { useAuthStore } from '../../../store/authStore';
import { generateId, cn } from '../../../lib/utils';
import { findOrphanMemberForProfile, resolveAdminRevoke } from './projectAdminAssignment';
import type { Project, ProjectMember, SystemRole } from '../../../types';

interface Profile {
  id: string;
  email: string;
  name: string;
  systemRole: SystemRole;
}

interface AssignProjectAdminModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignProjectAdminModal({ project, isOpen, onClose }: AssignProjectAdminModalProps) {
  const { user } = useAuthStore();
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [adminsOnly, setAdminsOnly] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [m, p] = await Promise.all([
      loadProjectMembers(project.id),
      loadAllProfiles(),
    ]);
    setMembers(m);
    setProfiles(p.filter((row) => row.accountStatus === 'active'));
    setLoading(false);
  }, [project.id]);

  useEffect(() => {
    if (!isOpen) return;
    clearFeedback();
    setQuery('');
    void reload();
  }, [isOpen, reload, clearFeedback]);

  const currentAdmins = useMemo(
    () => members.filter((m) => m.role === 'owner' || m.role === 'admin'),
    [members],
  );

  const memberByUserId = useMemo(() => {
    const map = new Map<string, ProjectMember>();
    for (const m of members) if (m.userId) map.set(m.userId, m);
    return map;
  }, [members]);

  // 배정 가능 후보: 현재 관리자/소유자가 아닌 활성 사용자
  const candidates = useMemo(() => {
    return profiles.filter((p) => {
      const existing = memberByUserId.get(p.id);
      if (existing && (existing.role === 'admin' || existing.role === 'owner')) return false;
      if (adminsOnly && p.systemRole !== 'admin' && p.systemRole !== 'superadmin') return false;
      return true;
    });
  }, [profiles, memberByUserId, adminsOnly]);

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((p) =>
      p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const assignAdmin = async (profile: Profile) => {
    if (!user) return;
    setBusyUserId(profile.id);
    try {
      // userId로 인덱싱된 멤버가 없으면, 같은 인물의 orphan(user_id 미연결) 행을
      // 이름/이메일로 매칭한다. 매칭되면 중복 행을 만들지 않고 해당 행을 승격한다. (M-4)
      const existing = memberByUserId.get(profile.id) ?? findOrphanMemberForProfile(members, profile);
      let next: ProjectMember[];
      let auditDetails: string;
      let auditAction: 'member.add' | 'member.role_change';

      if (existing) {
        const previousRole = existing.role;
        // 관리자 해제 시 복원할 이전 역할을 기록한다. 단 이미 admin/owner였다면
        // 복원 대상이 없으므로 기록하지 않는다. (M-6)
        const shouldRecordPrev = previousRole !== 'admin' && previousRole !== 'owner';
        next = members.map((m) =>
          m.id === existing.id
            ? {
                ...m,
                userId: profile.id,
                role: 'admin' as const,
                name: profile.name || m.name,
                ...(shouldRecordPrev ? { previousRole } : {}),
              }
            : m,
        );
        auditAction = 'member.role_change';
        auditDetails = `슈퍼관리자가 "${profile.name}" 역할 변경: ${previousRole} → admin`;
      } else {
        const newMember: ProjectMember = {
          id: generateId(),
          projectId: project.id,
          userId: profile.id,
          name: profile.name,
          role: 'admin',
          createdAt: new Date().toISOString(),
        };
        next = [...members, newMember];
        auditAction = 'member.add';
        auditDetails = `슈퍼관리자가 "${profile.name}"을(를) 관리자(admin)로 배정`;
      }

      await syncProjectMembers(project.id, next);
      setMembers(next);

      await logAuditEvent({
        projectId: project.id,
        userId: user.id,
        userName: user.name,
        action: auditAction,
        details: auditDetails,
      });

      showFeedback({
        tone: 'success',
        title: '배정 완료',
        message: `${profile.name} 님을 ${project.name} 관리자로 배정했습니다.`,
      });
    } catch (e) {
      showFeedback({
        tone: 'error',
        title: '배정 실패',
        message: e instanceof Error ? e.message : '알 수 없는 오류',
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const revokeAdmin = async (member: ProjectMember) => {
    if (!user) return;
    if (member.role === 'owner') return;
    setBusyUserId(member.userId || member.id);
    try {
      // 관리자로 신규 추가된 멤버는 멤버십을 제거하고, 기존 멤버를 승격한 경우는
      // 이전 역할로 복원한다 ('해제' 라벨대로 멤버십을 통째로 잃지 않도록). (M-6)
      const decision = resolveAdminRevoke(member);
      let next: ProjectMember[];
      let auditAction: 'member.remove' | 'member.role_change';
      let auditDetails: string;

      if (decision.action === 'restore') {
        next = members.map((m) =>
          m.id === member.id
            ? { ...m, role: decision.role, previousRole: undefined }
            : m,
        );
        auditAction = 'member.role_change';
        auditDetails = `슈퍼관리자가 관리자 "${member.name}" 해제 → ${decision.role} 복원`;
      } else {
        next = members.filter((m) => m.id !== member.id);
        auditAction = 'member.remove';
        auditDetails = `슈퍼관리자가 관리자 "${member.name}" 배정 해제`;
      }

      await syncProjectMembers(project.id, next);
      setMembers(next);

      await logAuditEvent({
        projectId: project.id,
        userId: user.id,
        userName: user.name,
        action: auditAction,
        details: auditDetails,
      });

      showFeedback({
        tone: 'success',
        title: '해제 완료',
        message: `${member.name} 님의 관리자 배정을 해제했습니다.`,
      });
    } catch (e) {
      showFeedback({
        tone: 'error',
        title: '해제 실패',
        message: e instanceof Error ? e.message : '알 수 없는 오류',
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const roleBadge = (role: ProjectMember['role']) => {
    if (role === 'owner') return { label: 'Owner', icon: Crown, cls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' };
    return { label: 'Admin', icon: ShieldCheck, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="프로젝트 관리자 배정" size="2xl">
      <div className="space-y-5 p-6">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">대상 프로젝트</p>
          <p className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">{project.name}</p>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-xs text-[color:var(--text-secondary)]">{project.description}</p>
          )}
          <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
            슈퍼관리자가 배정하면 별도 승인 없이 즉시 해당 프로젝트의 관리자(admin) 권한이 부여됩니다.
          </p>
        </div>

        {feedback && (
          <FeedbackNotice
            tone={feedback.tone}
            title={feedback.title}
            message={feedback.message}
            onClose={clearFeedback}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--text-muted)]" />
          </div>
        ) : (
          <>
            <section>
              <header className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[color:var(--accent-primary)]" />
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">현재 관리자</h3>
                <span className="text-xs text-[color:var(--text-muted)]">({currentAdmins.length}명)</span>
              </header>
              {currentAdmins.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border-color)] px-4 py-6 text-center text-xs text-[color:var(--text-muted)]">
                  아직 배정된 관리자가 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {currentAdmins.map((member) => {
                    const badge = roleBadge(member.role);
                    const Icon = badge.icon;
                    const isBusy = busyUserId === (member.userId || member.id);
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-secondary)] px-4 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-bold text-white">
                            {member.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{member.name}</p>
                            <p className="truncate text-xs text-[color:var(--text-muted)]">
                              {member.userId ? '계정 연결됨' : '로컬 멤버 (계정 미연결)'}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase', badge.cls)}>
                            <Icon className="h-3 w-3" />
                            {badge.label}
                          </span>
                          {member.role === 'admin' ? (
                            <button
                              onClick={() => void revokeAdmin(member)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 transition-all hover:-translate-y-0.5 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400"
                            >
                              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                              해제
                            </button>
                          ) : (
                            <span className="text-[11px] text-[color:var(--text-muted)]">소유자 — 해제 불가</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-[color:var(--accent-primary)]" />
                  <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">관리자로 배정할 사용자</h3>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={adminsOnly}
                    onChange={(e) => setAdminsOnly(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[color:var(--accent-primary)]"
                  />
                  관리자/슈퍼관리자만 표시
                </label>
              </header>

              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="이름 또는 이메일로 검색..."
                  className="field-input w-full py-2.5 pl-9"
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)]">
                {filteredCandidates.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-[color:var(--text-muted)]">
                    {candidates.length === 0
                      ? adminsOnly
                        ? '배정 가능한 관리자 계정이 없습니다.'
                        : '배정 가능한 사용자가 없습니다.'
                      : '검색 결과가 없습니다.'}
                  </p>
                ) : (
                  filteredCandidates.map((profile) => {
                    const existing = memberByUserId.get(profile.id);
                    const isBusy = busyUserId === profile.id;
                    return (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-2.5 last:border-b-0 hover:bg-[color:var(--bg-secondary)]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-bold text-white">
                            {profile.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                              {profile.name}
                              {profile.systemRole === 'superadmin' && (
                                <span className="ml-2 inline-flex rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                  슈퍼
                                </span>
                              )}
                              {profile.systemRole === 'admin' && (
                                <span className="ml-2 inline-flex rounded bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                                  관리자
                                </span>
                              )}
                              {existing && (
                                <span className="ml-2 inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                  현재 {existing.role}
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-[color:var(--text-muted)]">{profile.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => void assignAdmin(profile)}
                          disabled={isBusy}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[color:var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          {existing ? '관리자로 변경' : '배정'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-[color:var(--text-muted)]">
                <KeyRound className="h-3 w-3" />
                관리자로 배정되면 해당 프로젝트의 멤버·작업·설정을 편집할 수 있습니다.
              </p>
            </section>
          </>
        )}

        <div className="flex items-center justify-end border-t border-[var(--border-color)] pt-4">
          <Button variant="ghost" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </Modal>
  );
}
