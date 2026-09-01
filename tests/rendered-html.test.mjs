import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

const dashboardPath = new URL("../app/dashboard.tsx", import.meta.url);
const courseDataPath = new URL(
  "../app/api/course-data/route.ts",
  import.meta.url,
);
const schemaPath = new URL("../db/schema.ts", import.meta.url);
const setupPath = new URL("../app/setup-panel.tsx", import.meta.url);
const manualTasksPath = new URL("../app/api/tasks/route.ts", import.meta.url);
const syllabusRoutePath = new URL("../app/api/syllabi/route.ts", import.meta.url);
const canvasRoutePath = new URL(
  "../app/api/canvas-sources/route.ts",
  import.meta.url,
);

test("template keeps the dashboard D1-backed and free of personal defaults", async () => {
  const [
    dashboard,
    courseData,
    schema,
    setup,
    manualTasks,
    syllabusRoute,
    canvasRoute,
  ] = await Promise.all([
    fs.readFile(dashboardPath, "utf8"),
    fs.readFile(courseDataPath, "utf8"),
    fs.readFile(schemaPath, "utf8"),
    fs.readFile(setupPath, "utf8"),
    fs.readFile(manualTasksPath, "utf8"),
    fs.readFile(syllabusRoutePath, "utf8"),
    fs.readFile(canvasRoutePath, "utf8"),
  ]);
  assert.match(dashboard, /Week \{week\}/);
  assert.doesNotMatch(dashboard, /Emily|\bEG\b/);
  assert.match(courseData, /where\(eq\(courses\.semesterId/);
  assert.match(schema, /taskCandidates/);
  assert.match(schema, /canvasSources/);
  assert.match(setup, /Finish setup and open dashboard/);
  assert.match(setup, /Add a custom assignment or exam/);
  assert.match(setup, /Add another Canvas calendar/);
  assert.match(manualTasks, /source: "manual"/);
  assert.match(syllabusRoute, /chunkItems\(parsed, CANDIDATE_INSERT_SIZE\)/);
  assert.doesNotMatch(canvasRoute, /redirect: "error"/);
});
