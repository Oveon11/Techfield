import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { techfieldMenu } from "@/pages/TechfieldPages";
import { Building2, Mail, PanelLeft } from "lucide-react";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 292;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <UnauthenticatedCard />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function UnauthenticatedCard() {
  const { authAvailable, authMessage, error, isRequestingMagicLink, isVerifyingCode, pendingEmail, requestMagicLink, verifyCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const handleSubmitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await requestMagicLink(email);
    } catch {
      // message géré par le hook
    }
  };

  const handleSubmitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await verifyCode(code);
    } catch {
      // message géré par le hook
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.14),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-6">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white/90 p-10 shadow-2xl shadow-slate-950/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Techfield</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Accédez à votre espace opérationnel</h1>
          </div>
        </div>
        <p className="mt-6 text-sm leading-7 text-muted-foreground">
          La plateforme centralise les chantiers, contrats d’entretien, interventions et informations terrain. Connectez-vous avec un lien sécurisé envoyé par e-mail via Supabase Auth.
        </p>

        {authAvailable ? (
          !pendingEmail ? (
            <form className="mt-8 space-y-4" onSubmit={handleSubmitEmail}>
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium text-foreground">
                  Adresse e-mail professionnelle
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    className="pl-9"
                    placeholder="nom@entreprise.fr"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full shadow-lg shadow-primary/20" disabled={isRequestingMagicLink}>
                {isRequestingMagicLink ? "Envoi en cours..." : "Recevoir mon code de connexion"}
              </Button>
              {error ? (
                <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error.message}
                </p>
              ) : null}
            </form>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={handleSubmitCode}>
              {authMessage && (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {authMessage}
                </p>
              )}
              <div className="space-y-2">
                <label htmlFor="login-code" className="text-sm font-medium text-foreground">
                  Code à 6 chiffres
                </label>
                <Input
                  id="login-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" className="w-full shadow-lg shadow-primary/20" disabled={isVerifyingCode || code.length !== 6}>
                {isVerifyingCode ? "Vérification..." : "Se connecter"}
              </Button>
              {error ? (
                <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error.message}
                </p>
              ) : null}
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => { /* reset géré par pendingEmail dans le hook */ window.location.reload(); }}
              >
                Utiliser une autre adresse e-mail
              </button>
            </form>
          )
        ) : (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
            L’authentification Supabase côté navigateur n’est pas encore configurée. Ajoutez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans l’environnement de déploiement pour activer la connexion.
          </div>
        )}
      </div>
    </div>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = techfieldMenu.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const roleLabel =
    user?.role === "admin" ? "Administrateur" :
    user?.role === "technicien" ? "Technicien" :
    user?.role === "client" ? "Client" : "Utilisateur";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-[#0D1526] text-slate-50" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center border-b border-white/8 px-3">
            <div className="flex w-full items-center gap-3 px-1 transition-all">
              <button
                onClick={toggleSidebar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-slate-400" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0 flex items-center">
                  <img src="/oveon-logo.png" alt="Oveon" className="h-8 w-8 rounded-lg object-contain" />
                  <div className="ml-2">
                    <span className="block truncate text-sm font-bold tracking-tight text-white">Techfield</span>
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Gestion terrain</p>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-3">
            {/* User Profile Card */}
            <div className="mb-3 rounded-xl border border-white/8 bg-white/5 p-3 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
              <div className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-primary text-sm font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase() || "T"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-semibold text-white">{user?.name || "Utilisateur"}</p>
                  <span className="mt-0.5 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
                    {roleLabel}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                className="mt-2.5 w-full text-left text-[11px] font-medium text-rose-400 transition-colors hover:text-rose-300 group-data-[collapsible=icon]:hidden"
              >
                Déconnexion
              </button>
            </div>

            {/* Navigation */}
            <SidebarMenu>
              {techfieldMenu.filter(item => !item.roles || item.roles.includes(user?.role ?? "")).map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => { setLocation(item.path); if (isMobile) setOpenMobile(false); }}
                      tooltip={item.label}
                      className={`h-10 rounded-xl px-3 font-medium transition-all ${
                        isActive
                          ? "bg-primary text-white shadow-sm shadow-primary/40 hover:bg-primary/90"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <div
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-sky-400/20 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium tracking-tight text-foreground">{activeMenuItem?.label ?? "Menu"}</span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Techfield</span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
