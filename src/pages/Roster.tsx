import { useState, useEffect } from "react";
import { Volunteer, ShiftType, UnitConfig } from "@/types/schedule";
import {
  getVolunteers,
  addVolunteer as createVolunteer,
  removeVolunteer,
  getUnits,
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
import { Trash } from "iconsax-react";
import { UserPlus, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Roster() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [units, setUnits] = useState<UnitConfig[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("");
  const [overnight, setOvernight] = useState(true);
  const [morning, setMorning] = useState(false);

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
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Name
                </label>
                <Input
                  placeholder="Enter volunteer name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div className="w-[160px]">
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Unit
                </label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
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
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={overnight}
                    onCheckedChange={(c) => setOvernight(!!c)}
                  />
                  Overnight
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={morning}
                    onCheckedChange={(c) => setMorning(!!c)}
                  />
                  Morning
                </label>
              </div>
              <Button onClick={handleAdd}>
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
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function TeamTable({
  title,
  volunteers,
  onRemove,
}: {
  title: string;
  volunteers: Volunteer[];
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {title}{" "}
          <Badge variant="secondary" className="ml-2">
            {volunteers.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {volunteers.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">
            No members yet
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volunteers.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(v.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
