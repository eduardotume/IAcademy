"""
IAcademy 🎓 — Asistente inteligente para estudiantes universitarios.
Autora: Giannina Cabrera Rottiers

Arquitectura:
  app.py       -> interfaz (Streamlit)
  ia.py        -> capa de IA (Gemini en la nube o modelo local de Hugging Face)
  db.py        -> persistencia local en SQLite (iacademy.db)
  exportar.py  -> descarga de resultados en Word (.docx)
"""

import io
import math
import os
import struct
import time
import wave
from datetime import date, datetime

import pandas as pd
import PyPDF2
import streamlit as st
from audio_recorder_streamlit import audio_recorder

import db
from exportar import markdown_a_docx
from ia import GEMINI_MODEL, GEMINI_MODELOS_RESPALDO, HF_MODEL, IAError, generar, ia_disponible, listar_modelos_gemini

# =====================================================================
# Configuración general
# =====================================================================
st.set_page_config(page_title="IAcademy", page_icon="🎓", layout="wide")

st.markdown(
    """
    <style>
    .reloj {font-size: 5.5rem; font-weight: 700; text-align: center; color: #7C3AED;
            font-variant-numeric: tabular-nums; line-height: 1.1; margin: .5rem 0;}
    .reloj-modo {text-align: center; font-size: 1.1rem; color: #6B7280;}
    .tarea-vencida {color: #DC2626; font-weight: 600;}
    .tarea-hoy {color: #D97706; font-weight: 600;}
    </style>
    """,
    unsafe_allow_html=True,
)

PAGINAS = [
    "🏠 Inicio",
    "📚 Mis Cursos",
    "📝 Resumir Documento",
    "❓ Generar Preguntas",
    "📅 Plan de Estudio",
    "⏱️ Pomodoro",
    "💬 Chat Tutor",
    "🎙️ Voz a Texto",
    "📸 Escanear Apuntes",
]
ESTADOS = ["Pendiente", "En progreso", "Completada"]
PRIORIDAD_ICONO = {"Alta": "🔴", "Media": "🟡", "Baja": "🟢"}
LIMITE_TEXTO_LOCAL = 6000  # los modelos locales pequeños tienen menos contexto

# =====================================================================
# Estado inicial
# =====================================================================
db.inicializar()

if "iniciado" not in st.session_state:
    st.session_state.iniciado = True
    st.session_state.student_name = db.leer_ajuste("student_name", "Estudiante")
    st.session_state.chat_history = []
    st.session_state.resultados = {}
    st.session_state.proveedor = "gemini"
    st.session_state.modelo_local = HF_MODEL


def leer_secreto(clave):
    """Busca la clave en variables de entorno (Render, Docker) o en st.secrets (Streamlit Cloud, secrets.toml)."""
    if os.environ.get(clave):
        return os.environ[clave]
    try:
        return st.secrets.get(clave, "")
    except Exception:
        return ""


# =====================================================================
# Utilidades
# =====================================================================
@st.cache_data(show_spinner=False)
def extract_text_from_pdf(datos_pdf: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(datos_pdf))
    texto = ""
    for page in reader.pages:
        texto += (page.extract_text() or "") + "\n"
    return texto.strip()


def leer_archivo_subido(archivo):
    """Devuelve el texto de un PDF o TXT subido, avisando si viene vacío."""
    if archivo is None:
        return ""
    try:
        if archivo.name.lower().endswith(".pdf"):
            with st.spinner("Extrayendo texto del PDF..."):
                texto = extract_text_from_pdf(archivo.getvalue())
            if not texto:
                st.warning(
                    "No se encontró texto en el PDF. Si es un documento escaneado, "
                    "toma una foto y usa **📸 Escanear Apuntes**."
                )
            else:
                st.success(f"✅ Texto extraído: {len(texto.split()):,} palabras.")
            return texto
        return archivo.getvalue().decode("utf-8", errors="ignore")
    except Exception as e:
        st.error(f"No se pudo leer el archivo: {e}")
        return ""


def recortar_para_local(texto):
    if st.session_state.proveedor == "local" and len(texto) > LIMITE_TEXTO_LOCAL:
        st.info(f"El modelo local tiene poco contexto: se usarán los primeros {LIMITE_TEXTO_LOCAL:,} caracteres.")
        return texto[:LIMITE_TEXTO_LOCAL]
    return texto


