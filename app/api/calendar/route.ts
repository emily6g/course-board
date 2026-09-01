import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  appSettings,
  canvasSources,
  courseMappings,
  courses,
  semesters,
  taskSourceHistory,
  tasks,
} from "../../../db/schema";
import { parseCalendar } from "../../../lib/ics";
import { fetchCalendarText } from "../../../lib/canvas/fetchCalendar";
import type { SchoolTask } from "../../../types/coursework";

const ARCHIVE_AFTER_MISSING_REFRESHES = 3;

function taskPayload(event: SchoolTask, seenAt: string) {
  let normalizedUtc: string | null = null;
  try {
    normalizedUtc = JSON.parse(event.originalData ?? "{}").normalizedUtc ?? null;
  } catch {}
  return {
    courseId: Number(event.courseId),
    title: event.title,
    taskType: event.type,
    dueDate: event.due,
    startTime: event.dueTime ?? null,
    endTime: event.endTime ?? null,
    source: "canvas",
    sourceKey: event.sourceKey ?? null,
    sourceEventId: event.sourceEventId ?? null,
    canvasUrl: event.url ?? null,
    originalData: event.originalData ?? null,
    normalizedUtc,
    lastSeenAt: seenAt,
    missingRefreshes: 0,
    cancelled: Boolean(event.cancelled),
    tentative: false,
    derived: false,
    needsReview: false,
    assumedTime: false,
    optional: Boolean(event.optional),
    notes: event.note ?? null,
    confirmed: true,
    updatedAt: seenAt,
  };
}

async function recordChanges(
  taskId: number,
  sourceKey: string,
  existing: typeof tasks.$inferSelect,
  next: ReturnType<typeof taskPayload>,
) {
  const tracked: Array<[keyof typeof existing, keyof typeof next, string]> = [
    ["title", "title", "title"],
    ["dueDate", "dueDate", "due_date"],
    ["startTime", "startTime", "start_time"],
    ["endTime", "endTime", "end_time"],
    ["taskType", "taskType", "task_type"],
    ["notes", "notes", "notes"],
    ["canvasUrl", "canvasUrl", "source_url"],
    ["cancelled", "cancelled", "cancelled"],
  ];
  const changes = tracked.flatMap(([oldKey, newKey, field]) => {
    const oldValue = existing[oldKey];
    const newValue = next[newKey];
    return String(oldValue ?? "") === String(newValue ?? "")
      ? []
      : [{ taskId, sourceKey, field, oldValue: oldValue == null ? null : String(oldValue), newValue: newValue == null ? null : String(newValue), changedAt: next.updatedAt }];
  });
  if (changes.length) await getDb().insert(taskSourceHistory).values(changes);
}

async function syncSource(
  source: typeof canvasSources.$inferSelect,
  knownCourses: Array<{ id: string; code: string; title: string; color: string }>,
  semester: typeof semesters.$inferSelect,
  mappings: Record<string, string>,
  timezone: string,
) {
  const db = getDb();
  const attemptedAt = new Date().toISOString();
  try {
    const calendar = await fetchCalendarText(source.feedUrl);
    let restrictions: string[] = [];
    try {
      restrictions = JSON.parse(source.courseRestrictions ?? "[]");
    } catch {}
    const parsed = parseCalendar(calendar.text, {
      allowedHosts: calendar.allowedHosts,
      courses: knownCourses,
      semester,
      sourceKey: source.sourceKey,
      mappings,
      timezone,
      restrictedCourseCodes: restrictions,
    });
    const existing = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.source, "canvas"), eq(tasks.sourceKey, source.sourceKey)));
    const byUid = new Map(existing.map((task) => [task.sourceEventId, task]));
    const seen = new Set<string>();

    for (const event of parsed.events) {
      if (!event.sourceEventId) continue;
      seen.add(event.sourceEventId);
      const values = taskPayload(event, attemptedAt);
      const current = byUid.get(event.sourceEventId);
      if (current) {
        await recordChanges(current.id, source.sourceKey, current, values);
        await db
          .update(tasks)
          .set(
            current.dueDate !== values.dueDate && !current.originalDueDate
              ? { ...values, originalDueDate: current.dueDate }
              : values,
          )
          .where(eq(tasks.id, current.id));
      } else {
        await db.insert(tasks).values({
          ...values,
          originalDueDate: event.due,
          createdAt: attemptedAt,
        });
      }
    }

    for (const current of existing) {
      if (!current.sourceEventId || seen.has(current.sourceEventId) || current.cancelled) continue;
      const missingRefreshes = current.missingRefreshes + 1;
      await db
        .update(tasks)
        .set({
          missingRefreshes,
          cancelled: missingRefreshes >= ARCHIVE_AFTER_MISSING_REFRESHES,
          updatedAt: attemptedAt,
        })
        .where(eq(tasks.id, current.id));
    }

    await db
      .update(canvasSources)
      .set({
        lastAttemptAt: attemptedAt,
        lastSyncedAt: attemptedAt,
        syncStatus: "connected",
        lastError: null,
        consecutiveFailures: 0,
      })
      .where(eq(canvasSources.id, source.id));
    return { sourceId: source.id, unmatchedCourses: parsed.unmatchedCourses, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canvas could not be refreshed.";
    await db
      .update(canvasSources)
      .set({
        lastAttemptAt: attemptedAt,
        syncStatus: "error",
        lastError: message,
        consecutiveFailures: source.consecutiveFailures + 1,
      })
      .where(eq(canvasSources.id, source.id));
    return { sourceId: source.id, unmatchedCourses: [] as string[], error: message };
  }
}

