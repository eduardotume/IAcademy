# IAcademy 🎓

Asistente inteligente para estudiantes universitarios, impulsado por IA generativa multimodal (texto, voz e imagen).

## Problema que resuelve

Los estudiantes pierden tiempo por desorganización, lecturas densas difíciles de sintetizar y mala planificación del estudio. IAcademy reúne en una sola app la organización de cursos y tareas, el resumen de documentos, la práctica con preguntas, un tutor conversacional, la transcripción de voz, el escaneo de apuntes y un temporizador Pomodoro.

## Módulos

| Módulo | Qué hace | IA usada |
|---|---|---|
| 🏠 Inicio | Panel con métricas, próximas entregas y accesos rápidos | — |
| 📚 Mis Cursos | Cursos y tareas guardados en SQLite (no se borran al recargar) | — |
| 📝 Resumir Documento | Resume PDF/TXT o texto pegado | Texto |
| ❓ Generar Preguntas | Cuestionarios con respuestas | Texto |
| 📅 Plan de Estudio | Plan día por día con tus tareas pendientes | Texto |
| ⏱️ Pomodoro | Temporizador 25/5/15 que registra tus sesiones | — |
| 💬 Chat Tutor | Tutor con memoria de conversación y documento de contexto | Texto |
| 🎙️ Voz a Texto | Transcribe, resume o genera preguntas desde tu voz | Audio |
| 📸 Escanear Apuntes | OCR de apuntes manuscritos, resumen y explicación | Imagen |

Todos los resultados de IA se pueden descargar en **Word (.docx)** o **TXT**.

## Arquitectura

```
iacademy/
├── app.py                    # Interfaz Streamlit (9 páginas)
├── ia.py                     # Capa de IA: Gemini (nube) o modelo local de Hugging Face
├── db.py                     # Persistencia en SQLite (iacademy.db se crea solo)
├── exportar.py               # Exportación a Word
├── requirements.txt          # Dependencias principales
├── requirements-local.txt    # Opcional: transformers + torch para modelo local
├── setup_anaconda.bat        # Instalación automática en Windows
└── .streamlit/
    ├── config.toml           # Tema morado universitario (#7C3AED)
    └── secrets.toml.example  # Plantilla para guardar la API Key
```

Toda la app llama a una sola función `generar()` en `ia.py`. Por eso se puede cambiar de motor de IA desde la barra lateral sin tocar las páginas:

- **☁️ Google Gemini** (por defecto): multimodal, usa el SDK `google-genai`. El modelo por defecto está en la constante `GEMINI_MODEL` y la barra lateral muestra los modelos disponibles para tu clave.
- **💻 Modelo local (Hugging Face)**: corre en tu PC con `transformers`, sin internet ni API Key. Por defecto `Qwen/Qwen2.5-1.5B-Instruct`. Solo texto: voz e imágenes requieren Gemini.

## Instalación con Anaconda (Windows)

1. Abre **Anaconda Prompt** o **Anaconda PowerShell Prompt**.
2. Ve a la carpeta del proyecto, por ejemplo `cd D:\iacademy\iacademy`.
3. Ejecuta:
   ```cmd
   setup_anaconda.bat
   ```
4. (Opcional) Para el modelo local:
   ```cmd
   conda activate iacademy
   pip install -r requirements-local.txt
   ```

## API Key de Gemini

1. Entra a [Google AI Studio](https://aistudio.google.com/) y genera una API Key.
2. Pégala en la barra lateral, **o** copia `.streamlit/secrets.toml.example` como `.streamlit/secrets.toml` y escribe tu clave ahí para no ingresarla cada vez.

## Ejecutar

```cmd
conda activate iacademy
streamlit run app.py
```

## Tecnologías

Python · Streamlit · Google Gen AI SDK (Gemini) · Hugging Face Transformers (opcional) · SQLite · python-docx · PyPDF2 · Pandas

## Autora

**Giannina Cabrera Rottiers**
