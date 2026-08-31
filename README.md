# Course Board

Course Board is a private, self-hosted semester dashboard. Upload PDF or DOCX syllabi, review the coursework it extracts, optionally connect one or more Canvas calendar feeds, and track everything in one weekly view.

Each copy uses its owner's Cloudflare Worker, D1 database, and private R2 bucket. It is intentionally a one-person app, so it does not include accounts or shared tenancy.

<img width="1119" height="569" alt="image" src="https://github.com/user-attachments/assets/fb8aa00a-5ac6-4a79-858d-36f1720c5618" />

## What Course Board provides

Course Board turns syllabi and Canvas calendar feeds into one personal semester workspace. The dashboard provides:

- **A semester overview** with the current date, the number of items due today and this week, and the next upcoming task.
- **A weekly coursework timeline** that organizes assignments, quizzes, readings, projects, presentations, and exams by semester week and due date.
- **Course colors and filters** for viewing one class, all classes, a specific work type, or completed coursework.
- **Progress tracking** with not started, in progress, and done statuses, plus a quick completion checkbox.
- **Editable task details** including the title, course, work type, due date, due time, and notes. Personal edits can be restored to the original imported values.
- **PDF and DOCX syllabus processing** that extracts dated coursework into a review list before anything is added to the dashboard.
- **A review workflow** for correcting extracted items, excluding unwanted items, marking optional work, and adding anything the syllabus parser missed.
- **Manual coursework entry** for adding an assignment, quiz, exam, project, reading, or other item even when a syllabus has no detailed schedule.
- **Multiple Canvas calendar connections** with saved source names, connection testing, manual course mapping, and calendar refresh information.
- **Syllabus and Canvas merging** that avoids duplicate tasks. Canvas supplies the current due date, time, and assignment link when both sources describe the same item, while syllabus notes and task details are preserved.
- **Private self-hosted storage** using Cloudflare D1 for course data and settings and a private R2 bucket for original syllabus files.

## How the dashboard works

1. You create a semester, add your courses, and choose a color for each class.
2. For each course, you can upload a syllabus, enter coursework yourself, or use both. Course Board privately stores uploaded files and extracts possible coursework.
3. You review every extracted item, make corrections, exclude anything you do not want, and confirm the final list.
4. You can optionally connect one or more Canvas calendar feeds, including feeds from different schools or Canvas accounts. Course Board tests each feed, imports its events, and asks you to map any course it cannot identify confidently.
5. Confirmed syllabus items and Canvas events are merged into the weekly dashboard. Your completion statuses, notes, and edits remain saved between visits.

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
