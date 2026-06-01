import {
  AlignJustify,
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Lock,
  LockOpen,
  MousePointer2,
  Redo2,
  RefreshCcw,
  RotateCcw,
  Save,
  Shuffle,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import React, { ChangeEvent, PointerEvent, forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Input, Textarea, Checkbox, SelectControl, SliderControl } from "./components/ui/form";
import { exportPng, exportStaticSvg, exportSvg, copySvg } from "./exporters";
import { fallbackFontFamily, readFontMetadata } from "./fontMetadata";
import { createProject, regenerate } from "./generator";
import { adjustmentFor, transformedText } from "./humanize";
import { renderIsoPictogram } from "./isoPictograms";
import { code, createRng } from "./random";
import { loadLocal, saveLocal } from "./storage";
import { CustomLibrarySettings, CustomSvgAsset, CustomSvgElement, FontRole, GraphicElement, IconElement, Project, ShapeElement, TextElement, fontRoleFamilies, fontRoleInternalFamilies, isoPictogramKinds } from "./types";

type History = { past: Project[]; present: Project; future: Project[] };
type DragState = { id: string; x: number; y: number; startX: number; startY: number; before: Project } | null;
type BottomPanelView = "layers" | "custom";
type PanelResizeState = { y: number; height: number } | null;

const iconKinds: IconElement["icon"][] = ["warning", "lightning", "globe", "cert", "stamp", "polarity", "bin", "doubleSquare", "arrow", "dotMark", "logo", "crosshair", "chip", "waveform", "antenna", "terminal", "chevron", "bracket", "target", "caliper", "diode", "glyph", "circuitBlock", "waveBadge", "terminalStrip", "equipmentCluster", "safetyPanel", "handlingPanel", "vehicleDotMark", "certification_marks", "regulatory_marks", "safety_pictograms", "warning_decals", "automotive_glass_markings", "recycling_disposal_marks", "handling_shipping_symbols", "technical_instruction_icons", "ansi_safety_pictograms", "iso_7010_safety_signs", "ce_mark", "fcc_mark", "rohs_mark", "weee_mark", "ul_mark", "dot_as1_mark", "e_mark_symbols", ...isoPictogramKinds];
const shapeKinds: ShapeElement["shape"][] = ["rect", "pill", "grid", "barcode"];
const fontRoles: Array<{ role: FontRole; label: string }> = [
  { role: "normal", label: "Normal" },
  { role: "mono", label: "Mono" },
  { role: "wide", label: "Wide" },
  { role: "condensed", label: "Condensed" }
];

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function normalizeStrokeWidth(strokeWidth: number): number {
  return strokeWidth > 0 ? clampValue(strokeWidth, 1, 5) : 0;
}

function clampElement(element: GraphicElement, project: Project): GraphicElement {
  const width = clampValue(element.width, 1, project.canvas.width);
  const height = clampValue(element.height, 1, project.canvas.height);
  return {
    ...element,
    width,
    height,
    x: clampValue(element.x, 0, project.canvas.width - width),
    y: clampValue(element.y, 0, project.canvas.height - height),
    opacity: clampValue(element.opacity, 0, 1),
    strokeWidth: normalizeStrokeWidth(element.strokeWidth),
    fill: element.fill === "none" ? "none" : "#111111",
    stroke: element.stroke === "none" ? "none" : "#111111"
  } as GraphicElement;
}

function applyElementPatch(element: GraphicElement, patch: Partial<GraphicElement>, project: Project): GraphicElement {
  const patched = clampElement({ ...element, ...patch } as GraphicElement, project);
  if (project.generator.preventOverlap && elementOverlaps(patched, project, new Set([element.id]))) {
    return clampElement(element, project);
  }
  return patched;
}

function clampProjectElements(project: Project): Project {
  return { ...project, elements: project.elements.map((element) => clampElement(element, project)) };
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function estimateTextLineWidth(line: string, element: TextElement) {
  const family = element.fontFamily.toLowerCase();
  const baseFactor = family.includes("mono") ? 0.62 : family.includes("condensed") ? 0.54 : family.includes("wide") || family.includes("black") ? 0.76 : 0.66;
  const glyphWidth = Array.from(line).reduce((total, char) => {
    const codePoint = char.codePointAt(0) ?? 0;
    const factor = /\s/.test(char) ? 0.35 : codePoint > 255 ? 0.95 : /[.,:;|/\\-]/.test(char) ? 0.4 : baseFactor;
    return total + element.fontSize * factor;
  }, 0);
  return glyphWidth + Math.max(0, line.length - 1) * element.letterSpacing;
}

function baseElementRect(element: GraphicElement): Rect {
  if (element.kind !== "text") {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  const lines = transformedText(element).split("\n");
  const width = Math.max(element.width, ...lines.map((line) => estimateTextLineWidth(line, element)));
  const height = Math.max(element.height, lines.length * element.fontSize * element.lineHeight);
  return { x: element.x, y: element.y, width, height };
}

function elementRect(element: GraphicElement): Rect {
  const baseRect = baseElementRect(element);
  const rotation = ((element.rotation % 360) + 360) % 360;
  if (rotation === 0) {
    return baseRect;
  }
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const origin = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
  const corners = [
    { x: baseRect.x, y: baseRect.y },
    { x: baseRect.x + baseRect.width, y: baseRect.y },
    { x: baseRect.x + baseRect.width, y: baseRect.y + baseRect.height },
    { x: baseRect.x, y: baseRect.y + baseRect.height }
  ].map((point) => ({
    x: origin.x + (point.x - origin.x) * cos - (point.y - origin.y) * sin,
    y: origin.y + (point.x - origin.x) * sin + (point.y - origin.y) * cos
  }));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top
  };
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function elementOverlaps(element: GraphicElement, project: Project, ignoredIds = new Set<string>()) {
  if (!element.visible) return false;
  const rect = elementRect(element);
  return project.elements.some((other) => other.visible && !ignoredIds.has(other.id) && rectsOverlap(rect, elementRect(other)));
}

function findOpenElementPosition(element: GraphicElement, project: Project, ignoredIds = new Set<string>()): GraphicElement | null {
  const clamped = clampElement(element, project);
  if (!elementOverlaps(clamped, project, ignoredIds)) return clamped;

  const grid = Math.max(1, project.canvas.gridSize || 8);
  const maxX = Math.max(0, project.canvas.width - clamped.width);
  const maxY = Math.max(0, project.canvas.height - clamped.height);
  let best: GraphicElement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let y = 0; y <= maxY; y += grid) {
    for (let x = 0; x <= maxX; x += grid) {
      const candidate = { ...clamped, x, y } as GraphicElement;
      if (elementOverlaps(candidate, project, ignoredIds)) continue;
      const distance = (x - clamped.x) ** 2 + (y - clamped.y) ** 2;
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }

  return best;
}

function resolveProjectOverlaps(project: Project): Project {
  const clamped = clampProjectElements(project);
  if (!clamped.generator.preventOverlap) return clamped;

  const placed: GraphicElement[] = [];
  const elements = clamped.elements.map((element) => {
    if (!element.visible) return element;
    const placedProject = { ...clamped, elements: placed };
    const next = findOpenElementPosition(element, placedProject) ?? element;
    placed.push(next);
    return next;
  });

  return { ...clamped, elements };
}

function roundedCanvasWidth(width: number, gridSize: number): number {
  const grid = Math.max(1, gridSize || 8);
  return Math.ceil(width / grid) * grid;
}

function svgNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeSvgAsset(name: string, source: string): CustomSvgAsset | null {
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (root.tagName.toLowerCase() !== "svg" || root.querySelector("parsererror")) return null;

  root.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
  root.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const attrName = attribute.name.toLowerCase();
      const attrValue = attribute.value.trim().toLowerCase();
      if (attrName.startsWith("on") || ((attrName === "href" || attrName.endsWith(":href")) && attrValue.startsWith("javascript:"))) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  const viewBox = root.getAttribute("viewBox");
  const parts = viewBox?.split(/[\s,]+/).map(Number).filter(Number.isFinite) ?? [];
  const attrWidth = svgNumber(root.getAttribute("width"), 64);
  const attrHeight = svgNumber(root.getAttribute("height"), attrWidth);
  const width = parts.length === 4 ? Math.max(1, parts[2]) : attrWidth;
  const height = parts.length === 4 ? Math.max(1, parts[3]) : attrHeight;
  const resolvedViewBox = parts.length === 4 ? parts.join(" ") : `0 0 ${width} ${height}`;
  const content = root.innerHTML.trim();
  if (!content) return null;

  return {
    id: `custom-svg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    content,
    viewBox: resolvedViewBox,
    aspectRatio: width / height
  };
}

function cleanProject(project: Project): Project {
  const legacyCustomEnabled = project.customLibrary?.enabled ?? false;
  return resolveProjectOverlaps({
    ...project,
    palette: "blackWhite",
    customPalette: ["#111111", "#ffffff", "#111111"],
    generator: {
      seed: project.generator?.seed ?? "micro-001",
      typeMin: project.generator?.typeMin ?? 10,
      typeMax: project.generator?.typeMax ?? 18,
      nonTypeMin: project.generator?.nonTypeMin ?? 18,
      nonTypeMax: project.generator?.nonTypeMax ?? 30,
      nonTypeStrokeWidth: normalizeStrokeWidth(project.generator?.nonTypeStrokeWidth ?? 1.5),
      template: "serial",
      textHighlight: project.generator?.textHighlight ?? false,
      textHighlightColor: project.generator?.textHighlightColor ?? "#000000",
      allow45Rotation: project.generator?.allow45Rotation ?? true,
      preventOverlap: project.generator?.preventOverlap ?? false
    },
    customLibrary: {
      useCustomText: project.customLibrary?.useCustomText ?? legacyCustomEnabled,
      useCustomSvg: project.customLibrary?.useCustomSvg ?? legacyCustomEnabled,
      texts: (project.customLibrary?.texts ?? []).map((text) => text.trim()).filter(Boolean),
      svgs: project.customLibrary?.svgs ?? []
    },
    fonts: {
      normal: project.fonts?.normal ?? null,
      mono: project.fonts?.mono ?? null,
      wide: project.fonts?.wide ?? null,
      condensed: project.fonts?.condensed ?? null
    },
    canvas: {
      ...project.canvas,
      background: "#ffffff",
      exportBackground: "#ffffff",
      previewBackground: "black",
      previewCustom: "#000000",
      width: 768,
      height: 256,
      padding: 32,
      gridSize: 8,
      roundedBackground: false,
      frame: false,
      gridVisible: false,
      snapToGrid: true,
      cleanVector: true
    },
    elements: project.elements
      .filter((element) => element.kind !== "shape" || !["line", "circle", "qr"].includes(element.shape as string))
      .map((element) => ({ ...element, cornerRadius: 0 }))
      .filter((element) => !["label plate", "backplate field", "square sticker", "white label", "red catalog field", "warning plate", "shipping label", "manufacturer tag"].includes(element.name.toLowerCase()))
  });
}

function customLibraryFor(project: Project, patch: Partial<CustomLibrarySettings> = {}): CustomLibrarySettings {
  const legacyCustomEnabled = project.customLibrary?.enabled ?? false;
  return {
    useCustomText: project.customLibrary?.useCustomText ?? legacyCustomEnabled,
    useCustomSvg: project.customLibrary?.useCustomSvg ?? legacyCustomEnabled,
    texts: project.customLibrary?.texts ?? [],
    svgs: project.customLibrary?.svgs ?? [],
    ...patch
  };
}

function App() {
  const initial = useMemo(() => cleanProject(loadLocal() ?? createProject("micro-001", "serial")), []);
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] });
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pngScale, setPngScale] = useState(2);
  const [transparentPng, setTransparentPng] = useState(false);
  const [includeBg, setIncludeBg] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingFontRole, setPendingFontRole] = useState<FontRole>("normal");
  const [drag, setDrag] = useState<DragState>(null);
  const [bottomPanel, setBottomPanel] = useState<BottomPanelView>("layers");
  const [bottomPanelHeight, setBottomPanelHeight] = useState(220);
  const [panelResize, setPanelResize] = useState<PanelResizeState>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const customSvgRef = useRef<HTMLInputElement>(null);
  const project = history.present;
  const selected = project.elements.find((el) => project.selectedIds.includes(el.id));

  const commit = (mutator: (project: Project) => Project) => {
    setHistory((current) => {
      const next = mutator(current.present);
      return { past: [...current.past.slice(-49), current.present], present: next, future: [] };
    });
  };

  const silent = (mutator: (project: Project) => Project) => {
    setHistory((current) => ({ ...current, present: mutator(current.present) }));
  };

  useEffect(() => saveLocal(project), [project]);

  useLayoutEffect(() => {
    if (editingId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const elementNodes = Array.from(svg.querySelectorAll<SVGGElement>("[data-label-element='true']"));
    if (!elementNodes.length) return;

    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width <= 0) return;
    const unitsPerPixel = project.canvas.width / svgRect.width;
    const rightEdge = elementNodes.reduce((right, node) => {
      const rect = node.getBoundingClientRect();
      return Math.max(right, (rect.right - svgRect.left) * unitsPerPixel);
    }, 0);
    const neededWidth = roundedCanvasWidth(rightEdge + project.canvas.padding, project.canvas.gridSize);

    if (neededWidth > project.canvas.width) {
      setHistory((current) => ({
        ...current,
        present: {
          ...current.present,
          canvas: {
            ...current.present.canvas,
            width: neededWidth
          }
        }
      }));
    }
  }, [editingId, project.canvas.gridSize, project.canvas.padding, project.canvas.width, project.elements, project.fonts, project.humanize]);

  useEffect(() => {
    const styleId = "micrographics-uploaded-fonts";
    document.getElementById(styleId)?.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = fontRoles
      .map(({ role }) => {
        const uploaded = project.fonts?.[role];
        if (!uploaded) return "";
        const family = fontRoleInternalFamilies[role];
        return `@font-face{font-family:"${family}";src:url("${uploaded.dataUrl}")}`;
      })
      .join("\n");
    document.head.append(style);
    return () => style.remove();
  }, [project.fonts]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (event.key === "Delete" || event.key === "Backspace") {
        if (project.selectedIds.length) {
          event.preventDefault();
          deleteSelected();
        }
      }
      if (meta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (meta && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
        event.preventDefault();
        redo();
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveLocal(project);
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && project.selectedIds.length && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        const step = event.altKey ? 0.5 : event.shiftKey ? 8 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        commit((p) => ({ ...p, elements: p.elements.map((el) => (p.selectedIds.includes(el.id) && !el.locked ? applyElementPatch(el, { x: el.x + dx, y: el.y + dy }, p) : el)) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!panelResize) return;
    const onMove = (event: globalThis.PointerEvent) => {
      setBottomPanelHeight(clampValue(panelResize.height + panelResize.y - event.clientY, 160, Math.min(560, window.innerHeight - 220)));
    };
    const onUp = () => setPanelResize(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [panelResize]);

  function undo() {
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
    });
  }

  function redo() {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return { past: [...current.past, current.present], present: next, future: current.future.slice(1) };
    });
  }

  function select(id: string, additive = false) {
    if (!id) {
      silent((p) => ({ ...p, selectedIds: [] }));
      return;
    }
    silent((p) => ({ ...p, selectedIds: additive ? Array.from(new Set([...p.selectedIds, id])) : [id] }));
  }

  function updateElement(id: string, patch: Partial<GraphicElement>) {
    commit((p) => ({ ...p, elements: p.elements.map((el) => (el.id === id ? applyElementPatch(el, patch, p) : el)) }));
  }

  function updateElementSilent(id: string, patch: Partial<GraphicElement>) {
    silent((p) => ({ ...p, elements: p.elements.map((el) => (el.id === id ? applyElementPatch(el, patch, p) : el)) }));
  }

  function updateNonTypeStrokeWidth(strokeWidth: number) {
    const nextStrokeWidth = normalizeStrokeWidth(strokeWidth);
    commit((p) => ({
      ...p,
      generator: { ...p.generator, nonTypeStrokeWidth: nextStrokeWidth },
      elements: p.elements.map((el) => (el.kind === "text" ? el : ({ ...el, strokeWidth: nextStrokeWidth } as GraphicElement)))
    }));
  }

  function updateCustomTexts(raw: string) {
    const texts = raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    commit((p) => ({ ...p, customLibrary: customLibraryFor(p, { texts }) }));
  }

  function addCustomText(value: string) {
    const entries = value.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean);
    if (!entries.length) return;
    commit((p) => {
      const texts = p.customLibrary?.texts ?? [];
      const nextTexts = [...texts];
      entries.forEach((entry) => {
        if (!nextTexts.includes(entry)) nextTexts.push(entry);
      });
      return {
        ...p,
        customLibrary: customLibraryFor(p, { texts: nextTexts })
      };
    });
  }

  function removeCustomText(index: number) {
    commit((p) => ({
      ...p,
      customLibrary: customLibraryFor(p, { texts: (p.customLibrary?.texts ?? []).filter((_, itemIndex) => itemIndex !== index) })
    }));
  }

  function removeCustomSvg(id: string) {
    commit((p) => ({
      ...p,
      customLibrary: customLibraryFor(p, { svgs: (p.customLibrary?.svgs ?? []).filter((asset) => asset.id !== id) })
    }));
  }

  function deleteSelected() {
    commit((p) => ({ ...p, elements: p.elements.filter((el) => !p.selectedIds.includes(el.id) || el.locked), selectedIds: [] }));
  }

  function duplicateSelected() {
    commit((p) => {
      const clones = p.elements
        .filter((el) => p.selectedIds.includes(el.id))
        .map((el) => ({ ...el, id: `${el.id}-copy-${Date.now()}`, name: `${el.name} copy`, x: el.x + 16, y: el.y + 16, locked: false } as GraphicElement))
        .reduce<GraphicElement[]>((placed, clone) => {
          const projectWithPlaced = { ...p, elements: [...p.elements, ...placed] };
          const next = p.generator.preventOverlap ? findOpenElementPosition(clone, projectWithPlaced) : clampElement(clone, p);
          return next ? [...placed, next] : placed;
        }, []);
      return { ...p, elements: [...p.elements, ...clones], selectedIds: clones.map((el) => el.id) };
    });
  }

  function addText() {
    const rng = createRng(`${project.generator.seed}-new-text-${project.elements.length}`);
  const el: TextElement = {
      id: `text-${Date.now()}`,
      kind: "text",
      name: "New text",
      text: `ID ${code(rng, "AA##-####")}`,
      x: project.canvas.padding,
      y: project.canvas.padding,
      width: 220,
      height: 32,
      rotation: 0,
      opacity: 1,
      fill: "#111111",
      stroke: "#111111",
      strokeWidth: 0,
      cornerRadius: 0,
      visible: true,
      locked: false,
      fontFamily: fontRoleFamilies.mono,
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 0.6,
      lineHeight: 1.1,
      transform: "uppercase"
    };
    commit((p) => {
      const next = p.generator.preventOverlap ? findOpenElementPosition(el, p) : clampElement(el, p);
      return next ? { ...p, elements: [...p.elements, next], selectedIds: [next.id] } : p;
    });
  }

  function addShape(shape: ShapeElement["shape"]) {
    const el: ShapeElement = {
      id: `shape-${Date.now()}`,
      kind: "shape",
      name: `New ${shape}`,
      shape,
      x: project.canvas.padding,
      y: project.canvas.padding,
      width: 96,
      height: 64,
      rotation: 0,
      opacity: 1,
      fill: shape === "rect" || shape === "pill" ? "none" : "#111111",
      stroke: "#111111",
      strokeWidth: normalizeStrokeWidth(project.generator.nonTypeStrokeWidth ?? 1.5),
      cornerRadius: 0,
      visible: true,
      locked: false,
      rows: 4,
      columns: 6
    };
    commit((p) => {
      const next = p.generator.preventOverlap ? findOpenElementPosition(el, p) : clampElement(el, p);
      return next ? { ...p, elements: [...p.elements, next], selectedIds: [next.id] } : p;
    });
  }

  function addIcon(icon: IconElement["icon"]) {
    const el: IconElement = {
      id: `icon-${Date.now()}`,
      kind: "icon",
      name: `New ${icon}`,
      icon,
      label: icon === "cert" ? "NX" : icon === "stamp" ? "QC" : undefined,
      x: project.canvas.padding,
      y: project.canvas.padding,
      width: 56,
      height: 56,
      rotation: 0,
      opacity: 1,
      fill: "#111111",
      stroke: "#111111",
      strokeWidth: normalizeStrokeWidth(project.generator.nonTypeStrokeWidth ?? 1.5),
      cornerRadius: 0,
      visible: true,
      locked: false
    };
    commit((p) => {
      const next = p.generator.preventOverlap ? findOpenElementPosition(el, p) : clampElement(el, p);
      return next ? { ...p, elements: [...p.elements, next], selectedIds: [next.id] } : p;
    });
  }

  function loadProjectJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((raw) => {
      const loaded = JSON.parse(raw) as Project;
      setHistory({ past: [project], present: cleanProject(loaded), future: [] });
    });
    event.target.value = "";
  }

  async function importFont(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const metadata = file.name.toLowerCase().endsWith(".woff2")
      ? { family: fallbackFontFamily(file.name) }
      : readFontMetadata(await file.arrayBuffer(), file.name);
    commit((p) => ({
      ...p,
      fonts: {
        normal: p.fonts?.normal ?? null,
        mono: p.fonts?.mono ?? null,
        wide: p.fonts?.wide ?? null,
        condensed: p.fonts?.condensed ?? null,
        [pendingFontRole]: { name: file.name, dataUrl, ...metadata }
      }
    }));
    const label = fontRoles.find((item) => item.role === pendingFontRole)?.label ?? pendingFontRole;
    window.alert(`${label} font uploaded: ${metadata.family ?? file.name}`);
    event.target.value = "";
  }

  async function importCustomSvg(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const assets = (await Promise.all(files.map(async (file) => sanitizeSvgAsset(file.name, await file.text())))).filter((asset): asset is CustomSvgAsset => Boolean(asset));
    if (assets.length) {
      commit((p) => ({
        ...p,
        customLibrary: customLibraryFor(p, { svgs: [...(p.customLibrary?.svgs ?? []), ...assets] })
      }));
      setBottomPanel("custom");
    }
    event.target.value = "";
  }

  function bakeHumanization() {
    commit((p) => ({
      ...p,
      elements: p.elements.map((el) => {
        const a = adjustmentFor(el, p.humanize);
        return {
          ...el,
          x: el.x + a.x,
          y: el.y + a.y,
          rotation: el.rotation + a.rotation,
          opacity: Math.max(0.05, Math.min(1, el.opacity + a.opacity)),
          strokeWidth: normalizeStrokeWidth(el.strokeWidth + a.strokeWidth),
          ...(el.kind === "text" ? { fontSize: Math.max(1, el.fontSize + a.fontSize) } : {})
        } as GraphicElement;
      }),
      humanize: { ...p.humanize, enabled: false }
    }));
  }

  function pointerDown(event: PointerEvent, el: GraphicElement) {
    if (el.locked) return;
    select(el.id, event.shiftKey);
    setDrag({ id: el.id, x: event.clientX, y: event.clientY, startX: el.x, startY: el.y, before: project });
  }

  function pointerMove(event: PointerEvent) {
    if (!drag) return;
    const dx = (event.clientX - drag.x) / zoom;
    const dy = (event.clientY - drag.y) / zoom;
    const snap = project.canvas.snapToGrid ? project.canvas.gridSize : 1;
    const element = project.elements.find((el) => el.id === drag.id);
    if (!element) return;
    const nextX = clampValue(Math.round((drag.startX + dx) / snap) * snap, 0, project.canvas.width - element.width);
    const nextY = clampValue(Math.round((drag.startY + dy) / snap) * snap, 0, project.canvas.height - element.height);
    updateElementSilent(drag.id, { x: nextX, y: nextY });
  }

  function pointerUp() {
    if (!drag) return;
    setDrag(null);
    setHistory((current) => ({ ...current, past: [...current.past.slice(-49), drag.before] }));
  }

  function moveLayer(id: string, dir: -1 | 1) {
    commit((p) => {
      const index = p.elements.findIndex((el) => el.id === id);
      const next = index + dir;
      if (index < 0 || next < 0 || next >= p.elements.length) return p;
      const elements = [...p.elements];
      [elements[index], elements[next]] = [elements[next], elements[index]];
      return { ...p, elements };
    });
  }

  const bgClass = project.canvas.previewBackground === "checker" ? "checker" : "";
  const previewStyle = project.canvas.previewBackground === "black" ? { background: "#000000" } : project.canvas.previewBackground === "white" ? { background: "#ffffff" } : project.canvas.previewBackground === "custom" ? { background: project.canvas.previewCustom } : undefined;

  return (
    <div className="grid h-screen grid-cols-[320px_1fr_344px] bg-white text-black" style={{ gridTemplateRows: `minmax(0, 1fr) ${bottomPanelHeight}px` }}>
      <aside className="panel row-span-2 overflow-y-auto border-r p-3">
        <Header project={project} commit={commit} undo={undo} redo={redo} canUndo={history.past.length > 0} canRedo={history.future.length > 0} />
        <Section title="Serial Sticker">
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="tool-button" onClick={() => commit((p) => regenerate(p, `${p.generator.seed}-${Date.now()}`))}><Shuffle size={14} />Generate</button>
            <button className="tool-button" onClick={() => commit(() => cleanProject(createProject("micro-001", "serial")))}><RotateCcw size={14} />Reset</button>
          </div>
          <Field label="Seed" value={project.generator.seed} onChange={(seed) => silent((p) => ({ ...p, generator: { ...p.generator, seed }, humanize: { ...p.humanize, seed } }))} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Type min" value={project.generator.typeMin ?? 10} onChange={(typeMin) => commit((p) => ({ ...p, generator: { ...p.generator, typeMin, typeMax: Math.max(typeMin, p.generator.typeMax ?? typeMin) } }))} />
            <NumberField label="Type max" value={project.generator.typeMax ?? 18} onChange={(typeMax) => commit((p) => ({ ...p, generator: { ...p.generator, typeMax, typeMin: Math.min(typeMax, p.generator.typeMin ?? typeMax) } }))} />
            <NumberField label="Non-type min" value={project.generator.nonTypeMin ?? 18} onChange={(nonTypeMin) => commit((p) => ({ ...p, generator: { ...p.generator, nonTypeMin, nonTypeMax: Math.max(nonTypeMin, p.generator.nonTypeMax ?? nonTypeMin) } }))} />
            <NumberField label="Non-type max" value={project.generator.nonTypeMax ?? 30} onChange={(nonTypeMax) => commit((p) => ({ ...p, generator: { ...p.generator, nonTypeMax, nonTypeMin: Math.min(nonTypeMax, p.generator.nonTypeMin ?? nonTypeMax) } }))} />
          </div>
          <Slider label="Non-type stroke" value={normalizeStrokeWidth(project.generator.nonTypeStrokeWidth ?? 1.5)} min={1} max={5} step={0.25} onChange={updateNonTypeStrokeWidth} />
          <Toggle label="Text highlight" checked={project.generator.textHighlight ?? false} onChange={(textHighlight) => commit((p) => ({ ...p, generator: { ...p.generator, textHighlight } }))} />
          <ColorField label="Highlight color" value={project.generator.textHighlightColor ?? "#000000"} onChange={(textHighlightColor) => commit((p) => ({ ...p, generator: { ...p.generator, textHighlightColor } }))} />
          <Toggle label="45 degree rotation" checked={project.generator.allow45Rotation ?? true} onChange={(allow45Rotation) => commit((p) => ({ ...p, generator: { ...p.generator, allow45Rotation } }))} />
          <Toggle label="Prevent overlap" checked={project.generator.preventOverlap ?? false} onChange={(preventOverlap) => commit((p) => resolveProjectOverlaps({ ...p, generator: { ...p.generator, preventOverlap } }))} />
          <Toggle label="Custom Text" checked={project.customLibrary.useCustomText ?? false} onChange={(useCustomText) => commit((p) => ({ ...p, customLibrary: customLibraryFor(p, { useCustomText }) }))} />
          <Toggle label="Custom SVG" checked={project.customLibrary.useCustomSvg ?? false} onChange={(useCustomSvg) => commit((p) => ({ ...p, customLibrary: customLibraryFor(p, { useCustomSvg }) }))} />
        </Section>
        <Section title="Humanize">
          <Toggle label="Humanize" checked={project.humanize.enabled} onChange={(enabled) => commit((p) => ({ ...p, humanize: { ...p.humanize, enabled } }))} />
          <Field label="Humanize seed" value={project.humanize.seed} onChange={(seed) => silent((p) => ({ ...p, humanize: { ...p.humanize, seed } }))} />
          <div className="grid grid-cols-2 gap-2">
            <button className="tool-button" onClick={() => commit((p) => ({ ...p, humanize: { ...p.humanize, seed: `hz-${Date.now()}` } }))}><RefreshCcw size={14} />Seed</button>
            <button className="tool-button" onClick={bakeHumanization}>Bake</button>
          </div>
          {(["jitterX", "jitterY", "rotation", "opacity", "fontSize", "baseline"] as const).map((key) => (
            <Slider key={key} label={key} value={project.humanize[key]} min={0} max={key === "opacity" ? 0.5 : key === "rotation" ? 5 : 8} step={key === "opacity" ? 0.01 : 0.1} onChange={(value) => commit((p) => ({ ...p, humanize: { ...p.humanize, [key]: value } }))} />
          ))}
        </Section>
      </aside>

      <main className={`relative overflow-hidden ${bgClass}`} style={previewStyle} onPointerMove={pointerMove} onPointerUp={pointerUp}>
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          <button className="icon-button" title="Fit to screen" onClick={() => { setZoom(Math.min(1.1, Math.min((window.innerWidth - 760) / project.canvas.width, (window.innerHeight - 320) / project.canvas.height))); setPan({ x: 0, y: 0 }); }}><MousePointer2 size={15} /></button>
          <button className="icon-button" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.15, z - 0.1))}><ZoomOut size={15} /></button>
          <button className="icon-button" title="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}><ZoomIn size={15} /></button>
          <button className="icon-button" title="Reset view" onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }}><RotateCcw size={15} /></button>
          <span className="rounded-md border border-black bg-white px-2 py-1 text-xs font-medium shadow-sm">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex h-full items-center justify-center" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <div className="shadow-2xl shadow-black/50" style={{ width: project.canvas.width * zoom, height: project.canvas.height * zoom }}>
            <LabelSvg ref={svgRef} project={project} zoom={zoom} selectedIds={project.selectedIds} editingId={editingId} setEditingId={setEditingId} select={select} updateElement={updateElement} updateElementSilent={updateElementSilent} pointerDown={pointerDown} />
          </div>
        </div>
      </main>

      <aside className="panel row-span-2 overflow-y-auto border-l p-3">
        <Section title="Export">
          <div className="grid grid-cols-2 gap-2">
            <button className="tool-button" onClick={() => svgRef.current && exportSvg(svgRef.current, project.name || "micrographic", project)}><Download size={14} />SVG</button>
            <button className="tool-button" onClick={() => svgRef.current && exportStaticSvg(svgRef.current, project.name || "micrographic", project)}><Download size={14} />SVG STATIC</button>
            <button className="tool-button" onClick={() => svgRef.current && exportPng(svgRef.current, project, pngScale, transparentPng, includeBg)}><Download size={14} />PNG 300 DPI</button>
            <button className="tool-button" onClick={() => svgRef.current && copySvg(svgRef.current, project)}><Copy size={14} />Copy SVG</button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select label="PNG scale" value={String(pngScale)} onChange={(value) => setPngScale(Number(value))} options={[1, 2, 3, 4, 8].map((n) => ({ value: String(n), label: `${n}x` }))} />
            <Select label="Preview bg" value={project.canvas.previewBackground} onChange={(previewBackground) => commit((p) => ({ ...p, canvas: { ...p.canvas, previewBackground: previewBackground as Project["canvas"]["previewBackground"] } }))} options={["checker", "black", "white", "custom"].map((value) => ({ value, label: value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Preview custom" value={project.canvas.previewCustom} onChange={(previewCustom) => commit((p) => ({ ...p, canvas: { ...p.canvas, previewCustom } }))} />
          </div>
          <Toggle label="Transparent PNG" checked={transparentPng} onChange={setTransparentPng} />
          <Toggle label="PNG background" checked={includeBg} onChange={setIncludeBg} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="tool-button" onClick={() => jsonRef.current?.click()}><Upload size={14} />Load JSON</button>
          </div>
          <input ref={jsonRef} className="hidden" type="file" accept="application/json" onChange={loadProjectJson} />
          <input ref={fileRef} className="hidden" type="file" accept=".ttf,.otf,.woff,.woff2" onChange={importFont} />
        </Section>
        <Section title="Fonts">
          <div className="grid grid-cols-2 gap-2">
            {fontRoles.map(({ role, label }) => (
              <button key={role} className="tool-button" onClick={() => { setPendingFontRole(role); fileRef.current?.click(); }}><Upload size={14} />{label}</button>
            ))}
          </div>
          <div className="mt-2 space-y-1 text-xs text-neutral-600">
            {fontRoles.map(({ role, label }) => <div key={role}>{label}: {project.fonts?.[role]?.name ?? "not uploaded"}</div>)}
          </div>
        </Section>
        <SelectedPanel selected={selected} updateElement={updateElement} duplicateSelected={duplicateSelected} deleteSelected={deleteSelected} />
      </aside>

      <section className="panel relative col-start-2 overflow-hidden border-t">
        <div className="absolute inset-x-0 top-0 z-20 h-2 cursor-row-resize bg-black/0 hover:bg-black/20" onPointerDown={(event) => { event.preventDefault(); setPanelResize({ y: event.clientY, height: bottomPanelHeight }); }} />
        <BottomPanel
          active={bottomPanel}
          setActive={setBottomPanel}
          project={project}
          commit={commit}
          select={select}
          moveLayer={moveLayer}
          customSvgRef={customSvgRef}
          importCustomSvg={importCustomSvg}
          addCustomText={addCustomText}
          updateCustomTexts={updateCustomTexts}
          removeCustomText={removeCustomText}
          removeCustomSvg={removeCustomSvg}
        />
        <input ref={customSvgRef} className="hidden" type="file" accept=".svg,image/svg+xml" multiple onChange={importCustomSvg} />
      </section>
    </div>
  );
}

export default App;

function Header({ project, commit, undo, redo, canUndo, canRedo }: { project: Project; commit: (m: (p: Project) => Project) => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }) {
  return (
    <div className="mb-3 border-b border-black pb-3">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-lg font-black uppercase tracking-wide">Micrographics</h1>
        <div className="flex gap-1">
          <button className="icon-button" title="Undo" onClick={undo} disabled={!canUndo}><Undo2 size={15} /></button>
          <button className="icon-button" title="Redo" onClick={redo} disabled={!canRedo}><Redo2 size={15} /></button>
          <button className="icon-button" title="Save locally" onClick={() => saveLocal(project)}><Save size={15} /></button>
        </div>
      </div>
      <Field label="Project name" value={project.name} onChange={(name) => commit((p) => ({ ...p, name }))} />
    </div>
  );
}

interface LabelSvgProps {
  project: Project;
  zoom: number;
  selectedIds: string[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  select: (id: string, additive?: boolean) => void;
  updateElement: (id: string, patch: Partial<GraphicElement>) => void;
  updateElementSilent: (id: string, patch: Partial<GraphicElement>) => void;
  pointerDown: (event: PointerEvent, el: GraphicElement) => void;
}

const LabelSvg = forwardRef<SVGSVGElement, LabelSvgProps>(function LabelSvg({ project, zoom, selectedIds, editingId, setEditingId, select, updateElement, updateElementSilent, pointerDown }, ref) {
  return (
    <svg
      ref={ref}
      width={project.canvas.width}
      height={project.canvas.height}
      viewBox={`0 0 ${project.canvas.width} ${project.canvas.height}`}
      style={{ width: project.canvas.width * zoom, height: project.canvas.height * zoom, display: "block", overflow: "visible" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) select("");
      }}
    >
      <rect data-export-background="true" width={project.canvas.width} height={project.canvas.height} fill={project.canvas.background} />
      <g data-export-content="true">
        {project.elements.filter((el) => el.visible).map((el) => <ElementNode key={el.id} el={el} project={project} selected={selectedIds.includes(el.id)} editing={editingId === el.id} setEditingId={setEditingId} select={select} updateElement={updateElement} updateElementSilent={updateElementSilent} pointerDown={pointerDown} />)}
      </g>
      {project.canvas.gridVisible && <GridOverlay project={project} />}
    </svg>
  );
});

function ElementNode({ el, project, selected, editing, setEditingId, select, updateElement, updateElementSilent, pointerDown }: {
  el: GraphicElement;
  project: Project;
  selected: boolean;
  editing: boolean;
  setEditingId: (id: string | null) => void;
  select: (id: string, additive?: boolean) => void;
  updateElement: (id: string, patch: Partial<GraphicElement>) => void;
  updateElementSilent: (id: string, patch: Partial<GraphicElement>) => void;
  pointerDown: (event: PointerEvent, el: GraphicElement) => void;
}) {
  const a = adjustmentFor(el, project.humanize);
  const x = el.x + a.x;
  const y = el.y + a.y;
  const rotation = el.rotation + a.rotation;
  const opacity = Math.max(0.03, Math.min(1, el.opacity + a.opacity));
  const strokeWidth = normalizeStrokeWidth(el.strokeWidth + a.strokeWidth);
  return (
    <g data-label-element="true" transform={`translate(${x} ${y}) rotate(${rotation} ${el.width / 2} ${el.height / 2})`} opacity={opacity} onPointerDown={(event) => pointerDown(event, el)} onClick={(event) => { event.stopPropagation(); select(el.id, event.shiftKey); }} onDoubleClick={(event) => { event.stopPropagation(); if (el.kind === "text") setEditingId(el.id); }}>
      {el.kind === "text" && <TextNode el={el} project={project} editing={editing} adjustment={a} updateElement={updateElement} updateElementSilent={updateElementSilent} setEditingId={setEditingId} />}
      {el.kind === "shape" && <ShapeNode el={el} strokeWidth={strokeWidth} />}
      {el.kind === "icon" && <IconNode el={el} strokeWidth={strokeWidth} />}
      {el.kind === "svg" && <CustomSvgNode el={el} />}
      {selected && <rect x={-4} y={-4} width={el.width + 8} height={el.height + 8} fill="none" stroke="#000000" strokeDasharray="4 3" strokeWidth={1} pointerEvents="none" />}
    </g>
  );
}

function TextNode({ el, project, editing, adjustment, updateElement, updateElementSilent, setEditingId }: { el: TextElement; project: Project; editing: boolean; adjustment: { fontSize: number; baseline: number }; updateElement: (id: string, patch: Partial<GraphicElement>) => void; updateElementSilent: (id: string, patch: Partial<GraphicElement>) => void; setEditingId: (id: string | null) => void }) {
  if (editing) {
    return (
      <foreignObject width={Math.max(el.width, 80)} height={Math.max(el.height, 40)}>
        <textarea
          autoFocus
          value={el.text}
          onChange={(event) => updateElementSilent(el.id, { text: event.target.value } as Partial<GraphicElement>)}
          onBlur={() => setEditingId(null)}
          onKeyDown={(event) => { if (event.key === "Escape") setEditingId(null); }}
          style={{ width: "100%", height: "100%", background: "#fff", color: "#000", border: "1px solid #000000", font: `${el.fontWeight} ${el.fontSize}px ${el.fontFamily}` }}
        />
      </foreignObject>
    );
  }
  const fontSize = Math.max(1, el.fontSize + adjustment.fontSize);
  const lines = transformedText(el).split("\n");
  const lineHeight = fontSize * el.lineHeight;
  const highlightEnabled = project.generator.textHighlight ?? false;
  const highlightColor = project.generator.textHighlightColor ?? "#000000";
  return (
    <g>
      {highlightEnabled && lines.map((_, i) => (
        <rect key={`hl-${i}`} x={0} y={adjustment.baseline + i * lineHeight - 1} width={el.width} height={lineHeight} fill={highlightColor} />
      ))}
      <text fill={el.fill} stroke={el.strokeWidth > 0 ? el.stroke : "none"} strokeWidth={normalizeStrokeWidth(el.strokeWidth)} fontFamily={el.fontFamily} fontSize={fontSize} fontWeight={el.fontWeight} letterSpacing={el.letterSpacing} dominantBaseline="text-before-edge">
        {lines.map((line, i) => <tspan key={i} x={0} y={adjustment.baseline + i * lineHeight}>{line}</tspan>)}
      </text>
    </g>
  );
}

function ShapeNode({ el, strokeWidth }: { el: ShapeElement; strokeWidth: number }) {
  if (el.shape === "line") return null;
  if (el.shape === "circle") return null;
  if (el.shape === "grid") {
    const rows = el.rows ?? 4;
    const columns = el.columns ?? 6;
    return <g>{Array.from({ length: rows + 1 }, (_, i) => <line key={`r${i}`} x1={0} x2={el.width} y1={(el.height / rows) * i} y2={(el.height / rows) * i} stroke={el.stroke} strokeWidth={strokeWidth} />)}{Array.from({ length: columns + 1 }, (_, i) => <line key={`c${i}`} y1={0} y2={el.height} x1={(el.width / columns) * i} x2={(el.width / columns) * i} stroke={el.stroke} strokeWidth={strokeWidth} />)}</g>;
  }
  if (el.shape === "barcode") return <g>{Array.from({ length: 42 }, (_, i) => <rect key={i} x={(el.width / 42) * i} y={0} width={(i % 5 === 0 ? 3 : i % 2 ? 1 : 2) * (el.width / 120)} height={el.height} fill={el.stroke} />)}</g>;
  return <rect width={el.width} height={el.height} rx={0} fill={el.fill} stroke={el.stroke} strokeWidth={strokeWidth} />;
}

function CustomSvgNode({ el }: { el: CustomSvgElement }) {
  return <svg width={el.width} height={el.height} viewBox={el.viewBox} preserveAspectRatio="xMidYMid meet" overflow="visible" dangerouslySetInnerHTML={{ __html: el.content }} />;
}

function IconNode({ el, strokeWidth }: { el: IconElement; strokeWidth: number }) {
  const s = Math.min(el.width, el.height);
  const common = { fill: "none", stroke: el.stroke, strokeWidth, strokeLinecap: "butt" as const, strokeLinejoin: "miter" as const };
  const isoPictogram = renderIsoPictogram(el, strokeWidth);
  if (isoPictogram) return isoPictogram;
  if (el.icon === "warning") return <g><path d={`M${s / 2} 4 L${s - 4} ${s - 4} L4 ${s - 4} Z`} {...common} /><line x1={s / 2} y1={s * 0.32} x2={s / 2} y2={s * 0.64} {...common} /><circle cx={s / 2} cy={s * 0.78} r={2} fill={el.stroke} /></g>;
  if (el.icon === "lightning") return <path d={`M${s * 0.58} 2 L${s * 0.2} ${s * 0.55} H${s * 0.48} L${s * 0.36} ${s - 2} L${s * 0.82} ${s * 0.38} H${s * 0.54} Z`} fill={el.fill} />;
  if (el.icon === "globe") return <g><circle cx={s / 2} cy={s / 2} r={s / 2 - 3} {...common} /><path d={`M5 ${s / 2} H${s - 5} M${s / 2} 5 C${s * 0.35} ${s * 0.25} ${s * 0.35} ${s * 0.75} ${s / 2} ${s - 5} M${s / 2} 5 C${s * 0.65} ${s * 0.25} ${s * 0.65} ${s * 0.75} ${s / 2} ${s - 5}`} {...common} /></g>;
  if (el.icon === "cert") return <g><circle cx={s / 2} cy={s / 2} r={s / 2 - 3} {...common} /><text x={s / 2} y={s / 2 + 5} textAnchor="middle" fontSize={s * 0.34} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>{el.label ?? "NX"}</text></g>;
  if (el.icon === "stamp") return <g><rect x={4} y={s * 0.25} width={s - 8} height={s * 0.5} rx={0} {...common} /><text x={s / 2} y={s * 0.58} textAnchor="middle" fontSize={s * 0.18} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.mono}>{el.label ?? "PASS"}</text></g>;
  if (el.icon === "polarity") return <g><circle cx={s * 0.35} cy={s / 2} r={s * 0.18} {...common} /><circle cx={s * 0.65} cy={s / 2} r={s * 0.18} {...common} /><line x1={s * 0.35} y1={s / 2} x2={s * 0.65} y2={s / 2} {...common} /><text x={s * 0.18} y={s * 0.58} fill={el.fill} fontSize={s * 0.22}>+</text><text x={s * 0.78} y={s * 0.58} fill={el.fill} fontSize={s * 0.28}>-</text></g>;
  if (el.icon === "bin") return <g><path d={`M${s * 0.3} ${s * 0.25} H${s * 0.7} L${s * 0.64} ${s * 0.82} H${s * 0.36} Z M${s * 0.25} ${s * 0.25} H${s * 0.75} M${s * 0.42} ${s * 0.18} H${s * 0.58}`} {...common} /><line x1={s * 0.24} y1={s * 0.78} x2={s * 0.78} y2={s * 0.28} {...common} /></g>;
  if (el.icon === "doubleSquare") return <g><rect x={s * 0.18} y={s * 0.18} width={s * 0.64} height={s * 0.64} {...common} /><rect x={s * 0.32} y={s * 0.32} width={s * 0.36} height={s * 0.36} {...common} /></g>;
  if (el.icon === "arrow") return <path d={`M4 ${s / 2} H${s - 12} M${s - 26} ${s * 0.28} L${s - 6} ${s / 2} L${s - 26} ${s * 0.72}`} {...common} />;
  if (el.icon === "dotMark") return <g>{Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => <circle key={`${x}-${y}`} cx={s * 0.22 + x * s * 0.18} cy={s * 0.22 + y * s * 0.18} r={s * 0.04} fill={el.fill} />))}</g>;
  if (el.icon === "crosshair") return <g><circle cx={s / 2} cy={s / 2} r={s * 0.34} {...common} /><line x1={s / 2} y1={3} x2={s / 2} y2={s - 3} {...common} /><line x1={3} y1={s / 2} x2={s - 3} y2={s / 2} {...common} /></g>;
  if (el.icon === "chip") return <g><rect x={s * 0.2} y={s * 0.2} width={s * 0.6} height={s * 0.6} {...common} />{Array.from({ length: 5 }, (_, i) => <g key={i}><line x1={s * 0.08} y1={s * (0.25 + i * 0.12)} x2={s * 0.2} y2={s * (0.25 + i * 0.12)} {...common} /><line x1={s * 0.8} y1={s * (0.25 + i * 0.12)} x2={s * 0.92} y2={s * (0.25 + i * 0.12)} {...common} /></g>)}</g>;
  if (el.icon === "waveform") return <path d={`M4 ${s * 0.55} C${s * 0.16} ${s * 0.15} ${s * 0.26} ${s * 0.15} ${s * 0.38} ${s * 0.55} S${s * 0.6} ${s * 0.95} ${s * 0.72} ${s * 0.55} S${s * 0.88} ${s * 0.15} ${s - 4} ${s * 0.55}`} {...common} />;
  if (el.icon === "antenna") return <g><line x1={s / 2} y1={s - 4} x2={s / 2} y2={s * 0.42} {...common} /><path d={`M${s * 0.28} ${s * 0.34} Q${s / 2} ${s * 0.12} ${s * 0.72} ${s * 0.34} M${s * 0.18} ${s * 0.22} Q${s / 2} -2 ${s * 0.82} ${s * 0.22}`} {...common} /><circle cx={s / 2} cy={s * 0.4} r={s * 0.05} fill={el.fill} /></g>;
  if (el.icon === "terminal") return <g><rect x={s * 0.12} y={s * 0.24} width={s * 0.76} height={s * 0.52} rx={0} {...common} /><path d={`M${s * 0.24} ${s * 0.4} L${s * 0.36} ${s * 0.5} L${s * 0.24} ${s * 0.6} M${s * 0.44} ${s * 0.62} H${s * 0.66}`} {...common} /></g>;
  if (el.icon === "chevron") return <path d={`M${s * 0.24} ${s * 0.18} L${s * 0.72} ${s / 2} L${s * 0.24} ${s * 0.82} M${s * 0.48} ${s * 0.18} L${s * 0.92} ${s / 2} L${s * 0.48} ${s * 0.82}`} {...common} />;
  if (el.icon === "bracket") return <path d={`M${s * 0.34} 4 H${s * 0.12} V${s - 4} H${s * 0.34} M${s * 0.66} 4 H${s * 0.88} V${s - 4} H${s * 0.66}`} {...common} />;
  if (el.icon === "target") return <g><circle cx={s / 2} cy={s / 2} r={s * 0.42} {...common} /><circle cx={s / 2} cy={s / 2} r={s * 0.24} {...common} /><circle cx={s / 2} cy={s / 2} r={s * 0.06} fill={el.fill} /></g>;
  if (el.icon === "caliper") return <path d={`M${s * 0.22} 4 V${s - 4} H${s * 0.78} M${s * 0.22} ${s * 0.24} H${s * 0.56} M${s * 0.22} ${s * 0.5} H${s * 0.7} M${s * 0.22} ${s * 0.76} H${s * 0.46}`} {...common} />;
  if (el.icon === "diode") return <g><line x1={4} y1={s / 2} x2={s - 4} y2={s / 2} {...common} /><path d={`M${s * 0.32} ${s * 0.28} L${s * 0.62} ${s / 2} L${s * 0.32} ${s * 0.72} Z`} fill={el.fill} stroke={el.stroke} strokeWidth={strokeWidth} /><line x1={s * 0.66} y1={s * 0.28} x2={s * 0.66} y2={s * 0.72} {...common} /></g>;
  if (el.icon === "glyph") return <text x={s / 2} y={s * 0.68} textAnchor="middle" fontSize={s * 0.68} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.mono}>{el.label ?? "⌖"}</text>;
  if (el.icon === "circuitBlock") return <g><rect x={s * 0.12} y={s * 0.16} width={s * 0.76} height={s * 0.68} rx={0} {...common} /><circle cx={s * 0.32} cy={s * 0.38} r={s * 0.07} {...common} /><circle cx={s * 0.68} cy={s * 0.38} r={s * 0.07} {...common} /><path d={`M${s * 0.32} ${s * 0.45} V${s * 0.62} H${s * 0.68} V${s * 0.45} M${s * 0.12} ${s * 0.5} H${s * 0.26} M${s * 0.74} ${s * 0.5} H${s * 0.88}`} {...common} /><text x={s / 2} y={s * 0.78} textAnchor="middle" fontSize={s * 0.13} fill={el.fill} fontFamily={fontRoleFamilies.mono}>I/O</text></g>;
  if (el.icon === "waveBadge") return <g><rect x={s * 0.08} y={s * 0.24} width={s * 0.84} height={s * 0.52} rx={0} {...common} /><path d={`M${s * 0.18} ${s * 0.52} C${s * 0.28} ${s * 0.28} ${s * 0.38} ${s * 0.28} ${s * 0.48} ${s * 0.52} S${s * 0.68} ${s * 0.76} ${s * 0.82} ${s * 0.48}`} {...common} /><circle cx={s * 0.22} cy={s * 0.5} r={s * 0.035} fill={el.fill} /><circle cx={s * 0.78} cy={s * 0.5} r={s * 0.035} fill={el.fill} /></g>;
  if (el.icon === "terminalStrip") return <g><rect x={s * 0.08} y={s * 0.25} width={s * 0.84} height={s * 0.5} {...common} />{Array.from({ length: 4 }, (_, i) => <g key={i}><rect x={s * (0.14 + i * 0.19)} y={s * 0.34} width={s * 0.12} height={s * 0.22} {...common} /><line x1={s * (0.2 + i * 0.19)} y1={s * 0.56} x2={s * (0.2 + i * 0.19)} y2={s * 0.84} {...common} /></g>)}</g>;
  if (el.icon === "equipmentCluster") return <g><rect x={s * 0.08} y={s * 0.08} width={s * 0.84} height={s * 0.84} {...common} /><text x={s * 0.25} y={s * 0.35} textAnchor="middle" fontSize={s * 0.22} fill={el.fill} fontFamily={fontRoleFamilies.mono}>⏻</text><text x={s * 0.5} y={s * 0.35} textAnchor="middle" fontSize={s * 0.2} fill={el.fill} fontFamily={fontRoleFamilies.mono}>⎓</text><text x={s * 0.75} y={s * 0.35} textAnchor="middle" fontSize={s * 0.2} fill={el.fill} fontFamily={fontRoleFamilies.mono}>⏚</text><path d={`M${s * 0.18} ${s * 0.58} H${s * 0.82} M${s * 0.24} ${s * 0.72} H${s * 0.76}`} {...common} /></g>;
  if (el.icon === "safetyPanel") return <g><rect x={s * 0.06} y={s * 0.1} width={s * 0.88} height={s * 0.8} {...common} /><path d={`M${s * 0.18} ${s * 0.78} L${s * 0.38} ${s * 0.26} L${s * 0.58} ${s * 0.78} Z`} {...common} /><line x1={s * 0.38} y1={s * 0.42} x2={s * 0.38} y2={s * 0.62} {...common} /><circle cx={s * 0.38} cy={s * 0.7} r={s * 0.025} fill={el.fill} /><text x={s * 0.72} y={s * 0.45} textAnchor="middle" fontSize={s * 0.12} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>WARN</text><path d={`M${s * 0.62} ${s * 0.58} H${s * 0.84} M${s * 0.62} ${s * 0.7} H${s * 0.78}`} {...common} /></g>;
  if (el.icon === "handlingPanel") return <g><rect x={s * 0.08} y={s * 0.08} width={s * 0.84} height={s * 0.84} {...common} /><path d={`M${s * 0.22} ${s * 0.66} H${s * 0.78} V${s * 0.34} H${s * 0.22} Z M${s * 0.34} ${s * 0.34} V${s * 0.2} H${s * 0.66} V${s * 0.34}`} {...common} /><path d={`M${s * 0.35} ${s * 0.78} L${s * 0.5} ${s * 0.66} L${s * 0.65} ${s * 0.78}`} {...common} /><text x={s / 2} y={s * 0.9} textAnchor="middle" fontSize={s * 0.1} fill={el.fill} fontFamily={fontRoleFamilies.mono}>UP</text></g>;
  if (el.icon === "vehicleDotMark") return <g><rect x={s * 0.08} y={s * 0.2} width={s * 0.84} height={s * 0.6} rx={0} {...common} /><text x={s / 2} y={s * 0.44} textAnchor="middle" fontSize={s * 0.18} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>DOT</text><text x={s / 2} y={s * 0.66} textAnchor="middle" fontSize={s * 0.16} fill={el.fill} fontFamily={fontRoleFamilies.mono}>AS-1 M###</text></g>;
  if (el.icon === "certification_marks") return <g><rect x={s * 0.08} y={s * 0.08} width={s * 0.84} height={s * 0.84} {...common} /><text x={s * 0.32} y={s * 0.43} textAnchor="middle" fontSize={s * 0.22} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>FC</text><text x={s * 0.68} y={s * 0.43} textAnchor="middle" fontSize={s * 0.22} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>NX</text><path d={`M${s * 0.2} ${s * 0.62} H${s * 0.8} M${s * 0.28} ${s * 0.74} H${s * 0.72}`} {...common} /></g>;
  if (el.icon === "regulatory_marks") return <g><rect x={s * 0.1} y={s * 0.12} width={s * 0.8} height={s * 0.76} {...common} /><path d={`M${s * 0.22} ${s * 0.3} H${s * 0.78} V${s * 0.48} H${s * 0.22} Z M${s * 0.28} ${s * 0.62} H${s * 0.72} M${s * 0.28} ${s * 0.74} H${s * 0.56}`} {...common} /><text x={s / 2} y={s * 0.43} textAnchor="middle" fontSize={s * 0.14} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.mono}>REG</text></g>;
  if (el.icon === "safety_pictograms") return <g><path d={`M${s * 0.5} ${s * 0.08} L${s * 0.9} ${s * 0.86} H${s * 0.1} Z`} {...common} /><path d={`M${s * 0.5} ${s * 0.28} V${s * 0.58} M${s * 0.5} ${s * 0.72} V${s * 0.78}`} {...common} /><path d={`M${s * 0.28} ${s * 0.84} H${s * 0.72}`} {...common} /></g>;
  if (el.icon === "warning_decals") return <g><rect x={s * 0.06} y={s * 0.18} width={s * 0.88} height={s * 0.64} {...common} /><path d={`M${s * 0.12} ${s * 0.34} H${s * 0.88}`} {...common} /><text x={s / 2} y={s * 0.31} textAnchor="middle" fontSize={s * 0.12} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>CAUTION</text><path d={`M${s * 0.24} ${s * 0.66} L${s * 0.34} ${s * 0.44} L${s * 0.44} ${s * 0.66} Z M${s * 0.54} ${s * 0.5} H${s * 0.82} M${s * 0.54} ${s * 0.62} H${s * 0.74}`} {...common} /></g>;
  if (el.icon === "automotive_glass_markings") return <g><rect x={s * 0.08} y={s * 0.16} width={s * 0.84} height={s * 0.68} {...common} /><text x={s / 2} y={s * 0.36} textAnchor="middle" fontSize={s * 0.16} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>DOT 742</text><text x={s / 2} y={s * 0.55} textAnchor="middle" fontSize={s * 0.13} fill={el.fill} fontFamily={fontRoleFamilies.mono}>M848 AS2</text><path d={`M${s * 0.24} ${s * 0.68} H${s * 0.76}`} {...common} /></g>;
  if (el.icon === "recycling_disposal_marks") return <g><rect x={s * 0.1} y={s * 0.1} width={s * 0.8} height={s * 0.8} {...common} /><path d={`M${s * 0.34} ${s * 0.42} L${s * 0.5} ${s * 0.24} L${s * 0.66} ${s * 0.42} M${s * 0.66} ${s * 0.58} L${s * 0.5} ${s * 0.76} L${s * 0.34} ${s * 0.58} M${s * 0.32} ${s * 0.72} L${s * 0.68} ${s * 0.28}`} {...common} /><text x={s / 2} y={s * 0.56} textAnchor="middle" fontSize={s * 0.15} fill={el.fill} fontFamily={fontRoleFamilies.mono}>R</text></g>;
  if (el.icon === "handling_shipping_symbols") return <g><rect x={s * 0.12} y={s * 0.18} width={s * 0.76} height={s * 0.58} {...common} /><path d={`M${s * 0.24} ${s * 0.58} H${s * 0.76} M${s * 0.36} ${s * 0.44} L${s * 0.5} ${s * 0.3} L${s * 0.64} ${s * 0.44} M${s * 0.5} ${s * 0.3} V${s * 0.66}`} {...common} /><text x={s / 2} y={s * 0.88} textAnchor="middle" fontSize={s * 0.1} fill={el.fill} fontFamily={fontRoleFamilies.mono}>HANDLE</text></g>;
  if (el.icon === "technical_instruction_icons") return <g><rect x={s * 0.1} y={s * 0.1} width={s * 0.8} height={s * 0.8} {...common} /><path d={`M${s * 0.28} ${s * 0.3} H${s * 0.72} M${s * 0.28} ${s * 0.46} H${s * 0.6} M${s * 0.28} ${s * 0.62} H${s * 0.72}`} {...common} /><text x={s * 0.72} y={s * 0.78} textAnchor="middle" fontSize={s * 0.18} fill={el.fill} fontFamily={fontRoleFamilies.mono}>i</text></g>;
  if (el.icon === "ansi_safety_pictograms") return <g><rect x={s * 0.06} y={s * 0.1} width={s * 0.88} height={s * 0.8} {...common} /><rect x={s * 0.06} y={s * 0.1} width={s * 0.88} height={s * 0.22} fill={el.fill} /><text x={s / 2} y={s * 0.27} textAnchor="middle" fontSize={s * 0.13} fontWeight={900} fill="#ffffff" fontFamily={fontRoleFamilies.condensed}>WARNING</text><path d={`M${s * 0.22} ${s * 0.74} L${s * 0.36} ${s * 0.42} L${s * 0.5} ${s * 0.74} Z M${s * 0.62} ${s * 0.46} H${s * 0.84} M${s * 0.62} ${s * 0.58} H${s * 0.78} M${s * 0.62} ${s * 0.7} H${s * 0.82}`} {...common} /></g>;
  if (el.icon === "iso_7010_safety_signs") return <g><path d={`M${s / 2} ${s * 0.08} L${s * 0.92} ${s * 0.84} H${s * 0.08} Z`} {...common} /><path d={`M${s / 2} ${s * 0.3} V${s * 0.58} M${s / 2} ${s * 0.7} V${s * 0.76}`} {...common} /><path d={`M${s * 0.22} ${s * 0.88} H${s * 0.78}`} {...common} /></g>;
  if (el.icon === "ce_mark") return <g><text x={s * 0.18} y={s * 0.68} fontSize={s * 0.58} fontWeight={700} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>CE</text><path d={`M${s * 0.14} ${s * 0.76} H${s * 0.88}`} {...common} /></g>;
  if (el.icon === "fcc_mark") return <g><rect x={s * 0.1} y={s * 0.18} width={s * 0.8} height={s * 0.64} {...common} /><text x={s / 2} y={s * 0.58} textAnchor="middle" fontSize={s * 0.26} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>FCC</text><path d={`M${s * 0.2} ${s * 0.32} H${s * 0.8} M${s * 0.2} ${s * 0.7} H${s * 0.8}`} {...common} /></g>;
  if (el.icon === "rohs_mark") return <g><rect x={s * 0.14} y={s * 0.14} width={s * 0.72} height={s * 0.72} {...common} /><text x={s / 2} y={s * 0.48} textAnchor="middle" fontSize={s * 0.18} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>RoHS</text><text x={s / 2} y={s * 0.66} textAnchor="middle" fontSize={s * 0.12} fill={el.fill} fontFamily={fontRoleFamilies.mono}>OK</text></g>;
  if (el.icon === "weee_mark") return <g><path d={`M${s * 0.3} ${s * 0.28} H${s * 0.72} L${s * 0.66} ${s * 0.76} H${s * 0.36} Z M${s * 0.24} ${s * 0.28} H${s * 0.78} M${s * 0.42} ${s * 0.2} H${s * 0.58} M${s * 0.22} ${s * 0.84} H${s * 0.78} M${s * 0.28} ${s * 0.9} H${s * 0.72}`} {...common} /></g>;
  if (el.icon === "ul_mark") return <g><rect x={s * 0.12} y={s * 0.12} width={s * 0.76} height={s * 0.76} {...common} /><text x={s / 2} y={s * 0.62} textAnchor="middle" fontSize={s * 0.38} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>UL</text></g>;
  if (el.icon === "dot_as1_mark") return <g><rect x={s * 0.08} y={s * 0.18} width={s * 0.84} height={s * 0.64} {...common} /><text x={s / 2} y={s * 0.38} textAnchor="middle" fontSize={s * 0.16} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>DOT 742</text><text x={s / 2} y={s * 0.56} textAnchor="middle" fontSize={s * 0.14} fill={el.fill} fontFamily={fontRoleFamilies.mono}>AS1 M848</text><path d={`M${s * 0.22} ${s * 0.68} H${s * 0.78}`} {...common} /></g>;
  if (el.icon === "e_mark_symbols") return <g><rect x={s * 0.12} y={s * 0.22} width={s * 0.76} height={s * 0.56} {...common} /><text x={s * 0.38} y={s * 0.57} textAnchor="middle" fontSize={s * 0.28} fontWeight={900} fill={el.fill} fontFamily={fontRoleFamilies.condensed}>E4</text><text x={s * 0.68} y={s * 0.57} textAnchor="middle" fontSize={s * 0.12} fill={el.fill} fontFamily={fontRoleFamilies.mono}>43R</text></g>;
  return <g><rect x={4} y={4} width={s - 8} height={s - 8} {...common} /><path d={`M${s * 0.25} ${s * 0.7} L${s * 0.45} ${s * 0.3} L${s * 0.7} ${s * 0.7}`} {...common} /><text x={s / 2} y={s * 0.52} textAnchor="middle" fontSize={s * 0.2} fill={el.fill}>{el.label ?? "ID"}</text></g>;
}

function GridOverlay({ project }: { project: Project }) {
  const size = project.canvas.gridSize;
  return <g opacity={0.16} pointerEvents="none">{Array.from({ length: Math.floor(project.canvas.width / size) + 1 }, (_, i) => <line key={`x${i}`} x1={i * size} x2={i * size} y1={0} y2={project.canvas.height} stroke="#000000" strokeWidth={1} />)}{Array.from({ length: Math.floor(project.canvas.height / size) + 1 }, (_, i) => <line key={`y${i}`} y1={i * size} y2={i * size} x1={0} x2={project.canvas.width} stroke="#000000" strokeWidth={1} />)}</g>;
}

function SelectedPanel({ selected, updateElement, duplicateSelected, deleteSelected }: { selected?: GraphicElement; updateElement: (id: string, patch: Partial<GraphicElement>) => void; duplicateSelected: () => void; deleteSelected: () => void }) {
  if (!selected) return <Section title="Selection"><p className="text-sm text-neutral-600">Select a layer or click an element in the preview.</p></Section>;
  const fontOptions = fontRoles.map(({ role, label }) => ({ label, value: fontRoleFamilies[role] }));
  return (
    <Section title="Selected Element">
      <Field label="Layer name" value={selected.name} onChange={(name) => updateElement(selected.id, { name } as Partial<GraphicElement>)} />
      {selected.kind === "text" && <TextArea label="Text" value={selected.text} onChange={(text) => updateElement(selected.id, { text } as Partial<GraphicElement>)} />}
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y", "width", "height", "rotation", "opacity"] as const).map((key) => <NumberField key={key} label={key} value={selected[key]} step={key === "opacity" ? 0.05 : 1} onChange={(value) => updateElement(selected.id, { [key]: value } as Partial<GraphicElement>)} />)}
      </div>
      <div className="grid grid-cols-1 gap-2">
        <NumberField label="Stroke width" value={selected.strokeWidth} step={0.25} onChange={(strokeWidth) => updateElement(selected.id, { strokeWidth: normalizeStrokeWidth(strokeWidth) } as Partial<GraphicElement>)} />
      </div>
      {selected.kind === "text" && (
        <>
          <Select label="Font" value={selected.fontFamily} onChange={(fontFamily) => updateElement(selected.id, { fontFamily } as Partial<GraphicElement>)} options={fontOptions} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Size" value={selected.fontSize} onChange={(fontSize) => updateElement(selected.id, { fontSize } as Partial<GraphicElement>)} />
            <NumberField label="Weight" value={selected.fontWeight} step={100} onChange={(fontWeight) => updateElement(selected.id, { fontWeight } as Partial<GraphicElement>)} />
            <NumberField label="Letter space" value={selected.letterSpacing} step={0.1} onChange={(letterSpacing) => updateElement(selected.id, { letterSpacing } as Partial<GraphicElement>)} />
            <NumberField label="Line height" value={selected.lineHeight} step={0.05} onChange={(lineHeight) => updateElement(selected.id, { lineHeight } as Partial<GraphicElement>)} />
          </div>
          <Select label="Transform" value={selected.transform} onChange={(transform) => updateElement(selected.id, { transform } as Partial<GraphicElement>)} options={["uppercase", "lowercase", "normal"].map((value) => ({ value, label: value }))} />
        </>
      )}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button className="tool-button" onClick={() => updateElement(selected.id, { locked: !selected.locked } as Partial<GraphicElement>)}>{selected.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
        <button className="tool-button" onClick={duplicateSelected}><Copy size={14} /></button>
        <button className="tool-button" onClick={deleteSelected}><Trash2 size={14} /></button>
      </div>
    </Section>
  );
}

function BottomPanel({
  active,
  setActive,
  project,
  commit,
  select,
  moveLayer,
  customSvgRef,
  importCustomSvg,
  addCustomText,
  updateCustomTexts,
  removeCustomText,
  removeCustomSvg
}: {
  active: BottomPanelView;
  setActive: (view: BottomPanelView) => void;
  project: Project;
  commit: (m: (p: Project) => Project) => void;
  select: (id: string, additive?: boolean) => void;
  moveLayer: (id: string, dir: -1 | 1) => void;
  customSvgRef: React.RefObject<HTMLInputElement | null>;
  importCustomSvg: (event: ChangeEvent<HTMLInputElement>) => void;
  addCustomText: (value: string) => void;
  updateCustomTexts: (raw: string) => void;
  removeCustomText: (index: number) => void;
  removeCustomSvg: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-black px-3 py-2 text-xs font-semibold uppercase text-neutral-600">
        <button className={`tool-button h-7 px-2 ${active === "layers" ? "bg-black text-white" : ""}`} onClick={() => setActive("layers")}><Layers size={13} />Layers</button>
        <button className={`tool-button h-7 px-2 ${active === "custom" ? "bg-black text-white" : ""}`} onClick={() => setActive("custom")}><FileText size={13} />Custom</button>
      </div>
      {active === "layers" ? (
        <LayerList project={project} commit={commit} select={select} moveLayer={moveLayer} />
      ) : (
        <CustomLibraryPanel
          project={project}
          commit={commit}
          customSvgRef={customSvgRef}
          importCustomSvg={importCustomSvg}
          addCustomText={addCustomText}
          updateCustomTexts={updateCustomTexts}
          removeCustomText={removeCustomText}
          removeCustomSvg={removeCustomSvg}
        />
      )}
    </div>
  );
}

function LayerList({ project, commit, select, moveLayer }: { project: Project; commit: (m: (p: Project) => Project) => void; select: (id: string, additive?: boolean) => void; moveLayer: (id: string, dir: -1 | 1) => void }) {
  return (
    <div className="flex-1 overflow-auto p-2">
        {[...project.elements].reverse().map((el) => (
          <div key={el.id} className={`mb-1 grid grid-cols-[28px_28px_1fr_28px_28px] items-center gap-1 rounded-md border px-1 py-1 text-xs ${project.selectedIds.includes(el.id) ? "border-black bg-neutral-100" : "border-black bg-white"}`} onClick={() => select(el.id)}>
            <button className="icon-button" title="Show/hide" onClick={(event) => { event.stopPropagation(); commit((p) => resolveProjectOverlaps({ ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, visible: !item.visible } : item) })); }}>{el.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
            <button className="icon-button" title="Lock" onClick={(event) => { event.stopPropagation(); commit((p) => ({ ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, locked: !item.locked } : item) })); }}>{el.locked ? <Lock size={13} /> : <LockOpen size={13} />}</button>
            <span className="truncate">{el.name}</span>
            <button className="icon-button" title="Move up" onClick={(event) => { event.stopPropagation(); moveLayer(el.id, 1); }}><ArrowUp size={13} /></button>
            <button className="icon-button" title="Move down" onClick={(event) => { event.stopPropagation(); moveLayer(el.id, -1); }}><ArrowDown size={13} /></button>
          </div>
        ))}
    </div>
  );
}

function CustomLibraryPanel({
  project,
  commit,
  customSvgRef,
  addCustomText,
  updateCustomTexts,
  removeCustomText,
  removeCustomSvg
}: {
  project: Project;
  commit: (m: (p: Project) => Project) => void;
  customSvgRef: React.RefObject<HTMLInputElement | null>;
  importCustomSvg: (event: ChangeEvent<HTMLInputElement>) => void;
  addCustomText: (value: string) => void;
  updateCustomTexts: (raw: string) => void;
  removeCustomText: (index: number) => void;
  removeCustomSvg: (id: string) => void;
}) {
  const custom = project.customLibrary ?? { useCustomText: false, useCustomSvg: false, texts: [], svgs: [] };
  const [draft, setDraft] = useState("");
  const submitDraft = () => {
    addCustomText(draft);
    setDraft("");
  };
  return (
    <div className="grid flex-1 grid-cols-[320px_1fr_1fr] gap-3 overflow-auto p-3 text-xs">
      <div>
        <div className="mb-2 block">
          <span className="label">Add custom word</span>
          <div className="grid grid-cols-[1fr_76px] gap-2">
            <Input
              aria-label="Add custom word"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitDraft();
                }
              }}
            />
            <button type="button" className="tool-button" onClick={submitDraft}>Add</button>
          </div>
        </div>
        <TextArea label="Custom words" value={custom.texts.join("\n")} onChange={updateCustomTexts} />
        <button className="tool-button w-full" onClick={() => customSvgRef.current?.click()}><Upload size={14} />Upload SVG</button>
      </div>
      <div className="overflow-auto">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-neutral-600"><FileText size={13} />Words</div>
        {custom.texts.length ? custom.texts.map((text, index) => (
          <div key={`${text}-${index}`} className="mb-1 grid grid-cols-[1fr_28px] items-center gap-2 rounded-md border border-black bg-white px-2 py-1">
            <span className="truncate">{text}</span>
            <button className="icon-button h-6 w-6" title="Remove word" onClick={() => removeCustomText(index)}><Trash2 size={12} /></button>
          </div>
        )) : <p className="text-neutral-600">No custom words</p>}
      </div>
      <div className="overflow-auto">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-neutral-600"><Upload size={13} />SVGs</div>
        {custom.svgs.length ? custom.svgs.map((asset) => (
          <div key={asset.id} className="mb-1 grid grid-cols-[1fr_70px_28px] items-center gap-2 rounded-md border border-black bg-white px-2 py-1">
            <span className="truncate">{asset.name}</span>
            <span className="text-neutral-600">{asset.viewBox.split(/\s+/).slice(2).join("x")}</span>
            <button className="icon-button h-6 w-6" title="Remove SVG" onClick={() => removeCustomSvg(asset.id)}><Trash2 size={12} /></button>
          </div>
        )) : <p className="text-neutral-600">No custom SVGs</p>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-4 border-b border-black pb-4"><h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-neutral-600"><AlignJustify size={13} />{title}</h2>{children}</section>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mb-2 block"><span className="label">{label}</span><Input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mb-2 block"><span className="label">{label}</span><Textarea className="resize-none" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <label className="mb-2 block"><span className="label">{label}</span><Input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mb-2 block"><span className="label">{label}</span><div className="flex gap-2"><Input className="h-9 w-11 p-1" type="color" value={value === "none" ? "#000000" : value} onChange={(event) => onChange(event.target.value)} /><Input value={value} onChange={(event) => onChange(event.target.value)} /></div></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="mb-2 block"><span className="label">{label}</span><SelectControl value={value} options={options} onValueChange={onChange} /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="mb-2 flex items-center justify-between gap-3 text-sm text-black"><span>{label}</span><Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} /></label>;
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="mb-3 block"><span className="label">{label}: {value.toFixed(2)}</span><SliderControl value={value} min={min} max={max} step={step} onValueChange={onChange} /></label>;
}
