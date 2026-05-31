import { CanvasSettings, ElementBase, FontRole, GraphicElement, IconKind, Project, ShapeKind, TemplateId, TextElement, fontRoleFamilies, isoPictogramKinds } from "./types";
import { Rng, between, code, createRng, int, pick } from "./random";

const white = "#ffffff";
const black = "#111111";
const red = black;
const gray = black;
const serialTemplate: TemplateId = "serial";

function normalizeStrokeWidth(strokeWidth: number): number {
  return strokeWidth > 0 ? Math.max(1, Math.min(5, strokeWidth)) : 0;
}

function rotationOptions(allow45Rotation = true): number[] {
  return allow45Rotation ? [0, 0, 0, 45, -45, 90, -90, 180] : [0, 0, 0, 90, -90, 180];
}

function id(prefix: string, rng: Rng): string {
  return `${prefix}-${Math.floor(rng() * 1e9).toString(36)}`;
}

function baseCanvas(width = 768, height = 512, background = white): CanvasSettings {
  return {
    width,
    height,
    padding: 32,
    background,
    exportBackground: background,
    previewBackground: "black",
    previewCustom: "#000000",
    roundedBackground: false,
    frame: false,
    gridVisible: false,
    snapToGrid: true,
    gridSize: 8,
    cleanVector: true
  };
}

const base = (rng: Rng, kind: GraphicElement["kind"], name: string, x: number, y: number, width: number, height: number): ElementBase => ({
  id: id(kind, rng),
  name,
  kind,
  x,
  y,
  width,
  height,
  rotation: 0,
    opacity: 1,
    fill: black,
    stroke: black,
    strokeWidth: 1.5,
  cornerRadius: 0,
  visible: true,
  locked: false
});

function text(rng: Rng, name: string, value: string, x: number, y: number, width: number, height: number, fontSize = 14, weight = 700, role?: FontRole): TextElement {
  return {
    ...base(rng, "text", name, x, y, width, height),
    kind: "text",
    text: value,
    fontFamily: fontRoleFamilies[role ?? pick(rng, ["normal", "wide", "condensed"] as FontRole[])],
    fontSize,
    fontWeight: weight,
    letterSpacing: between(rng, 0.2, 1.4),
    lineHeight: between(rng, 0.95, 1.18),
    transform: "uppercase"
  };
}

function mono(rng: Rng, name: string, value: string, x: number, y: number, width: number, height: number, fontSize = 10, weight = 600): TextElement {
  return { ...text(rng, name, value, x, y, width, height, fontSize, weight, "mono"), fontFamily: fontRoleFamilies.mono };
}

function shape(rng: Rng, shapeKind: ShapeKind, name: string, x: number, y: number, width: number, height: number, fill = "none", strokeCol = white): GraphicElement {
  return {
    ...base(rng, "shape", name, x, y, width, height),
    kind: "shape",
    shape: shapeKind,
    fill,
    stroke: strokeCol,
    strokeWidth: pick(rng, [1, 1.25, 1.5, 2]),
    rows: int(rng, 2, 8),
    columns: int(rng, 2, 12),
    cornerRadius: 0
  };
}

function icon(rng: Rng, iconKind: IconKind, name: string, x: number, y: number, size: number, label?: string): GraphicElement {
  return {
    ...base(rng, "icon", name, x, y, size, size),
    kind: "icon",
    icon: iconKind,
    label,
    strokeWidth: pick(rng, [1, 1.25, 1.5, 2])
  };
}

function metadata(rng: Rng) {
  return {
    product: pick(rng, ["FIELD ADAPTER", "SIGNAL NODE", "SCAN MODULE", "AUDIO INDEX", "POWER INTERFACE", "VECTOR RELAY", "MONITOR BUS", "SYNC UNIT"]),
    model: `${pick(rng, ["MX", "AR", "LT", "PX", "TX", "KZ", "VX", "NR"])}-${code(rng, "##A#")}-${pick(rng, ["B", "R", "S", "Q", "X"])}`,
    serial: code(rng, "AA##-####-A##"),
    input: `${pick(rng, ["100-240V", "90-264VAC", "12-48VDC", "5-24VDC"])} ${pick(rng, ["50/60HZ", "DC"])} ${between(rng, 0.4, 7.8).toFixed(1)}A`,
    output: `${pick(rng, ["3.3V", "5V", "9V", "12V", "19V", "24V", "48V"])} === ${between(rng, 0.2, 9.5).toFixed(1)}A`,
    rev: `REV ${pick(rng, ["A", "B", "C", "D", "X"])}.${int(rng, 0, 9)}`,
    date: `${int(rng, 2014, 2028)}-${String(int(rng, 1, 12)).padStart(2, "0")}`,
    factory: `FCT-${code(rng, "A##")}.${code(rng, "##A")}`,
    approval: `APP ${code(rng, "AA-####-##")}`,
    catalog: `CAT/${code(rng, "###A")}/${code(rng, "AA##")}`,
    region: pick(rng, ["FICTIONAL DISTRICT 07", "NODE PREFECTURE", "FACTORY AREA K-18", "SAMPLE INDUSTRIAL ZONE", "LAB BLOCK 44"]),
    asian: pick(rng, ["技術資料 仮番号 工場検査済", "技术参数 样品标签 批号", "기술 사양 샘플 검사 완료", "標準外 規格票 試作"])
  };
}

