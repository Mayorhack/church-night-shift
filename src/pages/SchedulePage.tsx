import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon,
  Chart2,
  ClipboardTick,
  CloseCircle,
  CloudAdd,
  DocumentDownload,
  Eye,
  Lock,
  Moon,
  Refresh,
  TickCircle,
  Trash,
  Unlock,
} from "iconsax-react";
import { AppLayout } from "@/components/AppLayout";
import {
  Volunteer,
  Schedule,
  ServiceRecord,
  ShiftType,
  WeekAssignment,
  UnitConfig,
} from "@/types/schedule";
import {
  getVolunteers,
  getSchedule,
  saveSchedule,
  clearSchedule,
  getUnits,
  getServiceHistory,
  recordService,
  resyncServiceForWeek,
} from "@/lib/store";
import {
  generateSchedule,
  redistributeOvernight,
  isWeekLocked,
  hasWeekStarted,
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
  const [history, setHistory] = useState<ServiceRecord[]>([]);

  useEffect(() => {
    getVolunteers().then(setVolunteers).catch(console.error);
    getUnits().then(setUnits).catch(console.error);
    getServiceHistory().then(setHistory).catch(console.error);
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
    // Commit anything already served to the permanent record BEFORE generating.
    // Weeks that are about to roll out of the window only survive here, and the
    // balance the new schedule is built on depends on them.
    let ledger = history;
    if (schedule) {
      try {
        await recordService(schedule.weeks, volunteers);
        ledger = await getServiceHistory();
        setHistory(ledger);
      } catch {
        toast.error("Could not save service history — balance may be off");
      }
    }

    const s = generateSchedule(
      volunteers,
      units,
      startDate,
      unitFilter,
      schedule ?? undefined,
      skippedOvernightWeeks,
      ledger,
    );
    const rolledForward =
      schedule != null && schedule.weeks[0]?.weekStartDate !== s.startDate;
    try {
      await saveSchedule(s);
      setSchedule(s);
      // Finished weeks drop off and the rest are renumbered, so re-read the
      // skipped flags off the new weeks instead of keeping stale numbers.
      setSkippedOvernightWeeks(
        new Set(
          s.weeks.filter((w) => w.overnightSkipped).map((w) => w.weekNumber),
        ),
      );
      const scope =
        unitFilter === "all"
          ? "all units"
          : (units.find((u) => u.name === unitFilter)?.label ?? unitFilter);
      toast.success(
        `Schedule generated for ${scope}` +
          (rolledForward
            ? ` — window rolled forward to ${format(parseISO(s.startDate), "MMM d")}`
            : ""),
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
      history,
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
    if (week.locked) {
      toast.error(`Week ${week.weekNumber} is locked — unlock it to make changes`);
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
      await syncEditedWeek(updated.weeks[weekIdx]);
      toast.success("Assignment updated");
    } catch {
      toast.error("Failed to save assignment");
    }
  };

  /**
   * A week that has already started may still be sitting in the permanent
   * record. Editing it there means rewriting those rows, or the people swapped
   * out keep credit for a shift that is no longer theirs.
   */
  const syncEditedWeek = async (week: WeekAssignment) => {
    if (!hasWeekStarted(week.weekStartDate)) return;
    try {
      await resyncServiceForWeek(week, volunteers);
      setHistory(await getServiceHistory());
    } catch {
      toast.error("Saved, but the service record could not be updated");
    }
  };

  /** Takes someone off a shift without putting anyone in their place. */
  const handleRemove = async (
    weekIdx: number,
    slot: string,
    memberIdx: number,
  ) => {
    if (!schedule) return;
    if (!isOwner) {
      toast.error("Only the schedule owner can update the schedule");
      return;
    }

    const week = schedule.weeks[weekIdx];
    if (week.locked) {
      toast.error(`Week ${week.weekNumber} is locked — unlock it to make changes`);
      return;
    }
    const [unitName, shift] = slot.split(":") as [string, ShiftType];
    const current = week.assignments?.[unitName]?.[shift] ?? [];
    const removedId = current[memberIdx];

    const updated: Schedule = {
      ...schedule,
      weeks: schedule.weeks.map((w, i) => {
        if (i !== weekIdx) return w;
        const existingUnit = w.assignments?.[unitName] ?? {
          overnight: [] as string[],
          morning: [] as string[],
        };
        return {
          ...w,
          assignments: {
            ...w.assignments,
            [unitName]: {
              ...existingUnit,
              [shift]: current.filter((_, idx) => idx !== memberIdx),
            },
          },
        };
      }),
    };

    try {
      await saveSchedule(updated);
      setSchedule(updated);
      await syncEditedWeek(updated.weeks[weekIdx]);
      toast.success(
        `${volMap.get(removedId)?.name ?? "Member"} removed from ${shift}`,
      );
    } catch {
      toast.error("Failed to remove member");
    }
  };

  /**
   * Flips one person between present and absent for a week that has already
   * happened. Nobody is absent until marked, so this only ever writes the
   * exceptions.
   */
  const handleToggleAttendance = async (
    weekIdx: number,
    shift: ShiftType,
    volunteerId: string,
  ) => {
    if (!schedule) return;
    if (!isOwner) {
      toast.error("Only the schedule owner can record attendance");
      return;
    }

    const week = schedule.weeks[weekIdx];
    const absent = week.absences?.[shift] ?? [];
    const isAbsent = absent.includes(volunteerId);
    const nextAbsent = isAbsent
      ? absent.filter((id) => id !== volunteerId)
      : [...absent, volunteerId];

    const updated: Schedule = {
      ...schedule,
      weeks: schedule.weeks.map((w, i) =>
        i === weekIdx
          ? {
              ...w,
              absences: {
                overnight: w.absences?.overnight ?? [],
                morning: w.absences?.morning ?? [],
                [shift]: nextAbsent,
              },
            }
          : w,
      ),
    };

    try {
      await saveSchedule(updated);
      setSchedule(updated);
      // Keep the permanent record in step so the balance reflects it straight
      // away, without waiting for the next generate.
      if (week.attendanceConfirmed) {
        await recordService([updated.weeks[weekIdx]], volunteers);
        setHistory(await getServiceHistory());
      }
      toast.success(
        `${volMap.get(volunteerId)?.name ?? "Member"} marked ${
          isAbsent ? "present" : "absent"
        }`,
      );
    } catch {
      toast.error("Failed to update attendance");
    }
  };

  /**
   * Pins a future week so Generate and the overnight redistribution leave it
   * alone. Once a week has been announced to the team it should not quietly
   * change underneath them the next time the schedule is rebuilt.
   */
  const handleToggleLock = async (weekIdx: number) => {
    if (!schedule) return;
    if (!isOwner) {
      toast.error("Only the schedule owner can lock a week");
      return;
    }

    const week = schedule.weeks[weekIdx];
    const nextLocked = !week.locked;

    const updated: Schedule = {
      ...schedule,
      weeks: schedule.weeks.map((w, i) => {
        if (i !== weekIdx) return w;
        const next = { ...w, locked: true };
        if (!nextLocked) delete next.locked;
        return next;
      }),
    };

    try {
      await saveSchedule(updated);
      setSchedule(updated);
      // A locked week can't be skipped for overnight — drop any pending flag so
      // the toggle above matches what will actually happen.
      if (nextLocked) {
        setSkippedOvernightWeeks((prev) => {
          if (!prev.has(week.weekNumber)) return prev;
          const next = new Set(prev);
          next.delete(week.weekNumber);
          return next;
        });
      }
      toast.success(
        nextLocked
          ? `Week ${week.weekNumber} locked — Generate will leave it as it is`
          : `Week ${week.weekNumber} unlocked — Generate can rebuild it again`,
      );
    } catch {
      toast.error("Failed to update the lock");
    }
  };

  /** Locks in this week's turnout and writes it to the permanent record. */
  const handleConfirmAttendance = async (weekIdx: number) => {
    if (!schedule) return;
    if (!isOwner) {
      toast.error("Only the schedule owner can record attendance");
      return;
    }

    const updated: Schedule = {
      ...schedule,
      weeks: schedule.weeks.map((w, i) =>
        i === weekIdx ? { ...w, attendanceConfirmed: true } : w,
      ),
    };

    try {
      await saveSchedule(updated);
      const written = await recordService(
        [updated.weeks[weekIdx]],
        volunteers,
      );
      setSchedule(updated);
      setHistory(await getServiceHistory());
      const week = updated.weeks[weekIdx];
      const absentCount =
        (week.absences?.overnight.length ?? 0) +
        (week.absences?.morning.length ?? 0);
      toast.success(
        absentCount === 0
          ? `Week ${week.weekNumber} confirmed — full turnout, ${written} shifts recorded`
          : `Week ${week.weekNumber} confirmed — ${absentCount} absent, ${written - absentCount} shifts credited`,
      );
    } catch {
      toast.error("Failed to confirm attendance");
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
                    const scheduledWeek = schedule?.weeks[i];
                    const weekDateStr = scheduledWeek?.weekStartDate;
                    const isPast = weekDateStr && isWeekLocked(weekDateStr);
                    const disabled =
                      !!isPast || !isOwner || !!scheduledWeek?.locked;
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
            {schedule.weeks.map((week, weekIdx) => (
              <WeekCard
                key={week.weekNumber}
                week={week}
                weekIdx={weekIdx}
                volMap={volMap}
                unitConfigs={units}
                selectedUnit={unitFilter}
                isLocked={isWeekLocked(week.weekStartDate)}
                isPinned={week.locked === true}
                hasStarted={hasWeekStarted(week.weekStartDate)}
                canEdit={isOwner}
                canAssign={isOwner && !week.locked}
                onSwap={handleSwap}
                onRemove={handleRemove}
                onToggleLock={handleToggleLock}
                onToggleAttendance={handleToggleAttendance}
                onConfirmAttendance={handleConfirmAttendance}
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
  readonly weekIdx: number;
  readonly volMap: ReadonlyMap<string, Volunteer>;
  readonly unitConfigs: UnitConfig[];
  readonly selectedUnit: string;
  readonly isLocked: boolean;
  /** True when the owner has pinned this week against regeneration. */
  readonly isPinned: boolean;
  /** True once the week is under way — attendance can be recorded from then on. */
  readonly hasStarted: boolean;
  /** False for everyone but the schedule owner — see OWNER_EMAIL. */
  readonly canEdit: boolean;
  /** The owner, on a week that is not pinned: assignments can still be changed. */
  readonly canAssign: boolean;
  readonly onSwap: (
    weekIdx: number,
    slot: string,
    memberIdx: number,
    newId: string,
  ) => void;
  readonly onRemove: (
    weekIdx: number,
    slot: string,
    memberIdx: number,
  ) => void;
  readonly onToggleAttendance: (
    weekIdx: number,
    shift: ShiftType,
    volunteerId: string,
  ) => void;
  readonly onConfirmAttendance: (weekIdx: number) => void;
  readonly onToggleLock: (weekIdx: number) => void;
  readonly getCandidates: (slot: string, week: WeekAssignment) => Volunteer[];
};

function WeekCard({
  week,
  weekIdx,
  volMap,
  unitConfigs,
  selectedUnit,
  isLocked,
  isPinned,
  hasStarted,
  canEdit,
  canAssign,
  onSwap,
  onRemove,
  onToggleAttendance,
  onConfirmAttendance,
  onToggleLock,
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
      shift: "overnight" as ShiftType,
      assigned: week.assignments?.[u.name]?.overnight ?? [],
      required: { min: u.overnightMin, max: u.overnightMax },
      isOvernightSlot: true,
    })),
    ...unitsToShow.map((u) => ({
      label: `Morning ${u.label}`,
      key: `${u.name}:morning`,
      shift: "morning" as ShiftType,
      assigned: week.assignments?.[u.name]?.morning ?? [],
      required: { min: u.morningMin, max: u.morningMax },
      isOvernightSlot: false,
    })),
  ];

  const absentCount =
    (week.absences?.overnight.length ?? 0) +
    (week.absences?.morning.length ?? 0);

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
            <Badge
              variant="outline"
              className="text-xs"
              title={
                canEdit
                  ? "This week has already started — edits here rewrite the service record"
                  : "This week has already started"
              }
            >
              Started
            </Badge>
          )}
          {isPinned && (
            <Badge
              variant="outline"
              className="text-xs border-sky-400 text-sky-700 bg-sky-50 dark:bg-sky-950 dark:text-sky-300"
              title="Locked by the owner — Generate and overnight changes leave this week exactly as it is"
            >
              <Lock className="h-3 w-3 mr-1" />
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
          {week.attendanceConfirmed && (
            <Badge
              variant="outline"
              className="text-xs border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300"
            >
              <TickCircle className="h-3 w-3 mr-1" />
              Attendance confirmed
              {absentCount > 0 ? ` · ${absentCount} absent` : ""}
            </Badge>
          )}
          {canEdit && (
            <div className="ml-auto flex items-center gap-1">
              {hasStarted && (
                <Button
                  size="sm"
                  variant={week.attendanceConfirmed ? "ghost" : "default"}
                  className="h-7 text-xs"
                  onClick={() => onConfirmAttendance(weekIdx)}
                >
                  <ClipboardTick className="h-3.5 w-3.5" />
                  {week.attendanceConfirmed
                    ? "Re-confirm"
                    : "Confirm attendance"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-7 text-xs", isPinned && "text-sky-700 dark:text-sky-300")}
                title={
                  isPinned
                    ? "Unlock this week so Generate can rebuild it"
                    : "Lock this week so Generate leaves it exactly as it is"
                }
                onClick={() => onToggleLock(weekIdx)}
              >
                {isPinned ? (
                  <Unlock className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {isPinned ? "Unlock week" : "Lock week"}
              </Button>
            </div>
          )}
        </CardTitle>
        {isPinned && canEdit && (
          <p className="text-xs text-muted-foreground">
            Locked. Generate and overnight changes will skip this week, and the
            assignments below cannot be edited until you unlock it.
          </p>
        )}
        {hasStarted && canEdit && !week.attendanceConfirmed && (
          <p className="text-xs text-muted-foreground">
            Everyone below counts as present. Tap anyone who did not turn up,
            then confirm — only attended shifts count toward the balance.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map(({ label, key, shift, assigned, required, isOvernightSlot }) => {
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
                {assigned.map((id: string, memberIdx: number) => {
                  const isAbsent = (week.absences?.[shift] ?? []).includes(id);
                  return (
                    <div
                      key={`${week.weekNumber}-${key}-${id}`}
                      className="flex items-center gap-1"
                    >
                      <Select
                        value={id}
                        disabled={!canAssign}
                        onValueChange={(v) =>
                          onSwap(weekIdx, key, memberIdx, v)
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-8 text-xs",
                            isAbsent &&
                              "line-through text-muted-foreground opacity-70",
                          )}
                        >
                          <SelectValue>
                            {volMap.get(id)?.name || "Unknown"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {candidates.map((c) => (
                            <SelectItem
                              key={c.id}
                              value={c.id}
                              className="text-xs"
                            >
                              {c.name}
                              {c.gender
                                ? ` (${c.gender === "male" ? "M" : "F"})`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {canEdit && hasStarted && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-8 w-8 shrink-0",
                            isAbsent
                              ? "text-destructive"
                              : "text-emerald-600 dark:text-emerald-400",
                          )}
                          title={
                            isAbsent
                              ? `${volMap.get(id)?.name ?? "Member"} did not turn up — tap to mark present`
                              : `${volMap.get(id)?.name ?? "Member"} attended — tap to mark absent`
                          }
                          onClick={() => onToggleAttendance(weekIdx, shift, id)}
                        >
                          {isAbsent ? (
                            <CloseCircle className="h-4 w-4" />
                          ) : (
                            <TickCircle className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {canAssign && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          title={`Remove ${volMap.get(id)?.name ?? "member"} from ${shift}`}
                          onClick={() => onRemove(weekIdx, key, memberIdx)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
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
