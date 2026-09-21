"use client";

import { useEffect, useRef } from "react";

import { registerPwaRefreshGuard } from "@/lib/pwa-update-guard";
import {
  activateNow,
  bindRegistration,
  bindUpdateEngine,
  checkForUpdates,
  dismissReadyToast,
  evaluateAutoActivation,
  getDisplayStatus,
  initUpdateCenter,
  notifyDownloadFailed,
  notifyDownloadStarting,
  notifyUpdateReady,
  notifyWaitingGone,
  queryControllerVersion,
  shouldShowReadyToast,
  useUpdateCenter,
} from "@/lib/update/update-center-store";
import { PearlSymbol } from "./ui/pearl-symbol";

// ─────────────────────────────────────────────────────────────
// PWA 更新链路（Task 4.5 / System Update 引擎）
// 1. 注册时 updateViaCache:"none" —— sw.js 永远走网络校验，不被 HTTP 缓存拖住；
// 2. updatefound / statechange / controllerchange 全程驱动 update-center-store；
// 3. 新 SW install 完成后停在 waiting（sw.js 不再无条件 skipWaiting）：
//    - 自动更新开 + 安全时机 → postMessage SKIP_WAITING，接管后单次 reload；
//    - 自动更新关 / 安全守卫未放行 → 只显示「新版本已就绪」，等用户操作；
// 4. 捕获 webpack ChunkLoadError（旧 HTML 引用已淘汰 hash）：
//    registration.update() + 显式 SKIP_WAITING，等新 SW 接管后整页 reload 一次；
//    sessionStorage 时间闸限制最小刷新间隔，杜绝死循环。
// 不清理任何 IDB / localStorage / 用户缓存。
// ─────────────────────────────────────────────────────────────
// upgrade-test round 3（4.5.1 三轮真升级测试：真实源码字节标记，随轮次更新；
// 仅供测试核对构建代际，无行为影响）
const UPGRADE_TEST_MARKER = "t45-round-3";
try { window.sessionStorage.setItem("t45-build-marker", UPGRADE_TEST_MARKER); } catch {}


const RELOAD_GUARD_KEY = "pwa-reload-guard-v1";
const MIN_RELOAD_INTERVAL_MS = 15_000;
const STABLE_LOAD_CLEAR_MS = 12_000;
const SW_UPDATE_WAIT_MS = 6_000;
const FOREGROUND_UPDATE_THROTTLE_MS = 10 * 60_000;
const SAFE_REEVAL_INTERVAL_MS = 20_000;

