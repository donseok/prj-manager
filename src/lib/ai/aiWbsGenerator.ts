import type { Task, ProjectMember } from '../../types';
import { generateId } from '../utils';
import { loadAISettings } from './aiConfig';
import { callAI } from './aiClient';
import { buildWbsGenerationPrompt } from './aiPrompts';

interface AIWbsNode {
  name: string;
  level: number;
  output?: string;
  durationDays?: number;
  children?: AIWbsNode[];
}

function flattenAINodes(
  nodes: AIWbsNode[],
  projectId: string,
  parentId: string | null,
  level: number,
): Task[] {
  const tasks: Task[] = [];
  const now = new Date().toISOString();

  nodes.forEach((node, index) => {
    const id = generateId();
    const task: Task = {
      id,
      projectId,
      parentId,
      level,
      orderIndex: index,
      name: node.name,
      output: node.output,
      weight: 0,
      durationDays: node.durationDays ?? (level >= 4 ? 2 : null),
      predecessorIds: [],
      taskSource: 'ai_generated',
      planStart: null,
      planEnd: null,
      planProgress: 0,
      actualStart: null,
      actualEnd: null,
      actualProgress: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      isExpanded: true,
    };
    tasks.push(task);

    if (node.children && node.children.length > 0) {
      const childLevel = Math.min(level + 1, 4);
      const childTasks = flattenAINodes(node.children, projectId, id, childLevel);
      tasks.push(...childTasks);
    }
  });

  return tasks;
}

function parseAIResponse(text: string): AIWbsNode[] {
  // Extract JSON from response (may be wrapped in markdown code blocks)
  let jsonStr = text.trim();

  // Remove markdown code block wrapper
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Find the first [ and last ]
  const startIdx = jsonStr.indexOf('[');
  const endIdx = jsonStr.lastIndexOf(']');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('AI 응답에서 JSON 배열을 찾을 수 없습니다.');
  }
  jsonStr = jsonStr.slice(startIdx, endIdx + 1);

  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) {
    throw new Error('AI 응답이 배열 형식이 아닙니다.');
  }

  return parsed as AIWbsNode[];
}

export async function generateWbsWithAI(params: {
  projectName: string;
  description: string;
  startDate?: string;
  members?: ProjectMember[];
  projectId: string;
}): Promise<{ tasks: Task[]; fromAI: true }> {
  const settings = loadAISettings();
  if (!settings.apiKey) {
    throw new Error('AI API Key가 설정되지 않았습니다. Settings에서 설정해주세요.');
  }

  const prompt = buildWbsGenerationPrompt({
    projectName: params.projectName,
    description: params.description,
    startDate: params.startDate,
    memberNames: params.members?.map((m) => m.name),
  });

  const response = await callAI(settings, [
    { role: 'system', content: '당신은 프로젝트 관리 WBS 전문가입니다. 요청된 형식의 JSON만 응답하세요.' },
    { role: 'user', content: prompt },
  ]);

  const nodes = parseAIResponse(response.content);
  const tasks = flattenAINodes(nodes, params.projectId, null, 1);

  if (tasks.length === 0) {
    throw new Error('AI가 생성한 WBS가 비어 있습니다.');
  }

  return { tasks, fromAI: true };
}
