import type { Task, CustomTemplate } from '../types';
import { generateId, storage } from './utils';

const STORAGE_KEY = 'dk-flow-custom-templates';

/**
 * Load all custom templates from localStorage.
 */
export function loadCustomTemplates(): CustomTemplate[] {
  return storage.get<CustomTemplate[]>(STORAGE_KEY, []);
}

/**
 * Save a set of tasks as a custom template.
 */
export function saveAsTemplate(name: string, tasks: Task[]): CustomTemplate {
  const existing = loadCustomTemplates();

  const phases = tasks.filter((t) => t.level === 1).length;
  const taskCount = tasks.length;

  // Strip project-specific fields for template storage
  const templateTasks = tasks.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    level: t.level,
    orderIndex: t.orderIndex,
    name: t.name,
    description: t.description,
    output: t.output,
    assigneeId: null as string | null,
    weight: t.weight,
    durationDays: t.durationDays,
    predecessorIds: [],
    taskSource: 'template' as const,
    planStart: null as string | null,
    planEnd: null as string | null,
    planProgress: 0,
    actualStart: null as string | null,
    actualEnd: null as string | null,
    actualProgress: 0,
    status: 'pending' as const,
    isExpanded: true,
  }));

  const template: CustomTemplate = {
    id: generateId(),
    name,
    phases,
    taskCount,
    tasks: templateTasks,
    createdAt: new Date().toISOString(),
  };

  existing.push(template);
  storage.set(STORAGE_KEY, existing);

  return template;
}

/**
 * Delete a custom template by id.
 */
export function deleteCustomTemplate(id: string): void {
  const existing = loadCustomTemplates();
  storage.set(
    STORAGE_KEY,
    existing.filter((t) => t.id !== id)
  );
}

/**
 * Apply a custom template to a project, generating new tasks with fresh IDs.
 */
export function applyCustomTemplate(templateId: string, projectId: string): Task[] {
  const templates = loadCustomTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) throw new Error(`Custom template not found: ${templateId}`);

  const now = new Date().toISOString();
  // Map old IDs to new IDs for parent relationships
  const idMap = new Map<string, string>();
  template.tasks.forEach((t) => {
    idMap.set(t.id, generateId());
  });

  return template.tasks.map((t) => ({
    ...t,
    id: idMap.get(t.id) || generateId(),
    projectId,
    parentId: t.parentId ? (idMap.get(t.parentId) ?? null) : null,
    assigneeId: null,
    planStart: null,
    planEnd: null,
    planProgress: 0,
    actualStart: null,
    actualEnd: null,
    actualProgress: 0,
    status: 'pending' as const,
    taskSource: 'template' as const,
    createdAt: now,
    updatedAt: now,
    isExpanded: true,
  }));
}
