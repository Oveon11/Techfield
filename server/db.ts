import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { clientContacts, InsertUser, technicians, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { createSupabaseAdminClient } from "./integrations/supabase/db/admin";
import { SUPABASE_ENV } from "./integrations/supabase/env";

let _db: ReturnType<typeof drizzle> | null = null;

function hasSupabaseRuntime() {
  return SUPABASE_ENV.isConfigured;
}

type RuntimeUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  loginMethod: string | null;
  role: "admin" | "technicien" | "client";
  accountStatus: "active" | "invited" | "suspended";
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type RuntimeTechnician = {
  id: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  skills: unknown;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RuntimeClientContact = {
  id: number;
  clientId: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  contactType: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : new Date(0);
}

function mapSupabaseUserRow(row: Record<string, unknown>): RuntimeUser {
  return {
    id: Number(row.id),
    openId: String(row.open_id ?? ""),
    name: (row.name as string | null | undefined) ?? null,
    email: (row.email as string | null | undefined) ?? null,
    phone: (row.phone as string | null | undefined) ?? null,
    loginMethod: (row.login_method as string | null | undefined) ?? null,
    role: ((row.role as RuntimeUser["role"] | undefined) ?? "client"),
    accountStatus: ((row.account_status as RuntimeUser["accountStatus"] | undefined) ?? "active"),
    avatarUrl: (row.avatar_url as string | null | undefined) ?? null,
    createdAt: toDate(row.created_at as string | null | undefined),
    updatedAt: toDate(row.updated_at as string | null | undefined),
    lastSignedIn: toDate(row.last_signed_in as string | null | undefined),
  };
}

function mapSupabaseTechnicianRow(row: Record<string, unknown>): RuntimeTechnician {
  return {
    id: Number(row.id),
    userId: row.user_id == null ? null : Number(row.user_id),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    email: (row.email as string | null | undefined) ?? null,
    phone: (row.phone as string | null | undefined) ?? null,
    employeeCode: (row.employee_code as string | null | undefined) ?? null,
    skills: row.skills ?? null,
    notes: (row.notes as string | null | undefined) ?? null,
    isActive: Boolean(row.is_active),
    createdAt: toDate(row.created_at as string | null | undefined),
    updatedAt: toDate(row.updated_at as string | null | undefined),
  };
}

function mapSupabaseClientContactRow(row: Record<string, unknown>): RuntimeClientContact {
  return {
    id: Number(row.id),
    clientId: Number(row.client_id),
    userId: row.user_id == null ? null : Number(row.user_id),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    email: (row.email as string | null | undefined) ?? null,
    phone: (row.phone as string | null | undefined) ?? null,
    jobTitle: (row.job_title as string | null | undefined) ?? null,
    contactType: String(row.contact_type ?? "principal"),
    isPrimary: Boolean(row.is_primary),
    createdAt: toDate(row.created_at as string | null | undefined),
    updatedAt: toDate(row.updated_at as string | null | undefined),
  };
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }

  return _db;
}

async function getSupabaseUserByOpenId(openId: string): Promise<RuntimeUser | undefined> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, open_id, name, email, phone, login_method, role, account_status, avatar_url, created_at, updated_at, last_signed_in")
    .eq("open_id", openId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseUserRow(data as Record<string, unknown>) : undefined;
}

async function getSupabaseUserById(userId: number): Promise<RuntimeUser | undefined> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, open_id, name, email, phone, login_method, role, account_status, avatar_url, created_at, updated_at, last_signed_in")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseUserRow(data as Record<string, unknown>) : undefined;
}

async function getSupabaseUserByEmail(email: string): Promise<RuntimeUser | undefined> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, open_id, name, email, phone, login_method, role, account_status, avatar_url, created_at, updated_at, last_signed_in")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseUserRow(data as Record<string, unknown>) : undefined;
}

async function getSupabaseTechnicianByUserId(userId: number): Promise<RuntimeTechnician | undefined> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("technicians")
    .select("id, user_id, first_name, last_name, email, phone, employee_code, skills, notes, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseTechnicianRow(data as Record<string, unknown>) : undefined;
}