def ejecutar_ia(clave, prompt, archivos=None, mensaje="🤖 La IA está trabajando..."):
    """Llama a la IA y guarda el resultado para que no se pierda al recargar."""
    if not ia_disponible():
        st.error("⚠️ Configura tu API Key de Gemini en la barra lateral.")
        return
    try:
        with st.spinner(mensaje):
            st.session_state.resultados[clave] = generar(prompt, archivos=archivos)
        st.toast("✅ ¡Listo!", icon="🎉")
    except IAError as e:
        st.error(str(e))


def mostrar_resultado(clave, titulo, nombre_archivo):
    """Muestra un resultado guardado con botones de descarga en Word y TXT."""
    texto = st.session_state.resultados.get(clave)
    if not texto:
        return
    st.divider()
    st.subheader(titulo)
    with st.container(border=True):
        st.markdown(texto)

    c1, c2, c3 = st.columns(3)
    c1.download_button(
        "📄 Descargar Word",
        data=markdown_a_docx(titulo, texto, st.session_state.student_name),
        file_name=f"{nombre_archivo}.docx",
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        key=f"docx_{clave}",
        width="stretch",
    )
    c2.download_button(
        "📝 Descargar TXT",
        data=texto,
        file_name=f"{nombre_archivo}.txt",
        key=f"txt_{clave}",
        width="stretch",
    )
    if c3.button("🗑️ Limpiar resultado", key=f"limpiar_{clave}", width="stretch"):
        del st.session_state.resultados[clave]
        st.rerun()


def ir_a(pagina):
    st.session_state.pagina = pagina


def dias_restantes(fecha_txt):
    try:
        return (date.fromisoformat(fecha_txt) - date.today()).days
    except (TypeError, ValueError):
        return None


def texto_vencimiento(dias):
    if dias is None:
        return ""
    if dias < 0:
        return f"<span class='tarea-vencida'>⚠️ Venció hace {-dias} día(s)</span>"
    if dias == 0:
        return "<span class='tarea-hoy'>⏰ Vence hoy</span>"
    if dias == 1:
        return "<span class='tarea-hoy'>Vence mañana</span>"
    return f"Faltan {dias} días"


def sonido_alarma():
    """Genera un 'bip-bip-bip' en WAV, sin archivos externos."""
    frecuencia, duracion, muestras_seg = 880, 0.18, 22050
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(muestras_seg)
        frames = b""
        for _ in range(3):
            for i in range(int(muestras_seg * duracion)):
                frames += struct.pack("<h", int(12000 * math.sin(2 * math.pi * frecuencia * i / muestras_seg)))
            frames += b"\x00\x00" * int(muestras_seg * 0.12)
        w.writeframes(frames)
    return buffer.getvalue()


# =====================================================================
# Barra lateral
# =====================================================================
st.sidebar.title("IAcademy 🎓")
st.sidebar.caption("Tu asistente de estudio inteligente")

page = st.sidebar.radio("Navegación", PAGINAS, key="pagina")

st.sidebar.divider()
st.sidebar.markdown("### ⚙️ Configuración de IA")

st.sidebar.radio(
    "Motor de IA",
    ["gemini", "local"],
    format_func=lambda p: "☁️ Google Gemini (multimodal)" if p == "gemini" else "💻 Modelo local (Hugging Face)",
    key="proveedor",
)

if st.session_state.proveedor == "gemini":
    clave_secreta = leer_secreto("GEMINI_API_KEY")
    st.session_state.setdefault("api_key", "")
    if clave_secreta and not st.session_state.api_key:
        st.session_state.api_key = clave_secreta

    st.session_state.api_key = st.sidebar.text_input(
        "Gemini API Key", type="password", value=st.session_state.api_key
    ).strip()
    if clave_secreta:
        st.sidebar.caption("🔐 Clave cargada desde la configuración del servidor")
    else:
        st.sidebar.markdown("[Obtener API Key en Google AI Studio](https://aistudio.google.com/)")

    if st.session_state.get("api_key"):
        modelos = listar_modelos_gemini(st.session_state.api_key)
    else:
        modelos = GEMINI_MODELOS_RESPALDO
    if st.session_state.get("modelo_gemini") not in modelos:
        st.session_state.modelo_gemini = GEMINI_MODEL if GEMINI_MODEL in modelos else modelos[0]
    st.sidebar.selectbox("Modelo", modelos, key="modelo_gemini")

    if not st.session_state.get("api_key"):
        st.sidebar.warning("⚠️ Ingresa tu API Key para habilitar las funciones de IA.")
