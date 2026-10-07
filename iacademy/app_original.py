import streamlit as st
import google.generativeai as genai
import PyPDF2
import pandas as pd
from datetime import datetime
from audio_recorder_streamlit import audio_recorder
import io

# --- Configuración de la página ---
st.set_page_config(page_title="IAcademy", page_icon="🎓", layout="wide")

# --- Inicialización del Estado (Session State) ---
if "api_key" not in st.session_state:
    st.session_state.api_key = ""
if "student_name" not in st.session_state:
    st.session_state.student_name = "Estudiante"
if "courses" not in st.session_state:
    st.session_state.courses = []
if "tasks" not in st.session_state:
    st.session_state.tasks = []
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

# --- Funciones Auxiliares ---
@st.cache_resource
def get_gemini_model(api_key):
    if not api_key:
        return None
    genai.configure(api_key=api_key)
    return genai.GenerativeModel('gemini-2.0-flash')

def extract_text_from_pdf(pdf_file):
    try:
        reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        return f"Error al extraer texto: {str(e)}"

# --- Navegación en la Barra Lateral ---
st.sidebar.title("IAcademy 🎓")
st.sidebar.subheader("Tu asistente de estudio inteligente")

page = st.sidebar.radio(
    "Navegación", 
    ['🏠 Inicio', '📚 Mis Cursos', '📝 Resumir Documento', '❓ Generar Preguntas', '📅 Plan de Estudio', '💬 Chat Tutor', '🎙️ Voz a Texto', '📸 Escanear Apuntes']
)

st.sidebar.divider()
st.sidebar.markdown("### Configuración de IA")
api_key = st.sidebar.text_input("Gemini API Key", type="password", value=st.session_state.api_key)
if api_key != st.session_state.api_key:
    st.session_state.api_key = api_key
    st.rerun()

st.sidebar.markdown("[Obtener API Key de Google AI Studio](https://aistudio.google.com/)")

if not st.session_state.api_key:
    st.sidebar.warning("⚠️ Ingresa tu API Key para habilitar las funciones de IA.")

# --- Página: Inicio ---
if page == '🏠 Inicio':
    st.title("Bienvenido a IAcademy 🎓")
    
    col_name, _ = st.columns([1, 2])
    with col_name:
        new_name = st.text_input("¿Cómo te llamas?", value=st.session_state.student_name)
        if new_name != st.session_state.student_name:
            st.session_state.student_name = new_name
            st.rerun()
            
    st.header(f"¡Hola, {st.session_state.student_name}! 👋")
    
    # Métricas
    col1, col2, col3 = st.columns(3)
    num_courses = len(st.session_state.courses)
    num_tasks = len([t for t in st.session_state.tasks if t['estado'] != 'Completada'])
    num_completed = len([t for t in st.session_state.tasks if t['estado'] == 'Completada'])
    
    col1.metric("Cursos registrados 📚", num_courses)
    col2.metric("Tareas pendientes 📝", num_tasks)
    col3.metric("Sesiones de estudio ✅", num_completed)
    
    st.divider()
    st.subheader("¿Qué quieres hacer hoy?")
    
    col_a, col_b, col_c, col_d = st.columns(4)
    with col_a:
        st.info("**Mis Cursos**\n\nOrganiza tus materias y tareas pendientes.")
    with col_b:
        st.success("**Resumir**\n\nSube documentos largos y obtén lo más importante.")
    with col_c:
        st.warning("**Practicar**\n\nGenera preguntas para prepararte para tus exámenes.")
    with col_d:
        st.error("**Tutor IA**\n\nResuelve tus dudas al instante con nuestro chat.")

