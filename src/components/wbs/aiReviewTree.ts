import type { Task } from '../../types';

export interface TreeNode {
  task: Task;
  children: TreeNode[];
  selected: boolean;
  expanded: boolean;
}

export function buildTree(tasks: Task[]): TreeNode[] {
  const taskMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const task of tasks) {
    taskMap.set(task.id, { task, children: [], selected: true, expanded: true });
  }

  for (const task of tasks) {
    const node = taskMap.get(task.id)!;
    if (task.parentId && taskMap.has(task.parentId)) {
      // Mutate the canonical parent node in place. Cloning the parent here
      // (taskMap.set(parentId, {...parent, children:[...]})) would orphan the
      // children: `roots` and previously-linked parents hold references to the
      // ORIGINAL node objects, so a replacement clone is never seen by them.
      taskMap.get(task.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function collectSelected(nodes: TreeNode[]): Task[] {
  const result: Task[] = [];
  for (const node of nodes) {
    if (node.selected) {
      result.push(node.task);
      result.push(...collectSelected(node.children));
    }
  }
  return result;
}

export function countNodes(nodes: TreeNode[]): { total: number; selected: number } {
  let total = 0;
  let selected = 0;
  for (const node of nodes) {
    total++;
    if (node.selected) selected++;
    const childCounts = countNodes(node.children);
    total += childCounts.total;
    selected += childCounts.selected;
  }
  return { total, selected };
}
