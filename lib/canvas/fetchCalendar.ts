type CalendarFetcher = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

const MAX_REDIRECTS = 4;
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 10_000;

function isBlockedHostname(hostname: string) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    value === "localhost" ||
    value.endsWith(".localhost") ||
    /^(?:0|10|127|169\.254|192\.168)\./.test(value) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(value) ||
    value === "::1" ||
    /^(?:fc|fd|fe8|fe9|fea|feb)/.test(value)
  );
}

function isSafeHttpsUrl(url: URL) {
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !isBlockedHostname(url.hostname)
  );
}

export function validCanvasUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      isSafeHttpsUrl(url) &&
      /\.ics(?:$|\?)/i.test(url.pathname + url.search)
    );
  } catch {
    return false;
  }
}

export async function fetchCalendarText(
  feedUrl: string,
  fetcher: CalendarFetcher = fetch,
) {
  const initialUrl = new URL(feedUrl);
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let currentUrl = initialUrl;
    try {
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        const response = await fetcher(currentUrl, {
          headers: { accept: "text/calendar" },
          redirect: "manual",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location || redirects === MAX_REDIRECTS)
            throw new Error("Canvas redirected too many times.");
          const nextUrl = new URL(location, currentUrl);
          if (!isSafeHttpsUrl(nextUrl))
            throw new Error("Canvas redirected to an unsafe address.");
          currentUrl = nextUrl;
          continue;
        }

        const text = await response.text();
        if (!response.ok || !/BEGIN:VCALENDAR/i.test(text))
          throw new Error(
            "Canvas did not return a valid calendar feed. Copy a new Calendar Feed URL and try again.",
          );

        return {
          text,
          allowedHosts: [...new Set([initialUrl.hostname, currentUrl.hostname])],
        };
      }
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /unsafe address|redirected too many/i.test(error.message)) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Canvas calendar could not be reached.");
}
