ALTER TABLE tasks ADD COLUMN canvas_url TEXT;
ALTER TABLE tasks ADD COLUMN original_due_date TEXT;
ALTER TABLE tasks ADD COLUMN updated_at TEXT;

ALTER TABLE canvas_sources ADD COLUMN source_name TEXT NOT NULL DEFAULT 'Canvas';

ALTER TABLE syllabi ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'application/pdf';
ALTER TABLE syllabi ADD COLUMN processing_error TEXT;

CREATE TABLE task_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  syllabus_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  task_type TEXT NOT NULL,
  due_date TEXT,
  due_time TEXT,
  notes TEXT,
  optional INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 50,
  source_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE course_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canvas_course_key TEXT NOT NULL UNIQUE,
  course_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX tasks_source_event_unique
ON tasks(course_id, source, source_event_id)
WHERE source_event_id IS NOT NULL;

CREATE UNIQUE INDEX canvas_sources_semester_key_unique
ON canvas_sources(semester_id, source_key);
