import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Schedule, Volunteer } from "@/types/schedule";
import { buildShiftReport, type ShiftReport, type ShiftTally } from "@/lib/report";

/** jspdf-autotable stashes the last table's geometry on the doc at runtime. */
function lastTableBottom(pdf: jsPDF): number {
  return (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
}

export function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSchedulePDF(
  schedule: Schedule,
  volMap: Map<string, Volunteer>,
  filename: string,
) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let yPosition = margin;

  // Title
  pdf.setFontSize(20);
  pdf.text("Schedule Overview", margin, yPosition);
  yPosition += 12;

  // Date range
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPosition);
  yPosition += 8;

  pdf.setTextColor(0, 0, 0);

  schedule.weeks.forEach((week, weekIdx) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    // Week header
    pdf.setFontSize(14);
    pdf.setFont(undefined, "bold");
    pdf.text(`Week ${week.weekNumber}`, margin, yPosition);
    yPosition += 8;

    const getVolunteerNames = (ids: string[]) =>
      ids.map((id) => volMap.get(id)?.name || "Unknown").join(", ");

    const tableData = Object.entries(week.assignments).flatMap(
      ([unitName, shifts]) => {
        const label = unitName.charAt(0).toUpperCase() + unitName.slice(1);
        return [
          [`Overnight ${label}`, getVolunteerNames(shifts.overnight)],
          [`Morning ${label}`, getVolunteerNames(shifts.morning)],
        ];
      },
    );

    pdf.setFontSize(10);
    autoTable(pdf, {
      head: [["Shift", "Volunteers"]],
      body: tableData,
      startY: yPosition,
      margin: margin,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: "linebreak",
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: pageWidth - 2 * margin - 40 },
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
    });

    yPosition = lastTableBottom(pdf) + 12;
  });

  // Shift report — who carried the most overnight / morning shifts
  const report = buildShiftReport(schedule, [...volMap.values()]);
  if (report.tallies.length > 0) {
    pdf.addPage();
    drawShiftReport(pdf, report, margin, margin, pageHeight);
  }

  pdf.save(filename);
}

/** Renders the ranked overnight/morning tables. Returns the new y position. */
function drawShiftReport(
  pdf: jsPDF,
  report: ShiftReport,
  margin: number,
  startY: number,
  pageHeight: number,
): number {
  let yPosition = startY;

  pdf.setFontSize(16);
  pdf.setFont(undefined, "bold");
  pdf.text("Shift Report", margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(10);
  pdf.setFont(undefined, "normal");
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `${report.totalOvernightSlots} overnight slots · ${report.totalMorningSlots} morning slots`,
    margin,
    yPosition,
  );
  pdf.setTextColor(0, 0, 0);
  yPosition += 8;

  const rankSection = (
    heading: string,
    rows: ShiftTally[],
    key: "overnight" | "morning",
    servedKey: "servedOvernight" | "servedMorning",
  ) => {
    if (rows.length === 0) return;
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.text(heading, margin, yPosition);
    pdf.setFont(undefined, "normal");
    yPosition += 6;

    autoTable(pdf, {
      head: [["#", "Name", "Unit", "Gender", "Shifts", "Served"]],
      body: rows.map((r, i) => [
        String(i + 1),
        r.volunteer.name,
        r.volunteer.unit,
        r.volunteer.gender ?? "—",
        String(r[key]),
        String(r[servedKey]),
      ]),
      startY: yPosition,
      margin: margin,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
    });

    yPosition = lastTableBottom(pdf) + 10;
  };

  rankSection(
    "Most overnight shifts",
    report.topOvernight,
    "overnight",
    "servedOvernight",
  );
  rankSection(
    "Most morning shifts",
    report.topMorning,
    "morning",
    "servedMorning",
  );

  return yPosition;
}

/** Standalone report PDF for the Report page. */
export function downloadShiftReportPDF(
  report: ShiftReport,
  filename: string,
  subtitle?: string,
) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  let yPosition = margin;
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    subtitle
      ? `${subtitle} · Generated ${new Date().toLocaleDateString()}`
      : `Generated ${new Date().toLocaleDateString()}`,
    margin,
    yPosition,
  );
  pdf.setTextColor(0, 0, 0);
  yPosition += 10;

  drawShiftReport(pdf, report, margin, yPosition, pageHeight);
  pdf.save(filename);
}

interface VolunteerScheduleData {
  volunteer: string;
  unit: string;
  overnightShifts: number;
  morningShifts: number;
  totalShifts: number;
  assignments: {
    weekNumber: number;
    shift: string;
    type: "overnight" | "morning";
    unit: string;
  }[];
}

export function downloadVolunteerSchedulePDF(
  data: VolunteerScheduleData[],
  filename: string,
) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let yPosition = margin;

  // Title
  pdf.setFontSize(20);
  pdf.text("Volunteer Schedule", margin, yPosition);
  yPosition += 15;

  // Date
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(new Date().toLocaleDateString(), margin, yPosition);
  yPosition += 10;

  // Reset text color
  pdf.setTextColor(0, 0, 0);

  data.forEach((stat, index) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      yPosition = margin;
    }

    // Volunteer Name and Info
    pdf.setFontSize(14);
    pdf.setFont(undefined, "bold");
    pdf.text(stat.volunteer, margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    pdf.text(
      `Unit: ${stat.unit.charAt(0).toUpperCase() + stat.unit.slice(1)}`,
      margin,
      yPosition,
    );
    yPosition += 6;

    // Stats box
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition, pageWidth - 2 * margin, 18, "F");

    pdf.setFont(undefined, "bold");
    pdf.text(`Total Shifts: ${stat.totalShifts}`, margin + 5, yPosition + 6);
    pdf.text(
      `Overnight: ${stat.overnightShifts}`,
      pageWidth / 2,
      yPosition + 6,
    );
    pdf.text(`Morning: ${stat.morningShifts}`, pageWidth - 40, yPosition + 6);
    yPosition += 22;

    // Assignments table
    if (stat.assignments.length > 0) {
      const tableData = stat.assignments.map((assignment) => [
        `Week ${assignment.weekNumber}`,
        assignment.type === "overnight" ? "🌙 Overnight" : "☀️ Morning",
        assignment.unit.charAt(0).toUpperCase() + assignment.unit.slice(1),
      ]);

      pdf.setFontSize(9);
      autoTable(pdf, {
        head: [["Week", "Shift Type", "Unit"]],
        body: tableData,
        startY: yPosition,
        margin: margin,
        theme: "grid",
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
      });

      yPosition = lastTableBottom(pdf) + 10;
    }

    // Add separator between volunteers
    if (index < data.length - 1) {
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
    }
  });

  pdf.save(filename);
}
