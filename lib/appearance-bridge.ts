/* ═══════════════════════════════════════════
   Appearance Bridge（v0.8.0）
   - 桌面 / 锁屏 / 控制中心共享的唯一外观状态投影层；
   - 纯函数 + 订阅，不依赖 React，可在锁屏 React 树之外调用；
   - 数据源只有 ThemeProfile（localStorage，key 见 theme-storage）。
   优先级（任何外观面）：
     icon skin / 用户 cssOverrides > 用户显式 appearance 选择 > accent > 系统默认
   ═══════════════════════════════════════════ */
import {
  DEFAULT_THEME_PROFILE,
  resolveActiveIconSkins,
  type ThemeProfile
} from "@/lib/theme-types";
import {
  readThemeProfile,
  writeThemeProfile,
  THEME_PROFILE_UPDATED_EVENT
} from "@/lib/theme-storage";

export type ColorMode = "light" | "dark";
export type IconAppearance = ThemeProfile["iconAppearance"];
export type WidgetAppearance = ThemeProfile["widgetAppearance"];
export type LockWallpaperMode = ThemeProfile["lockWallpaperMode"];

/** Bridge 对外广播的事件名（与 ThemeProfile 更新事件同源，别名便于语义订阅）。 */
export const APPEARANCE_CHANGED_EVENT = THEME_PROFILE_UPDATED_EVENT;

export interface LockWallpaperSnapshot {
  mode: LockWallpaperMode;
  assetId: string | null;
  blur: number;
  opacity: number;
  scale: number;
  x: number;
  y: number;
}

export interface AppearanceSnapshot {
  colorMode: ColorMode;
  /** 归一化后的 #RRGGBB；"" 表示跟随系统默认主色 */
  accentColor: string;
  borders: boolean;
  shadows: boolean;
  pearlGlassStrength: number;
  iconAppearance: IconAppearance;
  widgetAppearance: WidgetAppearance;
  wallpaperBrightness: number;
  lockWallpaper: LockWallpaperSnapshot;
  /** 桌面图标当前是否存在生效中的皮肤（优先级最高，外观面不得盖住皮肤） */
  hasIconSkin: boolean;
  /** 原始归一化 profile，供特殊消费方读取 */
  profile: ThemeProfile;
}

export function getAppearanceSnapshot(profile?: ThemeProfile): AppearanceSnapshot {
  const p = profile ?? readThemeProfile();
  const skins = resolveActiveIconSkins(p);
  return {
    colorMode: p.colorMode,
    accentColor: p.accentColor,
    borders: p.enableGlobalBorder,
    shadows: p.enableGlobalShadows,
    pearlGlassStrength: p.pearlGlassStrength,
    iconAppearance: p.iconAppearance,
    widgetAppearance: p.widgetAppearance,
    wallpaperBrightness: p.wallpaperBrightness,
    lockWallpaper: {
      mode: p.lockWallpaperMode,
      assetId: p.lockWallpaperAssetId,
      blur: p.lockWallpaperBlur,
      opacity: p.lockWallpaperOpacity,
      scale: p.lockWallpaperScale,
      x: p.lockWallpaperX,
      y: p.lockWallpaperY
    },
    hasIconSkin: Object.keys(skins).length > 0,
    profile: p
  };
}

type AppearanceListener = (snapshot: AppearanceSnapshot) => void;

/**
 * 订阅外观变化（含跨标签页 storage 同步）。
 * @returns 取消订阅函数
 */
export function subscribeAppearance(listener: AppearanceListener): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener(getAppearanceSnapshot());
  const detailHandler = (event: Event) => {
    const detail = (event as CustomEvent<ThemeProfile>).detail;
    listener(getAppearanceSnapshot(detail ?? undefined));
  };
  window.addEventListener(APPEARANCE_CHANGED_EVENT, detailHandler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(APPEARANCE_CHANGED_EVENT, detailHandler);
    window.removeEventListener("storage", handler);
  };
}

/** 局部更新外观字段（自动 read-merge-write，并广播 APPEARANCE_CHANGED_EVENT）。 */
export function updateAppearance(patch: Partial<ThemeProfile>): AppearanceSnapshot {
  const next = writeThemeProfile({ ...readThemeProfile(), ...patch });
  return getAppearanceSnapshot(next);
}

export function setColorMode(mode: ColorMode): AppearanceSnapshot {
  return updateAppearance({ colorMode: mode });
}

export function toggleColorMode(): AppearanceSnapshot {
  const current = getAppearanceSnapshot();
  return setColorMode(current.colorMode === "dark" ? "light" : "dark");
}

/* ── 桌面特效属性解析：cssOverrides > 显式 appearance > Pearl Glass 默认 ── */

const ICON_EFFECT_OVERRIDE = "--desktop-icon-effect";
const WIDGET_EFFECT_OVERRIDE = "--desktop-widget-effect";
const KNOWN_ICON_EFFECTS = new Set(["glass", "mono", "transparent", "flat"]);
const KNOWN_WIDGET_EFFECTS = new Set(["glass", "editorial", "transparent", "flat"]);

function resolveEffect(
  overrides: Record<string, string>,
  key: string,
  known: Set<string>,
  fallback: string
): string {
  const explicit = (overrides[key] ?? "").trim();
  if (explicit && known.has(explicit)) return explicit;
  return fallback;
}

/**
 * 解析写入 .phone-shell[data-icon-effect] 的实际值。
 * - 用户 cssOverrides 显式值最高优先；
 * - iconAppearance="mono" → "mono"（纯色灰阶方块，无玻璃）；
 * - auto / glass 一律走 Pearl Glass（"glass"）。
 */
export function resolveDesktopIconEffect(profile: ThemeProfile): string {
  if (profile.iconAppearance === "mono") {
    // cssOverrides 仍可强制改回玻璃/透明
    return resolveEffect(profile.cssOverrides, ICON_EFFECT_OVERRIDE, KNOWN_ICON_EFFECTS, "mono");
  }
  if (profile.iconAppearance === "glass") {
    return resolveEffect(profile.cssOverrides, ICON_EFFECT_OVERRIDE, KNOWN_ICON_EFFECTS, "glass");
  }
  return resolveEffect(profile.cssOverrides, ICON_EFFECT_OVERRIDE, KNOWN_ICON_EFFECTS, "glass");
}

export function resolveDesktopWidgetEffect(profile: ThemeProfile): string {
  if (profile.widgetAppearance === "editorial") {
    return resolveEffect(profile.cssOverrides, WIDGET_EFFECT_OVERRIDE, KNOWN_WIDGET_EFFECTS, "editorial");
  }
  if (profile.widgetAppearance === "glass") {
    return resolveEffect(profile.cssOverrides, WIDGET_EFFECT_OVERRIDE, KNOWN_WIDGET_EFFECTS, "glass");
  }
  return resolveEffect(profile.cssOverrides, WIDGET_EFFECT_OVERRIDE, KNOWN_WIDGET_EFFECTS, "glass");
}

/** 便捷常量：无 localStorage 环境（SSR）下的快照。 */
export const DEFAULT_APPEARANCE_SNAPSHOT: AppearanceSnapshot =
  getAppearanceSnapshot({ ...DEFAULT_THEME_PROFILE });
