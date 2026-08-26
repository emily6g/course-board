import { courses, semester, type Course, type SchoolTask, type TaskType } from "../app/data";

type CalendarResult = { events: SchoolTask[]; courses: Course[] };
type CalendarOptions = { allowedHosts: string[]; defaultCourseId?: string; sourceKey: string };

const extraColors = ["#9b4f17", "#6646a3", "#157681", "#a03f72", "#48641f"];

function decodeIcs(value: string) {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function parseDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return null;
  let [, year, month, day, hour, minute] = match;
  if (hour && minute && value.endsWith("Z")) {
    const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    year = parts.year;
    month = parts.month;
    day = parts.day;
    hour = parts.hour;
    minute = parts.minute;
  }
  const due = `${year}-${month}-${day}`;
  if (!hour || !minute) return { due };
  const numericHour = Number(hour);
  const suffix = numericHour >= 12 ? "PM" : "AM";
  const dueTime = `${numericHour % 12 || 12}:${minute} ${suffix}`;
  return { due, dueTime };
}

function inferType(text: string): TaskType {
  if (/\b(exam|midterm|final|test)\b/i.test(text)) return "exam";
  if (/\bquiz\b/i.test(text)) return "quiz";
  if (/\bpresentation\b/i.test(text)) return "presentation";
  if (/\bdiscussion\b/i.test(text)) return "discussion";
  if (/\b(read|reading|chapter)\b/i.test(text)) return "reading";
  if (/\b(reflection|retrospective)\b/i.test(text)) return "reflection";
  if (/\bproject\b/i.test(text)) return "project";
  return "homework";
}

function cleanTitle(value: string) {
  return value
    .replace(/^assignment\s+due\s*[:\-]?\s*/i, "")
    .replace(/^due\s*[:\-]?\s*/i, "")
    .replace(/^([A-Z]{2,5})[\s-]?\d{3}\s*[:\-]?\s*/i, "")
    .replace(/\s*[\[(]([A-Z]{2,5})[\s-]?\d{3}[^\])]*[\])]\s*$/i, "")
    .trim();
}

function courseFrom(text: string, discovered: Map<string, Course>) {
  const match = text.toUpperCase().match(/\b([A-Z]{2,5})[\s-]?(\d{3})\b/);
  if (!match) return null;
  const code = `${match[1]} ${match[2]}`;
  const known = courses.find((course) => course.code === code);
  if (known) return known;
  const id = code.toLowerCase().replace(/\s+/g, "-");
  if (!discovered.has(id)) {
    discovered.set(id, { id, code, title: "Canvas course", color: extraColors[discovered.size % extraColors.length] });
  }
  return discovered.get(id)!;
}

export function parseCalendar(ics: string, options: CalendarOptions): CalendarResult {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const discovered = new Map<string, Course>();
  const events: SchoolTask[] = [];

  for (const block of unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []) {
    const properties = new Map<string, string>();
    for (const line of block.split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      properties.set(line.slice(0, separator).split(";")[0], decodeIcs(line.slice(separator + 1)));
    }
    const summary = properties.get("SUMMARY") ?? "Canvas item";
    const description = properties.get("DESCRIPTION") ?? "";
    const location = properties.get("LOCATION") ?? "";
    const detectedCourse = courseFrom(`${summary} ${description} ${location}`, discovered);
    const course = detectedCourse ?? courses.find((candidate) => candidate.id === options.defaultCourseId) ?? null;
    const parsedDate = parseDate(properties.get("DTSTART") ?? "");
    if (!course || !parsedDate || parsedDate.due < semester.startDate || parsedDate.due > semester.endDate) continue;
    const safeUrl = properties.get("URL");
    let url: string | undefined;
    if (safeUrl) {
      try {
        const candidate = new URL(safeUrl);
        if (candidate.protocol === "https:" && options.allowedHosts.includes(candidate.hostname)) url = candidate.toString();
      } catch {}
    }
    const title = cleanTitle(summary) || summary;
    const uid = properties.get("UID") ?? `${course.id}-${title}-${parsedDate.due}`;
    events.push({
      id: `canvas-${hash(`${options.sourceKey}-${uid}`)}`,
      courseId: course.id,
      title,
      type: inferType(`${title} ${description}`),
      ...parsedDate,
      source: "canvas",
      url,
    });
  }

  return { events, courses: [...discovered.values()] };
}
