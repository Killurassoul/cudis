import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function localAdminGateway(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: "cudis-local-admin-gateway",
    apply: "serve",
    config(_, { mode }) {
      env = loadEnv(mode, process.cwd(), "");
    },
    configureServer(server) {
      server.middlewares.use("/api/admin.php", (req, res, next) => {
        void (async () => {
          const action = new URLSearchParams(req.url?.split("?")[1] ?? "").get("action");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          if (action === "session" && req.method === "GET") {
            res.statusCode = 200;
            res.end(JSON.stringify({ email: "Admin local" }));
            return;
          }
          if (action === "logout" && req.method === "POST") {
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          if (action !== "proxy" || req.method !== "POST") {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Route locale inconnue." }));
            return;
          }

          const baseUrl = env["VITE_SUPABASE_URL"];
          const secret = env["CUDIS_LOCAL_SUPABASE_SECRET_KEY"];
          if (!baseUrl || !secret) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: "Ajoute VITE_SUPABASE_URL et CUDIS_LOCAL_SUPABASE_SECRET_KEY dans .env.local, puis relance npm run dev." }));
            return;
          }
          const method = String(req.headers["x-admin-target-method"] ?? "").toUpperCase();
          const path = String(req.headers["x-admin-target-path"] ?? "");
          const restAllowed = /^\/rest\/v1\/(members|programs|partners|resources|contact_submissions|assistant_knowledge)(\?.*)?$/.test(path);
          const storageAllowed = /^\/storage\/v1\/object\/(member-photos|partner-logos|resources)\/[A-Za-z0-9._/-]+$/.test(path) && !path.includes("..");
          if (!(["GET", "POST", "PATCH", "DELETE"].includes(method)) || (!restAllowed && !storageAllowed)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Cette opération admin locale n’est pas autorisée." }));
            return;
          }
          const targetHeaders = new Headers({ apikey: secret });
          if (!secret.startsWith("sb_secret_")) targetHeaders.set("Authorization", `Bearer ${secret}`);
          for (const name of ["content-type", "prefer", "accept", "range", "content-range", "x-upsert", "cache-control"]) {
            const value = req.headers[`x-admin-${name}`];
            if (typeof value === "string") targetHeaders.set(name, value);
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const body = Buffer.concat(chunks);
          try {
            const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
              method,
              headers: targetHeaders,
              ...(body.length && !["GET", "HEAD"].includes(method) ? { body: new Uint8Array(body) } : {}),
            });
            res.statusCode = upstream.status;
            const contentType = upstream.headers.get("content-type");
            const contentRange = upstream.headers.get("content-range");
            if (contentType) res.setHeader("Content-Type", contentType);
            if (contentRange) res.setHeader("Content-Range", contentRange);
            res.end(Buffer.from(await upstream.arrayBuffer()));
          } catch (error) {
            console.error("Local admin proxy failed", error);
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "Supabase est injoignable depuis le serveur local." }));
          }
        })().catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localAdminGateway()],
  resolve: { tsconfigPaths: true },
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: "127.0.0.1" },
});
