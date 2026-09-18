"use client";

/* ═══════════════════════════════════════════
   AppearanceBridgeProvider（v0.8.0）
   - 挂在 main-app 根部，锁屏 / 桌面 / App 内全部生命周期都在；
   - 是 documentElement[data-color-mode] 的【唯一写入点】；
   - 同时注入 #ai-phone-appearance-bridge 的 :root 外观变量；
   - 不渲染任何 DOM。
   ═══════════════════════════════════════════ */
import { useEffect, useState } from "react";
import {
  getAppearanceSnapshot,
  subscribeAppearance,
  type AppearanceSnapshot
} from "@/lib/appearance-bridge";

const STYLE_ELEMENT_ID = "ai-phone-appearance-bridge";

function buildBridgeCss(snapshot: AppearanceSnapshot): string {
  const { pearlGlassStrength, wallpaperBrightness, iconAppearance, widgetAppearance, lockWallpaper } =
    snapshot;
  return [
    ":root {",
    `  --pearl-glass-strength: ${pearlGlassStrength};`,
    `  --ab-wallpaper-brightness: ${wallpaperBrightness};`,
    `  --ab-icon-appearance: ${iconAppearance};`,
    `  --ab-widget-appearance: ${widgetAppearance};`,
    `  --ab-lock-wallpaper-mode: ${lockWallpaper.mode};`,
    "}"
  ].join("\n");
}

function applyToDocument(snapshot: AppearanceSnapshot): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // 唯一 color-mode 写入点；不删除属性（light/dark 均为显式状态）
  root.dataset.colorMode = snapshot.colorMode;
  root.dataset.iconAppearance = snapshot.iconAppearance;
  root.dataset.widgetAppearance = snapshot.widgetAppearance;

  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ELEMENT_ID;
    styleEl.dataset.owner = "appearance-bridge";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildBridgeCss(snapshot);
}

export function AppearanceBridgeProvider(): null {
  const [snapshot, setSnapshot] = useState<AppearanceSnapshot | null>(null);

  // 挂载即同步（layout 阶段先于首帧绘制，避免明暗闪烁）
  useEffect(() => {
    const current = getAppearanceSnapshot();
    setSnapshot(current);
    applyToDocument(current);
    const unsubscribe = subscribeAppearance((next) => {
      setSnapshot(next);
      applyToDocument(next);
    });
    return unsubscribe;
  }, []);

  // 每次快照变更也兜底应用一次（严格模式双调用下幂等）
  useEffect(() => {
    if (snapshot) applyToDocument(snapshot);
  }, [snapshot]);

  return null;
}
