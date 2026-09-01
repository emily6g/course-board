# Extraction pipeline

Course Board treats syllabi, Canvas calendars, and manual entries as separate sources. They are normalized into a shared task shape, reviewed when needed, and merged only when there is strong evidence that two records describe the same coursework.

## Syllabus processing

1. PDF, DOCX, and TXT files are validated, stored privately in R2, and linked to the selected course.
2. PDF page boundaries are preserved. Every candidate stores its original text, page number, and row number.
3. Each text row is checked for actionable coursework. Gradeable tasks, required readings, deliverables, surveys, self-checks, and syllabus agreements are supported. Policy text, materials lists, and exam reviews without a submission are excluded.
4. Schedule rows containing several tasks are split into separate candidates. Multi-date rows and broken table relationships are flagged instead of guessed.
5. Dates use the configured semester year. Weekday-only deadlines use the containing schedule week and remain flagged for confirmation. TBD items remain undated.
6. Assigned readings without an official deadline use the prior calendar day and include a note identifying the class meeting and the derived nature of the date.
7. Explicit time ranges preserve both start and end times. Missing times remain empty and display as “Time not specified.”
8. Optional, alternative, tentative, inferred, date-mismatch, and low-confidence items are marked for review. Alternative choices share a group identifier and are not treated as independently required.
9. Repeated syllabus mentions are normalized by title and date. A cleaner detailed row replaces a summary duplicate while useful notes are retained.
10. Candidates are previewed before publishing. Flagged or undated candidates cannot be published until corrected and marked reviewed.

## Canvas processing

1. Multiple private ICS sources can be connected. Each source has a label, optional institution, and optional course-code restrictions. The complete URL is never returned to the browser.
2. Each source is fetched independently with a timeout, retry, manual redirect validation, and private-network protection.
3. Folded ICS lines are unfolded. Escaped characters are decoded and HTML descriptions are converted to safe plain text.
4. Each VEVENT is processed independently using UID, summary, description, dates, URL, categories, status, sequence, recurrence ID, and last-modified metadata.
5. UTC and TZID timestamps are converted into the configured timezone before the local date is derived. Date-only events remain all-day. DTEND is retained for scheduled exams and presentations.
6. Only actionable events mapped to configured courses are imported. Office hours, holidays, meetings, study sessions, announcements, exam reviews, and generic availability events are excluded.
7. Records are stored by calendar source and UID. Refreshes update the existing record, preserve its stable database ID, and record changed fields in source history.
8. A source failure leaves its cached tasks visible and stores a source-specific error. A missing event is archived only after three successful omissions. STATUS:CANCELLED is honored immediately.
9. Canvas feeds do not provide submission status. Progress always remains manual.

## Merge and display rules

- Manual overrides have highest display priority, followed by Canvas values, syllabus values, and derived values.
- Cross-source matching requires the same course plus a strong title, assignment-number, type, and nearby-date match. Same date or generic wording alone is never enough.
- Canvas supplies the active date, time, end time, and link for a matched item. Syllabus notes and original source evidence remain available.
- Status and manual overrides use the stable task ID and are never reset by refreshes.
- Required active work drives Due Today and Due This Week. Optional work stays visible in the full list but is excluded from required counts.
- The configured timezone determines today and week boundaries. Tasks sort by date, real time, untimed items, then title.
