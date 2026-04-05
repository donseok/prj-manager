import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const { t } = useTranslation();
    const baseStyles =
      'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[rgba(15,118,110,0.28)] focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';

    const variants = {
      primary:
        'border border-white/10 bg-[image:var(--gradient-primary)] text-white shadow-[0_24px_48px_-24px_rgba(15,118,110,0.85)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0',
      secondary:
        'border border-[var(--border-color)] bg-[image:var(--gradient-secondary)] text-[var(--bg-inverse)] shadow-[0_20px_45px_-26px_rgba(203,109,55,0.7)] hover:-translate-y-0.5 hover:saturate-125',
      outline:
        'border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-[rgba(15,118,110,0.28)] hover:bg-[color:var(--bg-secondary-solid)]',
      ghost:
        'bg-transparent text-[color:var(--text-secondary)] hover:bg-black/5 hover:text-[color:var(--text-primary)] dark:hover:bg-white/6 dark:hover:text-[color:var(--text-primary)]',
      danger:
        'border border-white/10 bg-[linear-gradient(135deg,#cb4b5f,#a83653)] text-white shadow-[0_22px_44px_-24px_rgba(203,75,95,0.86)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-5 py-3 text-sm',
      lg: 'px-6 py-3.5 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {t('common.loading')}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
