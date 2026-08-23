import JSZip from "jszip";

function decodeXml(value: string) {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'" })[entity] ?? entity);
}

export async function extractWordText(docx: Uint8Array) {
  const archive = await JSZip.loadAsync(docx);
  const documentXml = await archive.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("不是可读取的 DOCX 文档");
  const paragraphs = documentXml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
  const text = paragraphs.map((paragraph) => {
    const withBreaks = paragraph.replace(/<w:(?:tab)\s*\/>/g, "\t").replace(/<w:(?:br|cr)\s*\/>/g, "\n");
    const runs = [...withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1]));
    return runs.join("");
  }).filter(Boolean).join("\n").trim();
  if (!text) throw new Error("DOCX 中未识别到可用文字");
  return text;
}
