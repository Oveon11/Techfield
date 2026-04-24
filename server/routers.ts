import { TRPCError } from "@trpc/server";
import { createExpiredSessionCookie } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getUserAccessProfile } from "./db";
import { managementRouter } from "./routers/management";

function assertAllowedRole(role: string, allowedRoles: string[]) {
  if (!allowedRoles.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous n'avez pas les droits nécessaires pour accéder à cette ressource.",
    });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    session: protectedProcedure.query(async ({ ctx }) => {
      return getUserAccessProfile(ctx.user.openId);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.setHeader("Set-Cookie", createExpiredSessionCookie(ctx.req));
      return {
        success: true,
      } as const;
    }),
  }),

  security: router({
    roleMatrix: protectedProcedure.query(({ ctx }) => {
      const common = {
        dashboard: true,
        profile: true,
        documents: true,
      };

      if (ctx.user.role === "admin") {
        return {
          role: ctx.user.role,
          permissions: {
            ...common,
            manageUsers: true,
            manageClients: true,
            manageSites: true,
            manageProjects: true,
            manageContracts: true,
            manageInterventions: true,
            manageTechnicians: true,
          },
        };
      }

      if (ctx.user.role === "technicien") {
        return {
          role: ctx.user.role,
          permissions: {
            ...common,
            manageUsers: false,
            manageClients: false,
            manageSites: false,
            manageProjects: false,
            manageContracts: false,
            manageInterventions: true,
            manageTechnicians: false,
          },
        };
      }

      return {
        role: ctx.user.role,
        permissions: {
          ...common,
          manageUsers: false,
          manageClients: false,
          manageSites: false,
          manageProjects: false,
          manageContracts: false,
          manageInterventions: false,
          manageTechnicians: false,
        },
      };
    }),
    requireAdmin: adminProcedure.query(() => ({ authorized: true })),
    requireTechnician: protectedProcedure.query(({ ctx }) => {
      assertAllowedRole(ctx.user.role, ["admin", "technicien"]);
      return { authorized: true };
    }),
    requireClient: protectedProcedure.query(({ ctx }) => {
      assertAllowedRole(ctx.user.role, ["admin", "client"]);
      return { authorized: true };
    }),
  }),

  management: managementRouter,
});

export type AppRouter = typeof appRouter;
