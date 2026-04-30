import { Link, NavLink } from "react-router-dom";
import { Clipboard } from "iconsax-react";
import { cn } from "@/lib/utils";

const publicLinks = [
  { to: "/public/schedule", label: "Full Schedule" },
  { to: "/public/my-shifts", label: "My Shifts" },
];

export function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
            {publicLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <Link
            to="/login"
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin →
          </Link>
        </div>
      </header>
      <main className="flex-1 container py-8">{children}</main>
    </div>
  );
}
