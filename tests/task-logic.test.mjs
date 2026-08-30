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
