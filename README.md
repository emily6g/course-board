# Course Board

Course Board is a reusable semester dashboard that combines syllabus dates and
private Canvas calendar feeds into one weekly view.

Students can filter by class and task type, track progress, edit task details,
add notes, and keep manual edits when Canvas refreshes. Canvas dates override a
matching syllabus date, while personal status and edits stay in Cloudflare D1.

## What is reusable

- `app/` contains the dashboard UI and API routes.
- `data/coursework.ts` contains the replaceable semester, course, and syllabus data.
- `lib/ics.ts` parses Canvas `.ics` calendars and maps them into the same task format.
- `db/` and `drizzle/` contain Cloudflare D1 persistence.
- `worker/` contains the Cloudflare Worker entry point.

## Start a new semester

1. Edit `data/coursework.ts`.
2. Set your semester start and end dates.
3. Replace the sample courses.
4. Add syllabus tasks.
5. Connect one or more Canvas feeds with the `CANVAS_CALENDAR_SOURCES` secret.
6. Deploy to Cloudflare.

See:

- `data/README.md` for the syllabus data format
- `docs/CLOUDFLARE_SETUP.md` for D1 and Canvas setup
- `docs/GITHUB_TEMPLATE.md` for publishing as a GitHub template
- `docs/SYSTEM_GUIDE.md` for application behavior

## Privacy

Canvas calendar feed URLs function like private access links. Never commit them
to GitHub or expose them through client-side environment variables. Store them
as Cloudflare Worker secrets.

This public template contains only neutral example courses and tasks.