# --- Página: Mis Cursos ---
elif page == '📚 Mis Cursos':
    st.title("📚 Mis Cursos y Tareas")
    
    tab1, tab2 = st.tabs(["Mis Tareas", "Mis Cursos"])
    
    with tab2:
        st.subheader("Añadir Nuevo Curso")
        with st.form("course_form"):
            c_name = st.text_input("Nombre del Curso")
            c_prof = st.text_input("Profesor")
            c_time = st.text_input("Horario")
            submit_course = st.form_submit_button("Añadir Curso")
            if submit_course and c_name:
                st.session_state.courses.append({"curso": c_name, "profesor": c_prof, "horario": c_time})
                st.success(f"Curso '{c_name}' añadido exitosamente.")
                st.rerun()
                
        if st.session_state.courses:
            st.subheader("Cursos Registrados")
            df_courses = pd.DataFrame(st.session_state.courses)
            st.dataframe(df_courses, use_container_width=True)
        else:
            st.info("Aún no tienes cursos registrados.")
            
    with tab1:
        st.subheader("Añadir Nueva Tarea")
        if not st.session_state.courses:
            st.warning("⚠️ Primero debes añadir un curso para poder asignarle tareas.")
        else:
            with st.form("task_form"):
                t_course = st.selectbox("Curso", [c["curso"] for c in st.session_state.courses])
                t_name = st.text_input("Nombre de la Tarea")
                t_date = st.date_input("Fecha de entrega")
                t_priority = st.selectbox("Prioridad", ["Alta", "Media", "Baja"])
                t_status = st.selectbox("Estado", ["Pendiente", "En progreso", "Completada"])
                submit_task = st.form_submit_button("Añadir Tarea")
                
                if submit_task and t_name:
                    st.session_state.tasks.append({
                        "curso": t_course, 
                        "tarea": t_name, 
                        "fecha": t_date.strftime("%Y-%m-%d"), 
                        "prioridad": t_priority, 
                        "estado": t_status
                    })
                    st.success("Tarea añadida exitosamente.")
                    st.rerun()
                    
        if st.session_state.tasks:
            st.subheader("Lista de Tareas")
            df_tasks = pd.DataFrame(st.session_state.tasks)
            st.dataframe(df_tasks, use_container_width=True)
        else:
            st.info("Aún no tienes tareas registradas.")

# --- Página: Resumir Documento ---
elif page == '📝 Resumir Documento':
    st.title("📝 Resumir Documento")
    st.write("Carga un documento PDF o pega texto para generar un resumen inteligente.")
    
    source_type = st.radio("Fuente del texto:", ["Pegar texto", "Subir archivo (PDF/TXT)"])
    
    text_to_summarize = ""
    if source_type == "Pegar texto":
        text_to_summarize = st.text_area("Pega tu texto aquí", height=200)
    else:
        uploaded_file = st.file_uploader("Sube tu archivo", type=['pdf', 'txt'])
        if uploaded_file is not None:
            if uploaded_file.name.endswith('.pdf'):
                with st.spinner("Extrayendo texto del PDF..."):
                    text_to_summarize = extract_text_from_pdf(uploaded_file)
                st.success("Texto extraído correctamente.")
            else:
                text_to_summarize = uploaded_file.getvalue().decode("utf-8")
                
    col1, col2 = st.columns(2)
    with col1:
        length = st.selectbox("Longitud del resumen", ["Corto", "Medio", "Detallado"])
    with col2:
        level = st.selectbox("Nivel de lenguaje", ["Básico", "Intermedio", "Avanzado"])
        
    if st.button("✨ Resumir con IA", type="primary"):
        if not text_to_summarize.strip():
            st.error("Por favor proporciona texto para resumir.")
        elif not st.session_state.api_key:
            st.error("Por favor configura tu API Key de Gemini en la barra lateral.")
        else:
            try:
                with st.spinner("Analizando y resumiendo..."):
                    model = get_gemini_model(st.session_state.api_key)
                    prompt = f"Resume el siguiente texto. La longitud debe ser {length.lower()} y el nivel de lenguaje {level.lower()}.\n\nTexto:\n{text_to_summarize}"
                    response = model.generate_content(prompt)
                    
                st.subheader("Resumen generado:")
                st.markdown(response.text)
            except Exception as e:
                st.error(f"Error al generar resumen: Ocurrió un problema de comunicación con Gemini. ({str(e)})")

