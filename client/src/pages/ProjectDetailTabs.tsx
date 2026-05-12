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
  Download,
  FolderOpen,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { toast } from "sonner";

// ============================================================
// Types & constantes
// ============================================================

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
