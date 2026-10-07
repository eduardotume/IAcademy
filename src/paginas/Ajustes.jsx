import { useEffect, useState } from "react";
import { useDatos } from "../datos.jsx";
import { Encabezado } from "../componentes.jsx";
import { obtenerConfig } from "../lib/ia.js";
import { usePersistente } from "../lib/almacen.js";

export default function Ajustes() {
  const { avisar } = useDatos();
  const [apiKey, setApiKey] = usePersistente("apiKey", "");
  const [modelo, setModelo] = usePersistente("modelo", "");
  const [config, setConfig] = useState(null);

  useEffect(() => {
    obtenerConfig().then(setConfig);
  }, [apiKey]);

  const borrarTodo = () => {
    if (!window.confirm("¿Borrar cursos, tareas, chat y resultados guardados en este navegador?")) return;
    Object.keys(localStorage).filter((k) => k.startsWith("iacademy:")).forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  return (
    <>
      <Encabezado icono="⚙️" titulo="Ajustes">Configuración del motor de IA y de tus datos.</Encabezado>

      <section className="tarjeta formulario">
        <h2>🤖 Motor de IA · Google Gemini</h2>
        {config?.claveEnServidor ? (
          <div className="alerta exito">🔐 El servidor ya tiene una API key configurada. No necesitas poner la tuya.</div>
        ) : (
          <div className="alerta">El servidor no tiene API key. Pega la tuya para usar las funciones de IA.</div>
        )}
        <label className="campo">
          <span>Tu API key de Gemini (opcional si el servidor ya tiene una)</span>
          <input type="password" value={apiKey} placeholder="AIza…" onChange={(e) => setApiKey(e.target.value.trim())} />
        </label>
        <p className="tenue">
          Se guarda solo en este navegador. Consíguela gratis en{" "}
          <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio</a>.
        </p>
        <label className="campo">
          <span>Modelo</span>
          <select value={modelo} onChange={(e) => { setModelo(e.target.value); avisar("Modelo actualizado"); }}>
            <option value="">Por defecto ({config?.modeloPorDefecto || "…"})</option>
            {(config?.modelos || []).map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      </section>

      <section className="tarjeta">
        <h2>💾 Tus datos</h2>
        <p>Cursos, tareas, Pomodoros, chat y resultados se guardan en este navegador. No se suben a ningún servidor.</p>
        <button className="boton peligro" onClick={borrarTodo}>🗑️ Borrar todos mis datos</button>
      </section>
    </>
  );
}
