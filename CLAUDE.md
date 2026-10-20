# Course Board product rules

- Build for a new student using this repository as a GitHub template.
- Keep the product single-user per deployment. Do not add authentication, shared tenancy, or `user_id` columns.
- Keep D1 as the source of semester, course, task, Canvas, and settings data.
- Never require a normal user to edit TypeScript data files.
- Keep original syllabi private in R2 and never expose public object URLs.
- Treat Canvas ICS URLs as private. Store them in D1 and never return full saved URLs to the browser.
- Stage all extracted coursework in `task_candidates`, then auto-publish it to `tasks` as soon as it has a specific, resolved due date. Never insert parser output directly into production tasks, and never publish an item with no real due date.
- Do not require upfront user review before coursework appears on the dashboard. Instead, let the student edit or delete any item afterward.
- Do not silently guess ambiguous dates or Canvas course mappings. An actionable-looking line with no reliable date is dropped, not flagged or guessed.
- Preserve syllabus metadata when Canvas supplies a newer date, time, or assignment URL.
- Keep `wrangler.example.jsonc` safe and generic. Never commit an active `wrangler.jsonc`, production database ID, token, feed URL, syllabus, or student data.
- Prefer non-destructive migrations and never delete production Cloudflare resources or data without explicit approval.
- Run `npm run lint`, `npm test`, and a privacy scan before opening a pull request.
