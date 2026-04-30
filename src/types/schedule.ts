export type ShiftType = "overnight" | "morning";

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
  availability: ShiftType[];
}

export interface WeekAssignment {
  weekNumber: number;
  weekStartDate: string; // ISO date string
  /** Keyed by unit name slug (e.g. "sound", "light"). Values hold the IDs assigned to each shift. */
  assignments: Record<string, { overnight: string[]; morning: string[] }>;
}

export interface Schedule {
  id: string;
  startDate: string;
  weeks: WeekAssignment[];
  createdAt: string;
}
