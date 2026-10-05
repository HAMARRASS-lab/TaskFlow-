import { Meeting } from '../meeting.models';
import { MeetingsActions } from './meetings.actions';
import { initialMeetingsState, meetingsFeature } from './meetings.reducer';

const meeting = (id: number, startAt: string): Meeting => ({
  id,
  title: `M${id}`,
  description: null,
  location: null,
  startAt,
  endAt: startAt,
  organizer: { email: 'alice@test.com', fullName: 'Alice' },
  organizedByMe: false,
  myStatus: 'PENDING',
  participants: [],
  createdAt: '',
  updatedAt: '',
});

describe('meetings reducer', () => {
  const { reducer } = meetingsFeature;

  it('keeps meetings sorted by start time', () => {
    let state = reducer(initialMeetingsState, MeetingsActions.loadSuccess({
      meetings: [meeting(1, '2026-10-06T14:00:00'), meeting(2, '2026-10-06T09:00:00')],
    }));
    state = reducer(state, MeetingsActions.createSuccess({ meeting: meeting(3, '2026-10-05T10:00:00') }));

    const all = meetingsFeature.selectAllMeetings.projector(state);
    expect(all.map((m) => m.id)).toEqual([3, 2, 1]);
    expect(state.loading).toBe(false);
  });

  it('removes a deleted meeting', () => {
    const loaded = reducer(initialMeetingsState, MeetingsActions.loadSuccess({ meetings: [meeting(1, '2026-10-06T09:00:00')] }));
    const state = reducer(loaded, MeetingsActions.deleteSuccess({ id: 1 }));
    expect(state.ids).toEqual([]);
  });

  it('moves an answered invitation into the calendar', () => {
    const invited = meeting(5, '2026-11-02T09:00:00');
    const withInvite = reducer(initialMeetingsState, MeetingsActions.loadInvitationsSuccess({ invitations: [invited] }));
    const state = reducer(withInvite, MeetingsActions.respondSuccess({ meeting: { ...invited, myStatus: 'ACCEPTED' } }));

    expect(state.invitations).toEqual([]);
    expect(state.entities[5]?.myStatus).toBe('ACCEPTED');
  });
});
