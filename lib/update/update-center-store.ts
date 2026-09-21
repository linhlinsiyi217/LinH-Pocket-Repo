/**
 * 软件更新中心 —— 框架无关的单一状态机（System Update 模块）。
 *
 * 数据流：
 *   public/sw.js（waiting/消息协议）
 *     └─ components/pwa-registrar.tsx（SW 事件引擎，驱动本 store）
 *          └─ updateCenter（本文件：状态、偏好动作、安全时机决策）
 *               ├─ components/settings/software-update.tsx（更新中心页）
 *               └─ components/pwa-registrar.tsx 的 ready 浮层
 *
 * 不变量：
 * - autoUpdate=false：检测/下载照常，永不自动发 SKIP_WAITING、永不自动 reload；
 * - autoUpdate=true：仅 isSafeToAutoActivate() 时激活（守卫：聊天生成 / 输入草稿 /
 *   角色卷宗编辑 / 文件上传 / 后台任务），阻塞时进入 waiting-safe 等待安全时机；
 * - 任何失败都保留当前稳定版本（SW install 失败原生留在旧 worker），不阻断启动；
 * - 本模块不清理任何 IDB / localStorage / sessionStorage 用户数据。
 */

import { useSyncExternalStore } from "react";

import { hasFocusedDraft, isSafeToAutoActivate } from "../pwa-update-guard";
import {
  AUTO_UPDATE_CHANGED_EVENT,
  loadAutoUpdate,
  saveAutoUpdate,
} from "./update-preferences";

export type UpdatePhase =
  | "idle" // 已注册，尚未完成首轮检查
  | "checking" // 正在向部署查询更新
  | "downloading" // 发现新 SW，installing（预缓存中）
  | "ready" // 新 SW 停在 waiting：下载完成，尚未切换
  | "activating" // 已发 SKIP_WAITING，等待接管/刷新
  | "latest" // 检查完成，当前即最新
  | "error" // 检查或下载失败，当前稳定版本继续可用
  | "offline" // 离线且没有已就绪的更新
  | "unsupported"; // dev / 浏览器不支持 SW

export interface UpdateCenterState {
  supported: boolean;
  online: boolean;
  phase: UpdatePhase;
  autoUpdate: boolean;
  /** waiting-safe 时的阻塞原因文案；非阻塞为 null。 */
  blockedReason: string | null;
  /** 当前接管页面的 SW 缓存代际，如 ai-phone-pwa-v20；未接管为 null。 */
  cacheVersion: string | null;
  /** waiting 中新 SW 的缓存代际（用于"新版本"展示）。 */
  readyVersion: string | null;
  /** Next.js 构建 ID（window.__NEXT_DATA__.buildId）。 */
  buildId: string | null;
  lastChecked: number | null;
  errorMessage: string | null;
  /** ready 浮层被用户点「稍后」临时关闭（离开 ready 态自动复位）。 */
  toastDismissed: boolean;
}

/** UI 直接消费的展示态（六状态 + 过程态）。 */
export type UpdateDisplayStatus =
  | "unsupported"
  | "offline"
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "waiting-safe"
  | "activating"
  | "latest"
  | "error";

const initialState: UpdateCenterState = {
  supported: false,
  online: true,
  phase: "idle",
  autoUpdate: true,
  blockedReason: null,
  cacheVersion: null,
  readyVersion: null,
  buildId: null,
  lastChecked: null,
  errorMessage: null,
  toastDismissed: false,
};

let state: UpdateCenterState = initialState;
const listeners = new Set<() => void>();

