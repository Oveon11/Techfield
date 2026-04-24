export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const DEFAULT_OAUTH_PORTAL_URL = "https://manus.im";
const DEFAULT_APP_ID = "5GuoYJQWcigGPxU2N6Bgn5";

type LoginEnv = Record<string, unknown> & {
  VITE_OAUTH_PORTAL_URL?: string;
  VITE_APP_ID?: string;
};

export function resolveLoginConfig(env: LoginEnv, origin: string) {
  const oauthPortalUrl =
    typeof env.VITE_OAUTH_PORTAL_URL === "string" && env.VITE_OAUTH_PORTAL_URL.trim().length > 0
      ? env.VITE_OAUTH_PORTAL_URL
      : DEFAULT_OAUTH_PORTAL_URL;

  const appId =
    typeof env.VITE_APP_ID === "string" && env.VITE_APP_ID.trim().length > 0
      ? env.VITE_APP_ID
      : DEFAULT_APP_ID;

  const redirectUri = new URL("/api/oauth/callback", origin).toString();

  return {
    oauthPortalUrl,
    appId,
    redirectUri,
  };
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const { oauthPortalUrl, appId, redirectUri } = resolveLoginConfig(
    import.meta.env,
    window.location.origin,
  );
  const state = btoa(redirectUri);

  const url = new URL("/app-auth", oauthPortalUrl);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
