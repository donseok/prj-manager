import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Check } from 'lucide-react';
import Button from '../common/Button';
import { cn } from '../../lib/utils';
import type { Task } from '../../types';
import { LEVEL_LABELS } from '../../types';

interface AIReviewPanelProps {
  tasks: Task[];
  onApply: (selectedTasks: Task[]) => void;
  onCancel: () => void;
}

interface TreeNode {
  task: Task;
  children: TreeNode[];
  selected: boolean;
  expanded: boolean;
}

function buildTree(tasks: Task[]): TreeNode[] {
  const taskMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const task of tasks) {
    taskMap.set(task.id, { task, children: [], selected: true, expanded: true });
  }

  for (const task of tasks) {
    const node = taskMap.get(task.id)!;
    if (task.parentId && taskMap.has(task.parentId)) {
      taskMap.get(task.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function collectSelected(nodes: TreeNode[]): Task[] {
  const result: Task[] = [];
  for (const node of nodes) {
    if (node.selected) {
      result.push(node.task);
      result.push(...collectSelected(node.children));
    }
  }
  return result;
}

function countNodes(nodes: TreeNode[]): { total: number; selected: number } {
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

export default function AIReviewPanel({ tasks, onApply, onCancel }: AIReviewPanelProps) {
  const [tree, setTree] = useState<TreeNode[]>(() => buildTree(tasks));

  const counts = useMemo(() => countNodes(tree), [tree]);

  const toggleSelect = (nodeId: string, nodes: TreeNode[]): TreeNode[] => {
    return nodes.map((node) => {
      if (node.task.id === nodeId) {
        const newSelected = !node.selected;
        return {
          ...node,
          selected: newSelected,
          children: setAllSelected(node.children, newSelected),
        };
      }
      return { ...node, children: toggleSelect(nodeId, node.children) };
    });
  };

  const setAllSelected = (nodes: TreeNode[], selected: boolean): TreeNode[] => {
    return nodes.map((node) => ({
      ...node,
      selected,
      children: setAllSelected(node.children, selected),
    }));
  };

  const toggleExpand = (nodeId: string, nodes: TreeNode[]): TreeNode[] => {
    return nodes.map((node) => {
      if (node.task.id === nodeId) {
        return { ...node, expanded: !node.expanded };
      }
      return { ...node, children: toggleExpand(nodeId, node.children) };
    });
  };

  const handleApply = () => {
    const selectedTasks = collectSelected(tree);
    onApply(selectedTasks);
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const indent = depth * 24;

    return (
      <div key={node.task.id}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[color:var(--bg-elevated)]',
            !node.selected && 'opacity-40'
          )}
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          <button
            type="button"
            onClick={() => setTree(toggleSelect(node.task.id, tree))}
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
              node.selected
                ? 'border-violet-500 bg-violet-500 text-white'
                : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)]'
            )}
          >
            {node.selected && <Check className="h-3 w-3" />}
          </button>

          {hasChildren ? (
            <button
              type="button"
              onClick={() => setTree(toggleExpand(node.task.id, tree))}
              className="flex h-5 w-5 items-center justify-center text-[color:var(--text-muted)]"
            >
              {node.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            {LEVEL_LABELS[node.task.level]}
          </span>

          <span className={cn(
            'flex-1 truncate text-sm',
            node.task.level === 1 ? 'font-semibold text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'
          )}>
            {node.task.name}
          </span>

          {node.task.output && (
            <span className="hidden shrink-0 rounded-full bg-[color:var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)] sm:inline">
              {node.task.output}
            </span>
          )}

          <Sparkles className="h-3 w-3 shrink-0 text-violet-400" />
        </div>

        {hasChildren && node.expanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-medium text-[color:var(--text-primary)]">
            AI 생성 결과 미리보기
          </span>
          <span className="surface-badge text-xs">
            {counts.selected}/{counts.total}개 선택
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTree(setAllSelected(tree, true))}
            className="rounded-full px-2.5 py-1 text-xs text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={() => setTree(setAllSelected(tree, false))}
            className="rounded-full px-2.5 py-1 text-xs text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]"
          >
            전체 해제
          </button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-auto rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] p-2">
        {tree.map((node) => renderNode(node))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button onClick={handleApply} disabled={counts.selected === 0}>
          <Sparkles className="h-4 w-4" />
          {counts.selected}개 작업 적용
        </Button>
      </div>
    </div>
  );
}
