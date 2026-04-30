import { NavLink } from "react-router-dom";
import {
  Home,
  People,
  Calendar,
  User,
  Clipboard,
  Setting2,
} from "iconsax-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/roster", label: "Team Roster", icon: People },
  { to: "/units", label: "Units", icon: Setting2 },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/volunteer-schedule", label: "Volunteer Schedules", icon: User },
];

export function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { session } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container flex items-center h-16 gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Clipboard className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">
              Church Crew Scheduler
            </h1>
          </div>
          <nav className="flex gap-1 flex-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            {session?.user.email && (
              <span className="text-xs text-muted-foreground hidden md:block">
                {session.user.email}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => supabase.auth.signOut()}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-8">{children}</main>
    </div>
  );
}
