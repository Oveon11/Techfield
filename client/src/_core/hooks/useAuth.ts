import { getAuthRedirectPath } from "@/const";
import { trpc } from "@/lib/trpc";
import { getSupabaseBrowserClient, resolveSupabasePublicConfig } from "@/lib/supabase";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

const INTERNAL_DOMAIN = "techfield.local";

function toInternalEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${INTERNAL_DOMAIN}`;
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getAuthRedirectPath() } = options ?? {};
  const utils = trpc.useUtils();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const supabaseConfig = useMemo(() => resolveSupabasePublicConfig(import.meta.env), []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      setAuthError(null);
      await utils.auth.me.invalidate();
    });

    return () => { subscription.unsubscribe(); };
  }, [utils.auth.me]);

  const signIn = useCallback(async (username: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Authentification non configurée. Contactez votre administrateur.");

    setIsSigningIn(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: toInternalEmail(username),
        password,
      });

      if (error) {
        const msg = error.message.includes("Invalid login credentials")
          ? "Identifiant ou mot de passe incorrect."
          : error.message;
        throw new Error(msg);
      }

      await utils.auth.me.invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de connexion.";
      setAuthError(message);
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  }, [utils]);

  const logout = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return;
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem("manus-runtime-user-info", JSON.stringify(meQuery.data));
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? (authError ? new Error(authError) : null),
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    authError,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;
    window.location.replace(redirectPath);
  }, [redirectOnUnauthenticated, redirectPath, logoutMutation.isPending, meQuery.isLoading, state.user]);

  return {
    ...state,
    authAvailable: supabaseConfig.isConfigured,
    isSigningIn,
    refresh: () => meQuery.refetch(),
    signIn,
    logout,
  };
}
