/* ═══════════════════════════════════════════════════════════
   外观与主题 · 共享层（v0.8.0 T5）
   - phone-theme-app 兼容薄壳 与 设置→外观与主题 共用同一组组件；
   - 本文件只放类型 / 常量 / 纯函数，不含 JSX；
   - 主题 storage key、cssOverrides、globalCustomCSS、导入导出 JSON
     格式一律不在此改动。
   ═══════════════════════════════════════════════════════════ */
import type { CSSProperties } from "react";
import { normalizeThemeProfile, type ThemeProfile } from "@/lib/theme-types";
import type { DesktopIconId, IconId } from "@/lib/desktop-config";
import { DOCK_DEFAULT, PAGE_1_DEFAULT, PAGE_2_DEFAULT, PAGE_3_DEFAULT } from "@/lib/desktop-config";
import type { DesktopFolderMap, DesktopIconLayout } from "@/lib/desktop-layout-storage";
import type { WidgetInstance } from "@/lib/widget-types";

/** 外观根组件的子页路由（menu = 外观首页磁贴菜单）。 */
export type AppearanceSection =
  | "menu"
  | "display"
  | "palette"
  | "wallpaper"
  | "icons"
  | "widgets"
  | "glass"
  | "case"
  | "text"
  | "css";

export type WallpaperSliderField =
  | "wallpaperOpacity"
  | "wallpaperBlur"
  | "wallpaperScale"
  | "wallpaperX"
  | "wallpaperY";

/** 外观根组件 props（与旧 PhoneThemeAppProps 契约保持一致，禁止删字段）。 */
export type AppearanceRootProps = {
  draft: ThemeProfile;
  onDraftChange: (next: ThemeProfile) => void;
  onApply: (next: ThemeProfile) => Promise<void> | void;
  onClose: () => void;
  onNotice: (text: string) => void;
  widgets: WidgetInstance[];
  onWidgetsChange: (next: WidgetInstance[]) => void;
  onDesktopThemeChange: (next: {
    widgets: WidgetInstance[];
    iconLayout: DesktopIconLayout;
    dock?: DesktopIconId[];
    folders?: DesktopFolderMap;
  }) => void;
  pageIcons: DesktopIconLayout;
  iconSkins: Record<string, string | null>;
  wallpaperStyle?: CSSProperties;
};

/** 各 draft 编辑子页的公共 props。 */
export type AppearanceDraftPageProps = {
  draft: ThemeProfile;
  onDraftChange: (next: ThemeProfile) => void;
  onApply: (next: ThemeProfile) => Promise<void> | void;
  onNotice: (text: string) => void;
};

/* ── CSS 变量取色（原 phone-theme-app 内 COLOR_ITEMS，等价搬迁） ── */

export type ColorItem = { key: string; label: string; defaultValue: string };

export const COLOR_ITEMS: ColorItem[] = [
  { key: "--c-header-bg", label: "标题栏", defaultValue: "#FFFFFF" },
  { key: "--c-page-body-bg", label: "内容区", defaultValue: "#F1F2F6" },
  { key: "--c-card", label: "卡片", defaultValue: "rgba(255, 255, 255, 0.7)" },
  { key: "--c-card-border", label: "卡片边框", defaultValue: "#E0E0E0" },
  { key: "--c-panel", label: "面板", defaultValue: "#FFFFFF" },
  { key: "--c-panel-border", label: "面板边框", defaultValue: "#D9DADB" },
  { key: "--c-input", label: "输入框", defaultValue: "#F2F3F5" },
  { key: "--c-input-border", label: "输入框边框", defaultValue: "rgba(224, 226, 229, 0)" },
];

/** Parse any CSS color string into { hex, alpha } */
export function parseColorAlpha(val: string): { hex: string; alpha: number } {
  const rgbaMatch = val.match(/rgba?\(\s*(\d+)\s*(\d+)\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]), g = Number(rgbaMatch[2]), b = Number(rgbaMatch[3]);
    const a = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1;
    const hex = `#${[r, g, b].map(c => c.toString(16).padStart(2, "0")).join("")}`;
    return { hex, alpha: a };
  }
  if (val.startsWith("#") && (val.length === 4 || val.length === 7 || val.length === 9)) {
    if (val.length === 9) {
      const a = parseInt(val.slice(7, 9), 16) / 255;
      return { hex: val.slice(0, 7), alpha: a };
    }
    return { hex: val.length === 4 ? `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}` : val, alpha: 1 };
  }
  return { hex: "#000000", alpha: 1 };
}

/** Build CSS color string from hex + alpha */
export function buildColor(hex: string, alpha: number): string {
  if (alpha >= 1) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ── 图标皮肤（等价搬迁） ── */

// 三页桌面 + DOCK 的默认图标全收进来。漏了第三页时，筑境/工坊/资源集市/独家特调
// 这四个图标在外观里根本没有格子，换不了皮肤。
export const BUILTIN_ICON_SKIN_IDS: IconId[] = [...PAGE_1_DEFAULT, ...PAGE_2_DEFAULT, ...PAGE_3_DEFAULT, ...DOCK_DEFAULT];

export type IconSkinItem = {
  id: DesktopIconId;
  label: string;
  builtinId: IconId | null;
  iconDataUrl?: string;
};

export function updateIconSkin(draft: ThemeProfile, iconId: DesktopIconId, assetId: string | null): ThemeProfile {
  const skins = { ...draft.iconSkins };
  if (assetId) skins[iconId] = assetId; else delete skins[iconId];

  const schemes = draft.iconSchemes.map(s =>
    s.id === draft.activeIconSchemeId
      ? { ...s, iconSkins: { ...skins }, updatedAt: new Date().toISOString() }
      : s
  );

  return normalizeThemeProfile({ ...draft, iconSkins: skins, iconSchemes: schemes });
}
