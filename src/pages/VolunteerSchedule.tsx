import { useState, useEffect, useMemo } from "react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { getVolunteers, getSchedule, getUnits } from "@/lib/store";
import { Volunteer, Schedule, UnitConfig } from "@/types/schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CloudAdd, DocumentDownload, UserSquare } from "iconsax-react";
import { downloadJSON, downloadVolunteerSchedulePDF } from "@/lib/download";
import { toast } from "sonner";

interface VolunteerStats {
  volunteer: Volunteer;
  servedOvernight: number;
  servedMorning: number;
  pendingOvernight: number;
  pendingMorning: number;
  totalShifts: number;
  assignments: {
    weekNumber: number;
    weekStartDate: string;
    shift: string;
    type: "overnight" | "morning";
    unit: string;
    isPast: boolean;
  }[];
}

export default function VolunteerSchedulePage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [units, setUnits] = useState<UnitConfig[]>([]);
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [stats, setStats] = useState<VolunteerStats[]>([]);

  useEffect(() => {
    getVolunteers().then(setVolunteers).catch(console.error);
    getSchedule().then(setSchedule).catch(console.error);
    getUnits().then(setUnits).catch(console.error);
  }, []);

  useMemo(() => {
    if (!schedule) {
      setStats([]);
      return;
    }

    const today = startOfDay(new Date());

    const volunteerStats = volunteers.map((vol) => {
      const assignments: VolunteerStats["assignments"] = [];
      let servedOvernight = 0, servedMorning = 0, pendingOvernight = 0, pendingMorning = 0;

      schedule.weeks.forEach((week) => {
        const isPast = isBefore(parseISO(week.weekStartDate), today);
        Object.entries(week.assignments).forEach(([unitName, unitShifts]) => {
          const label = unitName.charAt(0).toUpperCase() + unitName.slice(1);
          if (unitShifts.overnight.includes(vol.id)) {
            assignments.push({
              weekNumber: week.weekNumber,
              weekStartDate: week.weekStartDate,
              shift: `Overnight ${label}`,
              type: "overnight",
              unit: unitName,
              isPast,
            });
            if (isPast) servedOvernight++; else pendingOvernight++;
          }
          if (unitShifts.morning.includes(vol.id)) {
            assignments.push({
              weekNumber: week.weekNumber,
              weekStartDate: week.weekStartDate,
              shift: `Morning ${label}`,
              type: "morning",
              unit: unitName,
              isPast,
            });
            if (isPast) servedMorning++; else pendingMorning++;
          }
        });
      });

      const totalShifts = servedOvernight + servedMorning + pendingOvernight + pendingMorning;
      return {
        volunteer: vol,
        servedOvernight,
        servedMorning,
        pendingOvernight,
        pendingMorning,
        totalShifts,
        assignments: assignments.sort((a, b) => a.weekNumber - b.weekNumber),
      };
    });

    setStats(volunteerStats.filter((s) => s.totalShifts > 0));
  }, [volunteers, schedule]);

  const filteredStats = useMemo(
    () =>
      unitFilter === "all"
        ? stats
        : stats.filter((s) => s.volunteer.unit === unitFilter),
    [stats, unitFilter],
  );

  const handleDownload = () => {
    if (!schedule || stats.length === 0) return;
    const data = stats.map((stat) => ({
      volunteer: stat.volunteer.name,
      unit: stat.volunteer.unit,
      servedOvernight: stat.servedOvernight,
      servedMorning: stat.servedMorning,
      pendingOvernight: stat.pendingOvernight,
      pendingMorning: stat.pendingMorning,
      totalShifts: stat.totalShifts,
      assignments: stat.assignments,
    }));
    const filename = `volunteer-schedule-${format(parseISO(schedule.startDate), "yyyy-MM-dd")}.json`;
    downloadJSON(data, filename);
    toast.success("Volunteer schedule downloaded!");
  };

  const handleDownloadPDF = () => {
    if (!schedule || stats.length === 0) return;
    const data = stats.map((stat) => ({
      volunteer: stat.volunteer.name,
      unit: stat.volunteer.unit,
      overnightShifts: stat.servedOvernight + stat.pendingOvernight,
      morningShifts: stat.servedMorning + stat.pendingMorning,
      totalShifts: stat.totalShifts,
      assignments: stat.assignments,
    }));
    const filename = `volunteer-schedule-${format(parseISO(schedule.startDate), "yyyy-MM-dd")}.pdf`;
    downloadVolunteerSchedulePDF(data, filename);
    toast.success("Volunteer schedule PDF downloaded!");
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Volunteer Schedules
            </h2>
            <p className="text-muted-foreground mt-1">
              Individual shift assignments and statistics
            </p>
          </div>
          {schedule && stats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadPDF} variant="default">
                <DocumentDownload className="h-4 w-4" />
                Download PDF
              </Button>
              <Button onClick={handleDownload} variant="outline">
                <CloudAdd className="h-4 w-4" />
                Download JSON
              </Button>
            </div>
          )}
        </div>

        <div className="w-full sm:w-[220px]">
          <label
            htmlFor="unit-filter"
            className="text-sm font-medium text-foreground mb-1.5 block"
          >
            Filter by unit
          </label>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
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

        {filteredStats.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <UserSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>
                {stats.length === 0
                  ? "No schedule generated yet. Create a schedule to see volunteer assignments."
                  : "No volunteers found for this unit."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredStats.map((stat) => (
              <Card key={stat.volunteer.id}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        {stat.volunteer.name}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {stat.volunteer.unit}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Total: {stat.totalShifts}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                          Served
                        </p>
                        <div className="flex gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-foreground">
                              {stat.servedOvernight}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Overnight
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-foreground">
                              {stat.servedMorning}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Morning
                            </p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                          Pending
                        </p>
                        <div className="flex gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                              {stat.pendingOvernight}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Overnight
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                              {stat.pendingMorning}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Morning
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Week</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Shift</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stat.assignments.map((assignment, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              Week {assignment.weekNumber}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(
                                parseISO(assignment.weekStartDate),
                                "EEE, MMM d",
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  assignment.type === "overnight"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {assignment.type === "overnight"
                                  ? "🌙 Overnight"
                                  : "☀️ Morning"}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">
                              {assignment.unit}
                            </TableCell>
                            <TableCell>
                              {assignment.isPast ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-green-700 border-green-400 bg-green-50 dark:bg-green-950 dark:text-green-300"
                                >
                                  Served
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-950 dark:text-amber-300"
                                >
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
