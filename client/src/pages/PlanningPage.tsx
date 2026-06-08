import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, MapPin, Clock, Tag,
  AlertTriangle, ChevronDown, ChevronRight as ChevronRightIcon, Layers,
  X, Phone, User, Building2, FileText, ExternalLink, Pencil, Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useRoleMatrix() {
  const auth = trpc.auth.me.useQuery();
  const matrix = trpc.security.roleMatrix.useQuery(undefined, { enabled: !!auth.data });
  return { permissions: matrix.data?.permissions, role: matrix.data?.role ?? auth.data?.role };
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function timeToMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minToTime(m: number) { return `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`; }
function getISOWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t.getTime() - y.getTime()) / 86400000) + 1) / 7);
}
function formatWeekLabel(monday: Date) {
  const fr = addDays(monday, 4);
  const mo = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const fri = fr.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `Sem. ${getISOWeek(monday)}  ·  ${mo} – ${fri}`;
}
function formatDateFr(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function mapsUrl(addr: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`; }

const WEEK_DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const H_START = 7;
const H_END   = 19;
const H_TOTAL = H_END - H_START;
const CELL_H  = 44; // px per hour in timeline
const LABEL_W = 168; // px for tech name column
const DAY_W   = H_TOTAL * CELL_H; // px per day column

const SERVICE_COLORS: Record<string, string> = {
  clim: "bg-sky-500", pac: "bg-violet-500", chauffe_eau: "bg-orange-500",
  pv: "bg-yellow-500", vmc: "bg-teal-500", autre: "bg-slate-500",
};
const SERVICE_LABELS: Record<string, string> = {
  clim: "Clim", pac: "PAC", chauffe_eau: "Chauffe-eau", pv: "PV", vmc: "VMC", autre: "Autre",
};
function slotColor(serviceType: string | null) { return SERVICE_COLORS[serviceType ?? ""] ?? "bg-primary"; }

// ─── Types ────────────────────────────────────────────────────────────────────

type Slot = {
  id: number; technicianId: number; technicianName: string | null;
  projectId: number | null; projectName: string | null; projectRef: string | null;
  projectAddress: string | null; projectServiceType: string | null;
  clientName: string | null; clientPhone: string | null; clientAddress: string | null;
  slotDate: string; startTime: string; endTime: string; notes: string | null; status: string;
  hasLocationChange: boolean; hasTimeChange: boolean; hasDiscount: boolean;
  discountNote: string | null; changeNote: string | null;
  prevDate: string | null; prevStartTime: string | null; prevEndTime: string | null;
};
type Technician = { id: number; name: string; firstName: string; lastName: string; email: string | null };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { permissions } = useRoleMatrix();
  const canManage = !!permissions?.manageInterventions;

  const [monday, setMonday] = useState<Date>(() => getMondayOf(new Date()));
  const [view, setView] = useState<"timeline" | "attribution">("timeline");
  const weekStart = toDateStr(monday);
  const dayDates = Array.from({ length: 5 }, (_, i) => toDateStr(addDays(monday, i)));

  const utils = trpc.useUtils();
  const { data: slots = [], isLoading: slotsLoading } = trpc.planning.listWeek.useQuery({ weekStart });
  const { data: technicians = [], isLoading: techLoading } = trpc.planning.listTechnicians.useQuery();
  const { data: projectsRaw = [] } = trpc.management.projects.list.useQuery();
  const projects = projectsRaw.map(p => ({ id: p.id, name: p.title, reference: p.reference }));

  const inv = () => utils.planning.listWeek.invalidate({ weekStart });
  const createMut = trpc.planning.create.useMutation({ onSuccess: () => { inv(); toast.success("Créneau créé"); }, onError: e => toast.error(e.message) });
  const updateMut = trpc.planning.update.useMutation({ onSuccess: () => { inv(); toast.success("Créneau mis à jour"); }, onError: e => toast.error(e.message) });
  const moveMut   = trpc.planning.move.useMutation({ onSuccess: inv, onError: e => toast.error(e.message) });
  const deleteMut = trpc.planning.delete.useMutation({ onSuccess: () => { inv(); toast.success("Créneau supprimé"); }, onError: e => toast.error(e.message) });

  const [createOpen, setCreateOpen] = useState(false);
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);
  const [editSlot, setEditSlot] = useState<Slot | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<Slot | null>(null);

  const goWeek = (n: number) => setMonday(d => addDays(d, n * 7));
  const isLoading = slotsLoading || techLoading;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Planning</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-white px-1 py-1 shadow-sm">
              <button onClick={() => goWeek(-1)} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-3 text-sm font-medium text-foreground min-w-[200px] text-center">{formatWeekLabel(monday)}</span>
              <button onClick={() => goWeek(1)} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button onClick={() => setMonday(getMondayOf(new Date()))} className="rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors shadow-sm">Aujourd'hui</button>
            <div className="flex rounded-xl border border-border bg-white shadow-sm overflow-hidden">
              <button onClick={() => setView("timeline")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${view === "timeline" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
                <Clock className="h-3.5 w-3.5" /> Timeline
              </button>
              <button onClick={() => setView("attribution")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${view === "attribution" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
                <Layers className="h-3.5 w-3.5" /> Attribution
              </button>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Créer
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Chargement…</div>
        ) : view === "timeline" ? (
          <WeekTimelineView
            slots={slots} technicians={technicians} dayDates={dayDates} canManage={canManage}
            onClickSlot={setDetailSlot}
            onMove={(id, date, start, end, prev) => moveMut.mutate({ id, slotDate: date, startTime: start, endTime: end, ...prev })}
          />
        ) : (
          <AttributionView slots={slots} technicians={technicians} dayDates={dayDates} canManage={canManage} onClickSlot={setDetailSlot} />
        )}

        {createOpen && (
          <SlotFormDialog open onClose={() => setCreateOpen(false)} technicians={technicians} projects={projects}
            onSave={rows => { rows.forEach(r => createMut.mutate(r)); setCreateOpen(false); }}
            saving={createMut.isPending} />
        )}
        {editSlot && (
          <SlotFormDialog open onClose={() => setEditSlot(null)} technicians={technicians} projects={projects}
            initialSlot={editSlot}
            onSave={rows => { rows.forEach(r => updateMut.mutate({ id: editSlot.id, ...r })); setEditSlot(null); }}
            saving={updateMut.isPending} />
        )}
        {detailSlot && (
          <SlotDetailDialog slot={detailSlot} onClose={() => setDetailSlot(null)}
            onEdit={() => { setEditSlot(detailSlot); setDetailSlot(null); }}
            onDelete={() => { setDeleteSlot(detailSlot); setDetailSlot(null); }}
            canManage={canManage} />
        )}
        <AlertDialog open={!!deleteSlot} onOpenChange={o => !o && setDeleteSlot(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
              <AlertDialogDescription>{deleteSlot?.projectName ?? "Créneau sans chantier"} — {deleteSlot?.slotDate} {deleteSlot?.startTime}–{deleteSlot?.endTime}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                onClick={() => { if (deleteSlot) { deleteMut.mutate({ id: deleteSlot.id }); setDeleteSlot(null); } }}>
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

// ─── Week Timeline View ───────────────────────────────────────────────────────
// Full week grid: technician rows × 5 day columns, each column = hourly timeline

type TimelineProps = {
  slots: Slot[]; technicians: Technician[]; dayDates: string[];
  canManage: boolean; onClickSlot: (s: Slot) => void;
  onMove: (id: number, date: string, start: string, end: string, prev: { prevDate?: string; prevStartTime?: string; prevEndTime?: string }) => void;
};

type SlotWithLane = Slot & { lane: number; totalLanes: number };

function computeLanes(daySlots: Slot[]): SlotWithLane[] {
  const sorted = [...daySlots].sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
  const laneEnds: number[] = [];
  const result: SlotWithLane[] = sorted.map(s => {
    const start = timeToMin(s.startTime);
    const end   = timeToMin(s.endTime);
    let lane = laneEnds.findIndex(e => e <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else { laneEnds[lane] = end; }
    return { ...s, lane, totalLanes: 0 };
  });
  // second pass: total lanes per overlapping group
  for (let i = 0; i < result.length; i++) {
    const { startTime: aS, endTime: aE, technicianId: tid } = result[i];
    let max = result[i].lane;
    for (let j = 0; j < result.length; j++) {
      if (i === j || result[j].technicianId !== tid) continue;
      if (timeToMin(result[j].startTime) < timeToMin(aE) && timeToMin(result[j].endTime) > timeToMin(aS))
        max = Math.max(max, result[j].lane);
    }
    result[i].totalLanes = max + 1;
  }
  return result;
}

function WeekTimelineView({ slots, technicians, dayDates, canManage, onClickSlot, onMove }: TimelineProps) {
  const today = toDateStr(new Date());
  const ROW_H = 68; // base height per slot lane

  // Drag / resize refs
  const dragRef  = useRef<{ id: number; dayIdx: number; origStart: number; origEnd: number; mouseX: number; date: string; origSStr: string; origEStr: string } | null>(null);
  const resizeRef = useRef<{ id: number; edge: "start" | "end"; dayIdx: number; origStart: number; origEnd: number; mouseX: number } | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragDx, setDragDx] = useState<Record<number, number>>({});
  const [resizeData, setResizeData] = useState<Record<number, { start: number; end: number }>>({});

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.mouseX;
      setDragDx(p => ({ ...p, [dragRef.current!.id]: dx }));
    }
    if (resizeRef.current) {
      const dx = e.clientX - resizeRef.current.mouseX;
      const dm = Math.round(dx / CELL_H * 60 / 15) * 15;
      const { id, edge, origStart, origEnd } = resizeRef.current;
      setResizeData(p => ({
        ...p,
        [id]: edge === "end"
          ? { start: origStart, end: Math.max(origStart + 15, Math.min(origEnd + dm, H_END * 60)) }
          : { start: Math.min(origEnd - 15, Math.max(origStart + dm, H_START * 60)), end: origEnd },
      }));
    }
  }, []);

  const onMouseUp = useCallback(() => {
    if (dragRef.current) {
      const { id, dayIdx, origStart, origEnd, mouseX: _, date, origSStr, origEStr } = dragRef.current;
      const dx = dragDx[id] ?? 0;
      if (Math.abs(dx) > 4) {
        const dm = Math.round(dx / CELL_H * 60 / 15) * 15;
        const dur = origEnd - origStart;
        const ns = Math.max(H_START * 60, Math.min(origStart + dm, H_END * 60 - dur));
        onMove(id, date, minToTime(ns), minToTime(ns + dur), { prevDate: date, prevStartTime: origSStr, prevEndTime: origEStr });
      }
      dragRef.current = null; setDraggingId(null); setDragDx({});
      void dayIdx;
    }
    if (resizeRef.current) {
      const { id } = resizeRef.current;
      const rd = resizeData[id];
      if (rd) {
        const s = slots.find(x => x.id === id);
        if (s) onMove(id, s.slotDate, minToTime(rd.start), minToTime(rd.end), { prevStartTime: s.startTime, prevEndTime: s.endTime });
      }
      resizeRef.current = null; setResizeData({});
    }
  }, [dragDx, resizeData, slots, onMove]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  // Build lane maps per technician per day
  type LaneMap = Map<string, SlotWithLane[]>; // key = `${techId}-${dateStr}`
  const laneMap: LaneMap = new Map();
  technicians.forEach(tech => {
    dayDates.forEach(d => {
      const key = `${tech.id}-${d}`;
      laneMap.set(key, computeLanes(slots.filter(s => s.technicianId === tech.id && s.slotDate === d)));
    });
  });
  const maxLanesPerTech = (techId: number) =>
    Math.max(1, ...dayDates.map(d => (laneMap.get(`${techId}-${d}`) ?? []).reduce((m, s) => Math.max(m, s.totalLanes), 1)));

  const totalW = LABEL_W + dayDates.length * DAY_W;

  return (
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalW }}>
          {/* ── Top header: day names + hour ruler ── */}
          <div className="sticky top-0 z-10 bg-white border-b border-border/60">
            {/* Day names row */}
            <div className="flex" style={{ marginLeft: LABEL_W }}>
              {dayDates.map((d, i) => {
                const date = new Date(d + "T00:00:00");
                const isToday = d === today;
                return (
                  <div key={d} style={{ width: DAY_W }} className={`flex items-center justify-center gap-2 border-l border-border/40 py-2 ${isToday ? "bg-primary/5" : ""}`}>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{WEEK_DAYS_FR[i]}</span>
                    <span className={`text-base font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{date.getDate()}</span>
                    {slots.filter(s => s.slotDate === d).length > 0 && (
                      <span className="rounded-full bg-primary/20 text-primary text-[10px] font-bold px-1.5">
                        {slots.filter(s => s.slotDate === d).length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Hour ruler row */}
            <div className="flex border-t border-border/30 bg-slate-50/60" style={{ marginLeft: LABEL_W }}>
              {dayDates.map(d => (
                <div key={d} style={{ width: DAY_W }} className="relative border-l border-border/40 flex">
                  {Array.from({ length: H_TOTAL + 1 }, (_, i) => (
                    <div key={i} style={{ width: CELL_H }} className="flex-shrink-0 text-[10px] text-muted-foreground pl-0.5 pb-1 border-l border-border/20 first:border-l-0">
                      {(H_START + i).toString().padStart(2, "0")}h
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ── Tech rows ── */}
          {technicians.map(tech => {
            const maxLanes = maxLanesPerTech(tech.id);
            const rowH = maxLanes * ROW_H;
            return (
              <div key={tech.id} className="flex border-b border-border/30 last:border-b-0">
                {/* Tech label */}
                <div style={{ width: LABEL_W, minHeight: rowH }} className="flex-shrink-0 flex items-start gap-2.5 px-3 py-3 bg-slate-50/80 border-r border-border/40">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                    {tech.firstName[0]}{tech.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate leading-tight">{tech.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Technicien</p>
                  </div>
                </div>

                {/* Day cells */}
                {dayDates.map((d, dayIdx) => {
                  const isToday = d === today;
                  const daySlots = laneMap.get(`${tech.id}-${d}`) ?? [];
                  return (
                    <div key={d} style={{ width: DAY_W, height: rowH }} className={`relative flex-shrink-0 border-l border-border/40 ${isToday ? "bg-primary/[0.02]" : ""}`}>
                      {/* Hour grid lines */}
                      {Array.from({ length: H_TOTAL }, (_, i) => (
                        <div key={i} style={{ left: i * CELL_H, width: CELL_H }} className="absolute top-0 bottom-0 border-l border-border/15" />
                      ))}
                      {/* Slots */}
                      {daySlots.map(slot => {
                        const origStart = timeToMin(slot.startTime);
                        const origEnd   = timeToMin(slot.endTime);
                        const isDragging = draggingId === slot.id;
                        const dx  = dragDx[slot.id] ?? 0;
                        const rd  = resizeData[slot.id];
                        const start = rd ? rd.start : Math.max(H_START * 60, origStart + (isDragging ? Math.round(dx / CELL_H * 60 / 15) * 15 : 0));
                        const end   = rd ? rd.end   : Math.min(H_END * 60,   origEnd   + (isDragging ? Math.round(dx / CELL_H * 60 / 15) * 15 : 0));
                        const left  = (start - H_START * 60) / 60 * CELL_H;
                        const width = Math.max(8, (end - start) / 60 * CELL_H);
                        const top   = slot.lane * ROW_H + 4;
                        const height = ROW_H - 10;
                        const color = slotColor(slot.projectServiceType);
                        const label = slot.projectName ?? slot.clientName ?? "Créneau";

                        return (
                          <div
                            key={slot.id}
                            style={{ left, top, width, height }}
                            className={`absolute rounded-lg ${color} text-white text-[11px] shadow-md cursor-pointer select-none overflow-hidden px-1.5 py-1 flex flex-col ${isDragging ? "shadow-xl ring-2 ring-white/50 opacity-90 z-20" : "hover:shadow-lg z-10 hover:brightness-105"}`}
                            onClick={() => onClickSlot(slot)}
                            onMouseDown={canManage ? e => {
                              e.preventDefault();
                              dragRef.current = { id: slot.id, dayIdx, origStart, origEnd, mouseX: e.clientX, date: d, origSStr: slot.startTime, origEStr: slot.endTime };
                              setDraggingId(slot.id);
                            } : undefined}
                          >
                            <div className="font-semibold leading-tight truncate">{label}</div>
                            <div className="text-white/80 text-[10px] leading-tight">{slot.startTime}–{slot.endTime}</div>
                            {slot.clientName && slot.projectName && (
                              <div className="text-white/70 text-[10px] leading-tight truncate">{slot.clientName}</div>
                            )}
                            <div className="flex gap-0.5 mt-auto">
                              {slot.hasLocationChange && <MapPin className="h-2.5 w-2.5 text-white/80" />}
                              {slot.hasTimeChange && <Clock className="h-2.5 w-2.5 text-white/80" />}
                              {slot.hasDiscount && <Tag className="h-2.5 w-2.5 text-white/80" />}
                            </div>
                            {/* Resize handles */}
                            {canManage && (
                              <>
                                <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { id: slot.id, edge: "start", dayIdx, origStart, origEnd, mouseX: e.clientX }; }} />
                                <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { id: slot.id, edge: "end", dayIdx, origStart, origEnd, mouseX: e.clientX }; }} />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {technicians.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">Aucun technicien actif.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Attribution View ─────────────────────────────────────────────────────────

function AttributionView({ slots, technicians, dayDates, canManage: _canManage, onClickSlot }: {
  slots: Slot[]; technicians: Technician[]; dayDates: string[]; canManage: boolean; onClickSlot: (s: Slot) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const today = toDateStr(new Date());
  const toggle = (id: number) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      <div className="grid border-b border-border/60 bg-slate-50/80" style={{ gridTemplateColumns: `${LABEL_W}px repeat(5, 1fr)` }}>
        <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Technicien</div>
        {dayDates.map((d, i) => {
          const date = new Date(d + "T00:00:00");
          return (
            <div key={d} className="px-2 py-3 text-center border-l border-border/40">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{WEEK_DAYS_FR[i]}</p>
              <p className={`text-base font-bold leading-none mt-0.5 ${d === today ? "text-primary" : "text-foreground"}`}>{date.getDate()}</p>
            </div>
          );
        })}
      </div>
      {technicians.map(tech => {
        const isExp = expanded.has(tech.id);
        const hasSlots = slots.some(s => s.technicianId === tech.id);
        return (
          <div key={tech.id} className="border-b border-border/30 last:border-b-0">
            <div className="grid items-center hover:bg-muted/30 transition-colors cursor-pointer" style={{ gridTemplateColumns: `${LABEL_W}px repeat(5, 1fr)` }} onClick={() => hasSlots && toggle(tech.id)}>
              <div className="flex items-center gap-2 px-3 py-3">
                {hasSlots ? (isExp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />) : <span className="w-3.5 h-3.5 shrink-0" />}
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">{tech.firstName[0]}{tech.lastName[0]}</div>
                <p className="text-sm font-semibold text-foreground truncate">{tech.name}</p>
              </div>
              {dayDates.map(d => {
                const count = slots.filter(s => s.technicianId === tech.id && s.slotDate === d).length;
                return (
                  <div key={d} className="border-l border-border/30 px-2 py-3 flex justify-center items-center min-h-[52px]">
                    {count === 0 ? <span className="text-[11px] text-muted-foreground/30">—</span> : (
                      <span className="rounded-full bg-primary/15 text-primary text-xs font-bold px-2 py-0.5">{count}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {isExp && (
              <div className="bg-slate-50/60 border-t border-border/30">
                {(() => {
                  const allDay = dayDates.map(d => slots.filter(s => s.technicianId === tech.id && s.slotDate === d));
                  const rows = Math.max(...allDay.map(a => a.length), 0);
                  return Array.from({ length: rows }, (_, ri) => (
                    <div key={ri} className="grid border-t border-border/20" style={{ gridTemplateColumns: `${LABEL_W}px repeat(5, 1fr)` }}>
                      <div className="px-4 py-1.5" />
                      {allDay.map((arr, di) => {
                        const slot = arr[ri];
                        if (!slot) return <div key={di} className="border-l border-border/20 px-2 py-1.5" />;
                        return (
                          <div key={di} className="border-l border-border/20 px-2 py-1.5">
                            <div className={`${slotColor(slot.projectServiceType)} text-white rounded-lg px-2 py-1.5 text-[11px] cursor-pointer hover:opacity-90 transition-opacity`} onClick={() => onClickSlot(slot)}>
                              <div className="font-semibold truncate">{slot.projectName ?? slot.clientName ?? "Créneau"}</div>
                              <div className="text-white/80 text-[10px]">{slot.startTime}–{slot.endTime}</div>
                              {slot.clientName && slot.projectName && <div className="text-white/70 text-[10px] truncate">{slot.clientName}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        );
      })}
      {technicians.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">Aucun technicien actif.</div>}
    </div>
  );
}

// ─── Slot Detail Dialog ───────────────────────────────────────────────────────

function SlotDetailDialog({ slot, onClose, onEdit, onDelete, canManage }: {
  slot: Slot; onClose: () => void; onEdit: () => void; onDelete: () => void; canManage: boolean;
}) {
  const color = slotColor(slot.projectServiceType);
  const address = slot.projectAddress || slot.clientAddress;
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base leading-snug">{slot.projectName ?? slot.clientName ?? "Créneau sans chantier"}</DialogTitle>
              {slot.projectRef && <p className="text-xs text-muted-foreground mt-0.5">Réf. {slot.projectRef}</p>}
            </div>
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          {/* Horaires */}
          <div className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-3 bg-muted/30">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium">{formatDateFr(slot.slotDate)}</p>
              <p className="text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
            </div>
            <StatusBadge status={slot.status} />
          </div>
          {/* Technicien */}
          {slot.technicianName && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/60 bg-white">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{slot.technicianName}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">Technicien</Badge>
            </div>
          )}
          {/* Alertes */}
          {(slot.hasLocationChange || slot.hasTimeChange || slot.hasDiscount) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-amber-800 font-medium text-xs uppercase tracking-wide"><AlertTriangle className="h-3.5 w-3.5" /> Modifications</div>
              {slot.hasLocationChange && <div className="flex items-center gap-2 text-amber-900 text-xs"><MapPin className="h-3.5 w-3.5" /> Changement de lieu</div>}
              {slot.hasTimeChange && slot.prevStartTime && (
                <div className="flex items-center gap-2 text-amber-900 text-xs"><Clock className="h-3.5 w-3.5" /> Déplacé depuis {slot.prevDate && slot.prevDate !== slot.slotDate ? `${slot.prevDate} ` : ""}{slot.prevStartTime}–{slot.prevEndTime}</div>
              )}
              {slot.hasDiscount && <div className="flex items-center gap-2 text-amber-900 text-xs"><Tag className="h-3.5 w-3.5" /> Remise{slot.discountNote ? ` : ${slot.discountNote}` : ""}</div>}
              {slot.changeNote && <p className="text-amber-800 text-xs italic">{slot.changeNote}</p>}
            </div>
          )}
          {/* Client */}
          {(slot.clientName || slot.clientPhone) && (
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Client</p>
              {slot.clientName && <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{slot.clientName}</span></div>}
              {slot.clientPhone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><a href={`tel:${slot.clientPhone}`} className="text-primary hover:underline">{slot.clientPhone}</a></div>}
              {slot.clientAddress && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground text-xs">{slot.clientAddress}</span></div>}
            </div>
          )}
          {/* Chantier */}
          {(slot.projectServiceType || address) && (
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Chantier</p>
              {slot.projectServiceType && <Badge variant="secondary" className="w-fit text-xs">{SERVICE_LABELS[slot.projectServiceType] ?? slot.projectServiceType}</Badge>}
              {address && (
                <div className="flex items-start gap-2 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">{address}</p>
                    <a href={mapsUrl(address)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary text-xs hover:underline mt-0.5">
                      <ExternalLink className="h-3 w-3" /> Ouvrir dans Maps
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Notes */}
          {slot.notes && (
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><FileText className="h-3.5 w-3.5" /> Notes</div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{slot.notes}</p>
            </div>
          )}
        </div>
        {canManage && (
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Modifier</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Slot Form Dialog ─────────────────────────────────────────────────────────

type SlotFormRow = {
  technicianId: number; projectId: number | null; slotDate: string;
  startTime: string; endTime: string; notes?: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  hasLocationChange: boolean; hasTimeChange: boolean; hasDiscount: boolean;
  discountNote?: string | null; changeNote?: string | null;
};

function SlotFormDialog({ open, onClose, technicians, projects, initialSlot, onSave, saving }: {
  open: boolean; onClose: () => void;
  technicians: Technician[];
  projects: { id: number; name: string; reference: string | null }[];
  initialSlot?: Slot | null;
  onSave: (rows: SlotFormRow[]) => void;
  saving: boolean;
}) {
  const [selectedTechIds, setSelectedTechIds] = useState<Set<number>>(
    new Set(initialSlot ? [initialSlot.technicianId] : technicians.slice(0, 1).map(t => t.id))
  );
  const [projId, setProjId]       = useState(initialSlot?.projectId ? String(initialSlot.projectId) : "none");
  const [date, setDate]           = useState(initialSlot?.slotDate ?? toDateStr(new Date()));
  const [startTime, setStartTime] = useState(initialSlot?.startTime ?? "08:00");
  const [endTime, setEndTime]     = useState(initialSlot?.endTime ?? "12:00");
  const [notes, setNotes]         = useState(initialSlot?.notes ?? "");
  const [status, setStatus]       = useState<SlotFormRow["status"]>((initialSlot?.status as SlotFormRow["status"]) ?? "scheduled");
  const [hasLocChange, setHasLocChange] = useState(initialSlot?.hasLocationChange ?? false);
  const [hasTimeChange, setHasTimeChange] = useState(initialSlot?.hasTimeChange ?? false);
  const [hasDiscount, setHasDiscount]     = useState(initialSlot?.hasDiscount ?? false);
  const [discountNote, setDiscountNote]   = useState(initialSlot?.discountNote ?? "");
  const [changeNote, setChangeNote]       = useState(initialSlot?.changeNote ?? "");

  const toggleTech = (id: number) => setSelectedTechIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const canSubmit = selectedTechIds.size > 0 && date && startTime && endTime && startTime < endTime;

  const handleSave = () => {
    const base: Omit<SlotFormRow, "technicianId"> = {
      projectId: projId !== "none" ? Number(projId) : null,
      slotDate: date, startTime, endTime,
      notes: notes.trim() || null, status,
      hasLocationChange: hasLocChange, hasTimeChange, hasDiscount,
      discountNote: discountNote.trim() || null,
      changeNote: changeNote.trim() || null,
    };
    onSave(Array.from(selectedTechIds).map(tid => ({ ...base, technicianId: tid })));
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initialSlot ? "Modifier le créneau" : "Nouveau créneau"}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          {/* Multi-select techniciens */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Technicien(s)</label>
            <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 p-2 bg-slate-50/60">
              {technicians.map(t => {
                const sel = selectedTechIds.has(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => toggleTech(t.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all border ${sel ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border hover:border-primary/40"}`}>
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${sel ? "bg-white/20" : "bg-primary/15 text-primary"}`}>
                      {t.firstName[0]}{t.lastName[0]}
                    </span>
                    {t.firstName}
                    {sel && <X className="h-3 w-3 opacity-70" />}
                  </button>
                );
              })}
            </div>
            {selectedTechIds.size > 1 && (
              <p className="text-xs text-muted-foreground">→ {selectedTechIds.size} créneaux identiques seront créés</p>
            )}
          </div>
          {/* Chantier */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chantier <span className="text-muted-foreground font-normal">(optionnel)</span></label>
            <Select value={projId} onValueChange={setProjId}>
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun chantier —</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.reference ? ` (${p.reference})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Date + Heures */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1"><label className="text-sm font-medium">Date</label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Début</label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} step={900} /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Fin</label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} step={900} /></div>
          </div>
          {/* Statut */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Statut</label>
            <Select value={status} onValueChange={v => setStatus(v as SlotFormRow["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Planifié</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Textarea placeholder="Informations complémentaires…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="resize-none" />
          </div>
          {/* Alertes */}
          <div className="rounded-xl border border-border/60 px-4 py-3 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alertes</p>
            <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={hasLocChange} onChange={e => setHasLocChange(e.target.checked)} className="h-4 w-4 rounded accent-primary" /><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">Changement de lieu</span></label>
            <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={hasTimeChange} onChange={e => setHasTimeChange(e.target.checked)} className="h-4 w-4 rounded accent-primary" /><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">Déplacement horaire</span></label>
            <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={hasDiscount} onChange={e => setHasDiscount(e.target.checked)} className="h-4 w-4 rounded accent-primary" /><Tag className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">Remise appliquée</span></label>
            {hasDiscount && <Input placeholder="Détail de la remise…" value={discountNote} onChange={e => setDiscountNote(e.target.value)} className="text-sm" />}
            {(hasLocChange || hasTimeChange) && <Input placeholder="Note sur la modification…" value={changeNote} onChange={e => setChangeNote(e.target.value)} className="text-sm" />}
          </div>
        </div>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!canSubmit || saving} onClick={handleSave}>{saving ? "Enregistrement…" : initialSlot ? "Modifier" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { label: string; className: string }> = {
    scheduled:   { label: "Planifié",  className: "bg-blue-100 text-blue-700" },
    in_progress: { label: "En cours",  className: "bg-amber-100 text-amber-700" },
    completed:   { label: "Terminé",   className: "bg-emerald-100 text-emerald-700" },
    cancelled:   { label: "Annulé",    className: "bg-slate-100 text-slate-500" },
  };
  const s = m[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>;
}
