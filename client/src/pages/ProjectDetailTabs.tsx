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
  ImageIcon,
  Pencil,
  Pin,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ReactNode, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ============================================================
// Types & constantes
// ============================================================

type JournalEntryType = "etape" | "blocage" | "livraison" | "contact_client" | "note" | "memo";
type MediaType = "photo" | "video";
type DocumentCategory = "rapport" | "photo" | "contrat" | "bon_intervention" | "plan" | "autre";
type DocumentVisibility = "interne" | "client" | "restreint";

const JOURNAL_TYPE_OPTIONS: { value: JournalEntryType; label: string; tone: string }[] = [
  { value: "etape", label: "Étape", tone: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { value: "blocage", label: "Blocage", tone: "bg-rose-500/10 text-rose-700 border-rose-200" },
  { value: "livraison", label: "Livraison", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  { value: "contact_client", label: "Contact client", tone: "bg-violet-500/10 text-violet-700 border-violet-200" },
  { value: "note", label: "Note", tone: "bg-slate-500/10 text-slate-700 border-slate-200" },
  { value: "memo", label: "Mémo", tone: "bg-amber-500/10 text-amber-700 border-amber-200" },
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

function fmtRelative(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function PostAvatar({ name }: { name: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const colors = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-rose-600", "bg-amber-500", "bg-cyan-600"];
  const color = colors[initial.charCodeAt(0) % colors.length];
  return (
    <div className={`h-10 w-10 shrink-0 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold`}>
      {initial}
    </div>
  );
}

type LocalPhoto = { id: number; signedUrl: string | null; caption: string | null };

function PhotoGrid({ photos, onZoom }: { photos: LocalPhoto[]; onZoom: (url: string) => void }) {
  if (photos.length === 0) return null;
  const z = (url: string | null) => (e: React.MouseEvent) => { e.stopPropagation(); if (url) onZoom(url); };
  if (photos.length === 1) {
    return <img src={photos[0].signedUrl ?? ""} alt={photos[0].caption ?? ""} className="w-full max-h-72 object-cover cursor-zoom-in rounded-b-2xl" onClick={z(photos[0].signedUrl)} />;
  }
  if (photos.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {photos.map(p => <img key={p.id} src={p.signedUrl ?? ""} alt={p.caption ?? ""} className="aspect-square w-full object-cover cursor-zoom-in" onClick={z(p.signedUrl)} />)}
      </div>
    );
  }
  if (photos.length === 3) {
    return (
      <div className="grid gap-0.5" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
        <img src={photos[0].signedUrl ?? ""} alt="" className="row-span-2 h-full w-full object-cover cursor-zoom-in" style={{ aspectRatio: "1" }} onClick={z(photos[0].signedUrl)} />
        <img src={photos[1].signedUrl ?? ""} alt="" className="aspect-square w-full object-cover cursor-zoom-in" onClick={z(photos[1].signedUrl)} />
        <img src={photos[2].signedUrl ?? ""} alt="" className="aspect-square w-full object-cover cursor-zoom-in" onClick={z(photos[2].signedUrl)} />
      </div>
    );
  }
  const visible = photos.slice(0, 4);
  const overflow = photos.length - 4;
  return (
    <div className="grid grid-cols-2 gap-0.5">
      {visible.map((p, i) => (
        <div key={p.id} className="relative cursor-zoom-in" onClick={z(p.signedUrl)}>
          <img src={p.signedUrl ?? ""} alt="" className="aspect-square w-full object-cover" />
          {i === 3 && overflow > 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
              <span className="text-white font-bold text-2xl">+{overflow}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors" onClick={onClose}>
        <X className="h-6 w-6" />
      </button>
      <img src={src} className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  );
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

export function ProjectJournalPanel({ projectId, canManage, canContribute }: { projectId: number; canManage: boolean; canContribute: boolean }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.management.projectJournal.list.useQuery({ projectId });
  const mediaListQuery = trpc.management.projectMedia.list.useQuery({ projectId });
  const createUploadMutation = trpc.management.projectMedia.createUploadUrl.useMutation();
  const registerMediaMutation = trpc.management.projectMedia.register.useMutation();

  const createMutation = trpc.management.projectJournal.create.useMutation({
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
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<JournalFormState>(INITIAL_JOURNAL_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitCreate = async () => {
    if (!form.content.trim()) return;
    const filesToUpload = [...attachedFiles];
    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        projectId,
        entryType: form.entryType,
        title: form.title.trim() ? form.title.trim() : null,
        content: form.content.trim(),
        occurredAt: toIsoOrNull(form.occurredAt),
      });
      for (const file of filesToUpload) {
        try {
          const upload = await createUploadMutation.mutateAsync({ projectId, fileName: file.name, mimeType: file.type, mediaType: "photo" });
          await fetch(upload.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          await registerMediaMutation.mutateAsync({ projectId, mediaType: "photo", caption: null, fileName: file.name, fileKey: upload.fileKey, mimeType: file.type, sizeBytes: file.size });
        } catch { /* skip failed photo */ }
      }
      toast.success(filesToUpload.length > 0 ? `Entrée + ${filesToUpload.length} photo(s) ajoutées.` : "Entrée de journal ajoutée.");
      setCreateOpen(false);
      setForm(INITIAL_JOURNAL_FORM);
      setAttachedFiles([]);
      await utils.management.projectJournal.list.invalidate({ projectId });
      if (filesToUpload.length > 0) await utils.management.projectMedia.list.invalidate({ projectId });
    } catch {
      // error shown by mutation onError
    } finally {
      setSubmitting(false);
    }
  };

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
          canContribute ? (
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
                      rows={4}
                      value={form.content}
                      onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Description détaillée…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Photos (optionnel)</Label>
                    <div className="flex flex-wrap gap-2">
                      {attachedFiles.map((f, i) => (
                        <div key={i} className="relative group">
                          <img src={URL.createObjectURL(f)} className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                          <button type="button" className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5 hidden group-hover:flex" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button type="button" className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors" onClick={() => fileInputRef.current?.click()}>
                        <ImageIcon className="h-5 w-5" />
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="hidden" onChange={e => { if (e.target.files) { setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; } }} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSubmitCreate} disabled={submitting || !form.content.trim()}>
                    {submitting ? `Envoi…` : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement du journal…</p>
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <PanelEmpty
          title="Aucune entrée pour le moment"
          description="Documentez les étapes clés du chantier pour garder une trace consultable par l'équipe."
        />
      ) : (
        <div className="space-y-2.5">
          {listQuery.data.map(entry => {
            const typeOpt = JOURNAL_TYPE_OPTIONS.find(o => o.value === entry.entryType);
            const tone = typeOpt?.tone ?? "bg-slate-500/10 text-slate-700 border-slate-200";
            const dot = typeOpt?.value === "etape" ? "bg-blue-500" : typeOpt?.value === "blocage" ? "bg-rose-500" : typeOpt?.value === "livraison" ? "bg-emerald-500" : typeOpt?.value === "contact_client" ? "bg-violet-500" : typeOpt?.value === "memo" ? "bg-amber-400" : "bg-slate-400";
            const leftBorder = typeOpt?.value === "etape" ? "border-l-blue-400" : typeOpt?.value === "blocage" ? "border-l-rose-400" : typeOpt?.value === "livraison" ? "border-l-emerald-400" : typeOpt?.value === "contact_client" ? "border-l-violet-400" : typeOpt?.value === "memo" ? "border-l-amber-400" : "border-l-slate-300";
            const entryTypeLabel = typeOpt?.label ?? entry.entryType;
            const authorName = entry.createdByName || "—";
            const entryTs = entry.occurredAt ?? entry.createdAt;
            const matchedPhotos: LocalPhoto[] = (mediaListQuery.data ?? []).filter(m => {
              if (m.mediaType !== "photo" || !m.signedUrl) return false;
              const mTs = m.createdAt ? new Date(m.createdAt).getTime() : 0;
              const eTs = entryTs ? new Date(entryTs).getTime() : 0;
              return m.uploadedByUserId === entry.createdByUserId && Math.abs(mTs - eTs) <= 10 * 60 * 1000;
            }).map(m => ({ id: m.id, signedUrl: m.signedUrl, caption: m.caption }));
            return (
              <div key={entry.id} className={`bg-white rounded-xl border border-l-4 ${leftBorder} border-slate-200 shadow-sm overflow-hidden`}>
                <div className="p-3">
                  <div className="flex items-start gap-2.5">
                    <PostAvatar name={authorName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-foreground shrink-0">{authorName}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${tone}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                          {entryTypeLabel}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{fmtRelative(entryTs)}</span>
                      </div>
                      {entry.title && <p className="mt-1 font-semibold text-sm text-foreground">{entry.title}</p>}
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-foreground">{entry.content}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(entryTs)}</p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Dialog open={editId === entry.id} onOpenChange={open => (open ? startEdit(entry) : setEditId(null))}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(entry)}>
                              <Pencil className="h-3.5 w-3.5" />
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
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-700 hover:bg-rose-50">
                              <Trash2 className="h-3.5 w-3.5" />
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
                    )}
                  </div>
                </div>
                {matchedPhotos.length > 0 && <PhotoGrid photos={matchedPhotos} onZoom={setLightboxSrc} />}
              </div>
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

const URGENCY_OPTIONS = [
  { value: "urgente", label: "Urgente", tone: "bg-rose-500/10 text-rose-700 border-rose-200" },
  { value: "haute",   label: "Haute",   tone: "bg-orange-500/10 text-orange-700 border-orange-200" },
  { value: "normale", label: "Normale", tone: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { value: "basse",   label: "Basse",   tone: "bg-slate-500/10 text-slate-500 border-slate-200" },
];

type TaskFormState = { title: string; content: string; urgency: string };
const INITIAL_TASK_FORM: TaskFormState = { title: "", content: "", urgency: "normale" };

export function ProjectMemosPanel({ projectId, canManage, canContribute }: { projectId: number; canManage: boolean; canContribute: boolean }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.management.projectMemos.list.useQuery({ projectId });

  const createMutation = trpc.management.projectMemos.create.useMutation({
    onSuccess: async () => {
      toast.success("Tâche créée.");
      setCreateOpen(false);
      setForm(INITIAL_TASK_FORM);
      await utils.management.projectMemos.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.management.projectMemos.update.useMutation({
    onSuccess: async () => {
      toast.success("Tâche mise à jour.");
      setEditId(null);
      await utils.management.projectMemos.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.management.projectMemos.delete.useMutation({
    onSuccess: async () => {
      toast.success("Tâche supprimée.");
      await utils.management.projectMemos.list.invalidate({ projectId });
    },
    onError: error => toast.error(error.message),
  });

  const createUploadMutation = trpc.management.projectMedia.createUploadUrl.useMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TaskFormState>(INITIAL_TASK_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TaskFormState & { status: string }>({ ...INITIAL_TASK_FORM, status: "todo" });
  const [validationTargetId, setValidationTargetId] = useState<number | null>(null);
  const [validationComment, setValidationComment] = useState("");
  const [validationPhotoFile, setValidationPhotoFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);

  const handleValidateMemo = async () => {
    if (!validationTargetId || !validationComment.trim()) return;
    setValidating(true);
    try {
      let photoKey: string | null = null;
      if (validationPhotoFile) {
        const upload = await createUploadMutation.mutateAsync({
          projectId,
          fileName: validationPhotoFile.name,
          mimeType: validationPhotoFile.type,
          mediaType: "photo",
        });
        await fetch(upload.signedUrl, { method: "PUT", body: validationPhotoFile, headers: { "Content-Type": validationPhotoFile.type } });
        photoKey = upload.fileKey;
      }
      await updateMutation.mutateAsync({
        id: validationTargetId,
        status: "done",
        validationComment: validationComment.trim(),
        validationPhotoKey: photoKey,
      });
      setValidationTargetId(null);
      setValidationComment("");
      setValidationPhotoFile(null);
    } catch {
      // error shown by mutation onError
    } finally {
      setValidating(false);
    }
  };

  const startEdit = (task: NonNullable<typeof listQuery.data>[number]) => {
    setEditId(task.id);
    setEditForm({ title: task.title ?? "", content: task.content ?? "", urgency: task.urgency ?? "normale", status: task.status ?? "todo" });
  };

  const tasks = listQuery.data ?? [];
  const sorted = [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const uOrder = ["urgente", "haute", "normale", "basse"];
    return (uOrder.indexOf(a.urgency ?? "normale")) - (uOrder.indexOf(b.urgency ?? "normale"));
  });

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<ClipboardList className="h-5 w-5" />}
        title="Tâches du chantier"
        description="Actions à réaliser, visibles par tous les membres de l'équipe."
        action={
          canContribute ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4" />Nouvelle tâche</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Nouvelle tâche</DialogTitle>
                  <DialogDescription>Ajoutez une action à réaliser sur ce chantier.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Titre (optionnel)</Label>
                      <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Ex. Poser le groupe extérieur" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Description</Label>
                      <Textarea rows={4} value={form.content} onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))} placeholder="Détails de la tâche…" />
                    </div>
                    <div className="space-y-2">
                      <Label>Urgence</Label>
                      <Select value={form.urgency} onValueChange={v => setForm(prev => ({ ...prev, urgency: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {URGENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createMutation.mutate({ projectId, title: form.title.trim() || null, content: form.content.trim(), urgency: form.urgency as "urgente" | "haute" | "normale" | "basse" })} disabled={createMutation.isPending || !form.content.trim()}>
                    Créer la tâche
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Validation dialog */}
      <Dialog open={validationTargetId !== null} onOpenChange={open => { if (!open) { setValidationTargetId(null); setValidationComment(""); setValidationPhotoFile(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Valider la tâche</DialogTitle>
            <DialogDescription>Renseignez un commentaire de clôture pour valider cette tâche.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Commentaire de validation <span className="text-rose-500">*</span></Label>
              <Textarea rows={3} value={validationComment} onChange={e => setValidationComment(e.target.value)} placeholder="Décrivez comment la tâche a été réalisée…" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Photo (optionnelle)</Label>
              {validationPhotoFile ? (
                <div className="flex items-center gap-2">
                  <img src={URL.createObjectURL(validationPhotoFile)} className="h-16 w-16 rounded-lg object-cover border" />
                  <button type="button" className="text-xs text-rose-600 hover:underline" onClick={() => setValidationPhotoFile(null)}>Retirer</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-primary hover:text-primary transition-colors">
                  <Camera className="h-4 w-4" />
                  Ajouter une photo
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setValidationPhotoFile(f); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidationTargetId(null); setValidationComment(""); setValidationPhotoFile(null); }}>Annuler</Button>
            <Button onClick={handleValidateMemo} disabled={validating || !validationComment.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {validating ? "Validation…" : "Valider la tâche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des tâches…</p>
      ) : sorted.length === 0 ? (
        <PanelEmpty title="Aucune tâche" description="Ajoutez des tâches à réaliser sur ce chantier, visibles par toute l'équipe." />
      ) : (
        <div className="space-y-3">
          {sorted.map(task => {
            const urgOpt = URGENCY_OPTIONS.find(o => o.value === (task.urgency ?? "normale")) ?? URGENCY_OPTIONS[2];
            const isDone = task.status === "done";
            return (
              <div key={task.id} className={`rounded-2xl border shadow-sm overflow-hidden transition-opacity ${isDone ? "opacity-60" : ""} ${task.pinned ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white"}`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (isDone) {
                          if (canManage) updateMutation.mutate({ id: task.id, status: "todo" });
                        } else {
                          setValidationTargetId(task.id);
                        }
                      }}
                      className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${isDone ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-emerald-400"} ${isDone && !canManage ? "cursor-default" : "cursor-pointer"}`}
                      title={isDone ? (canManage ? "Annuler la validation" : "Validé") : "Valider (commentaire requis)"}
                    >
                      {isDone && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <div className="flex-1 min-w-0">
                      {task.title && <p className={`font-semibold text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>}
                      <p className={`text-sm leading-6 mt-0.5 ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.content}</p>
                      {isDone && task.validationComment && (
                        <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                          <p className="text-xs text-emerald-700 font-semibold mb-0.5">
                            Validé{"validatedByName" in task && task.validatedByName ? ` par ${task.validatedByName}` : ""}
                            {"validatedAt" in task && task.validatedAt ? ` · ${formatDateTime(task.validatedAt as string)}` : ""}
                          </p>
                          <p className="text-xs text-emerald-700">{task.validationComment}</p>
                          {task.validationPhotoSignedUrl && (
                            <img src={task.validationPhotoSignedUrl} className="mt-2 h-20 w-20 object-cover rounded-lg cursor-zoom-in" onClick={() => window.open(task.validationPhotoSignedUrl!, "_blank")} />
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${urgOpt.tone}`}>{urgOpt.label}</span>
                        {isDone && <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Fait</span>}
                        {task.pinned && <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Épinglé</span>}
                        <span className="text-[10px] text-muted-foreground">Par {task.createdByName || "—"} · {formatDateTime(task.createdAt)}</span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title={task.pinned ? "Désépingler" : "Épingler"} onClick={() => updateMutation.mutate({ id: task.id, pinned: !task.pinned })}>
                          <Pin className={`h-3.5 w-3.5 ${task.pinned ? "fill-amber-500 text-amber-500" : ""}`} />
                        </Button>
                        <Dialog open={editId === task.id} onOpenChange={open => open ? startEdit(task) : setEditId(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(task)}><Pencil className="h-3.5 w-3.5" /></Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-xl">
                            <DialogHeader><DialogTitle>Modifier la tâche</DialogTitle></DialogHeader>
                            <div className="grid gap-4">
                              <div className="space-y-2">
                                <Label>Titre</Label>
                                <Input value={editForm.title} onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))} />
                              </div>
                              <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea rows={4} value={editForm.content} onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))} />
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Urgence</Label>
                                  <Select value={editForm.urgency} onValueChange={v => setEditForm(prev => ({ ...prev, urgency: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {URGENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={() => updateMutation.mutate({ id: task.id, title: editForm.title.trim() || null, content: editForm.content.trim(), urgency: editForm.urgency as "urgente" | "haute" | "normale" | "basse" })} disabled={updateMutation.isPending || !editForm.content.trim()}>
                                Enregistrer
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
                              <AlertDialogDescription>L'action est définitive.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate({ id: task.id })} className="bg-rose-600 text-white hover:bg-rose-700">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

export function ProjectMediaPanel({ projectId, canManage, canContribute }: { projectId: number; canManage: boolean; canContribute: boolean }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.management.projectMedia.list.useQuery({ projectId });
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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
  const [uploadProgress, setUploadProgress] = useState<[number, number] | null>(null);
  const [caption, setCaption] = useState("");

  const handleFiles = async (fileList: FileList) => {
    const allFiles = Array.from(fileList);
    const allowed = [...MEDIA_PHOTO_MIME, ...MEDIA_VIDEO_MIME];
    const valid = allFiles.filter(f => {
      if (!allowed.includes(f.type)) { toast.error(`Format non supporté : ${f.name}`); return false; }
      if (f.size > 100 * 1024 * 1024) { toast.error(`${f.name} dépasse 100 Mo.`); return false; }
      return true;
    });
    if (valid.length === 0) return;

    setUploading(true);
    setUploadProgress([0, valid.length]);
    let done = 0;

    for (const file of valid) {
      try {
        const mediaType: MediaType = file.type.startsWith("video/") ? "video" : "photo";
        const upload = await createUploadMutation.mutateAsync({
          projectId, fileName: file.name, mimeType: file.type, mediaType,
        });
        await uploadFileToSignedUrl(upload.signedUrl, file);
        await registerMutation.mutateAsync({
          projectId, mediaType,
          caption: valid.length === 1 && caption.trim() ? caption.trim() : null,
          fileName: file.name, fileKey: upload.fileKey,
          mimeType: file.type, sizeBytes: file.size,
        });
        done++;
        setUploadProgress([done, valid.length]);
      } catch (error) {
        toast.error(`Échec : ${file.name}`);
      }
    }

    if (done > 0) {
      toast.success(done === 1 ? "Média ajouté." : `${done} médias ajoutés.`);
      setCaption("");
      await utils.management.projectMedia.list.invalidate({ projectId });
    }
    setUploading(false);
    setUploadProgress(null);
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Camera className="h-5 w-5" />}
        title="Médias du chantier"
        description="Photos avant/après et vidéos courtes (max 100 Mo par fichier)."
        action={
          canContribute ? (
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
                  {uploading && uploadProgress
                    ? `Envoi ${uploadProgress[0]}/${uploadProgress[1]}…`
                    : uploading ? "Envoi…" : "Ajouter"}
                  <input
                    type="file"
                    accept={[...MEDIA_PHOTO_MIME, ...MEDIA_VIDEO_MIME].join(",")}
                    className="hidden"
                    multiple
                    disabled={uploading}
                    onChange={e => {
                      const files = e.target.files;
                      e.target.value = "";
                      if (files && files.length > 0) void handleFiles(files);
                    }}
                  />
                </label>
              </Button>
            </div>
          ) : null
        }
      />

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

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
                    <img src={item.signedUrl} alt={item.caption ?? item.fileName} className="h-full w-full object-cover cursor-zoom-in" loading="lazy" onClick={() => item.signedUrl && setLightboxSrc(item.signedUrl)} />
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

export function ProjectDocumentsPanel({ projectId, canManage, canContribute }: { projectId: number; canManage: boolean; canContribute: boolean }) {
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
          canContribute ? (
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
// Feed — Journal unifié chronologique
// ============================================================

export function ProjectActivityFeedPanel({
  projectId,
  clientId,
  siteId,
  canManage,
  canContribute,
}: {
  projectId: number;
  clientId: number;
  siteId: number | null;
  canManage: boolean;
  canContribute: boolean;
}) {
  const utils = trpc.useUtils();

  // --- Queries ---
  const journalQ = trpc.management.projectJournal.list.useQuery({ projectId });
  const mediaQ = trpc.management.projectMedia.list.useQuery({ projectId });
  const docsQ = trpc.management.projectDocuments.list.useQuery({ projectId });

  // --- Compose state ---
  const [composeText, setComposeText] = useState("");
  const [composeFile, setComposeFile] = useState<File | null>(null);
  const [composing, setComposing] = useState(false);

  // --- Document upload dialog state ---
  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState<DocumentFormState>(INITIAL_DOCUMENT_FORM);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);


  // --- Mutations ---
  const createJournal = trpc.management.projectJournal.create.useMutation();
  const deleteJournal = trpc.management.projectJournal.delete.useMutation({
    onSuccess: async () => { toast.success("Entrée supprimée."); await utils.management.projectJournal.list.invalidate({ projectId }); },
    onError: e => toast.error(e.message),
  });
  const togglePin = trpc.management.projectJournal.togglePin.useMutation({
    onSuccess: async (res) => { toast.success(res.pinned ? "Message épinglé." : "Message désépinglé."); await utils.management.projectJournal.list.invalidate({ projectId }); },
    onError: e => toast.error(e.message),
  });

  const createMediaUrl = trpc.management.projectMedia.createUploadUrl.useMutation();
  const registerMedia = trpc.management.projectMedia.register.useMutation();
  const deleteMedia = trpc.management.projectMedia.delete.useMutation({
    onSuccess: async () => { toast.success("Média supprimé."); await utils.management.projectMedia.list.invalidate({ projectId }); },
    onError: e => toast.error(e.message),
  });

  const createDocUrl = trpc.management.projectDocuments.createUploadUrl.useMutation();
  const registerDoc = trpc.management.projectDocuments.register.useMutation();
  const deleteDoc = trpc.management.projectDocuments.delete.useMutation({
    onSuccess: async () => { toast.success("Document supprimé."); await utils.management.projectDocuments.list.invalidate({ projectId }); },
    onError: e => toast.error(e.message),
  });


  // --- Build chronological feed (sorted DESC by date) ---
  const feedItems = useMemo(() => {
    const items = [
      ...(journalQ.data ?? []).map(d => ({ _type: "journal" as const, _date: d.occurredAt ?? d.createdAt ?? "", data: d })),
      ...(mediaQ.data ?? []).map(d => ({ _type: "media" as const, _date: d.createdAt ?? "", data: d })),
      ...(docsQ.data ?? []).map(d => ({ _type: "document" as const, _date: d.createdAt ?? "", data: d })),
    ];
    items.sort((a, b) => {
      const da = a._date ? new Date(a._date).getTime() : 0;
      const db = b._date ? new Date(b._date).getTime() : 0;
      return db - da;
    });
    return items;
  }, [journalQ.data, mediaQ.data, docsQ.data]);

  const isLoading = journalQ.isLoading || mediaQ.isLoading || docsQ.isLoading;

  // --- Handlers ---
  async function handlePublish() {
    const text = composeText.trim();
    if (!text && !composeFile) return;
    setComposing(true);
    try {
      if (composeFile) {
        const mediaType: MediaType = composeFile.type.startsWith("video/") ? "video" : "photo";
        const upload = await createMediaUrl.mutateAsync({ projectId, fileName: composeFile.name, mimeType: composeFile.type, mediaType });
        await uploadFileToSignedUrl(upload.signedUrl, composeFile);
        await registerMedia.mutateAsync({ projectId, mediaType, caption: text || null, fileName: composeFile.name, fileKey: upload.fileKey, mimeType: composeFile.type, sizeBytes: composeFile.size });
        await utils.management.projectMedia.list.invalidate({ projectId });
      }
      if (text) {
        await createJournal.mutateAsync({ projectId, entryType: "note", title: null, content: text, occurredAt: null });
        await utils.management.projectJournal.list.invalidate({ projectId });
      }
      toast.success("Publié.");
      setComposeText("");
      setComposeFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de publication.");
    } finally {
      setComposing(false);
    }
  }

  async function handleDocUpload() {
    if (!docFile || !docForm.title.trim()) return;
    setDocUploading(true);
    try {
      const upload = await createDocUrl.mutateAsync({ projectId, fileName: docFile.name, mimeType: docFile.type || "application/octet-stream" });
      await uploadFileToSignedUrl(upload.signedUrl, docFile);
      await registerDoc.mutateAsync({ projectId, title: docForm.title.trim(), documentType: docForm.documentType, visibility: docForm.visibility, fileName: docFile.name, fileKey: upload.fileKey, mimeType: docFile.type || "application/octet-stream" });
      toast.success("Document ajouté.");
      setDocOpen(false);
      setDocForm(INITIAL_DOCUMENT_FORM);
      setDocFile(null);
      await utils.management.projectDocuments.list.invalidate({ projectId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'import.");
    } finally {
      setDocUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Compose area ── */}
      {canContribute && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
          <Textarea
            rows={3}
            placeholder="Écrire une observation, une étape, une note…"
            value={composeText}
            onChange={e => setComposeText(e.target.value)}
            disabled={composing}
          />
          {composeFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Camera className="h-3.5 w-3.5" />
              <span>{composeFile.name} · {formatSize(composeFile.size)}</span>
              <button type="button" className="ml-auto text-rose-600 hover:text-rose-700" onClick={() => setComposeFile(null)}>✕</button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild disabled={composing}>
              <label className="cursor-pointer">
                <Camera className="h-4 w-4" />
                Photo
                <input type="file" accept={[...MEDIA_PHOTO_MIME, ...MEDIA_VIDEO_MIME].join(",")} className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setComposeFile(f); }} />
              </label>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDocOpen(true)}>
              <FolderOpen className="h-4 w-4" />
              Document
            </Button>
            <Button
              className="ml-auto"
              size="sm"
              disabled={composing || (!composeText.trim() && !composeFile)}
              onClick={() => void handlePublish()}
            >
              {composing ? "Publication…" : "Publier"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Feed ── */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Chargement du journal…</p>
      ) : feedItems.length === 0 ? (
        <PanelEmpty
          title="Aucune activité"
          description="Les notes, photos et documents apparaîtront ici dans l'ordre chronologique."
        />
      ) : (
        <div className="space-y-3">
          {feedItems.map(item => {
            if (item._type === "journal") {
              const entry = item.data;
              const tone = JOURNAL_TYPE_OPTIONS.find(o => o.value === entry.entryType)?.tone ?? "bg-slate-500/10 text-slate-700 border-slate-200";
              const label = JOURNAL_TYPE_OPTIONS.find(o => o.value === entry.entryType)?.label ?? entry.entryType;
              return (
                <Card key={`j-${entry.id}`} className={`shadow-sm shadow-slate-950/5 ${entry.pinned ? "border-primary/40 bg-primary/[0.03]" : "border-white/10"}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <BookOpen className="h-4 w-4 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {entry.pinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
                            <span className="text-sm font-bold text-foreground">{entry.createdByName || "—"}</span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(entry.occurredAt ?? entry.createdAt)}</span>
                            <Badge className={`border ${tone} text-xs`}>{label}</Badge>
                            {entry.title && <span className="text-sm font-semibold text-foreground">{entry.title}</span>}
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground mt-1">{entry.content}</p>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${entry.pinned ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-slate-100"}`}
                            onClick={() => togglePin.mutate({ id: entry.id })}
                            title={entry.pinned ? "Désépingler" : "Épingler"}
                          >
                            <Pin className={`h-3.5 w-3.5 ${entry.pinned ? "fill-primary" : ""}`} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-700 hover:bg-rose-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
                                <AlertDialogDescription>L'action est définitive.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteJournal.mutate({ id: entry.id })} className="bg-rose-600 text-white hover:bg-rose-700">Supprimer</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (item._type === "media") {
              const m = item.data;
              return (
                <Card key={`m-${m.id}`} className="border-white/10 shadow-sm shadow-slate-950/5">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{m.caption || m.fileName}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.signedUrl && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={m.signedUrl} target="_blank" rel="noreferrer noopener">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        {canManage && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-700 hover:bg-rose-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce média ?</AlertDialogTitle>
                                <AlertDialogDescription>Le fichier sera supprimé du stockage.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMedia.mutate({ id: m.id })} className="bg-rose-600 text-white hover:bg-rose-700">Supprimer</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    {m.signedUrl && m.mediaType === "photo" && (
                      <img src={m.signedUrl} alt={m.caption ?? m.fileName} className="max-h-48 rounded-md object-cover" loading="lazy" />
                    )}
                    {m.signedUrl && m.mediaType === "video" && (
                      <video src={m.signedUrl} controls className="max-h-48 w-full rounded-md" preload="metadata" />
                    )}
                    <p className="text-xs text-muted-foreground">Par {m.uploadedByName || "—"} · {formatSize(m.sizeBytes)}</p>
                  </CardContent>
                </Card>
              );
            }

            if (item._type === "document") {
              const doc = item.data;
              const catLabel = DOCUMENT_CATEGORY_OPTIONS.find(o => o.value === doc.documentType)?.label ?? doc.documentType;
              return (
                <Card key={`d-${doc.id}`} className="border-white/10 shadow-sm shadow-slate-950/5">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{doc.title}</span>
                        <Badge className="border bg-slate-500/10 text-slate-700 border-slate-200 text-xs">{catLabel}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(doc.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.signedUrl && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={doc.signedUrl} target="_blank" rel="noreferrer noopener" download={doc.fileName}>
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        {canManage && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-700 hover:bg-rose-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                                <AlertDialogDescription>Le fichier sera supprimé du stockage.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteDoc.mutate({ id: doc.id })} className="bg-rose-600 text-white hover:bg-rose-700">Supprimer</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Par {doc.uploadedByName || "—"} · {doc.fileName}</p>
                  </CardContent>
                </Card>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* ── Dialog : Upload document ── */}
      {canContribute && (
        <Dialog open={docOpen} onOpenChange={open => { setDocOpen(open); if (!open) { setDocForm(INITIAL_DOCUMENT_FORM); setDocFile(null); } }}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Nouveau document</DialogTitle>
              <DialogDescription>Importer un document lié à ce chantier.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={docForm.title} onChange={e => setDocForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex. Rapport de fin d'installation" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={docForm.documentType} onValueChange={v => setDocForm(p => ({ ...p, documentType: v as DocumentCategory }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DOCUMENT_CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibilité</Label>
                  <Select value={docForm.visibility} onValueChange={v => setDocForm(p => ({ ...p, visibility: v as DocumentVisibility }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DOCUMENT_VISIBILITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fichier</Label>
                <Input type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
                {docFile && <p className="text-xs text-muted-foreground">{docFile.name} · {formatSize(docFile.size)}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void handleDocUpload()} disabled={docUploading || !docFile || !docForm.title.trim()}>
                {docUploading ? "Envoi…" : "Importer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
