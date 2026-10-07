import { useDatos } from "../datos.jsx";
import { Vencimiento } from "./Cursos.jsx";
import { hoyISO } from "../lib/almacen.js";
import { PAGINAS } from "../paginas.js";

export default function Inicio({ ir }) {
  const { nombre, setNombre, cursos, tareas, pomodoros } = useDatos();
  const pendientes = tareas.filter((t) => t.estado !== "Completada");
  const hoy = pomodoros.filter((p) => p.dia === hoyISO()).length;
  const horas = pomodoros.reduce((s, p) => s + p.minutos, 0) / 60;

  return (
    <>
      <section className="bienvenida">
        <div>
          <p className="sobretitulo">Tu asistente de estudio con IA</p>
          <h1>
            ¡Hola,{" "}
            <input
              className="nombre-editable"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              aria-label="Tu nombre"
              size={Math.max(nombre.length, 4)}
            />
            ! 👋
          </h1>
          <p>Organiza tus cursos, resume lecturas, practica para tus exámenes y estudia con Pomodoro, todo en un solo lugar.</p>
        </div>
      </section>

      <section className="metricas">
        <Metrica etiqueta="Cursos" valor={cursos.length} icono="📚" />
        <Metrica etiqueta="Tareas pendientes" valor={pendientes.length} icono="📝" />
        <Metrica etiqueta="Pomodoros hoy" valor={hoy} icono="🍅" />
        <Metrica etiqueta="Horas de enfoque" valor={horas.toFixed(1)} icono="⏱️" />
      </section>

      {pendientes.length > 0 && (
        <section className="tarjeta">
          <h2>📌 Próximas entregas</h2>
          <ul className="lista-simple">
            {pendientes.slice(0, 4).map((t) => (
              <li key={t.id}>
                <strong>{t.tarea}</strong> <span className="tenue">· {t.curso}</span> <Vencimiento fecha={t.fecha} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="subtitulo">¿Qué quieres hacer hoy?</h2>
      <section className="accesos">
        {PAGINAS.filter((p) => p.id !== "inicio" && p.id !== "ajustes").map((p) => (
          <button key={p.id} className="acceso" onClick={() => ir(p.id)}>
            <span className="acceso-icono">{p.icono}</span>
            <strong>{p.titulo}</strong>
            <span>{p.descripcion}</span>
          </button>
        ))}
      </section>
    </>
  );
}

function Metrica({ etiqueta, valor, icono }) {
  return (
    <div className="metrica">
      <span className="metrica-icono">{icono}</span>
      <span className="metrica-valor">{valor}</span>
      <span className="metrica-etiqueta">{etiqueta}</span>
    </div>
  );
}
