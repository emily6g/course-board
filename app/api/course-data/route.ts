import { getDb } from "../../../db";
import { courses, semesters, tasks } from "../../../db/schema";

export async function GET() {
  const db = getDb();

  const semesterRows = await db.select().from(semesters);
  const courseRows = await db.select().from(courses);
  const taskRows = await db.select().from(tasks);

  const currentSemester = semesterRows[0] ?? null;

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
    })),

    tasks: taskRows.map((task) => ({
      id: String(task.id),
      courseId: String(task.courseId),
      title: task.title,
      type: task.taskType,
      due: task.dueDate,
      dueTime: task.startTime ?? undefined,
      note: task.notes ?? undefined,
      optional: Boolean(task.optional),
      source: task.source,
    })),
  });
}


export async function POST(request: Request) {
  const db = getDb();

  const body = (await request.json()) as {
    name?: string;
    startDate?: string;
    endDate?: string;
  };

  const name = body.name?.trim();
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();

  if (!name || !startDate || !endDate) {
    return Response.json(
      { error: "Semester name, start date, and end date are required." },
      { status: 400 }
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

  return Response.json({
    semester: {
      id: String(semester.id),
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
    },
  });
}