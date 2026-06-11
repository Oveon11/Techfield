import DashboardLayout from "@/components/DashboardLayout";
import {
  SharedProjectForm,
  SharedProjectFormState,
  INITIAL_SHARED_FORM,
  PROJECT_STATUS_OPTIONS,
  STATIC_SERVICE_OPTIONS,
  PROJECT_COLORS,
  type ProjectStatus,
} from "./ProjectFormUnified";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  Clock,
  FileDown,
  FileText,
  ImageIcon,
  Info,
  LayoutDashboard,
  MapPin,
  MapPinned,
  Phone,
  MoreVertical,
  Newspaper,
  Pencil,
  Search,
  Settings,
  ShieldCheck,
  StickyNote,
  Trash2,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import {
  ProjectActivityFeedPanel,
  ProjectDocumentsPanel,
  ProjectJournalPanel,
  ProjectMediaPanel,
  ProjectMemosPanel,
} from "./ProjectDetailTabs";

function AppShell({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function SectionGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 xl:grid-cols-12">{children}</div>;
}

function SurfaceCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <Card className={`border-white/10 shadow-sm shadow-slate-950/5 ${className}`}>{children}</Card>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function MetricCard({ title, value, hint, icon }: { title: string; value: string | number; hint: string; icon: ReactNode }) {
  return (
    <SurfaceCard className="xl:col-span-4">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-2 text-3xl font-semibold tracking-tight">{value}</CardTitle>
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </SurfaceCard>
  );
}

const STATUS_CONFIG: Record<string, { tone: string; display: string }> = {
  planifie:  { tone: "bg-amber-500/10 text-amber-700 border-amber-200", display: "Planifié" },
  en_cours:  { tone: "bg-emerald-500/10 text-emerald-700 border-emerald-200", display: "En cours" },
  termine:   { tone: "bg-emerald-500/10 text-emerald-700 border-emerald-200", display: "Terminé" },
  bloque:    { tone: "bg-rose-500/10 text-rose-700 border-rose-200", display: "Bloqué" },
  brouillon: { tone: "bg-slate-500/10 text-slate-600 border-slate-200", display: "Brouillon" },
  annule:    { tone: "bg-slate-500/10 text-slate-600 border-slate-200", display: "Annulé" },
  actif:     { tone: "bg-emerald-500/10 text-emerald-700 border-emerald-200", display: "Actif" },
  archive:   { tone: "bg-slate-200/80 text-slate-500 border-slate-300", display: "Archivé" },
};

const SERVICE_BORDER: Record<string, string> = {
  clim:        "border-l-blue-400",
  pac:         "border-l-red-400",
  pv:          "border-l-amber-400",
  vmc:         "border-l-green-400",
  chauffe_eau: "border-l-orange-400",
};
function serviceBorder(type: string) { return SERVICE_BORDER[type] ?? "border-l-slate-300"; }

function StatusBadge({ value }: { value: string | null | undefined }) {
  const key = value ?? "";
  const { tone, display } = STATUS_CONFIG[key] ?? { tone: "bg-slate-500/10 text-slate-600 border-slate-200", display: key.replaceAll("_", " ") };
  return <Badge className={`border ${tone}`}>{display}</Badge>;
}

const SERVICE_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue:   { bg: "bg-blue-100", text: "text-blue-700" },
  red:    { bg: "bg-red-100", text: "text-red-700" },
  orange: { bg: "bg-orange-100", text: "text-orange-700" },
  yellow: { bg: "bg-amber-100", text: "text-amber-700" },
  green:  { bg: "bg-green-100", text: "text-green-700" },
  cyan:   { bg: "bg-cyan-100", text: "text-cyan-700" },
  violet: { bg: "bg-violet-100", text: "text-violet-700" },
  slate:  { bg: "bg-slate-100", text: "text-slate-600" },
};

const STATIC_SERVICE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  clim:       { bg: "bg-blue-100", text: "text-blue-700", label: "CLIM" },
  pac:        { bg: "bg-red-100", text: "text-red-700", label: "PAC" },
  pv:         { bg: "bg-amber-100", text: "text-amber-700", label: "PV" },
  vmc:        { bg: "bg-green-100", text: "text-green-700", label: "VMC" },
  chauffe_eau:{ bg: "bg-orange-100", text: "text-orange-700", label: "CE" },
};

function getServiceStyle(type: string, dynamicTypes?: Array<{ code: string; label: string; color: string }>): { bg: string; text: string; label: string } {
  if (dynamicTypes) {
    const found = dynamicTypes.find(t => t.code === type);
    if (found) {
      const colors = SERVICE_COLOR_MAP[found.color] ?? SERVICE_COLOR_MAP.slate;
      return { bg: colors.bg, text: colors.text, label: found.label.toUpperCase() };
    }
  }
  return STATIC_SERVICE_STYLE[type] ?? { bg: "bg-slate-100", text: "text-slate-600", label: (type ?? "AUTRE").toUpperCase() };
}

