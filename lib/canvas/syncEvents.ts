import type { SchoolTask } from "../../types/coursework";

export type CanvasTaskValues = {
  courseId: number;
  title: string;
  taskType: string;
  dueDate: string;
  startTime: string | null;
  endTime: string | null;
  source: "canvas";
  sourceKey: string | null;
  sourceEventId: string | null;
  canvasUrl: string | null;
  originalData: string | null;
  normalizedUtc: string | null;
  lastSeenAt: string;
  missingRefreshes: number;
  cancelled: boolean;
  tentative: boolean;
  derived: boolean;
  needsReview: boolean;
  assumedTime: boolean;
  optional: boolean;
  notes: string | null;
  confirmed: boolean;
  updatedAt: string;
};

export type ExistingCanvasTask = {
  id: number;
  sourceEventId: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  missingRefreshes: number;
  cancelled: boolean;
  title: string;
  startTime: string | null;
  endTime: string | null;
  taskType: string;
  notes: string | null;
  canvasUrl: string | null;
};

export function canvasTaskValues(
  event: SchoolTask,
  seenAt: string,
): CanvasTaskValues {
  let normalizedUtc: string | null = null;
  try {
    normalizedUtc =
      JSON.parse(event.originalData ?? "{}").normalizedUtc ?? null;
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

const TRACKED_FIELDS: Array<
  [keyof ExistingCanvasTask, keyof CanvasTaskValues, string]
> = [
  ["title", "title", "title"],
  ["dueDate", "dueDate", "due_date"],
  ["startTime", "startTime", "start_time"],
  ["endTime", "endTime", "end_time"],
  ["taskType", "taskType", "task_type"],
  ["notes", "notes", "notes"],
  ["canvasUrl", "canvasUrl", "source_url"],
  ["cancelled", "cancelled", "cancelled"],
];

export function changedFields(
  existing: ExistingCanvasTask,
  next: CanvasTaskValues,
) {
  return TRACKED_FIELDS.flatMap(([oldKey, newKey, field]) => {
    const oldValue = existing[oldKey];
    const newValue = next[newKey];
    return String(oldValue ?? "") === String(newValue ?? "")
      ? []
      : [
          {
            field,
            oldValue: oldValue == null ? null : String(oldValue),
            newValue: newValue == null ? null : String(newValue),
          },
        ];
  });
}

export type CanvasSyncPlan = {
  toInsert: Array<{ values: CanvasTaskValues; originalDueDate: string }>;
  toUpdate: Array<{
    id: number;
    values: CanvasTaskValues & { originalDueDate?: string | null };
    changes: ReturnType<typeof changedFields>;
  }>;
  toArchive: Array<{ id: number; missingRefreshes: number; cancelled: boolean }>;
};

/**
 * Pure diff of a freshly-parsed Canvas feed against the tasks already
 * stored for that source, keyed by the feed's stable per-event UID. A new
 * UID becomes an insert, a known UID becomes an update (seeding
 * originalDueDate the first time the date actually changes), and a
 * previously-seen UID absent from this fetch is one step closer to being
 * archived rather than removed immediately, so a single missed refresh
 * never drops real coursework.
 */
export function planCanvasSync(
  events: SchoolTask[],
  existing: ExistingCanvasTask[],
  attemptedAt: string,
  archiveAfterMissingRefreshes: number,
): CanvasSyncPlan {
  const byUid = new Map(
    existing
      .filter((task) => task.sourceEventId)
      .map((task) => [task.sourceEventId as string, task]),
  );
  const seen = new Set<string>();
  const toInsert: CanvasSyncPlan["toInsert"] = [];
  const toUpdate: CanvasSyncPlan["toUpdate"] = [];
  const toArchive: CanvasSyncPlan["toArchive"] = [];

  for (const event of events) {
    if (!event.sourceEventId) continue;
    seen.add(event.sourceEventId);
    const values = canvasTaskValues(event, attemptedAt);
    const current = byUid.get(event.sourceEventId);
    if (current) {
      toUpdate.push({
        id: current.id,
        values:
          current.dueDate !== values.dueDate && !current.originalDueDate
            ? { ...values, originalDueDate: current.dueDate }
            : values,
        changes: changedFields(current, values),
      });
    } else {
      toInsert.push({ values, originalDueDate: event.due });
    }
  }

  for (const current of existing) {
    if (!current.sourceEventId || seen.has(current.sourceEventId) || current.cancelled)
      continue;
    const missingRefreshes = current.missingRefreshes + 1;
    toArchive.push({
      id: current.id,
      missingRefreshes,
      cancelled: missingRefreshes >= archiveAfterMissingRefreshes,
    });
  }

  return { toInsert, toUpdate, toArchive };
}
