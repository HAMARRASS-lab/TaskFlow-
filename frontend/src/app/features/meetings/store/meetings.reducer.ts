import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { AuthActions } from '../../../core/auth/store/auth.actions';
import { Meeting } from '../meeting.models';
import { MeetingsActions } from './meetings.actions';

export interface MeetingsState extends EntityState<Meeting> {
  loading: boolean;
  error: string | null;
  /** Upcoming meetings shared with me that I have not answered yet (any month). */
  invitations: Meeting[];
}

export const meetingsAdapter = createEntityAdapter<Meeting>({
  sortComparer: (a, b) => a.startAt.localeCompare(b.startAt),
});

export const initialMeetingsState: MeetingsState = meetingsAdapter.getInitialState({
  loading: false,
  error: null,
  invitations: [],
});

const { selectAll } = meetingsAdapter.getSelectors();

export const meetingsFeature = createFeature({
  name: 'meetings',
  reducer: createReducer(
    initialMeetingsState,
    on(MeetingsActions.load, (state) => ({ ...state, loading: true, error: null })),
    on(MeetingsActions.loadSuccess, (state, { meetings }) => meetingsAdapter.setAll(meetings, { ...state, loading: false })),
    on(MeetingsActions.createSuccess, (state, { meeting }) => meetingsAdapter.addOne(meeting, state)),
    on(MeetingsActions.updateSuccess, (state, { meeting }) => meetingsAdapter.upsertOne(meeting, state)),
    on(MeetingsActions.deleteSuccess, (state, { id }) => meetingsAdapter.removeOne(id, state)),
    on(MeetingsActions.loadInvitationsSuccess, (state, { invitations }) => ({ ...state, invitations })),
    on(MeetingsActions.respondSuccess, (state, { meeting }) => meetingsAdapter.upsertOne(meeting, {
      ...state,
      invitations: state.invitations.filter((m) => m.id !== meeting.id),
    })),
    on(MeetingsActions.requestFailure, (state, { error }) => ({ ...state, loading: false, error })),
    on(AuthActions.logout, () => initialMeetingsState),
  ),
  extraSelectors: ({ selectMeetingsState }) => ({
    selectAllMeetings: createSelector(selectMeetingsState, selectAll),
  }),
});
