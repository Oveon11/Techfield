import type { IncomingMessage, ServerResponse } from "http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appSpy = vi.fn();

vi.mock("../server/_core/app", () => ({
  createTechfieldApp: () => appSpy,
}));

describe("point d’entrée Vercel unifié", () => {
  beforeEach(() => {
    appSpy.mockReset();
  });

  it("reconstruit le chemin tRPC avant de déléguer à l’application Express", async () => {
    const { default: handler } = await import("../api/index");
    const req = {
      url: "/api?route=api/trpc/auth.me&batch=1&input=test",
    } as IncomingMessage;
    const res = {} as ServerResponse;

    handler(req, res);

    expect(req.url).toBe("/api/trpc/auth.me?batch=1&input=test");
    expect(appSpy).toHaveBeenCalledWith(req, res);
  });

  it("reconstruit aussi le chemin manus-storage avant délégation", async () => {
    const { default: handler } = await import("../api/index");
    const req = {
      url: "/api?route=manus-storage/client%2Fdocs%2Fplan.pdf",
    } as IncomingMessage;
    const res = {} as ServerResponse;

    handler(req, res);

    expect(req.url).toBe("/manus-storage/client/docs/plan.pdf");
    expect(appSpy).toHaveBeenCalledWith(req, res);
  });
});
