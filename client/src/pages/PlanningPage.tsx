import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
function useRoleMatrix() {
  const auth = trpc.auth.me.useQuery();
  const matrix = trpc.security.roleMatrix.useQuery(undefined, { enabled: !!auth.data });
  return { permissions: matrix.data?.permissions, role: matrix.data?.role ?? auth.data?.role };
}
import { toast } from "sonner";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, MapPin, Clock, Tag,
  AlertTriangle, ChevronDown, ChevronRight as ChevronRightIcon, Layers,
  LayoutList, X, Phone, User, Building2, FileText, ExternalLink, Pencil, Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Slot = {
  id: number;
  technicianId: number;
  technicianName: string | null;
  projectId: number | null;
  projectName: string | null;
  projectRef: string | null;
  projectAddress: string | null;
  projectServiceType: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  slotDate: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  status: string;
  hasLocationChange: boolean;
  hasTimeChange: boolean;
  hasDiscount: boolean;
  discountNote: string | null;
  changeNote: string | null;
  prevDate: string | null;
  prevStartTime: string | null;
  prevEndTime: string | null;
};

type Technician = { id: number; name: string; firstName: string; lastName: string; email: string | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const min = (m % 60).toString().padStart(2, "0");
  return `${h}:${min}`;
}

const WEEK_DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const HOURS_START = 7;   // 07h00
const HOURS_END   = 19;  // 19h00
const TOTAL_HOURS = HOURS_END - HOURS_START;

const SERVICE_COLORS: Record<string, string> = {
  clim:        "bg-sky-500",
  pac:         "bg-violet-500",
  chauffe_eau: "bg-orange-500",
  pv:          "bg-yellow-500",
  vmc:         "bg-teal-500",
  autre:       "bg-slate-500",
};

const SERVICE_LABELS: Record<string, string> = {
  clim: "Clim", pac: "PAC", chauffe_eau: "Chauffe-eau", pv: "PV", vmc: "VMC", autre: "Autre",
};

