// npm run build:web  ->  genera dist/ con la versión web de IAcademy (Python corre en el navegador con stlite).
// Vercel ejecuta este script automáticamente (ver vercel.json).
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const DIST = path.join(RAIZ, "dist");
const STLITE = "1.9.2";
const ARCHIVOS_PY = ["app.py", "ia.py", "db.py", "exportar.py"];

// Tema: se toma de .streamlit/config.toml para que la web se vea igual que la app local.
function leerTema() {
  const tema = {};
  const ruta = path.join(RAIZ, ".streamlit", "config.toml");
  if (!fs.existsSync(ruta)) return tema;
  let enTema = false;
  for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const l = linea.trim();
    if (l.startsWith("[")) { enTema = l === "[theme]"; continue; }
    const m = l.match(/^(\w+)\s*=\s*['"]([^'"]*)['"]/);
    if (enTema && m) tema[`theme.${m[1]}`] = m[2];
  }
  return tema;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const archivo of ARCHIVOS_PY) fs.copyFileSync(path.join(RAIZ, archivo), path.join(DIST, archivo));

const opciones = {
  entrypoint: "app.py",
  requirements: ["PyPDF2", "python-docx", "requests"],
  files: Object.fromEntries(ARCHIVOS_PY.map((a) => [a, { url: `./${a}` }])),
  // Cursos, tareas y Pomodoros se guardan en el navegador de cada usuario (IndexedDB).
  idbfsMountpoints: ["/mnt/iacademy"],
  env: { IACADEMY_DB_PATH: "/mnt/iacademy/iacademy.db" },
  streamlitConfig: { ...leerTema(), "client.toolbarMode": "minimal" },
};

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IAcademy 🎓</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stlite/browser@${STLITE}/build/stlite.css" />
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #fff; }
    #cargando { display: flex; flex-direction: column; align-items: center; justify-content: center;
                height: 100vh; gap: 12px; color: #4C1D95; text-align: center; padding: 0 16px; }
    #cargando h1 { margin: 0; font-size: 2.2rem; color: #7C3AED; }
    #cargando p { margin: 0; color: #6B7280; }
  </style>
</head>
<body>
  <div id="root">
    <div id="cargando">
      <h1>IAcademy 🎓</h1>
      <p>Cargando tu asistente de estudio…</p>
      <p>La primera vez tarda entre 20 y 40 segundos: Python se está instalando en tu navegador.</p>
    </div>
  </div>
  <script type="module">
    import { mount } from "https://cdn.jsdelivr.net/npm/@stlite/browser@${STLITE}/build/stlite.js";
    mount(${JSON.stringify(opciones, null, 2)}, document.getElementById("root"));
  </script>
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, "index.html"), html);
console.log(`✅ Versión web generada en dist/ (${ARCHIVOS_PY.length} archivos Python + index.html)`);
