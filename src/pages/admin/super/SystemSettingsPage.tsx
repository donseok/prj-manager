import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useSystemSettingsStore } from '../../../store/systemSettingsStore';
import FeedbackNotice from '../../../components/common/FeedbackNotice';
import { usePageFeedback } from '../../../hooks/usePageFeedback';

export default function SystemSettingsPage() {
  const { settings, setSettings } = useSystemSettingsStore();
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const [saving, setSaving] = useState(false);

  const handlePolicyChange = async (policy: 'all' | 'admin_only') => {
    if (saving || settings.projectCreationPolicy === policy) return;
    setSaving(true);
    try {
      await setSettings({ ...settings, projectCreationPolicy: policy });
      showFeedback({
        tone: 'success',
        title: '정책이 변경되었습니다',
        message: policy === 'all' ? '모든 사용자가 프로젝트를 생성할 수 있습니다.' : '관리자만 프로젝트를 생성할 수 있습니다.',
      });
    } catch {
      showFeedback({ tone: 'error', title: '정책 변경 실패', message: '다시 시도해주세요.' });
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { key: 'all' as const, title: '모든 사용자', desc: '로그인한 모든 사용자가 새 프로젝트를 만들 수 있습니다.' },
    { key: 'admin_only' as const, title: '관리자만', desc: '시스템 관리자만 새 프로젝트를 만들 수 있습니다.' },
  ];

  return (
    <section className="app-panel space-y-6 p-6">
      <header>
        <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">시스템 설정</h2>
        <p className="text-sm text-[color:var(--text-secondary)]">전사에 적용되는 정책을 관리합니다.</p>
      </header>

      {feedback && (
        <FeedbackNotice tone={feedback.tone} title={feedback.title} message={feedback.message} onClose={clearFeedback} />
      )}

      <div className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">프로젝트 생성 정책</h3>
            <p className="text-sm text-[color:var(--text-secondary)]">누가 새 프로젝트를 만들 수 있는지 결정합니다.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const isSelected = settings.projectCreationPolicy === option.key;
            return (
              <button
                key={option.key}
                onClick={() => void handlePolicyChange(option.key)}
                disabled={isSelected || saving}
                className={`rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.06)]'
                    : 'border-[var(--border-color)] hover:bg-[color:var(--bg-tertiary)]'
                } disabled:cursor-default`}
              >
                <p className="font-medium text-[color:var(--text-primary)]">
                  {option.title}
                  {isSelected && <span className="ml-2 text-xs font-semibold text-[color:var(--accent-primary)]">현재</span>}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{option.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
