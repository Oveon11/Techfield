import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  FileDown,
  GraduationCap,
  HeartPulse,
  Trash2,
  UserX,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

type EntryType = "travail" | "conge" | "cfa" | "maladie" | "absence";

const ENTRY_TYPES: { value: EntryType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "travail",  label: "TRAVAIL",  icon: Briefcase,      color: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  { value: "conge",    label: "CONGÉ",    icon: CalendarDays,   color: "bg-blue-50 border-blue-300 text-blue-700" },
  { value: "cfa",      label: "CFA",      icon: GraduationCap,  color: "bg-violet-50 border-violet-300 text-violet-700" },
  { value: "maladie",  label: "MALADIE",  icon: HeartPulse,     color: "bg-rose-50 border-rose-300 text-rose-700" },
  { value: "absence",  label: "ABSENCE",  icon: UserX,          color: "bg-slate-50 border-slate-300 text-slate-600" },
];

const BREAK_OPTIONS = [
  { value: 0, label: "0m" },
  { value: 15, label: "15m" },
  { value: 20, label: "20m" },
  { value: 30, label: "30m" },
  { value: 45, label: "45m" },
  { value: 60, label: "1h" },
  { value: 75, label: "1h15" },
  { value: 90, label: "1h30" },
];

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function workedHours(start: string, end: string, breakMin: number): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const total = (eh * 60 + em) - (sh * 60 + sm) - breakMin;
  return Math.max(0, total / 60);
}

function fmtH(h: number) {
  const hours = Math.floor(h);
  const min = Math.round((h - hours) * 60);
  return min > 0 ? `${hours}h${String(min).padStart(2, "0")}` : `${hours}h`;
}

function getDaysInMonth(year: number, month: number) {
  const days: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  let week: Date[] = [];
  days.forEach(day => {
    const dow = (day.getDay() + 6) % 7;
    if (dow === 0 && week.length > 0) { weeks.push(week); week = []; }
    week.push(day);
  });
  if (week.length > 0) weeks.push(week);
  return weeks;
}

interface SaveForm {
  entryType: EntryType;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  projectId: number | null;
  panier: boolean;
  note: string;
}

const defaultForm = (): SaveForm => ({
  entryType: "travail",
  startTime: "08:00",
  endTime: "",
  breakMinutes: 20,
  projectId: null,
  panier: true,
  note: "",
});

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR_LONG = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DAYS_FR_SHORT = ["LUN", "MAR", "MER", "JEU", "VEN"];

function getCurrentWeekBounds() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function isDateEditableByTechnician(dateStr: string): boolean {
  const { monday, sunday } = getCurrentWeekBounds();
  const d = new Date(dateStr + "T12:00:00");
  return d >= monday && d <= sunday;
}

