import { env } from "cloudflare:workers";
import { parseCalendar } from "../../../lib/ics";

type CalendarSource = {
  feedUrl: string;
  sourceKey?: string;
  defaultCourseId?: string;
};

function configuredSources(runtimeEnv: Record<string, string | undefined>): CalendarSource[] {
  const raw = runtimeEnv.CANVAS_CALENDAR_SOURCES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is CalendarSource => {
      if (!value || typeof value !== "object") return false;
      const source = value as Partial<CalendarSource>;
      return typeof source.feedUrl === "string" && source.feedUrl.startsWith("https://");
    });
  } catch {
    return [];
  }
}

export async function GET() {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const sources = configuredSources(runtimeEnv);

  if (!sources.length) {
    return Response.json({ connected: false, error: "Canvas calendars are not configured." }, { status: 503 });
  }

  const results = await Promise.allSettled(sources.map(async ({ feedUrl, sourceKey, defaultCourseId }, index) => {
    const source = new URL(feedUrl);
    if (source.protocol !== "https:") throw new Error("Invalid calendar source");
    const response = await fetch(source, { headers: { accept: "text/calendar" } });
    if (!response.ok) throw new Error("Calendar request failed");
    return parseCalendar(await response.text(), {
      allowedHosts: [source.hostname],
      defaultCourseId,
      sourceKey: sourceKey?.trim() || `canvas-${index + 1}`,
    });
  }));

  const refreshed = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!refreshed.length) {
    return Response.json({ connected: false, error: "Canvas calendars could not be refreshed." }, { status: 502 });
  }

  return Response.json(
    {
      connected: true,
      sourceCount: refreshed.length,
      syncedAt: new Date().toISOString(),
      events: refreshed.flatMap((result) => result.events),
      courses: refreshed.flatMap((result) => result.courses),
    },
    { headers: { "cache-control": "private, max-age=300" } },
  );
}
