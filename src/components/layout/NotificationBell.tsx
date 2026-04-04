import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Clock,
  ClipboardList,
  CircleCheckBig,
  AlertTriangle,
  AtSign,
  Info,
  Trash2,
  X,
} from 'lucide-react';
import { useNotificationStore, type NotificationType } from '../../store/notificationStore';

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '방금 전';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case 'delay_warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'assignment':
      return <ClipboardList className="h-4 w-4 text-blue-500" />;
    case 'weekly_reminder':
      return <Clock className="h-4 w-4 text-violet-500" />;
    case 'status_change':
      return <CircleCheckBig className="h-4 w-4 text-emerald-500" />;
    case 'mention':
      return <AtSign className="h-4 w-4 text-pink-500" />;
    case 'system':
      return <Info className="h-4 w-4 text-[color:var(--text-secondary)]" />;
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useNotificationStore();

  const recentNotifications = notifications.slice(0, 20);

  // 외부 클릭 / ESC로 닫기
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleNotificationClick = (n: (typeof recentNotifications)[number]) => {
    if (!n.isRead) markAsRead(n.id);
    setOpen(false);
    if (n.projectId && n.taskId) {
      navigate(`/projects/${n.projectId}/wbs`);
    } else if (n.projectId) {
      navigate(`/projects/${n.projectId}`);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* 벨 아이콘 버튼 */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-secondary-solid)]"
        title="알림"
        aria-label="알림"
      >
        <Bell className="h-5 w-5 text-[color:var(--text-secondary)] transition-colors duration-200 group-hover:text-[color:var(--text-primary)]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--accent-danger)] px-1 text-[10px] font-bold text-white ring-2 ring-[color:var(--bg-elevated)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-96 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] shadow-lg animate-scale-in">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
            <h3 className="text-sm font-bold text-[color:var(--text-primary)]">
              알림
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--accent-danger)] px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
                  title="모두 읽음"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  모두 읽음
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--accent-danger)]"
                  title="전체 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  전체 삭제
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg p-1 text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-[400px] overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[color:var(--text-muted)]">
                <Bell className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">새로운 알림이 없습니다</p>
              </div>
            ) : (
              recentNotifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-[color:var(--bg-tertiary)] ${
                    !n.isRead ? 'bg-[color:var(--bg-secondary)]' : ''
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{getTypeIcon(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`truncate text-sm ${
                          n.isRead
                            ? 'font-medium text-[color:var(--text-secondary)]'
                            : 'font-semibold text-[color:var(--text-primary)]'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[color:var(--accent-primary)]" />
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">
                      {n.message}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                      {getRelativeTime(n.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
