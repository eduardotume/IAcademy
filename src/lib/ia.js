// Única puerta de entrada a la IA desde el frontend: todo pasa por /api/gemini.
import { leer } from "./almacen.js";

function cabeceras() {
  const h = { "Content-Type": "application/json" };
  const clave = leer("apiKey", "");
  if (clave) h["x-user-api-key"] = clave;
  return h;
}

export async function generar({ prompt, sistema, historial, archivos }) {
  const r = await fetch("/api/gemini", {
    method: "POST",
    headers: cabeceras(),
    body: JSON.stringify({ prompt, sistema, historial, archivos, modelo: leer("modelo", "") || undefined }),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 413) throw new Error("El archivo es muy pesado. Prueba con uno más pequeño.");
    throw new Error(datos.error || `Error ${r.status} al llamar a la IA.`);
  }
  return datos.texto;
}

const cacheConfig = new Map();

// Pregunta al servidor si ya tiene API key y qué modelos hay. Se guarda en memoria por cada clave.
export function obtenerConfig() {
  const clave = leer("apiKey", "");
  if (!cacheConfig.has(clave)) {
    cacheConfig.set(
      clave,
      fetch("/api/config", { headers: cabeceras() })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .catch(() => {
          cacheConfig.delete(clave);
          return { claveEnServidor: false, modeloPorDefecto: "gemini-3.5-flash", modelos: [] };
        })
    );
  }
  return cacheConfig.get(clave);
}
