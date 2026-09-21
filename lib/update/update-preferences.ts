/**
 * 软件更新偏好（System Update 模块）。
 *
 * autoUpdate（默认开启）：
 * - true  = 检测并下载新版本后，仅在安全时机激活（见 pwa-update-guard 守卫）；
 * - false = 只检测/下载，停留「新版本已就绪」，等用户点「立即更新」。
 * 持久化走项目统一 kv-db（localStorage 为底，含 IDB 迁移），不使用独立存储。
 */

import { kvGet, kvSet, registerKvMigration } from "../kv-db";

const AUTO_UPDATE_KEY = "linh-pocket-auto-update-v1";
registerKvMigration(AUTO_UPDATE_KEY);

export const AUTO_UPDATE_CHANGED_EVENT = "linh-pocket-auto-update-changed";

export function loadAutoUpdate(): boolean {
  try {
    if (typeof window === "undefined") return true;
    // 未写入过时默认开启（沿用既有"安全时机自动刷新"行为）
    return kvGet(AUTO_UPDATE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveAutoUpdate(on: boolean): void {
  try {
    kvSet(AUTO_UPDATE_KEY, on ? "1" : "0");
    window.dispatchEvent(new CustomEvent(AUTO_UPDATE_CHANGED_EVENT, { detail: { autoUpdate: on } }));
  } catch {
    // 隐私模式 / 配额异常：偏好本次会话仍生效，忽略持久化失败
  }
}
