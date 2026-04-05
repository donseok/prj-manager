import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkPlus } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { saveAsTemplate } from '../../lib/customTemplates';
import type { Task } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSaved?: (templateName: string) => void;
}

export default function SaveTemplateModal({ isOpen, onClose, tasks, onSaved }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  const phases = tasks.filter((t) => t.level === 1).length;
  const totalTasks = tasks.length;

  const handleSave = () => {
    if (!name.trim() || tasks.length === 0) return;
    saveAsTemplate(name.trim(), tasks);
    onSaved?.(name.trim());
    setName('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="WBS 템플릿 저장" size="md">
      <div className="p-6 space-y-5">
        {/* Template name */}
        <div>
          <label className="field-label">템플릿 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            placeholder={t('saveTemplate.namePlaceholder')}
            className="field-input mt-1"
            autoFocus
          />
        </div>

        {/* Preview */}
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">미리보기</p>
          <div className="mt-2 flex gap-4 text-sm text-[color:var(--text-secondary)]">
            <span>
              Phase: <span className="font-semibold text-[color:var(--text-primary)]">{phases}개</span>
            </span>
            <span>
              총 작업: <span className="font-semibold text-[color:var(--text-primary)]">{totalTasks}건</span>
            </span>
          </div>
          {tasks.length === 0 && (
            <p className="mt-2 text-xs text-[color:var(--accent-warning)]">
              저장할 작업이 없습니다. WBS에 작업을 먼저 추가해주세요.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || tasks.length === 0}>
            <BookmarkPlus className="w-4 h-4" />
            저장
          </Button>
        </div>
      </div>
    </Modal>
  );
}
