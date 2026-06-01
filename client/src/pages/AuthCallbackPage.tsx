import { trpc } from "@/lib/trpc";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    const supabase = getSupabaseBrowserClient();
    if (!supabase || (!code && !tokenHash)) {
      navigate("/");
      return;
    }

    async function handleCallback() {
      try {
        let authError: { message: string } | null = null;

        if (code) {
          ({ error: authError } = await supabase!.auth.exchangeCodeForSession(code));
        } else if (tokenHash && type) {
          ({ error: authError } = await supabase!.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
          }));
        }

        if (authError) {
          setError(authError.message);
          return;
        }

        await utils.auth.me.invalidate();
        navigate("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de connexion inattendue.");
      }
    }

    void handleCallback();
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
