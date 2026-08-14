import {
  Volunteer,
  Schedule,
  UnitConfig,
  InactivePeriod,
  Gender,
  ServiceRecord,
  ShiftType,
  WeekAssignment,
} from "@/types/schedule";
import { hasWeekStarted } from "./scheduler";
import membersData from "@/data/members.json";
import { supabase } from "./supabase";

export async function getVolunteers(): Promise<Volunteer[]> {
  const { data, error } = await supabase
    .from("volunteers")
    .select("id, name, unit, gender, availability, inactive_periods")
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Seed default members on first run when the table is empty
  if (data.length === 0) {
    const { error: insertError } = await supabase
      .from("volunteers")
      .insert(membersData);
    if (insertError) throw insertError;
    return membersData as Volunteer[];
  }

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as string,
    gender: (row.gender as Gender | null) ?? undefined,
    availability: row.availability as Volunteer["availability"],
    inactivePeriods: (row.inactive_periods as InactivePeriod[]) ?? [],
  }));
}

export async function addVolunteer(vol: Volunteer): Promise<void> {
  const { error } = await supabase.from("volunteers").insert({
    id: vol.id,
    name: vol.name,
    unit: vol.unit,
    gender: vol.gender ?? null,
    availability: vol.availability,
    inactive_periods: vol.inactivePeriods ?? [],
  });
  if (error) throw error;
}

export async function updateVolunteerGender(
  id: string,
  gender: Gender,
): Promise<void> {
  const { error } = await supabase
    .from("volunteers")
    .update({ gender })
    .eq("id", id);
  if (error) throw error;
}

export async function removeVolunteer(id: string): Promise<void> {
  const { error } = await supabase.from("volunteers").delete().eq("id", id);
  if (error) throw error;
}

export async function updateVolunteerAvailability(
  id: string,
  availability: ShiftType[],
): Promise<void> {
  const { error } = await supabase
    .from("volunteers")
    .update({ availability })
    .eq("id", id);
  if (error) throw error;
}

export async function updateVolunteerInactivePeriods(
  id: string,
  periods: InactivePeriod[],
): Promise<void> {
  const { error } = await supabase
    .from("volunteers")
    .update({ inactive_periods: periods })
    .eq("id", id);
  if (error) throw error;
}

export async function getSchedule(): Promise<Schedule | null> {
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    id: row.id,
    startDate: row.start_date,
    weeks: row.weeks,
    createdAt: row.created_at,
  };
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
  const { error } = await supabase.from("schedules").upsert({
    id: schedule.id,
    start_date: schedule.startDate,
    weeks: schedule.weeks,
    created_at: schedule.createdAt,
  });
  if (error) throw error;
}

export async function clearSchedule(): Promise<void> {
  const { data } = await supabase.from("schedules").select("id");
  if (!data || data.length === 0) return;
  const { error } = await supabase
    .from("schedules")
    .delete()
    .in(
      "id",
      data.map((r) => r.id),
    );
  if (error) throw error;
}

// ── Service history ──────────────────────────────────────────────────────────

/** Jan 1 of the current year — the default window for the yearly balance. */
export function startOfCurrentYear(now: Date = new Date()): string {
  return `${now.getFullYear()}-01-01`;
}

/**
 * Every recorded shift from `since` onward (defaults to the start of this
 * year). This is what the scheduler balances against, so it must outlive the
 * rolling 8-week window in the schedules table.
 */
export async function getServiceHistory(
  since: string = startOfCurrentYear(),
): Promise<ServiceRecord[]> {
  const { data, error } = await supabase
    .from("service_history")
    .select("volunteer_id, volunteer_name, week_start_date, unit, shift, attended")
    .gte("week_start_date", since);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    volunteerId: row.volunteer_id as string,
    volunteerName: row.volunteer_name as string,
    weekStartDate: row.week_start_date as string,
    unit: row.unit as string,
    shift: row.shift as ShiftType,
    attended: row.attended as boolean,
  }));
}

/**
 * Flattens weeks into service rows. The week's `absences` list is the source of
 * truth for turnout, so re-recording a week is idempotent — it produces exactly
 * the same rows and simply overwrites what is already there.
 *
 * Only weeks that have started are recorded; a shift nobody has worked yet is
 * not history.
 */
