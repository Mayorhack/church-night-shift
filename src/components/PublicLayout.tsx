import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Clipboard, HambergerMenu, CloseCircle } from "iconsax-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const publicLinks = [
  { to: "/public/schedule", label: "Full Schedule" },
  { to: "/public/my-shifts", label: "My Shifts" },
];

export function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container flex items-center h-16 gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Clipboard className="h-6 w-6 text-primary" />
            <h1 className="text-base sm:text-lg font-bold text-foreground">
              Church Crew Scheduler
            </h1>
          </div>
          {/* Desktop nav */}
          <nav className="hidden sm:flex gap-1 flex-1">
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
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <Link
              to="/login"
              className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin →
            </Link>
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
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
          <div className="sm:hidden border-t bg-card">
            <nav className="container flex flex-col gap-1 py-3">
              {publicLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "px-4 py-3 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
              <div className="border-t pt-3 mt-1 px-4">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Admin →
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 container py-6 sm:py-8">{children}</main>
    </div>
  );
}
