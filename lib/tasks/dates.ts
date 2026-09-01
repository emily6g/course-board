export function semesterWeek(value: string, semesterStartDate: string) {
  const due = new Date(`${value}T12:00:00Z`);
  const start = new Date(`${semesterStartDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return Math.max(
    1,
    Math.floor((due.getTime() - start.getTime()) / 604_800_000) + 1,
  );
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}
