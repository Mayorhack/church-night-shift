import { describe, it, expect } from "vitest";
import { addWeeks, format, startOfDay, subWeeks } from "date-fns";
import { generateSchedule, seedCounts } from "@/lib/scheduler";
import { buildYearBalance } from "@/lib/report";
import { weeksToServiceRecords } from "@/lib/store";
import {
  Gender,
  Schedule,
  ServiceRecord,
  ShiftType,
  UnitConfig,
  Volunteer,
} from "@/types/schedule";

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

function record(
  volunteerId: string,
  shift: ShiftType,
  weeksAgo: number,
  attended = true,
): ServiceRecord {
  return {
    volunteerId,
    volunteerName: volunteerId,
    weekStartDate: iso(subWeeks(today, weeksAgo)),
    unit: "sound",
    shift,
    attended,
  };
}

describe("seedCounts", () => {
  it("counts overnight and morning separately", () => {
    const counts = seedCounts(
      volunteers,
      [record("m1", "overnight", 3), record("m1", "morning", 2)],
      undefined,
      new Set(),
    );

    expect(counts.overnight.get("m1")).toBe(1);
    expect(counts.morning.get("m1")).toBe(1);
  });

  it("gives no credit for a shift someone missed", () => {
    const counts = seedCounts(
      volunteers,
      [
        record("m1", "overnight", 3),
        record("m1", "overnight", 2, false),
        record("m2", "overnight", 3),
        record("m2", "overnight", 2),
      ],
      undefined,
      new Set(),
    );

    expect(counts.overnight.get("m1")).toBe(1);
    expect(counts.overnight.get("m2")).toBe(2);
  });

  it("falls back to the week's own assignments when history has no row for it", () => {
    const schedule: Schedule = {
      id: "s",
      startDate: iso(subWeeks(today, 1)),
      createdAt: "2026-01-01T00:00:00.000Z",
      weeks: [
        {
          weekNumber: 1,
          weekStartDate: iso(subWeeks(today, 1)),
          assignments: { sound: { overnight: ["m1", "m2"], morning: ["f1"] } },
          absences: { overnight: ["m2"], morning: [] },
        },
      ],
    };

    const counts = seedCounts(volunteers, [], schedule, new Set(["sound"]));

    expect(counts.overnight.get("m1")).toBe(1);
    // Marked absent, so the fallback withholds credit too.
    expect(counts.overnight.get("m2")).toBe(0);
    expect(counts.morning.get("f1")).toBe(1);
  });

  it("does not double count a week that history already covers", () => {
    const weekStart = iso(subWeeks(today, 1));
    const schedule: Schedule = {
      id: "s",
      startDate: weekStart,
      createdAt: "2026-01-01T00:00:00.000Z",
      weeks: [
        {
          weekNumber: 1,
          weekStartDate: weekStart,
          assignments: { sound: { overnight: ["m1"], morning: [] } },
        },
      ],
    };

    const counts = seedCounts(
      volunteers,
      [record("m1", "overnight", 1)],
      schedule,
      new Set(["sound"]),
    );

    expect(counts.overnight.get("m1")).toBe(1);
  });

  it("ignores a future draft for the units about to be regenerated", () => {
    const schedule: Schedule = {
      id: "s",
      startDate: iso(addWeeks(today, 1)),
      createdAt: "2026-01-01T00:00:00.000Z",
      weeks: [
        {
          weekNumber: 1,
          weekStartDate: iso(addWeeks(today, 1)),
          assignments: {
            sound: { overnight: ["m1"], morning: [] },
            light: { overnight: ["m2"], morning: [] },
          },
        },
      ],
    };

    const counts = seedCounts(volunteers, [], schedule, new Set(["sound"]));

    // sound is being rewritten, so its draft does not count against m1...
    expect(counts.overnight.get("m1")).toBe(0);
    // ...but light is being left alone, so that commitment still stands.
    expect(counts.overnight.get("m2")).toBe(1);
  });
});

