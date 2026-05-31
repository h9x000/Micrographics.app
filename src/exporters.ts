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
  canvas.toBlob((png) => png && download(`${project.name || "micrographic"}@${scale}x.png`, png), "image/png");
}
