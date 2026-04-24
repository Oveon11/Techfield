import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";

/**
 * Page exemple minimale conservée compilable pendant le refactor auth.
 */
export default function Home() {
  const { user, loading, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col gap-6 p-6">
      <main className="space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="text-sm text-muted-foreground">
            {user ? `Connecté en tant que ${user.email ?? user.name ?? "utilisateur"}` : "Aucun utilisateur connecté"}
          </span>
        </div>
        <Streamdown>La démonstration frontend utilise désormais **Supabase Auth** pour la connexion.</Streamdown>
        <Button variant="default" onClick={() => void logout()} disabled={!user}>
          Se déconnecter
        </Button>
      </main>
    </div>
  );
}
