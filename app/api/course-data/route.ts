import { getDb } from "../../../db";
import { desc, eq } from "drizzle-orm";
import {
  appSettings,
  courses,
  semesters,
  syllabi,
  tasks,
} from "../../../db/schema";

export async function GET() {
  const db = getDb();

  const [currentSemester] = await db
    .select()
    .from(semesters)
    .orderBy(desc(semesters.id))
    .limit(1);
  const courseRows = currentSemester
    ? await db
        .select()
        .from(courses)
        .where(eq(courses.semesterId, currentSemester.id))
    : [];
  const courseIds = new Set(courseRows.map((course) => course.id));
  const taskRows = currentSemester
    ? (await db.select().from(tasks)).filter(
        (task) => courseIds.has(task.courseId) && task.confirmed !== false,
      )
    : [];
  const syllabusRows = currentSemester
    ? (await db.select().from(syllabi)).filter((syllabus) =>
        courseIds.has(syllabus.courseId),
      )
    : [];
  const [displayName] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "displayName"))
    .limit(1);
  const [timezone] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "timezone"))
    .limit(1);
  const [setupComplete] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "setupComplete"))
    .limit(1);

  return Response.json({
    semester: currentSemester
      ? {
          id: String(currentSemester.id),
          name: currentSemester.name,
          startDate: currentSemester.startDate,
          endDate: currentSemester.endDate,
        }
      : null,

    courses: courseRows.map((course) => ({
      id: String(course.id),
      code: course.courseCode,
      title: course.courseName,
      color: course.color ?? "#64748b",
      instructor: course.instructor ?? undefined,
    })),

    tasks: taskRows.map((task) => ({
      id: String(task.id),
      courseId: String(task.courseId),
      title: task.title,
      type: task.taskType,
      due: task.dueDate ?? "",
      dueTime: task.startTime ?? undefined,
      endTime: task.endTime ?? undefined,
      note: task.notes ?? undefined,
      optional: Boolean(task.optional),
      tentative: Boolean(task.tentative),
      derived: Boolean(task.derived),
      needsReview: Boolean(task.needsReview),
      cancelled: Boolean(task.cancelled),
      source: task.source,
      sourceKey: task.sourceKey ?? undefined,
      sourceEventId: task.sourceEventId ?? undefined,
      url: task.canvasUrl ?? undefined,
      originalData: task.originalData ?? undefined,
      lastSeenAt: task.lastSeenAt ?? undefined,
    })),
    syllabi: syllabusRows.map((syllabus) => ({
      id: String(syllabus.id),
      courseId: String(syllabus.courseId),
      filename: syllabus.originalFilename,
      status: syllabus.processingStatus ?? "uploaded",
      error: syllabus.processingError ?? undefined,
    })),
    displayName: displayName?.value ?? "",
    timezone: timezone?.value ?? "",
    setupComplete: setupComplete?.value === "true",
  });
}

export async function POST(request: Request) {
  const db = getDb();

  const body = (await request.json()) as {
    name?: string;
    startDate?: string;
    endDate?: string;
    timezone?: string;
  };

  const name = body.name?.trim();
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();
  const timezone = body.timezone?.trim();

  if (!name || !startDate || !endDate) {
    return Response.json(
      { error: "Semester name, start date, and end date are required." },
      { status: 400 },
    );
  }

  if (endDate <= startDate) {
    return Response.json(
      { error: "The semester end date must be after the start date." },
      { status: 400 },
    );
  }

  const result = await db
    .insert(semesters)
    .values({
      name,
      startDate,
      endDate,
    })
    .returning();

  const semester = result[0];
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      await db
        .insert(appSettings)
        .values({
          key: "timezone",
          value: timezone,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: timezone, updatedAt: new Date().toISOString() },
        });
    } catch {}
  }

  return Response.json({
    semester: {
      id: String(semester.id),
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
    },
  });
}
