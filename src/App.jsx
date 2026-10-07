import { useEffect, useState } from "react";
import { ProveedorDatos, useDatos } from "./datos.jsx";
import { PAGINAS } from "./paginas.js";
import { obtenerConfig } from "./lib/ia.js";
import { leer } from "./lib/almacen.js";
import Inicio from "./paginas/Inicio.jsx";
import Cursos from "./paginas/Cursos.jsx";
import { Plan, Preguntas, Resumir } from "./paginas/Texto.jsx";
import Pomodoro, { fmt, usePomodoro } from "./paginas/Pomodoro.jsx";
import Chat from "./paginas/Chat.jsx";
import { Escanear, Voz } from "./paginas/Multimodal.jsx";
import Ajustes from "./paginas/Ajustes.jsx";

const paginaDeHash = () => {
  const id = location.hash.replace("#/", "");
  return PAGINAS.some((p) => p.id === id) ? id : "inicio";
};

function Aplicacion() {
  const { avisos } = useDatos();
  const [pagina, setPagina] = useState(paginaDeHash);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sinClave, setSinClave] = useState(false);
  const pomodoro = usePomodoro();

  useEffect(() => {
    const alCambiar = () => setPagina(paginaDeHash());
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  useEffect(() => {
    obtenerConfig().then((c) => setSinClave(!c.claveEnServidor && !leer("apiKey", "")));
  }, [pagina]);

  const ir = (id) => {
    location.hash = `/${id}`;
    setMenuAbierto(false);
    window.scrollTo({ top: 0 });
  };

  const vistas = {
    inicio: <Inicio ir={ir} />,
    cursos: <Cursos />,
    resumir: <Resumir />,
    preguntas: <Preguntas />,
    plan: <Plan ir={ir} />,
    pomodoro: <Pomodoro pomodoro={pomodoro} />,
    chat: <Chat />,
    voz: <Voz />,
    escanear: <Escanear />,
    ajustes: <Ajustes />,
  };

  return (
    <div className={`app ${menuAbierto ? "menu-abierto" : ""}`}>
      <header className="barra-movil">
        <button className="boton fantasma" onClick={() => setMenuAbierto(!menuAbierto)} aria-label="Menú">☰</button>
        <span className="marca">IAcademy 🎓</span>
        {pomodoro.sesion?.fin && <button className="chip" onClick={() => ir("pomodoro")}>🍅 {fmt(pomodoro.restante)}</button>}
      </header>

      <aside className="lateral">
        <div className="marca-lateral">
          <span className="marca">IAcademy</span>
          <span className="tenue">Tu asistente de estudio inteligente</span>
        </div>
        <nav>
          {PAGINAS.map((p) => (
            <button key={p.id} className={`nav-item ${pagina === p.id ? "activo" : ""}`} onClick={() => ir(p.id)}>
              <span aria-hidden>{p.icono}</span> {p.titulo}
            </button>
          ))}
        </nav>
        {pomodoro.sesion && (
          <button className="pomodoro-mini" onClick={() => ir("pomodoro")}>
            🍅 {fmt(pomodoro.restante)} <span className="tenue">{pomodoro.sesion.fin ? "en curso" : "en pausa"}</span>
          </button>
        )}
        <p className="pie">Hecho por Giannina Cabrera Rottiers · ESAN</p>
      </aside>
      <div className="velo" onClick={() => setMenuAbierto(false)} />

      <main className="contenido">
        {sinClave && pagina !== "ajustes" && (
          <div className="alerta">
            🔑 Falta configurar la API key de Gemini para usar la IA. <button className="enlace" onClick={() => ir("ajustes")}>Ir a Ajustes →</button>
          </div>
        )}
        {vistas[pagina]}
      </main>

      <div className="avisos" aria-live="polite">
        {avisos.map((a) => <div key={a.id} className={`aviso ${a.tipo}`}>{a.texto}</div>)}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ProveedorDatos>
      <Aplicacion />
    </ProveedorDatos>
  );
}
