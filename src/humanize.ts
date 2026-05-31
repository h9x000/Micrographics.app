import { GraphicElement, HumanizeSettings, TextElement } from "./types";
import { between, createRng } from "./random";

export interface RenderAdjustment {
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  fontSize: number;
  baseline: number;
  strokeWidth: number;
}

export function adjustmentFor(element: GraphicElement, humanize: HumanizeSettings): RenderAdjustment {
  if (!humanize.enabled) {
    return { x: 0, y: 0, rotation: 0, opacity: 0, fontSize: 0, baseline: 0, strokeWidth: 0 };
  }
  const rng = createRng(`${humanize.seed}:${element.id}`);
  return {
    x: between(rng, -humanize.jitterX, humanize.jitterX),
    y: between(rng, -humanize.jitterY, humanize.jitterY),
    rotation: between(rng, -humanize.rotation, humanize.rotation),
    opacity: between(rng, -humanize.opacity, humanize.opacity),
    fontSize: element.kind === "text" ? between(rng, -humanize.fontSize, humanize.fontSize) : 0,
    baseline: element.kind === "text" ? between(rng, -humanize.baseline, humanize.baseline) : 0,
    strokeWidth: 0
  };
}

export function transformedText(element: TextElement): string {
  if (element.transform === "uppercase") return element.text.toUpperCase();
  if (element.transform === "lowercase") return element.text.toLowerCase();
  return element.text;
}
