"use client";

import { useEffect } from "react";

import { attachGestureFullscreen } from "@/lib/pwa-display-mode";

/**
 * 安卓全屏兜底（仅 world-builder 独立窗口使用）。
 *
 * world-builder（筑境）通过 window.open 开在独立窗口，不在 main-app 的 React 树内。
 * 全屏以 PWA 为优先策略：已安装（standalone/fullscreen display-mode）时什么都不做；
 * 普通手机浏览器里，只在用户第一次真实轻触时请求一次 requestFullscreen()，
 * 用户退出全屏后本页面生命周期内不再请求——避免 Chrome 反复弹出全屏安全提示。
 * 绝不在加载/路由/visibility/focus 等事件里自动请求。
 */
export function AndroidFullscreen() {
  useEffect(() => attachGestureFullscreen(), []);

  return null;
}
