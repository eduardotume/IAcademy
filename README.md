# IAcademy 🎓

Asistente de estudio con IA (Google Gemini) para estudiantes universitarios. Página web hecha con **React + Vite**, lista para desplegar en **Vercel**.

Autora: Giannina Cabrera Rottiers · ESAN

## Módulos

Inicio · Mis Cursos (cursos y tareas) · Resumir Documento · Generar Preguntas · Plan de Estudio · Pomodoro · Chat Tutor · Voz a Texto · Escanear Apuntes · Ajustes

Los datos (cursos, tareas, chat, pomodoros) se guardan en el navegador. Los resultados se descargan en Word o TXT.

## Estructura

```
api/              Funciones serverless de Vercel (la API key nunca llega al navegador)
  gemini.js       POST /api/gemini  → llama a Gemini
  config.js       GET  /api/config  → modelos disponibles
  _lib/gemini.js  Lógica compartida
src/              Frontend React
  paginas/        Una vista por módulo
  lib/            IA, archivos (PDF, audio, imagen), exportar Word/TXT, almacenamiento
index.html
vite.config.js    Incluye un middleware para que /api funcione también en local
```

## Correr en local

Requiere Node 18 o superior.

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# edita .env y pon tu GEMINI_API_KEY (https://aistudio.google.com/apikey)
npm run dev               # en PowerShell, si da error: npm.cmd run dev
```

Se abre en http://localhost:5173

## Desplegar en Vercel

1. En Vercel: **Add New → Project → Import** el repositorio `IAcademy`.
2. Framework: **Vite** (se detecta solo). No cambies los comandos.
3. En **Environment Variables** agrega `GEMINI_API_KEY` con tu clave (opcional: `GEMINI_MODEL`, por defecto `gemini-3.5-flash`).
4. **Deploy**.

Si ya habías importado el proyecto antes, agrega la variable en *Settings → Environment Variables* y haz **Redeploy**.

Sin `GEMINI_API_KEY` en el servidor, cada usuario puede poner su propia clave en **Ajustes** (se guarda solo en su navegador).

## Licencia

Ver [LICENSE](LICENSE).
