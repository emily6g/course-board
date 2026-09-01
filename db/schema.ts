import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const taskStatuses = sqliteTable("task_statuses", {
  taskId: text("task_id").primaryKey(),
  status: text("status").notNull().default("not-started"),
  manualOverride: integer("manual_override", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const taskOverrides = sqliteTable("task_overrides", {
  taskId: text("task_id").primaryKey(),
  courseId: text("course_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  due: text("due").notNull(),
  dueTime: text("due_time").notNull().default(""),
  endTime: text("end_time").notNull().default(""),
  note: text("note").notNull().default(""),
  optional: integer("optional", { mode: "boolean" }).notNull().default(false),
  tentative: integer("tentative", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const semesters = sqliteTable("semesters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  createdAt: text("created_at"),
});

export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semesters.id),
  courseCode: text("course_code").notNull(),
  courseName: text("course_name").notNull(),
  instructor: text("instructor"),
  color: text("color"),
  createdAt: text("created_at"),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
  title: text("title").notNull(),
  taskType: text("task_type").notNull(),
  dueDate: text("due_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  source: text("source").notNull(),
  sourceKey: text("source_key"),
  sourceEventId: text("source_event_id"),
  canvasUrl: text("canvas_url"),
  originalDueDate: text("original_due_date"),
  originalData: text("original_data"),
  normalizedUtc: text("normalized_utc"),
  lastSeenAt: text("last_seen_at"),
  missingRefreshes: integer("missing_refreshes").notNull().default(0),
  cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
  tentative: integer("tentative", { mode: "boolean" }).notNull().default(false),
  derived: integer("derived", { mode: "boolean" }).notNull().default(false),
  needsReview: integer("needs_review", { mode: "boolean" })
    .notNull()
    .default(false),
  assumedTime: integer("assumed_time", { mode: "boolean" })
    .notNull()
    .default(false),
  optional: integer("optional", { mode: "boolean" }).default(false),
  notes: text("notes"),
  confirmed: integer("confirmed", { mode: "boolean" }).default(true),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const canvasSources = sqliteTable("canvas_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  semesterId: integer("semester_id").references(() => semesters.id),
  sourceKey: text("source_key").notNull(),
  sourceName: text("source_name").notNull().default("Canvas"),
  feedUrl: text("feed_url").notNull(),
  lastSyncedAt: text("last_synced_at"),
  syncStatus: text("sync_status"),
  institution: text("institution"),
  courseRestrictions: text("course_restrictions"),
  lastAttemptAt: text("last_attempt_at"),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: text("created_at"),
});

export const syllabi = sqliteTable("syllabi", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
  fileKey: text("file_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull().default("application/pdf"),
  processingStatus: text("processing_status").default("uploaded"),
  processingError: text("processing_error"),
  uploadedAt: text("uploaded_at"),
});

export const taskCandidates = sqliteTable("task_candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  syllabusId: integer("syllabus_id")
    .notNull()
    .references(() => syllabi.id),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
  title: text("title").notNull(),
  taskType: text("task_type").notNull(),
  dueDate: text("due_date"),
  dueTime: text("due_time"),
  endTime: text("end_time"),
  notes: text("notes"),
  optional: integer("optional", { mode: "boolean" }).notNull().default(false),
  tentative: integer("tentative", { mode: "boolean" }).notNull().default(false),
  derived: integer("derived", { mode: "boolean" }).notNull().default(false),
  needsReview: integer("needs_review", { mode: "boolean" })
    .notNull()
    .default(false),
  reviewReason: text("review_reason"),
  sourcePage: integer("source_page"),
  sourceRow: integer("source_row"),
  originalData: text("original_data"),
  alternativeGroup: text("alternative_group"),
  confidence: integer("confidence").notNull().default(50),
  sourceText: text("source_text"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const courseMappings = sqliteTable("course_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  canvasCourseKey: text("canvas_course_key").notNull().unique(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
  createdAt: text("created_at"),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at"),
});

export const taskSourceHistory = sqliteTable("task_source_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id),
  sourceKey: text("source_key"),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: text("changed_at").notNull(),
});
