# Course Board system guide

## How the system works

Course Board starts with syllabus records from `data/coursework.ts`. The browser
requests `/api/calendar`, whose server-side route downloads configured Canvas
calendar feeds and converts their iCalendar events into the same task format.
The dashboard merges both sources, removes likely duplicates, and gives live
Canvas dates priority over matching syllabus dates.

Progress and personal edits use Cloudflare D1. Statuses and overrides are stored
separately from source tasks, so a later Canvas refresh does not erase a user's
notes, corrected title, class, task type, date, or time. Restore Original removes
the override and reveals the syllabus or Canvas value again.

The interface sorts tasks chronologically, groups them into Monday-to-Sunday
semester weeks, applies a course-specific color, and shows the date number,
month, and abbreviated weekday in each date tile.

## Data flow

1. `data/coursework.ts` supplies classes and syllabus tasks.
2. `/api/calendar` securely fetches one or more private `.ics` feeds.
3. `lib/ics.ts` parses events and maps them to courses.
4. `app/dashboard.tsx` merges, deduplicates, filters, sorts, and renders tasks.
5. `/api/statuses` saves completion state in D1.
6. `/api/task-overrides` saves notes and manual task edits in D1.

## Add or replace syllabus data

Open `data/coursework.ts`. Replace the `courses` array first, then replace the
`tasks` array. A task's `courseId` must match an existing course `id`.

Use dates such as `2026-09-20`. Keep times as display text such as `11:59 PM` or
`8:00-10:00 AM`. Put wording such as "Optional" in `note` and also set
`optional: true` so the interface can treat it consistently.

Supported task types are homework, quiz, exam, project, reflection,
presentation, discussion, and reading.

## Connect Canvas calendars

Canvas calendar feed URLs act like passwords. Configure them only as server-side
secrets:

- `CANVAS_CALENDAR_SOURCES` stores one JSON array of Canvas feed configurations.

Each source includes a private `feedUrl` and may include a stable `sourceKey` and
`defaultCourseId`. The server derives the allowed hostname from the configured
HTTPS feed itself, so the public template is not tied to one university.

Do not expose these values through client-side environment variables, commit
them to GitHub, or paste them into public issues.

## Database

The Drizzle schema in `db/schema.ts` defines saved statuses and task overrides.
The SQL files under `drizzle/` create the required D1 tables. Bind the database
as `DB`, matching the name used by `db/index.ts` and the deployment manifest.

## Local development

```bash
npm ci
npm run dev
```

Without calendar environment values, the dashboard still uses syllabus data.
Without D1, read-only rendering can work, but saved statuses, notes, and edits
require the database binding.

## Validation

```bash
npm run build
npm test
```

## GitHub and Cloudflare deployment

1. Create a new GitHub repository and upload this project.
2. Keep `.env` files and calendar URLs out of the repository.
3. Create a Cloudflare D1 database and apply the migrations in `drizzle/`.
4. Configure the `DB` binding for the Worker.
5. Add the `CANVAS_CALENDAR_SOURCES` JSON value as an encrypted server-side secret.
6. Use `npm run build` as the build command and deploy the generated Worker
   output according to your Cloudflare Workers setup.

This export preserves the architecture of the live ChatGPT Site. Cloudflare's
dashboard may ask for account-specific project, domain, and binding names, which
are intentionally not hard-coded in the reusable ZIP.

## Security boundaries

- Never put Canvas secrets in `data/coursework.ts`.
- Never use `NEXT_PUBLIC_` or another browser-exposed prefix for a feed URL.
- The calendar endpoint validates HTTPS and an allowlisted hostname.
- The ZIP excludes the live deployment identity, Git history, installed
  dependencies, build output, runtime caches, and deployed D1 contents.
