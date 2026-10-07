// Secciones basadas en texto: Resumir Documento, Generar Preguntas y Plan de Estudio.
import { useState } from "react";
import { useDatos, useIA } from "../datos.jsx";
import { BotonIA, Encabezado, ErrorIA, Resultado, Segmentado, Selector } from "../componentes.jsx";
import { textoDeArchivo } from "../lib/archivos.js";

export function EntradaTexto({ texto, setTexto, placeholder = "Pega tu texto aquí…" }) {
  const [fuente, setFuente] = useState("pegar");
  const [estado, setEstado] = useState("");

  const cargar = async (archivo) => {
    if (!archivo) return;
    setEstado("Leyendo archivo…");
    try {
      const contenido = await textoDeArchivo(archivo);
      setTexto(contenido);
      setEstado(
        contenido
          ? `✅ ${archivo.name}: ${contenido.split(/\s+/).length.toLocaleString("es-PE")} palabras`
          : "⚠️ No se encontró texto. Si es un PDF escaneado, usa «Escanear Apuntes»."
      );
    } catch (e) {
      setEstado(`⚠️ No se pudo leer el archivo: ${e.message}`);
    }
  };

  return (
    <div className="tarjeta">
      <Segmentado valor={fuente} onChange={setFuente} opciones={[["pegar", "✍️ Pegar texto"], ["archivo", "📄 Subir PDF o TXT"]]} />
      {fuente === "pegar" ? (
        <textarea rows={9} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} />
      ) : (
        <label className="zona-archivo">
          <input type="file" accept=".pdf,.txt,.md" onChange={(e) => cargar(e.target.files[0])} />
          <span>📂 Haz clic o arrastra aquí tu PDF o TXT</span>
          {estado && <strong>{estado}</strong>}
        </label>
      )}
    </div>
  );
}

export function Resumir() {
  const [texto, setTexto] = useState("");
  const [largo, setLargo] = useState("Medio");
  const [nivel, setNivel] = useState("Intermedio");
  const { ejecutar, cargando, error } = useIA("resumen");

  const resumir = () =>
    ejecutar({
      prompt:
        `Resume el siguiente texto. Longitud: ${largo.toLowerCase()}. Nivel de lenguaje: ${nivel.toLowerCase()}.\n` +
        "Estructura: un título, las ideas principales en viñetas, conceptos clave en negrita y una conclusión breve.\n\n" +
        `Texto:\n${texto}`,
    });

  return (
    <>
      <Encabezado icono="📝" titulo="Resumir Documento">Sube un PDF o pega texto y obtén lo más importante.</Encabezado>
      <EntradaTexto texto={texto} setTexto={setTexto} />
      <div className="fila">
        <Selector etiqueta="Longitud" valor={largo} opciones={["Corto", "Medio", "Detallado"]} onChange={setLargo} />
        <Selector etiqueta="Nivel de lenguaje" valor={nivel} opciones={["Básico", "Intermedio", "Avanzado"]} onChange={setNivel} />
      </div>
      <BotonIA cargando={cargando} disabled={!texto.trim()} onClick={resumir}>✨ Resumir con IA</BotonIA>
      <ErrorIA mensaje={error} />
      <Resultado clave="resumen" titulo="Resumen" />
    </>
  );
}

export function Preguntas() {
  const [texto, setTexto] = useState("");
  const [cantidad, setCantidad] = useState("5");
  const [tipo, setTipo] = useState("Opción múltiple");
  const { ejecutar, cargando, error } = useIA("preguntas");

  const generarPreguntas = () =>
    ejecutar({
      prompt:
        `Genera ${cantidad} preguntas de tipo "${tipo}" sobre el siguiente contenido.\n` +
        "Numera cada pregunta. Al final agrega una sección «## Respuestas» con la respuesta correcta y una explicación breve de cada una.\n\n" +
        `Contenido:\n${texto}`,
    });

  return (
    <>
      <Encabezado icono="❓" titulo="Generar Preguntas">Escribe un tema o pega tu material y practica para el examen.</Encabezado>
      <EntradaTexto texto={texto} setTexto={setTexto} placeholder="Ej.: La fotosíntesis, o pega aquí tu lectura…" />
      <div className="fila">
        <Selector etiqueta="Número de preguntas" valor={cantidad} opciones={["5", "10", "15"]} onChange={setCantidad} />
        <Selector etiqueta="Tipo" valor={tipo} opciones={["Opción múltiple", "Verdadero/Falso", "Abiertas", "Mixtas"]} onChange={setTipo} />
      </div>
      <BotonIA cargando={cargando} disabled={!texto.trim()} onClick={generarPreguntas}>🎯 Generar preguntas</BotonIA>
      <ErrorIA mensaje={error} />
      <Resultado clave="preguntas" titulo="Cuestionario de práctica" />
    </>
  );
}

export function Plan({ ir }) {
  const { tareas } = useDatos();
  const [horas, setHoras] = useState(2);
  const [dias, setDias] = useState(7);
  const { ejecutar, cargando, error } = useIA("plan");
  const pendientes = tareas.filter((t) => t.estado !== "Completada");

  const planificar = () => {
    const lista = pendientes
      .map((t) => `- ${t.tarea} (Curso: ${t.curso}, Prioridad: ${t.prioridad}, Entrega: ${t.fecha}, Estado: ${t.estado})`)
      .join("\n");
    const hoy = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    ejecutar({
      prompt:
        `Actúa como un experto en productividad estudiantil. Hoy es ${hoy}. Tengo ${horas} horas al día durante ${dias} días para estas tareas:\n${lista}\n\n` +
        "Crea un plan día por día con fechas reales, bloques de tiempo concretos, prioridad a lo que vence antes, repetición espaciada " +
        "y descansos Pomodoro (25 min de estudio / 5 de descanso). Usa un título por día y viñetas.",
    });
  };

  return (
    <>
      <Encabezado icono="📅" titulo="Plan de Estudio">Un plan personalizado a partir de tus tareas pendientes.</Encabezado>
      {tareas.length === 0 ? (
        <div className="alerta">
          No tienes tareas registradas. <button className="enlace" onClick={() => ir("cursos")}>Ir a Mis Cursos →</button>
        </div>
      ) : pendientes.length === 0 ? (
        <div className="alerta exito">🎉 ¡No tienes tareas pendientes!</div>
      ) : (
        <>
          <div className="tarjeta">
            <h2>Tareas pendientes ({pendientes.length})</h2>
            <ul className="lista-simple">
              {pendientes.map((t) => <li key={t.id}><strong>{t.tarea}</strong> <span className="tenue">· {t.curso} · {t.fecha} · {t.prioridad}</span></li>)}
            </ul>
          </div>
          <div className="fila">
            <label className="campo"><span>Horas por día</span><input type="number" min="1" max="12" value={horas} onChange={(e) => setHoras(e.target.value)} /></label>
            <label className="campo"><span>Días a planificar</span><input type="number" min="1" max="30" value={dias} onChange={(e) => setDias(e.target.value)} /></label>
          </div>
          <BotonIA cargando={cargando} onClick={planificar}>🗓️ Generar plan</BotonIA>
          <ErrorIA mensaje={error} />
        </>
      )}
      <Resultado clave="plan" titulo="Mi plan de estudio" />
    </>
  );
}
