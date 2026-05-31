import React from "react";
import { IconElement, IconKind } from "./types";

function signFrame(kind: IconKind, s: number, common: Record<string, unknown>) {
  if (kind.includes("_warning_")) {
    return <path d={`M${s / 2} ${s * 0.08} L${s * 0.92} ${s * 0.86} H${s * 0.08} Z`} {...common} />;
  }
  if (kind.includes("_no_")) {
    return <g><circle cx={s / 2} cy={s / 2} r={s * 0.4} {...common} /><line x1={s * 0.24} y1={s * 0.76} x2={s * 0.76} y2={s * 0.24} {...common} /></g>;
  }
  if (kind.includes("_wear_")) {
    return <circle cx={s / 2} cy={s / 2} r={s * 0.42} {...common} />;
  }
  return <rect x={s * 0.08} y={s * 0.08} width={s * 0.84} height={s * 0.84} {...common} />;
}

function pictogramBody(kind: IconKind, s: number, common: Record<string, unknown>, fill: string) {
  switch (kind) {
    case "iso_emergency_exit":
      return <g><path d={`M${s * 0.22} ${s * 0.3} H${s * 0.45} V${s * 0.7} H${s * 0.22} Z M${s * 0.46} ${s * 0.5} H${s * 0.82} M${s * 0.7} ${s * 0.38} L${s * 0.84} ${s * 0.5} L${s * 0.7} ${s * 0.62}`} {...common} /><circle cx={s * 0.56} cy={s * 0.35} r={s * 0.045} fill={fill} /></g>;
    case "iso_first_aid":
      return <path d={`M${s * 0.44} ${s * 0.24} H${s * 0.56} V${s * 0.44} H${s * 0.76} V${s * 0.56} H${s * 0.56} V${s * 0.76} H${s * 0.44} V${s * 0.56} H${s * 0.24} V${s * 0.44} H${s * 0.44} Z`} fill={fill} />;
    case "iso_eyewash":
      return <g><path d={`M${s * 0.2} ${s * 0.46} C${s * 0.34} ${s * 0.28} ${s * 0.66} ${s * 0.28} ${s * 0.8} ${s * 0.46} C${s * 0.66} ${s * 0.64} ${s * 0.34} ${s * 0.64} ${s * 0.2} ${s * 0.46} Z`} {...common} /><circle cx={s * 0.5} cy={s * 0.46} r={s * 0.08} {...common} /><path d={`M${s * 0.32} ${s * 0.72} C${s * 0.42} ${s * 0.62} ${s * 0.58} ${s * 0.62} ${s * 0.68} ${s * 0.72}`} {...common} /></g>;
    case "iso_safety_shower":
      return <g><path d={`M${s * 0.3} ${s * 0.3} H${s * 0.7} M${s * 0.36} ${s * 0.3} C${s * 0.4} ${s * 0.2} ${s * 0.6} ${s * 0.2} ${s * 0.64} ${s * 0.3} M${s * 0.5} ${s * 0.3} V${s * 0.68}`} {...common} />{[0.34, 0.43, 0.52, 0.61, 0.7].map((x) => <line key={x} x1={s * x} y1={s * 0.42} x2={s * (x - 0.04)} y2={s * 0.58} {...common} />)}</g>;
    case "iso_assembly_point":
      return <g><circle cx={s * 0.34} cy={s * 0.38} r={s * 0.05} fill={fill} /><circle cx={s * 0.66} cy={s * 0.38} r={s * 0.05} fill={fill} /><circle cx={s * 0.5} cy={s * 0.56} r={s * 0.05} fill={fill} /><path d={`M${s * 0.22} ${s * 0.72} L${s * 0.42} ${s * 0.58} M${s * 0.78} ${s * 0.72} L${s * 0.58} ${s * 0.58} M${s * 0.5} ${s * 0.2} V${s * 0.48}`} {...common} /></g>;
    case "iso_fire_extinguisher":
      return <g><rect x={s * 0.38} y={s * 0.36} width={s * 0.22} height={s * 0.38} rx={s * 0.04} {...common} /><path d={`M${s * 0.43} ${s * 0.36} V${s * 0.25} H${s * 0.58} M${s * 0.58} ${s * 0.28} H${s * 0.74} M${s * 0.6} ${s * 0.42} C${s * 0.76} ${s * 0.48} ${s * 0.74} ${s * 0.66} ${s * 0.62} ${s * 0.7}`} {...common} /></g>;
    case "iso_fire_alarm":
      return <g><circle cx={s * 0.5} cy={s * 0.5} r={s * 0.2} {...common} /><path d={`M${s * 0.5} ${s * 0.26} V${s * 0.5} L${s * 0.64} ${s * 0.62} M${s * 0.24} ${s * 0.24} L${s * 0.36} ${s * 0.36} M${s * 0.76} ${s * 0.24} L${s * 0.64} ${s * 0.36}`} {...common} /></g>;
    case "iso_no_smoking":
      return <path d={`M${s * 0.25} ${s * 0.58} H${s * 0.58} V${s * 0.66} H${s * 0.25} Z M${s * 0.62} ${s * 0.58} H${s * 0.74} M${s * 0.64} ${s * 0.48} C${s * 0.72} ${s * 0.42} ${s * 0.62} ${s * 0.34} ${s * 0.7} ${s * 0.28}`} {...common} />;
    case "iso_no_entry":
      return <line x1={s * 0.26} y1={s * 0.5} x2={s * 0.74} y2={s * 0.5} {...common} />;
    case "iso_no_mobile":
      return <rect x={s * 0.38} y={s * 0.24} width={s * 0.24} height={s * 0.48} rx={s * 0.04} {...common} />;
    case "iso_wear_eye_protection":
      return <path d={`M${s * 0.22} ${s * 0.5} C${s * 0.34} ${s * 0.36} ${s * 0.44} ${s * 0.36} ${s * 0.5} ${s * 0.5} C${s * 0.56} ${s * 0.36} ${s * 0.66} ${s * 0.36} ${s * 0.78} ${s * 0.5} C${s * 0.68} ${s * 0.64} ${s * 0.56} ${s * 0.64} ${s * 0.5} ${s * 0.52} C${s * 0.44} ${s * 0.64} ${s * 0.32} ${s * 0.64} ${s * 0.22} ${s * 0.5} Z`} {...common} />;
    case "iso_wear_ear_protection":
      return <path d={`M${s * 0.3} ${s * 0.58} V${s * 0.48} C${s * 0.3} ${s * 0.28} ${s * 0.7} ${s * 0.28} ${s * 0.7} ${s * 0.48} V${s * 0.58} M${s * 0.3} ${s * 0.58} H${s * 0.42} V${s * 0.74} H${s * 0.3} Z M${s * 0.58} ${s * 0.58} H${s * 0.7} V${s * 0.74} H${s * 0.58} Z`} {...common} />;
    case "iso_wear_gloves":
      return <path d={`M${s * 0.26} ${s * 0.68} C${s * 0.32} ${s * 0.42} ${s * 0.34} ${s * 0.28} ${s * 0.38} ${s * 0.28} C${s * 0.42} ${s * 0.28} ${s * 0.4} ${s * 0.48} ${s * 0.44} ${s * 0.48} C${s * 0.48} ${s * 0.48} ${s * 0.46} ${s * 0.26} ${s * 0.5} ${s * 0.26} C${s * 0.54} ${s * 0.26} ${s * 0.52} ${s * 0.48} ${s * 0.56} ${s * 0.48} C${s * 0.62} ${s * 0.48} ${s * 0.64} ${s * 0.58} ${s * 0.58} ${s * 0.76} H${s * 0.34} C${s * 0.3} ${s * 0.74} ${s * 0.28} ${s * 0.72} ${s * 0.26} ${s * 0.68} Z`} {...common} />;
    case "iso_wear_respirator":
      return <path d={`M${s * 0.34} ${s * 0.45} C${s * 0.4} ${s * 0.34} ${s * 0.6} ${s * 0.34} ${s * 0.66} ${s * 0.45} V${s * 0.64} C${s * 0.58} ${s * 0.76} ${s * 0.42} ${s * 0.76} ${s * 0.34} ${s * 0.64} Z M${s * 0.3} ${s * 0.55} H${s * 0.18} M${s * 0.7} ${s * 0.55} H${s * 0.82}`} {...common} />;
    case "iso_wear_hard_hat":
      return <path d={`M${s * 0.25} ${s * 0.58} C${s * 0.28} ${s * 0.34} ${s * 0.72} ${s * 0.34} ${s * 0.75} ${s * 0.58} Z M${s * 0.2} ${s * 0.62} H${s * 0.8}`} {...common} />;
    case "iso_warning_flammable":
      return <path d={`M${s * 0.5} ${s * 0.74} C${s * 0.28} ${s * 0.58} ${s * 0.46} ${s * 0.42} ${s * 0.44} ${s * 0.24} C${s * 0.62} ${s * 0.38} ${s * 0.72} ${s * 0.5} ${s * 0.5} ${s * 0.74} Z`} {...common} />;
    case "iso_warning_corrosive":
      return <g><path d={`M${s * 0.28} ${s * 0.34} H${s * 0.48} M${s * 0.52} ${s * 0.28} H${s * 0.72} M${s * 0.34} ${s * 0.34} L${s * 0.26} ${s * 0.54} M${s * 0.6} ${s * 0.32} L${s * 0.74} ${s * 0.5} M${s * 0.24} ${s * 0.66} H${s * 0.5} M${s * 0.58} ${s * 0.68} H${s * 0.78}`} {...common} /></g>;
    case "iso_warning_electricity":
      return <path d={`M${s * 0.56} ${s * 0.24} L${s * 0.34} ${s * 0.54} H${s * 0.5} L${s * 0.42} ${s * 0.78} L${s * 0.68} ${s * 0.46} H${s * 0.52} Z`} fill={fill} />;
    case "iso_warning_laser":
      return <g><circle cx={s * 0.5} cy={s * 0.5} r={s * 0.06} fill={fill} />{[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => <line key={deg} x1={s * 0.5} y1={s * 0.5} x2={s * (0.5 + 0.28 * Math.cos((deg * Math.PI) / 180))} y2={s * (0.5 + 0.28 * Math.sin((deg * Math.PI) / 180))} {...common} />)}</g>;
    case "iso_warning_biohazard":
      return <g><circle cx={s * 0.5} cy={s * 0.42} r={s * 0.1} {...common} /><circle cx={s * 0.38} cy={s * 0.62} r={s * 0.1} {...common} /><circle cx={s * 0.62} cy={s * 0.62} r={s * 0.1} {...common} /><circle cx={s * 0.5} cy={s * 0.54} r={s * 0.04} fill={fill} /></g>;
    case "iso_warning_radiation":
      return <g><circle cx={s * 0.5} cy={s * 0.52} r={s * 0.04} fill={fill} /><path d={`M${s * 0.5} ${s * 0.48} L${s * 0.43} ${s * 0.3} A${s * 0.22} ${s * 0.22} 0 0 1 ${s * 0.57} ${s * 0.3} Z M${s * 0.46} ${s * 0.55} L${s * 0.25} ${s * 0.6} A${s * 0.22} ${s * 0.22} 0 0 1 ${s * 0.32} ${s * 0.72} Z M${s * 0.54} ${s * 0.55} L${s * 0.68} ${s * 0.72} A${s * 0.22} ${s * 0.22} 0 0 1 ${s * 0.75} ${s * 0.6} Z`} fill={fill} /></g>;
    case "iso_warning_forklift":
      return <g><rect x={s * 0.28} y={s * 0.54} width={s * 0.28} height={s * 0.12} {...common} /><circle cx={s * 0.34} cy={s * 0.7} r={s * 0.05} {...common} /><circle cx={s * 0.54} cy={s * 0.7} r={s * 0.05} {...common} /><path d={`M${s * 0.58} ${s * 0.34} V${s * 0.7} H${s * 0.78} M${s * 0.58} ${s * 0.42} H${s * 0.72}`} {...common} /></g>;
    case "iso_warning_hot_surface":
      return <g><path d={`M${s * 0.28} ${s * 0.66} H${s * 0.78}`} {...common} />{[0.34, 0.5, 0.66].map((x) => <path key={x} d={`M${s * x} ${s * 0.54} C${s * (x - 0.06)} ${s * 0.44} ${s * (x + 0.06)} ${s * 0.38} ${s * x} ${s * 0.28}`} {...common} />)}</g>;
    case "iso_warning_slippery_floor":
      return <g><path d={`M${s * 0.24} ${s * 0.7} H${s * 0.76} M${s * 0.35} ${s * 0.5} L${s * 0.5} ${s * 0.6} L${s * 0.65} ${s * 0.38} M${s * 0.42} ${s * 0.36} L${s * 0.28} ${s * 0.28}`} {...common} /><circle cx={s * 0.38} cy={s * 0.28} r={s * 0.045} fill={fill} /></g>;
    case "iso_warning_overhead_load":
      return <g><path d={`M${s * 0.28} ${s * 0.28} H${s * 0.72} M${s * 0.5} ${s * 0.28} V${s * 0.5} M${s * 0.38} ${s * 0.5} H${s * 0.62} V${s * 0.66} H${s * 0.38} Z M${s * 0.3} ${s * 0.74} H${s * 0.7}`} {...common} /></g>;
    case "iso_warning_magnetic_field":
      return <path d={`M${s * 0.32} ${s * 0.34} V${s * 0.58} C${s * 0.32} ${s * 0.78} ${s * 0.68} ${s * 0.78} ${s * 0.68} ${s * 0.58} V${s * 0.34} H${s * 0.56} V${s * 0.58} C${s * 0.56} ${s * 0.64} ${s * 0.44} ${s * 0.64} ${s * 0.44} ${s * 0.58} V${s * 0.34} Z`} {...common} />;
    default:
      return null;
  }
}

export function renderIsoPictogram(el: IconElement, strokeWidth: number) {
  if (!el.icon.startsWith("iso_")) return null;
  const s = Math.min(el.width, el.height);
  const common = { fill: "none", stroke: el.stroke, strokeWidth, strokeLinecap: "butt" as const, strokeLinejoin: "miter" as const };
  return (
    <g>
      {signFrame(el.icon, s, common)}
      {pictogramBody(el.icon, s, common, el.fill)}
    </g>
  );
}
