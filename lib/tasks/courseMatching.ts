import type { Course } from "../../types/coursework";

export function normalizeCourseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function extractCourseCodeTokens(text: string) {
  return new Set(
    [...text.toUpperCase().matchAll(/\b[A-Z]{2,6}[\s-]?\d{2,4}\b/g)].map(
      (match) => normalizeCourseCode(match[0]),
    ),
  );
}

export function matchCourse(text: string, courses: Course[]) {
  const tokens = extractCourseCodeTokens(text);
  const matches = courses.filter((course) => {
    const code = normalizeCourseCode(course.code);
    return code.length >= 5 && tokens.has(code);
  });
  return matches.length === 1 ? matches[0] : null;
}
