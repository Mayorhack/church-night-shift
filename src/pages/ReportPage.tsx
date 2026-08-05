import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CloudAdd, DocumentDownload, Calendar as CalendarIcon } from "iconsax-react";
import { AppLayout } from "@/components/AppLayout";
import { ShiftReportCard } from "@/components/ShiftReportCard";
import { Volunteer, Schedule, UnitConfig } from "@/types/schedule";
import { getVolunteers, getSchedule, getUnits } from "@/lib/store";
import { buildShiftReport } from "@/lib/report";
import { downloadJSON, downloadShiftReportPDF } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function ReportPage() {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [units, setUnits] = useState<UnitConfig[]>([]);
  const [unitFilter, setUnitFilter] = useState<string>("all");

  useEffect(() => {
    getVolunteers().then(setVolunteers).catch(console.error);
    getSchedule().then(setSchedule).catch(console.error);
    getUnits().then(setUnits).catch(console.error);
  }, []);

  const report = useMemo(
    () => buildShiftReport(schedule, volunteers, unitFilter),
    [schedule, volunteers, unitFilter],
  );

  const unitLabel =
    unitFilter === "all"
      ? "All units"
      : (units.find((u) => u.name === unitFilter)?.label ?? unitFilter);

  const handleDownloadPDF = () => {
    if (!schedule) return;
    const filename = `shift-report-${format(parseISO(schedule.startDate), "yyyy-MM-dd")}.pdf`;
    downloadShiftReportPDF(report, filename, unitLabel);
    toast.success("Shift report PDF downloaded!");
  };

  const handleDownloadJSON = () => {
    if (!schedule) return;
    const data = {
      scheduleStartDate: schedule.startDate,
      unit: unitLabel,
      totalOvernightSlots: report.totalOvernightSlots,
      totalMorningSlots: report.totalMorningSlots,
      mostOvernight: report.topOvernight.map((t) => ({
        name: t.volunteer.name,
        unit: t.volunteer.unit,
        gender: t.volunteer.gender ?? null,
        overnight: t.overnight,
        served: t.servedOvernight,
      })),
      mostMorning: report.topMorning.map((t) => ({
        name: t.volunteer.name,
        unit: t.volunteer.unit,
        gender: t.volunteer.gender ?? null,
        morning: t.morning,
        served: t.servedMorning,
      })),
    };
    const filename = `shift-report-${format(parseISO(schedule.startDate), "yyyy-MM-dd")}.json`;
    downloadJSON(data, filename);
    toast.success("Shift report downloaded!");
  };

  const hasReport = schedule !== null && report.tallies.length > 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Shift Report</h2>
            <p className="text-muted-foreground mt-1">
              Who is carrying the most overnight and morning shifts
              {schedule
                ? ` — schedule starting ${format(parseISO(schedule.startDate), "MMM d, yyyy")}`
                : ""}
            </p>
          </div>
          {hasReport && (
            <div className="flex flex-wrap gap-2">
              <Button variant="default" onClick={handleDownloadPDF}>
                <DocumentDownload className="h-4 w-4" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={handleDownloadJSON}>
                <CloudAdd className="h-4 w-4" />
                Download JSON
              </Button>
            </div>
          )}
        </div>

        <div className="w-full sm:w-[220px]">
          <label
            htmlFor="report-unit-filter"
            className="text-sm font-medium text-foreground mb-1.5 block"
          >
            Filter by unit
          </label>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger id="report-unit-filter" className="w-full">
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

        {hasReport ? (
          <ShiftReportCard report={report} />
        ) : (
          <Card>
            <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
              <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>
                {schedule
                  ? "No assignments found for this unit."
                  : "No schedule generated yet. Create a schedule to see the report."}
              </p>
              {!schedule && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/schedule")}
                >
                  Go to Schedule
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