function clampElementToCanvas(element: GraphicElement, canvas: CanvasSettings): GraphicElement {
  const width = Math.min(element.width, canvas.width);
  const height = Math.min(element.height, canvas.height);
  return {
    ...element,
    width,
    height,
    x: Math.max(0, Math.min(Math.max(0, canvas.width - width), element.x)),
    y: Math.max(0, Math.min(Math.max(0, canvas.height - height), element.y)),
    strokeWidth: normalizeStrokeWidth(element.strokeWidth)
  } as GraphicElement;
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = int(rng, 0, i);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function overlaps(a: Rect, b: Rect, gap: number) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function randomSlot(rng: Rng, canvas: CanvasSettings, width: number, height: number, occupied: Rect[], loose = false): Rect {
  const grid = canvas.gridSize || 8;
  const gap = loose ? 0 : pick(rng, [8, 8, 16, 24]);
  const maxX = Math.max(canvas.padding, canvas.width - canvas.padding - width);
  const maxY = Math.max(canvas.padding, canvas.height - canvas.padding - height);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const rect = {
      x: Math.round(between(rng, canvas.padding, maxX) / grid) * grid,
      y: Math.round(between(rng, canvas.padding, maxY) / grid) * grid,
      w: width,
      h: height
    };
    if (loose || occupied.every((other) => !overlaps(rect, other, gap))) {
      occupied.push(rect);
      return rect;
    }
  }
  const rect = {
    x: Math.round(between(rng, canvas.padding, maxX) / grid) * grid,
    y: Math.round(between(rng, canvas.padding, maxY) / grid) * grid,
    w: width,
    h: height
  };
  occupied.push(rect);
  return rect;
}

function paletteFor(seed: string, canvas: CanvasSettings) {
  const palette = { bg: white, fg: black, alt: black, muted: gray };
  canvas.background = palette.bg;
  canvas.exportBackground = palette.bg;
  return palette;
}

