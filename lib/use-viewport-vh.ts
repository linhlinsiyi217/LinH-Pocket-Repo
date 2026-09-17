"use client";

import { useEffect } from "react";

/**
 * 动态视口高度（PROJECT_RULES 全面屏适配，禁止硬编码状态栏高度）。
 *
 * 监听 window.visualViewport 的 resize/scroll：安卓浏览器自动隐藏/显示
 * 地址栏或底部手势条时，100vh/100lvh 不会实时跟随，会在底部留下白条。
 * 这里把实时视口高度的 1% 写进 CSS 变量 --vh，容器统一用
 * height: calc(var(--vh, 1dvh) * 100) 撑满，1dvh 仅作降级兜底。
 *
 * 同时写入 --vvh（整高 px）与 --vvw（实时宽度），供个别需要像素值的地方使用。
 */
export function useViewportVh(): void {
  useEffect(() => {
    const root = document.documentElement;

    const update = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const width = vv?.width ?? window.innerWidth;
      if (height > 0) {
        root.style.setProperty("--vh", `${height / 100}px`);
        root.style.setProperty("--vvh", `${height}px`);
      }
      if (width > 0) {
        root.style.setProperty("--vw", `${width / 100}px`);
        root.style.setProperty("--vvw", `${width}px`);
      }
      // visualViewport.offsetTop 是视口相对布局视口的偏移（键盘/工具栏弹出时非 0）
      if (vv) {
        root.style.setProperty("--vvo", `${vv.offsetTop}px`);
      }
    };

    update();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", update, { passive: true });
    vv?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
}
