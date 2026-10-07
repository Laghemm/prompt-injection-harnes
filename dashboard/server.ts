import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/config";
import { createApiV2Router } from "./apiV2";

/**
 * Blocks cross-site requests to this local server: a web page you visit must not be able to
 * make the harness send requests on its behalf (CSRF / DNS rebinding).
 */
function localOnly(port: number) {
  const hostOk = new RegExp(`^(localhost|127\\.0\\.0\\.1)(:${port})?$`);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hostOk.test(req.headers.host ?? "")) return res.status(403).json({ error: "Forbidden host" });
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (!hostOk.test(new URL(origin).host)) return res.status(403).json({ error: "Forbidden origin" });
      } catch {
        return res.status(403).json({ error: "Forbidden origin" });
      }
    }
    if (req.method === "POST" && !req.is("application/json")) {
      return res.status(415).json({ error: "JSON only" });
    }
    next();
  };
}

export function startDashboard(port: number) {
  const app = express();

  app.use(localOnly(port));
  app.use(express.json({ limit: "100kb" }));

  // The adaptive-engine dashboard (webapp/) talks to this, read-only JSON over /api/v2/*.
  app.use("/api/v2", createApiV2Router());

  const webappDist = path.join(ROOT, "webapp", "dist");
  // Any unmatched /api/* request is a real 404, never the SPA's index.html.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  if (fs.existsSync(webappDist)) {
    app.use(express.static(webappDist));
    // SPA fallback: any other route serves index.html so client-side routing (e.g. /findings/F-123) survives a refresh.
    app.get("/*splat", (_req, res) => res.sendFile(path.join(webappDist, "index.html")));
  } else {
    app.get("/", (_req, res) =>
      res.status(503).send("Dashboard not built yet. Run `npm run build:webapp` (or `npm run dev:webapp` for live development)."),
    );
    console.log("Dashboard not built yet — run `npm run build:webapp` (or `npm run dev:webapp` for live development).");
  }

  // Local-only: results contain model outputs and the form can carry tokens, so never expose this on the network.
  app.listen(port, "127.0.0.1", () => console.log(`Dashboard: http://localhost:${port}`));
}
