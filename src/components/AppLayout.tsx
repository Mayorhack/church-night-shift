import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  People,
  Calendar,
  User,
  Clipboard,
  Setting2,
  HambergerMenu,
  CloseCircle,
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container flex items-center h-16 gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Clipboard className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground hidden sm:block">
              Church Crew Scheduler
            </h1>
            <h1 className="text-base font-bold text-foreground sm:hidden">
              Crew Scheduler
            </h1>
          </div>
          {/* Desktop nav */}
          <nav className="hidden lg:flex gap-1 flex-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
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
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            {session?.user.email && (
              <span className="text-xs text-muted-foreground hidden md:block">
                {session.user.email}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => supabase.auth.signOut()}
              className="hidden sm:inline-flex"
            >
              Sign Out
            </Button>
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <CloseCircle className="h-5 w-5" />
              ) : (
                <HambergerMenu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t bg-card">
            <nav className="container flex flex-col gap-1 py-3">
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
              <div className="border-t pt-3 mt-1 flex items-center justify-between px-4">
                {session?.user.email && (
                  <span className="text-xs text-muted-foreground truncate mr-3">
                    {session.user.email}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    supabase.auth.signOut();
                    setMobileOpen(false);
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 container py-6 sm:py-8">{children}</main>
    </div>
  );
}
