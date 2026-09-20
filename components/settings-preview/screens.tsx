"use client";

/* ═══════════════════════════════════════════════════════════
   T6.5 Settings Preview 屏幕集合
   - Home：按 A1-A5 新 IA 的 5 组 grouped list（preview-only 分组，
     production 迁移时再替换 SETTINGS_GROUPS）；
   - Search：复用真实 SETTINGS_SEARCH_INDEX（不重写索引/排序）；
   - Notifications：G1-G6 通知与提醒（视觉稿，本地 state，不持久化）；
   - Display：二级页 + 全局外观 token 联动演示（本地写 CSS 变量，
     production 由 Appearance Bridge 统一全局写入）。
   ═══════════════════════════════════════════════════════════ */

import { useMemo, useState, type CSSProperties } from "react";
import { SETTINGS_SEARCH_INDEX } from "@/components/settings/settings-search";
import type { PearlSymbolName } from "@/components/ui/pearl-symbol";
import { PearlSymbol } from "@/components/ui/pearl-symbol";
import {
  AccountRow,
  PearlScreen,
  SettingsGroup,
  SettingsLargeTitle,
  SettingsNavBar,
  SettingsRow,
  SettingsSearchBar,
  SettingsSearchRow,
  SettingsSectionTitle,
  SettingsToggleRow,
} from "@/components/settings/pearl-settings";

/* ── 新 IA（A1-A5）：preview 分组定义 ── */

type PreviewItem = {
  key: string;
  symbol: PearlSymbolName;
  tone?: "mono" | "wechat";
  title: string;
  sub?: string;
  value?: string;
};

type PreviewGroup = { id: string; title: string; items: PreviewItem[] };

const PREVIEW_GROUPS: PreviewGroup[] = [
  {
    id: "system-appearance",
    title: "外观与系统",
    items: [
      { key: "appearance", symbol: "appearance", title: "外观与主题" },
      { key: "display", symbol: "brightness", title: "显示与亮度" },
      { key: "lock", symbol: "lock", title: "锁屏与状态栏" },
      { key: "sound", symbol: "sound", title: "声音与触感" },
      { key: "notifications-settings", symbol: "bell", title: "通知与提醒" },
    ],
  },
  {
    id: "characters-world",
    title: "角色与世界",
    items: [
      { key: "worldCharacters", symbol: "characters", title: "角色与世界", sub: "角色档案 · 世界卷宗" },
      { key: "worldbook", symbol: "book", title: "世界书", sub: "触发式设定与 AI 上下文" },
      { key: "worldResources", symbol: "resources", title: "资源库" },
      { key: "worldResources-memory", symbol: "memory", title: "记忆与上下文" },
    ],
  },
  {
    id: "connect-model",
    title: "连接与模型",
    items: [
      { key: "apiHub", symbol: "api", title: "API 与模型" },
      { key: "voice", symbol: "voice", title: "语音" },
      { key: "vision", symbol: "vision", title: "视觉识别" },
      { key: "weixin", symbol: "wechat", tone: "wechat", title: "微信接入" },
      { key: "notifications", symbol: "background-notifications", title: "通知与后台" },
    ],
  },
  {
    id: "data",
    title: "数据",
    items: [
      { key: "data", symbol: "storage", title: "数据与存储" },
      { key: "data-export", symbol: "import-export", title: "导入与导出" },
      { key: "global-resources", symbol: "resources", title: "全局资源" },
      { key: "cloud", symbol: "cloud", title: "云服务与备份" },
    ],
  },
  {
    id: "system",
    title: "系统",
    items: [
      { key: "identity", symbol: "user", title: "用户身份" },
      { key: "accessibility", symbol: "accessibility", title: "辅助功能" },
      { key: "general", symbol: "general", title: "通用" },
      { key: "about", symbol: "about", title: "关于" },
    ],
  },
];

