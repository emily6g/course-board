import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { syllabi, taskCandidates, tasks } from "../../../../db/schema";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    syllabusId?: string;
    candidateIds?: string[];
  };
  const syllabusId = Number(body.syllabusId);
  const selectedIds = new Set(
    (body.candidateIds ?? []).map(Number).filter(Number.isInteger),
  );
  if (!Number.isInteger(syllabusId))
    return Response.json(
      { error: "A valid syllabus is required." },
      { status: 400 },
    );
  const db = getDb();
  const candidates = await db
    .select()
    .from(taskCandidates)
    .where(eq(taskCandidates.syllabusId, syllabusId));
  let inserted = 0;

  for (const candidate of candidates) {
    if (!selectedIds.has(candidate.id) || !candidate.dueDate) {
      if (candidate.status === "pending")
        await db
          .update(taskCandidates)
          .set({ status: "rejected", updatedAt: new Date().toISOString() })
          .where(eq(taskCandidates.id, candidate.id));
      continue;
    }
    const sourceEventId = `syllabus-candidate-${candidate.id}`;
    const [existing] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.courseId, candidate.courseId),
          eq(tasks.source, "syllabus"),
          eq(tasks.sourceEventId, sourceEventId),
        ),
      )
      .limit(1);
    if (!existing) {
      await db
        .insert(tasks)
        .values({
          courseId: candidate.courseId,
          title: candidate.title,
          taskType: candidate.taskType,
          dueDate: candidate.dueDate,
          startTime: candidate.dueTime,
          source: "syllabus",
          sourceEventId,
          optional: candidate.optional,
          notes: candidate.notes,
          confirmed: true,
          createdAt: new Date().toISOString(),
        });
      inserted += 1;
    }
    await db
      .update(taskCandidates)
      .set({ status: "confirmed", updatedAt: new Date().toISOString() })
      .where(eq(taskCandidates.id, candidate.id));
  }

  await db
    .update(syllabi)
    .set({ processingStatus: "confirmed", processingError: null })
    .where(eq(syllabi.id, syllabusId));
  return Response.json({ confirmed: true, inserted });
}
