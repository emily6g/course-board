import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  canvasSources,
  semesters,
  taskSourceHistory,
  tasks,
} from "../../../db/schema";
import {
  fetchCalendarText,
  validCanvasUrl,
} from "../../../lib/canvas/fetchCalendar";

async function testFeed(feedUrl: string) {
  await fetchCalendarText(feedUrl);
}

export async function GET() {
  const db = getDb();
  const [semester] = await db
    .select()
    .from(semesters)
    .orderBy(desc(semesters.id))
    .limit(1);
  if (!semester) return Response.json({ sources: [] });
  const rows = await db
    .select()
    .from(canvasSources)
    .where(eq(canvasSources.semesterId, semester.id));
  return Response.json({
    sources: rows.map((row) => ({
      id: String(row.id),
      name: row.sourceName,
      sourceKey: row.sourceKey,
      connected: true,
      lastSyncedAt: row.lastSyncedAt,
      syncStatus: row.syncStatus,
      institution: row.institution,
      courseRestrictions: JSON.parse(row.courseRestrictions ?? "[]"),
      lastAttemptAt: row.lastAttemptAt,
      error: row.lastError,
      maskedUrl: (() => {
        try {
          const url = new URL(row.feedUrl);
          const tail = url.pathname.slice(-8);
          return `${url.hostname}/feeds/...${tail}`;
        } catch {
          return "Protected Canvas feed";
        }
      })(),
    })),
  });
}
export async function POST(request: Request) {
  const body = (await request.json()) as {
    semesterId?: string;
    name?: string;
    feedUrl?: string;
    institution?: string;
    courseRestrictions?: string[];
    testOnly?: boolean;
  };
  const semesterId = Number(body.semesterId);
  const feedUrl = body.feedUrl?.trim() ?? "";
  if (!Number.isInteger(semesterId) || !validCanvasUrl(feedUrl))
    return Response.json(
      { error: "Enter a valid HTTPS Canvas calendar feed URL ending in .ics." },
      { status: 400 },
    );
  try {
    await testFeed(feedUrl);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The feed could not be reached.",
      },
      { status: 422 },
    );
  }
  if (body.testOnly) return Response.json({ valid: true });
  const name = body.name?.trim() || "Canvas";
  const sourceKey = `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "canvas"
  }-${crypto.randomUUID().slice(0, 8)}`;
  const [source] = await getDb()
    .insert(canvasSources)
    .values({
      semesterId,
      sourceName: name,
      sourceKey,
      feedUrl,
      institution: body.institution?.trim() || name,
      courseRestrictions: JSON.stringify(
        (body.courseRestrictions ?? [])
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
      ),
      syncStatus: "connected",
      createdAt: new Date().toISOString(),
    })
    .returning();
  return Response.json({
    source: {
      id: String(source.id),
      name: source.sourceName,
      sourceKey: source.sourceKey,
      connected: true,
      institution: source.institution,
      courseRestrictions: JSON.parse(source.courseRestrictions ?? "[]"),
    },
  });
}
export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id))
    return Response.json(
      { error: "A valid source is required." },
      { status: 400 },
    );
  const db = getDb();
  const [source] = await db
    .select()
    .from(canvasSources)
    .where(eq(canvasSources.id, id))
    .limit(1);
  if (!source)
    return Response.json({ error: "Canvas source not found." }, { status: 404 });
  const sourceTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.sourceKey, source.sourceKey));
  if (sourceTasks.length)
    await db
      .delete(taskSourceHistory)
      .where(inArray(taskSourceHistory.taskId, sourceTasks.map((task) => task.id)));
  await db.delete(tasks).where(eq(tasks.sourceKey, source.sourceKey));
  await db.delete(canvasSources).where(eq(canvasSources.id, id));
  return Response.json({ deleted: true });
}
