import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Moon, Sun } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { getSchedule, getVolunteers } from "@/lib/store";
import { Volunteer, Schedule } from "@/types/schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PublicSchedule() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
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

  const volMap = useMemo(() => {
    const m = new Map<string, Volunteer>();
    volunteers.forEach((v) => m.set(v.id, v));
    return m;
  }, [volunteers]);

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Full Schedule</h2>
          <p className="text-muted-foreground mt-1">
            Current crew rotation — all weeks
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {!loading && !schedule && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No schedule has been published yet. Check back soon.
            </CardContent>
          </Card>
        )}

        {schedule && (
          <div className="space-y-4">
            {schedule.weeks.map((week) => (
              <Card key={week.weekNumber}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2">
                    <Badge>Week {week.weekNumber}</Badge>
                    <span className="text-muted-foreground font-normal text-sm">
                      {format(parseISO(week.weekStartDate), "EEE, MMM d, yyyy")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Moon className="h-4 w-4" />
                        Overnight
                      </div>
                      {Object.entries(week.assignments).map(
                        ([unitName, shifts]) => (
                          <ShiftGroup
                            key={unitName}
                            label={
                              unitName.charAt(0).toUpperCase() +
                              unitName.slice(1)
                            }
                            ids={shifts.overnight}
                            volMap={volMap}
                          />
                        ),
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sun className="h-4 w-4" />
                        Morning Setup
                      </div>
                      {Object.entries(week.assignments).map(
                        ([unitName, shifts]) => (
                          <ShiftGroup
                            key={unitName}
                            label={
                              unitName.charAt(0).toUpperCase() +
                              unitName.slice(1)
                            }
                            ids={shifts.morning}
                            volMap={volMap}
                          />
                        ),
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

function ShiftGroup({
  label,
  ids,
  volMap,
}: {
  readonly label: string;
  readonly ids: string[];
  readonly volMap: Map<string, Volunteer>;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1">
        {ids.length === 0 ? (
          <span className="text-xs text-destructive">Unassigned</span>
        ) : (
          ids.map((id) => (
            <Badge key={id} variant="secondary" className="text-xs">
              {volMap.get(id)?.name ?? "Unknown"}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
