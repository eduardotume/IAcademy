// POST /api/gemini  →  { texto }
import { ErrorIA, generar, obtenerClave } from "./_lib/gemini.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST." });
  try {
    const cuerpo = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const texto = await generar(cuerpo, obtenerClave(req.headers));
    res.status(200).json({ texto });
  } catch (e) {
    const estado = e instanceof ErrorIA ? e.estado : 500;
    res.status(estado).json({ error: e.message || "Error inesperado." });
  }
}
