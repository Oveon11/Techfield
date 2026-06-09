import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, MapPin, Clock, Tag,
  AlertTriangle, ChevronDown, ChevronRight as ChevronRightIcon, Layers,
  X, Phone, User, Building2, FileText, ExternalLink, Pencil, Trash2,
  ZoomIn, ZoomOut, ArrowUpRight,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useRoleMatrix() {
  const auth = trpc.auth.me.useQuery();
  const matrix = trpc.security.roleMatrix.useQuery(undefined, { enabled: !!auth.data });
  return { permissions: matrix.data?.permissions, role: matrix.data?.role ?? auth.data?.role };
}

function getMondayOf(d: Date): Date {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); r.setHours(0,0,0,0); return r;
}
function getMonthStart(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function toDateStr(d: Date) { return d.toISOString().slice(0,10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function addMonths(d: Date, n: number) { const r = new Date(d); r.setMonth(r.getMonth()+n); return r; }
function timeToMin(t: string) { const [h,m]=t.split(":").map(Number); return h*60+m; }
function minToTime(m: number) { return `${Math.floor(m/60).toString().padStart(2,"0")}:${(m%60).toString().padStart(2,"0")}`; }
function getISOWeek(d: Date) {
  const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day);
  const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  return Math.ceil((((t.getTime()-y.getTime())/86400000)+1)/7);
}
function formatDateFr(s: string) {
  return new Date(s+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
}
function mapsUrl(addr: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`; }
function slotsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeToMin(aStart) < timeToMin(bEnd) && timeToMin(aEnd) > timeToMin(bStart);
}

const WEEK_DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven"];
const WEEK_DAYS_FULL = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const H_START = 7;
const H_END   = 18;
const H_TOTAL = H_END - H_START; // 11

const SERVICE_COLORS: Record<string,string> = {
  clim:"bg-sky-500",pac:"bg-violet-500",chauffe_eau:"bg-orange-500",
  pv:"bg-yellow-500",vmc:"bg-teal-500",autre:"bg-slate-500",
};
const SERVICE_LABELS: Record<string,string> = {
  clim:"Clim",pac:"PAC",chauffe_eau:"Chauffe-eau",pv:"PV",vmc:"VMC",autre:"Autre",
};
function slotColor(serviceType: string|null) { return SERVICE_COLORS[serviceType??""]??"bg-primary"; }
function slotLabel(slot: Slot) { return slot.projectName ?? slot.clientName ?? null; }

// ─── Types ────────────────────────────────────────────────────────────────────

type Slot = {
  id:number; technicianId:number; technicianName:string|null;
  projectId:number|null; projectName:string|null; projectRef:string|null;
  projectAddress:string|null; projectServiceType:string|null;
  clientName:string|null; clientPhone:string|null; clientAddress:string|null;
  slotDate:string; startTime:string; endTime:string; notes:string|null; status:string;
  hasLocationChange:boolean; hasTimeChange:boolean; hasDiscount:boolean;
  discountNote:string|null; changeNote:string|null;
  prevDate:string|null; prevStartTime:string|null; prevEndTime:string|null;
};
type Technician = {id:number;name:string;firstName:string;lastName:string;email:string|null};
type ViewMode = "semaine"|"jour"|"mois"|"attribution";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { permissions } = useRoleMatrix();
  const canManage = !!permissions?.manageInterventions;
  const [, setLocation] = useLocation();

  const [view, setView]      = useState<ViewMode>("semaine");
  const [monday, setMonday]  = useState<Date>(() => getMondayOf(new Date()));
  const [selDay, setSelDay]  = useState<string>(() => toDateStr(new Date()));
  const [monthRef, setMonthRef] = useState<Date>(() => getMonthStart(new Date()));
  const [zoom, setZoom]      = useState(1); // 0.7 – 1.5

  // Compute weekStart from view context
  const weekStart = view === "jour"
    ? toDateStr(getMondayOf(new Date(selDay+"T00:00:00")))
    : view === "mois"
      ? toDateStr(getMondayOf(monthRef))
      : toDateStr(monday);

  const dayDates = Array.from({length:5},(_,i)=>toDateStr(addDays(new Date(weekStart+"T00:00:00"),i)));

  const utils = trpc.useUtils();
  const {data:slots=[],isLoading:slotsLoading} = trpc.planning.listWeek.useQuery({weekStart});
  const {data:technicians=[],isLoading:techLoading} = trpc.planning.listTechnicians.useQuery();
  const {data:projectsRaw=[]} = trpc.management.projects.list.useQuery();
  const projects = projectsRaw.map(p=>({id:p.id,name:p.title,reference:p.reference}));

  const inv = useCallback(() => utils.planning.listWeek.invalidate({weekStart}),[utils,weekStart]);
  const createMut = trpc.planning.create.useMutation({onSuccess:()=>{inv();toast.success("Créneau créé");},onError:e=>toast.error(e.message)});
  const updateMut = trpc.planning.update.useMutation({onSuccess:()=>{inv();toast.success("Créneau mis à jour");},onError:e=>toast.error(e.message)});
  const moveMut   = trpc.planning.move.useMutation({onSuccess:inv,onError:e=>toast.error(e.message)});
  const deleteMut = trpc.planning.delete.useMutation({onSuccess:()=>{inv();toast.success("Créneau supprimé");},onError:e=>toast.error(e.message)});

  const [createOpen, setCreateOpen] = useState(false);
  const [detailSlot, setDetailSlot] = useState<Slot|null>(null);
  const [editSlot,   setEditSlot]   = useState<Slot|null>(null);
  const [deleteSlot, setDeleteSlot] = useState<Slot|null>(null);

  const formatNavLabel = () => {
    if (view==="semaine") {
      const fri = addDays(new Date(weekStart+"T00:00:00"),4);
      const mo = new Date(weekStart+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
      const fri2 = fri.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
      return `Sem. ${getISOWeek(new Date(weekStart+"T00:00:00"))}  ·  ${mo} – ${fri2}`;
    }
    if (view==="jour") return formatDateFr(selDay);
    if (view==="mois") return `${MONTHS_FR[monthRef.getMonth()]} ${monthRef.getFullYear()}`;
    const fri2 = addDays(new Date(weekStart+"T00:00:00"),4);
    return `${new Date(weekStart+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} – ${fri2.toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}`;
  };

  const goNext = () => {
    if (view==="semaine"||view==="attribution") setMonday(d=>addDays(d,7));
    if (view==="jour") setSelDay(d=>toDateStr(addDays(new Date(d+"T00:00:00"),1)));
    if (view==="mois") setMonthRef(d=>addMonths(d,1));
  };
  const goPrev = () => {
    if (view==="semaine"||view==="attribution") setMonday(d=>addDays(d,-7));
    if (view==="jour") setSelDay(d=>toDateStr(addDays(new Date(d+"T00:00:00"),-1)));
    if (view==="mois") setMonthRef(d=>addMonths(d,-1));
  };
  const goToday = () => {
    const today = new Date();
    setMonday(getMondayOf(today));
    setSelDay(toDateStr(today));
    setMonthRef(getMonthStart(today));
  };

  const handleSaveCreate = (rows: SlotFormRow[]) => {
    // Check overlap
    for (const row of rows) {
      const conflict = slots.find(s =>
        s.technicianId === row.technicianId &&
        s.slotDate === row.slotDate &&
        slotsOverlap(row.startTime, row.endTime, s.startTime, s.endTime)
      );
      if (conflict) {
        const tech = technicians.find(t=>t.id===row.technicianId);
        toast.error(`Conflit pour ${tech?.name??""} : créneau existant ${conflict.startTime}–${conflict.endTime}`);
        return;
      }
    }
    rows.forEach(r => createMut.mutate(r));
    setCreateOpen(false);
  };

  const handleSaveEdit = (rows: SlotFormRow[]) => {
    if (!editSlot) return;
    for (const row of rows) {
      const conflict = slots.find(s =>
        s.id !== editSlot.id &&
        s.technicianId === row.technicianId &&
        s.slotDate === row.slotDate &&
        slotsOverlap(row.startTime, row.endTime, s.startTime, s.endTime)
      );
      if (conflict) {
        const tech = technicians.find(t=>t.id===row.technicianId);
        toast.error(`Conflit pour ${tech?.name??""} : créneau existant ${conflict.startTime}–${conflict.endTime}`);
        return;
      }
    }
    rows.forEach(r => updateMut.mutate({id:editSlot.id,...r}));
    setEditSlot(null);
  };

  const isLoading = slotsLoading || techLoading;

  const VIEW_BUTTONS: {key:ViewMode;label:string}[] = [
    {key:"semaine",label:"Semaine"},
    {key:"jour",label:"Jour"},
    {key:"mois",label:"Mois"},
    {key:"attribution",label:"Attribution"},
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary"/>
            <h1 className="text-xl font-bold text-foreground">Planning</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Navigation */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-white px-1 py-1 shadow-sm">
              <button onClick={goPrev} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4"/></button>
              <span className="px-2 text-sm font-medium text-foreground min-w-[180px] text-center">{formatNavLabel()}</span>
              <button onClick={goNext} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4"/></button>
            </div>
            <button onClick={goToday} className="rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors shadow-sm">Aujourd'hui</button>
            {/* View toggle */}
            <div className="flex rounded-xl border border-border bg-white shadow-sm overflow-hidden">
              {VIEW_BUTTONS.map(b=>(
                <button key={b.key} onClick={()=>setView(b.key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${view===b.key?"bg-primary text-white":"text-muted-foreground hover:bg-muted"}`}>
                  {b.label}
                </button>
              ))}
            </div>
            {/* Zoom (semaine/jour only) */}
            {(view==="semaine"||view==="jour") && (
              <div className="flex items-center gap-1 rounded-xl border border-border bg-white px-1 py-1 shadow-sm">
                <button onClick={()=>setZoom(z=>Math.max(0.6,z-0.1))} className="rounded-lg p-1.5 hover:bg-muted transition-colors" title="Dézoomer"><ZoomOut className="h-3.5 w-3.5"/></button>
                <span className="text-xs text-muted-foreground w-8 text-center">{Math.round(zoom*100)}%</span>
                <button onClick={()=>setZoom(z=>Math.min(2,z+0.1))} className="rounded-lg p-1.5 hover:bg-muted transition-colors" title="Zoomer"><ZoomIn className="h-3.5 w-3.5"/></button>
              </div>
            )}
            {canManage&&(
              <Button size="sm" onClick={()=>setCreateOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4"/> Créer
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Chargement…</div>
        ) : view==="semaine" ? (
          <WeekView slots={slots} technicians={technicians} dayColumns={dayDates} canManage={canManage} zoom={zoom}
            onClickSlot={setDetailSlot}
            onMove={(id,date,start,end,prev)=>moveMut.mutate({id,slotDate:date,startTime:start,endTime:end,...prev})}
            onDayClick={d=>{setSelDay(d);setView("jour");}}
          />
        ) : view==="jour" ? (
          <DayView slots={slots} technicians={technicians} selDay={selDay} canManage={canManage} zoom={zoom}
            onClickSlot={setDetailSlot}
            onMove={(id,date,start,end,prev)=>moveMut.mutate({id,slotDate:date,startTime:start,endTime:end,...prev})}
          />
        ) : view==="mois" ? (
          <MonthView slots={slots} monthRef={monthRef}
            onDayClick={d=>{setSelDay(d);setView("jour");}}
          />
        ) : (
          <AttributionView slots={slots} technicians={technicians} dayDates={dayDates} canManage={canManage} onClickSlot={setDetailSlot}/>
        )}

        {createOpen&&(
          <SlotFormDialog open onClose={()=>setCreateOpen(false)} technicians={technicians} projects={projects}
            existingSlots={slots} defaultDate={selDay}
            onSave={handleSaveCreate} saving={createMut.isPending}/>
        )}
        {editSlot&&(
          <SlotFormDialog open onClose={()=>setEditSlot(null)} technicians={technicians} projects={projects}
            existingSlots={slots} initialSlot={editSlot}
            onSave={handleSaveEdit} saving={updateMut.isPending}/>
        )}
        {detailSlot&&(
          <SlotDetailDialog slot={detailSlot}
            onClose={()=>setDetailSlot(null)}
            onEdit={()=>{setEditSlot(detailSlot);setDetailSlot(null);}}
            onDelete={()=>{setDeleteSlot(detailSlot);setDetailSlot(null);}}
            onOpenProject={id=>{setDetailSlot(null);setLocation(`/chantiers/${id}`);}}
            canManage={canManage}/>
        )}
        <AlertDialog open={!!deleteSlot} onOpenChange={o=>!o&&setDeleteSlot(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
              <AlertDialogDescription>{(deleteSlot ? slotLabel(deleteSlot) : null)??"Créneau sans chantier"} — {deleteSlot?.slotDate} {deleteSlot?.startTime}–{deleteSlot?.endTime}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                onClick={()=>{if(deleteSlot){deleteMut.mutate({id:deleteSlot.id});setDeleteSlot(null);}}}
              >Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

// ─── Shared timeline grid (used by Week & Day) ────────────────────────────────

type SlotWithLane = Slot & {lane:number;totalLanes:number};

function computeLanes(daySlots: Slot[]): SlotWithLane[] {
  const sorted = [...daySlots].sort((a,b)=>timeToMin(a.startTime)-timeToMin(b.startTime));
  const laneEnds: number[] = [];
  const result: SlotWithLane[] = sorted.map(s=>{
    const start=timeToMin(s.startTime);const end=timeToMin(s.endTime);
    let lane=laneEnds.findIndex(e=>e<=start);
    if(lane===-1){lane=laneEnds.length;laneEnds.push(end);}else{laneEnds[lane]=end;}
    return {...s,lane,totalLanes:0};
  });
  for(let i=0;i<result.length;i++){
    const {startTime:aS,endTime:aE,technicianId:tid}=result[i];
    let max=result[i].lane;
    for(let j=0;j<result.length;j++){
      if(i===j||result[j].technicianId!==tid)continue;
      if(timeToMin(result[j].startTime)<timeToMin(aE)&&timeToMin(result[j].endTime)>timeToMin(aS))
        max=Math.max(max,result[j].lane);
    }
    result[i].totalLanes=max+1;
  }
  return result;
}

type GridProps = {
  slots:Slot[]; technicians:Technician[]; dayColumns:string[];
  canManage:boolean; zoom:number;
  onClickSlot:(s:Slot)=>void;
  onMove:(id:number,date:string,start:string,end:string,prev:{prevDate?:string;prevStartTime?:string;prevEndTime?:string})=>void;
};

// Shared timeline grid — percentage-based, fits parent width
function TimelineGrid({slots,technicians,dayColumns,canManage,zoom,onClickSlot,onMove}:GridProps){
  const LANE_H = Math.round(52*zoom);
  const LABEL_W = 148;
  // zoom=1 → colonnes s'étirent pour remplir l'espace (1fr)
  // zoom>1 → largeur fixe en px, déclenche le scroll horizontal
  const COL_W = zoom > 1.05 ? Math.round(150 * zoom) : undefined;
  const today = toDateStr(new Date());

  // Drag / resize
  const dragRef  = useRef<{id:number;date:string;origStart:number;origEnd:number;origSStr:string;origEStr:string;dayColRef:Element|null;mouseX:number}|null>(null);
  const resizeRef = useRef<{id:number;date:string;origStart:number;origEnd:number;dayColRef:Element|null;mouseX:number;edge:"start"|"end"}|null>(null);
  const [draggingId,setDraggingId]=useState<number|null>(null);
  // preview positions during drag (minutes)
  const [preview,setPreview]=useState<Record<number,{start:number;end:number}>>({});
  const dayColRefs = useRef<Record<string,HTMLDivElement|null>>({});

  const clearInteraction = useCallback(()=>{
    if(dragRef.current){
      const {id,date,origSStr,origEStr}=dragRef.current;
      const pv=preview[id];
      if(pv&&(pv.start!==timeToMin(origSStr)||pv.end!==timeToMin(origEStr))){
        onMove(id,date,minToTime(pv.start),minToTime(pv.end),{prevDate:date,prevStartTime:origSStr,prevEndTime:origEStr});
      }
      dragRef.current=null;setDraggingId(null);setPreview({});
    }
    if(resizeRef.current){
      const {id,date}=resizeRef.current;
      const pv=preview[id];
      const s=dragRef.current;void s;
      if(pv){
        const slot=slots.find(x=>x.id===id);
        if(slot)onMove(id,date,minToTime(pv.start),minToTime(pv.end),{prevStartTime:slot.startTime,prevEndTime:slot.endTime});
      }
      resizeRef.current=null;setPreview({});
    }
  },[preview,slots,onMove]);

  const onMouseMove = useCallback((e:MouseEvent)=>{
    if(dragRef.current){
      const {id,origStart,origEnd,dayColRef}=dragRef.current;
      if(!dayColRef)return;
      const rect=dayColRef.getBoundingClientRect();
      const dx=e.clientX-dragRef.current.mouseX;
      const dm=Math.round(dx/rect.width*H_TOTAL*60/15)*15;
      const dur=origEnd-origStart;
      const ns=Math.max(H_START*60,Math.min(origStart+dm,H_END*60-dur));
      setPreview(p=>({...p,[id]:{start:ns,end:ns+dur}}));
    }
    if(resizeRef.current){
      const {id,origStart,origEnd,dayColRef,edge}=resizeRef.current;
      if(!dayColRef)return;
      const rect=dayColRef.getBoundingClientRect();
      const dx=e.clientX-resizeRef.current.mouseX;
      const dm=Math.round(dx/rect.width*H_TOTAL*60/15)*15;
      setPreview(p=>({
        ...p,[id]:edge==="end"
          ?{start:origStart,end:Math.max(origStart+15,Math.min(origEnd+dm,H_END*60))}
          :{start:Math.min(origEnd-15,Math.max(origStart+dm,H_START*60)),end:origEnd},
      }));
    }
  },[]);

  useEffect(()=>{
    window.addEventListener("mousemove",onMouseMove);
    window.addEventListener("mouseup",clearInteraction);
    return ()=>{window.removeEventListener("mousemove",onMouseMove);window.removeEventListener("mouseup",clearInteraction);};
  },[onMouseMove,clearInteraction]);

  // build lane map per (techId, date)
  const laneMap = new Map<string,SlotWithLane[]>();
  technicians.forEach(tech=>{
    dayColumns.forEach(d=>{
      laneMap.set(`${tech.id}-${d}`,computeLanes(slots.filter(s=>s.technicianId===tech.id&&s.slotDate===d)));
    });
  });
  const maxLanes=(techId:number)=>Math.max(1,...dayColumns.map(d=>(laneMap.get(`${techId}-${d}`)??[]).reduce((m,s)=>Math.max(m,s.totalLanes),1)));

  const colUnit = COL_W ? `${COL_W}px` : "1fr";
  const colTemplate = `${LABEL_W}px repeat(${dayColumns.length},${colUnit})`;
  // helper pour positionner les labels de graduation sans débordement
  const rulerLabelStyle = (i: number): React.CSSProperties =>
    i === 0          ? {left: "2px"} :
    i === H_TOTAL    ? {right: "2px"} :
    {left:`${i/H_TOTAL*100}%`, transform:"translateX(-50%)"};

  return (
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
      {/* ── Column headers ── */}
      <div className="border-b border-border/60 bg-slate-50/80" style={{display:"grid",gridTemplateColumns:colTemplate}}>
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Technicien</div>
        {dayColumns.map((d,i)=>{
          const date=new Date(d+"T00:00:00");
          const isToday=d===today;
          return(
            <div key={d} className={`border-l border-border/40 px-2 py-2 flex flex-col items-center ${isToday?"bg-primary/5":""}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{WEEK_DAYS_FR[i%5]}</span>
              <span className={`text-lg font-bold leading-none mt-0.5 ${isToday?"text-primary":"text-foreground"}`}>{date.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* ── Hour ruler ── */}
      <div className="border-b border-border/40 bg-white" style={{display:"grid",gridTemplateColumns:colTemplate}}>
        <div/>
        {dayColumns.map(d=>(
          <div key={d} className="border-l border-border/40 relative h-6 overflow-hidden">
            {Array.from({length:H_TOTAL+1},(_,i)=>(
              (i % 3 === 0 || i === H_TOTAL) ? (
                <span key={i} className="absolute top-1 text-[9px] font-medium text-muted-foreground" style={rulerLabelStyle(i)}>
                  {(H_START+i).toString().padStart(2,"0")}h
                </span>
              ) : null
            ))}
          </div>
        ))}
      </div>

      {/* ── Tech rows ── */}
      {technicians.map(tech=>{
        const ml=maxLanes(tech.id);
        const rowH=ml*LANE_H+8;
        return(
          <div key={tech.id} className="border-b border-border/20 last:border-b-0"
            style={{display:"grid",gridTemplateColumns:colTemplate}}>
            {/* Label */}
            <div style={{height:rowH}} className="flex items-start gap-2 px-3 py-2 bg-slate-50/70 border-r border-border/40">
              <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                {tech.firstName[0]}{tech.lastName[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">{tech.name}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Technicien</p>
              </div>
            </div>
            {/* Day cells */}
            {dayColumns.map(d=>{
              const isToday=d===today;
              const daySlots=laneMap.get(`${tech.id}-${d}`)??[];
              return(
                <div key={d} ref={el=>{dayColRefs.current[`${tech.id}-${d}`]=el;}}
                  style={{height:rowH}}
                  className={`relative border-l border-border/30 ${isToday?"bg-primary/[0.025]":""}`}>
                  {/* Hour lines */}
                  {Array.from({length:H_TOTAL-1},(_,i)=>(
                    <div key={i} style={{left:`${(i+1)/H_TOTAL*100}%`}} className="absolute top-0 bottom-0 border-l border-border/15 pointer-events-none"/>
                  ))}
                  {/* Slots */}
                  {daySlots.map(slot=>{
                    const pv=preview[slot.id];
                    const start=pv?pv.start:timeToMin(slot.startTime);
                    const end=pv?pv.end:timeToMin(slot.endTime);
                    const leftPct=(start-H_START*60)/(H_TOTAL*60)*100;
                    const widthPct=(end-start)/(H_TOTAL*60)*100;
                    const top=slot.lane*LANE_H+3;
                    const height=LANE_H-6;
                    const color=slotColor(slot.projectServiceType);
                    const label=slotLabel(slot)??"Sans chantier";
                    const isDragging=draggingId===slot.id;
                    return(
                      <Tooltip key={slot.id} delayDuration={400}>
                        <TooltipTrigger asChild>
                          <div
                            style={{left:`${leftPct}%`,width:`max(${widthPct}%, 2px)`,top,height}}
                            className={`absolute rounded-lg ${color} text-white text-[10px] shadow-sm cursor-pointer select-none overflow-hidden px-1.5 py-1 flex flex-col ${isDragging?"shadow-xl ring-2 ring-white/50 opacity-90 z-20":"hover:shadow-md z-10 hover:brightness-110 transition-all"}`}
                            onClick={()=>onClickSlot(slot)}
                            onMouseDown={canManage?e=>{
                              e.preventDefault();
                              const colEl=dayColRefs.current[`${tech.id}-${d}`];
                              dragRef.current={id:slot.id,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),origSStr:slot.startTime,origEStr:slot.endTime,dayColRef:colEl,mouseX:e.clientX};
                              setDraggingId(slot.id);
                            }:undefined}
                          >
                            <div className="font-semibold leading-tight truncate">{label}</div>
                            {zoom>=0.8&&<div className="text-white/80 text-[9px] leading-tight">{slot.startTime}–{slot.endTime}</div>}
                            {zoom>=1&&slot.clientName&&slot.projectName&&<div className="text-white/70 text-[9px] leading-tight truncate">{slot.clientName}</div>}
                            <div className="flex gap-0.5 mt-auto">
                              {slot.hasLocationChange&&<MapPin className="h-2 w-2 text-white/80"/>}
                              {slot.hasTimeChange&&<Clock className="h-2 w-2 text-white/80"/>}
                              {slot.hasDiscount&&<Tag className="h-2 w-2 text-white/80"/>}
                            </div>
                            {canManage&&(
                              <>
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize" onMouseDown={e=>{e.preventDefault();e.stopPropagation();const colEl=dayColRefs.current[`${tech.id}-${d}`];resizeRef.current={id:slot.id,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),dayColRef:colEl,mouseX:e.clientX,edge:"start"};}}/>
                                <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize" onMouseDown={e=>{e.preventDefault();e.stopPropagation();const colEl=dayColRefs.current[`${tech.id}-${d}`];resizeRef.current={id:slot.id,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),dayColRef:colEl,mouseX:e.clientX,edge:"end"};}}/>
                              </>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="flex flex-col gap-0.5">
                          <p className="font-semibold text-xs">{slot.clientName??slot.projectName??"Sans chantier"}</p>
                          {slot.projectName&&slot.clientName&&<p className="text-[11px] opacity-80">{slot.projectName}</p>}
                          <p className="text-[11px] opacity-70">{slot.startTime} – {slot.endTime}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
      {technicians.length===0&&<div className="py-16 text-center text-sm text-muted-foreground">Aucun technicien actif.</div>}
      </div>{/* end overflow-x-auto */}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({slots,technicians,dayColumns,canManage,zoom,onClickSlot,onMove,onDayClick}:GridProps&{onDayClick:(d:string)=>void}){
  void onDayClick;
  return <TimelineGrid slots={slots} technicians={technicians} dayColumns={dayColumns} canManage={canManage} zoom={zoom} onClickSlot={onClickSlot} onMove={onMove}/>;
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({slots,technicians,selDay,canManage,zoom,onClickSlot,onMove}:{
  slots:Slot[];technicians:Technician[];selDay:string;canManage:boolean;zoom:number;
  onClickSlot:(s:Slot)=>void;
  onMove:(id:number,date:string,start:string,end:string,prev:{prevDate?:string;prevStartTime?:string;prevEndTime?:string})=>void;
}){
  return <TimelineGrid slots={slots} technicians={technicians} dayColumns={[selDay]} canManage={canManage} zoom={zoom} onClickSlot={onClickSlot} onMove={onMove}/>;
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({slots,monthRef,onDayClick}:{slots:Slot[];monthRef:Date;onDayClick:(d:string)=>void}){
  const today=toDateStr(new Date());
  const year=monthRef.getFullYear();const month=monthRef.getMonth();
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  // start from Monday of the first week
  const gridStart=getMondayOf(firstDay);
  // end on Sunday of the last week
  const gridEnd=addDays(getMondayOf(lastDay),6);
  const days:string[]=[];
  let cur=new Date(gridStart);
  while(cur<=gridEnd){days.push(toDateStr(cur));cur=addDays(cur,1);}

  const SERVICE_DOT_COLORS: Record<string,string>={
    clim:"bg-sky-400",pac:"bg-violet-400",chauffe_eau:"bg-orange-400",
    pv:"bg-yellow-400",vmc:"bg-teal-400",autre:"bg-slate-400",
  };

  return(
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b border-border/60 bg-slate-50/80">
        {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=>(
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/30 last:border-r-0">{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map(d=>{
          const isCurrentMonth=new Date(d+"T00:00:00").getMonth()===month;
          const isToday=d===today;
          const daySlots=slots.filter(s=>s.slotDate===d);
          const dotMap=new Map<string,number>();
          daySlots.forEach(s=>{const k=s.projectServiceType??"autre";dotMap.set(k,(dotMap.get(k)??0)+1);});
          return(
            <button key={d} onClick={()=>onDayClick(d)}
              className={`relative border-r border-b border-border/20 last:border-r-0 p-1.5 min-h-[72px] text-left flex flex-col hover:bg-muted/40 transition-colors ${!isCurrentMonth?"opacity-40":""}`}>
              <span className={`text-sm font-semibold leading-none mb-1.5 ${isToday?"h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs":"text-foreground"}`}>
                {new Date(d+"T00:00:00").getDate()}
              </span>
              <div className="flex flex-wrap gap-0.5">
                {Array.from(dotMap.entries()).map(([type,count])=>(
                  <div key={type} className={`${SERVICE_DOT_COLORS[type]??"bg-primary"} rounded-full px-1 py-0 text-white text-[9px] font-bold leading-4`}>{count}</div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Attribution View ─────────────────────────────────────────────────────────

function AttributionView({slots,technicians,dayDates,canManage:_c,onClickSlot}:{
  slots:Slot[];technicians:Technician[];dayDates:string[];canManage:boolean;onClickSlot:(s:Slot)=>void;
}){
  const [expanded,setExpanded]=useState<Set<number>>(new Set());
  const today=toDateStr(new Date());
  const toggle=(id:number)=>setExpanded(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const LABEL_W=148;
  return(
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-border/60 bg-slate-50/80" style={{display:"grid",gridTemplateColumns:`${LABEL_W}px repeat(5,1fr)`}}>
        <div className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Technicien</div>
        {dayDates.map((d,i)=>{
          const date=new Date(d+"T00:00:00");
          return(
            <div key={d} className="px-2 py-3 text-center border-l border-border/40">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{WEEK_DAYS_FR[i]}</p>
              <p className={`text-base font-bold leading-none mt-0.5 ${d===today?"text-primary":"text-foreground"}`}>{date.getDate()}</p>
            </div>
          );
        })}
      </div>
      {technicians.map(tech=>{
        const isExp=expanded.has(tech.id);
        const hasSlots=slots.some(s=>s.technicianId===tech.id);
        return(
          <div key={tech.id} className="border-b border-border/20 last:border-b-0">
            <div className="hover:bg-muted/30 transition-colors cursor-pointer" style={{display:"grid",gridTemplateColumns:`${LABEL_W}px repeat(5,1fr)`}} onClick={()=>hasSlots&&toggle(tech.id)}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                {hasSlots?(isExp?<ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>:<ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>):<span className="w-3.5 shrink-0"/>}
                <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{tech.firstName[0]}{tech.lastName[0]}</div>
                <p className="text-sm font-semibold text-foreground truncate">{tech.name}</p>
              </div>
              {dayDates.map(d=>{
                const count=slots.filter(s=>s.technicianId===tech.id&&s.slotDate===d).length;
                return(
                  <div key={d} className="border-l border-border/20 px-2 py-2.5 flex justify-center items-center min-h-[44px]">
                    {count===0?<span className="text-[10px] text-muted-foreground/30">—</span>:
                      <span className="rounded-full bg-primary/15 text-primary text-xs font-bold px-2 py-0.5">{count}</span>}
                  </div>
                );
              })}
            </div>
            {isExp&&(
              <div className="bg-slate-50/60 border-t border-border/20">
                {(()=>{
                  const allDay=dayDates.map(d=>slots.filter(s=>s.technicianId===tech.id&&s.slotDate===d));
                  const rows=Math.max(...allDay.map(a=>a.length),0);
                  return Array.from({length:rows},(_,ri)=>(
                    <div key={ri} className="border-t border-border/10" style={{display:"grid",gridTemplateColumns:`${LABEL_W}px repeat(5,1fr)`}}>
                      <div/>
                      {allDay.map((arr,di)=>{
                        const slot=arr[ri];
                        if(!slot)return<div key={di} className="border-l border-border/10 px-2 py-1.5"/>;
                        return(
                          <div key={di} className="border-l border-border/10 px-2 py-1.5">
                            <div className={`${slotColor(slot.projectServiceType)} text-white rounded-lg px-2 py-1.5 text-[11px] cursor-pointer hover:opacity-90 transition-opacity`} onClick={()=>onClickSlot(slot)}>
                              <div className="font-semibold truncate">{slotLabel(slot)??"Sans chantier"}</div>
                              <div className="text-white/80 text-[10px]">{slot.startTime}–{slot.endTime}</div>
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
      {technicians.length===0&&<div className="py-16 text-center text-sm text-muted-foreground">Aucun technicien actif.</div>}
    </div>
  );
}

// ─── Slot Detail Dialog ───────────────────────────────────────────────────────

function SlotDetailDialog({slot,onClose,onEdit,onDelete,onOpenProject,canManage}:{
  slot:Slot;onClose:()=>void;onEdit:()=>void;onDelete:()=>void;
  onOpenProject:(id:number)=>void;canManage:boolean;
}){
  const color=slotColor(slot.projectServiceType);
  const address=slot.projectAddress||slot.clientAddress;
  const label=slotLabel(slot)??"Créneau sans chantier";
  return(
    <Dialog open onOpenChange={o=>!o&&onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
              <Building2 className="h-5 w-5 text-white"/>
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base leading-snug">{label}</DialogTitle>
              {slot.projectRef&&<p className="text-xs text-muted-foreground mt-0.5">Réf. {slot.projectRef}</p>}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          {/* Horaires + statut */}
          <div className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-3 bg-muted/30">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0"/>
            <div>
              <p className="font-medium">{formatDateFr(slot.slotDate)}</p>
              <p className="text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
            </div>
            <StatusBadge status={slot.status}/>
          </div>

          {/* Technicien */}
          {slot.technicianName&&(
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 bg-white">
              <User className="h-3.5 w-3.5 text-muted-foreground"/>
              <span className="font-medium">{slot.technicianName}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">Technicien</Badge>
            </div>
          )}

          {/* Chantier */}
          {slot.projectId&&(
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chantier</p>
                <button onClick={()=>onOpenProject(slot.projectId!)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                  <ArrowUpRight className="h-3.5 w-3.5"/> Ouvrir
                </button>
              </div>
              {slot.projectName&&<p className="font-semibold text-foreground">{slot.projectName}</p>}
              {slot.projectRef&&<p className="text-xs text-muted-foreground">Réf. {slot.projectRef}</p>}
              {slot.projectServiceType&&(
                <Badge variant="secondary" className="w-fit text-xs">{SERVICE_LABELS[slot.projectServiceType]??slot.projectServiceType}</Badge>
              )}
            </div>
          )}

          {/* Client */}
          {(slot.clientName||slot.clientPhone||slot.clientAddress)&&(
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Client</p>
              {slot.clientName&&<div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground"/><span className="font-medium">{slot.clientName}</span></div>}
              {slot.clientPhone&&<div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground"/><a href={`tel:${slot.clientPhone}`} className="text-primary hover:underline">{slot.clientPhone}</a></div>}
              {slot.clientAddress&&(
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-muted-foreground text-xs">{slot.clientAddress}</p>
                    <a href={mapsUrl(slot.clientAddress)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary text-xs hover:underline mt-0.5">
                      <ExternalLink className="h-3 w-3"/> Ouvrir dans Maps
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Adresse chantier si différente */}
          {slot.projectAddress&&slot.projectAddress!==slot.clientAddress&&(
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Adresse chantier</p>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5"/>
                <div>
                  <p className="text-muted-foreground text-xs">{slot.projectAddress}</p>
                  <a href={mapsUrl(slot.projectAddress)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary text-xs hover:underline mt-0.5">
                    <ExternalLink className="h-3 w-3"/> Ouvrir dans Maps
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Alertes */}
          {(slot.hasLocationChange||slot.hasTimeChange||slot.hasDiscount)&&(
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-amber-800 font-medium text-xs uppercase tracking-wide"><AlertTriangle className="h-3.5 w-3.5"/> Modifications</div>
              {slot.hasLocationChange&&<div className="flex items-center gap-2 text-amber-900 text-xs"><MapPin className="h-3.5 w-3.5"/> Changement de lieu</div>}
              {slot.hasTimeChange&&slot.prevStartTime&&<div className="flex items-center gap-2 text-amber-900 text-xs"><Clock className="h-3.5 w-3.5"/> Déplacé depuis {slot.prevDate&&slot.prevDate!==slot.slotDate?`${slot.prevDate} `:""}{slot.prevStartTime}–{slot.prevEndTime}</div>}
              {slot.hasDiscount&&<div className="flex items-center gap-2 text-amber-900 text-xs"><Tag className="h-3.5 w-3.5"/> Remise{slot.discountNote?` : ${slot.discountNote}`:""}</div>}
              {slot.changeNote&&<p className="text-amber-800 text-xs italic">{slot.changeNote}</p>}
            </div>
          )}

          {/* Notes */}
          {slot.notes&&(
            <div className="rounded-xl border border-border/60 px-4 py-3 bg-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><FileText className="h-3.5 w-3.5"/> Notes</div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{slot.notes}</p>
            </div>
          )}
        </div>

        {canManage&&(
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5"/> Supprimer
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onEdit}><Pencil className="h-3.5 w-3.5"/> Modifier</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Slot Form Dialog ─────────────────────────────────────────────────────────

type SlotFormRow = {
  technicianId:number;projectId:number|null;slotDate:string;
  startTime:string;endTime:string;notes?:string|null;
  status:"scheduled"|"in_progress"|"completed"|"cancelled";
  hasLocationChange:boolean;hasTimeChange:boolean;hasDiscount:boolean;
  discountNote?:string|null;changeNote?:string|null;
};

function SlotFormDialog({open,onClose,technicians,projects,existingSlots,initialSlot,defaultDate,onSave,saving}:{
  open:boolean;onClose:()=>void;
  technicians:Technician[];projects:{id:number;name:string;reference:string|null}[];
  existingSlots:Slot[];initialSlot?:Slot|null;defaultDate?:string;
  onSave:(rows:SlotFormRow[])=>void;saving:boolean;
}){
  const [selectedTechIds,setSelectedTechIds]=useState<Set<number>>(
    new Set(initialSlot?[initialSlot.technicianId]:technicians.slice(0,1).map(t=>t.id))
  );
  const [projId,setProjId]=useState(initialSlot?.projectId?String(initialSlot.projectId):"none");
  const [date,setDate]=useState(initialSlot?.slotDate??defaultDate??toDateStr(new Date()));
  const [startTime,setStartTime]=useState(initialSlot?.startTime??"08:00");
  const [endTime,setEndTime]=useState(initialSlot?.endTime??"12:00");
  const [notes,setNotes]=useState(initialSlot?.notes??"");
  const [status,setStatus]=useState<SlotFormRow["status"]>((initialSlot?.status as SlotFormRow["status"])??"scheduled");
  const [hasLocChange,setHasLocChange]=useState(initialSlot?.hasLocationChange??false);
  const [hasTimeChange,setHasTimeChange]=useState(initialSlot?.hasTimeChange??false);
  const [hasDiscount,setHasDiscount]=useState(initialSlot?.hasDiscount??false);
  const [discountNote,setDiscountNote]=useState(initialSlot?.discountNote??"");
  const [changeNote,setChangeNote]=useState(initialSlot?.changeNote??"");

  const toggleTech=(id:number)=>setSelectedTechIds(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const canSubmit=selectedTechIds.size>0&&date&&startTime&&endTime&&startTime<endTime;

  // Live overlap warning
  const conflicts = Array.from(selectedTechIds).flatMap(tid=>{
    const tech=technicians.find(t=>t.id===tid);
    const conflicting=existingSlots.filter(s=>
      s.technicianId===tid&&s.slotDate===date&&
      (initialSlot?s.id!==initialSlot.id:true)&&
      slotsOverlap(startTime,endTime,s.startTime,s.endTime)
    );
    return conflicting.map(c=>({tech:tech?.name??"",slot:c}));
  });

  const handleSave=()=>{
    if(conflicts.length>0){
      toast.error(`Conflit horaire : ${conflicts[0].tech} a déjà un créneau ${conflicts[0].slot.startTime}–${conflicts[0].slot.endTime}`);
      return;
    }
    const base:Omit<SlotFormRow,"technicianId">={
      projectId:projId!=="none"?Number(projId):null,
      slotDate:date,startTime,endTime,notes:notes.trim()||null,status,
      hasLocationChange:hasLocChange,hasTimeChange,hasDiscount,
      discountNote:discountNote.trim()||null,changeNote:changeNote.trim()||null,
    };
    onSave(Array.from(selectedTechIds).map(tid=>({...base,technicianId:tid})));
  };

  return(
    <Dialog open={open} onOpenChange={o=>!o&&onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initialSlot?"Modifier le créneau":"Nouveau créneau"}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          {/* Techniciens */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Technicien(s)</label>
            <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 p-2 bg-slate-50/60">
              {technicians.map(t=>{
                const sel=selectedTechIds.has(t.id);
                return(
                  <button key={t.id} type="button" onClick={()=>toggleTech(t.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all border ${sel?"bg-primary text-white border-primary":"bg-white text-foreground border-border hover:border-primary/40"}`}>
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${sel?"bg-white/20":"bg-primary/15 text-primary"}`}>{t.firstName[0]}{t.lastName[0]}</span>
                    {t.firstName}
                    {sel&&<X className="h-3 w-3 opacity-70"/>}
                  </button>
                );
              })}
            </div>
            {selectedTechIds.size>1&&<p className="text-xs text-muted-foreground">→ {selectedTechIds.size} créneaux identiques seront créés</p>}
          </div>
          {/* Chantier */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chantier <span className="text-muted-foreground font-normal">(optionnel)</span></label>
            <Select value={projId} onValueChange={setProjId}>
              <SelectTrigger><SelectValue placeholder="Aucun"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun chantier —</SelectItem>
                {projects.map(p=><SelectItem key={p.id} value={String(p.id)}>{p.name}{p.reference?` (${p.reference})`:""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Date + heures */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1"><label className="text-sm font-medium">Date</label><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Début</label><Input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} step={900}/></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Fin</label><Input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} step={900}/></div>
          </div>
          {/* Conflit warning */}
          {conflicts.length>0&&(
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs uppercase tracking-wide"><AlertTriangle className="h-3.5 w-3.5"/> Conflit horaire</div>
              {conflicts.map((c,i)=>(
                <p key={i} className="text-xs text-rose-700">{c.tech} a déjà : {c.slot.startTime}–{c.slot.endTime} ({slotLabel(c.slot)??"créneau sans chantier"})</p>
              ))}
            </div>
          )}
          {/* Statut */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Statut</label>
            <Select value={status} onValueChange={v=>setStatus(v as SlotFormRow["status"])}>
              <SelectTrigger><SelectValue/></SelectTrigger>
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
            <Textarea placeholder="Informations complémentaires…" value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="resize-none"/>
          </div>
          {/* Alertes */}
          <div className="rounded-xl border border-border/60 px-4 py-3 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alertes</p>
            <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={hasLocChange} onChange={e=>setHasLocChange(e.target.checked)} className="h-4 w-4 rounded accent-primary"/><MapPin className="h-3.5 w-3.5 text-muted-foreground"/><span className="text-sm">Changement de lieu</span></label>
            <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={hasTimeChange} onChange={e=>setHasTimeChange(e.target.checked)} className="h-4 w-4 rounded accent-primary"/><Clock className="h-3.5 w-3.5 text-muted-foreground"/><span className="text-sm">Déplacement horaire</span></label>
            <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={hasDiscount} onChange={e=>setHasDiscount(e.target.checked)} className="h-4 w-4 rounded accent-primary"/><Tag className="h-3.5 w-3.5 text-muted-foreground"/><span className="text-sm">Remise appliquée</span></label>
            {hasDiscount&&<Input placeholder="Détail de la remise…" value={discountNote} onChange={e=>setDiscountNote(e.target.value)} className="text-sm"/>}
            {(hasLocChange||hasTimeChange)&&<Input placeholder="Note sur la modification…" value={changeNote} onChange={e=>setChangeNote(e.target.value)} className="text-sm"/>}
          </div>
        </div>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!canSubmit||saving||conflicts.length>0} onClick={handleSave}>
            {saving?"Enregistrement…":initialSlot?"Modifier":"Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({status}:{status:string}){
  const m:Record<string,{label:string;className:string}>={
    scheduled:{label:"Planifié",className:"bg-blue-100 text-blue-700"},
    in_progress:{label:"En cours",className:"bg-amber-100 text-amber-700"},
    completed:{label:"Terminé",className:"bg-emerald-100 text-emerald-700"},
    cancelled:{label:"Annulé",className:"bg-slate-100 text-slate-500"},
  };
  const s=m[status]??{label:status,className:"bg-muted text-muted-foreground"};
  return<span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>;
}

// suppress unused import warning
void WEEK_DAYS_FULL;