function ServiceTypePill({ type, dynamicTypes }: { type: string; dynamicTypes?: Array<{ code: string; label: string; color: string }> }) {
  const { bg, text, label } = getServiceStyle(type, dynamicTypes);
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[10px] font-bold tracking-widest ${bg} ${text}`}>
      {label}
    </span>
  );
}

function useRoleMatrix() {
  const auth = trpc.auth.me.useQuery();
  const matrix = trpc.security.roleMatrix.useQuery(undefined, { enabled: !!auth.data });
  return {
    user: auth.data,
    permissions: matrix.data?.permissions,
    role: matrix.data?.role ?? auth.data?.role,
  };
}

function useInvalidateAfterSuccess() {
  const utils = trpc.useUtils();
  return async () => {
    await Promise.all([
      utils.management.dashboard.summary.invalidate(),
      utils.management.clients.list.invalidate(),
      utils.management.sites.list.invalidate(),
      utils.management.technicians.list.invalidate(),
      utils.management.projects.list.invalidate(),
      utils.management.contracts.list.invalidate(),
      utils.management.interventions.list.invalidate(),
      utils.management.calendar.events.invalidate(),
    ]);
  };
}

export function DashboardPage() {
  const { role } = useRoleMatrix();
  const summary = trpc.management.dashboard.summary.useQuery();

  if (role === "technicien") {
    return <FeedPage />;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Pilotage d'activité"
        />

        {(summary.data?.blockedProjects?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-700">
                {summary.data!.blockedProjects!.length} chantier{summary.data!.blockedProjects!.length > 1 ? "s" : ""} bloqué{summary.data!.blockedProjects!.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="space-y-2">
              {summary.data!.blockedProjects!.map(p => (
                <Link key={p.id} href={`/chantiers/${p.id}`}>
                  <div className="flex flex-col gap-1 rounded-xl border border-amber-100 bg-white px-4 py-3 hover:bg-amber-50 transition-colors cursor-pointer sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <ServiceTypePill type={p.serviceType} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.reference}</p>
                      </div>
                    </div>
                    <span className="text-xs text-amber-700 font-medium shrink-0 sm:ml-2">{p.clientName}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(summary.data?.overdueProjects?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <p className="text-sm font-semibold text-rose-700">
                {summary.data!.overdueProjects!.length} chantier{summary.data!.overdueProjects!.length > 1 ? "s" : ""} en retard
              </p>
            </div>
            <div className="space-y-2">
              {summary.data!.overdueProjects!.map(p => (
                <Link key={p.id} href={`/chantiers/${p.id}`}>
                  <div className="flex flex-col gap-1 rounded-xl border border-rose-100 bg-white px-4 py-3 hover:bg-rose-50 transition-colors cursor-pointer sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <ServiceTypePill type={p.serviceType} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.reference}</p>
                      </div>
                    </div>
                    <span className="text-xs text-rose-600 font-medium shrink-0 sm:ml-2">
                      Échéance dépassée le {new Date(p.plannedEndDate).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <SectionGrid>
          <MetricCard
            title="Chantiers en cours"
            value={summary.data?.cards.projectsInProgress ?? 0}
            hint="Nombre de chantiers actifs actuellement suivis dans la plateforme."
            icon={<BriefcaseBusiness className="h-5 w-5" />}
          />
          <MetricCard
            title="Interventions à venir"
            value={summary.data?.cards.upcomingInterventions ?? 0}
            hint="Volume d'interventions planifiées dans les prochains créneaux."
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <MetricCard
            title="Contrats proches d'expiration"
            value={summary.data?.cards.expiringContracts ?? 0}
            hint="Contrats nécessitant une action de renouvellement ou de relance."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </SectionGrid>

        <SectionGrid>
          <SurfaceCard className="xl:col-span-7">
            <CardHeader>
              <CardTitle>Interventions imminentes</CardTitle>
              <CardDescription>Les prochaines opérations planifiées à suivre en priorité.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.data?.upcomingInterventions?.length ? (
                summary.data.upcomingInterventions.map(item => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.reference}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge value={item.status} />
                      <span className="text-sm text-muted-foreground">
                        {item.scheduledStartAt ? new Date(item.scheduledStartAt).toLocaleString() : "Date non planifiée"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="Aucune intervention à venir" description="Le planning ne contient pas encore d'interventions futures visibles pour ce profil." />
              )}
            </CardContent>
          </SurfaceCard>

          <SurfaceCard className="xl:col-span-5">
            <CardHeader>
              <CardTitle>Échéances contrats</CardTitle>
              <CardDescription>Contrats à surveiller sur l'horizon des 30 prochains jours.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.data?.expiringContracts?.length ? (
                summary.data.expiringContracts.map(item => (
                  <div key={item.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.contractNumber}</p>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Expiration prévue le {item.endDate ? new Date(item.endDate).toLocaleDateString() : "non renseigné"}.
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState title="Aucune échéance proche" description="Aucun contrat n’arrive à expiration prochainement dans votre périmètre visible." />
              )}
            </CardContent>
          </SurfaceCard>
        </SectionGrid>

        <SurfaceCard>
          <CardHeader>
            <CardTitle>Positionnement de l'utilisateur</CardTitle>
            <CardDescription>Les droits et la visibilité applicative sont pilotés par le rôle connecté.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-primary/20 bg-primary/10 text-primary">Rôle actif: {role ?? "inconnu"}</Badge>
              <p className="text-sm text-muted-foreground">
                Les écrans d’administration permettent la création et l’organisation des données, tandis que les profils technicien et client bénéficient d’un accès ciblé sur leurs opérations et documents.
              </p>
            </div>
          </CardContent>
        </SurfaceCard>
      </div>
    </AppShell>
  );
}

export function ClientsPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const clientsQuery = trpc.management.clients.list.useQuery();
  const createClient = trpc.management.clients.create.useMutation({
    onSuccess: async () => {
      toast.success("Client créé avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const contactsQuery = trpc.management.clients.contacts.list.useQuery();
  const createContact = trpc.management.clients.contacts.create.useMutation({
    onSuccess: async () => {
      toast.success("Contact client créé avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState<{
    companyName: string;
    legalName: string;
    customerType: "particulier" | "professionnel" | "collectivite";
    email: string;
    phone: string;
    billingAddress: string;
    city: string;
    postalCode: string;
    notes: string;
  }>({
    companyName: "",
    legalName: "",
    customerType: "professionnel",
    email: "",
    phone: "",
    billingAddress: "",
    city: "",
    postalCode: "",
    notes: "",
  });
  const [contactForm, setContactForm] = useState<{
    clientId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    jobTitle: string;
    contactType: "principal" | "facturation" | "technique" | "administratif" | "autre";
    isPrimary: boolean;
  }>({
    clientId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    contactType: "principal",
    isPrimary: false,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Clients"
          action={
            permissions?.manageClients ? (
              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Ajouter un contact</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Nouveau contact client</DialogTitle>
                      <DialogDescription>Rattachez un interlocuteur métier ou administratif à un client existant.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Client</Label>
                        <Select value={contactForm.clientId} onValueChange={value => setContactForm(prev => ({ ...prev, clientId: value }))}>
                          <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                          <SelectContent>
                            {clientsQuery.data?.map(client => <SelectItem key={client.id} value={String(client.id)}>{client.companyName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Prénom</Label>
                        <Input value={contactForm.firstName} onChange={e => setContactForm(prev => ({ ...prev, firstName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input value={contactForm.lastName} onChange={e => setContactForm(prev => ({ ...prev, lastName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={contactForm.email} onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input value={contactForm.phone} onChange={e => setContactForm(prev => ({ ...prev, phone: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fonction</Label>
                        <Input value={contactForm.jobTitle} onChange={e => setContactForm(prev => ({ ...prev, jobTitle: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={contactForm.contactType} onValueChange={value => setContactForm(prev => ({ ...prev, contactType: value as typeof prev.contactType }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="principal">Principal</SelectItem>
                            <SelectItem value="facturation">Facturation</SelectItem>
                            <SelectItem value="technique">Technique</SelectItem>
                            <SelectItem value="administratif">Administratif</SelectItem>
                            <SelectItem value="autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createContact.mutate({
                          clientId: Number(contactForm.clientId),
                          firstName: contactForm.firstName,
                          lastName: contactForm.lastName,
                          email: contactForm.email,
                          phone: contactForm.phone,
                          jobTitle: contactForm.jobTitle,
                          contactType: contactForm.contactType,
                          isPrimary: contactForm.isPrimary,
                        })}
                        disabled={createContact.isPending || !contactForm.clientId || !contactForm.firstName.trim() || !contactForm.lastName.trim()}
                      >
                        Enregistrer le contact
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button>Ajouter un client</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Nouveau client</DialogTitle>
                      <DialogDescription>Créez une fiche client prête à être reliée à ses sites, chantiers et contrats.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Nom de l'entreprise</Label>
                        <Input value={form.companyName} onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Raison sociale</Label>
                        <Input value={form.legalName} onChange={e => setForm(prev => ({ ...prev, legalName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Type de client</Label>
                        <Select value={form.customerType} onValueChange={value => setForm(prev => ({ ...prev, customerType: value as typeof form.customerType }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professionnel">Professionnel</SelectItem>
                            <SelectItem value="particulier">Particulier</SelectItem>
                            <SelectItem value="collectivite">Collectivité</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Adresse de facturation</Label>
                        <Textarea value={form.billingAddress} onChange={e => setForm(prev => ({ ...prev, billingAddress: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Ville</Label>
                        <Input value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Code postal</Label>
                        <Input value={form.postalCode} onChange={e => setForm(prev => ({ ...prev, postalCode: e.target.value }))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createClient.mutate(form)}
                        disabled={createClient.isPending || !form.companyName.trim()}
                      >
                        Enregistrer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : null
          }
        />

        <SectionGrid>
          <SurfaceCard className="xl:col-span-7">
            <CardContent className="pt-6">
              {clientsQuery.data?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsQuery.data.map(client => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{client.companyName}</p>
                            <p className="text-xs text-muted-foreground">{client.legalName || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{client.customerType}</TableCell>
                        <TableCell>{client.city || "—"}</TableCell>
                        <TableCell>{client.email || client.phone || "—"}</TableCell>
                        <TableCell><StatusBadge value={client.isActive ? "actif" : "inactif"} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="Aucun client enregistré" description="Commencez par créer une base clients pour structurer les sites, chantiers et contrats rattachés." />
              )}
            </CardContent>
          </SurfaceCard>

          <SurfaceCard className="xl:col-span-5">
            <CardHeader>
              <CardTitle>Contacts clients</CardTitle>
              <CardDescription>Interlocuteurs opérationnels, techniques ou administratifs rattachés aux comptes clients.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contactsQuery.data?.length ? (
                contactsQuery.data.map(contact => (
                  <div key={contact.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{contact.firstName} {contact.lastName}</p>
                        <p className="text-sm text-muted-foreground">{contact.clientName}</p>
                      </div>
                      <StatusBadge value={contact.contactType} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{contact.jobTitle || "Fonction non renseignée"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{contact.email || contact.phone || "Coordonnées non renseignées"}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="Aucun contact client" description="Ajoutez les interlocuteurs de vos clients pour fiabiliser les échanges liés aux contrats, sites et interventions." />
              )}
            </CardContent>
          </SurfaceCard>
        </SectionGrid>
      </div>
    </AppShell>
  );
}

export function SitesPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const sitesQuery = trpc.management.sites.list.useQuery();
  const clientsQuery = trpc.management.clients.list.useQuery();
  const createSite = trpc.management.sites.create.useMutation({
    onSuccess: async () => {
      toast.success("Site créé avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState({
    clientId: "",
    siteName: "",
    siteCode: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postalCode: "",
    country: "France",
    accessInstructions: "",
    notes: "",
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Sites"
          action={
            permissions?.manageSites ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Ajouter un site</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Nouveau site</DialogTitle>
                    <DialogDescription>Ajoutez un site d’intervention opérationnel et immédiatement exploitable.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Client</Label>
                      <Select value={form.clientId} onValueChange={value => setForm(prev => ({ ...prev, clientId: value }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                        <SelectContent>
                          {clientsQuery.data?.map(client => (
                            <SelectItem key={client.id} value={String(client.id)}>{client.companyName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nom du site</Label>
                      <Input value={form.siteName} onChange={e => setForm(prev => ({ ...prev, siteName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Code site</Label>
                      <Input value={form.siteCode} onChange={e => setForm(prev => ({ ...prev, siteCode: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Adresse</Label>
                      <Input value={form.addressLine1} onChange={e => setForm(prev => ({ ...prev, addressLine1: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Complément</Label>
                      <Input value={form.addressLine2} onChange={e => setForm(prev => ({ ...prev, addressLine2: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ville</Label>
                      <Input value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Code postal</Label>
                      <Input value={form.postalCode} onChange={e => setForm(prev => ({ ...prev, postalCode: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Consignes d'accès</Label>
                      <Textarea value={form.accessInstructions} onChange={e => setForm(prev => ({ ...prev, accessInstructions: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createSite.mutate({ ...form, clientId: Number(form.clientId) })}
                      disabled={createSite.isPending || !form.clientId || !form.siteName.trim() || !form.addressLine1.trim() || !form.city.trim()}
                    >
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sitesQuery.data?.length ? (
            sitesQuery.data.map(site => (
              <SurfaceCard key={site.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{site.siteName}</CardTitle>
                  <CardDescription>{site.clientName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><MapPinned className="h-4 w-4" /> {site.city} {site.postalCode || ""}</p>
                  <p>Code site: {site.siteCode || "—"}</p>
                  <StatusBadge value={site.isActive ? "actif" : "inactif"} />
                </CardContent>
              </SurfaceCard>
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="Aucun site créé" description="Les sites permettront de lier précisément les chantiers, contrats et interventions aux lieux d’exécution." />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

type ProjectServiceType = string;

type ProjectFormState = SharedProjectFormState & {
  clientId: string;
  siteId: string;
  actualHours: string;
  budgetAmount: string;
  progressPercent: number;
};

const INITIAL_PROJECT_FORM: ProjectFormState = {
  ...INITIAL_SHARED_FORM,
  clientId: "",
  siteId: "",
  actualHours: "0.00",
  budgetAmount: "0.00",
  progressPercent: 0,
};

type CreateWithClientFormState = SharedProjectFormState;

const INITIAL_CREATE_FORM: CreateWithClientFormState = { ...INITIAL_SHARED_FORM };



export function ProjectsPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const projectsQuery = trpc.management.projects.list.useQuery();
  const clientsQuery = trpc.management.clients.list.useQuery();
  const sitesQuery = trpc.management.sites.list.useQuery();
  const techniciansQuery = trpc.management.technicians.list.useQuery(undefined, { enabled: !!permissions?.manageTechnicians });

  const createWithClient = trpc.management.projects.createWithClient.useMutation({
    onSuccess: async () => {
      toast.success("Chantier créé avec succès.");
      setCreateOpen(false);
      setCreateForm(INITIAL_CREATE_FORM);
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const updateProject = trpc.management.projects.update.useMutation({
    onSuccess: async () => {
      toast.success("Chantier mis à jour.");
      setEditingId(null);
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const deleteProject = trpc.management.projects.delete.useMutation({
    onSuccess: async () => {
      toast.success("Chantier supprimé.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const archiveProject = trpc.management.projects.updateStatus.useMutation({
    onSuccess: async () => { toast.success("Chantier archivé."); await invalidateAll(); },
    onError: e => toast.error(e.message),
  });
  const unarchiveProject = trpc.management.projects.updateStatus.useMutation({
    onSuccess: async () => { toast.success("Chantier réactivé."); await invalidateAll(); },
    onError: e => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<CreateWithClientFormState>(INITIAL_CREATE_FORM);
  const [editForm, setEditForm] = useState<ProjectFormState>(INITIAL_PROJECT_FORM);
  const [dupConfirmOpen, setDupConfirmOpen] = useState(false);

  // Pré-remplissage depuis le planning (bouton "Créer le chantier" d'un slot libre)
  useEffect(() => {
    const raw = sessionStorage.getItem("tf-prefill-chantier");
    if (!raw) return;
    sessionStorage.removeItem("tf-prefill-chantier");
    try {
      const prefill = JSON.parse(raw) as {clientName?:string;clientPhone?:string;clientAddress?:string};
      setCreateForm(f => ({ ...f, clientName: prefill.clientName??f.clientName, phone: prefill.clientPhone??f.phone, address: prefill.clientAddress??f.address }));
      setCreateOpen(true);
    } catch {}
  }, []);
  const [search, setSearch] = useState("");
  const [archiveTab, setArchiveTab] = useState<"actifs" | "archives">("actifs");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [serviceFilter, setServiceFilter] = useState<"all" | ProjectServiceType>("all");

  const doCreateWithClient = () => createWithClient.mutate({
    clientName: createForm.clientName,
    clientPhone: createForm.phone || null,
    clientAddress: createForm.address || null,
    title: createForm.title,
    serviceType: createForm.serviceType,
    description: createForm.description || null,
    status: createForm.status,
    progressPercent: 0,
    estimatedHours: createForm.estimatedHours,
    actualHours: "0.00",
    budgetAmount: "0.00",
    startDate: createForm.startDate || null,
    plannedEndDate: createForm.plannedEndDate || null,
    quoteNumber: createForm.quoteNumber || null,
    technicianIds: createForm.technicianIds,
    color: createForm.color || null,
  });

  const handleCreateProject = () => {
    const titleLow = createForm.title.trim().toLowerCase();
    const clientLow = createForm.clientName.trim().toLowerCase();
    const isDuplicate = (projectsQuery.data ?? []).some(
      p => p.title.trim().toLowerCase() === titleLow && (p.clientName ?? "").trim().toLowerCase() === clientLow
    );
    if (isDuplicate) { setDupConfirmOpen(true); return; }
    doCreateWithClient();
  };

  const projectDetailQuery = trpc.management.projects.getById.useQuery(
    { projectId: editingId ?? 0 },
    { enabled: editingId !== null },
  );

  // Hydrate edit form when detail query lands
  useMemo(() => {
    const detail = projectDetailQuery.data;
    if (!detail || editingId === null) return;
    setEditForm({
      clientId: String(detail.clientId ?? ""),
      clientName: (detail as {clientName?:string|null}).clientName ?? "",
      siteId: detail.siteId ? String(detail.siteId) : "",
      title: detail.title ?? "",
      serviceType: detail.serviceType ?? "autre",
      description: detail.description ?? "",
      status: (detail.status ?? "planifie") as ProjectStatus,
      progressPercent: Number(detail.progressPercent ?? 0),
      estimatedHours: String(detail.estimatedHours ?? "0.00"),
      actualHours: String(detail.actualHours ?? "0.00"),
      budgetAmount: String(detail.budgetAmount ?? "0.00"),
      startDate: detail.startDate ? new Date(detail.startDate).toISOString().slice(0, 10) : "",
      plannedEndDate: detail.plannedEndDate ? new Date(detail.plannedEndDate).toISOString().slice(0, 10) : "",
      quoteNumber: detail.quoteNumber ?? "",
      technicianIds: detail.technicianIds ?? [],
      color: detail.color ?? "",
      address: (detail as {address?:string|null}).address ?? "",
      phone: (detail as {phone?:string|null}).phone ?? "",
    });
  }, [projectDetailQuery.data, editingId]);

  const filteredProjects = useMemo(() => {
    const list = projectsQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    return list.filter(project => {
      if (archiveTab === "archives") return project.status === "archive";
      if (project.status === "archive") return false;
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (serviceFilter !== "all" && project.serviceType !== serviceFilter) return false;
      if (!needle) return true;
      const haystack = [project.title, project.reference, project.clientName, project.siteName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [projectsQuery.data, search, statusFilter, serviceFilter, archiveTab]);

  const clients = clientsQuery.data ?? [];
  const sites = sitesQuery.data ?? [];
  const technicians = techniciansQuery.data ?? [];
  const canManage = !!permissions?.manageProjects;
  const canCreate = canManage || !!permissions?.createProjects;

  const archivedCount = (projectsQuery.data ?? []).filter(p => p.status === "archive").length;
  const activeCount = (projectsQuery.data ?? []).filter(p => p.status !== "archive").length;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Chantiers"
          action={
            canCreate ? (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>Nouveau chantier</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90dvh]">
                  <DialogHeader>
                    <DialogTitle>Nouveau chantier</DialogTitle>
                    <DialogDescription>Renseignez les informations client et les détails du chantier.</DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-2">
                    <SharedProjectForm
                      form={createForm}
                      onChange={updates => setCreateForm(prev => ({ ...prev, ...updates }))}
                      technicians={technicians}
                      showColor={true}
                    />
                  </div>
                  <DialogFooter className="pt-2 border-t border-border/60">
                    <Button
                      onClick={handleCreateProject}
                      disabled={createWithClient.isPending || !createForm.clientName.trim() || !createForm.title.trim()}
                    >
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        {/* AlertDialog doublon */}
        <AlertDialog open={dupConfirmOpen} onOpenChange={setDupConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Doublon détecté
              </AlertDialogTitle>
              <AlertDialogDescription>
                Un chantier intitulé <strong>« {createForm.title} »</strong> pour le client <strong>« {createForm.clientName} »</strong> existe déjà. Créer quand même ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setDupConfirmOpen(false); doCreateWithClient(); }}>
                Créer quand même
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Archive tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setArchiveTab("actifs")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${archiveTab === "actifs" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <BriefcaseBusiness className="h-4 w-4" />
            Actifs
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${archiveTab === "actifs" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{activeCount}</span>
          </button>
          <button
            onClick={() => setArchiveTab("archives")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${archiveTab === "archives" ? "bg-slate-700 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <Archive className="h-4 w-4" />
            Archives
            {archivedCount > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${archiveTab === "archives" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{archivedCount}</span>}
          </button>
        </div>

        <SurfaceCard>
          <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par intitulé, référence, client ou site…"
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={value => setStatusFilter(value as "all" | ProjectStatus)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {PROJECT_STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={serviceFilter} onValueChange={value => setServiceFilter(value as "all" | ProjectServiceType)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les services</SelectItem>
                  {STATIC_SERVICE_OPTIONS.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </SurfaceCard>

        <div className="grid gap-4 xl:grid-cols-2">
          {filteredProjects.length ? (
            filteredProjects.map(project => (
              <div key={project.id} className={`flex flex-col gap-3 rounded-2xl border border-slate-100 border-l-4 ${serviceBorder(project.serviceType)} bg-white p-5 shadow-sm transition-all hover:border-slate-200 hover:shadow-md`}>
                {/* Hidden dialogs — triggered by state */}
                {canManage && (
                  <>
                    <Dialog open={editingId === project.id} onOpenChange={open => setEditingId(open ? project.id : null)}>
                      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Modifier le chantier</DialogTitle>
                          <DialogDescription>{project.reference} · {project.clientName}</DialogDescription>
                        </DialogHeader>
                        {projectDetailQuery.isLoading && editingId === project.id ? (
                          <p className="py-6 text-sm text-muted-foreground">Chargement…</p>
                        ) : (
                          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-180px)] px-1">
                            <SharedProjectForm
                              form={editForm}
                              onChange={updates => setEditForm(prev => ({ ...prev, ...updates }))}
                              technicians={technicians}
                              showColor={true}
                            />
                            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                              <div className="space-y-2">
                                <Label>Budget (€)</Label>
                                <Input value={editForm.budgetAmount} onChange={e => setEditForm(prev => ({ ...prev, budgetAmount: e.target.value }))} placeholder="0.00" />
                              </div>
                              <div className="space-y-2">
                                <Label>Avancement (%)</Label>
                                <Input type="number" min={0} max={100} value={editForm.progressPercent} onChange={e => setEditForm(prev => ({ ...prev, progressPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
                              </div>
                              <div className="space-y-2">
                                <Label>Heures réelles</Label>
                                <Input value={editForm.actualHours} onChange={e => setEditForm(prev => ({ ...prev, actualHours: e.target.value }))} placeholder="0.00" />
                              </div>
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <Button
                            onClick={() => updateProject.mutate({
                              ...editForm,
                              projectId: project.id,
                              clientId: Number(editForm.clientId),
                              clientName: editForm.clientName || null,
                              siteId: editForm.siteId ? Number(editForm.siteId) : null,
                              quoteNumber: editForm.quoteNumber || null,
                              color: editForm.color || null,
                            })}
                            disabled={updateProject.isPending || !editForm.clientId || !editForm.title.trim()}
                          >
                            Enregistrer les modifications
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog open={deletingId === project.id} onOpenChange={open => setDeletingId(open ? project.id : null)}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce chantier ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Le chantier « {project.title} » sera supprimé définitivement. Ses affectations seront retirées et les interventions associées seront détachées. Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteProject.mutate({ projectId: project.id })}
                            className="bg-rose-600 text-white hover:bg-rose-700"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}

                {/* Top row: service badge + CLIENT NAME + admin dropdown */}
                <div className="flex items-start gap-3">
                  <ServiceTypePill type={project.serviceType} />
                  <p className="min-w-0 flex-1 font-semibold leading-snug text-foreground">{project.clientName}</p>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="-mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {archiveTab === "actifs" && (
                          <DropdownMenuItem onSelect={() => setEditingId(project.id)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Éditer
                          </DropdownMenuItem>
                        )}
                        {archiveTab === "actifs" ? (
                          <DropdownMenuItem onSelect={() => archiveProject.mutate({ projectId: project.id, status: "archive", progressPercent: project.progressPercent ?? 0 })}>
                            <Archive className="mr-2 h-4 w-4" />
                            Archiver
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => unarchiveProject.mutate({ projectId: project.id, status: "planifie", progressPercent: project.progressPercent ?? 0 })}>
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            Réactiver
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setDeletingId(project.id)} className="text-rose-600 focus:text-rose-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Info row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 shrink-0" />
                    {project.title}
                  </span>
                  {project.siteName ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {project.siteName}
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-400">{project.reference}</span>
                </div>

                {/* Bottom row: status + open button */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge value={project.status} />
                    {project.plannedEndDate && project.status === "en_cours" && new Date(project.plannedEndDate) < new Date() && (
                      <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                        <AlertTriangle className="h-3 w-3" /> Retard
                      </span>
                    )}
                  </div>
                  <Link href={`/chantiers/${project.id}`}>
                    <Button size="sm" className="bg-primary font-semibold text-white shadow-sm shadow-primary/30 hover:bg-primary/90">
                      Voir
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="xl:col-span-2">
              <EmptyState
                title={projectsQuery.data?.length ? "Aucun chantier ne correspond aux filtres" : "Aucun chantier enregistré"}
                description={projectsQuery.data?.length
                  ? "Ajustez la recherche, le statut ou le type de service pour afficher davantage de chantiers."
                  : "Les chantiers créés ici alimenteront le suivi d’avancement, l’affectation d’équipe et l’historique opérationnel."}
              />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

interface FinDeChantierProject {
  id: number;
  reference: string;
  title: string;
  clientName: string;
  siteName: string | null;
  serviceType: string;
  status: string;
  startDate: Date | string | null;
  plannedEndDate: Date | string | null;
  actualEndDate: Date | string | null;
  actualEndAt: Date | string | null;
  quoteNumber: string | null;
  progressPercent: number;
  estimatedHours: string;
  actualHours: string;
  description: string | null;
  assignedTechnicianNames?: string[];
}

function generateFinDeChantierPDF(
  project: FinDeChantierProject,
  avecReserve: boolean,
  reserveText: string,
  reservePhotos: string[],
  serviceLabel: string,
  statusLabel: string,
  signatureDataUrl: string | null,
  logoInfo: { dataUrl: string; ratio: number } | null,
  clientSignatureDataUrl: string | null,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 18;
  const colRight = pageW - margin;
  let y = 0;

  const fmt = (d: Date | string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-FR");
  };

  // ── Header band ──
  const headerH = 36;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(0, headerH, pageW, headerH);

  // Logo OVEON (left)
  const logoY = 4;
  const logoH = 26;
  if (logoInfo) {
    const logoW = logoH * logoInfo.ratio;
    doc.addImage(logoInfo.dataUrl, "PNG", margin, logoY, logoW, logoH);
  } else {
    // Fallback text
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 65, 81);
    doc.text("OVEON", margin, logoY + 18);
  }

  // Title block (right side)
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("PV DE RÉCEPTION", colRight, logoY + 10, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, colRight, logoY + 17, { align: "right" });
  doc.text(`Réf. ${project.reference}`, colRight, logoY + 23, { align: "right" });

  y = headerH + 10;

  // Helper: section title
  const sectionTitle = (label: string) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 5, pageW - margin * 2, 9, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), margin + 2, y + 0.5);
    y += 8;
  };

  // Helper: key-value row
  const kv = (key: string, value: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(key, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(value, margin + 48, y);
    y += 7;
  };

  // Divider
  const divider = () => {
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y - 1, colRight, y - 1);
    y += 4;
  };

  // ── Section CHANTIER ──
  sectionTitle("Informations chantier");
  y += 2;
  kv("Référence", project.reference);
  if (project.quoteNumber) kv("N° de devis", project.quoteNumber);
  kv("Intitulé", project.title);
  kv("Client", project.clientName);
  kv("Site", project.siteName ?? "—");
  kv("Type de service", serviceLabel);
  kv("Statut", statusLabel);
  kv("Heures estimées", `${Number(project.estimatedHours).toFixed(0)} h`);
  kv("Date de début", fmt(project.startDate));
  kv("Date de fin", project.actualEndAt ? new Date(project.actualEndAt).toLocaleString("fr-FR") : fmt(project.plannedEndDate));
  divider();

  // Description
  if (project.description) {
    sectionTitle("Description");
    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(project.description, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += (lines as string[]).length * 5 + 3;
    divider();
  }

  // ── Section TECHNICIENS ──
  sectionTitle("Techniciens assignés");
  y += 2;
  const names = project.assignedTechnicianNames ?? [];
  if (names.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("Aucun technicien assigné", margin, y);
    y += 7;
  } else {
    names.forEach((name, i) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`${i + 1}.  ${name}`, margin + 4, y);
      y += 6;
    });
    y += 2;
  }
  divider();

  // ── Section RÉSERVES ──
  if (avecReserve) {
    sectionTitle("Réserves");
    y += 2;
    if (reserveText.trim()) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(reserveText.trim(), pageW - margin * 2);
      doc.text(lines, margin, y);
      y += (lines as string[]).length * 5 + 5;
    } else {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 116, 139);
      doc.text("Aucune réserve notée.", margin, y);
      y += 7;
    }
    // Photos des réserves (2 par ligne)
    if (reservePhotos.length > 0) {
      const imgW = (pageW - margin * 2 - 6) / 2;
      const imgH = imgW * 0.7;
      reservePhotos.forEach((dataUrl, i) => {
        const col = i % 2;
        if (col === 0 && i > 0) y += imgH + 4;
        const x = margin + col * (imgW + 6);
        // new page if needed
        if (y + imgH > 270) { doc.addPage(); y = 20; }
        doc.addImage(dataUrl, "JPEG", x, y, imgW, imgH);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, y, imgW, imgH, "S");
      });
      y += imgH + 6;
    }
    divider();
  } else {
    sectionTitle("Sans réserve");
    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text("Les travaux ont été réalisés sans réserve.", margin, y);
    y += 10;
    divider();
  }

  // ── Signature zone ──
  y += 4;
  const sigBoxW = 78;
  const sigBoxH = 28;
  const sigClientX = margin;
  const sigSocX = pageW / 2 + 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Signature du client :", sigClientX, y);
  doc.text("Signature société :", sigSocX, y);
  y += 3;

  // Boxes
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(sigClientX, y, sigBoxW, sigBoxH, 2, 2, "S");
  doc.roundedRect(sigSocX, y, sigBoxW, sigBoxH, 2, 2, "S");

  // Embed client signature if provided
  if (clientSignatureDataUrl) {
    doc.addImage(clientSignatureDataUrl, "PNG", sigClientX + 2, y + 2, sigBoxW - 4, sigBoxH - 4);
  }
  // Embed company signature if provided
  if (signatureDataUrl) {
    doc.addImage(signatureDataUrl, "PNG", sigSocX + 2, y + 2, sigBoxW - 4, sigBoxH - 4);
  }

  y += sigBoxH + 4;

  // Date fields under signatures
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Date : ____/____/________`, sigClientX, y);
  doc.text(`Date : ${new Date().toLocaleDateString("fr-FR")}`, sigSocX, y);

  // Footer
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(148, 163, 184);
  doc.text(`Document généré par Techfield · ${project.reference}`, pageW / 2, 291, { align: "center" });

  doc.save(`pv-reception-${project.reference}.pdf`);
  return doc.output("blob");
}

