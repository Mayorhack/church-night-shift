import {
  Volunteer,
  WeekAssignment,
  Schedule,
  UnitConfig,
} from "@/types/schedule";
import { addWeeks, format } from "date-fns";

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
): Schedule {
  const counts = new Map<string, number>();
  volunteers.forEach((v) => counts.set(v.id, 0));

  const weeks: WeekAssignment[] = [];
  // Track previous week's picks per "unitName:shift" to avoid back-to-back
  const lastWeek = new Map<string, Set<string>>();

  for (let w = 0; w < 8; w++) {
    const weekDate = addWeeks(startDate, w);
    const assignments: Record<
      string,
      { overnight: string[]; morning: string[] }
    > = {};
    // Collect all overnight picks first so morning can exclude them
    const overnightIds = new Set<string>();

    // First pass: overnight for every unit
    for (const unit of unitConfigs) {
      const pool = volunteers.filter(
        (v) => v.unit === unit.name && v.availability.includes("overnight"),
      );
      const last = lastWeek.get(`${unit.name}:overnight`) ?? new Set<string>();
      const count = Math.min(unit.overnightMax, pool.length);
      const picked = pickFairest(pool, count, counts, last);
      assignments[unit.name] = { overnight: picked, morning: [] };
      picked.forEach((id) => overnightIds.add(id));
    }

    // Second pass: morning for every unit (excluding overnight volunteers)
    for (const unit of unitConfigs) {
      const pool = volunteers.filter(
        (v) => v.unit === unit.name && v.availability.includes("morning"),
      );
      const last = lastWeek.get(`${unit.name}:morning`) ?? new Set<string>();
      const count = Math.min(unit.morningMax, pool.length);
      const picked = pickFairest(pool, count, counts, last, overnightIds);
      assignments[unit.name].morning = picked;
    }

    // Update cumulative counts and last-week tracking
    for (const unit of unitConfigs) {
      const { overnight, morning } = assignments[unit.name];
      [...overnight, ...morning].forEach((id) =>
        counts.set(id, (counts.get(id) || 0) + 1),
      );
      lastWeek.set(`${unit.name}:overnight`, new Set(overnight));
      lastWeek.set(`${unit.name}:morning`, new Set(morning));
    }

    weeks.push({
      weekNumber: w + 1,
      weekStartDate: format(weekDate, "yyyy-MM-dd"),
      assignments,
    });
  }

  return {
    id: crypto.randomUUID(),
    startDate: format(startDate, "yyyy-MM-dd"),
    weeks,
    createdAt: new Date().toISOString(),
  };
}
