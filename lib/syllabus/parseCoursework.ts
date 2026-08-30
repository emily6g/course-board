import type { TaskType } from "../../types/coursework";

export type ParsedCandidate = {
  title: string;
  taskType: TaskType;
  dueDate: string | null;
  dueTime: string | null;
  notes: string | null;
  optional: boolean;
  confidence: number;
  sourceText: string;
};

const months: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function inferType(value: string): TaskType {
  if (/\b(exam|midterm|final|test)\b/i.test(value)) return "exam";
  if (/\bquiz\b/i.test(value)) return "quiz";
  if (/\bpresentation\b/i.test(value)) return "presentation";
  if (/\bdiscussion\b/i.test(value)) return "discussion";
  if (/\b(read|reading|chapter)\b/i.test(value)) return "reading";
  if (/\b(reflection|journal)\b/i.test(value)) return "reflection";
  if (/\bproject\b/i.test(value)) return "project";
  if (/\b(homework|assignment|problem set|worksheet)\b/i.test(value))
    return "homework";
  return "other";
}

function parseDate(value: string, semesterStart: string, semesterEnd: string) {
  const startYear = Number(semesterStart.slice(0, 4));
  let match = value.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (match)
    return `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`;
  match = value.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/);
  if (match) {
    const year = match[3]
      ? match[3].length === 2
        ? 2000 + Number(match[3])
        : Number(match[3])
      : startYear;
    const date = `${year}-${pad(Number(match[1]))}-${pad(Number(match[2]))}`;
    if (date < semesterStart && !match[3])
      return `${year + 1}-${pad(Number(match[1]))}-${pad(Number(match[2]))}`;
    return date;
  }
  match = value.match(
    /\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i,
  );
  if (!match) return null;
  const month = months[match[1].toLowerCase()];
  let year = match[3] ? Number(match[3]) : startYear;
  let date = `${year}-${pad(month)}-${pad(Number(match[2]))}`;
  if (date < semesterStart && !match[3])
    date = `${++year}-${pad(month)}-${pad(Number(match[2]))}`;
  return date <= semesterEnd ? date : null;
}

function parseTime(value: string) {
  const match = value.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
  );
  if (!match) return null;
  return `${Number(match[1])}:${match[2] ?? "00"} ${match[3][0].toUpperCase()}M`;
}

function cleanTitle(line: string) {
  return line
    .replace(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g, "")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-](?:20)?\d{2})?\b/g, "")
    .replace(
      /\b(?:January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?\b/gi,
      "",
    )
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi, "")
    .replace(/^[\s|,:;–—-]+|[\s|,:;–—-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 180);
}

export function parseCoursework(
  text: string,
  semesterStart: string,
  semesterEnd: string,
) {
  const candidates: ParsedCandidate[] = [];
  const seen = new Set<string>();
  const taskWords =
    /\b(homework|assignment|quiz|exam|midterm|final|test|project|presentation|discussion|reflection|journal|reading|read|chapter|problem set|worksheet|paper|essay|report|lab)\b/i;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.length > 320 || !taskWords.test(line)) continue;
    const dueDate = parseDate(line, semesterStart, semesterEnd);
    if (!dueDate || dueDate < semesterStart || dueDate > semesterEnd) continue;
    const title = cleanTitle(line);
    if (title.length < 3) continue;
    const key = `${title.toLowerCase()}|${dueDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const dueTime = parseTime(line);
    candidates.push({
      title,
      taskType: inferType(title),
      dueDate,
      dueTime,
      notes: null,
      optional: /\b(optional|extra credit)\b/i.test(line),
      confidence: dueTime ? 90 : 82,
      sourceText: line.slice(0, 500),
    });
  }

  return candidates;
}
