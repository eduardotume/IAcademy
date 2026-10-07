// npm run web  ->  genera dist/ y lo sirve en http://localhost:3000 para probar la versión de Vercel en tu PC.
const http = require("http");
const fs = require("fs");
const path = require("path");
require("./build-web");

const DIST = path.resolve(__dirname, "..", "dist");
const PUERTO = Number(process.env.PORT) || 3000;
const TIPOS = { ".html": "text/html; charset=utf-8", ".py": "text/plain; charset=utf-8", ".js": "text/javascript" };

http
  .createServer((req, res) => {
    const ruta = decodeURIComponent(req.url.split("?")[0]);
    const archivo = path.join(DIST, ruta === "/" ? "index.html" : ruta);
    if (!archivo.startsWith(DIST) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404);
      return res.end("No encontrado");
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
    fs.createReadStream(archivo).pipe(res);
  })
  .listen(PUERTO, () => console.log(`🌐 Versión web en http://localhost:${PUERTO}  (Ctrl + C para detener)`));
