import { describe, it, expect } from "vitest";
import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  subDays,
  subWeeks,
} from "date-fns";
import { generateSchedule, hasWeekEnded } from "@/lib/scheduler";
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

/**
 * Eight weeks starting three weeks ago: weeks 1-3 are finished, week 4 is the
 * one in progress, weeks 5-8 are still ahead.
 */
function buildStaleSchedule(
  fill: (weekIndex: number) => { overnight: string[]; morning: string[] },
): Schedule {
  const firstWeek = subWeeks(today, 3);
  return {
    id: "sched-1",
    startDate: iso(firstWeek),
    createdAt: "2026-01-01T00:00:00.000Z",
    weeks: Array.from({ length: 8 }, (_, i) => ({
      weekNumber: i + 1,
      weekStartDate: iso(addWeeks(firstWeek, i)),
      assignments: { sound: fill(i) },
    })),
  };
}

const noAssignments = () => ({ overnight: [], morning: [] });

describe("hasWeekEnded", () => {
  it("is false on the week's last day", () => {
    expect(hasWeekEnded(subDays(today, 6))).toBe(false);
  });

  it("is true the day after the week's last day", () => {
    expect(hasWeekEnded(subDays(today, 7))).toBe(true);
  });

  it("is false for the week that started today", () => {
    expect(hasWeekEnded(today)).toBe(false);
  });

  it("accepts an ISO date string", () => {
    expect(hasWeekEnded(iso(subWeeks(today, 4)))).toBe(true);
    expect(hasWeekEnded(iso(addWeeks(today, 1)))).toBe(false);
  });
});

describe("rolling 8-week window", () => {
  it("drops finished weeks and appends new ones to keep eight", () => {
    const existing = buildStaleSchedule(noAssignments);
    const result = generateSchedule(
      volunteers,
      [unit],
      today,
      "all",
      existing,
    );

    expect(result.weeks).toHaveLength(8);
    // Three finished weeks fell off, so the window now opens on the week in
    // progress and runs seven weeks past it.
    expect(result.weeks[0].weekStartDate).toBe(iso(today));
    expect(result.weeks[7].weekStartDate).toBe(iso(addWeeks(today, 7)));
    expect(result.startDate).toBe(iso(today));
  });

  it("renumbers the surviving weeks from one and keeps dates contiguous", () => {
    const existing = buildStaleSchedule(noAssignments);
    const result = generateSchedule(volunteers, [unit], today, "all", existing);

    expect(result.weeks.map((w) => w.weekNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    for (let i = 1; i < result.weeks.length; i++) {
      const gap = differenceInCalendarDays(
        parseISO(result.weeks[i].weekStartDate),
        parseISO(result.weeks[i - 1].weekStartDate),
      );
      expect(gap).toBe(7);
    }
  });

  it("keeps the in-progress week's assignments untouched as it moves to slot 1", () => {
    const existing = buildStaleSchedule((i) =>
      i === 3
        ? { overnight: ["m1", "m2"], morning: ["f1"] }
        : { overnight: [], morning: [] },
    );
    const result = generateSchedule(volunteers, [unit], today, "all", existing);

    expect(result.weeks[0].weekStartDate).toBe(iso(today));
    expect(result.weeks[0].assignments.sound).toEqual({
      overnight: ["m1", "m2"],
      morning: ["f1"],
    });
  });

  it("still counts dropped weeks toward fairness before discarding them", () => {
    // Only the three finished weeks carry assignments, so m1/m2/f1 enter this
    // generate with a three-week head start on everyone else.
    const existing = buildStaleSchedule((i) =>
      i < 3
        ? { overnight: ["m1", "m2"], morning: ["f1"] }
        : { overnight: [], morning: [] },
    );
    const result = generateSchedule(volunteers, [unit], today, "all", existing);

    // Week 1 is the locked in-progress week; week 2 is the first regenerated one.
    const firstFresh = result.weeks[1].assignments.sound;
    expect(firstFresh.overnight.sort()).toEqual(["m3", "m4"]);
    expect(firstFresh.morning).not.toContain("f1");
  });

  it("keeps skipped-overnight weeks attached to their week after renumbering", () => {
    const existing = buildStaleSchedule(() => ({
      overnight: ["m1", "m2"],
      morning: ["f1"],
    }));
    // Week 6 of the old numbering starts two weeks from now.
    const skippedDate = iso(addWeeks(today, 2));
    expect(existing.weeks[5].weekStartDate).toBe(skippedDate);

    const result = generateSchedule(
      volunteers,
      [unit],
      today,
      "all",
      existing,
      new Set([6]),
    );

    const skipped = result.weeks.find(
      (w) => w.weekStartDate === skippedDate,
    );
    expect(skipped?.weekNumber).toBe(3);
    expect(skipped?.overnightSkipped).toBe(true);
    expect(skipped?.assignments.sound.overnight).toEqual([]);
    expect(
      result.weeks.filter((w) => w.overnightSkipped).map((w) => w.weekNumber),
    ).toEqual([3]);
  });

  it("leaves the window alone when no week has finished", () => {
    const firstWeek = addWeeks(today, 1);
    const existing: Schedule = {
      id: "sched-2",
      startDate: iso(firstWeek),
      createdAt: "2026-01-01T00:00:00.000Z",
      weeks: Array.from({ length: 8 }, (_, i) => ({
        weekNumber: i + 1,
        weekStartDate: iso(addWeeks(firstWeek, i)),
        assignments: { sound: { overnight: [], morning: [] } },
      })),
    };

    const result = generateSchedule(volunteers, [unit], today, "all", existing);

    expect(result.weeks.map((w) => w.weekStartDate)).toEqual(
      existing.weeks.map((w) => w.weekStartDate),
    );
  });

  it("falls back to the picked start date when every week has finished", () => {
    const firstWeek = subWeeks(today, 20);
    const existing: Schedule = {
      id: "sched-3",
      startDate: iso(firstWeek),
      createdAt: "2026-01-01T00:00:00.000Z",
      weeks: Array.from({ length: 8 }, (_, i) => ({
        weekNumber: i + 1,
        weekStartDate: iso(addWeeks(firstWeek, i)),
        assignments: { sound: { overnight: [], morning: [] } },
      })),
    };
    const pickedStart = addDays(today, 3);

    const result = generateSchedule(
      volunteers,
      [unit],
      pickedStart,
      "all",
      existing,
    );

    expect(result.weeks[0].weekStartDate).toBe(iso(pickedStart));
    expect(result.startDate).toBe(iso(pickedStart));
    // Same row is overwritten rather than a second schedule being created.
    expect(result.id).toBe("sched-3");
  });

  it("uses the picked start date when there is no existing schedule", () => {
    const pickedStart = addWeeks(today, 2);
    const result = generateSchedule(volunteers, [unit], pickedStart);

    expect(result.weeks).toHaveLength(8);
    expect(result.weeks[0].weekStartDate).toBe(iso(pickedStart));
    expect(result.startDate).toBe(iso(pickedStart));
  });
});
