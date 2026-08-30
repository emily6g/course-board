# Course Board

Course Board is a private, self-hosted semester dashboard. Upload PDF or DOCX syllabi, review the coursework it extracts, optionally connect one or more Canvas calendar feeds, and track everything in one weekly view.

Each copy uses its owner's Cloudflare Worker, D1 database, and private R2 bucket. It is intentionally a one-person app, so it does not include accounts or shared tenancy.

## Prerequisites

- A GitHub account
- Git
- Node.js 22 or newer
- A Cloudflare account
- Your syllabus files
- An optional Canvas calendar feed

## 1. Create your copy

Click **Use this template** on GitHub, create your repository, then clone it:

```bash
git clone https://github.com/YOUR_USERNAME/course-board.git
cd course-board
npm install
```

## 2. Connect Cloudflare

```bash
npx wrangler login
npx wrangler d1 create course-board-db
npx wrangler r2 bucket create course-board-syllabi
npm run setup:cloudflare
```

Open `wrangler.jsonc`. Replace `YOUR_D1_DATABASE_ID` with the database ID printed by the D1 command. Do not commit `wrangler.jsonc`; Git ignores it because the ID belongs only to your deployment.

## 3. Create the database tables

```bash
npm run db:migrate:remote
```

Migrations are non-destructive and run in order from the `drizzle` folder.

## 4. Deploy

```bash
npm run deploy
```

Open the URL Wrangler prints. Course Board will guide you through:

1. Entering semester dates
2. Adding courses
3. Uploading each syllabus
4. Reviewing, correcting, excluding, or adding coursework
5. Confirming items before they appear on the dashboard
6. Connecting Canvas, if wanted

## Canvas setup

In Canvas, open **Calendar**, then **Calendar Feed**. Copy the ICS URL into Course Board settings. You can name each source and connect more than one feed.

Course Board tests the feed on the server and stores the full URL only in your D1 database. The browser receives only masked connection details. Never paste the feed into GitHub, `wrangler.jsonc`, screenshots, or public messages because the URL works like a private access link.

If a Canvas course cannot be matched confidently, Course Board asks you to map it to one of the courses you added. It does not silently guess.

## How coursework is handled

Original syllabus files remain private in R2. Course Board extracts text using a serverless PDF parser or DOCX parser, then uses deterministic date and task rules to create candidates. Candidates never become dashboard tasks until you review and confirm them.

Canvas dates take priority when Canvas and a syllabus contain the same course item. Syllabus notes, type, and optional status are kept. Statuses and personal edits remain in D1.

Scanned image-only PDFs need OCR and are not currently supported. If extraction finds no dated items, use **Add missing item** during review.

## Local development

Create your local configuration first:

```bash
npm run setup:cloudflare
npm run db:migrate:local
npm run dev
```

The Cloudflare local runtime can occasionally fail on its internal SQLite state. If that happens, run `npm run build` first and test with a temporary or normal Cloudflare deployment rather than deleting production resources.

## Updating Course Board

Add the template repository as an upstream remote once, then merge updates into your own branch:

```bash
git remote add upstream https://github.com/emily6g/course-board.git
git fetch upstream
git merge upstream/main
npm install
npm run db:migrate:remote
```

Review migration files before applying future updates. Never replace your `wrangler.jsonc` with another person's configuration.

## Useful commands

```bash
npm run build
npm test
npm run lint
npm run db:migrate:local
npm run db:migrate:remote
npm run deploy
```

## Troubleshooting

- **Wrangler is not logged in:** run `npx wrangler login` from the same terminal or WSL environment.
- **DB binding unavailable:** confirm the binding is named `DB` and the D1 ID in `wrangler.jsonc` is correct.
- **Syllabus upload unavailable:** confirm the R2 binding is named `SYLLABI` and the bucket is `course-board-syllabi`.
- **Canvas feed fails:** copy a new Calendar Feed URL from Canvas, confirm it uses HTTPS and ends in `.ics`, then reconnect it in settings.
- **Wrong or missing Canvas course:** open settings and complete the course mapping shown there.
- **Node errors:** run `node --version` and use Node 22 or newer.

## Privacy

- Canvas URLs stay in your D1 database.
- Syllabus originals stay in your private R2 bucket.
- The API never returns public R2 URLs or full saved feed URLs.
- `wrangler.jsonc`, `.dev.vars`, `.env`, `.wrangler`, build output, and local data are ignored by Git.
- The template contains no personal course data, names, production database IDs, tokens, or uploaded syllabi.
