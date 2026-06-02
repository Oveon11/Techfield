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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const COLOR_OPTIONS = [
  { value: "slate",   label: "Gris",    cls: "bg-slate-500" },
  { value: "blue",    label: "Bleu",    cls: "bg-blue-500" },
  { value: "green",   label: "Vert",    cls: "bg-emerald-500" },
  { value: "red",     label: "Rouge",   cls: "bg-rose-500" },
  { value: "amber",   label: "Ambre",   cls: "bg-amber-500" },
  { value: "violet",  label: "Violet",  cls: "bg-violet-500" },
  { value: "cyan",    label: "Cyan",    cls: "bg-cyan-500" },
  { value: "orange",  label: "Orange",  cls: "bg-orange-500" },
];

function colorSwatch(color: string) {
  const opt = COLOR_OPTIONS.find(c => c.value === color);
  return opt?.cls ?? "bg-slate-500";
}

type CreateForm = { code: string; label: string; color: string };
type EditForm   = { label: string; color: string; isActive: boolean };

const INIT_CREATE: CreateForm = { code: "", label: "", color: "blue" };
const INIT_EDIT:   EditForm   = { label: "", color: "blue", isActive: true };

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const listQuery = trpc.management.settings.listServiceTypes.useQuery();

  const createMutation = trpc.management.settings.createServiceType.useMutation({
    onSuccess: async () => {
      toast.success("Type de service créé.");
      setCreateOpen(false);
      setCreateForm(INIT_CREATE);
      await utils.management.settings.listServiceTypes.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const updateMutation = trpc.management.settings.updateServiceType.useMutation({
    onSuccess: async () => {
      toast.success("Type de service mis à jour.");
      setEditId(null);
      await utils.management.settings.listServiceTypes.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const deleteMutation = trpc.management.settings.deleteServiceType.useMutation({
    onSuccess: async () => {
      toast.success("Type de service supprimé.");
      await utils.management.settings.listServiceTypes.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(INIT_CREATE);

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(INIT_EDIT);

  const startEdit = (type: NonNullable<typeof listQuery.data>[number]) => {
    setEditId(type.id);
    setEditForm({ label: type.label, color: type.color, isActive: type.isActive });
  };

  const types = listQuery.data ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>
          <p className="text-sm text-muted-foreground">Configuration générale de Techfield</p>
        </div>

        {/* Types de services */}
        <div className="rounded-2xl border bg-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Types de services</h2>
              <p className="text-sm text-muted-foreground">PAC, Clim, PV, VMC… Personnalisez la liste selon vos activités.</p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>

          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : types.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun type de service configuré.</p>
          ) : (
            <div className="space-y-2">
              {types.map(type => (
                <div key={type.id} className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${colorSwatch(type.color)}`} />
                    <span className="font-medium text-sm">{type.label}</span>
                    <span className="text-xs font-mono text-muted-foreground uppercase">{type.code}</span>
                    {!type.isActive && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactif</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Dialog open={editId === type.id} onOpenChange={open => (open ? startEdit(type) : setEditId(null))}>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(type)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Modifier le type de service</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                          <div className="space-y-2">
                            <Label>Libellé</Label>
                            <Input
                              value={editForm.label}
                              onChange={e => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                              placeholder="Ex. Pompe à chaleur"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Couleur</Label>
                            <Select value={editForm.color} onValueChange={v => setEditForm(prev => ({ ...prev, color: v }))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {COLOR_OPTIONS.map(c => (
                                  <SelectItem key={c.value} value={c.value}>
                                    <div className="flex items-center gap-2">
                                      <span className={`h-3 w-3 rounded-full ${c.cls}`} />
                                      {c.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-3">
                            <Label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.isActive}
                                onChange={e => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="h-4 w-4 rounded border-input"
                              />
                              Actif
                            </Label>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => updateMutation.mutate({
                              id: type.id,
                              label: editForm.label.trim(),
                              color: editForm.color,
                              isActive: editForm.isActive,
                            })}
                            disabled={updateMutation.isPending || !editForm.label.trim()}
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
                          <AlertDialogTitle>Supprimer « {type.label} » ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Les chantiers utilisant ce type conserveront la valeur brute mais la couleur sera perdue.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: type.id })}
                            className="bg-rose-600 text-white hover:bg-rose-700"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogue création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouveau type de service</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Code (identifiant court)</Label>
              <Input
                value={createForm.code}
                onChange={e => setCreateForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, "_") }))}
                placeholder="Ex. PAC"
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input
                value={createForm.label}
                onChange={e => setCreateForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Ex. Pompe à chaleur"
              />
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <Select value={createForm.color} onValueChange={v => setCreateForm(prev => ({ ...prev, color: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${c.cls}`} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate({
                code: createForm.code.trim().toUpperCase(),
                label: createForm.label.trim(),
                color: createForm.color,
              })}
              disabled={createMutation.isPending || !createForm.code.trim() || !createForm.label.trim()}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
