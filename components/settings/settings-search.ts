// 设置本地搜索索引（0.8.0 T4）。
// 纯前端本地匹配：标题 + 副标题 + 关键词，不做远程检索、不上报输入。
// 新增子页时在 SETTINGS_SEARCH_INDEX 补一条即可，首页分组与搜索自动同步。

export type SettingsSearchEntry = {
  /** PhoneSettingsApp SubPage id。 */
  page: string;
  /** 二级 tab（可选），如资源库记忆页。 */
  tab?: string;
  title: string;
  desc: string;
  /** 搜索关键词（含别称、旧名称），中文按包含匹配。 */
  keywords: string[];
};

// ── 规定的 16 个关键词覆盖矩阵（AC-8 / FR-5）─────────────────────
//  外观      → appearance（外观与主题，旧主题 App 兼容承载，T5 抽共享组件）
//  壁纸      → appearance
//  锁屏      → lock（锁屏与状态栏，T12 接入完整能力）
//  图标      → appearance（图标皮肤/Dock 皮肤在主题能力内）
//  世界卷宗  → worldCharacters（T6/T7 落地为卷宗页，T4 由旧角色入口承载）
//  世界书    → worldbook
//  角色      → worldCharacters
//  记忆      → worldResources?tab=memory
//  API       → api
//  视觉 API  → vision（T10 文件智能层接入）
//  小淮宝    → mascot（AI 与全局助手，T8/T9 落地）
//  工坊      → mascot
//  云服务    → cloud
//  微信      → weixin
//  备份      → cloud（云服务三合一：备份桶/微信/推送）
//  推送      → cloud
export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  {
    page: "appearance",
    title: "外观与主题",
    desc: "浅色深色、主题色、壁纸、图标、字体与玻璃风格",
    keywords: ["外观", "主题", "壁纸", "图标", "皮肤", "深色", "浅色", "暗色", "颜色", "主题色", "字体", "玻璃", "dock", "桌面", "css", "样式"],
  },
  {
    page: "lock",
    title: "锁屏与状态栏",
    desc: "锁屏壁纸、锁屏组件、密码与状态栏",
    keywords: ["锁屏", "状态栏", "密码", "锁机", "解锁", "锁屏壁纸", "锁屏组件", "passcode"],
  },
  {
    page: "display",
    title: "显示与亮度",
    desc: "亮度与显示效果偏好",
    keywords: ["显示", "亮度", "屏幕", "明暗"],
  },
  {
    page: "sound",
    title: "声音与触感",
    desc: "铃声、提示音与震动偏好",
    keywords: ["声音", "音量", "触感", "震动", "铃声", "提示音"],
  },
  {
    page: "worldCharacters",
    title: "角色与世界",
    desc: "角色档案与世界卷宗",
    keywords: ["世界卷宗", "卷宗", "世界", "角色", "人物", "人设", "立绘", "头像", "character", "world"],
  },
  {
    page: "worldResources",
    tab: "memory",
    title: "记忆与上下文",
    desc: "角色记忆库",
    keywords: ["记忆", "记忆库", "上下文", "回忆", "memory"],
  },
  {
    page: "worldResources",
    title: "资源库",
    desc: "记忆库与漫卷资源（场景、立绘素材）",
    keywords: ["资源", "资源库", "漫卷", "立绘", "场景", "素材", "vn", "assets"],
  },
  {
    page: "worldResources",
    title: "全局资源",
    desc: "不属任何世界的资源与素材（数据与存储分组入口）",
    keywords: ["全局资源", "全局", "无世界", "未分类资源", "global"],
  },
  {
    page: "mascot",
    title: "AI 与全局助手",
    desc: "小淮宝与工坊的助手能力",
    keywords: ["小淮宝", "工坊", "助手", "全局助手", "mascot", "qa", "系统动作"],
  },
  {
    page: "api",
    title: "API 设置",
    desc: "大模型对话接口",
    keywords: ["api", "接口", "大模型", "模型", "密钥", "key", "baseurl", "对话"],
  },
  {
    page: "voice",
    title: "语音 API",
    desc: "语音合成接口",
    keywords: ["语音", "tts", "朗读", "合成声音", "配音"],
  },
  {
    page: "imageGeneration",
    title: "图像生成 API",
    desc: "图像模型、参考图与提示词",
    keywords: ["图像", "画图", "生图", "图片生成", "参考图", "绘图"],
  },
  {
    page: "vision",
    title: "视觉识别",
    desc: "图片与文件的 AI 视觉识别",
    keywords: ["视觉", "视觉api", "识别", "看图", "图片理解", "ocr", "vision"],
  },
  {
    page: "presets",
    title: "预设",
    desc: "角色预设",
    keywords: ["预设", "preset", "角色预设", "模板"],
  },
  {
    page: "worldbook",
    title: "世界书",
    desc: "为 AI 提供触发式设定与上下文",
    keywords: ["世界书", "世界观", "设定", "触发", "worldbook", "lorebook"],
  },
  {
    page: "regex",
    title: "正则规则",
    desc: "文本替换规则",
    keywords: ["正则", "替换", "regex", "文本替换", "规则"],
  },
  {
    page: "binding",
    title: "配置绑定",
    desc: "全局默认、角色与应用的配置绑定关系",
    keywords: ["绑定", "配置绑定", "binding", "默认配置", "关联"],
  },
  {
    page: "agentComputer",
    title: "角色电脑",
    desc: "云端小电脑（自部署）",
    keywords: ["角色电脑", "云端电脑", "小电脑", "computer", "自部署"],
  },
  {
    page: "data",
    title: "数据与存储",
    desc: "本地数据、导入与导出",
    keywords: ["数据", "存储", "导入", "导出", "备份数据", "迁移", "data", "存档", "下载数据"],
  },
  {
    page: "cloud",
    title: "云服务与备份",
    desc: "备份桶 / 微信 / 离线推送一站配置",
    keywords: ["云服务", "云", "备份", "推送", "离线推送", "云端备份", "supabase", "部署", "cloud"],
  },
  {
    page: "weixin",
    title: "微信接入",
    desc: "iLink Bot 微信桥接",
    keywords: ["微信", "weixin", "wechat", "ilink", "bot", "公众号"],
  },
  {
    page: "notifications",
    title: "通知与后台",
    desc: "通知、后台保活与离线推送",
    keywords: ["通知", "后台", "保活", "推送", "消息提醒", "notification", "常驻"],
  },
  {
    page: "toolbox",
    title: "工具箱",
    desc: "聊天外部工具调用",
    keywords: ["工具箱", "工具", "外部工具", "tool", "toolbox", "函数调用"],
  },
  {
    page: "accessibility",
    title: "辅助功能",
    desc: "时间感知、提示词查看器、快捷操作与悬浮球",
    keywords: ["辅助", "无障碍", "时间感知", "提示词", "快捷操作", "悬浮球", "贴边", "accessibility"],
  },
  {
    page: "moderation",
    title: "管理中心",
    desc: "举报队列、应用审核与用户封禁（管理员）",
    keywords: ["管理", "审核", "举报", "封禁", "moderation", "管理员"],
  },
  {
    page: "general",
    title: "通用",
    desc: "更新日志与版本信息",
    keywords: ["通用", "更新", "更新日志", "版本", "日志", "changelog", "升级", "general"],
  },
  {
    page: "identity",
    title: "用户身份",
    desc: "个人信息",
    keywords: ["身份", "用户", "个人信息", "昵称", "identity", "profile"],
  },
  {
    page: "about",
    title: "关于与声明",
    desc: "版本、协议与声明",
    keywords: ["关于", "声明", "协议", "版权", "about", "terms", "版本"],
  },
];

// page+tab 去重（同一子页可被多个关键词命中，结果只出现一次）
// 排序：标题命中 > 副标题命中 > 关键词命中；同级保持索引顺序（稳定排序）。
export function searchSettings(query: string): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const hits: Array<{ entry: SettingsSearchEntry; tier: number }> = [];
  for (const entry of SETTINGS_SEARCH_INDEX) {
    const title = entry.title.toLowerCase();
    const desc = entry.desc.toLowerCase();
    const keywordHit = entry.keywords.some(k => k.toLowerCase().includes(q));
    let tier = -1;
    if (title.includes(q)) tier = 0;
    else if (desc.includes(q)) tier = 1;
    else if (keywordHit) tier = 2;
    if (tier >= 0) {
      const key = `${entry.page}:${entry.tab ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({ entry, tier });
      }
    }
  }
  return hits.sort((a, b) => a.tier - b.tier).map(h => h.entry);
}