# --- Página: Generar Preguntas ---
elif page == '❓ Generar Preguntas':
    st.title("❓ Generar Preguntas de Práctica")
    st.write("Genera preguntas sobre un tema para prepararte para tus exámenes.")
    
    topic = st.text_area("Pega el contenido de estudio o escribe un tema", height=150)
    
    col1, col2 = st.columns(2)
    with col1:
        num_questions = st.selectbox("Número de preguntas", [5, 10, 15])
    with col2:
        q_type = st.selectbox("Tipo de preguntas", ["Opción múltiple", "Verdadero/Falso", "Abiertas", "Mixtas"])
        
    if st.button("🎯 Generar Preguntas", type="primary"):
        if not topic.strip():
            st.error("Por favor proporciona el tema o contenido.")
        elif not st.session_state.api_key:
            st.error("Por favor configura tu API Key de Gemini en la barra lateral.")
        else:
            try:
                with st.spinner("Generando tu cuestionario..."):
                    model = get_gemini_model(st.session_state.api_key)
                    prompt = (f"Genera {num_questions} preguntas de tipo '{q_type}' basadas en el siguiente tema o texto: "
                              f"'{topic}'. Formatea la respuesta de manera que cada pregunta esté clara. "
                              "Proporciona también las respuestas correctas al final o junto a la pregunta.")
                    response = model.generate_content(prompt)
                
                st.subheader("Tus Preguntas")
                with st.expander("Ver preguntas y respuestas"):
                    st.markdown(response.text)
            except Exception as e:
                st.error(f"Error al generar preguntas: {str(e)}")

# --- Página: Plan de Estudio ---
elif page == '📅 Plan de Estudio':
    st.title("📅 Generador de Plan de Estudio")
    st.write("Crea un plan de estudio personalizado basado en tus tareas pendientes.")
    
    if not st.session_state.tasks:
        st.warning("No tienes tareas registradas. Ve a 'Mis Cursos' para agregar tareas.")
    else:
        pending_tasks = [t for t in st.session_state.tasks if t['estado'] != 'Completada']
        if not pending_tasks:
            st.info("¡Felicidades! No tienes tareas pendientes.")
        else:
            st.dataframe(pd.DataFrame(pending_tasks), use_container_width=True)
            
            col1, col2 = st.columns(2)
            with col1:
                hours = st.number_input("Horas disponibles por día", min_value=1, max_value=12, value=2)
            with col2:
                days = st.number_input("Días hasta los exámenes / límite", min_value=1, max_value=30, value=7)
                
            if st.button("🗓️ Generar Plan de Estudio", type="primary"):
                if not st.session_state.api_key:
                    st.error("Por favor configura tu API Key de Gemini en la barra lateral.")
                else:
                    try:
                        with st.spinner("Planificando tu horario ideal..."):
                            model = get_gemini_model(st.session_state.api_key)
                            tasks_str = "\n".join([f"- {t['tarea']} (Curso: {t['curso']}, Prioridad: {t['prioridad']}, Entrega: {t['fecha']})" for t in pending_tasks])
                            
                            prompt = (f"Actúa como un experto en productividad estudiantil. "
                                      f"Tengo {hours} horas disponibles al día y quedan {days} días para completar estas tareas:\n{tasks_str}\n\n"
                                      f"Crea un plan de estudio estructurado aplicando principios de repetición espaciada y priorización. "
                                      f"Muestra bloques de tiempo claros.")
                            response = model.generate_content(prompt)
                        
                        st.subheader("Tu Plan Personalizado")
                        st.markdown(response.text)
                        
                        st.download_button("Descargar Plan", data=response.text, file_name="plan_estudio.txt")
                    except Exception as e:
                        st.error(f"Error al generar plan: {str(e)}")

