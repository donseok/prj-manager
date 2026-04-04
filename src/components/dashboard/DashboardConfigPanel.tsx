import { useRef, useState, useCallback, type DragEvent } from 'react';
import { X, GripVertical, RotateCcw } from 'lucide-react';
import { useDashboardConfigStore, type DashboardWidget } from '../../store/dashboardConfigStore';
import { cn } from '../../lib/utils';

interface DashboardConfigPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function DashboardConfigPanel({ open, onClose }: DashboardConfigPanelProps) {
  const { widgets, setWidgetVisibility, reorderWidgets, resetToDefault } = useDashboardConfigStore();
  const sorted = [...widgets].sort((a, b) => a.order - b.order);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLLIElement | null>(null);

  const handleDragStart = useCallback((e: DragEvent<HTMLLIElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.4';
      }
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      reorderWidgets(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, [dragIndex, dragOverIndex, reorderWidgets]);

  const handleDragOver = useCallback((e: DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-[color:var(--bg-primary)] shadow-2xl transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-5">
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
            대시보드 설정
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="mb-5 text-sm leading-6 text-[color:var(--text-secondary)]">
            위젯의 표시 여부와 순서를 설정합니다. 드래그하여 순서를 변경할 수 있습니다.
          </p>

          <ul className="space-y-2">
            {sorted.map((widget: DashboardWidget, index: number) => (
              <li
                key={widget.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3 transition-all',
                  dragOverIndex === index && dragIndex !== index && 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.04)]'
                )}
              >
                <button
                  type="button"
                  className="cursor-grab touch-none text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] active:cursor-grabbing"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <span className="flex-1 text-sm font-medium text-[color:var(--text-primary)]">
                  {widget.label}
                </span>
                {/* Toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={widget.visible}
                  onClick={() => setWidgetVisibility(widget.id, !widget.visible)}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
                    widget.visible
                      ? 'bg-[color:var(--accent-primary)]'
                      : 'bg-[color:var(--bg-tertiary)]'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                      widget.visible ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-color)] px-6 py-4">
          <button
            onClick={() => {
              resetToDefault();
            }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
          >
            <RotateCcw className="h-4 w-4" />
            기본값 복원
          </button>
        </div>
      </div>
    </>
  );
}
