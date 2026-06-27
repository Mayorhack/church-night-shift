import { useState, useEffect, useMemo } from "react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { Moon, Sun } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { getSchedule, getUnits, getVolunteers } from "@/lib/store";
import { Volunteer, Schedule, UnitConfig } from "@/types/schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PublicSchedule() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [units, setUnits] = useState<UnitConfig[]>([]);
  const [selectedVolId, setSelectedVolId] = useState<string>("none");

  useEffect(() => {
    Promise.all([getSchedule(), getVolunteers(), getUnits()])
      .then(([s, v, u]) => {
        setSchedule(s);
        setVolunteers(v);
        setUnits(u);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const volMap = useMemo(() => {
    const m = new Map<string, Volunteer>();
    volunteers.forEach((v) => m.set(v.id, v));
    return m;
  }, [volunteers]);

  const selectedVolSummary = useMemo(() => {
    if (!schedule || selectedVolId === "none") return null;
    const today = startOfDay(new Date());
    let servedOvernight = 0, servedMorning = 0, pendingOvernight = 0, pendingMorning = 0;
    schedule.weeks.forEach((week) => {
      const isPast = isBefore(parseISO(week.weekStartDate), today);
      Object.values(week.assignments).forEach((shifts) => {
        if (shifts.overnight.includes(selectedVolId)) {
          if (isPast) servedOvernight++; else pendingOvernight++;
        }
        if (shifts.morning.includes(selectedVolId)) {
          if (isPast) servedMorning++; else pendingMorning++;
        }
      });
    });
    return { servedOvernight, servedMorning, pendingOvernight, pendingMorning };
  }, [schedule, selectedVolId]);

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
        <div className="flex flex-wrap gap-4 items-start">
          <div className="w-full sm:w-[220px]">
            <label
              htmlFor="name-filter"
              className="text-sm font-medium text-foreground mb-1.5 block"
            >
              Find my shifts
            </label>
            <Select value={selectedVolId} onValueChange={setSelectedVolId}>
              <SelectTrigger id="name-filter" className="w-full">
                <SelectValue placeholder="Select your name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select your name —</SelectItem>
                {volunteers.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[220px]">
            <label
              htmlFor="unit-filter"
              className="text-sm font-medium text-foreground mb-1.5 block"
            >
              Unit Filter
            </label>
            <Select
              value={unitFilter}
              onValueChange={(value) => setUnitFilter(value)}
            >
              <SelectTrigger id="unit-filter" className="w-full">
                <SelectValue placeholder="All units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.name}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedVolSummary && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                {volMap.get(selectedVolId)?.name} — shift summary
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    Served
                  </p>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {selectedVolSummary.servedOvernight}
                      </p>
                      <p className="text-xs text-muted-foreground">Overnight</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {selectedVolSummary.servedMorning}
                      </p>
                      <p className="text-xs text-muted-foreground">Morning</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    Pending
                  </p>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {selectedVolSummary.pendingOvernight}
                      </p>
                      <p className="text-xs text-muted-foreground">Overnight</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {selectedVolSummary.pendingMorning}
                      </p>
                      <p className="text-xs text-muted-foreground">Morning</p>
                    </div>
                  </div>
                </div>
              </div>
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
                      {Object.entries(week.assignments)
                        .filter(
                          ([unitName]) =>
                            unitFilter === "all" || unitName === unitFilter,
                        )
                        .map(([unitName, shifts]) => (
                          <ShiftGroup
                            key={unitName}
                            label={
                              unitName.charAt(0).toUpperCase() +
                              unitName.slice(1)
                            }
                            ids={shifts.overnight}
                            volMap={volMap}
                          />
                        ))}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sun className="h-4 w-4" />
                        Morning Setup
                      </div>
                      {Object.entries(week.assignments)
                        .filter(
                          ([unitName]) =>
                            unitFilter === "all" || unitName === unitFilter,
                        )
                        .map(([unitName, shifts]) => (
                          <ShiftGroup
                            key={unitName}
                            label={
                              unitName.charAt(0).toUpperCase() +
                              unitName.slice(1)
                            }
                            ids={shifts.morning}
                            volMap={volMap}
                          />
                        ))}
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