function setState(patch: Partial<UpdateCenterState>): void {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function subscribeUpdateCenter(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUpdateCenterState(): UpdateCenterState {
  return state;
}

/** React 订阅入口（设置页 / ready 浮层共用同一份状态）。 */
export function useUpdateCenter(): UpdateCenterState {
  // 初始化统一由 pwa-registrar 的 effect（水合后）完成，避免服务端/首帧快照不一致。
  // SSR 期返回常量 initialState，防止 useSyncExternalStore 缺 getServerSnapshot 报错。
  return useSyncExternalStore(subscribeUpdateCenter, getUpdateCenterState, () => initialState);
}

// ── 引擎句柄（由 pwa-registrar 注入） ──────────────────────────

let registration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
let hardReload: ((manual: boolean) => void) | null = null;
let initialized = false;
let checkSettleTimer: number | null = null;
let autoActivateFallbackTimer: number | null = null;

const CHECK_SETTLE_MS = 2000;
const ACTIVATE_FALLBACK_MS = 4000;

function readBuildId(): string | null {
  try {
    const data = (window as unknown as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__;
    return typeof data?.buildId === "string" ? data.buildId : null;
  } catch {
    return null;
  }
}

/** 包成函数避免 TS 对 navigator.onLine 在 await 后仍保持字面量收窄。 */
function isOfflineNow(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function detectSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    process.env.NODE_ENV === "production"
  );
}

/**
 * 由 pwa-registrar 在水合后调用一次：注入能力位、偏好、构建号，
 * 挂全局联网状态监听。不在 hook 内做，避免 SSR/首帧快照不一致。
 */
export function initUpdateCenter(supported?: boolean): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const capable = supported ?? detectSupported();
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  setState({
    supported: capable,
    online,
    autoUpdate: loadAutoUpdate(),
    buildId: readBuildId(),
    phase: capable ? (online ? "idle" : "offline") : "unsupported",
  });

  window.addEventListener("offline", () => {
    // 不覆盖 downloading / ready / activating：恢复后链路继续
    setState({ online: false });
  });
  window.addEventListener("online", () => {
    setState({ online: true });
    // 「恢复网络后检查更新」：离线期间未结算 / 失败过的自动重试
    if (state.phase === "offline" || state.phase === "error") {
      void checkForUpdates();
    }
  });

  // 跨标签页 / 其他写入点改动自动更新偏好时同步本页状态
  window.addEventListener(AUTO_UPDATE_CHANGED_EVENT, () => {
    setState({ autoUpdate: loadAutoUpdate() });
    evaluateAutoActivation();
  });
}

/** pwa-registrar 注入防 loop 的硬刷新实现（manual=用户显式操作，绕过时间闸）。 */
export function bindUpdateEngine(engine: { hardReload: (manual: boolean) => void }): void {
  hardReload = engine.hardReload;
}

export function bindRegistration(reg: ServiceWorkerRegistration | null): void {
  registration = reg;
}

// ── SW 消息：查询 worker 自报的缓存代际 ─────────────────────────

function queryWorkerVersion(worker: ServiceWorker, kind: "controller" | "waiting"): void {
  try {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent) => {
      const version = (event.data as { version?: unknown } | null)?.version;
      if (typeof version === "string") {
        setState(kind === "controller" ? { cacheVersion: version } : { readyVersion: version });
      }
    };
    worker.postMessage({ type: "GET_CACHE_VERSION" }, [channel.port2]);
  } catch {
    // 旧 SW 不识别消息：版本行显示 "—"，不影响更新主链路
  }
}

export function queryControllerVersion(worker: ServiceWorker | null): void {
  if (worker) queryWorkerVersion(worker, "controller");
}

// ── SW 事件回调（pwa-registrar 驱动） ──────────────────────────

/** updatefound：新 SW 开始安装（预缓存下载中）。 */
export function notifyDownloadStarting(): void {
  if (autoActivateFallbackTimer) {
    window.clearTimeout(autoActivateFallbackTimer);
    autoActivateFallbackTimer = null;
  }
  setState({ phase: "downloading", readyVersion: null, blockedReason: null, errorMessage: null, toastDismissed: false });
}

/** 新 SW 安装完成停在 waiting：更新包已就绪。 */
export function notifyUpdateReady(worker: ServiceWorker): void {
  waitingWorker = worker;
  queryWorkerVersion(worker, "waiting");
  setState({
    phase: "ready",
    blockedReason: computeBlockedReason(),
    errorMessage: null,
    toastDismissed: false,
  });
  evaluateAutoActivation();
}

/** waiting worker 消失（被更新的安装顶替时由引擎重新驱动 downloading）。 */
export function notifyWaitingGone(): void {
  waitingWorker = null;
  setState({ readyVersion: null, blockedReason: null });
}

/** installing worker 失败变 redundant（下载/预缓存失败）。 */
export function notifyDownloadFailed(): void {
  waitingWorker = null;
  if (state.phase === "downloading" || state.phase === "ready") {
    setState({
      phase: "error",
      readyVersion: null,
      blockedReason: null,
      errorMessage: "新版本下载失败，当前稳定版本可继续使用，将在下次启动或联网后重试",
    });
  }
}

/** 检查结算：未发现新版本 → latest。 */
export function notifyCheckSettled(): void {
  if (state.phase === "checking" || state.phase === "idle") {
    setState({ phase: "latest", lastChecked: Date.now() });
  }
}