# --- Página: Chat Tutor ---
elif page == '💬 Chat Tutor':
    st.title("💬 Chat Tutor IAcademy")
    st.write("Habla con tu tutor virtual sobre cualquier duda que tengas.")
    
    context = ""
    with st.expander("📄 Subir documento de contexto (opcional)"):
        doc_file = st.file_uploader("PDF para que el tutor lo lea", type=['pdf'], key="chat_pdf")
        if doc_file:
            with st.spinner("Leyendo documento..."):
                context = extract_text_from_pdf(doc_file)
            st.success("Documento cargado como contexto para el tutor.")
            
    col1, col2, col3 = st.columns(3)
    quick_prompt = None
    if col1.button("🧠 Explícame un concepto"):
        quick_prompt = "Explícame un concepto difícil de entender de manera muy simple."
    if col2.button("💡 Dame ejemplos de..."):
        quick_prompt = "Dame ejemplos de la vida real sobre este tema."
    if col3.button("🤝 Ayúdame a entender..."):
        quick_prompt = "Ayúdame a entender paso a paso cómo resolver un problema típico de este tema."
        
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            
    prompt_input = st.chat_input("Escribe tu duda aquí...")
    prompt = quick_prompt if quick_prompt else prompt_input
    
    if prompt:
        st.session_state.chat_history.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)
            
        with st.chat_message("assistant"):
            if not st.session_state.api_key:
                st.warning("Para obtener respuestas del tutor, configura tu API Key de Gemini en la barra lateral.")
                response_text = "Esta es una respuesta de demostración porque no hay API Key configurada. ¡Añade tu API key para empezar!"
                st.markdown(response_text)
                st.session_state.chat_history.append({"role": "assistant", "content": response_text})
            else:
                try:
                    with st.spinner("Pensando..."):
                        model = get_gemini_model(st.session_state.api_key)
                        system_prompt = (
                            "Eres IAcademy, un tutor universitario amigable y experto. "
                            "Explicas conceptos de manera clara y sencilla, usando ejemplos cotidianos. "
                            "Respondes en español. "
                        )
                        if context:
                            system_prompt += f"\n\nContexto del documento proporcionado por el estudiante:\n{context[:5000]}..."
                            
                        # Concatenando historial
                        history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in st.session_state.chat_history[:-1][-5:]])
                        full_prompt = f"{system_prompt}\n\nHistorial reciente:\n{history_text}\n\nUsuario: {prompt}\nRespuesta:"
                        
                        response = model.generate_content(full_prompt)
                        
                    response_text = response.text
                    st.markdown(response_text)
                    st.session_state.chat_history.append({"role": "assistant", "content": response_text})
                except Exception as e:
                    st.error(f"Ocurrió un error con el tutor: {str(e)}")

# --- Página: Voz a Texto ---
elif page == '🎙️ Voz a Texto':
    st.title("🎙️ Voz a Texto")
    st.write("Graba tu voz y la IA transcribirá y analizará lo que digas.")
    
    st.info("🎤 Haz clic en el micrófono para empezar a grabar. Haz clic de nuevo para detener.")
    
    # Grabador de audio
    audio_bytes = audio_recorder(
        text="Clic para grabar",
        recording_color="#7C3AED",
        neutral_color="#6B7280",
        icon_size="2x",
        pause_threshold=3.0
    )
    
    if audio_bytes:
        st.audio(audio_bytes, format="audio/wav")
        st.success("✅ Audio grabado correctamente.")
        
        col1, col2, col3 = st.columns(3)
        action = None
        with col1:
            if st.button("📝 Transcribir", type="primary", use_container_width=True):
                action = "transcribir"
        with col2:
            if st.button("📋 Transcribir y Resumir", use_container_width=True):
                action = "resumir"
        with col3:
            if st.button("❓ Transcribir y Generar Preguntas", use_container_width=True):
                action = "preguntas"
        
        if action:
            if not st.session_state.api_key:
                st.error("⚠️ Configura tu API Key de Gemini en la barra lateral.")
            else:
                try:
                    with st.spinner("🤖 Procesando audio con IA..."):
                        model = get_gemini_model(st.session_state.api_key)
                        
                        # Enviar audio directamente a Gemini (soporta multimodal)
                        audio_part = {
                            "mime_type": "audio/wav",
                            "data": audio_bytes
                        }
                        
                        if action == "transcribir":
                            prompt = "Transcribe el siguiente audio en español. Devuelve SOLO la transcripción del texto hablado, sin comentarios adicionales."
                        elif action == "resumir":
                            prompt = "Transcribe el siguiente audio en español. Luego genera un resumen claro y organizado de lo que se dijo. Formato:\n\n**Transcripción:**\n(texto)\n\n**Resumen:**\n(resumen)"
                        elif action == "preguntas":
                            prompt = "Transcribe el siguiente audio en español. Luego genera 5 preguntas de práctica basadas en el contenido. Formato:\n\n**Transcripción:**\n(texto)\n\n**Preguntas de Práctica:**\n(preguntas con respuestas)"
                        
                        response = model.generate_content([prompt, audio_part])
                    
                    st.subheader("Resultado:")
                    st.markdown(response.text)
                    
                except Exception as e:
                    st.error(f"Error al procesar el audio: {str(e)}")
                    st.info("💡 Si el error persiste, intenta grabar un audio más largo y claro.")
    
    st.divider()
    st.subheader("💡 Ideas de uso")
    st.markdown("""
    - 🗣️ **Dicta tus apuntes** en vez de escribirlos
    - 🎧 **Graba una explicación** del profesor y obten un resumen
    - 📝 **Repasa en voz alta** y genera preguntas sobre lo que dijiste
    """)

