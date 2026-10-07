// Estado global de IAcademy: perfil, cursos, tareas, sesiones Pomodoro y resultados de IA.
import { createContext, useContext, useState } from "react";
import { generar } from "./lib/ia.js";
import { hoyISO, nuevoId, usePersistente } from "./lib/almacen.js";

const Datos = createContext(null);
export const useDatos = () => useContext(Datos);

export function ProveedorDatos({ children }) {
  const [nombre, setNombre] = usePersistente("nombre", "Estudiante");
  const [cursos, setCursos] = usePersistente("cursos", []);
  const [tareas, setTareas] = usePersistente("tareas", []);
  const [pomodoros, setPomodoros] = usePersistente("pomodoros", []);
  const [resultados, setResultados] = usePersistente("resultados", {});
  const [avisos, setAvisos] = useState([]);

  const avisar = (texto, tipo = "ok") => {
    const id = nuevoId();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3500);
  };

  const valor = {
    nombre, setNombre, avisos, avisar,
    cursos,
    agregarCurso: (c) => {
      if (cursos.some((x) => x.curso.toLowerCase() === c.curso.trim().toLowerCase())) return false;
      setCursos([...cursos, { id: nuevoId(), ...c, curso: c.curso.trim() }].sort((a, b) => a.curso.localeCompare(b.curso)));
      return true;
    },
    eliminarCurso: (id) => {
      const curso = cursos.find((c) => c.id === id);
      setCursos(cursos.filter((c) => c.id !== id));
      if (curso) setTareas(tareas.filter((t) => t.curso !== curso.curso));
    },
    tareas: [...tareas].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")),
    agregarTarea: (t) => setTareas([...tareas, { id: nuevoId(), ...t }]),
    actualizarTarea: (id, cambios) => setTareas(tareas.map((t) => (t.id === id ? { ...t, ...cambios } : t))),
    eliminarTarea: (id) => setTareas(tareas.filter((t) => t.id !== id)),
    pomodoros,
    registrarPomodoro: (minutos, curso) => setPomodoros([...pomodoros, { id: nuevoId(), fecha: new Date().toISOString(), dia: hoyISO(), minutos, curso }]),
    resultados,
    guardarResultado: (clave, texto) => setResultados((r) => ({ ...r, [clave]: texto })),
    borrarResultado: (clave) => setResultados(({ [clave]: _, ...resto }) => resto),
  };
  return <Datos.Provider value={valor}>{children}</Datos.Provider>;
}

// Hook para cualquier sección que llame a la IA: maneja carga, errores y guarda el resultado.
export function useIA(clave) {
  const { resultados, guardarResultado, avisar } = useDatos();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const ejecutar = async (solicitud) => {
    setCargando(true);
    setError("");
    try {
      const texto = await generar(solicitud);
      if (clave) guardarResultado(clave, texto);
      avisar("¡Listo! ✨");
      return texto;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setCargando(false);
    }
  };
  return { ejecutar, cargando, error, resultado: clave ? resultados[clave] : undefined };
}