function componentLibrary(rng: Rng, canvas: CanvasSettings, seed: string, settings?: Partial<Project["generator"]>): { type: Array<() => GraphicElement>; nonType: Array<() => GraphicElement> } {
  const m = metadata(rng);
  const palette = paletteFor(seed, canvas);
  const occupied: Rect[] = [];
  const rotations = rotationOptions(settings?.allow45Rotation ?? true);
  const nonTypeStrokeWidth = normalizeStrokeWidth(settings?.nonTypeStrokeWidth ?? 1.5);
  const makeSlot = (w: number, h: number, loose = false) => randomSlot(rng, canvas, w, h, occupied, loose);
  const label = () => pick(rng, ["NX", "FC", "RU", "TC", "SA", "Q", "VX", "K"]);
  const glyphs = ["⏚", "⎓", "⏻", "⌁", "⌖", "⌬", "◆", "◇", "□", "▣", "▲", "△", "●", "○", "※", "№", "Ω", "µ", "±", "↯"];
  const textLines = [
    m.product,
    `MODEL ${m.model}`,
    `S/N ${m.serial}`,
    `INPUT ${m.input}`,
    `OUTPUT ${m.output}`,
    `${m.factory} ${m.rev}`,
    `${m.date} ${m.approval}`,
    `CAT ${m.catalog}`,
    m.region,
    m.asian,
    `TYPE ${code(rng, "AA-###")}`,
    `RATED CURRENT ${between(rng, 0.1, 12.5).toFixed(1)}A`,
    `TEMP RANGE -${int(rng, 10, 40)}C TO +${int(rng, 55, 105)}C`,
    `ENCLOSURE ${pick(rng, ["IP20", "IP40", "IP54", "IP65", "NEMA 1", "NEMA 4X"])}`,
    `MADE IN ${pick(rng, ["ZONE A", "PLANT K", "UNIT 07", "LAB NORTH", "WORKCELL 18"])}`,
    `QC ${code(rng, "##A-###")} VERIFIED`,
    `CAL ${int(rng, 2020, 2029)}.${String(int(rng, 1, 12)).padStart(2, "0")}`,
    `HW ID ${code(rng, "AA##-AA##")}`,
    `FW ${int(rng, 1, 9)}.${int(rng, 0, 9)}.${int(rng, 0, 9)}`,
    `TRACE ${code(rng, "A##A-####")}`,
    `BATCH ${code(rng, "##-AA-###")}`,
    `INSPECTOR ${code(rng, "A##")}`,
    "DO NOT OPEN WHILE ENERGIZED",
    "DISCONNECT SUPPLY BEFORE SERVICE",
    "FOR INDOOR USE ONLY",
    "DRY LOCATION DEVICE",
    `CLASS ${pick(rng, ["II", "III", "2", "B"])} EQUIPMENT`,
    `POLARITY ${pick(rng, ["CENTER POSITIVE", "CENTER NEGATIVE", "AUTO SENSE"])}`,
    `FUSE ${pick(rng, ["T1A", "T2A", "F500MA", "T3.15A"])} 250V`,
    `USB ${pick(rng, ["SERVICE", "DATA", "CONFIG", "DIAGNOSTIC"])}`,
    `CAN ${pick(rng, ["TERM ON", "TERM OFF", "BUS A", "BUS B"])}`,
    `WINDOW CODE DOT ${int(rng, 100, 999)} AS${int(rng, 1, 3)}`,
    `ECE E${int(rng, 1, 49)} ${code(rng, "##R-#####")}`,
    `SAFETY LABEL ${pick(rng, ["DANGER", "WARNING", "CAUTION", "NOTICE"])}`,
    `RECYCLE STREAM ${pick(rng, ["PAP 20", "PET 1", "HDPE 2", "WEEE"])}`,
    "KEEP DRY / THIS SIDE UP / FRAGILE",
    `MAX ALTITUDE ${pick(rng, ["2000M", "3000M", "5000M"])}`,
    `TORQUE ${between(rng, 0.2, 3.5).toFixed(1)} N M`,
    `TERMINAL ${pick(rng, ["L N PE", "+ - SIG", "A B GND", "NO NC COM"])}`,
    `SERIAL MATRIX ${code(rng, "####-####-####")}`,
    `REVISION BLOCK ${pick(rng, ["ALPHA", "BETA", "GAMMA", "DELTA"])}`,
    "SERVICE ACCESS RESTRICTED",
    "FICTIONAL VECTOR APPROVAL",
    "INSPECTION / SAMPLE / TRACE",
    `LOT ${code(rng, "###-AA##")}`,
    `${pick(rng, glyphs)} ${pick(rng, glyphs)} ${pick(rng, glyphs)} / GLYPH INDEX ${code(rng, "##A")}`,
    `⏚ ${m.model}  ⎓ ${m.output}  № ${code(rng, "####")}`
  ];
  const textQueue = shuffle(rng, textLines);

  const textFactory = (i: number) => () => {
    const w = pick(rng, [96, 128, 160, 208, 264, 336, 416]);
    const fs = pick(rng, [8, 9, 10, 12, 14, 18, 24, 30]);
    const h = Math.max(14, Math.ceil(fs * pick(rng, [1.2, 1.6, 2.2])));
    const slot = makeSlot(w, h);
    const value = textQueue[i % textQueue.length];
    const role = pick(rng, ["normal", "mono", "wide", "condensed"] as FontRole[]);
    const el = role === "mono" ? mono(rng, `Data / ${value.slice(0, 16)}`, value, slot.x, slot.y, w, h, fs, pick(rng, [500, 600, 700])) : text(rng, `Text / ${value.slice(0, 16)}`, value, slot.x, slot.y, w, h, fs, pick(rng, [600, 700, 800, 900]), role);
    el.fill = pick(rng, [palette.fg, palette.fg, palette.muted]);
    el.stroke = "none";
    el.strokeWidth = 0;
    return el;
  };

  const shapeFactory = (kind: ShapeKind) => () => {
    const w = pick(rng, [32, 48, 64, 96, 128, 176, 240]);
    const h = kind === "barcode" ? pick(rng, [36, 48, 72, 96]) : pick(rng, [16, 24, 32, 48, 64, 96, 144]);
    const slot = makeSlot(w, Math.max(1, h));
    const el = shape(rng, kind, `${kind} component`, slot.x, slot.y, w, Math.max(1, h), kind === "rect" || kind === "pill" || kind === "grid" ? "none" : palette.fg, pick(rng, [palette.fg, palette.fg, palette.muted]));
    el.strokeWidth = nonTypeStrokeWidth;
    el.rotation = pick(rng, rotations);
    return el;
  };

  const iconFactory = (kind: IconKind) => () => {
    const size = pick(rng, [20, 24, 28, 32, 40, 48, 56, 72, 88]);
    const slot = makeSlot(size, size);
    const el = icon(rng, kind, `${kind} mark`, slot.x, slot.y, size, kind === "cert" || kind === "stamp" || kind === "logo" ? label() : kind === "glyph" ? pick(rng, glyphs) : undefined);
    el.fill = palette.fg;
    el.stroke = pick(rng, [palette.fg, palette.fg, palette.muted]);
    el.strokeWidth = nonTypeStrokeWidth;
    el.rotation = pick(rng, rotations);
    return el;
  };

  const iconKinds: IconKind[] = [
    "warning",
    "lightning",
    "globe",
    "cert",
    "stamp",
    "polarity",
    "bin",
    "doubleSquare",
    "arrow",
    "dotMark",
    "logo",
    "crosshair",
    "chip",
    "waveform",
    "antenna",
    "terminal",
    "chevron",
    "bracket",
    "target",
    "caliper",
    "diode",
    "glyph",
    "circuitBlock",
    "waveBadge",
    "terminalStrip",
    "equipmentCluster",
    "safetyPanel",
    "handlingPanel",
    "vehicleDotMark",
    "certification_marks",
    "regulatory_marks",
    "safety_pictograms",
    "warning_decals",
    "automotive_glass_markings",
    "recycling_disposal_marks",
    "handling_shipping_symbols",
    "technical_instruction_icons",
    "ansi_safety_pictograms",
    "iso_7010_safety_signs",
    "ce_mark",
    "fcc_mark",
    "rohs_mark",
    "weee_mark",
    "ul_mark",
    "dot_as1_mark",
    "e_mark_symbols",
    ...isoPictogramKinds
  ];
  const shapeKinds: ShapeKind[] = ["rect", "grid", "barcode", "pill"];
  return {
    type: Array.from({ length: 28 }, (_, i) => textFactory(i)),
    nonType: [
      ...shapeKinds.flatMap((kind) => Array.from({ length: 5 }, () => shapeFactory(kind))),
      ...iconKinds.flatMap((kind) => Array.from({ length: 3 }, () => iconFactory(kind)))
    ]
  };
}

