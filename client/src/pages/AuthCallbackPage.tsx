import { trpc } from "@/lib/trpc";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      navigate("/");
      return;
    }

    // Avec flowType "implicit", le SDK détecte automatiquement les tokens
    // dans le hash (#access_token=...) ou les params (?token_hash=...) dès
    // l'initialisation. On écoute juste le SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        subscription.unsubscribe();
        await utils.auth.me.invalidate();
        navigate("/");
      } else if (event === "SIGNED_OUT") {
        subscription.unsubscribe();
        setError("Lien de connexion invalide ou expiré.");
      }
    });

    // Si la session est déjà établie (rechargement de page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        void utils.auth.me.invalidate().then(() => navigate("/"));
      }
    });

    // Timeout de sécurité : si rien ne se passe en 8s, c'est que le lien est mauvais
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      setError("Lien de connexion invalide ou expiré. Demandez un nouveau lien.");
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate, utils]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg text-center space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <button
            className="text-sm text-primary underline"
            onClick={() => navigate("/")}
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-muted-foreground">Connexion en cours…</p>
    </div>
  );
}
