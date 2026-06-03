import { CanvasSettings, CustomSvgAsset, CustomSvgElement, ElementBase, FontRole, GraphicElement, IconKind, Project, ShapeKind, TemplateId, TextElement, fontRoleFamilies, isoPictogramKinds } from "./types";
import { Rng, between, code, createRng, int, pick } from "./random";

const white = "#ffffff";
const black = "#111111";
const red = black;
const gray = black;
const serialTemplate: TemplateId = "serial";
const allFontRoles: FontRole[] = ["normal", "mono", "wide", "condensed"];
const geistGlyphs = ["!","\"","#","$","%","&","'","(",")","*","+",",","-",".","/",":",";","<","=",">","?","@","[","\\","]","^","_","`","{","|","}","~","¡","¢","£","¤","¥","¦","§","¨","©","«","¬","®","¯","°","±","´","¶","·","¸","»","¿","×","÷","˘","˙","˚","˛","˜","˝","̀","́","̂","̃","̄","̆","̇","̈","̉","̊","̋","̌","̒","̛","̣","̦","̧","̨","̵","̶","̷","̸","฿","–","—","‘","’","‚","“","”","„","†","‡","•","…","‰","′","″","‹","›","⁄","₪","€","₱","₴","₹","₽","№","℗","™","←","↑","→","↓","↔","↕","↖","↗","↘","↙","↝","↩","↪","↰","↱","↳","↴","↵","⇤","⇥","⇧","∂","∆","∏","∑","−","√","∞","∫","∶","≈","≠","≤","≥","⌦","⌧","⌫","⏎","␋","␌","␣","─","━","│","┃","┄","┅","┆","┇","┈","┉","┊","┋","┌","┍","┎","┏","┐","┑","┒","┓","└","┕","┖","┗","┘","┙","┚","┛","├","┝","┞","┟","┠","┡","┢","┣","┤","┥","┦","┧","┨","┩","┪","┫","┬","┭","┮","┯","┰","┱","┲","┳","┴","┵","┶","┷","┸","┹","┺","┻","┼","┽","┾","┿","╀","╁","╂","╃","╄","╅","╆","╇","╈","╉","╊","╋","╌","╍","╎","╏","═","║","╒","╓","╔","╕","╖","╗","╘","╙","╚","╛","╜","╝","╞","╟","╠","╡","╢","╣","╤","╥","╦","╧","╨","╩","╪","╫","╬","╭","╮","╯","╰","╱","╲","╳","╴","╵","╶","╷","╸","╹","╺","╻","╼","╽","╾","╿","▀","▁","▂","▃","▄","▅","▆","▇","█","▉","▊","▋","▌","▍","▎","▏","▐","░","▒","▓","▔","▕","▖","▗","▘","▙","▚","▛","▜","▝","▞","▟","▲","△","▶","▷","▼","▽","◀","◁","◊","○","◌","●","☹","☺","〃","〜",""];

function normalizeStrokeWidth(strokeWidth: number): number {
  return strokeWidth > 0 ? Math.max(1, Math.min(5, strokeWidth)) : 0;
}

function enabledFontRoles(settings?: Partial<Project["generator"]>): FontRole[] {
  const roles = settings?.enabledFonts?.filter((role): role is FontRole => allFontRoles.includes(role)) ?? allFontRoles;
  return roles.length ? roles : allFontRoles;
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

function customSvg(rng: Rng, name: string, svgId: string, content: string, viewBox: string, x: number, y: number, width: number, height: number, strokeWidth: number): CustomSvgElement {
  return {
    ...base(rng, "svg", name, x, y, width, height),
    kind: "svg",
    svgId,
    content,
    viewBox,
    fill: "none",
    stroke: black,
    strokeWidth
  };
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

function transformedTextValue(element: TextElement) {
  if (element.transform === "uppercase") return element.text.toUpperCase();
  if (element.transform === "lowercase") return element.text.toLowerCase();
  return element.text;
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
    return { x: element.x, y: element.y, w: element.width, h: element.height };
  }
  const lines = transformedTextValue(element).split("\n");
  const w = Math.max(element.width, ...lines.map((line) => estimateTextLineWidth(line, element)));
  const h = Math.max(element.height, lines.length * element.fontSize * element.lineHeight);
  return { x: element.x, y: element.y, w, h };
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
    { x: baseRect.x + baseRect.w, y: baseRect.y },
    { x: baseRect.x + baseRect.w, y: baseRect.y + baseRect.h },
    { x: baseRect.x, y: baseRect.y + baseRect.h }
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
    w: Math.max(...xs) - left,
    h: Math.max(...ys) - top
  };
}

