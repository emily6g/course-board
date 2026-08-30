export const taskTypes = [
  "homework",
  "quiz",
  "exam",
  "project",
  "reflection",
  "presentation",
  "discussion",
  "reading",
  "other",
] as const;

export type TaskType = (typeof taskTypes)[number];
export type TaskSource = "syllabus" | "canvas" | "merged" | "manual";

export type Course = {
  id: string;
  code: string;
  title: string;
  instructor?: string;
  color: string;
};

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
  source?: TaskSource;
  sourceEventId?: string;
  url?: string;
};

export type Semester = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type TaskCandidate = {
  id: string;
  syllabusId: string;
  courseId: string;
  title: string;
  type: TaskType;
  due: string;
  dueTime?: string;
  note?: string;
  optional: boolean;
  confidence: number;
  sourceText?: string;
  status: "pending" | "confirmed" | "rejected";
};
