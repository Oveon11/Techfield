import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, CheckSquare, Square, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportedEvent {
  uid: string;
  summary: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  location: string | null;
  description: string | null;
}

interface Technician {
  id: number;
  firstName: string;
  lastName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  technicians: Technician[];
  onImport: (events: ImportedEvent[], technicianId: number) => void;
  importing: boolean;
}

// ── iCal parser ───────────────────────────────────────────────────────────────

function unfold(content: string): string[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const result: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && result.length > 0) {
      result[result.length - 1] += line.slice(1);
    } else {
      result.push(line);
    }
  }
  return result;
}

function parseICSDateTime(value: string): { date: string; time: string } | null {
  // Remove VALUE=DATE-TIME or TZID= param: take only the value after the last ':'
  const raw = value.includes(":") ? value.split(":").pop()! : value;
  // Date-only: 20260610
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8);
    return { date: `${y}-${m}-${d}`, time: "08:00" };
  }
  // DateTime: 20260610T080000Z or 20260610T080000
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    time: `${m[4]}:${m[5]}`,
  };
}

export function parseICS(content: string): ImportedEvent[] {
  const lines = unfold(content);
  const events: ImportedEvent[] = [];
  let inEvent = false;
  let cur: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") { inEvent = true; cur = {}; continue; }
    if (trimmed === "END:VEVENT") {
      inEvent = false;
      const start = cur.DTSTART ? parseICSDateTime(cur.DTSTART) : null;
      const end   = cur.DTEND   ? parseICSDateTime(cur.DTEND)   : null;
      if (start && end && cur.SUMMARY) {
        events.push({
          uid: cur.UID ?? `${Date.now()}-${Math.random()}`,
          summary: cur.SUMMARY.replace(/\\,/g, ",").replace(/\\n/g, " ").trim(),
          date: start.date,
          startTime: start.time,
          endTime: end.time === start.time ? addOneHour(start.time) : end.time,
          location: cur.LOCATION ? cur.LOCATION.replace(/\\,/g, ",").replace(/\\n/g, " ").trim() : null,
          description: cur.DESCRIPTION ? cur.DESCRIPTION.replace(/\\n/g, "\n").replace(/\\,/g, ",").trim() : null,
        });
      }
      continue;
    }
    if (!inEvent) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const keyFull = trimmed.slice(0, colon).toUpperCase();
    const val = trimmed.slice(colon + 1);
    // Normalize key: strip parameters (e.g. DTSTART;TZID=... → DTSTART)
    const key = keyFull.split(";")[0];
    cur[key] = val;
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const nh = Math.min(h + 1, 23);
  return `${String(nh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportCalendarDialog({ open, onClose, technicians, onImport, importing }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<ImportedEvent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [techId, setTechId] = useState<string>("");
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const reset = () => {
    setEvents([]);
    setSelected(new Set());
    setTechId("");
    setStep("upload");
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".ics") && !file.name.endsWith(".ical")) {
      toast.error("Fichier invalide. Exportez votre agenda Google au format .ics");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseICS(content);
        if (!parsed.length) { toast.error("Aucun événement trouvé dans ce fichier."); return; }
        setEvents(parsed);
        setSelected(new Set(parsed.map(ev => ev.uid)));
        setStep("preview");
      } catch {
        toast.error("Impossible de lire ce fichier iCal.");
      }
    };
    reader.readAsText(file);
  };

  const toggleAll = () => {
    if (selected.size === events.length) setSelected(new Set());
    else setSelected(new Set(events.map(e => e.uid)));
  };

  const toggle = (uid: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  };

  const handleImport = () => {
    if (!techId) { toast.error("Sélectionnez un technicien."); return; }
    const toImport = events.filter(e => selected.has(e.uid));
    if (!toImport.length) { toast.error("Sélectionnez au moins un événement."); return; }
    onImport(toImport, Number(techId));
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Importer depuis Google Calendar
          </DialogTitle>
        </DialogHeader>

        {step === "upload" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            {/* Instructions */}
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 space-y-1.5 w-full">
              <p className="font-semibold">Comment exporter votre Google Calendar :</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Ouvrez <strong>Google Calendar</strong> sur ordinateur</li>
                <li>⚙️ Paramètres → <strong>Importer et exporter</strong></li>
                <li>Cliquez sur <strong>Exporter</strong> → télécharge un .zip</li>
                <li>Décompressez et uploadez le fichier <strong>.ics</strong> ci-dessous</li>
              </ol>
            </div>

            {/* Drop zone */}
            <div
              className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 py-12"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Glissez votre fichier .ics ici</p>
                <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".ics,.ical" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Technician selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs font-semibold mb-1">Assigner à</p>
                <Select value={techId} onValueChange={setTechId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un technicien…" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.firstName} {t.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground pt-5">
                <span className="font-semibold text-foreground">{selected.size}</span>/{events.length} événements sélectionnés
              </div>
            </div>

            {/* Event list */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40 min-h-0">
              {/* Select all header */}
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 sticky top-0">
                <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
                  {selected.size === events.length
                    ? <CheckSquare className="h-4 w-4 text-primary" />
                    : <Square className="h-4 w-4" />}
                </button>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tout sélectionner</span>
              </div>

              {events.map(ev => {
                const sel = selected.has(ev.uid);
                return (
                  <div key={ev.uid}
                    className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${sel ? "" : "opacity-40"}`}
                    onClick={() => toggle(ev.uid)}>
                    <button className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                      {sel
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm truncate">{ev.summary}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{ev.startTime}–{ev.endTime}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{fmtDate(ev.date)}</p>
                      {ev.location && <p className="text-xs text-muted-foreground/70 truncate">{ev.location}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Back button */}
            <button onClick={() => { setStep("upload"); setEvents([]); }}
              className="text-xs text-muted-foreground underline underline-offset-2 self-start">
              ← Changer de fichier
            </button>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          {step === "preview" && (
            <Button
              onClick={handleImport}
              disabled={importing || selected.size === 0 || !techId}
              className="gap-1.5"
            >
              <CalendarDays className="h-4 w-4" />
              {importing ? "Import en cours…" : `Importer ${selected.size} événement${selected.size > 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
