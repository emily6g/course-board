ALTER TABLE tasks ADD COLUMN source_key TEXT;
ALTER TABLE tasks ADD COLUMN original_data TEXT;
ALTER TABLE tasks ADD COLUMN normalized_utc TEXT;
ALTER TABLE tasks ADD COLUMN last_seen_at TEXT;
ALTER TABLE tasks ADD COLUMN missing_refreshes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN tentative INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN derived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN assumed_time INTEGER NOT NULL DEFAULT 0;

ALTER TABLE canvas_sources ADD COLUMN institution TEXT;
ALTER TABLE canvas_sources ADD COLUMN course_restrictions TEXT;
ALTER TABLE canvas_sources ADD COLUMN last_attempt_at TEXT;
ALTER TABLE canvas_sources ADD COLUMN last_error TEXT;
ALTER TABLE canvas_sources ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;

ALTER TABLE task_candidates ADD COLUMN end_time TEXT;
ALTER TABLE task_candidates ADD COLUMN tentative INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task_candidates ADD COLUMN derived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task_candidates ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task_candidates ADD COLUMN review_reason TEXT;
ALTER TABLE task_candidates ADD COLUMN source_page INTEGER;
ALTER TABLE task_candidates ADD COLUMN source_row INTEGER;
ALTER TABLE task_candidates ADD COLUMN original_data TEXT;
ALTER TABLE task_candidates ADD COLUMN alternative_group TEXT;

ALTER TABLE task_overrides ADD COLUMN end_time TEXT NOT NULL DEFAULT '';
ALTER TABLE task_overrides ADD COLUMN optional INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task_overrides ADD COLUMN tentative INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS tasks_source_event_unique;
CREATE UNIQUE INDEX tasks_source_event_unique
ON tasks(source_key, source_event_id)
WHERE source = 'canvas' AND source_key IS NOT NULL AND source_event_id IS NOT NULL;

CREATE INDEX tasks_source_key_index ON tasks(source_key);
CREATE INDEX tasks_last_seen_index ON tasks(last_seen_at);

CREATE TABLE task_source_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  source_key TEXT,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX task_source_history_task_index
ON task_source_history(task_id, changed_at);
