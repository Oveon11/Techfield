// Storage helpers backed by Supabase Storage.
// The legacy Manus Forge presigned-URL flow was removed during the Plan B
// migration; Supabase is now the only supported backend.

import { SUPABASE_ENV } from "./integrations/supabase/env";
import {
  createTechfieldSignedUrl,
  TECHFIELD_STORAGE_BUCKET,
  uploadTechfieldDocument,
} from "./integrations/supabase/storage/admin";

function assertSupabaseConfigured(): void {
  if (!SUPABASE_ENV.isConfigured) {
    throw new Error(
      "Storage config missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  assertSupabaseConfigured();
  const key = appendHashSuffix(normalizeKey(relKey));

  const fileBuffer =
    typeof data === "string"
      ? Buffer.from(data)
      : data instanceof Uint8Array
        ? data
        : Buffer.from(data);

  const uploaded = await uploadTechfieldDocument({
    path: key,
    file: fileBuffer,
    contentType,
  });

  return {
    key: uploaded.path,
    url: `supabase://${TECHFIELD_STORAGE_BUCKET}/${uploaded.path}`,
  };
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  assertSupabaseConfigured();
  const key = normalizeKey(relKey);
  const signed = await createTechfieldSignedUrl(key);
  return { key, url: signed.signedUrl };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  assertSupabaseConfigured();
  const key = normalizeKey(relKey);
  const signed = await createTechfieldSignedUrl(key);
  return signed.signedUrl;
}
