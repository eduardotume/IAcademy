// GET /api/config  →  { claveEnServidor, modeloPorDefecto, modelos }
import { MODELO_POR_DEFECTO, listarModelos, obtenerClave } from "./_lib/gemini.js";

export default async function handler(req, res) {
  const clave = obtenerClave(req.headers);
  res.status(200).json({
    claveEnServidor: Boolean(process.env.GEMINI_API_KEY),
    modeloPorDefecto: MODELO_POR_DEFECTO,
    modelos: await listarModelos(clave),
  });
}
