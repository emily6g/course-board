import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { syllabi, taskCandidates } from "../../../../db/schema";
import {
  publishCandidateAsTask,
  unpublishCandidateTask,
} from "../../../../lib/tasks/publishCandidates";

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
      if (candidate.status !== "rejected")
        await unpublishCandidateTask(db, candidate);
      continue;
    }
    if (await publishCandidateAsTask(db, candidate, syllabusId)) inserted += 1;
  }

  await db
    .update(syllabi)
    .set({ processingStatus: "confirmed", processingError: null })
    .where(eq(syllabi.id, syllabusId));
  return Response.json({ confirmed: true, inserted });
}
