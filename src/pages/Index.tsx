import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, isWithinInterval, addDays } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { getVolunteers, getSchedule } from "@/lib/store";
import { Volunteer, Schedule, WeekAssignment } from "@/types/schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  People,
  Calendar as CalendarIcon,
  Volume,
  ArrowRight,
  Sun,
  Moon,
  CloudLightning,
} from "iconsax-react";
import { Lightbulb, Users } from "lucide-react";

export default function Dashboard() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    getVolunteers().then(setVolunteers).catch(console.error);
    getSchedule().then(setSchedule).catch(console.error);
  }, []);

  const soundCount = volunteers.filter((v) => v.unit === "sound").length;
  const lightCount = volunteers.filter((v) => v.unit === "light").length;

  const today = new Date();
  const currentWeek = schedule?.weeks.find((w) => {
    const start = parseISO(w.weekStartDate);
    return isWithinInterval(today, { start, end: addDays(start, 6) });
  });

  const volMap = new Map<string, Volunteer>();
  volunteers.forEach((v) => volMap.set(v.id, v));

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Church overnight work crew overview
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-full p-3 bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{volunteers.length}</p>
                <p className="text-sm text-muted-foreground">
                  Total Volunteers
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-full p-3 bg-accent/30">
                <Volume className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{soundCount}</p>
                <p className="text-sm text-muted-foreground">Sound Team</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-full p-3 bg-primary/10">
                <CloudLightning className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lightCount}</p>
                <p className="text-sm text-muted-foreground">Light Team</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Week */}
        {currentWeek ? (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <CalendarIcon className="h-5 w-5 text-primary" />
                This Week's Schedule
                <Badge>Week {currentWeek.weekNumber}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-6">
                <CrewList
                  icon={<Moon className="h-4 w-4" />}
                  title="Overnight"
                  items={Object.entries(currentWeek.assignments).map(
                    ([unitName, shifts]) => ({
                      label:
                        unitName.charAt(0).toUpperCase() + unitName.slice(1),
                      ids: shifts.overnight,
                      volMap,
                    }),
                  )}
                />
                <CrewList
                  icon={<Sun className="h-4 w-4" />}
                  title="Morning Setup"
                  items={Object.entries(currentWeek.assignments).map(
                    ([unitName, shifts]) => ({
                      label:
                        unitName.charAt(0).toUpperCase() + unitName.slice(1),
                      ids: shifts.morning,
                      volMap,
                    }),
                  )}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">
                {schedule
                  ? "No schedule matches the current week."
                  : "No schedule generated yet."}
              </p>
              <div className="flex gap-3 justify-center">
                {volunteers.length === 0 && (
                  <Button asChild>
                    <Link to="/roster">
                      <Users className="h-4 w-4" /> Add Volunteers
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  variant={volunteers.length > 0 ? "default" : "outline"}
                >
                  <Link to="/schedule">
                    <CalendarIcon className="h-4 w-4" /> Go to Schedule{" "}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <Link to="/roster" className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Manage Roster</p>
                    <p className="text-sm text-muted-foreground">
                      Add or remove team members
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <Link
                to="/schedule"
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">View Schedule</p>
                    <p className="text-sm text-muted-foreground">
                      Generate or edit the rotation
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function CrewList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: { label: string; ids: string[]; volMap: Map<string, Volunteer> }[];
}) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold flex items-center gap-2 text-foreground">
        {icon} {title}
      </h4>
      {items.map(({ label, ids, volMap }) => (
        <div key={label}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {label}
          </p>
          <div className="flex flex-wrap gap-1">
            {ids.map((id) => (
              <Badge key={id} variant="outline">
                {volMap.get(id)?.name || "Unknown"}
              </Badge>
            ))}
            {ids.length === 0 && (
              <span className="text-xs text-destructive">None assigned</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
