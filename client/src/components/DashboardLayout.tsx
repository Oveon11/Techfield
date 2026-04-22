import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { techfieldMenu } from "@/pages/TechfieldPages";
import { Building2, LogOut, PanelLeft } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
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
            La plateforme centralise les chantiers, contrats d’entretien, interventions et informations terrain. Connectez-vous pour accéder à votre périmètre métier sécurisé.
          </p>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="mt-8 w-full shadow-lg shadow-primary/20"
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
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

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
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

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-slate-950 text-slate-50" disableTransition={isResizing}>
          <SidebarHeader className="h-20 justify-center border-b border-white/10 px-3">
            <div className="flex w-full items-center gap-3 px-2 transition-all">
              <button
                onClick={toggleSidebar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-slate-300" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Techfield</p>
                  <span className="block truncate text-sm font-semibold tracking-tight text-white">Gestion chantiers & maintenance</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-4">
            <SidebarMenu>
              {techfieldMenu.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 rounded-xl px-3 font-normal transition-all ${isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-sky-300" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-white/10 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-left transition-colors hover:bg-white/10 group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20">
                  <Avatar className="h-10 w-10 border border-white/10 bg-slate-900">
                    <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "T"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium leading-none text-white">{user?.name || "Utilisateur"}</p>
                    <p className="mt-1.5 truncate text-xs text-slate-400">{user?.email || user?.role || "Profil sécurisé"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Se déconnecter</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
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
