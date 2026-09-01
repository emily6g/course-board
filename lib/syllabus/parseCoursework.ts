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

const dateSource = String.raw`(?:\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-](?:20)?\d{2})?\b|\b(?:January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?\b)`;

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
  if (/\bagreement\b/i.test(value)) return "homework";
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
    .replace(new RegExp(dateSource, "gi"), "")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi, "")
    .replace(/\b(?:points?\s+vary|\d+(?:\.\d+)?\s*points?)\b/gi, "")
    .replace(/\b(?:due\s+dates?|deadlines?)\s*:?/gi, "")
    .replace(/\b(?:due|deadline)(?:\s+(?:on|by))?\b/gi, "")
    .replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, "")
    .replace(/\bassign\.?/gi, "Assignment")
    .replace(/\s+(?:at|by|on)\s*$/i, "")
    .replace(/\s*[|,:;–—-]+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 180);
}

function normalizeCandidateTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/\bassign\.?/g, "assignment")
    .replace(/\b(midterm|final)\s+exam\b/g, "$1")
    .replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g,
      (word) => numberWords[word],
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dateMatches(
  value: string,
  semesterStart: string,
  semesterEnd: string,
) {
  return [...value.matchAll(new RegExp(dateSource, "gi"))]
    .map((match) => ({
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      dueDate: parseDate(match[0], semesterStart, semesterEnd),
    }))
    .filter(
      (match): match is typeof match & { dueDate: string } =>
        Boolean(
          match.dueDate &&
            match.dueDate >= semesterStart &&
            match.dueDate <= semesterEnd,
        ),
    );
}

function splitTaskList(value: string) {
  const taskStart =
    "quiz|exam|midterm|final|test|discussion|homework|assignment|artifact|journal|project|presentation|reflection|reading|chapter|paper|essay|report|lab|syllabus|extra credit";
  return value.split(
    new RegExp(
      String.raw`\s*(?:,|;|&|\band\b)\s*(?=(?:${taskStart})\b)`,
      "i",
    ),
  );
}

function expandSummaryLine(
  line: string,
  semesterStart: string,
  semesterEnd: string,
) {
  const matches = dateMatches(line, semesterStart, semesterEnd);
  if (!matches.length) return [];

  const expanded: Array<{ title: string; dueDate: string }> = [];
  let previousEnd = 0;
  for (const match of matches) {
    const group = line
      .slice(previousEnd, match.index)
      .replace(/^\s*(?:due\s+dates?|deadlines?)\s*:\s*/i, "")
      .replace(/^\s*[;,]+\s*/, "");
    previousEnd = match.end;

    for (const item of splitTaskList(group)) {
      const title = cleanTitle(item);
      if (title.length >= 3) expanded.push({ title, dueDate: match.dueDate });
    }
  }
  return expanded;
}

export function parseCoursework(
  text: string,
  semesterStart: string,
  semesterEnd: string,
) {
  const candidates = new Map<
    string,
    { candidate: ParsedCandidate; extractionQuality: number }
  >();
  const taskWords =
    /\b(homework|assignment|agreement|quiz|exam|midterm|final|test|project|presentation|discussion|reflection|journal|reading|read|chapter|problem set|worksheet|paper|essay|report|lab)\b/i;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  function addCandidate(
    title: string,
    dueDate: string,
    line: string,
    extractionQuality: number,
  ) {
    if (title.length < 3 || !taskWords.test(title)) return;
    const key = normalizeCandidateTitle(title);
    if (!key) return;
    const dueTime = parseTime(line);
    const candidate = {
      title,
      taskType: inferType(title),
      dueDate,
      dueTime,
      notes: null,
      optional: /\b(optional|extra credit)\b/i.test(title),
      confidence: dueTime ? 90 : extractionQuality,
      sourceText: line.slice(0, 500),
    } satisfies ParsedCandidate;
    const existing = candidates.get(key);
    if (!existing || extractionQuality > existing.extractionQuality)
      candidates.set(key, { candidate, extractionQuality });
  }

  for (const line of lines) {
    if (line.length > 320 || !taskWords.test(line)) continue;
    const matches = dateMatches(line, semesterStart, semesterEnd);
    if (!matches.length) continue;

    if (/^\s*(?:due\s+dates?|deadlines?)\s*:/i.test(line) || matches.length > 1) {
      for (const item of expandSummaryLine(line, semesterStart, semesterEnd))
        addCandidate(item.title, item.dueDate, line, 70);
      continue;
    }

    addCandidate(cleanTitle(line), matches[0].dueDate, line, 82);
  }

  return [...candidates.values()].map((entry) => entry.candidate);
}