else:
    st.sidebar.text_input("Modelo de Hugging Face", key="modelo_local")
    st.sidebar.caption(
        "Corre en tu PC, sin internet ni API Key. Solo texto: voz e imágenes requieren Gemini. "
        "Instala antes `requirements-local.txt`."
    )

if st.session_state.get("pomo_fin") and page != "⏱️ Pomodoro":
    fin = datetime.fromtimestamp(st.session_state.pomo_fin).strftime("%H:%M")
    st.sidebar.info(f"🍅 Pomodoro en curso · termina a las {fin}")

# =====================================================================
# Página: Inicio
# =====================================================================
if page == "🏠 Inicio":
    st.title("Bienvenido a IAcademy 🎓")

    col_name, _ = st.columns([1, 2])
    with col_name:
        nuevo_nombre = st.text_input("¿Cómo te llamas?", value=st.session_state.student_name)
        if nuevo_nombre.strip() and nuevo_nombre != st.session_state.student_name:
            st.session_state.student_name = nuevo_nombre.strip()
            db.guardar_ajuste("student_name", st.session_state.student_name)
            st.toast("Nombre guardado", icon="💾")
            st.rerun()

    st.header(f"¡Hola, {st.session_state.student_name}! 👋")

    cursos = db.listar_cursos()
    pendientes = db.listar_tareas(solo_pendientes=True)
    sesiones, minutos, sesiones_hoy = db.resumen_pomodoros()

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Cursos registrados 📚", len(cursos), border=True)
    c2.metric("Tareas pendientes 📝", len(pendientes), border=True)
    c3.metric("Sesiones Pomodoro 🍅", sesiones, delta=f"{sesiones_hoy} hoy" if sesiones_hoy else None, border=True)
    c4.metric("Horas de estudio ⏱️", f"{minutos / 60:.1f}", border=True)

    if pendientes:
        st.subheader("📌 Próximas entregas")
        for t in pendientes[:3]:
            st.markdown(
                f"{PRIORIDAD_ICONO.get(t['prioridad'], '')} **{t['tarea']}** · {t['curso']} · "
                f"{texto_vencimiento(dias_restantes(t['fecha']))}",
                unsafe_allow_html=True,
            )

    st.divider()
    st.subheader("¿Qué quieres hacer hoy?")
    accesos = [
        ("📚 Mis Cursos", "Organiza tus materias y tareas."),
        ("📝 Resumir Documento", "Sintetiza lecturas largas en minutos."),
        ("❓ Generar Preguntas", "Practica para tus exámenes."),
        ("⏱️ Pomodoro", "Estudia en bloques de enfoque."),
        ("💬 Chat Tutor", "Resuelve tus dudas al instante."),
        ("🎙️ Voz a Texto", "Dicta apuntes o graba explicaciones."),
        ("📸 Escanear Apuntes", "Digitaliza tus apuntes a mano."),
        ("📅 Plan de Estudio", "Organiza tu semana con IA."),
    ]
    for fila in range(0, len(accesos), 4):
        columnas = st.columns(4)
        for col, (destino, descripcion) in zip(columnas, accesos[fila:fila + 4]):
            with col.container(border=True):
                st.markdown(f"**{destino}**")
                st.caption(descripcion)
                st.button("Abrir", key=f"ir_{destino}", on_click=ir_a, args=(destino,), width="stretch")

