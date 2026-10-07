// npm run dev  ->  abre IAcademy con el Python del entorno "iacademy" (sin conda activate).
const { spawn, spawnSync } = require("child_process");
const { ENV, WIN, RAIZ, buscarPython } = require("./entorno");

let python = buscarPython();
if (!python) {
  console.warn(`\n⚠️  No encontré el entorno conda "${ENV}". Intentaré con el Python del sistema.`);
  console.warn("   Si falla, ejecuta primero:  npm run setup\n");
  python = WIN ? "python" : "python3";
}

const prueba = spawnSync(python, ["-c", "import streamlit, google.genai"], { stdio: "ignore" });
if (prueba.status !== 0) {
  console.error(`\n❌ Faltan dependencias en: ${python}`);
  console.error("   Ejecuta:  npm run setup\n");
  process.exit(1);
}

console.log(`\n🎓 IAcademy · usando ${python}`);
console.log("   Cambios en el código se recargan solos. Ctrl + C para detener.\n");

const extra = process.argv.slice(2);
const app = spawn(
  python,
  ["-m", "streamlit", "run", "app.py", "--server.runOnSave", "true", "--browser.gatherUsageStats", "false", ...extra],
  { stdio: "inherit", cwd: RAIZ }
);

const detener = () => app.kill("SIGINT");
process.on("SIGINT", detener);
process.on("SIGTERM", detener);
app.on("exit", (codigo) => process.exit(codigo ?? 0));