describe("balancing against service history", () => {
  it("schedules the people who are behind on attended shifts", () => {
    // m1 and m2 have three overnights each; m3 and m4 have none.
    const history = [
      record("m1", "overnight", 4),
      record("m1", "overnight", 3),
      record("m1", "overnight", 2),
      record("m2", "overnight", 4),
      record("m2", "overnight", 3),
      record("m2", "overnight", 2),
    ];

    const result = generateSchedule(
      volunteers,
      [unit],
      addWeeks(today, 1),
      "all",
      undefined,
      new Set(),
      history,
    );

    expect(result.weeks[0].assignments.sound.overnight.sort()).toEqual([
      "m3",
      "m4",
    ]);
  });

  it("puts a no-show back in the rotation rather than crediting them", () => {
    // Both were scheduled three times, but m1 only turned up once.
    const history = [
      record("m1", "overnight", 4),
      record("m1", "overnight", 3, false),
      record("m1", "overnight", 2, false),
      record("m2", "overnight", 4),
      record("m2", "overnight", 3),
      record("m2", "overnight", 2),
      record("m3", "overnight", 4),
      record("m3", "overnight", 3),
      record("m3", "overnight", 2),
      record("m4", "overnight", 4),
      record("m4", "overnight", 3),
      record("m4", "overnight", 2),
    ];

    const result = generateSchedule(
      volunteers,
      [unit],
      addWeeks(today, 1),
      "all",
      undefined,
      new Set(),
      history,
    );

    expect(result.weeks[0].assignments.sound.overnight).toContain("m1");
  });

  it("levels an uneven start out over the eight generated weeks", () => {
    const history = [
      record("m1", "overnight", 4),
      record("m1", "overnight", 3),
      record("m1", "overnight", 2),
      record("m2", "overnight", 4),
    ];

    const result = generateSchedule(
      volunteers,
      [unit],
      addWeeks(today, 1),
      "all",
      undefined,
      new Set(),
      history,
    );

    const totals = new Map<string, number>([
      ["m1", 3],
      ["m2", 1],
      ["m3", 0],
      ["m4", 0],
    ]);
    for (const week of result.weeks) {
      for (const id of week.assignments.sound.overnight) {
        totals.set(id, (totals.get(id) || 0) + 1);
      }
    }

    const counts = [...totals.values()];
    // 4 people, 4 starting shifts + 16 new ones = 5 each if perfectly level.
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe("no back-to-back weeks", () => {
  /** Counts people appearing in the same slot two weeks running. */
  function countRepeats(
    weeks: { assignments: Record<string, { overnight: string[] }> }[],
  ): number {
    let repeats = 0;
    for (let w = 1; w < weeks.length; w++) {
      const prev = new Set(weeks[w - 1].assignments.sound.overnight);
      repeats += weeks[w].assignments.sound.overnight.filter((id) =>
        prev.has(id),
      ).length;
    }
    return repeats;
  }

  /** Six for two slots — the rested pool always has room to spare. */
  const roomyRoster = [
    ...volunteers.filter((v) => v.gender === "male"),
    makeVolunteer("m5", "male"),
    makeVolunteer("m6", "male"),
  ];

  it("never repeats anyone while the rested pool has slack", () => {
    for (let run = 0; run < 50; run++) {
      const result = generateSchedule(roomyRoster, [unit], addWeeks(today, 1));
      expect(countRepeats(result.weeks)).toBe(0);
    }
  });

  it("still avoids repeats when some people start well behind", () => {
    // Four of the six have already served four overnights.
    const history = roomyRoster
      .slice(0, 4)
      .flatMap((v) => [4, 3, 2, 1].map((n) => record(v.id, "overnight", n)));

    for (let run = 0; run < 50; run++) {
      const result = generateSchedule(
        roomyRoster,
        [unit],
        addWeeks(today, 1),
        "all",
        undefined,
        new Set(),
        history,
      );
      expect(countRepeats(result.weeks)).toBe(0);
    }
  });

  it("closes a deficit without ever doubling anyone up", () => {
    const behind = ["m5", "m6"];
    const history = roomyRoster
      .filter((v) => !behind.includes(v.id))
      .flatMap((v) => [4, 3, 2, 1].map((n) => record(v.id, "overnight", n)));

    const result = generateSchedule(
      roomyRoster,
      [unit],
      addWeeks(today, 1),
      "all",
      undefined,
      new Set(),
      history,
    );

    expect(countRepeats(result.weeks)).toBe(0);

    const totals = new Map<string, number>(
      roomyRoster.map((v) => [v.id, behind.includes(v.id) ? 0 : 4]),
    );
    for (const week of result.weeks) {
      for (const id of week.assignments.sound.overnight) {
        totals.set(id, (totals.get(id) || 0) + 1);
      }
    }
    const counts = [...totals.values()];
    // The gap starts at 4; eight weeks of catching up should close most of it.
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });
});

describe("weeksToServiceRecords", () => {
  it("records started weeks only, defaulting everyone to present", () => {
    const weeks = [
      {
        weekNumber: 1,
        weekStartDate: iso(subWeeks(today, 1)),
        assignments: { sound: { overnight: ["m1", "m2"], morning: ["f1"] } },
      },
      {
        weekNumber: 2,
        weekStartDate: iso(addWeeks(today, 1)),
        assignments: { sound: { overnight: ["m3"], morning: ["f2"] } },
      },
    ];

    const records = weeksToServiceRecords(weeks, volunteers);

    expect(records).toHaveLength(3);
    expect(records.every((r) => r.attended)).toBe(true);
    expect(records.map((r) => r.volunteerId).sort()).toEqual([
      "f1",
      "m1",
      "m2",
    ]);
  });

  it("marks the listed absentees as not attended", () => {
    const records = weeksToServiceRecords(
      [
        {
          weekNumber: 1,
          weekStartDate: iso(subWeeks(today, 1)),
          assignments: { sound: { overnight: ["m1", "m2"], morning: ["f1"] } },
          absences: { overnight: ["m2"], morning: [] },
        },
      ],
      volunteers,
    );

    expect(records.find((r) => r.volunteerId === "m1")?.attended).toBe(true);
    expect(records.find((r) => r.volunteerId === "m2")?.attended).toBe(false);
  });
});

describe("buildYearBalance", () => {
  it("ranks the people furthest behind first and ignores no-shows", () => {
    const history = [
      record("m1", "overnight", 4),
      record("m1", "overnight", 3),
      record("m2", "overnight", 4),
      record("m2", "overnight", 3, false),
    ];

    const { overnight } = buildYearBalance(history, volunteers);

    expect(overnight.entries[0].attended).toBe(0);
    const m1 = overnight.entries.find((e) => e.volunteer.id === "m1");
    const m2 = overnight.entries.find((e) => e.volunteer.id === "m2");
    expect(m1?.attended).toBe(2);
    expect(m2?.attended).toBe(1);
    expect(m2?.missed).toBe(1);
    expect(overnight.spread).toBe(2);
  });

  it("leaves out anyone no longer available for the shift", () => {
    const roster = volunteers.map((v) =>
      v.id === "f1" ? { ...v, availability: ["overnight" as ShiftType] } : v,
    );

    const { morning } = buildYearBalance(
      [record("f1", "morning", 2)],
      roster,
    );

    expect(morning.entries.map((e) => e.volunteer.id)).not.toContain("f1");
  });
});
