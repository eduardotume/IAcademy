import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDatos } from "./datos.jsx";
import { descargarTxt, descargarWord } from "./lib/exportar.js";

export function Encabezado({ icono, titulo, children }) {
  return (
    <header className="encabezado">
      <h1>
        <span className="encabezado-icono" aria-hidden>{icono}</span>
        {titulo}
      </h1>
      {children && <p>{children}</p>}
    </header>
  );
}

export function Markdown({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function BotonIA({ cargando, children, ...props }) {
  return (
    <button className="boton primario" disabled={cargando || props.disabled} {...props}>
      {cargando ? <><span className="girando" aria-hidden /> La IA está trabajando…</> : children}
    </button>
  );
}

export function ErrorIA({ mensaje }) {
  if (!mensaje) return null;
  return <div className="alerta error" role="alert">⚠️ {mensaje}</div>;
}

export function Resultado({ clave, titulo }) {
  const { resultados, borrarResultado, nombre } = useDatos();
  const texto = resultados[clave];
  if (!texto) return null;
  return (
    <section className="tarjeta resultado">
      <div className="resultado-cabecera">
        <h2>{titulo}</h2>
        <div className="acciones">
          <button className="boton" onClick={() => descargarWord(titulo, texto, nombre)}>📄 Word</button>
          <button className="boton" onClick={() => descargarTxt(titulo, texto)}>📝 TXT</button>
          <button className="boton" onClick={() => navigator.clipboard?.writeText(texto)}>📋 Copiar</button>
          <button className="boton fantasma" onClick={() => borrarResultado(clave)} aria-label="Limpiar resultado">🗑️</button>
        </div>
      </div>
      <Markdown>{texto}</Markdown>
    </section>
  );
}

export function Selector({ etiqueta, valor, opciones, onChange }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Segmentado({ valor, opciones, onChange }) {
  return (
    <div className="segmentado" role="tablist">
      {opciones.map(([v, etiqueta]) => (
        <button key={v} role="tab" aria-selected={valor === v} className={valor === v ? "activo" : ""} onClick={() => onChange(v)}>
          {etiqueta}
        </button>
      ))}
    </div>
  );
}
