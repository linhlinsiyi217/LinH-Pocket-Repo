/**
 * LinH Pocket 版本与更新日志（纯前端）。
 *
 * 规则（见 PROJECT_RULES.md 第三、四章）：
 * - 每次打开 App 比对 localStorage 已读版本；当前版本更新（含补丁）即视为未读，
 *   新老用户都会弹更新日志弹窗。
 * - 标签四色：新增 #34c759 / 修复 #ff3b30 / 调整 #0a84ff / 补丁 #bf5af2。
 *   彩色只允许出现在更新日志面板与更新弹窗。
 */

export const APP_VERSION = "0.6.1";

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
    version: "0.6.1",
    date: "2026-09-18",
    entries: [
      { kind: "adjust", text: "「显示与颜色」的主色调选择重做为面板式取色器：支持在颜色面板上长按拖动连续取色、轻点直选，提供格线 / 光谱 / 滑杆三种模式与实时 HEX 预览，原预设色保留为底部小色点快捷入口" },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-09-18",
    entries: [
      { kind: "feature", text: "新增 iOS 风格锁屏密码：支持 4 位 / 6 位数字密码、圆形大按键、错误轻晃提示与触觉反馈；设置 → 安全 → 锁屏密码中可开启、修改、关闭与切换位数" },
      { kind: "feature", text: "锁屏改为 iOS 式向上轻扫解锁：页面随手跟动、距离或速度达标顺势离场、未达标轻微回弹，手势可随时打断" },
      { kind: "fix", text: "修复 Android Chrome / PWA 下锁屏大时间「02:20」数字重叠：改为等宽数字整体排版 + 响应式字号，任何字体回退都不重叠、不溢出" },
      { kind: "adjust", text: "全屏策略改为 PWA 优先：安装到桌面后由系统提供沉浸界面，不再在普通网页里反复请求 Fullscreen；离开应用超过 30 秒自动重新锁屏" },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-09-18",
    entries: [
      { kind: "feature", text: "美化应用新增「显示与颜色」：一键切换日间 / 夜间模式，标题栏、卡片、弹窗、设置、长按菜单等界面自动反色，文字图标始终清晰" },
      { kind: "feature", text: "新增全局主色调：8 种韩系预设色 + 自定义取色，按钮、高亮、开关、聊天气泡实时变色，并按亮度自动计算黑白反色" },
      { kind: "adjust", text: "夜间模式下珍珠玻璃弹窗与设置卡片同步转为深色液态玻璃，桌面壁纸与图标皮肤等个性化主题完全不受影响" },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-09-18",
    entries: [
      { kind: "adjust", text: "全局底部弹层（Action Sheet）与居中弹窗重做：36px 珍珠毛玻璃、顶部发丝亮边、双层柔光投影，底部自动避让手势条" },
      { kind: "adjust", text: "聊天消息长按菜单由深灰胶囊改为珍珠玻璃浮层，菜单项按压有弹性反馈，删除等危险项保留红色" },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-18",
    entries: [
      { kind: "adjust", text: "主屏幕「添加小组件」面板重做：珍珠玻璃底板、发丝亮边与柔和投影，列表项按压弹性回弹" },
      { kind: "adjust", text: "主屏幕页面指示点改为中性珍珠白，去除旧的偏绿色" },
      { kind: "adjust", text: "非玻璃质感主题下的 Dock 底板升级为珍珠毛玻璃（玻璃/皮肤/描边主题保持原样）" },
    ],
  },
  {
    version: "0.2.2",
    date: "2026-09-18",
    entries: [
      { kind: "adjust", text: "设置页卡片全面改用珍珠玻璃质感，悬停微浮起、按压物理回弹更细腻" },
    ],
  },
  {
    version: "0.2.1",
    date: "2026-09-18",
    entries: [
      { kind: "feature", text: "全局注入 Pearl Glass 珍珠玻璃设计系统：统一玻璃卡片、玻璃按钮、玻璃弹窗与排版令牌" },
      { kind: "feature", text: "锁屏手电筒、相机按钮升级为圆形玻璃按钮，按压缩放回弹，手电筒开启时变深发光" },
      { kind: "adjust", text: "集成全新 iOS 韩系珍珠玻璃锁屏，银白液态玻璃质感与微光组件" },
      { kind: "adjust", text: "锁屏顶部状态栏与主界面完全统一：同款时间、信号、Wi-Fi、电量样式与配色变量" },
      { kind: "adjust", text: "更新日志弹窗改用统一玻璃模态面板，四色标签升级为微光胶囊" },
      { kind: "adjust", text: "设置页分组、选项行与分区标题开始套用 Pearl Glass 玻璃样式" },
      { kind: "fix", text: "修复开屏动画结束后偶发白屏：CSS 加载顺序导致白底覆盖锁屏底色" },
      { kind: "fix", text: "改用 visualViewport 动态视口高度，内容分层避让安全区，根除安卓全面屏顶部与底部白条" },
      { kind: "patch", text: "放弃状态栏涂黑方案，壁纸与背景现可完整延伸至系统栏下方" },
    ],
  },
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