function randomComposition(seed: string, template: TemplateId, settings?: Partial<Project["generator"]>): { canvas: CanvasSettings; elements: GraphicElement[] } {
  const rng = createRng(seed);
  const sizes: Record<TemplateId, [number, number]> = {
    adapter: [768, 512],
    backplate: [1024, 512],
    certCluster: [512, 512],
    serial: [768, 256],
    catalog: [768, 512],
    warning: [768, 512],
    shipping: [1024, 512],
    manufacturer: [1536, 768]
  };
  const [width, height] = sizes[serialTemplate];
  const canvas = baseCanvas(width, height);
  const library = componentLibrary(rng, canvas, seed, settings);
  const defaultTypeMin = 10;
  const defaultTypeMax = 18;
  const defaultNonTypeMin = 18;
  const defaultNonTypeMax = 30;
  const typeMin = Math.max(0, Math.floor(settings?.typeMin ?? defaultTypeMin));
  const typeMax = Math.max(typeMin, Math.floor(settings?.typeMax ?? defaultTypeMax));
  const nonTypeMin = Math.max(0, Math.floor(settings?.nonTypeMin ?? defaultNonTypeMin));
  const nonTypeMax = Math.max(nonTypeMin, Math.floor(settings?.nonTypeMax ?? defaultNonTypeMax));
  const typeCount = Math.min(library.type.length, int(rng, typeMin, typeMax));
  const nonTypeCount = Math.min(library.nonType.length, int(rng, nonTypeMin, nonTypeMax));
  const selected = [
    ...shuffle(rng, library.type).slice(0, typeCount),
    ...shuffle(rng, library.nonType).slice(0, nonTypeCount)
  ].map((make) => clampElementToCanvas(make(), canvas));
  return { canvas, elements: selected };
}