/* 真实搜索索引 page/tab → Pearl Symbol 映射（不重写索引，仅换图标体系） */
const SEARCH_SYMBOL_MAP: Record<string, PearlSymbolName> = {
  appearance: "appearance",
  lock: "lock",
  display: "brightness",
  sound: "sound",
  notificationsSettings: "bell",
  worldCharacters: "characters",
  worldbook: "book",
  worldResources: "resources",
  mascot: "sparkles",
  apiHub: "api",
  api: "api",
  voice: "voice",
  imageGeneration: "api",
  vision: "vision",
  presets: "archive",
  regex: "settings",
  binding: "settings",
  data: "storage",
  cloud: "cloud",
  weixin: "wechat",
  notifications: "bell",
  toolbox: "settings",
  accessibility: "accessibility",
  general: "general",
  identity: "user",
  about: "about",
  agentComputer: "api",
  moderation: "settings",
  lockPasscode: "lock",
};

/* page → 新 IA 分组面包屑（搜索路径副标题） */
const SEARCH_GROUP_MAP: Record<string, string> = {
  appearance: "外观与系统",
  lock: "外观与系统",
  display: "外观与系统",
  sound: "外观与系统",
  notificationsSettings: "外观与系统",
  worldCharacters: "角色与世界",
  worldbook: "角色与世界",
  worldResources: "角色与世界",
  apiHub: "连接与模型",
  api: "连接与模型",
  voice: "连接与模型",
  imageGeneration: "连接与模型",
  vision: "连接与模型",
  weixin: "连接与模型",
  notifications: "连接与模型",
  data: "数据",
  cloud: "数据",
  identity: "系统",
  accessibility: "系统",
  general: "系统",
  about: "系统",
  presets: "AI 与规则",
  regex: "AI 与规则",
  binding: "AI 与规则",
  agentComputer: "角色与世界",
  toolbox: "系统",
  moderation: "系统",
  lockPasscode: "外观与系统",
  mascot: "独立助手",
};

/* ── Home ── */

export function HomeScreenBody() {
  return (
    <div className="ps-scroll">
      <SettingsLargeTitle>设置</SettingsLargeTitle>
      <SettingsSearchBar value="" onChange={() => undefined} placeholder="搜索设置" />
      <SettingsGroup>
        <AccountRow name="LinH" sub="账号、云端与 LinH Pocket" />
      </SettingsGroup>

      {PREVIEW_GROUPS.map((group) => (
        <div key={group.id}>
          <SettingsSectionTitle>{group.title}</SettingsSectionTitle>
          <SettingsGroup>
            {group.items.map((item) => (
              <SettingsRow
                key={item.key}
                symbol={item.symbol}
                tone={item.tone ?? "mono"}
                title={item.title}
                sub={item.sub}
              />
            ))}
          </SettingsGroup>
        </div>
      ))}
    </div>
  );
}

/* ── Search（复用 SETTINGS_SEARCH_INDEX 真实数据） ── */

