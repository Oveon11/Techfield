import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Check, Copy, KeyRound, Plus, RefreshCw, Settings, Trash2, UserX, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeFirstName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

function generateUsername(firstName: string): string {
  const base = normalizeFirstName(firstName) || "user";
  const num = String(Math.floor(Math.random() * 10) + 1).padStart(2, "0");
  return `${base}${num}`;
}

function generatePassword(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1.5 inline-flex items-center rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
      title="Copier"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const ROLE_LABELS: Record<string, string> = { admin: "Admin", technicien: "Technicien", client: "Client" };
const ROLE_TONE: Record<string, string> = {
  admin:      "bg-violet-100 text-violet-700 border-violet-200",
  technicien: "bg-blue-100 text-blue-700 border-blue-200",
  client:     "bg-slate-100 text-slate-600 border-slate-200",
};

// ─── Create user dialog ──────────────────────────────────────────────────────

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"admin" | "technicien" | "client">("technicien");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(() => generatePassword());

  const createMutation = trpc.users.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Utilisateur "${data.username}" créé avec succès.`);
      setOpen(false);
      resetForm();
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setFirstName(""); setLastName(""); setRole("technicien");
    setUsername(""); setPassword(generatePassword());
  }

  function handleFirstNameChange(v: string) {
    setFirstName(v);
    if (!username || username === generateUsername(firstName)) {
      setUsername(generateUsername(v));
    }
  }

  const canSubmit = firstName.trim() && lastName.trim() && username.trim() && password.length === 6 && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un utilisateur</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cu-first">Prénom</Label>
              <Input
                id="cu-first"
                placeholder="Léo"
                value={firstName}
                onChange={e => handleFirstNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-last">Nom</Label>
              <Input
                id="cu-last"
                placeholder="Benkatta"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-role">Rôle</Label>
            <Select value={role} onValueChange={v => setRole(v as typeof role)}>
              <SelectTrigger id="cu-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="technicien">Technicien</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cu-username">Identifiant</Label>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setUsername(generateUsername(firstName || "user"))}
              >
                <RefreshCw className="h-3 w-3" /> Régénérer
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="cu-username"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                placeholder="leo03"
                className="font-mono"
              />
              <CopyButton value={username} />
            </div>
            <p className="text-xs text-muted-foreground">Lettres minuscules et chiffres uniquement.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cu-password">Mot de passe (6 chiffres)</Label>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setPassword(generatePassword())}
              >
                <RefreshCw className="h-3 w-3" /> Régénérer
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="cu-password"
                value={password}
                onChange={e => setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                className="font-mono tracking-widest text-lg"
                placeholder="000000"
              />
              <CopyButton value={password} />
            </div>
          </div>

          {/* Récap à partager */}
          {username && password.length === 6 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">Identifiants à communiquer :</p>
              <p>Identifiant : <span className="font-mono font-bold">{username}</span> <CopyButton value={username} /></p>
              <p>Mot de passe : <span className="font-mono font-bold">{password}</span> <CopyButton value={password} /></p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            onClick={() => createMutation.mutate({ firstName, lastName, role, username, password })}
            disabled={!canSubmit}
          >
            {createMutation.isPending ? "Création…" : "Créer le compte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit user dialog ────────────────────────────────────────────────────────

type UserRow = { id: number; openId: string; name: string | null; username: string | null; email: string | null; role: "admin" | "technicien" | "client"; accountStatus: "active" | "invited" | "suspended" };

function EditUserDialog({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const parts = (user.name ?? "").trim().split(" ");
  const [firstName, setFirstName] = useState(parts[0] ?? "");
  const [lastName, setLastName] = useState(parts.slice(1).join(" ") ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [role, setRole] = useState<"admin" | "technicien" | "client">(user.role);
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState(() => generatePassword());

  const utils = trpc.useUtils();

  const updateMut = trpc.users.update.useMutation({
    onSuccess: () => { toast.success("Utilisateur mis à jour."); utils.users.list.invalidate(); setOpen(false); onDone(); },
    onError: e => toast.error(e.message),
  });

  const deleteMut = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("Utilisateur supprimé."); utils.users.list.invalidate(); setOpen(false); onDone(); },
    onError: e => toast.error(e.message),
  });

  const canSave = firstName.trim() && lastName.trim() && username.trim() && (!changePassword || password.length === 6) && !updateMut.isPending;

  return (
    <>
      <button
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Réglages"
      >
        <Settings className="h-3.5 w-3.5" /> Réglages
      </button>

      <Dialog open={open} onOpenChange={v => { setOpen(v); }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prénom</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Léo" />
              </div>
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Benkatta" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Identifiant</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                  placeholder="leo03"
                  className="font-mono"
                />
                <CopyButton value={username} />
              </div>
              <p className="text-xs text-muted-foreground">Lettres minuscules et chiffres uniquement.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={v => setRole(v as typeof role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="technicien">Technicien</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={changePassword} onChange={e => setChangePassword(e.target.checked)} className="rounded" />
                <span className="text-sm font-medium">Changer le mot de passe</span>
              </label>
              {changePassword && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Nouveau mot de passe (6 chiffres)</Label>
                    <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setPassword(generatePassword())}>
                      <RefreshCw className="h-3 w-3" /> Régénérer
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={password} onChange={e => setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} inputMode="numeric" className="font-mono tracking-widest text-lg" placeholder="000000" />
                    <CopyButton value={password} />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-destructive/20">
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-destructive hover:underline"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Supprimer cet utilisateur
              </button>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => updateMut.mutate({ id: user.id, openId: user.openId, firstName: firstName.trim(), lastName: lastName.trim(), username, role, ...(changePassword ? { password } : {}) })} disabled={!canSave}>
              {updateMut.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {user.name ?? user.username} ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible. Le compte sera définitivement supprimé.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => deleteMut.mutate({ id: user.id, openId: user.openId })} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Reset password dialog ───────────────────────────────────────────────────

function ResetPasswordDialog({ user }: { user: { openId: string; name: string | null; username: string | null; email: string | null } }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState(() => generatePassword());

  const resetMutation = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Mot de passe réinitialisé.");
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const canReset = Boolean(user.openId && user.openId.length > 10);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setNewPassword(generatePassword()); }}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={!canReset}
          title={canReset ? "Réinitialiser le mot de passe" : "Compte legacy — réinitialiser depuis le dashboard Supabase"}
        >
          <KeyRound className="h-3.5 w-3.5" /> Réinitialiser
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Utilisateur : <span className="font-medium text-foreground">{user.name ?? user.username ?? user.email}</span>
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Nouveau mot de passe</Label>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setNewPassword(generatePassword())}
              >
                <RefreshCw className="h-3 w-3" /> Régénérer
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newPassword}
                onChange={e => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                className="font-mono tracking-widest text-lg"
                placeholder="000000"
              />
              <CopyButton value={newPassword} />
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Communiquez ce nouveau mot de passe à l'utilisateur.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            onClick={() => resetMutation.mutate({ openId: user.openId, password: newPassword })}
            disabled={newPassword.length !== 6 || resetMutation.isPending}
          >
            {resetMutation.isPending ? "Réinitialisation…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Rôle mis à jour."); },
    onError: (err) => toast.error(err.message),
  });

  const toggleStatusMutation = trpc.users.toggleStatus.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between border-b border-border/60 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Utilisateurs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gérez les comptes, rôles et mots de passe.</p>
          </div>
          <CreateUserDialog onCreated={() => utils.users.list.invalidate()} />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/60 bg-white shadow-sm shadow-slate-950/5">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Utilisateur</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    Aucun utilisateur. Créez le premier compte ci-dessus.
                  </TableCell>
                </TableRow>
              ) : (
                users.map(u => (
                  <TableRow key={u.id} className="group">
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {(u.name ?? u.username ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{u.name ?? "—"}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {u.username ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-700">
                          {u.username}
                          <CopyButton value={u.username} />
                        </span>
                      ) : u.email ? (
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={role => updateRoleMutation.mutate({ id: u.id, role: role as "admin" | "technicien" | "client" })}
                      >
                        <SelectTrigger className="h-7 w-32 border-0 bg-transparent p-0 focus:ring-0 shadow-none">
                          <Badge className={`border ${ROLE_TONE[u.role] ?? ROLE_TONE.client} cursor-pointer`}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="technicien">Technicien</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      {u.accountStatus === "suspended" ? (
                        <Badge className="border border-rose-200 bg-rose-50 text-rose-700">Suspendu</Badge>
                      ) : (
                        <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">Actif</Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">{fmtDate(u.lastSignedIn)}</TableCell>

                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditUserDialog user={u} onDone={() => {}} />
                        <button
                          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
                          title={u.accountStatus === "suspended" ? "Activer" : "Suspendre"}
                          onClick={() => toggleStatusMutation.mutate({
                            id: u.id,
                            accountStatus: u.accountStatus === "suspended" ? "active" : "suspended",
                          })}
                        >
                          {u.accountStatus === "suspended"
                            ? <><UserCheck className="h-3.5 w-3.5" /> Activer</>
                            : <><UserX className="h-3.5 w-3.5" /> Suspendre</>
                          }
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