export const templates: Record<TemplateId, { label: string; build: (seed: string, settings?: Partial<Project["generator"]>) => { canvas: CanvasSettings; elements: GraphicElement[] } }> = {
  adapter: { label: "AC adapter label", build: (seed, settings) => randomComposition(`${seed}:adapter`, "adapter", settings) },
  backplate: { label: "Electronics backplate", build: (seed, settings) => randomComposition(`${seed}:backplate`, "backplate", settings) },
  certCluster: { label: "Compliance cluster", build: (seed, settings) => randomComposition(`${seed}:cert`, "certCluster", settings) },
  serial: { label: "Serial sticker", build: (seed, settings) => randomComposition(`${seed}:serial`, "serial", settings) },
  catalog: { label: "Music/catalog micrographic", build: (seed, settings) => randomComposition(`${seed}:catalog`, "catalog", settings) },
  warning: { label: "Warning/rating plate", build: (seed, settings) => randomComposition(`${seed}:warning`, "warning", settings) },
  shipping: { label: "Shipping/product label", build: (seed, settings) => randomComposition(`${seed}:shipping`, "shipping", settings) },
  manufacturer: { label: "Dense manufacturer tag", build: (seed, settings) => randomComposition(`${seed}:manufacturer`, "manufacturer", settings) }
};

export function createProject(seed = "micro-001", template: TemplateId = serialTemplate): Project {
  const built = templates[serialTemplate].build(seed);
  return {
    version: 1,
    name: "Micrographics Label",
    palette: "blackWhite",
    customPalette: [black, white, black],
    canvas: built.canvas,
    elements: built.elements,
    selectedIds: built.elements[0] ? [built.elements[0].id] : [],
    humanize: {
      enabled: false,
      seed,
      jitterX: 1.2,
      jitterY: 1.2,
      rotation: 0.25,
      opacity: 0.08,
      fontSize: 0.4,
      baseline: 0.8,
      strokeWidth: 0.25
    },
    generator: {
      seed,
      template: serialTemplate,
      batchCount: 6,
      overlayCount: 4,
      overlayOffset: 18,
      overlayOpacity: 0.32,
      overlayColorVariation: 0,
      overlayRotation: 45,
      typeMin: 10,
      typeMax: 18,
      nonTypeMin: 18,
      nonTypeMax: 30,
      nonTypeStrokeWidth: 1.5,
      textHighlight: false,
      textHighlightColor: "#000000",
      allow45Rotation: true
    },
    fonts: {
      normal: null,
      mono: null,
      wide: null,
      condensed: null
    }
  };
}

export function regenerate(project: Project, seed: string, template = serialTemplate): Project {
  const settings = {
    typeMin: project.generator.typeMin,
    typeMax: project.generator.typeMax,
    nonTypeMin: project.generator.nonTypeMin,
    nonTypeMax: project.generator.nonTypeMax,
    nonTypeStrokeWidth: project.generator.nonTypeStrokeWidth,
    textHighlight: project.generator.textHighlight,
    textHighlightColor: project.generator.textHighlightColor,
    allow45Rotation: project.generator.allow45Rotation
  };
  const built = templates[serialTemplate].build(seed, settings);
  return {
    ...project,
    canvas: built.canvas,
    elements: built.elements,
    selectedIds: [],
    humanize: { ...project.humanize, enabled: false, seed },
    generator: { ...project.generator, ...settings, seed, template: serialTemplate }
  };
}

export function makeOverlay(project: Project): GraphicElement[] {
  const rng = createRng(`${project.generator.seed}-overlay`);
  const overlays: GraphicElement[] = [];
  for (let i = 0; i < project.generator.overlayCount; i += 1) {
    const seed = `${project.generator.seed}-${i}-${int(rng, 1, 9999)}`;
    const built = templates[serialTemplate].build(seed, project.generator);
    const dx = between(rng, -project.generator.overlayOffset, project.generator.overlayOffset);
    const dy = between(rng, -project.generator.overlayOffset, project.generator.overlayOffset);
    const rot = pick(rng, rotationOptions(project.generator.allow45Rotation));
    built.elements.forEach((el) => {
      overlays.push(clampElementToCanvas({
        ...el,
        id: id(`overlay-${i}`, rng),
        name: `Overlay ${i + 1} / ${el.name}`,
        x: el.x + dx,
        y: el.y + dy,
        rotation: el.rotation + rot,
        opacity: Math.min(el.opacity, project.generator.overlayOpacity),
        fill: el.fill === "none" ? "none" : black,
        stroke: el.stroke === "none" ? "none" : black,
        strokeWidth: normalizeStrokeWidth(el.strokeWidth)
      }, project.canvas));
    });
  }
  return overlays;
}
