import {
  Volunteer,
  WeekAssignment,
  Schedule,
  UnitConfig,
} from "@/types/schedule";
import {
  addDays,
  addWeeks,
  format,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
} from "date-fns";

/** Weeks starting within this many days (or already started) can no longer be edited/regenerated. */
const LOCK_BUFFER_DAYS = 4;

/** Returns true once a week's start date is within the lock buffer of today (or has passed). */
export function isWeekLocked(
  weekStartDate: string | Date,
  now: Date = new Date(),
): boolean {
  const weekDate =
    typeof weekStartDate === "string" ? parseISO(weekStartDate) : weekStartDate;
  const lockThreshold = addDays(startOfDay(now), LOCK_BUFFER_DAYS);
  return isBefore(weekDate, lockThreshold) || isEqual(weekDate, lockThreshold);
}

/** Returns true when the volunteer has an inactive period that overlaps the given week. */
export function isVolunteerInactiveForWeek(
  vol: Volunteer,
  weekStartDate: string | Date,
): boolean {
  if (!vol.inactivePeriods?.length) return false;
  const weekStart =
    typeof weekStartDate === "string" ? parseISO(weekStartDate) : weekStartDate;
  const weekEnd = addDays(weekStart, 6);
  return vol.inactivePeriods.some((p) => {
    const from = parseISO(p.from);
    const to = parseISO(p.to);
    return from <= weekEnd && to >= weekStart;
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickFairest(
  candidates: Volunteer[],
  count: number,
  assignmentCounts: Map<string, number>,
  lastWeekIds: Set<string>,
  excludeIds?: Set<string>,
): string[] {
  const available = excludeIds
    ? candidates.filter((v) => !excludeIds.has(v.id))
    : candidates;

  // Pick `needed` people from `pool` by least-assigned first, shuffling within ties.
  const pickByFairness = (pool: Volunteer[], needed: number): string[] => {
    const sorted = [...pool].sort(
      (a, b) => (assignmentCounts.get(a.id) || 0) - (assignmentCounts.get(b.id) || 0),
    );
    const result: string[] = [];
    let i = 0;
    while (result.length < needed && i < sorted.length) {
      const currentCount = assignmentCounts.get(sorted[i].id) || 0;
      const group: Volunteer[] = [];
      while (
        i < sorted.length &&
        (assignmentCounts.get(sorted[i].id) || 0) === currentCount
      ) {
        group.push(sorted[i]);
        i++;
      }
      for (const v of shuffle(group)) {
        if (result.length < needed) result.push(v.id);
      }
    }
    return result;
  };

  // Strictly prefer people who were NOT scheduled last week so no one is
  // ever back-to-back unless the fresh pool is too small to fill all slots.
  const fresh = available.filter((v) => !lastWeekIds.has(v.id));
  const picked = pickByFairness(fresh, count);

  if (picked.length < count) {
    // Fresh pool exhausted — fall back to last-week people for the remaining
    // slots rather than leaving them empty.
    const pickedSet = new Set(picked);
    const repeat = available.filter(
      (v) => lastWeekIds.has(v.id) && !pickedSet.has(v.id),
    );
    return [...picked, ...pickByFairness(repeat, count - picked.length)];
  }

  return picked;
}

export function generateSchedule(
  volunteers: Volunteer[],
  unitConfigs: UnitConfig[],
  startDate: Date,
  unitFilter: string = "all",
  existingSchedule?: Schedule,
  skippedOvernightWeeks: Set<number> = new Set(),
): Schedule {
  const counts = new Map<string, number>();
  volunteers.forEach((v) => counts.set(v.id, 0));

  const activeUnits =
    unitFilter === "all"
      ? unitConfigs
      : unitConfigs.filter((unit) => unit.name === unitFilter);

  // Seed fairness counts from the ENTIRE existing schedule (locked weeks
  // included), since those assignments are real and should still count.
  // For unlocked weeks that are being skipped, don't count overnight — those
  // volunteers are being redistributed and shouldn't be penalised.
  if (existingSchedule) {
    for (const week of existingSchedule.weeks) {
      const weekDate = parseISO(week.weekStartDate);
      const weekIsLocked = isWeekLocked(weekDate);
      const weekOvernightBeingCleared =
        !weekIsLocked && skippedOvernightWeeks.has(week.weekNumber);

      for (const [unitName, shifts] of Object.entries(week.assignments)) {
        // Skip only unlocked weeks for the filtered unit — those will be
        // recomputed below. Locked/passed weeks are real history and must
        // always count, even when regenerating a single unit, so volunteers
        // who already served aren't treated as fresh once new members join.
        if (unitFilter !== "all" && unitName === unitFilter && !weekIsLocked)
          continue;
        if (!weekOvernightBeingCleared) {
          shifts.overnight.forEach((id) =>
            counts.set(id, (counts.get(id) || 0) + 1),
          );
        }
        shifts.morning.forEach((id) =>
          counts.set(id, (counts.get(id) || 0) + 1),
        );
      }
    }
  }

  const weeks: WeekAssignment[] = [];
  const lastWeek = new Map<string, Set<string>>();

  for (let w = 0; w < 8; w++) {
    const existingWeek = existingSchedule?.weeks[w];
    // Prefer the actual stored date so that changing startDate in the picker
    // never causes past weeks to be unlocked or regenerated.
    const weekDate = existingWeek
      ? parseISO(existingWeek.weekStartDate)
      : addWeeks(startDate, w);
    const isLocked = isWeekLocked(weekDate);

    if (isLocked && existingWeek) {
      // Current/past week: keep exactly as-is, no regeneration at all.
      weeks.push(structuredClone(existingWeek));
      // Still feed lastWeek tracking so the first unlocked week doesn't
      // accidentally repeat someone from this locked week.
      for (const [unitName, shifts] of Object.entries(
        existingWeek.assignments,
      )) {
        lastWeek.set(`${unitName}:overnight`, new Set(shifts.overnight));
        lastWeek.set(`${unitName}:morning`, new Set(shifts.morning));
      }
      continue;
    }

    const isOvernightSkipped = skippedOvernightWeeks.has(w + 1);

    // Start from existing week's assignments so untouched units carry over.
    const assignments: Record<
      string,
      { overnight: string[]; morning: string[] }
    > = existingWeek ? structuredClone(existingWeek.assignments) : {};

    const overnightIds = new Set<string>();
    if (unitFilter !== "all" && existingWeek) {
      for (const [unitName, shifts] of Object.entries(
        existingWeek.assignments,
      )) {
        if (unitName === unitFilter) continue;
        shifts.overnight.forEach((id) => overnightIds.add(id));
      }
    }

    if (isOvernightSkipped) {
      // No overnight this week — clear overnight slots for all active units so
      // those volunteers redistribute evenly across the remaining active weeks.
      for (const unit of activeUnits) {
        assignments[unit.name] = {
          overnight: [],
          morning: assignments[unit.name]?.morning ?? [],
        };
      }
    } else {
      // First pass: overnight for active (selected) units only
      for (const unit of activeUnits) {
        const pool = volunteers.filter(
          (v) =>
            v.unit === unit.name &&
            v.availability.includes("overnight") &&
            !isVolunteerInactiveForWeek(v, weekDate),
        );
        const last =
          lastWeek.get(`${unit.name}:overnight`) ?? new Set<string>();
        const count = Math.min(unit.overnightMax, pool.length);
        const picked = pickFairest(pool, count, counts, last);
        assignments[unit.name] = { overnight: picked, morning: [] };
        picked.forEach((id) => overnightIds.add(id));
      }
    }

    // Second pass: morning for active (selected) units only (always runs)
    for (const unit of activeUnits) {
      const pool = volunteers.filter(
        (v) =>
          v.unit === unit.name &&
          v.availability.includes("morning") &&
          !isVolunteerInactiveForWeek(v, weekDate),
      );
      const last = lastWeek.get(`${unit.name}:morning`) ?? new Set<string>();
      const count = Math.min(unit.morningMax, pool.length);
      const picked = pickFairest(pool, count, counts, last, overnightIds);
      assignments[unit.name].morning = picked;
    }

    // Update cumulative counts and last-week tracking for active units only
    for (const unit of activeUnits) {
      const { overnight, morning } = assignments[unit.name];
      [...overnight, ...morning].forEach((id) =>
        counts.set(id, (counts.get(id) || 0) + 1),
      );
      lastWeek.set(`${unit.name}:overnight`, new Set(overnight));
      lastWeek.set(`${unit.name}:morning`, new Set(morning));
    }

    weeks.push({
      weekNumber: w + 1,
      weekStartDate: existingWeek
        ? existingWeek.weekStartDate
        : format(weekDate, "yyyy-MM-dd"),
      assignments,
      ...(isOvernightSkipped ? { overnightSkipped: true } : {}),
    });
  }

  return {
    id: existingSchedule?.id ?? crypto.randomUUID(),
    startDate: existingSchedule?.startDate ?? format(startDate, "yyyy-MM-dd"),
    weeks,
    createdAt: existingSchedule?.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Re-distributes only the overnight assignments across all unlocked weeks
 * without touching morning assignments.
 *
 * Weeks in `skippedOvernightWeeks` get their overnight slots cleared and are
 * flagged `overnightSkipped: true`.  Because those volunteers no longer
 * accumulate a count for the skipped week, the fairness algorithm
 * automatically spreads them across the remaining active overnight weeks.
 */
export function redistributeOvernight(
  volunteers: Volunteer[],
  unitConfigs: UnitConfig[],
  existingSchedule: Schedule,
  skippedOvernightWeeks: Set<number>,
): Schedule {
  const counts = new Map<string, number>();
  volunteers.forEach((v) => counts.set(v.id, 0));

  // Seed counts: morning from all weeks (stays unchanged) + overnight from
  // locked weeks only (those are immutable).
  for (const week of existingSchedule.weeks) {
    const weekDate = parseISO(week.weekStartDate);
    const weekIsLocked = isWeekLocked(weekDate);

    for (const [, shifts] of Object.entries(week.assignments)) {
      shifts.morning.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
      if (weekIsLocked) {
        shifts.overnight.forEach((id) =>
          counts.set(id, (counts.get(id) || 0) + 1),
        );
      }
    }
  }

  const lastWeek = new Map<string, Set<string>>();
  const updatedWeeks: WeekAssignment[] = [];

  for (const week of existingSchedule.weeks) {
    const weekDate = parseISO(week.weekStartDate);
    const isLocked = isWeekLocked(weekDate);

    if (isLocked) {
      updatedWeeks.push(structuredClone(week));
      for (const [unitName, shifts] of Object.entries(week.assignments)) {
        lastWeek.set(`${unitName}:overnight`, new Set(shifts.overnight));
      }
      continue;
    }

    const isSkipped = skippedOvernightWeeks.has(week.weekNumber);
    const assignments = structuredClone(week.assignments);

    if (isSkipped) {
      for (const unit of unitConfigs) {
        const existing = assignments[unit.name] ?? { overnight: [], morning: [] };
        assignments[unit.name] = { ...existing, overnight: [] };
        lastWeek.set(`${unit.name}:overnight`, new Set());
      }
    } else {
      for (const unit of unitConfigs) {
        const pool = volunteers.filter(
          (v) =>
            v.unit === unit.name &&
            v.availability.includes("overnight") &&
            !isVolunteerInactiveForWeek(v, weekDate),
        );
        const last =
          lastWeek.get(`${unit.name}:overnight`) ?? new Set<string>();
        const count = Math.min(unit.overnightMax, pool.length);
        const picked = pickFairest(pool, count, counts, last);
        const existing = assignments[unit.name] ?? { overnight: [], morning: [] };
        assignments[unit.name] = { ...existing, overnight: picked };
        picked.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
        lastWeek.set(`${unit.name}:overnight`, new Set(picked));
      }
    }

    const weekCopy = structuredClone(week);
    weekCopy.assignments = assignments;
    if (isSkipped) {
      weekCopy.overnightSkipped = true;
    } else {
      delete weekCopy.overnightSkipped;
    }
    updatedWeeks.push(weekCopy);
  }

  return { ...existingSchedule, weeks: updatedWeeks };
}
