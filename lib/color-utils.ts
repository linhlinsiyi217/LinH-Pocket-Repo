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
