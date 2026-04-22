import type { IncomingMessage, ServerResponse } from "http";
import { createTechfieldApp } from "../server/_core/app";

const app = createTechfieldApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as any, res as any);
}
