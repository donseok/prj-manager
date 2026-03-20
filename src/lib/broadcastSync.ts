import type { Task, Project } from '../types';

const CHANNEL_NAME = 'dk-flow-sync';
const windowId = crypto.randomUUID();

type SyncMessage =
  | { type: 'TASKS_UPDATED'; windowId: string; projectId: string; tasks: Task[] }
  | { type: 'PROJECT_UPDATED'; windowId: string; projectId: string; updates: Partial<Project> };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function broadcastTasks(projectId: string, tasks: Task[]) {
  const msg: SyncMessage = { type: 'TASKS_UPDATED', windowId, projectId, tasks };
  getChannel().postMessage(msg);
}

export function broadcastProjectUpdate(projectId: string, updates: Partial<Project>) {
  const msg: SyncMessage = { type: 'PROJECT_UPDATED', windowId, projectId, updates };
  getChannel().postMessage(msg);
}

export function onTasksUpdated(callback: (projectId: string, tasks: Task[]) => void): () => void {
  const ch = getChannel();
  const handler = (event: MessageEvent<SyncMessage>) => {
    const data = event.data;
    if (data.windowId === windowId) return; // ignore own messages
    if (data.type === 'TASKS_UPDATED') {
      callback(data.projectId, data.tasks);
    }
  };
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}

export function onProjectUpdated(callback: (projectId: string, updates: Partial<Project>) => void): () => void {
  const ch = getChannel();
  const handler = (event: MessageEvent<SyncMessage>) => {
    const data = event.data;
    if (data.windowId === windowId) return;
    if (data.type === 'PROJECT_UPDATED') {
      callback(data.projectId, data.updates);
    }
  };
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
