// npm run setup         -> crea el entorno conda "iacademy" e instala todo
// npm run setup:local   -> además instala transformers + torch para el modelo local
const { ENV, buscarPython, buscarConda, ejecutar } = require("./entorno");

const conLocal = process.argv.includes("--local");

function fallar(mensaje) {
  console.error(`\n❌ ${mensaje}\n`);
  process.exit(1);
}

let python = buscarPython();

if (!python) {
  const conda = buscarConda();
  if (!conda) fallar("No encontré Anaconda. Instálalo desde https://www.anaconda.com/download y vuelve a intentar.");
  console.log(`\n📦 Creando el entorno "${ENV}" con Python 3.11...`);
  if (ejecutar(conda, ["create", "-n", ENV, "python=3.11", "-y"]) !== 0) fallar("No se pudo crear el entorno.");
  python = buscarPython();
  if (!python) fallar("El entorno se creó, pero no encontré su Python. Ábrelo con Anaconda Prompt y vuelve a intentar.");
}

const conda = buscarConda();
if (conda) {
  // Librerías con DLLs desde conda-forge: evita el bloqueo del "Control inteligente de aplicaciones" de Windows.
  console.log("\n📦 Instalando librerías base desde conda-forge...");
  ejecutar(conda, ["install", "-n", ENV, "-c", "conda-forge", "pandas", "numpy", "pyarrow", "pillow", "-y"]);
}

// Sin "-U": así pip no reemplaza las librerías de conda-forge por las de PyPI (que Windows puede bloquear).
console.log("\n📦 Instalando dependencias de IAcademy...");
if (ejecutar(python, ["-m", "pip", "install", "-r", "requirements.txt"]) !== 0) fallar("Falló pip install.");

if (conLocal) {
  console.log("\n📦 Instalando dependencias del modelo local (puede tardar)...");
  if (ejecutar(python, ["-m", "pip", "install", "-r", "requirements-local.txt"]) !== 0) fallar("Falló la instalación del modelo local.");
}

console.log("\n✅ Todo listo. Ahora ejecuta:  npm run dev\n");
