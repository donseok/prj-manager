import type { RecurringRule } from '../types';
import { storage } from './utils';

const STORAGE_KEY = 'dk-flow-recurring-rules';

export function loadRecurringRules(projectId: string): RecurringRule[] {
  const all = storage.get<RecurringRule[]>(STORAGE_KEY, []);
  return all.filter((r) => r.projectId === projectId);
}

export function saveRecurringRule(rule: RecurringRule): void {
  const all = storage.get<RecurringRule[]>(STORAGE_KEY, []);
  const idx = all.findIndex((r) => r.id === rule.id);
  if (idx >= 0) {
    all[idx] = rule;
  } else {
    all.push(rule);
  }
  storage.set(STORAGE_KEY, all);
}

export function deleteRecurringRule(ruleId: string): void {
  const all = storage.get<RecurringRule[]>(STORAGE_KEY, []);
  storage.set(
    STORAGE_KEY,
    all.filter((r) => r.id !== ruleId)
  );
}

export function updateRecurringRules(updatedRules: RecurringRule[]): void {
  const all = storage.get<RecurringRule[]>(STORAGE_KEY, []);
  const idMap = new Map(updatedRules.map((r) => [r.id, r]));
  const updated = all.map((r) => idMap.get(r.id) ?? r);
  storage.set(STORAGE_KEY, updated);
}
