import { Project } from "./types";

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function serializeSvg(svg: SVGSVGElement, options: { includeBackground?: boolean } = {}): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (options.includeBackground === false) {
    clone.querySelectorAll("[data-export-background]").forEach((node) => node.remove());
  }
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return new XMLSerializer().serializeToString(clone);
}

export function exportSvg(svg: SVGSVGElement, name: string) {
  download(`${name}.svg`, new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" }));
}

export async function copySvg(svg: SVGSVGElement) {
  await navigator.clipboard.writeText(serializeSvg(svg));
}

export async function exportPng(svg: SVGSVGElement, project: Project, scale: number, transparent: boolean, includeBackground: boolean) {
  const source = serializeSvg(svg, { includeBackground });
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
