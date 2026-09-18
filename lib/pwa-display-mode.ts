export type PwaDisplayPreference = "fullscreen" | "standalone";
export type RuntimePwaDisplayMode = "fullscreen" | "standalone" | "minimal-ui" | "browser";
export type PwaHostedSurface = "custom-app" | "game";

export type PwaHostedSafeArea = {
  top: string;
  right: string;
  bottom: string;
  left: string;
  /* 宿主顶部浮层（胶囊按钮/悬浮返回钮）所在行的几何：想跟宿主按钮同排摆自己
     顶栏的应用用这组值贴行对齐，只需避开水平占位，不必整体让到 top 之下。 */
  barTop: string;
  barHeight: string;
  barClearLeft: string;
  barClearRight: string;
};

/** 宿主实测的浮层几何（px）；缺项用各表面的估算值兜底。 */
export type PwaHostedOverlayMetrics = {
  topPx?: number | null;
  barTopPx?: number | null;
  barHeightPx?: number | null;
  barClearLeftPx?: number | null;
  barClearRightPx?: number | null;
};

export const PWA_DISPLAY_MODE_COOKIE = "pwa_display_mode";
export const PWA_DISPLAY_MODE_CHANGED_EVENT = "pwa-display-mode-changed";
export const DEFAULT_PWA_DISPLAY_PREFERENCE: PwaDisplayPreference = "fullscreen";

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function readPwaDisplayPreference(cookie: string): PwaDisplayPreference | null {
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${PWA_DISPLAY_MODE_COOKIE}=([^;]+)`));
  if (!match) return null;
  const value = decodeCookieValue(match[1]);
  return value === "fullscreen" || value === "standalone" ? value : null;
}

export function writePwaDisplayPreference(preference: PwaDisplayPreference) {
  if (typeof document === "undefined") return;
  document.cookie = `${PWA_DISPLAY_MODE_COOKIE}=${preference}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(PWA_DISPLAY_MODE_CHANGED_EVENT, { detail: preference }));
}

/** Preserve the upstream default: mobile browsers request fullscreen unless Edge or explicitly disabled. */
export function shouldRequestPwaFullscreen(): boolean {
  if (typeof document === "undefined" || typeof navigator === "undefined") return false;
  const preference = readPwaDisplayPreference(document.cookie);
  if (preference === "standalone") return false;
  if (preference === "fullscreen") return true;
  return !/Edg/i.test(navigator.userAgent);
}

export function getRuntimePwaDisplayMode(): RuntimePwaDisplayMode {
  if (typeof window === "undefined" || typeof document === "undefined") return "browser";
  if (document.fullscreenElement || window.matchMedia("(display-mode: fullscreen)").matches) {
    return "fullscreen";
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return "standalone";
  }
  if (window.matchMedia("(display-mode: minimal-ui)").matches) {
    return "minimal-ui";
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone ? "standalone" : "browser";
}

/**
 * 是否已经运行在「安装到桌面」的 PWA 里（standalone/fullscreen display-mode，
 * 含 iOS Safari 的 navigator.standalone）。此环境下系统已提供沉浸界面，
 * 网页绝不能再调用 Fullscreen API。
 */
export function isInstalledPwa(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone === true;
}

/**
 * 是否为 iOS / iPadOS 设备。
 * 必须与 Android 分开处理沉浸布局：iOS 安装的 PWA 永远报 standalone，
 * 其系统状态栏区域由 webview 绘制，项目用模拟状态栏承接系统区；
 * Android 安装 PWA 的真实系统栏由 Chrome 绘制，再保留模拟栏会形成双状态栏。
 */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ 桌面 UA：Intel Mac + 触屏
  const nav = navigator as Navigator & { standalone?: boolean };
  if (/Macintosh/i.test(ua) && typeof nav.maxTouchPoints === "number" && nav.maxTouchPoints > 1) {
    return true;
  }
  return false;
}

/**
 * 是否应让 Web UI 进入「系统区沉浸」布局（隐藏模拟状态栏、内容按 env 安全区避让）。
 *
 * 成立条件（满足其一）：
 * 1. 用户显式选择「显示系统状态栏」（cookie=standalone）；
 * 2. Android/其他平台已安装到桌面的 PWA（standalone 或 fullscreen display-mode）。
 *
 * iOS 安装 PWA 且用户未显式选择时不成立：保留模拟状态栏承接系统状态栏区域，
 * 避免 iOS 用户静默丢失模拟状态栏（历史行为）。
 */
