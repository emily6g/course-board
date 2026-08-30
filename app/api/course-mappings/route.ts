import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { courseMappings, courses } from "../../../db/schema";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    canvasCourseKey?: string;
    courseId?: string;
  };
  const canvasCourseKey = body.canvasCourseKey?.trim().toUpperCase() ?? "";
  const courseId = Number(body.courseId);
  if (!canvasCourseKey || !Number.isInteger(courseId))
    return Response.json(
      { error: "A Canvas course and Course Board course are required." },
      { status: 400 },
    );
  const db = getDb();
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course)
    return Response.json({ error: "Course not found." }, { status: 404 });
  await db
    .insert(courseMappings)
    .values({ canvasCourseKey, courseId, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: courseMappings.canvasCourseKey,
      set: { courseId },
    });
  return Response.json({ saved: true });
}
