// Descarga de resultados en Word (.docx) y TXT, generados en el navegador.
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const MORADO = "7C3AED";

function runsConFormato(texto) {
  return texto
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
    .filter(Boolean)
    .map((parte) => {
      if (parte.startsWith("**") && parte.endsWith("**")) return new TextRun({ text: parte.slice(2, -2), bold: true });
      if (parte.startsWith("*") && parte.endsWith("*")) return new TextRun({ text: parte.slice(1, -1), italics: true });
      return new TextRun(parte);
    });
}

function markdownAParrafos(md) {
  const parrafos = [];
  for (const linea of md.split(/\r?\n/)) {
    const l = linea.trim();
    if (!l || /^(-{3,}|\*{3,}|_{3,})$/.test(l)) continue;
    const titulo = l.match(/^(#{1,6})\s+(.*)/);
    const vineta = l.match(/^[-*•]\s+(.*)/);
    const numerada = l.match(/^\d+[.)]\s+(.*)/);
    if (titulo) {
      const nivel = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][Math.min(titulo[1].length, 3) - 1];
      parrafos.push(new Paragraph({ heading: nivel, children: [new TextRun(titulo[2].replace(/\*\*/g, ""))] }));
    } else if (vineta) {
      parrafos.push(new Paragraph({ bullet: { level: 0 }, children: runsConFormato(vineta[1]) }));
    } else if (numerada) {
      parrafos.push(new Paragraph({ bullet: { level: 0 }, children: runsConFormato(numerada[1]) }));
    } else {
      parrafos.push(new Paragraph({ spacing: { after: 120 }, children: runsConFormato(l) }));
    }
  }
  return parrafos;
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function descargarWord(titulo, contenido, autor = "") {
  const fecha = new Date().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
  const doc = new Document({
    creator: autor || "IAcademy",
    title: titulo,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: titulo, color: MORADO })] }),
          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: `${autor ? autor + " · " : ""}Generado con IAcademy · ${fecha}`, italics: true, size: 18, color: "6B7280" })],
          }),
          ...markdownAParrafos(contenido),
        ],
      },
    ],
  });
  descargar(await Packer.toBlob(doc), `${nombreArchivo(titulo)}.docx`);
}

export function descargarTxt(titulo, contenido) {
  descargar(new Blob([contenido], { type: "text/plain;charset=utf-8" }), `${nombreArchivo(titulo)}.txt`);
}

const nombreArchivo = (t) =>
  "iacademy_" + t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
