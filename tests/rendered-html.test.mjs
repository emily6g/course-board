import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

const dashboardPath = new URL("../app/dashboard.tsx", import.meta.url);
const courseDataPath = new URL(
  "../app/api/course-data/route.ts",
  import.meta.url,
);
const schemaPath = new URL("../db/schema.ts", import.meta.url);

test("template keeps the dashboard D1-backed and free of personal defaults", async () => {
  const [dashboard, courseData, schema] = await Promise.all([
    fs.readFile(dashboardPath, "utf8"),
    fs.readFile(courseDataPath, "utf8"),
    fs.readFile(schemaPath, "utf8"),
  ]);
  assert.match(dashboard, /Week \{week\}/);
  assert.doesNotMatch(dashboard, /Emily|\bEG\b/);
  assert.match(courseData, /where\(eq\(courses\.semesterId/);
  assert.match(schema, /taskCandidates/);
  assert.match(schema, /canvasSources/);
});
