import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import { isSupabaseConfigured, deleteUserAccount } from '../lib/supabase';
import { loadOwnedProjectIds, deleteAllOwnedProjects, removeUserFromAllProjects } from '../lib/dataRepository';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import { usePageFeedback } from '../hooks/usePageFeedback';

const CONFIRM_TEXT = '회원탈퇴';

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuthStore();
  const { projects } = useProjectStore();
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [ownedCount, setOwnedCount] = useState<number | null>(null);

  const ownedProjects = useMemo(
    () => projects.filter((p) => p.ownerId === user?.id && p.status !== 'deleted'),
    [projects, user?.id]
  );

  const isConfirmValid = confirmText === CONFIRM_TEXT && (!isSupabaseConfigured || password.length > 0);

  const handleOpenDeleteModal = async () => {
    if (!user) return;
    setShowDeleteModal(true);
    setPassword('');
    setConfirmText('');

    const ids = await loadOwnedProjectIds(user.id);
    setOwnedCount(ids.length);
  };

  const handleDeleteAccount = async () => {
    if (!user || !isConfirmValid) return;
    setIsDeleting(true);

    try {
      const { error } = await deleteUserAccount(user.id, user.email, password, {
        deleteAllOwned: deleteAllOwnedProjects,
        removeFromAll: removeUserFromAllProjects,
      });

      if (error) {
        showFeedback({ tone: 'error', title: '회원 탈퇴 실패', message: error });
        setIsDeleting(false);
        return;
      }

      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Account deletion error:', err);
      showFeedback({
        tone: 'error',
        title: '회원 탈퇴 실패',
        message: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      {feedback && (
        <FeedbackNotice
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={clearFeedback}
        />
      )}

      {/* 계정 정보 */}
      <section className="app-panel p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_18px_40px_-24px_rgba(15,118,110,0.8)]">
            <UserCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              계정 설정
            </h1>
            <p className="text-sm text-[color:var(--text-secondary)]">
              계정 정보 확인 및 관리
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                이름
              </p>
              <p className="mt-1 font-medium text-[color:var(--text-primary)]">{user.name}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                이메일
              </p>
              <p className="mt-1 font-medium text-[color:var(--text-primary)]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                역할
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-medium text-[color:var(--text-primary)]">
                {isAdmin && <ShieldCheck className="h-4 w-4 text-[color:var(--accent-primary)]" />}
                {isAdmin ? '관리자' : '일반 사용자'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                소유 프로젝트
              </p>
              <p className="mt-1 font-medium text-[color:var(--text-primary)]">{ownedProjects.length}개</p>
            </div>
          </div>
        </div>
      </section>

      {/* 회원 탈퇴 */}
      <section className="app-panel border-[rgba(203,75,95,0.2)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[rgba(203,75,95,0.1)] text-[color:var(--accent-danger)]">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--accent-danger)]">회원 탈퇴</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              계정과 관련 데이터를 영구적으로 삭제합니다
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[18px] border border-[rgba(203,75,95,0.15)] bg-[rgba(203,75,95,0.04)] p-4">
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
            회원 탈퇴 시 다음 데이터가 <strong className="text-[color:var(--accent-danger)]">영구 삭제</strong>됩니다:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--text-secondary)]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-danger)]" />
              소유한 프로젝트 및 WBS/작업 데이터 ({ownedProjects.length}개)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-danger)]" />
              프로젝트 멤버 참여 내역
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-danger)]" />
              계정 프로필 정보
            </li>
          </ul>
          <p className="mt-3 text-xs font-medium text-[color:var(--accent-danger)]">
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="danger" onClick={() => void handleOpenDeleteModal()}>
            <Trash2 className="h-4 w-4" />
            회원 탈퇴
          </Button>
        </div>
      </section>

      {/* 회원 탈퇴 확인 모달 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title="회원 탈퇴 확인"
        size="md"
      >
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(203,75,95,0.12)] text-[color:var(--accent-danger)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
                정말로 탈퇴하시겠습니까? 계정과 관련된 모든 데이터가 영구적으로 삭제됩니다.
              </p>
              {ownedCount !== null && ownedCount > 0 && (
                <p className="mt-2 text-sm font-semibold text-[color:var(--accent-danger)]">
                  소유 프로젝트 {ownedCount}개가 함께 삭제됩니다.
                </p>
              )}
            </div>
          </div>

          {isSupabaseConfigured && (
            <div>
              <label className="field-label">비밀번호 확인</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input !pr-10"
                  placeholder="현재 비밀번호를 입력해주세요"
                  disabled={isDeleting}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="field-label">
              확인을 위해 <strong className="text-[color:var(--accent-danger)]">{CONFIRM_TEXT}</strong>을 입력해주세요
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="field-input"
              placeholder={CONFIRM_TEXT}
              disabled={isDeleting}
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleDeleteAccount()}
              disabled={!isConfirmValid || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                '회원 탈퇴'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
