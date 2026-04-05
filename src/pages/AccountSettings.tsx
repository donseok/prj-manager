import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

export default function AccountSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuthStore();
  const { projects } = useProjectStore();
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const CONFIRM_TEXT = t('account.confirmText');

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
        showFeedback({ tone: 'error', title: t('account.deleteFail'), message: error });
        setIsDeleting(false);
        return;
      }

      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Account deletion error:', err);
      showFeedback({
        tone: 'error',
        title: t('account.deleteFail'),
        message: t('account.deleteFailMsg'),
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
              {t('account.title')}
            </h1>
            <p className="text-sm text-[color:var(--text-secondary)]">
              {t('account.subtitle')}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                {t('account.nameLabel')}
              </p>
              <p className="mt-1 font-medium text-[color:var(--text-primary)]">{user.name}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                {t('account.emailLabel')}
              </p>
              <p className="mt-1 font-medium text-[color:var(--text-primary)]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                {t('account.roleLabel')}
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-medium text-[color:var(--text-primary)]">
                {isAdmin && <ShieldCheck className="h-4 w-4 text-[color:var(--accent-primary)]" />}
                {isAdmin ? t('account.admin') : t('account.normalUser')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                {t('account.ownedProjects')}
              </p>
              <p className="mt-1 font-medium text-[color:var(--text-primary)]">{t('account.projectCount', { count: ownedProjects.length })}</p>
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
            <h2 className="text-lg font-semibold text-[color:var(--accent-danger)]">{t('account.deleteAccount')}</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              {t('account.deleteAccountDesc')}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[18px] border border-[rgba(203,75,95,0.15)] bg-[rgba(203,75,95,0.04)] p-4">
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
            {t('account.deleteWarning')} <strong className="text-[color:var(--accent-danger)]">{t('account.permanentlyDeleted')}</strong>{t('account.deleteWarningEnd')}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--text-secondary)]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-danger)]" />
              {t('account.deleteItem1', { count: ownedProjects.length })}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-danger)]" />
              {t('account.deleteItem2')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-danger)]" />
              {t('account.deleteItem3')}
            </li>
          </ul>
          <p className="mt-3 text-xs font-medium text-[color:var(--accent-danger)]">
            {t('account.irreversible')}
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="danger" onClick={() => void handleOpenDeleteModal()}>
            <Trash2 className="h-4 w-4" />
            {t('account.deleteAccount')}
          </Button>
        </div>
      </section>

      {/* 회원 탈퇴 확인 모달 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title={t('account.deleteConfirmTitle')}
        size="md"
      >
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(203,75,95,0.12)] text-[color:var(--accent-danger)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
                {t('account.deleteConfirmMessage')}
              </p>
              {ownedCount !== null && ownedCount > 0 && (
                <p className="mt-2 text-sm font-semibold text-[color:var(--accent-danger)]">
                  {t('account.ownedProjectsWillBeDeleted', { count: ownedCount })}
                </p>
              )}
            </div>
          </div>

          {isSupabaseConfigured && (
            <div>
              <label className="field-label">{t('account.passwordConfirm')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input !pr-10"
                  placeholder={t('account.passwordPlaceholder')}
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
              {t('account.confirmTextLabel')} <strong className="text-[color:var(--accent-danger)]">{CONFIRM_TEXT}</strong>{t('account.confirmTextSuffix')}
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
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleDeleteAccount()}
              disabled={!isConfirmValid || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.processing')}
                </>
              ) : (
                t('account.deleteAccount')
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
