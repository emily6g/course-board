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
