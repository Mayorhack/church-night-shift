import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
import type { ShiftReport, ShiftTally } from "@/lib/report";
import { cn } from "@/lib/utils";

/**
 * Post-generation summary: who is carrying the most overnight shifts and who
 * is carrying the most morning shifts in the current schedule.
 */
export function ShiftReportCard({
  report,
}: Readonly<{ report: ShiftReport }>) {
  if (report.tallies.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Shift Report
          <Badge variant="secondary" className="text-xs font-normal">
            {report.totalOvernightSlots} overnight ·{" "}
            {report.totalMorningSlots} morning slots
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Who is on the most shifts across this schedule. "Served" counts weeks
          that have already started.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <RankTable
            title="🌙 Most overnight"
            shiftKey="overnight"
            servedKey="servedOvernight"
            rows={report.topOvernight}
          />
          <RankTable
            title="☀️ Most morning"
            shiftKey="morning"
            servedKey="servedMorning"
            rows={report.topMorning}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RankTable({
  title,
  shiftKey,
  servedKey,
  rows,
}: Readonly<{
  title: string;
  shiftKey: "overnight" | "morning";
  servedKey: "servedOvernight" | "servedMorning";
  rows: ShiftTally[];
}>) {
  const topCount = rows[0]?.[shiftKey] ?? 0;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No {shiftKey} shifts assigned.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[360px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="whitespace-nowrap">Unit</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Shifts
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Served
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.volunteer.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {idx + 1}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap",
                      row[shiftKey] === topCount && "font-semibold",
                    )}
                  >
                    {row.volunteer.name}
                    {row.volunteer.gender && (
                      <span className="text-muted-foreground text-xs ml-1.5">
                        ({row.volunteer.gender === "male" ? "M" : "F"})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground text-sm">
                    {row.volunteer.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        row[shiftKey] === topCount ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {row[shiftKey]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {row[servedKey]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
