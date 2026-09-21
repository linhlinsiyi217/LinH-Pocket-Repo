/**
 * LinH Pocket 版本信息（纯前端）。
 *
 * - APP_VERSION 是全仓唯一应用版本常量；更新日志的结构化数据源在
 *   lib/update/changelog.ts（CHANGELOG），发版时两处必须同步，
 *   dev 下以不变量断言强制校验（见文件尾部）。
 * - 每次打开 App 比对 localStorage 已读版本；当前版本更新（含补丁）即视为未读，
 *   更新中心入口显示小圆点（更新日志弹窗不再进主页自动弹出，由用户主动打开）。
 */

import { CHANGELOG } from "./update/changelog";

export const APP_VERSION = "0.7.0";

const READ_VERSION_KEY = "linh-pocket-changelog-read-version";
export const UPDATE_UNREAD_CHANGED_EVENT = "linh-pocket-update-unread-changed";

/** 取版本号数字段，忽略预发布后缀；非法值返回 null。 */
function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** a > b 返回 1，a < b 返回 -1，相等或无法比较返回 0。 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a === b ? 0 : 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

export function getReadChangelogVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(READ_VERSION_KEY);
  } catch {
    return null;
  }
}

/** 有未读更新：没有已读记录（新用户）或当前版本比已读版本新（老用户/新补丁）。 */
export function isUpdateUnread(): boolean {
  const read = getReadChangelogVersion();
  if (!read) return true;
  return compareVersions(APP_VERSION, read) > 0;
}

/** 写入已读并广播，小圆点订阅后即时消失。 */
export function markUpdateRead(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_VERSION_KEY, APP_VERSION);
    window.dispatchEvent(new CustomEvent(UPDATE_UNREAD_CHANGED_EVENT, { detail: { unread: false } }));
  } catch {
    // localStorage 不可用（隐私模式等）时静默忽略，不影响进入主界面
  }
}

/**
 * 发版同步不变量：CHANGELOG 头部版本必须与 APP_VERSION 一致。
 * 仅在浏览器 dev 环境校验，不一致时 console.error 提醒发版者，不影响用户使用。
 */
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const latestLoggedVersion = CHANGELOG[0]?.version;
  if (latestLoggedVersion !== APP_VERSION) {
    // eslint-disable-next-line no-console
    console.error(
      `[版本同步] APP_VERSION=${APP_VERSION} 与 CHANGELOG 头部版本 v${latestLoggedVersion} 不一致，发版前必须同步 lib/version-info.ts、lib/update/changelog.ts 与 public/sw.js 的 CACHE_VERSION。`,
    );
  }
}
