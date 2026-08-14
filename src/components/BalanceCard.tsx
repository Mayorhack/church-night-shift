import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShiftBalance } from "@/lib/report";
import { cn } from "@/lib/utils";

/**
 * Year-to-date standing for one shift type: who is ahead, who is behind, and
 * how far apart the two ends are. A spread of 0 or 1 means the rotation has
 * evened out; anything larger is what the next generate will work to close.
 */
export function BalanceCard({
  balance,
  title,
}: Readonly<{ balance: ShiftBalance; title: string }>) {
  const { entries, average, spread } = balance;
  const busiest = Math.max(1, ...entries.map((e) => e.attended));

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nobody is on this rotation yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          {title}
          <Badge variant="secondary" className="text-xs font-normal">
            avg {average}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-normal",
              spread <= 1
                ? "border-emerald-400 text-emerald-700 dark:text-emerald-300"
                : "border-amber-400 text-amber-700 dark:text-amber-300",
            )}
          >
            {spread <= 1 ? "level" : `${spread} apart`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {entries.map(({ volunteer, attended, missed, diff }) => (
          <div key={volunteer.id} className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 truncate" title={volunteer.name}>
              {volunteer.name}
            </span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(attended / busiest) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums">{attended}</span>
            <span
              className={cn(
                "w-10 text-right text-xs tabular-nums",
                diff < 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
              )}
            >
              {diff > 0 ? `+${diff}` : diff}
            </span>
            {missed > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 border-destructive/50 text-destructive"
                title={`Missed ${missed} scheduled shift${missed > 1 ? "s" : ""}`}
              >
                {missed} missed
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
