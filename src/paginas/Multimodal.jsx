// Secciones multimodales: Voz a Texto (audio) y Escanear Apuntes (imagen).
import { useEffect, useRef, useState } from "react";
import { useIA } from "../datos.jsx";
import { BotonIA, Encabezado, ErrorIA, Resultado, Segmentado } from "../componentes.jsx";
import { audioParaIA, imagenParaIA } from "../lib/archivos.js";

const ACCIONES_VOZ = {
  transcribir: ["📝 Transcribir", "Transcribe el siguiente audio en español. Devuelve SOLO la transcripción, sin comentarios."],
  resumir: ["📋 Transcribir y resumir", "Transcribe el audio en español y luego resume lo que se dijo.\n\n## Transcripción\n(texto)\n\n## Resumen\n(viñetas)"],
  preguntas: ["❓ Transcribir y generar preguntas", "Transcribe el audio en español y genera 5 preguntas de práctica con sus respuestas.\n\n## Transcripción\n(texto)\n\n## Preguntas de práctica\n(preguntas y respuestas)"],
};

export function Voz() {
  const [estado, setEstado] = useState("listo"); // listo | grabando
  const [grabacion, setGrabacion] = useState(null); // { blob, url }
  const [segundos, setSegundos] = useState(0);
  const [fallo, setFallo] = useState("");
  const grabador = useRef(null);
  const { ejecutar, cargando, error } = useIA("voz");

  useEffect(() => {
    if (estado !== "grabando") return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [estado]);

  const grabar = async () => {
    setFallo("");
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const trozos = [];
      const rec = new MediaRecorder(flujo);
      rec.ondataavailable = (e) => trozos.push(e.data);
      rec.onstop = () => {
        flujo.getTracks().forEach((t) => t.stop());
        const blob = new Blob(trozos, { type: rec.mimeType || "audio/webm" });
        setGrabacion({ blob, url: URL.createObjectURL(blob) });
      };
      rec.start();
      grabador.current = rec;
      setGrabacion(null);
      setSegundos(0);
      setEstado("grabando");
    } catch {
      setFallo("No se pudo usar el micrófono. Revisa que el navegador tenga permiso.");
    }
  };

  const detener = () => {
    grabador.current?.stop();
    setEstado("listo");
  };

  const procesar = async (accion) => {
    try {
      const audio = await audioParaIA(grabacion.blob);
      await ejecutar({ prompt: ACCIONES_VOZ[accion][1], archivos: [audio] });
    } catch (e) {
      setFallo(`No se pudo procesar el audio: ${e.message}`);
    }
  };

  return (
    <>
      <Encabezado icono="🎙️" titulo="Voz a Texto">Graba tu voz y la IA la transcribe, la resume o te hace preguntas.</Encabezado>
      <div className="tarjeta centrada">
        <button className={`microfono ${estado === "grabando" ? "grabando" : ""}`} onClick={estado === "grabando" ? detener : grabar} aria-label={estado === "grabando" ? "Detener" : "Grabar"}>
          {estado === "grabando" ? "⏹" : "🎤"}
        </button>
        <p>{estado === "grabando" ? `Grabando… ${segundos}s · toca para detener` : grabacion ? "✅ Audio grabado" : "Toca el micrófono para grabar"}</p>
        {grabacion && <audio controls src={grabacion.url} />}
      </div>
      {grabacion && estado !== "grabando" && (
        <div className="acciones">
          {Object.entries(ACCIONES_VOZ).map(([k, [etiqueta]]) => (
            <BotonIA key={k} cargando={cargando} onClick={() => procesar(k)}>{etiqueta}</BotonIA>
          ))}
        </div>
      )}
      <ErrorIA mensaje={fallo || error} />
      <Resultado clave="voz" titulo="Transcripción" />
      <Ideas items={["🗣️ Dicta tus apuntes en vez de escribirlos", "🎧 Graba una explicación y obtén un resumen", "📝 Repasa en voz alta y genera preguntas"]} />
    </>
  );
}

