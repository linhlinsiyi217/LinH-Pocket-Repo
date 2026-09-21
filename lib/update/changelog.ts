/**
 * LinH Pocket 更新日志 —— 全仓唯一结构化数据源（System Update 模块）。
 *
 * 规则：
 * - 新版本发布时在 CHANGELOG 头部插入一条，同时升 lib/version-info.ts 的 APP_VERSION，
 *   并按 public/sw.js 头部规则 bump CACHE_VERSION；三处必须同步（dev 下有不变量断言）。
 * - 禁止在 UI 内另维护版本日志：更新日志弹窗、设置 → 软件更新页都只从本文件取数。
 * - 条目按 新增 / 优化 / 修复 / 已知问题 四组维护；没有内容的分组给空数组。
 * - 分组色仅允许出现在更新日志语境（弹窗、更新中心），其余界面保持单色。
 */

export type ChangelogSectionKey = "added" | "improved" | "fixed" | "knownIssues";

export interface ReleaseEntry {
  /** 语义化三段版本号，如 "0.7.0"；必须与发布版本、APP_VERSION 一致。 */
  version: string;
  /** 发布日期 YYYY-MM-DD。 */
  date: string;
  /** 版本主题（一句话）。 */
  title: string;
  /** 版本概述（1~2 句），用于更新中心首页卡片。 */
  summary: string;
  /** 新功能。 */
  added: string[];
  /** 体验优化 / 调整。 */
  improved: string[];
  /** 问题修复。 */
  fixed: string[];
  /** 已知问题（随版本告知用户，无则空数组）。 */
  knownIssues: string[];
}

export const CHANGELOG_SECTION_META: Record<
  ChangelogSectionKey,
  { label: string; color: string }
> = {
  added: { label: "新增", color: "#34c759" },
  improved: { label: "优化", color: "#0a84ff" },
  fixed: { label: "修复", color: "#ff3b30" },
  knownIssues: { label: "已知问题", color: "#ff9f0a" },
};