function rotatedSlotSize(width: number, height: number, rotation: number) {
  const rotationValue = ((rotation % 360) + 360) % 360;
  if (rotationValue === 0 || rotationValue === 180) {
    return { width, height, offsetX: 0, offsetY: 0 };
  }
  const radians = rotationValue * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const rotatedWidth = width * cos + height * sin;
  const rotatedHeight = width * sin + height * cos;
  return {
    width: rotatedWidth,
    height: rotatedHeight,
    offsetX: (rotatedWidth - width) / 2,
    offsetY: (rotatedHeight - height) / 2
  };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function randomSlot(rng: Rng, canvas: CanvasSettings, width: number, height: number, occupied: Rect[], loose = false, strict = false): Rect | null {
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
  if (strict) return null;
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

function componentLibrary(rng: Rng, canvas: CanvasSettings, seed: string, settings?: Partial<Project["generator"]>, occupied: Rect[] = []): { type: Array<() => GraphicElement | null>; nonType: Array<() => GraphicElement | null> } {
  const m = metadata(rng);
  const palette = paletteFor(seed, canvas);
  const rotations = rotationOptions(settings?.allow45Rotation ?? true);
  const nonTypeStrokeWidth = normalizeStrokeWidth(settings?.nonTypeStrokeWidth ?? 1.5);
  const preventOverlap = settings?.preventOverlap ?? false;
  const fontChoices = enabledFontRoles(settings);
  const makeSlot = (w: number, h: number, loose = false) => randomSlot(rng, canvas, w, h, occupied, loose, preventOverlap);
  const label = () => pick(rng, ["NX", "FC", "RU", "TC", "SA", "Q", "VX", "K"]);
  const glyphs = Array.from(new Set(["⏚", "⎓", "⏻", "⌁", "⌖", "⌬", "◆", "◇", "□", "▣", "▲", "△", "●", "○", "※", "№", "Ω", "µ", "±", "↯", ...geistGlyphs]));
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
    const value = textQueue[i % textQueue.length];
    const role = pick(rng, fontChoices);
    const el = role === "mono" ? mono(rng, `Data / ${value.slice(0, 16)}`, value, 0, 0, w, h, fs, pick(rng, [500, 600, 700])) : text(rng, `Text / ${value.slice(0, 16)}`, value, 0, 0, w, h, fs, pick(rng, [600, 700, 800, 900]), role);
    el.fill = pick(rng, [palette.fg, palette.fg, palette.muted]);
    el.stroke = "none";
    el.strokeWidth = 0;
    const bounds = preventOverlap ? elementRect(el) : { w, h };
    const slot = makeSlot(bounds.w, bounds.h);
    if (!slot) return null;
    el.x = slot.x;
    el.y = slot.y;
    return el;
  };

  const shapeFactory = (kind: ShapeKind) => () => {
    const w = pick(rng, [32, 48, 64, 96, 128, 176, 240]);
    const h = kind === "barcode" ? pick(rng, [36, 48, 72, 96]) : pick(rng, [16, 24, 32, 48, 64, 96, 144]);
    const rotation = pick(rng, rotations);
    const slotSize = preventOverlap ? rotatedSlotSize(w, Math.max(1, h), rotation) : { width: w, height: Math.max(1, h), offsetX: 0, offsetY: 0 };
    const slot = makeSlot(slotSize.width, slotSize.height);
    if (!slot) return null;
    const el = shape(rng, kind, `${kind} component`, slot.x + slotSize.offsetX, slot.y + slotSize.offsetY, w, Math.max(1, h), kind === "rect" || kind === "pill" || kind === "grid" ? "none" : palette.fg, pick(rng, [palette.fg, palette.fg, palette.muted]));
    el.strokeWidth = nonTypeStrokeWidth;
    el.rotation = rotation;
    return el;
  };

  const iconFactory = (kind: IconKind) => () => {
    const size = pick(rng, [20, 24, 28, 32, 40, 48, 56, 72, 88]);
    const rotation = pick(rng, rotations);
    const slotSize = preventOverlap ? rotatedSlotSize(size, size, rotation) : { width: size, height: size, offsetX: 0, offsetY: 0 };
    const slot = makeSlot(slotSize.width, slotSize.height);
    if (!slot) return null;
    const el = icon(rng, kind, `${kind} mark`, slot.x + slotSize.offsetX, slot.y + slotSize.offsetY, size, kind === "cert" || kind === "stamp" || kind === "logo" ? label() : kind === "glyph" ? pick(rng, glyphs) : undefined);
    el.fill = palette.fg;
    el.stroke = pick(rng, [palette.fg, palette.fg, palette.muted]);
    el.strokeWidth = nonTypeStrokeWidth;
    el.rotation = rotation;
    return el;
  };

  const glyphFactory = (glyph: string) => () => {
    const size = pick(rng, [14, 16, 18, 20, 24, 28, 32, 40, 48, 56]);
    const rotation = pick(rng, rotations);
    const slotSize = preventOverlap ? rotatedSlotSize(size, size, rotation) : { width: size, height: size, offsetX: 0, offsetY: 0 };
    const slot = makeSlot(slotSize.width, slotSize.height);
    if (!slot) return null;
    const el = icon(rng, "glyph", `Geist glyph / ${glyph}`, slot.x + slotSize.offsetX, slot.y + slotSize.offsetY, size, glyph);
    el.fill = palette.fg;
    el.stroke = "none";
    el.strokeWidth = 0;
    el.rotation = rotation;
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
      ...iconKinds.flatMap((kind) => Array.from({ length: 3 }, () => iconFactory(kind))),
      ...geistGlyphs.map((glyph) => glyphFactory(glyph))
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
  ].map((make) => make()).filter((element): element is GraphicElement => Boolean(element)).map((element) => clampElementToCanvas(element, canvas));
  return { canvas, elements: selected };
}

function mixedComposition(seed: string, project: Project): { canvas: CanvasSettings; elements: GraphicElement[] } {
  const rng = createRng(seed);
  const canvas = baseCanvas(768, 256);
  const occupied: Rect[] = [];
  const rotations = rotationOptions(project.generator.allow45Rotation);
  const preventOverlap = project.generator.preventOverlap ?? false;
  const makeSlot = (w: number, h: number, loose = false) => randomSlot(rng, canvas, w, h, occupied, loose, preventOverlap);
  const textItems = project.customLibrary?.texts.filter((item) => item.trim()) ?? [];
  const svgItems = project.customLibrary?.svgs ?? [];
  const useCustomText = project.customLibrary?.useCustomText ?? project.customLibrary?.enabled ?? false;
  const useCustomSvg = project.customLibrary?.useCustomSvg ?? project.customLibrary?.enabled ?? false;
  const fontChoices = enabledFontRoles(project.generator);
  const builtIn = componentLibrary(rng, canvas, seed, project.generator, occupied);

  const customTextFactory = (value: string) => () => {
    const fontSize = pick(rng, [10, 12, 14, 18, 24, 30]);
    const width = Math.max(72, Math.min(480, estimateTextLineWidth(value, {
      ...text(rng, "measure", value, 0, 0, 1, 1, fontSize, 800, "normal"),
      text: value
    }) + 12));
    const height = Math.max(18, Math.ceil(fontSize * 1.4));
    const element = text(rng, `Custom text / ${value.slice(0, 24)}`, value, 0, 0, width, height, fontSize, pick(rng, [600, 700, 800, 900]), pick(rng, fontChoices));
    element.fill = black;
    element.stroke = "none";
    element.strokeWidth = 0;
    const rotation = pick(rng, rotations);
    element.rotation = rotation;
    const slotSize = preventOverlap ? rotatedSlotSize(width, height, rotation) : { width, height, offsetX: 0, offsetY: 0 };
    const slot = makeSlot(slotSize.width, slotSize.height);
    if (!slot) return null;
    element.x = slot.x + slotSize.offsetX;
    element.y = slot.y + slotSize.offsetY;
    return clampElementToCanvas(element, canvas);
  };

  const customSvgFactory = (asset: CustomSvgAsset) => () => {
    const width = pick(rng, [32, 40, 48, 56, 72, 88, 112, 144]);
    const height = Math.max(16, Math.round(width / Math.max(0.1, asset.aspectRatio || 1)));
    const rotation = pick(rng, rotations);
    const slotSize = preventOverlap ? rotatedSlotSize(width, height, rotation) : { width, height, offsetX: 0, offsetY: 0 };
    const slot = makeSlot(slotSize.width, slotSize.height);
    if (!slot) return null;
    const element = customSvg(rng, `Custom SVG / ${asset.name}`, asset.id, asset.content, asset.viewBox, slot.x + slotSize.offsetX, slot.y + slotSize.offsetY, width, height, normalizeStrokeWidth(project.generator.nonTypeStrokeWidth ?? 1.5));
    element.rotation = rotation;
    return clampElementToCanvas(element, canvas);
  };

  const typeLibrary = useCustomText ? textItems.map(customTextFactory) : builtIn.type;
  const nonTypeLibrary = useCustomSvg ? svgItems.map(customSvgFactory) : builtIn.nonType;
  const defaultTypeMin = useCustomText ? Math.min(1, typeLibrary.length) : 10;
  const defaultTypeMax = useCustomText ? typeLibrary.length : 18;
  const defaultNonTypeMin = useCustomSvg ? Math.min(1, nonTypeLibrary.length) : 18;
  const defaultNonTypeMax = useCustomSvg ? nonTypeLibrary.length : 30;
  const typeMin = Math.min(typeLibrary.length, Math.max(0, Math.floor(project.generator.typeMin ?? defaultTypeMin)));
  const typeMax = Math.min(typeLibrary.length, Math.max(typeMin, Math.floor(project.generator.typeMax ?? defaultTypeMax)));
  const nonTypeMin = Math.min(nonTypeLibrary.length, Math.max(0, Math.floor(project.generator.nonTypeMin ?? defaultNonTypeMin)));
  const nonTypeMax = Math.min(nonTypeLibrary.length, Math.max(nonTypeMin, Math.floor(project.generator.nonTypeMax ?? defaultNonTypeMax)));
  const typeCount = typeLibrary.length ? int(rng, typeMin, typeMax) : 0;
  const nonTypeCount = nonTypeLibrary.length ? int(rng, nonTypeMin, nonTypeMax) : 0;
  const elements = [
    ...shuffle(rng, typeLibrary).slice(0, typeCount),
    ...shuffle(rng, nonTypeLibrary).slice(0, nonTypeCount)
  ].map((make) => make()).filter((element): element is GraphicElement => Boolean(element));

  return { canvas, elements };
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
      typeMin: 10,
      typeMax: 18,
      nonTypeMin: 18,
      nonTypeMax: 30,
      nonTypeStrokeWidth: 1.5,
      enabledFonts: allFontRoles,
      textHighlight: false,
      textHighlightColor: "#000000",
      allow45Rotation: true,
      preventOverlap: false
    },
    customLibrary: {
      useCustomText: false,
      useCustomSvg: false,
      texts: [],
      svgs: []
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
  const useCustomSources = Boolean(project.customLibrary?.useCustomText || project.customLibrary?.useCustomSvg || project.customLibrary?.enabled);
  if (useCustomSources) {
    const built = mixedComposition(seed, project);
    return {
      ...project,
      canvas: built.canvas,
      elements: built.elements,
      selectedIds: [],
      humanize: { ...project.humanize, enabled: false, seed },
      generator: { ...project.generator, seed, template: serialTemplate }
    };
  }

  const settings = {
    typeMin: project.generator.typeMin,
    typeMax: project.generator.typeMax,
    nonTypeMin: project.generator.nonTypeMin,
    nonTypeMax: project.generator.nonTypeMax,
    nonTypeStrokeWidth: project.generator.nonTypeStrokeWidth,
    enabledFonts: enabledFontRoles(project.generator),
    textHighlight: project.generator.textHighlight,
    textHighlightColor: project.generator.textHighlightColor,
    allow45Rotation: project.generator.allow45Rotation,
    preventOverlap: project.generator.preventOverlap ?? false
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