function SignaturePad({ onchange, label = "Signature société" }: { onchange: (dataUrl: string | null) => void; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStrokes = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes.current = true;
  };

  const endDraw = () => {
    drawing.current = false;
    if (hasStrokes.current && canvasRef.current) {
      onchange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onchange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <button type="button" onClick={clear} className="text-xs text-muted-foreground underline hover:text-foreground">
          Effacer
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        className="w-full rounded-lg border border-border bg-slate-50 touch-none cursor-crosshair"
        style={{ height: "100px" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <p className="text-xs text-muted-foreground">Dessinez votre signature dans la zone ci-dessus</p>
    </div>
  );
}

function FinDeChantierDialog({ project, serviceLabel, statusLabel }: {
  project: FinDeChantierProject;
  serviceLabel: string;
  statusLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [avecReserve, setAvecReserve] = useState(false);
  const [reserveText, setReserveText] = useState("");
  const [reservePhotos, setReservePhotos] = useState<string[]>([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [clientSignatureDataUrl, setClientSignatureDataUrl] = useState<string | null>(null);
  const [logoInfo, setLogoInfo] = useState<{ dataUrl: string; ratio: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const createUploadUrl = trpc.management.projectDocuments.createUploadUrl.useMutation();
  const registerDoc = trpc.management.projectDocuments.register.useMutation();

  // Preload OVEON logo once — conserve le vrai ratio
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      setLogoInfo({ dataUrl: canvas.toDataURL("image/png"), ratio: img.width / img.height });
    };
    img.src = "/oveon-logo.png";
  }, []);

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          setReservePhotos(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = (i: number) => setReservePhotos(prev => prev.filter((_, idx) => idx !== i));

  const handleGenerate = async () => {
    setIsSaving(true);
    try {
      const blob = generateFinDeChantierPDF(project, avecReserve, reserveText, reservePhotos, serviceLabel, statusLabel, signatureDataUrl, logoInfo, clientSignatureDataUrl);
      const fileName = `pv-reception-${project.reference}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      const upload = await createUploadUrl.mutateAsync({ projectId: project.id, fileName, mimeType: "application/pdf" });
      await fetch(upload.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": "application/pdf" } });
      await registerDoc.mutateAsync({
        projectId: project.id,
        title: `PV de réception — ${project.reference}`,
        documentType: "rapport",
        visibility: "interne",
        fileName,
        fileKey: upload.fileKey,
        mimeType: "application/pdf",
      });
      await utils.management.projectDocuments.list.invalidate({ projectId: project.id });
      toast.success("PDF généré et enregistré dans les documents.");
      setOpen(false);
    } catch {
      toast.error("PDF généré mais l'enregistrement dans les documents a échoué.");
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="h-3.5 w-3.5" />
          PV de réception
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PV de réception</DialogTitle>
          <DialogDescription>{project.reference} — {project.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Avec réserves</p>
              <p className="text-xs text-muted-foreground">Cochez si des réserves doivent être mentionnées</p>
            </div>
            <Switch checked={avecReserve} onCheckedChange={setAvecReserve} />
          </div>
          {avecReserve && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Détail des réserves</Label>
                <Textarea
                  placeholder="Décrire les réserves constatées…"
                  value={reserveText}
                  onChange={e => setReserveText(e.target.value)}
                  rows={4}
                  className="resize-none text-sm"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Photos des réserves</Label>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ImageIcon className="h-3 w-3" />
                    Ajouter des photos
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotos}
                  />
                </div>
                {reservePhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {reservePhotos.map((src, i) => (
                      <div key={i} className="relative group">
                        <img src={src} alt="" className="h-20 w-full rounded-md object-cover border border-border/60" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <SignaturePad label="Signature client" onchange={setClientSignatureDataUrl} />
            <SignaturePad label="Signature société" onchange={setSignatureDataUrl} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Annuler</Button>
          <Button onClick={handleGenerate} disabled={isSaving}>
            <FileDown className="h-3.5 w-3.5" />
            {isSaving ? "Enregistrement…" : "Générer le PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDetailPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const [, params] = useRoute<{ id: string }>("/chantiers/:id");
  const projectId = params?.id ? Number(params.id) : NaN;
  const validId = Number.isFinite(projectId) && projectId > 0;

  const projectQuery = trpc.management.projects.getById.useQuery(
    { projectId },
    { enabled: validId },
  );
  const clientsQuery = trpc.management.clients.list.useQuery();
  const sitesQuery = trpc.management.sites.list.useQuery();
  const techniciansQuery = trpc.management.technicians.list.useQuery(undefined, { enabled: !!permissions?.manageTechnicians });

  const closeProject = trpc.management.projects.close.useMutation({
    onSuccess: async () => {
      toast.success("Chantier clôturé.");
      setCloseOpen(false);
      await invalidateAll();
      await projectQuery.refetch();
    },
    onError: err => toast.error(err.message),
  });

  const updateProject = trpc.management.projects.update.useMutation({
    onSuccess: async () => {
      toast.success("Chantier mis à jour.");
      setEditOpen(false);
      await invalidateAll();
      await projectQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const deleteProject = trpc.management.projects.delete.useMutation({
    onSuccess: async () => {
      toast.success("Chantier supprimé.");
      await invalidateAll();
      window.history.back();
    },
    onError: error => toast.error(error.message),
  });

  const updateClientName = trpc.management.clients.updateName.useMutation({
    onSuccess: async () => {
      toast.success("Nom client mis à jour.");
      setEditClientNameOpen(false);
      await invalidateAll();
      await projectQuery.refetch();
    },
    onError: e => toast.error(e.message),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteDetailOpen, setDeleteDetailOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeStatus, setCloseStatus] = useState<"termine" | "bloque">("termine");
  const [closeDate, setCloseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [closeTime, setCloseTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [editForm, setEditForm] = useState<ProjectFormState>(INITIAL_PROJECT_FORM);
  const [editClientNameOpen, setEditClientNameOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  useMemo(() => {
    const detail = projectQuery.data;
    if (!detail) return;
    setEditForm({
      clientId: String(detail.clientId ?? ""),
      clientName: (detail as {clientName?:string|null}).clientName ?? "",
      siteId: detail.siteId ? String(detail.siteId) : "",
      title: detail.title ?? "",
      serviceType: detail.serviceType ?? "autre",
      description: detail.description ?? "",
      status: (detail.status ?? "planifie") as ProjectStatus,
      progressPercent: Number(detail.progressPercent ?? 0),
      estimatedHours: String(detail.estimatedHours ?? "0.00"),
      actualHours: String(detail.actualHours ?? "0.00"),
      budgetAmount: String(detail.budgetAmount ?? "0.00"),
      startDate: detail.startDate ? new Date(detail.startDate).toISOString().slice(0, 10) : "",
      plannedEndDate: detail.plannedEndDate ? new Date(detail.plannedEndDate).toISOString().slice(0, 10) : "",
      quoteNumber: detail.quoteNumber ?? "",
      technicianIds: detail.technicianIds ?? [],
      color: detail.color ?? "",
      address: (detail as {address?:string|null}).address ?? "",
      phone: (detail as {phone?:string|null}).phone ?? "",
    });
  }, [projectQuery.data]);

  if (!validId) {
    return (
      <AppShell>
        <EmptyState title="Chantier introuvable" description="L'identifiant fourni dans l'URL n'est pas valide." />
      </AppShell>
    );
  }

  if (projectQuery.isLoading) {
    return (
      <AppShell>
        <p className="py-12 text-center text-sm text-muted-foreground">Chargement du chantier…</p>
      </AppShell>
    );
  }

  const project = projectQuery.data;
  if (!project) {
    return (
      <AppShell>
        <EmptyState title="Chantier introuvable" description="Ce chantier n'existe pas ou vous n'y avez pas accès." />
      </AppShell>
    );
  }

  const canManage = !!permissions?.manageProjects;
  const canContribute = !!permissions?.manageInterventions; // admin + technicien
  const serviceLabel = STATIC_SERVICE_OPTIONS.find(st => st.value === project.serviceType)?.label ?? project.serviceType;
  const statusLabel = PROJECT_STATUS_OPTIONS.find(opt => opt.value === project.status)?.label ?? STATUS_CONFIG[project.status]?.display ?? project.status;

  return (
    <AppShell>
      {/* Hidden dialogs */}
      {canManage && (
        <>
          {/* Edit client name */}
          <Dialog open={editClientNameOpen} onOpenChange={setEditClientNameOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Modifier le nom du client</DialogTitle>
                <DialogDescription>Cette modification s'applique à la fiche client.</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Label className="mb-1.5 block text-sm">Nom du client</Label>
                <Input
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="Nom du client"
                  onKeyDown={e => { if (e.key === "Enter" && newClientName.trim()) updateClientName.mutate({ clientId: project.clientId!, companyName: newClientName.trim() }); }}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditClientNameOpen(false)}>Annuler</Button>
                <Button
                  disabled={updateClientName.isPending || !newClientName.trim() || newClientName.trim() === project.clientName}
                  onClick={() => updateClientName.mutate({ clientId: project.clientId!, companyName: newClientName.trim() })}
                >
                  {updateClientName.isPending ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Modifier le chantier</DialogTitle>
                <DialogDescription>{project.reference}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <SharedProjectForm
                  form={editForm}
                  onChange={updates => setEditForm(prev => ({ ...prev, ...updates }))}
                  technicians={techniciansQuery.data ?? []}
                  showColor={true}
                />
                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>Budget (€)</Label>
                    <Input value={editForm.budgetAmount} onChange={e => setEditForm(prev => ({ ...prev, budgetAmount: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Avancement (%)</Label>
                    <Input type="number" min={0} max={100} value={editForm.progressPercent} onChange={e => setEditForm(prev => ({ ...prev, progressPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Heures réelles</Label>
                    <Input value={editForm.actualHours} onChange={e => setEditForm(prev => ({ ...prev, actualHours: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => updateProject.mutate({
                    ...editForm,
                    projectId: project.id,
                    clientId: Number(editForm.clientId),
                    clientName: editForm.clientName || null,
                    siteId: editForm.siteId ? Number(editForm.siteId) : null,
                    quoteNumber: editForm.quoteNumber || null,
                    color: editForm.color || null,
                  })}
                  disabled={updateProject.isPending || !editForm.clientId || !editForm.title.trim()}
                >
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal clôture */}
          <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Clôturer le chantier</DialogTitle>
                <DialogDescription>Définir le statut final et la date/heure de clôture.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Statut final</Label>
                  <Select value={closeStatus} onValueChange={v => setCloseStatus(v as "termine" | "bloque")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="termine">Terminé</SelectItem>
                      <SelectItem value="bloque">Bloqué</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date de clôture</Label>
                  <Input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Heure de clôture</Label>
                  <Input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCloseOpen(false)}>Annuler</Button>
                <Button
                  disabled={closeProject.isPending}
                  className={closeStatus === "bloque" ? "bg-rose-600 hover:bg-rose-700" : ""}
                  onClick={() => closeProject.mutate({
                    projectId: project.id,
                    status: closeStatus,
                    actualEndAt: `${closeDate}T${closeTime}:00`,
                  })}
                >
                  Clôturer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteDetailOpen} onOpenChange={setDeleteDetailOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce chantier ?</AlertDialogTitle>
                <AlertDialogDescription>
                  « {project.title} » sera supprimé définitivement. Ses affectations seront retirées et les interventions associées seront détachées. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteProject.mutate({ projectId: project.id })}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <div className="space-y-6">
        {/* OVEON-style header */}
        <div className="space-y-4">
          {/* Row 1: back link + action buttons */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/chantiers">
              <button className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <FinDeChantierDialog
                project={project}
                serviceLabel={serviceLabel}
                statusLabel={statusLabel}
              />
              {canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Éditer
                  </Button>
                  {project.status !== "termine" && project.status !== "bloque" && project.status !== "archive" && (
                    <Button size="sm" className="bg-slate-800 text-white hover:bg-slate-700" onClick={() => setCloseOpen(true)}>
                      Clôturer
                    </Button>
                  )}
                  {project.status !== "archive" ? (
                    <Button variant="outline" size="sm" className="text-slate-600 hover:bg-slate-50"
                      onClick={() => updateProject.mutate({ ...editForm, projectId: project.id, clientId: Number(editForm.clientId), siteId: editForm.siteId ? Number(editForm.siteId) : null, quoteNumber: editForm.quoteNumber || null, status: "archive" })}>
                      <Archive className="h-3.5 w-3.5" />
                      Archiver
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="text-emerald-700 hover:bg-emerald-50"
                      onClick={() => updateProject.mutate({ ...editForm, projectId: project.id, clientId: Number(editForm.clientId), siteId: editForm.siteId ? Number(editForm.siteId) : null, quoteNumber: editForm.quoteNumber || null, status: "planifie" })}>
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Réactiver
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setDeleteDetailOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: title + service badge */}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{project.title}</h1>
              <ServiceTypePill type={project.serviceType} />
              <StatusBadge value={project.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 group">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {project.clientName}
                {canManage && (
                  <button
                    onClick={() => { setNewClientName(project.clientName ?? ""); setEditClientNameOpen(true); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-slate-100 text-muted-foreground hover:text-foreground"
                    title="Modifier le nom du client"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>
              {project.siteName ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {project.siteName}
                </span>
              ) : null}
              <span className="text-xs text-slate-400">{project.reference}</span>
            </div>
          </div>

          {/* Row 3: contact rapide */}
          {(() => {
            const displayPhone = project.phone || project.clientPhone;
            const displayAddress = project.address || (project.siteAddress || project.siteCity ? [project.siteAddress, project.sitePostalCode, project.siteCity].filter(Boolean).join(", ") : null);
            if (!displayPhone && !displayAddress) return null;
            return (
              <div className="rounded-xl border border-border/60 bg-white px-5 py-4 shadow-sm">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Contact &amp; Adresse</p>
                <div className="flex flex-wrap gap-4">
                  {displayPhone && (
                    <a href={`tel:${displayPhone}`}
                      className="flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <Phone className="h-4 w-4 text-primary shrink-0"/>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">Téléphone</p>
                        <p className="font-semibold text-sm text-foreground">{displayPhone}</p>
                      </div>
                    </a>
                  )}
                  {displayAddress && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <MapPin className="h-4 w-4 text-primary shrink-0"/>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">Adresse chantier</p>
                        <p className="font-semibold text-sm text-foreground leading-snug">{displayAddress}</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <Tabs defaultValue="journal">
          <TabsList className="grid grid-cols-3 h-auto w-full gap-1 rounded-xl bg-slate-100/80 p-1">
            <TabsTrigger value="journal" className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <BookOpen className="h-3.5 w-3.5" />Journal
            </TabsTrigger>
            <TabsTrigger value="medias" className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <ImageIcon className="h-3.5 w-3.5" />Médias
            </TabsTrigger>
            <TabsTrigger value="memos" className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <StickyNote className="h-3.5 w-3.5" />Mémos
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" />Documents
            </TabsTrigger>
            <TabsTrigger value="infos" className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <Info className="h-3.5 w-3.5" />Infos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="infos" className="mt-6 space-y-4">
            <SectionGrid>
              <SurfaceCard className="xl:col-span-6">
                <CardHeader>
                  <CardTitle>Informations générales</CardTitle>
                  <CardDescription>Données administratives et contractuelles du chantier.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Référence</p>
                    <p className="font-medium text-foreground">{project.reference}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Statut</p>
                    <StatusBadge value={project.status} />
                  </div>
                  {project.quoteNumber && (
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">N° de devis</p>
                      <p className="font-medium text-foreground">{project.quoteNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Client</p>
                    <p className="font-medium text-foreground">{project.clientName}</p>
                    {project.clientPhone && <p className="text-sm text-primary mt-0.5">{project.clientPhone}</p>}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Site</p>
                    <p className="font-medium text-foreground">{project.siteName || "—"}</p>
                    {project.siteAddress && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {project.siteAddress}{project.sitePostalCode ? `, ${project.sitePostalCode}` : ""}{project.siteCity ? ` ${project.siteCity}` : ""}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type de service</p>
                    <p className="font-medium text-foreground">{serviceLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Budget</p>
                    <p className="font-medium text-foreground">{project.budgetAmount ?? "—"} €</p>
                  </div>
                  {project.actualEndAt && (
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Date de clôture</p>
                      <p className="font-medium text-foreground">{new Date(project.actualEndAt).toLocaleString("fr-FR")}</p>
                    </div>
                  )}
                </CardContent>
              </SurfaceCard>

              <SurfaceCard className="xl:col-span-6">
                <CardHeader>
                  <CardTitle>Planification</CardTitle>
                  <CardDescription>Échéances et progression du chantier.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Date de début</p>
                      <p className="font-medium text-foreground">
                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Fin prévue</p>
                      <p className="font-medium text-foreground">
                        {project.plannedEndDate ? new Date(project.plannedEndDate).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Avancement global</span>
                      <span className="font-medium text-foreground">{project.progressPercent ?? 0}%</span>
                    </div>
                    <Progress value={project.progressPercent ?? 0} />
                  </div>
                </CardContent>
              </SurfaceCard>

              <SurfaceCard className="xl:col-span-12">
                <CardHeader>
                  <CardTitle>Description et notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {project.description ? (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{project.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune description renseignée pour ce chantier.</p>
                  )}
                </CardContent>
              </SurfaceCard>
            </SectionGrid>
          </TabsContent>

          <TabsContent value="journal" className="mt-6">
            <ProjectActivityFeedPanel
              projectId={project.id}
              clientId={project.clientId}
              siteId={project.siteId ?? null}
              canManage={canManage}
              canContribute={canContribute}
            />
          </TabsContent>
          <TabsContent value="medias" className="mt-6">
            <ProjectMediaPanel projectId={project.id} canManage={canManage} canContribute={canContribute} />
          </TabsContent>
          <TabsContent value="memos" className="mt-6">
            <ProjectMemosPanel projectId={project.id} canManage={canManage} canContribute={canContribute} />
          </TabsContent>
          <TabsContent value="documents" className="mt-6">
            <ProjectDocumentsPanel projectId={project.id} canManage={canManage} canContribute={canContribute} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

export function ContractsPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const contractsQuery = trpc.management.contracts.list.useQuery();
  const clientsQuery = trpc.management.clients.list.useQuery();
  const sitesQuery = trpc.management.sites.list.useQuery();
  const createContract = trpc.management.contracts.create.useMutation({
    onSuccess: async () => {
      toast.success("Contrat créé avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const renewContract = trpc.management.contracts.renew.useMutation({
    onSuccess: async () => {
      toast.success("Contrat renouvelé avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState<{
    clientId: string;
    siteId: string;
    title: string;
    serviceType: "clim" | "pac" | "chauffe_eau" | "pv" | "vmc" | "autre";
    frequency: "mensuelle" | "trimestrielle" | "semestrielle" | "annuelle" | "personnalisee";
    status: "brouillon" | "actif" | "renouvellement_proche" | "expire" | "suspendu";
    annualAmount: string;
    renewalNoticeDays: number;
    startDate: string;
    nextServiceDate: string;
    endDate: string;
    notes: string;
  }>({
    clientId: "",
    siteId: "",
    title: "",
    serviceType: "autre",
    frequency: "annuelle",
    status: "actif",
    annualAmount: "0.00",
    renewalNoticeDays: 30,
    startDate: "",
    nextServiceDate: "",
    endDate: "",
    notes: "",
  });
  const [renewForm, setRenewForm] = useState<{
    contractId: string;
    startDate: string;
    nextServiceDate: string;
    endDate: string;
    annualAmount: string;
    notes: string;
  }>({
    contractId: "",
    startDate: "",
    nextServiceDate: "",
    endDate: "",
    annualAmount: "",
    notes: "",
  });

  const contractAlerts = useMemo(() => {
    const now = new Date();
    return (contractsQuery.data ?? []).map(contract => {
      if (!contract.endDate) {
        return { ...contract, alertLevel: "info", daysLeft: null } as const;
      }
      const end = new Date(contract.endDate);
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const alertLevel = daysLeft <= 0 ? "expire" : daysLeft <= Number(contract.renewalNoticeDays ?? 30) ? "renouvellement_proche" : "actif";
      return { ...contract, alertLevel, daysLeft };
    });
  }, [contractsQuery.data]);

  const highlightedContracts = contractAlerts.filter(item => item.alertLevel !== "actif");

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Contrats d'entretien"
          action={
            permissions?.manageContracts ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Nouveau contrat</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Nouveau contrat d'entretien</DialogTitle>
                    <DialogDescription>Structurez le cycle de maintenance et les échéances associées.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select value={form.clientId} onValueChange={value => setForm(prev => ({ ...prev, clientId: value }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {clientsQuery.data?.map(client => <SelectItem key={client.id} value={String(client.id)}>{client.companyName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Site</Label>
                      <Select value={form.siteId || "none"} onValueChange={value => setForm(prev => ({ ...prev, siteId: value === "none" ? "" : value }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun site</SelectItem>
                          {sitesQuery.data?.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.siteName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Intitulé</Label>
                      <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type de service</Label>
                      <Select value={form.serviceType} onValueChange={value => setForm(prev => ({ ...prev, serviceType: value as typeof form.serviceType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clim">CLIM</SelectItem>
                          <SelectItem value="pac">PAC</SelectItem>
                          <SelectItem value="chauffe_eau">Chauffe-eau</SelectItem>
                          <SelectItem value="pv">PV</SelectItem>
                          <SelectItem value="vmc">VMC</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Périodicité</Label>
                      <Select value={form.frequency} onValueChange={value => setForm(prev => ({ ...prev, frequency: value as typeof form.frequency }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensuelle">Mensuelle</SelectItem>
                          <SelectItem value="trimestrielle">Trimestrielle</SelectItem>
                          <SelectItem value="semestrielle">Semestrielle</SelectItem>
                          <SelectItem value="annuelle">Annuelle</SelectItem>
                          <SelectItem value="personnalisee">Personnalisée</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Montant annuel</Label>
                      <Input value={form.annualAmount} onChange={e => setForm(prev => ({ ...prev, annualAmount: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Délai d’alerte (jours)</Label>
                      <Input type="number" value={form.renewalNoticeDays} onChange={e => setForm(prev => ({ ...prev, renewalNoticeDays: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date de début</Label>
                      <Input type="date" value={form.startDate} onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prochaine visite</Label>
                      <Input type="date" value={form.nextServiceDate} onChange={e => setForm(prev => ({ ...prev, nextServiceDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date d’expiration</Label>
                      <Input type="date" value={form.endDate} onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createContract.mutate({
                        ...form,
                        clientId: Number(form.clientId),
                        siteId: form.siteId ? Number(form.siteId) : null,
                      })}
                      disabled={createContract.isPending || !form.clientId || !form.title.trim()}
                    >
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        <SectionGrid>
          <SurfaceCard className="xl:col-span-4">
            <CardHeader>
              <CardTitle>Alertes contractuelles</CardTitle>
              <CardDescription>Échéances proches ou expirées nécessitant une action de renouvellement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {highlightedContracts.length ? (
                highlightedContracts.map(contract => (
                  <div key={contract.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{contract.title}</p>
                        <p className="text-sm text-muted-foreground">{contract.contractNumber}</p>
                      </div>
                      <StatusBadge value={contract.alertLevel} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {contract.daysLeft !== null ? `${contract.daysLeft} jour(s) avant échéance.` : "Échéance non renseignée."}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState title="Aucune alerte en cours" description="Les contrats proches de renouvellement remonteront ici automatiquement." />
              )}
            </CardContent>
          </SurfaceCard>

          <SurfaceCard className="xl:col-span-8">
            <CardContent className="pt-6">
              {contractAlerts.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrat</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Alerte</TableHead>
                      <TableHead>Statut</TableHead>
                      {permissions?.manageContracts ? <TableHead>Action</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractAlerts.map(contract => (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{contract.title}</p>
                            <p className="text-xs text-muted-foreground">{contract.contractNumber} · {contract.siteName || "Sans site"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{contract.clientName}</TableCell>
                        <TableCell>
                          {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell><StatusBadge value={contract.alertLevel} /></TableCell>
                        <TableCell><StatusBadge value={contract.status} /></TableCell>
                        {permissions?.manageContracts ? (
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  onClick={() => setRenewForm({
                                    contractId: String(contract.id),
                                    startDate: contract.startDate ? new Date(contract.startDate).toISOString().slice(0, 10) : "",
                                    nextServiceDate: contract.nextServiceDate ? new Date(contract.nextServiceDate).toISOString().slice(0, 10) : "",
                                    endDate: contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : "",
                                    annualAmount: String(contract.annualAmount ?? "0.00"),
                                    notes: contract.notes || "",
                                  })}
                                >
                                  Renouveler
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Renouveler le contrat</DialogTitle>
                                  <DialogDescription>Actualisez la période, la prochaine visite et le montant contractuel.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Nouvelle date de début</Label>
                                    <Input type="date" value={renewForm.startDate} onChange={e => setRenewForm(prev => ({ ...prev, startDate: e.target.value }))} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Nouvelle prochaine visite</Label>
                                    <Input type="date" value={renewForm.nextServiceDate} onChange={e => setRenewForm(prev => ({ ...prev, nextServiceDate: e.target.value }))} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Nouvelle échéance</Label>
                                    <Input type="date" value={renewForm.endDate} onChange={e => setRenewForm(prev => ({ ...prev, endDate: e.target.value }))} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Montant annuel</Label>
                                    <Input value={renewForm.annualAmount} onChange={e => setRenewForm(prev => ({ ...prev, annualAmount: e.target.value }))} />
                                  </div>
                                  <div className="space-y-2 md:col-span-2">
                                    <Label>Notes</Label>
                                    <Textarea value={renewForm.notes} onChange={e => setRenewForm(prev => ({ ...prev, notes: e.target.value }))} />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => renewContract.mutate({
                                      contractId: Number(renewForm.contractId),
                                      startDate: renewForm.startDate,
                                      nextServiceDate: renewForm.nextServiceDate || null,
                                      endDate: renewForm.endDate,
                                      annualAmount: renewForm.annualAmount || null,
                                      notes: renewForm.notes || null,
                                    })}
                                    disabled={renewContract.isPending || !renewForm.contractId || !renewForm.startDate || !renewForm.endDate}
                                  >
                                    Valider le renouvellement
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="Aucun contrat enregistré" description="Les contrats créés ici alimenteront les alertes, le calendrier de maintenance et l’historique des interventions contractuelles." />
              )}
            </CardContent>
          </SurfaceCard>
        </SectionGrid>
      </div>
    </AppShell>
  );
}

export function InterventionsPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const interventionsQuery = trpc.management.interventions.list.useQuery();
  const clientsQuery = trpc.management.clients.list.useQuery();
  const sitesQuery = trpc.management.sites.list.useQuery();
  const projectsQuery = trpc.management.projects.list.useQuery();
  const contractsQuery = trpc.management.contracts.list.useQuery();
  const techniciansQuery = trpc.management.technicians.list.useQuery(undefined, { enabled: !!permissions?.manageTechnicians });
  const [historyFilter, setHistoryFilter] = useState<{ projectId: string; contractId: string }>({ projectId: "", contractId: "" });
  const historyQuery = trpc.management.interventions.history.useQuery({
    projectId: historyFilter.projectId ? Number(historyFilter.projectId) : undefined,
    contractId: historyFilter.contractId ? Number(historyFilter.contractId) : undefined,
  });
  const createIntervention = trpc.management.interventions.create.useMutation({
    onSuccess: async () => {
      toast.success("Intervention créée avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const updateIntervention = trpc.management.interventions.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Compte-rendu enregistré avec succès.");
      await invalidateAll();
      await historyQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState<{
    clientId: string;
    siteId: string;
    projectId: string;
    contractId: string;
    technicianId: string;
    title: string;
    description: string;
    interventionType: "installation" | "maintenance" | "depannage" | "inspection" | "urgence" | "autre";
    priority: "basse" | "normale" | "haute" | "urgente";
    status: "planifiee" | "assignee" | "en_cours" | "rapport_a_faire" | "terminee" | "annulee";
    scheduledStartAt: string;
    scheduledEndAt: string;
  }>({
    clientId: "",
    siteId: "",
    projectId: "",
    contractId: "",
    technicianId: "",
    title: "",
    description: "",
    interventionType: "maintenance",
    priority: "normale",
    status: "planifiee",
    scheduledStartAt: "",
    scheduledEndAt: "",
  });
  const [reportForm, setReportForm] = useState<{
    interventionId: string;
    status: "planifiee" | "assignee" | "en_cours" | "rapport_a_faire" | "terminee" | "annulee";
    report: string;
  }>({
    interventionId: "",
    status: "rapport_a_faire",
    report: "",
  });

  const actionableInterventions = useMemo(
    () => (interventionsQuery.data ?? []).filter(item => item.status !== "terminee" || !item.report),
    [interventionsQuery.data],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Interventions"
          action={
            permissions?.manageInterventions ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Nouvelle intervention</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Nouvelle intervention</DialogTitle>
                    <DialogDescription>Planifiez une intervention ponctuelle ou contractuelle et affectez-la à un technicien.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select value={form.clientId} onValueChange={value => setForm(prev => ({ ...prev, clientId: value }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {clientsQuery.data?.map(client => <SelectItem key={client.id} value={String(client.id)}>{client.companyName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Site</Label>
                      <Select value={form.siteId || "none"} onValueChange={value => setForm(prev => ({ ...prev, siteId: value === "none" ? "" : value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun site</SelectItem>
                          {sitesQuery.data?.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.siteName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Chantier</Label>
                      <Select value={form.projectId || "none"} onValueChange={value => setForm(prev => ({ ...prev, projectId: value === "none" ? "" : value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun chantier</SelectItem>
                          {projectsQuery.data?.map(project => <SelectItem key={project.id} value={String(project.id)}>{project.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Contrat</Label>
                      <Select value={form.contractId || "none"} onValueChange={value => setForm(prev => ({ ...prev, contractId: value === "none" ? "" : value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun contrat</SelectItem>
                          {contractsQuery.data?.map(contract => <SelectItem key={contract.id} value={String(contract.id)}>{contract.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Intitulé</Label>
                      <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={form.interventionType} onValueChange={value => setForm(prev => ({ ...prev, interventionType: value as typeof form.interventionType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="installation">Installation</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="depannage">Dépannage</SelectItem>
                          <SelectItem value="inspection">Inspection</SelectItem>
                          <SelectItem value="urgence">Urgence</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priorité</Label>
                      <Select value={form.priority} onValueChange={value => setForm(prev => ({ ...prev, priority: value as typeof form.priority }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basse">Basse</SelectItem>
                          <SelectItem value="normale">Normale</SelectItem>
                          <SelectItem value="haute">Haute</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {techniciansQuery.data?.length ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Technicien</Label>
                        <Select value={form.technicianId || "none"} onValueChange={value => setForm(prev => ({ ...prev, technicianId: value === "none" ? "" : value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non affecté</SelectItem>
                            {techniciansQuery.data.map(tech => <SelectItem key={tech.id} value={String(tech.id)}>{tech.firstName} {tech.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>Début planifié</Label>
                      <Input type="datetime-local" value={form.scheduledStartAt} onChange={e => setForm(prev => ({ ...prev, scheduledStartAt: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fin planifiée</Label>
                      <Input type="datetime-local" value={form.scheduledEndAt} onChange={e => setForm(prev => ({ ...prev, scheduledEndAt: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createIntervention.mutate({
                        ...form,
                        clientId: Number(form.clientId),
                        siteId: form.siteId ? Number(form.siteId) : null,
                        projectId: form.projectId ? Number(form.projectId) : null,
                        contractId: form.contractId ? Number(form.contractId) : null,
                        technicianId: form.technicianId ? Number(form.technicianId) : null,
                        scheduledStartAt: form.scheduledStartAt ? new Date(form.scheduledStartAt).toISOString() : null,
                        scheduledEndAt: form.scheduledEndAt ? new Date(form.scheduledEndAt).toISOString() : null,
                      })}
                      disabled={createIntervention.isPending || !form.clientId || !form.title.trim()}
                    >
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        <SectionGrid>
          <SurfaceCard className="xl:col-span-7">
            <CardHeader>
              <CardTitle>Suivi d’exécution</CardTitle>
              <CardDescription>Interventions à piloter, avec saisie du compte-rendu et clôture d’exécution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionableInterventions.length ? (
                actionableInterventions.map(item => (
                  <div key={item.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.reference} · {item.clientName}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{item.technicianName || "Technicien non affecté"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={item.priority} />
                        <StatusBadge value={item.status} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            onClick={() => setReportForm({
                              interventionId: String(item.id),
                              status: item.status,
                              report: item.report || "",
                            })}
                          >
                            Compte-rendu
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Compte-rendu d’intervention</DialogTitle>
                            <DialogDescription>Renseignez le statut final et le résumé d’exécution directement depuis la fiche opérationnelle.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4">
                            <div className="space-y-2">
                              <Label>Statut</Label>
                              <Select value={reportForm.status} onValueChange={value => setReportForm(prev => ({ ...prev, status: value as typeof prev.status }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="assignee">Assignée</SelectItem>
                                  <SelectItem value="en_cours">En cours</SelectItem>
                                  <SelectItem value="rapport_a_faire">Rapport à faire</SelectItem>
                                  <SelectItem value="terminee">Terminée</SelectItem>
                                  <SelectItem value="annulee">Annulée</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Compte-rendu</Label>
                              <Textarea value={reportForm.report} onChange={e => setReportForm(prev => ({ ...prev, report: e.target.value }))} />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => updateIntervention.mutate({
                                interventionId: Number(reportForm.interventionId),
                                status: reportForm.status,
                                report: reportForm.report,
                              })}
                              disabled={updateIntervention.isPending || !reportForm.interventionId}
                            >
                              Enregistrer le compte-rendu
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="Aucune intervention à traiter" description="Les interventions planifiées apparaîtront ici jusqu’à leur clôture complète avec compte-rendu." />
              )}
            </CardContent>
          </SurfaceCard>

          <SurfaceCard className="xl:col-span-5">
            <CardHeader>
              <CardTitle>Historique filtré</CardTitle>
              <CardDescription>Retrouvez les interventions passées par chantier ou par contrat avec leurs comptes-rendus.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Filtrer par chantier</Label>
                  <Select value={historyFilter.projectId || "none"} onValueChange={value => setHistoryFilter(prev => ({ ...prev, projectId: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tous les chantiers</SelectItem>
                      {projectsQuery.data?.map(project => <SelectItem key={project.id} value={String(project.id)}>{project.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Filtrer par contrat</Label>
                  <Select value={historyFilter.contractId || "none"} onValueChange={value => setHistoryFilter(prev => ({ ...prev, contractId: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tous les contrats</SelectItem>
                      {contractsQuery.data?.map(contract => <SelectItem key={contract.id} value={String(contract.id)}>{contract.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-3">
                {historyQuery.data?.length ? (
                  historyQuery.data.map(item => (
                    <div key={item.id} className="rounded-2xl border border-border/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.reference} · {item.clientName}</p>
                        </div>
                        <StatusBadge value={item.status} />
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{item.report || "Aucun compte-rendu renseigné pour cette intervention."}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.completedAt ? `Terminée le ${new Date(item.completedAt).toLocaleString()}` : item.scheduledStartAt ? `Planifiée le ${new Date(item.scheduledStartAt).toLocaleString()}` : "Sans date enregistrée"}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Aucun historique trouvé" description="Choisissez un chantier ou un contrat pour consulter les interventions passées et leurs comptes-rendus." />
                )}
              </div>
            </CardContent>
          </SurfaceCard>
        </SectionGrid>
      </div>
    </AppShell>
  );
}

export function TeamPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const techniciansQuery = trpc.management.technicians.list.useQuery(undefined, { enabled: !!permissions?.manageTechnicians });
  const availabilityQuery = trpc.management.technicians.availability.useQuery();
  const createTechnician = trpc.management.technicians.create.useMutation({
    onSuccess: async () => {
      toast.success("Technicien créé avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const createAvailability = trpc.management.technicians.createAvailability.useMutation({
    onSuccess: async () => {
      toast.success("Disponibilité enregistrée avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", employeeCode: "", skills: "", notes: "" });
  const [availabilityForm, setAvailabilityForm] = useState<{
    technicianId: string;
    availabilityType: "disponible" | "mission" | "conge" | "formation" | "indisponible";
    startAt: string;
    endAt: string;
    notes: string;
  }>({
    technicianId: "",
    availabilityType: "disponible",
    startAt: "",
    endAt: "",
    notes: "",
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Techniciens et disponibilités"
          action={
            permissions?.manageTechnicians ? (
              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Déclarer une disponibilité</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Nouvelle disponibilité</DialogTitle>
                      <DialogDescription>Ajoutez un créneau disponible, une mission, une formation ou une indisponibilité pour fiabiliser le planning terrain.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Technicien</Label>
                        <Select value={availabilityForm.technicianId} onValueChange={value => setAvailabilityForm(prev => ({ ...prev, technicianId: value }))}>
                          <SelectTrigger><SelectValue placeholder="Sélectionner un technicien" /></SelectTrigger>
                          <SelectContent>
                            {techniciansQuery.data?.map(tech => (
                              <SelectItem key={tech.id} value={String(tech.id)}>{tech.firstName} {tech.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={availabilityForm.availabilityType} onValueChange={value => setAvailabilityForm(prev => ({ ...prev, availabilityType: value as typeof prev.availabilityType }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disponible">Disponible</SelectItem>
                            <SelectItem value="mission">Mission</SelectItem>
                            <SelectItem value="conge">Congé</SelectItem>
                            <SelectItem value="formation">Formation</SelectItem>
                            <SelectItem value="indisponible">Indisponible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Début</Label>
                        <Input type="datetime-local" value={availabilityForm.startAt} onChange={e => setAvailabilityForm(prev => ({ ...prev, startAt: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fin</Label>
                        <Input type="datetime-local" value={availabilityForm.endAt} onChange={e => setAvailabilityForm(prev => ({ ...prev, endAt: e.target.value }))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={availabilityForm.notes} onChange={e => setAvailabilityForm(prev => ({ ...prev, notes: e.target.value }))} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createAvailability.mutate({
                          technicianId: Number(availabilityForm.technicianId),
                          availabilityType: availabilityForm.availabilityType,
                          startAt: new Date(availabilityForm.startAt).toISOString(),
                          endAt: new Date(availabilityForm.endAt).toISOString(),
                          notes: availabilityForm.notes,
                        })}
                        disabled={createAvailability.isPending || !availabilityForm.technicianId || !availabilityForm.startAt || !availabilityForm.endAt}
                      >
                        Enregistrer la disponibilité
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button>Ajouter un technicien</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Nouveau technicien</DialogTitle>
                      <DialogDescription>Ajoutez un profil technicien pour préparer les affectations chantier et intervention.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Prénom</Label>
                        <Input value={form.firstName} onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input value={form.lastName} onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Code salarié</Label>
                        <Input value={form.employeeCode} onChange={e => setForm(prev => ({ ...prev, employeeCode: e.target.value }))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Compétences (séparées par des virgules)</Label>
                        <Input value={form.skills} onChange={e => setForm(prev => ({ ...prev, skills: e.target.value }))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createTechnician.mutate({
                          ...form,
                          skills: form.skills.split(",").map(item => item.trim()).filter(Boolean),
                        })}
                        disabled={createTechnician.isPending || !form.firstName.trim() || !form.lastName.trim()}
                      >
                        Enregistrer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : null
          }
        />

        <SectionGrid>
          <SurfaceCard className="xl:col-span-7">
            <CardHeader>
              <CardTitle>Équipe</CardTitle>
              <CardDescription>Profils activés dans la plateforme pour l’exécution terrain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {techniciansQuery.data?.length ? (
                techniciansQuery.data.map(tech => (
                  <div key={tech.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{tech.firstName} {tech.lastName}</p>
                      <p className="text-sm text-muted-foreground">{tech.email || tech.phone || "Coordonnées non renseignées"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {tech.skills?.length ? tech.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>) : <Badge variant="secondary">Compétences à compléter</Badge>}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="Aucun technicien visible" description="Ajoutez des techniciens pour pouvoir les affecter aux chantiers et aux interventions." />
              )}
            </CardContent>
          </SurfaceCard>

          <SurfaceCard className="xl:col-span-5">
            <CardHeader>
              <CardTitle>Disponibilités</CardTitle>
              <CardDescription>Créneaux disponibles ou périodes d’indisponibilité remontés dans le planning.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {availabilityQuery.data?.length ? (
                availabilityQuery.data.map(slot => (
                  <div key={slot.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge value={slot.availabilityType} />
                      <span className="text-xs text-muted-foreground">{new Date(slot.startAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Jusqu’au {new Date(slot.endAt).toLocaleString()} {slot.notes ? `· ${slot.notes}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState title="Aucune disponibilité enregistrée" description="Les créneaux de disponibilité pourront ensuite enrichir les affectations et le planning." />
              )}
            </CardContent>
          </SurfaceCard>
        </SectionGrid>
      </div>
    </AppShell>
  );
}

export function CalendarPage() {
  const eventsQuery = trpc.management.calendar.events.useQuery();

  const grouped = useMemo(() => {
    const rows = eventsQuery.data ?? [];
    const byDay = new Map<string, typeof rows>();
    rows.forEach(item => {
      const key = item.start ? new Date(item.start).toLocaleDateString() : "Sans date";
      const current = byDay.get(key) ?? [];
      current.push(item);
      byDay.set(key, current);
    });
    return Array.from(byDay.entries());
  }, [eventsQuery.data]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Calendrier opérationnel"
        />

        <SurfaceCard>
          <CardContent className="pt-6 space-y-5">
            {grouped.length ? (
              grouped.map(([day, items]) => (
                <div key={day} className="space-y-3 rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-medium text-foreground">{day}</h2>
                    <Badge variant="secondary">{items.length} événement(s)</Badge>
                  </div>
                  <div className="space-y-3">
                    {items.map(item => (
                      <div key={`${item.eventType}-${item.id}`} className="flex flex-col gap-3 rounded-xl bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.eventType === "maintenance" ? "Maintenance planifiée" : "Intervention planifiée"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge value={item.status} />
                          <span className="text-sm text-muted-foreground">{item.start ? new Date(item.start).toLocaleString() : "À planifier"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="Calendrier vide" description="Les prochains chantiers, contrats et interventions planifiées apparaîtront ici de manière consolidée." />
            )}
          </CardContent>
        </SurfaceCard>
      </div>
    </AppShell>
  );
}

export function DocumentsPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const documentsQuery = trpc.management.documents.list.useQuery();
  const clientsQuery = trpc.management.clients.list.useQuery();
  const sitesQuery = trpc.management.sites.list.useQuery();
  const projectsQuery = trpc.management.projects.list.useQuery();
  const contractsQuery = trpc.management.contracts.list.useQuery();
  const interventionsQuery = trpc.management.interventions.list.useQuery();
  const uploadDocument = trpc.management.documents.upload.useMutation({
    onSuccess: async () => {
      toast.success("Document téléversé avec succès.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState<{
    entityType: "client" | "site" | "project" | "contract" | "intervention";
    entityId: string;
    clientId: string;
    siteId: string;
    projectId: string;
    contractId: string;
    interventionId: string;
    title: string;
    documentType: "rapport" | "photo" | "contrat" | "bon_intervention" | "plan" | "autre";
    visibility: "interne" | "client" | "restreint";
  }>({
    entityType: "project",
    entityId: "",
    clientId: "",
    siteId: "",
    projectId: "",
    contractId: "",
    interventionId: "",
    title: "",
    documentType: "rapport",
    visibility: "interne",
  });

  const entityOptions =
    form.entityType === "client"
      ? clientsQuery.data?.map(item => ({ value: String(item.id), label: item.companyName }))
      : form.entityType === "site"
        ? sitesQuery.data?.map(item => ({ value: String(item.id), label: item.siteName }))
        : form.entityType === "project"
          ? projectsQuery.data?.map(item => ({ value: String(item.id), label: item.title }))
          : form.entityType === "contract"
            ? contractsQuery.data?.map(item => ({ value: String(item.id), label: item.title }))
            : interventionsQuery.data?.map(item => ({ value: String(item.id), label: item.title }));

  async function handleUpload() {
    if (!selectedFile || !form.entityId || !form.title.trim()) {
      toast.error("Veuillez renseigner le document, sa cible et son titre.");
      return;
    }

    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const payload = result.includes(",") ? result.split(",")[1] ?? "" : result;
        resolve(payload);
      };
      reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
      reader.readAsDataURL(selectedFile);
    });

    uploadDocument.mutate({
      entityType: form.entityType,
      entityId: Number(form.entityId),
      clientId: form.clientId ? Number(form.clientId) : form.entityType === "client" ? Number(form.entityId) : null,
      siteId: form.siteId ? Number(form.siteId) : form.entityType === "site" ? Number(form.entityId) : null,
      projectId: form.projectId ? Number(form.projectId) : form.entityType === "project" ? Number(form.entityId) : null,
      contractId: form.contractId ? Number(form.contractId) : form.entityType === "contract" ? Number(form.entityId) : null,
      interventionId: form.interventionId ? Number(form.interventionId) : form.entityType === "intervention" ? Number(form.entityId) : null,
      title: form.title,
      fileName: selectedFile.name,
      mimeType: selectedFile.type || "application/octet-stream",
      base64Content,
      documentType: form.documentType,
      visibility: form.visibility,
    });
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Documents et photos"
          action={
            permissions?.documents ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Déposer un document</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Nouveau document</DialogTitle>
                    <DialogDescription>Associez votre fichier à un objet métier pour le retrouver directement dans le bon contexte opérationnel.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type d'objet</Label>
                      <Select value={form.entityType} onValueChange={value => setForm(prev => ({ ...prev, entityType: value as typeof form.entityType, entityId: "" }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="site">Site</SelectItem>
                          <SelectItem value="project">Chantier</SelectItem>
                          <SelectItem value="contract">Contrat</SelectItem>
                          <SelectItem value="intervention">Intervention</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Objet cible</Label>
                      <Select value={form.entityId || "none"} onValueChange={value => setForm(prev => ({ ...prev, entityId: value === "none" ? "" : value }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sélectionner</SelectItem>
                          {entityOptions?.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Titre</Label>
                      <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type documentaire</Label>
                      <Select value={form.documentType} onValueChange={value => setForm(prev => ({ ...prev, documentType: value as typeof form.documentType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rapport">Rapport</SelectItem>
                          <SelectItem value="photo">Photo</SelectItem>
                          <SelectItem value="contrat">Contrat</SelectItem>
                          <SelectItem value="bon_intervention">Bon d'intervention</SelectItem>
                          <SelectItem value="plan">Plan</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Visibilité</Label>
                      <Select value={form.visibility} onValueChange={value => setForm(prev => ({ ...prev, visibility: value as typeof form.visibility }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interne">Interne</SelectItem>
                          <SelectItem value="client">Partagé client</SelectItem>
                          <SelectItem value="restreint">Restreint</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Fichier</Label>
                      <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleUpload} disabled={uploadDocument.isPending || !selectedFile || !form.entityId || !form.title.trim()}>
                      Téléverser
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        <SectionGrid>
          <SurfaceCard className="xl:col-span-4">
            <CardHeader>
              <CardTitle>Types de pièces</CardTitle>
              <CardDescription>Le dépôt documentaire est structuré par usage métier et niveau de partage.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="rounded-2xl border border-border/60 p-5">
                  <FileText className="h-5 w-5 text-primary" />
                  <p className="mt-4 font-medium text-foreground">Rapports</p>
                  <p className="mt-2 text-sm text-muted-foreground">Comptes-rendus, procès-verbaux et pièces d’exécution.</p>
                </div>
                <div className="rounded-2xl border border-border/60 p-5">
                  <Building2 className="h-5 w-5 text-primary" />
                  <p className="mt-4 font-medium text-foreground">Photos</p>
                  <p className="mt-2 text-sm text-muted-foreground">Preuves visuelles avant, pendant et après intervention.</p>
                </div>
                <div className="rounded-2xl border border-border/60 p-5">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  <p className="mt-4 font-medium text-foreground">Pièces contractuelles</p>
                  <p className="mt-2 text-sm text-muted-foreground">Contrats, avenants, plans et bons d’intervention.</p>
                </div>
              </div>
            </CardContent>
          </SurfaceCard>

          <SurfaceCard className="xl:col-span-8">
            <CardHeader>
              <CardTitle>Bibliothèque documentaire</CardTitle>
              <CardDescription>Liste consolidée des documents enregistrés dans le périmètre visible de l’utilisateur.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {documentsQuery.data?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Cible</TableHead>
                      <TableHead>Visibilité</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Accès</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentsQuery.data.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge value={doc.documentType} /></TableCell>
                        <TableCell>{doc.entityType} #{doc.entityId}</TableCell>
                        <TableCell><StatusBadge value={doc.visibility} /></TableCell>
                        <TableCell>{new Date(doc.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                            Ouvrir
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="Aucun document enregistré" description="Déposez un premier rapport, une photo ou une pièce contractuelle pour alimenter l’historique documentaire." />
              )}
            </CardContent>
          </SurfaceCard>
        </SectionGrid>
      </div>
    </AppShell>
  );
}

export function OverviewPage() {
  return <DashboardPage />;
}

function fmtDt(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

const ENTRY_TYPE_STYLE: Record<string, { label: string; tone: string; dot: string }> = {
  etape:         { label: "Étape",         tone: "bg-blue-500/10 text-blue-700 border-blue-200",     dot: "bg-blue-500" },
  blocage:       { label: "Blocage",       tone: "bg-rose-500/10 text-rose-700 border-rose-200",     dot: "bg-rose-500" },
  livraison:     { label: "Livraison",     tone: "bg-emerald-500/10 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  contact_client:{ label: "Contact client",tone: "bg-violet-500/10 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  note:          { label: "Note",          tone: "bg-slate-500/10 text-slate-700 border-slate-200",  dot: "bg-slate-400" },
};

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

function LinkedInCard({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="block">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer overflow-hidden">
        {children}
      </div>
    </Link>
  );
}

type FeedPhoto = { id: number; signedUrl: string | null; caption: string | null };

function PhotoGrid({ photos }: { photos: FeedPhoto[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (photos.length === 0) return null;

  const zoom = (url: string | null) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (url) setLightbox(url); };

  let grid: React.ReactNode;
  if (photos.length === 1) {
    grid = <img src={photos[0].signedUrl ?? ""} alt={photos[0].caption ?? ""} className="w-full max-h-80 object-cover cursor-zoom-in" onClick={zoom(photos[0].signedUrl)} />;
  } else if (photos.length === 2) {
    grid = (
      <div className="grid grid-cols-2 gap-0.5">
        {photos.map(p => <img key={p.id} src={p.signedUrl ?? ""} alt={p.caption ?? ""} className="aspect-square w-full object-cover cursor-zoom-in" onClick={zoom(p.signedUrl)} />)}
      </div>
    );
  } else if (photos.length === 3) {
    grid = (
      <div className="grid gap-0.5" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
        <img src={photos[0].signedUrl ?? ""} alt={photos[0].caption ?? ""} className="row-span-2 h-full w-full object-cover cursor-zoom-in" style={{ aspectRatio: "1" }} onClick={zoom(photos[0].signedUrl)} />
        <img src={photos[1].signedUrl ?? ""} alt={photos[1].caption ?? ""} className="aspect-square w-full object-cover cursor-zoom-in" onClick={zoom(photos[1].signedUrl)} />
        <img src={photos[2].signedUrl ?? ""} alt={photos[2].caption ?? ""} className="aspect-square w-full object-cover cursor-zoom-in" onClick={zoom(photos[2].signedUrl)} />
      </div>
    );
  } else {
    const visible = photos.slice(0, 4);
    const overflow = photos.length - 4;
    grid = (
      <div className="grid grid-cols-2 gap-0.5">
        {visible.map((p, i) => (
          <div key={p.id} className="relative cursor-zoom-in" onClick={zoom(p.signedUrl)}>
            <img src={p.signedUrl ?? ""} alt={p.caption ?? ""} className="aspect-square w-full object-cover" />
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

  return (
    <>
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
      {grid}
    </>
  );
}

type MediaGroup = {
  kind: "media";
  id: string;
  projectId: number;
  projectName: string;
  projectRef: string;
  projectServiceType: string;
  clientName: string;
  authorName: string;
  date: string | null;
  photos: FeedPhoto[];
};

type JournalFeedEntry = {
  kind: "journal";
  id: number;
  projectId: number;
  projectName: string;
  projectRef: string;
  projectServiceType: string;
  clientName: string;
  entryType: string;
  title: string | null;
  content: string;
  createdByName: string;
  occurredAt: string | null;
  createdAt: string | null;
};

type CombinedFeedItem = Omit<JournalFeedEntry, "kind"> & {
  kind: "combined";
  photos: FeedPhoto[];
};

type TaskFeedItem = {
  kind: "task";
  id: number;
  projectId: number;
  projectName: string;
  projectRef: string;
  projectServiceType: string;
  clientName: string;
  title: string | null;
  content: string;
  createdByName: string;
  urgency: string;
  status: string;
  pinned: boolean;
  createdAt: string | null;
};

type FeedItem = JournalFeedEntry | MediaGroup | CombinedFeedItem | TaskFeedItem;

function getItemDate(item: FeedItem): string | null {
  if (item.kind === "media") return item.date;
  if (item.kind === "task") return item.createdAt;
  return item.occurredAt ?? item.createdAt;
}

function groupMediaForFeed(items: Array<{
  id: number;
  projectId: number;
  projectName: string;
  projectRef: string;
  projectServiceType: string;
  projectClientName?: string;
  uploadedByName: string;
  uploadedByUserId: number | null;
  createdAt: string | null;
  signedUrl: string | null;
  caption: string | null;
}>): MediaGroup[] {
  const sorted = [...items].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  const groups: MediaGroup[] = [];
  for (const item of sorted) {
    const ts = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    const existing = groups.find(g => {
      const gts = g.date ? new Date(g.date).getTime() : 0;
      return (
        g.projectId === item.projectId &&
        g.authorName === (item.uploadedByName || "—") &&
        Math.abs(ts - gts) < 30 * 60 * 1000
      );
    });
    if (existing) {
      existing.photos.push({ id: item.id, signedUrl: item.signedUrl, caption: item.caption });
    } else {
      groups.push({
        kind: "media",
        id: `media-${item.id}`,
        projectId: item.projectId,
        projectName: item.projectName,
        projectRef: item.projectRef,
        projectServiceType: item.projectServiceType,
        clientName: item.projectClientName ?? "",
        authorName: item.uploadedByName || "—",
        date: item.createdAt,
        photos: [{ id: item.id, signedUrl: item.signedUrl, caption: item.caption }],
      });
    }
  }
  return groups;
}

function buildFeed(journals: JournalFeedEntry[], mediaGroups: MediaGroup[]): FeedItem[] {
  const usedMedia = new Set<string>();
  const result: FeedItem[] = [];

  const allSorted = [...journals, ...mediaGroups].sort((a, b) =>
    (getItemDate(b) ? new Date(getItemDate(b)!).getTime() : 0) -
    (getItemDate(a) ? new Date(getItemDate(a)!).getTime() : 0)
  );

  for (const item of allSorted) {
    if (item.kind === "media") {
      if (!usedMedia.has(item.id)) result.push(item);
      continue;
    }
    // Journal entry — look for a nearby media group (same project + author, ≤15 min)
    const itemTs = getItemDate(item) ? new Date(getItemDate(item)!).getTime() : 0;
    const nearbyMedia = mediaGroups.find(mg => {
      if (usedMedia.has(mg.id)) return false;
      const mgTs = mg.date ? new Date(mg.date).getTime() : 0;
      return (
        mg.projectId === item.projectId &&
        mg.authorName === item.createdByName &&
        Math.abs(itemTs - mgTs) <= 15 * 60 * 1000
      );
    });
    if (nearbyMedia) {
      usedMedia.add(nearbyMedia.id);
      result.push({
        kind: "combined",
        id: item.id,
        projectId: item.projectId,
        projectName: item.projectName,
        projectRef: item.projectRef,
        projectServiceType: item.projectServiceType,
        clientName: item.clientName,
        entryType: item.entryType,
        title: item.title,
        content: item.content,
        createdByName: item.createdByName,
        occurredAt: item.occurredAt,
        createdAt: item.createdAt,
        photos: nearbyMedia.photos,
      });
    } else {
      result.push(item);
    }
  }
  return result;
}

const FEED_URGENCY_TONE: Record<string, string> = {
  urgente: "bg-rose-500/10 text-rose-700 border-rose-200",
  haute:   "bg-orange-500/10 text-orange-700 border-orange-200",
  normale: "bg-blue-500/10 text-blue-700 border-blue-200",
  basse:   "bg-slate-500/10 text-slate-500 border-slate-200",
};
const FEED_URGENCY_DOT: Record<string, string> = {
  urgente: "bg-rose-500",
  haute:   "bg-orange-400",
  normale: "bg-blue-400",
  basse:   "bg-slate-400",
};

export function FeedPage() {
  const journalQuery = trpc.management.projectJournal.listAll.useQuery();
  const mediaQuery = trpc.management.projectMedia.listAll.useQuery();
  const memosQuery = trpc.management.projectMemos.listAll.useQuery();

  const isLoading = journalQuery.isLoading || mediaQuery.isLoading || memosQuery.isLoading;
  const err = journalQuery.error ?? mediaQuery.error ?? memosQuery.error;

  const feed = useMemo(() => {
    const journals: JournalFeedEntry[] = (journalQuery.data ?? []).filter(e => e.entryType !== "memo").map(e => ({
      kind: "journal" as const,
      id: e.id,
      projectId: e.projectId,
      projectName: e.projectName ?? "",
      projectRef: e.projectRef ?? "",
      projectServiceType: e.projectServiceType ?? "autre",
      clientName: (e as Record<string, unknown>).projectClientName as string ?? "",
      entryType: e.entryType,
      title: e.title,
      content: e.content,
      createdByName: e.createdByName || "—",
      occurredAt: e.occurredAt,
      createdAt: e.createdAt,
    }));
    const mediaGroups = groupMediaForFeed(mediaQuery.data ?? []);
    const baseFeed = buildFeed(journals, mediaGroups);

    const tasks: TaskFeedItem[] = (memosQuery.data ?? []).map(m => ({
      kind: "task" as const,
      id: m.id,
      projectId: m.projectId,
      projectName: (m as Record<string, unknown>).projectName as string ?? "",
      projectRef: (m as Record<string, unknown>).projectRef as string ?? "",
      projectServiceType: (m as Record<string, unknown>).projectServiceType as string ?? "autre",
      clientName: "",
      title: m.title,
      content: m.content,
      createdByName: m.createdByName || "—",
      urgency: m.urgency,
      status: m.status,
      pinned: m.pinned,
      createdAt: m.createdAt,
    }));

    const all = [...baseFeed, ...tasks];
    all.sort((a, b) => {
      const ta = getItemDate(a) ? new Date(getItemDate(a)!).getTime() : 0;
      const tb = getItemDate(b) ? new Date(getItemDate(b)!).getTime() : 0;
      return tb - ta;
    });
    return all;
  }, [journalQuery.data, mediaQuery.data, memosQuery.data]);

  return (
    <AppShell>
      <div className="flex flex-col gap-5 max-w-2xl mx-auto">
        <PageHeader title="Fil d'actualité" />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err.message}</div>
        ) : feed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-10 text-center">
            <p className="text-sm text-muted-foreground">Aucune publication dans le fil d'actualité.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {feed.map(item => {
              const authorName = item.kind === "media" ? item.authorName : item.createdByName;
              const serviceType = item.projectServiceType;
              const itemDate = getItemDate(item);
              const clientLabel = item.clientName || item.projectName;
              const projectSub = item.clientName ? item.projectName : "";

              if (item.kind === "media") {
                return (
                  <LinkedInCard key={item.id} href={`/chantiers/${item.projectId}`}>
                    <div className="p-3">
                      <div className="flex items-start gap-2.5">
                        <PostAvatar name={authorName} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-foreground shrink-0">{authorName}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{fmtRelative(itemDate)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <ServiceTypePill type={serviceType} />
                            {clientLabel && <span className="text-xs font-medium text-foreground truncate">{clientLabel}</span>}
                            {projectSub && <span className="text-xs text-muted-foreground truncate">{projectSub}</span>}
                          </div>
                          {item.photos.some(p => p.caption) && (
                            <p className="mt-1 text-sm text-foreground">{item.photos[0].caption}</p>
                          )}
                        </div>
                        <span className="shrink-0 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                          Photo{item.photos.length > 1 ? `s (${item.photos.length})` : ""}
                        </span>
                      </div>
                    </div>
                    <PhotoGrid photos={item.photos} />
                    <div className="px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{fmtDt(itemDate)}</span>
                      {item.projectRef && <span className="text-[10px] font-mono text-muted-foreground">{item.projectRef}</span>}
                    </div>
                  </LinkedInCard>
                );
              }

              if (item.kind === "task") {
                const urgencyTone = FEED_URGENCY_TONE[item.urgency] ?? FEED_URGENCY_TONE.normale;
                const urgencyDot = FEED_URGENCY_DOT[item.urgency] ?? FEED_URGENCY_DOT.normale;
                const urgencyLabel = { urgente: "Urgente", haute: "Haute", normale: "Normale", basse: "Basse" }[item.urgency] ?? item.urgency;
                return (
                  <LinkedInCard key={`t-${item.id}`} href={`/chantiers/${item.projectId}`}>
                    <div className="p-3">
                      <div className="flex items-start gap-2.5">
                        <PostAvatar name={authorName} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-foreground shrink-0">{authorName}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${urgencyTone}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${urgencyDot}`} />Mémo
                            </span>
                            {item.status === "done" && <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shrink-0">Fait</span>}
                            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{fmtRelative(itemDate)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <ServiceTypePill type={serviceType} />
                            {item.projectName && <span className="text-xs font-medium text-foreground truncate">{item.projectName}</span>}
                          </div>
                          <div className={`mt-1 ${item.status === "done" ? "opacity-60" : ""}`}>
                            {item.title && <p className={`font-semibold text-sm text-foreground ${item.status === "done" ? "line-through" : ""}`}>{item.title}</p>}
                            <p className="whitespace-pre-wrap text-sm leading-5 text-foreground">{item.content}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{fmtDt(itemDate)}</span>
                      {item.projectRef && <span className="text-[10px] font-mono text-muted-foreground">{item.projectRef}</span>}
                    </div>
                  </LinkedInCard>
                );
              }

              const entryStyle = ENTRY_TYPE_STYLE[item.entryType] ?? { label: item.entryType, tone: "bg-slate-500/10 text-slate-700 border-slate-200", dot: "bg-slate-400" };
              const photos = item.kind === "combined" ? item.photos : [];

              return (
                <LinkedInCard key={`j-${item.id}`} href={`/chantiers/${item.projectId}`}>
                  <div className="p-3">
                    <div className="flex items-start gap-2.5">
                      <PostAvatar name={authorName} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-foreground shrink-0">{authorName}</span>
                          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${entryStyle.tone}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${entryStyle.dot}`} />
                            {entryStyle.label}
                          </span>
                          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{fmtRelative(itemDate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <ServiceTypePill type={serviceType} />
                          {clientLabel && <span className="text-xs font-medium text-foreground truncate">{clientLabel}</span>}
                          {projectSub && <span className="text-xs text-muted-foreground truncate">{projectSub}</span>}
                        </div>
                        {item.title && <p className="mt-1 font-semibold text-sm text-foreground">{item.title}</p>}
                        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-foreground">{item.content}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{fmtDt(itemDate)}</p>
                      </div>
                    </div>
                  </div>
                  {photos.length > 0 && <PhotoGrid photos={photos} />}
                </LinkedInCard>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export function MemosGlobalPage() {
  const utils = trpc.useUtils();
  const memosQuery = trpc.management.projectMemos.listAll.useQuery();
  const updateMutation = trpc.management.projectMemos.update.useMutation({
    onSuccess: async () => { await utils.management.projectMemos.listAll.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const createUploadMutation = trpc.management.projectMedia.createUploadUrl.useMutation();
  const [validationTargetId, setValidationTargetId] = useState<number | null>(null);
  const [validationProjectId, setValidationProjectId] = useState<number | null>(null);
  const [validationComment, setValidationComment] = useState("");
  const [validationPhotoFile, setValidationPhotoFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);

  const handleValidateMemo = async () => {
    if (!validationTargetId || !validationComment.trim()) return;
    setValidating(true);
    try {
      let photoKey: string | null = null;
      if (validationPhotoFile && validationProjectId) {
        const upload = await createUploadMutation.mutateAsync({
          projectId: validationProjectId,
          fileName: validationPhotoFile.name,
          mimeType: validationPhotoFile.type,
          mediaType: "photo",
        });
        await fetch(upload.signedUrl, { method: "PUT", body: validationPhotoFile, headers: { "Content-Type": validationPhotoFile.type } });
        photoKey = upload.fileKey;
      }
      await updateMutation.mutateAsync({ id: validationTargetId, status: "done", validationComment: validationComment.trim(), validationPhotoKey: photoKey });
      setValidationTargetId(null);
      setValidationProjectId(null);
      setValidationComment("");
      setValidationPhotoFile(null);
    } catch {
      // error shown by mutation onError
    } finally {
      setValidating(false);
    }
  };

  const items = memosQuery.data ?? [];
  const todo = items.filter(m => m.status !== "done");
  const done = items.filter(m => m.status === "done");

  return (
    <AppShell>
      {/* Validation dialog */}
      <Dialog open={validationTargetId !== null} onOpenChange={open => { if (!open) { setValidationTargetId(null); setValidationProjectId(null); setValidationComment(""); setValidationPhotoFile(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Valider le mémo</DialogTitle>
            <DialogDescription>Renseignez un commentaire de clôture pour valider ce mémo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Commentaire de validation <span className="text-rose-500">*</span></Label>
              <Textarea rows={3} value={validationComment} onChange={e => setValidationComment(e.target.value)} placeholder="Décrivez comment c'est résolu…" autoFocus />
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
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Ajouter une photo
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setValidationPhotoFile(f); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidationTargetId(null); setValidationProjectId(null); setValidationComment(""); setValidationPhotoFile(null); }}>Annuler</Button>
            <Button onClick={handleValidateMemo} disabled={validating || !validationComment.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {validating ? "Validation…" : "Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-5 max-w-2xl mx-auto">
        <PageHeader title="Mémos" description={`${todo.length} à faire · ${done.length} terminé${done.length > 1 ? "s" : ""}`} />
        {memosQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : memosQuery.error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{memosQuery.error.message}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-10 text-center">
            <p className="text-sm text-muted-foreground">Aucun mémo enregistré.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {[...todo, ...done].map(memo => {
              const authorName = memo.createdByName || "—";
              const isDone = memo.status === "done";
              return (
                <div key={memo.id} className={`rounded-2xl border shadow-sm overflow-hidden transition-opacity ${isDone ? "opacity-60" : ""} ${isDone ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => isDone
                          ? updateMutation.mutate({ id: memo.id, status: "todo" })
                          : (() => { setValidationTargetId(memo.id); setValidationProjectId(memo.projectId); })()
                        }
                        disabled={updateMutation.isPending}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${isDone ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-emerald-400"}`}
                        title={isDone ? "Marquer à faire" : "Valider (commentaire requis)"}
                      >
                        {isDone && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                      <PostAvatar name={authorName} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{authorName}</span>
                          <span className="text-xs text-muted-foreground">{fmtRelative(memo.updatedAt ?? memo.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <ServiceTypePill type={memo.projectServiceType ?? "autre"} />
                          {memo.projectName && (
                            <a href={`/chantiers/${memo.projectId}`} className="text-xs text-primary hover:underline truncate">{memo.projectName}</a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDone && <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Fait</span>}
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Mémo</span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 ml-8">
                      {memo.title && <p className={`font-semibold text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{memo.title}</p>}
                      <p className={`whitespace-pre-wrap text-sm leading-6 ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{memo.content}</p>
                      {isDone && memo.validationComment && (
                        <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                          <p className="text-xs text-emerald-700"><span className="font-semibold">Validation :</span> {memo.validationComment}</p>
                          {memo.validationPhotoSignedUrl && (
                            <img src={memo.validationPhotoSignedUrl} className="mt-2 h-20 w-20 object-cover rounded-lg cursor-zoom-in" onClick={() => window.open(memo.validationPhotoSignedUrl!, "_blank")} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{fmtDt(memo.updatedAt ?? memo.createdAt)}</span>
                    {memo.projectRef && <span className="text-[10px] font-mono text-muted-foreground">{memo.projectRef}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export const techfieldMenu = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/", roles: ["admin", "client"] },
  { icon: Newspaper, label: "Fil d'actualité", path: "/fil-actualite", roles: ["admin", "technicien"] },
  { icon: BriefcaseBusiness, label: "Chantiers", path: "/chantiers", roles: ["admin", "technicien", "client"] },
  { icon: StickyNote, label: "Mémos", path: "/memos-globaux", roles: ["admin", "technicien"] },
  { icon: ClipboardCheck, label: "Contrats", path: "/contrats", roles: ["admin", "client"] },
  { icon: Clock, label: "Heures", path: "/heures", roles: ["admin", "technicien"] },
  { icon: Users, label: "Équipe", path: "/equipe", roles: ["admin"] },
  { icon: UserCog, label: "Utilisateurs", path: "/utilisateurs", roles: ["admin"] },
  { icon: CalendarRange, label: "Planning", path: "/planning", roles: ["admin", "technicien"] },
  { icon: CalendarClock, label: "Calendrier", path: "/calendrier", roles: ["admin"] },
  { icon: FileText, label: "Documents", path: "/documents", roles: ["admin", "client"] },
  { icon: Settings, label: "Réglages", path: "/reglages", roles: ["admin"] },
];