/** 完整更新日志，新的在前。 */
export const CHANGELOG: ReleaseEntry[] = [
  {
    version: "0.7.0",
    date: "2026-09-18",
    title: "Pearl Glass 全局统一",
    summary: "全机视觉统一到同一套 Pearl Glass 珍珠玻璃设计系统，并修复 Android 安装版状态栏问题。",
    added: [],
    improved: [
      "统一全机 Pearl Glass 珍珠玻璃：桌面图标、Dock、文件夹与小组件改用同一套模糊/圆角/珍珠描边令牌，去除默认紫色与粉色染色和发光，未选主色时全部为中性玻璃",
      "统一主色派生与页面背景层级：图标玻璃染色纳入种子色系统，锁屏底色改用语义色板，锁屏、桌面、设置与按钮严格同属一个色彩家族",
      "统一交互动效：图标与按钮按压改为克制的缩放反馈与标准曲线，桌面松手归位使用 settle 曲线，并完善减弱动态效果（reduced motion）下的表现",
    ],
    fixed: [
      "修复 Android 安装 PWA 的顶部黑条与双状态栏：系统将自动识别 standalone/fullscreen 安装模式，隐藏模拟状态栏并按刘海安全区（env safe-area）避让，页面背景延伸至系统区，首帧不再闪现双状态栏",
    ],
    knownIssues: [],
  },
  {
    version: "0.6.2",
    date: "2026-09-19",
    title: "主题色系统与设置页修复",
    summary: "统一全局主题色派生体系，修复顶部安全区变黑与锁屏密码条目挤压。",
    added: [],
    improved: [
      "统一全局主题色系统：主色作为单一种子色派生出强调、染面、壁纸/锁屏着色等语义 token，桌面、锁屏、设置与按钮同属一个色彩家族，壁纸仅轻度着色",
    ],
    fixed: [
      "修复设置等页面顶部黑色安全区：manifest 主题/背景色改为浅色、壳层背景链统一，浅色页顶部不再突兀变黑，深色页一体化",
      "修复「锁屏密码」设置页条目挤压：改为规范双行布局（图标固定 / 正文伸缩 / 尾部固定），副标题支持换行、底部说明文案正常多行，多种宽度下不再重叠",
    ],
    knownIssues: [],
  },
  {
    version: "0.6.1",
    date: "2026-09-18",
    title: "面板式主色取色器",
    summary: "「显示与颜色」的主色调选择升级为可长按拖动的面板式取色器。",
    added: [],
    improved: [
      "「显示与颜色」的主色调选择重做为面板式取色器：支持在颜色面板上长按拖动连续取色、轻点直选，提供格线 / 光谱 / 滑杆三种模式与实时 HEX 预览，原预设色保留为底部小色点快捷入口",
    ],
    fixed: [],
    knownIssues: [],
  },
  {
    version: "0.6.0",
    date: "2026-09-18",
    title: "iOS 风格锁屏密码",
    summary: "新增数字锁屏密码与上滑解锁手势，PWA 安装后获得沉浸式系统体验。",
    added: [
      "新增 iOS 风格锁屏密码：支持 4 位 / 6 位数字密码、圆形大按键、错误轻晃提示与触觉反馈；设置 → 安全 → 锁屏密码中可开启、修改、关闭与切换位数",
      "锁屏改为 iOS 式向上轻扫解锁：页面随手跟动、距离或速度达标顺势离场、未达标轻微回弹，手势可随时打断",
    ],
    improved: [
      "全屏策略改为 PWA 优先：安装到桌面后由系统提供沉浸界面，不再在普通网页里反复请求 Fullscreen；离开应用超过 30 秒自动重新锁屏",
    ],
    fixed: [
      "修复 Android Chrome / PWA 下锁屏大时间「02:20」数字重叠：改为等宽数字整体排版 + 响应式字号，任何字体回退都不重叠、不溢出",
    ],
    knownIssues: [],
  },
  {
    version: "0.5.0",
    date: "2026-09-18",
    title: "深色模式与全局主色调",
    summary: "一键切换日间 / 夜间模式，并可在 8 种韩系预设色与自定义取色间选择全局主色。",
    added: [
      "美化应用新增「显示与颜色」：一键切换日间 / 夜间模式，标题栏、卡片、弹窗、设置、长按菜单等界面自动反色，文字图标始终清晰",
      "新增全局主色调：8 种韩系预设色 + 自定义取色，按钮、高亮、开关、聊天气泡实时变色，并按亮度自动计算黑白反色",
    ],
    improved: [
      "夜间模式下珍珠玻璃弹窗与设置卡片同步转为深色液态玻璃，桌面壁纸与图标皮肤等个性化主题完全不受影响",
    ],
    fixed: [],
    knownIssues: [],
  },
  {
    version: "0.4.0",
    date: "2026-09-18",
    title: "珍珠玻璃浮层体系",
    summary: "底部弹层、居中弹窗与聊天长按菜单统一为珍珠玻璃质感。",
    added: [],
    improved: [
      "全局底部弹层（Action Sheet）与居中弹窗重做：36px 珍珠毛玻璃、顶部发丝亮边、双层柔光投影，底部自动避让手势条",
      "聊天消息长按菜单由深灰胶囊改为珍珠玻璃浮层，菜单项按压有弹性反馈，删除等危险项保留红色",
    ],
    fixed: [],
    knownIssues: [],
  },
  {
    version: "0.3.0",
    date: "2026-09-18",
    title: "桌面组件玻璃化",
    summary: "主屏幕小组件面板、页面指示点与 Dock 底板升级为珍珠玻璃。",
    added: [],
    improved: [
      "主屏幕「添加小组件」面板重做：珍珠玻璃底板、发丝亮边与柔和投影，列表项按压弹性回弹",
      "主屏幕页面指示点改为中性珍珠白，去除旧的偏绿色",
      "非玻璃质感主题下的 Dock 底板升级为珍珠毛玻璃（玻璃/皮肤/描边主题保持原样）",
    ],
    fixed: [],
    knownIssues: [],
  },
  {
    version: "0.2.2",
    date: "2026-09-18",
    title: "设置页珍珠玻璃质感",
    summary: "设置页卡片改用珍珠玻璃，悬停微浮起、按压物理回弹。",
    added: [],
    improved: [
      "设置页卡片全面改用珍珠玻璃质感，悬停微浮起、按压物理回弹更细腻",
    ],
    fixed: [],
    knownIssues: [],
  },
  {
    version: "0.2.1",
    date: "2026-09-18",
    title: "Pearl Glass 设计系统注入",
    summary: "全局注入 Pearl Glass 珍珠玻璃设计系统，全新 iOS 韩系珍珠玻璃锁屏同步亮相。",
    added: [
      "全局注入 Pearl Glass 珍珠玻璃设计系统：统一玻璃卡片、玻璃按钮、玻璃弹窗与排版令牌",
      "锁屏手电筒、相机按钮升级为圆形玻璃按钮，按压缩放回弹，手电筒开启时变深发光",
    ],
    improved: [
      "集成全新 iOS 韩系珍珠玻璃锁屏，银白液态玻璃质感与微光组件",
      "锁屏顶部状态栏与主界面完全统一：同款时间、信号、Wi-Fi、电量样式与配色变量",
      "更新日志弹窗改用统一玻璃模态面板，四色标签升级为微光胶囊",
      "设置页分组、选项行与分区标题开始套用 Pearl Glass 玻璃样式",
      "放弃状态栏涂黑方案，壁纸与背景现可完整延伸至系统栏下方",
    ],
    fixed: [
      "修复开屏动画结束后偶发白屏：CSS 加载顺序导致白底覆盖锁屏底色",
      "改用 visualViewport 动态视口高度，内容分层避让安全区，根除安卓全面屏顶部与底部白条",
    ],
    knownIssues: [],
  },
  {
    version: "0.2.0",
    date: "2026-09-17",
    title: "首版珍珠锁屏",
    summary: "LinH Pocket 首个带开屏动画与仿 iOS 锁屏的版本，并内置版本更新弹窗。",
    added: [
      "LinH Pocket 专属极简开屏动画：纯黑底玻璃质感 Logo 呼吸发光",
      "新增仿 iOS 锁屏：超大纤细时钟与日期，支持向上滑动解锁",
      "新增版本更新弹窗，设置内可随时查看完整更新日志",
    ],
    improved: [
      "启动流程调整为：开屏动画 → 锁屏 → 上滑解锁 → 主页",
      "筑境页面高度改用 100dvh 动态视口，消除全屏高度缝隙",
    ],
    fixed: [
      "修复安卓 PWA 全屏时顶部白条，状态栏区域统一融入纯黑背景",
    ],
    knownIssues: [],
  },
];

/** 最新一次发布（更新中心首屏卡片数据源）。 */
export const LATEST_RELEASE: ReleaseEntry = CHANGELOG[0];