async function getSupabaseClientContactByUserId(userId: number): Promise<RuntimeClientContact | undefined> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("client_contacts")
    .select("id, client_id, user_id, first_name, last_name, email, phone, job_title, contact_type, is_primary, created_at, updated_at")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseClientContactRow(data as Record<string, unknown>) : undefined;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  if (hasSupabaseRuntime()) {
    const supabase = createSupabaseAdminClient();
    const existing = await getSupabaseUserByOpenId(user.openId);

    const payload = {
      open_id: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
      login_method: user.loginMethod ?? null,
      role: user.role ?? (existing?.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "client")),
      account_status: user.accountStatus ?? existing?.accountStatus ?? "active",
      avatar_url: user.avatarUrl ?? existing?.avatarUrl ?? null,
      last_signed_in: (user.lastSignedIn ?? new Date()).toISOString(),
    };

    const { error } = existing
      ? await supabase.from("users").update(payload).eq("id", existing.id)
      : await supabase.from("users").insert(payload);

    if (error) {
      console.error("[Supabase] Failed to upsert user:", error);
      throw error;
    }

    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const nullableTextFields = ["name", "email", "phone", "loginMethod", "avatarUrl"] as const;
    type NullableTextField = (typeof nullableTextFields)[number];

    const assignNullable = (field: NullableTextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    nullableTextFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    if (user.accountStatus !== undefined) {
      values.accountStatus = user.accountStatus;
      updateSet.accountStatus = user.accountStatus;
    }

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.accountStatus) {
      values.accountStatus = "active";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  if (hasSupabaseRuntime()) {
    return getSupabaseUserByOpenId(openId);
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(userId: number) {
  if (hasSupabaseRuntime()) {
    return getSupabaseUserById(userId);
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by id: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  if (hasSupabaseRuntime()) {
    return getSupabaseUserByEmail(email);
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function resolveUserFromSupabaseIdentity(identity: {
  authUserId?: string | null;
  openId?: string | null;
  email?: string | null;
  name?: string | null;
}) {
  const normalizedEmail = identity.email?.trim().toLowerCase() || null;
  const normalizedOpenId = identity.openId?.trim() || null;

  if (normalizedOpenId) {
    const existingByOpenId = await getUserByOpenId(normalizedOpenId);
    if (existingByOpenId) {
      await upsertUser({
        openId: normalizedOpenId,
        email: normalizedEmail,
        name: identity.name ?? existingByOpenId.name,
        loginMethod: "supabase",
        lastSignedIn: new Date(),
      });
      return getUserByOpenId(normalizedOpenId);
    }
  }

  if (normalizedEmail) {
    const existingByEmail = await getUserByEmail(normalizedEmail);
    if (existingByEmail) {
      await upsertUser({
        openId: existingByEmail.openId,
        email: normalizedEmail,
        name: identity.name ?? existingByEmail.name,
        loginMethod: "supabase",
        lastSignedIn: new Date(),
      });
      return getUserByOpenId(existingByEmail.openId);
    }
  }

  const fallbackOpenId = normalizedOpenId || (identity.authUserId ? `supabase:${identity.authUserId}` : null);
  if (!fallbackOpenId) {
    return null;
  }

  await upsertUser({
    openId: fallbackOpenId,
    email: normalizedEmail,
    name: identity.name ?? null,
    loginMethod: "supabase",
    lastSignedIn: new Date(),
  });

  return getUserByOpenId(fallbackOpenId);
}

export async function getTechnicianByUserId(userId: number) {
  if (hasSupabaseRuntime()) {
    return getSupabaseTechnicianByUserId(userId);
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get technician profile: database not available");
    return undefined;
  }

  const result = await db.select().from(technicians).where(eq(technicians.userId, userId)).limit(1);
  return result[0];
}

export async function getClientContactByUserId(userId: number) {
  if (hasSupabaseRuntime()) {
    return getSupabaseClientContactByUserId(userId);
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get client contact profile: database not available");
    return undefined;
  }

  const result = await db.select().from(clientContacts).where(eq(clientContacts.userId, userId)).limit(1);
  return result[0];
}

export async function getUserAccessProfile(openId: string) {
  const user = await getUserByOpenId(openId);
  if (!user) return null;

  const [technicianProfile, clientContactProfile] = await Promise.all([
    getTechnicianByUserId(user.id),
    getClientContactByUserId(user.id),
  ]);

  return {
    user,
    technicianProfile: technicianProfile ?? null,
    clientContactProfile: clientContactProfile ?? null,
  };
}
