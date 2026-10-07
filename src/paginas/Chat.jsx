import { useEffect, useRef, useState } from "react";
import { useDatos, useIA } from "../datos.jsx";
import { Encabezado, ErrorIA, Markdown } from "../componentes.jsx";
import { usePersistente } from "../lib/almacen.js";
import { textoDeArchivo } from "../lib/archivos.js";
import { descargarWord } from "../lib/exportar.js";

const RAPIDAS = [
  ["🧠 Explícame el tema principal", "Explícame el tema principal de forma muy simple. Si no tienes un documento, pregúntame qué tema quiero."],
  ["💡 Dame ejemplos reales", "Dame ejemplos de la vida real sobre el tema que estamos viendo."],
  ["🤝 Paso a paso", "Ayúdame a entender paso a paso cómo resolver un problema típico de este tema."],
];

export default function Chat() {
  const { nombre } = useDatos();
  const [mensajes, setMensajes] = usePersistente("chat", []);
  const [entrada, setEntrada] = useState("");
  const [contexto, setContexto] = useState({ nombre: "", texto: "" });
  const { ejecutar, cargando, error } = useIA(null);
  const fin = useRef(null);

  useEffect(() => fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [mensajes, cargando]);

  const enviar = async (texto) => {
    texto = texto.trim();
    if (!texto || cargando) return;
    const previos = mensajes.slice(-10);
    setMensajes([...mensajes, { role: "user", content: texto }]);
    setEntrada("");
    let sistema =
      "Eres IAcademy, un tutor universitario amigable y experto. Explicas de manera clara y sencilla, con ejemplos cotidianos, y respondes en español.";
    if (contexto.texto) sistema += `\n\nDocumento del estudiante (úsalo como referencia principal):\n${contexto.texto.slice(0, 30000)}`;
    const respuesta = await ejecutar({ prompt: texto, historial: previos, sistema });
    setMensajes((m) => (respuesta ? [...m, { role: "assistant", content: respuesta }] : m.slice(0, -1)));
    if (!respuesta) setEntrada(texto);
  };

  const cargarPdf = async (archivo) => {
    if (!archivo) return;
    const texto = await textoDeArchivo(archivo);
    setContexto({ nombre: archivo.name, texto });
  };

  const conversacion = mensajes.map((m) => `**${m.role === "user" ? "Tú" : "Tutor IAcademy"}:** ${m.content}`).join("\n\n");

  return (
    <>
      <Encabezado icono="💬" titulo="Chat Tutor">Pregunta lo que no entiendas. Puedes darle un PDF para que lo use de referencia.</Encabezado>

      <div className="chat-barra">
        <label className="boton">
          📄 {contexto.nombre ? `Contexto: ${contexto.nombre}` : "Subir documento de contexto"}
          <input type="file" accept=".pdf,.txt,.md" hidden onChange={(e) => cargarPdf(e.target.files[0])} />
        </label>
        {contexto.nombre && <button className="boton fantasma" onClick={() => setContexto({ nombre: "", texto: "" })}>Quitar</button>}
        <span className="espaciador" />
        {mensajes.length > 0 && (
          <>
            <button className="boton" onClick={() => descargarWord("Conversación con el Tutor", conversacion, nombre)}>📄 Descargar</button>
            <button className="boton fantasma" onClick={() => setMensajes([])}>🧹 Nueva</button>
          </>
        )}
      </div>

      <div className="chat">
        {mensajes.length === 0 && (
          <div className="chat-vacio">
            <p>¿Por dónde empezamos?</p>
            <div className="acciones centradas">
              {RAPIDAS.map(([etiqueta, texto]) => <button key={etiqueta} className="boton" onClick={() => enviar(texto)}>{etiqueta}</button>)}
            </div>
          </div>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`burbuja ${m.role === "user" ? "yo" : "tutor"}`}>
            {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
          </div>
        ))}
        {cargando && <div className="burbuja tutor escribiendo"><span /><span /><span /></div>}
        <div ref={fin} />
      </div>
      <ErrorIA mensaje={error} />

      <form className="chat-entrada" onSubmit={(e) => { e.preventDefault(); enviar(entrada); }}>
        <textarea
          rows={1}
          value={entrada}
          placeholder="Escribe tu duda…"
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(entrada); } }}
        />
        <button className="boton primario" disabled={cargando || !entrada.trim()} aria-label="Enviar">➤</button>
      </form>
    </>
  );
}
