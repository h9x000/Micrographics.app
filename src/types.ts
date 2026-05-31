export type ElementKind = "text" | "shape" | "icon" | "group";
export type ShapeKind = "rect" | "line" | "grid" | "barcode" | "circle" | "pill";
export type IconKind =
  | "warning"
  | "lightning"
  | "globe"
  | "cert"
  | "stamp"
  | "polarity"
  | "bin"
  | "doubleSquare"
  | "arrow"
  | "dotMark"
  | "logo"
  | "crosshair"
  | "chip"
  | "waveform"
  | "antenna"
  | "terminal"
  | "chevron"
  | "bracket"
  | "target"
  | "caliper"
  | "diode"
  | "glyph"
  | "circuitBlock"
  | "waveBadge"
  | "terminalStrip"
  | "equipmentCluster"
  | "safetyPanel"
  | "handlingPanel"
  | "vehicleDotMark"
  | "certification_marks"
  | "regulatory_marks"
  | "safety_pictograms"
  | "warning_decals"
  | "automotive_glass_markings"
  | "recycling_disposal_marks"
  | "handling_shipping_symbols"
  | "technical_instruction_icons"
  | "ansi_safety_pictograms"
  | "iso_7010_safety_signs"
  | "ce_mark"
  | "fcc_mark"
  | "rohs_mark"
  | "weee_mark"
  | "ul_mark"
  | "dot_as1_mark"
  | "e_mark_symbols";
export type TextTransform = "normal" | "uppercase" | "lowercase";
export type PaletteName = "whiteBlack" | "blackWhite" | "redBlack" | "grayscale" | "custom";
export type FontRole = "normal" | "mono" | "wide" | "condensed";

export interface UploadedFont {
  name: string;
  dataUrl: string;
  family?: string;
  fullName?: string;
  postScriptName?: string;
}

export interface CanvasSettings {
  width: number;
  height: number;
  padding: number;
  background: string;
  exportBackground: string;
  previewBackground: "black" | "white" | "checker" | "custom";
  previewCustom: string;
  roundedBackground: boolean;
  frame: boolean;
  gridVisible: boolean;
  snapToGrid: boolean;
  gridSize: number;
  cleanVector: boolean;
}

export interface ElementBase {
  id: string;
  name: string;
  kind: ElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  visible: boolean;
  locked: boolean;
}

export interface TextElement extends ElementBase {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  transform: TextTransform;
}

export interface ShapeElement extends ElementBase {
  kind: "shape";
  shape: ShapeKind;
  rows?: number;
  columns?: number;
}

export interface IconElement extends ElementBase {
  kind: "icon";
  icon: IconKind;
  label?: string;
}

export interface GroupElement extends ElementBase {
  kind: "group";
  children: string[];
}

export type GraphicElement = TextElement | ShapeElement | IconElement | GroupElement;

export interface HumanizeSettings {
  enabled: boolean;
  seed: string;
  jitterX: number;
  jitterY: number;
  rotation: number;
  opacity: number;
  fontSize: number;
  baseline: number;
  strokeWidth: number;
}

export interface GeneratorSettings {
  seed: string;
  template: TemplateId;
  batchCount: number;
  overlayCount: number;
  overlayOffset: number;
  overlayOpacity: number;
  overlayColorVariation: number;
  overlayRotation: number;
  typeMin: number;
  typeMax: number;
  nonTypeMin: number;
  nonTypeMax: number;
  textHighlight: boolean;
  textHighlightColor: string;
  allow45Rotation: boolean;
}

export type TemplateId =
  | "adapter"
  | "backplate"
  | "certCluster"
  | "serial"
  | "catalog"
  | "warning"
  | "shipping"
  | "manufacturer";

export interface Project {
  version: 1;
  name: string;
  palette: PaletteName;
  customPalette: string[];
  canvas: CanvasSettings;
  elements: GraphicElement[];
  selectedIds: string[];
  humanize: HumanizeSettings;
  generator: GeneratorSettings;
  fonts: Record<FontRole, UploadedFont | null>;
}

export const fontRoleFamilies: Record<FontRole, string> = {
  normal: "\"MicroFontNormal\", Arial, sans-serif",
  mono: "\"MicroFontMono\", \"Courier New\", monospace",
  wide: "\"MicroFontWide\", \"Arial Black\", Arial, sans-serif",
  condensed: "\"MicroFontCondensed\", \"Arial Narrow\", Arial, sans-serif"
};

export const fontRoleInternalFamilies: Record<FontRole, string> = {
  normal: "MicroFontNormal",
  mono: "MicroFontMono",
  wide: "MicroFontWide",
  condensed: "MicroFontCondensed"
};

export const fontStacks = {
  "Sans condensed": "\"Arial Narrow\", \"Roboto Condensed\", Arial, sans-serif",
  Monospace: "\"IBM Plex Mono\", \"Roboto Mono\", \"Courier New\", monospace",
  "OCR technical": "\"OCR A Std\", \"OCR A\", \"Lucida Console\", monospace",
  "Bold industrial": "Impact, \"Arial Black\", \"DIN Condensed\", sans-serif",
  "Serif label": "Georgia, \"Times New Roman\", serif"
} as const;
