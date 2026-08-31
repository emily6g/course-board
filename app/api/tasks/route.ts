import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { courses, tasks } from "../../../db/schema";
import { isIsoDate } from "../../../lib/tasks/dates";
import { taskTypes } from "../../../types/coursework";

const allowedTypes = new Set<string>(taskTypes);

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const courseId = Number(body.courseId);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const taskType = typeof body.type === "string" ? body.type : "other";
  const dueDate = typeof body.due === "string" ? body.due : "";

  if (
    !Number.isInteger(courseId) ||
    !title ||
    !allowedTypes.has(taskType) ||
    !isIsoDate(dueDate)
  ) {
    return Response.json(
      { error: "A class, assignment name, work type, and date are required." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course)
    return Response.json({ error: "Course not found." }, { status: 404 });

  const [task] = await db
    .insert(tasks)
    .values({
      courseId,
      title,
      taskType,
      dueDate,
      startTime:
        typeof body.dueTime === "string" && body.dueTime.trim()
          ? body.dueTime.trim()
          : null,
      source: "manual",
      optional: Boolean(body.optional),
      notes:
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim()
          : null,
      confirmed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return Response.json({
    task: {
      id: String(task.id),
      courseId: String(task.courseId),
      title: task.title,
      type: task.taskType,
      due: task.dueDate,
      dueTime: task.startTime ?? undefined,
      note: task.notes ?? undefined,
      source: task.source,
    },
  });
}
