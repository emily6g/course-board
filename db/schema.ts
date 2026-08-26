import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const taskStatuses = sqliteTable("task_statuses", {
  taskId: text("task_id").primaryKey(),
  status: text("status").notNull().default("not-started"),
  manualOverride: integer("manual_override", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const taskOverrides = sqliteTable("task_overrides", {
  taskId: text("task_id").primaryKey(),
  courseId: text("course_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  due: text("due").notNull(),
  dueTime: text("due_time").notNull().default(""),
  note: text("note").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