export function SearchScreenBody({ initialQuery = "世界" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SETTINGS_SEARCH_INDEX.filter((entry) =>
      [entry.title, entry.desc, ...entry.keywords].some((field) => field.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="ps-scroll">
      <SettingsLargeTitle>搜索</SettingsLargeTitle>
      <SettingsSearchBar value={query} onChange={setQuery} placeholder="搜索设置" autoFocus={false} />
      <SettingsSectionTitle>{results.length ? `结果 · ${results.length}` : "无结果"}</SettingsSectionTitle>
      <SettingsGroup>
        {results.length === 0 ? (
          <p className="ps-empty">没有找到与「{query.trim()}」相关的设置</p>
        ) : (
          results.map((entry) => (
            <SettingsSearchRow
              key={`${entry.page}:${entry.tab ?? ""}`}
              symbol={SEARCH_SYMBOL_MAP[entry.page] ?? "settings"}
              title={entry.title}
              path={`设置 > ${SEARCH_GROUP_MAP[entry.page] ?? "系统"} > ${entry.title}`}
            />
          ))
        )}
      </SettingsGroup>
    </div>
  );
}

/* ── 通知与提醒（G1-G6，视觉稿：本地 state，不写存储） ── */

type SoundSource = "default" | "none" | "url" | "upload" | "file-manager";

function SoundSourceChips({ value, onChange }: { value: SoundSource; onChange: (s: SoundSource) => void }) {
  const chips: { id: SoundSource; label: string; symbol: PearlSymbolName }[] = [
    { id: "default", label: "默认", symbol: "check" },
    { id: "none", label: "无", symbol: "close" },
    { id: "url", label: "URL", symbol: "link" },
    { id: "upload", label: "上传", symbol: "upload" },
    { id: "file-manager", label: "文件管理器", symbol: "folder-open" },
  ];
  return (
    <div className="ps-chips">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className="ps-chip"
          data-active={value === chip.id ? "true" : "false"}
          onClick={() => onChange(chip.id)}
        >
          <PearlSymbol name={chip.symbol} size={13} strokeWidth={1.9} />
          {chip.label}
        </button>
      ))}
    </div>
  );
}

function MediaActions({ canDelete }: { canDelete: boolean }) {
  return (
    <div className="ps-media-actions">
      <button type="button" className="ps-btn"><PearlSymbol name="play" size={13} strokeWidth={2} />试听</button>
      <button type="button" className="ps-btn"><PearlSymbol name="stop" size={11} strokeWidth={2.2} />停止</button>
      <button type="button" className="ps-btn ps-btn--danger" disabled={!canDelete}>
        <PearlSymbol name="trash" size={13} strokeWidth={1.9} />删除
      </button>
      <button type="button" className="ps-btn" disabled={canDelete}>恢复默认</button>
    </div>
  );
}