function slotColor(slot: Slot): string {
  return SERVICE_COLORS[slot.projectServiceType ?? ""] ?? "bg-primary";
}

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatWeekLabel(monday: Date): string {
  const friday = addDays(monday, 4);
  const mo = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const fr = friday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const week = getISOWeek(monday);
  return `Semaine ${week}  ·  ${mo} – ${fr}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { permissions } = useRoleMatrix();
  const canManage = !!permissions?.manageInterventions;

  const [monday, setMonday] = useState<Date>(() => getMondayOf(new Date()));
  const [view, setView] = useState<"timeline" | "attribution">("timeline");
  const [selectedDay, setSelectedDay] = useState<string>(() => toDateStr(new Date()));
  const weekStart = toDateStr(monday);

  const utils = trpc.useUtils();
  const { data: slots = [], isLoading: slotsLoading } = trpc.planning.listWeek.useQuery({ weekStart });
  const { data: technicians = [], isLoading: techLoading } = trpc.planning.listTechnicians.useQuery();
  const { data: projectsRaw = [] } = trpc.management.projects.list.useQuery();
  const projects = projectsRaw.map(p => ({ id: p.id, name: p.title, reference: p.reference }));

  const createMut = trpc.planning.create.useMutation({
    onSuccess: () => { utils.planning.listWeek.invalidate(); toast.success("Créneau créé"); },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.planning.update.useMutation({
    onSuccess: () => { utils.planning.listWeek.invalidate(); toast.success("Créneau mis à jour"); },
    onError: e => toast.error(e.message),
  });
  const moveMut = trpc.planning.move.useMutation({
    onSuccess: () => { utils.planning.listWeek.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.planning.delete.useMutation({
    onSuccess: () => { utils.planning.listWeek.invalidate(); toast.success("Créneau supprimé"); },
    onError: e => toast.error(e.message),
  });

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);
  const [editSlot, setEditSlot] = useState<Slot | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<Slot | null>(null);

  const goWeek = (n: number) => setMonday(d => addDays(d, n * 7));

  const dayDates = Array.from({ length: 5 }, (_, i) => toDateStr(addDays(monday, i)));
  const isLoading = slotsLoading || techLoading;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Planning</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Navigation semaine */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-white px-1 py-1 shadow-sm">
            <button onClick={() => goWeek(-1)} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm font-medium text-foreground min-w-[250px] text-center">
              {formatWeekLabel(monday)}
            </span>
            <button onClick={() => goWeek(1)} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setMonday(getMondayOf(new Date()))}
            className="rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors shadow-sm"
          >
            Aujourd'hui
          </button>

          {/* Toggle vue */}
          <div className="flex rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setView("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${view === "timeline" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Clock className="h-3.5 w-3.5" />
              Timeline
            </button>
            <button
              onClick={() => setView("attribution")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${view === "attribution" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Layers className="h-3.5 w-3.5" />
              Attribution
            </button>
          </div>

          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Créer
            </Button>
          )}
        </div>
      </div>

      {/* ── View ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Chargement…</div>
      ) : view === "timeline" ? (
        <TimelineView
          slots={slots}
          technicians={technicians}
          dayDates={dayDates}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          canManage={canManage}
          onClickSlot={setDetailSlot}
          onEditSlot={setEditSlot}
          onDeleteSlot={setDeleteSlot}
          onMove={(id, slotDate, startTime, endTime, prev) => moveMut.mutate({ id, slotDate, startTime, endTime, ...prev })}
        />
      ) : (
        <AttributionView
          slots={slots}
          technicians={technicians}
          dayDates={dayDates}
          canManage={canManage}
          onClickSlot={setDetailSlot}
          onEditSlot={setEditSlot}
          onDeleteSlot={setDeleteSlot}
        />
      )}

      {/* ── Dialogs ── */}
      {createOpen && (
        <SlotFormDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          technicians={technicians}
          projects={projects}
          defaultDate={selectedDay}
          onSave={data => { createMut.mutate(data); setCreateOpen(false); }}
          saving={createMut.isPending}
        />
      )}

      {editSlot && (
        <SlotFormDialog
          open={!!editSlot}
          onClose={() => setEditSlot(null)}
          technicians={technicians}
          projects={projects}
          initialSlot={editSlot}
          onSave={data => { updateMut.mutate({ id: editSlot.id, ...data }); setEditSlot(null); }}
          saving={updateMut.isPending}
        />
      )}

      {detailSlot && (
        <SlotDetailDialog
          slot={detailSlot}
          onClose={() => setDetailSlot(null)}
          onEdit={() => { setEditSlot(detailSlot); setDetailSlot(null); }}
          onDelete={() => { setDeleteSlot(detailSlot); setDetailSlot(null); }}
          canManage={canManage}
        />
      )}

      <AlertDialog open={!!deleteSlot} onOpenChange={open => !open && setDeleteSlot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSlot?.projectName ?? "Créneau sans chantier"} — {deleteSlot?.slotDate} {deleteSlot?.startTime}–{deleteSlot?.endTime}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deleteSlot) { deleteMut.mutate({ id: deleteSlot.id }); setDeleteSlot(null); } }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Timeline View ────────────────────────────────────────────────────────────

type TimelineProps = {
  slots: Slot[];
  technicians: Technician[];
  dayDates: string[];
  selectedDay: string;
  setSelectedDay: (d: string) => void;
  canManage: boolean;
  onClickSlot: (s: Slot) => void;
  onEditSlot: (s: Slot) => void;
  onDeleteSlot: (s: Slot) => void;
  onMove: (id: number, date: string, start: string, end: string, prev: { prevDate?: string; prevStartTime?: string; prevEndTime?: string }) => void;
};

function TimelineView({ slots, technicians, dayDates, selectedDay, setSelectedDay, canManage, onClickSlot, onEditSlot, onDeleteSlot, onMove }: TimelineProps) {
  const CELL_W = 64; // px per hour
  const ROW_H = 72;  // px per technician row
  const LABEL_W = 200;

  const daySlots = slots.filter(s => s.slotDate === selectedDay);

  // Compute lanes (avoid visual overlap)
  type SlotWithLane = Slot & { lane: number; totalLanes: number };
  function computeLanes(dayS: Slot[]): SlotWithLane[] {
    const sorted = [...dayS].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const result: SlotWithLane[] = [];
    const laneEnds: number[] = [];

    for (const s of sorted) {
      const start = timeToMinutes(s.startTime);
      const end = timeToMinutes(s.endTime);
      let lane = laneEnds.findIndex(e => e <= start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else { laneEnds[lane] = end; }
      result.push({ ...s, lane, totalLanes: 0 });
    }

    // Pass 2: compute totalLanes per overlapping group
    for (let i = 0; i < result.length; i++) {
      const aStart = timeToMinutes(result[i].startTime);
      const aEnd = timeToMinutes(result[i].endTime);
      let maxLane = result[i].lane;
      for (let j = 0; j < result.length; j++) {
        if (i === j) continue;
        const bStart = timeToMinutes(result[j].startTime);
        const bEnd = timeToMinutes(result[j].endTime);
        if (bStart < aEnd && bEnd > aStart && result[i].technicianId === result[j].technicianId) {
          maxLane = Math.max(maxLane, result[j].lane);
        }
      }
      result[i].totalLanes = maxLane + 1;
    }
    return result;
  }

  const lanesMap = new Map<number, SlotWithLane[]>();
  technicians.forEach(t => {
    const ts = daySlots.filter(s => s.technicianId === t.id);
    lanesMap.set(t.id, computeLanes(ts));
  });

  const totalW = TOTAL_HOURS * CELL_W;

  // Drag state
  const dragRef = useRef<{ slotId: number; origStart: number; origEnd: number; mouseStartX: number; date: string; origStartStr: string; origEndStr: string } | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffsets, setDragOffsets] = useState<Record<number, number>>({});

  // Resize state
  const resizeRef = useRef<{ slotId: number; edge: "start" | "end"; origStart: number; origEnd: number; mouseStartX: number } | null>(null);
  const [resizeData, setResizeData] = useState<Record<number, { start: number; end: number }>>({});

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.mouseStartX;
      const minutesDelta = Math.round(dx / CELL_W * 60 / 15) * 15;
      setDragOffsets(prev => ({ ...prev, [dragRef.current!.slotId]: minutesDelta }));
    }
    if (resizeRef.current) {
      const dx = e.clientX - resizeRef.current.mouseStartX;
      const minutesDelta = Math.round(dx / CELL_W * 60 / 15) * 15;
      const { slotId, edge, origStart, origEnd } = resizeRef.current;
      if (edge === "end") {
        const newEnd = Math.max(origStart + 15, Math.min(origEnd + minutesDelta, HOURS_END * 60));
        setResizeData(prev => ({ ...prev, [slotId]: { start: origStart, end: newEnd } }));
      } else {
        const newStart = Math.min(origEnd - 15, Math.max(origStart + minutesDelta, HOURS_START * 60));
        setResizeData(prev => ({ ...prev, [slotId]: { start: newStart, end: origEnd } }));
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      const { slotId, origStart, origEnd, mouseStartX, date, origStartStr, origEndStr } = dragRef.current;
      const offset = dragOffsets[slotId] ?? 0;
      if (offset !== 0) {
        const newStart = Math.max(HOURS_START * 60, Math.min(origStart + offset, HOURS_END * 60 - (origEnd - origStart)));
        const newEnd = newStart + (origEnd - origStart);
        onMove(slotId, date, minutesToTime(newStart), minutesToTime(newEnd), {
          prevDate: date, prevStartTime: origStartStr, prevEndTime: origEndStr,
        });
      }
      dragRef.current = null;
      setDraggingId(null);
      setDragOffsets({});
    }
    if (resizeRef.current) {
      const { slotId } = resizeRef.current;
      const rd = resizeData[slotId];
      if (rd) {
        const slot = daySlots.find(s => s.id === slotId);
        if (slot) {
          onMove(slotId, slot.slotDate, minutesToTime(rd.start), minutesToTime(rd.end), {
            prevStartTime: slot.startTime, prevEndTime: slot.endTime,
          });
        }
      }
      resizeRef.current = null;
      setResizeData({});
    }
  }, [dragOffsets, resizeData, daySlots, onMove]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      {/* Day selector */}
      <div className="flex border-b border-border/60">
        {dayDates.map((d, i) => {
          const date = new Date(d + "T00:00:00");
          const isToday = d === toDateStr(new Date());
          const isSel = d === selectedDay;
          const count = slots.filter(s => s.slotDate === d).length;
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors border-b-2 ${
                isSel ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider">{WEEK_DAYS_FR[i].slice(0, 3)}</span>
              <span className={`text-lg font-bold leading-none ${isToday ? "text-primary" : ""}`}>
                {date.getDate()}
              </span>
              {count > 0 && <span className="rounded-full bg-primary/20 text-primary text-[9px] font-bold px-1.5">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto pb-2">
        <div style={{ minWidth: LABEL_W + totalW + 32 }}>
          {/* Hour ruler */}
          <div className="flex" style={{ marginLeft: LABEL_W }}>
            <div style={{ width: 16 }} />
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div key={i} style={{ width: CELL_W }} className="text-[10px] text-muted-foreground border-l border-border/40 pl-1 pb-1 shrink-0">
                {(HOURS_START + i).toString().padStart(2, "0")}h
              </div>
            ))}
          </div>

          {/* Rows */}
          {technicians.map(tech => {
            const techSlots = lanesMap.get(tech.id) ?? [];
            const maxLanes = Math.max(1, ...techSlots.map(s => s.totalLanes));
            const rowH = maxLanes * ROW_H;

            return (
              <div key={tech.id} className="flex border-t border-border/30 group">
                {/* Technician label */}
                <div
                  style={{ width: LABEL_W, minHeight: rowH }}
                  className="flex-shrink-0 flex items-start gap-2.5 px-3 py-3 bg-slate-50/80 border-r border-border/40"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                    {tech.firstName[0]}{tech.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{tech.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Technicien</p>
                  </div>
                </div>

                {/* Time grid */}
                <div className="relative flex-1" style={{ height: rowH }}>
                  {/* Hour lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={i}
                      style={{ left: i * CELL_W, width: CELL_W }}
                      className="absolute top-0 bottom-0 border-l border-border/20"
                    />
                  ))}

                  {/* Slots */}
                  {techSlots.map(slot => {
                    const origStart = timeToMinutes(slot.startTime);
                    const origEnd = timeToMinutes(slot.endTime);
                    const isDragging = draggingId === slot.id;
                    const offset = dragOffsets[slot.id] ?? 0;
                    const rd = resizeData[slot.id];
                    const start = rd ? rd.start : Math.max(HOURS_START * 60, origStart + (isDragging ? offset : 0));
                    const end = rd ? rd.end : Math.min(HOURS_END * 60, origEnd + (isDragging ? offset : 0));
                    const left = (start - HOURS_START * 60) / 60 * CELL_W;
                    const width = Math.max(8, (end - start) / 60 * CELL_W);
                    const top = slot.lane * ROW_H;
                    const height = ROW_H - 8;
                    const color = slotColor(slot);

                    return (
                      <div
                        key={slot.id}
                        style={{ left, top, width, height }}
                        className={`absolute rounded-lg ${color} text-white text-[11px] shadow-md cursor-pointer select-none overflow-hidden flex flex-col px-1.5 py-1 transition-shadow ${isDragging ? "shadow-xl ring-2 ring-white/60 opacity-90 z-20" : "hover:shadow-lg z-10"}`}
                        onClick={() => onClickSlot(slot)}
                        onMouseDown={canManage ? e => {
                          e.preventDefault();
                          dragRef.current = { slotId: slot.id, origStart, origEnd, mouseStartX: e.clientX, date: slot.slotDate, origStartStr: slot.startTime, origEndStr: slot.endTime };
                          setDraggingId(slot.id);
                        } : undefined}
                      >
                        <div className="font-semibold leading-tight truncate">{slot.projectName ?? "Créneau"}</div>
                        <div className="text-white/80 leading-tight truncate">{slot.startTime}–{slot.endTime}</div>
                        {slot.clientName && <div className="text-white/70 leading-tight truncate text-[10px]">{slot.clientName}</div>}
                        <div className="flex gap-0.5 mt-auto pt-0.5">
                          {slot.hasLocationChange && <MapPin className="h-2.5 w-2.5 text-white/80" />}
                          {slot.hasTimeChange && <Clock className="h-2.5 w-2.5 text-white/80" />}
                          {slot.hasDiscount && <Tag className="h-2.5 w-2.5 text-white/80" />}
                        </div>

                        {/* Resize handles */}
                        {canManage && (
                          <>
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize"
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                resizeRef.current = { slotId: slot.id, edge: "start", origStart, origEnd, mouseStartX: e.clientX };
                              }}
                            />
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize"
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                resizeRef.current = { slotId: slot.id, edge: "end", origStart, origEnd, mouseStartX: e.clientX };
                              }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
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

type AttributionProps = {
  slots: Slot[];
  technicians: Technician[];
  dayDates: string[];
  canManage: boolean;
  onClickSlot: (s: Slot) => void;
  onEditSlot: (s: Slot) => void;
  onDeleteSlot: (s: Slot) => void;
};

function AttributionView({ slots, technicians, dayDates, canManage, onClickSlot }: AttributionProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid border-b border-border/60 bg-slate-50/80" style={{ gridTemplateColumns: "200px repeat(5, 1fr)" }}>
        <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Technicien</div>
        {dayDates.map((d, i) => {
          const date = new Date(d + "T00:00:00");
          const isToday = d === toDateStr(new Date());
          return (
            <div key={d} className="px-2 py-3 text-center border-l border-border/40">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{WEEK_DAYS_FR[i].slice(0, 3)}</p>
              <p className={`text-base font-bold leading-none mt-0.5 ${isToday ? "text-primary" : "text-foreground"}`}>
                {date.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rows */}
      {technicians.map(tech => {
        const isExp = expanded.has(tech.id);
        const hasSlots = slots.some(s => s.technicianId === tech.id);

        return (
          <div key={tech.id} className="border-b border-border/30 last:border-b-0">
            {/* Technician row */}
            <div
              className="grid items-center hover:bg-muted/30 transition-colors cursor-pointer"
              style={{ gridTemplateColumns: "200px repeat(5, 1fr)" }}
              onClick={() => hasSlots && toggle(tech.id)}
            >
              <div className="flex items-center gap-2.5 px-4 py-3">
                {hasSlots ? (
                  isExp
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 shrink-0" />
                )}
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                  {tech.firstName[0]}{tech.lastName[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{tech.name}</p>
                </div>
              </div>

              {/* Day cells — count badges */}
              {dayDates.map(d => {
                const count = slots.filter(s => s.technicianId === tech.id && s.slotDate === d).length;
                return (
                  <div key={d} className="border-l border-border/30 px-2 py-3 flex flex-wrap gap-1 justify-center items-center min-h-[52px]">
                    {count === 0
                      ? <span className="text-[11px] text-muted-foreground/40">—</span>
                      : (
                        <span className="rounded-full bg-primary/15 text-primary text-xs font-bold px-2 py-0.5">
                          {count} chantier{count > 1 ? "s" : ""}
                        </span>
                      )
                    }
                  </div>
                );
              })}
            </div>

            {/* Expanded sub-rows */}
            {isExp && (
              <div className="bg-slate-50/60 border-t border-border/30">
                {(() => {
                  const techSlots = slots.filter(s => s.technicianId === tech.id);
                  const allDaySlots = dayDates.map(d => techSlots.filter(s => s.slotDate === d));
                  const maxRows = Math.max(...allDaySlots.map(a => a.length), 0);
                  return Array.from({ length: maxRows }, (_, rowIdx) => (
                    <div
                      key={rowIdx}
                      className="grid border-t border-border/20"
                      style={{ gridTemplateColumns: "200px repeat(5, 1fr)" }}
                    >
                      <div className="px-4 py-1.5" />
                      {allDaySlots.map((dayArr, di) => {
                        const slot = dayArr[rowIdx];
                        if (!slot) return <div key={di} className="border-l border-border/20 px-2 py-1.5" />;
                        const color = slotColor(slot);
                        return (
                          <div key={di} className="border-l border-border/20 px-2 py-1.5">
                            <div
                              className={`${color} text-white rounded-lg px-2 py-1.5 text-[11px] cursor-pointer hover:opacity-90 transition-opacity`}
                              onClick={() => onClickSlot(slot)}
                            >
                              <div className="font-semibold truncate">{slot.projectName ?? "Créneau"}</div>
                              <div className="text-white/80 text-[10px]">{slot.startTime}–{slot.endTime}</div>
                              {slot.clientName && <div className="text-white/70 text-[10px] truncate">{slot.clientName}</div>}
                              <div className="flex gap-0.5 mt-0.5">
                                {slot.hasLocationChange && <MapPin className="h-2.5 w-2.5 text-white/70" />}
                                {slot.hasTimeChange && <Clock className="h-2.5 w-2.5 text-white/70" />}
                                {slot.hasDiscount && <Tag className="h-2.5 w-2.5 text-white/70" />}
                              </div>
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

      {technicians.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">Aucun technicien actif.</div>
      )}
    </div>
  );
}

// ─── Slot Detail Dialog ───────────────────────────────────────────────────────

function SlotDetailDialog({ slot, onClose, onEdit, onDelete, canManage }: {
  slot: Slot; onClose: () => void; onEdit: () => void; onDelete: () => void; canManage: boolean;
}) {
  const color = slotColor(slot);
  const address = slot.projectAddress || slot.clientAddress;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base leading-snug">
                {slot.projectName ?? "Créneau sans chantier"}
              </DialogTitle>
              {slot.projectRef && <p className="text-xs text-muted-foreground mt-0.5">Réf. {slot.projectRef}</p>}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          {/* Horaires */}
          <div className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-3 bg-muted/30">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium">{formatDateFr(slot.slotDate)}</p>
              <p className="text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
            </div>
            <StatusBadge status={slot.status} />
          </div>

          {/* Changements */}
          {(slot.hasLocationChange || slot.hasTimeChange || slot.hasDiscount) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-amber-800 font-medium text-xs uppercase tracking-wide">
                <AlertTriangle className="h-3.5 w-3.5" />
                Modifications
              </div>
              {slot.hasLocationChange && (
                <div className="flex items-center gap-2 text-amber-900 text-xs">
                  <MapPin className="h-3.5 w-3.5" /> Changement de lieu
                </div>
              )}
              {slot.hasTimeChange && slot.prevStartTime && (
                <div className="flex items-center gap-2 text-amber-900 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  Déplacé depuis {slot.prevDate && slot.prevDate !== slot.slotDate ? `${slot.prevDate} ` : ""}
                  {slot.prevStartTime}–{slot.prevEndTime}
                </div>
              )}
              {slot.hasDiscount && (
                <div className="flex items-center gap-2 text-amber-900 text-xs">
                  <Tag className="h-3.5 w-3.5" /> Remise appliquée{slot.discountNote ? ` : ${slot.discountNote}` : ""}
                </div>
              )}
              {slot.changeNote && <p className="text-amber-800 text-xs italic">{slot.changeNote}</p>}
            </div>
          )}

          {/* Client */}
          {(slot.clientName || slot.clientPhone) && (
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
              {slot.clientName && (
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{slot.clientName}</span>
                </div>
              )}
              {slot.clientPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={`tel:${slot.clientPhone}`} className="text-primary hover:underline">{slot.clientPhone}</a>
                </div>
              )}
              {slot.clientAddress && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{slot.clientAddress}</span>
                </div>
              )}
            </div>
          )}

          {/* Chantier / adresse */}
          {(slot.projectServiceType || address) && (
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chantier</p>
              {slot.projectServiceType && (
                <Badge variant="secondary" className="w-fit text-xs">
                  {SERVICE_LABELS[slot.projectServiceType] ?? slot.projectServiceType}
                </Badge>
              )}
              {address && (
                <div className="flex items-start gap-2 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">{address}</p>
                    <a
                      href={mapsUrl(address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary text-xs hover:underline mt-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ouvrir dans Maps
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {slot.notes && (
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <FileText className="h-3.5 w-3.5" /> Notes
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{slot.notes}</p>
            </div>
          )}
        </div>

        {canManage && (
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Slot Form Dialog ─────────────────────────────────────────────────────────

type SlotFormInput = {
  technicianId: number;
  projectId: number | null;
  slotDate: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  hasLocationChange: boolean;
  hasTimeChange: boolean;
  hasDiscount: boolean;
  discountNote?: string | null;
  changeNote?: string | null;
};

function SlotFormDialog({ open, onClose, technicians, projects, defaultDate, initialSlot, onSave, saving }: {
  open: boolean;
  onClose: () => void;
  technicians: Technician[];
  projects: { id: number; name: string; reference: string | null }[];
  defaultDate?: string;
  initialSlot?: Slot | null;
  onSave: (data: SlotFormInput) => void;
  saving: boolean;
}) {
  const [techId, setTechId] = useState<string>(initialSlot ? String(initialSlot.technicianId) : (technicians[0] ? String(technicians[0].id) : ""));
  const [projId, setProjId] = useState<string>(initialSlot?.projectId ? String(initialSlot.projectId) : "none");
  const [date, setDate] = useState(initialSlot?.slotDate ?? defaultDate ?? toDateStr(new Date()));
  const [startTime, setStartTime] = useState(initialSlot?.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(initialSlot?.endTime ?? "12:00");
  const [notes, setNotes] = useState(initialSlot?.notes ?? "");
  const [status, setStatus] = useState<SlotFormInput["status"]>((initialSlot?.status as SlotFormInput["status"]) ?? "scheduled");
  const [hasLocChange, setHasLocChange] = useState(initialSlot?.hasLocationChange ?? false);
  const [hasTimeChange, setHasTimeChange] = useState(initialSlot?.hasTimeChange ?? false);
  const [hasDiscount, setHasDiscount] = useState(initialSlot?.hasDiscount ?? false);
  const [discountNote, setDiscountNote] = useState(initialSlot?.discountNote ?? "");
  const [changeNote, setChangeNote] = useState(initialSlot?.changeNote ?? "");

  const isEdit = !!initialSlot;
  const canSubmit = !!techId && date && startTime && endTime && startTime < endTime;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le créneau" : "Nouveau créneau"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Technicien */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Technicien</label>
            <Select value={techId} onValueChange={setTechId}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {technicians.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Chantier */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chantier <span className="text-muted-foreground font-normal">(optionnel)</span></label>
            <Select value={projId} onValueChange={setProjId}>
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun chantier —</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}{p.reference ? ` (${p.reference})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date + Heures */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Début</label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} step={900} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fin</label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} step={900} />
            </div>
          </div>

          {/* Statut */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Statut</label>
            <Select value={status} onValueChange={v => setStatus(v as SlotFormInput["status"])}>
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
            <Textarea
              placeholder="Informations complémentaires sur l'intervention…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Flags */}
          <div className="rounded-xl border border-border/60 px-4 py-3 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alertes (optionnel)</p>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={hasLocChange} onChange={e => setHasLocChange(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">Changement de lieu</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={hasTimeChange} onChange={e => setHasTimeChange(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">Déplacement horaire</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={hasDiscount} onChange={e => setHasDiscount(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">Remise appliquée</span>
            </label>
            {hasDiscount && (
              <Input placeholder="Détail de la remise…" value={discountNote} onChange={e => setDiscountNote(e.target.value)} className="text-sm" />
            )}
            {(hasLocChange || hasTimeChange) && (
              <Input placeholder="Note sur la modification…" value={changeNote} onChange={e => setChangeNote(e.target.value)} className="text-sm" />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!canSubmit || saving}
            onClick={() => onSave({
              technicianId: Number(techId),
              projectId: projId !== "none" ? Number(projId) : null,
              slotDate: date,
              startTime,
              endTime,
              notes: notes.trim() || null,
              status,
              hasLocationChange: hasLocChange,
              hasTimeChange,
              hasDiscount,
              discountNote: discountNote.trim() || null,
              changeNote: changeNote.trim() || null,
            })}
          >
            {saving ? "Enregistrement…" : isEdit ? "Modifier" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled:   { label: "Planifié",  className: "bg-blue-100 text-blue-700" },
    in_progress: { label: "En cours",  className: "bg-amber-100 text-amber-700" },
    completed:   { label: "Terminé",   className: "bg-emerald-100 text-emerald-700" },
    cancelled:   { label: "Annulé",    className: "bg-slate-100 text-slate-500" },
  };
  const s = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>;
}