const ACCIONES_IMAGEN = {
  ocr: ["🔍 Extraer texto", "Extrae TODO el texto visible en esta imagen. Si son apuntes manuscritos, haz tu mejor esfuerzo. Devuelve el texto organizado y limpio."],
  resumir: ["📋 Resumir", "Extrae el texto de esta imagen y genera un resumen claro y organizado. Si hay diagramas o fórmulas, descríbelos."],
  preguntas: ["❓ Generar preguntas", "Extrae el texto de esta imagen y genera 5 preguntas tipo examen con sus respuestas correctas."],
  explicar: ["💬 Explicar", "Analiza esta imagen y explica su contenido de forma clara y sencilla, como un tutor universitario, con ejemplos cotidianos."],
};

export function Escanear() {
  const [fuente, setFuente] = useState("subir");
  const [imagen, setImagen] = useState(null); // URL para mostrar
  const [fallo, setFallo] = useState("");
  const { ejecutar, cargando, error } = useIA("imagen");

  const procesar = async (accion) => {
    try {
      const img = await imagenParaIA(imagen);
      await ejecutar({ prompt: ACCIONES_IMAGEN[accion][1], archivos: [img] });
    } catch (e) {
      setFallo(`No se pudo procesar la imagen: ${e.message}`);
    }
  };

  return (
    <>
      <Encabezado icono="📸" titulo="Escanear Apuntes">Toma una foto de tus apuntes o sube una imagen y la IA la lee por ti.</Encabezado>
      <Segmentado valor={fuente} onChange={(f) => { setFuente(f); setImagen(null); }} opciones={[["subir", "📁 Subir imagen"], ["camara", "📷 Usar cámara"]]} />
      {fuente === "subir" ? (
        <label className="zona-archivo">
          <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files[0] && setImagen(URL.createObjectURL(e.target.files[0]))} />
          <span>📂 Haz clic o arrastra una foto (en el celular abre la cámara)</span>
        </label>
      ) : (
        <Camara onFoto={setImagen} onError={setFallo} />
      )}
      {imagen && (
        <>
          <img className="vista-previa" src={imagen} alt="Apuntes cargados" />
          <div className="acciones">
            {Object.entries(ACCIONES_IMAGEN).map(([k, [etiqueta]]) => (
              <BotonIA key={k} cargando={cargando} onClick={() => procesar(k)}>{etiqueta}</BotonIA>
            ))}
          </div>
        </>
      )}
      <ErrorIA mensaje={fallo || error} />
      <Resultado clave="imagen" titulo="Resultado del escaneo" />
      <Ideas items={["📖 Escanea apuntes a mano y conviértelos a texto", "📊 Fotografía diagramas y obtén una explicación", "📐 Captura fórmulas o ejercicios y pide que te los expliquen"]} />
    </>
  );
}

function Camara({ onFoto, onError }) {
  const video = useRef(null);
  const [flujo, setFlujo] = useState(null);

  useEffect(() => {
    let activo = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        activo = s;
        setFlujo(s);
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => onError("No se pudo abrir la cámara. Revisa los permisos del navegador o sube una imagen."));
    return () => activo?.getTracks().forEach((t) => t.stop());
  }, [onError]);

  const capturar = () => {
    const v = video.current;
    const lienzo = Object.assign(document.createElement("canvas"), { width: v.videoWidth, height: v.videoHeight });
    lienzo.getContext("2d").drawImage(v, 0, 0);
    onFoto(lienzo.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div className="tarjeta centrada">
      <video ref={video} autoPlay playsInline muted className="camara" />
      <button className="boton primario" disabled={!flujo} onClick={capturar}>📸 Tomar foto</button>
    </div>
  );
}

function Ideas({ items }) {
  return (
    <details className="tarjeta">
      <summary>💡 Ideas de uso</summary>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </details>
  );
}
