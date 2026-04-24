import { COOKIE_NAME } from "@shared/const";
import { serialize as serializeCookie } from "cookie";
import type { IncomingMessage } from "http";

type RequestLike = IncomingMessage & {
  protocol?: string;
  hostname?: string;
};

export type SessionCookieOptions = {
  domain?: string;
  httpOnly: boolean;
  path: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  maxAge?: number;
  expires?: Date;
};

function isSecureRequest(req: RequestLike) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some((proto: string) => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(req: RequestLike): SessionCookieOptions {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}

export function createExpiredSessionCookie(req: RequestLike) {
  return serializeCookie(COOKIE_NAME, "", {
    ...getSessionCookieOptions(req),
    maxAge: 0,
    expires: new Date(0),
  });
}
