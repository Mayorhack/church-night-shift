import { Volunteer, WeekAssignment, Schedule, CREW_REQUIREMENTS } from "@/types/schedule";
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
  lastWeekIds: Set<string>
): string[] {
  // Sort by: least assignments first, then avoid back-to-back
  const sorted = [...candidates].sort((a, b) => {
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
    // Find group with same count
    const currentCount = assignmentCounts.get(sorted[i].id) || 0;
    const group: Volunteer[] = [];
    while (i < sorted.length && (assignmentCounts.get(sorted[i].id) || 0) === currentCount) {
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

export function generateSchedule(volunteers: Volunteer[], startDate: Date): Schedule {
  const soundVolunteers = volunteers.filter((v) => v.unit === "sound");
  const lightVolunteers = volunteers.filter((v) => v.unit === "light");

  const overnightSound = soundVolunteers.filter((v) => v.availability.includes("overnight"));
  const overnightLight = lightVolunteers.filter((v) => v.availability.includes("overnight"));
  const morningSound = soundVolunteers.filter((v) => v.availability.includes("morning"));
  const morningLight = lightVolunteers.filter((v) => v.availability.includes("morning"));

  const counts = new Map<string, number>();
  volunteers.forEach((v) => counts.set(v.id, 0));

  const weeks: WeekAssignment[] = [];
  let lastOvernightSound = new Set<string>();
  let lastOvernightLight = new Set<string>();
  let lastMorningSound = new Set<string>();
  let lastMorningLight = new Set<string>();

  for (let w = 0; w < 6; w++) {
    const weekDate = addWeeks(startDate, w);

    const osCount = overnightSound.length >= 6 ? 6 : Math.max(5, overnightSound.length);
    const os = pickFairest(overnightSound, Math.min(osCount, overnightSound.length), counts, lastOvernightSound);
    const ol = pickFairest(overnightLight, Math.min(CREW_REQUIREMENTS.overnight.light.min, overnightLight.length), counts, lastOvernightLight);
    const ms = pickFairest(morningSound, Math.min(CREW_REQUIREMENTS.morning.sound.min, morningSound.length), counts, lastMorningSound);
    const ml = pickFairest(morningLight, Math.min(CREW_REQUIREMENTS.morning.light.min, morningLight.length), counts, lastMorningLight);

    [...os, ...ol, ...ms, ...ml].forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));

    lastOvernightSound = new Set(os);
    lastOvernightLight = new Set(ol);
    lastMorningSound = new Set(ms);
    lastMorningLight = new Set(ml);

    weeks.push({
      weekNumber: w + 1,
      weekStartDate: format(weekDate, "yyyy-MM-dd"),
      overnightSound: os,
      overnightLight: ol,
      morningSound: ms,
      morningLight: ml,
    });
  }

  return {
    id: crypto.randomUUID(),
    startDate: format(startDate, "yyyy-MM-dd"),
    weeks,
    createdAt: new Date().toISOString(),
  };
}
