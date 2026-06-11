import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ProjectStatus = "brouillon" | "planifie" | "en_cours" | "bloque" | "termine" | "annule" | "archive";

export type SharedProjectFormState = {
  clientName: string;
  address: string;
  phone: string;
  title: string;
  serviceType: string;
  description: string;
  quoteNumber: string;
  status: ProjectStatus;
  startDate: string;
  plannedEndDate: string;
  estimatedHours: string;
  technicianIds: number[];
  color: string;
};

export const INITIAL_SHARED_FORM: SharedProjectFormState = {
  clientName: "", address: "", phone: "", title: "",
  serviceType: "autre", description: "", quoteNumber: "",
  status: "planifie", startDate: "", plannedEndDate: "",
  estimatedHours: "0.00", technicianIds: [], color: "",
};

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planifie", label: "Planifié" },
  { value: "en_cours", label: "En cours" },
  { value: "bloque", label: "Bloqué" },
  { value: "termine", label: "Terminé" },
];

export const STATIC_SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: "clim", label: "Climatisation" },
  { value: "pac", label: "PAC" },
  { value: "chauffe_eau", label: "Chauffe-eau" },
  { value: "pv", label: "Photovoltaïque" },
  { value: "vmc", label: "VMC" },
  { value: "autre", label: "Autre" },
];

export const PROJECT_COLORS = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#10b981","#14b8a6",
  "#06b6d4","#0ea5e9","#3b82f6","#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899",
  "#be123c","#7f1d1d","#78350f","#365314","#14532d","#134e4a","#1e3a8a","#4c1d95",
  "#64748b","#475569","#1e293b","#292524","#0c4a6e","#fbbf24",
];

export function SharedProjectForm({
  form,
  onChange,
  technicians,
  showColor = true,
}: {
  form: SharedProjectFormState;
  onChange: (updates: Partial<SharedProjectFormState>) => void;
  technicians?: Array<{ id: number; firstName: string; lastName: string }>;
  showColor?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* 1. Nom du client */}
      <div className="space-y-2">
        <Label>Nom du client <span className="text-destructive text-xs">*</span></Label>
        <Input
          value={form.clientName}
          onChange={e => onChange({ clientName: e.target.value })}
          placeholder="Dupont Jean"
        />
      </div>

      {/* 2. Adresse avec suggestions */}
      <div className="space-y-2">
        <Label>Adresse</Label>
        <AddressAutocomplete
          value={form.address}
          onChange={v => onChange({ address: v })}
          placeholder="12 rue de la Paix, 75001 Paris…"
        />
      </div>

      {/* 3. Téléphone */}
      <div className="space-y-2">
        <Label>Téléphone</Label>
        <Input
          type="tel"
          value={form.phone}
          onChange={e => onChange({ phone: e.target.value })}
          placeholder="06 00 00 00 00"
          maxLength={50}
        />
      </div>

      {/* 4. Intitulé + Type de service côte à côte */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Intitulé du chantier <span className="text-destructive text-xs">*</span></Label>
          <Input
            value={form.title}
            onChange={e => onChange({ title: e.target.value })}
            placeholder="Installation pompe à chaleur"
          />
        </div>
        <div className="space-y-2">
          <Label>Type de service</Label>
          <Select value={form.serviceType} onValueChange={v => onChange({ serviceType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATIC_SERVICE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 5. Description */}
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Détails du chantier…"
          rows={3}
          className="resize-none"
        />
      </div>

      {/* 6. N° devis + Statut côte à côte */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>N° de devis</Label>
          <Input
            value={form.quoteNumber}
            onChange={e => onChange({ quoteNumber: e.target.value })}
            placeholder="DEV-2025-001"
          />
        </div>
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={v => onChange({ status: v as ProjectStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 7. Date début + Date fin + Heures estimées */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Date de début</Label>
          <Input
            type="date"
            value={form.startDate}
            onChange={e => onChange({ startDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Date de fin</Label>
          <Input
            type="date"
            value={form.plannedEndDate}
            onChange={e => onChange({ plannedEndDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Heures estimées</Label>
          <Input
            value={form.estimatedHours}
            onChange={e => onChange({ estimatedHours: e.target.value })}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* 8. Techniciens */}
      {technicians && technicians.length > 0 && (
        <div className="space-y-2">
          <Label>Technicien(s) attribué(s)</Label>
          <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 p-3">
            {technicians.map(tech => {
              const checked = form.technicianIds.includes(tech.id);
              return (
                <button
                  key={tech.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${checked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-slate-400"}`}
                  onClick={() => onChange({
                    technicianIds: checked
                      ? form.technicianIds.filter(id => id !== tech.id)
                      : [...form.technicianIds, tech.id],
                  })}
                >
                  {tech.firstName} {tech.lastName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. Couleur planning */}
      {showColor && (
        <div className="space-y-2">
          <Label>Couleur planning</Label>
          <div className="rounded-xl border border-border/60 p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                title="Aucune couleur"
                onClick={() => onChange({ color: "" })}
                className={`h-7 w-7 rounded-full border-2 transition-all flex items-center justify-center bg-white ${!form.color ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border hover:border-slate-400"}`}
              >
                <span className="text-[10px] text-muted-foreground font-bold">✕</span>
              </button>
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => onChange({ color: c })}
                  style={{ backgroundColor: c }}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${form.color === c ? "border-white ring-2 ring-offset-1 scale-110" : "border-transparent hover:scale-105"}`}
                />
              ))}
            </div>
            {form.color && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border border-border/60" style={{ backgroundColor: form.color }} />
                <span className="text-xs text-muted-foreground font-mono">{form.color}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
