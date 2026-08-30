import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { canvasSources, semesters } from "../../../db/schema";

function validCanvasUrl(value: string) {
  try {
    const url = new URL(value);
    const blocked =
      /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !blocked.test(url.hostname) &&
      /\.ics(?:$|\?)/i.test(url.pathname + url.search)
    );
  } catch {
    return false;
  }
}
async function testFeed(feedUrl: string) {
  const response = await fetch(feedUrl, {
    headers: { accept: "text/calendar" },
    redirect: "error",
  });
  const text = await response.text();
  if (!response.ok || !/BEGIN:VCALENDAR/i.test(text))
    throw new Error("Canvas did not return a valid calendar feed.");
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
    })),
  });
}
export async function POST(request: Request) {
  const body = (await request.json()) as {
    semesterId?: string;
    name?: string;
    feedUrl?: string;
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
  await getDb().delete(canvasSources).where(eq(canvasSources.id, id));
  return Response.json({ deleted: true });
}
