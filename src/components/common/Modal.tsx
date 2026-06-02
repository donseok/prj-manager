import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'fullscreen';
  density?: 'default' | 'compact';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', density = 'default' }: ModalProps) {
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
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    fullscreen: 'max-w-none',
  };

  const isFullscreen = size === 'fullscreen';
  const isCompact = density === 'compact';

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center', !isFullscreen && (isCompact ? 'p-3' : 'p-4'))}>
      <div
        className="absolute inset-0 bg-[#0c1016]/62 backdrop-blur-xl animate-fade-in"
        onClick={onClose}
      />

      <div
        className={cn(
          'relative w-full overflow-hidden border border-white/10 bg-[image:var(--gradient-surface)] shadow-[0_52px_120px_-56px_rgba(0,0,0,0.72)] backdrop-blur-2xl animate-scale-in dark:border-[var(--border-color)]',
          isFullscreen ? 'flex h-full flex-col rounded-none' : isCompact ? 'rounded-[22px]' : 'rounded-[30px]',
          sizes[size]
        )}
      >
        <div className={cn(
          'pointer-events-none absolute top-0 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.2),transparent_70%)] blur-3xl',
          isCompact ? 'inset-x-8 h-16' : 'inset-x-10 h-24'
        )} />

        {(title || isFullscreen) && (
          <div className={cn(
            'relative flex items-center justify-between border-b border-[var(--border-color)]',
            isCompact ? 'px-4 py-3' : 'px-6 py-5'
          )}>
            <div>
              <p className={cn('page-kicker', isCompact ? 'text-[0.56rem]' : 'text-[0.62rem]')}>Workspace Dialog</p>
              {title && (
                <h2 className={cn(
                  'font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]',
                  isCompact ? 'mt-1 text-base' : 'mt-2 text-xl'
                )}>
                  {title}
                </h2>
              )}
            </div>
            <button
              onClick={onClose}
              className={cn(
                'flex items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-secondary-solid)] hover:text-[color:var(--text-primary)]',
                isCompact ? 'h-9 w-9' : 'h-11 w-11'
              )}
            >
              <X className={cn(isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
            </button>
          </div>
        )}

        <div className={cn(!title && 'pt-4', isFullscreen && 'flex-1 overflow-auto')} style={isFullscreen ? { height: 'calc(100% - 5rem)' } : undefined}>{children}</div>
      </div>
    </div>
  );
}