// webpack 动态 import / Next 懒加载 chunk 失败的典型报错特征
const CHUNK_FAILURE_RE =
  /loading chunk|loading css chunk|chunkloaderror|error loading dynamically imported module|failed to fetch dynamically imported module/i;

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
  const updateState = useUpdateCenter();
  const reloadingRef = useRef(false);
  const chunkHandlingRef = useRef(false);
  const hadControllerRef = useRef(false);
  const lastForegroundUpdateRef = useRef(0);

  useEffect(() => {
    const supported = process.env.NODE_ENV === "production" && "serviceWorker" in navigator;
    initUpdateCenter(supported);
    if (!supported) return;

    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;
    let safeReevalTimer = 0;

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
      evaluateAutoActivation();
    };
    const onWeixinGenerating = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const id = sessionIdOf(event);
      if (!id) return;
      if (detail?.generating) busySessions.add(id);
      else {
        busySessions.delete(id);
        evaluateAutoActivation();
      }
    };
    window.addEventListener("followup-started", onFollowupStarted);
    window.addEventListener("followup-fired", onFollowupFired);
    window.addEventListener("weixin-generating", onWeixinGenerating);
    const unregisterBusyGuard = registerPwaRefreshGuard(
      () => busySessions.size > 0
    );

    // manual=true 仅用于用户显式点击「立即更新」/chunk 自愈的最终跳转，
    // 无视 15s 时间闸；自动安全时机激活走 manual=false，严格受时间闸保护。
    const hardReload = (manual: boolean) => {
      if (reloadingRef.current) return;
      if (!manual && recentlyReloaded()) return;
      reloadingRef.current = true;
      try {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      } catch {
        /* 隐私模式等场景写不进就算了 */
      }
      window.location.reload();
    };
    bindUpdateEngine({ hardReload });

    // 页面稳定存活 12s 即视为成功启动，放开下一次 chunk 失败的单次刷新额度
    const stableTimer = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {
        /* ignore */
      }
    }, STABLE_LOAD_CLEAR_MS);

    // 跟踪单个 installing/waiting worker 的生命周期
    const trackWorker = (worker: ServiceWorker, reg: ServiceWorkerRegistration) => {
      worker.addEventListener("statechange", () => {
        if (disposed) return;
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller &&
          reg.waiting === worker
        ) {
          // 新版本已下载完成并停在 waiting（等待手动或安全时机推进）
          notifyUpdateReady(worker);
          return;
        }
        if (worker.state === "redundant") {
          // 被更新的安装顶替：跟新的 installing/waiting；否则是下载失败
          if (reg.installing) {
            notifyDownloadStarting();
            trackWorker(reg.installing, reg);
          } else if (reg.waiting) {
            notifyUpdateReady(reg.waiting);
          } else {
            notifyWaitingGone();
            notifyDownloadFailed();
          }
        }
      });
    };

    const onControllerChange = () => {
      // 首次安装（页面加载时没有 controller）：claim 引发的 cc 无需刷新
      if (!hadControllerRef.current) {
        hadControllerRef.current = true;
        queryControllerVersion(navigator.serviceWorker.controller);
        return;
      }
      // 新版本接管当前页：SKIP_WAITING 只可能来自用户手动或安全时机自动流程，
      // 故这里直接单次硬刷；15s 时间闸兜底防 loop。
      queryControllerVersion(navigator.serviceWorker.controller);
      hardReload(false);
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
          // sw.js 不再无条件 skipWaiting：自愈路径需显式推进 waiting worker
          if (reg.waiting) {
            try {
              reg.waiting.postMessage({ type: "SKIP_WAITING" });
            } catch {
              /* ignore */
            }
          }
          await Promise.race([takenOver, wait(SW_UPDATE_WAIT_MS)]);
        }
      } finally {
        hardReload(true);
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

    // 安全时机复算触发器：输入失焦、切后台、回前台、定时轮询
    const onFocusOut = () => evaluateAutoActivation();
    document.addEventListener("focusout", onFocusOut);

    // 回到前台时（节流）主动查一次部署，覆盖 iOS standalone 的更新节流
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        // 切走且无进行中任务：天然的无打扰激活时机
        evaluateAutoActivation();
        return;
      }
      evaluateAutoActivation();
      const now = Date.now();
      if (
        registration &&
        now - lastForegroundUpdateRef.current > FOREGROUND_UPDATE_THROTTLE_MS
      ) {
        lastForegroundUpdateRef.current = now;
        void checkForUpdates();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // 长等待兜底：守卫状态变化不一定有全局事件（各编辑器自行注册的布尔守卫），
    // 20s 轮询一次，激活判定幂等且只在 ready 态有副作用。
    safeReevalTimer = window.setInterval(() => {
      evaluateAutoActivation();
    }, SAFE_REEVAL_INTERVAL_MS);

    const register = () => {
      if (disposed) return;
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (disposed) return;
          registration = reg;
          bindRegistration(reg);
          hadControllerRef.current = Boolean(navigator.serviceWorker.controller);
          queryControllerVersion(navigator.serviceWorker.controller);

          // 冷启动时已存在 waiting worker（上次下载完未切换）：直接进入 ready
          if (reg.waiting) {
            notifyUpdateReady(reg.waiting);
          } else if (reg.installing) {
            notifyDownloadStarting();
            trackWorker(reg.installing, reg);
          } else {
            void checkForUpdates();
          }

          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            notifyDownloadStarting();
            trackWorker(installing, reg);
          });
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
      window.clearInterval(safeReevalTimer);
      window.removeEventListener("load", register);
      window.removeEventListener("followup-started", onFollowupStarted);
      window.removeEventListener("followup-fired", onFollowupFired);
      window.removeEventListener("weixin-generating", onWeixinGenerating);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
      unregisterBusyGuard();
      bindRegistration(null);
    };
    // 引擎 effect 全程只挂载一次；状态订阅走 store，不作为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const display = getDisplayStatus(updateState);
  if (!shouldShowReadyToast(updateState)) return null;
  const waitingSafe = display === "waiting-safe";

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="应用更新提示"
      className="su-ready-toast"
    >
      <span className="su-ready-icon" aria-hidden>
        {waitingSafe ? (
          <PearlSymbol name="clock" size={18} strokeWidth={1.9} />
        ) : (
          <PearlSymbol name="download" size={18} strokeWidth={1.9} />
        )}
      </span>
      <span className="su-ready-copy">
        <span className="su-ready-title">
          {waitingSafe ? "更新将在安全时机完成" : "新版本已就绪"}
        </span>
        <span className="su-ready-sub">
          {waitingSafe
            ? updateState.blockedReason ?? "有进行中的任务，结束后自动切换"
            : "新版本已下载完成，点击立即更新切换"}
        </span>
      </span>
      <button
        type="button"
        className="su-ready-later"
        onClick={() => dismissReadyToast()}
      >
        稍后
      </button>
      <button
        type="button"
        className="su-ready-apply"
        onClick={() => activateNow()}
      >
        立即更新
      </button>
    </div>
  );
}
