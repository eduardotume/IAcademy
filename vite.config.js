import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo (npm run dev) Vite responde /api/* con las mismas funciones que usa Vercel,
// así la app funciona igual en tu PC y en producción.
function apiLocal() {
  return {
    name: "iacademy-api-local",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const ruta = req.url.split("?")[0];
        if (!ruta.startsWith("/api/") || ruta.includes("/_")) return next();
        try {
          const modulo = await server.ssrLoadModule(`/api${ruta.slice(4)}.js`);
          let datos = "";
          for await (const trozo of req) datos += trozo;
          req.body = datos ? JSON.parse(datos) : {};
          res.status = (codigo) => ((res.statusCode = codigo), res);
          res.json = (obj) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(obj));
          };
          await modulo.default(req, res);
        } catch (e) {
          if (e.code === "ERR_LOAD_URL" || /Failed to load url/.test(e.message)) return next();
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), apiLocal()],
    server: { port: 5173, open: true },
  };
});
