// Busca el Python del entorno conda de IAcademy sin necesidad de "conda activate".
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ENV = process.env.IACADEMY_ENV || "iacademy";
const WIN = process.platform === "win32";
const RAIZ = path.resolve(__dirname, "..");

function raicesConda() {
  const home = os.homedir();
  const raices = [];
  if (process.env.CONDA_EXE) raices.push(path.resolve(path.dirname(process.env.CONDA_EXE), ".."));
  if (process.env.CONDA_PREFIX) {
    const p = process.env.CONDA_PREFIX;
    raices.push(path.basename(path.dirname(p)) === "envs" ? path.resolve(p, "..", "..") : p);
  }
  for (const nombre of ["anaconda3", "miniconda3", "miniforge3", "mambaforge"]) {
    raices.push(path.join(home, nombre));
    if (WIN) {
      raices.push(path.join("C:\\ProgramData", nombre));
      if (process.env.LOCALAPPDATA) raices.push(path.join(process.env.LOCALAPPDATA, nombre));
    } else {
      raices.push(path.join(home, "opt", nombre), path.join("/opt", nombre));
    }
  }
  return [...new Set(raices)];
}

function pythonDe(carpeta) {
  return WIN ? path.join(carpeta, "python.exe") : path.join(carpeta, "bin", "python");
}

function buscarPython() {
  if (process.env.IACADEMY_PYTHON) return process.env.IACADEMY_PYTHON;
  if (process.env.CONDA_PREFIX && path.basename(process.env.CONDA_PREFIX) === ENV) {
    const py = pythonDe(process.env.CONDA_PREFIX);
    if (fs.existsSync(py)) return py;
  }
  for (const raiz of raicesConda()) {
    const py = pythonDe(path.join(raiz, "envs", ENV));
    if (fs.existsSync(py)) return py;
  }
  return null;
}

function buscarConda() {
  if (process.env.CONDA_EXE && fs.existsSync(process.env.CONDA_EXE)) return process.env.CONDA_EXE;
  for (const raiz of raicesConda()) {
    const candidatos = WIN
      ? [path.join(raiz, "Scripts", "conda.exe"), path.join(raiz, "condabin", "conda.bat")]
      : [path.join(raiz, "bin", "conda"), path.join(raiz, "condabin", "conda")];
    for (const c of candidatos) if (fs.existsSync(c)) return c;
  }
  const probe = spawnSync("conda", ["--version"], { shell: true, stdio: "ignore" });
  return probe.status === 0 ? "conda" : null;
}

function ejecutar(cmd, args, opciones = {}) {
  const usarShell = cmd === "conda" || cmd.toLowerCase().endsWith(".bat");
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(usarShell ? `"${cmd}"` : cmd, args, {
    stdio: "inherit",
    cwd: RAIZ,
    shell: usarShell,
    ...opciones,
  });
  if (r.error) throw r.error;
  return r.status;
}

module.exports = { ENV, WIN, RAIZ, buscarPython, buscarConda, ejecutar };
