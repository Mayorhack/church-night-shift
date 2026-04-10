import { NavLink } from "react-router-dom";
import { Home, Users, Calendar, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/roster", label: "Team Roster", icon: Users },
  { to: "/schedule", label: "Schedule", icon: Calendar },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container flex items-center h-16 gap-8">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Church Crew Scheduler</h1>
          </div>
          <nav className="flex gap-1">
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
                      : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 container py-8">{children}</main>
    </div>
  );
}
