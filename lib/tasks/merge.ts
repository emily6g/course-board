import type { SchoolTask } from "../../types/coursework";

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
  return value
    .toLowerCase()
    .replace(/\b(assignment|assign|due)\b/g, "")
    .replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g,
      (word) => numberWords[word],
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
  const merged = syllabusTasks.map((task) => ({
    ...task,
    source: task.source ?? ("syllabus" as const),
  }));

  for (const canvasTask of canvasTasks) {
    const matchIndex = merged.findIndex(
      (task) =>
        task.courseId === canvasTask.courseId &&
        normalizeTaskTitle(task.title) ===
          normalizeTaskTitle(canvasTask.title) &&
        dateDistance(task.due, canvasTask.due) <= 14,
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
      source: "merged",
      sourceEventId: canvasTask.sourceEventId,
      url: canvasTask.url,
      tentative: false,
    };
  }

  return merged;
}
