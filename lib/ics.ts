import { matchCourse, normalizeCourseCode } from "./tasks/courseMatching.ts";
import { cleanCourseworkTitle, inferCourseworkType } from "./syllabus/parseCoursework.ts";
import type { Course, SchoolTask } from "../types/coursework";

type CalendarResult = { events: SchoolTask[]; unmatchedCourses: string[] };
type CalendarOptions = {
  allowedHosts: string[];
  courses: Course[];
  semester: { startDate: string; endDate: string };
  sourceKey: string;
  mappings?: Record<string, string>;
  timezone?: string;
  restrictedCourseCodes?: string[];
};

type IcsProperty = { value: string; params: Record<string, string> };

function decodeIcs(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function plainText(value: string) {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
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

function formatParts(date: Date, timezone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function zonedInstant(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = formatParts(new Date(guess), timezone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    guess += desired - represented;
  }
  return new Date(guess);
}

function displayTime(hour: number, minute: string) {
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

function parseIcsDate(property: IcsProperty | undefined, displayTimezone: string) {
  if (!property) return null;
  const match = property.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, , utc] = match;
  const allDay = property.params.VALUE === "DATE" || !hour || !minute;
  if (allDay) return { due: `${year}-${month}-${day}`, allDay: true, normalizedUtc: null };

  const instant = utc
    ? new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)))
    : zonedInstant(Number(year), Number(month), Number(day), Number(hour), Number(minute), property.params.TZID || displayTimezone);
  const parts = formatParts(instant, displayTimezone);
  return {
    due: `${parts.year}-${parts.month}-${parts.day}`,
    dueTime: displayTime(Number(parts.hour), parts.minute),
    allDay: false,
    normalizedUtc: instant.toISOString(),
  };
}

function courseKey(text: string) {
  return text.toUpperCase().match(/\b[A-Z]{2,6}[\s-]?\d{3,4}(?:[-\s]\d{3})?\b/)?.[0]?.replace(/\s+/g, "-") ?? "";
}

function actionable(summary: string, description: string, categories: string, url: string) {
  const text = `${summary} ${description} ${categories}`;
  const explicit = /\b(assignment|homework|quiz|exam|midterm|final|test|project|presentation|discussion|reflection|journal|reading|pre-read|chapter|paper|essay|report|lab|worksheet|self-check|survey|submission|milestone|proposal|deliverable|due)\b/i.test(text) || /\/assignments\//i.test(url);
  if (!explicit) return false;
  if (/\b(office hours?|holiday|registration|class meeting|lecture|study session|instructor event|announcement)\b/i.test(text) && !/\b(submit|submission|assignment|quiz|project|due)\b/i.test(text)) return false;
  if (/\b(exam|final|quiz|test)\s+(review|study guide|prep|preparation)\b/i.test(text) && !/\b(submit|submission|assignment|worksheet|due)\b/i.test(text)) return false;
  if (/\b(module|course)\s+(opens?|available|availability)\b/i.test(text) && !/\b(required|submit|due)\b/i.test(text)) return false;
  return true;
}

function cleanCanvasTitle(summary: string, course: Course) {
  const escapedCode = course.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]*");
  return (cleanCourseworkTitle(
    summary
      .replace(new RegExp(`^${escapedCode}\\s*[:\\-|]\\s*`, "i"), "")
      .replace(/^assignment\s+due\s*[:\-]?\s*/i, "")
      .replace(/^due\s*[:\-]?\s*/i, "")
      .replace(/\[(?:fall|spring|summer|winter)\s+20\d{2}\]\s*$/i, ""),
  ) || summary.trim());
}

function parseProperties(block: string) {
  const properties = new Map<string, IcsProperty>();
  for (const line of block.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const descriptor = line.slice(0, separator).split(";");
    const name = descriptor.shift()?.toUpperCase() ?? "";
    const params = Object.fromEntries(descriptor.map((entry) => {
      const index = entry.indexOf("=");
      return index < 0 ? [entry.toUpperCase(), ""] : [entry.slice(0, index).toUpperCase(), entry.slice(index + 1)];
    }));
    properties.set(name, { value: decodeIcs(line.slice(separator + 1)), params });
  }
  return properties;
}

export function parseCalendar(ics: string, options: CalendarOptions): CalendarResult {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const events: SchoolTask[] = [];
  const unmatchedCourses = new Set<string>();
  const restricted = new Set((options.restrictedCourseCodes ?? []).map(normalizeCourseCode));

  for (const block of unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []) {
    const properties = parseProperties(block);
    const summary = plainText(properties.get("SUMMARY")?.value ?? "Canvas item");
    const description = plainText(properties.get("DESCRIPTION")?.value ?? "");
    const location = plainText(properties.get("LOCATION")?.value ?? "");
    const categories = plainText(properties.get("CATEGORIES")?.value ?? "");
    const rawUrl = properties.get("URL")?.value ?? "";
    const allText = `${summary} ${description} ${location} ${categories} ${rawUrl}`;
    const detectedKey = courseKey(allText);
    const mappedId = detectedKey ? options.mappings?.[detectedKey] : undefined;
    const course = options.courses.find((candidate) => candidate.id === mappedId) ?? matchCourse(allText, options.courses);
    if (!course || (restricted.size && !restricted.has(normalizeCourseCode(course.code)))) {
      if (detectedKey) unmatchedCourses.add(detectedKey);
      continue;
    }
    if (!actionable(summary, description, categories, rawUrl)) continue;

    const parsedStart = parseIcsDate(properties.get("DTSTART"), options.timezone ?? "UTC");
    if (!parsedStart || parsedStart.due < options.semester.startDate || parsedStart.due > options.semester.endDate) continue;
    const parsedEnd = parseIcsDate(properties.get("DTEND"), options.timezone ?? "UTC");
    let url: string | undefined;
    if (rawUrl) {
      try {
        const candidate = new URL(rawUrl);
        if (candidate.protocol === "https:" && options.allowedHosts.includes(candidate.hostname)) url = candidate.toString();
      } catch {}
    }
    const title = cleanCanvasTitle(summary, course);
    const uid = properties.get("UID")?.value ?? `${course.id}-${title}-${parsedStart.due}`;
    const optional = /\b(optional|extra credit|recommended|not required)\b/i.test(`${summary} ${description}`);
    const cancelled = properties.get("STATUS")?.value.toUpperCase() === "CANCELLED";
    events.push({
      id: `canvas-${hash(`${options.sourceKey}-${uid}`)}`,
      sourceEventId: uid,
      sourceKey: options.sourceKey,
      courseId: course.id,
      title,
      type: inferCourseworkType(`${title} ${categories}`),
      due: parsedStart.due,
      dueTime: parsedStart.dueTime,
      endTime: parsedEnd && parsedEnd.due === parsedStart.due ? parsedEnd.dueTime : undefined,
      allDay: parsedStart.allDay,
      source: "canvas",
      url,
      note: description || (optional ? "Optional Canvas activity" : undefined),
      optional,
      cancelled,
      originalData: JSON.stringify({
        uid,
        summary,
        description,
        dtstart: properties.get("DTSTART")?.value,
        dtend: properties.get("DTEND")?.value,
        status: properties.get("STATUS")?.value,
        lastModified: properties.get("LAST-MODIFIED")?.value,
        sequence: properties.get("SEQUENCE")?.value,
        recurrenceId: properties.get("RECURRENCE-ID")?.value,
        normalizedUtc: parsedStart.normalizedUtc,
      }),
    });
  }
  return { events, unmatchedCourses: [...unmatchedCourses] };
}
