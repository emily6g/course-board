import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { taskOverrides } from "../../../db/schema";

const allowedTypes = new Set(["homework", "quiz", "exam", "project", "reflection", "presentation", "discussion", "reading"]);

export async function GET() {
  try {
    const rows = await getDb().select().from(taskOverrides);
    return Response.json({ overrides: Object.fromEntries(rows.map((row) => [row.taskId, row])) });
  } catch {
    return Response.json({ error: "Task edits are unavailable." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as {
      taskId?: string;
      courseId?: string;
      title?: string;
      type?: string;
      due?: string;
      dueTime?: string;
      note?: string;
    };
    const taskId = payload.taskId?.trim() ?? "";
    const courseId = payload.courseId?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    const type = payload.type?.trim() ?? "";
    const due = payload.due?.trim() ?? "";
    const dueTime = payload.dueTime?.trim() ?? "";
    const note = payload.note?.trim() ?? "";
    if (!taskId || !courseId || !title || !allowedTypes.has(type) || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      return Response.json({ error: "A name, class, work type, and valid due date are required." }, { status: 400 });
    }

    const db = getDb();
    const values = { taskId, courseId, title, type, due, dueTime, note, updatedAt: new Date() };
    await db.insert(taskOverrides).values(values).onConflictDoUpdate({
      target: taskOverrides.taskId,
      set: { courseId, title, type, due, dueTime, note, updatedAt: new Date() },
    });
    const [saved] = await db.select().from(taskOverrides).where(eq(taskOverrides.taskId, taskId)).limit(1);
    return Response.json({ override: saved });
  } catch {
    return Response.json({ error: "The task edit could not be saved." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const taskId = new URL(request.url).searchParams.get("taskId")?.trim() ?? "";
    if (!taskId) return Response.json({ error: "A task is required." }, { status: 400 });
    await getDb().delete(taskOverrides).where(eq(taskOverrides.taskId, taskId));
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "The original task could not be restored." }, { status: 500 });
  }
}