export default function HoursPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState<SaveForm>(defaultForm());
  const [selectedTechId, setSelectedTechId] = useState<number | null>(null);
  const [hrMode, setHrMode] = useState(false);
  const [hrTechIds, setHrTechIds] = useState<Set<number>>(new Set());
  const [hrDate, setHrDate] = useState<string>("");
  const [exportMode, setExportMode] = useState<"mois" | "plage">("mois");
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");

  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();
  const role = meQuery.data?.role;

  const techniciansQuery = trpc.management.timeEntries.listTechnicians.useQuery(undefined, { enabled: role === "admin" });
  const myTechProfileQuery = trpc.management.timeEntries.myTechnicianId.useQuery(undefined, { enabled: role === "technicien" });

  const updateContractHoursMut = trpc.management.timeEntries.updateContractHours.useMutation({
    onSuccess: async () => { toast.success("Catégorie mise à jour."); await utils.management.timeEntries.listTechnicians.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const myTechId: number | null = useMemo(() => {
    if (role === "admin") return selectedTechId;
    if (role === "technicien") return myTechProfileQuery.data?.technicianId ?? null;
    return null;
  }, [role, selectedTechId, myTechProfileQuery.data]);

  const projectsQuery = trpc.management.projects.list.useQuery();

  const entriesQuery = trpc.management.timeEntries.list.useQuery(
    { technicianId: myTechId!, year, month },
    { enabled: myTechId != null }
  );

  const rangeEntriesQuery = trpc.management.timeEntries.listRange.useQuery(
    { technicianId: myTechId!, startDate: exportStart, endDate: exportEnd },
    { enabled: exportMode === "plage" && !!myTechId && !!exportStart && !!exportEnd && exportStart <= exportEnd }
  );

  const saveMutation = trpc.management.timeEntries.save.useMutation({
    onError: e => toast.error(e.message),
  });

  const deleteMutation = trpc.management.timeEntries.delete.useMutation({
    onSuccess: async () => {
      toast.success("Entrée supprimée.");
      await utils.management.timeEntries.list.invalidate({ technicianId: myTechId!, year, month });
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    if (role === "admin" && !selectedTechId && techniciansQuery.data?.length) {
      setSelectedTechId(techniciansQuery.data[0].id);
    }
  }, [role, selectedTechId, techniciansQuery.data]);

  const days = getDaysInMonth(year, month);
  const weeks = getWeeks(days);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof entriesQuery.data>[number][]>();
    (entriesQuery.data ?? []).forEach(e => {
      const existing = map.get(e.date) ?? [];
      map.set(e.date, [...existing, e]);
    });
    return map;
  }, [entriesQuery.data]);

  const weekTotals = useMemo(() => weeks.map(week => {
    let total = 0;
    week.forEach(day => {
      const ds = toLocalDateString(day);
      (entriesByDate.get(ds) ?? []).forEach(e => {
        if (e.entryType === "travail" && e.startTime && e.endTime) {
          total += workedHours(e.startTime, e.endTime, e.breakMinutes);
        }
      });
    });
    return total;
  }), [weeks, entriesByDate]);

  const selectedTech = techniciansQuery.data?.find(t => t.id === selectedTechId);
  const contractHours: "35h" | "39h" = (selectedTech?.contractHours as "35h" | "39h") ?? "39h";
  const weeklyTarget = contractHours === "35h" ? 35 : 39;

  const monthTotal = weekTotals.reduce((a, b) => a + b, 0);
  const hasOvertime = weekTotals.some(w => w > weeklyTarget);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const openAdd = (dateStr: string) => {
    setSelectedDate(dateStr);
    setForm(defaultForm());
    setAddOpen(true);
  };

  const openDetail = (dateStr: string) => {
    setDetailDate(dateStr);
    setDetailOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    const techIds = (role === "admin" && hrMode && hrTechIds.size > 0)
      ? Array.from(hrTechIds)
      : myTechId ? [myTechId] : [];
    if (techIds.length === 0) return;
    try {
      for (const techId of techIds) {
        await saveMutation.mutateAsync({
          technicianId: techId,
          date: selectedDate,
          entryType: form.entryType,
          startTime: form.entryType === "travail" ? form.startTime : null,
          endTime: form.entryType === "travail" ? (form.endTime || null) : null,
          breakMinutes: form.entryType === "travail" ? form.breakMinutes : 0,
          projectId: form.projectId,
          panier: form.panier,
          note: form.note || null,
        });
      }
      toast.success(techIds.length > 1 ? `Saisie effectuée pour ${techIds.length} techniciens.` : "Heures enregistrées.");
      if (myTechId) await utils.management.timeEntries.list.invalidate({ technicianId: myTechId, year, month });
      setAddOpen(false);
    } catch {
      // Erreur affichée par onError
    }
  };

  const exportPDF = () => {
    const techName = role === "admin"
      ? (techniciansQuery.data?.find(t => t.id === selectedTechId)
          ? `${techniciansQuery.data!.find(t => t.id === selectedTechId)!.firstName} ${techniciansQuery.data!.find(t => t.id === selectedTechId)!.lastName}`.trim()
          : "Technicien")
      : (meQuery.data?.name ?? "Technicien");

    // Determine entries and days for the chosen mode
    let pdfEntries: NonNullable<typeof entriesQuery.data>;
    let pdfDays: Date[];
    let periodLabel: string;
    let pdfFileName: string;

    if (exportMode === "plage" && exportStart && exportEnd && rangeEntriesQuery.data) {
      pdfEntries = rangeEntriesQuery.data;
      pdfDays = [];
      const cur = new Date(exportStart + "T12:00:00");
      const end = new Date(exportEnd + "T12:00:00");
      while (cur <= end) {
        pdfDays.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      periodLabel = `${new Date(exportStart + "T12:00:00").toLocaleDateString("fr-FR")} → ${new Date(exportEnd + "T12:00:00").toLocaleDateString("fr-FR")}`;
      pdfFileName = `heures_${techName.replace(/\s+/g, "_")}_${exportStart}_${exportEnd}.pdf`;
    } else {
      pdfEntries = entriesQuery.data ?? [];
      pdfDays = getDaysInMonth(year, month);
      periodLabel = `${MONTHS_FR[month - 1]} ${year}`;
      pdfFileName = `heures_${techName.replace(/\s+/g, "_")}_${year}_${String(month).padStart(2, "0")}.pdf`;
    }

    // Build entries map for PDF
    const pdfEntriesByDate = new Map<string, typeof pdfEntries>();
    pdfEntries.forEach(e => {
      const existing = pdfEntriesByDate.get(e.date) ?? [];
      pdfEntriesByDate.set(e.date, [...existing, e]);
    });

    // Filter out weekends
    const weekdayDays = pdfDays.filter(d => {
      const dow = (d.getDay() + 6) % 7;
      return dow < 5; // Mon=0 … Fri=4
    });

    const pdfWeeks = getWeeks(weekdayDays);

    // Compute week totals for PDF
    const pdfWeekTotals = pdfWeeks.map(week =>
      week.reduce((acc, day) => {
        const ds = toLocalDateString(day);
        return acc + (pdfEntriesByDate.get(ds) ?? []).reduce((s, e) => {
          if (e.entryType === "travail" && e.startTime && e.endTime) s += workedHours(e.startTime, e.endTime, e.breakMinutes);
          return s;
        }, 0);
      }, 0)
    );
    const pdfWeeklyTarget = weeklyTarget;
    const pdfTotal = pdfWeekTotals.reduce((a, b) => a + b, 0);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;
    const ML = 12;
    const colW = [32, 22, 16, 16, 14, 16, 80, 14, 0];
    const noteW = pageW - ML * 2 - colW.slice(0, 8).reduce((a, b) => a + b, 0);
    colW[8] = noteW;
    const headers = ["Date", "Type", "Début", "Fin", "Pause", "Heures", "Chantier", "Panier", "Note"];

    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Feuille de temps — ${periodLabel}`, ML, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Technicien : ${techName}`, ML, y);
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, pageW - ML, y, { align: "right" });
    y += 6;

    doc.setFillColor(37, 99, 235);
    doc.setTextColor(255, 255, 255);
    doc.rect(ML, y, pageW - ML * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    let x = ML + 1;
    headers.forEach((h, i) => { doc.text(h, x, y + 4); x += colW[i]; });
    doc.setTextColor(0, 0, 0);
    y += 6;

    let totalPaniers = 0;

    pdfWeeks.forEach((week, wi) => {
      const weekHours = pdfWeekTotals[wi];
      const weekOver = weekHours > pdfWeeklyTarget;

      doc.setFillColor(241, 245, 249);
      doc.rect(ML, y, pageW - ML * 2, 4.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      if (weekOver) doc.setTextColor(220, 38, 38); else doc.setTextColor(100, 116, 139);
      doc.text(`Semaine ${wi + 1} — ${fmtH(weekHours)}${weekOver ? " ⚠ HEURES SUP" : ""}`, ML + 1, y + 3);
      doc.setTextColor(0, 0, 0);
      y += 4.5;

      week.forEach(day => {
        const ds = toLocalDateString(day);
        const dayEntries = pdfEntriesByDate.get(ds) ?? [];
        const dayHours = dayEntries.reduce((acc, e) => {
          if (e.entryType === "travail" && e.startTime && e.endTime) return acc + workedHours(e.startTime, e.endTime, e.breakMinutes);
          return acc;
        }, 0);
        const dayOver = dayHours > 8;

        if (dayEntries.length === 0) {
          if (y > 185) { doc.addPage(); y = 15; }
          doc.setFillColor(255, 255, 255);
          doc.rect(ML, y, pageW - ML * 2, 5, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(200, 200, 200);
          const m = day.getMonth() + 1;
          doc.text(`${DAYS_FR_LONG[(day.getDay() + 6) % 7].substring(0, 3)} ${day.getDate().toString().padStart(2, "0")}/${String(m).padStart(2, "0")}`, ML + 1, y + 3.5);
          doc.setTextColor(0, 0, 0);
          y += 5;
          return;
        }

        dayEntries.forEach((e, ei) => {
          if (y > 185) { doc.addPage(); y = 15; }
          const rowH = 5.5;
          const bg = ei % 2 === 0 ? [255, 255, 255] : [250, 251, 253];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(ML, y, pageW - ML * 2, rowH, "F");
          doc.setFont("helvetica", ei === 0 ? "bold" : "normal");
          doc.setFontSize(7.5);
          x = ML + 1;

          if (ei === 0) {
            const m = day.getMonth() + 1;
            const dateLabel = `${DAYS_FR_LONG[(day.getDay() + 6) % 7].substring(0, 3)} ${day.getDate().toString().padStart(2, "0")}/${String(m).padStart(2, "0")}`;
            doc.setTextColor(0, 0, 0);
            doc.text(dateLabel, x, y + rowH / 2 + 1.5);
          }
          x += colW[0];

          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(ENTRY_TYPES.find(t => t.value === e.entryType)?.label ?? e.entryType.toUpperCase(), x, y + rowH / 2 + 1.5);
          x += colW[1];

          doc.setFont("helvetica", "normal");
          doc.text(e.startTime ?? "—", x, y + rowH / 2 + 1.5); x += colW[2];
          doc.text(e.endTime ?? "—", x, y + rowH / 2 + 1.5); x += colW[3];
          doc.text(e.breakMinutes > 0 ? `${e.breakMinutes}m` : "—", x, y + rowH / 2 + 1.5); x += colW[4];

          const hVal = e.entryType === "travail" && e.startTime && e.endTime
            ? workedHours(e.startTime, e.endTime, e.breakMinutes) : null;
          const hLabel = hVal !== null ? fmtH(hVal) : "—";
          doc.setFont("helvetica", "bold");
          if (dayOver && hVal !== null) doc.setTextColor(220, 38, 38); else doc.setTextColor(0, 0, 0);
          doc.text(hLabel, x, y + rowH / 2 + 1.5); x += colW[5];
          doc.setTextColor(0, 0, 0);

          doc.setFont("helvetica", "normal");
          const project = (projectsQuery.data ?? []).find(p => p.id === e.projectId);
          doc.text(project ? `${project.reference} — ${project.title}`.substring(0, 38) : "—", x, y + rowH / 2 + 1.5); x += colW[6];
          if (e.panier) totalPaniers++;
          doc.text(e.panier ? "OUI" : "NON", x, y + rowH / 2 + 1.5); x += colW[7];
          doc.text((e.note ?? "").substring(0, 40), x, y + rowH / 2 + 1.5);
          y += rowH;
        });
      });
    });

    y += 3;
    if (y > 185) { doc.addPage(); y = 15; }
    doc.setFillColor(37, 99, 235);
    doc.setTextColor(255, 255, 255);
    doc.rect(ML, y, pageW - ML * 2, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Total heures travaillées : ${fmtH(pdfTotal)}`, ML + 2, y + 4.8);
    doc.text(`Paniers repas : ${totalPaniers}`, pageW / 2, y + 4.8, { align: "center" });
    if (pdfWeekTotals.some(w => w > weeklyTarget)) doc.text("⚠ Heures supplémentaires", pageW - ML - 2, y + 4.8, { align: "right" });
    doc.setTextColor(0, 0, 0);

    doc.save(pdfFileName);
  };

  const detailEntries = detailDate ? (entriesByDate.get(detailDate) ?? []) : [];
  const detailDay = detailDate ? new Date(detailDate + "T12:00:00") : null;

  if (role === "client") return null;

  return (
    <DashboardLayout>
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Suivi des <span className="text-primary">Heures</span>
          </h1>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mt-0.5">
            Feuille de temps · Saisie quotidienne
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            <button
              onClick={() => setExportMode("mois")}
              className={`px-3 py-1.5 transition-colors ${exportMode === "mois" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-slate-50"}`}
            >
              Mois
            </button>
            <button
              onClick={() => setExportMode("plage")}
              className={`px-3 py-1.5 transition-colors ${exportMode === "plage" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-slate-50"}`}
            >
              Plage
            </button>
          </div>
          {exportMode === "plage" && (
            <>
              <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)}
                className="rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)}
                className="rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
            </>
          )}
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportPDF}
            disabled={
              !myTechId ||
              (exportMode === "mois" && !entriesQuery.data) ||
              (exportMode === "plage" && (!exportStart || !exportEnd || exportStart > exportEnd || !rangeEntriesQuery.data))
            }
          >
            <FileDown className="h-4 w-4" />
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Admin: technician selector / Mode RH */}
      {role === "admin" && techniciansQuery.data && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </div>
            {!hrMode ? (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedTechId?.toString() ?? ""}
                  onValueChange={v => setSelectedTechId(Number(v))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choisir un technicien" />
                  </SelectTrigger>
                  <SelectContent>
                    {techniciansQuery.data.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.firstName} {t.lastName} {t.employeeCode ? `(${t.employeeCode})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTech && (
                  <div className="flex items-center gap-1 rounded-lg border border-border overflow-hidden text-xs font-semibold">
                    {(["35h", "39h"] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => updateContractHoursMut.mutate({ technicianId: selectedTech.id, contractHours: opt })}
                        className={`px-2.5 py-1.5 transition-colors ${contractHours === opt ? "bg-primary text-white" : "text-muted-foreground hover:bg-slate-50"}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {techniciansQuery.data.map(t => {
                  const sel = hrTechIds.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setHrTechIds(prev => {
                        const next = new Set(prev);
                        if (sel) next.delete(t.id); else next.add(t.id);
                        return next;
                      })}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${sel ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-600 hover:border-primary/50"}`}
                    >
                      {t.firstName} {t.lastName}
                    </button>
                  );
                })}
              </div>
            )}
            <Button
              variant={hrMode ? "default" : "outline"}
              size="sm"
              className="gap-1.5 ml-auto"
              onClick={() => { setHrMode(m => !m); setHrTechIds(new Set()); }}
            >
              <Users className="h-3.5 w-3.5" />
              {hrMode ? "Mode individuel" : "Mode RH"}
            </Button>
          </div>
          {hrMode && (
            <div className="flex flex-wrap items-center gap-2 pl-11">
              <input
                type="date"
                value={hrDate}
                onChange={e => setHrDate(e.target.value)}
                className="rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                size="sm"
                disabled={hrTechIds.size === 0 || !hrDate}
                onClick={() => { setSelectedDate(hrDate); setForm(defaultForm()); setAddOpen(true); }}
              >
                Saisir · {hrTechIds.size} technicien{hrTechIds.size !== 1 ? "s" : ""}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Calendar nav + totals */}
      <div className="rounded-2xl border border-border/60 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-base font-bold">{MONTHS_FR[month - 1]} {year}</p>
            <div className="mt-1 flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Total : <strong>{fmtH(monthTotal)}</strong></span>
              {hasOvertime ? (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">⚠ Heures sup ce mois</span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">Pas d'heures sup</span>
              )}
            </div>
          </div>
          <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                {DAYS_FR_SHORT.map(d => (
                  <th key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {d}
                  </th>
                ))}
                <th className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-primary w-20">
                  TOTAL SEM.
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => {
                const weekTotal = weekTotals[wi];
                const isOver35 = weekTotal > weeklyTarget;
                // 5 columns: Mon(0)..Fri(4) — weekends excluded
                const padded = Array.from({ length: 5 }, (_, i) =>
                  week.find(d => (d.getDay() + 6) % 7 === i) ?? null
                );
                return (
                  <tr key={wi} className="border-t border-slate-100">
                    {padded.map((day, di) => {
                      if (!day) return <td key={di} className="h-16 border-r border-slate-100 bg-slate-50/40" />;
                      const ds = toLocalDateString(day);
                      const isToday = ds === toLocalDateString(new Date());
                      const dayEntries = entriesByDate.get(ds) ?? [];
                      const dayHours = dayEntries.reduce((acc, e) => {
                        if (e.entryType === "travail" && e.startTime && e.endTime) {
                          return acc + workedHours(e.startTime, e.endTime, e.breakMinutes);
                        }
                        return acc;
                      }, 0);

                      return (
                        <td
                          key={di}
                          className={`relative h-12 md:h-16 border-r border-slate-100 align-top p-1 text-xs bg-white ${isToday ? "ring-2 ring-inset ring-primary" : ""} ${dayEntries.length > 0 ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""}`}
                          onClick={() => dayEntries.length > 0 && openDetail(ds)}
                          title={dayEntries.length > 0 ? "Voir le détail" : undefined}
                        >
                          <div className="flex items-start justify-between">
                            <span className={`text-[11px] font-medium leading-none ${isToday ? "text-primary font-bold" : "text-slate-700"}`}>
                              {day.getDate()}
                            </span>
                            {((role === "admin" && (hrMode ? hrTechIds.size > 0 : !!myTechId)) || (role === "technicien" && !!myTechId && isDateEditableByTechnician(ds))) && (
                              <button
                                onClick={e => { e.stopPropagation(); openAdd(ds); }}
                                className="rounded p-0.5 text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors leading-none"
                              >
                                <span className="text-sm leading-none">+</span>
                              </button>
                            )}
                          </div>
                          <div className="mt-0.5 space-y-0.5">
                            {dayEntries.map(e => {
                              const et = ENTRY_TYPES.find(t => t.value === e.entryType);
                              const h = e.entryType === "travail" && e.startTime && e.endTime
                                ? workedHours(e.startTime, e.endTime, e.breakMinutes)
                                : null;
                              const shortLabel = { travail: "TRV", conge: "CGÉ", cfa: "CFA", maladie: "MAL", absence: "ABS" }[e.entryType] ?? e.entryType.slice(0, 3).toUpperCase();
                              return (
                                <div
                                  key={e.id}
                                  className={`flex items-center justify-between rounded px-0.5 py-0.5 text-[8px] font-bold border ${et?.color ?? ""}`}
                                >
                                  <span className="truncate">{shortLabel}</span>
                                  {h !== null && <span className="shrink-0 ml-0.5">{fmtH(h)}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                    <td className="h-16 w-20 border-r-0 bg-slate-50 px-2 align-middle text-center">
                      <p className="text-xs font-bold text-slate-500">TOTAL</p>
                      <p className={`text-sm font-bold ${isOver35 ? "text-rose-600" : "text-foreground"}`}>
                        {fmtH(weekTotal)}
                      </p>
                      {isOver35 && (
                        <p className="text-[9px] text-rose-500">+{fmtH(weekTotal - weeklyTarget)} sup</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {detailDay?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {detailEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune entrée pour ce jour.</p>
            ) : detailEntries.map(e => {
              const et = ENTRY_TYPES.find(t => t.value === e.entryType);
              const h = e.entryType === "travail" && e.startTime && e.endTime
                ? workedHours(e.startTime, e.endTime, e.breakMinutes)
                : null;
              const project = (projectsQuery.data ?? []).find(p => p.id === e.projectId);
              return (
                <div key={e.id} className={`rounded-xl border-2 p-3 ${et?.color ?? "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {et && <et.icon className="h-4 w-4" />}
                        <span className="text-sm font-bold">{et?.label}</span>
                        {h !== null && (
                          <span className="ml-auto text-sm font-bold">{fmtH(h)}</span>
                        )}
                      </div>
                      {e.entryType === "travail" && e.startTime && e.endTime && (
                        <p className="text-xs text-muted-foreground">
                          {e.startTime} → {e.endTime}
                          {e.breakMinutes > 0 && ` · Pause ${e.breakMinutes}m`}
                        </p>
                      )}
                      {project && (
                        <p className="text-xs font-medium">{project.reference} — {project.title}</p>
                      )}
                      {e.entryType === "travail" && (
                        <p className="text-xs text-muted-foreground">Panier : {e.panier ? "OUI" : "NON"}</p>
                      )}
                      {e.note && (
                        <p className="text-xs italic text-muted-foreground">{e.note}</p>
                      )}
                    </div>
                    {(role === "admin" || (role === "technicien" && isDateEditableByTechnician(e.date))) && (
                      <button
                        onClick={() => deleteMutation.mutate({ id: e.id })}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Supprimer cette entrée"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            {detailDate && myTechId && (role === "admin" || (role === "technicien" && isDateEditableByTechnician(detailDate))) && (
              <Button
                variant="outline"
                onClick={() => { setDetailOpen(false); openAdd(detailDate); }}
              >
                + Ajouter une entrée
              </Button>
            )}
            <Button onClick={() => setDetailOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {role === "admin" && hrMode ? "Saisie RH groupée" : "Saisie des heures"}
            </DialogTitle>
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            )}
            {role === "admin" && hrMode && hrTechIds.size > 0 && (
              <p className="text-xs font-semibold text-primary">
                {hrTechIds.size} technicien{hrTechIds.size !== 1 ? "s" : ""} sélectionné{hrTechIds.size !== 1 ? "s" : ""}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              {ENTRY_TYPES.map(et => {
                const Icon = et.icon;
                const isActive = form.entryType === et.value;
                return (
                  <button
                    key={et.value}
                    onClick={() => setForm(f => ({ ...f, entryType: et.value }))}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all ${isActive ? et.color + " border-current shadow-sm" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {et.label}
                  </button>
                );
              })}
            </div>

            {form.entryType === "travail" && (
              <>
                {/* Chantier */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Briefcase className="h-3 w-3" /> Chantier (optionnel)
                  </label>
                  <Select
                    value={form.projectId?.toString() ?? "none"}
                    onValueChange={v => setForm(f => ({ ...f, projectId: v === "none" ? null : Number(v) }))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Aucun chantier spécifique" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun chantier spécifique</SelectItem>
                      {(projectsQuery.data ?? []).map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.reference} — {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Début / Fin */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Début</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-2 py-3 text-center text-lg font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fin <span className="text-rose-500">*</span></label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full rounded-xl border-2 border-rose-300 bg-rose-50 px-2 py-3 text-center text-lg font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="--:--"
                    />
                  </div>
                </div>
                {form.startTime && form.endTime && (
                  <p className="text-center text-xs text-muted-foreground">
                    = <strong>{fmtH(workedHours(form.startTime, form.endTime, form.breakMinutes))}</strong> travaillées
                  </p>
                )}

                {/* Pause */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Coffee className="h-3 w-3" /> Pause
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BREAK_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setForm(f => ({ ...f, breakMinutes: opt.value }))}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${form.breakMinutes === opt.value ? "bg-foreground text-background" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panier */}
                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    🍽 Panier repas
                  </div>
                  <div className="flex gap-1.5">
                    {([true, false] as const).map(v => (
                      <button
                        key={String(v)}
                        onClick={() => setForm(f => ({ ...f, panier: v }))}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition-colors ${form.panier === v ? (v ? "bg-primary text-white" : "bg-slate-200 text-slate-700") : "bg-slate-100 text-slate-400"}`}
                      >
                        {v ? "OUI" : "NON"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Commentaire */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Commentaire (optionnel)
            </label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
              placeholder="Notes sur cette journée…"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Fermer</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || (role === "admin" && hrMode && hrTechIds.size === 0)}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {saveMutation.isPending
                ? "Enregistrement…"
                : (role === "admin" && hrMode && hrTechIds.size > 1 ? `Valider · ${hrTechIds.size} tech.` : "Valider")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
