import assert from "node:assert/strict";
import test from "node:test";
import { semesterWeek } from "../lib/tasks/dates.ts";
import {
  matchCourse,
  normalizeCourseCode,
} from "../lib/tasks/courseMatching.ts";
import { mergeTasks, normalizeTaskTitle } from "../lib/tasks/merge.ts";
import { parseCoursework } from "../lib/syllabus/parseCoursework.ts";
import { parseCalendar } from "../lib/ics.ts";
import {
  fetchCalendarText,
  validCanvasUrl,
} from "../lib/canvas/fetchCalendar.ts";
import { chunkItems } from "../lib/db/chunkItems.ts";

test("semester weeks start at one and advance every seven days", () => {
  assert.equal(semesterWeek("2026-08-24", "2026-08-24"), 1);
  assert.equal(semesterWeek("2026-08-31", "2026-08-24"), 2);
});

test("task titles normalize numbering and assignment wording", () => {
  assert.equal(normalizeTaskTitle("Assignment One: Arrays"), "1 arrays");
  assert.equal(normalizeTaskTitle("Due, Assignment 1 - Arrays"), "1 arrays");
});

test("Canvas updates a matching syllabus task without losing syllabus metadata", () => {
  const syllabus = [
    {
      id: "1",
      courseId: "10",
      title: "Assignment One",
      type: "homework",
      due: "2026-09-01",
      note: "Read chapter 2",
      optional: true,
      source: "syllabus",
    },
  ];
  const canvas = [
    {
      id: "canvas-1",
      courseId: "10",
      title: "Assignment 1",
      type: "homework",
      due: "2026-09-03",
      dueTime: "11:59 PM",
      source: "canvas",
      sourceEventId: "uid-1",
      url: "https://canvas.example.edu/a/1",
    },
  ];
  const [merged] = mergeTasks(syllabus, canvas);
  assert.equal(merged.due, "2026-09-03");
  assert.equal(merged.note, "Read chapter 2");
  assert.equal(merged.optional, true);
  assert.equal(merged.source, "merged");
});

test("course matching uses one normalized course code and rejects ambiguity", () => {
  const courses = [
    { id: "1", code: "CSCE 314", title: "Languages", color: "#000000" },
    { id: "2", code: "HIST 201", title: "History", color: "#ffffff" },
  ];
  assert.equal(normalizeCourseCode("CSCE-314"), "CSCE314");
  assert.equal(matchCourse("Assignment [CSCE-314-500]", courses)?.id, "1");
  assert.equal(matchCourse("General assignment", courses), null);
});

test("syllabus parsing accepts dated coursework and ignores policy text", () => {
  const text =
    "Homework 1 due September 4, 2026 at 11:59 PM\nAttendance policy applies every day\nExam 1 October 8, 2026";
  const rows = parseCoursework(text, "2026-08-24", "2026-12-18");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].dueDate, "2026-09-04");
  assert.equal(rows[0].dueTime, "11:59 PM");
  assert.equal(rows[1].taskType, "exam");
});

test("syllabus parsing removes points and due labels from coursework titles", () => {
  const text = [
    "Discussion One – 25 points – Due Aug. 28",
    "Quiz One – points vary – Due Sept. 4",
    "Midterm Exam – 100 points – Due Oct. 16",
  ].join("\n");
  const rows = parseCoursework(text, "2026-08-24", "2026-12-18");
  assert.deepEqual(
    rows.map(({ title, dueDate, taskType }) => ({ title, dueDate, taskType })),
    [
      { title: "Discussion One", dueDate: "2026-08-28", taskType: "discussion" },
      { title: "Quiz One", dueDate: "2026-09-04", taskType: "quiz" },
      { title: "Midterm Exam", dueDate: "2026-10-16", taskType: "exam" },
    ],
  );
});