# =====================================================================
# Página: Mis Cursos
# =====================================================================
elif page == "📚 Mis Cursos":
    st.title("📚 Mis Cursos y Tareas")
    tab_tareas, tab_cursos = st.tabs(["📝 Mis Tareas", "📚 Mis Cursos"])
    cursos = db.listar_cursos()

    with tab_cursos:
        st.subheader("Añadir nuevo curso")
        with st.form("course_form", clear_on_submit=True):
            c1, c2, c3 = st.columns(3)
            c_name = c1.text_input("Nombre del curso *")
            c_prof = c2.text_input("Profesor")
            c_time = c3.text_input("Horario", placeholder="Lun y Mié 8:00–10:00")
            if st.form_submit_button("➕ Añadir curso", type="primary"):
                if not c_name.strip():
                    st.error("El nombre del curso es obligatorio.")
                elif db.agregar_curso(c_name, c_prof, c_time):
                    st.toast(f"Curso '{c_name}' guardado", icon="✅")
                    st.rerun()
                else:
                    st.warning(f"El curso '{c_name}' ya existe.")

        if cursos:
            st.subheader("Cursos registrados")
            for c in cursos:
                col_info, col_borrar = st.columns([6, 1])
                col_info.markdown(f"**{c['curso']}** · 👤 {c['profesor'] or '—'} · 🕒 {c['horario'] or '—'}")
                if col_borrar.button("🗑️", key=f"borrar_curso_{c['id']}", help="Eliminar curso y sus tareas"):
                    db.eliminar_curso(c["id"])
                    st.toast(f"Curso '{c['curso']}' eliminado", icon="🗑️")
                    st.rerun()
        else:
            st.info("Aún no tienes cursos registrados.")

    with tab_tareas:
        st.subheader("Añadir nueva tarea")
        if not cursos:
            st.warning("⚠️ Primero añade un curso en la pestaña **Mis Cursos**.")
        else:
            with st.form("task_form", clear_on_submit=True):
                c1, c2 = st.columns(2)
                t_course = c1.selectbox("Curso", [c["curso"] for c in cursos])
                t_name = c2.text_input("Nombre de la tarea *")
                c3, c4, c5 = st.columns(3)
                t_date = c3.date_input("Fecha de entrega", format="DD/MM/YYYY")
                t_priority = c4.selectbox("Prioridad", ["Alta", "Media", "Baja"])
                t_status = c5.selectbox("Estado", ESTADOS)
                if st.form_submit_button("➕ Añadir tarea", type="primary"):
                    if not t_name.strip():
                        st.error("Escribe el nombre de la tarea.")
                    else:
                        db.agregar_tarea(t_course, t_name, t_date.isoformat(), t_priority, t_status)
                        st.toast("Tarea guardada", icon="✅")
                        st.rerun()

        tareas = db.listar_tareas()
        if tareas:
            st.subheader("Lista de tareas")
            filtro = st.radio("Mostrar", ["Pendientes", "Completadas", "Todas"], horizontal=True)
            if filtro == "Pendientes":
                tareas = [t for t in tareas if t["estado"] != "Completada"]
            elif filtro == "Completadas":
                tareas = [t for t in tareas if t["estado"] == "Completada"]

            for t in tareas:
                with st.container(border=True):
                    c_info, c_estado, c_borrar = st.columns([5, 2, 1])
                    c_info.markdown(
                        f"{PRIORIDAD_ICONO.get(t['prioridad'], '')} **{t['tarea']}**  \n"
                        f"{t['curso']} · 📅 {t['fecha']} · {texto_vencimiento(dias_restantes(t['fecha']))}",
                        unsafe_allow_html=True,
                    )
                    nuevo_estado = c_estado.selectbox(
                        "Estado",
                        ESTADOS,
                        index=ESTADOS.index(t["estado"]) if t["estado"] in ESTADOS else 0,
                        key=f"estado_{t['id']}",
                        label_visibility="collapsed",
                    )
                    if nuevo_estado != t["estado"]:
                        db.actualizar_estado_tarea(t["id"], nuevo_estado)
                        if nuevo_estado == "Completada":
                            st.toast("¡Tarea completada! 🎉")
                        st.rerun()
                    if c_borrar.button("🗑️", key=f"borrar_tarea_{t['id']}", help="Eliminar tarea"):
                        db.eliminar_tarea(t["id"])
                        st.rerun()
            if not tareas:
                st.info("No hay tareas en esta vista.")
        else:
            st.info("Aún no tienes tareas registradas.")

# =====================================================================
# Página: Resumir Documento
# =====================================================================
elif page == "📝 Resumir Documento":
    st.title("📝 Resumir Documento")
    st.write("Carga un PDF o pega texto para generar un resumen inteligente.")

    source_type = st.radio("Fuente del texto:", ["Pegar texto", "Subir archivo (PDF/TXT)"], horizontal=True)
    if source_type == "Pegar texto":
        texto = st.text_area("Pega tu texto aquí", height=200)
    else:
        texto = leer_archivo_subido(st.file_uploader("Sube tu archivo", type=["pdf", "txt"]))

    col1, col2 = st.columns(2)
    length = col1.selectbox("Longitud del resumen", ["Corto", "Medio", "Detallado"])
    level = col2.selectbox("Nivel de lenguaje", ["Básico", "Intermedio", "Avanzado"])

    if st.button("✨ Resumir con IA", type="primary"):
        if not texto.strip():
            st.error("Proporciona un texto para resumir.")
        else:
            prompt = (
                f"Resume el siguiente texto. Longitud: {length.lower()}. Nivel de lenguaje: {level.lower()}.\n"
                "Estructura: un título, las ideas principales en viñetas, conceptos clave en negrita "
                "y una conclusión breve.\n\nTexto:\n" + recortar_para_local(texto)
            )
            ejecutar_ia("resumen", prompt, mensaje="Analizando y resumiendo...")

    mostrar_resultado("resumen", "Resumen", "resumen_iacademy")

