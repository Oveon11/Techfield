import type { IncomingMessage, ServerResponse } from "http";
import { createTechfieldApp } from "../server/_core/app";

const app = createTechfieldApp();

function rewriteUrl(req: IncomingMessage) {
  const currentUrl = req.url ?? "/";
  const url = new URL(currentUrl, "http://localhost");
  const route = url.searchParams.get("route");

  if (!route) {
    return;
  }

  url.searchParams.delete("route");
  const pathname = route.startsWith("/") ? route : `/${route}`;
  const query = url.searchParams.toString();
  req.url = `${pathname}${query ? `?${query}` : ""}`;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  rewriteUrl(req);
  return app(req as any, res as any);
}
