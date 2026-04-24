import { describe, expect, it } from "vitest";
import { getUserAccessProfile, getUserByOpenId } from "./db";

describe("db runtime Supabase", () => {
  it("lit un utilisateur seedé depuis Supabase par openId", async () => {
    const user = await getUserByOpenId("test-admin-001");

    expect(user).toBeTruthy();
    expect(user?.openId).toBe("test-admin-001");
    expect(user?.role).toBe("admin");
  });

  it("reconstruit le profil d'accès complet depuis Supabase", async () => {
    const profile = await getUserAccessProfile("test-admin-001");

    expect(profile).toBeTruthy();
    expect(profile?.user.openId).toBe("test-admin-001");
    expect(profile?.user.role).toBe("admin");
    expect(profile?.technicianProfile).toBeTruthy();
  });
});
