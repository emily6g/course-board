"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { type Course, type SchoolTask, type TaskType } from "./data";

type Status = "not-started" | "in-progress" | "done";
type StatusMap = Record<string, Status>;
type TaskOverride = Pick<SchoolTask, "courseId" | "title" | "type" | "due" | "dueTime" | "note"> & { taskId: string };
type OverrideMap = Record<string, TaskOverride>;
type Semester = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

const typeLabels: Record<TaskType, string> = {
  homework: "Homework",
  quiz: "Quiz",
  exam: "Exam",
  project: "Project",
  reflection: "Reflection",
  presentation: "Presentation",
  discussion: "Discussion",
  reading: "Reading",
};

function localDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short" }).format(localDate(value));
}

function semesterWeek(value: string, semesterStartDate: string) {
  const semesterStart = localDate(semesterStartDate);

  const daysFromStart = Math.floor(
    (localDate(value).getTime() - semesterStart.getTime()) / 86_400_000
  );

  return Math.max(1, Math.floor(daysFromStart / 7) + 1);
}

function semesterWeekRange(week: number, semesterStartDate: string) {
  const semesterStart = localDate(semesterStartDate);

  const start = new Date(semesterStart);
  start.setDate(start.getDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function startTimeMinutes(value?: string) {
  if (!value) return 24 * 60;
  const match = value.toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!match) return 24 * 60;
  const suffix = match[3] ?? value.toUpperCase().match(/\b(AM|PM)\b/)?.[1];
  let hour = Number(match[1]);
  if (suffix === "AM" && hour === 12) hour = 0;
  if (suffix === "PM" && hour !== 12) hour += 12;
  return hour * 60 + Number(match[2] ?? 0);
}

function compareTasks(a: SchoolTask, b: SchoolTask) {
  return a.due.localeCompare(b.due) || startTimeMinutes(a.dueTime) - startTimeMinutes(b.dueTime) || a.title.localeCompare(b.title);
}

function weekBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function taskCourse(task: SchoolTask, availableCourses: Course[]) {
  return availableCourses.find((course) => course.id === task.courseId);
}

function normalizedTitle(value: string) {
  const numberWords: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6" };
  return value.toLowerCase()
    .replace(/\b(assignment|assign|due|exam)\b/g, "")
    .replace(/\b(one|two|three|four|five|six)\b/g, (word) => numberWords[word])
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mergeTasks(baseTasks: SchoolTask[], canvasTasks: SchoolTask[]) {
  const merged: SchoolTask[] = baseTasks.map((task) => ({ 
      ...task,
    source: task.source ?? ("syllabus" as const),
  }));

  for (const canvasTask of canvasTasks) {
    const matchIndex = merged.findIndex(
      (task) =>
        task.courseId === canvasTask.courseId &&
        normalizedTitle(task.title) === normalizedTitle(canvasTask.title)
    );

    if (matchIndex >= 0) {
      merged[matchIndex] = {
        ...merged[matchIndex],
        due: canvasTask.due,
        dueTime: canvasTask.dueTime,
        tentative: false,
        source: "canvas",
        url: canvasTask.url,
      };
    } else {
      merged.push(canvasTask);
    }
  }

  return merged;
}

function applyOverrides(baseTasks: SchoolTask[], overrides: OverrideMap) {
  return baseTasks.map((task) => {
    const override = overrides[task.id];
    return override ? { ...task, ...override, dueTime: override.dueTime || undefined, note: override.note || undefined } : task;
  });
}

export default function Dashboard() {
  const [semesterData, setSemesterData] = useState<Semester | null>(null);
  const [baseCourses, setBaseCourses] = useState<Course[]>([]);
  const [baseTasks, setBaseTasks] = useState<SchoolTask[]>([]);
  const [courseDataLoading, setCourseDataLoading] = useState(true);
  const [courseDataError, setCourseDataError] = useState("");
  const [semesterName, setSemesterName] = useState("");
  const [semesterStartDate, setSemesterStartDate] = useState("");
  const [semesterEndDate, setSemesterEndDate] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [calendarTasks, setCalendarTasks] = useState<SchoolTask[]>([]);
  const [calendarCourses, setCalendarCourses] = useState<Course[]>([]);
  const [canvasConnected, setCanvasConnected] = useState<boolean | null>(null);
  const [calendarSourceCount, setCalendarSourceCount] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskOverride | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
  fetch("/api/course-data", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Course data unavailable");
      }

      return response.json();
    })
    .then(
      (data: {
        semester: Semester | null;
        courses: Course[];
        tasks: SchoolTask[];
      }) => {
        setSemesterData(data.semester ?? null);
        setBaseCourses(data.courses ?? []);
        setBaseTasks(data.tasks ?? []);
      }
    )
    .catch(() => {
      setCourseDataError("Course data could not be loaded.");
    })
    .finally(() => {
      setCourseDataLoading(false);
    });
}, []);

  useEffect(() => {
    fetch("/api/statuses")
      .then((response) => {
        if (!response.ok) throw new Error("Status sync unavailable");
        return response.json();
      })
      .then((data: { statuses: StatusMap }) => setStatuses(data.statuses ?? {}))
      .catch(() => setSyncError(true));
  }, []);

  useEffect(() => {
    fetch("/api/task-overrides")
      .then((response) => {
        if (!response.ok) throw new Error("Task edits unavailable");
        return response.json();
      })
      .then((data: { overrides: OverrideMap }) => setOverrides(data.overrides ?? {}))
      .catch(() => setEditError("Saved task edits could not be loaded."));
  }, []);

  useEffect(() => {
    let active = true;
    async function refreshCalendar() {
      try {
        const response = await fetch("/api/calendar", { cache: "no-store" });
        if (!response.ok) throw new Error("Calendar unavailable");
        const data = await response.json() as { connected: boolean; sourceCount?: number; syncedAt?: string; events?: SchoolTask[]; courses?: Course[] };
        if (!active) return;
        setCalendarTasks(data.events ?? []);
        setCalendarCourses(data.courses ?? []);
        setCanvasConnected(data.connected);
        setCalendarSourceCount(data.sourceCount ?? 0);
        setLastSynced(data.syncedAt ?? null);
      } catch {
        if (active) setCanvasConnected(false);
      }
    }
    refreshCalendar();
    const refreshTimer = window.setInterval(refreshCalendar, 15 * 60 * 1000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, []);

  async function createSemester(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setSetupSaving(true);
  setSetupError("");

  try {
    const response = await fetch("/api/course-data", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: semesterName,
        startDate: semesterStartDate,
        endDate: semesterEndDate,
      }),
    });

    const data = (await response.json()) as {
      semester?: Semester;
      error?: string;
    };

    if (!response.ok || !data.semester) {
      throw new Error(data.error ?? "Semester could not be created.");
    }

    setSemesterData(data.semester);
  } catch (error) {
    setSetupError(
      error instanceof Error
        ? error.message
        : "Semester could not be created."
    );
  } finally {
    setSetupSaving(false);
  }
}

  async function updateStatus(taskId: string, status: Status) {
    const previous = statuses[taskId] ?? "not-started";
    setStatuses((current) => ({ ...current, [taskId]: status }));
    setSaving(taskId);
    setSyncError(false);
    try {
      const response = await fetch("/api/statuses", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, status, manualOverride: true }),
      });
      if (!response.ok) throw new Error("Status could not be saved");
    } catch {
      setStatuses((current) => ({ ...current, [taskId]: previous }));
      setSyncError(true);
    } finally {
      setSaving(null);
    }
  }

  function openEditor(task: SchoolTask) {
    setEditingTaskId(task.id);
    setEditDraft({
      taskId: task.id,
      courseId: task.courseId,
      title: task.title,
      type: task.type,
      due: task.due,
      dueTime: task.dueTime ?? "",
      note: task.note ?? "",
    });
    setEditError("");
  }

  function closeEditor() {
    if (editSaving) return;
    setEditingTaskId(null);
    setEditDraft(null);
    setEditError("");
  }

  async function saveTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editDraft) return;
    setEditSaving(true);
    setEditError("");
    try {
      const response = await fetch("/api/task-overrides", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const data = await response.json() as { override?: TaskOverride; error?: string };
      if (!response.ok || !data.override) throw new Error(data.error ?? "The changes could not be saved.");
      setOverrides((current) => ({ ...current, [editDraft.taskId]: data.override! }));
      setEditingTaskId(null);
      setEditDraft(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "The changes could not be saved.");
    } finally {
      setEditSaving(false);
    }
  }

  async function restoreOriginal() {
    if (!editDraft) return;
    setEditSaving(true);
    setEditError("");
    try {
      const response = await fetch(`/api/task-overrides?taskId=${encodeURIComponent(editDraft.taskId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("The original details could not be restored.");
      setOverrides((current) => {
        const next = { ...current };
        delete next[editDraft.taskId];
        return next;
      });
      setEditingTaskId(null);
      setEditDraft(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "The original details could not be restored.");
    } finally {
      setEditSaving(false);
    }
  }

  const allCourses = useMemo(
    () => [
      ...baseCourses,
      ...calendarCourses.filter(
        (candidate) =>
          !baseCourses.some((course) => course.id === candidate.id)
      ),
    ],
    [baseCourses, calendarCourses]
  );
  const allTasks = useMemo(
    () => applyOverrides(mergeTasks(baseTasks, calendarTasks), overrides),
    [baseTasks, calendarTasks, overrides]
  );
  const sortedTasks = useMemo(() => [...allTasks].sort(compareTasks), [allTasks]);
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const today = dateKey(now);
  const { start, end } = weekBounds(now);
  const activeTasks = sortedTasks.filter((task) => (statuses[task.id] ?? "not-started") !== "done");
  const dueToday = activeTasks.filter((task) => task.due === today);
  const dueThisWeek = activeTasks.filter((task) => {
    const due = localDate(task.due);
    return due >= start && due <= end;
  });
  const nextTask = activeTasks.find((task) => localDate(task.due) >= localDate(today));
  const filteredTasks = useMemo(
    () => sortedTasks.filter((task) => {
      const status = statuses[task.id] ?? "not-started";
      return (
        (courseFilter === "all" || task.courseId === courseFilter) &&
        (typeFilter === "all" || task.type === typeFilter) &&
        (showCompleted || status !== "done")
      );
    }),
    [courseFilter, typeFilter, showCompleted, statuses, sortedTasks],
  );

  const grouped = filteredTasks.reduce<Record<number, SchoolTask[]>>(
    (acc, task) => {
      if (!semesterData) return acc;

      const week = semesterWeek(task.due, semesterData.startDate);

      (acc[week] ??= []).push(task);

      return acc;
    },
    {}
  );

  if (courseDataLoading) {
    return (
      <main className="dashboard-shell">
        <section style={{ padding: "4rem" }}>
          <h1>Course Board</h1>
          <p>Loading your semester...</p>
        </section>
      </main>
    );
  }
  if (courseDataError) {
    return (
      <main className="dashboard-shell">
        <section style={{ padding: "4rem" }}>
          <h1>Course Board</h1>
          <p>{courseDataError}</p>
        </section>
      </main>
    );
  }

  if (!semesterData) {
  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">CB</span>

          <div>
            <p>Welcome</p>
            <h1>Course Board</h1>
          </div>
        </div>
      </header>

      <section
        style={{
          maxWidth: "600px",
          margin: "5rem auto",
          padding: "2rem",
        }}
      >
        <p className="eyebrow">Get started</p>

        <h2>Set up your semester</h2>

        <p>
          Add your semester first. Next, you will upload your syllabi and
          connect Canvas.
        </p>

        <form
          onSubmit={createSemester}
          style={{
            display: "grid",
            gap: "1.25rem",
            marginTop: "2rem",
          }}
        >
          <label>
            Semester name: 
            <input
              required
              placeholder="Fall 2026"
              value={semesterName}
              onChange={(event) => setSemesterName(event.target.value)}
            />
          </label>

          <label>
            Start date: 
            <input
              required
              type="date"
              value={semesterStartDate}
              onChange={(event) => setSemesterStartDate(event.target.value)}
            />
          </label>

          <label>
            End date: 
            <input
              required
              type="date"
              value={semesterEndDate}
              onChange={(event) => setSemesterEndDate(event.target.value)}
            />
          </label>

          {setupError && (
            <p role="alert">
              {setupError}
            </p>
          )}

          <button type="submit" disabled={setupSaving}>
            {setupSaving ? "Creating semester..." : "Create semester"}
          </button>
        </form>
      </section>
    </main>
  );
}

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">CB</span>
            <div>
              <p>{semesterData?.name ?? "Course Board"}</p>
              <h1>Course Board</h1>
            </div>        </div>
        <div className="header-meta">
          <span className={`source-pill ${canvasConnected === false ? "offline" : ""}`}><i /> {canvasConnected ? `${calendarSourceCount} calendars connected` : canvasConnected === null ? "Connecting calendars" : "Syllabuses ready"}</span>
          <span className="avatar">EG</span>
        </div>
      </header>

      <section className="overview" aria-labelledby="overview-heading">
        <div className="overview-heading">
          <div><p className="eyebrow">Your semester at a glance</p><h2 id="overview-heading">{greeting}, Emily</h2></div>
          <p className="date-label">{new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(now)}</p>
        </div>
        <div className="summary-grid">
          <article className="summary-card today-card"><span className="summary-label">Due today</span><strong>{dueToday.length}</strong><p>{dueToday.length ? dueToday[0].title : "Nothing due today"}</p></article>
          <article className="summary-card week-card"><span className="summary-label">Due this week</span><strong>{dueThisWeek.length}</strong><p>{dueThisWeek.length ? "Keep the week moving" : "Your week is clear"}</p></article>
          <article className="summary-card next-card"><span className="summary-label">Coming next</span><strong className="next-title">{nextTask?.title ?? "All caught up"}</strong><p>
              {nextTask
                ? `${taskCourse(nextTask, allCourses)?.code ?? "Course"} · ${formatDate(nextTask.due)}`
                : "No upcoming work"}
            </p></article>
        </div>
      </section>

      <section className="workspace">
        <aside className="filters" aria-label="Task filters">
          <div className="filter-block">
            <p className="filter-title">Classes</p>
            <button className={courseFilter === "all" ? "filter active" : "filter"} onClick={() => setCourseFilter("all")}><span className="filter-dot all-dot" /> All classes <b>{allTasks.length}</b></button>
            {allCourses.map((course) => (
              <button
                key={course.id}
                className={courseFilter === course.id ? "filter course-filter active" : "filter course-filter"}
                style={{ "--course-color": course.color } as CSSProperties}
                onClick={() => setCourseFilter(course.id)}
              >
                <span className="filter-dot" style={{ background: course.color }} />
                <span className="filter-course-name"><strong>{course.code}</strong><small>{course.title}</small></span>
                <b>{allTasks.filter((task) => task.courseId === course.id).length}</b>
              </button>
            ))}
          </div>
          <div className="filter-block">
            <p className="filter-title">Work type</p>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by work type">
              <option value="all">All work types</option>
              {Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
          <label className="completed-toggle"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Show completed</label>
          <div className="source-note">
            <p>{canvasConnected ? `${calendarSourceCount} Canvas calendars connected` : canvasConnected === null ? "Connecting to Canvas" : "Canvas refresh unavailable"}</p>
            <span>Syllabus dates are merged with Canvas. When both list the same item, Canvas takes priority.</span>
            {lastSynced && <small>Refreshed {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(lastSynced))}</small>}
          </div>
        </aside>

        <div className="task-panel">
          <div className="task-panel-heading">
            <div><p className="eyebrow">All coursework</p><h2>{courseFilter === "all" ? "Full semester" : allCourses.find((course) => course.id === courseFilter)?.code}</h2></div>
            <span>{filteredTasks.length} items</span>
          </div>
          {syncError && <p className="sync-error" role="alert">Your last status change could not be saved. Please try again.</p>}
          <div className="task-groups">
            {Object.entries(grouped).map(([week, weekTasks]) => (
              <section className="week-group" key={week}>
                <div className="week-heading">
                  <div><h3>Week {week}</h3><p>
                      {semesterData
                        ? semesterWeekRange(Number(week), semesterData.startDate)
                        : ""}
                    </p></div>
                  <span>{weekTasks.length}</span>
                </div>
                <div className="task-list">
                  {weekTasks.map((task) => {
                    const course = taskCourse(task, allCourses);
                    if (!course) return null;                    
                    const status = statuses[task.id] ?? "not-started";
                    return (
                      <article
                        className={`task-row status-${status}`}
                        style={{ "--course-color": course.color } as CSSProperties}
                        key={task.id}
                      >
                        <button className="check-button" aria-label={status === "done" ? `Mark ${task.title} not started` : `Mark ${task.title} done`} onClick={() => updateStatus(task.id, status === "done" ? "not-started" : "done")} disabled={saving === task.id}>{status === "done" ? "✓" : ""}</button>
                        <div className="date-box">
                          <strong>{localDate(task.due).getDate()}</strong>
                          <span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(localDate(task.due))}</span>
                          <small>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(localDate(task.due))}</small>
                        </div>
                        <div className="task-copy">
                          <div className="task-title-line">
                            <h4>{task.url ? <a href={task.url} target="_blank" rel="noreferrer">{task.title}</a> : task.title}</h4>
                            {task.source === "canvas" && <span className="canvas-badge">Canvas</span>}
                            {task.tentative && <span className="tentative-badge">Tentative</span>}{task.optional && <span className="optional-badge">Optional</span>}
                          </div>
                          <p><span className="course-chip">{course.code}</span> {typeLabels[task.type]}{task.dueTime ? ` · ${task.dueTime}` : ""}</p>
                          {task.note && <span className="task-note">{task.note}</span>}
                        </div>
                        <select className={`status-select ${status}`} value={status} onChange={(event) => updateStatus(task.id, event.target.value as Status)} disabled={saving === task.id} aria-label={`Status for ${task.title}`}>
                          <option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="done">Done</option>
                        </select>
                        <button className="edit-button" onClick={() => openEditor(task)} aria-label={`Edit ${task.title}`}>Edit</button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
      {editingTaskId && editDraft && (
        <div className="edit-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <div className="edit-heading">
              <div><p className="eyebrow">Task details</p><h2 id="edit-title">Edit item</h2></div>
              <button className="close-button" type="button" onClick={closeEditor} aria-label="Close editor">×</button>
            </div>
            <form onSubmit={saveTaskEdit}>
              <label className="wide-field">Name<input required value={editDraft.title} onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })} /></label>
              <label>Class<select value={editDraft.courseId} onChange={(event) => setEditDraft({ ...editDraft, courseId: event.target.value })}>{allCourses.map((course) => <option value={course.id} key={course.id}>{course.code}</option>)}</select></label>
              <label>Work type<select value={editDraft.type} onChange={(event) => setEditDraft({ ...editDraft, type: event.target.value as TaskType })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label>Due date<input required type="date" value={editDraft.due} onChange={(event) => setEditDraft({ ...editDraft, due: event.target.value })} /></label>
              <label>Due time<input placeholder="Example, 11:59 PM" value={editDraft.dueTime ?? ""} onChange={(event) => setEditDraft({ ...editDraft, dueTime: event.target.value })} /></label>
              <label className="wide-field">Notes<textarea rows={4} placeholder="Add reminders, instructions, study topics, or anything else" value={editDraft.note ?? ""} onChange={(event) => setEditDraft({ ...editDraft, note: event.target.value })} /></label>
              {editError && <p className="edit-error" role="alert">{editError}</p>}
              <div className="edit-actions">
                {overrides[editDraft.taskId] && <button className="restore-button" type="button" onClick={restoreOriginal} disabled={editSaving}>Restore original</button>}
                <span />
                <button className="cancel-button" type="button" onClick={closeEditor} disabled={editSaving}>Cancel</button>
                <button className="save-button" type="submit" disabled={editSaving}>{editSaving ? "Saving" : "Save changes"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
