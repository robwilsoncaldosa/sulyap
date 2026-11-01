import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { createTryOnHandler } from "./tryOn.js";

/** Serves /api/try-on/* from the Vite dev and preview servers, mirroring the Vercel functions. */
export function tryOnApi(env: Record<string, string | undefined>): Plugin {
  const handle = createTryOnHandler({
    apiKey: env.YOUCAM_API_KEY?.trim() || undefined,
    looksPerVisitorPerHour: Number(env.TRY_ON_LOOKS_PER_VISITOR_PER_HOUR) || undefined,
    looksPerDay: Number(env.TRY_ON_LOOKS_PER_DAY) || undefined,
  });
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/try-on")) return next();
    serve(req, res).catch(next);
  };
  async function serve(req: IncomingMessage, res: ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers))
      if (typeof value === "string") headers.set(name, value);
    const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
    });
    const response = await handle(request, { clientIp: req.socket.remoteAddress });
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  }
  return {
    name: "sulyap-try-on-api",
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}
