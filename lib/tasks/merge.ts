import type { SchoolTask } from "../../types/coursework";
import { normalizeCourseworkTitle } from "../syllabus/parseCoursework.ts";

const numberWords: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

export function normalizeTaskTitle(value: string) {
  return normalizeCourseworkTitle(value)
    .replace(/\b(assignment|homework|due)\b/g, "")
    .replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g,
      (word) => numberWords[word],
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalizeTaskTitle(value).split(" ").filter((token) => token.length > 1));
}

function similarity(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / new Set([...left, ...right]).size;
}

function assignmentNumber(value: string) {
  return normalizeTaskTitle(value).match(/\b\d+\b/)?.[0] ?? null;
}

function isSubsetOf(small: Set<string>, big: Set<string>) {
  if (!small.size) return false;
  for (const token of small) if (!big.has(token)) return false;
  return true;
}

function safeCrossSourceMatch(a: SchoolTask, b: SchoolTask) {
  if (a.courseId !== b.courseId) return false;
  if (/\b(review|study guide|proposal|presentation|reflection)\b/i.test(a.title) !== /\b(review|study guide|proposal|presentation|reflection)\b/i.test(b.title)) return false;
  const left = normalizeTaskTitle(a.title);
  const right = normalizeTaskTitle(b.title);
  const leftNumber = assignmentNumber(a.title);
  const rightNumber = assignmentNumber(b.title);
  const sameTitle = left === right && (left.length >= 3 || Boolean(leftNumber));
  const sameType = a.type === b.type;
  // A matching assignment number plus the same work type and course is
  // already specific enough on its own (e.g. syllabus "Homework 1" vs
  // Canvas "Homework 1: Arrays and Loops") — a bare number is too short to
  // register on the word-overlap score, so that score should not gate it.
  const strongNumberMatch = Boolean(leftNumber && rightNumber && leftNumber === rightNumber && sameType);
  // Without a number to anchor on, fall back to a high word-overlap score,
  // or one title's words being a strict subset of the other's (Canvas
  // restating the syllabus title with extra wording appended).
  const leftTokens = tokens(a.title);
  const rightTokens = tokens(b.title);
  const strongWordingMatch =
    sameType &&
    (similarity(a.title, b.title) >= 0.82 ||
      isSubsetOf(leftTokens, rightTokens) ||
      isSubsetOf(rightTokens, leftTokens));
  const distance = dateDistance(a.due, b.due);
  return (sameTitle && distance <= 30) || ((strongNumberMatch || strongWordingMatch) && distance <= 14);
}

function dateDistance(a: string, b: string) {
  return (
    Math.abs(
      new Date(`${a}T12:00:00Z`).getTime() -
        new Date(`${b}T12:00:00Z`).getTime(),
    ) / 86_400_000
  );
}

export function mergeTasks(
  syllabusTasks: SchoolTask[],
  canvasTasks: SchoolTask[],
) {
  const merged: SchoolTask[] = syllabusTasks.map((task) => ({
    ...task,
    source: task.source ?? ("syllabus" as const),
  }));

  for (const canvasTask of canvasTasks) {
    const matchIndex = merged.findIndex(
      (task) =>
        task.source !== "canvas" && safeCrossSourceMatch(task, canvasTask),
    );

    if (matchIndex < 0) {
      merged.push(canvasTask);
      continue;
    }

    const syllabusTask = merged[matchIndex];
    merged[matchIndex] = {
      ...syllabusTask,
      due: canvasTask.due,
      dueTime: canvasTask.dueTime,
      endTime: canvasTask.endTime,
      source: "merged",
      sourceKey: canvasTask.sourceKey,
      sourceEventId: canvasTask.sourceEventId,
      url: canvasTask.url,
      optional: Boolean(syllabusTask.optional || canvasTask.optional),
      note: syllabusTask.note || canvasTask.note,
      originalData: JSON.stringify({
        syllabus: syllabusTask.originalData ?? null,
        canvas: canvasTask.originalData ?? null,
        syllabusDueDate: syllabusTask.due,
      }),
      sourceChanged: canvasTask.sourceChanged,
      tentative: false,
    };
  }

  return merged;
}
