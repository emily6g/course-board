import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  appSettings,
  canvasSources,
  courseMappings,
  courses,
  semesters,
} from "../../../db/schema";
import { parseCalendar } from "../../../lib/ics";

export async function GET() {
  const db = getDb();
  const [semester] = await db
    .select()
    .from(semesters)
    .orderBy(desc(semesters.id))
    .limit(1);
  if (!semester)
    return Response.json({ connected: false, events: [], courses: [] });
  const sourceRows = await db
    .select()
    .from(canvasSources)
    .where(eq(canvasSources.semesterId, semester.id));
  if (!sourceRows.length)
    return Response.json({ connected: false, events: [], courses: [] });
  const courseRows = await db
    .select()
    .from(courses)
    .where(eq(courses.semesterId, semester.id));
  const mappingRows = await db.select().from(courseMappings);
  const [timezoneRow] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "timezone"))
    .limit(1);
  const knownCourses = courseRows.map((course) => ({
    id: String(course.id),
    code: course.courseCode,
    title: course.courseName,
    color: course.color ?? "#64748b",
  }));
  const mappings = Object.fromEntries(
    mappingRows.map((mapping) => [
      mapping.canvasCourseKey,
      String(mapping.courseId),
    ]),
  );
  const results = await Promise.allSettled(
    sourceRows.map(async (source) => {
      const url = new URL(source.feedUrl);
      const response = await fetch(url, {
        headers: { accept: "text/calendar" },
        redirect: "error",
      });
      if (!response.ok) throw new Error("Calendar request failed");
      const parsed = parseCalendar(await response.text(), {
        allowedHosts: [url.hostname],
        courses: knownCourses,
        semester,
        sourceKey: source.sourceKey,
        mappings,
        timezone: timezoneRow?.value ?? "UTC",
      });
      await db
        .update(canvasSources)
        .set({
          lastSyncedAt: new Date().toISOString(),
          syncStatus: "connected",
        })
        .where(eq(canvasSources.id, source.id));
      return parsed;
    }),
  );
  const refreshed = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (!refreshed.length)
    return Response.json(
      {
        connected: true,
        sourceCount: sourceRows.length,
        events: [],
        courses: knownCourses,
        error: "Canvas could not be refreshed.",
      },
      { status: 502 },
    );
  return Response.json(
    {
      connected: true,
      sourceCount: sourceRows.length,
      syncedAt: new Date().toISOString(),
      events: refreshed.flatMap((result) => result.events),
      courses: knownCourses,
      unmatchedCourses: [
        ...new Set(refreshed.flatMap((result) => result.unmatchedCourses)),
      ],
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
