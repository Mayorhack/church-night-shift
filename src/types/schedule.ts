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
}

export interface Schedule {
  id: string;
  startDate: string;
  weeks: WeekAssignment[];
  createdAt: string;
}
