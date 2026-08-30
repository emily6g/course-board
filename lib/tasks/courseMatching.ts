import type { Course } from "../../types/coursework";

export function normalizeCourseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchCourse(text: string, courses: Course[]) {
  const normalized = normalizeCourseCode(text);
  const matches = courses.filter((course) => {
    const code = normalizeCourseCode(course.code);
    return code.length >= 5 && normalized.includes(code);
  });
  return matches.length === 1 ? matches[0] : null;
}
