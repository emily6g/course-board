import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { taskStatuses } from "../../../db/schema";

const allowedStatuses = new Set(["not-started", "in-progress", "done"]);

export async function GET() {
  try {
    const rows = await getDb().select().from(taskStatuses);
    return Response.json({ statuses: Object.fromEntries(rows.map((row) => [row.taskId, row.status])) });
  } catch {
    return Response.json({ error: "Status storage is unavailable." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as { taskId?: string; status?: string; manualOverride?: boolean };
    const taskId = payload.taskId?.trim() ?? "";
    const status = payload.status?.trim() ?? "";
    if (!taskId || !allowedStatuses.has(status)) {
      return Response.json({ error: "A valid task and status are required." }, { status: 400 });
    }

    const db = getDb();
    await db.insert(taskStatuses).values({ taskId, status, manualOverride: payload.manualOverride ?? true, updatedAt: new Date() }).onConflictDoUpdate({
      target: taskStatuses.taskId,
      set: { status, manualOverride: payload.manualOverride ?? true, updatedAt: new Date() },
    });
    const [saved] = await db.select().from(taskStatuses).where(eq(taskStatuses.taskId, taskId)).limit(1);
    return Response.json({ status: saved });
  } catch {
    return Response.json({ error: "The status could not be saved." }, { status: 500 });
  }
}