test("syllabus parsing splits due-date summaries and removes detailed duplicates", () => {
  const text = [
    "Due Dates: Syllabus Agreement and Discussion One due Friday, August 28th; Quiz One due Friday, September 4th; Quiz Two due Friday, September 18th",
    "Discussion One – 25 points – Due Aug. 28",
    "Quiz One – points vary – Due Sept. 4",
    "Quiz Two – points vary – Due Sept. 18",
    "Due Dates: Artifact Analysis Assign. 1 due Friday, October 2nd; Discussion Two, Quiz Three & Midterm due Friday, October 16th",
    "Artifact Analysis Assignment 1 – 50 points – Due Oct. 2",
    "Discussion Two – 25 points – Due Oct. 16",
    "Quiz Three – points vary – Due Oct. 16",
    "Midterm Exam – 100 points – Due Oct. 16",
  ].join("\n");
  const rows = parseCoursework(text, "2026-08-24", "2026-12-18");

  assert.equal(rows.filter((row) => row.title === "Quiz One").length, 1);
  assert.equal(rows.filter((row) => /Artifact Analysis/i.test(row.title)).length, 1);
  assert.equal(rows.filter((row) => /Midterm/i.test(row.title)).length, 1);
  assert.deepEqual(
    rows.map((row) => row.title),
    [
      "Syllabus Agreement",
      "Discussion One",
      "Quiz One",
      "Quiz Two",
      "Artifact Analysis Assignment 1",
      "Discussion Two",
      "Quiz Three",
      "Midterm Exam",
    ],
  );
});

test("syllabus parsing assigns one shared summary date to each listed task", () => {
  const text =
    "Due Dates: Discussion Three, Quiz Four, Quiz Five; Artifact Analysis Assign. 2 due Friday, November 13th";
  const rows = parseCoursework(text, "2026-08-24", "2026-12-18");
  assert.deepEqual(
    rows.map(({ title, dueDate }) => ({ title, dueDate })),
    [
      { title: "Discussion Three", dueDate: "2026-11-13" },
      { title: "Quiz Four", dueDate: "2026-11-13" },
      { title: "Quiz Five", dueDate: "2026-11-13" },
      { title: "Artifact Analysis Assignment 2", dueDate: "2026-11-13" },
    ],
  );
});

test("Canvas UTC dates use the semester timezone", () => {
  const ics =
    "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:assignment-1\nDTSTART:20260905T045900Z\nSUMMARY:Homework 1 [CSCE 314]\nEND:VEVENT\nEND:VCALENDAR";
  const result = parseCalendar(ics, {
    allowedHosts: ["canvas.example.edu"],
    courses: [
      {
        id: "1",
        code: "CSCE 314",
        title: "Programming Languages",
        color: "#000000",
      },
    ],
    semester: { startDate: "2026-08-24", endDate: "2026-12-18" },
    sourceKey: "canvas",
    timezone: "America/Chicago",
  });
  assert.equal(result.events[0].due, "2026-09-04");
  assert.equal(result.events[0].dueTime, "11:59 PM");
});

test("Canvas feeds use edge-compatible manual redirects", async () => {
  const calls = [];
  const result = await fetchCalendarText(
    "https://canvas.example.edu/calendar.ics",
    async (input, init) => {
      calls.push({ input: input.toString(), redirect: init?.redirect });
      if (calls.length === 1)
        return new Response(null, {
          status: 302,
          headers: {
            location: "https://files.canvas.example.edu/calendar.ics",
          },
        });
      return new Response("BEGIN:VCALENDAR\nEND:VCALENDAR", { status: 200 });
    },
  );
  assert.equal(calls[0].redirect, "manual");
  assert.equal(calls.length, 2);
  assert.deepEqual(result.allowedHosts, [
    "canvas.example.edu",
    "files.canvas.example.edu",
  ]);
  assert.equal(validCanvasUrl("https://canvas.example.edu/calendar.ics"), true);
  assert.equal(validCanvasUrl("http://canvas.example.edu/calendar.ics"), false);
});

test("Canvas feeds reject redirects to private addresses", async () => {
  await assert.rejects(
    fetchCalendarText(
      "https://canvas.example.edu/calendar.ics",
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://127.0.0.1/calendar.ics" },
        }),
    ),
    /unsafe address/,
  );
});

test("syllabus candidates are split into D1-safe insert batches", () => {
  const chunks = chunkItems(Array.from({ length: 17 }, (_, index) => index), 5);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [5, 5, 5, 2]);
});

test("assigned readings without official deadlines use a flagged derived date", () => {
  const rows = parseCoursework(
    "September 14 Read Chapter 4 before class",
    "2026-08-24",
    "2026-12-18",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dueDate, "2026-09-14");
  assert.equal(rows[0].derived, false);

  const scheduleRows = parseCoursework(
    "September 14 Read Chapter 4",
    "2026-08-24",
    "2026-12-18",
  );
  assert.equal(scheduleRows[0].dueDate, "2026-09-13");
  assert.equal(scheduleRows[0].derived, true);
  assert.equal(scheduleRows[0].needsReview, true);
  assert.match(scheduleRows[0].notes, /class meeting on 2026-09-14/);
});

