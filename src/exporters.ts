import { fallbackFontFamily } from "./fontMetadata";
import { FontRole, Project, UploadedFont, fontRoleFamilies, fontRoleInternalFamilies } from "./types";

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const genericFamilies = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
const pngSignatureLength = 8;
const pngChunkHeaderLength = 8;
const pngChunkCrcLength = 4;
const pngIhdrDataLength = 13;
const printDpi = 300;
let crcTable: Uint32Array | null = null;

function splitFontFamilies(value: string): string[] {
  const families: string[] = [];
  let current = "";
  let quote = "";

  for (const char of value) {
    if ((char === "\"" || char === "'") && !quote) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = "";
      continue;
    }
    if (char === "," && !quote) {
      families.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) families.push(current.trim());
  return families.filter(Boolean);
}

function cssQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function fontRoleForStack(stack: string): FontRole | null {
  const families = splitFontFamilies(stack);
  for (const role of Object.keys(fontRoleFamilies) as FontRole[]) {
    if (families.includes(fontRoleInternalFamilies[role]) || stack === fontRoleFamilies[role]) return role;
  }
  return null;
}

function installedFamilyForFont(font: UploadedFont | null | undefined): string | null {
  if (!font) return null;
  return font.family ?? font.fullName ?? font.postScriptName ?? fallbackFontFamily(font.name);
}

function fallbackFamilyForStack(stack: string): string {
  return splitFontFamilies(stack).find((family) => !family.startsWith("MicroFont") && !genericFamilies.has(family.toLowerCase())) ?? "Arial";
}

function exportFamilyForStack(stack: string, project?: Project): string {
  const role = fontRoleForStack(stack);
  if (!role) return fallbackFamilyForStack(stack);
  return installedFamilyForFont(project?.fonts?.[role]) ?? fallbackFamilyForStack(fontRoleFamilies[role]);
}

function addEmbeddedFontStyles(clone: SVGSVGElement, project?: Project) {
  if (!project) return;
  const rules = (Object.keys(project.fonts ?? {}) as FontRole[])
    .map((role) => {
      const font = project.fonts?.[role];
      const family = installedFamilyForFont(font);
      if (!font || !family) return "";
      return `@font-face{font-family:${cssQuote(family)};src:url("${font.dataUrl}");font-style:normal;}`;
    })
    .filter(Boolean);

  if (!rules.length) return;

  const defs = clone.querySelector("defs") ?? clone.insertBefore(document.createElementNS("http://www.w3.org/2000/svg", "defs"), clone.firstChild);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.setAttribute("type", "text/css");
  style.textContent = rules.join("\n");
  defs.insertBefore(style, defs.firstChild);
}

function prepareTextFonts(clone: SVGSVGElement, project?: Project) {
  clone.querySelectorAll("text").forEach((node) => {
    const attrFamily = node.getAttribute("font-family");
    const styleFamily = (node as SVGTextElement).style.fontFamily;
    const sourceFamily = attrFamily || styleFamily;
    if (!sourceFamily) return;

    const family = exportFamilyForStack(sourceFamily, project);
    node.setAttribute("font-family", family);
    node.setAttribute("font-style", node.getAttribute("font-style") ?? "normal");
    (node as SVGTextElement).style.removeProperty("font-family");
  });
}

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[i] = value >>> 0;
  }
  return crcTable;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32Bytes(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
}

function makePhysChunk(dpi: number): Uint8Array {
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]);
  const data = new Uint8Array(9);
  data.set(uint32Bytes(pixelsPerMeter), 0);
  data.set(uint32Bytes(pixelsPerMeter), 4);
  data[8] = 1;

  const chunk = new Uint8Array(pngChunkHeaderLength + data.length + pngChunkCrcLength);
  chunk.set(uint32Bytes(data.length), 0);
  chunk.set(type, 4);
  chunk.set(data, 8);
  chunk.set(uint32Bytes(crc32(chunk.subarray(4, 8 + data.length))), 8 + data.length);
  return chunk;
}

async function withPngDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < pngSignatureLength + pngChunkHeaderLength + pngIhdrDataLength + pngChunkCrcLength || chunkType(bytes, pngSignatureLength) !== "IHDR") {
    return blob;
  }

  const physChunk = makePhysChunk(dpi);
  let insertOffset = pngSignatureLength + pngChunkHeaderLength + pngIhdrDataLength + pngChunkCrcLength;
  let replaceEnd = insertOffset;

  for (let offset = pngSignatureLength; offset + pngChunkHeaderLength <= bytes.length;) {
    const length = readUint32(bytes, offset);
    const nextOffset = offset + pngChunkHeaderLength + length + pngChunkCrcLength;
    if (nextOffset > bytes.length) return blob;
    if (chunkType(bytes, offset) === "pHYs") {
      insertOffset = offset;
      replaceEnd = nextOffset;
      break;
    }
    if (chunkType(bytes, offset) === "IDAT") break;
    offset = nextOffset;
  }

  const output = new Uint8Array(bytes.length - (replaceEnd - insertOffset) + physChunk.length);
  output.set(bytes.subarray(0, insertOffset), 0);
  output.set(physChunk, insertOffset);
  output.set(bytes.subarray(replaceEnd), insertOffset + physChunk.length);
  return new Blob([output], { type: "image/png" });
}

export function serializeSvg(svg: SVGSVGElement, options: { includeBackground?: boolean; project?: Project } = {}): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (options.includeBackground === false) {
    clone.querySelectorAll("[data-export-background]").forEach((node) => node.remove());
  }
  prepareTextFonts(clone, options.project);
  addEmbeddedFontStyles(clone, options.project);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return new XMLSerializer().serializeToString(clone);
}

export function exportSvg(svg: SVGSVGElement, name: string, project: Project) {
  download(`${name}.svg`, new Blob([serializeSvg(svg, { project })], { type: "image/svg+xml;charset=utf-8" }));
}

export async function copySvg(svg: SVGSVGElement, project: Project) {
  await navigator.clipboard.writeText(serializeSvg(svg, { project }));
}

export async function exportPng(svg: SVGSVGElement, project: Project, scale: number, transparent: boolean, includeBackground: boolean) {
  const source = serializeSvg(svg, { includeBackground, project });
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  const ready = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });
  image.src = url;
  await ready;
  const canvas = document.createElement("canvas");
  canvas.width = project.canvas.width * scale;
  canvas.height = project.canvas.height * scale;
  const ctx = canvas.getContext("2d")!;
  if (!transparent && includeBackground) {
    ctx.fillStyle = project.canvas.exportBackground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (png) download(`${project.name || "micrographic"}@${scale}x.png`, await withPngDpi(png, printDpi));
}