export function weeksToServiceRecords(
  weeks: WeekAssignment[],
  volunteers: Volunteer[],
): ServiceRecord[] {
  const nameById = new Map(volunteers.map((v) => [v.id, v.name]));
  const records: ServiceRecord[] = [];

  for (const week of weeks) {
    if (!hasWeekStarted(week.weekStartDate)) continue;

    for (const [unit, shifts] of Object.entries(week.assignments ?? {})) {
      for (const shift of ["overnight", "morning"] as const) {
        const absent = new Set(week.absences?.[shift] ?? []);
        for (const id of shifts[shift]) {
          records.push({
            volunteerId: id,
            volunteerName: nameById.get(id) ?? "Unknown",
            weekStartDate: week.weekStartDate,
            unit,
            shift,
            attended: !absent.has(id),
          });
        }
      }
    }
  }

  return records;
}

/**
 * Writes started weeks into the permanent record. Called before every generate
 * so that weeks about to roll out of the window are never lost, and again when
 * turnout is confirmed so absences overwrite the presumed-present rows.
 */
export async function recordService(
  weeks: WeekAssignment[],
  volunteers: Volunteer[],
): Promise<number> {
  const records = weeksToServiceRecords(weeks, volunteers);
  if (records.length === 0) return 0;

  const { error } = await supabase.from("service_history").upsert(
    records.map((r) => ({
      volunteer_id: r.volunteerId,
      volunteer_name: r.volunteerName,
      week_start_date: r.weekStartDate,
      unit: r.unit,
      shift: r.shift,
      attended: r.attended,
    })),
    { onConflict: "volunteer_id,week_start_date,shift" },
  );
  if (error) throw error;
  return records.length;
}

/**
 * Rewrites a week's rows from scratch. Editing a week that has already been
 * recorded would otherwise leave the people who were swapped out still holding
 * credit for a shift they no longer have, so the old rows go first.
 */
export async function resyncServiceForWeek(
  week: WeekAssignment,
  volunteers: Volunteer[],
): Promise<void> {
  const { error } = await supabase
    .from("service_history")
    .delete()
    .eq("week_start_date", week.weekStartDate);
  if (error) throw error;
  await recordService([week], volunteers);
}

// ── Units ────────────────────────────────────────────────────────────────────

const DEFAULT_UNITS: UnitConfig[] = [
  {
    id: crypto.randomUUID(),
    name: "sound",
    label: "Sound",
    overnightMin: 5,
    overnightMax: 6,
    morningMin: 2,
    morningMax: 2,
  },
  {
    id: crypto.randomUUID(),
    name: "light",
    label: "Light",
    overnightMin: 2,
    overnightMax: 2,
    morningMin: 1,
    morningMax: 1,
  },
];

function rowToUnit(row: Record<string, unknown>): UnitConfig {
  return {
    id: row.id as string,
    name: row.name as string,
    label: row.label as string,
    overnightMin: row.overnight_min as number,
    overnightMax: row.overnight_max as number,
    morningMin: row.morning_min as number,
    morningMax: row.morning_max as number,
  };
}

export async function getUnits(): Promise<UnitConfig[]> {
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  if (data.length === 0) {
    const { error: insertError } = await supabase.from("units").insert(
      DEFAULT_UNITS.map((u) => ({
        id: u.id,
        name: u.name,
        label: u.label,
        overnight_min: u.overnightMin,
        overnight_max: u.overnightMax,
        morning_min: u.morningMin,
        morning_max: u.morningMax,
      })),
    );
    if (insertError) throw insertError;
    return DEFAULT_UNITS;
  }

  return data.map(rowToUnit);
}

export async function createUnit(unit: UnitConfig): Promise<void> {
  const { error } = await supabase.from("units").insert({
    id: unit.id,
    name: unit.name,
    label: unit.label,
    overnight_min: unit.overnightMin,
    overnight_max: unit.overnightMax,
    morning_min: unit.morningMin,
    morning_max: unit.morningMax,
  });
  if (error) throw error;
}

export async function updateUnit(unit: UnitConfig): Promise<void> {
  const { error } = await supabase
    .from("units")
    .update({
      label: unit.label,
      overnight_min: unit.overnightMin,
      overnight_max: unit.overnightMax,
      morning_min: unit.morningMin,
      morning_max: unit.morningMax,
    })
    .eq("id", unit.id);
  if (error) throw error;
}

export async function deleteUnit(id: string): Promise<void> {
  const { error } = await supabase.from("units").delete().eq("id", id);
  if (error) throw error;
}
