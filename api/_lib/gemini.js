// Lógica compartida para hablar con Google Gemini desde el servidor.
// La usan las funciones de Vercel (api/*.js) y el servidor de desarrollo de Vite.

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const MODELO_POR_DEFECTO = process.env.GEMINI_MODEL || "gemini-3.5-flash";
export const MODELOS_RESPALDO = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];

const SISTEMA_BASE =
  "Eres IAcademy, un asistente universitario amigable y experto. " +
  "Respondes siempre en español, con explicaciones claras, ordenadas y ejemplos cotidianos.";

export class ErrorIA extends Error {
  constructor(mensaje, estado = 500) {
    super(mensaje);
    this.estado = estado;
  }
}

export function obtenerClave(cabeceras = {}) {
  const deUsuario = cabeceras["x-user-api-key"];
  return process.env.GEMINI_API_KEY || (Array.isArray(deUsuario) ? deUsuario[0] : deUsuario) || "";
}

function traducirError(estado, cuerpo, modelo) {
  const texto = JSON.stringify(cuerpo || {});
  if (estado === 400 && /API_KEY_INVALID|API key not valid/i.test(texto))
    return new ErrorIA("La API key de Gemini no es válida. Revísala en Google AI Studio.", 401);
  if (estado === 403) return new ErrorIA("La API key no tiene permiso para usar Gemini.", 403);
  if (estado === 404) return new ErrorIA(`El modelo "${modelo}" no está disponible. Elige otro en Ajustes.`, 404);
  if (estado === 429) return new ErrorIA("Se alcanzó el límite gratuito de Gemini. Espera un minuto e inténtalo de nuevo.", 429);
  const detalle = cuerpo?.error?.message || `error ${estado}`;
  return new ErrorIA(`Problema al comunicarse con Gemini: ${detalle}`, 502);
}

/**
 * prompt:    instrucción en texto
 * sistema:   instrucción de sistema (opcional)
 * historial: [{ role: "user" | "assistant", content }]
 * archivos:  [{ mimeType, data (base64) }]  → audio o imagen
 */
export async function generar({ prompt, sistema, historial = [], archivos = [], modelo }, clave) {
  if (!clave) throw new ErrorIA("Falta la API key de Gemini. Configúrala en Vercel (GEMINI_API_KEY) o en Ajustes.", 400);
  if (!prompt || typeof prompt !== "string") throw new ErrorIA("La solicitud no tiene texto.", 400);
  modelo = modelo || MODELO_POR_DEFECTO;

  const contents = historial.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: String(m.content) }],
  }));
  contents.push({
    role: "user",
    parts: [{ text: prompt }, ...archivos.map((a) => ({ inlineData: { mimeType: a.mimeType, data: a.data } }))],
  });

  const respuesta = await fetch(`${BASE}/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema || SISTEMA_BASE }] }, contents }),
  });
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw traducirError(respuesta.status, cuerpo, modelo);

  const partes = cuerpo?.candidates?.[0]?.content?.parts || [];
  const texto = partes.map((p) => p.text || "").join("");
  if (!texto) throw new ErrorIA("Gemini no devolvió texto. Intenta reformular o usar otro archivo.", 502);
  return texto;
}

export async function listarModelos(clave) {
  if (!clave) return MODELOS_RESPALDO;
  try {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": clave } });
    if (!r.ok) return MODELOS_RESPALDO;
    const { models = [] } = await r.json();
    const nombres = models
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace("models/", ""))
      .filter((n) => n.startsWith("gemini") && n.includes("flash"));
    return nombres.length ? [...new Set(nombres)].sort().reverse() : MODELOS_RESPALDO;
  } catch {
    return MODELOS_RESPALDO;
  }
}
