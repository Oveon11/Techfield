import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OVEON_LOGO_B64 } from "@/lib/oveon-logo";
import { trpc } from "@/lib/trpc";
import { jsPDF } from "jspdf";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileDown,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ── helpers ──────────────────────────────────────────────────────────────────

function countDays(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  let n = 0;
  const c = new Date(s);
  while (c <= e) { if (c.getDay() !== 0) n++; c.setDate(c.getDate() + 1); }
  return n;
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateShort(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const STATUS_CFG = {
  pending:  { label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  approved: { label: "Approuvé",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  refused:  { label: "Refusé",     cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "pending" | "approved" | "refused" }) {
  const { label, cls } = STATUS_CFG[status];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Signature canvas ─────────────────────────────────────────────────────────

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn = useRef(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = "touches" in e ? e.touches[0] : e;
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    hasDrawn.current = true;
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    isDrawing.current = false;
    lastPos.current = null;
    onChange(hasDrawn.current ? (canvasRef.current?.toDataURL("image/png") ?? null) : null);
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    onChange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600} height={120}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 80 }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
        <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400 pointer-events-none select-none">Signez ici</span>
      </div>
      <button type="button" onClick={clear} className="text-[11px] text-muted-foreground underline underline-offset-2">Effacer la signature</button>
    </div>
  );
}

// ── Document PDF ─────────────────────────────────────────────────────────────

interface RequestDoc {
  id: number;
  technicianName: string;
  employeeCode: string | null;
  contractHours: string | null;
  startDate: string;
  endDate: string;
  days: number;
  comment: string | null;
  adminComment: string | null;
  status: "pending" | "approved" | "refused";
  approvedAt: string | null;
  createdAt: string;
  techSignature?: string | null;
  adminSignature?: string | null;
  adminName?: string | null;
}

function generateRequestPDF(req: RequestDoc) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, ML = 18, MR = 18, CW = W - ML - MR;
  let y = 20;

  // ── Header ──
  try { doc.addImage("data:image/png;base64," + OVEON_LOGO_B64, "PNG", 155, 12, 35, 14); } catch { /* logo load failed */ }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text("DEMANDE DE CONGÉ", W / 2, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Document n°${req.id} — Généré le ${new Date().toLocaleDateString("fr-FR")}`, W / 2, y, { align: "center" });
  y += 8;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(ML, y, W - MR, y);
  y += 8;

  // ── Technicien ──
  doc.setTextColor(0, 0, 0);
  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(label, ML, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, ML + 42, y);
    y += 6;
  };

  row("Technicien :", req.technicianName);
  if (req.employeeCode) row("Code employé :", req.employeeCode);
  row("Type de contrat :", req.contractHours ?? "39h");
  y += 2;

  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y); y += 6;

  // ── Période ──
  row("Date de début :", fmtDate(req.startDate));
  row("Date de fin :", fmtDate(req.endDate));
  row("Durée :", `${req.days} jour${req.days > 1 ? "s" : ""} (samedi inclus, dimanche exclu)`);
  if (req.comment) row("Commentaire :", req.comment);
  y += 2;

  doc.line(ML, y, W - MR, y); y += 6;

  // ── Statut ──
  const STATUS_LABELS: Record<string, string> = { pending: "EN ATTENTE", approved: "APPROUVÉ", refused: "REFUSÉ" };
  const STATUS_COLORS: Record<string, [number, number, number]> = {
    pending: [251, 191, 36], approved: [5, 150, 105], refused: [220, 38, 38]
  };
  const [sr, sg, sb] = STATUS_COLORS[req.status];
  doc.setFillColor(sr, sg, sb);
  doc.roundedRect(ML, y, 50, 8, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  doc.text(STATUS_LABELS[req.status], ML + 25, y + 5.2, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 12;

  if (req.adminComment) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Commentaire admin :", ML, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(req.adminComment, CW);
    doc.text(lines, ML, y); y += lines.length * 5 + 4;
  }

  if (req.approvedAt) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
    doc.text(`Traité le : ${new Date(req.approvedAt).toLocaleDateString("fr-FR")}`, ML, y); y += 8;
    doc.setTextColor(0, 0, 0);
  }

  doc.line(ML, y, W - MR, y); y += 8;

  // ── Signatures ──
  const sigBoxW = (CW - 10) / 2;
  const sigBoxH = 35;

  // Left: tech signature
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text("Signature du technicien", ML, y); y += 5;
  doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
  doc.rect(ML, y, sigBoxW, sigBoxH);
  if (req.techSignature) {
    try { doc.addImage(req.techSignature, "PNG", ML + 2, y + 2, sigBoxW - 4, sigBoxH - 4); } catch { /* invalid image */ }
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100);
  doc.text(req.technicianName, ML + sigBoxW / 2, y + sigBoxH + 4, { align: "center" });
  doc.text(fmtDate(req.createdAt.slice(0, 10)), ML + sigBoxW / 2, y + sigBoxH + 8, { align: "center" });

  // Right: admin signature
  const sigX2 = ML + sigBoxW + 10;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
  doc.text("Signature de validation", sigX2, y - 5);
  doc.rect(sigX2, y, sigBoxW, sigBoxH);
  if (req.adminSignature) {
    try { doc.addImage(req.adminSignature, "PNG", sigX2 + 2, y + 2, sigBoxW - 4, sigBoxH - 4); } catch { /* invalid image */ }
  }
  if (req.status === "pending") {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text("En attente de validation", sigX2 + sigBoxW / 2, y + sigBoxH / 2, { align: "center" });
  }
  if (req.adminName && req.approvedAt) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100);
    doc.text(req.adminName, sigX2 + sigBoxW / 2, y + sigBoxH + 4, { align: "center" });
    doc.text(new Date(req.approvedAt).toLocaleDateString("fr-FR"), sigX2 + sigBoxW / 2, y + sigBoxH + 8, { align: "center" });
  }

  doc.save(`conge_${req.technicianName.replace(/\s+/g, "_")}_${req.startDate}.pdf`);
}

export function LeaveRequestsPanel({ role }: { role: "admin" | "technicien" }) {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();

  // Queries
  const allQuery    = trpc.management.timeEntries.leaveRequests.list.useQuery(undefined, { enabled: role === "admin" });
  const ownQuery    = trpc.management.timeEntries.leaveRequests.list.useQuery(undefined, { enabled: role === "technicien" });
  const techsQuery  = trpc.management.timeEntries.listTechnicians.useQuery(undefined, { enabled: role === "admin" });

  const invalidate = async () => { await utils.management.timeEntries.leaveRequests.list.invalidate(); };

  // Mutations
  const pendingDocRef = useRef<RequestDoc | null>(null);

  const createMut  = trpc.management.timeEntries.leaveRequests.create.useMutation({
    onSuccess: async (res) => {
      toast.success("Demande envoyée.");
      // Generate PDF with technician signature
      const doc = pendingDocRef.current;
      if (doc) { doc.id = res.id; generateRequestPDF({ ...doc, techSignature: techSig }); }
      pendingDocRef.current = null;
      setTechSig(null);
      setCreateOpen(false);
      setForm({ startDate:"", endDate:"", comment:"" });
      await invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const approveMut = trpc.management.timeEntries.leaveRequests.approve.useMutation({
    onSuccess: async (d) => {
      toast.success(`Approuvé — ${d.daysCreated} jour(s) créé(s).`);
      const doc = pendingDocRef.current;
      if (doc) generateRequestPDF({ ...doc, adminSignature: adminSig, adminName: meQuery.data?.name ?? null, approvedAt: new Date().toISOString() });
      pendingDocRef.current = null;
      setAdminSig(null);
      setApproveId(null);
      setApproveComment("");
      await invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const refuseMut  = trpc.management.timeEntries.leaveRequests.refuse.useMutation({
    onSuccess: async () => { toast.success("Demande refusée."); setRefuseId(null); setRefuseComment(""); await invalidate(); },
    onError: e => toast.error(e.message),
  });
  const datesMut   = trpc.management.timeEntries.leaveRequests.updateDates.useMutation({
    onSuccess: async () => { toast.success("Dates modifiées."); setEditDatesId(null); await invalidate(); },
    onError: e => toast.error(e.message),
  });
  const cancelMut  = trpc.management.timeEntries.leaveRequests.cancel.useMutation({
    onSuccess: async () => { toast.success("Demande annulée."); setCancelId(null); await invalidate(); },
    onError: e => toast.error(e.message),
  });

  // UI state — create
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ startDate: "", endDate: "", comment: "" });

  // UI state — admin actions
  const [adminTab, setAdminTab]       = useState<"pending" | "all">("pending");
  const [techFilter, setTechFilter]   = useState<number | null>(null);
  const [approveId, setApproveId]     = useState<number | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [refuseId, setRefuseId]       = useState<number | null>(null);
  const [refuseComment, setRefuseComment]   = useState("");
  const [editDatesId, setEditDatesId] = useState<number | null>(null);
  const [editDatesForm, setEditDatesForm]   = useState({ startDate: "", endDate: "" });
  const [cancelId, setCancelId]       = useState<number | null>(null);
  const [techSig, setTechSig]         = useState<string | null>(null);
  const [adminSig, setAdminSig]       = useState<string | null>(null);

  // UI state — export (admin)
  const [exportMode, setExportMode]   = useState<"mois" | "plage">("mois");
  const [exportYear, setExportYear]   = useState(() => new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(() => new Date().getMonth() + 1);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd]     = useState("");
  const [exportTechIds, setExportTechIds] = useState<Set<number>>(new Set());

  // Export date bounds
  const { exportDateStart, exportDateEnd } = useMemo(() => {
    if (exportMode === "plage") return { exportDateStart: exportStart, exportDateEnd: exportEnd };
    const lastDay = new Date(exportYear, exportMonth, 0).getDate();
    return {
      exportDateStart: `${exportYear}-${String(exportMonth).padStart(2,"0")}-01`,
      exportDateEnd:   `${exportYear}-${String(exportMonth).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`,
    };
  }, [exportMode, exportYear, exportMonth, exportStart, exportEnd]);

  const exportEnabled = exportMode === "mois" || (!!exportStart && !!exportEnd && exportStart <= exportEnd);
  const exportQuery = trpc.management.timeEntries.leaveRequests.listForExport.useQuery(
    { startDate: exportDateStart, endDate: exportDateEnd, technicianIds: exportTechIds.size > 0 ? Array.from(exportTechIds) : undefined },
    { enabled: role === "admin" && exportEnabled && !!exportDateStart && !!exportDateEnd },
  );

  // Computed
  const minDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 31);
    return d.toISOString().slice(0, 10);
  }, []);

  const pendingCount = (allQuery.data ?? []).filter(r => r.status === "pending").length;
  const displayList  = role === "admin"
    ? (allQuery.data ?? []).filter(r => {
        if (adminTab === "pending" && r.status !== "pending") return false;
        if (techFilter && r.technicianId !== techFilter) return false;
        return true;
      })
    : (ownQuery.data ?? []);

  // ── Export PDF ──────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const rows = exportQuery.data ?? [];
    if (!rows.length) { toast.error("Aucune demande sur cette période."); return; }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, ML = 12, TH = 6, RH = 6;

    const periodLabel = exportMode === "plage"
      ? `${fmtDate(exportDateStart)} → ${fmtDate(exportDateEnd)}`
      : `${MONTHS_FR[exportMonth - 1]} ${exportYear}`;

    let y = 18;
    try { doc.addImage("data:image/png;base64," + OVEON_LOGO_B64, "PNG", W - ML - 40, 10, 40, 16); } catch { /* logo load failed */ }
    doc.setFont("helvetica","bold"); doc.setFontSize(13);
    doc.text("Récapitulatif des congés", ML, y); y += 7;
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text(`Période : ${periodLabel}`, ML, y);
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, W - ML, y, { align: "right" });
    y += 8;

    // Headers
    const cols = [48, 26, 26, 16, 28, 0];
    const heads = ["Technicien", "Début", "Fin", "Jours", "Statut", "Commentaire"];
    const noteW = W - ML * 2 - cols.slice(0, 5).reduce((a,b)=>a+b,0);
    cols[5] = noteW;

    doc.setFillColor(37, 99, 235); doc.setTextColor(255,255,255);
    doc.rect(ML, y, W - ML*2, TH, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
    let x = ML + 1;
    heads.forEach((h, i) => { doc.text(h, x, y + 4.2); x += cols[i]; });
    doc.setTextColor(0,0,0); y += TH;

    // Group by technician
    const byTech = new Map<number, typeof rows>();
    rows.forEach(r => {
      if (!byTech.has(r.technicianId)) byTech.set(r.technicianId, []);
      byTech.get(r.technicianId)!.push(r);
    });

    let grandTotal = 0;
    byTech.forEach((techRows) => {
      const first = techRows[0];
      const techTotal = techRows.reduce((s, r) => s + r.days, 0);
      grandTotal += techTotal;

      // Tech header row
      if (y > 185) { doc.addPage(); y = 15; }
      doc.setFillColor(241,245,249); doc.rect(ML, y, W - ML*2, 5, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(60,60,60);
      doc.text(`${first.technicianName}  (${first.contractHours ?? "39h"})`, ML+1, y+3.5);
      doc.text(`${techTotal} j`, W - ML - 2, y+3.5, { align: "right" });
      doc.setTextColor(0,0,0); y += 5;

      techRows.forEach((r, ei) => {
        if (y > 185) { doc.addPage(); y = 15; }
        const bg = ei % 2 === 0 ? [255,255,255] : [250,251,253];
        doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(ML, y, W - ML*2, RH, "F");
        doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
        x = ML+1;
        doc.text("", x, y + RH/2 + 1.5); x += cols[0]; // name already in header
        doc.text(fmtDateShort(r.startDate), x, y + RH/2 + 1.5); x += cols[1];
        doc.text(fmtDateShort(r.endDate),   x, y + RH/2 + 1.5); x += cols[2];
        doc.text(String(r.days),            x, y + RH/2 + 1.5); x += cols[3];
        const sc = STATUS_CFG[r.status];
        doc.setFont("helvetica","bold"); doc.text(sc.label, x, y + RH/2 + 1.5); x += cols[4];
        doc.setFont("helvetica","normal");
        const note = [r.comment, r.adminComment].filter(Boolean).join(" / ");
        if (note) doc.text(doc.splitTextToSize(note, cols[5] - 2)[0], x, y + RH/2 + 1.5);
        y += RH;
      });
    });

    // Footer
    if (y > 185) { doc.addPage(); y = 15; }
    y += 2;
    doc.setFillColor(37,99,235); doc.setTextColor(255,255,255);
    doc.rect(ML, y, W - ML*2, 7, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
    doc.text(`Total congés : ${grandTotal} jour${grandTotal > 1 ? "s" : ""}`, ML+2, y+4.8);
    doc.setTextColor(0,0,0);

    const suffix = exportMode === "plage" ? `${exportDateStart}_${exportDateEnd}` : `${exportYear}_${String(exportMonth).padStart(2,"0")}`;
    doc.save(`conges_${suffix}.pdf`);
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Demandes de <span className="text-primary">Congés</span></h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {role === "admin" ? "Gestion et validation des demandes de l'équipe" : "Vos demandes de congés"}
          </p>
        </div>
        {role === "technicien" && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <CalendarDays className="h-4 w-4" /> Nouvelle demande
          </Button>
        )}
      </div>

      {/* ── Admin tabs + filters ── */}
      {role === "admin" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            <button onClick={() => setAdminTab("pending")}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${adminTab==="pending" ? "bg-primary text-white" : "text-muted-foreground hover:bg-slate-50"}`}>
              <Clock className="h-3.5 w-3.5"/>En attente
              {pendingCount > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${adminTab==="pending" ? "bg-white/20" : "bg-primary/10 text-primary"}`}>{pendingCount}</span>}
            </button>
            <button onClick={() => setAdminTab("all")}
              className={`px-3 py-1.5 transition-colors ${adminTab==="all" ? "bg-primary text-white" : "text-muted-foreground hover:bg-slate-50"}`}>
              Toutes
            </button>
          </div>

          <select
            value={techFilter ?? ""}
            onChange={e => setTechFilter(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les techniciens</option>
            {(techsQuery.data ?? []).map(t => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Request list ── */}
      {displayList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3"/>
          <p className="font-medium text-muted-foreground">Aucune demande</p>
          {role === "technicien" && <p className="text-sm text-muted-foreground mt-1">Vos demandes de congés apparaîtront ici.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map(req => {
            const isEditing = editDatesId === req.id;
            return (
              <div key={req.id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${req.status === "pending" ? "border-amber-200" : req.status === "approved" ? "border-emerald-200" : "border-rose-200"}`}>
                <div className="p-4 space-y-3">
                  {/* Row 1: tech name (admin) + status + dates */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      {role === "admin" && (
                        <p className="text-sm font-bold text-foreground">
                          {req.technicianName}
                          <span className="ml-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{req.contractHours}</span>
                        </p>
                      )}
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <input type="date" value={editDatesForm.startDate} onChange={e => setEditDatesForm(f => ({...f, startDate: e.target.value}))}
                            className="rounded-lg border border-border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          <span className="text-muted-foreground text-sm">→</span>
                          <input type="date" value={editDatesForm.endDate} onChange={e => setEditDatesForm(f => ({...f, endDate: e.target.value}))}
                            className="rounded-lg border border-border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          <span className="text-xs text-muted-foreground">{countDays(editDatesForm.startDate, editDatesForm.endDate)} j</span>
                        </div>
                      ) : (
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                          {fmtDate(req.startDate)} → {fmtDate(req.endDate)}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{req.days} jour{req.days > 1 ? "s" : ""}</span>
                        </p>
                      )}
                    </div>
                    <StatusBadge status={req.status}/>
                  </div>

                  {/* Row 2: comments */}
                  {req.comment && (
                    <p className="text-sm text-muted-foreground italic">"{req.comment}"</p>
                  )}
                  {req.adminComment && (
                    <p className="text-sm rounded-lg bg-slate-50 px-3 py-2 border border-slate-200">
                      <span className="font-semibold text-slate-700">Admin : </span>{req.adminComment}
                    </p>
                  )}

                  {/* Row 3: actions */}
                  {role === "technicien" && (
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground text-xs"
                        onClick={() => generateRequestPDF({
                          id: req.id, technicianName: req.technicianName, employeeCode: req.employeeCode,
                          contractHours: req.contractHours, startDate: req.startDate, endDate: req.endDate,
                          days: req.days, comment: req.comment, adminComment: req.adminComment,
                          status: req.status, approvedAt: req.approvedAt, createdAt: req.createdAt,
                          techSignature: req.techSignature, adminSignature: req.adminSignature,
                        })}>
                        <FileDown className="h-3.5 w-3.5"/> Document
                      </Button>
                      {req.status === "pending" && (
                        <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5"
                          onClick={() => setCancelId(req.id)}>
                          <Trash2 className="h-3.5 w-3.5"/> Annuler
                        </Button>
                      )}
                    </div>
                  )}

                  {role === "admin" && req.status !== "pending" && (
                    <div className="flex justify-end pt-1 border-t border-slate-100">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground text-xs"
                        onClick={() => generateRequestPDF({
                          id: req.id, technicianName: req.technicianName, employeeCode: req.employeeCode,
                          contractHours: req.contractHours, startDate: req.startDate, endDate: req.endDate,
                          days: req.days, comment: req.comment, adminComment: req.adminComment,
                          status: req.status, approvedAt: req.approvedAt, createdAt: req.createdAt,
                          adminName: meQuery.data?.name ?? null,
                          techSignature: req.techSignature, adminSignature: req.adminSignature,
                        })}>
                        <FileDown className="h-3.5 w-3.5"/> Document
                      </Button>
                    </div>
                  )}

                  {role === "admin" && req.status === "pending" && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={() => datesMut.mutate({ id: req.id, ...editDatesForm })} disabled={datesMut.isPending || !editDatesForm.startDate || !editDatesForm.endDate || editDatesForm.endDate < editDatesForm.startDate}>
                            Enregistrer
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditDatesId(null)}>Annuler</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => { setEditDatesId(req.id); setEditDatesForm({ startDate: req.startDate, endDate: req.endDate }); }}>
                            <Pencil className="h-3.5 w-3.5"/> Modifier dates
                          </Button>
                          <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5 ml-auto"
                            onClick={() => { setRefuseId(req.id); setRefuseComment(""); }}>
                            <XCircle className="h-3.5 w-3.5"/> Refuser
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                            onClick={() => { setApproveId(req.id); setApproveComment(""); }}>
                            <CheckCircle2 className="h-3.5 w-3.5"/> Valider
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Admin export section ── */}
      {role === "admin" && (
        <div className="rounded-2xl border border-border/60 bg-white px-5 py-4 shadow-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Export PDF congés</p>

          {/* Tech selection */}
          <div>
            <p className="text-xs font-semibold mb-2">Techniciens</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setExportTechIds(new Set())}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${exportTechIds.size === 0 ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:border-primary/50"}`}
              >
                Tous
              </button>
              {(techsQuery.data ?? []).map(t => {
                const sel = exportTechIds.has(t.id);
                return (
                  <button key={t.id}
                    onClick={() => setExportTechIds(prev => { const n = new Set(prev); if (sel) n.delete(t.id); else n.add(t.id); return n; })}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${sel ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:border-primary/50"}`}
                  >
                    {t.firstName} {t.lastName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
              <button onClick={() => setExportMode("mois")}
                className={`px-3 py-1.5 transition-colors ${exportMode==="mois" ? "bg-primary text-white" : "text-muted-foreground hover:bg-slate-50"}`}>
                Mois
              </button>
              <button onClick={() => setExportMode("plage")}
                className={`px-3 py-1.5 transition-colors ${exportMode==="plage" ? "bg-primary text-white" : "text-muted-foreground hover:bg-slate-50"}`}>
                Plage
              </button>
            </div>

            {exportMode === "mois" ? (
              <div className="flex items-center gap-1">
                <button onClick={() => { if (exportMonth === 1) { setExportMonth(12); setExportYear(y => y-1); } else setExportMonth(m => m-1); }}
                  className="rounded-lg p-1 hover:bg-slate-100"><ChevronLeft className="h-4 w-4"/></button>
                <span className="text-sm font-semibold min-w-[110px] text-center">{MONTHS_FR[exportMonth-1]} {exportYear}</span>
                <button onClick={() => { if (exportMonth === 12) { setExportMonth(1); setExportYear(y => y+1); } else setExportMonth(m => m+1); }}
                  className="rounded-lg p-1 hover:bg-slate-100"><ChevronRight className="h-4 w-4"/></button>
              </div>
            ) : (
              <>
                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)}
                  className="rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"/>
                <span className="text-xs text-muted-foreground">→</span>
                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)}
                  className="rounded-lg border border-border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"/>
              </>
            )}

            <Button variant="outline" className="gap-2" onClick={exportPDF}
              disabled={!exportEnabled || exportQuery.isLoading}>
              <FileDown className="h-4 w-4"/>
              {exportQuery.isLoading ? "Chargement…" : "Exporter PDF"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Create (tech) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary"/> Nouvelle demande de congés
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-xs text-muted-foreground rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              La demande doit être faite au moins 31 jours à l'avance.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Début *</Label>
                <input type="date" min={minDate} value={form.startDate}
                  onChange={e => setForm(f => ({...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate}))}
                  className="w-full rounded-xl border border-border px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Fin *</Label>
                <input type="date" min={form.startDate || minDate} value={form.endDate}
                  onChange={e => setForm(f => ({...f, endDate: e.target.value}))}
                  className="w-full rounded-xl border border-border px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
            </div>
            {form.startDate && form.endDate && form.endDate >= form.startDate && (
              <p className="text-center text-sm font-semibold text-primary">
                {countDays(form.startDate, form.endDate)} jour{countDays(form.startDate, form.endDate) > 1 ? "s" : ""} de congé
                <span className="text-xs font-normal text-muted-foreground ml-1">(sam. inclus, dim. exclus)</span>
              </p>
            )}
            <div>
              <Label className="mb-1 block text-xs">Commentaire (optionnel)</Label>
              <Textarea value={form.comment} onChange={e => setForm(f => ({...f, comment: e.target.value}))}
                rows={2} placeholder="Raison, précisions…"
                className="resize-none text-sm"/>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Signature du technicien</Label>
              <SignaturePad onChange={setTechSig}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setTechSig(null); }}>Annuler</Button>
            <Button onClick={() => {
              pendingDocRef.current = {
                id: 0, technicianName: meQuery.data?.name ?? "", employeeCode: null,
                contractHours: null, startDate: form.startDate, endDate: form.endDate,
                days: countDays(form.startDate, form.endDate), comment: form.comment || null,
                adminComment: null, status: "pending", approvedAt: null, createdAt: new Date().toISOString(),
              };
              createMut.mutate({ startDate: form.startDate, endDate: form.endDate, comment: form.comment || null, techSignature: techSig });
            }}
              disabled={createMut.isPending || !form.startDate || !form.endDate || form.endDate < form.startDate || form.startDate < minDate}>
              {createMut.isPending ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={approveId !== null} onOpenChange={open => !open && setApproveId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600"/> Valider la demande</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="mb-1 block text-xs">Commentaire (optionnel)</Label>
              <Textarea value={approveComment} onChange={e => setApproveComment(e.target.value)} rows={2} placeholder="Message pour le technicien…" className="resize-none text-sm"/>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Signature de validation</Label>
              <SignaturePad onChange={setAdminSig}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveId(null); setAdminSig(null); }}>Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                const req = (allQuery.data ?? []).find(r => r.id === approveId);
                if (req) pendingDocRef.current = {
                  id: req.id, technicianName: req.technicianName, employeeCode: req.employeeCode,
                  contractHours: req.contractHours, startDate: req.startDate, endDate: req.endDate,
                  days: req.days, comment: req.comment, adminComment: approveComment || null,
                  status: "approved", approvedAt: null, createdAt: req.createdAt,
                  techSignature: req.techSignature,
                };
                approveMut.mutate({ id: approveId!, adminComment: approveComment || null, adminSignature: adminSig });
              }}
              disabled={approveMut.isPending}>
              {approveMut.isPending ? "Validation…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refuse dialog */}
      <Dialog open={refuseId !== null} onOpenChange={open => !open && setRefuseId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><XCircle className="h-4 w-4 text-rose-600"/> Refuser la demande</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="mb-1 block text-xs">Motif du refus (optionnel)</Label>
            <Textarea value={refuseComment} onChange={e => setRefuseComment(e.target.value)} rows={2} placeholder="Expliquez le refus…" className="resize-none text-sm"/>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseId(null)}>Annuler</Button>
            <Button variant="destructive"
              onClick={() => refuseMut.mutate({ id: refuseId!, adminComment: refuseComment || null })}
              disabled={refuseMut.isPending}>
              {refuseMut.isPending ? "Refus…" : "Confirmer le refus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm (tech) */}
      <AlertDialog open={cancelId !== null} onOpenChange={open => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la demande ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMut.mutate({ id: cancelId! })} className="bg-rose-600 text-white hover:bg-rose-700">
              Oui, annuler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
