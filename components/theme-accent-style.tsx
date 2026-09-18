"use client";

import { useInsertionEffect } from "react";

import { buildAccentTokensCSS } from "@/lib/theme-accent";
import { readThemeProfile, THEME_PROFILE_UPDATED_EVENT } from "@/lib/theme-storage";

/**
 * 全局主色 token 同步器（不渲染任何 UI）。
 *
 * 锁屏 / 密码页渲染在 .phone-shell 之外、且发生在 DesktopShell 挂载之前，
 * 因此需要一个与外壳同生命周期的注入点，在首帧就把持久化的种子色
 * 以 :root CSS 变量形式下发，保证锁屏 / 桌面 / 设置取自同一套 token。
 *
 * 注入位置固定在 DesktopShell 的实时覆盖样式之前：取色器拖动时
 * DesktopShell 的草稿样式（同 specificity、在 <head> 更靠后）优先，
 * 应用持久化后这里同步为最新值。
 */
export function ThemeAccentStyle() {
  useInsertionEffect(() => {
    if (typeof document === "undefined") return;

    const id = "ai-phone-accent-tokens";

    const sync = () => {
      let node = document.getElementById(id) as HTMLStyleElement | null;
      const css = buildAccentTokensCSS(readThemeProfile().accentColor);
      if (!css) {
        node?.remove();
        return;
      }
      if (!node) {
        node = document.createElement("style");
        node.id = id;
        node.setAttribute("data-source", "accent-tokens");
      }
      node.textContent = css;
      // 必须位于实时覆盖样式之前，使取色器草稿永远赢过持久化值
      const overridesNode = document.getElementById("ai-phone-theme-overrides");
      if (overridesNode?.parentNode) {
        overridesNode.parentNode.insertBefore(node, overridesNode);
      } else {
        document.head.appendChild(node);
      }
    };

    sync();
    window.addEventListener(THEME_PROFILE_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_PROFILE_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return null;
}
