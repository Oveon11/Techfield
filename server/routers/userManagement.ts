import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { createSupabaseAdminClient } from "../integrations/supabase/db/admin";

const INTERNAL_DOMAIN = "techfield.local";

function toInternalEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${INTERNAL_DOMAIN}`;
}

function usernameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const suffix = `@${INTERNAL_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
}

function mapUserRow(row: Record<string, unknown>) {
  const email = (row.email as string | null) ?? null;
  return {
    id: Number(row.id),
    openId: String(row.open_id ?? ""),
    name: (row.name as string | null) ?? null,
    email,
    username: usernameFromEmail(email),
    role: (row.role as "admin" | "technicien" | "client") ?? "client",
    accountStatus: (row.account_status as "active" | "invited" | "suspended") ?? "active",
    lastSignedIn: row.last_signed_in ? new Date(String(row.last_signed_in)).toISOString() : null,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

export const userManagementRouter = router({
  list: adminProcedure.query(async () => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, open_id, name, email, role, account_status, last_signed_in, created_at")
      .order("name");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return (data ?? []).map(r => mapUserRow(r as Record<string, unknown>));
  }),

  create: adminProcedure.input(z.object({
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    role: z.enum(["admin", "technicien", "client"]),
    username: z.string().min(2).max(20).regex(/^[a-z0-9]+$/, "Identifiant invalide"),
    password: z.string().length(6).regex(/^\d{6}$/, "Le mot de passe doit contenir 6 chiffres"),
  })).mutation(async ({ input }) => {
    const supabase = createSupabaseAdminClient();
    const email = toInternalEmail(input.username);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
    });

    if (authError) {
      const msg = authError.message;
      if (msg.includes("already been registered") || msg.includes("already exists") || msg.includes("duplicate")) {
        throw new TRPCError({ code: "CONFLICT", message: "Cet identifiant est déjà utilisé." });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
    }

    const openId = authData.user.id;
    const fullName = `${input.firstName} ${input.lastName}`.trim();

    const { data: userInserted, error: dbError } = await supabase.from("users").insert({
      open_id: openId,
      name: fullName,
      email,
      role: input.role,
      account_status: "active",
      login_method: "password",
      last_signed_in: new Date().toISOString(),
    }).select("id").single();

    if (dbError) {
      await supabase.auth.admin.deleteUser(openId).catch(() => {});
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: dbError.message });
    }

    // Pour les techniciens, créer aussi la ligne dans la table technicians
    // afin que myTechnicianId puisse retourner leur ID pour la saisie des heures
    if (input.role === "technicien" && userInserted) {
      const userId = (userInserted as Record<string, unknown>).id as number;
      const { error: techError } = await supabase.from("technicians").insert({
        user_id: userId,
        first_name: input.firstName,
        last_name: input.lastName,
        email,
        is_active: true,
      });
      if (techError) {
        await supabase.auth.admin.deleteUser(openId).catch(() => {});
        await supabase.from("users").delete().eq("open_id", openId);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: techError.message });
      }
    }

    return { success: true, username: input.username };
  }),

  resetPassword: adminProcedure.input(z.object({
    openId: z.string().min(1),
    password: z.string().length(6).regex(/^\d{6}$/),
  })).mutation(async ({ input }) => {
    if (!input.openId || input.openId === "undefined") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Identifiant utilisateur manquant. Ce compte ne peut pas être réinitialisé depuis l'interface." });
    }
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(input.openId, {
      password: input.password,
    });
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  updateRole: adminProcedure.input(z.object({
    id: z.number(),
    role: z.enum(["admin", "technicien", "client"]),
  })).mutation(async ({ input }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("users").update({ role: input.role }).eq("id", input.id);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  toggleStatus: adminProcedure.input(z.object({
    id: z.number(),
    accountStatus: z.enum(["active", "suspended"]),
  })).mutation(async ({ input }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("users").update({ account_status: input.accountStatus }).eq("id", input.id);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),
});
