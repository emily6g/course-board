import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

const dashboardPath = new URL("../app/dashboard.tsx", import.meta.url);
const courseworkPath = new URL("../data/coursework.ts", import.meta.url);

test("template keeps dashboard and replaceable sample coursework", async () => {
  const [dashboard, coursework] = await Promise.all([
    fs.readFile(dashboardPath, "utf8"),
    fs.readFile(courseworkPath, "utf8"),
  ]);
  assert.match(dashboard, /Week \{week\}/);
  assert.match(dashboard, /Canvas takes priority/);
  assert.match(coursework, /Introduction to Computing/);
  assert.match(coursework, /Optional Extra Credit/);
  assert.match(coursework, /startDate/);
});
