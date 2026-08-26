import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const headingOnly = process.argv.includes("--headings");
const files = process.argv.slice(2).filter((value) => value !== "--headings");
if (!files.length) throw new Error("请提供至少一个DOCX路径");
const decode = (value = "") => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
function paragraphText(xml) {
  return decode([...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join(""));
}
for (const path of files) {
  const zip = await JSZip.loadAsync(await readFile(path));
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error(`${path} 缺少 word/document.xml`);
  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match) => ({ text: paragraphText(match[0]), pageBreak: /w:type="page"|w:lastRenderedPageBreak/.test(match[0]), hasDrawing: /<w:drawing\b/.test(match[0]) })).filter((item) => item.text || item.pageBreak || item.hasDrawing);
  const media = Object.keys(zip.files).filter((name) => /^word\/media\//.test(name));
  const tables = (xml.match(/<w:tbl\b/g) ?? []).length;
  const headers = Object.keys(zip.files).filter((name) => /^word\/header\d+\.xml$/.test(name));
  const output = { path, paragraphs: headingOnly ? paragraphs.filter((item) => /第[一二三四五]\s*讲|第\d讲|一、|二、|三、|四、|五、|本讲要学什么|家长使用提示|精读|真题带练|我是小老师|参考答案|使用说明|能力提升|阶段.*关注/.test(item.text)) : paragraphs, tables, media, headers, sectionCount: (xml.match(/<w:sectPr\b/g) ?? []).length };
  console.log(JSON.stringify(output));
}
