"""
ia.py — Capa de Inteligencia Artificial de IAcademy.

Toda la app llama a una sola función: generar(...).
Por dentro decide qué proveedor usar:
  - "gemini": Google Gemini en la nube (texto + audio + imagen). Proveedor principal.
  - "local":  modelo open-source de Hugging Face corriendo en la PC (solo texto).

Así la arquitectura queda abierta: cambiar de modelo no obliga a tocar las páginas.
"""

import streamlit as st

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


@st.cache_data(ttl=3600, show_spinner=False)
def listar_modelos_gemini(api_key: str) -> list[str]:
    """Pregunta a Google qué modelos Gemini están disponibles para esta API key."""
    try:
        cliente = _cliente_gemini(api_key)
        nombres = []
        for m in cliente.models.list():
            acciones = m.supported_actions or []
            nombre = (m.name or "").replace("models/", "")
            if "generateContent" in acciones and nombre.startswith("gemini") and "flash" in nombre:
                nombres.append(nombre)
        return sorted(set(nombres), reverse=True) or GEMINI_MODELOS_RESPALDO
    except Exception:
        return GEMINI_MODELOS_RESPALDO


def _generar_gemini(api_key, modelo, prompt, archivos, historial, sistema):
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
        if "API_KEY_INVALID" in texto or "API key not valid" in texto:
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
