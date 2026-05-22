import DashboardLayout from "@/components/DashboardLayout";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileText,
  ImageIcon,
  Info,
  LayoutDashboard,
  MapPin,
  MapPinned,
  MoreVertical,
  Pencil,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import {
  ProjectActivityFeedPanel,
  ProjectDocumentsPanel,
  ProjectInterventionsPanel,
  ProjectJournalPanel,
  ProjectMediaPanel,
  ProjectMemosPanel,
} from "./ProjectDetailTabs";

function AppShell({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
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

function StatusBadge({ value }: { value: string | null | undefined }) {
  const label = value ?? "non défini";
  const tone =
    label.includes("term") || label.includes("actif")
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
      : label.includes("urgent") || label.includes("expire") || label.includes("bloqu")
        ? "bg-rose-500/10 text-rose-700 border-rose-200"
        : label.includes("cours") || label.includes("planifi") || label.includes("assig")
          ? "bg-amber-500/10 text-amber-700 border-amber-200"
          : "bg-slate-500/10 text-slate-700 border-slate-200";

  return <Badge className={`border ${tone}`}>{label.replaceAll("_", " ")}</Badge>;
}

function getServiceStyle(type: string): { bg: string; text: string; label: string } {
  switch (type) {
    case "clim": return { bg: "bg-blue-100", text: "text-blue-700", label: "CLIM" };
    case "pac": return { bg: "bg-red-100", text: "text-red-700", label: "PAC" };
    case "pv": return { bg: "bg-amber-100", text: "text-amber-700", label: "PV" };
    case "vmc": return { bg: "bg-violet-100", text: "text-violet-700", label: "VMC" };
    case "chauffe_eau": return { bg: "bg-orange-100", text: "text-orange-700", label: "CE" };
    default: return { bg: "bg-slate-100", text: "text-slate-600", label: "AUTRE" };
  }
}

function ServiceTypePill({ type }: { type: string }) {
  const { bg, text, label } = getServiceStyle(type);
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

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Pilotage d'activité"
          description="Vue consolidée des chantiers, interventions et contrats d’entretien, conçue pour offrir une lecture rapide de l’activité et des échéances à surveiller."
        />

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
          description="Gestion centralisée des entreprises et donneurs d’ordre, avec leurs informations administratives et opérationnelles."
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
          description="Les sites rattachent les interventions au terrain réel, avec adresse, consignes d’accès et rattachement client."
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

type ProjectServiceType = "clim" | "pac" | "chauffe_eau" | "pv" | "vmc" | "autre";
type ProjectStatus = "brouillon" | "planifie" | "en_cours" | "bloque" | "termine" | "annule";

type ProjectFormState = {
  clientId: string;
  siteId: string;
  title: string;
  serviceType: ProjectServiceType;
  description: string;
  status: ProjectStatus;
  progressPercent: number;
  estimatedHours: string;
  actualHours: string;
  budgetAmount: string;
  startDate: string;
  plannedEndDate: string;
  technicianIds: number[];
};

const INITIAL_PROJECT_FORM: ProjectFormState = {
  clientId: "",
  siteId: "",
  title: "",
  serviceType: "autre",
  description: "",
  status: "planifie",
  progressPercent: 0,
  estimatedHours: "0.00",
  actualHours: "0.00",
  budgetAmount: "0.00",
  startDate: "",
  plannedEndDate: "",
  technicianIds: [],
};

const SERVICE_TYPE_OPTIONS: { value: ProjectServiceType; label: string }[] = [
  { value: "clim", label: "CLIM" },
  { value: "pac", label: "PAC" },
  { value: "chauffe_eau", label: "Chauffe-eau" },
  { value: "pv", label: "PV" },
  { value: "vmc", label: "VMC" },
  { value: "autre", label: "Autre" },
];

const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "brouillon", label: "Brouillon" },
  { value: "planifie", label: "Planifié" },
  { value: "en_cours", label: "En cours" },
  { value: "bloque", label: "Bloqué" },
  { value: "termine", label: "Terminé" },
  { value: "annule", label: "Annulé" },
];

function ProjectFormFields({
  form,
  setForm,
  clients,
  sites,
  technicians,
}: {
  form: ProjectFormState;
  setForm: (updater: (prev: ProjectFormState) => ProjectFormState) => void;
  clients: Array<{ id: number; companyName: string }>;
  sites: Array<{ id: number; siteName: string }>;
  technicians: Array<{ id: number; firstName: string; lastName: string }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Client</Label>
        <Select value={form.clientId} onValueChange={value => setForm(prev => ({ ...prev, clientId: value }))}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
          <SelectContent>
            {clients.map(client => <SelectItem key={client.id} value={String(client.id)}>{client.companyName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Site</Label>
        <Select value={form.siteId || "none"} onValueChange={value => setForm(prev => ({ ...prev, siteId: value === "none" ? "" : value }))}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucun site</SelectItem>
            {sites.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.siteName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Intitulé</Label>
        <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Type de service</Label>
        <Select value={form.serviceType} onValueChange={value => setForm(prev => ({ ...prev, serviceType: value as ProjectServiceType }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SERVICE_TYPE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Statut</Label>
        <Select value={form.status} onValueChange={value => setForm(prev => ({ ...prev, status: value as ProjectStatus }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROJECT_STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Début</Label>
        <Input type="date" value={form.startDate} onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Fin prévue</Label>
        <Input type="date" value={form.plannedEndDate} onChange={e => setForm(prev => ({ ...prev, plannedEndDate: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Budget</Label>
        <Input value={form.budgetAmount} onChange={e => setForm(prev => ({ ...prev, budgetAmount: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Avancement (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={form.progressPercent}
          onChange={e => setForm(prev => ({ ...prev, progressPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
      </div>
      {technicians.length ? (
        <div className="space-y-2 md:col-span-2">
          <Label>Techniciens à affecter</Label>
          <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 p-3">
            {technicians.map(tech => {
              const checked = form.technicianIds.includes(tech.id);
              return (
                <button
                  key={tech.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm ${checked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  onClick={() => setForm(prev => ({
                    ...prev,
                    technicianIds: checked ? prev.technicianIds.filter(id => id !== tech.id) : [...prev.technicianIds, tech.id],
                  }))}
                >
                  {tech.firstName} {tech.lastName}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectsPage() {
  const { permissions } = useRoleMatrix();
  const invalidateAll = useInvalidateAfterSuccess();
  const projectsQuery = trpc.management.projects.list.useQuery();
  const clientsQuery = trpc.management.clients.list.useQuery();
  const sitesQuery = trpc.management.sites.list.useQuery();
  const techniciansQuery = trpc.management.technicians.list.useQuery(undefined, { enabled: !!permissions?.manageTechnicians });

  const createProject = trpc.management.projects.create.useMutation({
    onSuccess: async () => {
      toast.success("Chantier créé avec succès.");
      setCreateOpen(false);
      setForm(INITIAL_PROJECT_FORM);
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

  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectFormState>(INITIAL_PROJECT_FORM);
  const [editForm, setEditForm] = useState<ProjectFormState>(INITIAL_PROJECT_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [serviceFilter, setServiceFilter] = useState<"all" | ProjectServiceType>("all");

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
      siteId: detail.siteId ? String(detail.siteId) : "",
      title: detail.title ?? "",
      serviceType: (detail.serviceType ?? "autre") as ProjectServiceType,
      description: detail.description ?? "",
      status: (detail.status ?? "planifie") as ProjectStatus,
      progressPercent: Number(detail.progressPercent ?? 0),
      estimatedHours: String(detail.estimatedHours ?? "0.00"),
      actualHours: String(detail.actualHours ?? "0.00"),
      budgetAmount: String(detail.budgetAmount ?? "0.00"),
      startDate: detail.startDate ? new Date(detail.startDate).toISOString().slice(0, 10) : "",
      plannedEndDate: detail.plannedEndDate ? new Date(detail.plannedEndDate).toISOString().slice(0, 10) : "",
      technicianIds: detail.technicianIds ?? [],
    });
  }, [projectDetailQuery.data, editingId]);

  const filteredProjects = useMemo(() => {
    const list = projectsQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    return list.filter(project => {
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (serviceFilter !== "all" && project.serviceType !== serviceFilter) return false;
      if (!needle) return true;
      const haystack = [project.title, project.reference, project.clientName, project.siteName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [projectsQuery.data, search, statusFilter, serviceFilter]);

  const clients = clientsQuery.data ?? [];
  const sites = sitesQuery.data ?? [];
  const technicians = techniciansQuery.data ?? [];
  const canManage = !!permissions?.manageProjects;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Chantiers"
          description="Création, suivi d’avancement, pilotage opérationnel et affectation des techniciens sur les dossiers terrain."
          action={
            canManage ? (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>Nouveau chantier</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Nouveau chantier</DialogTitle>
                    <DialogDescription>Créez un chantier et préparez immédiatement son affectation opérationnelle.</DialogDescription>
                  </DialogHeader>
                  <ProjectFormFields form={form} setForm={setForm} clients={clients} sites={sites} technicians={technicians} />
                  <DialogFooter>
                    <Button
                      onClick={() => createProject.mutate({
                        ...form,
                        clientId: Number(form.clientId),
                        siteId: form.siteId ? Number(form.siteId) : null,
                      })}
                      disabled={createProject.isPending || !form.clientId || !form.title.trim()}
                    >
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

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
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={value => setStatusFilter(value as "all" | ProjectStatus)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {PROJECT_STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={serviceFilter} onValueChange={value => setServiceFilter(value as "all" | ProjectServiceType)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les services</SelectItem>
                  {SERVICE_TYPE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </SurfaceCard>

        <div className="grid gap-4 xl:grid-cols-2">
          {filteredProjects.length ? (
            filteredProjects.map(project => (
              <div key={project.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-slate-200 hover:shadow-md">
                {/* Hidden dialogs — triggered by state */}
                {canManage && (
                  <>
                    <Dialog open={editingId === project.id} onOpenChange={open => setEditingId(open ? project.id : null)}>
                      <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Modifier le chantier</DialogTitle>
                          <DialogDescription>{project.reference} · {project.clientName}</DialogDescription>
                        </DialogHeader>
                        {projectDetailQuery.isLoading && editingId === project.id ? (
                          <p className="py-6 text-sm text-muted-foreground">Chargement…</p>
                        ) : (
                          <ProjectFormFields form={editForm} setForm={setEditForm} clients={clients} sites={sites} technicians={technicians} />
                        )}
                        <DialogFooter>
                          <Button
                            onClick={() => updateProject.mutate({
                              ...editForm,
                              projectId: project.id,
                              clientId: Number(editForm.clientId),
                              siteId: editForm.siteId ? Number(editForm.siteId) : null,
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

                {/* Top row: service badge + title + admin dropdown */}
                <div className="flex items-start gap-3">
                  <ServiceTypePill type={project.serviceType} />
                  <p className="min-w-0 flex-1 font-semibold leading-snug text-foreground">{project.title}</p>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="-mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditingId(project.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Éditer
                        </DropdownMenuItem>
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
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    {project.clientName}
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
                  <StatusBadge value={project.status} />
                  <Link href={`/chantiers/${project.id}`}>
                    <Button size="sm" className="bg-primary font-semibold text-white shadow-sm shadow-primary/30 hover:bg-primary/90">
                      OUVRIR
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
  const interventionsQuery = trpc.management.interventions.history.useQuery(
    { projectId },
    { enabled: validId },
  );
  const clientsQuery = trpc.management.clients.list.useQuery();
  const sitesQuery = trpc.management.sites.list.useQuery();
  const techniciansQuery = trpc.management.technicians.list.useQuery(undefined, { enabled: !!permissions?.manageTechnicians });

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

  const [editOpen, setEditOpen] = useState(false);
  const [deleteDetailOpen, setDeleteDetailOpen] = useState(false);
  const [editForm, setEditForm] = useState<ProjectFormState>(INITIAL_PROJECT_FORM);

  useMemo(() => {
    const detail = projectQuery.data;
    if (!detail) return;
    setEditForm({
      clientId: String(detail.clientId ?? ""),
      siteId: detail.siteId ? String(detail.siteId) : "",
      title: detail.title ?? "",
      serviceType: (detail.serviceType ?? "autre") as ProjectServiceType,
      description: detail.description ?? "",
      status: (detail.status ?? "planifie") as ProjectStatus,
      progressPercent: Number(detail.progressPercent ?? 0),
      estimatedHours: String(detail.estimatedHours ?? "0.00"),
      actualHours: String(detail.actualHours ?? "0.00"),
      budgetAmount: String(detail.budgetAmount ?? "0.00"),
      startDate: detail.startDate ? new Date(detail.startDate).toISOString().slice(0, 10) : "",
      plannedEndDate: detail.plannedEndDate ? new Date(detail.plannedEndDate).toISOString().slice(0, 10) : "",
      technicianIds: detail.technicianIds ?? [],
    });
  }, [projectQuery.data]);

  const linkedInterventions = interventionsQuery.data ?? [];

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
  const serviceLabel = SERVICE_TYPE_OPTIONS.find(opt => opt.value === project.serviceType)?.label ?? project.serviceType;
  const statusLabel = PROJECT_STATUS_OPTIONS.find(opt => opt.value === project.status)?.label ?? project.status;

  return (
    <AppShell>
      {/* Hidden dialogs */}
      {canManage && (
        <>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Modifier le chantier</DialogTitle>
                <DialogDescription>{project.reference}</DialogDescription>
              </DialogHeader>
              <ProjectFormFields
                form={editForm}
                setForm={setEditForm}
                clients={clientsQuery.data ?? []}
                sites={sitesQuery.data ?? []}
                technicians={techniciansQuery.data ?? []}
              />
              <DialogFooter>
                <Button
                  onClick={() => updateProject.mutate({
                    ...editForm,
                    projectId: project.id,
                    clientId: Number(editForm.clientId),
                    siteId: editForm.siteId ? Number(editForm.siteId) : null,
                  })}
                  disabled={updateProject.isPending || !editForm.clientId || !editForm.title.trim()}
                >
                  Enregistrer
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
            {canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Éditer
                </Button>
                <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setDeleteDetailOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </Button>
              </div>
            ) : null}
          </div>

          {/* Row 2: title + service badge */}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{project.title}</h1>
              <ServiceTypePill type={project.serviceType} />
              <StatusBadge value={project.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {project.clientName}
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

          {/* Row 3: stats card */}
          <div className="rounded-xl border border-border/60 bg-white px-5 py-4 shadow-sm">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Charge de travail</p>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Réalisé</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">{Number(project.actualHours ?? 0).toFixed(0)} h</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimé</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">{Number(project.estimatedHours ?? 0).toFixed(0)} h</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avancement</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">{project.progressPercent ?? 0} %</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Interventions</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">{linkedInterventions.length}</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="journal">
          <TabsList className="h-auto flex-wrap gap-0.5 rounded-xl bg-slate-100/80 p-1">
            <TabsTrigger value="journal" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <BookOpen className="h-3.5 w-3.5" />Journal
            </TabsTrigger>
            <TabsTrigger value="medias" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <ImageIcon className="h-3.5 w-3.5" />Médias
            </TabsTrigger>
            <TabsTrigger value="memos" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <StickyNote className="h-3.5 w-3.5" />Mémos
            </TabsTrigger>
            <TabsTrigger value="interventions" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <Wrench className="h-3.5 w-3.5" />Interventions
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" />Documents
            </TabsTrigger>
            <TabsTrigger value="infos" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
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
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Client</p>
                    <p className="font-medium text-foreground">{project.clientName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Site</p>
                    <p className="font-medium text-foreground">{project.siteName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type de service</p>
                    <p className="font-medium text-foreground">{serviceLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Budget</p>
                    <p className="font-medium text-foreground">{project.budgetAmount ?? "—"} €</p>
                  </div>
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

          <TabsContent value="interventions" className="mt-6">
            <ProjectInterventionsPanel
              projectId={project.id}
              clientId={project.clientId}
              siteId={project.siteId ?? null}
              canManage={canManage}
            />
          </TabsContent>

          <TabsContent value="journal" className="mt-6">
            <ProjectActivityFeedPanel
              projectId={project.id}
              clientId={project.clientId}
              siteId={project.siteId ?? null}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="medias" className="mt-6">
            <ProjectMediaPanel projectId={project.id} canManage={canManage} />
          </TabsContent>
          <TabsContent value="memos" className="mt-6">
            <ProjectMemosPanel projectId={project.id} canManage={canManage} />
          </TabsContent>
          <TabsContent value="documents" className="mt-6">
            <ProjectDocumentsPanel projectId={project.id} canManage={canManage} />
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
          description="Création, renouvellement et suivi des échéances contractuelles pour la maintenance préventive et les visites périodiques."
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
          description="Planification, affectation terrain, suivi d’exécution et historisation des opérations techniques."
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
          description="Pilotage de l’équipe opérationnelle, des compétences et des créneaux de disponibilité terrain."
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
          description="Vue regroupée des interventions programmées et des maintenances prévues par contrat."
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
          description="Téléversez et consultez rapports, photos de chantier et pièces contractuelles dans un stockage centralisé et sécurisé."
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

export const techfieldMenu = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/" },
  { icon: Building2, label: "Clients", path: "/clients" },
  { icon: MapPinned, label: "Sites", path: "/sites" },
  { icon: BriefcaseBusiness, label: "Chantiers", path: "/chantiers" },
  { icon: ClipboardCheck, label: "Contrats", path: "/contrats" },
  { icon: Wrench, label: "Interventions", path: "/interventions" },
  { icon: Users, label: "Équipe", path: "/equipe" },
  { icon: CalendarClock, label: "Calendrier", path: "/calendrier" },
  { icon: FileText, label: "Documents", path: "/documents" },
];