# --- Página: Escanear Apuntes ---
elif page == '📸 Escanear Apuntes':
    st.title("📸 Escanear Apuntes")
    st.write("Toma una foto de tus apuntes o sube una imagen y la IA extraerá el texto.")
    
    source = st.radio("¿Cómo quieres capturar la imagen?", ["📷 Usar cámara", "📁 Subir imagen"])
    
    img_data = None
    img_mime = "image/jpeg"
    
    if source == "📷 Usar cámara":
        camera_photo = st.camera_input("Toma una foto de tus apuntes")
        if camera_photo:
            img_data = camera_photo.getvalue()
            img_mime = "image/jpeg"
            st.success("📸 Foto capturada.")
    else:
        uploaded_img = st.file_uploader("Sube una imagen", type=["jpg", "jpeg", "png", "webp"])
        if uploaded_img:
            img_data = uploaded_img.getvalue()
            img_mime = uploaded_img.type
            st.image(img_data, caption="Imagen cargada", use_container_width=True)
    
    if img_data:
        st.divider()
        st.subheader("¿Qué quieres hacer con esta imagen?")
        
        col1, col2, col3, col4 = st.columns(4)
        action = None
        with col1:
            if st.button("🔍 Extraer texto", type="primary", use_container_width=True):
                action = "ocr"
        with col2:
            if st.button("📋 Resumir", use_container_width=True):
                action = "resumir"
        with col3:
            if st.button("❓ Generar Preguntas", use_container_width=True):
                action = "preguntas"
        with col4:
            if st.button("💬 Explicar", use_container_width=True):
                action = "explicar"
        
        if action:
            if not st.session_state.api_key:
                st.error("⚠️ Configura tu API Key de Gemini en la barra lateral.")
            else:
                try:
                    with st.spinner("🤖 Analizando imagen con IA..."):
                        model = get_gemini_model(st.session_state.api_key)
                        
                        image_part = {
                            "mime_type": img_mime,
                            "data": img_data
                        }
                        
                        if action == "ocr":
                            prompt = "Extrae TODO el texto visible en esta imagen. Si son apuntes manuscritos, haz tu mejor esfuerzo por leerlos. Devuelve el texto organizado y limpio."
                        elif action == "resumir":
                            prompt = "Extrae el texto de esta imagen y genera un resumen claro y organizado del contenido. Si hay diagramas o fórmulas, descríbelos también."
                        elif action == "preguntas":
                            prompt = "Extrae el texto de esta imagen y genera 5 preguntas de práctica tipo examen basadas en el contenido. Incluye las respuestas correctas."
                        elif action == "explicar":
                            prompt = "Analiza esta imagen. Si contiene apuntes, texto o diagramas, explica el contenido de manera clara y sencilla como si fueras un tutor universitario. Usa ejemplos cotidianos."
                        
                        response = model.generate_content([prompt, image_part])
                    
                    st.subheader("Resultado:")
                    st.markdown(response.text)
                    
                except Exception as e:
                    st.error(f"Error al analizar la imagen: {str(e)}")
    
    st.divider()
    st.subheader("💡 Ideas de uso")
    st.markdown("""
    - 📖 **Escanea apuntes escritos a mano** y conviértelos a texto digital
    - 📊 **Fotografía diagramas o gráficos** y obtén una explicación
    - 📐 **Captura fórmulas o ejercicios** y pide que te los expliquen
    - 📄 **Digitaliza páginas de libros** y genera un resumen
    """)