# =====================================================================
# Página: Generar Preguntas
# =====================================================================
elif page == "❓ Generar Preguntas":
    st.title("❓ Generar Preguntas de Práctica")
    st.write("Genera preguntas sobre un tema para prepararte para tus exámenes.")

    topic = st.text_area("Pega el contenido de estudio o escribe un tema", height=150)
    col1, col2 = st.columns(2)
    num_questions = col1.selectbox("Número de preguntas", [5, 10, 15])
    q_type = col2.selectbox("Tipo de preguntas", ["Opción múltiple", "Verdadero/Falso", "Abiertas", "Mixtas"])

    if st.button("🎯 Generar Preguntas", type="primary"):
        if not topic.strip():
            st.error("Proporciona el tema o contenido.")
        else:
            prompt = (
                f"Genera {num_questions} preguntas de tipo '{q_type}' sobre el siguiente contenido.\n"
                "Numera cada pregunta. Al final agrega una sección '## Respuestas' con la respuesta "
                "correcta y una explicación breve de cada una.\n\nContenido:\n" + recortar_para_local(topic)
            )
            ejecutar_ia("preguntas", prompt, mensaje="Generando tu cuestionario...")

    mostrar_resultado("preguntas", "Cuestionario de práctica", "cuestionario_iacademy")

# =====================================================================
# Página: Plan de Estudio
# =====================================================================
elif page == "📅 Plan de Estudio":
    st.title("📅 Generador de Plan de Estudio")
    st.write("Crea un plan personalizado a partir de tus tareas pendientes.")

    pendientes = db.listar_tareas(solo_pendientes=True)
    if not db.listar_tareas():
        st.warning("No tienes tareas registradas.")
        st.button("Ir a Mis Cursos", on_click=ir_a, args=("📚 Mis Cursos",))
    elif not pendientes:
        st.success("¡Felicidades! No tienes tareas pendientes. 🎉")
    else:
        df = pd.DataFrame(pendientes).drop(columns=["id"])
        st.dataframe(df, width="stretch", hide_index=True)

        col1, col2 = st.columns(2)
        hours = col1.number_input("Horas disponibles por día", min_value=1, max_value=12, value=2)
        days = col2.number_input("Días para planificar", min_value=1, max_value=30, value=7)

        if st.button("🗓️ Generar Plan de Estudio", type="primary"):
            tareas_txt = "\n".join(
                f"- {t['tarea']} (Curso: {t['curso']}, Prioridad: {t['prioridad']}, Entrega: {t['fecha']}, Estado: {t['estado']})"
                for t in pendientes
            )
            prompt = (
                "Actúa como un experto en productividad estudiantil.\n"
                f"Hoy es {date.today().strftime('%A %d/%m/%Y')}. Tengo {hours} horas al día durante {days} días "
                f"para estas tareas:\n{tareas_txt}\n\n"
                "Crea un plan día por día con fechas reales, bloques de tiempo concretos, prioridad a lo que vence "
                "antes, repetición espaciada y descansos tipo Pomodoro (25 min de estudio / 5 de descanso). "
                "Usa títulos por día y viñetas."
            )
            ejecutar_ia("plan", prompt, mensaje="Planificando tu horario ideal...")

    mostrar_resultado("plan", "Mi plan de estudio", "plan_estudio_iacademy")

