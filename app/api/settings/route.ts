import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { appSettings, semesters } from "../../../db/schema";

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    displayName?: string;
    timezone?: string;
    semester?: {
      id?: string;
      name?: string;
      startDate?: string;
      endDate?: string;
    };
  };
  const db = getDb();
  if (typeof body.displayName === "string") {
    await db
      .insert(appSettings)
      .values({
        key: "displayName",
        value: body.displayName.trim(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: body.displayName.trim(),
          updatedAt: new Date().toISOString(),
        },
      });
  }
  if (typeof body.timezone === "string" && body.timezone.trim()) {
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: body.timezone.trim(),
      }).format();
    } catch {
      return Response.json(
        { error: "Enter a valid IANA timezone." },
        { status: 400 },
      );
    }
    await db
      .insert(appSettings)
      .values({
        key: "timezone",
        value: body.timezone.trim(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: body.timezone.trim(),
          updatedAt: new Date().toISOString(),
        },
      });
  }
  if (body.semester) {
    const id = Number(body.semester.id);
    const name = body.semester.name?.trim() ?? "";
    const startDate = body.semester.startDate?.trim() ?? "";
    const endDate = body.semester.endDate?.trim() ?? "";
    if (
      !Number.isInteger(id) ||
      !name ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      endDate <= startDate
    ) {
      return Response.json(
        { error: "Valid semester details are required." },
        { status: 400 },
      );
    }
    await db
      .update(semesters)
      .set({ name, startDate, endDate })
      .where(eq(semesters.id, id));
  }
  return Response.json({ saved: true });
}
