"use client";

import { useEffect, useRef, useState } from "react";
import {
  isPwaRefreshBlocked,
  registerPwaRefreshGuard,
} from "@/lib/pwa-update-guard";

// ─────────────────────────────────────────────────────────────
// PWA 更新链路（Task 4.5 / 4.5.1）
// 1. 注册时 updateViaCache:"none" —— sw.js 永远走网络校验，不被 HTTP 缓存拖住；
// 2. updatefound / statechange / controllerchange 全程监听新版本；
// 3. 新 SW 接管时：安全（无流式生成/未保存输入）→ 静默 reload 一次；
//    不安全 → 顶部轻提示「新版本已就绪」由用户手动刷新；
// 4. 捕获 webpack ChunkLoadError（旧 HTML 引用已淘汰 hash）：
//    触发 registration.update()，等新 SW 接管后整页 reload 一次；
//    sessionStorage 时间闸限制最小刷新间隔，杜绝死循环。
// 不清理任何 IDB / localStorage / 用户缓存。
// ─────────────────────────────────────────────────────────────
// upgrade-test round 1（4.5.1 三轮真升级测试：真实源码字节标记，随轮次更新；
// 仅供测试核对构建代际，无行为影响）
const UPGRADE_TEST_MARKER = "t45-round-1";
try { window.sessionStorage.setItem("t45-build-marker", UPGRADE_TEST_MARKER); } catch {}


const RELOAD_GUARD_KEY = "pwa-reload-guard-v1";
const MIN_RELOAD_INTERVAL_MS = 15_000;
const STABLE_LOAD_CLEAR_MS = 12_000;
const SW_UPDATE_WAIT_MS = 6_000;
const FOREGROUND_UPDATE_THROTTLE_MS = 10 * 60_000;

// webpack 动态 import / Next 懒加载 chunk 失败的典型报错特征
const CHUNK_FAILURE_RE =
  /loading chunk|loading css chunk|chunkloaderror|error loading dynamically imported module|failed to fetch dynamically imported module/i;

function hasUnsavedDraft(): boolean {
  // 聚焦中的输入框/textarea/contenteditable 有非空内容 → 视为未保存输入
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value.trim().length > 0;
  }
  if (el.isContentEditable) {
    return (el.textContent || "").trim().length > 0;
  }
  return false;
}

function safeToAutoRefresh(): boolean {
  return !isPwaRefreshBlocked() && !hasUnsavedDraft();
}

