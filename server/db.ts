import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { clientContacts, InsertUser, technicians, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
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
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by id: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function getTechnicianByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get technician profile: database not available");
    return undefined;
  }

  const result = await db.select().from(technicians).where(eq(technicians.userId, userId)).limit(1);
  return result[0];
}

export async function getClientContactByUserId(userId: number) {
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
