import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Copy,
  ClipboardPaste,
  ChevronRight as IndentIcon,
  ChevronLeft as OutdentIcon,
  ArrowUp,
  ArrowDown,
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
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMarkComplete: () => void;
  canPaste: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
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
  onMoveUp,
  onMoveDown,
  onMarkComplete,
  canPaste,
  canIndent,
  canOutdent,
  canMoveUp,
  canMoveDown,
}: ContextMenuProps) {
  const { t } = useTranslation();
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
    { label: t('wbsComponents.contextMenu.addAbove'), icon: <Plus className="w-3.5 h-3.5" />, onClick: onAddAbove },
    { label: t('wbsComponents.contextMenu.addBelow'), icon: <Plus className="w-3.5 h-3.5" />, onClick: onAddBelow },
    {
      label: t('wbsComponents.contextMenu.addChild'),
      icon: <Plus className="w-3.5 h-3.5" />,
      onClick: onAddChild,
      disabled: task.level >= 4,
      dividerAfter: true,
    },
    { label: t('wbsComponents.contextMenu.copy'), icon: <Copy className="w-3.5 h-3.5" />, onClick: onCopy },
    {
      label: t('wbsComponents.contextMenu.paste'),
      icon: <ClipboardPaste className="w-3.5 h-3.5" />,
      onClick: onPaste,
      disabled: !canPaste,
      dividerAfter: true,
    },
    {
      label: t('wbsComponents.contextMenu.indent'),
      icon: <IndentIcon className="w-3.5 h-3.5" />,
      onClick: onIndent,
      disabled: !canIndent,
    },
    {
      label: t('wbsComponents.contextMenu.outdent'),
      icon: <OutdentIcon className="w-3.5 h-3.5" />,
      onClick: onOutdent,
      disabled: !canOutdent,
    },
    {
      label: t('wbsComponents.contextMenu.moveUp'),
      icon: <ArrowUp className="w-3.5 h-3.5" />,
      onClick: onMoveUp,
      disabled: !canMoveUp,
    },
    {
      label: t('wbsComponents.contextMenu.moveDown'),
      icon: <ArrowDown className="w-3.5 h-3.5" />,
      onClick: onMoveDown,
      disabled: !canMoveDown,
      dividerAfter: true,
    },
    {
      label: t('wbsComponents.contextMenu.markComplete'),
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      onClick: onMarkComplete,
      disabled: task.status === 'completed',
      dividerAfter: true,
    },
    {
      label: t('wbsComponents.contextMenu.delete'),
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
