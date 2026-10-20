import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { taskCandidates, tasks } from "../../db/schema";

type Db = ReturnType<typeof getDb>;
type Candidate = typeof taskCandidates.$inferSelect;

export async function publishCandidateAsTask(
  db: Db,
  candidate: Candidate,
  syllabusId: number,
) {
  if (!candidate.dueDate) return false;
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
  const values = {
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
  };
  if (!existing) {
    await db.insert(tasks).values({
      ...values,
      source: "syllabus",
      sourceKey: `syllabus-${syllabusId}`,
      sourceEventId,
      confirmed: true,
      createdAt: new Date().toISOString(),
    });
  } else {
    await db
      .update(tasks)
      .set({ ...values, updatedAt: new Date().toISOString() })
      .where(eq(tasks.id, existing.id));
  }
  await db
    .update(taskCandidates)
    .set({ status: "confirmed", updatedAt: new Date().toISOString() })
    .where(eq(taskCandidates.id, candidate.id));
  return true;
}

export async function unpublishCandidateTask(db: Db, candidate: Candidate) {
  const sourceEventId = `syllabus-candidate-${candidate.id}`;
  await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.courseId, candidate.courseId),
        eq(tasks.source, "syllabus"),
        eq(tasks.sourceEventId, sourceEventId),
      ),
    );
  await db
    .update(taskCandidates)
    .set({ status: "rejected", updatedAt: new Date().toISOString() })
    .where(eq(taskCandidates.id, candidate.id));
}
