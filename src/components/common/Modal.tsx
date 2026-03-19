import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#0c1016]/62 backdrop-blur-xl animate-fade-in"
        onClick={onClose}
      />

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[30px] border border-white/10 bg-[image:var(--gradient-surface)] shadow-[0_52px_120px_-56px_rgba(0,0,0,0.72)] backdrop-blur-2xl animate-scale-in dark:border-[var(--border-color)]',
          sizes[size]
        )}
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.2),transparent_70%)] blur-3xl" />

        {title && (
          <div className="relative flex items-center justify-between border-b border-[var(--border-color)] px-6 py-5">
            <div>
              <p className="page-kicker text-[0.62rem]">Workspace Dialog</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-secondary-solid)] hover:text-[color:var(--text-primary)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className={cn(!title && 'pt-4')}>{children}</div>
      </div>
    </div>
  );
}
