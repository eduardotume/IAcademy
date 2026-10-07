"""
db.py — Persistencia local con SQLite.

Los datos se guardan en el archivo iacademy.db (junto a app.py),
así cursos, tareas y sesiones de estudio no se pierden al recargar la página.
"""

import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "iacademy.db"


def _conectar():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def inicializar():
    with _conectar() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS ajustes (
                clave TEXT PRIMARY KEY,
                valor TEXT
            );
            CREATE TABLE IF NOT EXISTS cursos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                curso TEXT NOT NULL UNIQUE,
                profesor TEXT,
                horario TEXT
            );
            CREATE TABLE IF NOT EXISTS tareas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                curso TEXT NOT NULL,
                tarea TEXT NOT NULL,
                fecha TEXT,
                prioridad TEXT,
                estado TEXT
            );
            CREATE TABLE IF NOT EXISTS pomodoros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT NOT NULL,
                minutos INTEGER NOT NULL,
                curso TEXT
            );
            """
        )


# --- Ajustes (nombre del estudiante, etc.) ---
def leer_ajuste(clave, por_defecto=""):
    with _conectar() as con:
        fila = con.execute("SELECT valor FROM ajustes WHERE clave = ?", (clave,)).fetchone()
    return fila["valor"] if fila else por_defecto


def guardar_ajuste(clave, valor):
    with _conectar() as con:
        con.execute(
            "INSERT INTO ajustes (clave, valor) VALUES (?, ?) "
            "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            (clave, valor),
        )


# --- Cursos ---
def listar_cursos():
    with _conectar() as con:
        return [dict(f) for f in con.execute("SELECT * FROM cursos ORDER BY curso")]


def agregar_curso(curso, profesor, horario):
    """Devuelve False si el curso ya existía."""
    try:
        with _conectar() as con:
            con.execute(
                "INSERT INTO cursos (curso, profesor, horario) VALUES (?, ?, ?)",
                (curso.strip(), profesor.strip(), horario.strip()),
            )
        return True
    except sqlite3.IntegrityError:
        return False


def eliminar_curso(curso_id):
    """Elimina el curso y sus tareas."""
    with _conectar() as con:
        fila = con.execute("SELECT curso FROM cursos WHERE id = ?", (curso_id,)).fetchone()
        if fila:
            con.execute("DELETE FROM tareas WHERE curso = ?", (fila["curso"],))
        con.execute("DELETE FROM cursos WHERE id = ?", (curso_id,))


# --- Tareas ---
def listar_tareas(solo_pendientes=False):
    sql = "SELECT * FROM tareas"
    if solo_pendientes:
        sql += " WHERE estado != 'Completada'"
    sql += " ORDER BY fecha"
    with _conectar() as con:
        return [dict(f) for f in con.execute(sql)]


def agregar_tarea(curso, tarea, fecha, prioridad, estado):
    with _conectar() as con:
        con.execute(
            "INSERT INTO tareas (curso, tarea, fecha, prioridad, estado) VALUES (?, ?, ?, ?, ?)",
            (curso, tarea.strip(), fecha, prioridad, estado),
        )


def actualizar_estado_tarea(tarea_id, estado):
    with _conectar() as con:
        con.execute("UPDATE tareas SET estado = ? WHERE id = ?", (estado, tarea_id))


def eliminar_tarea(tarea_id):
    with _conectar() as con:
        con.execute("DELETE FROM tareas WHERE id = ?", (tarea_id,))


# --- Pomodoro ---
def registrar_pomodoro(minutos, curso=None):
    with _conectar() as con:
        con.execute(
            "INSERT INTO pomodoros (fecha, minutos, curso) VALUES (?, ?, ?)",
            (datetime.now().isoformat(timespec="seconds"), minutos, curso),
        )


def resumen_pomodoros():
    """Devuelve (sesiones totales, minutos totales, sesiones de hoy)."""
    hoy = datetime.now().date().isoformat()
    with _conectar() as con:
        total = con.execute("SELECT COUNT(*), COALESCE(SUM(minutos), 0) FROM pomodoros").fetchone()
        de_hoy = con.execute("SELECT COUNT(*) FROM pomodoros WHERE fecha LIKE ?", (hoy + "%",)).fetchone()
    return total[0], total[1], de_hoy[0]
