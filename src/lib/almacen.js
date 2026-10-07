// Persistencia en el navegador (localStorage): los datos sobreviven al recargar la página.
import { useEffect, useState } from "react";

const PREFIJO = "iacademy:";

export function leer(clave, porDefecto) {
  try {
    const valor = localStorage.getItem(PREFIJO + clave);
    return valor === null ? porDefecto : JSON.parse(valor);
  } catch {
    return porDefecto;
  }
}

export function guardar(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
  }
}

export function usePersistente(clave, porDefecto) {
  const [valor, setValor] = useState(() => leer(clave, porDefecto));
  useEffect(() => guardar(clave, valor), [clave, valor]);
  return [valor, setValor];
}

export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function diasRestantes(fechaISO) {
  if (!fechaISO) return null;
  const [a, m, d] = fechaISO.split("-").map(Number);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(a, m - 1, d) - hoy) / 86400000);
}
