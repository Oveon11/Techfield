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
  GraduationCap,
  HeartPulse,
  UserX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
    const dow = (day.getDay() + 6) % 7; // 0=lun
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
  endTime: "17:00",
  breakMinutes: 60,
  projectId: null,
  panier: true,
  note: "",
});

export default function HoursPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SaveForm>(defaultForm());
  const [selectedTechId, setSelectedTechId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();
  const role = meQuery.data?.role;

  const techniciansQuery = trpc.management.timeEntries.listTechnicians.useQuery(undefined, { enabled: role === "admin" });
  const myTechProfileQuery = trpc.management.timeEntries.myTechnicianId.useQuery(undefined, { enabled: role === "technicien" });

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

  const saveMutation = trpc.management.timeEntries.save.useMutation({
    onSuccess: async () => {
      toast.success("Heures enregistrées.");
      await utils.management.timeEntries.list.invalidate({ technicianId: myTechId!, year, month });
      setDialogOpen(false);
    },
    onError: e => toast.error(e.message),
  });

  const deleteMutation = trpc.management.timeEntries.delete.useMutation({
    onSuccess: async () => {
      toast.success("Entrée supprimée.");
      await utils.management.timeEntries.list.invalidate({ technicianId: myTechId!, year, month });
    },
    onError: e => toast.error(e.message),
  });

  // Auto-select first technician for admin
  useEffect(() => {
    if (role === "admin" && !selectedTechId && techniciansQuery.data?.length) {
      setSelectedTechId(techniciansQuery.data[0].id);
    }
  }, [role, selectedTechId, techniciansQuery.data]);

  const days = getDaysInMonth(year, month);
  const weeks = getWeeks(days);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, typeof entriesQuery.data>();
    (entriesQuery.data ?? []).forEach(e => {
      const existing = map.get(e.date) ?? [];
      map.set(e.date, [...existing, e]);
    });
    return map;
  }, [entriesQuery.data]);

  // Weekly hour totals
  const weekTotals = useMemo(() => weeks.map(week => {
    let total = 0;
    week.forEach(day => {
      const ds = toLocalDateString(day);
      (entriesByDate.get(ds) ?? [])?.forEach(e => {
        if (e.entryType === "travail" && e.startTime && e.endTime) {
          total += workedHours(e.startTime, e.endTime, e.breakMinutes);
        }
      });
    });
    return total;
  }), [weeks, entriesByDate]);

  const monthTotal = weekTotals.reduce((a, b) => a + b, 0);
  const hasOvertime = weekTotals.some(w => w > 35);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const openAdd = (dateStr: string) => {
    setSelectedDate(dateStr);
    setForm(defaultForm());
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!myTechId || !selectedDate) return;
    saveMutation.mutate({
      technicianId: myTechId,
      date: selectedDate,
      entryType: form.entryType,
      startTime: form.entryType === "travail" ? form.startTime : null,
      endTime: form.entryType === "travail" ? form.endTime : null,
      breakMinutes: form.entryType === "travail" ? form.breakMinutes : 0,
      projectId: form.projectId,
      panier: form.panier,
      note: form.note || null,
    });
  };

  const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const DAYS_FR = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

  const selectedTech = techniciansQuery.data?.find(t => t.id === selectedTechId);

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
      </div>

      {/* Admin: technician selector */}
      {role === "admin" && techniciansQuery.data && (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </div>
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
                {DAYS_FR.map(d => (
                  <th key={d} className={`py-2 text-center text-[10px] font-bold uppercase tracking-wider ${d === "SAM" || d === "DIM" ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
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
                const isOver35 = weekTotal > 35;
                // Pad week to 7 days
                const padded = Array.from({ length: 7 }, (_, i) => {
                  const dayOfWeek = week[0] ? (week[0].getDay() + 6) % 7 : 0;
                  const offset = i - dayOfWeek;
                  if (offset < 0 || offset >= week.length) return null;
                  return week[offset] ?? null;
                });
                return (
                  <tr key={wi} className="border-t border-slate-100">
                    {padded.map((day, di) => {
                      if (!day) return <td key={di} className="h-16 border-r border-slate-100 bg-slate-50/40" />;
                      const ds = toLocalDateString(day);
                      const isToday = ds === toLocalDateString(new Date());
                      const dayEntries = entriesByDate.get(ds) ?? [];
                      const isWeekend = di >= 5;
                      const dayHours = dayEntries.reduce((acc, e) => {
                        if (e.entryType === "travail" && e.startTime && e.endTime) {
                          return acc + workedHours(e.startTime, e.endTime, e.breakMinutes);
                        }
                        return acc;
                      }, 0);

                      return (
                        <td
                          key={di}
                          className={`relative h-16 border-r border-slate-100 align-top p-1 text-xs ${isWeekend ? "bg-slate-50/60" : "bg-white"} ${isToday ? "ring-2 ring-inset ring-primary" : ""}`}
                        >
                          <div className="flex items-start justify-between">
                            <span className={`text-[11px] font-medium ${isToday ? "text-primary font-bold" : isWeekend ? "text-slate-400" : "text-slate-700"}`}>
                              {day.getDate()}
                            </span>
                            {!isWeekend && myTechId && (
                              <button
                                onClick={() => openAdd(ds)}
                                className="rounded p-0.5 text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <span className="text-base leading-none">+</span>
                              </button>
                            )}
                          </div>
                          <div className="mt-0.5 space-y-0.5">
                            {dayEntries.map(e => {
                              const et = ENTRY_TYPES.find(t => t.value === e.entryType);
                              const h = e.entryType === "travail" && e.startTime && e.endTime
                                ? workedHours(e.startTime, e.endTime, e.breakMinutes)
                                : null;
                              return (
                                <div
                                  key={e.id}
                                  className={`flex items-center justify-between rounded px-1 py-0.5 text-[9px] font-semibold border ${et?.color ?? ""} cursor-pointer`}
                                  onClick={() => deleteMutation.mutate({ id: e.id })}
                                  title="Cliquer pour supprimer"
                                >
                                  <span>{et?.label}</span>
                                  {h !== null && <span>{fmtH(h)}</span>}
                                </div>
                              );
                            })}
                            {dayHours > 0 && dayEntries.length > 0 && (
                              <div className="text-[9px] text-right text-slate-400">{fmtH(dayHours)}</div>
                            )}
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
                        <p className="text-[9px] text-rose-500">+{fmtH(weekTotal - 35)} sup</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog saisie */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Saisie des heures
            </DialogTitle>
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
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
                    value={form.projectId?.toString() ?? ""}
                    onValueChange={v => setForm(f => ({ ...f, projectId: v ? Number(v) : null }))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Aucun chantier spécifique" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun chantier spécifique</SelectItem>
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
                    <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Début</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-center text-xl font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fin</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-center text-xl font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Fermer</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-foreground text-background hover:bg-foreground/90">
              {saveMutation.isPending ? "Enregistrement…" : "Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
