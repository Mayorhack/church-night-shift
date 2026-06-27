import { useState, useEffect } from "react";
import { Volunteer, ShiftType, UnitConfig, InactivePeriod } from "@/types/schedule";
import {
  getVolunteers,
  addVolunteer as createVolunteer,
  removeVolunteer,
  getUnits,
  updateVolunteerInactivePeriods,
} from "@/lib/store";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash } from "iconsax-react";
import { UserPlus, Plus, CalendarOff } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export default function Roster() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [units, setUnits] = useState<UnitConfig[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("");
  const [overnight, setOvernight] = useState(true);
  const [morning, setMorning] = useState(false);
  const [editingVol, setEditingVol] = useState<Volunteer | null>(null);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  useEffect(() => {
    getVolunteers().then(setVolunteers).catch(console.error);
    getUnits()
      .then((u) => {
        setUnits(u);
        if (u.length > 0) setUnit(u[0].name);
      })
      .catch(console.error);
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    const availability: ShiftType[] = [];
    if (overnight) availability.push("overnight");
    if (morning) availability.push("morning");
    if (availability.length === 0) {
      toast.error("Select at least one shift type");
      return;
    }
    const vol: Volunteer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      unit,
      availability,
    };
    try {
      await createVolunteer(vol);
      setVolunteers((prev) => [...prev, vol]);
      setName("");
      toast.success(`${vol.name} added to ${unit} team`);
    } catch {
      toast.error("Failed to add volunteer");
    }
  };

  const remove = async (id: string) => {
    try {
      await removeVolunteer(id);
      setVolunteers((prev) => prev.filter((v) => v.id !== id));
      toast.success("Volunteer removed");
    } catch {
      toast.error("Failed to remove volunteer");
    }
  };

  const openInactiveDialog = (vol: Volunteer) => {
    setEditingVol(vol);
    const existing = vol.inactivePeriods?.[0];
    setPeriodFrom(existing?.from ?? "");
    setPeriodTo(existing?.to ?? "");
  };

  const handleSaveInactivePeriod = async () => {
    if (!editingVol) return;
    if (periodFrom && periodTo && periodFrom > periodTo) {
      toast.error("'From' date must be before 'To' date");
      return;
    }
    const periods: InactivePeriod[] =
      periodFrom && periodTo ? [{ from: periodFrom, to: periodTo }] : [];
    try {
      await updateVolunteerInactivePeriods(editingVol.id, periods);
      setVolunteers((prev) =>
        prev.map((v) =>
          v.id === editingVol.id ? { ...v, inactivePeriods: periods } : v,
        ),
      );
      setEditingVol(null);
      toast.success(
        periods.length ? "Inactive period saved" : "Inactive period cleared",
      );
    } catch {
      toast.error("Failed to update inactive period");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Team Roster</h2>
          <p className="text-muted-foreground mt-1">
            Manage your volunteer team members
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" />
              Add Volunteer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-4">
                <p className="text-sm font-medium text-foreground mb-1.5">
                  Name
                </p>
                <Input
                  id="volunteer-name"
                  placeholder="Enter volunteer name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div className="md:col-span-3">
                <p className="text-sm font-medium text-foreground mb-1.5">
                  Unit
                </p>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger id="volunteer-unit" className="w-full">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={overnight}
                    onCheckedChange={(c) => setOvernight(!!c)}
                  />
                  <span>Overnight</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={morning}
                    onCheckedChange={(c) => setMorning(!!c)}
                  />
                  <span>Morning</span>
                </div>
              </div>
              <Button
                onClick={handleAdd}
                className="w-full md:w-auto md:col-span-2"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {units.map((u) => (
            <TeamTable
              key={u.id}
              title={u.label}
              volunteers={volunteers.filter((v) => v.unit === u.name)}
              onRemove={remove}
              onEditInactive={openInactiveDialog}
            />
          ))}
        </div>
      </div>

      {/* Inactive period dialog */}
      <Dialog open={!!editingVol} onOpenChange={(o) => !o && setEditingVol(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-4 w-4" />
              Inactive Period — {editingVol?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="period-from">From</Label>
              <Input
                id="period-from"
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-to">To</Label>
              <Input
                id="period-to"
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPeriodFrom("");
                setPeriodTo("");
              }}
            >
              Clear
            </Button>
            <Button onClick={handleSaveInactivePeriod}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function TeamTable({
  title,
  volunteers,
  onRemove,
  onEditInactive,
}: Readonly<{
  title: string;
  volunteers: Volunteer[];
  onRemove: (id: string) => void;
  onEditInactive: (vol: Volunteer) => void;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
          {title}
          <Badge variant="secondary">{volunteers.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {volunteers.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">
            No members yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Availability
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Inactive Period
                  </TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {v.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {v.availability.map((a) => (
                          <Badge
                            key={a}
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {a}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {v.inactivePeriods?.[0] ? (
                        <Badge
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          {format(
                            parseISO(v.inactivePeriods[0].from),
                            "MMM d",
                          )}
                          {" – "}
                          {format(
                            parseISO(v.inactivePeriods[0].to),
                            "MMM d, yyyy",
                          )}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditInactive(v)}
                          title="Set inactive period"
                        >
                          <CalendarOff className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemove(v.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
