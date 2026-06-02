import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import HoursPage from "@/pages/HoursPage";
import SettingsPage from "@/pages/SettingsPage";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  CalendarPage,
  ClientsPage,
  ContractsPage,
  DashboardPage,
  DocumentsPage,
  FeedPage,
  InterventionsPage,
  MemosGlobalPage,
  ProjectDetailPage,
  ProjectsPage,
  TeamPage,
} from "./pages/TechfieldPages";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/fil-actualite" component={FeedPage} />
      <Route path="/memos-globaux" component={MemosGlobalPage} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/chantiers" component={ProjectsPage} />
      <Route path="/chantiers/:id" component={ProjectDetailPage} />
      <Route path="/contrats" component={ContractsPage} />
      <Route path="/interventions" component={InterventionsPage} />
      <Route path="/heures" component={HoursPage} />
      <Route path="/equipe" component={TeamPage} />
      <Route path="/calendrier" component={CalendarPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/reglages" component={SettingsPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
