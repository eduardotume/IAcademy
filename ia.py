"""
ia.py — Capa de Inteligencia Artificial de IAcademy.

Toda la app llama a una sola función: generar(...).
Por dentro decide qué proveedor usar:
  - "gemini": Google Gemini en la nube (texto + audio + imagen). Proveedor principal.
  - "local":  modelo open-source de Hugging Face corriendo en la PC (solo texto).

Así la arquitectura queda abierta: cambiar de modelo no obliga a tocar las páginas.
"""

import base64
import sys

import streamlit as st

# True cuando la app corre dentro del navegador (stlite / Pyodide), por ejemplo en Vercel.
EN_NAVEGADOR = sys.platform == "emscripten"
GEMINI_REST = "https://generativelanguage.googleapis.com/v1beta"

# --- Configuración global del modelo ---
# Modelo por defecto. Si Google lo retira, solo se cambia aquí (o desde la barra lateral).
GEMINI_MODEL = "gemini-3.5-flash"
GEMINI_MODELOS_RESPALDO = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"]

# Modelo local sugerido (pequeño, corre en una GPU de 8 GB o incluso en CPU).
HF_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"

SISTEMA_BASE = (
    "Eres IAcademy, un asistente universitario amigable y experto. "
    "Respondes siempre en español, con explicaciones claras, ordenadas y ejemplos cotidianos."
)


class IAError(Exception):
    """Error con un mensaje listo para mostrar al estudiante."""


# =====================================================================
# Proveedor 1: Google Gemini (SDK nuevo: google-genai)
# =====================================================================
@st.cache_resource(show_spinner=False)
def _cliente_gemini(api_key: str):
    from google import genai
    return genai.Client(api_key=api_key)


def _filtrar_modelos(pares):
    nombres = [
        nombre.replace("models/", "")
        for nombre, acciones in pares
        if "generateContent" in (acciones or [])
    ]
    nombres = [n for n in nombres if n.startswith("gemini") and "flash" in n]
    return sorted(set(nombres), reverse=True) or GEMINI_MODELOS_RESPALDO


@st.cache_data(ttl=3600, show_spinner=False)
def listar_modelos_gemini(api_key: str) -> list[str]:
    """Pregunta a Google qué modelos Gemini están disponibles para esta API key."""
    if EN_NAVEGADOR:
        try:
            import requests
            r = requests.get(f"{GEMINI_REST}/models", headers={"x-goog-api-key": api_key}, params={"pageSize": 200}, timeout=30)
            r.raise_for_status()
            return _filtrar_modelos((m.get("name", ""), m.get("supportedGenerationMethods")) for m in r.json().get("models", []))
        except Exception:
            return GEMINI_MODELOS_RESPALDO
    try:
        cliente = _cliente_gemini(api_key)
        return _filtrar_modelos((m.name or "", m.supported_actions) for m in cliente.models.list())
    except Exception:
        return GEMINI_MODELOS_RESPALDO


def _generar_gemini_rest(api_key, modelo, prompt, archivos, historial, sistema):
    """Misma llamada a Gemini, pero por la API REST: es lo que funciona dentro del navegador."""
    import requests

    contenidos = []
    for msg in historial or []:
        rol = "user" if msg["role"] == "user" else "model"
        contenidos.append({"role": rol, "parts": [{"text": msg["content"]}]})
    partes = [{"text": prompt}]
    for datos, mime in archivos or []:
        partes.append({"inlineData": {"mimeType": mime, "data": base64.b64encode(datos).decode()}})
    contenidos.append({"role": "user", "parts": partes})

    r = requests.post(
        f"{GEMINI_REST}/models/{modelo}:generateContent",
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={"systemInstruction": {"parts": [{"text": sistema}]}, "contents": contenidos},
        timeout=120,
    )
    if r.status_code != 200:
        try:
            detalle = r.json().get("error", {})
            mensaje = f"{r.status_code} {detalle.get('status', '')} {detalle.get('message', '')}"
        except ValueError:
            mensaje = f"{r.status_code} {r.text[:200]}"
        raise RuntimeError(mensaje)

    candidatos = r.json().get("candidates") or []
    partes_resp = (candidatos[0].get("content") or {}).get("parts", []) if candidatos else []
    texto = "".join(p.get("text", "") for p in partes_resp)
    if not texto:
        raise IAError("Gemini no devolvió texto. Intenta reformular o usar otro archivo.")
    return texto


