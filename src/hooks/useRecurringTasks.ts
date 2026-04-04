import { useEffect, useRef } from 'react';
import { useTaskStore } from '../store/taskStore';
import { loadRecurringRules, updateRecurringRules } from '../lib/recurringRulesStorage';
import { generateRecurringTasks } from '../lib/recurringTasks';

/**
 * Hook that checks and auto-generates recurring tasks when entering a project page.
 * Returns the number of tasks generated (for toast notification).
 */
export function useRecurringTasks(
  projectId: string | undefined,
  onGenerated?: (count: number) => void
) {
  const hasChecked = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    // Only check once per project load
    if (hasChecked.current === projectId) return;
    hasChecked.current = projectId;

    const rules = loadRecurringRules(projectId);
    if (rules.length === 0) return;

    const { tasks, setTasks } = useTaskStore.getState();
    const { tasks: newTasks, updatedRules } = generateRecurringTasks(
      rules,
      tasks,
      new Date()
    );

    if (newTasks.length > 0) {
      const allTasks = [...tasks, ...newTasks];
      setTasks(allTasks, undefined, { recordHistory: true });
      updateRecurringRules(updatedRules);
      onGenerated?.(newTasks.length);
    }
  }, [projectId, onGenerated]);
}
