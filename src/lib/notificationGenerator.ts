import type { Task } from '../types';
import { useNotificationStore, type NotificationType } from '../store/notificationStore';

/**
 * 중복 알림 방지: 같은 taskId + type 조합으로 24시간 내 중복 생성 방지
 */
function hasDuplicate(taskId: string, type: NotificationType): boolean {
  const { notifications } = useNotificationStore.getState();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return notifications.some(
    (n) =>
      n.taskId === taskId &&
      n.type === type &&
      new Date(n.createdAt).getTime() > oneDayAgo
  );
}

function addNotification(
  type: NotificationType,
  title: string,
  message: string,
  projectId?: string,
  taskId?: string
) {
  if (taskId && hasDuplicate(taskId, type)) return;
  useNotificationStore.getState().addNotification({ type, title, message, projectId, taskId });
}

/**
 * 이전 작업 목록과 현재 작업 목록을 비교하여 알림을 생성합니다.
 */
export function checkAndGenerateNotifications(
  tasks: Task[],
  previousTasks: Task[]
): void {
  const prevMap = new Map(previousTasks.map((t) => [t.id, t]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const task of tasks) {
    const prev = prevMap.get(task.id);

    // 지연 작업 감지: planEnd < today && status !== 'completed'
    if (
      task.planEnd &&
      task.status !== 'completed' &&
      new Date(task.planEnd) < today
    ) {
      const delayDays = Math.floor(
        (today.getTime() - new Date(task.planEnd).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (delayDays > 0) {
        addNotification(
          'delay_warning',
          '작업 지연 경고',
          `⏰ '${task.name}' 작업이 ${delayDays}일 지연되었습니다`,
          task.projectId,
          task.id
        );
      }
    }

    if (!prev) continue;

    // 담당자 배정 알림: assigneeId 변경 시
    if (task.assigneeId && task.assigneeId !== prev.assigneeId) {
      addNotification(
        'assignment',
        '담당자 배정',
        `📋 '${task.name}' 작업에 배정되었습니다`,
        task.projectId,
        task.id
      );
    }

    // 상태 변경 알림: 작업 완료 시
    if (task.status === 'completed' && prev.status !== 'completed') {
      addNotification(
        'status_change',
        '작업 완료',
        `✅ '${task.name}' 작업이 완료되었습니다`,
        task.projectId,
        task.id
      );
    }
  }
}
