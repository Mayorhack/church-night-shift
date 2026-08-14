import {
  Schedule,
  ServiceRecord,
  ShiftType,
  Volunteer,
} from "@/types/schedule";
import { hasWeekStarted } from "@/lib/scheduler";

export interface BalanceEntry {
  volunteer: Volunteer;
  /** Shifts actually turned up for — the number being levelled out. */
  attended: number;
  /** Scheduled but did not show. Earns no credit. */
  missed: number;
  /** Distance from the group average. Negative means owed more shifts. */
  diff: number;
}

export interface ShiftBalance {
  shift: ShiftType;
  entries: BalanceEntry[];
  average: number;
  /** Gap between the busiest and the quietest person. Zero is perfectly level. */
  spread: number;
}

/**
 * Year-to-date standing per shift type, built from the permanent service
 * record rather than the current 8-week window — this is the number the
 * scheduler is working to equalise.
 *
 * Only people currently available for a shift appear in its balance: someone
 * taken off morning is no longer part of the morning rotation, so counting
 * them would drag the average down and never be corrected.
 */
export function buildYearBalance(
  history: ServiceRecord[],
  volunteers: Volunteer[],
  unitFilter: string = "all",
): { overnight: ShiftBalance; morning: ShiftBalance } {
  const build = (shift: ShiftType): ShiftBalance => {
    const pool = volunteers.filter(
      (v) =>
        v.availability.includes(shift) &&
        (unitFilter === "all" || v.unit === unitFilter),
    );

    const attended = new Map<string, number>();
    const missed = new Map<string, number>();
    for (const r of history) {
      if (r.shift !== shift) continue;
      if (unitFilter !== "all" && r.unit !== unitFilter) continue;
      const target = r.attended ? attended : missed;
      target.set(r.volunteerId, (target.get(r.volunteerId) || 0) + 1);
    }

    const counts = pool.map((v) => attended.get(v.id) || 0);
    const average = counts.length
      ? counts.reduce((sum, n) => sum + n, 0) / counts.length
      : 0;

    const entries: BalanceEntry[] = pool
      .map((v) => {
        const served = attended.get(v.id) || 0;
        return {
          volunteer: v,
          attended: served,
          missed: missed.get(v.id) || 0,
          diff: Math.round((served - average) * 10) / 10,
        };
      })
      .sort(
        (a, b) =>
          a.attended - b.attended ||
          a.volunteer.name.localeCompare(b.volunteer.name),
      );

    return {
      shift,
      entries,
      average: Math.round(average * 10) / 10,
      spread: counts.length ? Math.max(...counts) - Math.min(...counts) : 0,
    };
  };

  return { overnight: build("overnight"), morning: build("morning") };
}

export interface ShiftTally {
  volunteer: Volunteer;
  /** Overnight shifts in this schedule (served + upcoming). */
  overnight: number;
  /** Morning shifts in this schedule (served + upcoming). */
  morning: number;
  total: number;
  /** Subset of the above whose week has already started. */
  servedOvernight: number;
  servedMorning: number;
}

export interface ShiftReport {
  tallies: ShiftTally[];
  /** Ranked by overnight count, highest first. Only people with 1+ overnight. */
  topOvernight: ShiftTally[];
  /** Ranked by morning count, highest first. Only people with 1+ morning. */
  topMorning: ShiftTally[];
  totalOvernightSlots: number;
  totalMorningSlots: number;
}

/**
 * Tallies every assignment in a schedule per volunteer, ranked so the people
 * carrying the most overnight and the most morning shifts surface first.
 */
export function buildShiftReport(
  schedule: Schedule | null,
  volunteers: Volunteer[],
  unitFilter: string = "all",
): ShiftReport {
  const empty: ShiftReport = {
    tallies: [],
    topOvernight: [],
    topMorning: [],
    totalOvernightSlots: 0,
    totalMorningSlots: 0,
  };
  if (!schedule) return empty;

  const tallyById = new Map<string, ShiftTally>();
  volunteers.forEach((v) =>
    tallyById.set(v.id, {
      volunteer: v,
      overnight: 0,
      morning: 0,
      total: 0,
      servedOvernight: 0,
      servedMorning: 0,
    }),
  );

  let totalOvernightSlots = 0;
  let totalMorningSlots = 0;

  for (const week of schedule.weeks) {
    const hasStarted = hasWeekStarted(week.weekStartDate);
    for (const [unitName, shifts] of Object.entries(week.assignments ?? {})) {
      if (unitFilter !== "all" && unitName !== unitFilter) continue;

      totalOvernightSlots += shifts.overnight.length;
      totalMorningSlots += shifts.morning.length;

      for (const id of shifts.overnight) {
        const t = tallyById.get(id);
        if (!t) continue; // volunteer was removed from the roster
        t.overnight++;
        t.total++;
        if (hasStarted) t.servedOvernight++;
      }
      for (const id of shifts.morning) {
        const t = tallyById.get(id);
        if (!t) continue;
        t.morning++;
        t.total++;
        if (hasStarted) t.servedMorning++;
      }
    }
  }

  const tallies = [...tallyById.values()].filter((t) => t.total > 0);

  const rank = (key: "overnight" | "morning") =>
    tallies
      .filter((t) => t[key] > 0)
      .sort(
        (a, b) =>
          b[key] - a[key] ||
          b.total - a.total ||
          a.volunteer.name.localeCompare(b.volunteer.name),
      );

  return {
    tallies: tallies.sort(
      (a, b) =>
        b.total - a.total || a.volunteer.name.localeCompare(b.volunteer.name),
    ),
    topOvernight: rank("overnight"),
    topMorning: rank("morning"),
    totalOvernightSlots,
    totalMorningSlots,
  };
}
