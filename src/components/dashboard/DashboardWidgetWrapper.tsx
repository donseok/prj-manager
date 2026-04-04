import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface DashboardWidgetWrapperProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export default function DashboardWidgetWrapper({ label, children, className }: DashboardWidgetWrapperProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          'pointer-events-none absolute -top-3 left-4 z-10 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-0.5 text-[11px] font-medium text-[color:var(--text-secondary)] shadow-sm transition-all duration-200',
          hovered ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
        )}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
