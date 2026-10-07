// Lectura de PDF, imágenes y audio en el navegador.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function textoDePdf(archivo) {
  const pdf = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const contenido = await (await pdf.getPage(i)).getTextContent();
    paginas.push(contenido.items.map((it) => it.str).join(" "));
  }
  return paginas.join("\n\n").trim();
}

export async function textoDeArchivo(archivo) {
  if (archivo.name.toLowerCase().endsWith(".pdf")) return textoDePdf(archivo);
  return (await archivo.text()).trim();
}

function blobABase64(blob) {
  return new Promise((ok, falla) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(",")[1]);
    lector.onerror = falla;
    lector.readAsDataURL(blob);
  });
}

// Reduce la foto (máx. 1600 px) para que viaje rápido y no supere el límite del servidor.
export async function imagenParaIA(fuente) {
  const url = typeof fuente === "string" ? fuente : URL.createObjectURL(fuente);
  const img = await new Promise((ok, falla) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = falla;
    i.src = url;
  });
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
  return { mimeType: "image/jpeg", data: await blobABase64(blob) };
}

// Convierte la grabación del micrófono (webm/ogg) a WAV mono de 16 kHz, un formato que Gemini acepta siempre.
export async function audioParaIA(blob) {
  const contexto = new (window.AudioContext || window.webkitAudioContext)();
  const audio = await contexto.decodeAudioData(await blob.arrayBuffer());
  await contexto.close();

  const frecuencia = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * frecuencia), frecuencia);
  const fuente = offline.createBufferSource();
  fuente.buffer = audio;
  fuente.connect(offline.destination);
  fuente.start();
  const muestras = (await offline.startRendering()).getChannelData(0);

  const buffer = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(buffer);
  const texto = (pos, s) => [...s].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)));
  texto(0, "RIFF"); v.setUint32(4, 36 + muestras.length * 2, true); texto(8, "WAVE");
  texto(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, frecuencia, true); v.setUint32(28, frecuencia * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  texto(36, "data"); v.setUint32(40, muestras.length * 2, true);
  muestras.forEach((m, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, m)) * 0x7fff, true));

  return { mimeType: "audio/wav", data: await blobABase64(new Blob([buffer], { type: "audio/wav" })) };
}
