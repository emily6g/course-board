"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  taskTypes,
  type Course,
  type Semester,
  type TaskCandidate,
  type TaskType,
} from "../types/coursework";

type Syllabus = {
  id: string;
  courseId: string;
  filename: string;
  status: string;
  error?: string;
};
type CanvasSource = {
  id: string;
  name: string;
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
};

export default function SetupPanel({
  semester,
  courses,
  syllabi,
  displayName,
  timezone,
  unmatchedCourses = [],
  onClose,
  onFinish,
}: {
  semester: Semester;
  courses: Course[];
  syllabi: Syllabus[];
  displayName: string;
  timezone: string;
  unmatchedCourses?: string[];
  onClose?: () => void;
  onFinish?: () => Promise<void>;
}) {
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [instructor, setInstructor] = useState("");
  const [color, setColor] = useState("#517562");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>(
    {},
  );
  const [manualCourseId, setManualCourseId] = useState(courses[0]?.id ?? "");
  const [manualTitle, setManualTitle] = useState("");
  const [manualType, setManualType] = useState<TaskType>("homework");
  const [manualDue, setManualDue] = useState(semester.startDate);
  const [manualDueTime, setManualDueTime] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewing, setReviewing] = useState<Syllabus | null>(null);
  const [candidates, setCandidates] = useState<TaskCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<CanvasSource[]>([]);
  const [canvasName, setCanvasName] = useState("");
  const [canvasUrl, setCanvasUrl] = useState("");
  const [nameDraft, setNameDraft] = useState(displayName);
  const [semesterNameDraft, setSemesterNameDraft] = useState(semester.name);
  const [semesterStartDraft, setSemesterStartDraft] = useState(
    semester.startDate,
  );
  const [semesterEndDraft, setSemesterEndDraft] = useState(semester.endDate);
  const [timezoneDraft, setTimezoneDraft] = useState(timezone);

  useEffect(() => {
    fetch("/api/canvas-sources")
      .then((r) => r.json())
      .then((data: { sources?: CanvasSource[] }) =>
        setSources(data.sources ?? []),
      )
      .catch(() => undefined);
  }, []);

  async function request(url: string, init: RequestInit) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(url, init);
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error ?? "The change could not be saved.");
      return data;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The change could not be saved.",
      );
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function addCourse(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          semesterId: semester.id,
          courseCode,
          courseName,
          instructor,
          color,
        }),
      });
      window.location.reload();
    } catch {}
  }

  async function uploadSyllabus(
    event: FormEvent<HTMLFormElement>,
    courseId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("courseId", courseId);
    try {
      await request("/api/syllabi", { method: "POST", body: form });
      window.location.reload();
    } catch {}
  }

  async function openReview(syllabus: Syllabus) {
    setReviewing(syllabus);
    setMessage("");
    const response = await fetch(`/api/candidates?syllabusId=${syllabus.id}`);
    const data = (await response.json()) as { candidates?: TaskCandidate[] };
    const rows = data.candidates ?? [];
    setCandidates(rows);
    setSelected(
      new Set(
        rows.filter((row) => row.status !== "rejected").map((row) => row.id),
      ),
    );
  }

  async function updateCandidate(candidate: TaskCandidate) {
    try {
      await request("/api/candidates", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(candidate),
      });
      setMessage("Coursework item saved.");
    } catch {}
  }

  async function confirmCandidates() {
    if (!reviewing) return;
    try {
      await request("/api/candidates/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          syllabusId: reviewing.id,
          candidateIds: [...selected],
        }),
      });
      window.location.reload();
    } catch {}
  }

  async function addCandidate() {
    if (!reviewing) return;
    try {
      await request("/api/candidates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          syllabusId: reviewing.id,
          title: "New coursework item",
          type: "other",
          due: semester.startDate,
        }),
      });
      await openReview(reviewing);
    } catch {}
  }

  async function connectCanvas(event: FormEvent) {
    event.preventDefault();
    try {
      const data = (await request("/api/canvas-sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          semesterId: semester.id,
          name: canvasName,
          feedUrl: canvasUrl,
        }),
      })) as { source?: CanvasSource };
      if (data.source)
        setSources((current) => [...current, data.source as CanvasSource]);
      setCanvasName("");
      setCanvasUrl("");
      setMessage("Canvas calendar connected. You can add another one below.");
    } catch {}
  }

  async function addManualTask(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseId: manualCourseId,
          title: manualTitle,
          type: manualType,
          due: manualDue,
          dueTime: manualDueTime,
          note: manualNote,
        }),
      });
      window.location.reload();
    } catch {}
  }

  async function completeSetup() {
    if (!onFinish) return;
    setSaving(true);
    setMessage("");
    try {
      await onFinish();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Setup could not be completed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: nameDraft,
          timezone: timezoneDraft,
          semester: {
            id: semester.id,
            name: semesterNameDraft,
            startDate: semesterStartDraft,
            endDate: semesterEndDraft,
          },
        }),
      });
      window.location.reload();
    } catch {}
  }

  async function saveMapping(canvasCourseKey: string, courseId: string) {
    try {
      await request("/api/course-mappings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ canvasCourseKey, courseId }),
      });
      window.location.reload();
    } catch {}
  }

  return (
    <section className="setup-page">
      <div className="setup-heading">
        <div>
          <p className="eyebrow">Semester setup</p>
          <h2>{semester.name}</h2>
          <p>
            Add all your courses, upload syllabi or enter coursework yourself,
            and optionally connect one or more Canvas calendars.
          </p>
        </div>
        {onClose && (
          <button className="secondary-button" onClick={onClose}>
            Back to dashboard
          </button>
        )}
      </div>
      {message && (
        <p className="setup-message" role="status">
          {message}
        </p>
      )}

      <div className="setup-grid">
        <article className="setup-card">
          <p className="step-number">1</p>
          <h3>Your courses</h3>
          <div className="course-progress">
            {courses.map((course) => {
              const syllabus = syllabi.find(
                (item) => item.courseId === course.id,
              );
              return (
                <div className="progress-row" key={course.id}>
                  <span
                    className="course-swatch"
                    style={{ background: course.color }}
                  />
                  <div>
                    <strong>{course.code}</strong>
                    <small>{course.title}</small>
                  </div>
                  <span>
                    {syllabus?.status === "confirmed"
                      ? "✓ Ready"
                      : syllabus
                        ? syllabus.status
                        : "Syllabus optional"}
                  </span>
                  {!syllabus && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await request(`/api/courses?id=${course.id}`, {
                            method: "DELETE",
                          });
                          window.location.reload();
                        } catch {}
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
            {!courses.length && (
              <p>No courses yet. Add your first one below.</p>
            )}
          </div>
          <form className="setup-form" onSubmit={addCourse}>
            <label>
              Course code
              <input
                required
                placeholder="CSCE 314"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
              />
            </label>
            <label>
              Course name
              <input
                required
                placeholder="Programming Languages"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
              />
            </label>
            <label>
              Instructor, optional
              <input
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
              />
            </label>
            <label>
              Pick a class color
              <span className="color-picker-control">
                <input
                  aria-label="Pick a class color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span>{color.toUpperCase()}</span>
              </span>
            </label>
            <button disabled={saving}>Add another course</button>
          </form>
        </article>

        <article className="setup-card">
          <p className="step-number">2</p>
          <h3>Add coursework</h3>
          <p>
            Upload a syllabus, add assignments yourself, or use both. A
            syllabus is optional.
          </p>
          {!courses.length && (
            <p className="setup-empty-note">
              Add a course first, then its syllabus and coursework controls
              will appear here.
            </p>
          )}
          {courses.map((course) => {
            const syllabus = syllabi.find(
              (item) => item.courseId === course.id,
            );
            return (
              <div className="syllabus-row" key={course.id}>
                <div>
                  <strong>{course.code}</strong>
                  <small>{syllabus?.filename ?? "No syllabus uploaded"}</small>
                  {syllabus?.error && (
                    <small className="warning-text">{syllabus.error}</small>
                  )}
                </div>
                {syllabus ? (
                  <div className="row-actions">
                    <button
                      className="secondary-button"
                      onClick={() => openReview(syllabus)}
                      disabled={syllabus.status === "failed"}
                    >
                      Review coursework
                    </button>
                    <button
                      className="text-button"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Remove this syllabus and its confirmed coursework?",
                          )
                        )
                          return;
                        try {
                          await request(`/api/syllabi?id=${syllabus.id}`, {
                            method: "DELETE",
                          });
                          window.location.reload();
                        } catch {}
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={(event) => uploadSyllabus(event, course.id)}>
                    <input
                      id={`syllabus-file-${course.id}`}
                      className="file-picker-input"
                      required
                      name="file"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) =>
                        setSelectedFiles((current) => ({
                          ...current,
                          [course.id]: event.target.files?.[0]?.name ?? "",
                        }))
                      }
                    />
                    <label
                      className="file-picker-button"
                      htmlFor={`syllabus-file-${course.id}`}
                    >
                      {selectedFiles[course.id] || "Choose PDF or DOCX"}
                    </label>
                    <button disabled={saving}>Upload syllabus</button>
                  </form>
                )}
              </div>
            );
          })}
          {!!courses.length && (
            <div className="manual-task-section">
              <h4>Add a custom assignment or exam</h4>
              <p>
                Use this whenever a syllabus is missing an item or does not
                include a detailed schedule.
              </p>
              <form className="manual-task-form" onSubmit={addManualTask}>
                <label>
                  Class
                  <select
                    required
                    value={manualCourseId}
                    onChange={(event) => setManualCourseId(event.target.value)}
                  >
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} · {course.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="manual-title-field">
                  Assignment name
                  <input
                    required
                    placeholder="Exam 1 or Homework 3"
                    value={manualTitle}
                    onChange={(event) => setManualTitle(event.target.value)}
                  />
                </label>
                <label>
                  Work type
                  <select
                    value={manualType}
                    onChange={(event) =>
                      setManualType(event.target.value as TaskType)
                    }
                  >
                    {taskTypes.map((type) => (
                      <option key={type} value={type}>
                        {type[0].toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Due date
                  <input
                    required
                    type="date"
                    value={manualDue}
                    onChange={(event) => setManualDue(event.target.value)}
                  />
                </label>
                <label>
                  Due time, optional
                  <input
                    placeholder="11:59 PM"
                    value={manualDueTime}
                    onChange={(event) => setManualDueTime(event.target.value)}
                  />
                </label>
                <label className="manual-note-field">
                  Notes, optional
                  <textarea
                    rows={3}
                    placeholder="Add study topics, instructions, or reminders"
                    value={manualNote}
                    onChange={(event) => setManualNote(event.target.value)}
                  />
                </label>
                <button disabled={saving}>Add to dashboard</button>
              </form>
            </div>
          )}
        </article>

        <article className="setup-card">
          <p className="step-number">3</p>
          <h3>Connect Canvas</h3>
          <p>
            In Canvas, open Calendar, then Calendar Feed. The private URL is
            stored only in your D1 database. Repeat this form for every Canvas
            account or school you use.
          </p>
          {sources.map((source) => (
            <div className="progress-row" key={source.id}>
              <div>
                <strong>{source.name}</strong>
                <small>Connected feed ••••••</small>
              </div>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await request(`/api/canvas-sources?id=${source.id}`, {
                      method: "DELETE",
                    });
                    setSources((current) =>
                      current.filter((item) => item.id !== source.id),
                    );
                    setMessage("Canvas calendar disconnected.");
                  } catch {}
                }}
              >
                Disconnect
              </button>
            </div>
          ))}
          {!!sources.length && (
            <button
              className="secondary-button sync-button"
              onClick={async () => {
                try {
                  await request("/api/calendar", { method: "GET" });
                  setMessage("Canvas sync completed.");
                } catch {}
              }}
            >
              Sync now
            </button>
          )}
          <form className="setup-form single-column" onSubmit={connectCanvas}>
            <label>
              Source name, optional
              <input
                placeholder="Texas A&M"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
              />
            </label>
            <label>
              Canvas ICS URL
              <input
                required
                type="url"
                placeholder="https://canvas.example.edu/feeds/...ics"
                value={canvasUrl}
                onChange={(e) => setCanvasUrl(e.target.value)}
              />
            </label>
            <button disabled={saving}>
              {sources.length ? "Add another Canvas calendar" : "Test and connect"}
            </button>
          </form>
          {unmatchedCourses.map((key) => (
            <label className="mapping-row" key={key}>
              Match Canvas course <strong>{key}</strong>
              <select
                defaultValue=""
                onChange={(e) =>
                  e.target.value && saveMapping(key, e.target.value)
                }
              >
                <option value="">Choose a course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </article>

        <article className="setup-card">
          <p className="step-number">4</p>
          <h3>Personalize</h3>
          <form className="setup-form single-column" onSubmit={saveSettings}>
            <label>
              Display name, optional
              <input
                placeholder="Your name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
              />
            </label>
            <label>
              Semester name
              <input
                required
                value={semesterNameDraft}
                onChange={(e) => setSemesterNameDraft(e.target.value)}
              />
            </label>
            <label>
              Start date
              <input
                required
                type="date"
                value={semesterStartDraft}
                onChange={(e) => setSemesterStartDraft(e.target.value)}
              />
            </label>
            <label>
              End date
              <input
                required
                type="date"
                value={semesterEndDraft}
                onChange={(e) => setSemesterEndDraft(e.target.value)}
              />
            </label>
            <label>
              Timezone
              <input
                required
                placeholder="America/Chicago"
                value={timezoneDraft}
                onChange={(e) => setTimezoneDraft(e.target.value)}
              />
            </label>
            <button disabled={saving}>Save settings</button>
          </form>
        </article>
      </div>

      {onFinish && (
        <div className="setup-finish-bar">
          <div>
            <strong>Finished adding your classes?</strong>
            <span>
              You can return to Settings anytime to add more courses,
              coursework, syllabi, or Canvas calendars.
            </span>
          </div>
          <button onClick={completeSetup} disabled={saving || !courses.length}>
            Finish setup and open dashboard
          </button>
        </div>
      )}

      {reviewing && (
        <div className="edit-overlay">
          <section className="review-dialog" role="dialog" aria-modal="true">
            <div className="edit-heading">
              <div>
                <p className="eyebrow">Review coursework</p>
                <h2>{reviewing.filename}</h2>
              </div>
              <button
                className="close-button"
                onClick={() => setReviewing(null)}
              >
                ×
              </button>
            </div>
            <p>
              Edit every uncertain item, uncheck anything that should be
              excluded, then confirm.
            </p>
            <div className="candidate-list">
              {candidates.map((candidate, index) => (
                <article className="candidate-row" key={candidate.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(candidate.id)}
                    aria-label={`Include ${candidate.title}`}
                    onChange={(e) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(candidate.id);
                        else next.delete(candidate.id);
                        return next;
                      })
                    }
                  />
                  <div className="candidate-fields">
                    <input
                      aria-label="Title"
                      value={candidate.title}
                      onChange={(e) =>
                        setCandidates((rows) =>
                          rows.map((row, i) =>
                            i === index
                              ? { ...row, title: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <select
                      aria-label="Work type"
                      value={candidate.type}
                      onChange={(e) =>
                        setCandidates((rows) =>
                          rows.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  type: e.target.value as TaskCandidate["type"],
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      {taskTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      aria-label="Due date"
                      type="date"
                      value={candidate.due}
                      onChange={(e) =>
                        setCandidates((rows) =>
                          rows.map((row, i) =>
                            i === index ? { ...row, due: e.target.value } : row,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label="Due time"
                      placeholder="11:59 PM"
                      value={candidate.dueTime ?? ""}
                      onChange={(e) =>
                        setCandidates((rows) =>
                          rows.map((row, i) =>
                            i === index
                              ? { ...row, dueTime: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={candidate.optional}
                        onChange={(e) =>
                          setCandidates((rows) =>
                            rows.map((row, i) =>
                              i === index
                                ? { ...row, optional: e.target.checked }
                                : row,
                            ),
                          )
                        }
                      />{" "}
                      Optional
                    </label>
                    <button
                      className="secondary-button"
                      onClick={() => updateCandidate(candidate)}
                    >
                      Save item
                    </button>
                  </div>
                  {candidate.confidence < 0.75 && (
                    <span className="confidence-warning">Low confidence</span>
                  )}
                </article>
              ))}
            </div>
            {!candidates.length && (
              <p>
                No dated items were found. Add the missing coursework manually
                below.
              </p>
            )}
            <div className="review-actions">
              <button className="secondary-button" onClick={addCandidate}>
                Add missing item
              </button>
              <span />
              <button
                className="secondary-button"
                onClick={() => setReviewing(null)}
              >
                Cancel
              </button>
              <button onClick={confirmCandidates} disabled={saving}>
                Add coursework to Course Board
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
