import { getAuthRedirectPath } from "@/const";
import { trpc } from "@/lib/trpc";
import { getSupabaseBrowserClient, resolveSupabasePublicConfig } from "@/lib/supabase";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getAuthRedirectPath() } = options ?? {};
  const utils = trpc.useUtils();
  const [isRequestingMagicLink, setIsRequestingMagicLink] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const supabaseConfig = useMemo(() => resolveSupabasePublicConfig(import.meta.env), []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      setAuthError(null);
      await utils.auth.me.invalidate();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [utils.auth.me]);

  const requestMagicLink = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Veuillez saisir une adresse e-mail.");
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("L’authentification Supabase n’est pas configurée côté navigateur. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
    }

    setIsRequestingMagicLink(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }

      setAuthMessage("Un lien de connexion a été envoyé à votre adresse e-mail.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d’envoyer le lien de connexion.";
      setAuthError(message);
      throw error;
    } finally {
      setIsRequestingMagicLink(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      }

      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
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
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    authAvailable: supabaseConfig.isConfigured,
    authMessage,
    isRequestingMagicLink,
    refresh: () => meQuery.refetch(),
    requestMagicLink,
    logout,
  };
}
