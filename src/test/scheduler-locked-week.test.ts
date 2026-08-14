import { describe, it, expect } from "vitest";
import { addWeeks, format, startOfDay, subWeeks } from "date-fns";
import {
  generateSchedule,
  isWeekFrozen,
  redistributeOvernight,
} from "@/lib/scheduler";
import { Gender, Schedule, UnitConfig, Volunteer } from "@/types/schedule";

const unit: UnitConfig = {
  id: "u1",
  name: "sound",
  label: "Sound",
  overnightMin: 2,
  overnightMax: 2,
  morningMin: 1,
  morningMax: 1,
};

function makeVolunteer(name: string, gender: Gender): Volunteer {
  return {
    id: name,
    name,
    unit: "sound",
    gender,
    availability: ["overnight", "morning"],
  };
}

const volunteers = [
  makeVolunteer("m1", "male"),
  makeVolunteer("m2", "male"),
  makeVolunteer("m3", "male"),
  makeVolunteer("m4", "male"),
  makeVolunteer("f1", "female"),
  makeVolunteer("f2", "female"),
  makeVolunteer("f3", "female"),
];

const today = startOfDay(new Date());
const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Eight weeks starting today: week 1 is in progress, weeks 2-8 are ahead. */
function buildSchedule(lockedWeekNumbers: number[] = []): Schedule {
  return {
    id: "sched-lock",
    startDate: iso(today),
    createdAt: "2026-01-01T00:00:00.000Z",
    weeks: Array.from({ length: 8 }, (_, i) => ({
      weekNumber: i + 1,
      weekStartDate: iso(addWeeks(today, i)),
      assignments: { sound: { overnight: ["m1", "m2"], morning: ["f1"] } },
      ...(lockedWeekNumbers.includes(i + 1) ? { locked: true } : {}),
    })),
  };
}

describe("isWeekFrozen", () => {
  it("is true for a week that has started", () => {
    expect(isWeekFrozen({ weekStartDate: iso(subWeeks(today, 1)) })).toBe(true);
  });

  it("is false for an untouched future week", () => {
    expect(isWeekFrozen({ weekStartDate: iso(addWeeks(today, 2)) })).toBe(false);
  });

  it("is true for a future week the owner locked", () => {
    expect(
      isWeekFrozen({ weekStartDate: iso(addWeeks(today, 2)), locked: true }),
    ).toBe(true);
  });
});

describe("locked weeks", () => {
  it("survives a generate untouched, keeping the lock", () => {
    const existing = buildSchedule([3]);
    const result = generateSchedule(volunteers, [unit], today, "all", existing);

    const locked = result.weeks.find(
      (w) => w.weekStartDate === iso(addWeeks(today, 2)),
    );
    expect(locked?.locked).toBe(true);
    expect(locked?.assignments.sound).toEqual({
      overnight: ["m1", "m2"],
      morning: ["f1"],
    });
  });

  it("leaves every other future week free to be regenerated", () => {
    const existing = buildSchedule([3]);
    const result = generateSchedule(volunteers, [unit], today, "all", existing);

    // Everyone starts level except m1/m2/f1, who are already committed to the
    // in-progress week and the locked one, so the first free week goes to the
    // people who are behind.
    const firstFree = result.weeks[1].assignments.sound;
    expect(firstFree.overnight.sort()).toEqual(["m3", "m4"]);
    expect(firstFree.morning).not.toContain("f1");
  });

  it("counts toward the fairness balance even though it is not regenerated", () => {
    const lockedOnly = buildSchedule([3]);
    // Strip assignments everywhere but the locked week, so it is the only
    // source of a head start.
    lockedOnly.weeks = lockedOnly.weeks.map((w) =>
      w.locked
        ? w
        : { ...w, assignments: { sound: { overnight: [], morning: [] } } },
    );

    const result = generateSchedule(
      volunteers,
      [unit],
      today,
      "all",
      lockedOnly,
    );

    // m1/m2 already have the locked week, so the next free week must not be
    // theirs again.
    expect(result.weeks[1].assignments.sound.overnight.sort()).toEqual([
      "m3",
      "m4",
    ]);
  });

  it("is skipped by the overnight redistribution", () => {
    const existing = buildSchedule([3]);
    const result = redistributeOvernight(
      volunteers,
      [unit],
      existing,
      new Set(),
    );

    const locked = result.weeks.find((w) => w.weekNumber === 3);
    expect(locked?.assignments.sound.overnight).toEqual(["m1", "m2"]);
  });

  it("is not cleared when its week number is marked no-overnight", () => {
    const existing = buildSchedule([3]);
    const result = redistributeOvernight(
      volunteers,
      [unit],
      existing,
      new Set([3]),
    );

    const locked = result.weeks.find((w) => w.weekNumber === 3);
    expect(locked?.overnightSkipped).toBeUndefined();
    expect(locked?.assignments.sound.overnight).toEqual(["m1", "m2"]);
  });

  it("keeps its lock through a window roll and renumber", () => {
    // Window starts three weeks back, so weeks 1-3 have finished and drop off.
    const firstWeek = subWeeks(today, 3);
    const existing: Schedule = {
      id: "sched-roll",
      startDate: iso(firstWeek),
      createdAt: "2026-01-01T00:00:00.000Z",
      weeks: Array.from({ length: 8 }, (_, i) => ({
        weekNumber: i + 1,
        weekStartDate: iso(addWeeks(firstWeek, i)),
        assignments: { sound: { overnight: ["m1", "m2"], morning: ["f1"] } },
        ...(i === 5 ? { locked: true } : {}),
      })),
    };
    const lockedDate = iso(addWeeks(today, 2));
    expect(existing.weeks[5].weekStartDate).toBe(lockedDate);

    const result = generateSchedule(volunteers, [unit], today, "all", existing);

    const locked = result.weeks.find((w) => w.weekStartDate === lockedDate);
    expect(locked?.weekNumber).toBe(3);
    expect(locked?.locked).toBe(true);
    expect(locked?.assignments.sound.overnight).toEqual(["m1", "m2"]);
  });
});
