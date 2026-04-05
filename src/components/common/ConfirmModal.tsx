import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  icon?: ReactNode;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmVariant = 'danger',
  icon,
  isLoading = false,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel || t('common.confirm');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-5 p-6" data-testid="confirm-modal">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]">
            {icon || <AlertTriangle className="h-5 w-5" />}
          </div>
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{description}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading} data-testid="confirm-modal-cancel-button">
            {t('common.cancel')}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
            data-testid="confirm-modal-confirm-button"
          >
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
