import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon,
  Chart2,
  CloudAdd,
  DocumentDownload,
  Eye,
  Moon,
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
import {
  generateSchedule,
  redistributeOvernight,
  isWeekLocked,
} from "@/lib/scheduler";
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
import { useAuth } from "@/contexts/AuthContext";

export default function SchedulePage() {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [units, setUnits] = useState<UnitConfig[]>([]);
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [skippedOvernightWeeks, setSkippedOvernightWeeks] = useState<
    Set<number>
  >(new Set());

  useEffect(() => {
    getVolunteers().then(setVolunteers).catch(console.error);
    getUnits().then(setUnits).catch(console.error);
    getSchedule()
      .then((s) => {
        setSchedule(s);
        if (s) {
          setSkippedOvernightWeeks(
            new Set(
              s.weeks
                .filter((w) => w.overnightSkipped)
                .map((w) => w.weekNumber),
            ),
          );
        }
      })
      .catch(console.error);
  }, []);

  const toggleSkipWeek = (weekNum: number) => {
    setSkippedOvernightWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNum)) next.delete(weekNum);
      else next.add(weekNum);
      return next;
    });
  };

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
    if (!isOwner) {
      toast.error("Only the schedule owner can generate or update a schedule");
      return;
    }
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }

    if (volunteers.length === 0) {
      toast.error("Add volunteers to the roster first");
      return;
    }
    const s = generateSchedule(
      volunteers,
      units,
      startDate,
      unitFilter,
      schedule ?? undefined,
      skippedOvernightWeeks,
    );
    try {
      await saveSchedule(s);
      setSchedule(s);
      toast.success(
        "Schedule generated for " + unitFilter === "all"
          ? "all units"
          : units.find((u) => u.name === unitFilter)?.label,
      );
    } catch {
      toast.error("Failed to save schedule");
    }
  };

  const handleClear = async () => {
    if (!isOwner) {
      toast.error("Only the schedule owner can clear the schedule");
      return;
    }
    try {
      await clearSchedule();
      setSchedule(null);
      toast.success("Schedule cleared");
    } catch {
      toast.error("Failed to clear schedule");
    }
  };

  const handleSaveOvernightChanges = async () => {
    if (!isOwner) {
      toast.error("Only the schedule owner can update the schedule");
      return;
    }
    if (!schedule) {
      toast.error("Generate a schedule first");
      return;
    }
    const updated = redistributeOvernight(
      volunteers,
      units,
      schedule,
      skippedOvernightWeeks,
    );
    try {
      await saveSchedule(updated);
      setSchedule(updated);
      const skippedCount = skippedOvernightWeeks.size;
      toast.success(
        skippedCount === 0
          ? "Overnight restored — team redistributed across all weeks"
          : `${skippedCount} week${skippedCount > 1 ? "s" : ""} set to no overnight — team redistributed evenly`,
      );
    } catch {
      toast.error("Failed to save overnight changes");
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

    if (!isOwner) {
      toast.error("Only the schedule owner can update the schedule");
      return;
    }

    const week = schedule.weeks[weekIdx];
    if (isWeekLocked(week.weekStartDate)) {
      toast.error("This week has already started and cannot be edited");
      return;
    }

    const [unitName, shift] = slot.split(":") as [
      string,
      "overnight" | "morning",
    ];
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
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <Button variant="outline" onClick={() => navigate("/report")}>
                <Chart2 className="h-4 w-4" />
                View Report
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/public/schedule")}
              >
                <Eye className="h-4 w-4" />
                View Public Schedule
              </Button>
            </div>
          </div>
        </div>

        {!isOwner && (
          <Card className="border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/30">
            <CardContent className="pt-4 pb-4 text-sm text-amber-800 dark:text-amber-300">
              You have view-only access. Only the schedule owner can generate or
              edit the schedule.
            </CardContent>
          </Card>
        )}

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
              {isOwner && (
                <Button onClick={handleGenerate}>
                  <Refresh className="h-4 w-4" />
                  Generate Schedule
                </Button>
              )}

              <div className="w-full space-y-2">
                <label className="text-sm font-medium text-foreground block">
                  No overnight on weeks
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 8 }, (_, i) => {
                    const wk = i + 1;
                    const isSelected = skippedOvernightWeeks.has(wk);
                    const weekDateStr = schedule?.weeks[i]?.weekStartDate;
                    const isPast = weekDateStr && isWeekLocked(weekDateStr);
                    const disabled = !!isPast || !isOwner;
                    return (
                      <button
                        key={wk}
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && toggleSkipWeek(wk)}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-full border font-medium transition-colors",
                          disabled && !isSelected
                            ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground border-border"
                            : isSelected
                              ? "bg-amber-50 text-amber-700 border-amber-400 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-background text-muted-foreground border-border hover:bg-muted",
                        )}
                      >
                        Wk {wk}
                        {weekDateStr
                          ? ` · ${format(parseISO(weekDateStr), "MMM d")}`
                          : ""}
                      </button>
                    );
                  })}
                </div>
                {schedule && isOwner && (
                  <div className="pt-1">
                    <Button
                      variant="secondary"
                      onClick={handleSaveOvernightChanges}
                    >
                      <Moon className="h-4 w-4" />
                      Save overnight changes
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Clears overnight for selected weeks and redistributes the
                      team evenly across the remaining weeks.
                    </p>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-[220px]">
                <label
                  htmlFor="unit-filter"
                  className="text-sm font-medium text-foreground mb-1.5 block"
                >
                  Unit Filter
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
              {schedule && (
                <>
                  {isOwner && (
                    <Button
                      variant="outline"
                      onClick={handleClear}
                      className="text-destructive"
                    >
                      <Trash className="h-4 w-4" />
                      Clear
                    </Button>
                  )}
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
                selectedUnit={unitFilter}
                isLocked={isWeekLocked(week.weekStartDate)}
                canEdit={isOwner}
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
  readonly selectedUnit: string;
  readonly isLocked: boolean;
  /** False for everyone but the schedule owner — see OWNER_EMAIL. */
  readonly canEdit: boolean;
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
  selectedUnit,
  isLocked,
  canEdit,
  onSwap,
  getCandidates,
}: WeekCardProps) {
  const unitsToShow =
    selectedUnit === "all"
      ? unitConfigs
      : unitConfigs.filter((u) => u.name === selectedUnit);

  const slots = [
    ...unitsToShow.map((u) => ({
      label: `Overnight ${u.label}`,
      key: `${u.name}:overnight`,
      assigned: week.assignments?.[u.name]?.overnight ?? [],
      required: { min: u.overnightMin, max: u.overnightMax },
      isOvernightSlot: true,
    })),
    ...unitsToShow.map((u) => ({
      label: `Morning ${u.label}`,
      key: `${u.name}:morning`,
      assigned: week.assignments?.[u.name]?.morning ?? [],
      required: { min: u.morningMin, max: u.morningMax },
      isOvernightSlot: false,
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
          {isLocked && (
            <Badge variant="outline" className="text-xs">
              Locked
            </Badge>
          )}
          {week.overnightSkipped && (
            <Badge
              variant="outline"
              className="text-xs border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300"
            >
              No Overnight
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map(({ label, key, assigned, required, isOvernightSlot }) => {
            if (isOvernightSlot && week.overnightSkipped) {
              return (
                <div key={key} className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {label}
                  </span>
                  <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/30 p-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      No team needed
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Overnight service is suspended this week. Members have
                      been redistributed to other weeks.
                    </p>
                  </div>
                </div>
              );
            }

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
                    disabled={isLocked || !canEdit}
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
                          {c.gender ? ` (${c.gender === "male" ? "M" : "F"})` : ""}
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
        {slots.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No assignments found for this unit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