# =====================================================================
# Página: Pomodoro
# =====================================================================
elif page == "⏱️ Pomodoro":
    st.title("⏱️ Temporizador Pomodoro")
    st.caption("Estudia en bloques de enfoque con descansos cortos. Cada bloque de enfoque completado se guarda en tu progreso.")

    MODOS = {"🍅 Enfoque": 25, "☕ Descanso corto": 5, "🌴 Descanso largo": 15}
    for clave, valor in {
        "pomo_fin": None, "pomo_restante": None, "pomo_total": None, "pomo_alarma": None, "pomo_sesion": None
    }.items():
        st.session_state.setdefault(clave, valor)

    corriendo = st.session_state.pomo_fin is not None
    en_pausa = st.session_state.pomo_restante is not None
    activo = corriendo or en_pausa

    col_conf, col_reloj = st.columns([1, 2])

    with col_conf:
        if activo and st.session_state.pomo_sesion:
            sesion = st.session_state.pomo_sesion
            modo, minutos, curso_pomo = sesion["modo"], sesion["minutos"], sesion["curso"] or "(Sin curso)"
            st.markdown(f"**Modo:** {modo}  \n**Duración:** {minutos} min  \n**Curso:** {curso_pomo}")
            st.caption("Reinicia el temporizador para cambiar la configuración.")
        else:
            modo = st.radio("Modo", list(MODOS))
            minutos = st.number_input("Minutos", min_value=1, max_value=120, value=MODOS[modo], key=f"pomo_min_{modo}")
            cursos_nombres = ["(Sin curso)"] + [c["curso"] for c in db.listar_cursos()]
            curso_pomo = st.selectbox("¿Qué curso estudias?", cursos_nombres)

    with col_reloj:
        b1, b2, b3 = st.columns(3)
        if not corriendo:
            if b1.button("▶️ Reanudar" if en_pausa else "▶️ Iniciar", type="primary", width="stretch"):
                segundos = st.session_state.pomo_restante or int(minutos * 60)
                if not en_pausa:
                    st.session_state.pomo_total = int(minutos * 60)
                    st.session_state.pomo_sesion = {
                        "modo": modo,
                        "minutos": int(minutos),
                        "curso": None if curso_pomo == "(Sin curso)" else curso_pomo,
                    }
                st.session_state.pomo_fin = time.time() + segundos
                st.session_state.pomo_restante = None
                st.rerun()
        else:
            if b1.button("⏸️ Pausar", width="stretch"):
                st.session_state.pomo_restante = max(0, int(st.session_state.pomo_fin - time.time()))
                st.session_state.pomo_fin = None
                st.rerun()
        if b2.button("🔄 Reiniciar", width="stretch", disabled=not activo):
            st.session_state.pomo_fin = st.session_state.pomo_restante = None
            st.session_state.pomo_total = st.session_state.pomo_sesion = None
            st.rerun()

        @st.fragment(run_every=1 if corriendo else None)
        def reloj():
            total = st.session_state.pomo_total or int(minutos * 60)
            if st.session_state.pomo_fin is not None:
                restante = max(0, math.ceil(st.session_state.pomo_fin - time.time()))
            elif st.session_state.pomo_restante is not None:
                restante = st.session_state.pomo_restante
            else:
                restante = total

            estado = "en curso" if st.session_state.pomo_fin else ("en pausa" if st.session_state.pomo_restante is not None else "listo")
            st.markdown(f"<div class='reloj-modo'>{modo} · {estado}</div>", unsafe_allow_html=True)
            st.markdown(f"<div class='reloj'>{restante // 60:02d}:{restante % 60:02d}</div>", unsafe_allow_html=True)
            st.progress(1 - restante / total if total else 0.0)

            if st.session_state.pomo_fin is not None and restante == 0:
                sesion = st.session_state.pomo_sesion or {"modo": modo, "minutos": int(minutos), "curso": None}
                if sesion["modo"] == "🍅 Enfoque":
                    db.registrar_pomodoro(sesion["minutos"], sesion["curso"])
                st.session_state.pomo_alarma = sesion["modo"]
                st.session_state.pomo_fin = st.session_state.pomo_total = st.session_state.pomo_sesion = None
                st.rerun(scope="app")

        reloj()

        if st.session_state.pomo_alarma:
            modo_terminado = st.session_state.pomo_alarma
            st.session_state.pomo_alarma = None
            st.audio(sonido_alarma(), format="audio/wav", autoplay=True)
            if modo_terminado == "🍅 Enfoque":
                st.balloons()
                st.success("🎉 ¡Bloque de enfoque completado y guardado! Toma un descanso corto.")
            else:
                st.info("⏰ Se acabó el descanso. ¡A seguir estudiando!")

    st.divider()
    sesiones, minutos_totales, sesiones_hoy = db.resumen_pomodoros()
    m1, m2, m3 = st.columns(3)
    m1.metric("Sesiones hoy", sesiones_hoy, border=True)
    m2.metric("Sesiones totales", sesiones, border=True)
    m3.metric("Horas de enfoque", f"{minutos_totales / 60:.1f}", border=True)

    with st.expander("💡 ¿Cómo funciona la técnica Pomodoro?"):
        st.markdown(
            "1. Elige una tarea y estudia **25 minutos** sin distracciones.\n"
            "2. Toma un **descanso corto de 5 minutos**.\n"
            "3. Cada 4 bloques, toma un **descanso largo de 15 minutos**.\n\n"
            "Trabajar en bloques cortos reduce la fatiga y mejora la concentración."
        )

