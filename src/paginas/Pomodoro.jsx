import { useEffect, useRef, useState } from "react";
import { useDatos } from "../datos.jsx";
import { Encabezado, Segmentado } from "../componentes.jsx";
import { hoyISO, usePersistente } from "../lib/almacen.js";

const MODOS = { enfoque: ["🍅 Enfoque", 25], corto: ["☕ Descanso corto", 5], largo: ["🌴 Descanso largo", 15] };

function pitido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach((t) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = 880;
      vol.gain.value = 0.2;
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.18);
    });
  } catch { /* sin audio */ }
}

// El temporizador vive aquí (no en la página) para que siga corriendo si cambias de sección.
export function usePomodoro() {
  const { registrarPomodoro, avisar } = useDatos();
  const [sesion, setSesion] = usePersistente("pomodoroActivo", null); // { modo, minutos, curso, fin, restante }
  const [, forzar] = useState(0);
  const terminado = useRef(false);

  const restante = sesion ? (sesion.fin ? Math.max(0, Math.ceil((sesion.fin - Date.now()) / 1000)) : sesion.restante) : null;

  useEffect(() => {
    if (!sesion?.fin) return;
    terminado.current = false;
    const t = setInterval(() => forzar((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [sesion?.fin]);

  useEffect(() => {
    if (sesion?.fin && restante === 0 && !terminado.current) {
      terminado.current = true;
      pitido();
      if (sesion.modo === "enfoque") {
        registrarPomodoro(sesion.minutos, sesion.curso);
        avisar("🎉 ¡Bloque de enfoque completado! Toma un descanso.");
      } else avisar("⏰ Se acabó el descanso. ¡A estudiar!");
      setSesion(null);
    }
  });

  useEffect(() => {
    document.title = sesion?.fin && restante ? `${fmt(restante)} · IAcademy` : "IAcademy 🎓";
  }, [sesion, restante]);

  return {
    sesion,
    restante,
    iniciar: (modo, minutos, curso) => setSesion({ modo, minutos, curso, fin: Date.now() + minutos * 60000 }),
    pausar: () => setSesion({ ...sesion, fin: null, restante }),
    reanudar: () => setSesion({ ...sesion, fin: Date.now() + sesion.restante * 1000, restante: null }),
    reiniciar: () => setSesion(null),
  };
}

export const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Pomodoro({ pomodoro }) {
  const { cursos, pomodoros } = useDatos();
  const { sesion, restante, iniciar, pausar, reanudar, reiniciar } = pomodoro;
  const [modo, setModo] = useState("enfoque");
  const [minutos, setMinutos] = useState(25);
  const [curso, setCurso] = useState("");

  const modoActual = sesion?.modo || modo;
  const total = (sesion?.minutos || minutos) * 60;
  const mostrar = restante ?? minutos * 60;
  const progreso = 1 - mostrar / total;
  const hoy = pomodoros.filter((p) => p.dia === hoyISO()).length;
  const horas = pomodoros.reduce((s, p) => s + p.minutos, 0) / 60;
  const R = 120, C = 2 * Math.PI * R;

  return (
    <>
      <Encabezado icono="⏱️" titulo="Pomodoro">Estudia en bloques de enfoque con descansos cortos. Cada bloque completado se guarda.</Encabezado>

      <div className="pomodoro">
        <div className="reloj-envoltura">
          <svg viewBox="0 0 280 280" className="reloj-anillo" aria-hidden>
            <circle cx="140" cy="140" r={R} className="anillo-fondo" />
            <circle cx="140" cy="140" r={R} className={`anillo-progreso ${modoActual}`} strokeDasharray={C} strokeDashoffset={C * (1 - progreso)} />
          </svg>
          <div className="reloj-texto">
            <span className="reloj-modo">{MODOS[modoActual][0]}</span>
            <span className="reloj">{fmt(mostrar)}</span>
            <span className="tenue">{sesion ? (sesion.fin ? "en curso" : "en pausa") : "listo"}</span>
          </div>
        </div>

        <div className="pomodoro-controles">
          {!sesion ? (
            <>
              <Segmentado valor={modo} onChange={(m) => { setModo(m); setMinutos(MODOS[m][1]); }} opciones={Object.entries(MODOS).map(([k, [e]]) => [k, e])} />
              <div className="fila">
                <label className="campo"><span>Minutos</span><input type="number" min="1" max="120" value={minutos} onChange={(e) => setMinutos(Math.max(1, Number(e.target.value) || 1))} /></label>
                <label className="campo"><span>¿Qué curso estudias?</span>
                  <select value={curso} onChange={(e) => setCurso(e.target.value)}>
                    <option value="">(Sin curso)</option>
                    {cursos.map((c) => <option key={c.id}>{c.curso}</option>)}
                  </select>
                </label>
              </div>
              <button className="boton primario grande" onClick={() => iniciar(modo, minutos, curso || null)}>▶️ Iniciar</button>
            </>
          ) : (
            <>
              <p className="tenue">{sesion.minutos} min · {sesion.curso || "Sin curso"}</p>
              <div className="acciones">
                {sesion.fin ? <button className="boton primario grande" onClick={pausar}>⏸️ Pausar</button> : <button className="boton primario grande" onClick={reanudar}>▶️ Reanudar</button>}
                <button className="boton grande" onClick={reiniciar}>🔄 Reiniciar</button>
              </div>
              <p className="tenue">Puedes cambiar de sección: el temporizador sigue corriendo.</p>
            </>
          )}
        </div>
      </div>

      <section className="metricas">
        <div className="metrica"><span className="metrica-valor">{hoy}</span><span className="metrica-etiqueta">Sesiones hoy</span></div>
        <div className="metrica"><span className="metrica-valor">{pomodoros.length}</span><span className="metrica-etiqueta">Sesiones totales</span></div>
        <div className="metrica"><span className="metrica-valor">{horas.toFixed(1)}</span><span className="metrica-etiqueta">Horas de enfoque</span></div>
      </section>

      <details className="tarjeta">
        <summary>💡 ¿Cómo funciona la técnica Pomodoro?</summary>
        <ol>
          <li>Elige una tarea y estudia <strong>25 minutos</strong> sin distracciones.</li>
          <li>Toma un <strong>descanso corto de 5 minutos</strong>.</li>
          <li>Cada 4 bloques, toma un <strong>descanso largo de 15 minutos</strong>.</li>
        </ol>
      </details>
    </>
  );
}
