import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Meeting, MeetingRequest, ParticipantStatus } from '../meeting.models';

export const MeetingsActions = createActionGroup({
  source: 'Meetings',
  events: {
    Load: props<{ from: string; to: string }>(),
    'Load Success': props<{ meetings: Meeting[] }>(),
    Create: props<{ request: MeetingRequest }>(),
    'Create Success': props<{ meeting: Meeting }>(),
    Update: props<{ id: number; request: MeetingRequest }>(),
    'Update Success': props<{ meeting: Meeting }>(),
    Delete: props<{ id: number }>(),
    'Delete Success': props<{ id: number }>(),
    'Load Invitations': emptyProps(),
    'Load Invitations Success': props<{ invitations: Meeting[] }>(),
    Respond: props<{ id: number; status: Exclude<ParticipantStatus, 'PENDING'> }>(),
    'Respond Success': props<{ meeting: Meeting }>(),
    'Request Failure': props<{ error: string }>(),
  },
});
