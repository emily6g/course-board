import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { syllabi, taskCandidates } from "../../../db/schema";
import { isIsoDate } from "../../../lib/tasks/dates";
import { taskTypes } from "../../../types/coursework";

const allowedTypes = new Set<string>(taskTypes);

function serialize(row: typeof taskCandidates.$inferSelect) {
  return {
    id: String(row.id),
    syllabusId: String(row.syllabusId),
    courseId: String(row.courseId),
    title: row.title,
    type: row.taskType,
    due: row.dueDate ?? "",
    dueTime: row.dueTime ?? "",
    endTime: row.endTime ?? "",
    note: row.notes ?? "",
    optional: Boolean(row.optional),
    tentative: Boolean(row.tentative),
    derived: Boolean(row.derived),
    needsReview: Boolean(row.needsReview),
    reviewReason: row.reviewReason ?? undefined,
    sourcePage: row.sourcePage ?? undefined,
    sourceRow: row.sourceRow ?? undefined,
    alternativeGroup: row.alternativeGroup ?? undefined,
    confidence: row.confidence / 100,
    sourceText: row.sourceText ?? "",
    status: row.status,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const syllabusId = Number(url.searchParams.get("syllabusId"));
  const rows = Number.isInteger(syllabusId)
    ? await getDb()
        .select()
        .from(taskCandidates)
        .where(eq(taskCandidates.syllabusId, syllabusId))
    : await getDb()
        .select()
        .from(taskCandidates)
        .where(eq(taskCandidates.status, "pending"));
  return Response.json({ candidates: rows.map(serialize) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const syllabusId = Number(body.syllabusId);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const taskType = typeof body.type === "string" ? body.type : "other";
  const dueDate = typeof body.due === "string" ? body.due : "";
  if (
    !Number.isInteger(syllabusId) ||
    !title ||
    !allowedTypes.has(taskType) ||
    (dueDate !== "" && !isIsoDate(dueDate))
  ) {
    return Response.json(
      { error: "Title, work type, and syllabus are required. Add a date before confirming the item." },
      { status: 400 },
    );
  }
  const db = getDb();
  const [syllabus] = await db
    .select()
    .from(syllabi)
    .where(eq(syllabi.id, syllabusId))
    .limit(1);
  if (!syllabus)
    return Response.json({ error: "Syllabus not found." }, { status: 404 });
  const [candidate] = await db
    .insert(taskCandidates)
    .values({
      syllabusId,
      courseId: syllabus.courseId,
      title,
      taskType,
      dueDate: dueDate || null,
      dueTime: typeof body.dueTime === "string" ? body.dueTime.trim() : null,
      endTime: typeof body.endTime === "string" ? body.endTime.trim() : null,
      notes: typeof body.note === "string" ? body.note.trim() : null,
      optional: Boolean(body.optional),
      tentative: Boolean(body.tentative),
      needsReview: !dueDate || Boolean(body.needsReview),
      reviewReason: !dueDate ? "Needs date confirmation" : null,
      confidence: 100,
      status: "pending",
    })
    .returning();
  return Response.json({ candidate: serialize(candidate) });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const taskType = typeof body.type === "string" ? body.type : "other";
  const dueDate = typeof body.due === "string" ? body.due : "";
  const status = body.status === "rejected" ? "rejected" : "pending";
  if (
    !Number.isInteger(id) ||
    !title ||
    !allowedTypes.has(taskType) ||
    (dueDate !== "" && !isIsoDate(dueDate))
  ) {
    return Response.json(
      { error: "A valid title and work type are required. Add a valid date before confirming." },
      { status: 400 },
    );
  }
  const [candidate] = await getDb()
    .update(taskCandidates)
    .set({
      title,
      taskType,
      dueDate: dueDate || null,
      dueTime: typeof body.dueTime === "string" ? body.dueTime.trim() : null,
      endTime: typeof body.endTime === "string" ? body.endTime.trim() : null,
      notes: typeof body.note === "string" ? body.note.trim() : null,
      optional: Boolean(body.optional),
      tentative: Boolean(body.tentative),
      needsReview: Boolean(body.needsReview) || !dueDate,
      reviewReason:
        Boolean(body.needsReview) || !dueDate
          ? typeof body.reviewReason === "string"
            ? body.reviewReason.trim()
            : "Needs confirmation"
          : null,
      status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(taskCandidates.id, id))
    .returning();
  if (!candidate)
    return Response.json({ error: "Candidate not found." }, { status: 404 });
  return Response.json({ candidate: serialize(candidate) });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id))
    return Response.json(
      { error: "A valid candidate is required." },
      { status: 400 },
    );
  await getDb().delete(taskCandidates).where(eq(taskCandidates.id, id));
  return Response.json({ deleted: true });
}
