import { fallbackFontFamily } from "./fontMetadata";
import { FontRole, Project, UploadedFont, fontRoleFamilies, fontRoleInternalFamilies } from "./types";
import * as opentype from "opentype.js";

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

function repairMojibake(value: string): string {
  if (!/[ÃÂ]/.test(value) || typeof TextDecoder === "undefined") return value;
  try {
    const bytes = new Uint8Array(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
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
  return repairMojibake(font.postScriptName ?? font.fullName ?? font.family ?? fallbackFontFamily(font.name));
}

async function parseUploadedFont(font: UploadedFont | null | undefined): Promise<opentype.Font | null> {
  if (!font?.dataUrl) return null;
  const base64 = font.dataUrl.split(",")[1];
  if (!base64) return null;
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return opentype.parse(buffer);
}

async function resolveFontName(font: UploadedFont | null | undefined): Promise<string | null> {
  if (!font) return null;
  if (font.postScriptName || font.fullName || font.family) return installedFamilyForFont(font);

  try {
    const parsed = await parseUploadedFont(font);
    const names = parsed?.names;
    const postScriptName = names?.postScriptName?.en;
    const fullName = names?.fullName?.en;
    const family = names?.fontFamily?.en;
    return repairMojibake(postScriptName ?? fullName ?? family ?? fallbackFontFamily(font.name));
  } catch {
    return repairMojibake(fallbackFontFamily(font.name));
  }
}

function fallbackFamilyForStack(stack: string): string {
  return splitFontFamilies(stack).find((family) => !family.startsWith("MicroFont") && !genericFamilies.has(family.toLowerCase())) ?? "Arial";
}

async function exportFamilyForStack(stack: string, project?: Project): Promise<string> {
  const role = fontRoleForStack(stack);
  if (!role) return fallbackFamilyForStack(stack);
  return (await resolveFontName(project?.fonts?.[role])) ?? fallbackFamilyForStack(fontRoleFamilies[role]);
}

async function addEmbeddedFontStyles(clone: SVGSVGElement, project?: Project) {
  if (!project) return;
  const rules = (
    await Promise.all((Object.keys(project.fonts ?? {}) as FontRole[])
      .map(async (role) => {
      const font = project.fonts?.[role];
      const family = await resolveFontName(font);
      if (!font || !family) return "";
      return `@font-face{font-family:${cssQuote(family)};src:url("${font.dataUrl}");font-style:normal;}`;
    }))
  ).filter(Boolean);

  if (!rules.length) return;

  const defs = clone.querySelector("defs") ?? clone.insertBefore(document.createElementNS("http://www.w3.org/2000/svg", "defs"), clone.firstChild);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.setAttribute("type", "text/css");
  style.textContent = rules.join("\n");
  defs.insertBefore(style, defs.firstChild);
}

async function prepareTextFonts(clone: SVGSVGElement, project?: Project) {
  for (const node of clone.querySelectorAll("text")) {
    const attrFamily = node.getAttribute("font-family");
    const styleFamily = (node as SVGTextElement).style.fontFamily;
    const sourceFamily = attrFamily || styleFamily;
    if (!sourceFamily) continue;

    const family = await exportFamilyForStack(sourceFamily, project);
    node.setAttribute("font-family", family);
    node.setAttribute("font-style", node.getAttribute("font-style") ?? "normal");
    (node as SVGTextElement).style.removeProperty("font-family");
  }
}

function pathDataForText(font: opentype.Font, value: string, x: number, y: number, fontSize: number, letterSpacing: number): string {
  const scale = fontSize / font.unitsPerEm;
  const baseline = y + font.ascender * scale;
  let cursor = x;
  let data = "";

  for (const char of value) {
    const glyph = font.charToGlyph(char);
    data += glyph.getPath(cursor, baseline, fontSize).toPathData(3);
    cursor += (glyph.advanceWidth ?? font.unitsPerEm * 0.5) * scale + letterSpacing;
  }

  return data;
}

function copyTextPaint(text: SVGTextElement, path: SVGPathElement) {
  for (const attr of ["fill", "stroke", "stroke-width", "font-weight", "letter-spacing", "opacity"]) {
    const value = text.getAttribute(attr);
    if (value !== null) path.setAttribute(attr, value);
  }
  if (!path.hasAttribute("fill")) path.setAttribute("fill", "black");
}

async function outlineTextFonts(clone: SVGSVGElement, project?: Project) {
  const fontCache = new Map<FontRole, opentype.Font | null>();

  for (const text of Array.from(clone.querySelectorAll("text"))) {
    const sourceFamily = text.getAttribute("font-family") || text.style.fontFamily;
    const role = sourceFamily ? fontRoleForStack(sourceFamily) : null;
    const font = role
      ? fontCache.has(role)
        ? fontCache.get(role)
        : await parseUploadedFont(project?.fonts?.[role]).then((parsed) => {
            fontCache.set(role, parsed);
            return parsed;
          }).catch(() => {
            fontCache.set(role, null);
            return null;
          })
      : null;

    if (!font) continue;

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const fontSize = Number(text.getAttribute("font-size") ?? text.style.fontSize.replace("px", "") ?? 16);
    const letterSpacing = Number(text.getAttribute("letter-spacing") ?? text.style.letterSpacing.replace("px", "") ?? 0);
    const tspans = text.querySelectorAll("tspan");
    const lineNodes = tspans.length ? Array.from(tspans) : [text];

    for (const line of lineNodes) {
      const value = line.textContent ?? "";
      if (!value) continue;
      const x = Number((line as SVGTSpanElement).getAttribute?.("x") ?? text.getAttribute("x") ?? 0);
      const y = Number((line as SVGTSpanElement).getAttribute?.("y") ?? text.getAttribute("y") ?? 0);
      const d = pathDataForText(font, value, x, y, fontSize, letterSpacing);
      if (!d) continue;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      copyTextPaint(text, path);
      group.append(path);
    }

    text.replaceWith(group);
  }
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

export async function serializeSvg(svg: SVGSVGElement, options: { embedFonts?: boolean; includeBackground?: boolean; outlineText?: boolean; project?: Project } = {}): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (options.includeBackground === false) {
    clone.querySelectorAll("[data-export-background]").forEach((node) => node.remove());
  }
  if (options.outlineText) {
    await outlineTextFonts(clone, options.project);
  }
  await prepareTextFonts(clone, options.project);
  if (options.embedFonts) {
    await addEmbeddedFontStyles(clone, options.project);
  }
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return new XMLSerializer().serializeToString(clone);
}

export function exportSvg(svg: SVGSVGElement, name: string, project: Project) {
  serializeSvg(svg, { includeBackground: false, project }).then((source) => {
    download(`${name}.svg`, new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  });
}

export function exportStaticSvg(svg: SVGSVGElement, name: string, project: Project) {
  serializeSvg(svg, { includeBackground: false, outlineText: true, project }).then((source) => {
    download(`${name}-static.svg`, new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  });
}

export async function copySvg(svg: SVGSVGElement, project: Project) {
  await navigator.clipboard.writeText(await serializeSvg(svg, { includeBackground: false, project }));
}

export async function exportPng(svg: SVGSVGElement, project: Project, scale: number, transparent: boolean, includeBackground: boolean) {
  const source = await serializeSvg(svg, { embedFonts: true, includeBackground, project });
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
