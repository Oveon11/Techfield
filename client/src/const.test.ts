import { describe, expect, it } from "vitest";
import { resolveLoginConfig } from "./const";

describe("resolveLoginConfig", () => {
  it("utilise les variables fournies quand elles existent", () => {
    const result = resolveLoginConfig(
      {
        VITE_OAUTH_PORTAL_URL: "https://auth.example.com",
        VITE_APP_ID: "app-123",
      },
      "https://techfield.vercel.app",
    );

    expect(result).toEqual({
      oauthPortalUrl: "https://auth.example.com",
      appId: "app-123",
      redirectUri: "https://techfield.vercel.app/api/oauth/callback",
    });
  });

  it("retombe sur des valeurs sûres quand les variables Vite manquent", () => {
    const result = resolveLoginConfig({}, "https://techfield.vercel.app");

    expect(result).toEqual({
      oauthPortalUrl: "https://manus.im",
      appId: "5GuoYJQWcigGPxU2N6Bgn5",
      redirectUri: "https://techfield.vercel.app/api/oauth/callback",
    });
  });
});
