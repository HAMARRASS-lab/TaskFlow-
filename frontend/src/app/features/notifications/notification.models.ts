export type NotificationType = 'TASK_ASSIGNED' | 'TASK_COMMENTED' | 'MEETING_INVITED' | 'MEETING_RESCHEDULED';

export interface AppNotification {
  id: number;
  type: NotificationType;
  /** Who did it; null if their account was deleted. */
  actor: { id: number; fullName: string } | null;
  taskId: number | null;
  meetingId: number | null;
  /** The task or meeting title. */
  subject: string;
  read: boolean;
  createdAt: string;
}

const ACTIONS: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'assigned you',
  TASK_COMMENTED: 'commented on',
  MEETING_INVITED: 'invited you to',
  MEETING_RESCHEDULED: 'rescheduled',
};

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'assignment_ind',
  TASK_COMMENTED: 'chat_bubble_outline',
  MEETING_INVITED: 'event',
  MEETING_RESCHEDULED: 'update',
};

/** "Alice assigned you", "Someone commented on"…, followed by the subject in the bell. */
export function describeNotification(n: Pick<AppNotification, 'type' | 'actor'>): string {
  return `${n.actor?.fullName ?? 'Someone'} ${ACTIONS[n.type]}`;
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