# =====================================================================
# Página: Chat Tutor
# =====================================================================
elif page == "💬 Chat Tutor":
    st.title("💬 Chat Tutor IAcademy")
    st.write("Habla con tu tutor virtual sobre cualquier duda.")

    contexto = ""
    with st.expander("📄 Subir documento de contexto (opcional)"):
        doc_file = st.file_uploader("PDF para que el tutor lo lea", type=["pdf"], key="chat_pdf")
        if doc_file:
            contexto = recortar_para_local(leer_archivo_subido(doc_file))

    col1, col2, col3 = st.columns(3)
    quick_prompt = None
    if col1.button("🧠 Explícame el tema principal", width="stretch"):
        quick_prompt = "Explícame el tema principal de forma muy simple. Si no tienes un documento, pregúntame qué tema quiero."
    if col2.button("💡 Dame ejemplos reales", width="stretch"):
        quick_prompt = "Dame ejemplos de la vida real sobre el tema que estamos viendo."
    if col3.button("🤝 Paso a paso", width="stretch"):
        quick_prompt = "Ayúdame a entender paso a paso cómo resolver un problema típico de este tema."

    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    prompt_input = st.chat_input("Escribe tu duda aquí...")
    prompt = quick_prompt or prompt_input

    if prompt:
        historial_previo = st.session_state.chat_history[-10:]
        st.session_state.chat_history.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            if not ia_disponible():
                st.warning("Configura tu API Key de Gemini en la barra lateral para hablar con el tutor.")
                st.session_state.chat_history.pop()
            else:
                sistema = (
                    "Eres IAcademy, un tutor universitario amigable y experto. Explicas de manera clara y "
                    "sencilla, con ejemplos cotidianos, y respondes en español."
                )
                if contexto:
                    sistema += f"\n\nDocumento del estudiante (úsalo como referencia principal):\n{contexto[:30000]}"
                try:
                    with st.spinner("Pensando..."):
                        respuesta = generar(prompt, historial=historial_previo, sistema=sistema)
                    st.markdown(respuesta)
                    st.session_state.chat_history.append({"role": "assistant", "content": respuesta})
                except IAError as e:
                    st.error(str(e))
                    st.session_state.chat_history.pop()

    if st.session_state.chat_history:
        st.divider()
        conversacion = "\n\n".join(
            f"**{'Tú' if m['role'] == 'user' else 'Tutor IAcademy'}:** {m['content']}"
            for m in st.session_state.chat_history
        )
        c1, c2 = st.columns(2)
        c1.download_button(
            "📄 Descargar conversación (Word)",
            data=markdown_a_docx("Conversación con el Tutor", conversacion, st.session_state.student_name),
            file_name="chat_tutor_iacademy.docx",
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            width="stretch",
        )
        if c2.button("🧹 Nueva conversación", width="stretch"):
            st.session_state.chat_history = []
            st.rerun()

