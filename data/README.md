# Semester data

The public template keeps syllabus-derived data separate from the dashboard code.
Edit only `data/coursework.ts` to start a new semester.

## 1. Semester

Set `semester.name`, `semester.startDate`, and `semester.endDate`. Dates use
`YYYY-MM-DD`.

## 2. Courses

Each course needs a unique `id`, a display `code`, a title, and a color.

## 3. Tasks

Each syllabus item needs a unique `id`, a matching `courseId`, a title, type,
and due date. Optional fields include `dueTime`, `note`, `tentative`, and
`optional`.

Supported task types are `homework`, `quiz`, `exam`, `project`, `reflection`,
`presentation`, `discussion`, and `reading`.

Canvas feed URLs never belong in this file. Keep them in the encrypted
`CANVAS_CALENDAR_SOURCES` Cloudflare secret.
