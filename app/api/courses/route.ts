import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { courses, semesters, syllabi, tasks } from "../../../db/schema";

function coursePayload(body: Record<string, unknown>) {
  const courseCode =
    typeof body.courseCode === "string"
      ? body.courseCode.trim().toUpperCase()
      : "";
  const courseName =
    typeof body.courseName === "string" ? body.courseName.trim() : "";
  const instructor =
    typeof body.instructor === "string" ? body.instructor.trim() : "";
  const color =
    typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)
      ? body.color
      : "#517562";
  return { courseCode, courseName, instructor: instructor || null, color };
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const values = coursePayload(body);
  const semesterId = Number(body.semesterId);
  if (
    !Number.isInteger(semesterId) ||
    !values.courseCode ||
    !values.courseName
  ) {
    return Response.json(
      { error: "Course code and name are required." },
      { status: 400 },
    );
  }
  const db = getDb();
  const [semester] = await db
    .select()
    .from(semesters)
    .where(eq(semesters.id, semesterId))
    .limit(1);
  if (!semester)
    return Response.json({ error: "Semester not found." }, { status: 404 });
  const [course] = await db
    .insert(courses)
    .values({ semesterId, ...values })
    .returning();
  return Response.json({
    course: {
      id: String(course.id),
      code: course.courseCode,
      title: course.courseName,
      instructor: course.instructor,
      color: course.color,
    },
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const values = coursePayload(body);
  if (!Number.isInteger(id) || !values.courseCode || !values.courseName) {
    return Response.json(
      { error: "Valid course details are required." },
      { status: 400 },
    );
  }
  const [course] = await getDb()
    .update(courses)
    .set(values)
    .where(eq(courses.id, id))
    .returning();
  if (!course)
    return Response.json({ error: "Course not found." }, { status: 404 });
  return Response.json({
    course: {
      id: String(course.id),
      code: course.courseCode,
      title: course.courseName,
      instructor: course.instructor,
      color: course.color,
    },
  });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id))
    return Response.json(
      { error: "A valid course is required." },
      { status: 400 },
    );
  const db = getDb();
  const taskCount = await db.select().from(tasks).where(eq(tasks.courseId, id));
  const syllabusCount = await db
    .select()
    .from(syllabi)
    .where(eq(syllabi.courseId, id));
  if (taskCount.length || syllabusCount.length) {
    return Response.json(
      {
        error:
          "Remove this course's coursework and syllabi before deleting it.",
      },
      { status: 409 },
    );
  }
  await db.delete(courses).where(eq(courses.id, id));
  return Response.json({ deleted: true });
}
