import { useCallback, useRef, useState } from 'react';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';
import type { Task } from '../types';

export type DragMode = 'move' | 'resize-left' | 'resize-right';

export interface DragState {
  taskId: string;
  mode: DragMode;
  /** Current pixel offset from the original left position */
  deltaX: number;
  /** Original planStart as Date */
  originalStart: Date;
  /** Original planEnd as Date */
  originalEnd: Date;
  /** Snapped new planStart */
  newStart: Date;
  /** Snapped new planEnd */
  newEnd: Date;
}

export interface UseGanttDragOptions {
  dayWidth: number;
  allTasks: Task[];
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  isReadOnly?: boolean;
}

export function useGanttDrag({
  dayWidth,
  allTasks,
  onUpdate,
  isReadOnly = false,
}: UseGanttDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<{
    taskId: string;
    mode: DragMode;
    startMouseX: number;
    originalStart: Date;
    originalEnd: Date;
    originalDurationDays: number;
    rafId: number | null;
    lastDeltaX: number;
  } | null>(null);

  const isLeafTask = useCallback(
    (taskId: string) => {
      return !allTasks.some((t) => t.parentId === taskId);
    },
    [allTasks]
  );

  const snapToDay = useCallback(
    (deltaX: number): number => {
      return Math.round(deltaX / dayWidth) * dayWidth;
    },
    [dayWidth]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, task: Task, mode: DragMode) => {
      if (isReadOnly) return;
      if (!task.planStart || !task.planEnd) return;
      if (!isLeafTask(task.id)) return;

      e.preventDefault();
      e.stopPropagation();

      const originalStart = parseISO(task.planStart);
      const originalEnd = parseISO(task.planEnd);
      const originalDurationDays = differenceInDays(originalEnd, originalStart);

      dragRef.current = {
        taskId: task.id,
        mode,
        startMouseX: e.clientX,
        originalStart,
        originalEnd,
        originalDurationDays,
        rafId: null,
        lastDeltaX: 0,
      };

      setDragState({
        taskId: task.id,
        mode,
        deltaX: 0,
        originalStart,
        originalEnd,
        newStart: originalStart,
        newEnd: originalEnd,
      });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return;

        const rawDeltaX = moveEvent.clientX - dragRef.current.startMouseX;
        const snappedDeltaX = snapToDay(rawDeltaX);

        if (snappedDeltaX === dragRef.current.lastDeltaX) return;
        dragRef.current.lastDeltaX = snappedDeltaX;

        if (dragRef.current.rafId !== null) {
          cancelAnimationFrame(dragRef.current.rafId);
        }

        dragRef.current.rafId = requestAnimationFrame(() => {
          if (!dragRef.current) return;

          const daysDelta = Math.round(snappedDeltaX / dayWidth);
          const ref = dragRef.current;
          let newStart: Date;
          let newEnd: Date;

          switch (ref.mode) {
            case 'move':
              newStart = addDays(ref.originalStart, daysDelta);
              newEnd = addDays(ref.originalEnd, daysDelta);
              break;
            case 'resize-left': {
              newStart = addDays(ref.originalStart, daysDelta);
              newEnd = ref.originalEnd;
              // Prevent start from going past end
              if (differenceInDays(newEnd, newStart) < 0) {
                newStart = newEnd;
              }
              break;
            }
            case 'resize-right': {
              newStart = ref.originalStart;
              newEnd = addDays(ref.originalEnd, daysDelta);
              // Prevent end from going before start
              if (differenceInDays(newEnd, newStart) < 0) {
                newEnd = newStart;
              }
              break;
            }
          }

          setDragState({
            taskId: ref.taskId,
            mode: ref.mode,
            deltaX: snappedDeltaX,
            originalStart: ref.originalStart,
            originalEnd: ref.originalEnd,
            newStart,
            newEnd,
          });
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        if (dragRef.current?.rafId !== null) {
          cancelAnimationFrame(dragRef.current!.rafId!);
        }

        // Apply the final state
        const ref = dragRef.current;
        if (ref) {
          const daysDelta = Math.round(ref.lastDeltaX / dayWidth);

          if (daysDelta !== 0) {
            let newStart: Date;
            let newEnd: Date;

            switch (ref.mode) {
              case 'move':
                newStart = addDays(ref.originalStart, daysDelta);
                newEnd = addDays(ref.originalEnd, daysDelta);
                break;
              case 'resize-left':
                newStart = addDays(ref.originalStart, daysDelta);
                newEnd = ref.originalEnd;
                if (differenceInDays(newEnd, newStart) < 0) {
                  newStart = newEnd;
                }
                break;
              case 'resize-right':
                newStart = ref.originalStart;
                newEnd = addDays(ref.originalEnd, daysDelta);
                if (differenceInDays(newEnd, newStart) < 0) {
                  newEnd = newStart;
                }
                break;
            }

            onUpdate(ref.taskId, {
              planStart: format(newStart, 'yyyy-MM-dd'),
              planEnd: format(newEnd, 'yyyy-MM-dd'),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        dragRef.current = null;
        setDragState(null);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [dayWidth, isLeafTask, isReadOnly, onUpdate, snapToDay]
  );

  const getDragLabel = useCallback((state: DragState): string => {
    return `${format(state.newStart, 'MM/dd')} ~ ${format(state.newEnd, 'MM/dd')}`;
  }, []);

  return {
    dragState,
    handleMouseDown,
    isLeafTask,
    getDragLabel,
  };
}
