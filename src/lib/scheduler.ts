import {
  Volunteer,
  WeekAssignment,
  Schedule,
  UnitConfig,
} from "@/types/schedule";
import { addWeeks, format, isBefore, isEqual, startOfWeek } from "date-fns";

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
  // Filter out excluded IDs (e.g., those already assigned to another shift this week)
  const available = excludeIds
    ? candidates.filter((v) => !excludeIds.has(v.id))
    : candidates;

  // Sort by: least assignments first, then avoid back-to-back
  const sorted = [...available].sort((a, b) => {
    const ca = assignmentCounts.get(a.id) || 0;
    const cb = assignmentCounts.get(b.id) || 0;
    if (ca !== cb) return ca - cb;
    const aLast = lastWeekIds.has(a.id) ? 1 : 0;
    const bLast = lastWeekIds.has(b.id) ? 1 : 0;
    return aLast - bLast;
  });

  // Among ties, shuffle for randomness
  const result: string[] = [];
  let i = 0;
  while (result.length < count && i < sorted.length) {
    const currentCount = assignmentCounts.get(sorted[i].id) || 0;
    const group: Volunteer[] = [];
    while (
      i < sorted.length &&
      (assignmentCounts.get(sorted[i].id) || 0) === currentCount
    ) {
      group.push(sorted[i]);
      i++;
    }
    const shuffled = shuffle(group);
    for (const v of shuffled) {
      if (result.length < count) {
        result.push(v.id);
      }
    }
  }
  return result;
}

export function generateSchedule(
  volunteers: Volunteer[],
  unitConfigs: UnitConfig[],
  startDate: Date,
  unitFilter: string = "all",
  existingSchedule?: Schedule,
): Schedule {
  const counts = new Map<string, number>();
  volunteers.forEach((v) => counts.set(v.id, 0));

  const activeUnits =
    unitFilter === "all"
      ? unitConfigs
      : unitConfigs.filter((unit) => unit.name === unitFilter);

  // Anything at or before the start of the current week is locked.
  const currentWeekStart = startOfWeek(new Date());

  // Seed fairness counts from the ENTIRE existing schedule (locked weeks
  // included), since those assignments are real and should still count.
  if (existingSchedule) {
    for (const week of existingSchedule.weeks) {
      for (const [unitName, shifts] of Object.entries(week.assignments)) {
        if (unitFilter !== "all" && unitName === unitFilter) continue; // will be recomputed for unlocked weeks
        [...shifts.overnight, ...shifts.morning].forEach((id) =>
          counts.set(id, (counts.get(id) || 0) + 1),
        );
      }
    }
  }

  const weeks: WeekAssignment[] = [];
  const lastWeek = new Map<string, Set<string>>();

  for (let w = 0; w < 8; w++) {
    const weekDate = addWeeks(startDate, w);
    const existingWeek = existingSchedule?.weeks[w];
    const isLocked =
      isBefore(weekDate, currentWeekStart) ||
      isEqual(weekDate, currentWeekStart);

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

    // First pass: overnight for active (selected) units only
    for (const unit of activeUnits) {
      const pool = volunteers.filter(
        (v) => v.unit === unit.name && v.availability.includes("overnight"),
      );
      const last = lastWeek.get(`${unit.name}:overnight`) ?? new Set<string>();
      const count = Math.min(unit.overnightMax, pool.length);
      const picked = pickFairest(pool, count, counts, last);
      assignments[unit.name] = { overnight: picked, morning: [] };
      picked.forEach((id) => overnightIds.add(id));
    }

    // Second pass: morning for active (selected) units only
    for (const unit of activeUnits) {
      const pool = volunteers.filter(
        (v) => v.unit === unit.name && v.availability.includes("morning"),
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
    });
  }

  return {
    id: existingSchedule?.id ?? crypto.randomUUID(),
    startDate: existingSchedule?.startDate ?? format(startDate, "yyyy-MM-dd"),
    weeks,
    createdAt: existingSchedule?.createdAt ?? new Date().toISOString(),
  };
}