function NotificationScreenBody() {
  const [enabled, setEnabled] = useState(true);
  const [lockScreen, setLockScreen] = useState(true);
  const [banner, setBanner] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [haptics, setHaptics] = useState(true);

  const [messageSource, setMessageSource] = useState<SoundSource>("default");
  const [reminderSource, setReminderSource] = useState<SoundSource>("default");
  const [aiMode, setAiMode] = useState<"follow" | "custom">("follow");
  const [aiSource, setAiSource] = useState<SoundSource>("upload");
  const [voiceSource, setVoiceSource] = useState<SoundSource>("upload");

  return (
    <>
      <SettingsNavBar title="通知与提醒" backLabel="设置" right={null} />
      <div className="ps-scroll">
        {/* G1 通知总设置 */}
        <SettingsSectionTitle>通知总设置</SettingsSectionTitle>
        <SettingsGroup>
          <SettingsToggleRow symbol="bell" title="允许通知" checked={enabled} onChange={setEnabled} />
          <SettingsToggleRow symbol="lock" title="锁屏显示" sub="在锁定屏幕上显示通知" checked={lockScreen} onChange={setLockScreen} />
          <SettingsToggleRow symbol="banner" title="横幅" sub="解锁使用时从顶部下拉显示" checked={banner} onChange={setBanner} />
          <SettingsToggleRow symbol="sound" title="声音" checked={soundOn} onChange={setSoundOn} />
          <SettingsToggleRow symbol="vibrate" title="震动与触感" sub="当前为模拟状态" checked={haptics} onChange={setHaptics} />
        </SettingsGroup>

        {/* G2 消息通知音 */}
        <SettingsSectionTitle>消息通知音</SettingsSectionTitle>
        <SettingsGroup>
          <SettingsRow symbol="message" title="消息通知音" value={messageSource === "default" ? "三全音（默认）" : messageSource === "none" ? "无" : "自定义"} static showChevron={false} />
          <div className="ps-media-block">
            <div className="ps-media-current">
              <PearlSymbol name="sound" size={16} />
              <span className="ps-media-name">{messageSource === "none" ? "静音" : "三全音"}</span>
              <span className="ps-media-meta">mp3 · 0.8s</span>
            </div>
            <SoundSourceChips value={messageSource} onChange={setMessageSource} />
            <MediaActions canDelete={messageSource !== "default"} />
          </div>
        </SettingsGroup>

        {/* G3 提醒通知音 */}
        <SettingsSectionTitle>提醒通知音</SettingsSectionTitle>
        <SettingsGroup>
          <SettingsRow symbol="bell" title="提醒通知音" sub="Reminder · 计划 · AI 跟进" value={reminderSource === "default" ? "默认提醒音" : "自定义"} static showChevron={false} />
          <div className="ps-media-block">
            <SoundSourceChips value={reminderSource} onChange={setReminderSource} />
            <MediaActions canDelete={reminderSource !== "default"} />
          </div>
        </SettingsGroup>

        {/* G4 AI / 角色消息通知音 */}
        <SettingsSectionTitle>AI / 角色消息通知音</SettingsSectionTitle>
        <div className="ps-segmented" role="tablist" aria-label="AI 通知音模式">
          <button type="button" data-active={aiMode === "follow"} onClick={() => setAiMode("follow")}>跟随消息通知音</button>
          <button type="button" data-active={aiMode === "custom"} onClick={() => setAiMode("custom")}>自定义</button>
        </div>
        {aiMode === "custom" ? (
          <SettingsGroup>
            <div className="ps-media-block">
              <SoundSourceChips value={aiSource} onChange={setAiSource} />
              <MediaActions canDelete />
            </div>
          </SettingsGroup>
        ) : null}

        {/* G5 语音提醒 */}
        <SettingsSectionTitle>语音提醒</SettingsSectionTitle>
        <SettingsGroup>
          <SettingsRow symbol="voice" title="语音提醒音频" static showChevron={false} />
          <div className="ps-media-block">
            <p className="ps-empty" style={{ padding: 0 }}>未导入语音音频（支持 URL / 本地上传 / 文件管理器）</p>
            <SoundSourceChips value={voiceSource} onChange={setVoiceSource} />
          </div>
        </SettingsGroup>
        <p className="ps-note">语音 TTS 为后续能力，本轮不伪造；已有语音 API Provider 时可在生产阶段扩展。</p>

        {/* G6 视频提醒媒体 */}
        <SettingsSectionTitle>视频提醒媒体</SettingsSectionTitle>
        <SettingsGroup>
          <div className="ps-media-block">
            <div className="ps-video-placeholder">
              <span className="ps-video-muted-tag">静音预览</span>
              <PearlSymbol name="video" size={18} />
              <span>可选短视频提醒媒体（mp4 / webm）</span>
            </div>
            <SoundSourceChips value="upload" onChange={() => undefined} />
          </div>
        </SettingsGroup>
        <p className="ps-note">
          设置页仅静音预览，不自动播放有声视频，不强制全屏。系统 Push 是否能展示视频取决于浏览器 / PWA 实际能力。
        </p>
      </div>
    </>
  );
}

/* ── 二级页：显示与亮度 + 全局外观 token 联动演示 ── */

function DemoSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <div className="ps-demo-value">{label} · {display}</div>
      <input
        className="ps-demo-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </>
  );
}

