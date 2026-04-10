export type Unit = "sound" | "light";
export type ShiftType = "overnight" | "morning";

export interface Volunteer {
  id: string;
  name: string;
  unit: Unit;
  availability: ShiftType[]; // which shifts they can do
}

export interface WeekAssignment {
  weekNumber: number;
  weekStartDate: string; // ISO date string
  overnightSound: string[]; // volunteer IDs
  overnightLight: string[]; // volunteer IDs
  morningSound: string[]; // volunteer IDs
  morningLight: string[]; // volunteer IDs
}

export interface Schedule {
  id: string;
  startDate: string;
  weeks: WeekAssignment[];
  createdAt: string;
}

export const CREW_REQUIREMENTS = {
  overnight: { sound: { min: 5, max: 6 }, light: { min: 2, max: 2 } },
  morning: { sound: { min: 2, max: 2 }, light: { min: 1, max: 1 } },
} as const;
