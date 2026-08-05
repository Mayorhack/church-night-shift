import { Schedule, Volunteer } from "@/types/schedule";
import { hasWeekStarted } from "@/lib/scheduler";

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
