import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
  image: Uint8Array;
  width: number;
  height: number;
}

export interface ExtractedPdfTextPage {
  pageNumber: number;
  text: string;
}

function pngSize(data: Uint8Array) {
  if (data.length < 24 || String.fromCharCode(...data.slice(1, 4)) !== "PNG") return { width: 0, height: 0 };
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function executable(name: "pdfinfo" | "pdftotext" | "pdftoppm") {
  const configured = process.env[`${name.toUpperCase()}_BIN`];
  return configured || name;
}

export async function extractPdfPages(
  pdf: Uint8Array,
  onProgress?: (progress: { pageNumber: number; totalPages: number }) => Promise<void> | void
): Promise<ExtractedPdfPage[]> {
  const directory = await mkdtemp(join(tmpdir(), "handout-pdf-"));
  const inputPath = join(directory, "source.pdf");
  await writeFile(inputPath, pdf);
  try {
    const { stdout } = await run(executable("pdfinfo"), [inputPath], { maxBuffer: 4 * 1024 * 1024, timeout: 30_000 });
    const pageCount = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 500) throw new Error("无法读取PDF页数或页数超过500页");
    const pages: ExtractedPdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const textPath = join(directory, `page-${pageNumber}.txt`);
      const imagePrefix = join(directory, `page-${pageNumber}`);
      await run(executable("pdftotext"), ["-f", String(pageNumber), "-l", String(pageNumber), "-layout", "-enc", "UTF-8", inputPath, textPath], { maxBuffer: 8 * 1024 * 1024, timeout: 90_000 });
      await run(executable("pdftoppm"), ["-f", String(pageNumber), "-l", String(pageNumber), "-singlefile", "-r", "130", "-png", inputPath, imagePrefix], { maxBuffer: 8 * 1024 * 1024, timeout: 90_000 });
      const image = new Uint8Array(await readFile(`${imagePrefix}.png`));
      const text = (await readFile(textPath, "utf8")).replace(/\f/g, "").trim();
      pages.push({ pageNumber, text, image, ...pngSize(image) });
      await onProgress?.({ pageNumber, totalPages: pageCount });
    }
    return pages;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function extractPdfTextPages(
  pdf: Uint8Array,
  onProgress?: (progress: { pageNumber: number; totalPages: number }) => Promise<void> | void
): Promise<ExtractedPdfTextPage[]> {
  const directory = await mkdtemp(join(tmpdir(), "handout-pdf-"));
  const inputPath = join(directory, "source.pdf");
  const textPath = join(directory, "all-pages.txt");
  await writeFile(inputPath, pdf);
  try {
    const { stdout } = await run(executable("pdfinfo"), [inputPath], { maxBuffer: 4 * 1024 * 1024, timeout: 30_000 });
    const pageCount = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 500) throw new Error("无法读取PDF页数或页数超过500页");
    await run(executable("pdftotext"), ["-layout", "-enc", "UTF-8", inputPath, textPath], { maxBuffer: 32 * 1024 * 1024, timeout: 90_000 });
    const textByPage = (await readFile(textPath, "utf8")).split("\f");
    const pages: ExtractedPdfTextPage[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      pages.push({ pageNumber, text: (textByPage[pageNumber - 1] ?? "").trim() });
      await onProgress?.({ pageNumber, totalPages: pageCount });
    }
    return pages;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function renderPdfPage(pdf: Uint8Array, pageNumber: number) {
  const directory = await mkdtemp(join(tmpdir(), "handout-pdf-page-"));
  const inputPath = join(directory, "source.pdf");
  const imagePrefix = join(directory, "page");
  await writeFile(inputPath, pdf);
  try {
    await run(executable("pdftoppm"), ["-f", String(pageNumber), "-l", String(pageNumber), "-singlefile", "-r", "110", "-png", inputPath, imagePrefix], { maxBuffer: 16 * 1024 * 1024, timeout: 90_000 });
    const image = new Uint8Array(await readFile(`${imagePrefix}.png`));
    return { image, ...pngSize(image) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