function serialize(task: typeof tasks.$inferSelect, sourceChanged = false): SchoolTask {
  return {
    id: String(task.id),
    courseId: String(task.courseId),
    title: task.title,
    type: task.taskType as SchoolTask["type"],
    due: task.dueDate ?? "",
    dueTime: task.startTime ?? undefined,
    endTime: task.endTime ?? undefined,
    note: task.notes ?? undefined,
    optional: Boolean(task.optional),
    tentative: Boolean(task.tentative),
    derived: Boolean(task.derived),
    needsReview: Boolean(task.needsReview),
    cancelled: Boolean(task.cancelled),
    source: "canvas",
    sourceKey: task.sourceKey ?? undefined,
    sourceEventId: task.sourceEventId ?? undefined,
    url: task.canvasUrl ?? undefined,
    originalData: task.originalData ?? undefined,
    lastSeenAt: task.lastSeenAt ?? undefined,
    sourceChanged,
  };
}

export async function GET() {
  const db = getDb();
  const [semester] = await db.select().from(semesters).orderBy(desc(semesters.id)).limit(1);
  if (!semester) return Response.json({ connected: false, events: [], courses: [], sources: [] });
  const sourceRows = await db.select().from(canvasSources).where(eq(canvasSources.semesterId, semester.id));
  const courseRows = await db.select().from(courses).where(eq(courses.semesterId, semester.id));
  const knownCourses = courseRows.map((course) => ({ id: String(course.id), code: course.courseCode, title: course.courseName, color: course.color ?? "#64748b" }));
  if (!sourceRows.length) return Response.json({ connected: false, events: [], courses: knownCourses, sources: [] });

  const mappingRows = await db.select().from(courseMappings);
  const mappings = Object.fromEntries(mappingRows.map((mapping) => [mapping.canvasCourseKey, String(mapping.courseId)]));
  const [timezoneRow] = await db.select().from(appSettings).where(eq(appSettings.key, "timezone")).limit(1);
  const results = await Promise.all(sourceRows.map((source) => syncSource(source, knownCourses, semester, mappings, timezoneRow?.value ?? "UTC")));
  const courseIds = courseRows.map((course) => course.id);
  const cached = courseIds.length
    ? await db.select().from(tasks).where(and(eq(tasks.source, "canvas"), inArray(tasks.courseId, courseIds)))
    : [];
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const historyRows = await db.select().from(taskSourceHistory);
  const recentlyChanged = new Set(
    historyRows
      .filter(
        (change) =>
          change.field === "due_date" &&
          new Date(change.changedAt).getTime() >= recentCutoff,
      )
      .map((change) => change.taskId),
  );
  const refreshedSources = await db.select().from(canvasSources).where(eq(canvasSources.semesterId, semester.id));
  const syncedAt = refreshedSources.map((source) => source.lastSyncedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

  return Response.json(
    {
      connected: true,
      sourceCount: sourceRows.length,
      syncedAt,
      events: cached.filter((task) => !task.cancelled && task.missingRefreshes < ARCHIVE_AFTER_MISSING_REFRESHES && Boolean(task.dueDate)).map((task) => serialize(task, recentlyChanged.has(task.id))),
      courses: knownCourses,
      unmatchedCourses: [...new Set(results.flatMap((result) => result.unmatchedCourses))],
      sourceErrors: results.filter((result) => result.error).map((result) => ({ sourceId: String(result.sourceId), error: result.error })),
      sources: refreshedSources.map((source) => ({
        id: String(source.id),
        name: source.sourceName,
        syncStatus: source.syncStatus,
        lastSyncedAt: source.lastSyncedAt,
        lastAttemptAt: source.lastAttemptAt,
        error: source.lastError,
      })),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
