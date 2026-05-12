import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Camera,
  ClipboardList,
  Download,
  FolderOpen,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { toast } from "sonner";

// ============================================================
// Types & constantes
// ============================================================

type InterventionType = "installation" | "maintenance" | "depannage" | "inspection" | "urgence" | "autre";
type InterventionPriority = "basse" | "normale" | "haute" | "urgente";
type InterventionStatus = "planifiee" | "en_cours" | "terminee" | "annulee";

type InterventionItem = {
  id: number;
  reference: string;
  title: string;
  interventionType: string;
  priority: string;
  status: string;
  technicianId: number | null;
  technicianName: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  completedAt: string | null;
  description: string | null;
  report: string | null;
  internalNotes: string | null;
};

const INTERVENTION_TYPE_OPTIONS: { value: InterventionType; label: string }[] = [
  { value: "installation", label: "Installation" },
  { value: "maintenance", label: "Maintenance" },
  { value: "depannage", label: "Dépannage" },
  { value: "inspection", label: "Inspection" },
  { value: "urgence", label: "Urgence" },
  { value: "autre", label: "Autre" },
];

const INTERVENTION_PRIORITY_OPTIONS: { value: InterventionPriority; label: string; tone: string }[] = [
  { value: "basse", label: "Basse", tone: "bg-slate-500/10 text-slate-600 border-slate-200" },
  { value: "normale", label: "Normale", tone: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { value: "haute", label: "Haute", tone: "bg-orange-500/10 text-orange-700 border-orange-200" },
  { value: "urgente", label: "Urgente", tone: "bg-rose-500/10 text-rose-700 border-rose-200" },
];

const INTERVENTION_STATUS_OPTIONS: { value: InterventionStatus; label: string; tone: string }[] = [
  { value: "planifiee", label: "Planifiée", tone: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { value: "en_cours", label: "En cours", tone: "bg-amber-500/10 text-amber-700 border-amber-200" },
  { value: "terminee", label: "Terminée", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  { value: "annulee", label: "Annulée", tone: "bg-slate-500/10 text-slate-500 border-slate-200" },
];

function intervenStatusTone(status: string): string {
  return INTERVENTION_STATUS_OPTIONS.find(o => o.value === status)?.tone ?? "bg-slate-500/10 text-slate-500 border-slate-200";
}
function priorityTone(priority: string): string {
  return INTERVENTION_PRIORITY_OPTIONS.find(o => o.value === priority)?.tone ?? "bg-slate-500/10 text-slate-500 border-slate-200";
}
function typeLabel(type: string): string {
  return INTERVENTION_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type;
}
function statusLabel(status: string): string {
  return INTERVENTION_STATUS_OPTIONS.find(o => o.value === status)?.label ?? status;
}
function priorityLabel(priority: string): string {
  return INTERVENTION_PRIORITY_OPTIONS.find(o => o.value === priority)?.label ?? priority;
}

type JournalEntryType = "etape" | "blocage" | "livraison" | "contact_client" | "note";
type MediaType = "photo" | "video";
type DocumentCategory = "rapport" | "photo" | "contrat" | "bon_intervention" | "plan" | "autre";
type DocumentVisibility = "interne" | "client" | "restreint";

const JOURNAL_TYPE_OPTIONS: { value: JournalEntryType; label: string; tone: string }[] = [
  { value: "etape", label: "Étape", tone: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { value: "blocage", label: "Blocage", tone: "bg-rose-500/10 text-rose-700 border-rose-200" },
  { value: "livraison", label: "Livraison", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  { value: "contact_client", label: "Contact client", tone: "bg-violet-500/10 text-violet-700 border-violet-200" },
  { value: "note", label: "Note", tone: "bg-slate-500/10 text-slate-700 border-slate-200" },
];

const DOCUMENT_CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "rapport", label: "Rapport" },
  { value: "photo", label: "Photo" },
  { value: "contrat", label: "Contrat" },
  { value: "bon_intervention", label: "Bon d'intervention" },
  { value: "plan", label: "Plan" },
  { value: "autre", label: "Autre" },
];

const DOCUMENT_VISIBILITY_OPTIONS: { value: DocumentVisibility; label: string; hint: string }[] = [
  { value: "interne", label: "Interne", hint: "Visible par l'équipe Oveon uniquement." },
  { value: "client", label: "Client", hint: "Également visible par le client final." },
  { value: "restreint", label: "Restreint", hint: "Accès limité (admin)." },
];

const MEDIA_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MEDIA_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"];

function PanelEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PanelHeader({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return value;
  }
}

function formatSize(bytes: number | null | undefined) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function toIsoOrNull(local: string) {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isoToLocalDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

// ============================================================
// Journal
// ============================================================

type JournalFormState = {
  entryType: JournalEntryType;
  title: string;
  content: string;
  occurredAt: string;
};

const INITIAL_JOURNAL_FORM: JournalFormState = {
  entryType: "etape",
  title: "",
  content: "",
  occurredAt: "",
};

export function ProjectJournalPanel({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.management.projectJournal.list.useQuery({ projectId });

  const createMutation = trpc.management.projectJournal.create.useMutation({
    onSuccess: async () => {
      toast.success("Entrée de journal ajoutée.");
      setCreateOpen(false);
      setForm(INITIAL_JOURNAL_FORM);
      await utils.management.projectJournal.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.management.projectJournal.update.useMutation({
    onSuccess: async () => {
      toast.success("Entrée mise à jour.");
      setEditId(null);
      await utils.management.projectJournal.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.management.projectJournal.delete.useMutation({
    onSuccess: async () => {
      toast.success("Entrée supprimée.");
      await utils.management.projectJournal.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<JournalFormState>(INITIAL_JOURNAL_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<JournalFormState>(INITIAL_JOURNAL_FORM);

  const startEdit = (entry: NonNullable<typeof listQuery.data>[number]) => {
    setEditId(entry.id);
    setEditForm({
      entryType: entry.entryType,
      title: entry.title ?? "",
      content: entry.content ?? "",
      occurredAt: isoToLocalDateTime(entry.occurredAt),
    });
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<BookOpen className="h-5 w-5" />}
        title="Journal du chantier"
        description="Historique horodaté des étapes, blocages, livraisons et échanges client."
        action={
          canManage ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  Nouvelle entrée
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Ajouter au journal</DialogTitle>
                  <DialogDescription>Documentez une étape, un blocage ou un échange.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type d'entrée</Label>
                      <Select value={form.entryType} onValueChange={value => setForm(prev => ({ ...prev, entryType: value as JournalEntryType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {JOURNAL_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date / heure</Label>
                      <Input
                        type="datetime-local"
                        value={form.occurredAt}
                        onChange={e => setForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Titre (optionnel)</Label>
                    <Input
                      value={form.title}
                      onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex. Réception du matériel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contenu</Label>
                    <Textarea
                      rows={5}
                      value={form.content}
                      onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Description détaillée…"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createMutation.mutate({
                      projectId,
                      entryType: form.entryType,
                      title: form.title.trim() ? form.title.trim() : null,
                      content: form.content.trim(),
                      occurredAt: toIsoOrNull(form.occurredAt),
                    })}
                    disabled={createMutation.isPending || !form.content.trim()}
                  >
                    Enregistrer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement du journal…</p>
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <PanelEmpty
          title="Aucune entrée pour le moment"
          description="Documentez les étapes clés du chantier pour garder une trace consultable par l'équipe."
        />
      ) : (
        <div className="space-y-3">
          {listQuery.data.map(entry => {
            const tone = JOURNAL_TYPE_OPTIONS.find(o => o.value === entry.entryType)?.tone ?? "bg-slate-500/10 text-slate-700 border-slate-200";
            const typeLabel = JOURNAL_TYPE_OPTIONS.find(o => o.value === entry.entryType)?.label ?? entry.entryType;
            return (
              <Card key={entry.id} className="border-white/10 shadow-sm shadow-slate-950/5">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`border ${tone}`}>{typeLabel}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(entry.occurredAt)}</span>
                    </div>
                    {entry.title ? <CardTitle className="text-base">{entry.title}</CardTitle> : null}
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Dialog open={editId === entry.id} onOpenChange={open => (open ? startEdit(entry) : setEditId(null))}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => startEdit(entry)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl">
                          <DialogHeader>
                            <DialogTitle>Modifier l'entrée</DialogTitle>
                            <DialogDescription>Mise à jour de l'entrée de journal.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={editForm.entryType} onValueChange={value => setEditForm(prev => ({ ...prev, entryType: value as JournalEntryType }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {JOURNAL_TYPE_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Date / heure</Label>
                                <Input
                                  type="datetime-local"
                                  value={editForm.occurredAt}
                                  onChange={e => setEditForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Titre</Label>
                              <Input value={editForm.title} onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Contenu</Label>
                              <Textarea rows={5} value={editForm.content} onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))} />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => updateMutation.mutate({
                                id: entry.id,
                                entryType: editForm.entryType,
                                title: editForm.title.trim() ? editForm.title.trim() : null,
                                content: editForm.content.trim(),
                                occurredAt: toIsoOrNull(editForm.occurredAt),
                              })}
                              disabled={updateMutation.isPending || !editForm.content.trim()}
                            >
                              Enregistrer
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-rose-700 hover:bg-rose-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
                            <AlertDialogDescription>L'action est définitive.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: entry.id })}
                              className="bg-rose-600 text-white hover:bg-rose-700"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{entry.content}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Par {entry.createdByName || "—"} · ajouté le {formatDateTime(entry.createdAt)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Mémos (internes)
// ============================================================

type MemoFormState = { title: string; content: string };
const INITIAL_MEMO_FORM: MemoFormState = { title: "", content: "" };

export function ProjectMemosPanel({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.management.projectMemos.list.useQuery({ projectId });

  const createMutation = trpc.management.projectMemos.create.useMutation({
    onSuccess: async () => {
      toast.success("Mémo créé.");
      setCreateOpen(false);
      setForm(INITIAL_MEMO_FORM);
      await utils.management.projectMemos.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.management.projectMemos.update.useMutation({
    onSuccess: async () => {
      toast.success("Mémo mis à jour.");
      setEditId(null);
      await utils.management.projectMemos.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.management.projectMemos.delete.useMutation({
    onSuccess: async () => {
      toast.success("Mémo supprimé.");
      await utils.management.projectMemos.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<MemoFormState>(INITIAL_MEMO_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MemoFormState>(INITIAL_MEMO_FORM);

  const startEdit = (memo: NonNullable<typeof listQuery.data>[number]) => {
    setEditId(memo.id);
    setEditForm({ title: memo.title ?? "", content: memo.content ?? "" });
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<StickyNote className="h-5 w-5" />}
        title="Mémos internes"
        description="Notes et rappels visibles uniquement par l'équipe Oveon (jamais par le client)."
        action={
          canManage ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  Nouveau mémo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Nouveau mémo interne</DialogTitle>
                  <DialogDescription>Note partagée uniquement avec l'équipe interne.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Titre (optionnel)</Label>
                    <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contenu</Label>
                    <Textarea rows={5} value={form.content} onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createMutation.mutate({
                      projectId,
                      title: form.title.trim() ? form.title.trim() : null,
                      content: form.content.trim(),
                    })}
                    disabled={createMutation.isPending || !form.content.trim()}
                  >
                    Enregistrer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des mémos…</p>
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <PanelEmpty
          title="Aucun mémo interne"
          description="Ajoutez un mémo pour partager une consigne ou un rappel avec l'équipe sans l'exposer au client."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {listQuery.data.map(memo => (
            <Card key={memo.id} className="border-white/10 shadow-sm shadow-slate-950/5">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="space-y-1">
                  {memo.title ? <CardTitle className="text-base">{memo.title}</CardTitle> : <CardTitle className="text-base text-muted-foreground">Mémo</CardTitle>}
                  <CardDescription className="text-xs">
                    Par {memo.createdByName || "—"} · mis à jour {formatDateTime(memo.updatedAt)}
                  </CardDescription>
                </div>
                {canManage ? (
                  <div className="flex gap-1">
                    <Dialog open={editId === memo.id} onOpenChange={open => (open ? startEdit(memo) : setEditId(null))}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(memo)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                          <DialogTitle>Modifier le mémo</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>Titre</Label>
                            <Input value={editForm.title} onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Contenu</Label>
                            <Textarea rows={5} value={editForm.content} onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => updateMutation.mutate({
                              id: memo.id,
                              title: editForm.title.trim() ? editForm.title.trim() : null,
                              content: editForm.content.trim(),
                            })}
                            disabled={updateMutation.isPending || !editForm.content.trim()}
                          >
                            Enregistrer
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-rose-700 hover:bg-rose-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce mémo ?</AlertDialogTitle>
                          <AlertDialogDescription>L'action est définitive.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: memo.id })}
                            className="bg-rose-600 text-white hover:bg-rose-700"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="pt-0">
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{memo.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Médias (photos + vidéos)
// ============================================================

async function uploadFileToSignedUrl(signedUrl: string, file: File): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Échec de l'upload (HTTP ${res.status}). ${text}`);
  }
}

export function ProjectMediaPanel({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.management.projectMedia.list.useQuery({ projectId });

  const createUploadMutation = trpc.management.projectMedia.createUploadUrl.useMutation();
  const registerMutation = trpc.management.projectMedia.register.useMutation();
  const deleteMutation = trpc.management.projectMedia.delete.useMutation({
    onSuccess: async () => {
      toast.success("Média supprimé.");
      await utils.management.projectMedia.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const handleFile = async (file: File) => {
    if (!file) return;
    const mediaType: MediaType = file.type.startsWith("video/") ? "video" : "photo";
    const allowed = mediaType === "video" ? MEDIA_VIDEO_MIME : MEDIA_PHOTO_MIME;
    if (!allowed.includes(file.type)) {
      toast.error(`Format ${file.type || "inconnu"} non supporté.`);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 100 Mo).");
      return;
    }

    setUploading(true);
    try {
      const upload = await createUploadMutation.mutateAsync({
        projectId,
        fileName: file.name,
        mimeType: file.type,
        mediaType,
      });
      await uploadFileToSignedUrl(upload.signedUrl, file);
      await registerMutation.mutateAsync({
        projectId,
        mediaType,
        caption: caption.trim() ? caption.trim() : null,
        fileName: file.name,
        fileKey: upload.fileKey,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      toast.success("Média ajouté.");
      setCaption("");
      await utils.management.projectMedia.list.invalidate({ projectId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'ajout du média.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Camera className="h-5 w-5" />}
        title="Médias du chantier"
        description="Photos avant/après et vidéos courtes (max 100 Mo par fichier)."
        action={
          canManage ? (
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              <Input
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Légende (optionnelle)"
                className="w-full sm:w-64"
                disabled={uploading}
              />
              <Button asChild disabled={uploading}>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Envoi…" : "Ajouter"}
                  <input
                    type="file"
                    accept={[...MEDIA_PHOTO_MIME, ...MEDIA_VIDEO_MIME].join(",")}
                    className="hidden"
                    disabled={uploading}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void handleFile(file);
                    }}
                  />
                </label>
              </Button>
            </div>
          ) : null
        }
      />

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des médias…</p>
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <PanelEmpty
          title="Aucun média"
          description="Ajoutez des photos avant/après ou de courtes vidéos pour documenter visuellement le chantier."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listQuery.data.map(item => (
            <Card key={item.id} className="overflow-hidden border-white/10 shadow-sm shadow-slate-950/5">
              <div className="relative aspect-video bg-muted">
                {item.signedUrl ? (
                  item.mediaType === "video" ? (
                    <video src={item.signedUrl} controls className="h-full w-full object-cover" preload="metadata" />
                  ) : (
                    <img src={item.signedUrl} alt={item.caption ?? item.fileName} className="h-full w-full object-cover" loading="lazy" />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    Aperçu indisponible
                  </div>
                )}
                <Badge className="absolute left-2 top-2 border bg-background/80 text-foreground">
                  {item.mediaType === "video" ? "Vidéo" : "Photo"}
                </Badge>
              </div>
              <CardContent className="space-y-2 p-4">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{item.caption || item.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(item.sizeBytes)} · {item.uploadedByName || "—"} · {formatDateTime(item.createdAt)}
                </p>
                <div className="flex justify-between gap-2 pt-1">
                  {item.signedUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={item.signedUrl} target="_blank" rel="noreferrer noopener" download={item.fileName}>
                        <Download className="h-4 w-4" />
                        Télécharger
                      </a>
                    </Button>
                  ) : <span />}
                  {canManage ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-rose-700 hover:bg-rose-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce média ?</AlertDialogTitle>
                          <AlertDialogDescription>Le fichier sera supprimé du stockage.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: item.id })}
                            className="bg-rose-600 text-white hover:bg-rose-700"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Documents (par chantier)
// ============================================================

type DocumentFormState = {
  title: string;
  documentType: DocumentCategory;
  visibility: DocumentVisibility;
};

const INITIAL_DOCUMENT_FORM: DocumentFormState = {
  title: "",
  documentType: "autre",
  visibility: "interne",
};

export function ProjectDocumentsPanel({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.management.projectDocuments.list.useQuery({ projectId });

  const createUploadMutation = trpc.management.projectDocuments.createUploadUrl.useMutation();
  const registerMutation = trpc.management.projectDocuments.register.useMutation();
  const deleteMutation = trpc.management.projectDocuments.delete.useMutation({
    onSuccess: async () => {
      toast.success("Document supprimé.");
      await utils.management.projectDocuments.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState<DocumentFormState>(INITIAL_DOCUMENT_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const resetUploadDialog = () => {
    setForm(INITIAL_DOCUMENT_FORM);
    setSelectedFile(null);
  };

  const submitUpload = async () => {
    if (!selectedFile) {
      toast.error("Sélectionnez un fichier.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Saisissez un titre.");
      return;
    }
    setUploading(true);
    try {
      const upload = await createUploadMutation.mutateAsync({
        projectId,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
      });
      await uploadFileToSignedUrl(upload.signedUrl, selectedFile);
      await registerMutation.mutateAsync({
        projectId,
        title: form.title.trim(),
        documentType: form.documentType,
        visibility: form.visibility,
        fileName: selectedFile.name,
        fileKey: upload.fileKey,
        mimeType: selectedFile.type || "application/octet-stream",
      });
      toast.success("Document ajouté.");
      setUploadOpen(false);
      resetUploadDialog();
      await utils.management.projectDocuments.list.invalidate({ projectId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'ajout du document.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<FolderOpen className="h-5 w-5" />}
        title="Documents du chantier"
        description="Rapports, contrats, plans et bons d'intervention rattachés à ce chantier."
        action={
          canManage ? (
            <Dialog open={uploadOpen} onOpenChange={open => { setUploadOpen(open); if (!open) resetUploadDialog(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4" />
                  Ajouter un document
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Nouveau document</DialogTitle>
                  <DialogDescription>Importer un document (rapport, contrat, plan…) lié à ce chantier.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Titre</Label>
                    <Input
                      value={form.title}
                      onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex. Rapport de fin d'installation"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Select value={form.documentType} onValueChange={value => setForm(prev => ({ ...prev, documentType: value as DocumentCategory }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_CATEGORY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Visibilité</Label>
                      <Select value={form.visibility} onValueChange={value => setForm(prev => ({ ...prev, visibility: value as DocumentVisibility }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_VISIBILITY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_VISIBILITY_OPTIONS.find(o => o.value === form.visibility)?.hint}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fichier</Label>
                    <Input
                      type="file"
                      onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    {selectedFile ? (
                      <p className="text-xs text-muted-foreground">
                        {selectedFile.name} · {formatSize(selectedFile.size)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => void submitUpload()} disabled={uploading || !selectedFile || !form.title.trim()}>
                    {uploading ? "Envoi…" : "Importer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des documents…</p>
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <PanelEmpty
          title="Aucun document"
          description="Importez les fichiers contractuels et techniques rattachés au chantier (rapports, contrats, plans, bons d'intervention…)."
        />
      ) : (
        <div className="space-y-3">
          {listQuery.data.map(doc => {
            const categoryLabel = DOCUMENT_CATEGORY_OPTIONS.find(o => o.value === doc.documentType)?.label ?? doc.documentType;
            const visibilityLabel = DOCUMENT_VISIBILITY_OPTIONS.find(o => o.value === doc.visibility)?.label ?? doc.visibility;
            return (
              <Card key={doc.id} className="border-white/10 shadow-sm shadow-slate-950/5">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.fileName} · {doc.uploadedByName || "—"} · {formatDateTime(doc.createdAt)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border bg-slate-500/10 text-slate-700 border-slate-200">{categoryLabel}</Badge>
                      <Badge className="border bg-indigo-500/10 text-indigo-700 border-indigo-200">{visibilityLabel}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {doc.signedUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={doc.signedUrl} target="_blank" rel="noreferrer noopener" download={doc.fileName}>
                          <Download className="h-4 w-4" />
                          Télécharger
                        </a>
                      </Button>
                    ) : null}
                    {canManage ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-rose-700 hover:bg-rose-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                            <AlertDialogDescription>Le fichier sera supprimé du stockage.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: doc.id })}
                              className="bg-rose-600 text-white hover:bg-rose-700"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Interventions
// ============================================================

type InterventionCreateForm = {
  title: string;
  interventionType: InterventionType;
  priority: InterventionPriority;
  technicianId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  description: string;
};

const INITIAL_INT_FORM: InterventionCreateForm = {
  title: "",
  interventionType: "maintenance",
  priority: "normale",
  technicianId: "",
  scheduledStartAt: "",
  scheduledEndAt: "",
  description: "",
};

export function ProjectInterventionsPanel({
  projectId,
  clientId,
  siteId,
  canManage,
}: {
  projectId: number;
  clientId: number;
  siteId: number | null;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<InterventionCreateForm>(INITIAL_INT_FORM);
  const [selected, setSelected] = useState<InterventionItem | null>(null);
  const [reportForm, setReportForm] = useState({ report: "", internalNotes: "" });
  const [editStatusValue, setEditStatusValue] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const listQuery = trpc.management.interventions.listByProject.useQuery({ projectId });
  const techniciansQuery = trpc.management.technicians.list.useQuery(undefined, { enabled: canManage });
  const mediaQuery = trpc.management.interventions.listMedia.useQuery(
    { interventionId: selected?.id ?? 0 },
    { enabled: !!selected }
  );

  const invalidate = async () => {
    await utils.management.interventions.listByProject.invalidate({ projectId });
  };

  const createMutation = trpc.management.interventions.create.useMutation({
    onSuccess: async () => {
      toast.success("Intervention créée.");
      setCreateOpen(false);
      setCreateForm(INITIAL_INT_FORM);
      await invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.management.interventions.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Statut mis à jour.");
      setSelected((prev) => (prev ? { ...prev, status: editStatusValue } : null));
      await invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateReportMutation = trpc.management.interventions.updateReport.useMutation({
    onSuccess: async () => {
      toast.success("Compte-rendu sauvegardé.");
      await invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createUploadUrl = trpc.management.interventions.createMediaUploadUrl.useMutation();
  const registerMedia = trpc.management.interventions.registerMedia.useMutation({
    onSuccess: async () => {
      await utils.management.interventions.listMedia.invalidate({ interventionId: selected?.id });
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMedia = trpc.management.interventions.deleteMedia.useMutation({
    onSuccess: async () => {
      toast.success("Photo supprimée.");
      await utils.management.interventions.listMedia.invalidate({ interventionId: selected?.id });
    },
    onError: (err) => toast.error(err.message),
  });

  function openDetail(item: InterventionItem) {
    setSelected(item);
    setReportForm({ report: item.report ?? "", internalNotes: item.internalNotes ?? "" });
    setEditStatusValue(item.status);
  }

  async function handlePhotoUpload(file: File) {
    if (!selected) return;
    setUploadingPhoto(true);
    try {
      const upload = await createUploadUrl.mutateAsync({
        interventionId: selected.id,
        fileName: file.name,
        mimeType: file.type,
      });
      const res = await fetch(upload.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error("Échec de l'upload.");
      await registerMedia.mutateAsync({
        interventionId: selected.id,
        fileName: file.name,
        fileKey: upload.fileKey,
        mimeType: file.type,
        sizeBytes: file.size,
        caption: null,
      });
      toast.success("Photo ajoutée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur upload.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const interventionsList = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">
            Interventions{interventionsList.length > 0 ? ` (${interventionsList.length})` : ""}
          </h3>
        </div>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nouvelle intervention
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nouvelle intervention</DialogTitle>
                <DialogDescription>Planifiez une intervention sur ce chantier.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Intitulé *</Label>
                  <Input
                    placeholder="Ex. : Maintenance climatisation"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={createForm.interventionType}
                      onValueChange={(v) => setCreateForm((p) => ({ ...p, interventionType: v as InterventionType }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTERVENTION_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priorité</Label>
                    <Select
                      value={createForm.priority}
                      onValueChange={(v) => setCreateForm((p) => ({ ...p, priority: v as InterventionPriority }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTERVENTION_PRIORITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Technicien</Label>
                  <Select
                    value={createForm.technicianId || "none"}
                    onValueChange={(v) => setCreateForm((p) => ({ ...p, technicianId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Non assigné" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non assigné</SelectItem>
                      {(techniciansQuery.data ?? []).map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.firstName} {t.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date de début</Label>
                    <Input
                      type="datetime-local"
                      value={createForm.scheduledStartAt}
                      onChange={(e) => setCreateForm((p) => ({ ...p, scheduledStartAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date de fin</Label>
                    <Input
                      type="datetime-local"
                      value={createForm.scheduledEndAt}
                      onChange={(e) => setCreateForm((p) => ({ ...p, scheduledEndAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Contexte, consignes…"
                    rows={3}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                <Button
                  disabled={!createForm.title.trim() || createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({
                      clientId,
                      siteId: siteId ?? undefined,
                      projectId,
                      title: createForm.title.trim(),
                      interventionType: createForm.interventionType,
                      priority: createForm.priority,
                      technicianId: createForm.technicianId ? Number(createForm.technicianId) : null,
                      scheduledStartAt: createForm.scheduledStartAt || null,
                      scheduledEndAt: createForm.scheduledEndAt || null,
                      description: createForm.description || null,
                    })
                  }
                >
                  {createMutation.isPending ? "Création…" : "Créer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Liste */}
      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Chargement…</p>
      ) : interventionsList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Wrench className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Aucune intervention</p>
            <p className="text-xs text-muted-foreground">
              {canManage ? "Créez la première via le bouton ci-dessus." : "Aucune intervention planifiée pour ce chantier."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {interventionsList.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => openDetail(item)}
            >
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{item.reference}</span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${intervenStatusTone(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityTone(item.priority)}`}>
                      {priorityLabel(item.priority)}
                    </span>
                    <span className="text-xs text-muted-foreground">{typeLabel(item.interventionType)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {item.scheduledStartAt && (
                      <span>{new Date(item.scheduledStartAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                    )}
                    {item.technicianName && <span>{item.technicianName}</span>}
                  </div>
                </div>
                <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog détail / compte-rendu */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-muted-foreground">{selected.reference}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${intervenStatusTone(selected.status)}`}>
                    {statusLabel(selected.status)}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-base font-semibold text-foreground">{selected.title}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-2">
                {/* Infos */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                    <p className="font-medium">{typeLabel(selected.interventionType)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Priorité</p>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityTone(selected.priority)}`}>
                      {priorityLabel(selected.priority)}
                    </span>
                  </div>
                  {selected.scheduledStartAt && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Début planifié</p>
                      <p className="font-medium">{new Date(selected.scheduledStartAt).toLocaleString("fr-FR")}</p>
                    </div>
                  )}
                  {selected.scheduledEndAt && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Fin planifiée</p>
                      <p className="font-medium">{new Date(selected.scheduledEndAt).toLocaleString("fr-FR")}</p>
                    </div>
                  )}
                  {selected.technicianName && (
                    <div className="col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Technicien</p>
                      <p className="font-medium">{selected.technicianName}</p>
                    </div>
                  )}
                  {selected.description && (
                    <div className="col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                      <p className="whitespace-pre-wrap">{selected.description}</p>
                    </div>
                  )}
                </div>

                {/* Changement de statut */}
                <div className="space-y-2 border-t pt-4">
                  <p className="text-sm font-semibold">Statut</p>
                  <div className="flex items-center gap-2">
                    <Select value={editStatusValue} onValueChange={setEditStatusValue}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTERVENTION_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={editStatusValue === selected.status || updateStatusMutation.isPending}
                      onClick={() =>
                        updateStatusMutation.mutate({
                          interventionId: selected.id,
                          status: editStatusValue as InterventionStatus,
                        })
                      }
                    >
                      {updateStatusMutation.isPending ? "…" : "Enregistrer"}
                    </Button>
                  </div>
                </div>

                {/* Compte-rendu */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold">Compte-rendu</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Travaux effectués</Label>
                    <Textarea
                      rows={4}
                      placeholder="Décrivez les travaux réalisés…"
                      value={reportForm.report}
                      onChange={(e) => setReportForm((p) => ({ ...p, report: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notes internes</Label>
                    <Textarea
                      rows={2}
                      placeholder="Notes pour l'équipe (non visible par le client)…"
                      value={reportForm.internalNotes}
                      onChange={(e) => setReportForm((p) => ({ ...p, internalNotes: e.target.value }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={updateReportMutation.isPending}
                    onClick={() =>
                      updateReportMutation.mutate({
                        interventionId: selected.id,
                        report: reportForm.report || null,
                        internalNotes: reportForm.internalNotes || null,
                      })
                    }
                  >
                    {updateReportMutation.isPending ? "Sauvegarde…" : "Sauvegarder le compte-rendu"}
                  </Button>
                </div>

                {/* Photos */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Photos</p>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingPhoto}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handlePhotoUpload(file);
                          e.target.value = "";
                        }}
                      />
                      <Button size="sm" variant="outline" disabled={uploadingPhoto} asChild>
                        <span className="flex items-center gap-1.5">
                          <Camera className="h-4 w-4" />
                          {uploadingPhoto ? "Upload…" : "Ajouter une photo"}
                        </span>
                      </Button>
                    </label>
                  </div>
                  {mediaQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Chargement photos…</p>
                  ) : (mediaQuery.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune photo pour cette intervention.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(mediaQuery.data ?? []).map((photo) => (
                        <div key={photo.id} className="relative group rounded-md overflow-hidden border bg-muted aspect-video">
                          {photo.signedUrl ? (
                            <img
                              src={photo.signedUrl}
                              alt={photo.caption ?? photo.fileName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Camera className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer cette photo ?</AlertDialogTitle>
                                <AlertDialogDescription>Le fichier sera supprimé du stockage.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMedia.mutate({ id: photo.id })}
                                  className="bg-rose-600 text-white hover:bg-rose-700"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
