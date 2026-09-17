/* ═══════════════════════════════════════════
   Color utilities（全局主色调工具）
   - 解析 #RGB / #RRGGBB
   - 相对亮度（WCAG）自动计算黑/白反色
   - 生成主色的半透明衍生色
   所有计算结果最终都以 CSS 变量下发，组件不直接消费硬编码色。
   ═══════════════════════════════════════════ */

export type Rgb = { r: number; g: number; b: number };

/** 把 #RGB / #RRGGBB 解析为 RGB；非法输入返回 null。 */
export function parseHexColor(input: string): Rgb | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  const short = /^#?([0-9a-fA-F]{3})$/.exec(value);
  if (short) {
    const hex = short[1];
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  const long = /^#?([0-9a-fA-F]{6})$/.exec(value);
  if (!long) return null;
  const hex = long[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** sRGB 单通道线性化。 */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 相对亮度，范围 0（纯黑）~ 1（纯白）。 */
export function getRelativeLuminance(input: string): number {
  const rgb = parseHexColor(input);
  if (!rgb) return 0;
  return (
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b)
  );
}

/**
 * 自动反色：给定背景主色，返回在其上永远清晰可读的前景色。
 * 亮度 > 0.45 用深墨字，否则用纯白字。
 */
export function getReadableOnColor(input: string): string {
  return getRelativeLuminance(input) > 0.45 ? "#1C1C1E" : "#FFFFFF";
}

/** 生成 `r, g, b` 字符串，用于 rgba() 拼装。 */
export function hexToRgbChannels(input: string): string {
  const rgb = parseHexColor(input);
  return rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : "10, 132, 255";
}

/** 主色调预设（韩系低饱和 + iOS 系统色），第一个为"跟随默认"。 */
export const ACCENT_PRESETS: Array<{ name: string; value: string }> = [
  { name: "默认", value: "" },
  { name: "iOS 蓝", value: "#0A84FF" },
  { name: "苔绿", value: "#34C759" },
  { name: "暖橙", value: "#FF9500" },
  { name: "珊瑚红", value: "#FF3B30" },
  { name: "葡萄紫", value: "#BF5AF2" },
  { name: "樱粉", value: "#FF375F" },
  { name: "青蓝", value: "#5AC8FA" },
  { name: "石墨", value: "#3B3F46" },
];

/* ── HSV 取色支持（面板式取色器内部统一用 HSV，对外仍只收发 HEX） ── */

export type Hsv = { h: number; s: number; v: number };

export function rgbToHex({ r, g, b }: Rgb): string {
  const to2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const m = v - c;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

export function hexToHsv(input: string): Hsv | null {
  const rgb = parseHexColor(input);
  return rgb ? rgbToHsv(rgb) : null;
}

export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}

/** 当前色相在「满饱和、满明度」下的纯色，用于渐变条取色停止点。 */
export function hueToPureHex(h: number): string {
  return hsvToHex({ h, s: 1, v: 1 });
}