export function dismissReadyToast(): void {
  if (!state.toastDismissed) setState({ toastDismissed: true });
}

// ── 安全时机决策 ────────────────────────────────────────────────

function computeBlockedReason(): string | null {
  if (isSafeToAutoActivate()) return null;
  return hasFocusedDraft()
    ? "有尚未保存的输入内容"
    : "有进行中的任务（聊天生成 / 角色或卷宗编辑 / 文件上传等）";
}

/**
 * 复算自动激活：ready + autoUpdate + 安全 → 推进 waiting SW 接管；
 * 不安全 → 记录阻塞原因，等待外部触发再次复算（focusout / visibility /
 * busy 事件 / online / 定时轮询 / 偏好切换）。
 */
export function evaluateAutoActivation(): void {
  if (state.phase !== "ready" || !state.autoUpdate || !waitingWorker) {
    if (state.blockedReason) setState({ blockedReason: null });
    return;
  }
  if (!isSafeToAutoActivate()) {
    const reason = computeBlockedReason();
    if (reason !== state.blockedReason) setState({ blockedReason: reason });
    return;
  }
  setState({ phase: "activating", blockedReason: null });
  try {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } catch {
    setState({ phase: "ready", errorMessage: "无法激活新版本，请稍后重试" });
    return;
  }
  // 兜底：个别 WebView 延迟抛 controllerchange，4s 后仍由防 loop 硬刷接管
  if (autoActivateFallbackTimer) window.clearTimeout(autoActivateFallbackTimer);
  autoActivateFallbackTimer = window.setTimeout(() => {
    hardReload?.(false);
  }, ACTIVATE_FALLBACK_MS);
}

// ── 用户动作 ────────────────────────────────────────────────────

/** 手动检查更新（设置页「检查更新」/ 启动与回前台自动检查也走这里）。 */
export async function checkForUpdates(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!state.supported || !registration) return;
  if (isOfflineNow()) {
    setState({ online: false, phase: state.phase === "ready" ? "ready" : "offline" });
    return;
  }
  if (state.phase === "checking" || state.phase === "downloading" || state.phase === "activating") return;

  setState({ phase: "checking", online: true, errorMessage: null });
  try {
    await registration.update();
  } catch {
    if (isOfflineNow()) {
      setState({ online: false, phase: "offline" });
    } else {
      setState({
        phase: "error",
        errorMessage: "检查更新失败：网络不可用或更新服务暂时无法访问",
      });
    }
    return;
  }
  // 有新版本时 updatefound 已把状态推进 downloading/waiting；
  // 没有新版本则在宽限后结算为 latest（兼容 update() resolve 早于事件的情况）。
  if (checkSettleTimer) window.clearTimeout(checkSettleTimer);
  checkSettleTimer = window.setTimeout(() => {
    notifyCheckSettled();
  }, CHECK_SETTLE_MS);
}

/** 用户显式「立即更新」：跳过安全判定，直接推进并刷新。 */
export function activateNow(): void {
  if (state.phase !== "ready" || !waitingWorker) return;
  if (autoActivateFallbackTimer) {
    window.clearTimeout(autoActivateFallbackTimer);
    autoActivateFallbackTimer = null;
  }
  setState({ phase: "activating", blockedReason: null });
  try {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } catch {
    setState({ phase: "ready", errorMessage: "无法激活新版本，请稍后重试" });
    return;
  }
  // 与旧链路一致：消息发出后立即硬刷，新文档由新 SW 接管
  hardReload?.(true);
}

/** 自动更新开关（真实持久化；开启时立即复算安全时机）。 */
export function setAutoUpdatePreference(on: boolean): void {
  setState({ autoUpdate: on });
  saveAutoUpdate(on);
  if (on) evaluateAutoActivation();
}

// ── 展示态派生 ──────────────────────────────────────────────────

export function getDisplayStatus(s: UpdateCenterState = state): UpdateDisplayStatus {
  if (!s.supported) return "unsupported";
  if (s.phase === "ready") {
    return s.autoUpdate && s.blockedReason ? "waiting-safe" : "ready";
  }
  if (!s.online && s.phase !== "downloading" && s.phase !== "activating") {
    return "offline";
  }
  return s.phase;
}

/** 浮层是否可见：ready（或自动模式等待安全时机）且用户未点「稍后」。 */
export function shouldShowReadyToast(s: UpdateCenterState = state): boolean {
  if (s.toastDismissed) return false;
  const display = getDisplayStatus(s);
  return display === "ready" || display === "waiting-safe";
}
