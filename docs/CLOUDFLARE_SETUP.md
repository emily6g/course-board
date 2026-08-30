# Cloudflare setup reference

The beginner setup is in the project README. The required bindings are:

| Binding | Resource | Purpose |
| --- | --- | --- |
| `DB` | D1 database `course-board-db` | App data and private Canvas feeds |
| `SYLLABI` | R2 bucket `course-board-syllabi` | Private original syllabus files |
| `ASSETS` | Worker assets | Static files |

Use `wrangler.example.jsonc` as the safe committed template. The active `wrangler.jsonc` is intentionally ignored.