export function shouldUseImmersiveSystemLayout(): boolean {
  if (typeof window === "undefined") return false;
  if (readPwaDisplayPreference(document.cookie) === "standalone") return true;
  return isInstalledPwa() && !isIosDevice();
}

/**
 * 普通手机浏览器里的「一次性手势全屏」兜底（主 App 已不使用，仅独立窗口的
 * world-builder 保留）。规则：
 * - 已是安装版 PWA（standalone/fullscreen）→ 直接跳过；
 * - 绝不在加载/路由/visibility/focus 时自动请求，只响应用户真实轻触；
 * - 每次页面生命周期最多请求一次；用户一旦退出全屏，本次生命周期内永不再请求，
 *   避免 Android Chrome 反复显示「如需退出全屏…」的安全提示条；
 * - Chrome 自己的提示条无法也不允许由网页关闭。
 * 返回卸载函数。
 */
export function attachGestureFullscreen(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  if (isInstalledPwa()) return () => {};

  const isMobile = window.matchMedia(
    "(max-width: 500px) and (hover: none) and (pointer: coarse)"
  ).matches;
  if (!isMobile) return () => {};

  let requested = false;
  let exitBlocked = false;

  const onFullscreenChange = () => {
    if (!document.fullscreenElement) {
      // 用户（或浏览器）退出了全屏 → 不再自动请求
      exitBlocked = true;
    }
  };

  const onGesture = () => {
    if (requested || exitBlocked) return;
    if (document.fullscreenElement) return;
    if (!shouldRequestPwaFullscreen()) return;
    requested = true;
    document.documentElement.requestFullscreen?.().catch(() => {
      exitBlocked = true;
    });
  };

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("pointerdown", onGesture);
  return () => {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("pointerdown", onGesture);
  };
}

/** 非沉浸布局是否生效：必须用户显式开了「显示系统状态栏」且运行时确实不在全屏。
 *  只看运行时模式是不行的——iOS 装到桌面永远报 standalone，会把没碰过开关的
 *  用户也误判成非沉浸（这正是 pwa-manifest-injector 挂标记前要先过这道门的原因）。 */
export function isNonImmersiveLayoutActive(): boolean {
  if (typeof document === "undefined") return false;
  return readPwaDisplayPreference(document.cookie) === "standalone"
    && getRuntimePwaDisplayMode() !== "fullscreen";
}

/** Safe-area values injected into sandboxed apps, which cannot inherit host CSS variables.
 *  measured：宿主实测的浮层几何，优先于估算值——壳布局以后再调整时数字不会失真。
 *  top 是"完全让开浮层"的保守值；bar* 描述浮层那一行本身，供想同排摆按钮的应用用。 */
export function getPwaHostedSafeArea(surface: PwaHostedSurface, embedded = false, measured?: PwaHostedOverlayMetrics): PwaHostedSafeArea {
  if (embedded) {
    return { top: "0px", right: "0px", bottom: "0px", left: "0px", barTop: "0px", barHeight: "0px", barClearLeft: "0px", barClearRight: "0px" };
  }

  const nonImmersive = isNonImmersiveLayoutActive();
  const px = (value: number | null | undefined, fallback: number) =>
    `${value != null && value > 0 ? Math.round(value) : fallback}px`;
  // 兜底估算与两个浮层的 CSS 定位保持一致（app-market.css 胶囊 / game.css 悬浮返回钮）：
  // top = 浮层 top + 浮层高 + 4px 间隙。浮层的 top 偏移与这段间隙都已从 8px 收到 4px，
  // 兜底值同步跟着减，免得实测拿不到时又冒出一条比实际更宽的留白。
  const isGame = surface === "game";
  return {
    top: px(measured?.topPx, nonImmersive ? (isGame ? 52 : 40) : (isGame ? 84 : 80)),
    right: "16px",
    bottom: "24px",
    left: "16px",
    barTop: px(measured?.barTopPx, isGame ? 38 : (nonImmersive ? 4 : 52)),
    barHeight: px(measured?.barHeightPx, isGame ? 44 : 30),
    barClearLeft: px(measured?.barClearLeftPx, isGame ? 66 : 0),
    barClearRight: px(measured?.barClearRightPx, isGame ? 0 : 96),
  };
}
