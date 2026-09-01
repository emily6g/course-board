import type { TaskType } from "../../types/coursework";

export type ParsedCandidate = {
  title: string;
  taskType: TaskType;
  dueDate: string | null;
  dueTime: string | null;
  endTime: string | null;
  notes: string | null;
  optional: boolean;
  tentative: boolean;
  derived: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  sourcePage: number | null;
  sourceRow: number | null;
  originalData: string;
  alternativeGroup: string | null;
  confidence: number;
  sourceText: string;
};

const months: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const numberWords: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

const monthNames =
  "January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const dateSource = String.raw`(?:\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-](?:20)?\d{2})?\b|\b(?:${monthNames})\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?\b)`;
const actionSource =
  "homework|hw|assignment|assign|agreement|quiz|exam|midterm|mid-term|final|test|project|presentation|discussion|reflection|journal|reading|read|pre-read|chapter|problem set|worksheet|paper|essay|report|lab|self-check|survey|submission|milestone|proposal|deliverable";
const actionPattern = new RegExp(String.raw`\b(?:${actionSource})\b`, "i");
const dueLanguage = /\b(due|deadline|submit|submission|complete by|before class|before next class)\b/i;
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function validDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
}

function parseDate(value: string, semesterStart: string) {
  const startYear = Number(semesterStart.slice(0, 4));
  let match = value.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  let year: number;
  let month: number;
  let day: number;
  let hasYear = true;
  if (match) {
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
  } else {
    match = value.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/);
    if (match) {
      month = Number(match[1]); day = Number(match[2]); hasYear = Boolean(match[3]);
      year = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : startYear;
    } else {
      match = value.match(new RegExp(String.raw`\b(${monthNames})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b`, "i"));
      if (!match) return null;
      month = months[match[1].toLowerCase()]; day = Number(match[2]);
      hasYear = Boolean(match[3]); year = match[3] ? Number(match[3]) : startYear;
    }
  }
  if (!validDate(year, month, day)) return null;
  let date = `${year}-${pad(month)}-${pad(day)}`;
  if (!hasYear && date < semesterStart) date = `${year + 1}-${pad(month)}-${pad(day)}`;
  return date;
}

function dateMatches(value: string, semesterStart: string) {
  return [...value.matchAll(new RegExp(dateSource, "gi"))]
    .map((match) => ({
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      dueDate: parseDate(match[0], semesterStart),
    }))
    .filter((match): match is typeof match & { dueDate: string } => Boolean(match.dueDate));
}

function formatTime(hour: number, minute: string, suffix: string) {
  return `${hour}:${minute} ${suffix.toUpperCase().replace(/\./g, "")}`;
}

function parseTimes(value: string) {
  const range = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (range) {
    return {
      dueTime: formatTime(Number(range[1]), range[2] ?? "00", range[3] ?? range[6]),
      endTime: formatTime(Number(range[4]), range[5] ?? "00", range[6]),
    };
  }
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  return match
    ? { dueTime: formatTime(Number(match[1]), match[2] ?? "00", match[3]), endTime: null }
    : { dueTime: null, endTime: null };
}

