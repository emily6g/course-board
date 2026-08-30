import { matchCourse } from "./tasks/courseMatching.ts";
import type { Course, SchoolTask, TaskType } from "../types/coursework";

type CalendarResult = { events: SchoolTask[]; unmatchedCourses: string[] };
type CalendarOptions = {
  allowedHosts: string[];
  courses: Course[];
  semester: { startDate: string; endDate: string };
  sourceKey: string;
  mappings?: Record<string, string>;
  timezone?: string;
};

function decodeIcs(value: string) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}
function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function parseDate(value: string, timezone = "UTC") {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return null;
  let [, year, month, day, hour, minute] = match;
  if (hour && minute && value.endsWith("Z")) {
    const instant = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
      ),
    );
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(instant)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    year = parts.year;
    month = parts.month;
    day = parts.day;
    hour = parts.hour;
    minute = parts.minute;
  }
  const due = `${year}-${month}-${day}`;
  if (!hour || !minute) return { due };
  const numericHour = Number(hour);
  return {
    due,
    dueTime: `${numericHour % 12 || 12}:${minute} ${numericHour >= 12 ? "PM" : "AM"}`,
  };
}

function inferType(text: string): TaskType {
  if (/\b(exam|midterm|final|test)\b/i.test(text)) return "exam";
  if (/\bquiz\b/i.test(text)) return "quiz";
  if (/\bpresentation\b/i.test(text)) return "presentation";
  if (/\bdiscussion\b/i.test(text)) return "discussion";
  if (/\b(read|reading|chapter)\b/i.test(text)) return "reading";
  if (/\b(reflection|journal)\b/i.test(text)) return "reflection";
  if (/\bproject\b/i.test(text)) return "project";
  return "homework";
}

function courseKey(text: string) {
  return (
    text
      .toUpperCase()
      .match(/\b[A-Z]{2,6}[\s-]?\d{3,4}(?:[-\s]\d{3})?\b/)?.[0]
      ?.replace(/\s+/g, "-") ?? ""
  );
}

export function parseCalendar(
  ics: string,
  options: CalendarOptions,
): CalendarResult {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const events: SchoolTask[] = [];
  const unmatchedCourses = new Set<string>();
  for (const block of unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []) {
    const properties = new Map<string, string>();
    for (const line of block.split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator >= 0)
        properties.set(
          line.slice(0, separator).split(";")[0],
          decodeIcs(line.slice(separator + 1)),
        );
    }
    const summary = properties.get("SUMMARY") ?? "Canvas item";
    const description = properties.get("DESCRIPTION") ?? "";
    const allText = `${summary} ${description} ${properties.get("LOCATION") ?? ""}`;
    const detectedKey = courseKey(allText);
    const mappedId = detectedKey ? options.mappings?.[detectedKey] : undefined;
    const course =
      options.courses.find((candidate) => candidate.id === mappedId) ??
      matchCourse(allText, options.courses);
    if (!course) {
      if (detectedKey) unmatchedCourses.add(detectedKey);
      continue;
    }
    const parsedDate = parseDate(
      properties.get("DTSTART") ?? "",
      options.timezone,
    );
    if (
      !parsedDate ||
      parsedDate.due < options.semester.startDate ||
      parsedDate.due > options.semester.endDate
    )
      continue;
    let url: string | undefined;
    const rawUrl = properties.get("URL");
    if (rawUrl) {
      try {
        const candidate = new URL(rawUrl);
        if (
          candidate.protocol === "https:" &&
          options.allowedHosts.includes(candidate.hostname)
        )
          url = candidate.toString();
      } catch {}
    }
    const title =
      summary
        .replace(/^assignment\s+due\s*[:\-]?\s*/i, "")
        .replace(/^due\s*[:\-]?\s*/i, "")
        .trim() || summary;
    const uid =
      properties.get("UID") ?? `${course.id}-${title}-${parsedDate.due}`;
    events.push({
      id: `canvas-${hash(`${options.sourceKey}-${uid}`)}`,
      sourceEventId: uid,
      courseId: course.id,
      title,
      type: inferType(`${title} ${description}`),
      ...parsedDate,
      source: "canvas",
      url,
    });
  }
  return { events, unmatchedCourses: [...unmatchedCourses] };
}
