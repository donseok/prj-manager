import { addDays, format, parseISO } from 'date-fns';
import type { Task } from '../types';
import { generateId } from './utils';

export interface TaskTemplateSummary {
  id: string;
  name: string;
  description: string;
  audience: string;
  phases: number;
  taskCount: number;
}

interface TemplateNode {
  name: string;
  output?: string;
  durationDays?: number;
  children?: TemplateNode[];
}

interface TaskTemplateDefinition extends TaskTemplateSummary {
  nodes: TemplateNode[];
}

const TASK_TEMPLATES: TaskTemplateDefinition[] = [
  {
    id: 'web-launch',
    name: 'Website Launch',
    description: 'Corporate site, landing page, and ecommerce-style website rollout.',
    audience: 'Marketing sites and renewal projects',
    phases: 4,
    taskCount: 15,
    nodes: [
      {
        name: 'Discovery',
        children: [
          {
            name: 'Requirements',
            children: [
              { name: 'Stakeholder interviews', output: 'Requirement notes', durationDays: 2 },
              { name: 'Scope alignment', output: 'Scope baseline', durationDays: 2 },
            ],
          },
          {
            name: 'Architecture',
            children: [
              { name: 'IA and sitemap', output: 'Sitemap', durationDays: 2 },
              { name: 'Content inventory', output: 'Content matrix', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: 'Design',
        children: [
          {
            name: 'UX/UI',
            children: [
              { name: 'Wireframes', output: 'Wireframe set', durationDays: 3 },
              { name: 'Visual design', output: 'Design system', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: 'Build',
        children: [
          {
            name: 'Implementation',
            children: [
              { name: 'Frontend development', output: 'Responsive screens', durationDays: 6 },
              { name: 'CMS/API integration', output: 'Integrated build', durationDays: 4 },
            ],
          },
          {
            name: 'Quality',
            children: [
              { name: 'QA and bug fixing', output: 'QA report', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: 'Launch',
        children: [
          {
            name: 'Release',
            children: [
              { name: 'Production deployment', output: 'Release note', durationDays: 1 },
              { name: 'Hypercare', output: 'Stabilization log', durationDays: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mobile-app',
    name: 'Mobile App Delivery',
    description: 'Planning through release for a customer-facing mobile application.',
    audience: 'iOS, Android, or cross-platform app teams',
    phases: 5,
    taskCount: 17,
    nodes: [
      {
        name: 'Planning',
        children: [
          {
            name: 'Definition',
            children: [
              { name: 'User story mapping', output: 'Story map', durationDays: 3 },
              { name: 'Release scope', output: 'MVP scope', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: 'Design',
        children: [
          {
            name: 'Experience',
            children: [
              { name: 'UX flow design', output: 'User flow', durationDays: 3 },
              { name: 'High fidelity UI', output: 'UI screens', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: 'Development',
        children: [
          {
            name: 'Client',
            children: [
              { name: 'App shell setup', output: 'Base app', durationDays: 3 },
              { name: 'Feature implementation', output: 'Core features', durationDays: 8 },
            ],
          },
          {
            name: 'Backend',
            children: [
              { name: 'API integration', output: 'Connected endpoints', durationDays: 4 },
              { name: 'Push/auth setup', output: 'Integrated services', durationDays: 3 },
            ],
          },
        ],
      },
      {
        name: 'Validation',
        children: [
          {
            name: 'Test',
            children: [
              { name: 'Functional QA', output: 'QA checklist', durationDays: 4 },
              { name: 'Store review prep', output: 'Submission package', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: 'Release',
        children: [
          {
            name: 'Go-live',
            children: [
              { name: 'Store submission', output: 'Published app', durationDays: 2 },
              { name: 'Post-release monitoring', output: 'Monitoring log', durationDays: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'internal-system',
    name: 'Internal System Rollout',
    description: 'For admin portals, ERP-like tools, and internal workflow systems.',
    audience: 'Backoffice and operational systems',
    phases: 5,
    taskCount: 18,
    nodes: [
      {
        name: 'Initiation',
        children: [
          {
            name: 'Business alignment',
            children: [
              { name: 'Current process review', output: 'AS-IS document', durationDays: 3 },
              { name: 'Target workflow design', output: 'TO-BE workflow', durationDays: 3 },
            ],
          },
        ],
      },
      {
        name: 'Specification',
        children: [
          {
            name: 'Definition',
            children: [
              { name: 'Feature specification', output: 'Feature spec', durationDays: 4 },
              { name: 'Data model review', output: 'Entity list', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: 'Implementation',
        children: [
          {
            name: 'Core build',
            children: [
              { name: 'Admin screens', output: 'CRUD screens', durationDays: 6 },
              { name: 'Permission model', output: 'Role matrix', durationDays: 3 },
              { name: 'Reporting', output: 'Dashboard/report set', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: 'Migration',
        children: [
          {
            name: 'Data cutover',
            children: [
              { name: 'Migration rehearsal', output: 'Dry-run result', durationDays: 2 },
              { name: 'Production migration', output: 'Migration log', durationDays: 1 },
            ],
          },
        ],
      },
      {
        name: 'Adoption',
        children: [
          {
            name: 'Enablement',
            children: [
              { name: 'User training', output: 'Training materials', durationDays: 2 },
              { name: 'Stabilization support', output: 'Support log', durationDays: 4 },
            ],
          },
        ],
      },
    ],
  },
];

export function listTaskTemplates(): TaskTemplateSummary[] {
  return TASK_TEMPLATES.map(({ nodes: _nodes, ...summary }) => summary);
}

export function getTaskTemplate(templateId: string): TaskTemplateSummary | undefined {
  return listTaskTemplates().find((template) => template.id === templateId);
}

export function generateTasksFromTemplate(params: {
  templateId: string;
  projectId: string;
  projectStartDate?: string;
}): Task[] {
  const template = TASK_TEMPLATES.find((item) => item.id === params.templateId);
  if (!template) {
    throw new Error(`Unknown task template: ${params.templateId}`);
  }

  const baseDate = params.projectStartDate ? parseISO(params.projectStartDate) : null;
  let nextStart = baseDate;
  const tasks: Task[] = [];

  const createNodes = (
    nodes: TemplateNode[],
    parentId: string | null,
    level: number
  ) => {
    nodes.forEach((node, index) => {
      const taskId = generateId();
      const isLeaf = !node.children || node.children.length === 0;
      const durationDays = Math.max(node.durationDays ?? 2, 1);
      const planStart = isLeaf && nextStart ? format(nextStart, 'yyyy-MM-dd') : null;
      const planEnd =
        isLeaf && nextStart ? format(addDays(nextStart, durationDays - 1), 'yyyy-MM-dd') : null;

      tasks.push({
        id: taskId,
        projectId: params.projectId,
        parentId,
        level,
        orderIndex: index,
        name: node.name,
        output: node.output,
        weight: isLeaf ? Number((100 / template.taskCount).toFixed(3)) : 0,
        durationDays: isLeaf ? durationDays : null,
        predecessorIds: [],
        taskSource: 'template',
        planStart,
        planEnd,
        planProgress: 0,
        actualStart: null,
        actualEnd: null,
        actualProgress: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isExpanded: true,
      });

      if (node.children && node.children.length > 0) {
        createNodes(node.children, taskId, level + 1);
        return;
      }

      if (nextStart) {
        nextStart = addDays(nextStart, durationDays);
      }
    });
  };

  createNodes(template.nodes, null, 1);
  return tasks;
}
