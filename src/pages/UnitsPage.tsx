import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { UnitConfig } from "@/types/schedule";
import { getUnits, createUnit, updateUnit, deleteUnit } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Trash, Edit, Add } from "iconsax-react";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = {
  name: "",
  label: "",
  overnightMin: 2,
  overnightMax: 2,
  morningMin: 1,
  morningMax: 1,
};

type FormState = typeof EMPTY_FORM;

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UnitConfig | null>(null);

  useEffect(() => {
    getUnits()
      .then(setUnits)
      .catch(() => toast.error("Failed to load units"))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditingUnit(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (unit: UnitConfig) => {
    setEditingUnit(unit);
    setForm({
      name: unit.name,
      label: unit.label,
      overnightMin: unit.overnightMin,
      overnightMax: unit.overnightMax,
      morningMin: unit.morningMin,
      morningMax: unit.morningMax,
    });
    setDialogOpen(true);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.label.trim()) {
      toast.error("Name and label are required");
      return;
    }
    if (
      form.overnightMin > form.overnightMax ||
      form.morningMin > form.morningMax
    ) {
      toast.error("Min cannot exceed max");
      return;
    }

    setSaving(true);
    try {
      if (editingUnit) {
        const updated: UnitConfig = { ...editingUnit, ...form };
        await updateUnit(updated);
        setUnits((prev) =>
          prev.map((u) => (u.id === updated.id ? updated : u)),
        );
        toast.success(`${updated.label} updated`);
      } else {
        // Check name uniqueness
        if (units.some((u) => u.name === form.name.trim().toLowerCase())) {
          toast.error("A unit with that name already exists");
          setSaving(false);
          return;
        }
        const newUnit: UnitConfig = {
          id: crypto.randomUUID(),
          name: form.name.trim().toLowerCase(),
          label: form.label.trim(),
          overnightMin: form.overnightMin,
          overnightMax: form.overnightMax,
          morningMin: form.morningMin,
          morningMax: form.morningMax,
        };
        await createUnit(newUnit);
        setUnits((prev) => [...prev, newUnit]);
        toast.success(`${newUnit.label} unit created`);
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save unit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUnit(deleteTarget.id);
      setUnits((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast.success(`${deleteTarget.label} unit deleted`);
    } catch {
      toast.error("Failed to delete unit");
    } finally {
      setDeleteTarget(null);
    }
  };

  let saveButtonLabel = "Create Unit";
  if (saving) saveButtonLabel = "Saving…";
  else if (editingUnit) saveButtonLabel = "Save Changes";

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Units</h2>
            <p className="text-muted-foreground mt-1">
              Manage crew units and their required volunteer counts
            </p>
          </div>
          <Button onClick={openCreate} className="self-start sm:self-auto">
            <Add className="h-4 w-4" />
            Add Unit
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {!loading && units.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No units yet. Click "Add Unit" to create one.
            </CardContent>
          </Card>
        )}

        {!loading && units.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {units.map((unit) => (
              <Card key={unit.id}>
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{unit.label}</CardTitle>
                    <Badge
                      variant="secondary"
                      className="mt-1 text-xs font-mono"
                    >
                      {unit.name}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(unit)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(unit)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Moon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Overnight</span>
                    <span className="ml-auto font-medium">
                      {unit.overnightMin === unit.overnightMax
                        ? unit.overnightMin
                        : `${unit.overnightMin}–${unit.overnightMax}`}{" "}
                      volunteers
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Sun className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Morning</span>
                    <span className="ml-auto font-medium">
                      {unit.morningMin === unit.morningMax
                        ? unit.morningMin
                        : `${unit.morningMin}–${unit.morningMax}`}{" "}
                      volunteers
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? `Edit ${editingUnit.label}` : "Add Unit"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name (slug) — only editable on create */}
            <div className="space-y-2">
              <Label htmlFor="unit-name">Unit Name (slug)</Label>
              <Input
                id="unit-name"
                placeholder="e.g. sound"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                disabled={!!editingUnit}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase identifier used internally. Cannot be changed after
                creation.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-label">Display Label</Label>
              <Input
                id="unit-label"
                placeholder="e.g. Sound Team"
                value={form.label}
                onChange={(e) => setField("label", e.target.value)}
              />
            </div>

            {/* Overnight */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Moon className="h-4 w-4" />
                Overnight Volunteers Needed
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="overnight-min"
                    className="text-xs text-muted-foreground"
                  >
                    Minimum
                  </Label>
                  <Input
                    id="overnight-min"
                    type="number"
                    min={0}
                    value={form.overnightMin}
                    onChange={(e) =>
                      setField("overnightMin", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="overnight-max"
                    className="text-xs text-muted-foreground"
                  >
                    Maximum
                  </Label>
                  <Input
                    id="overnight-max"
                    type="number"
                    min={0}
                    value={form.overnightMax}
                    onChange={(e) =>
                      setField("overnightMax", Number(e.target.value))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Morning */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sun className="h-4 w-4" />
                Morning Volunteers Needed
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="morning-min"
                    className="text-xs text-muted-foreground"
                  >
                    Minimum
                  </Label>
                  <Input
                    id="morning-min"
                    type="number"
                    min={0}
                    value={form.morningMin}
                    onChange={(e) =>
                      setField("morningMin", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="morning-max"
                    className="text-xs text-muted-foreground"
                  >
                    Maximum
                  </Label>
                  <Input
                    id="morning-max"
                    type="number"
                    min={0}
                    value={form.morningMax}
                    onChange={(e) =>
                      setField("morningMax", Number(e.target.value))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saveButtonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the unit. Volunteers already assigned to this
              unit will retain their unit value but the unit won't appear in
              dropdowns. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
