import { createSupabaseAdminClient } from "../db/admin";

export const TECHFIELD_STORAGE_BUCKET = "techfield-documents";

export async function uploadTechfieldDocument(params: {
  path: string;
  file: ArrayBuffer | Uint8Array;
  contentType: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(TECHFIELD_STORAGE_BUCKET)
    .upload(params.path, params.file, {
      contentType: params.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }

  return data;
}

export async function createTechfieldSignedUrl(path: string, expiresIn = 60 * 10) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(TECHFIELD_STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Supabase signed URL generation failed: ${error.message}`);
  }

  return data;
}
