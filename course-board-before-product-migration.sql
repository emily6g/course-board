PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE `task_statuses` (
	`task_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'not-started' NOT NULL,
	`manual_override` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE TABLE `task_overrides` (
	`task_id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`due` text NOT NULL,
	`due_time` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE TABLE semesters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "semesters" ("id","name","start_date","end_date","created_at") VALUES(1,'fall 2026','2026-08-24','2026-12-09',NULL);
CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_id INTEGER NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  instructor TEXT,
  color TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id) REFERENCES semesters(id)
);
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  task_type TEXT NOT NULL,
  due_date TEXT,
  start_time TEXT,
  end_time TEXT,
  source TEXT NOT NULL,
  source_event_id TEXT,
  optional INTEGER DEFAULT 0,
  notes TEXT,
  confirmed INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE TABLE canvas_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_id INTEGER,
  source_key TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  last_synced_at TEXT,
  sync_status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id) REFERENCES semesters(id)
);
CREATE TABLE syllabi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  file_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending',
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('semesters',1);
