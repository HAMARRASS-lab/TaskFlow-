-- Invitees' answer to a meeting. Participants matching a registered user's email see the meeting in their calendar.
ALTER TABLE meeting_participants ADD COLUMN status VARCHAR(20) DEFAULT 'PENDING' NOT NULL;

-- Emails are matched case-insensitively: store them lower-cased like users.email.
UPDATE meeting_participants SET participant = LOWER(participant) WHERE participant LIKE '%@%';

CREATE INDEX idx_meeting_participants_participant ON meeting_participants (participant);
