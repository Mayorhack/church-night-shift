import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon,
  CloudAdd,
  DocumentDownload,
  Eye,
  Refresh,
  Trash,
} from "iconsax-react";
import { AppLayout } from "@/components/AppLayout";
import {
  Volunteer,
  Schedule,
  WeekAssignment,
  UnitConfig,
} from "@/types/schedule";
import {
  getVolunteers,
  getSchedule,
  saveSchedule,
  clearSchedule,
  getUnits,
} from "@/lib/store";
import { generateSchedule } from "@/lib/scheduler";
import { downloadJSON, downloadSchedulePDF } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SchedulePage() {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [units, setUnits] = useState<UnitConfig[]>([]);

  useEffect(() => {
    getVolunteers().then(setVolunteers).catch(console.error);
    getSchedule().then(setSchedule).catch(console.error);
    getUnits().then(setUnits).catch(console.error);
  }, []);

  const volMap = useMemo(() => {
    const m = new Map<string, Volunteer>();
    volunteers.forEach((v) => m.set(v.id, v));
    return m;
  }, [volunteers]);

  // True when a schedule was saved under the old field-per-unit format
  const isLegacySchedule =
    schedule !== null &&
    schedule.weeks.length > 0 &&
    !schedule.weeks[0].assignments;

  const handleGenerate = async () => {
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }
    if (volunteers.length === 0) {
      toast.error("Add volunteers to the roster first");
      return;
    }
    const s = generateSchedule(volunteers, units, startDate);
    try {
      await saveSchedule(s);
      setSchedule(s);
      toast.success("Schedule generated!");
    } catch {
      toast.error("Failed to save schedule");
    }
  };

  const handleClear = async () => {
    try {
      await clearSchedule();
      setSchedule(null);
      toast.success("Schedule cleared");
    } catch {
      toast.error("Failed to clear schedule");
    }
  };

  const handleDownload = () => {
    if (!schedule) return;
    const filename = `schedule-${format(parseISO(schedule.startDate), "yyyy-MM-dd")}.json`;
    downloadJSON(schedule, filename);
    toast.success("Schedule downloaded!");
  };

  const handleDownloadPDF = () => {
    if (!schedule) return;
    const filename = `schedule-${format(parseISO(schedule.startDate), "yyyy-MM-dd")}.pdf`;
    downloadSchedulePDF(schedule, volMap, filename);
    toast.success("Schedule PDF downloaded!");
  };

  const handleSwap = async (
    weekIdx: number,
    slot: string,
    memberIdx: number,
    newVolunteerId: string,
  ) => {
    if (!schedule) return;

    const [unitName, shift] = slot.split(":") as [
      string,
      "overnight" | "morning",
    ];
    const week = schedule.weeks[weekIdx];
    const oppShift = shift === "overnight" ? "morning" : "overnight";

    // Check if volunteer is already in the opposite shift type this week
    const inOpp = Object.values(week.assignments ?? {}).some((a) =>
      a[oppShift].includes(newVolunteerId),
    );
    if (inOpp) {
      toast.error(
        shift === "overnight"
          ? "Volunteer is already scheduled for morning shift this week"
          : "Volunteer is already scheduled for overnight shift this week",
      );
      return;
    }

    const updated = {
      ...schedule,
      weeks: schedule.weeks.map((w, i) => {
        if (i !== weekIdx) return w;
        const arr = [...(w.assignments?.[unitName]?.[shift] ?? [])];
        arr[memberIdx] = newVolunteerId;
        const existingUnit = w.assignments?.[unitName] ?? {
          overnight: [] as string[],
          morning: [] as string[],
        };
        return {
          ...w,
          assignments: {
            ...(w.assignments as Record<
              string,
              { overnight: string[]; morning: string[] }
            >),
            [unitName]: { ...existingUnit, [shift]: arr },
          },
        };
      }),
    };
    try {
      await saveSchedule(updated);
      setSchedule(updated);
      toast.success("Assignment updated");
    } catch {
      toast.error("Failed to save assignment");
    }
  };

  const getSlotCandidates = (
    slot: string,
    week: WeekAssignment,
  ): Volunteer[] => {
    const [unitName, shift] = slot.split(":") as [
      string,
      "overnight" | "morning",
    ];
    const oppShift = shift === "overnight" ? "morning" : "overnight";
    const oppIds = new Set(
      Object.values(week.assignments ?? {}).flatMap((a) => a[oppShift]),
    );
    return volunteers.filter(
      (v) =>
        v.unit === unitName &&
        v.availability.includes(shift) &&
        !oppIds.has(v.id),
    );
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Schedule</h2>
              <p className="text-muted-foreground mt-1">
                Generate and manage the 6-week rotation
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/public/schedule")}
              className="self-start sm:self-auto"
            >
              <Eye className="h-4 w-4" />
              View Public Schedule
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[220px]">
                <label
                  htmlFor="start-date-picker"
                  className="text-sm font-medium text-foreground mb-1.5 block"
                >
                  Start Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="start-date-picker"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {startDate
                        ? format(startDate, "PPP")
                        : "Pick a start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleGenerate}>
                <Refresh className="h-4 w-4" />
                Generate Schedule
              </Button>
              {schedule && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    className="text-destructive"
                  >
                    <Trash className="h-4 w-4" />
                    Clear
                  </Button>
                  <Button variant="default" onClick={handleDownloadPDF}>
                    <DocumentDownload className="h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={handleDownload}>
                    <CloudAdd className="h-4 w-4" />
                    Download JSON
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {isLegacySchedule && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4 pb-4 text-sm text-destructive">
              The saved schedule was generated with an older format and is no
              longer compatible. Please pick a start date and click{" "}
              <strong>Generate Schedule</strong> to create a new one.
            </CardContent>
          </Card>
        )}

        {schedule && !isLegacySchedule && (
          <div className="space-y-4">
            {schedule.weeks.map((week) => (
              <WeekCard
                key={week.weekNumber}
                week={week}
                volMap={volMap}
                unitConfigs={units}
                onSwap={handleSwap}
                getCandidates={getSlotCandidates}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

type WeekCardProps = {
  readonly week: WeekAssignment;
  readonly volMap: ReadonlyMap<string, Volunteer>;
  readonly unitConfigs: UnitConfig[];
  readonly onSwap: (
    weekIdx: number,
    slot: string,
    memberIdx: number,
    newId: string,
  ) => void;
  readonly getCandidates: (slot: string, week: WeekAssignment) => Volunteer[];
};

function WeekCard({
  week,
  volMap,
  unitConfigs,
  onSwap,
  getCandidates,
}: WeekCardProps) {
  const slots = [
    ...unitConfigs.map((u) => ({
      label: `Overnight ${u.label}`,
      key: `${u.name}:overnight`,
      assigned: week.assignments?.[u.name]?.overnight ?? [],
      required: { min: u.overnightMin, max: u.overnightMax },
    })),
    ...unitConfigs.map((u) => ({
      label: `Morning ${u.label}`,
      key: `${u.name}:morning`,
      assigned: week.assignments?.[u.name]?.morning ?? [],
      required: { min: u.morningMin, max: u.morningMax },
    })),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <Badge className="bg-primary text-primary-foreground">
            Week {week.weekNumber}
          </Badge>
          <span className="text-muted-foreground font-normal text-sm">
            {format(parseISO(week.weekStartDate), "EEE, MMM d, yyyy")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map(({ label, key, assigned, required }) => {
            const isFull = assigned.length >= required.min;
            const candidates = getCandidates(key, week);
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{label}</span>
                  <Badge
                    variant={isFull ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {assigned.length}/{required.min}
                    {required.max > required.min ? `-${required.max}` : ""}
                  </Badge>
                </div>
                {assigned.map((id: string, memberIdx: number) => (
                  <Select
                    key={`${week.weekNumber}-${key}-${id}`}
                    value={id}
                    onValueChange={(v) =>
                      onSwap(week.weekNumber - 1, key, memberIdx, v)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        {volMap.get(id)?.name || "Unknown"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
                {assigned.length === 0 && (
                  <p className="text-xs text-destructive">No one assigned</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
