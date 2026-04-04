import type { Task, ProjectMember } from '../../types';
import { loadAISettings } from './aiConfig';
import { callAI } from './aiClient';
import { buildProgressSuggestionPrompt } from './aiPrompts';

export interface ProgressSuggestion {
  taskId: string;
  taskName: string;
  currentProgress: number;
  suggestedProgress: number;
  suggestedStatus: Task['status'];
  reason: string;
}

function getParentName(task: Task, tasks: Task[]): string | undefined {
  if (!task.parentId) return undefined;
  return tasks.find((t) => t.id === task.parentId)?.name;
}

function getSiblingProgress(task: Task, tasks: Task[]): number[] {
  if (!task.parentId) return [];
  return tasks
    .filter((t) => t.parentId === task.parentId && t.id !== task.id)
    .map((t) => t.actualProgress);
}

export async function suggestProgressUpdates(params: {
  tasks: Task[];
  members?: ProjectMember[];
  baseDate?: string;
}): Promise<ProgressSuggestion[]> {
  const settings = loadAISettings();
  if (!settings.apiKey) {
    throw new Error('AI API Key가 설정되지 않았습니다.');
  }

  const { tasks, members } = params;
  const baseDate = params.baseDate || new Date().toISOString().split('T')[0];

  // Only analyze leaf tasks that are not completed
  const parentIds = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId!));
  const leafTasks = tasks.filter(
    (t) => !parentIds.has(t.id) && t.status !== 'completed'
  );

  if (leafTasks.length === 0) {
    return [];
  }

  // Limit to 30 tasks max to avoid token limits
  const targetTasks = leafTasks.slice(0, 30);

  const memberMap = new Map(members?.map((m) => [m.id, m.name]) || []);

  const promptTasks = targetTasks.map((task) => ({
    id: task.id,
    name: task.name,
    level: task.level,
    planStart: task.planStart,
    planEnd: task.planEnd,
    actualProgress: task.actualProgress,
    status: task.status,
    assignee: task.assigneeId ? memberMap.get(task.assigneeId) : undefined,
    parentName: getParentName(task, tasks),
    siblingProgress: getSiblingProgress(task, tasks),
  }));

  const prompt = buildProgressSuggestionPrompt({
    tasks: promptTasks,
    baseDate,
  });

  const response = await callAI(settings, [
    { role: 'system', content: '당신은 프로젝트 진행률 분석 전문가입니다. 요청된 형식의 JSON만 응답하세요.' },
    { role: 'user', content: prompt },
  ]);

  // Parse response
  let jsonStr = response.content.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  const startIdx = jsonStr.indexOf('[');
  const endIdx = jsonStr.lastIndexOf(']');
  if (startIdx === -1 || endIdx === -1) {
    return [];
  }
  jsonStr = jsonStr.slice(startIdx, endIdx + 1);

  const parsed = JSON.parse(jsonStr) as Array<{
    taskId: string;
    suggestedProgress: number;
    suggestedStatus: string;
    reason: string;
  }>;

  // Map back to our format, filter out invalid entries
  const validStatuses = new Set(['pending', 'in_progress', 'completed', 'on_hold']);
  const taskMap = new Map(targetTasks.map((t) => [t.id, t]));

  return parsed
    .filter((s) => taskMap.has(s.taskId) && validStatuses.has(s.suggestedStatus))
    .filter((s) => {
      const task = taskMap.get(s.taskId)!;
      // Only include if something actually changes
      return s.suggestedProgress !== task.actualProgress || s.suggestedStatus !== task.status;
    })
    .map((s) => {
      const task = taskMap.get(s.taskId)!;
      return {
        taskId: s.taskId,
        taskName: task.name,
        currentProgress: task.actualProgress,
        suggestedProgress: Math.min(100, Math.max(0, Math.round(s.suggestedProgress))),
        suggestedStatus: s.suggestedStatus as Task['status'],
        reason: s.reason,
      };
    });
}
