export type ParticipantStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  PENDING: 'Awaiting answer',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
};

export const PARTICIPANT_STATUS_ICONS: Record<ParticipantStatus, string> = {
  PENDING: 'schedule',
  ACCEPTED: 'check_circle',
  DECLINED: 'cancel',
};

export interface Participant {
  /** A free-text name, or a (lower-cased) email. */
  participant: string;
  /** Set when the participant is a TaskFlow user: the meeting then appears in their calendar. */
  fullName: string | null;
  status: ParticipantStatus;
}

export interface Meeting {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  /** Local date-time, `YYYY-MM-DDTHH:mm:ss` (no timezone, as returned by the API). */
  startAt: string;
  endAt: string;
  organizer: { email: string; fullName: string };
  /** Only the organizer can edit or delete a meeting; invitees can accept or decline it. */
  organizedByMe: boolean;
  /** The current user's answer when invited, `null` for the organizer. */
  myStatus: ParticipantStatus | null;
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
}

export interface MeetingRequest {
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  participants?: string[];
}

/** Data passed to the meeting dialog: an existing meeting to edit, or a day to pre-fill a new one. */
export interface MeetingDialogData {
  meeting?: Meeting;
  date?: Date;
}