test("TBD coursework remains in review without an invented date", () => {
  const [row] = parseCoursework(
    "Final Project Presentation, date TBD",
    "2026-08-24",
    "2026-12-18",
  );
  assert.equal(row.dueDate, null);
  assert.equal(row.needsReview, true);
  assert.match(row.reviewReason, /TBD|date confirmation/i);
});

test("syllabus parsing excludes exam reviews and uses specific task types", () => {
  const rows = parseCoursework(
    [
      "Exam Review October 1",
      "Final Project due October 2",
      "Final Exam Presentation December 8, 8:00 to 10:00 AM",
    ].join("\n"),
    "2026-08-24",
    "2026-12-18",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].taskType, "project");
  assert.equal(rows[1].taskType, "presentation");
  assert.equal(rows[1].dueTime, "8:00 AM");
  assert.equal(rows[1].endTime, "10:00 AM");
});

test("one schedule row creates separate tasks that share only its date", () => {
  const rows = parseCoursework(
    "October 3 Quiz 2 due; Project proposal due",
    "2026-08-24",
    "2026-12-18",
  );
  assert.deepEqual(
    rows.map(({ title, dueDate }) => ({ title, dueDate })),
    [
      { title: "Quiz 2", dueDate: "2026-10-03" },
      { title: "Project proposal", dueDate: "2026-10-03" },
    ],
  );
});

test("alternative coursework is separate, optional, and requires review", () => {
  const rows = parseCoursework(
    "Choose either Project or Research Paper due October 5",
    "2026-08-24",
    "2026-12-18",
  );
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.optional && row.needsReview));
  assert.equal(rows[0].alternativeGroup, rows[1].alternativeGroup);
});

test("Canvas filters non-action events and preserves UID, metadata, and end time", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:office-1",
    "DTSTART:20260901T150000Z",
    "SUMMARY:Office Hours [CSCE 435]",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:presentation-1",
    "DTSTART:20261208T140000Z",
    "DTEND:20261208T160000Z",
    "SUMMARY:CSCE 435: Final Exam Presentation [Fall 2026]",
    "DESCRIPTION:<b>Required</b> presentation\\nBring slides",
    "STATUS:CONFIRMED",
    "SEQUENCE:2",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  const result = parseCalendar(ics, {
    allowedHosts: ["canvas.example.edu"],
    courses: [{ id: "1", code: "CSCE 435", title: "Parallel Computing", color: "#000" }],
    semester: { startDate: "2026-08-24", endDate: "2026-12-18" },
    sourceKey: "tamu",
    timezone: "America/Chicago",
  });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].sourceEventId, "presentation-1");
  assert.equal(result.events[0].title, "Final Exam Presentation");
  assert.equal(result.events[0].type, "presentation");
  assert.equal(result.events[0].dueTime, "8:00 AM");
  assert.equal(result.events[0].endTime, "10:00 AM");
  assert.doesNotMatch(result.events[0].note, /<b>/);
});

test("Canvas preserves all-day events and explicit cancellations", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:quiz-1",
    "DTSTART;VALUE=DATE:20260914",
    "SUMMARY:Quiz 1 [MTDE 314]",
    "STATUS:CANCELLED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  const result = parseCalendar(ics, {
    allowedHosts: [],
    courses: [{ id: "1", code: "MTDE 314", title: "Course", color: "#000" }],
    semester: { startDate: "2026-08-24", endDate: "2026-12-18" },
    sourceKey: "tamu",
    timezone: "America/Chicago",
  });
  assert.equal(result.events[0].due, "2026-09-14");
  assert.equal(result.events[0].dueTime, undefined);
  assert.equal(result.events[0].allDay, true);
  assert.equal(result.events[0].cancelled, true);
});

test("cross-source merging does not collapse different tasks on the same date", () => {
  const syllabus = [{ id: "1", courseId: "10", title: "Project Proposal", type: "project", due: "2026-10-03", source: "syllabus" }];
  const canvas = [{ id: "2", courseId: "10", title: "Project Presentation", type: "presentation", due: "2026-10-03", source: "canvas" }];
  assert.equal(mergeTasks(syllabus, canvas).length, 2);
});

test("broken PDF title and date columns are flagged instead of guessed", () => {
  const rows = parseCoursework(
    "Quiz 2\nProject proposal\nOctober 3\nOctober 10",
    "2026-08-24",
    "2026-12-18",
  );
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.dueDate === null && row.needsReview));
  assert.ok(rows.every((row) => /without a reliable date relationship/i.test(row.reviewReason)));
});
