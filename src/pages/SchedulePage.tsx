import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, RefreshCw, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Volunteer, Schedule, WeekAssignment, CREW_REQUIREMENTS } from "@/types/schedule";
import { getVolunteers, getSchedule, saveSchedule, clearSchedule } from "@/lib/store";
import { generateSchedule } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SlotKey = "overnightSound" | "overnightLight" | "morningSound" | "morningLight";

export default function SchedulePage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setVolunteers(getVolunteers());
    setSchedule(getSchedule());
  }, []);

  const volMap = useMemo(() => {
    const m = new Map<string, Volunteer>();
    volunteers.forEach((v) => m.set(v.id, v));
    return m;
  }, [volunteers]);

  const handleGenerate = () => {
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }
    if (volunteers.length === 0) {
      toast.error("Add volunteers to the roster first");
      return;
    }
    const s = generateSchedule(volunteers, startDate);
    saveSchedule(s);
    setSchedule(s);
    toast.success("Schedule generated!");
  };

  const handleClear = () => {
    clearSchedule();
    setSchedule(null);
    toast.success("Schedule cleared");
  };

  const handleSwap = (weekIdx: number, slot: SlotKey, memberIdx: number, newVolunteerId: string) => {
    if (!schedule) return;
    const updated = { ...schedule, weeks: schedule.weeks.map((w, i) => {
      if (i !== weekIdx) return w;
      const arr = [...w[slot]];
      arr[memberIdx] = newVolunteerId;
      return { ...w, [slot]: arr };
    })};
    saveSchedule(updated);
    setSchedule(updated);
  };

  const getSlotCandidates = (slot: SlotKey): Volunteer[] => {
    const isSound = slot.includes("Sound");
    const isOvernight = slot.includes("overnight");
    return volunteers.filter(
      (v) => v.unit === (isSound ? "sound" : "light") && v.availability.includes(isOvernight ? "overnight" : "morning")
    );
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Schedule</h2>
          <p className="text-muted-foreground mt-1">Generate and manage the 6-week rotation</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleGenerate}>
                <RefreshCw className="h-4 w-4" />
                Generate Schedule
              </Button>
              {schedule && (
                <Button variant="outline" onClick={handleClear} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {schedule && (
          <div className="space-y-4">
            {schedule.weeks.map((week, weekIdx) => (
              <WeekCard
                key={week.weekNumber}
                week={week}
                weekIdx={weekIdx}
                volMap={volMap}
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

function WeekCard({
  week,
  weekIdx,
  volMap,
  onSwap,
  getCandidates,
}: {
  week: WeekAssignment;
  weekIdx: number;
  volMap: Map<string, Volunteer>;
  onSwap: (weekIdx: number, slot: SlotKey, memberIdx: number, newId: string) => void;
  getCandidates: (slot: SlotKey) => Volunteer[];
}) {
  const slots: { label: string; key: SlotKey; required: { min: number; max: number } }[] = [
    { label: "Overnight Sound", key: "overnightSound", required: CREW_REQUIREMENTS.overnight.sound },
    { label: "Overnight Light", key: "overnightLight", required: CREW_REQUIREMENTS.overnight.light },
    { label: "Morning Sound", key: "morningSound", required: CREW_REQUIREMENTS.morning.sound },
    { label: "Morning Light", key: "morningLight", required: CREW_REQUIREMENTS.morning.light },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-3">
          <Badge className="bg-primary text-primary-foreground">Week {week.weekNumber}</Badge>
          <span className="text-muted-foreground font-normal text-sm">
            {format(parseISO(week.weekStartDate), "EEEE, MMMM d, yyyy")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map(({ label, key, required }) => {
            const assigned = week[key];
            const isFull = assigned.length >= required.min;
            const candidates = getCandidates(key);
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{label}</span>
                  <Badge variant={isFull ? "secondary" : "destructive"} className="text-xs">
                    {assigned.length}/{required.min}{required.max > required.min ? `-${required.max}` : ""}
                  </Badge>
                </div>
                {assigned.map((id, memberIdx) => (
                  <Select key={memberIdx} value={id} onValueChange={(v) => onSwap(weekIdx, key, memberIdx, v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>{volMap.get(id)?.name || "Unknown"}</SelectValue>
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