function DisplayScreenBody() {
  const [dark, setDark] = useState(true);
  const [strength, setStrength] = useState(0.65);
  const [border, setBorder] = useState(1);
  const [shadow, setShadow] = useState(1);
  const [radius, setRadius] = useState(20);

  const screenStyle: CSSProperties = {
    ["--pearl-glass-strength" as string]: strength,
    ["--ps-border-alpha" as string]: border,
    ["--ps-shadow-strength" as string]: shadow,
    ["--ps-radius" as string]: `${radius}px`,
  };

  return (
    <PearlScreen colorMode={dark ? "dark" : "light"} screenStyle={screenStyle}>
      <SettingsNavBar title="显示与亮度" backLabel="设置" />
      <div className="ps-scroll">
        <SettingsSectionTitle>外观</SettingsSectionTitle>
        <SettingsGroup>
          <SettingsToggleRow
            symbol={dark ? "focus" : "brightness"}
            title="深色模式"
            checked={dark}
            onChange={setDark}
          />
          <SettingsRow symbol="appearance" title="外观与主题" sub="壁纸 · 图标材质 · 字体" />
        </SettingsGroup>

        <SettingsSectionTitle>全局 Pearl Glass（Preview 联动演示）</SettingsSectionTitle>
        <SettingsGroup>
          <SettingsRow symbol="settings" title="玻璃容器实时联动" sub="滑动下方滑杆，本屏所有分组容器同步变化" static showChevron={false} />
        </SettingsGroup>
        <DemoSlider label="Pearl Glass strength" value={strength} min={0} max={1} step={0.01} display={strength.toFixed(2)} onChange={setStrength} />
        <DemoSlider label="边框强度" value={border} min={0} max={1} step={0.05} display={border.toFixed(2)} onChange={setBorder} />
        <DemoSlider label="阴影强度" value={shadow} min={0} max={1.6} step={0.05} display={shadow.toFixed(2)} onChange={setShadow} />
        <DemoSlider label="圆角" value={radius} min={14} max={26} step={1} display={`${radius}px`} onChange={setRadius} />
        <p className="ps-note">
          Preview 仅在本屏写 CSS 变量做视觉验证；production 由 Appearance Bridge 写入 documentElement，
          Settings / 桌面 Dock 与图标 / 锁屏 Widget / 通知横幅 / Sheet 同时联动。
        </p>

        <SettingsSectionTitle>联动目标（production 验收面）</SettingsSectionTitle>
        <SettingsGroup>
          <SettingsRow symbol="settings" title="Settings grouped 容器" value="✓" static showChevron={false} />
          <SettingsRow symbol="character" title="桌面图标 / Dock" sub="production 阶段真机验证" static showChevron={false} />
          <SettingsRow symbol="lock" title="锁屏 Widget / 通知玻璃" sub="production 阶段真机验证" static showChevron={false} />
        </SettingsGroup>
      </div>
    </PearlScreen>
  );
}

/* ── Gallery ── */

export function SettingsPreviewGallery() {
  return (
    <main className="ps-gallery">
      <div className="ps-gallery-banner">
        <strong>T6.5 Settings Visual Rebuild — PREVIEW 视觉确认稿</strong>
        　·　iOS grouped list · Pearl Glass · 黑白灰
        <br />
        本页只做视觉/组件确认，不写入任何设置、不修改 production 代码；确认后再迁移共享组件。
      </div>
      <div className="ps-gallery-grid">
        <div className="ps-stage">
          <div className="ps-stage-label"><b>① Settings 首页</b> · Light</div>
          <PearlScreen colorMode="light"><HomeScreenBody /></PearlScreen>
        </div>

        <div className="ps-stage">
          <div className="ps-stage-label"><b>② Settings 首页</b> · Dark</div>
          <PearlScreen colorMode="dark"><HomeScreenBody /></PearlScreen>
        </div>

        <div className="ps-stage">
          <div className="ps-stage-label"><b>③ 搜索结果</b> · 复用真实 search index</div>
          <PearlScreen colorMode="light"><SearchScreenBody initialQuery="世界" /></PearlScreen>
        </div>

        <div className="ps-stage">
          <div className="ps-stage-label"><b>④ 通知与提醒</b> · G1–G6</div>
          <PearlScreen colorMode="light"><NotificationScreenBody /></PearlScreen>
        </div>

        <div className="ps-stage">
          <div className="ps-stage-label"><b>⑤ 二级页 · 显示与亮度</b> · 全局 token 联动演示（可滑）</div>
          <DisplayScreenBody />
        </div>
      </div>
    </main>
  );
}
