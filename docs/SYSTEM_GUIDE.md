# Course Board architecture

## Data flow

```text
Private syllabus in R2
-> server-side PDF or DOCX text extraction
-> validated task_candidates in D1
-> user review and confirmation
-> tasks in D1
-> dashboard

Private Canvas feed URL in D1
-> server-side ICS fetch and parsing
-> explicit course matching
-> reusable merge logic
-> dashboard
```

D1 is the source of truth for semesters, courses, confirmed syllabus tasks, Canvas connections, display settings, completion status, and manual edits. Source TypeScript files never contain a real semester.

## Safety boundaries

- Candidate extraction cannot write directly to production tasks.
- Confirmation uses a stable candidate source ID so retries do not create duplicates.
- Canvas sources are masked in API responses and fetched only on the server.
- R2 objects are private and never receive public URLs.
- Course matching requires one confident code match or a saved explicit mapping.
- The template is single-user by deployment, with no authentication or `user_id` columns.

## Document parsing

`lib/syllabus/extractText.ts` handles PDF and DOCX text extraction. `lib/syllabus/parseCoursework.ts` converts only lines containing both a recognized coursework term and a semester-valid date. It does not resolve relative phrases or invent missing dates.

## Canvas merging

`lib/ics.ts` normalizes events. `lib/tasks/courseMatching.ts` matches known course codes, while saved ambiguous mappings live in D1. `lib/tasks/merge.ts` matches normalized titles within the same course and a 14-day date window. Canvas supplies the current date, time, and URL; syllabus details remain intact.
