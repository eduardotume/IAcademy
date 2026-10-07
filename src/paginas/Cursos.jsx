import { useState } from "react";
import { useDatos } from "../datos.jsx";
import { Encabezado, Segmentado } from "../componentes.jsx";
import { diasRestantes, hoyISO } from "../lib/almacen.js";

const ESTADOS = ["Pendiente", "En progreso", "Completada"];
const PRIORIDAD = { Alta: "🔴", Media: "🟡", Baja: "🟢" };

export function Vencimiento({ fecha }) {
  const d = diasRestantes(fecha);
  if (d === null) return null;
  if (d < 0) return <span className="etiqueta peligro">Venció hace {-d} día(s)</span>;
  if (d === 0) return <span className="etiqueta alerta-suave">Vence hoy</span>;
  if (d === 1) return <span className="etiqueta alerta-suave">Vence mañana</span>;
  return <span className="etiqueta">Faltan {d} días</span>;
}

export default function Cursos() {
  const [pestana, setPestana] = useState("tareas");
  return (
    <>
      <Encabezado icono="📚" titulo="Mis Cursos y Tareas">Todo se guarda en tu navegador: no se pierde al recargar.</Encabezado>
      <Segmentado valor={pestana} onChange={setPestana} opciones={[["tareas", "📝 Tareas"], ["cursos", "📚 Cursos"]]} />
      {pestana === "tareas" ? <Tareas irACursos={() => setPestana("cursos")} /> : <ListaCursos />}
    </>
  );
}

function ListaCursos() {
  const { cursos, agregarCurso, eliminarCurso, avisar } = useDatos();
  const [form, setForm] = useState({ curso: "", profesor: "", horario: "" });

  const enviar = (e) => {
    e.preventDefault();
    if (!form.curso.trim()) return;
    if (agregarCurso(form)) {
      avisar(`Curso "${form.curso}" guardado`);
      setForm({ curso: "", profesor: "", horario: "" });
    } else avisar(`El curso "${form.curso}" ya existe`, "error");
  };

  return (
    <>
      <form className="tarjeta formulario" onSubmit={enviar}>
        <h2>Añadir curso</h2>
        <div className="fila">
          <label className="campo"><span>Nombre del curso *</span><input required value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })} /></label>
          <label className="campo"><span>Profesor</span><input value={form.profesor} onChange={(e) => setForm({ ...form, profesor: e.target.value })} /></label>
          <label className="campo"><span>Horario</span><input placeholder="Lun y Mié 8:00–10:00" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} /></label>
        </div>
        <button className="boton primario">➕ Añadir curso</button>
      </form>

      {cursos.length === 0 ? (
        <p className="vacio">Aún no tienes cursos registrados.</p>
      ) : (
        <div className="lista">
          {cursos.map((c) => (
            <div key={c.id} className="item">
              <div>
                <strong>{c.curso}</strong>
                <div className="tenue">👤 {c.profesor || "—"} · 🕒 {c.horario || "—"}</div>
              </div>
              <button className="boton fantasma" title="Eliminar curso y sus tareas" onClick={() => eliminarCurso(c.id)}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Tareas({ irACursos }) {
  const { cursos, tareas, agregarTarea, actualizarTarea, eliminarTarea, avisar } = useDatos();
  const [filtro, setFiltro] = useState("pendientes");
  const vacio = { curso: cursos[0]?.curso || "", tarea: "", fecha: hoyISO(), prioridad: "Alta", estado: "Pendiente" };
  const [form, setForm] = useState(vacio);

  if (cursos.length === 0)
    return (
      <div className="alerta">
        Primero añade un curso. <button className="enlace" onClick={irACursos}>Ir a Cursos →</button>
      </div>
    );

  const visibles = tareas.filter((t) =>
    filtro === "todas" ? true : filtro === "completadas" ? t.estado === "Completada" : t.estado !== "Completada"
  );

  const enviar = (e) => {
    e.preventDefault();
    if (!form.tarea.trim()) return;
    agregarTarea({ ...form, curso: form.curso || cursos[0].curso, tarea: form.tarea.trim() });
    avisar("Tarea guardada");
    setForm({ ...vacio, curso: form.curso });
  };

  return (
    <>
      <form className="tarjeta formulario" onSubmit={enviar}>
        <h2>Añadir tarea</h2>
        <div className="fila">
          <label className="campo"><span>Curso</span>
            <select value={form.curso || cursos[0].curso} onChange={(e) => setForm({ ...form, curso: e.target.value })}>
              {cursos.map((c) => <option key={c.id}>{c.curso}</option>)}
            </select>
          </label>
          <label className="campo ancho"><span>Tarea *</span><input required value={form.tarea} onChange={(e) => setForm({ ...form, tarea: e.target.value })} /></label>
        </div>
        <div className="fila">
          <label className="campo"><span>Entrega</span><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
          <label className="campo"><span>Prioridad</span>
            <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>{Object.keys(PRIORIDAD).map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="campo"><span>Estado</span>
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>{ESTADOS.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
        </div>
        <button className="boton primario">➕ Añadir tarea</button>
      </form>

      <Segmentado valor={filtro} onChange={setFiltro} opciones={[["pendientes", "Pendientes"], ["completadas", "Completadas"], ["todas", "Todas"]]} />
      {visibles.length === 0 ? (
        <p className="vacio">No hay tareas en esta vista.</p>
      ) : (
        <div className="lista">
          {visibles.map((t) => (
            <div key={t.id} className={`item ${t.estado === "Completada" ? "hecha" : ""}`}>
              <div>
                <strong>{PRIORIDAD[t.prioridad]} {t.tarea}</strong>
                <div className="tenue">{t.curso} · 📅 {t.fecha} <Vencimiento fecha={t.estado === "Completada" ? null : t.fecha} /></div>
              </div>
              <div className="acciones">
                <select
                  value={t.estado}
                  aria-label="Estado"
                  onChange={(e) => {
                    actualizarTarea(t.id, { estado: e.target.value });
                    if (e.target.value === "Completada") avisar("¡Tarea completada! 🎉");
                  }}
                >
                  {ESTADOS.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button className="boton fantasma" title="Eliminar tarea" onClick={() => eliminarTarea(t.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