function previousDay(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function dateForWeekday(contextDate: string, weekday: string) {
  const context = new Date(`${contextDate}T12:00:00Z`);
  const target = weekdays.findIndex((name) => name.toLowerCase() === weekday.toLowerCase());
  if (target < 0) return null;
  const monday = new Date(context);
  monday.setUTCDate(context.getUTCDate() - ((context.getUTCDay() + 6) % 7) + ((target + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function isActionable(title: string, allowShort = false) {
  if (!actionPattern.test(title)) return false;
  if (!allowShort && /^\s*(assignments?|assessments?|exams?|projects?|readings?|homework)\s*:?\s*$/i.test(title)) return false;
  if (/\b(exam|final|quiz|test)\s+(review|study guide|prep|preparation)\b/i.test(title) && !/\b(submit|submission|assignment|worksheet|due)\b/i.test(title)) return false;
  return true;
}

export function inferCourseworkType(value: string): TaskType {
  if (/\bpresentation\b/i.test(value)) return "presentation";
  if (/\bproject\b/i.test(value)) return "project";
  if (/\b(exam|midterm|mid-term|final|test)\b/i.test(value) && !/\b(review|study guide)\b/i.test(value)) return "exam";
  if (/\b(quiz|self-check)\b/i.test(value)) return "quiz";
  if (/\bdiscussion\b/i.test(value)) return "discussion";
  if (/\b(read|reading|pre-read|chapter)\b/i.test(value)) return "reading";
  if (/\b(reflection|journal)\b/i.test(value)) return "reflection";
  if (/\b(homework|hw|assignment|assign|agreement|problem set|worksheet|paper|essay|report|lab|survey|submission|milestone|proposal|deliverable)\b/i.test(value)) return "homework";
  return "other";
}

export function cleanCourseworkTitle(line: string) {
  return line
    .replace(new RegExp(dateSource, "gi"), "")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to|until)\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi, "")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\s*(?:-|–|—|to|until)?\s*/gi, "")
    .replace(/\b(?:points?\s+vary|\d+(?:\.\d+)?\s*points?)\b/gi, "")
    .replace(/\b(?:due\s+dates?|deadlines?)\s*:?/gi, "")
    .replace(/\b(?:due|deadline|submit(?:ted)?)(?:\s+(?:on|by))?\b/gi, "")
    .replace(new RegExp(String.raw`\b(?:${weekdays.join("|")})\b`, "gi"), "")
    .replace(/\bassign\.?/gi, "Assignment")
    .replace(/\((?:optional|recommended|not required)\)/gi, "")
    .replace(/\b(?:optional|recommended|not required)\s*[:,-]?\s*/gi, "")
    .replace(/\s+(?:at|by|on)\s*$/i, "")
    .replace(/\s*[|;–—]+\s*/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/^[\s,:-]+|[\s,:-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim().slice(0, 180);
}

export function normalizeCourseworkTitle(value: string) {
  return value.toLowerCase()
    .replace(/\bhw\b/g, "homework")
    .replace(/\bassign\.?\b/g, "assignment")
    .replace(/\bmid[\s-]?term\b/g, "midterm")
    .replace(/\b(midterm|final)\s+exam\b/g, "$1")
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (word) => numberWords[word])
    .replace(/\b(due|optional|tentative)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function splitTaskList(value: string, splitAlternatives = false) {
  const separator = splitAlternatives
    ? String.raw`;|&|\band\b|\bor\b|,(?=\s*(?:${actionSource})\b)`
    : String.raw`;|&|\band\b|,(?=\s*(?:${actionSource})\b)`;
  return value
    .replace(/\b(?:choose\s+(?:one|either)|either|one of)\b\s*/gi, "")
    .split(new RegExp(String.raw`\s*(?:${separator})\s*`, "i"));
}

function weekdayMismatch(line: string, dueDate: string) {
  const match = line.match(new RegExp(String.raw`\b(${weekdays.join("|")})\b`, "i"));
  return Boolean(match && weekdays[new Date(`${dueDate}T12:00:00Z`).getUTCDay()].toLowerCase() !== match[1].toLowerCase());
}

function alternativeId(line: string, page: number, row: number) {
  return /\b(either|choose (?:one|either)|one of|alternative)\b/i.test(line) ? `syllabus-${page}-${row}` : null;
}

export function parseCoursework(text: string, semesterStart: string, semesterEnd: string) {
  const candidates = new Map<string, { candidate: ParsedCandidate; quality: number }>();
  let contextDate: string | null = null;

  function addCandidate(input: {
    title: string; dueDate: string | null; line: string; page: number; row: number;
    quality: number; derived?: boolean; needsReview?: boolean; reviewReason?: string | null;
    notes?: string | null; alternativeGroup?: string | null;
  }) {
    const title = cleanCourseworkTitle(input.title);
    if (!isActionable(title, Boolean(input.alternativeGroup))) return;
    const optional = /\b(optional|extra credit|recommended|not required)\b/i.test(input.line) || Boolean(input.alternativeGroup);
    const tentative = /\b(tentative|may change|subject to change|TBD|to be determined)\b/i.test(input.line);
    const times = parseTimes(input.line);
    const outOfSemester = Boolean(input.dueDate && (input.dueDate < semesterStart || input.dueDate > semesterEnd));
    const mismatch = Boolean(input.dueDate && weekdayMismatch(input.line, input.dueDate));
    const needsReview = Boolean(input.needsReview || !input.dueDate || outOfSemester || mismatch || input.alternativeGroup);
    const reasons = [input.reviewReason, !input.dueDate ? "Needs date confirmation" : null, outOfSemester ? "Date is outside the selected semester" : null, mismatch ? "Weekday and date do not match" : null, input.alternativeGroup ? "Alternative coursework, confirm which option is required" : null].filter(Boolean);
    const notes = [input.notes, optional ? (/extra credit/i.test(input.line) ? "Extra credit item" : "Optional or conditional item") : null, tentative ? "Tentative date from the syllabus. Confirm in Canvas or with the instructor." : null].filter(Boolean).join(" ") || null;
    const key = `${normalizeCourseworkTitle(title)}|${input.dueDate ?? "undated"}`;
    const candidate: ParsedCandidate = {
      title, taskType: inferCourseworkType(title), dueDate: outOfSemester ? null : input.dueDate,
      dueTime: times.dueTime, endTime: times.endTime, notes, optional, tentative,
      derived: Boolean(input.derived), needsReview, reviewReason: reasons.join("; ") || null,
      sourcePage: input.page, sourceRow: input.row,
      originalData: JSON.stringify({ page: input.page, row: input.row, text: input.line }),
      alternativeGroup: input.alternativeGroup ?? null,
      confidence: Math.max(20, Math.min(98, input.quality - (needsReview ? 25 : 0))),
      sourceText: input.line.slice(0, 500),
    };
    const existing = candidates.get(key);
    if (!existing || input.quality > existing.quality) candidates.set(key, { candidate, quality: input.quality });
    else if (notes && !existing.candidate.notes) existing.candidate.notes = notes;
  }

  text.split(/\f/).forEach((pageText, pageIndex) => {
    const lines = pageText.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    lines.forEach((line, rowIndex) => {
      if (line.length > 600) return;
      const matches = dateMatches(line, semesterStart);
      const inSemester = matches.filter((item) => item.dueDate >= semesterStart && item.dueDate <= semesterEnd);
      if (inSemester.length && (/^\s*week\s+(?:of\s+)?/i.test(line) || /^\s*(?:mon|tue|wed|thu|fri|sat|sun)/i.test(line) || !actionPattern.test(line))) contextDate = inSemester[0].dueDate;
      if (!actionPattern.test(line)) return;

      const page = pageIndex + 1;
      const row = rowIndex + 1;
      const alternativeGroup = alternativeId(line, page, row);
      if (/\b(?:TBD|to be determined)\b/i.test(line) && !matches.length) {
        addCandidate({ title: line, dueDate: null, line, page, row, quality: 55, needsReview: true, reviewReason: "Syllabus lists this item as TBD", alternativeGroup });
        return;
      }
      const weekdayOnly = line.match(new RegExp(String.raw`\bdue\s+(?:on\s+)?(${weekdays.join("|")})\b`, "i"));
      if (!matches.length && weekdayOnly) {
        const dueDate = contextDate ? dateForWeekday(contextDate, weekdayOnly[1]) : null;
        addCandidate({ title: line, dueDate, line, page, row, quality: dueDate ? 72 : 45, needsReview: true, reviewReason: dueDate ? "Date calculated from the containing schedule week" : "Weekday has no containing schedule date", alternativeGroup });
        return;
      }
      if (!matches.length) {
        if (/\b(before next class|before class)\b/i.test(line)) {
          addCandidate({ title: line, dueDate: contextDate ? previousDay(contextDate) : null, line, page, row, quality: 45, derived: Boolean(contextDate), needsReview: true, reviewReason: "Deadline depends on class schedule", alternativeGroup });
        } else {
          const type = inferCourseworkType(line);
          const assignedReading = type !== "reading" || /\b(read|required|pre-read|before class)\b/i.test(line);
          if (assignedReading && isActionable(cleanCourseworkTitle(line)))
            addCandidate({ title: line, dueDate: null, line, page, row, quality: 35, needsReview: true, reviewReason: "Actionable item found without a reliable date relationship. Confirm it against the original syllabus.", alternativeGroup });
        }
        return;
      }
      if (/^\s*(?:due\s+dates?|deadlines?)\s*:/i.test(line) || matches.length > 1) {
        let previousEnd = 0;
        for (const match of matches) {
          const group = line.slice(previousEnd, match.index).replace(/^\s*(?:due\s+dates?|deadlines?)\s*:\s*/i, "").replace(/^\s*[;,]+\s*/, "");
          previousEnd = match.end;
          for (const item of splitTaskList(group, Boolean(alternativeGroup))) addCandidate({ title: item, dueDate: match.dueDate, line, page, row, quality: 68, needsReview: matches.length > 1 && !dueLanguage.test(group), reviewReason: matches.length > 1 ? "Extracted from a row containing multiple dates" : null, alternativeGroup });
        }
        return;
      }
      const dueDate = matches[0].dueDate;
      const reading = inferCourseworkType(line) === "reading";
      const derivedReading = reading && !dueLanguage.test(line);
      const taskDate = derivedReading ? previousDay(dueDate) : dueDate;
      const readingNote = derivedReading ? `Deadline derived from the class meeting on ${dueDate}. The syllabus did not provide an official reading deadline.` : null;
      const portions = splitTaskList(line, Boolean(alternativeGroup));
      for (const portion of portions) addCandidate({ title: portion, dueDate: taskDate, line, page, row, quality: portions.length > 1 ? 78 : 86, derived: derivedReading, needsReview: derivedReading, reviewReason: derivedReading ? "Reading deadline was inferred from the class meeting" : null, notes: readingNote, alternativeGroup });
    });
  });

  return [...candidates.values()].map((entry) => entry.candidate);
}