def _generar_gemini(api_key, modelo, prompt, archivos, historial, sistema):
    if EN_NAVEGADOR:
        return _generar_gemini_rest(api_key, modelo, prompt, archivos, historial, sistema)
    from google.genai import types

    cliente = _cliente_gemini(api_key)

    contenidos = []
    for msg in historial or []:
        rol = "user" if msg["role"] == "user" else "model"
        contenidos.append(types.Content(role=rol, parts=[types.Part.from_text(text=msg["content"])]))

    partes = [types.Part.from_text(text=prompt)]
    for datos, mime in archivos or []:
        partes.append(types.Part.from_bytes(data=datos, mime_type=mime))
    contenidos.append(types.Content(role="user", parts=partes))

    respuesta = cliente.models.generate_content(
        model=modelo,
        contents=contenidos,
        config=types.GenerateContentConfig(
            system_instruction=sistema,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        ),
    )
    if not respuesta.text:
        raise IAError("Gemini no devolvió texto. Intenta reformular o usar otro archivo.")
    return respuesta.text


# =====================================================================
# Proveedor 2: Modelo local de Hugging Face (opcional)
# =====================================================================
@st.cache_resource(show_spinner="Cargando modelo local (la primera vez se descarga)...")
def _pipeline_local(nombre_modelo: str):
    try:
        import torch
        from transformers import pipeline
    except ImportError:
        raise IAError(
            "Para usar el modelo local instala: pip install transformers torch accelerate"
        )
    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    return pipeline(
        "text-generation",
        model=nombre_modelo,
        torch_dtype=torch.float16 if dispositivo == "cuda" else torch.float32,
        device=dispositivo,
    )


def _generar_local(modelo, prompt, historial, sistema):
    gen = _pipeline_local(modelo)
    mensajes = [{"role": "system", "content": sistema}]
    for msg in historial or []:
        mensajes.append({"role": msg["role"], "content": msg["content"]})
    mensajes.append({"role": "user", "content": prompt})
    salida = gen(mensajes, max_new_tokens=700, do_sample=True, temperature=0.7)
    return salida[0]["generated_text"][-1]["content"]


# =====================================================================
# Función única que usa toda la app
# =====================================================================
def generar(prompt: str, archivos=None, historial=None, sistema: str = SISTEMA_BASE) -> str:
    """
    prompt:    instrucción en texto.
    archivos:  lista de (bytes, mime_type) para audio o imagen. Solo Gemini.
    historial: lista de {"role": "user"|"assistant", "content": str} para el chat.
    """
    proveedor = st.session_state.get("proveedor", "gemini")

    if proveedor == "local" and EN_NAVEGADOR:
        raise IAError("El modelo local no funciona en la versión web. Usa Google Gemini.")
    if proveedor == "local":
        if archivos:
            raise IAError(
                "El modelo local solo procesa texto. Para voz e imágenes cambia a Gemini en la barra lateral."
            )
        return _generar_local(st.session_state.get("modelo_local", HF_MODEL), prompt, historial, sistema)

    api_key = st.session_state.get("api_key", "")
    if not api_key:
        raise IAError("Configura tu API Key de Gemini en la barra lateral.")
    modelo = st.session_state.get("modelo_gemini", GEMINI_MODEL)

    try:
        return _generar_gemini(api_key, modelo, prompt, archivos, historial, sistema)
    except IAError:
        raise
    except Exception as e:
        texto = str(e)
        if "API_KEY_INVALID" in texto or "API key not valid" in texto or texto.startswith(("400 INVALID", "403")):
            raise IAError("Tu API Key no es válida. Revísala en Google AI Studio.")
        if "404" in texto or "not found" in texto.lower():
            raise IAError(f"El modelo '{modelo}' no está disponible. Elige otro en la barra lateral.")
        if "429" in texto or "RESOURCE_EXHAUSTED" in texto:
            raise IAError("Llegaste al límite de uso gratuito. Espera un minuto e inténtalo de nuevo.")
        raise IAError(f"Problema de comunicación con Gemini: {texto}")


def ia_disponible() -> bool:
    if st.session_state.get("proveedor") == "local":
        return True
    return bool(st.session_state.get("api_key"))
