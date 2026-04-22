import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  CalendarPage,
  ClientsPage,
  ContractsPage,
  DashboardPage,
  DocumentsPage,
  InterventionsPage,
  ProjectsPage,
  SitesPage,
  TeamPage,
} from "./pages/TechfieldPages";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/sites" component={SitesPage} />
      <Route path="/chantiers" component={ProjectsPage} />
      <Route path="/contrats" component={ContractsPage} />
      <Route path="/interventions" component={InterventionsPage} />
      <Route path="/equipe" component={TeamPage} />
      <Route path="/calendrier" component={CalendarPage} />
      <Route path="/documents" component={DocumentsPage} />
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
