# Cloudflare setup

This version is designed as one Course Board deployment per student.

## Create D1

Create a D1 database for Course Board, then apply both SQL files under
`drizzle/` in migration order. Bind the database to the Worker as `DB`.

Copy `wrangler.example.jsonc` to `wrangler.jsonc` and replace the example D1
ID with your own database ID.

## Configure Canvas

Store Canvas calendar feed URLs in one encrypted Worker secret named
`CANVAS_CALENDAR_SOURCES`. The value is a JSON array.

Example:

```json
[
  {
    "feedUrl": "https://canvas.example.edu/feeds/calendars/PRIVATE_TOKEN.ics",
    "sourceKey": "main"
  }
]
```

For a calendar whose events do not identify their course, add a
`defaultCourseId` that matches a course in `data/coursework.ts`.

Never put a real feed URL in `wrangler.jsonc`, GitHub, screenshots, or browser
code.

## Deploy

Install dependencies, build, and deploy with your Cloudflare Worker workflow.
The Worker needs the `DB` D1 binding and the `CANVAS_CALENDAR_SOURCES` secret.
