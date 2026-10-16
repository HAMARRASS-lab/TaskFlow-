-- The teammate responsible for a task (optional). It stays on the creator's (owner's) board too.
ALTER TABLE tasks ADD COLUMN assignee_id BIGINT REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_assignee ON tasks (assignee_id);

-- Users following a task: it shows up on their board, read-only unless they own it or are assigned to it.
CREATE TABLE task_watchers (
    task_id  BIGINT  NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id  BIGINT  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_watchers_user ON task_watchers (user_id);
