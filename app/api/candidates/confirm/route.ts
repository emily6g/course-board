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
  const unresolved = candidates.filter(
    (candidate) =>
      selectedIds.has(candidate.id) &&
      (!candidate.dueDate || candidate.needsReview),
  );
  if (unresolved.length)
    return Response.json(
      {
        error:
          "Review every flagged item and add any missing date before publishing.",
        unresolvedIds: unresolved.map((candidate) => String(candidate.id)),
      },
      { status: 409 },
    );
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
          endTime: candidate.endTime,
          source: "syllabus",
          sourceKey: `syllabus-${syllabusId}`,
          sourceEventId,
          originalData: candidate.originalData,
          optional: candidate.optional,
          tentative: candidate.tentative,
          derived: candidate.derived,
          needsReview: false,
          notes: candidate.notes,
          confirmed: true,
          createdAt: new Date().toISOString(),
        });
      inserted += 1;
    } else {
      await db
        .update(tasks)
        .set({
          courseId: candidate.courseId,
          title: candidate.title,
          taskType: candidate.taskType,
          dueDate: candidate.dueDate,
          startTime: candidate.dueTime,
          endTime: candidate.endTime,
          originalData: candidate.originalData,
          optional: candidate.optional,
          tentative: candidate.tentative,
          derived: candidate.derived,
          needsReview: false,
          notes: candidate.notes,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, existing.id));
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
