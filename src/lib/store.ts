import { Volunteer, Schedule } from "@/types/schedule";

const VOLUNTEERS_KEY = "church-scheduler-volunteers";
const SCHEDULE_KEY = "church-scheduler-schedule";

export function getVolunteers(): Volunteer[] {
  const data = localStorage.getItem(VOLUNTEERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveVolunteers(volunteers: Volunteer[]) {
  localStorage.setItem(VOLUNTEERS_KEY, JSON.stringify(volunteers));
}

export function getSchedule(): Schedule | null {
  const data = localStorage.getItem(SCHEDULE_KEY);
  return data ? JSON.parse(data) : null;
}

export function saveSchedule(schedule: Schedule) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

export function clearSchedule() {
  localStorage.removeItem(SCHEDULE_KEY);
}
