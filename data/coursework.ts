export type TaskType = "homework" | "quiz" | "exam" | "project" | "reflection" | "presentation" | "discussion" | "reading";

export type Course = { id: string; code: string; title: string; color: string };

export type SchoolTask = {
  id: string;
  courseId: string;
  title: string;
  type: TaskType;
  due: string;
  dueTime?: string;
  note?: string;
  tentative?: boolean;
  optional?: boolean;
  source?: "syllabus" | "canvas";
  url?: string;
};

export type Semester = {
  name: string;
  startDate: string;
  endDate: string;
};

// Replace this sample semester with your own dates.
export const semester: Semester = {
  name: "Fall 2026",
  startDate: "2026-08-24",
  endDate: "2026-12-18",
};

// Replace these sample courses with your own classes.
export const courses: Course[] = [
  { id: "cs-101", code: "CS 101", title: "Introduction to Computing", color: "#7a1f3d" },
  { id: "hist-201", code: "HIST 201", title: "Modern History", color: "#287454" },
];

// Replace these sample tasks with dates extracted from your syllabi.
// Canvas items are merged at runtime and take priority when a matching item exists.
export const tasks: SchoolTask[] = [
  { id: "cs101-hw1", courseId: "cs-101", title: "Homework 1", type: "homework", due: "2026-09-04", dueTime: "11:59 PM" },
  { id: "hist201-read1", courseId: "hist-201", title: "Read Chapter 1", type: "reading", due: "2026-09-07", note: "Prepare for the next class meeting." },
  { id: "cs101-exam1", courseId: "cs-101", title: "Exam 1", type: "exam", due: "2026-10-08", dueTime: "2:00-3:15 PM" },
  { id: "hist201-extra", courseId: "hist-201", title: "Optional Extra Credit", type: "homework", due: "2026-11-20", note: "Optional.", optional: true },
];
