import { describe, it, expect } from "vitest";
import { addWeeks, format, startOfDay } from "date-fns";
import { generateSchedule } from "@/lib/scheduler";
import { buildShiftReport } from "@/lib/report";
import { Gender, UnitConfig, Volunteer } from "@/types/schedule";

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

/** Far enough out that every generated week is unlocked. */
const startDate = startOfDay(addWeeks(new Date(), 2));

describe("gender preference", () => {
  it("fills overnight with males first when enough males exist", () => {
    const volunteers = [
      makeVolunteer("m1", "male"),
      makeVolunteer("m2", "male"),
      makeVolunteer("m3", "male"),
      makeVolunteer("m4", "male"),
      makeVolunteer("f1", "female"),
      makeVolunteer("f2", "female"),
      makeVolunteer("f3", "female"),
    ];

    const schedule = generateSchedule(volunteers, [unit], startDate);
    const byId = new Map(volunteers.map((v) => [v.id, v]));

    for (const week of schedule.weeks) {
      const overnight = week.assignments.sound.overnight;
      expect(overnight).toHaveLength(2);
      for (const id of overnight) {
        expect(byId.get(id)?.gender).toBe("male");
      }
    }
  });

  it("fills morning with females first when enough females exist", () => {
    const volunteers = [
      makeVolunteer("m1", "male"),
      makeVolunteer("m2", "male"),
      makeVolunteer("m3", "male"),
      makeVolunteer("f1", "female"),
      makeVolunteer("f2", "female"),
      makeVolunteer("f3", "female"),
    ];

    const schedule = generateSchedule(volunteers, [unit], startDate);
    const byId = new Map(volunteers.map((v) => [v.id, v]));

    for (const week of schedule.weeks) {
      const morning = week.assignments.sound.morning;
      expect(morning).toHaveLength(1);
      expect(byId.get(morning[0])?.gender).toBe("female");
    }
  });

  it("falls back to the other gender rather than leaving a slot empty", () => {
    // Only one male — the second overnight slot must go to a female.
    const volunteers = [
      makeVolunteer("m1", "male"),
      makeVolunteer("f1", "female"),
      makeVolunteer("f2", "female"),
      makeVolunteer("f3", "female"),
    ];

    const schedule = generateSchedule(volunteers, [unit], startDate);

    for (const week of schedule.weeks) {
      expect(week.assignments.sound.overnight).toHaveLength(2);
    }
  });

  it("still schedules volunteers with no gender set", () => {
    const volunteers: Volunteer[] = [
      { id: "a", name: "a", unit: "sound", availability: ["overnight"] },
      { id: "b", name: "b", unit: "sound", availability: ["overnight"] },
      { id: "c", name: "c", unit: "sound", availability: ["morning"] },
    ];

    const schedule = generateSchedule(volunteers, [unit], startDate);

    for (const week of schedule.weeks) {
      expect(week.assignments.sound.overnight).toHaveLength(2);
      expect(week.assignments.sound.morning).toHaveLength(1);
    }
  });
});

describe("buildShiftReport", () => {
  const volunteers = [
    makeVolunteer("m1", "male"),
    makeVolunteer("m2", "male"),
    makeVolunteer("f1", "female"),
  ];

  const schedule = {
    id: "s1",
    startDate: format(startDate, "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
    weeks: [
      {
        weekNumber: 1,
        weekStartDate: format(startDate, "yyyy-MM-dd"),
        assignments: {
          sound: { overnight: ["m1", "m2"], morning: ["f1"] },
        },
      },
      {
        weekNumber: 2,
        weekStartDate: format(addWeeks(startDate, 1), "yyyy-MM-dd"),
        assignments: {
          sound: { overnight: ["m1"], morning: ["f1"] },
        },
      },
    ],
  };

  it("ranks the most overnight and most morning first", () => {
    const report = buildShiftReport(schedule, volunteers);

    expect(report.topOvernight[0].volunteer.id).toBe("m1");
    expect(report.topOvernight[0].overnight).toBe(2);
    expect(report.topOvernight[1].overnight).toBe(1);

    expect(report.topMorning[0].volunteer.id).toBe("f1");
    expect(report.topMorning[0].morning).toBe(2);
  });

  it("counts total slots and excludes people with no shifts", () => {
    const report = buildShiftReport(schedule, [
      ...volunteers,
      makeVolunteer("unused", "male"),
    ]);

    expect(report.totalOvernightSlots).toBe(3);
    expect(report.totalMorningSlots).toBe(2);
    expect(report.tallies.map((t) => t.volunteer.id)).not.toContain("unused");
  });

  it("returns an empty report when there is no schedule", () => {
    const report = buildShiftReport(null, volunteers);
    expect(report.tallies).toEqual([]);
    expect(report.topOvernight).toEqual([]);
  });

  it("counts upcoming weeks as unserved", () => {
    const report = buildShiftReport(schedule, volunteers);
    // Every week in this fixture starts in the future.
    expect(report.topOvernight[0].servedOvernight).toBe(0);
  });
});
