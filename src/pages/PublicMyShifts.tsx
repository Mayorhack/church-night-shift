import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { PublicLayout } from "@/components/PublicLayout";
import { getSchedule, getVolunteers } from "@/lib/store";
import { Volunteer, Schedule } from "@/types/schedule";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShiftEntry {
  weekNumber: number;
  weekStartDate: string;
  shift: string;
  type: "overnight" | "morning";
}

export default function PublicMyShifts() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSchedule(), getVolunteers()])
      .then(([s, v]) => {
        setSchedule(s);
        setVolunteers(v);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const shifts = useMemo((): ShiftEntry[] => {
    if (!schedule || !selectedId) return [];
    const entries: ShiftEntry[] = [];
    for (const week of schedule.weeks) {
      for (const [unitName, unitShifts] of Object.entries(week.assignments)) {
        const label = unitName.charAt(0).toUpperCase() + unitName.slice(1);
        if (unitShifts.overnight.includes(selectedId))
          entries.push({
            weekNumber: week.weekNumber,
            weekStartDate: week.weekStartDate,
            shift: `Overnight — ${label}`,
            type: "overnight",
          });
        if (unitShifts.morning.includes(selectedId))
          entries.push({
            weekNumber: week.weekNumber,
            weekStartDate: week.weekStartDate,
            shift: `Morning Setup — ${label}`,
            type: "morning",
          });
      }
    }
    return entries;
  }, [schedule, selectedId]);

  const sortedVolunteers = useMemo(
    () => [...volunteers].sort((a, b) => a.name.localeCompare(b.name)),
    [volunteers],
  );

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Shifts</h2>
          <p className="text-muted-foreground mt-1">
            Select your name to see all your assigned shifts
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <div className="max-w-xs">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your name…" />
                </SelectTrigger>
                <SelectContent>
                  {sortedVolunteers.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      <span className="text-muted-foreground ml-2 text-xs capitalize">
                        ({v.unit})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedId && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {schedule
                    ? "Select your name above to see your shifts."
                    : "No schedule has been published yet. Check back soon."}
                </CardContent>
              </Card>
            )}

            {selectedId && shifts.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  You have no shifts in the current schedule.
                </CardContent>
              </Card>
            )}

            {shifts.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {shifts.length} shift{shifts.length === 1 ? "" : "s"} assigned
                </p>
                {shifts.map((s) => (
                  <Card key={`${s.weekNumber}-${s.shift}`}>
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-sm">
                          Week {s.weekNumber} —{" "}
                          {format(parseISO(s.weekStartDate), "MMMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {s.shift}
                        </p>
                      </div>
                      <Badge
                        variant={
                          s.type === "overnight" ? "default" : "secondary"
                        }
                        className="shrink-0"
                      >
                        {s.type === "overnight" ? "Overnight" : "Morning"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