function recentlyReloaded(): boolean {
  try {
    const ts = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    return Boolean(ts) && Date.now() - ts < MIN_RELOAD_INTERVAL_MS;
  } catch {
    return false;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function PWARegistrar() {
  const [updateReady, setUpdateReady] = useState(false);
  const reloadingRef = useRef(false);
  const chunkHandlingRef = useRef(false);
  const hadControllerRef = useRef(false);
  const newControllerActiveRef = useRef(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const lastForegroundUpdateRef = useRef(0);
  const updateReadyRef = useRef(false);
  const showUpdateToast = () => {
    updateReadyRef.current = true;
    setUpdateReady(true);
  };

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;

    // 后台追问/定时唤醒/微信桥生成中的会话集合（前台聊天室由 chat-room
    // 自行注册守卫覆盖；这里覆盖聊天室未挂载时的后台生成场景）。
    const busySessions = new Set<string>();
    const sessionIdOf = (event: Event): string =>
      String((event as CustomEvent).detail?.sessionId || "");
    const onFollowupStarted = (event: Event) => {
      const id = sessionIdOf(event);
      if (id) busySessions.add(id);
    };
    const onFollowupFired = (event: Event) => {
      busySessions.delete(sessionIdOf(event));
    };
    const onWeixinGenerating = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const id = sessionIdOf(event);
      if (!id) return;
      if (detail?.generating) busySessions.add(id);
      else busySessions.delete(id);
    };
    window.addEventListener("followup-started", onFollowupStarted);
    window.addEventListener("followup-fired", onFollowupFired);
    window.addEventListener("weixin-generating", onWeixinGenerating);
    const unregisterBusyGuard = registerPwaRefreshGuard(
      () => busySessions.size > 0
    );

    const hardReload = () => {
      if (reloadingRef.current) return;
      // 上一次自动 reload 刚发生（15s 内）→ 不再刷新，避免失败时死循环
      if (recentlyReloaded()) return;
      reloadingRef.current = true;
      try {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      } catch {
        /* 隐私模式等场景写不进就算了 */
      }
      window.location.reload();
    };

    // 页面稳定存活 12s 即视为成功启动，放开下一次 chunk 失败的单次刷新额度
    const stableTimer = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {
        /* ignore */
      }
    }, STABLE_LOAD_CLEAR_MS);

    const onControllerChange = () => {
      // 首次安装（页面加载时没有 controller）：claim 引发的 cc 无需刷新
      if (!hadControllerRef.current) {
        hadControllerRef.current = true;
        return;
      }
      // 新版本已接管当前页
      newControllerActiveRef.current = true;
      waitingWorkerRef.current = null;
      if (safeToAutoRefresh()) {
        hardReload();
        return;
      }
      // 有进行中生成/未保存输入：不打断，等用户手动刷新
      showUpdateToast();
    };

    const onChunkFailure = async () => {
      if (chunkHandlingRef.current) return;
      if (recentlyReloaded()) return;
      chunkHandlingRef.current = true;
      try {
        const reg =
          registration ||
          (await navigator.serviceWorker.getRegistration().catch(() => null));
        if (reg) {
          const takenOver = new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => resolve(),
              { once: true }
            );
          });
          // 主动检查部署（sw.js updateViaCache:none，必拿到最新字节）
          try {
            await reg.update();
          } catch {
            /* 网络波动也继续：下面的单次 reload 同样能自愈 */
          }
          await Promise.race([takenOver, wait(SW_UPDATE_WAIT_MS)]);
        }
      } finally {
        hardReload();
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      if (typeof event.message === "string" && CHUNK_FAILURE_RE.test(event.message)) {
        void onChunkFailure();
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const message =
        (reason && typeof reason === "object" && "message" in reason
          ? String((reason as { message: unknown }).message)
          : String(reason)) || "";
      if (CHUNK_FAILURE_RE.test(message)) {
        void onChunkFailure();
      }
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // 回到前台时（节流）主动查一次部署，覆盖 iOS standalone 的更新节流
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        // 切走时若新版本已接管且当前安全，是天然的无打扰刷新时机
        if (newControllerActiveRef.current && updateReadyRef.current && safeToAutoRefresh()) {
          hardReload();
        }
        return;
      }
      const now = Date.now();
      if (
        registration &&
        now - lastForegroundUpdateRef.current > FOREGROUND_UPDATE_THROTTLE_MS
      ) {
        lastForegroundUpdateRef.current = now;
        registration.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const register = () => {
      if (disposed) return;
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (disposed) return;
          registration = reg;
          hadControllerRef.current = Boolean(navigator.serviceWorker.controller);

          const onUpdateFound = () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller &&
                reg.waiting === installing
              ) {
                // 新版本停在 waiting（skipWaiting 通常会直接越过；
                // 某些 WebView 节流下会停在此）→ 提示，用户点刷新时推进
                waitingWorkerRef.current = installing;
                showUpdateToast();
              }
            });
          };
          reg.addEventListener("updatefound", onUpdateFound);
        })
        .catch((error) => {
          console.warn("[PWA] Service worker registration failed:", error);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      disposed = true;
      window.clearTimeout(stableTimer);
      window.removeEventListener("load", register);
      window.removeEventListener("followup-started", onFollowupStarted);
      window.removeEventListener("followup-fired", onFollowupFired);
      window.removeEventListener("weixin-generating", onWeixinGenerating);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
      unregisterBusyGuard();
    };
    // updateReady 仅用于轻提示渲染，刷新逻辑走 ref，无需作为 effect 依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshClick = () => {
    // waiting 中的新 SW：先推进激活，再刷新；controllerchange 监听会兜底
    try {
      waitingWorkerRef.current?.postMessage({ type: "SKIP_WAITING" });
    } catch {
      /* ignore */
    }
    reloadingRef.current = false; // 用户显式操作，无视时间闸
    try {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  if (!updateReady) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="应用更新提示"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(20px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 2147483000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: "calc(100vw - 32px)",
        padding: "10px 12px",
        borderRadius: 16,
        background: "rgba(28, 28, 30, 0.82)",
        WebkitBackdropFilter: "blur(18px)",
        backdropFilter: "blur(18px)",
        color: "#fff",
        fontSize: 13,
        lineHeight: 1.35,
        boxShadow: "0 8px 30px rgba(0,0,0,0.28)",
      }}
    >
      <span style={{ flex: "1 1 auto", whiteSpace: "normal" }}>
        新版本已就绪，刷新后生效
      </span>
      <button
        type="button"
        onClick={() => {
          updateReadyRef.current = false;
          setUpdateReady(false);
        }}
        style={{
          flex: "0 0 auto",
          border: "none",
          background: "transparent",
          color: "rgba(255,255,255,0.72)",
          fontSize: 13,
          padding: "6px 8px",
          borderRadius: 10,
          cursor: "pointer",
        }}
      >
        稍后
      </button>
      <button
        type="button"
        onClick={handleRefreshClick}
        style={{
          flex: "0 0 auto",
          border: "none",
          background: "var(--c-accent, #3c82d2)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          padding: "7px 14px",
          borderRadius: 999,
          cursor: "pointer",
        }}
      >
        立即刷新
      </button>
    </div>
  );
}
