import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Plus, MapPin, Clock, Tag,
  AlertTriangle, Layers,
  X, Phone, User, Building2, FileText, ExternalLink, Pencil, Trash2,
  ZoomIn, ZoomOut, ArrowUpRight, GripVertical, EyeOff, Users, Search, Link2,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { SharedProjectForm, SharedProjectFormState, INITIAL_SHARED_FORM } from "./ProjectFormUnified";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useRoleMatrix() {
  const auth = trpc.auth.me.useQuery();
  const matrix = trpc.security.roleMatrix.useQuery(undefined, { enabled: !!auth.data });
  return { permissions: matrix.data?.permissions, role: matrix.data?.role ?? auth.data?.role, userId: (auth.data as {openId?:string}|null)?.openId ?? null };
}

function getMondayOf(d: Date): Date {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); r.setHours(0,0,0,0); return r;
}
function getMonthStart(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
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
const ALL_DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const H_START = 7;
const H_END   = 19;
const H_TOTAL = H_END - H_START; // 12

const SERVICE_COLORS: Record<string,string> = {
  clim:"bg-sky-500",pac:"bg-violet-500",chauffe_eau:"bg-orange-500",
  pv:"bg-yellow-500",vmc:"bg-teal-500",autre:"bg-slate-500",
};
const SERVICE_LABELS: Record<string,string> = {
  clim:"Clim",pac:"PAC",chauffe_eau:"Chauffe-eau",pv:"PV",vmc:"VMC",autre:"Autre",
};
const SERVICE_EMOJI: Record<string,string> = {
  clim:"❄️",pac:"♨️",chauffe_eau:"🚿",pv:"☀️",vmc:"💨",autre:"🔧",
};
function slotColor(serviceType: string|null) { return SERVICE_COLORS[serviceType??""]??"bg-primary"; }
function slotBgStyle(slot: {projectColor:string|null;projectServiceType:string|null}): {bgClass:string;bgStyle:React.CSSProperties|undefined} {
  if (slot.projectColor) return {bgClass:"",bgStyle:{backgroundColor:slot.projectColor}};
  return {bgClass:slotColor(slot.projectServiceType),bgStyle:undefined};
}
function slotLabel(slot: Slot) { return slot.projectName ?? slot.freeClientName ?? slot.clientName ?? null; }

// ─── Types ────────────────────────────────────────────────────────────────────

type Slot = {
  id:number; technicianId:number|null; technicianName:string|null;
  projectId:number|null; projectName:string|null; projectRef:string|null;
  projectAddress:string|null; projectServiceType:string|null; projectColor:string|null;
  freeClientName:string|null; freeClientAddress:string|null; freeClientPhone:string|null; gcalEventUid:string|null;
  clientName:string|null; clientPhone:string|null; clientAddress:string|null;
  slotDate:string; startTime:string; endTime:string; notes:string|null; status:string;
  hasLocationChange:boolean; hasTimeChange:boolean; hasDiscount:boolean;
  discountNote:string|null; changeNote:string|null;
  prevDate:string|null; prevStartTime:string|null; prevEndTime:string|null;
};
type Technician = {id:number;name:string;firstName:string;lastName:string;email:string|null;category:string};
type ViewMode = "semaine"|"jour"|"mois";
type GCalEvent = {technicianId:number;uid:string;summary:string;date:string;startTime:string;endTime:string;location:string|null};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { permissions, userId, role } = useRoleMatrix();
  const canManage = !!permissions?.manageInterventions;
  const isTechnicien = role === "technicien";
  // Techniciens ont manageInterventions=true mais ne peuvent pas modifier le planning
  const canEditPlanning = canManage && !isTechnicien;
  const [, setLocation] = useLocation();

  const [view, setView]           = useState<ViewMode>(() => typeof window !== "undefined" && window.innerWidth < 640 ? "jour" : "semaine");
  const [monday, setMonday]       = useState<Date>(() => getMondayOf(new Date()));
  const [selDay, setSelDay]       = useState<string>(() => toDateStr(new Date()));
  const [monthRef, setMonthRef]   = useState<Date>(() => getMonthStart(new Date()));
  const [zoom, setZoom]           = useState(1);
  const [hiddenTechs, setHiddenTechs] = useState<Set<number>>(new Set());
  const [techOrder, setTechOrder] = useState<number[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [techFilterOpen, setTechFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<Set<string>>(new Set());
  const [pinnedTechs, setPinnedTechs] = useState<Set<number>>(new Set());
  const [techShowAll, setTechShowAll] = useState(false);
  const {data:myTechProfile} = trpc.planning.getMyTechnicianId.useQuery(
    undefined, {enabled:isTechnicien, staleTime:Infinity}
  );
  const myTechId = myTechProfile?.technicianId ?? null;
  const prefsLoaded = useRef(false);
  // Charger les préférences dès que l'userId est connu (une seule fois)
  useEffect(()=>{
    if(!userId||prefsLoaded.current) return;
    prefsLoaded.current=true;
    try {
      const hidden=JSON.parse(localStorage.getItem(`tf-planning-hidden-${userId}`)??"[]") as number[];
      if(hidden.length>0) setHiddenTechs(new Set(hidden));
    } catch {}
    try {
      const order=JSON.parse(localStorage.getItem(`tf-planning-order-${userId}`)??"[]") as number[];
      if(order.length>0) setTechOrder(order);
    } catch {}
  },[userId]);
  // Sauvegarder à chaque changement (clé par utilisateur)
  useEffect(()=>{
    if(!userId) return;
    localStorage.setItem(`tf-planning-hidden-${userId}`,JSON.stringify(Array.from(hiddenTechs)));
  },[userId,hiddenTechs]);
  useEffect(()=>{
    if(!userId) return;
    localStorage.setItem(`tf-planning-order-${userId}`,JSON.stringify(techOrder));
  },[userId,techOrder]);

  // Compute weekStart from view context
  const weekStart = view === "jour"
    ? toDateStr(getMondayOf(new Date(selDay+"T00:00:00")))
    : toDateStr(monday);

  const monthRangeStart = React.useMemo(() => {
    const firstDay = new Date(monthRef.getFullYear(), monthRef.getMonth(), 1);
    return toDateStr(getMondayOf(firstDay));
  }, [monthRef]);
  const monthRangeEnd = React.useMemo(() => {
    const lastDay = new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 0);
    return toDateStr(addDays(getMondayOf(lastDay), 4));
  }, [monthRef]);

  const dayDates = Array.from({length:5},(_,i)=>toDateStr(addDays(new Date(weekStart+"T00:00:00"),i)));

  const utils = trpc.useUtils();
  const {data:weekSlots=[],isLoading:weekSlotsLoading} = trpc.planning.listWeek.useQuery(
    {weekStart}, {enabled: view !== "mois"}
  );
  const {data:monthSlots=[],isLoading:monthSlotsLoading} = trpc.planning.listRange.useQuery(
    {start:monthRangeStart,end:monthRangeEnd}, {enabled: view === "mois"}
  );
  const slots = view === "mois" ? monthSlots : weekSlots;
  const slotsLoading = view === "mois" ? monthSlotsLoading : weekSlotsLoading;
  const {data:technicians=[],isLoading:techLoading} = trpc.planning.listTechnicians.useQuery();
  const {data:unassignedUpcoming=[]} = trpc.planning.getUnassignedUpcoming.useQuery(
    undefined, {enabled: canManage, staleTime: 2*60*1000}
  );
  const {data:projectsRaw=[]} = trpc.management.projects.list.useQuery();
  const projects = projectsRaw.map(p=>({id:p.id,name:p.title,reference:p.reference,clientName:p.clientName??null}));

  // Approved leaves for congé indicators in the grid
  const approvedLeavesRangeStart = view === "mois" ? monthRangeStart : weekStart;
  const approvedLeavesRangeEnd = view === "mois" ? monthRangeEnd : toDateStr(addDays(new Date(weekStart+"T00:00:00"),6));
  const {data:approvedLeaves=[]} = trpc.management.timeEntries.leaveRequests.listApprovedForPlanning.useQuery(
    {startDate: approvedLeavesRangeStart, endDate: approvedLeavesRangeEnd}
  );
  const {data:congeEntries=[]} = trpc.management.timeEntries.listCongeForPlanning.useQuery(
    {startDate: approvedLeavesRangeStart, endDate: approvedLeavesRangeEnd}
  );
  // Google Calendar events overlay
  const {data:gcalEvents=[]} = trpc.management.timeEntries.listGCalEvents.useQuery(
    {startDate: approvedLeavesRangeStart, endDate: approvedLeavesRangeEnd},
    {staleTime: 5*60*1000, refetchOnWindowFocus: false}
  );
  // Techniciens avec URL Google Calendar (admin seulement)
  const {data:techsAdmin=[]} = trpc.management.timeEntries.listTechnicians.useQuery(
    undefined, {enabled: canManage}
  );
  const gcalUrlMap = React.useMemo(()=>{
    const m = new Map<number, string|null>();
    techsAdmin.forEach(t=>m.set(t.id, (t as {googleCalendarIcalUrl?:string|null}).googleCalendarIcalUrl ?? null));
    return m;
  }, [techsAdmin]);
  const allCongeIndicators = React.useMemo(()=>[
    ...approvedLeaves,
    ...congeEntries.map(e=>({technicianId:e.technicianId,startDate:e.date,endDate:e.date})),
  ],[approvedLeaves,congeEntries]);

  const inv = useCallback(() => {
    if (view === "mois") utils.planning.listRange.invalidate({start:monthRangeStart,end:monthRangeEnd});
    else utils.planning.listWeek.invalidate({weekStart});
  }, [utils, weekStart, view, monthRangeStart, monthRangeEnd]);
  const createMut   = trpc.planning.create.useMutation({onSuccess:()=>{inv();toast.success("Créneau créé");},onError:e=>toast.error(e.message)});
  const updateMut   = trpc.planning.update.useMutation({onSuccess:()=>{inv();toast.success("Créneau mis à jour");},onError:e=>toast.error(e.message)});
  const moveMut     = trpc.planning.move.useMutation({onSuccess:inv,onError:e=>toast.error(e.message)});
  const deleteMut   = trpc.planning.delete.useMutation({onSuccess:()=>{inv();toast.success("Créneau supprimé");},onError:e=>toast.error(e.message)});
  // Mutation silencieuse pour les transitions de statut automatiques
  const autoStatusMut = trpc.planning.update.useMutation({onSuccess:inv});

  // Auto-transition des statuts selon l'heure courante
  const autoApplied = useRef<Record<number,string>>({});
  useEffect(()=>{
    if(!canManage||slots.length===0) return;
    const now=new Date();
    const todayStr=toDateStr(now);
    const currentMin=now.getHours()*60+now.getMinutes();
    for(const slot of slots){
      const startMin=timeToMin(slot.startTime);
      const endMin=timeToMin(slot.endTime);
      const isPast=slot.slotDate<todayStr;
      const isToday=slot.slotDate===todayStr;
      let newStatus:"in_progress"|"completed"|null=null;
      if(isPast&&(slot.status==="scheduled"||slot.status==="in_progress")){
        newStatus="completed";
      } else if(isToday){
        if(slot.status==="scheduled"&&currentMin>=startMin)
          newStatus=currentMin>=endMin?"completed":"in_progress";
        else if(slot.status==="in_progress"&&currentMin>=endMin)
          newStatus="completed";
      }
      if(newStatus&&autoApplied.current[slot.id]!==newStatus){
        autoApplied.current[slot.id]=newStatus;
        autoStatusMut.mutate({id:slot.id,status:newStatus});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[slots,canManage]);

  // Refetch toutes les minutes pour détecter les transitions sans interaction
  useEffect(()=>{
    const id=setInterval(()=>inv(),60_000);
    return()=>clearInterval(id);
  },[inv]);

  const touchStartX = useRef<number|null>(null);
  const touchStartY = useRef<number|null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeSnapping, setSwipeSnapping] = useState(false);
  const gridWrapRef = useRef<HTMLDivElement>(null);

  // touchmove impératif (passive:false) pour pouvoir bloquer le scroll page
  useEffect(()=>{
    const el = gridWrapRef.current;
    if(!el) return;
    const onMove = (e: TouchEvent) => {
      if(touchStartX.current===null||touchStartY.current===null) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){
        e.preventDefault();
        // résistance légère : le grid suit mais freine
        const maxPull = typeof window!=="undefined" ? window.innerWidth*0.45 : 180;
        setSwipeOffset(Math.sign(dx)*Math.min(Math.abs(dx)*0.75, maxPull));
      }
    };
    el.addEventListener("touchmove", onMove, {passive:false});
    return()=>el.removeEventListener("touchmove", onMove);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipeSnapping(false);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if(touchStartX.current===null||touchStartY.current===null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){
      // Navigation + reset instantané (le nouveau contenu s'affiche)
      if(dx<0) goNext(); else goPrev();
      setSwipeOffset(0);
    } else {
      // Pas assez de swipe → retour animé
      setSwipeSnapping(true);
      setSwipeOffset(0);
      setTimeout(()=>setSwipeSnapping(false), 220);
    }
  };

  const [gcalUrlOpen, setGcalUrlOpen] = useState<number|null>(null); // technicianId or null
  const [gcalUrlInput, setGcalUrlInput] = useState("");
  const [gcalTestResult, setGcalTestResult] = useState<{ok:boolean;httpStatus:number|null;error:string|null;eventCount:number;preview:string|null}|null>(null);
  const updateGCalUrlMut = trpc.management.timeEntries.updateGCalUrl.useMutation({
    onSuccess: () => {
      utils.management.timeEntries.listTechnicians.invalidate();
      utils.management.timeEntries.listGCalEvents.invalidate();
      toast.success("Calendrier Google lié.");
      setGcalUrlOpen(null);
      setGcalTestResult(null);
    },
    onError: e => toast.error(e.message),
  });
  const testGCalMut = trpc.management.timeEntries.testGCalConnection.useMutation({
    onSuccess: (r) => setGcalTestResult(r),
    onError: e => setGcalTestResult({ok:false,httpStatus:null,error:e.message,eventCount:0,preview:null}),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState<{techId:number|null;date:string;start:string;end:string}|null>(null);
  const [detailSlot, setDetailSlot] = useState<Slot|null>(null);
  const [editSlot,   setEditSlot]   = useState<Slot|null>(null);
  const [deleteSlot, setDeleteSlot] = useState<Slot|null>(null);
  const [duplicateSource, setDuplicateSource] = useState<Slot|null>(null);
  const [convertSlot, setConvertSlot] = useState<Slot|null>(null);

  const formatNavLabel = () => {
    if (view==="semaine") {
      const fri = addDays(new Date(weekStart+"T00:00:00"),4);
      const mo = new Date(weekStart+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
      const fri2 = fri.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
      return `Sem. ${getISOWeek(new Date(weekStart+"T00:00:00"))}  ·  ${mo} – ${fri2}`;
    }
    if (view==="jour") return formatDateFr(selDay);
    return `${MONTHS_FR[monthRef.getMonth()]} ${monthRef.getFullYear()}`;
  };

  const goNext = () => {
    if (view==="semaine") setMonday(d=>addDays(d,7));
    if (view==="jour") setSelDay(d=>toDateStr(addDays(new Date(d+"T00:00:00"),1)));
    if (view==="mois") setMonthRef(d=>addMonths(d,1));
  };
  const goPrev = () => {
    if (view==="semaine") setMonday(d=>addDays(d,-7));
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
    rows.forEach(r => createMut.mutate(r));
    setCreateOpen(false);
  };

  const handleSaveEdit = (rows: SlotFormRow[]) => {
    if (!editSlot) return;
    rows.forEach(r => updateMut.mutate({id:editSlot.id,...r}));
    setEditSlot(null);
  };

  // Techniciens triés + filtrés selon l'ordre, la visibilité et la catégorie
  const sortedVisibleTechs = React.useMemo(()=>{
    const orderMap = new Map(techOrder.map((id,i)=>[id,i]));
    const realFilters = new Set(Array.from(activeCategoryFilters).filter(c=>c!=="unassigned"));
    const onlyUnassigned = activeCategoryFilters.size > 0 && realFilters.size === 0;
    // Vue technicien par défaut (pas de filtre actif et pas "Tout" explicitement cliqué)
    const isTechDefaultView = isTechnicien && myTechId !== null && !techShowAll && activeCategoryFilters.size === 0;
    return [...technicians]
      .sort((a,b)=>(orderMap.has(a.id)?orderMap.get(a.id)!:9999)-(orderMap.has(b.id)?orderMap.get(b.id)!:9999))
      .filter(t=>{
        if(hiddenTechs.has(t.id)) return false;
        if(isTechDefaultView) return t.id === myTechId || pinnedTechs.has(t.id);
        if(onlyUnassigned) return pinnedTechs.has(t.id);
        if(realFilters.size===0) return true;
        return realFilters.has(t.category as string)||pinnedTechs.has(t.id);
      });
  },[technicians,techOrder,hiddenTechs,activeCategoryFilters,pinnedTechs,isTechnicien,myTechId,techShowAll]);

  // Filtre slots par recherche client
  const filteredSlots = React.useMemo(()=>{
    const q = clientSearch.trim().toLowerCase();
    if (!q) return slots;
    return slots.filter(s=>{
      const hay = [s.clientName, s.projectName, s.freeClientName].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  },[slots, clientSearch]);

  const {data:searchResults=[],isLoading:searchLoading} = trpc.planning.search.useQuery(
    {q:clientSearch.trim()},
    {enabled:clientSearch.trim().length>=2, staleTime:30_000}
  );

  const isLoading = slotsLoading || techLoading;

  const VIEW_BUTTONS: {key:ViewMode;label:string}[] = [
    {key:"semaine",label:"Semaine"},
    {key:"jour",label:"Jour"},
    {key:"mois",label:"Mois"},
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        {/* ── Filtre catégorie ── */}
        <div className="flex items-center gap-1.5 flex-wrap order-first sm:order-none">
          {/* Tout */}
          <button onClick={()=>{setActiveCategoryFilters(new Set());setPinnedTechs(new Set());setTechShowAll(true);}}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${activeCategoryFilters.size===0&&(techShowAll||!isTechnicien)?"bg-slate-800 text-white border-slate-800":"border-slate-200 text-slate-500 hover:border-slate-400"}`}>
            Tout
          </button>
          {(["installation","sav","unassigned"] as const)
            .filter(cat=>cat!=="unassigned"||canEditPlanning)
            .map(cat=>{
              const labels={installation:"Installation",sav:"SAV / Dépannage",unassigned:"À affecter"};
              const active=activeCategoryFilters.has(cat);
              const colors={
                installation: active?"bg-blue-600 text-white border-blue-600":"border-blue-200 text-blue-600 hover:border-blue-400",
                sav: active?"bg-violet-600 text-white border-violet-600":"border-violet-200 text-violet-600 hover:border-violet-400",
                unassigned: active?"bg-amber-500 text-white border-amber-500":"border-amber-200 text-amber-600 hover:border-amber-400",
              };
              return(
                <button key={cat} onClick={()=>{setActiveCategoryFilters(s=>{const n=new Set(s);if(n.has(cat))n.delete(cat);else n.add(cat);return n;});setTechShowAll(false);}}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${colors[cat]}`}>
                  {labels[cat]}
                </button>
              );
            })}
        </div>

        {/* ── Filtre techniciens (en premier sur mobile) ── */}
        {!isLoading && technicians.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 order-first sm:order-none">
            {/* Mobile tech filter */}
            <div className="sm:hidden relative">
              <button
                onClick={()=>setTechFilterOpen(o=>!o)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-medium shadow-sm"
              >
                <Users className="h-4 w-4 text-muted-foreground"/>
                Techniciens{hiddenTechs.size>0?` (${technicians.length-hiddenTechs.size}/${technicians.length})`:""}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground"/>
              </button>
              {techFilterOpen&&(
                <div className="absolute top-full left-0 z-50 mt-1 min-w-[200px] rounded-xl border border-border bg-white shadow-xl p-2">
                  {technicians.map(t=>{
                    const hidden=hiddenTechs.has(t.id);
                    return(
                      <label key={t.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={!hidden}
                          onChange={()=>setHiddenTechs(s=>{const n=new Set(s);if(hidden)n.delete(t.id);else n.add(t.id);return n;})}
                          className="h-4 w-4 rounded border-border accent-primary"/>
                        <span className="text-sm">{t.firstName} {t.lastName}</span>
                      </label>
                    );
                  })}
                  {hiddenTechs.size>0&&(
                    <button onClick={()=>{setHiddenTechs(new Set());setTechFilterOpen(false);}}
                      className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-slate-50">
                      Tout afficher
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Desktop chips */}
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              {(()=>{
                const realFilters=new Set(Array.from(activeCategoryFilters).filter(c=>c!=="unassigned"));
                const onlyUnassigned=activeCategoryFilters.size>0&&realFilters.size===0;
                return technicians.map(t=>{
                  const hidden=hiddenTechs.has(t.id);
                  const hasGcal=!!gcalUrlMap.get(t.id);
                  const inActiveCat=!onlyUnassigned&&(realFilters.size===0||realFilters.has(t.category as string));
                  const isPinned=pinnedTechs.has(t.id);
                  const chipClass=inActiveCat
                    ?(hidden?"border-slate-200 bg-slate-100 text-slate-400 line-through":"border-primary/30 bg-primary/8 text-primary hover:bg-primary/15")
                    :(isPinned?"border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100":"border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600");
                  return(
                    <div key={t.id} className="flex items-center gap-0.5">
                      <button
                        onClick={()=>{
                          if(inActiveCat) setHiddenTechs(s=>{const n=new Set(s);if(hidden)n.delete(t.id);else n.add(t.id);return n;});
                          else setPinnedTechs(s=>{const n=new Set(s);if(isPinned)n.delete(t.id);else n.add(t.id);return n;});
                        }}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${chipClass}`}
                      >
                        {hidden&&inActiveCat&&<EyeOff className="h-3 w-3"/>}
                        {t.firstName[0]}{t.lastName[0]} · {t.firstName}
                      </button>
                      {canEditPlanning&&(
                        <button
                          onClick={()=>{setGcalUrlInput(gcalUrlMap.get(t.id)??"");setGcalUrlOpen(t.id);}}
                          className={`rounded-full p-1 transition-colors ${hasGcal?"text-green-600 hover:bg-green-50":"text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}
                          title={hasGcal?"Calendrier Google lié":"Lier Google Calendar"}
                        >
                          <Link2 className="h-3 w-3"/>
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
              {(hiddenTechs.size>0||pinnedTechs.size>0)&&(
                <button onClick={()=>{setHiddenTechs(new Set());setPinnedTechs(new Set());}}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                  Tout afficher
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Header nav + contrôles ── */}
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
            <button onClick={()=>setSearchOpen(true)}
              className="rounded-xl border border-border bg-white p-1.5 shadow-sm hover:bg-muted transition-colors"
              title="Rechercher">
              <Search className="h-4 w-4"/>
            </button>
            {/* View toggle */}
            {/* Mobile */}
            <select
              className="sm:hidden rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-medium shadow-sm"
              value={view}
              onChange={e=>setView(e.target.value as ViewMode)}
            >
              <option value="semaine">Semaine</option>
              <option value="jour">Jour</option>
              <option value="mois">Mois</option>
            </select>
            {/* Desktop */}
            <div className="hidden sm:flex rounded-xl border border-border bg-white shadow-sm overflow-hidden">
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
            {canEditPlanning&&(
              <Button size="sm" onClick={()=>setCreateOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4"/> Créer
              </Button>
            )}
          </div>
        </div>

        {/* ── Bannière alerte créneaux non affectés ── */}
        {canEditPlanning && unassignedUpcoming.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {unassignedUpcoming.length} créneau{unassignedUpcoming.length>1?"x":""} non affecté{unassignedUpcoming.length>1?"s":""} dans les 14 prochains jours
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {unassignedUpcoming.slice(0,3).map(s=>`${formatDateFr(s.slotDate)} ${s.startTime}–${s.endTime}${s.label?` · ${s.label}`:""}`).join(" · ")}
                {unassignedUpcoming.length>3?` · +${unassignedUpcoming.length-3} autre${unassignedUpcoming.length-3>1?"s":""}…`:""}
              </p>
            </div>
            <button onClick={()=>setActiveCategoryFilters(new Set(["unassigned"]))}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap underline underline-offset-2">
              Voir tout
            </button>
          </div>
        )}

        <div ref={gridWrapRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          style={{touchAction:"pan-y"}}>
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Chargement…</div>
        ) : view==="semaine" ? (
          <WeekView slots={filteredSlots} technicians={sortedVisibleTechs} dayColumns={dayDates} canManage={canEditPlanning} zoom={zoom} approvedLeaves={allCongeIndicators} gcalEvents={gcalEvents}
            showUnassignedRow={canEditPlanning&&(activeCategoryFilters.size===0||activeCategoryFilters.has("unassigned"))}
            swipeOffset={swipeOffset} swipeSnapping={swipeSnapping}
            onClickSlot={setDetailSlot}
            onMove={(id,date,start,end,prev,technicianId)=>{
              if(technicianId!==undefined) updateMut.mutate({id,technicianId,slotDate:date,startTime:start,endTime:end});
              else moveMut.mutate({id,slotDate:date,startTime:start,endTime:end,...prev});
            }}
            onCellClick={canEditPlanning?(techId,date,start,end)=>setQuickCreate({techId,date,start,end}):undefined}
            onDayClick={d=>{setSelDay(d);setView("jour");}}
            onReorder={canEditPlanning?setTechOrder:undefined}
          />
        ) : view==="jour" ? (
          <DayView slots={filteredSlots} technicians={sortedVisibleTechs} selDay={selDay} canManage={canEditPlanning} zoom={zoom} approvedLeaves={allCongeIndicators} gcalEvents={gcalEvents}
            showUnassignedRow={canEditPlanning&&(activeCategoryFilters.size===0||activeCategoryFilters.has("unassigned"))}
            swipeOffset={swipeOffset} swipeSnapping={swipeSnapping}
            onClickSlot={setDetailSlot}
            onMove={(id,date,start,end,prev,technicianId)=>{
              if(technicianId!==undefined) updateMut.mutate({id,technicianId,slotDate:date,startTime:start,endTime:end});
              else moveMut.mutate({id,slotDate:date,startTime:start,endTime:end,...prev});
            }}
            onCellClick={canEditPlanning?(techId,date,start,end)=>setQuickCreate({techId,date,start,end}):undefined}
            onReorder={canEditPlanning?setTechOrder:undefined}
          />
        ) : (
          <MonthGrid slots={filteredSlots} technicians={sortedVisibleTechs} monthRef={monthRef} canManage={canEditPlanning} approvedLeaves={allCongeIndicators} gcalEvents={gcalEvents} onClickSlot={setDetailSlot}
            showUnassignedRow={canEditPlanning&&(activeCategoryFilters.size===0||activeCategoryFilters.has("unassigned"))}
          />
        )}
        </div>

        {(createOpen||quickCreate!==null)&&(
          <SlotFormDialog open
            onClose={()=>{setCreateOpen(false);setQuickCreate(null);}}
            technicians={technicians} projects={projects}
            existingSlots={slots}
            defaultDate={quickCreate?.date??selDay}
            defaultTechId={quickCreate?.techId}
            defaultStartTime={quickCreate?.start}
            defaultEndTime={quickCreate?.end}
            onSave={handleSaveCreate} saving={createMut.isPending}/>
        )}
        {duplicateSource&&(
          <SlotFormDialog open
            onClose={()=>setDuplicateSource(null)}
            technicians={technicians} projects={projects}
            existingSlots={slots}
            defaultDate={duplicateSource.slotDate}
            defaultTechId={duplicateSource.technicianId ?? undefined}
            defaultStartTime={duplicateSource.startTime}
            defaultEndTime={duplicateSource.endTime}
            duplicateSource={duplicateSource}
            onSave={rows=>{rows.forEach(r=>createMut.mutate(r));setDuplicateSource(null);}}
            saving={createMut.isPending}/>
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
            onDuplicate={()=>{setDuplicateSource(detailSlot);setDetailSlot(null);}}
            onDelete={()=>{setDeleteSlot(detailSlot);setDetailSlot(null);}}
            onOpenProject={id=>{setDetailSlot(null);setLocation(`/chantiers/${id}`);}}
            onCreateProject={()=>{setConvertSlot(detailSlot);setDetailSlot(null);}}
            canManage={canEditPlanning}/>
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
        {convertSlot&&<ConvertSlotToProjectDialog slot={convertSlot} onClose={()=>setConvertSlot(null)}/>}
      </div>
      {searchOpen&&(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={()=>{setSearchOpen(false);setClientSearch("");}}/>
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-2xl"
            style={{maxHeight:"80vh"}}>
            {/* Handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-200"/>
            </div>
            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 min-h-0">
              {!clientSearch.trim()&&(
                <p className="text-center text-sm text-muted-foreground py-10">Tapez pour rechercher un client ou chantier…</p>
              )}
              {clientSearch.trim().length>=2&&searchResults.length===0&&!searchLoading&&(
                <p className="text-center text-sm text-muted-foreground py-10">Aucun résultat pour « {clientSearch} »</p>
              )}
              {searchLoading&&clientSearch.trim().length>=2&&(
                <p className="text-center text-sm text-muted-foreground py-6">Recherche…</p>
              )}
              {searchResults.map(s=>{
                const {bgClass,bgStyle}=slotBgStyle(s);
                const clientLabel=s.freeClientName??s.clientName??null;
                const dateLabel=new Date(s.slotDate+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
                const techLabel=s.technicianName?s.technicianName.split(" ")[0]:null;
                return(
                  <button key={s.id}
                    onClick={()=>{setDetailSlot(s);setSearchOpen(false);setClientSearch("");}}
                    className="w-full flex items-center gap-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2.5 text-left">
                    <div className={`w-1 h-8 rounded-full shrink-0 ${bgClass}`} style={bgStyle??undefined}/>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate text-foreground">{clientLabel??(s.projectName??"Sans client")}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {dateLabel} · {s.startTime}–{s.endTime}
                        {s.projectName&&clientLabel?` · ${s.projectName}`:""}
                        {techLabel?` · ${techLabel}`:" · À affecter"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Search input */}
            <div className="border-t border-border/50 px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"/>
                <input
                  autoFocus
                  value={clientSearch}
                  onChange={e=>setClientSearch(e.target.value)}
                  placeholder="Rechercher un client, chantier…"
                  className="w-full rounded-xl border border-border bg-slate-50 pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors"
                />
                {clientSearch&&(
                  <button onClick={()=>setClientSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4"/>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dialog : lier URL Google Calendar à un technicien */}
      {gcalUrlOpen!==null&&(()=>{
        const tech=technicians.find(t=>t.id===gcalUrlOpen);
        if(!tech) return null;
        const hasUrl=!!gcalUrlMap.get(tech.id);
        return(
          <Dialog open onOpenChange={o=>{if(!o){setGcalUrlOpen(null);setGcalTestResult(null);}}}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary"/>
                  Google Calendar — {tech.firstName} {tech.lastName}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">Deux façons de lier :</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>ID du calendrier</strong> (ex: <code>xyz@group.calendar.google.com</code>) — calendrier public</li>
                    <li><strong>URL iCal complète</strong> — Paramètres GCal → "Adresse secrète au format iCal" — pour calendrier privé</li>
                  </ul>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">ID du calendrier ou URL iCal</label>
                  <Input
                    value={gcalUrlInput}
                    onChange={e=>{setGcalUrlInput(e.target.value);setGcalTestResult(null);}}
                    placeholder="xyz@group.calendar.google.com  ou  https://calendar.google.com/…"
                    className="font-mono text-xs"
                  />
                </div>
                {/* Résultat du test */}
                {gcalTestResult&&(
                  <div className={`rounded-xl border px-4 py-3 text-xs space-y-1 ${gcalTestResult.ok?"border-green-200 bg-green-50 text-green-800":"border-red-200 bg-red-50 text-red-800"}`}>
                    {gcalTestResult.ok?(
                      <>
                        <p className="font-semibold">✅ Connexion réussie — {gcalTestResult.eventCount} événements trouvés</p>
                        {gcalTestResult.preview&&<p className="font-mono opacity-70 text-[10px] whitespace-pre">{gcalTestResult.preview}</p>}
                      </>
                    ):(
                      <>
                        <p className="font-semibold">❌ Échec{gcalTestResult.httpStatus?` (HTTP ${gcalTestResult.httpStatus})`:""}</p>
                        {gcalTestResult.error&&<p className="opacity-80">{gcalTestResult.error}</p>}
                      </>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                {hasUrl&&(
                  <Button variant="outline" className="text-destructive hover:text-destructive"
                    onClick={()=>updateGCalUrlMut.mutate({technicianId:tech.id,icalUrl:null})}
                    disabled={updateGCalUrlMut.isPending}>
                    Délier
                  </Button>
                )}
                <Button variant="outline" onClick={()=>setGcalUrlOpen(null)}>Annuler</Button>
                <Button variant="outline"
                  onClick={()=>testGCalMut.mutate({input:gcalUrlInput.trim()})}
                  disabled={testGCalMut.isPending||!gcalUrlInput.trim()}
                >
                  {testGCalMut.isPending?"Test en cours…":"Tester"}
                </Button>
                <Button
                  onClick={()=>updateGCalUrlMut.mutate({technicianId:tech.id,icalUrl:gcalUrlInput.trim()||null})}
                  disabled={updateGCalUrlMut.isPending||!gcalUrlInput.trim()}
                >
                  {updateGCalUrlMut.isPending?"Enregistrement…":"Enregistrer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

    </DashboardLayout>
  );
}

// ─── Shared timeline grid (used by Week & Day) ────────────────────────────────

type SlotWithLane = Slot & {lane:number;totalLanes:number};

/** Snap vers le gap libre le plus proche. Utilise les intervalles réels pour garantir 0 chevauchement. */
function snapToFreeSlot(ns: number, dur: number, others: {startMin:number;endMin:number}[], fallback?: number): number {
  if (others.length === 0) return ns;
  const sorted = [...others].sort((a,b)=>a.startMin-b.startMin);
  const overlaps = (p:number) => sorted.some(o=>p < o.endMin && p+dur > o.startMin);
  if (!overlaps(ns)) return ns;

  // Construire la liste des créneaux libres dans [H_START*60, H_END*60]
  const gaps:{s:number;e:number}[] = [];
  let cur = H_START*60;
  for (const o of sorted) {
    if (o.startMin > cur) gaps.push({s:cur,e:o.startMin});
    cur = Math.max(cur, o.endMin);
  }
  if (cur < H_END*60) gaps.push({s:cur,e:H_END*60});

  // Pour chaque gap assez large, trouver la meilleure position
  const candidates: number[] = [];
  for (const g of gaps) {
    if (g.e - g.s >= dur) candidates.push(Math.max(g.s, Math.min(ns, g.e-dur)));
  }
  if (candidates.length === 0) return fallback ?? H_START*60;
  return candidates.reduce((best,p) => Math.abs(p-ns) < Math.abs(best-ns) ? p : best);
}

function computeLanes(daySlots: Slot[]): SlotWithLane[] {
  return daySlots.map(s => ({ ...s, lane: 0, totalLanes: 1 }));
}

type ApprovedLeave = {technicianId:number;startDate:string;endDate:string};
type GridProps = {
  slots:Slot[]; technicians:Technician[]; dayColumns:string[];
  canManage:boolean; zoom:number;
  approvedLeaves?:ApprovedLeave[];
  gcalEvents?:GCalEvent[];
  showUnassignedRow?:boolean;
  swipeOffset?:number;
  swipeSnapping?:boolean;
  onClickSlot:(s:Slot)=>void;
  onMove:(id:number,date:string,start:string,end:string,prev:{prevDate?:string;prevStartTime?:string;prevEndTime?:string},technicianId?:number|null)=>void;
  onCellClick?:(technicianId:number|null,date:string,startTime:string,endTime:string)=>void;
  onReorder?:(orderedIds:number[])=>void;
};

// Shared timeline grid — percentage-based, fits parent width
function TimelineGrid({slots,technicians,dayColumns,canManage,zoom,approvedLeaves=[],gcalEvents=[],showUnassignedRow=false,swipeOffset=0,swipeSnapping=false,onClickSlot,onMove,onCellClick,onReorder}:GridProps){
  const LANE_H = Math.round(52*zoom);
  const LABEL_W = typeof window!=="undefined"&&window.innerWidth<640 ? 90 : 176;
  // zoom=1 → colonnes s'étirent pour remplir l'espace (1fr)
  // zoom>1 → largeur fixe en px, déclenche le scroll horizontal
  const COL_W = zoom > 1.05 ? Math.round(150 * zoom) : undefined;
  const today = toDateStr(new Date());

  // Drag / resize
  const dragRef  = useRef<{id:number;technicianId:number|null;date:string;origStart:number;origEnd:number;origSStr:string;origEStr:string;dayColRef:Element|null;mouseX:number;targetTechId:number|null;targetDate:string}|null>(null);
  const resizeRef = useRef<{id:number;technicianId:number|null;date:string;origStart:number;origEnd:number;dayColRef:Element|null;mouseX:number;edge:"start"|"end"}|null>(null);
  const justInteracted = useRef(false);
  const [draggingId,setDraggingId]=useState<number|null>(null);
  const [preview,setPreview]=useState<Record<number,{start:number;end:number}>>({});
  const [dragTarget,setDragTarget]=useState<{techId:number|null;date:string;start:number;end:number}|null>(null);
  const dayColRefs = useRef<Record<string,HTMLDivElement|null>>({});
  // ref vers les slots courants pour y accéder dans onMouseMove sans le mettre en dépendance
  const slotsRef = useRef(slots);
  useEffect(()=>{ slotsRef.current = slots; },[slots]);
  // ref vers les technicians + onReorder pour le drag de rangée (évite les dépendances stales)
  const techniciansRef = useRef(technicians);
  useEffect(()=>{ techniciansRef.current = technicians; },[technicians]);
  const onReorderRef = useRef(onReorder);
  useEffect(()=>{ onReorderRef.current = onReorder; },[onReorder]);
  // Drag de rangée (réordonnancement des techniciens)
  const rowDragRef = useRef<{techId:number}|null>(null);
  const rowDropIdxRef = useRef<number|null>(null);
  const rowRefs = useRef<Record<number,HTMLDivElement|null>>({});
  const [rowDraggingId, setRowDraggingId] = useState<number|null>(null);
  const [rowDropIdx, setRowDropIdx] = useState<number|null>(null);

  // Heure courante en minutes — mise à jour toutes les 30 s
  const [nowMin,setNowMin]=useState(()=>{const n=new Date();return n.getHours()*60+n.getMinutes();});
  useEffect(()=>{
    const id=setInterval(()=>{const n=new Date();setNowMin(n.getHours()*60+n.getMinutes());},30_000);
    return()=>clearInterval(id);
  },[]);

  const clearInteraction = useCallback(()=>{
    if(rowDragRef.current){
      const {techId}=rowDragRef.current;
      const dropIdx=rowDropIdxRef.current;
      const techs=techniciansRef.current;
      if(dropIdx!==null&&onReorderRef.current){
        const fromIdx=techs.findIndex(t=>t.id===techId);
        if(fromIdx!==-1){
          const newOrder=techs.map(t=>t.id);
          newOrder.splice(fromIdx,1);
          const insertAt=dropIdx>fromIdx?dropIdx-1:dropIdx;
          newOrder.splice(insertAt,0,techId);
          if(newOrder.join()!==techs.map(t=>t.id).join()) onReorderRef.current(newOrder);
        }
      }
      rowDragRef.current=null;rowDropIdxRef.current=null;setRowDraggingId(null);setRowDropIdx(null);
      return;
    }
    if(dragRef.current){
      const {id,technicianId,date,origSStr,origEStr,targetTechId,targetDate}=dragRef.current;
      const pv=preview[id];
      const changedTech=targetTechId!==technicianId;
      const changedDate=targetDate!==date;
      if(pv&&(pv.start!==timeToMin(origSStr)||pv.end!==timeToMin(origEStr)||changedTech||changedDate)){
        justInteracted.current=true;
        onMove(id,targetDate,minToTime(pv.start),minToTime(pv.end),{prevDate:date,prevStartTime:origSStr,prevEndTime:origEStr},changedTech?targetTechId:undefined);
      }
      dragRef.current=null;setDraggingId(null);setPreview({});setDragTarget(null);
    }
    if(resizeRef.current){
      const {id,date}=resizeRef.current;
      const pv=preview[id];
      if(pv){
        const slot=slots.find(x=>x.id===id);
        if(slot){
          justInteracted.current=true;
          onMove(id,date,minToTime(pv.start),minToTime(pv.end),{prevStartTime:slot.startTime,prevEndTime:slot.endTime});
        }
      }
      resizeRef.current=null;setPreview({});
    }
  },[preview,slots,onMove]);

  const onMouseMove = useCallback((e:MouseEvent)=>{
    if(rowDragRef.current){
      const techs=techniciansRef.current;
      let dropIdx=techs.length;
      for(let i=0;i<techs.length;i++){
        const el=rowRefs.current[techs[i].id];
        if(!el)continue;
        const r=el.getBoundingClientRect();
        if(e.clientY<r.top+r.height/2){dropIdx=i;break;}
      }
      rowDropIdxRef.current=dropIdx;
      setRowDropIdx(dropIdx);
      return;
    }
    if(dragRef.current){
      const {id,technicianId,origStart,origEnd,date,mouseX}=dragRef.current;
      const dur=origEnd-origStart;

      // Trouver la cellule cible sous le curseur
      let tTechId=dragRef.current.targetTechId;
      let tDate=dragRef.current.targetDate;
      let targetRect:DOMRect|null=null;
      for(const [key,el] of Object.entries(dayColRefs.current)){
        if(!el)continue;
        const r=el.getBoundingClientRect();
        if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){
          const dash=key.indexOf("-");
          const prefix=key.slice(0,dash);
          tTechId=prefix==="unassigned"?null:Number(prefix);
          tDate=key.slice(dash+1);
          targetRect=r;
          break;
        }
      }
      if(!targetRect){
        const refKey=tTechId===null?`unassigned-${tDate}`:`${tTechId}-${tDate}`;
        const el=dayColRefs.current[refKey];
        if(el)targetRect=el.getBoundingClientRect();
      }
      if(!targetRect)return;

      let ns:number;
      if(tTechId===technicianId&&tDate===date){
        // Même cellule : déplacement relatif (préserve le point de saisie)
        const dx=e.clientX-mouseX;
        const dm=Math.round(dx/targetRect.width*H_TOTAL*60/15)*15;
        ns=Math.max(H_START*60,Math.min(origStart+dm,H_END*60-dur));
      } else {
        // Autre cellule : position absolue sous le curseur
        const cursorMin=(e.clientX-targetRect.left)/targetRect.width*H_TOTAL*60+H_START*60;
        ns=Math.round(Math.max(H_START*60,Math.min(cursorMin-dur/2,H_END*60-dur))/15)*15;
      }

      dragRef.current.targetTechId=tTechId;
      dragRef.current.targetDate=tDate;
      setDragTarget({techId:tTechId,date:tDate,start:ns,end:ns+dur});
      setPreview(p=>({...p,[id]:{start:ns,end:ns+dur}}));
    }
    if(resizeRef.current){
      const {id,technicianId,origStart,origEnd,dayColRef,edge,date}=resizeRef.current;
      if(!dayColRef)return;
      const rect=dayColRef.getBoundingClientRect();
      const dx=e.clientX-resizeRef.current.mouseX;
      const dm=Math.round(dx/rect.width*H_TOTAL*60/15)*15;
      if(edge==="end"){
        const newEnd=Math.max(origStart+15,Math.min(origEnd+dm,H_END*60));
        setPreview(p=>({...p,[id]:{start:origStart,end:newEnd}}));
      }else{
        const newStart=Math.min(origEnd-15,Math.max(origStart+dm,H_START*60));
        setPreview(p=>({...p,[id]:{start:newStart,end:origEnd}}));
      }
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

  const dayFlexStyle: React.CSSProperties = COL_W
    ? {flex:`0 0 ${COL_W}px`}
    : {flex:"1 1 0",minWidth:0};
  const swipeInnerStyle: React.CSSProperties = {
    display:"flex",
    transform:`translateX(${swipeOffset}px)`,
    transition:swipeSnapping?"transform 0.22s ease-out":"none",
    willChange:"transform",
  };
  // helper pour positionner les labels de graduation sans débordement
  const rulerLabelStyle = (i: number): React.CSSProperties =>
    i === 0          ? {left: "2px"} :
    i === H_TOTAL    ? {right: "2px"} :
    {left:`${i/H_TOTAL*100}%`, transform:"translateX(-50%)"};

  return (
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
      {/* ── Column headers ── */}
      <div className="border-b border-border/60 bg-slate-50/80 flex">
        <div style={{width:LABEL_W,flexShrink:0}} className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:flex items-end">Technicien</div>
        <div style={{width:LABEL_W,flexShrink:0}} className="sm:hidden"/>
        <div style={{flex:1,overflow:"hidden"}}>
          <div style={swipeInnerStyle}>
            {dayColumns.map((d)=>{
              const date=new Date(d+"T00:00:00");
              const isToday=d===today;
              return(
                <div key={d} style={dayFlexStyle} className={`border-l-2 border-slate-200 px-2 py-2 flex flex-col items-center ${isToday?"bg-primary/5":""}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{ALL_DAYS_SHORT[(new Date(d+"T00:00:00").getDay()+6)%7]}</span>
                  <span className={`text-lg font-bold leading-none mt-0.5 ${isToday?"text-primary":"text-foreground"}`}>{date.getDate()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Hour ruler ── */}
      <div className="border-b border-border/50 bg-slate-50/70 flex">
        <div style={{width:LABEL_W,flexShrink:0}} className="px-2 flex items-end pb-1.5 hidden sm:flex"><span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Horaires</span></div>
        <div style={{width:LABEL_W,flexShrink:0}} className="sm:hidden"/>
        <div style={{flex:1,overflow:"hidden"}}>
          <div style={swipeInnerStyle}>
            {dayColumns.map(d=>(
              <div key={d} style={dayFlexStyle} className="border-l-2 border-slate-200 relative h-8">
                {Array.from({length:H_TOTAL+1},(_,i)=>(
                  (i % 3 === 0 && i > 0 && i < H_TOTAL) ? (
                    <div key={`tick-${i}`} className="absolute top-0 h-3 border-l border-border/35 pointer-events-none" style={{left:`${i/H_TOTAL*100}%`}}/>
                  ) : null
                ))}
                {Array.from({length:H_TOTAL+1},(_,i)=>(
                  (i % 3 === 0 || i === H_TOTAL) ? (
                    <span key={i} className="absolute bottom-1.5 text-[10px] font-semibold text-slate-400 tracking-tight" style={rulerLabelStyle(i)}>
                      {(H_START+i).toString().padStart(2,"0")}h
                    </span>
                  ) : null
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tech rows ── */}
      {technicians.map((tech,rowIdx)=>{
        const ml=maxLanes(tech.id);
        const rowH=ml*LANE_H+8;
        const isRowDragging=rowDraggingId===tech.id;
        const showDropBefore=rowDropIdx===rowIdx&&rowDraggingId!==null&&rowDraggingId!==tech.id;
        return(
          <div key={tech.id} ref={el=>{rowRefs.current[tech.id]=el;}}
            className={`border-b-2 border-slate-200 last:border-b-0 relative ${isRowDragging?"opacity-40":""}`}>
          {showDropBefore&&<div className="absolute top-0 left-0 right-0 h-0.5 bg-primary z-50"/>}
          <div style={{display:"flex"}}>
            {/* Label — fixe, ne se déplace pas au swipe */}
            <div style={{width:LABEL_W,flexShrink:0,height:rowH}} className="flex items-center gap-1.5 px-1.5 sm:px-3 py-2 border-r border-border/40 bg-slate-50/70">
              {onReorder&&(
                <div
                  className="hidden sm:flex mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0 transition-colors"
                  onMouseDown={e=>{e.preventDefault();e.stopPropagation();rowDragRef.current={techId:tech.id};setRowDraggingId(tech.id);setRowDropIdx(rowIdx);rowDropIdxRef.current=rowIdx;}}
                >
                  <GripVertical className="h-4 w-4"/>
                </div>
              )}
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                {tech.firstName[0]}{tech.lastName[0]}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-[10px] sm:text-sm font-semibold text-foreground leading-tight truncate">{tech.firstName}<span className="hidden sm:inline"> {tech.lastName}</span></p>
                <p className="hidden sm:block text-[9px] text-muted-foreground uppercase tracking-wide">Technicien</p>
              </div>
            </div>
            {/* Day cells — se déplacent au swipe */}
            <div style={{flex:1,overflow:"hidden"}}>
            <div style={{...swipeInnerStyle,height:rowH}}>
            {dayColumns.map(d=>{
              const isToday=d===today;
              const daySlots=laneMap.get(`${tech.id}-${d}`)??[];
              return(
                <div key={d} ref={el=>{dayColRefs.current[`${tech.id}-${d}`]=el;}}
                  style={{...dayFlexStyle,height:rowH}}
                  className={`relative border-l-2 border-slate-200 ${isToday?"bg-primary/[0.025]":""} ${canManage&&onCellClick?"cursor-crosshair":""}`}
                  onClick={canManage&&onCellClick?e=>{
                    const rect=e.currentTarget.getBoundingClientRect();
                    const rawMin=Math.round((e.clientX-rect.left)/rect.width*H_TOTAL*60/15)*15+H_START*60;
                    const s=Math.max(H_START*60,Math.min(rawMin,H_END*60-60));
                    const en=Math.min(s+120,H_END*60);
                    onCellClick(tech.id,d,minToTime(s),minToTime(en));
                  }:undefined}>
                  {/* Congé overlay */}
                  {approvedLeaves.some(l=>l.technicianId===tech.id&&l.startDate<=d&&l.endDate>=d)&&(
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-blue-50/70 border-l-2 border-blue-300">
                      <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest select-none">Congé</span>
                    </div>
                  )}
                  {/* Google Calendar events (read-only overlay) */}
                  {gcalEvents.filter(ev=>ev.technicianId===tech.id&&ev.date===d).map(ev=>{
                    const startM=timeToMin(ev.startTime);
                    const endM=timeToMin(ev.endTime);
                    if(startM>=H_END*60||endM<=H_START*60) return null;
                    const lp=Math.max(0,(startM-H_START*60)/(H_TOTAL*60)*100);
                    const wp=Math.max(0.5,(Math.min(endM,H_END*60)-Math.max(startM,H_START*60))/(H_TOTAL*60)*100);
                    return(
                      <Tooltip key={ev.uid} delayDuration={300}>
                        <TooltipTrigger asChild>
                          <div style={{left:`${lp}%`,width:`max(${wp}%,2px)`,top:3,bottom:3}}
                            className="absolute rounded-md border-2 border-emerald-400 bg-emerald-50/60 pointer-events-auto z-5 overflow-hidden px-1 flex items-center cursor-default">
                            <span className="text-[9px] font-semibold text-emerald-700 truncate leading-tight">{ev.summary}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="flex flex-col gap-0.5">
                          <p className="font-semibold text-xs text-emerald-700">📅 {ev.summary}</p>
                          <p className="text-[11px] opacity-70">{ev.startTime}–{ev.endTime}</p>
                          {ev.location&&<p className="text-[11px] opacity-60">{ev.location}</p>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {/* Hour lines — graduation (toutes les 3h) plus visible */}
                  {Array.from({length:H_TOTAL-1},(_,i)=>{
                    const isGrad=(i+1)%3===0;
                    return <div key={i} style={{left:`${(i+1)/H_TOTAL*100}%`}} className={`absolute top-0 bottom-0 border-l ${isGrad?"border-border/30":"border-border/10"} pointer-events-none`}/>;
                  })}
                  {/* Ligne heure courante */}
                  {isToday&&nowMin>=H_START*60&&nowMin<=H_END*60&&(
                    <div className="absolute top-0 bottom-0 z-25 pointer-events-none -translate-x-px"
                      style={{left:`${(nowMin-H_START*60)/(H_TOTAL*60)*100}%`}}>
                      <div className="absolute inset-y-0 w-px bg-rose-500/80"/>
                    </div>
                  )}
                  {/* Ghost slot cross-technicien/cross-jour */}
                  {draggingId!==null&&dragTarget?.techId===tech.id&&dragTarget?.date===d&&(()=>{
                    const src=slotsRef.current.find(s=>s.id===draggingId);
                    if(!src||( src.technicianId===tech.id&&src.slotDate===d))return null;
                    const lp=(dragTarget.start-H_START*60)/(H_TOTAL*60)*100;
                    const wp=(dragTarget.end-dragTarget.start)/(H_TOTAL*60)*100;
                    const {bgClass:gc,bgStyle:gs}=slotBgStyle(src);
                    return(
                      <div key="ghost" style={{left:`${lp}%`,width:`max(${wp}%,2px)`,top:3,height:LANE_H-6,...(gs??{})}}
                        className={`absolute rounded-lg ${gc} opacity-75 text-white text-[10px] shadow-xl ring-2 ring-white/60 z-30 pointer-events-none px-1.5 py-1 flex flex-col`}>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                          <span className="font-bold text-[12px] text-white drop-shadow-sm tracking-tight">{minToTime(dragTarget.start)} – {minToTime(dragTarget.end)}</span>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Slots */}
                  {daySlots.map(slot=>{
                    const pv=preview[slot.id];
                    const start=pv?pv.start:timeToMin(slot.startTime);
                    const end=pv?pv.end:timeToMin(slot.endTime);
                    const leftPct=(start-H_START*60)/(H_TOTAL*60)*100;
                    const widthPct=(end-start)/(H_TOTAL*60)*100;
                    const top=slot.lane*LANE_H+3;
                    const height=LANE_H-6;
                    const {bgClass,bgStyle}=slotBgStyle(slot);
                    const label=slotLabel(slot)??"Sans chantier";
                    const isDragging=draggingId===slot.id;
                    const isInteracting=!!pv;
                    const displayStart=minToTime(start);
                    const displayEnd=minToTime(end);
                    const isCrossDragging=isDragging&&dragTarget&&(dragTarget.techId!==slot.technicianId||dragTarget.date!==slot.slotDate);
                    const emoji=slot.projectServiceType?SERVICE_EMOJI[slot.projectServiceType]??null:null;
                    return(
                      <Tooltip key={slot.id} delayDuration={draggingId!==null?999999:400} open={draggingId!==null?false:undefined}>
                        <TooltipTrigger asChild>
                          <div
                            style={{left:`${leftPct}%`,width:`max(${widthPct}%, 2px)`,top,height,...(bgStyle??{})}}
                            className={`absolute rounded-lg ${bgClass} text-white text-[10px] shadow-sm cursor-pointer select-none overflow-hidden px-1.5 py-1 flex flex-col ${isDragging&&!isCrossDragging?"shadow-xl ring-2 ring-white/50 opacity-90 z-20":isCrossDragging?"opacity-25 z-10":isInteracting?"shadow-xl ring-2 ring-white/50 z-20":"hover:shadow-md z-10 hover:brightness-110 transition-all"}`}
                            onClick={e=>{e.stopPropagation();if(justInteracted.current){justInteracted.current=false;return;}if(!isInteracting)onClickSlot(slot);}}
                            onMouseDown={canManage?e=>{
                              e.preventDefault();e.stopPropagation();
                              const colEl=dayColRefs.current[`${tech.id}-${d}`];
                              dragRef.current={id:slot.id,technicianId:slot.technicianId!,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),origSStr:slot.startTime,origEStr:slot.endTime,dayColRef:colEl,mouseX:e.clientX,targetTechId:slot.technicianId!,targetDate:d};
                              setDraggingId(slot.id);
                            }:undefined}
                          >
                            {/* Overlay heures pendant drag/resize */}
                            {isInteracting&&!isCrossDragging&&(
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 pointer-events-none rounded-lg">
                                <span className="font-bold text-[12px] text-white drop-shadow-sm tracking-tight">{displayStart} – {displayEnd}</span>
                              </div>
                            )}
                            <div className="font-semibold leading-tight truncate">{emoji&&<span className="mr-0.5">{emoji}</span>}{slot.freeClientName??slot.clientName??slot.projectName??"Sans chantier"}</div>
                            {slot.projectName&&(slot.freeClientName||slot.clientName)&&<div className="text-white/85 text-[9px] leading-tight truncate">{slot.projectName}</div>}
                            {(zoom>=0.8||isInteracting)&&<div className="text-white/70 text-[9px] leading-tight">{displayStart}–{displayEnd}</div>}
                            <div className="flex gap-0.5 mt-auto">
                              {slot.hasLocationChange&&<MapPin className="h-2 w-2 text-white/80"/>}
                              {slot.hasTimeChange&&<Clock className="h-2 w-2 text-white/80"/>}
                              {slot.hasDiscount&&<Tag className="h-2 w-2 text-white/80"/>}
                            </div>
                            {canManage&&(
                              <>
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize" onMouseDown={e=>{e.preventDefault();e.stopPropagation();const colEl=dayColRefs.current[`${tech.id}-${d}`];resizeRef.current={id:slot.id,technicianId:slot.technicianId!,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),dayColRef:colEl,mouseX:e.clientX,edge:"start"};}}/>
                                <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize" onMouseDown={e=>{e.preventDefault();e.stopPropagation();const colEl=dayColRefs.current[`${tech.id}-${d}`];resizeRef.current={id:slot.id,technicianId:slot.technicianId!,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),dayColRef:colEl,mouseX:e.clientX,edge:"end"};}}/>
                              </>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="flex flex-col gap-0.5">
                          <p className="font-semibold text-xs">{slot.freeClientName??slot.clientName??slot.projectName??"Sans chantier"}</p>
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
            </div>
          </div>
          </div>
        );
      })}
      {rowDropIdx===technicians.length&&rowDraggingId!==null&&(
        <div className="h-0.5 bg-primary mx-0"/>
      )}
      {technicians.length===0&&<div className="py-16 text-center text-sm text-muted-foreground">Aucun technicien actif.</div>}

      {/* ── Ligne "À affecter" ── */}
      {showUnassignedRow&&(()=>{
        const unassignedSlots=slots.filter(s=>s.technicianId===null);
        if(!canManage&&unassignedSlots.length===0) return null;
        const maxU=Math.max(1,...dayColumns.map(d=>unassignedSlots.filter(s=>s.slotDate===d).length));
        const rowH=maxU*LANE_H+8;
        return(
          <div className="border-t-2 border-amber-200">
            <div style={{display:"flex"}}>
              {/* Label */}
              <div style={{width:LABEL_W,flexShrink:0,height:rowH}} className="flex items-center gap-1.5 px-1.5 sm:px-3 py-2 border-r border-amber-200/60 bg-amber-50/60">
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5"/>
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-[10px] sm:text-sm font-semibold text-amber-800 leading-tight truncate">À affecter</p>
                  <p className="hidden sm:block text-[9px] text-amber-600 uppercase tracking-wide">{unassignedSlots.length} créneau{unassignedSlots.length>1?"x":""}</p>
                </div>
              </div>
              {/* Day cells */}
              <div style={{flex:1,overflow:"hidden"}}>
              <div style={{...swipeInnerStyle,height:rowH}}>
              {dayColumns.map(d=>{
                const isToday=d===toDateStr(new Date());
                const daySlots=unassignedSlots.filter(s=>s.slotDate===d);
                return(
                  <div key={d}
                    ref={el=>{dayColRefs.current[`unassigned-${d}`]=el;}}
                    style={{...dayFlexStyle,height:rowH}}
                    className={`relative border-l-2 border-amber-200 ${isToday?"bg-amber-50/40":""} ${canManage&&onCellClick?"cursor-crosshair":""}`}
                    onClick={canManage&&onCellClick?e=>{
                      const rect=e.currentTarget.getBoundingClientRect();
                      const rawMin=Math.round((e.clientX-rect.left)/rect.width*H_TOTAL*60/15)*15+H_START*60;
                      const s=Math.max(H_START*60,Math.min(rawMin,H_END*60-60));
                      const en=Math.min(s+120,H_END*60);
                      onCellClick(null,d,minToTime(s),minToTime(en));
                    }:undefined}>
                    {Array.from({length:H_TOTAL-1},(_,i)=>{
                      const isGrad=(i+1)%3===0;
                      return <div key={i} style={{left:`${(i+1)/H_TOTAL*100}%`}} className={`absolute top-0 bottom-0 border-l ${isGrad?"border-amber-100/60":"border-amber-100/30"} pointer-events-none`}/>;
                    })}
                    {/* Ghost quand on drag un slot tech vers la ligne unassigned */}
                    {draggingId!==null&&dragTarget?.techId===null&&dragTarget?.date===d&&(()=>{
                      const src=slotsRef.current.find(s=>s.id===draggingId);
                      if(!src||(src.technicianId===null&&src.slotDate===d))return null;
                      const lp=(dragTarget.start-H_START*60)/(H_TOTAL*60)*100;
                      const wp=(dragTarget.end-dragTarget.start)/(H_TOTAL*60)*100;
                      return(
                        <div key="ghost" style={{left:`${lp}%`,width:`max(${wp}%,2px)`,top:3,height:LANE_H-6}}
                          className="absolute rounded-lg bg-amber-400 opacity-75 text-white text-[10px] shadow-xl ring-2 ring-white/60 z-30 pointer-events-none px-1.5 py-1 flex flex-col">
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                            <span className="font-bold text-[12px] text-white drop-shadow-sm tracking-tight">{minToTime(dragTarget.start)} – {minToTime(dragTarget.end)}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {daySlots.map((slot,idx)=>{
                      const pv=preview[slot.id];
                      const startM=pv?pv.start:timeToMin(slot.startTime);
                      const endM=pv?pv.end:timeToMin(slot.endTime);
                      const leftPct=(startM-H_START*60)/(H_TOTAL*60)*100;
                      const widthPct=(endM-startM)/(H_TOTAL*60)*100;
                      const top=idx*LANE_H+3;
                      const height=LANE_H-6;
                      const label=slotLabel(slot)??"Sans chantier";
                      const isDragging=draggingId===slot.id;
                      const isInteracting=!!pv;
                      const isCrossDragging=isDragging&&dragTarget&&(dragTarget.techId!==null||dragTarget.date!==d);
                      const displayStart=minToTime(startM);
                      const displayEnd=minToTime(endM);
                      return(
                        <Tooltip key={slot.id} delayDuration={draggingId!==null?999999:400} open={draggingId!==null?false:undefined}>
                          <TooltipTrigger asChild>
                            <div
                              style={{left:`${leftPct}%`,width:`max(${widthPct}%, 2px)`,top,height}}
                              className={`absolute rounded-lg bg-amber-500 text-white text-[10px] shadow-sm cursor-pointer select-none overflow-hidden px-1.5 py-1 flex flex-col ${isDragging&&!isCrossDragging?"shadow-xl ring-2 ring-white/50 opacity-90 z-20":isCrossDragging?"opacity-25 z-10":isInteracting?"shadow-xl ring-2 ring-white/50 z-20":"hover:brightness-110 transition-all z-10"}`}
                              onClick={e=>{e.stopPropagation();if(justInteracted.current){justInteracted.current=false;return;}if(!isInteracting)onClickSlot(slot);}}
                              onMouseDown={canManage?e=>{
                                e.preventDefault();e.stopPropagation();
                                const colEl=dayColRefs.current[`unassigned-${d}`];
                                dragRef.current={id:slot.id,technicianId:null,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),origSStr:slot.startTime,origEStr:slot.endTime,dayColRef:colEl,mouseX:e.clientX,targetTechId:null,targetDate:d};
                                setDraggingId(slot.id);
                              }:undefined}
                            >
                              {isInteracting&&!isCrossDragging&&(
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 pointer-events-none rounded-lg">
                                  <span className="font-bold text-[12px] text-white drop-shadow-sm tracking-tight">{displayStart} – {displayEnd}</span>
                                </div>
                              )}
                              <div className="font-semibold leading-tight truncate">{label}</div>
                              {(zoom>=0.8||isInteracting)&&<div className="text-white/70 text-[9px] leading-tight">{displayStart}–{displayEnd}</div>}
                              {canManage&&(
                                <>
                                  <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize" onMouseDown={e=>{e.preventDefault();e.stopPropagation();const colEl=dayColRefs.current[`unassigned-${d}`];resizeRef.current={id:slot.id,technicianId:null,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),dayColRef:colEl,mouseX:e.clientX,edge:"start"};}}/>
                                  <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize" onMouseDown={e=>{e.preventDefault();e.stopPropagation();const colEl=dayColRefs.current[`unassigned-${d}`];resizeRef.current={id:slot.id,technicianId:null,date:d,origStart:timeToMin(slot.startTime),origEnd:timeToMin(slot.endTime),dayColRef:colEl,mouseX:e.clientX,edge:"end"};}}/>
                                </>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="flex flex-col gap-0.5">
                            <p className="font-semibold text-xs text-amber-700">⚠ À affecter</p>
                            <p className="font-semibold text-xs">{label}</p>
                            <p className="text-[11px] opacity-70">{slot.startTime}–{slot.endTime}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              })}
              </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>{/* end overflow-x-auto */}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({slots,technicians,dayColumns,canManage,zoom,approvedLeaves,gcalEvents,showUnassignedRow,swipeOffset,swipeSnapping,onClickSlot,onMove,onCellClick,onReorder,onDayClick}:GridProps&{onDayClick:(d:string)=>void}){
  void onDayClick;
  return <TimelineGrid slots={slots} technicians={technicians} dayColumns={dayColumns} canManage={canManage} zoom={zoom} approvedLeaves={approvedLeaves} gcalEvents={gcalEvents} showUnassignedRow={showUnassignedRow} swipeOffset={swipeOffset} swipeSnapping={swipeSnapping} onClickSlot={onClickSlot} onMove={onMove} onCellClick={onCellClick} onReorder={onReorder}/>;
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({slots,technicians,selDay,canManage,zoom,approvedLeaves,gcalEvents,showUnassignedRow,swipeOffset,swipeSnapping,onClickSlot,onMove,onCellClick,onReorder}:{
  slots:Slot[];technicians:Technician[];selDay:string;canManage:boolean;zoom:number;
  approvedLeaves?:ApprovedLeave[];
  gcalEvents?:GCalEvent[];
  showUnassignedRow?:boolean;
  swipeOffset?:number;
  swipeSnapping?:boolean;
  onClickSlot:(s:Slot)=>void;
  onMove:(id:number,date:string,start:string,end:string,prev:{prevDate?:string;prevStartTime?:string;prevEndTime?:string},technicianId?:number|null)=>void;
  onCellClick?:(technicianId:number|null,date:string,startTime:string,endTime:string)=>void;
  onReorder?:(orderedIds:number[])=>void;
}){
  return <TimelineGrid slots={slots} technicians={technicians} dayColumns={[selDay]} canManage={canManage} zoom={zoom} approvedLeaves={approvedLeaves} gcalEvents={gcalEvents} showUnassignedRow={showUnassignedRow} swipeOffset={swipeOffset} swipeSnapping={swipeSnapping} onClickSlot={onClickSlot} onMove={onMove} onCellClick={onCellClick} onReorder={onReorder}/>;
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({slots,technicians,monthRef,canManage,approvedLeaves=[],gcalEvents=[],onClickSlot,showUnassignedRow=false}:{
  slots:Slot[];technicians:Technician[];monthRef:Date;canManage:boolean;approvedLeaves?:ApprovedLeave[];gcalEvents?:GCalEvent[];onClickSlot:(s:Slot)=>void;showUnassignedRow?:boolean;
}){
  void canManage;
  const year=monthRef.getFullYear();
  const month=monthRef.getMonth();
  const today=toDateStr(new Date());
  // All Mon-Fri days in the month's weeks
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const gridStart=getMondayOf(firstDay);
  const gridFriEnd=addDays(getMondayOf(lastDay),4);
  const days:string[]=[];
  let cur=new Date(gridStart);
  while(cur<=gridFriEnd){
    const dow=cur.getDay();
    if(dow>=1&&dow<=5) days.push(toDateStr(cur));
    cur=addDays(cur,1);
  }

  // Group by ISO week for headers
  const weeks:{weekNum:number;days:string[]}[]=[];
  for(const d of days){
    const wn=getISOWeek(new Date(d+"T00:00:00"));
    const last=weeks[weeks.length-1];
    if(last?.weekNum===wn) last.days.push(d);
    else weeks.push({weekNum:wn,days:[d]});
  }

  const LABEL_W=176;
  const colTemplate=`${LABEL_W}px repeat(${days.length}, minmax(28px, 1fr))`;
  const DOW_SHORT=["","Lu","Ma","Me","Je","Ve"];

  return(
    <div className="-mx-4 sm:mx-0 rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        {/* Week headers */}
        <div className="border-b border-border/40 bg-slate-50/80" style={{display:"grid",gridTemplateColumns:colTemplate}}>
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Technicien</div>
          {weeks.map(w=>(
            <div key={w.weekNum} style={{gridColumn:`span ${w.days.length}`}}
              className="border-l-2 border-slate-200 py-1.5 text-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sem.{w.weekNum}</span>
            </div>
          ))}
        </div>
        {/* Day headers */}
        <div className="border-b border-border/60 bg-slate-50/60" style={{display:"grid",gridTemplateColumns:colTemplate}}>
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{MONTHS_FR[month]} {year}</span>
          </div>
          {days.map(d=>{
            const date=new Date(d+"T00:00:00");
            const isCurrentMonth=date.getMonth()===month;
            const isToday=d===today;
            return(
              <div key={d} className={`border-l border-slate-200 flex flex-col items-center py-1 ${isToday?"bg-primary/8":""}`}>
                <span className="text-[8px] font-medium text-muted-foreground/50 leading-none">{DOW_SHORT[date.getDay()]}</span>
                <span className={`text-[11px] font-bold leading-snug ${isToday?"text-primary":isCurrentMonth?"text-foreground":"text-muted-foreground/40"}`}>
                  {date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        {/* Tech rows */}
        {technicians.length===0&&<div className="py-16 text-center text-sm text-muted-foreground">Aucun technicien actif.</div>}
        {technicians.map(tech=>{
          const techSlots=slots.filter(s=>s.technicianId===tech.id);

          return(
            <div key={tech.id} className="border-b border-slate-200 last:border-b-0">
              <div style={{display:"grid",gridTemplateColumns:colTemplate}}
                className="hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center justify-center sm:justify-start sm:gap-2 px-1 sm:px-3 py-2 border-r border-border/40">
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {tech.firstName[0]}{tech.lastName[0]}
                  </div>
                  <p className="hidden sm:block text-sm font-semibold text-foreground truncate">{tech.firstName} {tech.lastName}</p>
                </div>
                {days.map(d=>{
                  const isToday=d===today;
                  const date=new Date(d+"T00:00:00");
                  const isCurrentMonth=date.getMonth()===month;
                  const daySlots=techSlots.filter(s=>s.slotDate===d);
                  return(
                    <div key={d}
                      className={`relative border-l border-slate-100 py-1 px-0.5 flex flex-col gap-0.5 min-h-[40px] ${isToday?"bg-primary/[0.03]":""}${!isCurrentMonth?" opacity-50 bg-slate-50/40":""}${approvedLeaves.some(l=>l.technicianId===tech.id&&l.startDate<=d&&l.endDate>=d)?" bg-blue-50/60":""}`}>
                      {approvedLeaves.some(l=>l.technicianId===tech.id&&l.startDate<=d&&l.endDate>=d)&&(
                        <div className="w-full h-1.5 rounded-sm bg-blue-300/80 shrink-0" title="Congé approuvé"/>
                      )}
                      {gcalEvents.filter(ev=>ev.technicianId===tech.id&&ev.date===d).map(ev=>(
                        <Tooltip key={ev.uid} delayDuration={300}>
                          <TooltipTrigger asChild>
                            <div className="w-full h-1.5 rounded-sm bg-emerald-400/70 shrink-0 cursor-default" title={ev.summary}/>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="flex flex-col gap-0.5">
                            <p className="font-semibold text-xs text-emerald-700">📅 {ev.summary}</p>
                            <p className="text-[11px] opacity-70">{ev.startTime}–{ev.endTime}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {daySlots.map(s=>{
                        const{bgClass,bgStyle}=slotBgStyle(s);
                        return(
                          <Tooltip key={s.id} delayDuration={300}>
                            <TooltipTrigger asChild>
                              <button onClick={()=>onClickSlot(s)}
                                className={`w-full h-3 rounded-sm ${bgClass} hover:brightness-110 transition-all shrink-0 shadow-sm`}
                                style={bgStyle}/>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="flex flex-col gap-0.5">
                              <p className="font-semibold text-xs">{slotLabel(s)??"Sans chantier"}</p>
                              <p className="text-[11px] opacity-70">{s.startTime}–{s.endTime}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Ligne "À affecter" vue mois */}
        {showUnassignedRow&&(()=>{
          const unassignedSlots=slots.filter(s=>s.technicianId===null);
          if(unassignedSlots.length===0) return null;
          return(
            <div className="border-t-2 border-amber-200">
              <div style={{display:"grid",gridTemplateColumns:colTemplate}}
                className="hover:bg-amber-50/60 transition-colors">
                <div className="flex items-center justify-center sm:justify-start sm:gap-2 px-1 sm:px-3 py-2 border-r border-amber-200/60 bg-amber-50/50">
                  <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5"/>
                  </div>
                  <p className="hidden sm:block text-sm font-semibold text-amber-800 truncate">À affecter</p>
                </div>
                {days.map(d=>{
                  const daySlots=unassignedSlots.filter(s=>s.slotDate===d);
                  return(
                    <div key={d} className="relative border-l border-amber-100 py-1 px-0.5 flex flex-col gap-0.5 min-h-[40px]">
                      {daySlots.map(s=>(
                        <Tooltip key={s.id} delayDuration={300}>
                          <TooltipTrigger asChild>
                            <button onClick={()=>onClickSlot(s)}
                              className="w-full h-3 rounded-sm bg-amber-400 hover:brightness-110 transition-all shrink-0 shadow-sm"/>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="flex flex-col gap-0.5">
                            <p className="font-semibold text-xs text-amber-700">⚠ À affecter</p>
                            <p className="font-semibold text-xs">{slotLabel(s)??"Sans chantier"}</p>
                            <p className="text-[11px] opacity-70">{s.startTime}–{s.endTime}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Convert Slot → Project Dialog ───────────────────────────────────────────

function ConvertSlotToProjectDialog({slot,onClose}:{slot:Slot;onClose:()=>void}){
  const utils = trpc.useUtils();
  const {data:technicians=[]} = trpc.planning.listTechnicians.useQuery();

  const [form, setForm] = useState<SharedProjectFormState>({
    ...INITIAL_SHARED_FORM,
    clientName: slot.freeClientName ?? "",
    phone: slot.freeClientPhone ?? "",
    address: slot.freeClientAddress ?? "",
    title: slot.freeClientName ? `Chantier ${slot.freeClientName}` : "",
    startDate: slot.slotDate,
    technicianIds: slot.technicianId ? [slot.technicianId] : [],
    status: "en_cours",
  });

  const updateSlotMut = trpc.planning.update.useMutation();
  const createMut = trpc.management.projects.createWithClient.useMutation({
    onSuccess: async(res)=>{
      await updateSlotMut.mutateAsync({
        id:slot.id,
        projectId:res.id,
        freeClientName:null,
        freeClientAddress:null,
        freeClientPhone:null,
      });
      utils.planning.invalidate();
      toast.success(`Chantier ${res.reference} créé`);
      onClose();
    },
    onError:e=>toast.error(e.message),
  });

  const isPending = createMut.isPending||updateSlotMut.isPending;

  return(
    <Dialog open onOpenChange={o=>!o&&onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Créer le chantier</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-2">
          <SharedProjectForm
            form={form}
            onChange={updates => setForm(prev => ({ ...prev, ...updates }))}
            technicians={technicians}
            showColor={true}
          />
        </div>
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
          <Button
            onClick={()=>createMut.mutate({
              clientName: form.clientName.trim()||"Client",
              clientPhone: form.phone.trim()||null,
              clientAddress: form.address.trim()||null,
              title: form.title.trim()||form.clientName.trim()||"Nouveau chantier",
              serviceType: form.serviceType,
              description: form.description||null,
              status: form.status,
              progressPercent: 0,
              estimatedHours: form.estimatedHours,
              actualHours: "0.00",
              budgetAmount: "0.00",
              startDate: form.startDate||null,
              plannedEndDate: form.plannedEndDate||null,
              quoteNumber: form.quoteNumber||null,
              technicianIds: form.technicianIds,
              color: form.color||null,
            })}
            disabled={isPending||!form.clientName.trim()}
          >
            {isPending?"Création…":"Créer le chantier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Slot Detail Dialog ───────────────────────────────────────────────────────

function SlotDetailDialog({slot,onClose,onEdit,onDuplicate,onDelete,onOpenProject,onCreateProject,canManage}:{
  slot:Slot;onClose:()=>void;onEdit:()=>void;onDuplicate:()=>void;onDelete:()=>void;
  onOpenProject:(id:number)=>void;onCreateProject:()=>void;canManage:boolean;
}){
  const color=slotColor(slot.projectServiceType);
  const address=slot.projectAddress||slot.clientAddress;
  const label=slotLabel(slot)??"Créneau sans chantier";
  return(
    <Dialog open onOpenChange={o=>!o&&onClose()}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90dvh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
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

        <div className="flex-1 overflow-y-auto px-6 pb-4 flex flex-col gap-3 text-sm">
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
          {slot.technicianName ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 bg-white">
              <User className="h-3.5 w-3.5 text-muted-foreground"/>
              <span className="font-medium">{slot.technicianName}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">Technicien</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600"/>
              <span className="font-medium text-amber-800">Non affecté</span>
              <Badge className="text-[10px] ml-auto bg-amber-100 text-amber-700 border-amber-300">À affecter</Badge>
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

          {/* Infos créneau libre (sans chantier associé) */}
          {!slot.projectId&&(slot.freeClientAddress||slot.freeClientPhone)&&(
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 px-4 py-3 flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 mb-1">
                {slot.gcalEventUid ? "📅 Google Calendar" : "Contact"}
              </p>
              {slot.freeClientPhone&&(
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-sky-600 shrink-0"/>
                  <a href={`tel:${slot.freeClientPhone}`} className="text-sm text-primary hover:underline">{slot.freeClientPhone}</a>
                </div>
              )}
              {slot.freeClientAddress&&(
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm text-foreground">{slot.freeClientAddress}</p>
                    <a href={mapsUrl(slot.freeClientAddress)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-700 text-xs hover:underline mt-0.5">
                      <ExternalLink className="h-3 w-3"/> Ouvrir dans Maps
                    </a>
                  </div>
                </div>
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
          <DialogFooter className="gap-2 flex-wrap shrink-0 px-6 py-4 border-t border-border/60">
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5"/> Supprimer
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onDuplicate}>
              <Layers className="h-3.5 w-3.5"/> Dupliquer
            </Button>
            {!slot.projectId&&slot.freeClientName&&(
              <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5" onClick={onCreateProject}>
                <Building2 className="h-3.5 w-3.5"/> Créer le chantier
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={onEdit}><Pencil className="h-3.5 w-3.5"/> Modifier</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Slot Form Dialog ─────────────────────────────────────────────────────────

type SlotFormRow = {
  technicianId:number|null;projectId:number|null;freeClientName?:string|null;
  freeClientAddress?:string|null;freeClientPhone?:string|null;
  slotDate:string;startTime:string;endTime:string;notes?:string|null;
  status:"scheduled"|"in_progress"|"completed"|"cancelled";
  hasLocationChange:boolean;hasTimeChange:boolean;hasDiscount:boolean;
  discountNote?:string|null;changeNote?:string|null;
};

function SlotFormDialog({open,onClose,technicians,projects,existingSlots,initialSlot,duplicateSource,defaultDate,defaultTechId,defaultStartTime,defaultEndTime,onSave,saving}:{
  open:boolean;onClose:()=>void;
  technicians:Technician[];projects:{id:number;name:string;reference:string|null;clientName:string|null}[];
  existingSlots:Slot[];initialSlot?:Slot|null;duplicateSource?:Slot|null;defaultDate?:string;
  defaultTechId?:number|null;defaultStartTime?:string;defaultEndTime?:string;
  onSave:(rows:SlotFormRow[])=>void;saving:boolean;
}){
  const src = duplicateSource ?? null;
  const [isUnassignedMode,setIsUnassignedMode]=useState(initialSlot?.technicianId===null||defaultTechId===null);
  const [selectedTechIds,setSelectedTechIds]=useState<Set<number>>(()=>{
    if(initialSlot?.technicianId===null||defaultTechId===null) return new Set<number>();
    if(initialSlot?.technicianId) return new Set([initialSlot.technicianId]);
    if(defaultTechId) return new Set([defaultTechId]);
    return new Set(technicians.slice(0,1).map(t=>t.id));
  });
  const [projId,setProjId]=useState(initialSlot?.projectId?String(initialSlot.projectId):src?.projectId?String(src.projectId):"none");
  const [freeClientName,setFreeClientName]=useState(initialSlot?.freeClientName??src?.freeClientName??"");
  const [freeClientAddress,setFreeClientAddress]=useState(initialSlot?.freeClientAddress??src?.freeClientAddress??"");
  const [freeClientPhone,setFreeClientPhone]=useState(initialSlot?.freeClientPhone??src?.freeClientPhone??"");
  const [date,setDate]=useState(initialSlot?.slotDate??defaultDate??toDateStr(new Date()));
  const [startTime,setStartTime]=useState(initialSlot?.startTime??defaultStartTime??"08:00");
  const [endTime,setEndTime]=useState(initialSlot?.endTime??defaultEndTime??"10:00");
  const [notes,setNotes]=useState(initialSlot?.notes??src?.notes??"");
  const [status,setStatus]=useState<SlotFormRow["status"]>((initialSlot?.status as SlotFormRow["status"])??"scheduled");
  const [hasLocChange,setHasLocChange]=useState(initialSlot?.hasLocationChange??false);
  const [hasTimeChange,setHasTimeChange]=useState(initialSlot?.hasTimeChange??false);
  const [hasDiscount,setHasDiscount]=useState(initialSlot?.hasDiscount??false);
  const [discountNote,setDiscountNote]=useState(initialSlot?.discountNote??"");
  const [changeNote,setChangeNote]=useState(initialSlot?.changeNote??"");

  const toggleTech=(id:number)=>{
    setIsUnassignedMode(false);
    setSelectedTechIds(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  };
  const canSubmit=(selectedTechIds.size>0||isUnassignedMode)&&date&&startTime&&endTime&&startTime<endTime;

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
    if(!isUnassignedMode&&conflicts.length>0){
      toast.warning(`Conflit horaire : ${conflicts[0].tech} a déjà un créneau ${conflicts[0].slot.startTime}–${conflicts[0].slot.endTime}`);
    }
    const isFree=projId==="none";
    const base:Omit<SlotFormRow,"technicianId">={
      projectId:isFree?null:Number(projId),
      freeClientName:isFree&&freeClientName.trim()?freeClientName.trim():null,
      freeClientAddress:isFree&&freeClientAddress.trim()?freeClientAddress.trim():null,
      freeClientPhone:isFree&&freeClientPhone.trim()?freeClientPhone.trim():null,
      slotDate:date,startTime,endTime,notes:notes.trim()||null,status,
      hasLocationChange:hasLocChange,hasTimeChange,hasDiscount,
      discountNote:discountNote.trim()||null,changeNote:changeNote.trim()||null,
    };
    if(isUnassignedMode){
      onSave([{...base,technicianId:null}]);
    } else {
      onSave(Array.from(selectedTechIds).map(tid=>({...base,technicianId:tid})));
    }
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
              {/* Bouton "À affecter" */}
              <button type="button" onClick={()=>{setIsUnassignedMode(true);setSelectedTechIds(new Set());}}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all border ${isUnassignedMode?"bg-amber-500 text-white border-amber-500":"bg-white text-amber-700 border-amber-200 hover:border-amber-400"}`}>
                <AlertTriangle className="h-3.5 w-3.5"/>
                À affecter
              </button>
              {technicians.map(t=>{
                const sel=!isUnassignedMode&&selectedTechIds.has(t.id);
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
            {isUnassignedMode&&<p className="text-xs text-amber-700 font-medium">Créneau créé sans technicien — à affecter ultérieurement</p>}
            {!isUnassignedMode&&selectedTechIds.size>1&&<p className="text-xs text-muted-foreground">→ {selectedTechIds.size} créneaux identiques seront créés</p>}
          </div>
          {/* Chantier */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chantier <span className="text-muted-foreground font-normal">(optionnel)</span></label>
            <Select value={projId} onValueChange={setProjId}>
              <SelectTrigger><SelectValue placeholder="Aucun"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun chantier —</SelectItem>
                {projects.map(p=>(
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.clientName?`${p.clientName} · `:""}{p.name}{p.reference?` (${p.reference})`:""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Nom client libre (si pas de chantier) */}
          {projId==="none"&&(
            <div className="flex flex-col gap-3 rounded-xl border border-border/60 px-4 py-3 bg-slate-50/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact client</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nom <span className="text-muted-foreground font-normal">(optionnel)</span></label>
                <Input placeholder="Ex. Dupont, SARL Horizon…" value={freeClientName} onChange={e=>setFreeClientName(e.target.value)} maxLength={200}/>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Téléphone <span className="text-muted-foreground font-normal">(optionnel)</span></label>
                <Input placeholder="06 00 00 00 00" type="tel" value={freeClientPhone} onChange={e=>setFreeClientPhone(e.target.value)} maxLength={50}/>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Adresse <span className="text-muted-foreground font-normal">(optionnel)</span></label>
                <AddressAutocomplete value={freeClientAddress} onChange={setFreeClientAddress}/>
              </div>
            </div>
          )}
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
          <Button disabled={!canSubmit||saving} onClick={handleSave}>
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
