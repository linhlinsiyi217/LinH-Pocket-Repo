"use client";

import { useEffect } from "react";

import { getRuntimePwaDisplayMode, isIosDevice, shouldUseImmersiveSystemLayout, PWA_DISPLAY_MODE_CHANGED_EVENT } from "@/lib/pwa-display-mode";

export function PWAManifestInjector() {
  useEffect(() => {
    const root = document.documentElement;
    const displayModeQueries = ["fullscreen", "standalone", "minimal-ui"].map(mode => (
      window.matchMedia(`(display-mode: ${mode})`)
    ));

    const syncRuntimeDisplayMode = () => {
      // 标记运行时操作系统，供 CSS 在 iOS / Android 之间区分沉浸策略
      // （纯 @media (display-mode) 无法区分两者：iOS PWA 永远报 standalone）。
      root.dataset.mobileOs = isIosDevice() ? "ios" : "android";

      // 沉浸门控：
      // - 用户显式选「显示系统状态栏」→ 按运行时模式避让系统区；
      // - Android 等非 iOS 安装 PWA（standalone/fullscreen）→ 默认隐藏模拟状态栏，
      //   避免真实系统栏 + 模拟栏形成「双状态栏」，刘海区改由 env 安全区承接；
      // - iOS 安装 PWA 且未显式选择 → 保留模拟状态栏承接系统区。
      if (shouldUseImmersiveSystemLayout()) {
        root.dataset.pwaDisplayMode = getRuntimePwaDisplayMode();
      } else {
        delete root.dataset.pwaDisplayMode;
      }
    };

    const refreshManifest = () => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!link) return;
      const base = (link.getAttribute("href") || "/manifest.webmanifest").split("?")[0];
      link.setAttribute("href", `${base}?v=${Date.now()}`);
    };

    const handleSettingsChanged = () => {
      syncRuntimeDisplayMode();
      refreshManifest();
    };

    syncRuntimeDisplayMode();
    refreshManifest();
    document.addEventListener("fullscreenchange", syncRuntimeDisplayMode);
    window.addEventListener("pageshow", syncRuntimeDisplayMode);
    window.addEventListener(PWA_DISPLAY_MODE_CHANGED_EVENT, handleSettingsChanged);
    displayModeQueries.forEach(query => query.addEventListener("change", syncRuntimeDisplayMode));

    return () => {
      document.removeEventListener("fullscreenchange", syncRuntimeDisplayMode);
      window.removeEventListener("pageshow", syncRuntimeDisplayMode);
      window.removeEventListener(PWA_DISPLAY_MODE_CHANGED_EVENT, handleSettingsChanged);
      displayModeQueries.forEach(query => query.removeEventListener("change", syncRuntimeDisplayMode));
      delete root.dataset.pwaDisplayMode;
      delete root.dataset.mobileOs;
    };
  }, []);

  return null;
}
