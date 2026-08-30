import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  courses,
  semesters,
  syllabi,
  taskCandidates,
  tasks,
} from "../../../db/schema";
import { extractDocumentText } from "../../../lib/syllabus/extractText";
import { parseCoursework } from "../../../lib/syllabus/parseCoursework";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeFilename(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "syllabus"
  );
}

export async function GET(request: Request) {
  const courseId = Number(new URL(request.url).searchParams.get("courseId"));
  const rows = Number.isInteger(courseId)
    ? await getDb().select().from(syllabi).where(eq(syllabi.courseId, courseId))
    : await getDb().select().from(syllabi);
  return Response.json({
    syllabi: rows.map((row) => ({
      id: String(row.id),
      courseId: String(row.courseId),
      filename: row.originalFilename,
      status: row.processingStatus,
      error: row.processingError,
    })),
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const courseId = Number(form.get("courseId"));
  if (!(file instanceof File) || !Number.isInteger(courseId)) {
    return Response.json(
      { error: "Choose a course and syllabus file." },
      { status: 400 },
    );
  }
  const extension = file.name.toLowerCase().split(".").pop();
  if (
    !file.size ||
    file.size > MAX_FILE_SIZE ||
    !allowedTypes.has(file.type) ||
    !["pdf", "docx"].includes(extension ?? "")
  ) {
    return Response.json(
      { error: "Upload a non-empty PDF or DOCX file up to 20 MB." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course)
    return Response.json({ error: "Course not found." }, { status: 404 });
  const [semester] = await db
    .select()
    .from(semesters)
    .where(eq(semesters.id, course.semesterId))
    .limit(1);
  if (!semester)
    return Response.json({ error: "Semester not found." }, { status: 404 });

  const fileKey = `semester-${semester.id}/course-${course.id}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
  const bytes = await file.arrayBuffer();
  await env.SYLLABI.put(fileKey, bytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalFilename: file.name },
  });
  const [syllabus] = await db
    .insert(syllabi)
    .values({
      courseId,
      fileKey,
      originalFilename: file.name,
      mimeType: file.type,
      processingStatus: "processing",
      uploadedAt: new Date().toISOString(),
    })
    .returning();

  try {
    const text = await extractDocumentText(bytes, file.type, file.name);
    if (!text.trim())
      throw new Error(
        "No readable text was found. Scanned PDFs are not supported yet.",
      );
    const parsed = parseCoursework(text, semester.startDate, semester.endDate);
    if (parsed.length) {
      await db
        .insert(taskCandidates)
        .values(
          parsed.map((candidate) => ({
            ...candidate,
            syllabusId: syllabus.id,
            courseId,
          })),
        );
    }
    await db
      .update(syllabi)
      .set({
        processingStatus: "review",
        processingError: parsed.length
          ? null
          : "No dated coursework was found. Add items manually on the review screen.",
      })
      .where(eq(syllabi.id, syllabus.id));
    return Response.json({
      syllabus: {
        id: String(syllabus.id),
        courseId: String(courseId),
        filename: file.name,
        status: "review",
      },
      candidateCount: parsed.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The syllabus could not be processed.";
    await db
      .update(syllabi)
      .set({ processingStatus: "failed", processingError: message })
      .where(eq(syllabi.id, syllabus.id));
    return Response.json(
      { error: message, syllabusId: String(syllabus.id) },
      { status: 422 },
    );
  }
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id))
    return Response.json(
      { error: "A valid syllabus is required." },
      { status: 400 },
    );
  const db = getDb();
  const [syllabus] = await db
    .select()
    .from(syllabi)
    .where(eq(syllabi.id, id))
    .limit(1);
  if (!syllabus)
    return Response.json({ error: "Syllabus not found." }, { status: 404 });
  const candidates = await db
    .select()
    .from(taskCandidates)
    .where(eq(taskCandidates.syllabusId, id));
  for (const candidate of candidates) {
    await db
      .delete(tasks)
      .where(eq(tasks.sourceEventId, `syllabus-candidate-${candidate.id}`));
  }
  await env.SYLLABI.delete(syllabus.fileKey);
  await db.delete(taskCandidates).where(eq(taskCandidates.syllabusId, id));
  await db.delete(syllabi).where(eq(syllabi.id, id));
  return Response.json({ deleted: true });
}
