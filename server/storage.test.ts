import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabaseEnv = {
  isConfigured: false,
};

const mockUploadTechfieldDocument = vi.fn();
const mockCreateTechfieldSignedUrl = vi.fn();

vi.mock("./integrations/supabase/env", () => ({
  SUPABASE_ENV: mockSupabaseEnv,
}));

vi.mock("./integrations/supabase/storage/admin", () => ({
  TECHFIELD_STORAGE_BUCKET: "techfield-documents",
  uploadTechfieldDocument: mockUploadTechfieldDocument,
  createTechfieldSignedUrl: mockCreateTechfieldSignedUrl,
}));

describe("storage (Supabase-only)", () => {
  beforeEach(() => {
    mockSupabaseEnv.isConfigured = false;
    mockUploadTechfieldDocument.mockReset();
    mockCreateTechfieldSignedUrl.mockReset();
    vi.restoreAllMocks();
  });

  it("uploads via Supabase when configured", async () => {
    mockSupabaseEnv.isConfigured = true;
    mockUploadTechfieldDocument.mockResolvedValue({ path: "techfield/file.pdf" });

    const { storagePut } = await import("./storage");
    const result = await storagePut(
      "techfield/file.pdf",
      Buffer.from("demo"),
      "application/pdf",
    );

    expect(mockUploadTechfieldDocument).toHaveBeenCalledWith({
      path: expect.stringMatching(/^techfield\/file_[a-f0-9]{8}\.pdf$/),
      file: expect.any(Uint8Array),
      contentType: "application/pdf",
    });
    expect(result).toEqual({
      key: "techfield/file.pdf",
      url: "supabase://techfield-documents/techfield/file.pdf",
    });
  });

  it("throws when Supabase is not configured", async () => {
    mockSupabaseEnv.isConfigured = false;

    const { storagePut } = await import("./storage");
    await expect(
      storagePut("reports/photo.png", Buffer.from("demo"), "image/png"),
    ).rejects.toThrow(/SUPABASE_URL/);
  });

  it("returns a signed Supabase URL when storageGet runs with Supabase configured", async () => {
    mockSupabaseEnv.isConfigured = true;
    mockCreateTechfieldSignedUrl.mockResolvedValue({
      signedUrl: "https://supabase.example.test/signed/file",
    });

    const { storageGet } = await import("./storage");
    const result = await storageGet("techfield/file.pdf");

    expect(mockCreateTechfieldSignedUrl).toHaveBeenCalledWith("techfield/file.pdf");
    expect(result).toEqual({
      key: "techfield/file.pdf",
      url: "https://supabase.example.test/signed/file",
    });
  });
});