# =====================================================================
# Página: Voz a Texto
# =====================================================================
elif page == "🎙️ Voz a Texto":
    st.title("🎙️ Voz a Texto")
    st.write("Graba tu voz y la IA transcribirá y analizará lo que digas.")

    if st.session_state.proveedor == "local":
        st.warning("El modelo local no procesa audio. Cambia a **Google Gemini** en la barra lateral.")

    st.info("🎤 Haz clic en el micrófono para grabar. Se detiene solo tras 3 segundos de silencio.")
    audio_bytes = audio_recorder(
        text="Clic para grabar",
        recording_color="#7C3AED",
        neutral_color="#6B7280",
        icon_size="2x",
        pause_threshold=3.0,
    )

    if audio_bytes:
        st.audio(audio_bytes, format="audio/wav")
        st.success("✅ Audio grabado.")

        col1, col2, col3 = st.columns(3)
        action = None
        if col1.button("📝 Transcribir", type="primary", width="stretch"):
            action = "transcribir"
        if col2.button("📋 Transcribir y Resumir", width="stretch"):
            action = "resumir"
        if col3.button("❓ Transcribir y Generar Preguntas", width="stretch"):
            action = "preguntas"

        prompts = {
            "transcribir": "Transcribe el siguiente audio en español. Devuelve SOLO la transcripción, sin comentarios.",
            "resumir": "Transcribe el audio en español y luego resume lo que se dijo.\n\n## Transcripción\n(texto)\n\n## Resumen\n(viñetas)",
            "preguntas": "Transcribe el audio en español y genera 5 preguntas de práctica con sus respuestas.\n\n## Transcripción\n(texto)\n\n## Preguntas de práctica\n(preguntas y respuestas)",
        }
        if action:
            ejecutar_ia("voz", prompts[action], archivos=[(audio_bytes, "audio/wav")], mensaje="🤖 Procesando audio...")

    mostrar_resultado("voz", "Transcripción", "transcripcion_iacademy")

    st.divider()
    st.subheader("💡 Ideas de uso")
    st.markdown(
        "- 🗣️ **Dicta tus apuntes** en vez de escribirlos\n"
        "- 🎧 **Graba una explicación** y obtén un resumen\n"
        "- 📝 **Repasa en voz alta** y genera preguntas sobre lo que dijiste"
    )

# =====================================================================
# Página: Escanear Apuntes
# =====================================================================
elif page == "📸 Escanear Apuntes":
    st.title("📸 Escanear Apuntes")
    st.write("Toma una foto de tus apuntes o sube una imagen y la IA extraerá el texto.")

    if st.session_state.proveedor == "local":
        st.warning("El modelo local no procesa imágenes. Cambia a **Google Gemini** en la barra lateral.")

    source = st.radio("¿Cómo quieres capturar la imagen?", ["📁 Subir imagen", "📷 Usar cámara"], horizontal=True)
    img_data, img_mime = None, "image/jpeg"

    if source == "📷 Usar cámara":
        foto = st.camera_input("Toma una foto de tus apuntes")
        if foto:
            img_data = foto.getvalue()
    else:
        subida = st.file_uploader("Sube una imagen", type=["jpg", "jpeg", "png", "webp"])
        if subida:
            img_data, img_mime = subida.getvalue(), subida.type
            st.image(img_data, caption="Imagen cargada", width=500)

    if img_data:
        st.subheader("¿Qué quieres hacer con esta imagen?")
        col1, col2, col3, col4 = st.columns(4)
        action = None
        if col1.button("🔍 Extraer texto", type="primary", width="stretch"):
            action = "ocr"
        if col2.button("📋 Resumir", width="stretch"):
            action = "resumir"
        if col3.button("❓ Generar Preguntas", width="stretch"):
            action = "preguntas"
        if col4.button("💬 Explicar", width="stretch"):
            action = "explicar"

        prompts = {
            "ocr": "Extrae TODO el texto visible en esta imagen. Si son apuntes manuscritos, haz tu mejor esfuerzo. Devuelve el texto organizado y limpio.",
            "resumir": "Extrae el texto de esta imagen y genera un resumen claro y organizado. Si hay diagramas o fórmulas, descríbelos.",
            "preguntas": "Extrae el texto de esta imagen y genera 5 preguntas tipo examen con sus respuestas correctas.",
            "explicar": "Analiza esta imagen y explica su contenido de forma clara y sencilla, como un tutor universitario, con ejemplos cotidianos.",
        }
        if action:
            ejecutar_ia("imagen", prompts[action], archivos=[(img_data, img_mime)], mensaje="🤖 Analizando imagen...")

    mostrar_resultado("imagen", "Resultado del escaneo", "apuntes_escaneados_iacademy")

    st.divider()
    st.subheader("💡 Ideas de uso")
    st.markdown(
        "- 📖 **Escanea apuntes a mano** y conviértelos a texto digital\n"
        "- 📊 **Fotografía diagramas** y obtén una explicación\n"
        "- 📐 **Captura fórmulas o ejercicios** y pide que te los expliquen\n"
        "- 📄 **Digitaliza páginas de libros** y genera un resumen"
    )

st.sidebar.divider()
st.sidebar.caption("Hecho por Giannina Cabrera Rottiers · IAcademy")
