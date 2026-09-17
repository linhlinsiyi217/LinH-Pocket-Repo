/**
 * LinH Pocket 版本与更新日志（纯前端）。
 *
 * 规则（见 PROJECT_RULES.md 第三、四章）：
 * - 每次打开 App 比对 localStorage 已读版本；当前版本更新（含补丁）即视为未读，
 *   新老用户都会弹更新日志弹窗。
 * - 标签四色：新增 #34c759 / 修复 #ff3b30 / 调整 #0a84ff / 补丁 #bf5af2。
 *   彩色只允许出现在更新日志面板与更新弹窗。
 */

export const APP_VERSION = "0.2.0";

export type ChangelogKind = "feature" | "fix" | "adjust" | "patch";

export type ChangelogEntry = {
  kind: ChangelogKind;
  text: string;
};

export type ReleaseNote = {
  version: string;
  date: string;
  entries: ChangelogEntry[];
};

export const CHANGELOG_KIND_META: Record<ChangelogKind, { label: string; color: string }> = {
  feature: { label: "新增", color: "#34c759" },
  fix: { label: "修复", color: "#ff3b30" },
  adjust: { label: "调整", color: "#0a84ff" },
  patch: { label: "补丁", color: "#bf5af2" },
};

/** 完整更新日志，新的在前。发版时在数组头部插入新版本，同时升 APP_VERSION。 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.2.0",
    date: "2026-09-17",
    entries: [
      { kind: "feature", text: "LinH Pocket 专属极简开屏动画：纯黑底玻璃质感 Logo 呼吸发光" },
      { kind: "feature", text: "新增仿 iOS 锁屏：超大纤细时钟与日期，支持向上滑动解锁" },
      { kind: "feature", text: "新增版本更新弹窗，设置内可随时查看完整更新日志" },
      { kind: "fix", text: "修复安卓 PWA 全屏时顶部白条，状态栏区域统一融入纯黑背景" },
      { kind: "adjust", text: "启动流程调整为：开屏动画 → 锁屏 → 上滑解锁 → 主页" },
      { kind: "patch", text: "筑境页面高度改用 100dvh 动态视口，消除全屏高度缝隙" },
    ],
  },
];

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
