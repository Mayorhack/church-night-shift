export type ShiftType = "overnight" | "morning";

export type Gender = "male" | "female";

/** Gender the scheduler fills each shift with first. */
export const PREFERRED_GENDER: Record<ShiftType, Gender> = {
  overnight: "male",
  morning: "female",
};

export interface InactivePeriod {
  from: string; // ISO date string "yyyy-MM-dd"
  to: string; // ISO date string "yyyy-MM-dd"
}

export interface UnitConfig {
  id: string;
  name: string; // slug stored in volunteer.unit
  label: string; // display name
  overnightMin: number;
  overnightMax: number;
  morningMin: number;
  morningMax: number;
}

export interface Volunteer {
  id: string;
  name: string;
  unit: string;
  /** Optional — members added before gender tracking may not have one set. */
  gender?: Gender;
  availability: ShiftType[];
  inactivePeriods?: InactivePeriod[];
}

export interface WeekAssignment {
  weekNumber: number;
  weekStartDate: string; // ISO date string
  /** Keyed by unit name slug (e.g. "sound", "light"). Values hold the IDs assigned to each shift. */
  assignments: Record<string, { overnight: string[]; morning: string[] }>;
  /** True when overnight was intentionally skipped for this week — volunteers redistribute to other weeks. */
  overnightSkipped?: boolean;
  /**
   * Pinned by the owner: generate and redistribute leave this week exactly as
   * it is, even though it has not started yet. Weeks that have started are
   * frozen regardless — see `isWeekFrozen`.
   */
  locked?: boolean;
  /**
   * IDs that were scheduled but did not turn up. Everyone assigned and not
   * listed here is treated as present, so an absent field means full turnout.
   * Only attended shifts count toward the fairness balance.
   */
  absences?: { overnight: string[]; morning: string[] };
  /** True once the owner has reviewed turnout for this week. */
  attendanceConfirmed?: boolean;
}

/**
 * One person, one week, one shift — the durable record behind the yearly
 * balance. Lives in the `service_history` table rather than the schedule,
 * so it survives the 8-week window rolling forward.
 */
export interface ServiceRecord {
  volunteerId: string;
  volunteerName: string;
  weekStartDate: string;
  unit: string;
  shift: ShiftType;
  attended: boolean;
}

export interface Schedule {
  id: string;
  startDate: string;
  weeks: WeekAssignment[];
  createdAt: string;
}
