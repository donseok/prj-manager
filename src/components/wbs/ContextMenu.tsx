import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Copy,
  ClipboardPaste,
  ChevronRight as IndentIcon,
  ChevronLeft as OutdentIcon,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Task } from '../../types';

export interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  dividerAfter?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  task: Task;
  onClose: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onMarkComplete: () => void;
  canPaste: boolean;
  canIndent: boolean;
  canOutdent: boolean;
}

export default function ContextMenu({
  x,
  y,
  task,
  onClose,
  onAddAbove,
  onAddBelow,
  onAddChild,
  onDelete,
  onCopy,
  onPaste,
  onIndent,
  onOutdent,
  onMarkComplete,
  canPaste,
  canIndent,
  canOutdent,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const el = menuRef.current;
    if (rect.right > window.innerWidth) {
      el.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const actions: ContextMenuAction[] = [
    { label: '위에 작업 추가', icon: <Plus className="w-3.5 h-3.5" />, onClick: onAddAbove },
    { label: '아래에 작업 추가', icon: <Plus className="w-3.5 h-3.5" />, onClick: onAddBelow },
    {
      label: '하위 작업 추가',
      icon: <Plus className="w-3.5 h-3.5" />,
      onClick: onAddChild,
      disabled: task.level >= 4,
      dividerAfter: true,
    },
    { label: '복사', icon: <Copy className="w-3.5 h-3.5" />, onClick: onCopy },
    {
      label: '붙여넣기',
      icon: <ClipboardPaste className="w-3.5 h-3.5" />,
      onClick: onPaste,
      disabled: !canPaste,
      dividerAfter: true,
    },
    {
      label: '들여쓰기',
      icon: <IndentIcon className="w-3.5 h-3.5" />,
      onClick: onIndent,
      disabled: !canIndent,
    },
    {
      label: '내어쓰기',
      icon: <OutdentIcon className="w-3.5 h-3.5" />,
      onClick: onOutdent,
      disabled: !canOutdent,
      dividerAfter: true,
    },
    {
      label: '완료 처리',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      onClick: onMarkComplete,
      disabled: task.status === 'completed',
      dividerAfter: true,
    },
    {
      label: '삭제',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: onDelete,
      danger: true,
    },
  ];

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[200px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[color:var(--menu-surface)] py-1 shadow-[0_20px_48px_-14px_rgba(0,0,0,0.32)]"
      style={{ top: y, left: x }}
    >
      {actions.map((action, idx) => (
        <div key={idx}>
          <button
            onClick={() => {
              if (!action.disabled) {
                action.onClick();
                onClose();
              }
            }}
            disabled={action.disabled}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
              action.disabled
                ? 'cursor-not-allowed text-[color:var(--menu-muted)] opacity-40'
                : action.danger
                  ? 'text-[color:var(--accent-danger)] hover:bg-[rgba(203,75,95,0.08)]'
                  : 'text-[color:var(--menu-text)] hover:bg-[rgba(15,118,110,0.08)]'
            )}
          >
            {action.icon}
            {action.label}
          </button>
          {action.dividerAfter && (
            <div className="mx-2 my-1 border-t border-[var(--border-color)]" />
          )}
        </div>
      ))}
    </div>,
    document.body
  );
}
