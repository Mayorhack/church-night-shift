import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { getVolunteers, getSchedule } from "@/lib/store";
import { Volunteer, Schedule } from "@/types/schedule";
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
import { Button } from "@/components/ui/button";
import { CloudAdd, DocumentDownload, UserSquare } from "iconsax-react";
import { downloadJSON, downloadVolunteerSchedulePDF } from "@/lib/download";
import { toast } from "sonner";

interface VolunteerStats {
  volunteer: Volunteer;
  overnightShifts: number;
  morningShifts: number;
  totalShifts: number;
  assignments: {
    weekNumber: number;
    shift: string;
    type: "overnight" | "morning";
    unit: string;
  }[];
}

export default function VolunteerSchedulePage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [stats, setStats] = useState<VolunteerStats[]>([]);

  useEffect(() => {
    getVolunteers().then(setVolunteers).catch(console.error);
    getSchedule().then(setSchedule).catch(console.error);
  }, []);

  useMemo(() => {
    if (!schedule) {
      setStats([]);
      return;
    }

    const volunteerStats = volunteers.map((vol) => {
      const assignments: VolunteerStats["assignments"] = [];
      let overnightCount = 0;
      let morningCount = 0;

      schedule.weeks.forEach((week) => {
        Object.entries(week.assignments).forEach(([unitName, unitShifts]) => {
          const label = unitName.charAt(0).toUpperCase() + unitName.slice(1);
          if (unitShifts.overnight.includes(vol.id)) {
            assignments.push({
              weekNumber: week.weekNumber,
              shift: `Overnight ${label}`,
              type: "overnight",
              unit: unitName,
            });
            overnightCount++;
          }
          if (unitShifts.morning.includes(vol.id)) {
            assignments.push({
              weekNumber: week.weekNumber,
              shift: `Morning ${label}`,
              type: "morning",
              unit: unitName,
            });
            morningCount++;
          }
        });
      });

      return {
        volunteer: vol,
        overnightShifts: overnightCount,
        morningShifts: morningCount,
        totalShifts: overnightCount + morningCount,
        assignments: assignments.sort((a, b) => a.weekNumber - b.weekNumber),
      };
    });

    setStats(volunteerStats.filter((s) => s.totalShifts > 0));
  }, [volunteers, schedule]);

  const handleDownload = () => {
    if (!schedule || stats.length === 0) return;
    const data = stats.map((stat) => ({
      volunteer: stat.volunteer.name,
      unit: stat.volunteer.unit,
      overnightShifts: stat.overnightShifts,
      morningShifts: stat.morningShifts,
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
      overnightShifts: stat.overnightShifts,
      morningShifts: stat.morningShifts,
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

        {stats.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <UserSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>
                No schedule generated yet. Create a schedule to see volunteer
                assignments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {stats.map((stat) => (
              <Card key={stat.volunteer.id}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
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
                    <div className="flex gap-4 sm:text-right">
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {stat.overnightShifts}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Overnight
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-accent">
                          {stat.morningShifts}
                        </p>
                        <p className="text-xs text-muted-foreground">Morning</p>
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
                          <TableHead>Shift Type</TableHead>
                          <TableHead>Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stat.assignments.map((assignment, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              Week {assignment.weekNumber}
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
                            <TableCell>
                              <span className="capitalize">
                                {assignment.unit}
                              </span>
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
